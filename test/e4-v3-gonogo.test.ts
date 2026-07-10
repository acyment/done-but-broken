// v3-M6 gate-commit acceptance (pre-registration §2: the verdict tool is built and tested
// against zero-spend fake-agent dry-run manifests BEFORE any live evidence manifest exists —
// the v2-M7 gate-commit precedent). Three-arm showings:
//   - two-seed default dry run (drifting prose arm vs diligent executed arms) → GO via the
//     PRIMARY c1 (arm 0 vs arm p), exit 0; the v3 constants stamp is required by (b);
//   - a single surviving seed fires insufficient_valid_data → exit 2 (three-valued);
//   - diligent Arm-0 + vacuous-gamer Arm-H + diligent Arm-P → NO-GO, exit 1: (a) fails on the
//     every-seed pin while the gamer's drift defuses substrate_not_validated; the SECONDARY d2
//     contrast (arm h vs arm p false confidence) holds but carries NO verdict weight;
//   - predicate (b) fails on a tampered v2 boundary id, a tampered v3 stamp hash, and a missing
//     v3 stamp; pilot-classified manifests refuse to validate without the stamp;
//   - calibration manifests are excluded structurally; a group missing its arm-p manifest is
//     excluded (three-arm pairing).
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadE4Constants } from "../src/e4/constants";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants, type E4V2SealedConstants } from "../src/e4/v2/constants";
import { E4_V3_CONSTANTS_PATH, loadE4V3Constants, type E4V3SealedConstants } from "../src/e4/v3/constants";
import { buildE4V2FakeProviderFactory, type E4V2FakeBehavior } from "../src/e4/v2/fake-provider";
import { computeE4V3GoNoGo, E4V3GoNoGoError } from "../src/e4/v3/gonogo";
import { validateE4V2Manifest, type E4V2RunManifest, type E4V3BoundaryStamp } from "../src/e4/v2/manifest";
import { runE4V2Sequences } from "../src/e4/v2/orchestrator";
import { e4ProceduralRestV2Provider } from "../src/e4/substrate/v2/provider";
import type { E4V2ArmId } from "../src/e4/v2/constants";

const REPO_ROOT = resolve(import.meta.dir, "..");

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

type TripleFixture = {
  runRoot: string;
  manifests: E4V2RunManifest[];
  constants: E4V2SealedConstants;
  hash: string;
  v3Constants: E4V3SealedConstants;
  v3Hash: string;
  stamp: E4V3BoundaryStamp;
};

let cachedAggregation: number | null = null;

async function conventionAggregationMinItems(): Promise<number> {
  if (cachedAggregation === null) {
    const { constants } = await loadE4Constants(join(REPO_ROOT, "docs", "protocols", "e4-sealed-constants-v0.json"));
    cachedAggregation = constants.meter_rules.convention_aggregation_min_items!;
  }

  return cachedAggregation;
}

async function buildTriples(input: {
  seeds: number[];
  tasks: number;
  behaviorByArm?: Partial<Record<E4V2ArmId, E4V2FakeBehavior>>;
}): Promise<TripleFixture> {
  const runRoot = await mkdtemp(join(tmpdir(), "e4-v3-gonogo-"));
  tempRoots.push(runRoot);
  const { constants, hash } = await loadE4V2Constants(join(REPO_ROOT, E4_V2_CONSTANTS_PATH));
  const { constants: v3Constants, hash: v3Hash } = await loadE4V3Constants({
    v3Path: join(REPO_ROOT, E4_V3_CONSTANTS_PATH),
    v2Path: join(REPO_ROOT, E4_V2_CONSTANTS_PATH)
  });
  const stamp: E4V3BoundaryStamp = {
    constants_version: v3Constants.version,
    constants_hash: v3Hash,
    ...v3Constants.compatibility_boundary
  };
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
      executor_config: constants.executor,
      v3: { product_config: v3Constants.product_gate, constants_stamp: stamp }
    });

    manifests.push(result.manifests.e4_arm_0, result.manifests.e4_arm_h, result.manifests.e4_arm_p);
  }

  return { runRoot, manifests, constants, hash, v3Constants, v3Hash, stamp };
}

// The GO fixture: the established dry-run fixture seeds (45/50) at 4 tasks under the DEFAULT
// behaviors (drifting prose arm, diligent executed arms). Built once, shared.
let goFixturePromise: Promise<TripleFixture> | null = null;

function goFixture(): Promise<TripleFixture> {
  return (goFixturePromise ??= buildTriples({ seeds: [45, 50], tasks: 4 }));
}

