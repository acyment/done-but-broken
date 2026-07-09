// M0 scope (docs/e4/IMPLEMENTATION-PLAN.md §2 M0, §3.1 H1): the result-schema stub pins drift
// velocity as a flow of discrepancy episodes over fixture task records. These fixtures mirror the
// four identity-semantics rows the real M2 known-drift fixture will carry (missed rename,
// delete-then-re-add, fix-then-regress, cross-cutting convention change).
import { describe, expect, test } from "bun:test";
import {
  computeE4DriftVelocity,
  computeE4FalseConfidencePropensity,
  computeE4FloorCollapse,
  computeE4H3SignaturePair,
  computeE4H4,
  computeE4H5,
  E4_UNDEFINED_AT_PILOT_SCALE
} from "../src/e4/result-schema";
import type { E4TaskRecord } from "../src/e4/manifest";
import type { E4Discrepancy } from "../src/e4/types";

function discrepancy(overrides: Partial<E4Discrepancy>): E4Discrepancy {
  return {
    kind: "endpoint",
    class: "coverage_gap",
    direction: "spec_vs_truth",
    item_id: "GET /widgets",
    semantic_item_uid: "uid-1",
    detail: {},
    ...overrides
  };
}

function taskRecord(
  taskIndex: number,
  discrepancies: E4Discrepancy[],
  driftOpportunity = true,
  overrides: Partial<E4TaskRecord> = {}
): E4TaskRecord {
  return {
    task_index: taskIndex,
    opportunity_labels: driftOpportunity ? ["drift_opportunity"] : ["additive"],
    termination: "done",
    phase_at_termination: "implementation",
    gate_events: null,
    oracle: { delta_pass: 1, delta_total: 1, cumulative_pass: taskIndex, cumulative_total: taskIndex },
    false_confidence: { event: false, enforcement_outcome: null },
    smoke_feedback_runs: 1,
    drift: {
      meter_version: "v1",
      discrepancies,
      spec_unparseable: false,
      extraction_failed: false,
      registry_bypass: [],
      counts: {
        endpoint: { contradiction: 0, coverage_gap: 0, stale_claim: 0 },
        entity: { contradiction: 0, coverage_gap: 0, stale_claim: 0 },
        field: { contradiction: 0, coverage_gap: 0, stale_claim: 0 },
        validation_rule: { contradiction: 0, coverage_gap: 0, stale_claim: 0 },
        convention: { contradiction: 0, coverage_gap: 0, stale_claim: 0 }
      }
    },
    noticing_probe_answer: "n/a",
    spec_touch: { touched: false, paths: [] },
    usage: {
      turns: 1,
      tokens: { fresh_input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 },
      wall_clock_ms: 0,
      spend_usd: 0,
      by_phase: {
        spec: {
          turns: 0,
          tokens: { fresh_input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 },
          wall_clock_ms: 0,
          spec_authoring_tokens: 0,
          gate_protocol_interaction_tokens: 0,
          oracle_feedback_tokens: 0
        },
        implementation: {
          turns: 1,
          tokens: { fresh_input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 },
          wall_clock_ms: 0,
          spec_authoring_tokens: 0,
          gate_protocol_interaction_tokens: 0,
          oracle_feedback_tokens: 0
        }
      },
      gate_executor: null
    },
    smoke_readiness_failures: 0,
    snapshot: { hash: `hash-${taskIndex}`, path: `runRoot/snapshots/e4_arm_0/task-${taskIndex}` },
    executor_artifacts: [],
    status: "complete",
    classification_rationale: null,
    ...overrides
  };
}

