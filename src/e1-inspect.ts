import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { ConditionId } from "./conditions";
import type { E1SealedConstants } from "./e1-l1-constants";
import {
  replayE1NoProviderCheckpointBundle,
  type E1NoProviderCheckpointBundle
} from "./e1-no-provider-runner";
import type { E1OpenSpecProfile } from "./e1-openspec-constants";
import { runE1OpenSpecArchiveStep, type E1OpenSpecArchiveStepRecord } from "./e1-openspec-harness";
import {
  applyE1BaselineOverlay,
  buildMetrics,
  buildSelectedMetrics,
  calculateE1PromptTemplateHash,
  loadE1OraclePackage,
  loadE1TaskPackage,
  mountTaskWorkspace,
  noProviderRunForScoring,
  recordE1BaselineOverlay,
  scoreNoProviderRun,
  type E1TaskPackageNoProviderBundle,
  type E1TaskPackageProviderBundle
} from "./e1-package-runner";
import { hashText } from "./snapshot";

export type E1InspectionMismatch = {
  kind: string;
  detail: string;
};

export type E1InspectionReport = {
  valid: boolean;
  schema_version: string;
  grade: string;
  run_classification: string;
  invalid_run: boolean | "n/a";
  run_status: string;
  replay_steps: number;
  mismatches: E1InspectionMismatch[];
  metrics_by_condition: Partial<Record<ConditionId, number>>;
};

type LoadedBundle =
  | { kind: "provider"; bundle: E1TaskPackageProviderBundle }
  | { kind: "no_provider"; bundle: E1TaskPackageNoProviderBundle };

