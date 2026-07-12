// v3-M7 gate-commit acceptance (pre-registration §2/§9: the evidence verdict tool is built and
// tested against zero-spend fake-agent dry-run manifests BEFORE any live evidence manifest
// exists — the 3571a08 precedent). Two-arm, composition-proof showings:
//   - two-seed default dry run (drifting prose arm vs diligent product arm) → GO via the burden
//     AUC primary with the close-rate guard holding, exit 0;
//   - the SAME fixture with product-arm closes flipped to walls → the burden direction still
//     holds but the sealed close-rate guard FAILS → c void → NO-GO (the M6 §10 artifact made
//     structural);
//   - a single surviving seed fires insufficient_valid_data → exit 2;
//   - predicate (b) fails on a missing harness commit and on divergent harness commits;
//   - fc|done, matched pairs, and the disposition table are computed as first-class secondaries;
//   - calibration manifests are excluded structurally.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadE4Constants } from "../src/e4/constants";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants, type E4V2SealedConstants } from "../src/e4/v2/constants";
import { E4_V3_CONSTANTS_PATH, loadE4V3Constants, type E4V3SealedConstants } from "../src/e4/v3/constants";
import { buildE4V2FakeProviderFactory } from "../src/e4/v2/fake-provider";
import { computeE4V3M7GoNoGo, E4V3M7GoNoGoError } from "../src/e4/v3/evidence-gonogo";
import type { E4V2RunManifest, E4V3BoundaryStamp } from "../src/e4/v2/manifest";
import { runE4V2Sequences } from "../src/e4/v2/orchestrator";
import { e4ProceduralRestV2Provider } from "../src/e4/substrate/v2/provider";

const REPO_ROOT = resolve(import.meta.dir, "..");
const HARNESS_COMMIT = "f".repeat(40);

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

type PairFixture = {
  runRoot: string;
  manifests: E4V2RunManifest[];
  constants: E4V2SealedConstants;
  hash: string;
  v3Constants: E4V3SealedConstants;
  v3Hash: string;
};

let cachedAggregation: number | null = null;

async function conventionAggregationMinItems(): Promise<number> {
  if (cachedAggregation === null) {
    const { constants } = await loadE4Constants(join(REPO_ROOT, "docs", "protocols", "e4-sealed-constants-v0.json"));
    cachedAggregation = constants.meter_rules.convention_aggregation_min_items!;
  }

  return cachedAggregation;
}

async function buildPairs(input: { seeds: number[]; tasks: number }): Promise<PairFixture> {
  const runRoot = await mkdtemp(join(tmpdir(), "e4-v3-m7-gonogo-"));
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
      smoke_command: constants.feedback.smoke_command
    });

    const result = await runE4V2Sequences({
      repoRoot: REPO_ROOT,
      runRoot: join(runRoot, `seed-${seed}`),
      run_classification: "dry_run",
      pairing_label: `pair-m7-seed-${seed}`,
      substrate_config: substrateConfig,
      constants,
      constants_hash: hash,
      providerFactory,
      executor_config: constants.executor,
      arms: ["e4_arm_0", "e4_arm_p"],
      harness_commit: HARNESS_COMMIT,
      v3: { product_config: v3Constants.product_gate, constants_stamp: stamp }
    });

    manifests.push(result.manifests.e4_arm_0!, result.manifests.e4_arm_p!);
  }

  return { runRoot, manifests, constants, hash, v3Constants, v3Hash };
}

let goFixturePromise: Promise<PairFixture> | null = null;

function goFixture(): Promise<PairFixture> {
  return (goFixturePromise ??= buildPairs({ seeds: [45, 50], tasks: 4 }));
}

async function computeOn(fixture: PairFixture, manifests: E4V2RunManifest[]) {
  return computeE4V3M7GoNoGo({
    manifests,
    constants: fixture.constants,
    constantsHash: fixture.hash,
    v3Constants: fixture.v3Constants,
    v3ConstantsHash: fixture.v3Hash,
    conventionAggregationMinItems: await conventionAggregationMinItems()
  });
}

async function runCli(args: string[]): Promise<{ exitCode: number; stdout: string }> {
  const proc = Bun.spawn(["bun", "run", ...args], { cwd: REPO_ROOT, stdout: "pipe", stderr: "pipe" });
  const exitCode = await proc.exited;

  return { exitCode, stdout: await new Response(proc.stdout).text() };
}

