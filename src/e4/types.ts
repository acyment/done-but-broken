// Shared E4 type declarations (architecture §2, IMPLEMENTATION-PLAN.md M0). Pure declarations, no
// behavior — the milestones that own each concept (M1 substrate, M2 meter, M3 gate/executor, M4
// runner) implement against these shapes without re-inventing them per module.
//
// ADR-007 lineage: this module is under src/e4/ and imports nothing outside the E4 tree.

export type E4ArmId = "e4_arm_0" | "e4_arm_m" | "e4_arm_h";

export type E4TaskPhase = "spec" | "implementation";

export type E4OpportunityLabel = "drift_opportunity" | "additive" | "behavior_preserving";

export type E4TaskTermination =
  | "done"
  | "agent_stalled"
  | "budget_exhausted"
  | "invalid_integrity"
  | "provider_error"
  | "spend_cap_reached"
  | "executor_error";

// "dry_run" covers M6's fake-provider integration runs (zero spend, not a calibration or pilot
// observation); "calibration" and "pilot" are the estate-standard classifications the plan uses
// for M6.5 and M7 respectively.
export type E4RunClassification = "dry_run" | "calibration" | "pilot";

export type E4TokenUsage = {
  fresh_input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
};

export type E4Budgets = {
  turns_per_task: number;
  verifications_per_task: number;
  token_budget: number;
  spend_cap_usd: number;
};

export type E4UsageTotals = {
  turns: number;
  tokens: E4TokenUsage;
  wall_clock_ms: number;
  spend_usd: number;
};

// Mirrors the E1WorkflowGuards shape (src/e1-harness.ts, allowlisted) under E4's own lineage —
// Arm H's spec-only vs code-only phase writability (architecture §2.3).
export type E4WorkflowGuards = {
  extra_read_only_prefixes: string[];
  extra_protected_directories: string[];
};

// ADR-005: one record per resume, binding the restored snapshot to where the sequence continued.
export type E4ResumeEvent = {
  restored_snapshot_task_index: number;
  restored_snapshot_hash: string;
  resumed_at_task_index: number;
  aborted_task_index: number | null;
};

// Architecture §2.4: per-endpoint pass/fail from the task's hidden-oracle run, consumed only by
// the meter's registry-bypass reconciliation rule (Gate-1 change 1). [R1-S6] pinned here so M2
// tests against this real type, never an M2-invented shape.
export type E4ExecutorEvidence = {
  endpoints: Array<{ item_id: string; passed: boolean }>;
};

export type E4DriftItemKind = "endpoint" | "entity" | "field" | "validation_rule" | "convention";

export type E4DriftClass = "contradiction" | "coverage_gap" | "stale_claim";

export type E4DriftDirection = "spec_vs_truth" | "code_vs_truth";

export type E4Discrepancy = {
  kind: E4DriftItemKind;
  class: E4DriftClass;
  direction: E4DriftDirection;
  item_id: string; // rendered name at time of observation; can change across a rename op
  semantic_item_uid: string; // [R2: R2-1] stable identity; episodes are keyed by this, never item_id
  detail: { expected?: string; found?: string };
};

export type E4DriftReport = {
  meter_version: string;
  discrepancies: E4Discrepancy[];
  spec_unparseable: boolean;
  extraction_failed: boolean;
  registry_bypass: { item_id: string }[];
  counts: Record<E4DriftItemKind, Record<E4DriftClass, number>>;
};