export async function inspectE1Bundle(input: {
  constants: E1SealedConstants;
  bundlePath: string;
  taskPackagePath: string;
  oraclePackagePath: string;
  tmpRoot: string;
  openspecProfile?: E1OpenSpecProfile;
}): Promise<E1InspectionReport> {
  const mismatches: E1InspectionMismatch[] = [];
  const loaded = loadBundle(JSON.parse(await readFile(input.bundlePath, "utf8")));
  const bundle = loaded.bundle;
  const taskPackage = await loadE1TaskPackage(input.taskPackagePath);
  const oraclePackage = await loadE1OraclePackage(input.oraclePackagePath);

  if (taskPackage.workflow === "openspec" && !input.openspecProfile) {
    throw new Error("Task package declares workflow=openspec; openspecProfile is required for inspection");
  }

  if (taskPackage.workflow !== "openspec" && input.openspecProfile) {
    throw new Error("openspecProfile provided for a task package that does not declare workflow=openspec");
  }

  if (bundle.run_identity.constants_version !== input.constants.version) {
    mismatches.push({
      kind: "constants_version",
      detail: `bundle=${bundle.run_identity.constants_version} loaded=${input.constants.version}; replay rules may differ — inspect with the constants version the run used`
    });
  }

  if (bundle.run_identity.task_package_hash !== taskPackage.package_hash) {
    mismatches.push({
      kind: "task_package_hash",
      detail: `bundle=${bundle.run_identity.task_package_hash} on_disk=${taskPackage.package_hash}`
    });
  }

  if (bundle.run_identity.oracle_package_hash !== oraclePackage.package_hash) {
    mismatches.push({
      kind: "oracle_package_hash",
      detail: `bundle=${bundle.run_identity.oracle_package_hash} on_disk=${oraclePackage.package_hash}`
    });
  }

  const promptTemplateHash = calculateE1PromptTemplateHash(input.constants);

  if (bundle.run_identity.prompt_template_hash !== promptTemplateHash) {
    mismatches.push({
      kind: "prompt_template_hash",
      detail: `bundle=${bundle.run_identity.prompt_template_hash} recomputed=${promptTemplateHash}`
    });
  }

  if (bundle.baseline_overlay) {
    const recomputed = recordE1BaselineOverlay({ files: bundle.baseline_overlay.files });

    if (
      recomputed.files_hash !== bundle.baseline_overlay.files_hash ||
      recomputed.file_count !== bundle.baseline_overlay.file_count
    ) {
      mismatches.push({
        kind: "baseline_overlay",
        detail: `recorded files_hash=${bundle.baseline_overlay.files_hash} recomputed=${recomputed.files_hash}`
      });
    }
  }

  mismatches.push(...verifyContentHashManifest(loaded));

  const conditionBundles = bundlesByCondition(loaded);
  let replaySteps = 0;

  // Replay only proceeds on a matching constants version: a drifted version means the sealed
  // replay rules themselves changed, so workspace-hash comparisons would be meaningless.
  if (bundle.run_identity.constants_version === input.constants.version) {
    for (const [conditionId, checkpointBundles] of Object.entries(conditionBundles) as Array<
      [ConditionId, E1NoProviderCheckpointBundle[]]
    >) {
      if (!checkpointBundles.length) {
        continue;
      }

      const workspacePath = join(input.tmpRoot, "replay-workspaces", conditionId);
      await rm(workspacePath, { recursive: true, force: true });
      await mountTaskWorkspace({ taskPackage, conditionId, workspacePath });

      if (bundle.baseline_overlay) {
        await applyE1BaselineOverlay(workspacePath, { files: bundle.baseline_overlay.files });
      }

      const recordedArchives = [...(openspecArchiveRecords(loaded)[conditionId] ?? [])];

      for (const checkpointBundle of checkpointBundles) {
        const replayed = await replayE1NoProviderCheckpointBundle({
          constants: input.constants,
          workspacePath,
          bundle: checkpointBundle,
          workflowGuards: input.openspecProfile?.workflowGuards
        });

        replaySteps += checkpointBundle.turn_records.length;

        for (const mismatch of replayed.turn_hash_mismatches) {
          mismatches.push({
            kind: "replay_turn_workspace_hash",
            detail: `${conditionId} checkpoint=${checkpointBundle.run_manifest.checkpoint_id} turn=${mismatch.turn_index} expected=${mismatch.expected} actual=${mismatch.actual}`
          });
        }

        if (replayed.final_workspace_hash !== checkpointBundle.final_workspace_hash) {
          mismatches.push({
            kind: "replay_final_workspace_hash",
            detail: `${conditionId} checkpoint=${checkpointBundle.run_manifest.checkpoint_id} expected=${checkpointBundle.final_workspace_hash} actual=${replayed.final_workspace_hash}`
          });
        }

        if (replayed.final_workspace_code_hash !== checkpointBundle.final_workspace_code_hash) {
          mismatches.push({
            kind: "replay_final_workspace_code_hash",
            detail: `${conditionId} checkpoint=${checkpointBundle.run_manifest.checkpoint_id} expected=${checkpointBundle.final_workspace_code_hash} actual=${replayed.final_workspace_code_hash}`
          });
        }

        // The recorded run performed the harness archive step after this checkpoint; replay
        // must re-run it so the carried-forward workspace (and its hashes) stay reproducible.
        const checkpointId = checkpointBundle.run_manifest.checkpoint_id;
        const declaredChange = taskPackage.workflow_changes?.[checkpointId];

        if (declaredChange && recordedArchives[0]?.change_name === declaredChange) {
          const recorded = recordedArchives.shift()!;
          const replayedArchive = await runE1OpenSpecArchiveStep({
            repoRoot: process.cwd(),
            workspacePath,
            changeName: declaredChange
          });

          mismatches.push(
            ...compareArchiveRecords({
              conditionId,
              checkpointId,
              recorded,
              replayed: replayedArchive
            })
          );
        }
      }

      if (recordedArchives.length > 0) {
        mismatches.push({
          kind: "replay_openspec_archive",
          detail: `${conditionId} has ${recordedArchives.length} recorded archive step(s) replay did not reach`
        });
      }
    }

    mismatches.push(
      ...(await verifyOracleScoringAndMetrics({
        constants: input.constants,
        loaded,
        taskPackage,
        oraclePackage,
        tmpRoot: join(input.tmpRoot, "rescore-tmp")
      }))
    );
  }

  return {
    valid: mismatches.length === 0,
    schema_version: bundle.schema_version,
    grade: bundle.grade,
    run_classification: loaded.kind === "provider" ? loaded.bundle.run_classification ?? "missing" : "n/a",
    invalid_run: loaded.kind === "provider" ? loaded.bundle.invalid_run ?? false : "n/a",
    run_status:
      loaded.kind === "provider"
        ? loaded.bundle.provider_run.run_summary.status
        : loaded.bundle.no_provider_run.run_summary.status,
    replay_steps: replaySteps,
    mismatches,
    metrics_by_condition: bundle.metrics.by_condition
  };
}

