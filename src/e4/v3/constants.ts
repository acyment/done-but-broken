// e4-v3-sealed-constants validator + freeze discipline (E4V3-PRODUCT-LOOP-PROPOSAL.md §4/§5,
// v3-M4). The v3 lineage EXTENDS the fully-frozen v2 file rather than replacing it: the v2
// constants object still drives budgets/executor/protocol_text for every run, and the v3 file
// adds only what the product loop introduced — the three-arm profile, the product-gate config,
// and the new sealed-surface ids. The v3 file pins the exact v2 base by hash, so the pair is one
// compatibility boundary.
//
// Sealed TEXT discipline: the ASK_PM protocol text and the product-gate protocol text live as
// exported constants in code (turn-protocol.ts / product-gate.ts) and are sealed through the
// code-twin hashes recorded here — the same bytes-level freeze the v2 file applies to its sealed
// modules, without duplicating prose into JSON.
//
// Budgets: v3 runs read budgets from the v2 v0.3 file PROVISIONALLY. The product gate changes
// per-task appetite, so the v3-M5 calibration must re-ratify (or adjust-once) before any
// evidence run; that event moves this file's version and is a recorded gate act.
import { E4V2ConstantsValidationError, hashE4V2Bytes } from "../v2/constants";
import type { E4V3ReconcileCheck } from "./reconcile";

export const E4_V3_CONSTANTS_PATH = "docs/protocols/e4-v3-sealed-constants-v0.json";

export type E4V3SealedConstants = {
  schema: "e4-v3-sealed-constants";
  version: string;
  protocol_profile_id: "e4-openspec-workflow-v2";
  arms: ["e4_arm_0", "e4_arm_h", "e4_arm_p"];
  extends: {
    v2_constants_path: string;
    v2_constants_hash: string; // must equal the live v2 file's hash
  };
  compatibility_boundary: {
    determinacy_table_id: string;
    pm_brief_id: string;
    reconciler_id: string;
    mutation_harness_id: string;
    pm_review_id: string;
    product_gate_id: string;
    turn_protocol_id: string;
    // E5 P0-V sealed measurement-surface ids. OPTIONAL at the type/validator level so archived
    // pre-P0V constants files (git-show historical verdict re-runs) still validate; the census
    // asserts the LIVE file carries them and they match the module constants.
    on_topic_id?: string;
    root_cause_burden_id?: string;
    commitment_scorer_id?: string;
  };
  product_gate: {
    mutation_kill_floor: number;
    blocking_checks: E4V3ReconcileCheck[];
  };
  code_twins: Record<string, string>; // repo-relative sealed v3 module path → sha256
  budgets_note: string;
  // v3-M7 evidence seal (pre-registration §2): the composition-proof primary's sealed
  // parameters — the close-rate guard gap and the fixed scheduled-task denominator.
  m7_evidence?: {
    close_rate_guard_max_gap: number;
    scheduled_tasks_per_sequence: number;
  };
};

const KNOWN_CHECKS: ReadonlySet<string> = new Set([
  "route_without_scenario",
  "scenario_route_absent",
  "rule_without_rejection_scenario",
  "rejection_scenario_without_rule",
  "field_never_exercised",
  "scenario_field_unknown",
  "scenario_floor",
  "create_round_trip_missing",
  "rejection_case_missing"
]);

