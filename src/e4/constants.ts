// e4-sealed-constants validator + hash (IMPLEMENTATION-PLAN.md M0, §4). Own lineage, own schema,
// own validator — ADR-007. This module never validates or reads the E1 seal document;
// test/e4-no-legacy-imports.test.ts enforces that the E1 constants module is never imported
// anywhere under src/e4/.
//
// The v0 draft is filled in across M0–M6.5 (each milestone seals the parameters it introduces);
// this validator accepts a partially-drafted document — sections owned by a later milestone are
// `null` until that milestone seals them — but pins exact values already ratified at THIS gate
// (§3.2 floor_effect, §5.1 interpretability, R2-7).
import type { E4Budgets } from "./types";

export type E4CompatibilityBoundary = {
  substrate_config_id: string | null; // sealed M1
  substrate_kind: "procedural-rest-v1";
  substrate_version: string | null; // sealed M1
  meter_version: string | null; // sealed M2
};

export type E4FloorEffect = {
  task_index_max: number;
  consecutive_zero_tasks: number;
  per_arm: boolean;
};

export type E4Interpretability = {
  min_replay_valid_paired_seeds: number;
  extraction_failed_max_fraction: number;
  arm_h_spec_stall_max_fraction: number;
};

export type E4MeterRules = {
  convention_aggregation_min_items: number | null; // sealed M2 [R2: R2-1]
};

// Sealed at M1: the drawn-sequence proportions AND the structural (not just probabilistic)
// >=1 behavior_preserving guarantee draw.ts enforces regardless of the weights.
export type E4OpMixSeal = {
  weights: { drift_opportunity: number; additive: number; behavior_preserving: number };
  min_behavior_preserving_tasks: number;
};

// Sealed at M1: a one-word phrasing edit changes what an agent reads, so pool identifiers are
// sealed the same way protocol_text surfaces are (§4) — this is the substrate's own text surface.
export type E4PhrasingPools = {
  pool_ids: string[];
};

// Sealed at M3 (ADR-006): the executor's determinism parameters. Timeouts are sealed constants so
// a timeout is a classified outcome, never silent flake; the retry policy is arm-independent by
// construction (one string, no per-arm variants).
export type E4ExecutorSeal = {
  readiness_timeout_ms: number;
  request_timeout_ms: number;
  readiness_poll_interval_ms: number;
  fixed_order: true;
  port: 0;
  retry_policy: string;
};

// [R1-S2] Sealed condition-rendering TEXT surfaces. Keys accrete per owning milestone (M3 seals
// arm_h_gate_protocol incl. the §3.3 affirmation handshake verbatim; M4 seals the grammar/arm-M/
// noticing strings); once the block is non-null, arm_h_gate_protocol must be present.
export type E4ProtocolText = Record<string, string>;

export type E4SealedConstants = {
  schema: "e4-sealed-constants";
  version: string; // "0", "0.1", "0.2" … draft; non-budget frozen M6, budgets M6.5
  compatibility_boundary: E4CompatibilityBoundary;
  op_mix: E4OpMixSeal | null; // sealed M1
  phrasing_pools: E4PhrasingPools | null; // sealed M1
  executor: E4ExecutorSeal | null; // sealed M3
  protocol_text: E4ProtocolText | null; // sealed M3/M4
  budgets: E4Budgets | null; // slots M4, values frozen M6.5
  feedback: Record<string, unknown> | null; // sealed M4
  snapshot: Record<string, unknown> | null; // sealed M4
  floor_effect: E4FloorEffect; // pinned §3.2, this gate
  meter_rules: E4MeterRules;
  interpretability: E4Interpretability; // pinned §5.1, this gate [R2: R2-7]
};

const TOP_LEVEL_KEYS = [
  "schema",
  "version",
  "compatibility_boundary",
  "op_mix",
  "phrasing_pools",
  "executor",
  "protocol_text",
  "budgets",
  "feedback",
  "snapshot",
  "floor_effect",
  "meter_rules",
  "interpretability"
] as const;