// Usage fixture for the H5 hand-computed cases: token totals split across phases with explicit
// [R2: R2-8] component attribution.
function usageFixture(input: {
  spec_tokens: number;
  impl_tokens: number;
  spec_gpi?: number;
  spec_ofb?: number;
  impl_gpi?: number;
  impl_ofb?: number;
}): E4TaskRecord["usage"] {
  const tokens = (total: number) => ({ fresh_input_tokens: total, cached_input_tokens: 0, output_tokens: 0 });

  return {
    turns: 2,
    tokens: tokens(input.spec_tokens + input.impl_tokens),
    wall_clock_ms: 0,
    spend_usd: 0,
    by_phase: {
      spec: {
        turns: 1,
        tokens: tokens(input.spec_tokens),
        wall_clock_ms: 0,
        spec_authoring_tokens: 0,
        gate_protocol_interaction_tokens: input.spec_gpi ?? 0,
        oracle_feedback_tokens: input.spec_ofb ?? 0
      },
      implementation: {
        turns: 1,
        tokens: tokens(input.impl_tokens),
        wall_clock_ms: 0,
        spec_authoring_tokens: 0,
        gate_protocol_interaction_tokens: input.impl_gpi ?? 0,
        oracle_feedback_tokens: input.impl_ofb ?? 0
      }
    },
    gate_executor: null
  };
}

const NO_AGGREGATION = { convention_aggregation_min_items: 3 };