async function computeOn(fixture: TripleFixture, manifests: E4V2RunManifest[]) {
  return computeE4V3GoNoGo({
    manifests,
    constants: fixture.constants,
    constantsHash: fixture.hash,
    v3Constants: fixture.v3Constants,
    v3ConstantsHash: fixture.v3Hash,
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

describe("v3-M6 verdict tool — GO path over default three-arm dry-run manifests", () => {
  test("two surviving seeds, drifting prose arm vs diligent executed arms → go (exit 0) via primary c1", async () => {
    const fixture = await goFixture();
    const cli = await runCli(["bin/e4-v3-gonogo.ts", fixture.runRoot]);

    expect(cli.exitCode).toBe(0);
    expect(cli.stdout).toContain("verdict: go");
    expect(cli.stdout).toContain("(a) arm-0 drifts on every surviving seed: true");
    expect(cli.stdout).toContain("(b) boundary stamp (v2 + v3): true");
    expect(cli.stdout).toContain("(c) PRIMARY separation arm0 vs armP: true");
    expect(cli.stdout).toContain("no verdict weight");
    expect(cli.stdout).toContain("trigger insufficient_valid_data: clear");
    expect(cli.stdout).toContain("trigger substrate_not_validated: clear");
    expect(cli.stdout).toContain("trigger arm_h_protocol_confusion: clear");
    expect(cli.stdout).toContain("trigger arm_p_protocol_confusion: clear");
    expect(cli.stdout).toContain("diagnostic ASK_PM usage");
    expect(cli.stdout).toContain("diagnostic product gate (arm p)");
    expect(cli.stdout).toContain("floor e4_arm_p seed 45: clear");

    const report = await computeOn(fixture, fixture.manifests);

    expect(report.verdict).toBe("go");
    expect(report.predicates.a_arm0_drifts.per_seed_velocity.every((entry) => (entry.velocity ?? 0) > 0)).toBe(true);
    // PRIMARY c1: drifting prose arm > diligent product arm (velocity 0).
    expect(report.predicates.c_primary_separation.c1_velocity.holds).toBe(true);
    expect(report.predicates.c_primary_separation.c1_velocity.right_mean).toBe(0);
    // Drifting keeps gold code → the identical false-confidence event is 0 in every arm; c2
    // (correctly) does not hold here.
    expect(report.predicates.c_primary_separation.c2_false_confidence.holds).toBe(false);
    // REPLICATION e1 (arm 0 vs arm h) mirrors the v2 lineage on these fixtures: drifting vs
    // diligent → holds; SECONDARY d1 (arm h vs arm p, both diligent) does not.
    expect(report.reported_contrasts.e_replication_arm0_vs_armh.e1_velocity.holds).toBe(true);
    expect(report.reported_contrasts.d_secondary_armh_vs_armp.d1_velocity.holds).toBe(false);
    // Diligent product arm clears its gate without refusals on these fixtures.
    expect(report.diagnostics.product_gate_arm_p.pm_review_refusals).toBe(0);
    expect(report.diagnostics.product_gate_arm_p.mutation_refusals).toBe(0);
    expect(report.diagnostics.h4_analog_blocked_floor_confounded).toBe(false);
  }, 900_000);

  test("a single surviving seed fires insufficient_valid_data → inconclusive_uninterpretable (exit 2)", async () => {
    const fixture = await goFixture();
    const cli = await runCli(["bin/e4-v3-gonogo.ts", join(fixture.runRoot, "seed-45")]);

    expect(cli.exitCode).toBe(2);
    expect(cli.stdout).toContain("verdict: inconclusive_uninterpretable");
    expect(cli.stdout).toContain("insufficient_valid_data: FIRED");
  }, 900_000);
});

describe("v3-M6 verdict tool — NO-GO path and the reported contrasts", () => {
  test("diligent Arm-0 + gamer Arm-H + diligent Arm-P → no-go (exit 1); d2 holds without verdict weight", async () => {
    // Seeds 4 and 63 at 3 tasks: every drawn op kind is inside the gamer fixture's supported
    // domain and each draw carries ≥1 drift-opportunity task (v2-M7 gate-commit probe, carried).
    const fixture = await buildTriples({
      seeds: [4, 63],
      tasks: 3,
      behaviorByArm: { e4_arm_0: "diligent", e4_arm_h: "vacuous_gamer", e4_arm_p: "diligent" }
    });

    const report = await computeOn(fixture, fixture.manifests);

    // The gamer's drift (gutted coverage) defuses substrate_not_validated; no trigger fires.
    expect(report.triggers.every((trigger) => !trigger.fired)).toBe(true);
    // (a) fails: the diligent Arm-0 keeps its spec fresh (zero velocity on every seed).
    expect(report.predicates.a_arm0_drifts.holds).toBe(false);
    // PRIMARY c: both prose and product arms are clean here → no separation either lens.
    expect(report.predicates.c_primary_separation.holds).toBe(false);
    // SECONDARY d2: the gamer's own-gate false confidence exceeds the product arm's — the
    // contrast holds AND the verdict is still no_go (no verdict weight, pre-registration §2).
    const d2 = report.reported_contrasts.d_secondary_armh_vs_armp.d2_false_confidence;
    expect(d2.left_rate!).toBeGreaterThan(0.5);
    expect(d2.right_rate).toBe(0);
    expect(d2.holds).toBe(true);
    expect(report.verdict).toBe("no_go");
    expect(report.failed_predicates.some((entry) => entry.startsWith("(a)"))).toBe(true);
    // The identical-event semantics carried from v2: the gamer's event count exceeds its refusal
    // diagnostic (which stays reported-only).
    expect(d2.left_events).toBeGreaterThan(report.diagnostics.refused_done_over_red_by_arm.e4_arm_h);

    const cli = await runCli(["bin/e4-v3-gonogo.ts", fixture.runRoot]);

    expect(cli.exitCode).toBe(1);
    expect(cli.stdout).toContain("verdict: no-go");
    expect(cli.stdout).toContain("(a) Arm-0 drift velocity > 0 on every surviving seed");
    expect(cli.stdout).toContain("trigger substrate_not_validated: clear");
  }, 900_000);
});

describe("v3-M6 verdict tool — predicate pins via manifest mutation (no extra runs)", () => {
  test("(b) fails on a tampered v2 boundary id, a tampered v3 stamp, and a missing v3 stamp", async () => {
    const fixture = await goFixture();

    const tamperedBank = structuredClone(fixture.manifests);
    tamperedBank[0].compatibility_boundary.bank_id = "e4-adversarial-bank-TAMPERED";
    const bankReport = await computeOn(fixture, tamperedBank);

    expect(bankReport.predicates.b_boundary_stamp.holds).toBe(false);
    expect(bankReport.predicates.b_boundary_stamp.detail).toContain("bank_id");
    expect(bankReport.verdict).toBe("no_go");

    const tamperedV3Hash = structuredClone(fixture.manifests);
    tamperedV3Hash[1].compatibility_boundary.v3!.constants_hash = "0".repeat(64);
    const hashReport = await computeOn(fixture, tamperedV3Hash);

    expect(hashReport.predicates.b_boundary_stamp.holds).toBe(false);
    expect(hashReport.predicates.b_boundary_stamp.detail).toContain("v3 constants_hash");

    const missingStamp = structuredClone(fixture.manifests);
    delete missingStamp[2].compatibility_boundary.v3;
    const missingReport = await computeOn(fixture, missingStamp);

    expect(missingReport.predicates.b_boundary_stamp.holds).toBe(false);
    expect(missingReport.predicates.b_boundary_stamp.detail).toContain("no v3 constants stamp");

    const tamperedId = structuredClone(fixture.manifests);
    tamperedId[0].compatibility_boundary.v3!.product_gate_id = "e4-product-gate-TAMPERED";
    const idReport = await computeOn(fixture, tamperedId);

    expect(idReport.predicates.b_boundary_stamp.holds).toBe(false);
    expect(idReport.predicates.b_boundary_stamp.detail).toContain("product_gate_id");
  }, 900_000);

  test("pilot manifests under the v2 profile refuse to validate without the v3 stamp", async () => {
    const fixture = await goFixture();

    const stamped = structuredClone(fixture.manifests[0]);
    stamped.run_classification = "pilot";
    expect(() => validateE4V2Manifest(structuredClone(stamped))).not.toThrow();

    const unstamped = structuredClone(stamped);
    delete unstamped.compatibility_boundary.v3;
    expect(() => validateE4V2Manifest(unstamped)).toThrow(/stamp the v3 constants identity/);

    // Dry-run and calibration manifests may omit the stamp (the committed v3-M5 calibration
    // manifest predates it).
    const calibration = structuredClone(unstamped);
    calibration.run_classification = "calibration";
    expect(() => validateE4V2Manifest(calibration)).not.toThrow();
  }, 900_000);

  test("calibration manifests are excluded structurally; a missing arm-p manifest excludes its seed", async () => {
    const fixture = await goFixture();

    const withCalibration = structuredClone(fixture.manifests);
    for (const manifest of withCalibration.filter(
      (entry) => entry.compatibility_boundary.substrate_config.substrate_seed === 45
    )) {
      manifest.run_classification = "calibration";
    }

    const report = await computeOn(fixture, withCalibration);

    expect(report.groups).toHaveLength(1);
    expect(report.triggers.find((trigger) => trigger.id === "insufficient_valid_data")?.fired).toBe(true);
    expect(report.verdict).toBe("inconclusive_uninterpretable");

    const allCalibration = structuredClone(fixture.manifests);
    for (const manifest of allCalibration) {
      manifest.run_classification = "calibration";
    }
    expect(computeOn(fixture, allCalibration)).rejects.toThrow(E4V3GoNoGoError);

    // Three-arm pairing: dropping a seed's arm-p manifest excludes the whole seed.
    const missingArmP = fixture.manifests.filter(
      (manifest) =>
        !(manifest.arm === "e4_arm_p" && manifest.compatibility_boundary.substrate_config.substrate_seed === 50)
    );
    const missingReport = await computeOn(fixture, missingArmP);
    const seed50 = missingReport.groups.find((group) => group.substrate_seed === 50)!;

    expect(seed50.surviving).toBe(false);
    expect(seed50.exclusion_reasons.some((reason) => reason.includes("e4_arm_p: manifest missing"))).toBe(true);
    expect(missingReport.triggers.find((trigger) => trigger.id === "insufficient_valid_data")?.fired).toBe(true);
  }, 900_000);
});
