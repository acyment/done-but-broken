// e4-v2-sealed-constants validator + hash discipline (E4V2 design §5.4/§5.5 sealing + §9 v2-M5
// "non-budget v2 constants freeze"). A fresh compatibility boundary and lineage — never the v1
// file (docs/protocols/e4-sealed-constants-v0.json, fully frozen at v0.7 and untouched by v2).
//
// The sealed core surfaces (`e4-openspec-gherkin-v1`, `e4-step-table-v1`, `e4-t0-gold-spec-v1`,
// the §5.6 substrate semantics, the bank) are CODE TWINS: the constants file records the sha256
// of each twin's source bytes, and test/e4-v2-constants.test.ts recomputes them — any edit to a
// sealed module fails the suite until a new recorded gate decision updates the seal. The
// non-budget projection hash is additionally pinned by test (v1's M6 freeze discipline): budget
// VALUES stay free for the v2-M6 calibration; everything else is frozen at v2-M5.
import type { E4Budgets } from "../types";

export type E4V2ArmId = "e4_arm_0" | "e4_arm_h";

export type E4V2SealedConstants = {
  schema: "e4-v2-sealed-constants";
  version: string; // draft-v0 string; non-budget frozen at v2-M5, budgets at v2-M6
  protocol_profile_id: "e4-openspec-workflow-v1";
  arms: E4V2ArmId[];
  compatibility_boundary: {
    substrate_config_id: string;
    substrate_kind: "procedural-rest-v2";
    substrate_version: string;
    meter_version: string;
    converter_id: string;
    step_table_id: string;
    t0_gold_spec_id: string;
    bank_id: string;
  };
  code_twins: Record<string, string>; // repo-relative sealed module path → sha256 of its bytes
  op_mix: {
    weights: { drift_opportunity: number; additive: number; behavior_preserving: number };
    min_behavior_preserving_tasks: number;
  };
  executor: {
    readiness_timeout_ms: number;
    request_timeout_ms: number;
    readiness_poll_interval_ms: number;
    fixed_order: true;
    port: 0;
    retry_policy: string;
  };
  openspec: {
    package: "@fission-ai/openspec";
    version: string;
    validate_specs_args: string[];
    validate_change_args: string[]; // "<change>" placeholder for the change name
    archive_args: string[]; // ditto
  };
  feedback: { smoke_command: string; retry_policy: string };
  protocol_text: {
    block_grammar_id: string;
    turn_protocol_id: string;
    workflow_protocol: string; // arm-uniform workflow section of the system prompt
    executed_arm_gate_protocol: string; // the executed arm's declared policy channel
    noticing_probe_prompt: string;
    workspace_readme: string; // §5.5: the T0 README seals verbatim at the M5 freeze
  };
  budgets: E4Budgets; // provisional VALUES until the v2-M6 calibration ratifies them
  floor_effect: { task_index_max: number; consecutive_zero_tasks: number; per_arm: boolean };
  interpretability: {
    min_replay_valid_paired_seeds: number;
    extraction_failed_max_fraction: number;
    arm_h_spec_stall_max_fraction: number;
  };
};

const TOP_LEVEL_KEYS = [
  "schema",
  "version",
  "protocol_profile_id",
  "arms",
  "compatibility_boundary",
  "code_twins",
  "op_mix",
  "executor",
  "openspec",
  "feedback",
  "protocol_text",
  "budgets",
  "floor_effect",
  "interpretability"
] as const;

export class E4V2ConstantsValidationError extends Error {
  constructor(message: string) {
    super(`[e4-v2-sealed-constants] ${message}`);
    this.name = "E4V2ConstantsValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, label: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new E4V2ConstantsValidationError(`${label} must be a non-empty string`);
  }
}

