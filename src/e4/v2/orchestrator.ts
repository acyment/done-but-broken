// v2 run orchestrator (E4V2 design §2; v2-M5). One seeded substrate draw per pairing; each arm
// runs the SAME drawn sequence on its own workspace fork (shared task environment, execution of
// the spec as the only arm difference — checked by the parity validator before any task runs).
// The manifest is rewritten after every task close (crash durability), and replay validity is
// finalized through the same inspection code path bin/e4-v2-inspect uses.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { assertE1NoSecretsInJson, type E1RedactionSecret } from "../../e1-redaction";
import { captureE4Snapshot } from "../snapshot";
import type { E4ExecutorConfig } from "../oracle-executor";
import type { E4RunClassification } from "../types";
import { e4ProceduralRestV2Provider, type E4SubstrateConfig } from "../substrate/v2/provider";
import { E4_V2_ARM_POLICIES, validateE4V2RuntimeArmParity, type E4V2ArmRuntime } from "./arm-policy";
import type { E4V2ArmId, E4V2SealedConstants } from "./constants";
import { inspectE4V2Sequence } from "./inspect";
import type { E4V2RunManifest, E4V2TaskRecord, E4V3BoundaryStamp } from "./manifest";
import { runE4V2Task, type E4V2SequenceSpendLedger } from "./runner";
import {
  E4_PROVIDER_RETRY_POLICY_TEXT,
  renderE4V2SystemPromptParts,
  type E4AgentProviderFactory
} from "./turns";
// v3-M3 (E4V3-PRODUCT-LOOP-PROPOSAL.md §3): three-arm product-loop runs enter through the
// OPTIONAL `v3` input; v2 callers are unchanged.
import { buildBaselineIr } from "../substrate/ir";
import type { E4ChangeOpKind } from "../substrate/ops";
import { computeE4TaskDelta, type E4TaskDelta } from "../v3/task-delta";
import { renderE4PmBrief } from "../v3/pm-brief";
import { E4_V3_PRODUCT_GATE_PROTOCOL_TEXT, type E4V3ProductGateConfig } from "../v3/product-gate";
import { E4_V3_ASK_PM_PROTOCOL_TEXT } from "../v3/turn-protocol";

export type E4V2RunInput = {
  repoRoot: string;
  runRoot: string;
  run_classification: E4RunClassification;
  pairing_label: string;
  substrate_config: E4SubstrateConfig;
  constants: E4V2SealedConstants;
  constants_hash: string;
  providerFactory: E4AgentProviderFactory;
  executor_config: E4ExecutorConfig;
  secrets?: E1RedactionSecret[];
  arms?: E4V2ArmId[];
  // v2-M6: the model identity stamped into every manifest. Defaults to the dry-run fake-agent
  // identity (v1 bin/e4.ts precedent) so existing dry-run callers are unaffected; a live run
  // (v2-M6 calibration, v2-M7 pilot) must pass the real provider identity.
  model?: { preset: string; model_id: string; route_id: string };
  // v3-M3: presence switches the run to the three-arm product-loop shape — profile
  // e4-openspec-workflow-v2, the PM brief channel in every arm, and the product gate on
  // e4_arm_p. Absent for every v2 run.
  // v3-M6 gate commit: `constants_stamp` carries the v3 constants identity into every manifest's
  // compatibility_boundary.v3 block (M5 flag 1). Optional at the type level so pre-stamp callers
  // (fixture tests with draft configs) keep working; bin/e4-v3.ts always passes it, and pilot
  // manifests without it fail validation.
  v3?: { product_config: E4V3ProductGateConfig; constants_stamp?: E4V3BoundaryStamp };
  // v3-M7 gate commit: the harness git commit stamped into every manifest; REQUIRED for pilot
  // classification at creation time (validation stays permissive for historical manifests).
  harness_commit?: string;
};

const DRY_RUN_MODEL_IDENTITY = { preset: "fake-deterministic", model_id: "e4-fake-agent-v1", route_id: "none" };

export type E4V2RunResult = {
  manifests: Record<E4V2ArmId, E4V2RunManifest>;
  manifest_paths: Record<E4V2ArmId, string>;
};

