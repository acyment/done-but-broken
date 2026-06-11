import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { dirname, extname, join, resolve } from "node:path";
import type { ConditionId } from "./conditions";
import { validateE1DependencyLockfileBoundary } from "./e1-environment";
import type { E1SealedConstants } from "./e1-l1-constants";
import {
  assembleE1CheckpointConversation,
  runE1NoProviderCheckpoint,
  runE1NoProviderRun,
  validateE1ArmConversationDiff,
  validateE1RuntimeArmParity,
  type E1AgentProvider,
  type E1NoProviderCheckpointBundle,
  type E1CheckpointProviderFactoryInput,
  type E1NoProviderRunBundle
} from "./e1-no-provider-runner";
import type { E1CheckpointPromptInput } from "./e1-no-provider-runner";
import type { E1OpenSpecProfile } from "./e1-openspec-constants";
import {
  runE1OpenSpecArchiveStep,
  validateE1OpenSpecScenarioParity,
  type E1OpenSpecArchiveStepRecord
} from "./e1-openspec-harness";
import {
  collectE1SnapshotFiles,
  renderE1WorkspaceSnapshot,
  renderE1WorkspaceSnapshotFromFiles,
  type E1SnapshotOptions
} from "./e1-workspace-snapshot";
import type { OracleCheckResult } from "./result-schema";
import { hashDirectory, hashText, type WorkspaceCodeSnapshot } from "./snapshot";

export type E1TaskPackage = {
  schema_version: "e1-task-package-v0";
  task_id: string;
  task_version: string;
  virtual_now: string;
  checkpoints: string[];
  package_path: string;
  package_hash: string;
  template_workspace_path: string;
  readme_text: string;
  visible_specs: Record<string, string>;
  feedback_assets: E1TaskFeedbackAsset[];
  workflow?: "openspec";
  workflow_changes?: Record<string, string>;
};

export type E1TaskFeedbackAsset = {
  asset_id: string;
  checkpoint_introduced: string;
  relative_path: string;
  content: string;
};

export type E1OraclePackage = {
  schema_version: "e1-oracle-package-v0";
  task_id: string;
  task_version: string;
  virtual_now: string;
  oracle_kind: "cartcalc-json-v0" | "module-call-json-v1";
  package_path: string;
  package_hash: string;
  cases: E1OracleCase[];
};

export type E1CartCalcOracleCase = {
  check_id: string;
  commitment_id: string;
  checkpoint_introduced: string;
  call: "lineSubtotalCents" | "subtotalCents" | "discountCents" | "totalCents";
  input: unknown;
  expected: number;
};

// Generic oracle case: import entry_module from the captured snapshot, call the named export
// with JSON args, deep-compare the JSON result. held_out cases feed the visible-to-hidden
// generalization-gap metric and score identically.
export type E1ModuleCallOracleCase = {
  check_id: string;
  commitment_id: string;
  checkpoint_introduced: string;
  entry_module: string;
  export: string;
  args: unknown[];
  expected: unknown;
  held_out?: boolean;
};

export type E1OracleCase = E1CartCalcOracleCase | E1ModuleCallOracleCase;

export type E1OracleTurnScore = {
  turn_index: number;
  summary: { passed: number; total: number; pass_rate: number };
  checks: OracleCheckResult[];
};

export type E1TaskPackageNoProviderBundle = {
  schema_version: "e1-task-package-no-provider-bundle-v0";
  grade: "dev" | "evidence";
  run_identity: {
    task_package_hash: string;
    oracle_package_hash: string;
    constants_version: string;
    prompt_template_hash: string;
    model: "scripted";
    seed: "scripted";
  };
  no_provider_run: E1NoProviderRunBundle;
  baseline_overlay?: E1BaselineOverlayRecord;
  openspec_workflow?: E1OpenSpecWorkflowRecord;
  oracle_scoring: {
    cadence: "every_turn_snapshot";
    per_turn: Record<ConditionId, Record<string, E1OracleTurnScore[]>>;
    checkpoint_end: Record<ConditionId, Array<{ checkpoint_id: string; summary: E1OracleTurnScore["summary"] }>>;
  };
  metrics: {
    formula_id: "checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1";
    by_condition: Record<ConditionId, number>;
    delta_feedback_minus_context: number;
  };
  content_hash_manifest: Record<string, string>;
  content_hash_manifest_hash: string;
};

export type E1ProviderUsageTotals = {
  provider: {
    fresh_input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
  };
  estimator: {
    fresh_input_tokens: number;
    output_tokens: number;
  };
  spend: {
    cost_basis: "provider_reported_when_available_else_derived";
    cost_of_record_source: "provider_reported" | "derived";
    pricing_usd_per_million_tokens: {
      input: number;
      cached_input: number;
      output: number;
    } | null;
    provider_reported_spend_usd: number | null;
    derived_spend_usd: number;
    actual_spend_usd: number;
  };
  exchange_count: number;
};

export type E1TaskPackageProviderRunBundle = {
  schema_version: "e1-selected-provider-run-bundle-v0";
  constants_version: string;
  constants_hash: string;
  checkpoints: string[];
  selected_conditions: ConditionId[];
  condition_bundles: Record<ConditionId, E1NoProviderCheckpointBundle[]>;
  run_summary: {
    status: "completed" | "invalid_integrity" | "provider_error" | "spend_cap_reached";
    stopped_at?: { condition_id: ConditionId; checkpoint_id: string };
    provider_error_counts_by_condition: Record<ConditionId, number>;
    spend_cap_reached_counts_by_condition: Record<ConditionId, number>;
  };
};

export const E1_RUN_CLASSIFICATIONS = [
  "calibration",
  "difficulty_probe",
  "causal_pilot",
  "diagnostic_invalid"
] as const;

export type E1RunClassification = (typeof E1_RUN_CLASSIFICATIONS)[number];

// Isolated-competence diagnostics start a single checkpoint from a baseline workspace that
// correctly implements all earlier checkpoints. The overlay is written into both arms after
// mounting and recorded verbatim in the bundle so replay can reproduce the starting state.
export type E1BaselineOverlay = {
  files: Record<string, string>;
};

export type E1BaselineOverlayRecord = {
  file_count: number;
  files: Record<string, string>;
  files_hash: string;
};

export type E1OpenSpecWorkflowRecord = {
  protocol_profile_id: "e1-openspec-workflow-v0";
  profile_version: string;
  openspec_version: string;
  archive_records: Partial<Record<ConditionId, E1OpenSpecArchiveStepRecord[]>>;
  scenario_parity: Array<{ checkpoint_id: string; ok: boolean }>;
};

