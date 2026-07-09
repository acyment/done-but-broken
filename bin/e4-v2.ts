// E4 v2 dry-run CLI (E4V2 design §9 v2-M5). DRY-RUN ONLY BY CONSTRUCTION: no live-provider
// wiring exists in this binary until the spend-gated v2-M6 calibration milestone adds it under
// its own gate — no flag mistake can spend money or mint a calibration/pilot classification.
//
//   bun run bin/e4-v2.ts --seed 45 --tasks 4 [--run-root tmp/e4-v2-dryrun] [--gamer]
//
// Runs both v2 arms (prose e4_arm_0, executed e4_arm_h) with the deterministic fake agent
// (diligent in the executed arm, drifting in the prose arm; --gamer switches the executed arm to
// the vacuous-scenario gamer fixture), then prints the per-task summary and replay validity.
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants } from "../src/e4/v2/constants";
import { buildE4V2FakeProviderFactory } from "../src/e4/v2/fake-provider";
import { runE4V2Sequences } from "../src/e4/v2/orchestrator";
import { e4ProceduralRestV2Provider } from "../src/e4/substrate/v2/provider";

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : null;
}

const repoRoot = resolve(import.meta.dir, "..");
const seed = Number(argValue("--seed") ?? "45");
const taskCount = Number(argValue("--tasks") ?? "4");
const runRoot = resolve(argValue("--run-root") ?? join(repoRoot, "tmp", "e4-v2-dryrun", `seed-${seed}`));
const useGamer = process.argv.includes("--gamer");

const { constants, hash } = await loadE4V2Constants(join(repoRoot, E4_V2_CONSTANTS_PATH));

const substrateConfig = {
  substrate_config_id: constants.compatibility_boundary.substrate_config_id,
  substrate_seed: seed,
  task_count: taskCount,
  op_mix: { weights: constants.op_mix.weights }
};

await rm(runRoot, { recursive: true, force: true });
await mkdir(runRoot, { recursive: true });

const generated = await e4ProceduralRestV2Provider.generate(substrateConfig);
const providerFactory = buildE4V2FakeProviderFactory({
  generated,
  smoke_command: constants.feedback.smoke_command,
  ...(useGamer ? { behaviorByArm: { e4_arm_h: "vacuous_gamer" as const } } : {})
});

const result = await runE4V2Sequences({
  repoRoot,
  runRoot,
  run_classification: "dry_run",
  pairing_label: `pair-dryrun-seed-${seed}`,
  substrate_config: substrateConfig,
  constants,
  constants_hash: hash,
  providerFactory,
  executor_config: constants.executor
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

console.log(`\nmanifests: ${Object.values(result.manifest_paths).join(", ")}`);
console.log(`spend_usd: ${Object.values(result.manifests).reduce((sum, manifest) => sum + manifest.usage_totals.spend_usd, 0)} (dry run — always 0)`);
