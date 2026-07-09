// Go/no-go computation (IMPLEMENTATION-PLAN.md §5, §5.1; [R1-S7/S8] [R2: R2-6/R2-7/R2-10]).
// Three-valued and executable over emitted manifests alone: the §5.1 interpretability triggers run
// FIRST — a pilot that broke is never reported as a pilot that measured — then the three §5
// predicates. Thresholds come from the sealed constants, never from code defaults.
import type { E4SealedConstants } from "./constants";
import type { E4RunManifest, E4TaskRecord } from "./manifest";
import {
  computeE4DriftVelocity,
  computeE4FalseConfidencePropensity,
  type E4DriftVelocityResult
} from "./result-schema";
import type { E4ArmId, E4DriftItemKind, E4DriftClass } from "./types";

export type E4GoNoGoVerdict = "go" | "no_go" | "inconclusive_uninterpretable";

export type E4PairedSeedGroup = {
  pairing_label: string;
  substrate_seed: number;
  manifests: Record<E4ArmId, E4RunManifest>;
  surviving: boolean; // complete + replay-valid in every arm (§5.1 trigger 1 input)
  exclusion_reasons: string[];
};

export type E4GoNoGoReport = {
  verdict: E4GoNoGoVerdict;
  exit_code: 0 | 1 | 2;
  groups: Array<Pick<E4PairedSeedGroup, "pairing_label" | "substrate_seed" | "surviving" | "exclusion_reasons">>;
  triggers: Array<{ id: string; fired: boolean; detail: string }>;
  predicates: {
    a_arm0_drifts: { holds: boolean; per_seed_velocity: Array<{ seed: number; velocity: number | null }> };
    b_meter_stamp: { holds: boolean; detail: string };
    c_separation: {
      holds: boolean;
      c1_velocity: { holds: boolean; arm0_mean: number | null; arm_h_mean: number | null };
      c2_propensity: { holds: boolean; arm0m_rate: number | null; arm_h_rate: number | null };
      c3_spec_freshness: { holds: boolean; arm_m_spec_velocity: number | null; arm0_spec_velocity: number | null };
    };
  };
  diagnostics: {
    class_composition_by_arm: Record<string, Record<E4DriftItemKind, Record<E4DriftClass, number>>>;
    advisory_flags: string[];
  };
  failed_predicates: string[];
};

export class E4GoNoGoError extends Error {
  constructor(message: string) {
    super(`[e4-gonogo] ${message}`);
    this.name = "E4GoNoGoError";
  }
}

const ARMS: readonly E4ArmId[] = ["e4_arm_0", "e4_arm_m", "e4_arm_h"];

