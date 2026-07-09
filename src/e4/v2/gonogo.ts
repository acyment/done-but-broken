// v2 go/no-go — the v2-M7 verdict tool (docs/protocols/e4-v2-m7-pilot-preregistration-v1.md §2,
// sealed pre-data at commit e615395). A port of src/e4/gonogo.ts (computeE4GoNoGo) onto the v2
// manifest with the two-arm predicates exactly as pinned there:
//   (a) Arm-0 drift velocity > 0 on EVERY surviving seed (v1 was ≥1 seed; the seal pins "every");
//   (b) boundary stamp — constants hash, meter version, and the §1 compatibility-boundary ids
//       (converter / step table / T0 gold spec / bank) in every manifest;
//   (c) separation — c1 velocity as v1; c2 compares the IDENTICAL per-task binary event in both
//       arms (`false_confidence.event`), never v1's refusal-based gated-arm reading —
//       `refused_done_over_red` is retained as a reported diagnostic only; c3 retired with Arm M.
// §5.1 interpretability triggers run FIRST (a pilot that broke is never reported as a pilot that
// measured); trigger 2 carries the v2 spec_touch split in its detail (custody floors force spec
// changes on non-BP tasks, so the split discriminates on workflow flow, not voluntary upkeep).
// The per-arm floor rule runs at its sealed constants and is REPORTED: the H4-analog slope is
// blocked when any arm floor-collapses, and (c) is evaluated on the remaining comparisons —
// c1/c2 do not read that slope, so neither is ever removed by it (v1 §5 "never depends on H4
// alone"). Thresholds come from the sealed constants, never from code defaults.
import type { E4TaskRecord } from "../manifest";
import {
  computeE4DriftVelocity,
  computeE4FloorCollapse,
  type E4DriftVelocityResult,
  type E4FloorCollapseResult
} from "../result-schema";
import type { E4DriftClass, E4DriftItemKind } from "../types";
import type { E4V2ArmId, E4V2SealedConstants } from "./constants";
import type { E4V2RunManifest, E4V2TaskRecord } from "./manifest";

export type E4V2GoNoGoVerdict = "go" | "no_go" | "inconclusive_uninterpretable";

export type E4V2PairedSeedGroup = {
  pairing_label: string;
  substrate_seed: number;
  manifests: Record<E4V2ArmId, E4V2RunManifest>;
  surviving: boolean; // complete + replay-valid in every arm (§5.1 trigger 1 input)
  exclusion_reasons: string[];
};

export type E4V2GoNoGoReport = {
  verdict: E4V2GoNoGoVerdict;
  exit_code: 0 | 1 | 2;
  groups: Array<Pick<E4V2PairedSeedGroup, "pairing_label" | "substrate_seed" | "surviving" | "exclusion_reasons">>;
  triggers: Array<{ id: string; fired: boolean; detail: string }>;
  predicates: {
    a_arm0_drifts: { holds: boolean; per_seed_velocity: Array<{ seed: number; velocity: number | null }> };
    b_boundary_stamp: { holds: boolean; detail: string };
    c_separation: {
      holds: boolean;
      c1_velocity: { holds: boolean; arm0_mean: number | null; arm_h_mean: number | null };
      c2_false_confidence: {
        holds: boolean;
        arm0_rate: number | null;
        arm_h_rate: number | null;
        arm0_events: number;
        arm_h_events: number;
        attempted: { arm0: number; arm_h: number };
        refused_done_over_red_diagnostic: { arm0: number; arm_h: number };
      };
    };
  };
  diagnostics: {
    class_composition_by_arm: Record<string, Record<E4DriftItemKind, Record<E4DriftClass, number>>>;
    floor: Array<{ pairing_label: string; substrate_seed: number; arm: E4V2ArmId } & E4FloorCollapseResult>;
    h4_analog_blocked_floor_confounded: boolean;
    advisory_flags: string[];
  };
  failed_predicates: string[];
};

export class E4V2GoNoGoError extends Error {
  constructor(message: string) {
    super(`[e4-v2-gonogo] ${message}`);
    this.name = "E4V2GoNoGoError";
  }
}

const ARMS: readonly E4V2ArmId[] = ["e4_arm_0", "e4_arm_h"];

