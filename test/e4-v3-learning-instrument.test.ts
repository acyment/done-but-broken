// [Phase-0 learning boundary] The cheap-learning instrument's guards and readouts:
// --budget-override is calibration-only by construction, and the learning report computes the
// composition-aware quantities (fc|done, matched-pair concordance, done-only velocity) the M6
// adversarial review showed the sealed predicates conflate.
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { computeE4V3LearningReport } from "../src/e4/v3/learning-report";
import type { E4V2RunManifest, E4V2TaskRecord } from "../src/e4/v2/manifest";

const REPO_ROOT = resolve(import.meta.dir, "..");

async function runCli(args: string[]): Promise<{ exitCode: number; stderr: string }> {
  const proc = Bun.spawn(["bun", "run", "bin/e4-v3.ts", ...args], {
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe"
  });
  const exitCode = await proc.exited;
  const stderr = await new Response(proc.stderr).text();

  return { exitCode, stderr };
}

describe("--budget-override classification gate (no run, no spend)", () => {
  test("refused for dry_run", async () => {
    const { exitCode, stderr } = await runCli(["--budget-override", '{"spend_cap_usd":0.75}', "--run-root", "tmp/never-budget-override"]);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("calibration-only");
  });

  test("refused for pilot", async () => {
    const { exitCode, stderr } = await runCli([
      "--classification",
      "pilot",
      "--live",
      "--model",
      "x",
      "--budget-override",
      '{"spend_cap_usd":0.75}',
      "--run-root",
      "tmp/never-budget-override"
    ]);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("calibration-only");
  });

  test("unknown budget keys are refused before any setup", async () => {
    const { exitCode, stderr } = await runCli([
      "--classification",
      "calibration",
      "--live",
      "--model",
      "x",
      "--budget-override",
      '{"nonsense_cap":1}',
      "--run-root",
      "tmp/never-budget-override"
    ]);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("unknown budget keys");
  });
});

describe("learning report", () => {
  test("fc|done, spec-phase walls, matched pairs, and cap labeling come out composition-aware", () => {
    const manifests = [
      fakeManifest("e4_arm_0", 7, [
        fakeTask(1, { termination: "done", fc: true }),
        fakeTask(2, { termination: "done", fc: false }),
        fakeTask(3, { termination: "done", fc: true })
      ]),
      fakeManifest("e4_arm_p", 7, [
        fakeTask(1, { termination: "done", fc: false }), // discordant in the honest-P direction
        fakeTask(2, { termination: "done", fc: false }), // concordant honest
        fakeTask(3, { termination: "budget_exhausted", fc: false, phase: "spec" }) // wall — NOT a matched pair
      ])
    ];

    const report = computeE4V3LearningReport(manifests);
    const arm0 = report.arms.find((arm) => arm.arm === "e4_arm_0")!;
    const armP = report.arms.find((arm) => arm.arm === "e4_arm_p")!;

    expect(arm0.fc_over_attempted).toBeCloseTo(2 / 3, 10);
    expect(arm0.fc_over_closed).toBeCloseTo(2 / 3, 10);
    expect(armP.fc_over_attempted).toBeCloseTo(0, 10);
    expect(armP.fc_over_closed).toBe(0);
    expect(armP.spec_phase_walls).toBe(1);
    expect(armP.closed_done).toBe(2);

    expect(report.matched_pairs).toHaveLength(2);
    expect(report.matched_pairs_discordant_honest_p).toBe(1);
    expect(report.matched_pairs_discordant_honest_0).toBe(0);
    expect(report.matched_pairs_concordant).toBe(1);
  });

  test("zero closes yields undefined fc|done (never coerced) and a spend-cap label from aborted records", () => {
    const walled = fakeManifest("e4_arm_p", 9, [
      fakeTask(1, { termination: "budget_exhausted", fc: false, phase: "spec" }),
      { ...fakeTask(2, { termination: "budget_exhausted", fc: false }), status: "aborted" } as E4V2TaskRecord
    ]);

    const report = computeE4V3LearningReport([walled]);
    const armP = report.arms[0];

    expect(armP.fc_over_closed).toBeNull();
    expect(armP.attempted_tasks).toBe(1); // aborted records excluded (ADR-005 pin)
    expect(armP.spend_capped).toBe(true);
  });
});

