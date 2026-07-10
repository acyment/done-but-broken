// v3 go/no-go — the v3-M6 verdict tool (docs/protocols/e4-v3-m6-pilot-preregistration-v1.md §2;
// built and tested on fake-agent dry-run manifests BEFORE any live evidence manifest exists —
// the v2-M7 gate-commit precedent, 3571a08). A three-arm extension of src/e4/v2/gonogo.ts (that
// tool is left byte-untouched: it remains the M7/M8 verdict instrument) with the contrasts
// exactly as the pre-registration pins them:
//   (a) Arm-0 drifts: prose-arm drift velocity > 0 on EVERY surviving seed (carried verbatim);
//   (b) boundary stamp: BOTH constants identities — the frozen v2 file (hash + the five v2
//       boundary ids) AND the v3 file that extends it (compatibility_boundary.v3 stamp: hash,
//       version, the seven v3 surface ids) — plus profile e4-openspec-workflow-v2, in every
//       manifest;
//   (c) PRIMARY separation, arm 0 vs arm p (the product claim): c1 velocity contrast OR c2
//       false-confidence contrast (identical per-task binary event in both arms).
// The secondary contrast (d: arm h vs arm p — does the anti-cheat loop cause the difference)
// and the replication readout (e: arm 0 vs arm h — the v2-lineage contrast) are pre-registered
// REPORTED contrasts: their directional predicates are computed and printed but carry NO verdict
// weight (proposal §2: primary = the product claim; the verdict is never conjunctive across
// claims).
// §5.1 interpretability triggers run FIRST (a pilot that broke is never reported as a pilot that
// measured); trigger 4 (protocol confusion) is evaluated PER EXECUTED ARM (e4_arm_h and e4_arm_p
// each at the sealed arm_h_spec_stall_max_fraction — the product gate's PM-review refusals keep
// the phase at spec, which is exactly the confusion mode the trigger exists for). Thresholds come
// from the sealed constants, never from code defaults.
import type { E4TaskRecord } from "../manifest";
import {
  computeE4DriftVelocity,
  computeE4FloorCollapse,
  type E4DriftVelocityResult,
  type E4FloorCollapseResult
} from "../result-schema";
import type { E4DriftClass, E4DriftItemKind } from "../types";
import type { E4V2ArmId, E4V2SealedConstants } from "../v2/constants";
import type { E4V2RunManifest, E4V2TaskRecord } from "../v2/manifest";
import type { E4V3SealedConstants } from "./constants";

export type E4V3GoNoGoVerdict = "go" | "no_go" | "inconclusive_uninterpretable";

export const E4_V3_ARMS: readonly E4V2ArmId[] = ["e4_arm_0", "e4_arm_h", "e4_arm_p"];

export type E4V3PairedSeedGroup = {
  pairing_label: string;
  substrate_seed: number;
  manifests: Record<E4V2ArmId, E4V2RunManifest>;
  surviving: boolean; // complete + replay-valid in every one of the THREE arms (trigger 1 input)
  exclusion_reasons: string[];
};

export type E4V3VelocityContrast = {
  holds: boolean;
  left_mean: number | null;
  right_mean: number | null;
};

export type E4V3FalseConfidenceContrast = {
  holds: boolean;
  left_rate: number | null;
  right_rate: number | null;
  left_events: number;
  right_events: number;
  attempted: { left: number; right: number };
};

