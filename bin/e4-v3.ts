// E4 v3 run CLI (E4V3-PRODUCT-LOOP-PROPOSAL.md §5, v3-M4 dry-run harness). Three arms, profile
// e4-openspec-workflow-v2, PM brief channel in every arm, product gate on e4_arm_p.
//
// Dry run (fake agents, zero spend — the default):
//   bun run bin/e4-v3.ts --seed 50 --tasks 4 [--run-root tmp/e4-v3-dryrun] [--gamer]
//   --gamer puts the vacuous gamer on BOTH executed arms: measured-not-blocked on e4_arm_h vs
//   blocked-by-the-product-gate on e4_arm_p, in one run.
//
// Live calibration (v3-M5, SPEND-GATED — only under explicit operator authorization):
//   bun run bin/e4-v3.ts --seed <seed> --tasks 6 --live --classification calibration \
//                         --arms e4_arm_p --model <id> --endpoint <url> --api-key-env <ENV> \
//                         [--pricing-in/-cached/-out …] [--max-output-tokens N] [--extra-body …]
//
// Classification gates (bin/e4.ts → bin/e4-v2.ts precedent):
//   dry_run      → fake providers only; --live refused.
//   calibration  → live required; non-evidence by classification.
//   pilot        → live required. The unconditional refusal was lifted at the v3-M6
//                  pre-registration gate commit (the v2-M7 lift pattern, 3571a08: the lift is
//                  that gate commit's recorded action; spend still requires explicit operator
//                  authorization per the sealed pre-registration).
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants, type E4V2ArmId } from "../src/e4/v2/constants";
import { E4_V3_CONSTANTS_PATH, loadE4V3Constants } from "../src/e4/v3/constants";
import { buildE4V2FakeProviderFactory } from "../src/e4/v2/fake-provider";
import { createE4LiveProviderFactory } from "../src/e4/live-provider";
import { createFetchE1ProviderTransport } from "../src/e1-live-provider";
import {
  createRecordingTransport,
  extractReasoningSignals,
  type RecordedExchange
} from "../src/e4/reasoning-observability";
import { runE4V2Sequences } from "../src/e4/v2/orchestrator";
import { e4ProceduralRestV2Provider } from "../src/e4/substrate/v2/provider";
import type { E4RunClassification } from "../src/e4/types";
import type { E4AgentProviderFactory } from "../src/e4/v2/turns";

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : null;
}

const repoRoot = resolve(import.meta.dir, "..");
const seed = Number(argValue("--seed") ?? "50");
const taskCount = Number(argValue("--tasks") ?? "4");
const runRoot = resolve(argValue("--run-root") ?? join(repoRoot, "tmp", "e4-v3-dryrun", `seed-${seed}`));
const useGamer = process.argv.includes("--gamer");
const live = process.argv.includes("--live");
const classification = (argValue("--classification") ?? "dry_run") as E4RunClassification;
const arms = argValue("--arms")
  ? (argValue("--arms")!.split(",").map((arm) => arm.trim()) as E4V2ArmId[])
  : undefined;
const model = argValue("--model");
const endpoint = argValue("--endpoint") ?? "https://api.z.ai/api/paas/v4/chat/completions";
const apiKeyEnv = argValue("--api-key-env") ?? "ZHIPU_API_KEY";
const pricing = {
  input: Number(argValue("--pricing-in") ?? "1.4"),
  cached_input: Number(argValue("--pricing-cached") ?? "0.26"),
  output: Number(argValue("--pricing-out") ?? "4.4")
};
const maxOutputTokens = Number(argValue("--max-output-tokens") ?? "32000");
const extraBodyArg = argValue("--extra-body");
const extraBody = extraBodyArg ? (JSON.parse(extraBodyArg) as Record<string, unknown>) : null;
const budgetOverrideArg = argValue("--budget-override");

// ---- classification gates (checked before any workspace/provider setup) ----
if ((classification === "calibration" || classification === "pilot") && !live) {
  throw new Error(`${classification} runs are live-model runs: pass --live`);
}

