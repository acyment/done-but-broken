// v2-M7 gate-commit acceptance (pre-registration §2: the verdict tool "must be built and tested
// against existing fake-agent dry-run manifests BEFORE any live manifest exists"). Port fidelity
// showings, all against zero-spend dry-run manifests:
//   - two-seed default dry run (drifting prose arm vs diligent executed arm) → GO via c1, exit 0;
//   - a single surviving seed fires insufficient_valid_data → exit 2 (three-valued);
//   - diligent Arm-0 + vacuous-gamer Arm-H → NO-GO, exit 1: (a) fails on the every-seed pin while
//     the gamer's drift defuses substrate_not_validated, and c2 reads the IDENTICAL
//     false_confidence.event in BOTH arms (the gamer's rate is 1.0 with ZERO
//     refused_done_over_red — v1's refusal-based gated-arm reading would have said 0);
//   - predicate (b) fails on any tampered boundary id; predicate (a) fails when ONE seed's Arm-0
//     records zero velocity (v1's ≥1-seed form would have passed);
//   - calibration manifests are excluded structurally, aborted records exclude their pair.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadE4Constants } from "../src/e4/constants";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants, type E4V2SealedConstants } from "../src/e4/v2/constants";
import { buildE4V2FakeProviderFactory, type E4V2FakeBehavior } from "../src/e4/v2/fake-provider";
import { computeE4V2GoNoGo, E4V2GoNoGoError } from "../src/e4/v2/gonogo";
import type { E4V2RunManifest } from "../src/e4/v2/manifest";
import { runE4V2Sequences } from "../src/e4/v2/orchestrator";
import { e4ProceduralRestV2Provider } from "../src/e4/substrate/v2/provider";

const REPO_ROOT = resolve(import.meta.dir, "..");

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

type PairFixture = { runRoot: string; manifests: E4V2RunManifest[]; constants: E4V2SealedConstants; hash: string };

let cachedAggregation: number | null = null;

async function conventionAggregationMinItems(): Promise<number> {
  if (cachedAggregation === null) {
    const { constants } = await loadE4Constants(join(REPO_ROOT, "docs", "protocols", "e4-sealed-constants-v0.json"));
    cachedAggregation = constants.meter_rules.convention_aggregation_min_items!;
  }

  return cachedAggregation;
}

async function buildPairs(input: {
  seeds: number[];
  tasks: number;
  behaviorByArm?: Partial<Record<"e4_arm_0" | "e4_arm_h", E4V2FakeBehavior>>;
}): Promise<PairFixture> {
  const runRoot = await mkdtemp(join(tmpdir(), "e4-v2-gonogo-"));
  tempRoots.push(runRoot);
  const { constants, hash } = await loadE4V2Constants(join(REPO_ROOT, E4_V2_CONSTANTS_PATH));
  const manifests: E4V2RunManifest[] = [];

  for (const seed of input.seeds) {
    const substrateConfig = {
      substrate_config_id: constants.compatibility_boundary.substrate_config_id,
      substrate_seed: seed,
      task_count: input.tasks,
      op_mix: { weights: constants.op_mix.weights }
    };
    const generated = await e4ProceduralRestV2Provider.generate(substrateConfig);
    const providerFactory = buildE4V2FakeProviderFactory({
      generated,
      smoke_command: constants.feedback.smoke_command,
      ...(input.behaviorByArm ? { behaviorByArm: input.behaviorByArm } : {})
    });

    const result = await runE4V2Sequences({
      repoRoot: REPO_ROOT,
      runRoot: join(runRoot, `seed-${seed}`),
      run_classification: "dry_run",
      pairing_label: `pair-gonogo-seed-${seed}`,
      substrate_config: substrateConfig,
      constants,
      constants_hash: hash,
      providerFactory,
      executor_config: constants.executor
    });

    manifests.push(result.manifests.e4_arm_0, result.manifests.e4_arm_h);
  }

  return { runRoot, manifests, constants, hash };
}

// The GO fixture: the existing dry-run seeds (45 = the bin/e4-v2.ts default, 50 = the M5
// integration seed) at 4 tasks under the DEFAULT behaviors (drifting prose arm, diligent
// executed arm). Built once, shared by the CLI and mutation tests.
let goFixturePromise: Promise<PairFixture> | null = null;

function goFixture(): Promise<PairFixture> {
  return (goFixturePromise ??= buildPairs({ seeds: [45, 50], tasks: 4 }));
}

async function computeOn(fixture: PairFixture, manifests: E4V2RunManifest[]) {
  return computeE4V2GoNoGo({
    manifests,
    constants: fixture.constants,
    constantsHash: fixture.hash,
    conventionAggregationMinItems: await conventionAggregationMinItems()
  });
}

type CliResult = { exitCode: number; stdout: string; stderr: string };

