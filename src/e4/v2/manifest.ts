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

export type E4V2RunManifest = {
  schema: "e4-v2-run-manifest";
  schema_version: "1";
  run_classification: E4RunClassification;
  protocol_profile_id: "e4-openspec-workflow-v1";
  arm: E4V2ArmId;
  arm_mode: "prose" | "executed";
  pairing_label: string;
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

  if (manifest.protocol_profile_id !== "e4-openspec-workflow-v1") {
    throw new E4V2ManifestError("protocol_profile_id must be e4-openspec-workflow-v1");
  }

  if (manifest.arm !== "e4_arm_0" && manifest.arm !== "e4_arm_h") {
    throw new E4V2ManifestError(`unknown arm: ${String(manifest.arm)}`);
  }

  if (!manifest.compatibility_boundary?.constants_hash || !manifest.compatibility_boundary?.substrate_config) {
    throw new E4V2ManifestError("compatibility_boundary is incomplete");
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
