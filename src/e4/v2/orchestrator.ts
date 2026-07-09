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
import type { E4V2RunManifest, E4V2TaskRecord } from "./manifest";
import { runE4V2Task, type E4V2SequenceSpendLedger } from "./runner";
import {
  E4_PROVIDER_RETRY_POLICY_TEXT,
  renderE4V2SystemPromptParts,
  type E4AgentProviderFactory
} from "./turns";

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
};

export type E4V2RunResult = {
  manifests: Record<E4V2ArmId, E4V2RunManifest>;
  manifest_paths: Record<E4V2ArmId, string>;
};

function manifestPath(runRoot: string, arm: E4V2ArmId): string {
  return join(runRoot, `manifest-${arm}.json`);
}

export async function runE4V2Sequences(input: E4V2RunInput): Promise<E4V2RunResult> {
  const arms = input.arms ?? (["e4_arm_0", "e4_arm_h"] as E4V2ArmId[]);
  const generated = await e4ProceduralRestV2Provider.generate(input.substrate_config);
  const secrets = input.secrets ?? [];

  // Arm parity before anything runs: identical task text, budgets, retry policy, and base
  // prompt; the execution channel is the executed arm's only declared delta.
  const runtimes: E4V2ArmRuntime[] = (["e4_arm_0", "e4_arm_h"] as E4V2ArmId[]).map((arm) => {
    const parts = renderE4V2SystemPromptParts({ constants: input.constants, arm: E4_V2_ARM_POLICIES[arm] });

    return {
      arm,
      pairing_label: input.pairing_label,
      task_text: generated.tasks.map((task) => task.nl_request).join("\n"),
      budgets: input.constants.budgets,
      retry_policy: E4_PROVIDER_RETRY_POLICY_TEXT,
      system_prompt_base: parts.base,
      execution_channel: parts.channel
    };
  });
  validateE4V2RuntimeArmParity(runtimes);

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
      protocol_profile_id: "e4-openspec-workflow-v1",
      arm,
      arm_mode: policy.arm_mode,
      pairing_label: input.pairing_label,
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
        }
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
        secrets
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