async function runCli(args: string[]): Promise<CliResult> {
  const proc = Bun.spawn(["bun", "run", ...args], { cwd: REPO_ROOT, stdout: "pipe", stderr: "pipe" });
  const exitCode = await proc.exited;

  return {
    exitCode,
    stdout: await new Response(proc.stdout).text(),
    stderr: await new Response(proc.stderr).text()
  };
}

describe("v2-M7 verdict tool — GO path over default dry-run manifests", () => {
  test("two surviving seeds, drifting prose arm vs diligent executed arm → go (exit 0) via c1", async () => {
    const fixture = await goFixture();
    const cli = await runCli(["bin/e4-v2-gonogo.ts", fixture.runRoot]);

    expect(cli.exitCode).toBe(0);
    expect(cli.stdout).toContain("verdict: go");
    expect(cli.stdout).toContain("(a) arm-0 drifts on every surviving seed: true");
    expect(cli.stdout).toContain("(b) boundary stamp: true");
    expect(cli.stdout).toContain("c1 true");
    expect(cli.stdout).toContain("trigger insufficient_valid_data: clear");
    expect(cli.stdout).toContain("trigger substrate_not_validated: clear");
    expect(cli.stdout).toContain("diagnostic e4_arm_0 drift composition:");
    expect(cli.stdout).toContain("diagnostic refused_done_over_red");
    // The floor rule is reported per surviving sequence at its sealed constants.
    expect(cli.stdout).toContain("floor e4_arm_0 seed 45: clear");
    expect(cli.stdout).toContain("floor e4_arm_h seed 50: clear");

    // Module-level cross-check of the same manifests.
    const report = await computeOn(fixture, fixture.manifests);

    expect(report.verdict).toBe("go");
    expect(report.predicates.a_arm0_drifts.per_seed_velocity.every((entry) => (entry.velocity ?? 0) > 0)).toBe(true);
    expect(report.predicates.c_separation.c1_velocity.holds).toBe(true);
    // Diligent executed arm: zero velocity; drifting prose arm keeps gold code, so the identical
    // false-confidence event is 0 in BOTH arms and c2 (correctly) does not hold here.
    expect(report.predicates.c_separation.c1_velocity.arm_h_mean).toBe(0);
    expect(report.predicates.c_separation.c2_false_confidence.holds).toBe(false);
    expect(report.predicates.c_separation.c2_false_confidence.arm0_rate).toBe(0);
    expect(report.diagnostics.h4_analog_blocked_floor_confounded).toBe(false);
  }, 900_000);

  test("a single surviving seed fires insufficient_valid_data → inconclusive_uninterpretable (exit 2)", async () => {
    const fixture = await goFixture();
    const cli = await runCli(["bin/e4-v2-gonogo.ts", join(fixture.runRoot, "seed-45")]);

    expect(cli.exitCode).toBe(2);
    expect(cli.stdout).toContain("verdict: inconclusive_uninterpretable");
    expect(cli.stdout).toContain("insufficient_valid_data: FIRED");
  }, 900_000);
});

describe("v2-M7 verdict tool — NO-GO path and the two-arm c2 semantics", () => {
  test("diligent Arm-0 + vacuous-gamer Arm-H → no-go (exit 1); c2 reads false_confidence.event in BOTH arms", async () => {
    // Seeds 4 and 63 at 3 tasks: every drawn op kind is inside the gamer fixture's supported
    // domain and each draw carries ≥1 drift-opportunity task (probed, deterministic).
    const fixture = await buildPairs({
      seeds: [4, 63],
      tasks: 3,
      behaviorByArm: { e4_arm_0: "diligent", e4_arm_h: "vacuous_gamer" }
    });

    const report = await computeOn(fixture, fixture.manifests);

    // The gamer's drift (gutted coverage) defuses substrate_not_validated; no trigger fires.
    expect(report.triggers.every((trigger) => !trigger.fired)).toBe(true);
    // (a) fails: the diligent Arm-0 keeps its spec fresh (zero velocity on every seed).
    expect(report.predicates.a_arm0_drifts.holds).toBe(false);
    // c2 witnesses the pre-registered two-arm adaptation: the executed arm's OWN gate accepted
    // done while the hidden oracle failed on most tasks (noop-affirmation tasks can close with a
    // green oracle, so the rate needn't be 1.0). The witness that c2 reads the IDENTICAL event
    // rather than v1's refusal-based gated-arm proxy: the executed arm's false-confidence EVENT
    // count strictly exceeds its refusal diagnostic.
    const c2 = report.predicates.c_separation.c2_false_confidence;
    expect(c2.arm_h_rate!).toBeGreaterThan(0.5);
    expect(c2.arm0_rate).toBe(0);
    expect(c2.arm_h_events).toBeGreaterThan(c2.refused_done_over_red_diagnostic.arm_h);
    expect(c2.holds).toBe(false);
    expect(report.verdict).toBe("no_go");
    expect(report.failed_predicates.some((entry) => entry.startsWith("(a)"))).toBe(true);

    const cli = await runCli(["bin/e4-v2-gonogo.ts", fixture.runRoot]);

    expect(cli.exitCode).toBe(1);
    expect(cli.stdout).toContain("verdict: no-go");
    expect(cli.stdout).toContain("(a) Arm-0 drift velocity > 0 on every surviving seed");
    expect(cli.stdout).toContain("trigger substrate_not_validated: clear");
  }, 900_000);
});

