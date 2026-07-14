// E5 probe P1.2w run CLI — during-work truth feedback. Pre-registration:
// docs/e5/E5-P12W-DURING-WORK-PREREG-v1.md. SPEND-GATED: calibration classification only, live
// model only, one probe arm per invocation (treatment | control); each arm is one e4_arm_p
// sequence on the P0-V.1 product loop, treatment additionally wired with the P1.2w task-loop
// probe hook (control runs the loop unmodified — no hook attached at all).
//
//   bun run bin/e5-p12w.ts --seed <seed> --p12w-mode treatment|control --live \
//                          --model glm-5.2 [--run-root tmp/e5-p12w/seed-N] [--task-count 6] \
//                          [--endpoint …] [--api-key-env ZHIPU_API_KEY] [--extra-body …]
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants } from "../src/e4/v2/constants";
import { E4_V3_CONSTANTS_PATH, loadE4V3Constants } from "../src/e4/v3/constants";
import { createE4LiveProviderFactory } from "../src/e4/live-provider";
import { createFetchE1ProviderTransport } from "../src/e1-live-provider";
import { runE4V2Sequences } from "../src/e4/v2/orchestrator";
import type { E4V2GeneratedTask } from "../src/e4/substrate/v2/provider";
import { computeE5P11Partition } from "../src/e5/p11";
import { createE5P12wTaskLoopHook, E5_P12W_PROBE_ID } from "../src/e5/p12w";

type E5P12wMode = "treatment" | "control";

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : null;
}

const repoRoot = resolve(import.meta.dir, "..");
const seed = Number(argValue("--seed"));
const mode = argValue("--p12w-mode") as E5P12wMode | null;
const live = process.argv.includes("--live");
const model = argValue("--model");
const endpoint = argValue("--endpoint") ?? "https://api.z.ai/api/paas/v4/chat/completions";
const apiKeyEnv = argValue("--api-key-env") ?? "ZHIPU_API_KEY";
const extraBodyArg = argValue("--extra-body");
const taskCount = Number(argValue("--task-count") ?? "6");
const runRoot = resolve(argValue("--run-root") ?? join(repoRoot, "tmp", "e5-p12w", `seed-${seed}`, mode ?? "unset"));

if (!Number.isInteger(seed)) {
  throw new Error("--seed is required (integer)");
}

if (mode !== "treatment" && mode !== "control") {
  throw new Error('--p12w-mode must be "treatment" or "control"');
}

// Probe gates: calibration-class live runs ONLY — there is no dry-run or pilot shape for P1.2w.
if (!live || !model) {
  throw new Error("P1.2w is a live calibration probe: pass --live and --model (operator-authorized spend)");
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
  join(runRoot, "p12w-probe.json"),
  `${JSON.stringify(
    {
      schema: "e5-p12w-probe-manifest-v1",
      probe_id: E5_P12W_PROBE_ID,
      prereg: "docs/e5/E5-P12W-DURING-WORK-PREREG-v1.md",
      mode,
      seed,
      task_count: taskCount,
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
  pairing_label: `pair-p12w-${mode}-seed-${seed}`,
  substrate_config: {
    substrate_config_id: constants.compatibility_boundary.substrate_config_id,
    substrate_seed: seed,
    task_count: taskCount,
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
  // CONTROL runs the loop unmodified (prereg §2): no hook attached at all, not even a
  // content-free variant — the P1.1 post-close-cycle shape does not apply here.
  ...(mode === "treatment"
    ? {
        task_loop_probe: (task: E4V2GeneratedTask) =>
          createE5P12wTaskLoopHook({
            partition,
            tests: task.acceptance_tests.cumulative,
            executor_config: constants.executor
          })
      }
    : {})
});

const manifest = result.manifests.e4_arm_p;

console.log(`\n== P1.2w ${mode} seed ${seed} — chain_replay_valid=${manifest.replay_validity.chain_replay_valid} ==`);

for (const task of manifest.tasks) {
  console.log(
    `task ${task.task_index} (${task.op_kind}) termination=${task.termination} ` +
      `oracle=${task.oracle.cumulative_pass}/${task.oracle.cumulative_total} fc=${task.false_confidence.event}`
  );
}

console.log(`\nspend_usd: ${manifest.usage_totals.spend_usd}`);
console.log(`manifest: ${result.manifest_paths.e4_arm_p}`);
console.log(`per-task during-work feedback records: records/e4_arm_p/task-*/p12w-feedback-*.json`);