export class E4ConstantsValidationError extends Error {
  constructor(message: string) {
    super(`[e4-sealed-constants] ${message}`);
    this.name = "E4ConstantsValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecordOrNull(value: unknown): value is Record<string, unknown> | null {
  return value === null || isRecord(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function validateE4Constants(raw: unknown): E4SealedConstants {
  if (!isRecord(raw)) {
    throw new E4ConstantsValidationError("root must be a JSON object");
  }

  for (const key of TOP_LEVEL_KEYS) {
    if (!(key in raw)) {
      throw new E4ConstantsValidationError(`missing required key: ${key}`);
    }
  }

  for (const key of Object.keys(raw)) {
    if (!(TOP_LEVEL_KEYS as readonly string[]).includes(key)) {
      throw new E4ConstantsValidationError(`unknown top-level key: ${key}`);
    }
  }

  const constants = raw as unknown as E4SealedConstants;

  if (constants.schema !== "e4-sealed-constants") {
    throw new E4ConstantsValidationError(`schema mismatch: ${String(constants.schema)}`);
  }

  if (!/^0(\.\d+)?$/.test(constants.version)) {
    throw new E4ConstantsValidationError("version must be a draft-v0 string (0, 0.1, 0.2, …)");
  }

  validateCompatibilityBoundary(constants.compatibility_boundary);

  for (const key of ["feedback", "snapshot"] as const) {
    if (!isRecordOrNull(constants[key])) {
      throw new E4ConstantsValidationError(`${key} must be an object or null until its owning milestone seals it`);
    }
  }

  if (constants.executor !== null && !isValidExecutorSeal(constants.executor)) {
    throw new E4ConstantsValidationError(
      "executor must be null or a fully-populated E4ExecutorSeal (positive timeouts, fixed_order=true, port=0, retry_policy string)"
    );
  }

  if (constants.protocol_text !== null) {
    validateProtocolText(constants.protocol_text);
  }

  if (constants.op_mix !== null && !isValidOpMixSeal(constants.op_mix)) {
    throw new E4ConstantsValidationError("op_mix must be null or a fully-populated E4OpMixSeal object");
  }

  if (constants.phrasing_pools !== null && !isValidPhrasingPools(constants.phrasing_pools)) {
    throw new E4ConstantsValidationError("phrasing_pools must be null or a fully-populated E4PhrasingPools object");
  }

  if (constants.budgets !== null && !isValidBudgets(constants.budgets)) {
    throw new E4ConstantsValidationError("budgets must be null or a fully-populated E4Budgets object");
  }

  validateFloorEffect(constants.floor_effect);
  validateMeterRules(constants.meter_rules);
  validateInterpretability(constants.interpretability);

  return constants;
}

function validateCompatibilityBoundary(boundary: unknown): asserts boundary is E4CompatibilityBoundary {
  if (!isRecord(boundary)) {
    throw new E4ConstantsValidationError("compatibility_boundary must be an object");
  }

  if (boundary.substrate_kind !== "procedural-rest-v1") {
    throw new E4ConstantsValidationError("compatibility_boundary.substrate_kind must be procedural-rest-v1");
  }

  for (const key of ["substrate_config_id", "substrate_version", "meter_version"] as const) {
    const value = boundary[key];

    if (value !== null && typeof value !== "string") {
      throw new E4ConstantsValidationError(`compatibility_boundary.${key} must be a string or null`);
    }
  }
}

function isValidOpMixSeal(value: unknown): value is E4OpMixSeal {
  if (!isRecord(value) || !isRecord(value.weights)) {
    return false;
  }

  const weights = value.weights;
  const weightsValid = (["drift_opportunity", "additive", "behavior_preserving"] as const).every(
    (key) => typeof weights[key] === "number" && (weights[key] as number) >= 0
  );

  return weightsValid && isPositiveInteger(value.min_behavior_preserving_tasks);
}

function isValidExecutorSeal(value: unknown): value is E4ExecutorSeal {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPositiveInteger(value.readiness_timeout_ms) &&
    isPositiveInteger(value.request_timeout_ms) &&
    isPositiveInteger(value.readiness_poll_interval_ms) &&
    value.fixed_order === true &&
    value.port === 0 &&
    typeof value.retry_policy === "string" &&
    value.retry_policy.length > 0
  );
}

function validateProtocolText(value: unknown): asserts value is E4ProtocolText {
  if (!isRecord(value)) {
    throw new E4ConstantsValidationError("protocol_text must be an object or null until M3 seals it");
  }

  for (const [key, text] of Object.entries(value)) {
    if (typeof text !== "string" || text.length === 0) {
      throw new E4ConstantsValidationError(`protocol_text.${key} must be a non-empty string (sealed verbatim text surface)`);
    }
  }

  // M3 seals the gate protocol first; any non-null protocol_text block without it is malformed.
  if (typeof value.arm_h_gate_protocol !== "string" || value.arm_h_gate_protocol.length === 0) {
    throw new E4ConstantsValidationError("protocol_text.arm_h_gate_protocol is required once protocol_text is sealed (M3)");
  }
}

function isValidPhrasingPools(value: unknown): value is E4PhrasingPools {
  return isRecord(value) && Array.isArray(value.pool_ids) && value.pool_ids.every((id) => typeof id === "string");
}

function isValidBudgets(value: unknown): value is E4Budgets {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPositiveInteger(value.turns_per_task) &&
    isPositiveInteger(value.verifications_per_task) &&
    isPositiveInteger(value.token_budget) &&
    typeof value.spend_cap_usd === "number" &&
    value.spend_cap_usd > 0
  );
}

function validateFloorEffect(floorEffect: unknown): asserts floorEffect is E4FloorEffect {
  if (!isRecord(floorEffect)) {
    throw new E4ConstantsValidationError("floor_effect must be an object");
  }

  // §3.2's pinned numeric definition — ratified at this gate, not deferred to a later milestone.
  if (
    floorEffect.task_index_max !== 3 ||
    floorEffect.consecutive_zero_tasks !== 2 ||
    floorEffect.per_arm !== true
  ) {
    throw new E4ConstantsValidationError(
      "floor_effect must match the §3.2 pin: task_index_max=3, consecutive_zero_tasks=2, per_arm=true"
    );
  }
}

function validateMeterRules(meterRules: unknown): asserts meterRules is E4MeterRules {
  if (!isRecord(meterRules)) {
    throw new E4ConstantsValidationError("meter_rules must be an object");
  }

  const value = meterRules.convention_aggregation_min_items;

  if (value !== null && !isPositiveInteger(value)) {
    throw new E4ConstantsValidationError(
      "meter_rules.convention_aggregation_min_items must be null or a positive integer"
    );
  }
}

function validateInterpretability(interpretability: unknown): asserts interpretability is E4Interpretability {
  if (!isRecord(interpretability)) {
    throw new E4ConstantsValidationError("interpretability must be an object");
  }

  // §5.1's pinned thresholds ([R2: R2-7]) — ratified at this gate.
  if (
    interpretability.min_replay_valid_paired_seeds !== 2 ||
    interpretability.extraction_failed_max_fraction !== 0.1 ||
    interpretability.arm_h_spec_stall_max_fraction !== 0.5
  ) {
    throw new E4ConstantsValidationError(
      "interpretability must match the §5.1 pin: min_replay_valid_paired_seeds=2, " +
        "extraction_failed_max_fraction=0.10, arm_h_spec_stall_max_fraction=0.50"
    );
  }
}

export function hashE4ConstantsBytes(bytes: ArrayBuffer | Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

export async function loadE4Constants(path: string): Promise<{ constants: E4SealedConstants; hash: string }> {
  const file = Bun.file(path);

  if (!(await file.exists())) {
    throw new E4ConstantsValidationError(`constants file not found: ${path}`);
  }

  const bytes = await file.arrayBuffer();
  const hash = hashE4ConstantsBytes(bytes);

  let raw: unknown;

  try {
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new E4ConstantsValidationError(`constants file is not valid JSON: ${String(error)}`);
  }

  return { constants: validateE4Constants(raw), hash };
}