if (classification === "dry_run" && live) {
  throw new Error("--live is not valid for dry_run: the dry-run harness is the zero-spend fake agent");
}

if (live && !model) {
  throw new Error("--model is required for a live run");
}

// [Phase-0 learning boundary] Budget override: learning runs cap cost below the sealed budgets.
// Calibration-only by construction — evidence (pilot) and dry runs always use the sealed values,
// so an overridden run can never be reclassified into evidence without re-running.
if (budgetOverrideArg && classification !== "calibration") {
  throw new Error("--budget-override is calibration-only: sealed budgets are mandatory for every other classification");
}

const budgetOverride = budgetOverrideArg
  ? (JSON.parse(budgetOverrideArg) as Partial<{
      turns_per_task: number;
      verifications_per_task: number;
      token_budget: number;
      spend_cap_usd: number;
    }>)
  : null;

const { constants, hash } = await loadE4V2Constants(join(repoRoot, E4_V2_CONSTANTS_PATH));

if (budgetOverride) {
  const unknownKeys = Object.keys(budgetOverride).filter((key) => !(key in constants.budgets));
  if (unknownKeys.length > 0) {
    throw new Error(`--budget-override has unknown budget keys: ${unknownKeys.join(", ")}`);
  }
  constants.budgets = { ...constants.budgets, ...budgetOverride };
}
const { constants: v3Constants, hash: v3Hash } = await loadE4V3Constants({
  v3Path: join(repoRoot, E4_V3_CONSTANTS_PATH),
  v2Path: join(repoRoot, E4_V2_CONSTANTS_PATH)
});

const substrateConfig = {
  substrate_config_id: constants.compatibility_boundary.substrate_config_id,
  substrate_seed: seed,
  task_count: taskCount,
  op_mix: { weights: constants.op_mix.weights }
};

await rm(runRoot, { recursive: true, force: true });
await mkdir(runRoot, { recursive: true });

if (budgetOverride) {
  // Provenance sidecar: manifests stamp the sealed constants identity while the run executed
  // under these caps — the sidecar plus calibration classification keeps that honest.
  const sidecarPath = join(runRoot, "budget-override.json");
  await writeFile(
    sidecarPath,
    `${JSON.stringify({ sealed_budgets_overridden_for_learning_run: budgetOverride, effective_budgets: constants.budgets }, null, 2)}\n`
  );
  console.log(`budget override (calibration-only learning run): ${JSON.stringify(constants.budgets)} → ${sidecarPath}`);
}

let providerFactory: E4AgentProviderFactory;
let modelIdentity: { preset: string; model_id: string; route_id: string };
let secrets: Array<{ id: string; value: string }> = [];
let reasoningRecords: RecordedExchange[] | null = null;

if (live) {
  const recorder = createRecordingTransport(createFetchE1ProviderTransport());
  reasoningRecords = recorder.records;
  const liveProvider = createE4LiveProviderFactory({
    transport: recorder.transport,
    config: {
      preset: "direct-openai-compatible",
      model: model!,
      endpoint,
      api_key_env: apiKeyEnv,
      route_id: `direct-${apiKeyEnv.toLowerCase().replaceAll("_", "-")}`,
      pricing_usd_per_million_tokens: pricing,
      sealed_spend_cap_usd: constants.budgets.spend_cap_usd,
      max_estimated_call_cost_usd: 0.25,
      max_output_tokens: maxOutputTokens,
      ...(extraBody ? { extra_body: extraBody } : {})
    }
  });
  providerFactory = liveProvider.factory;
  modelIdentity = liveProvider.model;
  secrets = liveProvider.secrets;
} else {
  const generated = await e4ProceduralRestV2Provider.generate(substrateConfig);
  providerFactory = buildE4V2FakeProviderFactory({
    generated,
    smoke_command: constants.feedback.smoke_command,
    ...(useGamer
      ? { behaviorByArm: { e4_arm_h: "vacuous_gamer" as const, e4_arm_p: "vacuous_gamer" as const } }
      : {})
  });
  modelIdentity = { preset: "fake-deterministic", model_id: "e4-fake-agent-v1", route_id: "none" };
}

