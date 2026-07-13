// v2-M5 ACCEPTANCE, part 2 (E4V2 design §9/§10 v2-M5): the full dry-run integration — fake
// agents driving substrate → runner → gate → archive → oracle → meter → bank → manifest →
// inspector with ZERO spend. Required showings:
//   - the diligent executed arm closes green with zero drift and exercises the §5.5
//     retirement-tombstone path on the drawn rename_entity task;
//   - the drifting prose arm accepts done over an unmaintained spec (drift measured, not
//     blocked; custody identical, scenarios never executed);
//   - the vacuous-scenario gamer lands as HIGH false-confidence + LOW kill score + coverage
//     gaps — measured, never blocked;
//   - a seed-echo bank variant is killed by the diligent agent's scenarios and NOT by the
//     gamer's;
//   - chain replay is valid ACROSS the archive seam (and the inspector is not vacuous);
//   - the hidden oracle runs EXACTLY ONCE per task close (A9).
import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants } from "../src/e4/v2/constants";
import { buildE4V2FakeProviderFactory } from "../src/e4/v2/fake-provider";
import { inspectE4V2Sequence } from "../src/e4/v2/inspect";
import { validateE4V2Manifest, type E4V2RunManifest } from "../src/e4/v2/manifest";
import { runE4V2Sequences } from "../src/e4/v2/orchestrator";
import { runE4V2Task } from "../src/e4/v2/runner";
import { E4_V2_ARM_POLICIES } from "../src/e4/v2/arm-policy";
import { runE4OracleExecutor } from "../src/e4/oracle-executor";
import { captureE4Snapshot } from "../src/e4/snapshot";
import { e4ProceduralRestV2Provider } from "../src/e4/substrate/v2/provider";

const REPO_ROOT = resolve(import.meta.dir, "..");

// Seed 50 at 4 tasks draws add_entity → rename_entity → modify_convention → noop_maintenance:
// the tombstone path (rename of the added entity), the convention flip, and the affirmation
// path in one sequence, inside the gamer fixture's supported op-kind domain.
const SEED = 50;
const TASKS = 4;

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

async function dryRun(input: { gamer: boolean }): Promise<Record<"e4_arm_0" | "e4_arm_h", E4V2RunManifest> & { runRoot: string }> {
  const runRoot = await mkdtemp(join(tmpdir(), "e4-v2-dryrun-"));
  tempRoots.push(runRoot);
  const { constants, hash } = await loadE4V2Constants(join(REPO_ROOT, E4_V2_CONSTANTS_PATH));
  const substrateConfig = {
    substrate_config_id: constants.compatibility_boundary.substrate_config_id,
    substrate_seed: SEED,
    task_count: TASKS,
    op_mix: { weights: constants.op_mix.weights }
  };
  const generated = await e4ProceduralRestV2Provider.generate(substrateConfig);
  const providerFactory = buildE4V2FakeProviderFactory({
    generated,
    smoke_command: constants.feedback.smoke_command,
    ...(input.gamer ? { behaviorByArm: { e4_arm_h: "vacuous_gamer" as const } } : {})
  });

  const result = await runE4V2Sequences({
    repoRoot: REPO_ROOT,
    runRoot,
    run_classification: "dry_run",
    pairing_label: `pair-dryrun-seed-${SEED}`,
    substrate_config: substrateConfig,
    constants,
    constants_hash: hash,
    providerFactory,
    executor_config: constants.executor
  });

  return { ...result.manifests, runRoot };
}