export type E4V3GoNoGoReport = {
  verdict: E4V3GoNoGoVerdict;
  exit_code: 0 | 1 | 2;
  groups: Array<Pick<E4V3PairedSeedGroup, "pairing_label" | "substrate_seed" | "surviving" | "exclusion_reasons">>;
  triggers: Array<{ id: string; fired: boolean; detail: string }>;
  predicates: {
    a_arm0_drifts: { holds: boolean; per_seed_velocity: Array<{ seed: number; velocity: number | null }> };
    b_boundary_stamp: { holds: boolean; detail: string };
    // PRIMARY: arm 0 (prose, left) vs arm p (product loop, right).
    c_primary_separation: {
      holds: boolean;
      c1_velocity: E4V3VelocityContrast;
      c2_false_confidence: E4V3FalseConfidenceContrast;
    };
  };
  // Pre-registered, reported, NO verdict weight.
  reported_contrasts: {
    // SECONDARY: arm h (naked execution, left) vs arm p (product loop, right).
    d_secondary_armh_vs_armp: { d1_velocity: E4V3VelocityContrast; d2_false_confidence: E4V3FalseConfidenceContrast };
    // REPLICATION readout of the v2 lineage: arm 0 (left) vs arm h (right).
    e_replication_arm0_vs_armh: { e1_velocity: E4V3VelocityContrast; e2_false_confidence: E4V3FalseConfidenceContrast };
  };
  diagnostics: {
    class_composition_by_arm: Record<string, Record<E4DriftItemKind, Record<E4DriftClass, number>>>;
    floor: Array<{ pairing_label: string; substrate_seed: number; arm: E4V2ArmId } & E4FloorCollapseResult>;
    h4_analog_blocked_floor_confounded: boolean;
    refused_done_over_red_by_arm: Record<string, number>;
    ask_pm_by_arm: Record<string, { requested: number; complete: number }>;
    product_gate_arm_p: {
      pm_review_refusals: number;
      reconcile_refusals: number;
      mutation_refusals: number;
      pm_review_flags_total: number;
      reconcile_unavailable_count: number;
    };
    advisory_flags: string[];
  };
  failed_predicates: string[];
};

export class E4V3GoNoGoError extends Error {
  constructor(message: string) {
    super(`[e4-v3-gonogo] ${message}`);
    this.name = "E4V3GoNoGoError";
  }
}

