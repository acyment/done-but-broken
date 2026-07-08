// M0 scope (docs/e4/IMPLEMENTATION-PLAN.md §2 M0, §3.1 H1): the result-schema stub pins drift
// velocity as a flow of discrepancy episodes over fixture task records. These fixtures mirror the
// four identity-semantics rows the real M2 known-drift fixture will carry (missed rename,
// delete-then-re-add, fix-then-regress, cross-cutting convention change).
import { describe, expect, test } from "bun:test";
import { computeE4DriftVelocity } from "../src/e4/result-schema";
import type { E4Discrepancy, E4TaskRecord } from "../src/e4/types";

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

function taskRecord(taskIndex: number, discrepancies: E4Discrepancy[], driftOpportunity = true): E4TaskRecord {
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
        spec: { turns: 0, tokens: { fresh_input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 }, wall_clock_ms: 0 },
        implementation: {
          turns: 1,
          tokens: { fresh_input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 },
          wall_clock_ms: 0
        }
      },
      gate_executor: null
    },
    snapshot: { hash: `hash-${taskIndex}`, path: `runRoot/snapshots/e4_arm_0/task-${taskIndex}` },
    executor_artifacts: [],
    status: "complete",
    classification_rationale: null
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