export type E1TaskPackageProviderBundle = {
  schema_version: "e1-task-package-provider-bundle-v0";
  grade: "dev" | "evidence";
  run_classification: E1RunClassification;
  invalid_run: boolean;
  selected_conditions: ConditionId[];
  checkpoints: string[];
  run_identity: {
    task_package_hash: string;
    oracle_package_hash: string;
    constants_version: string;
    prompt_template_hash: string;
    model_provider: "openai_compatible";
    provider_profile_id: string;
    provider_route_id: string;
    provider_model: string;
    provider_endpoint: string;
    provider_transport_kind: "canned" | "live";
  };
  provider_run: E1TaskPackageProviderRunBundle;
  baseline_overlay?: E1BaselineOverlayRecord;
  openspec_workflow?: E1OpenSpecWorkflowRecord;
  oracle_scoring: E1TaskPackageNoProviderBundle["oracle_scoring"];
  metrics: {
    formula_id: "checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1";
    by_condition: Partial<Record<ConditionId, number>>;
  };
  provider_usage_totals: E1ProviderUsageTotals;
  content_hash_manifest: Record<string, string>;
  content_hash_manifest_hash: string;
};

type TaskPackageJson = {
  schema_version: "e1-task-package-v0";
  task_id: string;
  task_version: string;
  virtual_now: string;
  checkpoints: string[];
  template_workspace: string;
  readme_path: string;
  visible_specs: Record<string, string>;
  feedback_assets: string;
  workflow?: "openspec";
  workflow_changes?: Record<string, string>;
};

type FeedbackAssetManifest = {
  assets: Array<{
    asset_id: string;
    checkpoint_introduced: string;
    relative_path: string;
    source_path: string;
  }>;
};

type OraclePackageJson = {
  schema_version: "e1-oracle-package-v0";
  task_id: string;
  task_version: string;
  virtual_now: string;
  oracle_kind: "cartcalc-json-v0" | "module-call-json-v1";
  cases: string;
};

export async function loadE1TaskPackage(packagePath: string): Promise<E1TaskPackage> {
  const packageRoot = resolve(packagePath);
  await validateNoReachableRealClock(packageRoot);
  const taskJson = await readJson<TaskPackageJson>(join(packageRoot, "task.json"));

  if (taskJson.schema_version !== "e1-task-package-v0") {
    throw new Error("E1 task package schema_version must be e1-task-package-v0");
  }

  assertIsoInstant(taskJson.virtual_now, "task package virtual_now");
  assertCheckpointSpecMap(taskJson.checkpoints, taskJson.visible_specs);

  const feedbackManifestPath = resolveInside(packageRoot, taskJson.feedback_assets);
  const feedbackManifest = await readJson<FeedbackAssetManifest>(feedbackManifestPath);
  const feedbackManifestDir = dirname(feedbackManifestPath);
  const feedbackAssets = await Promise.all(
    feedbackManifest.assets.map(async (asset) => ({
      asset_id: asset.asset_id,
      checkpoint_introduced: asset.checkpoint_introduced,
      relative_path: asset.relative_path,
      content: await readFile(resolveInside(feedbackManifestDir, asset.source_path), "utf8")
    }))
  );
  const visibleSpecs = Object.fromEntries(
    await Promise.all(
      Object.entries(taskJson.visible_specs).map(async ([checkpoint, specPath]) => [
        checkpoint,
        await readFile(resolveInside(packageRoot, specPath), "utf8")
      ])
    )
  );

  return {
    schema_version: taskJson.schema_version,
    task_id: taskJson.task_id,
    task_version: taskJson.task_version,
    virtual_now: taskJson.virtual_now,
    checkpoints: taskJson.checkpoints,
    package_path: packageRoot,
    package_hash: (await hashDirectory(packageRoot)).hash,
    template_workspace_path: resolveInside(packageRoot, taskJson.template_workspace),
    readme_text: await readFile(resolveInside(packageRoot, taskJson.readme_path), "utf8"),
    visible_specs: visibleSpecs,
    feedback_assets: feedbackAssets,
    ...(taskJson.workflow ? { workflow: taskJson.workflow } : {}),
    ...(taskJson.workflow_changes ? { workflow_changes: taskJson.workflow_changes } : {})
  };
}

export async function loadE1OraclePackage(packagePath: string): Promise<E1OraclePackage> {
  const packageRoot = resolve(packagePath);
  await validateNoReachableRealClock(packageRoot);
  const oracleJson = await readJson<OraclePackageJson>(join(packageRoot, "oracle.json"));

  if (oracleJson.schema_version !== "e1-oracle-package-v0") {
    throw new Error("E1 oracle package schema_version must be e1-oracle-package-v0");
  }

  assertIsoInstant(oracleJson.virtual_now, "oracle package virtual_now");

  if (oracleJson.oracle_kind !== "cartcalc-json-v0" && oracleJson.oracle_kind !== "module-call-json-v1") {
    throw new Error(`Unknown E1 oracle kind ${String(oracleJson.oracle_kind)}`);
  }

  return {
    schema_version: oracleJson.schema_version,
    task_id: oracleJson.task_id,
    task_version: oracleJson.task_version,
    virtual_now: oracleJson.virtual_now,
    oracle_kind: oracleJson.oracle_kind,
    package_path: packageRoot,
    package_hash: (await hashDirectory(packageRoot)).hash,
    cases: await readJson<E1OracleCase[]>(resolveInside(packageRoot, oracleJson.cases))
  };
}

export async function validateNoReachableRealClock(root: string): Promise<void> {
  const files = await collectFiles(root);
  const banned = ["Date.now", "new Date()", "performance.now"];

  for (const file of files) {
    if (![".ts", ".js", ".mjs", ".cjs", ".json", ".md"].includes(extname(file))) {
      continue;
    }

    const content = await readFile(file, "utf8");
    const found = banned.find((pattern) => content.includes(pattern));

    if (found) {
      throw new Error(`Package file ${file} references real clock API ${found}`);
    }
  }
}

export function calculateE1CheckpointMeanPassRateAuc(
  checkpointSummaries: Array<{ checkpoint_id: string; passed: number; total: number }>
): number {
  if (checkpointSummaries.length === 0) {
    return 0;
  }

  return (
    checkpointSummaries.reduce(
      (sum, summary) => sum + (summary.total === 0 ? 0 : summary.passed / summary.total),
      0
    ) / checkpointSummaries.length
  );
}