function fakeTask(
  taskIndex: number,
  input: { termination: string; fc: boolean; phase?: string }
): E4V2TaskRecord {
  return {
    task_index: taskIndex,
    op_kind: "rename_entity",
    opportunity_labels: ["drift_opportunity"],
    nl_request: "x",
    termination: input.termination,
    phase_at_termination: input.phase ?? "implementation",
    status: "complete",
    gate_events: { custody_failures: 0, discriminating_red_refusals: 0, refused_done_over_red: 0, red_check: null },
    oracle: { delta_pass: 0, delta_total: 1, cumulative_pass: 0, cumulative_total: 1 },
    false_confidence: { event: input.fc, enforcement_outcome: null },
    archive: { attempted: false, change_name: null, archive_ok: false, failure_reason: null, survival_ledger: null },
    drift: {
      meter_version: "e4-drift-meter-v2",
      discrepancies: [],
      spec_unparseable: false,
      extraction_failed: false,
      registry_bypass: [],
      counts: {}
    },
    kill_score: { bank_id: "e4-adversarial-bank-v1", kill_score: 1, scenarios_total: 1, variants: [] },
    scenario_census: { spec_of_record_scenarios: 1, unbindable_scenarios: 0 },
    noticing_probe_answer: "No.",
    spec_touch: { touched: true, paths: [] },
    usage: {
      turns: 1,
      tokens: { fresh_input_tokens: 1, cached_input_tokens: 1, output_tokens: 1 },
      wall_clock_ms: 1,
      spend_usd: 0.01,
      by_phase: {
        spec: { turns: 1, tokens: { fresh_input_tokens: 1, cached_input_tokens: 1, output_tokens: 1 } },
        implementation: { turns: 0, tokens: { fresh_input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 } }
      }
    },
    probe_usage: null,
    snapshot: { hash: "x", path: "x" },
    executor_artifacts: [],
    pm_brief: { requested: false, first_turn: null },
    product_gate: null
  } as unknown as E4V2TaskRecord;
}

function fakeManifest(arm: string, seed: number, tasks: E4V2TaskRecord[]): E4V2RunManifest {
  return {
    schema: "e4-v2-run-manifest",
    schema_version: 1,
    run_classification: "calibration",
    protocol_profile_id: "e4-openspec-workflow-v2",
    arm,
    arm_mode: arm === "e4_arm_0" ? "prose" : "executed",
    pairing_label: `pair-learning-seed-${seed}`,
    model: { preset: "fake", model_id: "fake", route_id: "none" },
    compatibility_boundary: {
      constants_version: "0.4",
      constants_hash: "x",
      substrate_kind: "procedural-rest-v2",
      substrate_version: "procedural-rest-v2",
      meter_version: "e4-drift-meter-v2",
      converter_id: "e4-openspec-gherkin-v1",
      step_table_id: "e4-step-table-v1",
      t0_gold_spec_id: "e4-t0-gold-spec-v1",
      bank_id: "e4-adversarial-bank-v1",
      substrate_config: {
        substrate_config_id: "v2-default",
        substrate_seed: seed,
        task_count: tasks.length,
        op_mix: { weights: { drift_opportunity: 0.5, additive: 0.4, behavior_preserving: 0.1 } }
      }
    },
    initial_snapshot: { hash: "x", path: "x" },
    tasks,
    usage_totals: {
      turns: tasks.length,
      tokens: { fresh_input_tokens: 1, cached_input_tokens: 1, output_tokens: 1 },
      spend_usd: 0.03
    },
    replay_validity: { chain_replay_valid: true, substrate_regeneration_ok: true },
    status: "complete"
  } as unknown as E4V2RunManifest;
}