describe("v3-M7 evidence verdict tool", () => {
  test("GO: drifting prose arm vs diligent product arm — burden AUC direction + close-rate guard hold (CLI exit 0)", async () => {
    const fixture = await goFixture();
    const report = await computeOn(fixture, fixture.manifests);

    expect(report.verdict).toBe("go");
    expect(report.predicates.a_arm0_drifts.holds).toBe(true);
    expect(report.predicates.b_boundary_stamp.holds).toBe(true);
    expect(report.predicates.c_primary_burden.c1_auc.direction_holds).toBe(true);
    expect(report.predicates.c_primary_burden.guard.holds).toBe(true);
    // The diligent product arm ends every checkpoint burden-free and closes 4/4.
    const armpSeries = report.predicates.c_primary_burden.per_sequence_burden.filter((entry) => entry.arm === "e4_arm_p");
    expect(armpSeries.every((entry) => entry.auc === 0)).toBe(true);
    expect(report.predicates.c_primary_burden.guard.armp_done_rate).toBe(1);
    // First-class secondaries computed: gold-implementing fakes never lie, so fc|done is 0 in
    // the product arm and matched pairs are all concordant-honest or arm0-lied.
    expect(report.secondaries.fc_given_done.e4_arm_p.rate).toBe(0);
    expect(report.secondaries.matched_pairs.discordant_armp_lied).toBe(0);
    expect(report.secondaries.disposition.e4_arm_p.scheduled).toBe(8);
    expect(report.secondaries.disposition.e4_arm_p.nonclose).toBe(0);

    const cli = await runCli(["bin/e4-v3-m7-gonogo.ts", fixture.runRoot]);
    expect(cli.exitCode).toBe(0);
    expect(cli.stdout).toContain("verdict: go");
    expect(cli.stdout).toContain("secondary matched pairs");
    expect(cli.stdout).toContain("NEVER honesty-at-close");
  }, 240_000);

  test("close-rate guard: a freshness win purchased by not closing is VOID → no-go", async () => {
    const fixture = await goFixture();
    const tampered = structuredClone(fixture.manifests);

    // Flip ONE product-arm close per sequence to a spec-phase wall: burden direction still
    // favors the product arm, the done-rate gap (1.0 vs 0.75) exceeds the sealed 0.15, and the
    // spec-stall fraction (2/8) stays under the protocol-confusion trigger — the guard, not a
    // trigger, must carry this branch.
    for (const manifest of tampered.filter((candidate) => candidate.arm === "e4_arm_p")) {
      for (const task of manifest.tasks.slice(0, 1)) {
        task.termination = "budget_exhausted";
        task.phase_at_termination = "spec";
        task.false_confidence = { ...task.false_confidence, event: false };
      }
    }

    const report = await computeOn(fixture, tampered);

    expect(report.predicates.c_primary_burden.c1_auc.direction_holds).toBe(true);
    expect(report.predicates.c_primary_burden.guard.holds).toBe(false);
    expect(report.predicates.c_primary_burden.holds).toBe(false);
    expect(report.verdict).toBe("no_go");
    expect(report.diagnostics.advisory_flags.some((flag) => flag.includes("close-rate guard FAILED"))).toBe(true);
    // The disposition table shows the walls explicitly.
    expect(report.secondaries.disposition.e4_arm_p.nonclose).toBe(2);
    expect(Object.keys(report.secondaries.disposition.e4_arm_p.nonclose_by_termination).join(",")).toContain(
      "budget_exhausted/spec-phase"
    );
  }, 240_000);

  test("a single surviving seed fires insufficient_valid_data → inconclusive (exit 2)", async () => {
    const fixture = await goFixture();
    const oneSeed = fixture.manifests.filter((manifest) => manifest.pairing_label === "pair-m7-seed-45");
    const report = await computeOn(fixture, oneSeed);

    expect(report.triggers.find((trigger) => trigger.id === "insufficient_valid_data")?.fired).toBe(true);
    expect(report.verdict).toBe("inconclusive_uninterpretable");
    expect(report.exit_code).toBe(2);
  }, 240_000);

  test("(b) fails on a missing harness commit and on divergent harness commits", async () => {
    const fixture = await goFixture();

    const missing = structuredClone(fixture.manifests);
    delete missing[0].harness_commit;
    const missingReport = await computeOn(fixture, missing);
    expect(missingReport.predicates.b_boundary_stamp.holds).toBe(false);
    expect(missingReport.predicates.b_boundary_stamp.detail).toContain("no harness_commit");

    const divergent = structuredClone(fixture.manifests);
    divergent[divergent.length - 1].harness_commit = "0".repeat(40);
    const divergentReport = await computeOn(fixture, divergent);
    expect(divergentReport.predicates.b_boundary_stamp.holds).toBe(false);
    expect(divergentReport.predicates.b_boundary_stamp.detail).toContain("distinct harness commits");
  }, 240_000);

  test("calibration manifests are excluded structurally; all-calibration input throws", async () => {
    const fixture = await goFixture();
    const relabelled = structuredClone(fixture.manifests);

    for (const manifest of relabelled) {
      manifest.run_classification = "calibration";
    }

    await expect(computeOn(fixture, relabelled)).rejects.toThrow(E4V3M7GoNoGoError);
  }, 240_000);
});
