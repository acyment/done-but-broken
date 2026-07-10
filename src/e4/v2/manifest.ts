// v2 run manifest (E4V2 design §3 "carry over; field additions only"; v2-M5). One manifest per
// arm sequence, written after every task close (crash durability), carrying everything the
// inspector needs to recompute replay validity and everything the verdict/report layer reads:
// v2 gate events (change-level red capture), archive outcomes, the re-based drift reports, and
// the per-task kill-score reports (hidden instrument — recorded here, never agent-facing).
import type { E4RunClassification } from "../types";
import type { E4V2ArmId } from "./constants";
import type { E4V2TaskRunResult } from "./runner";

export type E4V2TaskRecord = E4V2TaskRunResult & {
  task_index: number;
  op_kind: string;
  opportunity_labels: string[];
  nl_request: string;
};

export type E4V2ReplayValidity = {
  substrate_regeneration_ok: boolean;
  per_task_replay_ok: boolean[];
  chain_replay_valid: boolean;
};

// v3-M6 gate commit (E4V3-M5-BUDGET-CALIBRATION-NOTES.md flag 1): three-arm product-loop runs
// stamp the v3 constants identity alongside the v2 one — the v3 file EXTENDS the frozen v2 file,
// so the boundary is only fully identified by both hashes. Additive and optional at the type
// level (historical v3-M5 calibration manifests predate it); REQUIRED on pilot-classified
// manifests under the v2 profile (validation below) and read by the v3 verdict tool's predicate
// (b).
export type E4V3BoundaryStamp = {
  constants_version: string;
  constants_hash: string;
  determinacy_table_id: string;
  pm_brief_id: string;
  reconciler_id: string;
  mutation_harness_id: string;
  pm_review_id: string;
  product_gate_id: string;
  turn_protocol_id: string;
};

export type E4V2RunManifest = {
  schema: "e4-v2-run-manifest";
  schema_version: "1";
  run_classification: E4RunClassification;
  // v2 runs stamp -v1; v3 three-arm product-loop runs stamp -v2 (the PM brief channel is a
  // shared-environment change — E4V3-PRODUCT-LOOP-PROPOSAL.md §3.4).
  protocol_profile_id: "e4-openspec-workflow-v1" | "e4-openspec-workflow-v2";
  arm: E4V2ArmId;
  arm_mode: "prose" | "executed";
  pairing_label: string;
  model: { preset: string; model_id: string; route_id: string };
  compatibility_boundary: {
    constants_version: string;
    constants_hash: string;
    substrate_kind: string;
    substrate_version: string;
    meter_version: string;
    converter_id: string;
    step_table_id: string;
    t0_gold_spec_id: string;
    bank_id: string;
    substrate_config: {
      substrate_config_id: string;
      substrate_seed: number;
      task_count: number;
      op_mix: { weights: Record<string, number> };
    };
    v3?: E4V3BoundaryStamp;
  };
  initial_snapshot: { hash: string; path: string };
  tasks: E4V2TaskRecord[];
  usage_totals: { turns: number; spend_usd: number; wall_clock_ms: number };
  replay_validity: E4V2ReplayValidity;
  status: "in_progress" | "complete";
};

export class E4V2ManifestError extends Error {
  constructor(message: string) {
    super(`[e4-v2-manifest] ${message}`);
    this.name = "E4V2ManifestError";
  }
}

// Structural validation (lean, fail-loud): the fields every downstream reader dereferences.
export function validateE4V2Manifest(raw: unknown): E4V2RunManifest {
  if (typeof raw !== "object" || raw === null) {
    throw new E4V2ManifestError("manifest must be a JSON object");
  }

  const manifest = raw as E4V2RunManifest;

  if (manifest.schema !== "e4-v2-run-manifest") {
    throw new E4V2ManifestError(`schema mismatch: ${String(manifest.schema)}`);
  }

  if (
    manifest.protocol_profile_id !== "e4-openspec-workflow-v1" &&
    manifest.protocol_profile_id !== "e4-openspec-workflow-v2"
  ) {
    throw new E4V2ManifestError("protocol_profile_id must be e4-openspec-workflow-v1 or -v2");
  }

  if (manifest.arm !== "e4_arm_0" && manifest.arm !== "e4_arm_h" && manifest.arm !== "e4_arm_p") {
    throw new E4V2ManifestError(`unknown arm: ${String(manifest.arm)}`);
  }

  if (manifest.arm === "e4_arm_p" && manifest.protocol_profile_id !== "e4-openspec-workflow-v2") {
    throw new E4V2ManifestError("e4_arm_p exists only under the e4-openspec-workflow-v2 profile");
  }

  if (!manifest.compatibility_boundary?.constants_hash || !manifest.compatibility_boundary?.substrate_config) {
    throw new E4V2ManifestError("compatibility_boundary is incomplete");
  }

  // v3-M6 gate: evidence (pilot) manifests under the three-arm profile must stamp the v3
  // constants identity. Dry-run and calibration manifests may omit it (the committed v3-M5
  // calibration manifest predates the stamp), but the v3 verdict tool's predicate (b) reads it
  // on every evidence manifest.
  if (manifest.run_classification === "pilot" && manifest.protocol_profile_id === "e4-openspec-workflow-v2") {
    const v3 = manifest.compatibility_boundary.v3;

    if (!v3 || !/^[0-9a-f]{64}$/.test(v3.constants_hash ?? "") || typeof v3.constants_version !== "string") {
      throw new E4V2ManifestError(
        "pilot manifests under e4-openspec-workflow-v2 must stamp the v3 constants identity (compatibility_boundary.v3)"
      );
    }
  }

  if (
    typeof manifest.model?.preset !== "string" ||
    typeof manifest.model?.model_id !== "string" ||
    typeof manifest.model?.route_id !== "string"
  ) {
    throw new E4V2ManifestError("model is incomplete");
  }

  if (!Array.isArray(manifest.tasks)) {
    throw new E4V2ManifestError("tasks must be an array");
  }

  for (const task of manifest.tasks) {
    if (typeof task.task_index !== "number" || !task.snapshot?.hash || !task.gate_events || !task.drift || !task.kill_score) {
      throw new E4V2ManifestError(`task record ${String(task.task_index)} is incomplete`);
    }
  }

  if (!manifest.replay_validity || typeof manifest.replay_validity.chain_replay_valid !== "boolean") {
    throw new E4V2ManifestError("replay_validity is incomplete");
  }

  return manifest;
}