export async function runE1TaskPackageNoProvider(input: {
  constants: E1SealedConstants;
  taskPackage: E1TaskPackage;
  oraclePackage: E1OraclePackage;
  runsRoot: string;
  runId: string;
  protocolDocumentHash?: string;
  openspecProfile?: E1OpenSpecProfile;
  baselineOverlay?: E1BaselineOverlay;
  arms: Record<ConditionId, (input: E1CheckpointProviderFactoryInput) => E1AgentProvider>;
}): Promise<E1TaskPackageNoProviderBundle> {
  await validateE1DependencyLockfileBoundary(process.cwd());
  assertPackageCompatibility(input.taskPackage, input.oraclePackage);
  const openspecProfile = assertOpenSpecProfileForWorkflow(input.taskPackage, input.openspecProfile);
  const snapshotOptions: E1SnapshotOptions | undefined = openspecProfile
    ? {
        includedRoots: openspecProfile.snapshotIncludedRoots,
        excludedPathPrefixes: openspecProfile.snapshotExcludedPathPrefixes
      }
    : undefined;
  const openspecRecord = openspecProfile ? emptyOpenSpecWorkflowRecord(openspecProfile) : undefined;
  const baselineRecord = input.baselineOverlay ? recordE1BaselineOverlay(input.baselineOverlay) : undefined;
  const promptTemplateHash = calculateE1PromptTemplateHash(input.constants);
  const runRoot = join(input.runsRoot, input.runId);
  const workspaceRoot = join(runRoot, "workspaces");
  const contextWorkspace = join(workspaceRoot, "context_only_spec");
  const feedbackWorkspace = join(workspaceRoot, "feedback_capable_spec");

  await mountTaskWorkspace({
    taskPackage: input.taskPackage,
    conditionId: "context_only_spec",
    workspacePath: contextWorkspace
  });
  await mountTaskWorkspace({
    taskPackage: input.taskPackage,
    conditionId: "feedback_capable_spec",
    workspacePath: feedbackWorkspace
  });

  if (input.baselineOverlay) {
    await applyE1BaselineOverlay(contextWorkspace, input.baselineOverlay);
    await applyE1BaselineOverlay(feedbackWorkspace, input.baselineOverlay);
  }

  await validateAllCheckpointPromptDiffs(input.constants, input.taskPackage, snapshotOptions);

  const noProviderRun = await runE1NoProviderRun({
    constants: input.constants,
    checkpoints: input.taskPackage.checkpoints,
    arms: [
      {
        conditionId: "context_only_spec",
        workspacePath: contextWorkspace,
        providerFactory: input.arms.context_only_spec
      },
      {
        conditionId: "feedback_capable_spec",
        workspacePath: feedbackWorkspace,
        providerFactory: input.arms.feedback_capable_spec
      }
    ],
    promptFactory: ({ conditionId, checkpointId }) => buildPrompt({
      taskPackage: input.taskPackage,
      conditionId,
      checkpointId,
      workspacePath: conditionId === "context_only_spec" ? contextWorkspace : feedbackWorkspace,
      snapshotOptions
    }),
    artifactDir: join(runRoot, "e1-no-provider-run"),
    workflowGuards: openspecProfile?.workflowGuards,
    checkpointHooks: openspecProfile
      ? {
          before: async ({ checkpointId, checkpointIndex }) => {
            const parity = await validateE1OpenSpecScenarioParity({
              contextWorkspacePath: contextWorkspace,
              feedbackWorkspacePath: feedbackWorkspace
            });
            openspecRecord!.scenario_parity.push({ checkpoint_id: checkpointId, ok: parity.ok });

            // Fresh mounts must be canonically identical; from the first agent-maintained
            // checkpoint onward, spec-of-record divergence is measured outcome (the survival
            // ledger), not a parity violation.
            if (checkpointIndex === 0 && !parity.ok) {
              throw new Error(
                `OpenSpec scenario parity failed at fresh mount for checkpoint ${checkpointId}: ${JSON.stringify(parity)}`
              );
            }
          },
          afterArm: async ({ conditionId, checkpointId, workspacePath }) => {
            await runOpenSpecAfterArmStep({
              profile: openspecProfile,
              record: openspecRecord!,
              taskPackage: input.taskPackage,
              conditionId,
              checkpointId,
              workspacePath
            });
          }
        }
      : undefined
  });
  const oracleScoring = await scoreNoProviderRun({
    taskPackage: input.taskPackage,
    oraclePackage: input.oraclePackage,
    noProviderRun,
    tmpRoot: join(runRoot, "oracle-tmp")
  });
  const metrics = buildMetrics(input.constants, oracleScoring.checkpoint_end);
  const contentHashManifest = {
    task_package_hash: input.taskPackage.package_hash,
    oracle_package_hash: input.oraclePackage.package_hash,
    prompt_template_hash: promptTemplateHash,
    no_provider_run_hash: hashText(JSON.stringify(noProviderRun)),
    oracle_scoring_hash: hashText(JSON.stringify(oracleScoring)),
    metrics_hash: hashText(JSON.stringify(metrics)),
    ...(baselineRecord ? { baseline_overlay_hash: baselineRecord.files_hash } : {}),
    ...(openspecRecord ? { openspec_workflow_hash: hashText(JSON.stringify(openspecRecord)) } : {})
  };
  const bundle: E1TaskPackageNoProviderBundle = {
    schema_version: "e1-task-package-no-provider-bundle-v0",
    grade: bundleGrade(input.constants, input.protocolDocumentHash),
    run_identity: {
      task_package_hash: input.taskPackage.package_hash,
      oracle_package_hash: input.oraclePackage.package_hash,
      constants_version: input.constants.version,
      prompt_template_hash: promptTemplateHash,
      model: "scripted",
      seed: "scripted"
    },
    no_provider_run: noProviderRun,
    ...(baselineRecord ? { baseline_overlay: baselineRecord } : {}),
    ...(openspecRecord ? { openspec_workflow: openspecRecord } : {}),
    oracle_scoring: oracleScoring,
    metrics,
    content_hash_manifest: contentHashManifest,
    content_hash_manifest_hash: hashText(JSON.stringify(contentHashManifest))
  };

  await writeFile(join(runRoot, "e1-task-package-bundle.json"), `${JSON.stringify(bundle, null, 2)}\n`);

  return bundle;
}