describe("drift velocity is a flow of discrepancy episode onsets, never a stock", () => {
  test("a single discrepancy present from task 1 onward onsets exactly once", () => {
    const uid = discrepancy({ semantic_item_uid: "uid-onset-once" });
    const records = [taskRecord(1, [uid]), taskRecord(2, [uid]), taskRecord(3, [uid])];

    const result = computeE4DriftVelocity(records, NO_AGGREGATION);

    expect(result.episode_onset_count).toBe(1);
    expect(result.velocity).toBe(1 / 3);
  });

  test("a clean sequence (no discrepancies anywhere) has zero velocity, not undefined", () => {
    const records = [taskRecord(1, []), taskRecord(2, []), taskRecord(3, [])];

    const result = computeE4DriftVelocity(records, NO_AGGREGATION);

    expect(result.episode_onset_count).toBe(0);
    expect(result.velocity).toBe(0);
  });

  test("velocity is undefined (null), never 0, when there are no drift_opportunity tasks", () => {
    const uid = discrepancy({ semantic_item_uid: "uid-x" });
    const records = [taskRecord(1, [uid], false), taskRecord(2, [uid], false)];

    const result = computeE4DriftVelocity(records, NO_AGGREGATION);

    expect(result.drift_opportunity_task_count).toBe(0);
    expect(result.velocity).toBeNull();
  });

  test("[R2: R2-1] missed rename: stale-claim + coverage-gap pair on one UID merges to ONE episode", () => {
    // A rename retires the old rendered name (now a stale claim) and mints a new one (now a
    // coverage gap); rename preserves the UID, so both discrepancies share semantic_item_uid.
    const staleClaimOldName = discrepancy({
      class: "stale_claim",
      direction: "spec_vs_truth",
      item_id: "GET /widget",
      semantic_item_uid: "uid-widget"
    });
    const coverageGapNewName = discrepancy({
      class: "coverage_gap",
      direction: "spec_vs_truth",
      item_id: "GET /widgets",
      semantic_item_uid: "uid-widget"
    });
    const records = [taskRecord(1, []), taskRecord(2, [staleClaimOldName, coverageGapNewName])];

    const result = computeE4DriftVelocity(records, NO_AGGREGATION);

    expect(result.episode_onset_count).toBe(1);
  });

  test("[R2: R2-1] delete-then-re-add: fresh UID produces a distinct episode from the deleted item's", () => {
    const deleted = discrepancy({ semantic_item_uid: "uid-deleted", direction: "spec_vs_truth" });
    const readded = discrepancy({ semantic_item_uid: "uid-readded", direction: "spec_vs_truth" });
    const records = [
      taskRecord(1, [deleted]), // onset 1: the deletion goes stale
      taskRecord(2, [readded]) // deleted item resolved, a fresh UID onsets: onset 2
    ];

    const result = computeE4DriftVelocity(records, NO_AGGREGATION);

    expect(result.episode_onset_count).toBe(2);
  });

  test("[R2: R2-1] fix-then-regress: reappearance after resolution counts as a NEW episode (two total)", () => {
    const uid = discrepancy({ semantic_item_uid: "uid-flaky" });
    const records = [
      taskRecord(1, [uid]), // onset 1
      taskRecord(2, []), // fixed
      taskRecord(3, [uid]) // regresses: onset 2, distinguishable from drift-once-and-ignore
    ];

    const result = computeE4DriftVelocity(records, NO_AGGREGATION);

    expect(result.episode_onset_count).toBe(2);
  });

  test("drift-once-and-ignore (no resolution) stays a single episode, distinct from fix-then-regress", () => {
    const uid = discrepancy({ semantic_item_uid: "uid-ignored" });
    const records = [taskRecord(1, [uid]), taskRecord(2, [uid]), taskRecord(3, [uid])];

    const result = computeE4DriftVelocity(records, NO_AGGREGATION);

    expect(result.episode_onset_count).toBe(1);
  });

  test("[R2: R2-1] cross-cutting convention change: ≥N convention items onsetting together aggregate to ONE", () => {
    const conventionItems = ["uid-conv-1", "uid-conv-2", "uid-conv-3"].map((uid) =>
      discrepancy({ kind: "convention", semantic_item_uid: uid, direction: "spec_vs_truth" })
    );
    const records = [taskRecord(1, []), taskRecord(2, conventionItems)];

    const result = computeE4DriftVelocity(records, { convention_aggregation_min_items: 3 });

    expect(result.episode_onset_count).toBe(1);
    // Item-level counts still land in drift burden — the aggregation only affects velocity.
    expect(result.drift_burden_at_t_n).toBe(3);
  });

  test("convention items below the aggregation threshold count individually", () => {
    const conventionItems = ["uid-conv-1", "uid-conv-2"].map((uid) =>
      discrepancy({ kind: "convention", semantic_item_uid: uid, direction: "spec_vs_truth" })
    );
    const records = [taskRecord(1, []), taskRecord(2, conventionItems)];

    const result = computeE4DriftVelocity(records, { convention_aggregation_min_items: 3 });

    expect(result.episode_onset_count).toBe(2);
  });

  test("a convention aggregation event does not swallow a simultaneous non-convention onset", () => {
    const conventionItems = ["uid-conv-1", "uid-conv-2", "uid-conv-3"].map((uid) =>
      discrepancy({ kind: "convention", semantic_item_uid: uid, direction: "spec_vs_truth" })
    );
    const endpointItem = discrepancy({ kind: "endpoint", semantic_item_uid: "uid-endpoint" });
    const records = [taskRecord(1, []), taskRecord(2, [...conventionItems, endpointItem])];

    const result = computeE4DriftVelocity(records, { convention_aggregation_min_items: 3 });

    // 1 aggregated convention episode + 1 independent endpoint episode.
    expect(result.episode_onset_count).toBe(2);
  });

  test("drift burden at T_N is the whole-surface item-level count at the LAST task only", () => {
    const uidA = discrepancy({ semantic_item_uid: "uid-a" });
    const uidB = discrepancy({ semantic_item_uid: "uid-b" });
    const records = [taskRecord(1, [uidA, uidB]), taskRecord(2, [uidA])];

    const result = computeE4DriftVelocity(records, NO_AGGREGATION);

    // Task 1 had 2 discrepancies but only task 2 (the last) counts toward drift burden.
    expect(result.drift_burden_at_t_n).toBe(1);
  });

  test("the onset scan runs over ALL tasks; only the denominator is drift_opportunity-restricted", () => {
    const uid = discrepancy({ semantic_item_uid: "uid-cascading" });
    // The onset appears on a non-opportunity (additive) task — it must still count in the
    // numerator (R2-9a); only the two drift_opportunity tasks count toward the denominator.
    const records = [
      taskRecord(1, [], true),
      taskRecord(2, [uid], false),
      taskRecord(3, [uid], true)
    ];

    const result = computeE4DriftVelocity(records, NO_AGGREGATION);

    expect(result.episode_onset_count).toBe(1);
    expect(result.drift_opportunity_task_count).toBe(2);
    expect(result.velocity).toBe(0.5);
  });
});

