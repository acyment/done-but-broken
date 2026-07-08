// M0 acceptance (docs/e4/IMPLEMENTATION-PLAN.md §2 M0): manifest schema accepts a complete record
// and rejects an incomplete one.
import { describe, expect, test } from "bun:test";
import {
  E4ManifestValidationError,
  type E4RunManifest,
  type E4TaskRecord,
  validateE4RunManifest
} from "../src/e4/manifest";

function tokenUsage() {
  return { fresh_input_tokens: 100, cached_input_tokens: 20, output_tokens: 50 };
}

function completeTaskRecord(overrides: Partial<E4TaskRecord> = {}): E4TaskRecord {
  return {
    task_index: 1,
    opportunity_labels: ["drift_opportunity"],
    termination: "done",
    phase_at_termination: "implementation",
    gate_events: null,
    oracle: { delta_pass: 2, delta_total: 2, cumulative_pass: 2, cumulative_total: 2 },
    false_confidence: { event: false, enforcement_outcome: null },
    smoke_feedback_runs: 1,
    drift: {
      meter_version: "v1",
      discrepancies: [],
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
    noticing_probe_answer: "yes",
    spec_touch: { touched: false, paths: [] },
    usage: {
      turns: 4,
      tokens: tokenUsage(),
      wall_clock_ms: 1000,
      spend_usd: 0.01,
      by_phase: {
        spec: { turns: 0, tokens: tokenUsage(), wall_clock_ms: 0 },
        implementation: { turns: 4, tokens: tokenUsage(), wall_clock_ms: 1000 }
      },
      gate_executor: null
    },
    snapshot: { hash: "abc123", path: "runRoot/snapshots/e4_arm_0/task-1" },
    executor_artifacts: [],
    status: "complete",
    classification_rationale: null,
    ...overrides
  };
}

function completeManifest(overrides: Partial<E4RunManifest> = {}): E4RunManifest {
  return {
    schema: "e4-run-manifest",
    schema_version: "0",
    run_id: "run-1",
    run_classification: "dry_run",
    compatibility_boundary: {
      constants_version: "0",
      constants_hash: "deadbeef",
      meter_version: "v1",
      substrate_config_id: "procedural-rest-v1-default",
      substrate_kind: "procedural-rest-v1",
      substrate_version: "v1"
    },
    substrate_seed: 42,
    pairing_label: "pair-1",
    arm: "e4_arm_0",
    model: { preset: "devstral", model_id: "devstral-medium", route_id: "direct" },
    budgets: { turns_per_task: 10, verifications_per_task: 5, token_budget: 100000, spend_cap_usd: 5 },
    tasks: [completeTaskRecord()],
    resume_events: [],
    replay_validity: {
      substrate_regeneration_ok: true,
      per_task_replay_ok: [true],
      chain_replay_valid: true
    },
    usage_totals: { turns: 4, tokens: tokenUsage(), wall_clock_ms: 1000, spend_usd: 0.01 },
    ...overrides
  };
}

describe("Manifest schema accepts a complete record and rejects an incomplete one", () => {
  test("a hand-authored complete fixture validates", () => {
    expect(() => validateE4RunManifest(completeManifest())).not.toThrow();
  });

  test("removing compatibility_boundary fails validation", () => {
    const manifest = completeManifest() as unknown as Record<string, unknown>;
    delete manifest.compatibility_boundary;

    expect(() => validateE4RunManifest(manifest)).toThrow(/compatibility_boundary/);
  });

  test("removing usage.by_phase fails validation", () => {
    const manifest = completeManifest();
    const task = manifest.tasks[0] as unknown as Record<string, unknown>;
    const usage = task.usage as unknown as Record<string, unknown>;
    delete usage.by_phase;

    expect(() => validateE4RunManifest(manifest)).toThrow(/usage\.by_phase/);
  });

  test("removing schema fails validation", () => {
    const manifest = completeManifest() as unknown as Record<string, unknown>;
    delete manifest.schema;

    expect(() => validateE4RunManifest(manifest)).toThrow(/schema/);
  });

  test("rejects a schema mismatch", () => {
    expect(() => validateE4RunManifest(completeManifest({ schema: "e1-run-manifest" as never }))).toThrow(
      /schema mismatch/
    );
  });

  test("[R2: R2-5] executor_error termination requires a non-empty classification_rationale", () => {
    const manifest = completeManifest({
      tasks: [completeTaskRecord({ termination: "executor_error", classification_rationale: null })]
    });

    expect(() => validateE4RunManifest(manifest)).toThrow(E4ManifestValidationError);
    expect(() => validateE4RunManifest(manifest)).toThrow(/classification_rationale is required/);
  });

  test("[R2: R2-5] executor_error termination with a rationale validates", () => {
    const manifest = completeManifest({
      tasks: [
        completeTaskRecord({
          termination: "executor_error",
          classification_rationale: "port-bind failure reproduced on a clean workspace"
        })
      ]
    });

    expect(() => validateE4RunManifest(manifest)).not.toThrow();
  });

  test("[R2: R2-5] a non-executor_error termination must not carry a classification_rationale", () => {
    const manifest = completeManifest({
      tasks: [completeTaskRecord({ termination: "done", classification_rationale: "spurious" })]
    });

    expect(() => validateE4RunManifest(manifest)).toThrow(/must be null when termination is not executor_error/);
  });

  test("rejects a task record missing a required field", () => {
    const manifest = completeManifest();
    const task = manifest.tasks[0] as unknown as Record<string, unknown>;
    delete task.oracle;

    expect(() => validateE4RunManifest(manifest)).toThrow(/tasks\[0\]\.oracle/);
  });
});