function mean(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

// The committed v1 episode-onset semantics operate UNCHANGED on the v2 meter's discrepancy lists
// (design §7.5 / pre-registration analysis layer) — same narrowing cast as the v2 tool: the v1
// functions read only fields present on E4V2TaskRecord with identical types.
function asV1TaskRecords(tasks: E4V2TaskRecord[]): E4TaskRecord[] {
  return tasks as unknown as E4TaskRecord[];
}

function velocityOrNull(result: E4DriftVelocityResult): number | null {
  return result.velocity;
}

export function groupE4V3PairedSeeds(manifests: E4V2RunManifest[]): E4V3PairedSeedGroup[] {
  const byLabel = new Map<string, E4V2RunManifest[]>();

  for (const manifest of manifests) {
    const list = byLabel.get(manifest.pairing_label) ?? [];
    list.push(manifest);
    byLabel.set(manifest.pairing_label, list);
  }

  const groups: E4V3PairedSeedGroup[] = [];

  for (const [label, group] of [...byLabel.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const byArm = new Map(group.map((manifest) => [manifest.arm, manifest]));
    const exclusionReasons: string[] = [];

    for (const arm of E4_V3_ARMS) {
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
      manifests: Object.fromEntries(E4_V3_ARMS.map((arm) => [arm, byArm.get(arm)]).filter(([, m]) => m)) as Record<
        E4V2ArmId,
        E4V2RunManifest
      >,
      surviving: exclusionReasons.length === 0,
      exclusion_reasons: exclusionReasons
    });
  }

  return groups;
}

function pooledRecords(groups: E4V3PairedSeedGroup[], arm: E4V2ArmId): E4V2TaskRecord[] {
  return groups.flatMap((group) => group.manifests[arm]?.tasks ?? []);
}

// [pre-reg §2] the identical per-task binary event in EVERY arm: a `done` accepted by the arm's
// own acceptance procedure while the hidden ground-truth oracle fails (carried verbatim from the
// v2 tool).
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

function velocityContrast(left: number | null, right: number | null): E4V3VelocityContrast {
  return { holds: left !== null && right !== null && left > right, left_mean: left, right_mean: right };
}

function falseConfidenceContrast(
  left: ReturnType<typeof falseConfidenceRate>,
  right: ReturnType<typeof falseConfidenceRate>
): E4V3FalseConfidenceContrast {
  return {
    holds: left.rate !== null && right.rate !== null && left.rate > right.rate,
    left_rate: left.rate,
    right_rate: right.rate,
    left_events: left.events,
    right_events: right.events,
    attempted: { left: left.attempted, right: right.attempted }
  };
}

export function computeE4V3GoNoGo(input: {
  manifests: E4V2RunManifest[];
  constants: E4V2SealedConstants;
  constantsHash: string;
  v3Constants: E4V3SealedConstants;
  v3ConstantsHash: string;
  // The v1-sealed convention-aggregation constant (frozen v0.7 meter_rules) — carried through
  // the v2 tool unchanged: neither the v2 nor the v3 constants file carries a meter_rules block
  // because the v1 episode semantics apply unchanged (§7.5 pin).
  conventionAggregationMinItems: number;
}): E4V3GoNoGoReport {
  const { constants, constantsHash, v3Constants, v3ConstantsHash, conventionAggregationMinItems } = input;

  // [M6.5 precedent] calibration runs are non-evidence: excluded structurally, never by caller
  // discipline (the v3-M5 calibration manifest can sit in the same folder and never pools in).
  const manifests = input.manifests.filter((manifest) => manifest.run_classification !== "calibration");
  const excludedCalibrations = input.manifests.length - manifests.length;

  if (manifests.length === 0) {
    throw new E4V3GoNoGoError(
      excludedCalibrations > 0
        ? `all ${excludedCalibrations} manifest(s) are calibration-classified (non-evidence) — nothing to evaluate`
        : "no manifests to evaluate"
    );
  }

  const aggregation = { convention_aggregation_min_items: conventionAggregationMinItems };
  const groups = groupE4V3PairedSeeds(manifests);
  const survivors = groups.filter((group) => group.surviving);

  // ---- §5.1 hard triggers (run FIRST; any one fires the class) ----

  const triggers: E4V3GoNoGoReport["triggers"] = [];

  triggers.push({
    id: "insufficient_valid_data",
    fired: survivors.length < constants.interpretability.min_replay_valid_paired_seeds,
    detail: `${survivors.length} surviving replay-valid paired seed(s); sealed minimum ${constants.interpretability.min_replay_valid_paired_seeds}`
  });

  const armVelocities = new Map<E4V2ArmId, Array<number | null>>();

  for (const arm of E4_V3_ARMS) {
    armVelocities.set(
      arm,
      survivors.map((group) =>
        velocityOrNull(computeE4DriftVelocity(asV1TaskRecords(group.manifests[arm]?.tasks ?? []), aggregation))
      )
    );
  }

  // Trigger 2 with the v2 spec_touch split carried verbatim (custody floors force spec changes on
  // non-BP tasks in every arm, so the split discriminates on whether the zero-velocity arm
  // actually FLOWED through the workflow).
  const anyArmDrifts = E4_V3_ARMS.some((arm) => (armVelocities.get(arm) ?? []).some((velocity) => (velocity ?? 0) > 0));
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

  // Trigger 4 per EXECUTED arm at the sealed threshold (pre-reg §2: the product gate's PM-review
  // refusals keep the phase at spec — protocol confusion is live in both executed arms).
  for (const arm of ["e4_arm_h", "e4_arm_p"] as const) {
    const armRecords = manifests.filter((manifest) => manifest.arm === arm).flatMap((manifest) => manifest.tasks);
    const attempted = armRecords.filter((task) => task.status === "complete");
    const specStalled = attempted.filter((task) => task.phase_at_termination === "spec").length;
    const stallFraction = attempted.length > 0 ? specStalled / attempted.length : 0;

    triggers.push({
      id: `${arm === "e4_arm_h" ? "arm_h" : "arm_p"}_protocol_confusion`,
      fired: stallFraction >= constants.interpretability.arm_h_spec_stall_max_fraction,
      detail: `${arm} never exited the spec phase on ${specStalled}/${attempted.length} attempted tasks (sealed max fraction ${constants.interpretability.arm_h_spec_stall_max_fraction})`
    });
  }

  // ---- predicates (pre-registration §2, three-arm form) ----

  const perSeedArm0 = survivors.map((group) => ({
    seed: group.substrate_seed,
    velocity: velocityOrNull(computeE4DriftVelocity(asV1TaskRecords(group.manifests.e4_arm_0?.tasks ?? []), aggregation))
  }));
  // [pre-reg §2(a)] EVERY surviving seed (any-class velocity counts; class composition is a
  // diagnostic, never the gate). Vacuously-empty survivor lists do not hold.
  const aHolds = perSeedArm0.length > 0 && perSeedArm0.every((entry) => (entry.velocity ?? 0) > 0);

  // [pre-reg §2(b)] BOTH constants identities + profile, in every manifest.
  const v2BoundaryKeys = ["meter_version", "converter_id", "step_table_id", "t0_gold_spec_id", "bank_id"] as const;
  const v3BoundaryKeys = [
    "determinacy_table_id",
    "pm_brief_id",
    "reconciler_id",
    "mutation_harness_id",
    "pm_review_id",
    "product_gate_id",
    "turn_protocol_id"
  ] as const;
  let badStampDetail: string | null = null;

  for (const manifest of manifests) {
    const where = `${manifest.pairing_label}/${manifest.arm}`;

    if (manifest.protocol_profile_id !== v3Constants.protocol_profile_id) {
      badStampDetail = `${where} stamps profile ${manifest.protocol_profile_id}, sealed is ${v3Constants.protocol_profile_id}`;
      break;
    }

    if (manifest.compatibility_boundary.constants_hash !== constantsHash) {
      badStampDetail = `${where} stamps v2 constants_hash ${manifest.compatibility_boundary.constants_hash}, sealed is ${constantsHash}`;
      break;
    }

    for (const key of v2BoundaryKeys) {
      if (manifest.compatibility_boundary[key] !== constants.compatibility_boundary[key]) {
        badStampDetail = `${where} stamps ${key} ${manifest.compatibility_boundary[key]}, sealed is ${constants.compatibility_boundary[key]}`;
        break;
      }
    }

    if (badStampDetail !== null) {
      break;
    }

    const v3Stamp = manifest.compatibility_boundary.v3;

    if (!v3Stamp) {
      badStampDetail = `${where} carries no v3 constants stamp (compatibility_boundary.v3)`;
      break;
    }

    if (v3Stamp.constants_hash !== v3ConstantsHash) {
      badStampDetail = `${where} stamps v3 constants_hash ${v3Stamp.constants_hash}, sealed is ${v3ConstantsHash}`;
      break;
    }

    if (v3Stamp.constants_version !== v3Constants.version) {
      badStampDetail = `${where} stamps v3 constants_version ${v3Stamp.constants_version}, sealed is ${v3Constants.version}`;
      break;
    }

    for (const key of v3BoundaryKeys) {
      if (v3Stamp[key] !== v3Constants.compatibility_boundary[key]) {
        badStampDetail = `${where} stamps ${key} ${v3Stamp[key]}, sealed is ${v3Constants.compatibility_boundary[key]}`;
        break;
      }
    }

    if (badStampDetail !== null) {
      break;
    }
  }

  const bHolds = badStampDetail === null;

  const armMeans = new Map<E4V2ArmId, number | null>();

  for (const arm of E4_V3_ARMS) {
    armMeans.set(arm, mean((armVelocities.get(arm) ?? []).filter((velocity): velocity is number => velocity !== null)));
  }

  const fcByArm = new Map<E4V2ArmId, ReturnType<typeof falseConfidenceRate>>();

  for (const arm of E4_V3_ARMS) {
    fcByArm.set(arm, falseConfidenceRate(pooledRecords(survivors, arm)));
  }

  const c1 = velocityContrast(armMeans.get("e4_arm_0")!, armMeans.get("e4_arm_p")!);
  const c2 = falseConfidenceContrast(fcByArm.get("e4_arm_0")!, fcByArm.get("e4_arm_p")!);
  const cHolds = c1.holds || c2.holds;

  const d1 = velocityContrast(armMeans.get("e4_arm_h")!, armMeans.get("e4_arm_p")!);
  const d2 = falseConfidenceContrast(fcByArm.get("e4_arm_h")!, fcByArm.get("e4_arm_p")!);
  const e1 = velocityContrast(armMeans.get("e4_arm_0")!, armMeans.get("e4_arm_h")!);
  const e2 = falseConfidenceContrast(fcByArm.get("e4_arm_0")!, fcByArm.get("e4_arm_h")!);

  // ---- Diagnostics (class composition; floor rule; product-gate + ASK_PM usage; advisories) ----

  const classComposition: E4V3GoNoGoReport["diagnostics"]["class_composition_by_arm"] = {};

  for (const arm of E4_V3_ARMS) {
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

  const floor: E4V3GoNoGoReport["diagnostics"]["floor"] = [];

  for (const group of survivors) {
    for (const arm of E4_V3_ARMS) {
      floor.push({
        pairing_label: group.pairing_label,
        substrate_seed: group.substrate_seed,
        arm,
        ...computeE4FloorCollapse(asV1TaskRecords(group.manifests[arm]?.tasks ?? []))
      });
    }
  }

  const h4AnalogBlocked = floor.some((entry) => entry.floor_collapsed);

  const refusedByArm: Record<string, number> = {};
  const askPmByArm: Record<string, { requested: number; complete: number }> = {};

  for (const arm of E4_V3_ARMS) {
    const fc = fcByArm.get(arm)!;
    refusedByArm[arm] = fc.refused_done_over_red;
    const complete = pooledRecords(survivors, arm).filter((task) => task.status === "complete");
    askPmByArm[arm] = {
      requested: complete.filter((task) => task.pm_brief?.requested === true).length,
      complete: complete.length
    };
  }

  const productGateTotals = {
    pm_review_refusals: 0,
    reconcile_refusals: 0,
    mutation_refusals: 0,
    pm_review_flags_total: 0,
    reconcile_unavailable_count: 0
  };

  for (const task of pooledRecords(survivors, "e4_arm_p")) {
    if (task.product_gate) {
      productGateTotals.pm_review_refusals += task.product_gate.pm_review_refusals;
      productGateTotals.reconcile_refusals += task.product_gate.reconcile_refusals;
      productGateTotals.mutation_refusals += task.product_gate.mutation_refusals;
      productGateTotals.pm_review_flags_total += task.product_gate.pm_review_flags_total;
      productGateTotals.reconcile_unavailable_count += task.product_gate.reconcile_unavailable_count;
    }
  }

  const advisoryFlags: string[] = [];

  for (const arm of E4_V3_ARMS) {
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
    ...(bHolds ? [] : ["(b) v2 + v3 constants hashes, frozen boundary ids, and profile stamped in every manifest"]),
    ...(cHolds ? [] : ["(c) primary product separation, arm 0 vs arm p (c1 | c2)"])
  ];

  const verdict: E4V3GoNoGoVerdict =
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
          ? `all manifests stamp v2 ${constantsHash} + v3 ${v3ConstantsHash} + profile ${v3Constants.protocol_profile_id} + frozen boundary ids`
          : badStampDetail!
      },
      c_primary_separation: { holds: cHolds, c1_velocity: c1, c2_false_confidence: c2 }
    },
    reported_contrasts: {
      d_secondary_armh_vs_armp: { d1_velocity: d1, d2_false_confidence: d2 },
      e_replication_arm0_vs_armh: { e1_velocity: e1, e2_false_confidence: e2 }
    },
    diagnostics: {
      class_composition_by_arm: classComposition,
      floor,
      h4_analog_blocked_floor_confounded: h4AnalogBlocked,
      refused_done_over_red_by_arm: refusedByArm,
      ask_pm_by_arm: askPmByArm,
      product_gate_arm_p: productGateTotals,
      advisory_flags: advisoryFlags
    },
    failed_predicates: failedPredicates
  };
}