function manifestPath(runRoot: string, arm: E4V2ArmId): string {
  return join(runRoot, `manifest-${arm}.json`);
}

export async function runE4V2Sequences(input: E4V2RunInput): Promise<E4V2RunResult> {
  // v3-M7 gate commit: evidence manifests must carry the harness identity from birth.
  if (input.run_classification === "pilot" && !input.harness_commit) {
    throw new Error("pilot runs must stamp harness_commit (v3-M7 gate commit; pass the repo HEAD at launch)");
  }

  const arms =
    input.arms ??
    (input.v3 ? (["e4_arm_0", "e4_arm_h", "e4_arm_p"] as E4V2ArmId[]) : (["e4_arm_0", "e4_arm_h"] as E4V2ArmId[]));
  const generated = await e4ProceduralRestV2Provider.generate(input.substrate_config);
  const secrets = input.secrets ?? [];

  // v3: the per-task PM briefs are a pure function of the drawn sequence (task-delta over the
  // ground-truth chain) — identical text in every arm by construction.
  const v3TaskExtras = new Map<number, { delta: E4TaskDelta; brief_text: string }>();

  if (input.v3) {
    let previousIr = buildBaselineIr();

    for (const task of generated.tasks) {
      const delta = computeE4TaskDelta(previousIr, task.ground_truth_ir);
      const brief = renderE4PmBrief({ opKind: task.op_kind as E4ChangeOpKind, delta });

      v3TaskExtras.set(task.task_index, { delta, brief_text: brief.text });
      previousIr = task.ground_truth_ir;
    }
  }

  // Arm parity before anything runs: identical task text, budgets, retry policy, and base
  // prompt; execution channels are the executed-mode arms' only declared deltas (the product
  // arm's channel adds the product-gate protocol).
  const runtimes: E4V2ArmRuntime[] = arms.map((arm) => {
    const parts = renderE4V2SystemPromptParts({ constants: input.constants, arm: E4_V2_ARM_POLICIES[arm] });
    const base = input.v3 ? `${parts.base}\n\n${E4_V3_ASK_PM_PROTOCOL_TEXT}` : parts.base;
    const channelParts = [parts.channel, arm === "e4_arm_p" ? E4_V3_PRODUCT_GATE_PROTOCOL_TEXT : null].filter(
      (part): part is string => part !== null
    );

    return {
      arm,
      pairing_label: input.pairing_label,
      task_text: generated.tasks.map((task) => task.nl_request).join("\n"),
      budgets: input.constants.budgets,
      retry_policy: E4_PROVIDER_RETRY_POLICY_TEXT,
      system_prompt_base: base,
      execution_channel: channelParts.length === 0 ? null : channelParts.join("\n\n")
    };
  });
  validateE4V2RuntimeArmParity(runtimes, arms);

  const manifests: Partial<Record<E4V2ArmId, E4V2RunManifest>> = {};
  const manifestPaths: Partial<Record<E4V2ArmId, string>> = {};

  for (const arm of arms) {
    const policy = E4_V2_ARM_POLICIES[arm];
    const workspaceDir = join(input.runRoot, "workspaces", arm);
    await mkdir(workspaceDir, { recursive: true });

    for (const [path, contents] of Object.entries(generated.initial_workspace)) {
      await mkdir(dirname(join(workspaceDir, path)), { recursive: true });
      await writeFile(join(workspaceDir, path), contents);
    }

    const initialSnapshot = await captureE4Snapshot({
      workspaceDir,
      runRoot: input.runRoot,
      arm,
      taskIndex: 0
    });

    const manifest: E4V2RunManifest = {
      schema: "e4-v2-run-manifest",
      schema_version: "1",
      run_classification: input.run_classification,
      protocol_profile_id: input.v3 ? "e4-openspec-workflow-v2" : "e4-openspec-workflow-v1",
      arm,
      arm_mode: policy.arm_mode,
      pairing_label: input.pairing_label,
      model: input.model ?? DRY_RUN_MODEL_IDENTITY,
      ...(input.harness_commit ? { harness_commit: input.harness_commit } : {}),
      compatibility_boundary: {
        constants_version: input.constants.version,
        constants_hash: input.constants_hash,
        substrate_kind: input.constants.compatibility_boundary.substrate_kind,
        substrate_version: input.constants.compatibility_boundary.substrate_version,
        meter_version: input.constants.compatibility_boundary.meter_version,
        converter_id: input.constants.compatibility_boundary.converter_id,
        step_table_id: input.constants.compatibility_boundary.step_table_id,
        t0_gold_spec_id: input.constants.compatibility_boundary.t0_gold_spec_id,
        bank_id: input.constants.compatibility_boundary.bank_id,
        substrate_config: {
          substrate_config_id: input.substrate_config.substrate_config_id,
          substrate_seed: input.substrate_config.substrate_seed,
          task_count: input.substrate_config.task_count,
          op_mix: input.substrate_config.op_mix
        },
        ...(input.v3?.constants_stamp ? { v3: input.v3.constants_stamp } : {})
      },
      initial_snapshot: initialSnapshot,
      tasks: [],
      usage_totals: { turns: 0, spend_usd: 0, wall_clock_ms: 0 },
      replay_validity: { substrate_regeneration_ok: false, per_task_replay_ok: [], chain_replay_valid: false },
      status: "in_progress"
    };

    const writeManifest = async (): Promise<void> => {
      const payload = `${JSON.stringify(manifest, null, 2)}\n`;
      assertE1NoSecretsInJson(payload, secrets);
      await writeFile(manifestPath(input.runRoot, arm), payload);
    };
    await writeManifest();

    const spendLedger: E4V2SequenceSpendLedger = { spent_usd: 0 };

    for (const task of generated.tasks) {
      const provider = input.providerFactory({ arm, pairing_label: input.pairing_label, task_index: task.task_index });
      const extras = v3TaskExtras.get(task.task_index);
      const result = await runE4V2Task({
        repoRoot: input.repoRoot,
        arm: policy,
        task,
        workspace_dir: workspaceDir,
        records_dir: join(input.runRoot, "records", arm, `task-${task.task_index}`),
        provider,
        budgets: input.constants.budgets,
        spend_ledger: spendLedger,
        constants: input.constants,
        rename_lineage: generated.rename_lineage_map.filter((entry) => entry.task_index <= task.task_index),
        executor_config: input.executor_config,
        captureSnapshot: () =>
          captureE4Snapshot({ workspaceDir, runRoot: input.runRoot, arm, taskIndex: task.task_index }),
        secrets,
        ...(input.v3 && extras
          ? {
              v3: {
                pm_brief_text: extras.brief_text,
                base_extra: E4_V3_ASK_PM_PROTOCOL_TEXT,
                channel_extra: arm === "e4_arm_p" ? E4_V3_PRODUCT_GATE_PROTOCOL_TEXT : null,
                product: arm === "e4_arm_p" ? { delta: extras.delta, config: input.v3.product_config } : null
              }
            }
          : {})
      });

      const record: E4V2TaskRecord = {
        ...result,
        task_index: task.task_index,
        op_kind: task.op_kind,
        opportunity_labels: task.opportunity_labels,
        nl_request: task.nl_request
      };
      manifest.tasks.push(record);
      manifest.usage_totals.turns += result.usage.turns;
      manifest.usage_totals.spend_usd += result.usage.spend_usd + (result.probe_usage?.spend_usd ?? 0);
      manifest.usage_totals.wall_clock_ms += result.usage.wall_clock_ms;
      await writeManifest();

      if (record.status === "aborted") {
        break;
      }
    }

    // Finalize replay validity through the same code path the inspector CLI uses.
    const inspection = await inspectE4V2Sequence({ repoRoot: input.repoRoot, runRoot: input.runRoot, manifest });
    manifest.replay_validity = {
      substrate_regeneration_ok: inspection.substrate_regeneration_ok,
      per_task_replay_ok: inspection.per_task_replay_ok,
      chain_replay_valid: inspection.chain_replay_valid
    };
    manifest.status = "complete";
    await writeManifest();

    manifests[arm] = manifest;
    manifestPaths[arm] = manifestPath(input.runRoot, arm);
  }

  return {
    manifests: manifests as Record<E4V2ArmId, E4V2RunManifest>,
    manifest_paths: manifestPaths as Record<E4V2ArmId, string>
  };
}