function mean(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

// The committed v1 episode-onset semantics operate UNCHANGED on the v2 meter's discrepancy lists
// (design §7.5 / pre-registration analysis layer), so the v1 functions are reused verbatim. They
// read only { status, task_index, opportunity_labels, drift.discrepancies } (velocity) and
// { status, task_index, oracle.cumulative_*, smoke_readiness_failures } (floor rule) — every one
// present on E4V2TaskRecord with identical types (drift is the shared E4DriftReport). The cast
// narrows to that shared surface instead of forking the sealed semantics.
function asV1TaskRecords(tasks: E4V2TaskRecord[]): E4TaskRecord[] {
  return tasks as unknown as E4TaskRecord[];
}

function velocityOrNull(result: E4DriftVelocityResult): number | null {
  return result.velocity;
}

export function groupE4V2PairedSeeds(manifests: E4V2RunManifest[]): E4V2PairedSeedGroup[] {
  const byLabel = new Map<string, E4V2RunManifest[]>();

  for (const manifest of manifests) {
    const list = byLabel.get(manifest.pairing_label) ?? [];
    list.push(manifest);
    byLabel.set(manifest.pairing_label, list);
  }

  const groups: E4V2PairedSeedGroup[] = [];

  for (const [label, group] of [...byLabel.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const byArm = new Map(group.map((manifest) => [manifest.arm, manifest]));
    const exclusionReasons: string[] = [];

    for (const arm of ARMS) {
      const manifest = byArm.get(arm);

      if (!manifest) {
        exclusionReasons.push(`${arm}: manifest missing`);
        continue;
      }

      if (manifest.tasks.length < manifest.compatibility_boundary.substrate_config.task_count) {
        exclusionReasons.push(
          `${arm}: incomplete (${manifest.tasks.length}/${manifest.compatibility_boundary.substrate_config.task_count} tasks)`
        );
      }

      if (manifest.tasks.some((task) => task.status === "aborted")) {
        exclusionReasons.push(`${arm}: aborted task record (infrastructure exclusion)`);
      }

      if (!manifest.replay_validity.chain_replay_valid) {
        exclusionReasons.push(`${arm}: not chain-replay-valid`);
      }
    }

    const seeds = new Set(group.map((manifest) => manifest.compatibility_boundary.substrate_config.substrate_seed));

    if (seeds.size !== 1) {
      exclusionReasons.push(`pairing ${label} spans multiple substrate_seeds`);
    }

    groups.push({
      pairing_label: label,
      substrate_seed: group[0].compatibility_boundary.substrate_config.substrate_seed,
      manifests: Object.fromEntries(ARMS.map((arm) => [arm, byArm.get(arm)]).filter(([, m]) => m)) as Record<
        E4V2ArmId,
        E4V2RunManifest
      >,
      surviving: exclusionReasons.length === 0,
      exclusion_reasons: exclusionReasons
    });
  }

  return groups;
}

function pooledRecords(groups: E4V2PairedSeedGroup[], arm: E4V2ArmId): E4V2TaskRecord[] {
  return groups.flatMap((group) => group.manifests[arm]?.tasks ?? []);
}

// [pre-reg §2 c2] the identical per-task binary event in BOTH arms: a `done` accepted by the
// arm's own acceptance procedure while the hidden ground-truth oracle fails. Never the v1
// refusal-based reading for the gated arm.
function falseConfidenceRate(taskRecords: E4V2TaskRecord[]): {
  events: number;
  attempted: number;
  rate: number | null;
  refused_done_over_red: number;
} {
  const complete = taskRecords.filter((task) => task.status === "complete");
  const events = complete.filter((task) => task.false_confidence.event).length;

  return {
    events,
    attempted: complete.length,
    rate: complete.length > 0 ? events / complete.length : null,
    refused_done_over_red: complete.reduce((sum, task) => sum + task.gate_events.refused_done_over_red, 0)
  };
}

export function computeE4V2GoNoGo(input: {
  manifests: E4V2RunManifest[];
  constants: E4V2SealedConstants;
  constantsHash: string;
  // The v1-sealed convention-aggregation constant (docs/protocols/e4-sealed-constants-v0.json
  // meter_rules.convention_aggregation_min_items, frozen v0.7) — the v2 constants file carries no
  // meter_rules block because the episode semantics carry over from v1 unchanged (§7.5 pin).
  conventionAggregationMinItems: number;
}): E4V2GoNoGoReport {
  const { constants, constantsHash, conventionAggregationMinItems } = input;

  // [M6.5 precedent] calibration runs are non-evidence: excluded structurally, never by caller
  // discipline (the v2-M6 calibration manifest can sit in the same folder and never pools in).
  const manifests = input.manifests.filter((manifest) => manifest.run_classification !== "calibration");
  const excludedCalibrations = input.manifests.length - manifests.length;

  if (manifests.length === 0) {
    throw new E4V2GoNoGoError(
      excludedCalibrations > 0
        ? `all ${excludedCalibrations} manifest(s) are calibration-classified (non-evidence) — nothing to evaluate`
        : "no manifests to evaluate"
    );
  }

  const aggregation = { convention_aggregation_min_items: conventionAggregationMinItems };
  const groups = groupE4V2PairedSeeds(manifests);
  const survivors = groups.filter((group) => group.surviving);

  // ---- §5.1 hard triggers (run FIRST; any one fires the class) ----

  const triggers: E4V2GoNoGoReport["triggers"] = [];

  triggers.push({
    id: "insufficient_valid_data",
    fired: survivors.length < constants.interpretability.min_replay_valid_paired_seeds,
    detail: `${survivors.length} surviving replay-valid paired seed(s); sealed minimum ${constants.interpretability.min_replay_valid_paired_seeds}`
  });

  const armVelocities = new Map<E4V2ArmId, Array<number | null>>();

  for (const arm of ARMS) {
    armVelocities.set(
      arm,
      survivors.map((group) =>
        velocityOrNull(computeE4DriftVelocity(asV1TaskRecords(group.manifests[arm]?.tasks ?? []), aggregation))
      )
    );
  }

  // Trigger 2 with the v2 spec_touch split sealed in the pre-registration: v2 custody floors
  // force spec changes on non-BP tasks, so the split discriminates on whether the zero-velocity
  // arm actually FLOWED through the workflow, not on voluntary spec upkeep as in v1. The report
  // must state which branch obtained; the detail below carries the branch.
  const anyArmDrifts = ARMS.some((arm) => (armVelocities.get(arm) ?? []).some((velocity) => (velocity ?? 0) > 0));
  const arm0Complete = pooledRecords(survivors, "e4_arm_0").filter((task) => task.status === "complete");
  const arm0SpecTouch = arm0Complete.filter((task) => task.spec_touch.touched).length;
  const specTouchBranch =
    arm0Complete.length > 0 && arm0SpecTouch * 2 >= arm0Complete.length
      ? "Arm-0 completed its spec phases normally — claim-safe finding branch (the model keeps even an unexecuted spec truthful under this workflow)"
      : "widespread Arm-0 spec-phase stalls / low spec_touch — H1-untested branch (substrate/workflow mismatch)";

  triggers.push({
    id: "substrate_not_validated",
    fired: survivors.length > 0 && !anyArmDrifts,
    detail: anyArmDrifts
      ? "at least one arm records drift velocity > 0"
      : `all arms record drift velocity == 0 — spec_touch split: Arm-0 spec_touch on ${arm0SpecTouch}/${arm0Complete.length} complete tasks ⇒ ${specTouchBranch}`
  });

  const allRecords = manifests.flatMap((manifest) => manifest.tasks);
  const nonAborted = allRecords.filter((task) => task.status === "complete");
  const extractionFailed = nonAborted.filter((task) => task.drift.extraction_failed).length;
  const extractionFraction = nonAborted.length > 0 ? extractionFailed / nonAborted.length : 0;

  triggers.push({
    id: "instrument_degraded",
    fired: extractionFraction > constants.interpretability.extraction_failed_max_fraction,
    detail: `extraction_failed on ${extractionFailed}/${nonAborted.length} non-aborted records (sealed max fraction ${constants.interpretability.extraction_failed_max_fraction})`
  });

  const armHRecords = manifests.filter((manifest) => manifest.arm === "e4_arm_h").flatMap((manifest) => manifest.tasks);
  const armHAttempted = armHRecords.filter((task) => task.status === "complete");
  const armHSpecStalled = armHAttempted.filter((task) => task.phase_at_termination === "spec").length;
  const stallFraction = armHAttempted.length > 0 ? armHSpecStalled / armHAttempted.length : 0;

  triggers.push({
    id: "arm_h_protocol_confusion",
    fired: stallFraction >= constants.interpretability.arm_h_spec_stall_max_fraction,
    detail: `Arm H never exited the spec phase on ${armHSpecStalled}/${armHAttempted.length} attempted tasks (sealed max fraction ${constants.interpretability.arm_h_spec_stall_max_fraction})`
  });

  // ---- predicates (pre-registration §2, two-arm form) ----

  const perSeedArm0 = survivors.map((group) => ({
    seed: group.substrate_seed,
    velocity: velocityOrNull(computeE4DriftVelocity(asV1TaskRecords(group.manifests.e4_arm_0?.tasks ?? []), aggregation))
  }));
  // [pre-reg §2(a)] EVERY surviving seed (any-class velocity counts; class composition is a
  // diagnostic, never the gate). Vacuously-empty survivor lists do not hold.
  const aHolds = perSeedArm0.length > 0 && perSeedArm0.every((entry) => (entry.velocity ?? 0) > 0);

  // [pre-reg §2(b)] full boundary stamp: constants hash + meter + converter + step table +
  // T0 gold spec + bank, in every manifest, against the sealed constants identity.
  const boundaryKeys = ["meter_version", "converter_id", "step_table_id", "t0_gold_spec_id", "bank_id"] as const;
  let badStampDetail: string | null = null;

  for (const manifest of manifests) {
    if (manifest.compatibility_boundary.constants_hash !== constantsHash) {
      badStampDetail = `${manifest.pairing_label}/${manifest.arm} stamps constants_hash ${manifest.compatibility_boundary.constants_hash}, sealed is ${constantsHash}`;
      break;
    }

    for (const key of boundaryKeys) {
      if (manifest.compatibility_boundary[key] !== constants.compatibility_boundary[key]) {
        badStampDetail = `${manifest.pairing_label}/${manifest.arm} stamps ${key} ${manifest.compatibility_boundary[key]}, sealed is ${constants.compatibility_boundary[key]}`;
        break;
      }
    }

    if (badStampDetail !== null) {
      break;
    }
  }

  const bHolds = badStampDetail === null;

  const arm0Mean = mean((armVelocities.get("e4_arm_0") ?? []).filter((velocity): velocity is number => velocity !== null));
  const armHMean = mean((armVelocities.get("e4_arm_h") ?? []).filter((velocity): velocity is number => velocity !== null));
  const c1 = arm0Mean !== null && armHMean !== null && arm0Mean > armHMean;

  const arm0FalseConfidence = falseConfidenceRate(pooledRecords(survivors, "e4_arm_0"));
  const armHFalseConfidence = falseConfidenceRate(pooledRecords(survivors, "e4_arm_h"));
  const c2 =
    arm0FalseConfidence.rate !== null && armHFalseConfidence.rate !== null && arm0FalseConfidence.rate > armHFalseConfidence.rate;

  const cHolds = c1 || c2;

  // ---- Diagnostics (class composition; floor rule; advisory flags — never gate) ----

  const classComposition: E4V2GoNoGoReport["diagnostics"]["class_composition_by_arm"] = {};

  for (const arm of ARMS) {
    const totals: Record<E4DriftItemKind, Record<E4DriftClass, number>> = {
      endpoint: { contradiction: 0, coverage_gap: 0, stale_claim: 0 },
      entity: { contradiction: 0, coverage_gap: 0, stale_claim: 0 },
      field: { contradiction: 0, coverage_gap: 0, stale_claim: 0 },
      validation_rule: { contradiction: 0, coverage_gap: 0, stale_claim: 0 },
      convention: { contradiction: 0, coverage_gap: 0, stale_claim: 0 }
    };

    for (const task of pooledRecords(survivors, arm)) {
      for (const kind of Object.keys(totals) as E4DriftItemKind[]) {
        for (const cls of Object.keys(totals[kind]) as E4DriftClass[]) {
          totals[kind][cls] += task.drift.counts[kind][cls];
        }
      }
    }

    classComposition[arm] = totals;
  }

  // Per-arm floor rule at its sealed constants (task_index ≤ 3, 2 consecutive zero-cumulative
  // tasks): reported per sequence; blocks the H4-analog slope as floor-confounded. (c) is then
  // evaluated on the remaining comparisons — c1/c2 never read that slope, so neither is removed.
  const floor: E4V2GoNoGoReport["diagnostics"]["floor"] = [];

  for (const group of survivors) {
    for (const arm of ARMS) {
      floor.push({
        pairing_label: group.pairing_label,
        substrate_seed: group.substrate_seed,
        arm,
        ...computeE4FloorCollapse(asV1TaskRecords(group.manifests[arm]?.tasks ?? []))
      });
    }
  }

  const h4AnalogBlocked = floor.some((entry) => entry.floor_collapsed);

  const advisoryFlags: string[] = [];

  for (const arm of ARMS) {
    const records = pooledRecords(survivors, arm).filter((task) => task.status === "complete");
    const passing = records.filter(
      (task) => task.oracle.cumulative_total > 0 && task.oracle.cumulative_pass === task.oracle.cumulative_total
    );

    if (records.length > 0 && passing.length === 0) {
      advisoryFlags.push(`(v) ${arm}: zero oracle-passing tasks — per-passing H5 quantities undefined at pilot scale`);
    }
  }

  const arm0Positive = perSeedArm0
    .map((entry) => entry.velocity)
    .filter((velocity): velocity is number => velocity !== null && velocity > 0);

  if (arm0Positive.length >= 2 && Math.max(...arm0Positive) / Math.min(...arm0Positive) > 3) {
    advisoryFlags.push(
      "(vi) high seed variance: max/min Arm-0 velocity ratio > 3 — recommend more seeds in any full-run pre-registration"
    );
  }

  // ---- Verdict (triggers first; predicates still reported for diagnosis) ----

  const firedTriggers = triggers.filter((trigger) => trigger.fired);
  const failedPredicates = [
    ...(aHolds ? [] : ["(a) Arm-0 drift velocity > 0 on every surviving seed"]),
    ...(bHolds ? [] : ["(b) constants hash + frozen boundary ids stamped in every manifest"]),
    ...(cHolds ? [] : ["(c) arm separation (c1 | c2)"])
  ];

  const verdict: E4V2GoNoGoVerdict =
    firedTriggers.length > 0 ? "inconclusive_uninterpretable" : failedPredicates.length === 0 ? "go" : "no_go";

  return {
    verdict,
    exit_code: verdict === "go" ? 0 : verdict === "no_go" ? 1 : 2,
    groups: groups.map(({ pairing_label, substrate_seed, surviving, exclusion_reasons }) => ({
      pairing_label,
      substrate_seed,
      surviving,
      exclusion_reasons
    })),
    triggers,
    predicates: {
      a_arm0_drifts: { holds: aHolds, per_seed_velocity: perSeedArm0 },
      b_boundary_stamp: {
        holds: bHolds,
        detail: bHolds
          ? `all manifests stamp constants_hash ${constantsHash} + meter ${constants.compatibility_boundary.meter_version} + frozen boundary ids`
          : badStampDetail!
      },
      c_separation: {
        holds: cHolds,
        c1_velocity: { holds: c1, arm0_mean: arm0Mean, arm_h_mean: armHMean },
        c2_false_confidence: {
          holds: c2,
          arm0_rate: arm0FalseConfidence.rate,
          arm_h_rate: armHFalseConfidence.rate,
          arm0_events: arm0FalseConfidence.events,
          arm_h_events: armHFalseConfidence.events,
          attempted: { arm0: arm0FalseConfidence.attempted, arm_h: armHFalseConfidence.attempted },
          refused_done_over_red_diagnostic: {
            arm0: arm0FalseConfidence.refused_done_over_red,
            arm_h: armHFalseConfidence.refused_done_over_red
          }
        }
      }
    },
    diagnostics: {
      class_composition_by_arm: classComposition,
      floor,
      h4_analog_blocked_floor_confounded: h4AnalogBlocked,
      advisory_flags: advisoryFlags
    },
    failed_predicates: failedPredicates
  };
}