export function renderE1InspectionLines(report: E1InspectionReport): string[] {
  const lines = [
    `valid=${report.valid}`,
    `schema_version=${report.schema_version}`,
    `grade=${report.grade}`,
    `run_classification=${report.run_classification}`,
    `invalid_run=${report.invalid_run}`,
    `run_status=${report.run_status}`,
    `replay_steps=${report.replay_steps}`,
    `mismatches=${report.mismatches.length}`
  ];

  for (const mismatch of report.mismatches) {
    lines.push(`mismatch=${mismatch.kind}: ${mismatch.detail}`);
  }

  for (const [conditionId, value] of Object.entries(report.metrics_by_condition)) {
    lines.push(`metric.${conditionId}=${value}`);
  }

  return lines;
}

function loadBundle(raw: unknown): LoadedBundle {
  const record = raw as { schema_version?: string };

  if (record.schema_version === "e1-task-package-provider-bundle-v0") {
    return { kind: "provider", bundle: raw as E1TaskPackageProviderBundle };
  }

  if (record.schema_version === "e1-task-package-no-provider-bundle-v0") {
    return { kind: "no_provider", bundle: raw as E1TaskPackageNoProviderBundle };
  }

  throw new Error(`Unsupported E1 bundle schema_version: ${String(record.schema_version)}`);
}

function bundlesByCondition(loaded: LoadedBundle): Partial<Record<ConditionId, E1NoProviderCheckpointBundle[]>> {
  return loaded.kind === "provider"
    ? loaded.bundle.provider_run.condition_bundles
    : loaded.bundle.no_provider_run.arm_bundles;
}

function verifyContentHashManifest(loaded: LoadedBundle): E1InspectionMismatch[] {
  const mismatches: E1InspectionMismatch[] = [];
  const bundle = loaded.bundle;
  const expectedEntries: Record<string, string> =
    loaded.kind === "provider"
      ? {
          provider_run_hash: hashText(JSON.stringify(loaded.bundle.provider_run)),
          oracle_scoring_hash: hashText(JSON.stringify(loaded.bundle.oracle_scoring)),
          metrics_hash: hashText(JSON.stringify(loaded.bundle.metrics)),
          provider_usage_totals_hash: hashText(JSON.stringify(loaded.bundle.provider_usage_totals)),
          ...(loaded.bundle.baseline_overlay
            ? { baseline_overlay_hash: loaded.bundle.baseline_overlay.files_hash }
            : {}),
          ...(loaded.bundle.openspec_workflow
            ? { openspec_workflow_hash: hashText(JSON.stringify(loaded.bundle.openspec_workflow)) }
            : {})
        }
      : {
          no_provider_run_hash: hashText(JSON.stringify(loaded.bundle.no_provider_run)),
          oracle_scoring_hash: hashText(JSON.stringify(loaded.bundle.oracle_scoring)),
          metrics_hash: hashText(JSON.stringify(loaded.bundle.metrics)),
          ...(loaded.bundle.baseline_overlay
            ? { baseline_overlay_hash: loaded.bundle.baseline_overlay.files_hash }
            : {}),
          ...(loaded.bundle.openspec_workflow
            ? { openspec_workflow_hash: hashText(JSON.stringify(loaded.bundle.openspec_workflow)) }
            : {})
        };

  for (const [key, expected] of Object.entries(expectedEntries)) {
    if (bundle.content_hash_manifest[key] !== expected) {
      mismatches.push({
        kind: "content_hash_manifest",
        detail: `${key}: recorded=${bundle.content_hash_manifest[key]} recomputed=${expected}`
      });
    }
  }

  const manifestHash = hashText(JSON.stringify(bundle.content_hash_manifest));

  if (bundle.content_hash_manifest_hash !== manifestHash) {
    mismatches.push({
      kind: "content_hash_manifest_hash",
      detail: `recorded=${bundle.content_hash_manifest_hash} recomputed=${manifestHash}`
    });
  }

  return mismatches;
}