describe("v2-M7 verdict tool — predicate pins via manifest mutation (no extra runs)", () => {
  test("(b) fails when any manifest stamps a tampered boundary id or constants hash", async () => {
    const fixture = await goFixture();

    const tamperedBank = structuredClone(fixture.manifests);
    tamperedBank[0].compatibility_boundary.bank_id = "e4-adversarial-bank-TAMPERED";
    const bankReport = await computeOn(fixture, tamperedBank);

    expect(bankReport.predicates.b_boundary_stamp.holds).toBe(false);
    expect(bankReport.predicates.b_boundary_stamp.detail).toContain("bank_id");
    expect(bankReport.verdict).toBe("no_go");

    const tamperedHash = structuredClone(fixture.manifests);
    tamperedHash[1].compatibility_boundary.constants_hash = "0".repeat(64);
    const hashReport = await computeOn(fixture, tamperedHash);

    expect(hashReport.predicates.b_boundary_stamp.holds).toBe(false);
    expect(hashReport.predicates.b_boundary_stamp.detail).toContain("constants_hash");
  }, 900_000);

  test("(a) is the EVERY-seed pin: one zero-velocity Arm-0 seed fails it even though the other drifts", async () => {
    const fixture = await goFixture();
    const mutated = structuredClone(fixture.manifests);
    const arm0Seed45 = mutated.find(
      (manifest) => manifest.arm === "e4_arm_0" && manifest.compatibility_boundary.substrate_config.substrate_seed === 45
    )!;

    for (const task of arm0Seed45.tasks) {
      task.drift.discrepancies = [];
    }

    const report = await computeOn(fixture, mutated);

    // v1's ≥1-seed form would hold here (seed 50 still drifts); the sealed v2 form must not.
    expect(report.predicates.a_arm0_drifts.holds).toBe(false);
    expect(report.predicates.a_arm0_drifts.per_seed_velocity.some((entry) => (entry.velocity ?? 0) > 0)).toBe(true);
    expect(report.verdict).toBe("no_go");
    expect(report.failed_predicates.some((entry) => entry.startsWith("(a)"))).toBe(true);
  }, 900_000);

  test("calibration manifests are excluded structurally; an all-calibration set refuses to evaluate", async () => {
    const fixture = await goFixture();

    const withCalibration = structuredClone(fixture.manifests);
    for (const manifest of withCalibration.filter(
      (entry) => entry.compatibility_boundary.substrate_config.substrate_seed === 45
    )) {
      manifest.run_classification = "calibration";
    }

    const report = await computeOn(fixture, withCalibration);

    // Only seed 50 remains as evidence → trigger 1 fires at the sealed minimum of 2.
    expect(report.groups).toHaveLength(1);
    expect(report.triggers.find((trigger) => trigger.id === "insufficient_valid_data")?.fired).toBe(true);
    expect(report.verdict).toBe("inconclusive_uninterpretable");

    const allCalibration = structuredClone(fixture.manifests);
    for (const manifest of allCalibration) {
      manifest.run_classification = "calibration";
    }

    expect(computeOn(fixture, allCalibration)).rejects.toThrow(E4V2GoNoGoError);
  }, 900_000);

  test("an aborted task record excludes its paired seed (ADR-005 infrastructure exclusion)", async () => {
    const fixture = await goFixture();
    const mutated = structuredClone(fixture.manifests);
    const armHSeed50 = mutated.find(
      (manifest) => manifest.arm === "e4_arm_h" && manifest.compatibility_boundary.substrate_config.substrate_seed === 50
    )!;
    armHSeed50.tasks[armHSeed50.tasks.length - 1].status = "aborted";

    const report = await computeOn(fixture, mutated);
    const group = report.groups.find((entry) => entry.substrate_seed === 50)!;

    expect(group.surviving).toBe(false);
    expect(group.exclusion_reasons.some((reason) => reason.includes("aborted"))).toBe(true);
    expect(report.triggers.find((trigger) => trigger.id === "insufficient_valid_data")?.fired).toBe(true);
    expect(report.verdict).toBe("inconclusive_uninterpretable");
  }, 900_000);
});