export async function runE1TaskPackageProvider(input: {
  constants: E1SealedConstants;
  taskPackage: E1TaskPackage;
  oraclePackage: E1OraclePackage;
  runsRoot: string;
  runId: string;
  protocolDocumentHash?: string;
  conditions: ConditionId[];
  checkpoints?: string[];
  runClassification?: E1RunClassification;
  openspecProfile?: E1OpenSpecProfile;
  baselineOverlay?: E1BaselineOverlay;
  providerFactory: (input: E1CheckpointProviderFactoryInput) => E1AgentProvider;
  maxModelTurns?: number;
  maxVerificationExecutions?: number;
  maxCheckpointTokens?: number;
  redactionSecrets?: Array<{ id: string; value: string }>;
}): Promise<E1TaskPackageProviderBundle> {
  await validateE1DependencyLockfileBoundary(process.cwd());
  assertPackageCompatibility(input.taskPackage, input.oraclePackage);
  assertSelectedConditions(input.conditions);
  const runClassification = input.runClassification ?? "calibration";

  if (!E1_RUN_CLASSIFICATIONS.includes(runClassification)) {
    throw new Error(`Unknown E1 run classification ${String(runClassification)}`);
  }

  const checkpoints = input.checkpoints ?? input.taskPackage.checkpoints;
  assertSelectedCheckpoints(input.taskPackage, checkpoints);
  const openspecProfile = assertOpenSpecProfileForWorkflow(input.taskPackage, input.openspecProfile);
  const snapshotOptions: E1SnapshotOptions | undefined = openspecProfile
    ? {
        includedRoots: openspecProfile.snapshotIncludedRoots,
        excludedPathPrefixes: openspecProfile.snapshotExcludedPathPrefixes
      }
    : undefined;
  const openspecRecord = openspecProfile ? emptyOpenSpecWorkflowRecord(openspecProfile) : undefined;
  const baselineRecord = input.baselineOverlay ? recordE1BaselineOverlay(input.baselineOverlay) : undefined;
  const promptTemplateHash = calculateE1PromptTemplateHash(input.constants);
  const runRoot = join(input.runsRoot, input.runId);
  const workspaceRoot = join(runRoot, "workspaces");
  const conditionBundles = emptyCheckpointBundleRecord();
  const providerErrorCounts = emptyConditionNumberRecord();
  const spendCapReachedCounts = emptyConditionNumberRecord();
  let stoppedAt: { condition_id: ConditionId; checkpoint_id: string } | undefined;
  let runStatus: E1TaskPackageProviderRunBundle["run_summary"]["status"] = "completed";

  await mkdir(runRoot, { recursive: true });
  await validateAllCheckpointPromptDiffs(input.constants, input.taskPackage, snapshotOptions);

  for (const conditionId of input.conditions) {
    await mountTaskWorkspace({
      taskPackage: input.taskPackage,
      conditionId,
      workspacePath: join(workspaceRoot, conditionId)
    });

    if (input.baselineOverlay) {
      await applyE1BaselineOverlay(join(workspaceRoot, conditionId), input.baselineOverlay);
    }
  }

  for (let checkpointIndex = 0; checkpointIndex < checkpoints.length; checkpointIndex += 1) {
    const checkpointId = checkpoints[checkpointIndex];
    const promptsByCondition = {} as Record<ConditionId, E1CheckpointPromptInput>;

    if (openspecRecord && input.conditions.length === 2) {
      const parity = await validateE1OpenSpecScenarioParity({
        contextWorkspacePath: join(workspaceRoot, "context_only_spec"),
        feedbackWorkspacePath: join(workspaceRoot, "feedback_capable_spec")
      });
      openspecRecord.scenario_parity.push({ checkpoint_id: checkpointId, ok: parity.ok });

      // Fresh mounts must be canonically identical; later divergence is measured outcome.
      if (checkpointIndex === 0 && !parity.ok) {
        throw new Error(
          `OpenSpec scenario parity failed at fresh mount for checkpoint ${checkpointId}: ${JSON.stringify(parity)}`
        );
      }
    }

    for (const conditionId of input.conditions) {
      promptsByCondition[conditionId] = await buildPrompt({
        taskPackage: input.taskPackage,
        conditionId,
        checkpointId,
        workspacePath: join(workspaceRoot, conditionId),
        snapshotOptions
      });
    }

    if (input.conditions.length === 2) {
      validateE1RuntimeArmParity({
        constants: input.constants,
        checkpointId,
        checkpoints,
        promptsByCondition
      });
    }

    for (const conditionId of input.conditions) {
      const checkpointBundle = await runE1NoProviderCheckpoint({
        constants: input.constants,
        workspacePath: join(workspaceRoot, conditionId),
        conditionId,
        checkpointId,
        checkpoints,
        provider: input.providerFactory({ conditionId, checkpointId, checkpointIndex }),
        prompt: promptsByCondition[conditionId],
        artifactDir: join(runRoot, "e1-provider-run", conditionId, `checkpoint-${checkpointId}`),
        maxModelTurns: input.maxModelTurns,
        maxVerificationExecutions: input.maxVerificationExecutions,
        maxCheckpointTokens: input.maxCheckpointTokens,
        redactionSecrets: input.redactionSecrets,
        workflowGuards: openspecProfile?.workflowGuards
      });

      conditionBundles[conditionId].push(checkpointBundle);

      if (
        openspecProfile &&
        openspecRecord &&
        checkpointBundle.termination?.classification !== "invalid_integrity" &&
        checkpointBundle.termination?.classification !== "provider_error" &&
        checkpointBundle.termination?.classification !== "spend_cap_reached"
      ) {
        await runOpenSpecAfterArmStep({
          profile: openspecProfile,
          record: openspecRecord,
          taskPackage: input.taskPackage,
          conditionId,
          checkpointId,
          workspacePath: join(workspaceRoot, conditionId)
        });
      }

      if (checkpointBundle.termination?.classification === "provider_error") {
        providerErrorCounts[conditionId] += 1;
        runStatus = "provider_error";
        stoppedAt = { condition_id: conditionId, checkpoint_id: checkpointId };
        break;
      }

      if (checkpointBundle.termination?.classification === "spend_cap_reached") {
        spendCapReachedCounts[conditionId] += 1;
        runStatus = "spend_cap_reached";
        stoppedAt = { condition_id: conditionId, checkpoint_id: checkpointId };
        break;
      }

      if (checkpointBundle.termination?.classification === "invalid_integrity") {
        runStatus = "invalid_integrity";
        stoppedAt = { condition_id: conditionId, checkpoint_id: checkpointId };
        break;
      }
    }

    if (stoppedAt) {
      break;
    }
  }

  const providerRun: E1TaskPackageProviderRunBundle = {
    schema_version: "e1-selected-provider-run-bundle-v0",
    constants_version: input.constants.version,
    constants_hash: hashText(JSON.stringify(input.constants)),
    checkpoints,
    selected_conditions: input.conditions,
    condition_bundles: conditionBundles,
    run_summary: {
      status: runStatus,
      ...(stoppedAt ? { stopped_at: stoppedAt } : {}),
      provider_error_counts_by_condition: providerErrorCounts,
      spend_cap_reached_counts_by_condition: spendCapReachedCounts
    }
  };
  const oracleScoring = await scoreNoProviderRun({
    taskPackage: input.taskPackage,
    oraclePackage: input.oraclePackage,
    noProviderRun: noProviderRunForScoring(input.constants, checkpoints, conditionBundles),
    tmpRoot: join(runRoot, "oracle-tmp")
  });
  const metrics = buildSelectedMetrics(input.constants, input.conditions, oracleScoring.checkpoint_end);
  const providerUsageTotals = aggregateProviderUsage(conditionBundles);
  const providerIdentity = extractOpenAICompatibleRunIdentity(conditionBundles);
  const contentHashManifest = {
    task_package_hash: input.taskPackage.package_hash,
    oracle_package_hash: input.oraclePackage.package_hash,
    prompt_template_hash: promptTemplateHash,
    provider_run_hash: hashText(JSON.stringify(providerRun)),
    oracle_scoring_hash: hashText(JSON.stringify(oracleScoring)),
    metrics_hash: hashText(JSON.stringify(metrics)),
    provider_usage_totals_hash: hashText(JSON.stringify(providerUsageTotals)),
    ...(baselineRecord ? { baseline_overlay_hash: baselineRecord.files_hash } : {}),
    ...(openspecRecord ? { openspec_workflow_hash: hashText(JSON.stringify(openspecRecord)) } : {})
  };
  const bundle: E1TaskPackageProviderBundle = {
    schema_version: "e1-task-package-provider-bundle-v0",
    grade: bundleGrade(input.constants, input.protocolDocumentHash),
    run_classification: runClassification,
    invalid_run: runStatus !== "completed",
    selected_conditions: input.conditions,
    checkpoints,
    run_identity: {
      task_package_hash: input.taskPackage.package_hash,
      oracle_package_hash: input.oraclePackage.package_hash,
      constants_version: input.constants.version,
      prompt_template_hash: promptTemplateHash,
      model_provider: "openai_compatible",
      ...providerIdentity
    },
    provider_run: providerRun,
    ...(baselineRecord ? { baseline_overlay: baselineRecord } : {}),
    ...(openspecRecord ? { openspec_workflow: openspecRecord } : {}),
    oracle_scoring: oracleScoring,
    metrics,
    provider_usage_totals: providerUsageTotals,
    content_hash_manifest: contentHashManifest,
    content_hash_manifest_hash: hashText(JSON.stringify(contentHashManifest))
  };

  await writeFile(join(runRoot, "e1-task-package-provider-bundle.json"), `${JSON.stringify(bundle, null, 2)}\n`);

  return bundle;
}

