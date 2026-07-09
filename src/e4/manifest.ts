// E4RunManifest / E4TaskRecord types + validator (architecture §2.5; IMPLEMENTATION-PLAN.md M0).
// Own schema ("e4-run-manifest"), own validator — never e1's manifest/bundle validation.
import type {
  E4ArmId,
  E4Budgets,
  E4DriftReport,
  E4OpportunityLabel,
  E4ResumeEvent,
  E4RunClassification,
  E4TaskPhase,
  E4TaskTermination,
  E4TokenUsage,
  E4UsageTotals
} from "./types";

export type E4CompatibilityBoundaryRef = {
  constants_version: string;
  constants_hash: string;
  meter_version: string;
  substrate_config_id: string;
  substrate_kind: string;
  substrate_version: string;
};

export type E4GateEvents = {
  custody_failures: number;
  // null only when the task never left the spec phase (budget exhaustion in spec phase — the M3
  // gate.summary() note anticipated this; phase_at_termination === "spec" disambiguates).
  red_check: "red" | "green_anomaly" | "skipped_behavior_preserving" | null;
  refused_done_over_red: number;
};

export type E4ByPhaseUsage = {
  turns: number;
  tokens: E4TokenUsage;
  wall_clock_ms: number;
  // [R2: R2-8] named component attribution, direct manifest reads (Gate-1 change 4). These are
  // sealed-estimator counts over the exact authored/injected text, counted once at the turn where
  // the text entered the conversation (provider-reported usage cannot attribute per component —
  // injected feedback recurs in every later turn's input). Estimator identity is recorded in
  // manifest.prompt_overhead_tokens.estimator_id. Zero in arms 0/M except spec_authoring_tokens,
  // which counts any arm's applied specs/ writes (arm-uniform definition; Arm-0 spec maintenance
  // is a finding).
  spec_authoring_tokens: number;
  gate_protocol_interaction_tokens: number;
  oracle_feedback_tokens: number;
};

export type E4GateExecutorUsage = {
  red_runs: number;
  green_runs: number;
  wall_clock_ms: number;
};

export type E4TaskUsage = {
  turns: number;
  tokens: E4TokenUsage;
  wall_clock_ms: number;
  spend_usd: number;
  by_phase: Record<E4TaskPhase, E4ByPhaseUsage>;
  gate_executor: E4GateExecutorUsage | null;
};

export type E4TaskRecord = {
  task_index: number;
  opportunity_labels: E4OpportunityLabel[];
  termination: E4TaskTermination;
  phase_at_termination: E4TaskPhase;
  gate_events: E4GateEvents | null;
  oracle: {
    delta_pass: number;
    delta_total: number;
    cumulative_pass: number;
    cumulative_total: number;
  };
  false_confidence: { event: boolean; enforcement_outcome: "accepted" | "refused" | null };
  smoke_feedback_runs: number;
  // §3.2 floor-rule smoke prong ([R1-S1i]): how many of this task's smoke runs ended
  // readiness_failed. The rule reads this as a per-task boolean (> 0); the count is retained so a
  // flaky-start pattern stays visible.
  smoke_readiness_failures: number;
  drift: E4DriftReport;
  noticing_probe_answer: string;
  spec_touch: { touched: boolean; paths: string[] };
  usage: E4TaskUsage;
  snapshot: { hash: string; path: string };
  executor_artifacts: string[];
  status: "complete" | "aborted";
  // [R2: R2-5] required (non-null) iff termination === "executor_error", so the closed-infra
  // enumeration boundary (§2 M3, §3.2) is post-hoc auditable.
  classification_rationale: string | null;
};

// [M5] Reproduction sufficiency (Feature 5 criterion 1): substrate_seed alone cannot regenerate
// the draw — the PRNG stream depends on task_count, and op_mix steers the draw — so the manifest
// carries the full generator input. op_mix weights duplicate the sealed constants value by design;
// the inspector cross-checks them against the constants file when given one.
export type E4SubstrateConfigRecord = {
  task_count: number;
  op_mix: { weights: { drift_opportunity: number; additive: number; behavior_preserving: number } };
};

// [R2: R2-8] per-arm prompt-overhead diagnostic: sealed-estimator token counts of the system
// prompt (base protocol text, arm-identical) and this arm's policy-channel addition (Arm M's
// standing instruction / Arm H's gate protocol; 0 for Arm 0).
export type E4PromptOverheadTokens = {
  estimator_id: string;
  system_prompt_tokens: number;
  arm_channel_tokens: number;
};