export function validateE4V2Constants(raw: unknown): E4V2SealedConstants {
  if (!isRecord(raw)) {
    throw new E4V2ConstantsValidationError("root must be a JSON object");
  }

  for (const key of TOP_LEVEL_KEYS) {
    if (!(key in raw)) {
      throw new E4V2ConstantsValidationError(`missing required key: ${key}`);
    }
  }

  for (const key of Object.keys(raw)) {
    if (!(TOP_LEVEL_KEYS as readonly string[]).includes(key)) {
      throw new E4V2ConstantsValidationError(`unknown top-level key: ${key}`);
    }
  }

  const constants = raw as unknown as E4V2SealedConstants;

  if (constants.schema !== "e4-v2-sealed-constants") {
    throw new E4V2ConstantsValidationError(`schema mismatch: ${String(constants.schema)}`);
  }

  if (!/^0(\.\d+)?$/.test(constants.version)) {
    throw new E4V2ConstantsValidationError("version must be a draft-v0 string (0, 0.1, …)");
  }

  if (constants.protocol_profile_id !== "e4-openspec-workflow-v1") {
    throw new E4V2ConstantsValidationError("protocol_profile_id must be e4-openspec-workflow-v1");
  }

  if (JSON.stringify(constants.arms) !== JSON.stringify(["e4_arm_0", "e4_arm_h"])) {
    throw new E4V2ConstantsValidationError('arms must be exactly ["e4_arm_0", "e4_arm_h"] (two-arm v2 design)');
  }

  const boundary = constants.compatibility_boundary;

  if (!isRecord(boundary) || boundary.substrate_kind !== "procedural-rest-v2") {
    throw new E4V2ConstantsValidationError("compatibility_boundary.substrate_kind must be procedural-rest-v2");
  }

  for (const key of ["substrate_config_id", "substrate_version", "meter_version", "converter_id", "step_table_id", "t0_gold_spec_id", "bank_id"] as const) {
    requireNonEmptyString(boundary[key], `compatibility_boundary.${key}`);
  }

  if (!isRecord(constants.code_twins) || Object.keys(constants.code_twins).length === 0) {
    throw new E4V2ConstantsValidationError("code_twins must map ≥1 sealed module path to a sha256");
  }

  for (const [path, hash] of Object.entries(constants.code_twins)) {
    if (!/^[0-9a-f]{64}$/.test(hash as string)) {
      throw new E4V2ConstantsValidationError(`code_twins[${path}] must be a sha256 hex digest`);
    }
  }

  for (const key of ["workflow_protocol", "executed_arm_gate_protocol", "noticing_probe_prompt", "workspace_readme", "block_grammar_id", "turn_protocol_id"] as const) {
    requireNonEmptyString(constants.protocol_text?.[key], `protocol_text.${key}`);
  }

  if (constants.openspec.version !== "1.4.1") {
    throw new E4V2ConstantsValidationError("openspec.version must be the pinned 1.4.1");
  }

  // §3.2 / §5.1 pins carry over verbatim from the v1 gate decisions.
  const floor = constants.floor_effect;

  if (floor.task_index_max !== 3 || floor.consecutive_zero_tasks !== 2 || floor.per_arm !== true) {
    throw new E4V2ConstantsValidationError("floor_effect must match the §3.2 pin (3, 2, per_arm)");
  }

  const interpretability = constants.interpretability;

  if (
    interpretability.min_replay_valid_paired_seeds !== 2 ||
    interpretability.extraction_failed_max_fraction !== 0.1 ||
    interpretability.arm_h_spec_stall_max_fraction !== 0.5
  ) {
    throw new E4V2ConstantsValidationError("interpretability must match the §5.1 pin (2, 0.10, 0.50)");
  }

  return constants;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeysDeep(value[key])])
    );
  }
  return value;
}

// The frozen surface: every field except the budget VALUES and the draft-version metadata
// (v1's M6 freeze-projection discipline). Canonical form = key-sorted JSON.
export function e4V2NonBudgetProjection(constants: E4V2SealedConstants): string {
  const { budgets: _budgets, version: _version, ...frozen } = constants;
  return JSON.stringify(sortKeysDeep(frozen));
}

export function hashE4V2Bytes(bytes: ArrayBuffer | Uint8Array | string): string {
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

export const E4_V2_CONSTANTS_PATH = "docs/protocols/e4-v2-sealed-constants-v0.json";

export async function loadE4V2Constants(path: string): Promise<{ constants: E4V2SealedConstants; hash: string }> {
  const file = Bun.file(path);

  if (!(await file.exists())) {
    throw new E4V2ConstantsValidationError(`constants file not found: ${path}`);
  }

  const bytes = await file.arrayBuffer();

  let raw: unknown;

  try {
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new E4V2ConstantsValidationError(`constants file is not valid JSON: ${String(error)}`);
  }

  return { constants: validateE4V2Constants(raw), hash: hashE4V2Bytes(bytes) };
}