async function verifyOracleScoringAndMetrics(input: {
  constants: E1SealedConstants;
  loaded: LoadedBundle;
  taskPackage: Awaited<ReturnType<typeof loadE1TaskPackage>>;
  oraclePackage: Awaited<ReturnType<typeof loadE1OraclePackage>>;
  tmpRoot: string;
}): Promise<E1InspectionMismatch[]> {
  const mismatches: E1InspectionMismatch[] = [];
  const checkpoints =
    input.loaded.kind === "provider" ? input.loaded.bundle.checkpoints : input.loaded.bundle.no_provider_run.checkpoints;
  const rescored = await scoreNoProviderRun({
    taskPackage: input.taskPackage,
    oraclePackage: input.oraclePackage,
    noProviderRun:
      input.loaded.kind === "provider"
        ? noProviderRunForScoring(
            input.constants,
            checkpoints,
            input.loaded.bundle.provider_run.condition_bundles
          )
        : input.loaded.bundle.no_provider_run,
    tmpRoot: input.tmpRoot
  });

  if (JSON.stringify(rescored) !== JSON.stringify(input.loaded.bundle.oracle_scoring)) {
    mismatches.push({
      kind: "oracle_scoring",
      detail: "re-scored hidden-oracle results differ from the recorded oracle_scoring section"
    });
  }

  const recomputedMetrics =
    input.loaded.kind === "provider"
      ? buildSelectedMetrics(input.constants, input.loaded.bundle.selected_conditions, rescored.checkpoint_end)
      : buildMetrics(input.constants, rescored.checkpoint_end);

  if (JSON.stringify(recomputedMetrics) !== JSON.stringify(input.loaded.bundle.metrics)) {
    mismatches.push({
      kind: "metrics",
      detail: `recomputed=${JSON.stringify(recomputedMetrics)} recorded=${JSON.stringify(input.loaded.bundle.metrics)}`
    });
  }

  return mismatches;
}

function openspecArchiveRecords(
  loaded: LoadedBundle
): Partial<Record<ConditionId, E1OpenSpecArchiveStepRecord[]>> {
  return loaded.bundle.openspec_workflow?.archive_records ?? {};
}

function compareArchiveRecords(input: {
  conditionId: ConditionId;
  checkpointId: string;
  recorded: E1OpenSpecArchiveStepRecord;
  replayed: E1OpenSpecArchiveStepRecord;
}): E1InspectionMismatch[] {
  const mismatches: E1InspectionMismatch[] = [];
  const where = `${input.conditionId} checkpoint=${input.checkpointId} change=${input.recorded.change_name}`;

  if (input.replayed.archive_ok !== input.recorded.archive_ok) {
    mismatches.push({
      kind: "replay_openspec_archive",
      detail: `${where}: archive_ok recorded=${input.recorded.archive_ok} replayed=${input.replayed.archive_ok}`
    });
  }

  if (input.replayed.pre_spec_of_record_hash !== input.recorded.pre_spec_of_record_hash) {
    mismatches.push({
      kind: "replay_openspec_archive",
      detail: `${where}: pre_spec_of_record_hash recorded=${input.recorded.pre_spec_of_record_hash} replayed=${input.replayed.pre_spec_of_record_hash}`
    });
  }

  if (input.replayed.post_spec_of_record_hash !== input.recorded.post_spec_of_record_hash) {
    mismatches.push({
      kind: "replay_openspec_archive",
      detail: `${where}: post_spec_of_record_hash recorded=${input.recorded.post_spec_of_record_hash} replayed=${input.replayed.post_spec_of_record_hash}`
    });
  }

  if (JSON.stringify(input.replayed.survival_ledger) !== JSON.stringify(input.recorded.survival_ledger)) {
    mismatches.push({
      kind: "replay_openspec_archive",
      detail: `${where}: survival ledger diverged from the recorded record`
    });
  }

  return mismatches;
}