describe("[M5] ADR-005 pin: aborted records are excluded from all analysis", () => {
  test("an aborted record's discrepancies never onset and it never joins any denominator", () => {
    const uid = discrepancy({ semantic_item_uid: "uid-aborted-only" });
    const records = [
      taskRecord(1, [], true),
      taskRecord(2, [uid], true, { status: "aborted", termination: "provider_error" })
    ];

    const result = computeE4DriftVelocity(records, NO_AGGREGATION);

    expect(result.episode_onset_count).toBe(0);
    expect(result.drift_opportunity_task_count).toBe(1);
    expect(result.drift_burden_at_t_n).toBe(0);
  });
});

describe("[M5] §3.2 floor-effect rule — pinned numeric definition", () => {
  const zeros = { delta_pass: 0, delta_total: 2, cumulative_pass: 0, cumulative_total: 10 };
  const green = { delta_pass: 2, delta_total: 2, cumulative_pass: 10, cumulative_total: 10 };

  test("two consecutive oracle-zero tasks starting at task_index ≤ 3 collapse the sequence", () => {
    const records = [
      taskRecord(1, [], true, { oracle: green }),
      taskRecord(2, [], true, { oracle: zeros }),
      taskRecord(3, [], true, { oracle: zeros })
    ];

    expect(computeE4FloorCollapse(records)).toEqual({ floor_collapsed: true, trigger_task_index: 2 });
  });

  test("non-consecutive zeros, or a pair starting after task_index 3, never collapse", () => {
    const nonConsecutive = [
      taskRecord(1, [], true, { oracle: zeros }),
      taskRecord(2, [], true, { oracle: green }),
      taskRecord(3, [], true, { oracle: zeros })
    ];
    const late = [
      taskRecord(3, [], true, { oracle: green }),
      taskRecord(4, [], true, { oracle: zeros }),
      taskRecord(5, [], true, { oracle: zeros })
    ];

    expect(computeE4FloorCollapse(nonConsecutive).floor_collapsed).toBe(false);
    expect(computeE4FloorCollapse(late).floor_collapsed).toBe(false);
  });

  test("[R1-S1i] the smoke prong is symmetric: consecutive readiness-failure tasks collapse; a single blip does not", () => {
    const collapsing = [
      taskRecord(1, [], true, { smoke_readiness_failures: 1 }),
      taskRecord(2, [], true, { smoke_readiness_failures: 2 })
    ];
    const blip = [
      taskRecord(1, [], true, { smoke_readiness_failures: 1 }),
      taskRecord(2, [], true),
      taskRecord(3, [], true)
    ];

    expect(computeE4FloorCollapse(collapsing)).toEqual({ floor_collapsed: true, trigger_task_index: 1 });
    expect(computeE4FloorCollapse(blip).floor_collapsed).toBe(false);
  });
});