describe("v2-M5 — dry run: diligent executed arm vs drifting prose arm", () => {
  test("both arms complete with valid manifests; drift lands in the prose arm only; the tombstone path is exercised; replay holds across the archive seam", async () => {
    const run = await dryRun({ gamer: false });
    const prose = validateE4V2Manifest(run.e4_arm_0);
    const executed = validateE4V2Manifest(run.e4_arm_h);

    // Zero spend, dry_run classification, v2 boundary stamped.
    for (const manifest of [prose, executed]) {
      expect(manifest.run_classification).toBe("dry_run");
      expect(manifest.usage_totals.spend_usd).toBe(0);
      expect(manifest.compatibility_boundary.substrate_version).toBe("procedural-rest-v2.3"); // E5 P0-V.1
      expect(manifest.tasks).toHaveLength(TASKS);
      expect(manifest.tasks.every((task) => task.termination === "done")).toBe(true);
      // Chain replay valid ACROSS the archive seam (≥1 archive actually ran in every sequence).
      expect(manifest.replay_validity.substrate_regeneration_ok).toBe(true);
      expect(manifest.replay_validity.chain_replay_valid).toBe(true);
      expect(manifest.tasks.some((task) => task.archive.archive_ok === true)).toBe(true);
    }

    // Diligent executed arm: zero drift, red checks executed, done accepted through the gate.
    for (const task of executed.tasks) {
      expect(task.drift.discrepancies).toEqual([]);
      expect(task.false_confidence.event).toBe(false);
    }
    expect(executed.tasks[0].gate_events.red_check?.mode).toBe("executed");
    expect(executed.tasks[0].gate_events.red_check?.novel_red).toBeGreaterThan(0);

    // The §5.5 retirement-tombstone path on the drawn rename_entity task: the diligent change's
    // novel set carries the tombstone scenario, red before implementation.
    const renameTask = executed.tasks.find((task) => task.op_kind === "rename_entity")!;
    const tombstoneRecord = renameTask.gate_events.red_check?.novel_records.find((record) =>
      record.title.startsWith("Requests to retired /")
    );
    expect(tombstoneRecord?.pre_implementation).toBe("red");

    // The behavior-preserving task closes through the affirmation path (no change, no archive).
    const noopTask = executed.tasks.find((task) => task.op_kind === "noop_maintenance")!;
    expect(noopTask.archive.attempted).toBe(false);
    expect(noopTask.gate_events.red_check).toBeNull();

    // Drifting prose arm: custody identical (changes exist + archive), scenarios never executed,
    // done accepted while spec-side drift accumulates monotonically.
    expect(prose.tasks[0].gate_events.red_check?.mode).toBe("prose_recorded");
    expect(prose.tasks[0].gate_events.red_check?.novel_red).toBeNull();
    const specSideCounts = prose.tasks.map(
      (task) => task.drift.discrepancies.filter((discrepancy) => discrepancy.direction === "spec_vs_truth").length
    );
    expect(specSideCounts[0]).toBeGreaterThan(0);
    expect(specSideCounts[specSideCounts.length - 1]).toBeGreaterThanOrEqual(specSideCounts[0]);
    // The prose arm's code is gold (the drift phenomenon is SPEC drift, decoupled from failure).
    expect(prose.tasks.every((task) => task.oracle.cumulative_pass === task.oracle.cumulative_total)).toBe(true);
    // Its restatement changes carry zero novel scenarios — legal in the prose arm (floors only).
    expect(prose.tasks[0].gate_events.red_check?.novel_total).toBe(0);
    expect(prose.tasks[0].gate_events.discriminating_red_refusals).toBe(0);

    // A9 at the artifact level: exactly one hidden-oracle record per task close, both arms.
    for (const manifest of [prose, executed]) {
      for (const task of manifest.tasks) {
        const oracleArtifacts = task.executor_artifacts.filter((artifact) => artifact === "hidden-oracle.json");
        expect(oracleArtifacts).toHaveLength(1);
      }
    }
  }, 600_000);

  test("the inspector is not vacuous: tampering with a retained snapshot flips chain_replay_valid", async () => {
    const run = await dryRun({ gamer: false });
    const manifest = run.e4_arm_h;

    // Tamper with the task-1 snapshot's workspace bytes. Task 1's own replay still matches (it
    // reconstructs from the UNTAMPERED T0 snapshot against the recorded hash), but task 2
    // replays FROM the tampered snapshot — the chain property catches the seam.
    const snapshotPath = manifest.tasks[0].snapshot.path;
    await writeFile(join(snapshotPath, "server.ts"), "// tampered\n");

    const inspection = await inspectE4V2Sequence({ repoRoot: REPO_ROOT, runRoot: run.runRoot, manifest });

    expect(inspection.chain_replay_valid).toBe(false);
    expect(inspection.per_task_replay_ok[0]).toBe(true);
    expect(inspection.per_task_replay_ok[1]).toBe(false);
    expect(inspection.mismatches.length).toBeGreaterThan(0);
  }, 600_000);
});