function mean(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function groupE4PairedSeeds(manifests: E4RunManifest[]): E4PairedSeedGroup[] {
  const byLabel = new Map<string, E4RunManifest[]>();

  for (const manifest of manifests) {
    const list = byLabel.get(manifest.pairing_label) ?? [];
    list.push(manifest);
    byLabel.set(manifest.pairing_label, list);
  }

  const groups: E4PairedSeedGroup[] = [];

  for (const [label, group] of [...byLabel.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const byArm = new Map(group.map((manifest) => [manifest.arm, manifest]));
    const exclusionReasons: string[] = [];

    for (const arm of ARMS) {
      const manifest = byArm.get(arm);

      if (!manifest) {
        exclusionReasons.push(`${arm}: manifest missing`);
        continue;
      }

      if (manifest.tasks.length < manifest.substrate_config.task_count) {
        exclusionReasons.push(`${arm}: incomplete (${manifest.tasks.length}/${manifest.substrate_config.task_count} tasks)`);
      }

      if (manifest.tasks.some((task) => task.status === "aborted")) {
        exclusionReasons.push(`${arm}: aborted task record (infrastructure exclusion)`);
      }

      if (!manifest.replay_validity.chain_replay_valid) {
        exclusionReasons.push(`${arm}: not chain-replay-valid`);
      }
    }

    const seeds = new Set(group.map((manifest) => manifest.substrate_seed));

    if (seeds.size !== 1) {
      exclusionReasons.push(`pairing ${label} spans multiple substrate_seeds`);
    }

    groups.push({
      pairing_label: label,
      substrate_seed: group[0].substrate_seed,
      manifests: Object.fromEntries(ARMS.map((arm) => [arm, byArm.get(arm)]).filter(([, m]) => m)) as Record<
        E4ArmId,
        E4RunManifest
      >,
      surviving: exclusionReasons.length === 0,
      exclusion_reasons: exclusionReasons
    });
  }

  return groups;
}

function pooledRecords(groups: E4PairedSeedGroup[], arm: E4ArmId): E4TaskRecord[] {
  return groups.flatMap((group) => group.manifests[arm]?.tasks ?? []);
}

function velocityOrNull(result: E4DriftVelocityResult): number | null {
  return result.velocity;
}

export function computeE4GoNoGo(input: {
  manifests: E4RunManifest[];
  constants: E4SealedConstants;
  constantsHash: string;
}): E4GoNoGoReport {
  const { constants, constantsHash } = input;

  if (input.manifests.length === 0) {
    throw new E4GoNoGoError("no manifests to evaluate");
  }

  if (constants.meter_rules.convention_aggregation_min_items === null || constants.compatibility_boundary.meter_version === null) {
    throw new E4GoNoGoError("sealed constants are pre-M2: meter_version / convention aggregation missing");
  }

  // Compatibility boundary is the pooling unit: refuse to pool across constants identities.
  for (const manifest of input.manifests) {
    if (manifest.compatibility_boundary.constants_hash !== constantsHash) {
      throw new E4GoNoGoError(
        `constants-hash mismatch in ${manifest.run_id}: manifests from a different compatibility boundary cannot be pooled`
      );
    }
  }

  const aggregation = { convention_aggregation_min_items: constants.meter_rules.convention_aggregation_min_items };
  const groups = groupE4PairedSeeds(input.manifests);
  const survivors = groups.filter((group) => group.surviving);

  // ---- §5.1 hard triggers (run FIRST; any one fires the class) ----

  const triggers: E4GoNoGoReport["triggers"] = [];

  triggers.push({
    id: "insufficient_valid_data",
    fired: survivors.length < constants.interpretability.min_replay_valid_paired_seeds,
    detail: `${survivors.length} surviving replay-valid paired seed(s); sealed minimum ${constants.interpretability.min_replay_valid_paired_seeds}`
  });

  const armVelocities = new Map<E4ArmId, Array<number | null>>();

  for (const arm of ARMS) {
    armVelocities.set(
      arm,
      survivors.map((group) => velocityOrNull(computeE4DriftVelocity(group.manifests[arm]?.tasks ?? [], aggregation)))
    );
  }

  // Trigger 2: a universal zero cannot distinguish "agents maintain specs" from "tasks map too
  // cleanly to spec edits" — any arm's velocity > 0 defuses it (a null velocity measures nothing
  // and therefore cannot defuse it either).
  const anyArmDrifts = ARMS.some((arm) => (armVelocities.get(arm) ?? []).some((velocity) => (velocity ?? 0) > 0));

  triggers.push({
    id: "substrate_not_validated",
    fired: survivors.length > 0 && !anyArmDrifts,
    detail: anyArmDrifts ? "at least one arm records drift velocity > 0" : "all arms record drift velocity == 0 — H1 untested"
  });

  const allRecords = input.manifests.flatMap((manifest) => manifest.tasks);
  const nonAborted = allRecords.filter((task) => task.status === "complete");
  const extractionFailed = nonAborted.filter((task) => task.drift.extraction_failed).length;
  const extractionFraction = nonAborted.length > 0 ? extractionFailed / nonAborted.length : 0;

  triggers.push({
    id: "instrument_degraded",
    fired: extractionFraction > constants.interpretability.extraction_failed_max_fraction,
    detail: `extraction_failed on ${extractionFailed}/${nonAborted.length} non-aborted records (sealed max fraction ${constants.interpretability.extraction_failed_max_fraction})`
  });

  const armHRecords = input.manifests.filter((manifest) => manifest.arm === "e4_arm_h").flatMap((manifest) => manifest.tasks);
  const armHAttempted = armHRecords.filter((task) => task.status === "complete");
  const armHSpecStalled = armHAttempted.filter((task) => task.phase_at_termination === "spec").length;
  const stallFraction = armHAttempted.length > 0 ? armHSpecStalled / armHAttempted.length : 0;

  triggers.push({
    id: "arm_h_protocol_confusion",
    fired: stallFraction >= constants.interpretability.arm_h_spec_stall_max_fraction,
    detail: `Arm H never exited the spec phase on ${armHSpecStalled}/${armHAttempted.length} attempted tasks (sealed max fraction ${constants.interpretability.arm_h_spec_stall_max_fraction})`
  });

  // ---- §5 predicates ----

  const perSeedArm0 = survivors.map((group) => ({
    seed: group.substrate_seed,
    velocity: velocityOrNull(computeE4DriftVelocity(group.manifests.e4_arm_0?.tasks ?? [], aggregation))
  }));
  // [R1-S8] any-class velocity counts; the class composition is a diagnostic, never the gate.
  const aHolds = perSeedArm0.some((entry) => (entry.velocity ?? 0) > 0);

  const badStamp = input.manifests.find(
    (manifest) => manifest.compatibility_boundary.meter_version !== constants.compatibility_boundary.meter_version
  );
  const bHolds = badStamp === undefined;

  const arm0Mean = mean((armVelocities.get("e4_arm_0") ?? []).filter((velocity): velocity is number => velocity !== null));
  const armHMean = mean((armVelocities.get("e4_arm_h") ?? []).filter((velocity): velocity is number => velocity !== null));
  const c1 = arm0Mean !== null && armHMean !== null && arm0Mean > armHMean;

  // [R2: R2-6] both sides binary per task, rates over attempted tasks, same event family.
  const arm0mPropensity = computeE4FalseConfidencePropensity([
    ...pooledRecords(survivors, "e4_arm_0"),
    ...pooledRecords(survivors, "e4_arm_m")
  ]);
  const armHPropensity = computeE4FalseConfidencePropensity(pooledRecords(survivors, "e4_arm_h"));
  const c2 = arm0mPropensity.rate !== null && armHPropensity.rate !== null && arm0mPropensity.rate > armHPropensity.rate;

  const armMSpec = mean(
    survivors
      .map((group) =>
        velocityOrNull(computeE4DriftVelocity(group.manifests.e4_arm_m?.tasks ?? [], aggregation, { direction: "spec_vs_truth" }))
      )
      .filter((velocity): velocity is number => velocity !== null)
  );
  const arm0Spec = mean(
    survivors
      .map((group) =>
        velocityOrNull(computeE4DriftVelocity(group.manifests.e4_arm_0?.tasks ?? [], aggregation, { direction: "spec_vs_truth" }))
      )
      .filter((velocity): velocity is number => velocity !== null)
  );
  // H3 leak signature: Arm M keeps the spec FRESHER than Arm 0 — lower spec-side onset velocity.
  const c3 = armMSpec !== null && arm0Spec !== null && armMSpec < arm0Spec;

  const cHolds = c1 || c2 || c3;

  // ---- Diagnostics ([R1-S8] class composition; §5.1 advisory flags — never gate) ----

  const classComposition: E4GoNoGoReport["diagnostics"]["class_composition_by_arm"] = {};

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

  const arm0Positive = perSeedArm0.map((entry) => entry.velocity).filter((velocity): velocity is number => velocity !== null && velocity > 0);

  if (arm0Positive.length >= 2 && Math.max(...arm0Positive) / Math.min(...arm0Positive) > 3) {
    advisoryFlags.push("(vi) high seed variance: max/min Arm-0 velocity ratio > 3 — recommend more seeds in the full-run pre-registration");
  }

  // ---- Verdict ([R2: R2-7] triggers first; predicates still reported for diagnosis) ----

  const firedTriggers = triggers.filter((trigger) => trigger.fired);
  const failedPredicates = [
    ...(aHolds ? [] : ["(a) Arm-0 drift velocity > 0 on >= 1 seed"]),
    ...(bHolds ? [] : ["(b) frozen meter_version stamped in every manifest"]),
    ...(cHolds ? [] : ["(c) arm separation (c1 | c2 | c3)"])
  ];

  const verdict: E4GoNoGoVerdict =
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
      b_meter_stamp: {
        holds: bHolds,
        detail: bHolds
          ? `all manifests stamp meter_version ${constants.compatibility_boundary.meter_version}`
          : `${badStamp?.run_id} stamps ${badStamp?.compatibility_boundary.meter_version}, sealed is ${constants.compatibility_boundary.meter_version}`
      },
      c_separation: {
        holds: cHolds,
        c1_velocity: { holds: c1, arm0_mean: arm0Mean, arm_h_mean: armHMean },
        c2_propensity: { holds: c2, arm0m_rate: arm0mPropensity.rate, arm_h_rate: armHPropensity.rate },
        c3_spec_freshness: { holds: c3, arm_m_spec_velocity: armMSpec, arm0_spec_velocity: arm0Spec }
      }
    },
    diagnostics: { class_composition_by_arm: classComposition, advisory_flags: advisoryFlags },
    failed_predicates: failedPredicates
  };
}