export type E4RunManifest = {
  schema: "e4-run-manifest";
  schema_version: string;
  run_id: string;
  run_classification: E4RunClassification;
  compatibility_boundary: E4CompatibilityBoundaryRef;
  substrate_seed: number;
  substrate_config: E4SubstrateConfigRecord;
  pairing_label: string;
  arm: E4ArmId;
  model: { preset: string; model_id: string; route_id: string };
  budgets: E4Budgets;
  prompt_overhead_tokens: E4PromptOverheadTokens;
  tasks: E4TaskRecord[];
  resume_events: E4ResumeEvent[];
  replay_validity: {
    substrate_regeneration_ok: boolean;
    per_task_replay_ok: boolean[];
    chain_replay_valid: boolean;
  };
  usage_totals: E4UsageTotals;
};

export class E4ManifestValidationError extends Error {
  constructor(message: string) {
    super(`[e4-run-manifest] ${message}`);
    this.name = "E4ManifestValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new E4ManifestValidationError(`${path} must be an object`);
  }

  return value;
}

function requireKeys(obj: Record<string, unknown>, keys: readonly string[], path: string): void {
  for (const key of keys) {
    if (!(key in obj)) {
      throw new E4ManifestValidationError(`missing required field: ${path}.${key}`);
    }
  }
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new E4ManifestValidationError(`${path} must be an array`);
  }

  return value;
}

const TASK_PHASES: readonly E4TaskPhase[] = ["spec", "implementation"];

const TOKEN_USAGE_KEYS = ["fresh_input_tokens", "cached_input_tokens", "output_tokens"] as const;

function validateTokenUsage(value: unknown, path: string): void {
  const obj = requireObject(value, path);
  requireKeys(obj, TOKEN_USAGE_KEYS, path);
}

function validateByPhaseUsage(value: unknown, path: string): void {
  const obj = requireObject(value, path);

  for (const phase of TASK_PHASES) {
    const phaseUsage = requireObject(obj[phase], `${path}.${phase}`);
    requireKeys(
      phaseUsage,
      [
        "turns",
        "tokens",
        "wall_clock_ms",
        "spec_authoring_tokens",
        "gate_protocol_interaction_tokens",
        "oracle_feedback_tokens"
      ],
      `${path}.${phase}`
    );
    validateTokenUsage(phaseUsage.tokens, `${path}.${phase}.tokens`);
  }
}

function validateTaskUsage(value: unknown, path: string): void {
  const obj = requireObject(value, path);
  requireKeys(obj, ["turns", "tokens", "wall_clock_ms", "spend_usd", "by_phase", "gate_executor"], path);
  validateTokenUsage(obj.tokens, `${path}.tokens`);
  validateByPhaseUsage(obj.by_phase, `${path}.by_phase`);

  if (obj.gate_executor !== null) {
    const gateExecutor = requireObject(obj.gate_executor, `${path}.gate_executor`);
    requireKeys(gateExecutor, ["red_runs", "green_runs", "wall_clock_ms"], `${path}.gate_executor`);
  }
}

function validateTaskRecord(value: unknown, path: string): void {
  const task = requireObject(value, path);
  requireKeys(
    task,
    [
      "task_index",
      "opportunity_labels",
      "termination",
      "phase_at_termination",
      "gate_events",
      "oracle",
      "false_confidence",
      "smoke_feedback_runs",
      "smoke_readiness_failures",
      "drift",
      "noticing_probe_answer",
      "spec_touch",
      "usage",
      "snapshot",
      "executor_artifacts",
      "status",
      "classification_rationale"
    ],
    path
  );

  requireArray(task.opportunity_labels, `${path}.opportunity_labels`);

  if (task.gate_events !== null) {
    const gateEvents = requireObject(task.gate_events, `${path}.gate_events`);
    requireKeys(gateEvents, ["custody_failures", "red_check", "refused_done_over_red"], `${path}.gate_events`);
  }

  const oracle = requireObject(task.oracle, `${path}.oracle`);
  requireKeys(oracle, ["delta_pass", "delta_total", "cumulative_pass", "cumulative_total"], `${path}.oracle`);

  const falseConfidence = requireObject(task.false_confidence, `${path}.false_confidence`);
  requireKeys(falseConfidence, ["event", "enforcement_outcome"], `${path}.false_confidence`);

  const drift = requireObject(task.drift, `${path}.drift`);
  requireKeys(
    drift,
    ["meter_version", "discrepancies", "spec_unparseable", "extraction_failed", "registry_bypass", "counts"],
    `${path}.drift`
  );

  const specTouch = requireObject(task.spec_touch, `${path}.spec_touch`);
  requireKeys(specTouch, ["touched", "paths"], `${path}.spec_touch`);

  validateTaskUsage(task.usage, `${path}.usage`);

  const snapshot = requireObject(task.snapshot, `${path}.snapshot`);
  requireKeys(snapshot, ["hash", "path"], `${path}.snapshot`);

  requireArray(task.executor_artifacts, `${path}.executor_artifacts`);

  // [R2: R2-5] the closed-infra-enumeration boundary must be post-hoc auditable: every
  // executor_error record carries its rationale; every other termination leaves it null.
  if (task.termination === "executor_error") {
    if (typeof task.classification_rationale !== "string" || task.classification_rationale.length === 0) {
      throw new E4ManifestValidationError(
        `${path}.classification_rationale is required (non-empty string) when termination is executor_error`
      );
    }
  } else if (task.classification_rationale !== null) {
    throw new E4ManifestValidationError(
      `${path}.classification_rationale must be null when termination is not executor_error`
    );
  }
}