describe("[M5] H3 signature pair and H4 slope", () => {
  test("[R1-C2] H3 is an ordered pair: spec-side onset velocity and code-side pass rate", () => {
    const specSide = discrepancy({ semantic_item_uid: "uid-spec", direction: "spec_vs_truth" });
    const codeSide = discrepancy({ semantic_item_uid: "uid-code", direction: "code_vs_truth" });
    const records = [
      taskRecord(1, [specSide, codeSide], true, {
        oracle: { delta_pass: 1, delta_total: 1, cumulative_pass: 8, cumulative_total: 10 }
      }),
      taskRecord(2, [specSide, codeSide], true, {
        oracle: { delta_pass: 1, delta_total: 1, cumulative_pass: 6, cumulative_total: 10 }
      })
    ];

    const pair = computeE4H3SignaturePair(records, NO_AGGREGATION);

    // Only the spec_vs_truth episode counts for the spec side: 1 onset / 2 opportunity tasks.
    expect(pair.spec_side_onset_velocity).toBe(0.5);
    expect(pair.code_side_pass_rate).toBe((8 + 6) / 20);
  });

  test("[R1-S1iii] H4 reports the per-task series and an OLS slope (hand-computed −0.2/task)", () => {
    const records = [
      taskRecord(1, [], true, { oracle: { delta_pass: 1, delta_total: 1, cumulative_pass: 10, cumulative_total: 10 } }),
      taskRecord(2, [], true, { oracle: { delta_pass: 1, delta_total: 1, cumulative_pass: 8, cumulative_total: 10 } }),
      taskRecord(3, [], true, { oracle: { delta_pass: 1, delta_total: 1, cumulative_pass: 6, cumulative_total: 10 } })
    ];

    const result = computeE4H4(records);

    expect(result.series.map((point) => point.cumulative_pass_rate)).toEqual([1, 0.8, 0.6]);
    expect(result.slope).toBeCloseTo(-0.2, 10);
    expect(result.floor.floor_collapsed).toBe(false);
  });
});

describe("[M5] false-confidence propensity ([R2: R2-6] binary per task, rates over attempted tasks)", () => {
  test("ungated arms read the false_confidence event; gated arms read refused_done_over_red ≥ 1", () => {
    const ungated = [
      taskRecord(1, [], true, { false_confidence: { event: true, enforcement_outcome: null } }),
      taskRecord(2, [], true, { false_confidence: { event: true, enforcement_outcome: null } }),
      taskRecord(3, [], true)
    ];
    const gated = [
      taskRecord(1, [], true, {
        gate_events: { custody_failures: 0, red_check: "red", refused_done_over_red: 2 },
        false_confidence: { event: false, enforcement_outcome: "refused" }
      }),
      taskRecord(2, [], true, {
        gate_events: { custody_failures: 0, red_check: "red", refused_done_over_red: 0 },
        false_confidence: { event: false, enforcement_outcome: "accepted" }
      })
    ];

    const ungatedResult = computeE4FalseConfidencePropensity(ungated);
    const gatedResult = computeE4FalseConfidencePropensity(gated);

    expect(ungatedResult.rate).toBe(2 / 3);
    // Two refusals on one task are ONE binary event; the raw count survives as a diagnostic.
    expect(gatedResult.event_task_count).toBe(1);
    expect(gatedResult.rate).toBe(1 / 2);
    expect(gatedResult.total_refusals_diagnostic).toBe(2);
  });
});