export function calculateE1PromptTemplateHash(constants: E1SealedConstants): string {
  const placeholder = {
    taskId: "<task-id>",
    visibleSpecText: "<cumulative-visible-spec>",
    checkpointSpecText: "<checkpoint-visible-spec>",
    workspaceSnapshotText: "<workspace-snapshot>",
    readmeText: "<readme>",
    feedbackAssetPaths: ["<feedback-asset-path>"]
  };

  return hashText(
    JSON.stringify({
      context_only_spec: assembleE1CheckpointConversation({
        constants,
        conditionId: "context_only_spec",
        checkpointId: "<checkpoint>",
        checkpoints: ["<checkpoint>"],
        ...placeholder,
        feedbackAssetPaths: undefined
      }),
      feedback_capable_spec: assembleE1CheckpointConversation({
        constants,
        conditionId: "feedback_capable_spec",
        checkpointId: "<checkpoint>",
        checkpoints: ["<checkpoint>"],
        ...placeholder
      })
    })
  );
}

export async function mountTaskWorkspace(input: {
  taskPackage: E1TaskPackage;
  conditionId: ConditionId;
  workspacePath: string;
}): Promise<void> {
  await cp(input.taskPackage.template_workspace_path, input.workspacePath, { recursive: true });
  await mkdir(join(input.workspacePath, "scratch"), { recursive: true });

  if (input.conditionId !== "feedback_capable_spec") {
    return;
  }

  for (const asset of input.taskPackage.feedback_assets) {
    const target = resolveInside(input.workspacePath, asset.relative_path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, asset.content);
  }
}

async function validateAllCheckpointPromptDiffs(
  constants: E1SealedConstants,
  taskPackage: E1TaskPackage,
  snapshotOptions?: E1SnapshotOptions
): Promise<void> {
  // Static fresh-mount parity: synthesize each arm's checkpoint-start snapshot from the
  // template workspace (plus mounted feedback assets for the feedback arm) so every
  // checkpoint's template content is validated before any agent turn exists.
  const templateFiles = await collectE1SnapshotFiles(taskPackage.template_workspace_path, snapshotOptions);
  const feedbackAssetPaths = taskPackage.feedback_assets.map((asset) => asset.relative_path);
  const feedbackFiles = {
    ...templateFiles,
    ...Object.fromEntries(taskPackage.feedback_assets.map((asset) => [asset.relative_path, asset.content]))
  };
  const contextSnapshot = renderE1WorkspaceSnapshotFromFiles(templateFiles, snapshotOptions);
  const feedbackSnapshot = renderE1WorkspaceSnapshotFromFiles(feedbackFiles, snapshotOptions);

  for (const checkpointId of taskPackage.checkpoints) {
    const context = assembleE1CheckpointConversation({
      constants,
      conditionId: "context_only_spec",
      checkpointId,
      checkpoints: taskPackage.checkpoints,
      ...buildStaticPrompt({ taskPackage, conditionId: "context_only_spec", checkpointId }),
      workspaceSnapshotText: contextSnapshot.text
    });
    const feedback = assembleE1CheckpointConversation({
      constants,
      conditionId: "feedback_capable_spec",
      checkpointId,
      checkpoints: taskPackage.checkpoints,
      ...buildStaticPrompt({ taskPackage, conditionId: "feedback_capable_spec", checkpointId }),
      workspaceSnapshotText: feedbackSnapshot.text
    });
    const diff = validateE1ArmConversationDiff({ constants, context, feedback, feedbackAssetPaths });

    if (!diff.ok) {
      throw new Error(`E1 prompt parity failed for ${checkpointId}: ${JSON.stringify(diff)}`);
    }
  }
}

async function buildPrompt(input: {
  taskPackage: E1TaskPackage;
  conditionId: ConditionId;
  checkpointId: string;
  workspacePath: string;
  snapshotOptions?: E1SnapshotOptions;
}): Promise<E1CheckpointPromptInput> {
  const snapshot = await renderE1WorkspaceSnapshot(input.workspacePath, input.snapshotOptions);

  return {
    ...buildStaticPrompt(input),
    workspaceSnapshotText: snapshot.text,
    workspaceSnapshotHash: snapshot.hash
  };
}

function buildStaticPrompt(input: {
  taskPackage: E1TaskPackage;
  conditionId: ConditionId;
  checkpointId: string;
}): E1CheckpointPromptInput {
  return {
    taskId: input.taskPackage.task_id,
    visibleSpecText: cumulativeVisibleSpec(input.taskPackage, input.checkpointId),
    checkpointSpecText: input.taskPackage.visible_specs[input.checkpointId],
    workspaceSnapshotText: "(rendered at checkpoint start)",
    readmeText: input.taskPackage.readme_text,
    feedbackAssetPaths:
      input.conditionId === "feedback_capable_spec"
        ? input.taskPackage.feedback_assets.map((asset) => asset.relative_path)
        : undefined
  };
}