export function validateE4V3Constants(raw: unknown): E4V3SealedConstants {
  if (typeof raw !== "object" || raw === null) {
    throw new E4V2ConstantsValidationError("v3 constants must be a JSON object");
  }

  const constants = raw as E4V3SealedConstants;

  if (constants.schema !== "e4-v3-sealed-constants") {
    throw new E4V2ConstantsValidationError(`v3 schema mismatch: ${String(constants.schema)}`);
  }

  if (constants.protocol_profile_id !== "e4-openspec-workflow-v2") {
    throw new E4V2ConstantsValidationError("v3 protocol_profile_id must be e4-openspec-workflow-v2");
  }

  if (JSON.stringify(constants.arms) !== JSON.stringify(["e4_arm_0", "e4_arm_h", "e4_arm_p"])) {
    throw new E4V2ConstantsValidationError('v3 arms must be exactly ["e4_arm_0", "e4_arm_h", "e4_arm_p"]');
  }

  if (!constants.extends?.v2_constants_path || !/^[0-9a-f]{64}$/.test(constants.extends?.v2_constants_hash ?? "")) {
    throw new E4V2ConstantsValidationError("v3 extends block must pin the v2 constants path + sha256");
  }

  const boundary = constants.compatibility_boundary;

  for (const key of [
    "determinacy_table_id",
    "pm_brief_id",
    "reconciler_id",
    "mutation_harness_id",
    "pm_review_id",
    "product_gate_id",
    "turn_protocol_id"
  ] as const) {
    if (typeof boundary?.[key] !== "string" || boundary[key].length === 0) {
      throw new E4V2ConstantsValidationError(`v3 compatibility_boundary.${key} missing`);
    }
  }

  // E5 P0-V ids: optional (historical files predate them), but never empty when present.
  for (const key of ["on_topic_id", "root_cause_burden_id", "commitment_scorer_id"] as const) {
    if (boundary[key] !== undefined && (typeof boundary[key] !== "string" || boundary[key].length === 0)) {
      throw new E4V2ConstantsValidationError(`v3 compatibility_boundary.${key} must be a non-empty string when present`);
    }
  }

  const gate = constants.product_gate;

  if (!(typeof gate?.mutation_kill_floor === "number" && gate.mutation_kill_floor > 0 && gate.mutation_kill_floor <= 1)) {
    throw new E4V2ConstantsValidationError("v3 product_gate.mutation_kill_floor must be in (0, 1]");
  }

  if (!Array.isArray(gate.blocking_checks) || gate.blocking_checks.length === 0) {
    throw new E4V2ConstantsValidationError("v3 product_gate.blocking_checks must be a non-empty list");
  }

  for (const check of gate.blocking_checks) {
    if (!KNOWN_CHECKS.has(check)) {
      throw new E4V2ConstantsValidationError(`v3 product_gate.blocking_checks contains unknown check: ${String(check)}`);
    }
  }

  if (typeof constants.code_twins !== "object" || constants.code_twins === null || Object.keys(constants.code_twins).length === 0) {
    throw new E4V2ConstantsValidationError("v3 code_twins must be a non-empty map");
  }

  if (constants.m7_evidence !== undefined) {
    const m7 = constants.m7_evidence;

    if (!(typeof m7.close_rate_guard_max_gap === "number" && m7.close_rate_guard_max_gap >= 0 && m7.close_rate_guard_max_gap < 1)) {
      throw new E4V2ConstantsValidationError("v3 m7_evidence.close_rate_guard_max_gap must be in [0, 1)");
    }

    if (!(Number.isInteger(m7.scheduled_tasks_per_sequence) && m7.scheduled_tasks_per_sequence > 0)) {
      throw new E4V2ConstantsValidationError("v3 m7_evidence.scheduled_tasks_per_sequence must be a positive integer");
    }
  }

  return constants;
}

export async function loadE4V3Constants(input: {
  v3Path: string;
  v2Path: string;
}): Promise<{ constants: E4V3SealedConstants; hash: string }> {
  const bytes = await Bun.file(input.v3Path).arrayBuffer();
  const constants = validateE4V3Constants(JSON.parse(new TextDecoder().decode(bytes)));
  const v2Bytes = await Bun.file(input.v2Path).arrayBuffer();
  const v2Hash = hashE4V2Bytes(v2Bytes);

  if (v2Hash !== constants.extends.v2_constants_hash) {
    throw new E4V2ConstantsValidationError(
      `v3 constants pin v2 base ${constants.extends.v2_constants_hash} but the live v2 file hashes to ${v2Hash}`
    );
  }

  return { constants, hash: hashE4V2Bytes(bytes) };
}
