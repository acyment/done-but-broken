// E5 probe P1.1 run CLI — truth-visible close, split-oracle design. Pre-registration:
// docs/e5/E5-P11-TRUTH-VISIBLE-CLOSE-PREREG-v1.md. SPEND-GATED: calibration classification
// only, live model only, one probe arm per invocation (treatment | control); each arm is one
// e4_arm_p sequence on the P0-V.1 product loop with the P1.1 post-close cycle.
//
//   bun run bin/e5-p11.ts --seed <seed> --p11-mode treatment|control --live \
//                          --model glm-5.2 [--run-root tmp/e5-p11/seed-N] \
//                          [--endpoint …] [--api-key-env ZHIPU_API_KEY] [--extra-body …]
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants } from "../src/e4/v2/constants";
import { E4_V3_CONSTANTS_PATH, loadE4V3Constants } from "../src/e4/v3/constants";
import { createE4LiveProviderFactory } from "../src/e4/live-provider";
import { createFetchE1ProviderTransport } from "../src/e1-live-provider";
import { runE4V2Sequences } from "../src/e4/v2/orchestrator";
import { computeE5P11Partition, createE5P11PostTaskHook, E5_P11_PROBE_ID, type E5P11Mode } from "../src/e5/p11";

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : null;
}

const repoRoot = resolve(import.meta.dir, "..");
const seed = Number(argValue("--seed"));
const mode = argValue("--p11-mode") as E5P11Mode | null;
const live = process.argv.includes("--live");
const model = argValue("--model");
const endpoint = argValue("--endpoint") ?? "https://api.z.ai/api/paas/v4/chat/completions";
const apiKeyEnv = argValue("--api-key-env") ?? "ZHIPU_API_KEY";
const extraBodyArg = argValue("--extra-body");
const runRoot = resolve(argValue("--run-root") ?? join(repoRoot, "tmp", "e5-p11", `seed-${seed}`, mode ?? "unset"));

if (!Number.isInteger(seed)) {
  throw new Error("--seed is required (integer)");
}

if (mode !== "treatment" && mode !== "control") {
  throw new Error('--p11-mode must be "treatment" or "control"');
}

// Probe gates: calibration-class live runs ONLY — there is no dry-run or pilot shape for P1.1.
if (!live || !model) {
  throw new Error("P1.1 is a live calibration probe: pass --live and --model (operator-authorized spend)");
}

const harnessCommit = new TextDecoder()
  .decode(Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: repoRoot }).stdout)
  .trim();

if (!/^[0-9a-f]{40}$/.test(harnessCommit)) {
  throw new Error("cannot resolve harness git commit");
}

const { constants, hash } = await loadE4V2Constants(join(repoRoot, E4_V2_CONSTANTS_PATH));
const { constants: v3Constants, hash: v3Hash } = await loadE4V3Constants({
  v3Path: join(repoRoot, E4_V3_CONSTANTS_PATH),
  v2Path: join(repoRoot, E4_V2_CONSTANTS_PATH)
});

const partition = computeE5P11Partition(seed);

await rm(runRoot, { recursive: true, force: true });
await mkdir(runRoot, { recursive: true });
await writeFile(
  join(runRoot, "p11-probe.json"),
  `${JSON.stringify(
    {
      schema: "e5-p11-probe-manifest-v1",
      probe_id: E5_P11_PROBE_ID,
      prereg: "docs/e5/E5-P11-TRUTH-VISIBLE-CLOSE-PREREG-v1.md",
      mode,
      seed,
      partition,
      harness_commit: harnessCommit,
      model,
      classification: "calibration"
    },
    null,
    2
  )}\n`
);

const liveProvider = createE4LiveProviderFactory({
  transport: createFetchE1ProviderTransport(),
  config: {
    preset: "direct-openai-compatible",
    model,
    endpoint,
    api_key_env: apiKeyEnv,
    route_id: `direct-${apiKeyEnv.toLowerCase().replaceAll("_", "-")}`,
    pricing_usd_per_million_tokens: {
      input: Number(argValue("--pricing-in") ?? "1.4"),
      cached_input: Number(argValue("--pricing-cached") ?? "0.26"),
      output: Number(argValue("--pricing-out") ?? "4.4")
    },
    sealed_spend_cap_usd: constants.budgets.spend_cap_usd,
    max_estimated_call_cost_usd: 0.25,
    max_output_tokens: Number(argValue("--max-output-tokens") ?? "32000"),
    ...(extraBodyArg ? { extra_body: JSON.parse(extraBodyArg) as Record<string, unknown> } : {})
  }
});

const result = await runE4V2Sequences({
  repoRoot,
  runRoot,
  run_classification: "calibration",
  pairing_label: `pair-p11-${mode}-seed-${seed}`,
  substrate_config: {
    substrate_config_id: constants.compatibility_boundary.substrate_config_id,
    substrate_seed: seed,
    task_count: 6,
    op_mix: { weights: constants.op_mix.weights }
  },
  constants,
  constants_hash: hash,
  providerFactory: liveProvider.factory,
  executor_config: constants.executor,
  model: liveProvider.model,
  harness_commit: harnessCommit,
  arms: ["e4_arm_p"],
  secrets: liveProvider.secrets,
  v3: {
    product_config: v3Constants.product_gate,
    constants_stamp: {
      constants_version: v3Constants.version,
      constants_hash: v3Hash,
      ...v3Constants.compatibility_boundary
    }
  },
  post_task_hook: createE5P11PostTaskHook({
    mode,
    partition,
    smoke_command: constants.feedback.smoke_command
  })
});

const manifest = result.manifests.e4_arm_p;

console.log(`\n== P1.1 ${mode} seed ${seed} — chain_replay_valid=${manifest.replay_validity.chain_replay_valid} (FALSE expected by prereg §2.2) ==`);

for (const task of manifest.tasks) {
  console.log(
    `task ${task.task_index} (${task.op_kind}) termination=${task.termination} ` +
      `oracle=${task.oracle.cumulative_pass}/${task.oracle.cumulative_total} fc=${task.false_confidence.event}`
  );
}

console.log(`\nspend_usd: ${manifest.usage_totals.spend_usd}`);
console.log(`manifest: ${result.manifest_paths.e4_arm_p}`);
console.log(`per-task cycle records: records/e4_arm_p/task-*/p11-cycle.json`);