describe("[M5] H5 taxes — [R2: R2-2] attempted-task denominators, [R2: R2-8] sensitivity line", () => {
  const passing = { delta_pass: 1, delta_total: 1, cumulative_pass: 10, cumulative_total: 10 };
  const failing = { delta_pass: 0, delta_total: 1, cumulative_pass: 5, cumulative_total: 10 };

  test("hand-computed two-task pair: freshness 412.5 vs drift 1300 → supported, no flip", () => {
    const arm0 = [
      taskRecord(1, [], true, { usage: usageFixture({ spec_tokens: 0, impl_tokens: 1500 }), oracle: failing }),
      taskRecord(2, [], true, { usage: usageFixture({ spec_tokens: 0, impl_tokens: 2500 }), oracle: passing })
    ];
    const armH = [
      taskRecord(1, [], true, {
        usage: usageFixture({ spec_tokens: 400, impl_tokens: 800, spec_gpi: 50, spec_ofb: 30, impl_gpi: 40, impl_ofb: 60 }),
        oracle: passing
      }),
      taskRecord(2, [], true, {
        usage: usageFixture({ spec_tokens: 300, impl_tokens: 600, spec_gpi: 20, impl_ofb: 25 }),
        oracle: failing
      })
    ];

    const result = computeE4H5({ arm0, arm_h: armH });

    expect(result.attempted_task_indices).toEqual([1, 2]);
    // freshness = ((400 + 40 + 60) + (300 + 0 + 25)) / 2 = 825 / 2
    expect(result.freshness_tax_tokens_per_task).toBe(412.5);
    // drift = 4000/2 − 1400/2 = 2000 − 700
    expect(result.drift_tax_tokens_per_task).toBe(1300);
    expect(result.verdict).toBe("supported");
    // without gate-protocol interaction: (825 − (50+40+20)) / 2 = 715 / 2
    expect(result.sensitivity.freshness_without_gate_protocol_tokens_per_task).toBe(357.5);
    expect(result.sensitivity.verdict_flips).toBe(false);
    expect(result.sensitivity.reported_verdict).toBe("supported");
    // Pass rates always reported alongside, never blended into the tax denominators.
    expect(result.pass_rates.arm0).toBe(15 / 20);
    expect(result.pass_rates.arm_h).toBe(15 / 20);
    // Secondary: each arm has exactly one oracle-passing task; totals are over attempted tasks.
    expect(result.secondary_per_oracle_passing_task.arm0_tokens_per_passing_task).toBe(4000);
    expect(result.secondary_per_oracle_passing_task.arm_h_tokens_per_passing_task).toBe(2100);
  });

  test("a verdict that flips without the gate-protocol component reports 'sensitive to protocol overhead'", () => {
    const arm0 = [taskRecord(1, [], true, { usage: usageFixture({ spec_tokens: 0, impl_tokens: 1000 }), oracle: passing })];
    const armH = [
      taskRecord(1, [], true, {
        usage: usageFixture({ spec_tokens: 400, impl_tokens: 600, spec_gpi: 100, impl_gpi: 100 }),
        oracle: failing
      })
    ];

    const result = computeE4H5({ arm0, arm_h: armH });

    // freshness = 400 + 100 = 500; drift = 1000 − 600 = 400 → not supported…
    expect(result.verdict).toBe("not_supported");
    // …but without gate-protocol interaction: 500 − 200 = 300 < 400 → the verdict flips.
    expect(result.sensitivity.verdict_flips).toBe(true);
    expect(result.sensitivity.reported_verdict).toBe("sensitive to protocol overhead");
    // [R2: R2-2 / §5.1(v)] the empty passing set reads as the pinned literal, never 0.
    expect(result.secondary_per_oracle_passing_task.arm_h_tokens_per_passing_task).toBe(E4_UNDEFINED_AT_PILOT_SCALE);
  });

  test("[R2: R2-2] an aborted task on either side drops that task_index from BOTH arms' denominators", () => {
    const arm0 = [
      taskRecord(1, [], true, { usage: usageFixture({ spec_tokens: 0, impl_tokens: 1000 }), oracle: passing }),
      taskRecord(2, [], true, { usage: usageFixture({ spec_tokens: 0, impl_tokens: 9999 }), oracle: passing })
    ];
    const armH = [
      taskRecord(1, [], true, { usage: usageFixture({ spec_tokens: 100, impl_tokens: 500 }), oracle: passing }),
      taskRecord(2, [], true, {
        status: "aborted",
        termination: "provider_error",
        usage: usageFixture({ spec_tokens: 9999, impl_tokens: 9999 })
      })
    ];

    const result = computeE4H5({ arm0, arm_h: armH });

    expect(result.attempted_task_indices).toEqual([1]);
    // Only task 1 counts on both sides: freshness = 100; drift = 1000 − 500.
    expect(result.freshness_tax_tokens_per_task).toBe(100);
    expect(result.drift_tax_tokens_per_task).toBe(500);
  });
});