function cumulativeVisibleSpec(taskPackage: E1TaskPackage, checkpointId: string): string {
  const index = checkpointIndex(taskPackage.checkpoints, checkpointId);

  return taskPackage.checkpoints
    .slice(0, index + 1)
    .map((checkpoint) => inputSpec(taskPackage, checkpoint))
    .join("\n\n");
}

function inputSpec(taskPackage: E1TaskPackage, checkpointId: string): string {
  const spec = taskPackage.visible_specs[checkpointId];

  if (!spec) {
    throw new Error(`Missing visible spec for ${checkpointId}`);
  }

  return spec;
}

export async function scoreNoProviderRun(input: {
  taskPackage: E1TaskPackage;
  oraclePackage: E1OraclePackage;
  noProviderRun: E1NoProviderRunBundle;
  tmpRoot: string;
}): Promise<E1TaskPackageNoProviderBundle["oracle_scoring"]> {
  const perTurn = {
    context_only_spec: {},
    feedback_capable_spec: {}
  } as Record<ConditionId, Record<string, E1OracleTurnScore[]>>;
  const checkpointEnd = {
    context_only_spec: [],
    feedback_capable_spec: []
  } as Record<ConditionId, Array<{ checkpoint_id: string; summary: E1OracleTurnScore["summary"] }>>;

  for (const conditionId of Object.keys(input.noProviderRun.arm_bundles) as ConditionId[]) {
    for (const checkpointBundle of input.noProviderRun.arm_bundles[conditionId]) {
      const checkpointScores: E1OracleTurnScore[] = [];

      for (const turn of checkpointBundle.turn_records) {
        checkpointScores.push(
          await scoreWorkspaceCodeSnapshot({
            taskPackage: input.taskPackage,
            oraclePackage: input.oraclePackage,
            checkpointId: checkpointBundle.run_manifest.checkpoint_id,
            snapshot: turn.workspace_after_code,
            tmpRoot: join(
              input.tmpRoot,
              conditionId,
              checkpointBundle.run_manifest.checkpoint_id,
              `turn-${turn.turn_index}`
            )
          })
        );
      }

      perTurn[conditionId][checkpointBundle.run_manifest.checkpoint_id] = checkpointScores;
      checkpointEnd[conditionId].push({
        checkpoint_id: checkpointBundle.run_manifest.checkpoint_id,
        summary: checkpointScores.at(-1)?.summary ?? { passed: 0, total: 0, pass_rate: 0 }
      });
    }
  }

  return {
    cadence: "every_turn_snapshot",
    per_turn: perTurn,
    checkpoint_end: checkpointEnd
  };
}

async function scoreWorkspaceCodeSnapshot(input: {
  taskPackage: E1TaskPackage;
  oraclePackage: E1OraclePackage;
  checkpointId: string;
  snapshot: WorkspaceCodeSnapshot;
  tmpRoot: string;
}): Promise<E1OracleTurnScore> {
  await mkdir(join(input.tmpRoot, "src"), { recursive: true });
  await writeFile(join(input.tmpRoot, "package.json"), "{\"type\":\"module\"}\n");

  for (const [path, file] of Object.entries(input.snapshot.files)) {
    const target = join(input.tmpRoot, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content);
  }

  const cases = cumulativeCases(input.taskPackage, input.oraclePackage, input.checkpointId);
  const checks =
    input.oraclePackage.oracle_kind === "module-call-json-v1"
      ? await runE1ModuleCallCases({
          snapshotRoot: input.tmpRoot,
          cases: cases as E1ModuleCallOracleCase[]
        })
      : await runCartCalcCases({
          modulePath: join(input.tmpRoot, "src", "cartcalc.ts"),
          cases: cases as E1CartCalcOracleCase[]
        });
  const passed = checks.filter((check) => check.passed).length;

  return {
    turn_index: Number(input.tmpRoot.split("turn-").at(-1) ?? 0),
    summary: {
      passed,
      total: checks.length,
      pass_rate: checks.length === 0 ? 0 : passed / checks.length
    },
    checks
  };
}

async function runCartCalcCases(input: {
  modulePath: string;
  cases: E1CartCalcOracleCase[];
}): Promise<OracleCheckResult[]> {
  let module: Record<string, (...args: never[]) => unknown>;

  try {
    module = (await import(pathToFileURL(input.modulePath).href)) as Record<string, (...args: never[]) => unknown>;
  } catch (error) {
    return input.cases.map((testCase) => ({
      check_id: testCase.check_id,
      commitment_id: testCase.commitment_id,
      passed: false,
      details: `module import failed: ${String(error)}`
    }));
  }

  return input.cases.map((testCase) => {
    try {
      const actual = evaluateCartCalcCase(module, testCase);

      return {
        check_id: testCase.check_id,
        commitment_id: testCase.commitment_id,
        passed: actual === testCase.expected,
        details: `expected ${testCase.expected}, got ${String(actual)}`
      };
    } catch (error) {
      return {
        check_id: testCase.check_id,
        commitment_id: testCase.commitment_id,
        passed: false,
        details: String(error)
      };
    }
  });
}

function evaluateCartCalcCase(module: Record<string, (...args: never[]) => unknown>, testCase: E1CartCalcOracleCase): number {
  const fn = module[testCase.call];

  if (typeof fn !== "function") {
    throw new Error(`Missing exported function ${testCase.call}`);
  }

  if (testCase.call === "lineSubtotalCents") {
    return fn(testCase.input as never) as number;
  }

  if (testCase.call === "subtotalCents") {
    return fn(testCase.input as never) as number;
  }

  return fn(testCase.input as never) as number;
}