describe("v2-M5 — dry run: the vacuous-scenario gamer is measured, not blocked", () => {
  test("high false-confidence + low kill score + coverage gaps; seed-echo killed by the diligent set but NOT by the gamer's", async () => {
    const diligentRun = await dryRun({ gamer: false });
    const gamerRun = await dryRun({ gamer: true });
    const diligent = diligentRun.e4_arm_h;
    const gamer = gamerRun.e4_arm_h;

    // The gamer satisfies the full gate every task (measured, never blocked)…
    expect(gamer.tasks.every((task) => task.termination === "done")).toBe(true);
    expect(gamer.tasks.every((task) => task.gate_events.discriminating_red_refusals === 0)).toBe(true);

    // …lands as HIGH false-confidence (done accepted by its own gate while GT fails)…
    const gamerFalseConfidence = gamer.tasks.filter((task) => task.false_confidence.event).length;
    expect(gamerFalseConfidence).toBe(TASKS);
    expect(diligent.tasks.filter((task) => task.false_confidence.event)).toHaveLength(0);

    // …with a LOW kill score (the strength instrument sees the gutted record)…
    const gamerFinal = gamer.tasks[TASKS - 1];
    const diligentFinal = diligent.tasks[TASKS - 1];
    expect(diligentFinal.kill_score.kill_score).toBe(1);
    expect(gamerFinal.kill_score.kill_score).toBeLessThanOrEqual(0.5);
    expect(gamerFinal.kill_score.kill_score).toBeLessThan(diligentFinal.kill_score.kill_score);

    // …and coverage gaps (the §7.4 diagnostic triple, complete).
    const gamerGaps = gamerFinal.drift.discrepancies.filter(
      (discrepancy) => discrepancy.direction === "spec_vs_truth" && discrepancy.class === "coverage_gap"
    );
    expect(gamerGaps.length).toBeGreaterThan(0);

    // The seed-echo differential (§10): killed by the diligent agent's scenarios, NOT the gamer's.
    const diligentSeedEcho = diligentFinal.kill_score.variants.find((variant) => variant.variant_id === "seed-echo")!;
    const gamerSeedEcho = gamerFinal.kill_score.variants.find((variant) => variant.variant_id === "seed-echo")!;
    expect(diligentSeedEcho.killed).toBe(true);
    expect(gamerSeedEcho.killed).toBe(false);

    // The gamer's record still passes its own gate — the kill-score report is hidden state,
    // recorded in the manifest and never in any agent-facing feedback artifact.
    expect(gamerFinal.gate_events.refused_done_over_red).toBe(0);

    // Replay validity is orthogonal to gaming: the gamer's chain replays too.
    expect(gamer.replay_validity.chain_replay_valid).toBe(true);
  }, 900_000);
});

describe("v2-M5 — A9: the hidden oracle runs exactly once per task close", () => {
  test("a counting oracle wrapper observes exactly one invocation for a full gated task", async () => {
    const { constants } = await loadE4V2Constants(join(REPO_ROOT, E4_V2_CONSTANTS_PATH));
    const substrateConfig = {
      substrate_config_id: constants.compatibility_boundary.substrate_config_id,
      substrate_seed: SEED,
      task_count: TASKS,
      op_mix: { weights: constants.op_mix.weights }
    };
    const generated = await e4ProceduralRestV2Provider.generate(substrateConfig);
    const runRoot = await mkdtemp(join(tmpdir(), "e4-v2-a9-"));
    tempRoots.push(runRoot);
    const workspaceDir = join(runRoot, "workspace");

    for (const [path, contents] of Object.entries(generated.initial_workspace)) {
      await mkdir(dirname(join(workspaceDir, path)), { recursive: true });
      await writeFile(join(workspaceDir, path), contents);
    }

    const providerFactory = buildE4V2FakeProviderFactory({
      generated,
      smoke_command: constants.feedback.smoke_command
    });

    let oracleInvocations = 0;
    const countingOracle: typeof runE4OracleExecutor = async (oracleInput) => {
      oracleInvocations += 1;
      return runE4OracleExecutor(oracleInput);
    };

    const result = await runE4V2Task({
      repoRoot: REPO_ROOT,
      arm: E4_V2_ARM_POLICIES.e4_arm_h,
      task: generated.tasks[0],
      workspace_dir: workspaceDir,
      records_dir: join(runRoot, "records", "e4_arm_h", "task-1"),
      provider: providerFactory({ arm: "e4_arm_h", pairing_label: "a9", task_index: 1 }),
      budgets: constants.budgets,
      spend_ledger: { spent_usd: 0 },
      constants,
      rename_lineage: [],
      executor_config: constants.executor,
      captureSnapshot: () => captureE4Snapshot({ workspaceDir, runRoot, arm: "e4_arm_h", taskIndex: 1 }),
      oracle_runner: countingOracle
    });

    expect(result.termination).toBe("done");
    expect(oracleInvocations).toBe(1);
  }, 600_000);
});