const result = await runE4V2Sequences({
  repoRoot,
  runRoot,
  run_classification: classification,
  pairing_label: `pair-${classification.replaceAll("_", "")}-seed-${seed}`,
  substrate_config: substrateConfig,
  constants,
  constants_hash: hash,
  providerFactory,
  executor_config: constants.executor,
  model: modelIdentity,
  v3: {
    product_config: v3Constants.product_gate,
    // v3-M6 gate commit (M5 flag 1): every v3 manifest stamps the v3 constants identity —
    // pilot manifests refuse to validate without it.
    constants_stamp: {
      constants_version: v3Constants.version,
      constants_hash: v3Hash,
      ...v3Constants.compatibility_boundary
    }
  },
  ...(arms ? { arms } : {}),
  ...(secrets.length > 0 ? { secrets } : {})
});

for (const [arm, manifest] of Object.entries(result.manifests)) {
  console.log(`\n== ${arm} (${manifest.arm_mode}) — chain_replay_valid=${manifest.replay_validity.chain_replay_valid} ==`);

  for (const task of manifest.tasks) {
    const product = task.product_gate
      ? `  product_refusals=${task.product_gate.pm_review_refusals + task.product_gate.reconcile_refusals + task.product_gate.mutation_refusals}`
      : "";

    console.log(
      [
        `task ${task.task_index} (${task.op_kind})`,
        `termination=${task.termination}`,
        `oracle=${task.oracle.cumulative_pass}/${task.oracle.cumulative_total}`,
        `false_confidence=${task.false_confidence.event}`,
        `drift=${task.drift.discrepancies.length}`,
        `kill_score=${task.kill_score.kill_score.toFixed(2)}`,
        `asked_pm=${task.pm_brief?.requested ?? false}`
      ].join("  ") + product
    );
  }
}

if (live && reasoningRecords !== null) {
  const perCall = reasoningRecords.map((record, call) => ({
    call,
    signals: extractReasoningSignals(record.response.body)
  }));
  const activeCalls = perCall.filter((entry) => entry.signals.reasoning_active).length;
  const accountingSet = [...new Set(perCall.map((entry) => entry.signals.accounting))];
  const anyTruncated = perCall.some((entry) => entry.signals.truncated);

  const reasoningReport = {
    schema: "e4-v2-reasoning-observability-v1",
    classification,
    route: {
      model: modelIdentity.model_id,
      route_id: modelIdentity.route_id,
      endpoint,
      extra_body: extraBody ?? {},
      disable_thinking: false,
      max_output_tokens: maxOutputTokens
    },
    checks: {
      calls_recorded: perCall.length,
      reasoning_active_calls: activeCalls,
      reasoning_active_4a: activeCalls > 0,
      accounting_4b: accountingSet,
      adjustment_needed: perCall.some((entry) => entry.signals.adjustment_needed),
      truncated_5iv: anyTruncated
    },
    per_call: perCall
  };
  const reasoningReportPath = join(runRoot, "reasoning-observability.json");
  await writeFile(reasoningReportPath, JSON.stringify(reasoningReport, null, 2));
  console.log(
    `\nreasoning observability (§4): active ${activeCalls}/${perCall.length} calls, accounting=${accountingSet.join(",")}, ` +
      `truncated=${anyTruncated} → ${reasoningReportPath}`
  );
}

console.log(`\nmodel: ${modelIdentity.preset}/${modelIdentity.model_id} classification=${classification}`);
console.log(`constants: v2 ${hash.slice(0, 8)}… + v3 ${v3Hash.slice(0, 8)}… (${v3Constants.version})`);
console.log(`manifests: ${Object.values(result.manifest_paths).join(", ")}`);
console.log(
  `spend_usd: ${Object.values(result.manifests).reduce((sum, manifest) => sum + manifest.usage_totals.spend_usd, 0)}${live ? "" : " (dry run — always 0)"}`
);