export async function runE1ModuleCallCases(input: {
  snapshotRoot: string;
  cases: E1ModuleCallOracleCase[];
}): Promise<OracleCheckResult[]> {
  const moduleCache = new Map<string, Record<string, unknown> | { import_error: string }>();
  const results: OracleCheckResult[] = [];

  for (const testCase of input.cases) {
    const modulePath = resolveInside(input.snapshotRoot, testCase.entry_module);
    let module = moduleCache.get(modulePath);

    if (!module) {
      try {
        module = (await import(pathToFileURL(modulePath).href)) as Record<string, unknown>;
      } catch (error) {
        module = { import_error: String(error) };
      }

      moduleCache.set(modulePath, module);
    }

    if ("import_error" in module && typeof module.import_error === "string") {
      results.push({
        check_id: testCase.check_id,
        commitment_id: testCase.commitment_id,
        passed: false,
        details: `module import failed: ${module.import_error}`
      });
      continue;
    }

    const fn = (module as Record<string, unknown>)[testCase.export];

    if (typeof fn !== "function") {
      results.push({
        check_id: testCase.check_id,
        commitment_id: testCase.commitment_id,
        passed: false,
        details: `missing exported function ${testCase.export}`
      });
      continue;
    }

    try {
      const actual = (fn as (...args: unknown[]) => unknown)(...structuredClone(testCase.args));
      const passed = jsonDeepEqual(actual, testCase.expected);

      results.push({
        check_id: testCase.check_id,
        commitment_id: testCase.commitment_id,
        passed,
        details: passed
          ? "ok"
          : `expected ${JSON.stringify(testCase.expected)}, got ${JSON.stringify(actual)}`
      });
    } catch (error) {
      results.push({
        check_id: testCase.check_id,
        commitment_id: testCase.commitment_id,
        passed: false,
        details: String(error)
      });
    }
  }

  return results;
}

export function jsonDeepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => jsonDeepEqual(item, right[index]));
  }

  if (
    typeof left === "object" &&
    typeof right === "object" &&
    left !== null &&
    right !== null &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();

    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key, index) =>
          key === rightKeys[index] &&
          jsonDeepEqual((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key])
      )
    );
  }

  return false;
}

function cumulativeCases(
  taskPackage: E1TaskPackage,
  oraclePackage: E1OraclePackage,
  checkpointId: string
): E1OracleCase[] {
  const targetIndex = checkpointIndex(taskPackage.checkpoints, checkpointId);

  return oraclePackage.cases.filter(
    (testCase) => checkpointIndex(taskPackage.checkpoints, testCase.checkpoint_introduced) <= targetIndex
  );
}

export function buildMetrics(
  constants: E1SealedConstants,
  checkpointEnd: E1TaskPackageNoProviderBundle["oracle_scoring"]["checkpoint_end"]
): E1TaskPackageNoProviderBundle["metrics"] {
  const byCondition = {
    context_only_spec: calculateE1CheckpointMeanPassRateAuc(checkpointEnd.context_only_spec.map(flattenSummary)),
    feedback_capable_spec: calculateE1CheckpointMeanPassRateAuc(checkpointEnd.feedback_capable_spec.map(flattenSummary))
  };

  return {
    formula_id: constants.metrics.regression_free_auc.formula_id,
    by_condition: byCondition,
    delta_feedback_minus_context: byCondition.feedback_capable_spec - byCondition.context_only_spec
  };
}

export function buildSelectedMetrics(
  constants: E1SealedConstants,
  conditions: ConditionId[],
  checkpointEnd: E1TaskPackageNoProviderBundle["oracle_scoring"]["checkpoint_end"]
): E1TaskPackageProviderBundle["metrics"] {
  const byCondition: Partial<Record<ConditionId, number>> = {};

  for (const conditionId of conditions) {
    byCondition[conditionId] = calculateE1CheckpointMeanPassRateAuc(
      checkpointEnd[conditionId].map(flattenSummary)
    );
  }

  return {
    formula_id: constants.metrics.regression_free_auc.formula_id,
    by_condition: byCondition
  };
}

function aggregateProviderUsage(
  conditionBundles: Record<ConditionId, E1NoProviderCheckpointBundle[]>
): E1ProviderUsageTotals {
  const totals: E1ProviderUsageTotals = {
    provider: {
      fresh_input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0
    },
    estimator: {
      fresh_input_tokens: 0,
      output_tokens: 0
    },
    spend: {
      cost_basis: "provider_reported_when_available_else_derived",
      cost_of_record_source: "derived",
      pricing_usd_per_million_tokens: null,
      provider_reported_spend_usd: null,
      derived_spend_usd: 0,
      actual_spend_usd: 0
    },
    exchange_count: 0
  };

  for (const bundles of Object.values(conditionBundles)) {
    for (const bundle of bundles) {
      for (const turn of bundle.turn_records) {
        totals.provider.fresh_input_tokens += turn.provider_usage?.provider.fresh_input_tokens ?? 0;
        totals.provider.cached_input_tokens += turn.provider_usage?.provider.cached_input_tokens ?? 0;
        totals.provider.output_tokens += turn.provider_usage?.provider.output_tokens ?? 0;
        totals.estimator.fresh_input_tokens += turn.provider_usage?.estimator.fresh_input_tokens ?? 0;
        totals.estimator.output_tokens += turn.provider_usage?.estimator.output_tokens ?? 0;
        totals.spend.pricing_usd_per_million_tokens ??=
          turn.provider_spend?.pricing_usd_per_million_tokens ?? null;
        totals.spend.derived_spend_usd = roundUsd(
          totals.spend.derived_spend_usd + (turn.provider_spend?.derived_call_cost_usd ?? 0)
        );
        if (turn.provider_spend?.provider_reported_cost_usd !== undefined) {
          totals.spend.provider_reported_spend_usd = roundUsd(
            (totals.spend.provider_reported_spend_usd ?? 0) + turn.provider_spend.provider_reported_cost_usd
          );
        }
        totals.spend.actual_spend_usd = roundUsd(
          totals.spend.actual_spend_usd + (turn.provider_spend?.actual_call_cost_usd ?? 0)
        );
        totals.exchange_count += turn.provider_exchange ? 1 : 0;
      }
    }
  }

  totals.spend.cost_of_record_source =
    totals.spend.provider_reported_spend_usd === null ? "derived" : "provider_reported";

  return totals;
}

function extractOpenAICompatibleRunIdentity(
  conditionBundles: Record<ConditionId, E1NoProviderCheckpointBundle[]>
): Pick<
  E1TaskPackageProviderBundle["run_identity"],
  "provider_profile_id" | "provider_route_id" | "provider_model" | "provider_endpoint" | "provider_transport_kind"
> {
  let identity:
    | Pick<
        E1TaskPackageProviderBundle["run_identity"],
        "provider_profile_id" | "provider_route_id" | "provider_model" | "provider_endpoint" | "provider_transport_kind"
      >
    | undefined;

  for (const bundles of Object.values(conditionBundles)) {
    for (const bundle of bundles) {
      const profile = bundle.run_manifest.provider_profile;

      if (!profile || profile.provider_kind !== "openai_compatible") {
        continue;
      }

      const nextIdentity = {
        provider_profile_id: profile.provider_profile_id,
        provider_route_id: profile.provider_route_id,
        provider_model: profile.model,
        provider_endpoint: profile.endpoint,
        provider_transport_kind: profile.transport_kind
      };

      if (identity && JSON.stringify(identity) !== JSON.stringify(nextIdentity)) {
        throw new Error("E1 provider run used multiple openai-compatible provider identities");
      }

      identity = nextIdentity;
    }
  }

  if (!identity) {
    throw new Error("E1 provider bundle is missing openai-compatible provider identity");
  }

  return identity;
}

