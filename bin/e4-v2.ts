// E4 v2 run CLI (E4V2 design §9 v2-M5 dry-run harness + v2-M6 live calibration wiring).
//
// Dry run (fake agent, zero spend — unchanged default):
//   bun run bin/e4-v2.ts --seed 45 --tasks 4 [--run-root tmp/e4-v2-dryrun] [--gamer]
//
// Live calibration (v2-M6, SPEND-GATED — runs only under explicit operator authorization):
//   bun run bin/e4-v2.ts --seed <seed> --tasks 6 --live --classification calibration \
//                         --arms e4_arm_h --model <id> --endpoint <url> --api-key-env <ENV> \
//                         [--pricing-in <usd/M>] [--pricing-cached <usd/M>] [--pricing-out <usd/M>] \
//                         [--max-output-tokens N] [--disable-thinking] [--extra-body <json>] \
//                         [--run-root <dir>]
//
// Classification gates (deliberate, mirrors bin/e4.ts's v1 discipline):
//   dry_run      → fake provider only; --live is refused.
//   calibration  → live provider required; non-evidence by classification (excluded from any
//                  future go/no-go or verdict computation structurally, same as v1).
//   pilot        → live provider required. The unconditional v2-M6 refusal was deliberately
//                  lifted at the v2-M7 gate (2026-07-09, operator-authorized): the sealed
//                  pre-registration is docs/protocols/e4-v2-m7-pilot-preregistration-v1.md and
//                  this lift is the gate action it records (v1 precedent).
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants, type E4V2ArmId } from "../src/e4/v2/constants";
import { buildE4V2FakeProviderFactory } from "../src/e4/v2/fake-provider";
import { createE4LiveProviderFactory } from "../src/e4/live-provider";
import { runE4V2Sequences } from "../src/e4/v2/orchestrator";
import { e4ProceduralRestV2Provider } from "../src/e4/substrate/v2/provider";
import type { E4RunClassification } from "../src/e4/types";
import type { E4AgentProviderFactory } from "../src/e4/v2/turns";

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : null;
}

const repoRoot = resolve(import.meta.dir, "..");
const seed = Number(argValue("--seed") ?? "45");
const taskCount = Number(argValue("--tasks") ?? "4");
const runRoot = resolve(argValue("--run-root") ?? join(repoRoot, "tmp", "e4-v2-dryrun", `seed-${seed}`));
const useGamer = process.argv.includes("--gamer");
const live = process.argv.includes("--live");
const classification = (argValue("--classification") ?? "dry_run") as E4RunClassification;
const arms = argValue("--arms")
  ? (argValue("--arms")!.split(",").map((arm) => arm.trim()) as E4V2ArmId[])
  : undefined;
const model = argValue("--model");
const endpoint = argValue("--endpoint") ?? "https://api.deepseek.com/chat/completions";
const apiKeyEnv = argValue("--api-key-env") ?? "DEEPSEEK_API_KEY";
// Conservative OVERestimates for the derived-cost cap guardrail when the provider does not report
// cost; observed token counts (not these prices) are what ratifies the budgets (v1 precedent).
const pricing = {
  input: Number(argValue("--pricing-in") ?? "0.5"),
  cached_input: Number(argValue("--pricing-cached") ?? "0.05"),
  output: Number(argValue("--pricing-out") ?? "2.0")
};
const maxOutputTokens = Number(argValue("--max-output-tokens") ?? "16000");
const disableThinking = process.argv.includes("--disable-thinking");
const extraBodyArg = argValue("--extra-body");
const extraBody = extraBodyArg ? (JSON.parse(extraBodyArg) as Record<string, unknown>) : null;

// ---- classification gates (checked before any workspace/provider setup) ----
// v2-M7 gate action (operator-authorized, 2026-07-09): the unconditional pilot refusal that
// stood since v2-M6 is lifted — the pre-registration is sealed and is this lift's record
// (docs/protocols/e4-v2-m7-pilot-preregistration-v1.md). pilot remains a live-model
// classification, gated exactly like calibration.
if ((classification === "pilot" || classification === "calibration") && !live) {
  throw new Error(`${classification} runs are live-model runs: pass --live`);
}

if (classification === "dry_run" && live) {
  throw new Error("--live is not valid for dry_run: the dry-run harness is the zero-spend fake agent");
}

if (live && !model) {
  throw new Error("--model is required for a live run");
}

const { constants, hash } = await loadE4V2Constants(join(repoRoot, E4_V2_CONSTANTS_PATH));

const substrateConfig = {
  substrate_config_id: constants.compatibility_boundary.substrate_config_id,
  substrate_seed: seed,
  task_count: taskCount,
  op_mix: { weights: constants.op_mix.weights }
};

await rm(runRoot, { recursive: true, force: true });
await mkdir(runRoot, { recursive: true });

let providerFactory: E4AgentProviderFactory;
let modelIdentity: { preset: string; model_id: string; route_id: string };
let secrets: Array<{ id: string; value: string }> = [];

if (live) {
  const liveProvider = createE4LiveProviderFactory({
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
      ...(disableThinking || extraBody
        ? {
            extra_body: {
              ...(disableThinking ? { thinking: { type: "disabled" } } : {}),
              ...(extraBody ?? {})
            }
          }
        : {})
    }
  });
  providerFactory = liveProvider.factory;
  modelIdentity = liveProvider.model;
  secrets = liveProvider.secrets;
} else {
  // The factory is scripted from the same deterministic generate() the orchestrator re-runs
  // internally — identical output by generator determinism (Feature 1).
  const generated = await e4ProceduralRestV2Provider.generate(substrateConfig);
  providerFactory = buildE4V2FakeProviderFactory({
    generated,
    smoke_command: constants.feedback.smoke_command,
    ...(useGamer ? { behaviorByArm: { e4_arm_h: "vacuous_gamer" as const } } : {})
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
  ...(arms ? { arms } : {}),
  ...(secrets.length > 0 ? { secrets } : {})
});

for (const [arm, manifest] of Object.entries(result.manifests)) {
  console.log(`\n== ${arm} (${manifest.arm_mode}) — chain_replay_valid=${manifest.replay_validity.chain_replay_valid} ==`);

  for (const task of manifest.tasks) {
    console.log(
      [
        `task ${task.task_index} (${task.op_kind})`,
        `termination=${task.termination}`,
        `oracle=${task.oracle.cumulative_pass}/${task.oracle.cumulative_total}`,
        `false_confidence=${task.false_confidence.event}`,
        `drift=${task.drift.discrepancies.length}`,
        `kill_score=${task.kill_score.kill_score.toFixed(2)}`,
        `archive=${task.archive.archive_ok === null ? "n/a" : task.archive.archive_ok}`
      ].join("  ")
    );
  }
}

console.log(`\nmodel: ${modelIdentity.preset}/${modelIdentity.model_id} classification=${classification}`);
console.log(`manifests: ${Object.values(result.manifest_paths).join(", ")}`);
console.log(
  `spend_usd: ${Object.values(result.manifests).reduce((sum, manifest) => sum + manifest.usage_totals.spend_usd, 0)}${live ? "" : " (dry run — always 0)"}`
);