const MANIFEST_TOP_LEVEL_KEYS = [
  "schema",
  "schema_version",
  "run_id",
  "run_classification",
  "compatibility_boundary",
  "substrate_seed",
  "substrate_config",
  "pairing_label",
  "arm",
  "model",
  "budgets",
  "prompt_overhead_tokens",
  "tasks",
  "resume_events",
  "replay_validity",
  "usage_totals"
] as const;

export function validateE4RunManifest(raw: unknown): E4RunManifest {
  const manifest = requireObject(raw, "manifest");
  requireKeys(manifest, MANIFEST_TOP_LEVEL_KEYS, "manifest");

  if (manifest.schema !== "e4-run-manifest") {
    throw new E4ManifestValidationError(`schema mismatch: ${String(manifest.schema)}`);
  }

  const compatibilityBoundary = requireObject(manifest.compatibility_boundary, "manifest.compatibility_boundary");
  requireKeys(
    compatibilityBoundary,
    ["constants_version", "constants_hash", "meter_version", "substrate_config_id", "substrate_kind", "substrate_version"],
    "manifest.compatibility_boundary"
  );

  const model = requireObject(manifest.model, "manifest.model");
  requireKeys(model, ["preset", "model_id", "route_id"], "manifest.model");

  const substrateConfig = requireObject(manifest.substrate_config, "manifest.substrate_config");
  requireKeys(substrateConfig, ["task_count", "op_mix"], "manifest.substrate_config");
  const opMix = requireObject(substrateConfig.op_mix, "manifest.substrate_config.op_mix");
  const weights = requireObject(opMix.weights, "manifest.substrate_config.op_mix.weights");
  requireKeys(weights, ["drift_opportunity", "additive", "behavior_preserving"], "manifest.substrate_config.op_mix.weights");

  const promptOverhead = requireObject(manifest.prompt_overhead_tokens, "manifest.prompt_overhead_tokens");
  requireKeys(
    promptOverhead,
    ["estimator_id", "system_prompt_tokens", "arm_channel_tokens"],
    "manifest.prompt_overhead_tokens"
  );

  const budgets = requireObject(manifest.budgets, "manifest.budgets");
  requireKeys(budgets, ["turns_per_task", "verifications_per_task", "token_budget", "spend_cap_usd"], "manifest.budgets");

  const tasks = requireArray(manifest.tasks, "manifest.tasks");
  tasks.forEach((task, index) => validateTaskRecord(task, `manifest.tasks[${index}]`));

  requireArray(manifest.resume_events, "manifest.resume_events");

  const replayValidity = requireObject(manifest.replay_validity, "manifest.replay_validity");
  requireKeys(
    replayValidity,
    ["substrate_regeneration_ok", "per_task_replay_ok", "chain_replay_valid"],
    "manifest.replay_validity"
  );
  requireArray(replayValidity.per_task_replay_ok, "manifest.replay_validity.per_task_replay_ok");

  const usageTotals = requireObject(manifest.usage_totals, "manifest.usage_totals");
  requireKeys(usageTotals, ["turns", "tokens", "wall_clock_ms", "spend_usd"], "manifest.usage_totals");
  validateTokenUsage(usageTotals.tokens, "manifest.usage_totals.tokens");

  return manifest as unknown as E4RunManifest;
}