export function noProviderRunForScoring(
  constants: E1SealedConstants,
  checkpoints: string[],
  conditionBundles: Record<ConditionId, E1NoProviderCheckpointBundle[]>
): E1NoProviderRunBundle {
  return {
    schema_version: "e1-no-provider-run-bundle-v0",
    constants_version: constants.version,
    constants_hash: hashText(JSON.stringify(constants)),
    checkpoints,
    arm_bundles: conditionBundles,
    run_summary: {
      status: "completed",
      stall_counts_by_condition: emptyConditionNumberRecord(),
      budget_exhausted_counts_by_condition: emptyConditionNumberRecord(),
      provider_error_counts_by_condition: emptyConditionNumberRecord(),
      spend_cap_reached_counts_by_condition: emptyConditionNumberRecord(),
      verification_slots_used_by_condition: emptyConditionNumberRecord()
    },
    structural_comparison: {
      checkpoint_counts_match: true,
      condition_ids: ["context_only_spec", "feedback_capable_spec"]
    }
  };
}

function flattenSummary(input: { checkpoint_id: string; summary: E1OracleTurnScore["summary"] }) {
  return {
    checkpoint_id: input.checkpoint_id,
    passed: input.summary.passed,
    total: input.summary.total
  };
}

export function bundleGrade(constants: E1SealedConstants, protocolDocumentHash: string | undefined): "dev" | "evidence" {
  return constants.status === constants.bundle_grading.evidence_requires_constants_status &&
    Boolean(protocolDocumentHash)
    ? "evidence"
    : "dev";
}


export async function applyE1BaselineOverlay(
  workspacePath: string,
  overlay: E1BaselineOverlay
): Promise<void> {
  for (const [path, content] of Object.entries(overlay.files).sort()) {
    const target = resolveInside(workspacePath, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}

export function recordE1BaselineOverlay(overlay: E1BaselineOverlay): E1BaselineOverlayRecord {
  const sorted = Object.fromEntries(Object.entries(overlay.files).sort(([a], [b]) => (a < b ? -1 : 1)));

  return {
    file_count: Object.keys(sorted).length,
    files: sorted,
    files_hash: hashText(JSON.stringify(sorted))
  };
}

function assertOpenSpecProfileForWorkflow(
  taskPackage: E1TaskPackage,
  openspecProfile: E1OpenSpecProfile | undefined
): E1OpenSpecProfile | undefined {
  if (taskPackage.workflow === "openspec") {
    if (!openspecProfile) {
      throw new Error("Task package declares workflow=openspec; openspecProfile is required");
    }

    return openspecProfile;
  }

  if (openspecProfile) {
    throw new Error("openspecProfile provided for a task package that does not declare workflow=openspec");
  }

  return undefined;
}

function emptyOpenSpecWorkflowRecord(profile: E1OpenSpecProfile): E1OpenSpecWorkflowRecord {
  return {
    protocol_profile_id: profile.profile.protocol_profile_id,
    profile_version: profile.profile.version,
    openspec_version: profile.profile.workflow_profile.openspec_version,
    archive_records: {},
    scenario_parity: []
  };
}

async function runOpenSpecAfterArmStep(input: {
  profile: E1OpenSpecProfile;
  record: E1OpenSpecWorkflowRecord;
  taskPackage: E1TaskPackage;
  conditionId: ConditionId;
  checkpointId: string;
  workspacePath: string;
}): Promise<void> {
  const changeName = input.taskPackage.workflow_changes?.[input.checkpointId];

  if (!changeName) {
    return;
  }

  const archiveRecord = await runE1OpenSpecArchiveStep({
    repoRoot: process.cwd(),
    workspacePath: input.workspacePath,
    changeName
  });

  input.record.archive_records[input.conditionId] = [
    ...(input.record.archive_records[input.conditionId] ?? []),
    archiveRecord
  ];
}

function assertPackageCompatibility(taskPackage: E1TaskPackage, oraclePackage: E1OraclePackage): void {
  if (taskPackage.task_id !== oraclePackage.task_id) {
    throw new Error("E1 task and oracle packages use different task_id values");
  }

  if (taskPackage.task_version !== oraclePackage.task_version) {
    throw new Error("E1 task and oracle packages use different task_version values");
  }

  if (taskPackage.virtual_now !== oraclePackage.virtual_now) {
    throw new Error("E1 task and oracle packages use different virtual_now values");
  }
}

function assertSelectedConditions(conditions: ConditionId[]): void {
  if (conditions.length === 0) {
    throw new Error("At least one E1 condition must be selected");
  }

  const seen = new Set<ConditionId>();

  for (const condition of conditions) {
    if (condition !== "context_only_spec" && condition !== "feedback_capable_spec") {
      throw new Error(`Unknown E1 condition ${condition}`);
    }

    if (seen.has(condition)) {
      throw new Error(`Duplicate E1 condition ${condition}`);
    }

    seen.add(condition);
  }
}

function assertSelectedCheckpoints(taskPackage: E1TaskPackage, checkpoints: string[]): void {
  if (checkpoints.length === 0) {
    throw new Error("At least one E1 checkpoint must be selected");
  }

  for (const checkpoint of checkpoints) {
    checkpointIndex(taskPackage.checkpoints, checkpoint);
  }
}

function emptyCheckpointBundleRecord(): Record<ConditionId, E1NoProviderCheckpointBundle[]> {
  return {
    context_only_spec: [],
    feedback_capable_spec: []
  };
}

function emptyConditionNumberRecord(): Record<ConditionId, number> {
  return {
    context_only_spec: 0,
    feedback_capable_spec: 0
  };
}

function assertCheckpointSpecMap(checkpoints: string[], visibleSpecs: Record<string, string>): void {
  for (const checkpoint of checkpoints) {
    if (typeof visibleSpecs[checkpoint] !== "string") {
      throw new Error(`Missing visible spec path for ${checkpoint}`);
    }
  }
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

function assertIsoInstant(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(value)) {
    throw new Error(`${field} must be a fixed ISO instant with millisecond precision`);
  }
}

function checkpointIndex(checkpoints: string[], checkpointId: string): number {
  const index = checkpoints.indexOf(checkpointId);

  if (index === -1) {
    throw new Error(`Unknown checkpoint ${checkpointId}`);
  }

  return index;
}

async function collectFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") {
      continue;
    }

    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path)));
      continue;
    }

    if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function resolveInside(root: string, relativePath: string): string {
  const resolvedRoot = resolve(root);
  const resolved = resolve(resolvedRoot, relativePath);

  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}/`)) {
    throw new Error(`${relativePath} escapes package root`);
  }

  return resolved;
}
