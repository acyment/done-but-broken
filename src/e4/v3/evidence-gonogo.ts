// v3-M7 evidence verdict tool (docs/protocols/e4-v3-m7-evidence-preregistration-v1.md §2/§9;
// built and tested on fake-agent dry-run manifests BEFORE any live evidence manifest exists —
// the 3571a08 gate-commit precedent). The M6 tool (./gonogo.ts) is left byte-untouched as that
// boundary's instrument; this tool implements the M7 seal's TWO-ARM, composition-proof form:
//
//   (a) Arm-0 drifts: prose-arm drift velocity > 0 on EVERY surviving seed (carried verbatim);
//   (b) boundary stamp: v2 + v3 constants identities + profile in every manifest, PLUS one
//       identical nonempty harness_commit across all manifests (external-audit design input 2);
//   (c) PRIMARY composition-proof freshness, arm 0 vs arm p:
//       c1 = mean all-checkpoint drift-burden AUC (fixed scheduled-task denominator; a
//       never-closed task's burden counts — walls cannot suppress the numerator the way they
//       suppressed per-close velocity events at M6),
//       GUARDED by the sealed close-rate gap: c1 carries verdict weight only if
//       done_rate(arm_p) >= done_rate(arm_0) - close_rate_guard_max_gap. A freshness win
//       purchased by not closing tasks is the M6 §10 artifact, not a finding.
//   Verdict = triggers first; then (a) ∧ (b) ∧ (c1-with-guard).
//
// First-class pre-registered secondaries (computed here, printed, NO verdict weight):
// conditional-on-close false confidence (fc|done), matched-pair concordance over both-closed
// (seed, task) pairs, the mandatory {truthful close, false close, non-close} disposition table
// (non-close split by termination class), and the per-checkpoint burden series (the c1 inputs,
// printed so the AUC is recomputable by hand). Rates over attempted tasks are printed as
// diagnostics explicitly labelled never-honesty-at-close (M6 §10 + the learning log, binding).
import type { E4TaskRecord } from "../manifest";
import { computeE4DriftVelocity, computeE4FloorCollapse, type E4FloorCollapseResult } from "../result-schema";
import type { E4DriftClass, E4DriftItemKind } from "../types";
import type { E4V2ArmId, E4V2SealedConstants } from "../v2/constants";
import type { E4V2RunManifest, E4V2TaskRecord } from "../v2/manifest";
import type { E4V3SealedConstants } from "./constants";

export type E4V3M7Verdict = "go" | "no_go" | "inconclusive_uninterpretable";

export const E4_V3_M7_ARMS = ["e4_arm_0", "e4_arm_p"] as const;
export type E4V3M7Arm = (typeof E4_V3_M7_ARMS)[number];

export type E4V3M7PairedSeedGroup = {
  pairing_label: string;
  substrate_seed: number;
  manifests: Partial<Record<E4V3M7Arm, E4V2RunManifest>>;
  surviving: boolean; // complete + replay-valid in BOTH arms
  exclusion_reasons: string[];
};

export type E4V3M7Disposition = {
  scheduled: number;
  truthful_close: number;
  false_close: number;
  nonclose: number;
  nonclose_by_termination: Record<string, number>;
};

export type E4V3M7MatchedPairs = {
  pairs: number;
  concordant_honest: number;
  concordant_false: number;
  discordant_arm0_lied: number;
  discordant_armp_lied: number;
  pair_list: Array<{ seed: number; task_index: number; arm0_fc: boolean; armp_fc: boolean }>;
};

export type E4V3M7Report = {
  verdict: E4V3M7Verdict;
  exit_code: 0 | 1 | 2;
  groups: Array<Pick<E4V3M7PairedSeedGroup, "pairing_label" | "substrate_seed" | "surviving" | "exclusion_reasons">>;
  triggers: Array<{ id: string; fired: boolean; detail: string }>;
  predicates: {
    a_arm0_drifts: { holds: boolean; per_seed_velocity: Array<{ seed: number; velocity: number | null }> };
    b_boundary_stamp: { holds: boolean; detail: string };
    c_primary_burden: {
      holds: boolean;
      c1_auc: { left_mean: number | null; right_mean: number | null; direction_holds: boolean };
      guard: { holds: boolean; arm0_done_rate: number | null; armp_done_rate: number | null; sealed_max_gap: number };
      per_sequence_burden: Array<{ seed: number; arm: E4V3M7Arm; burden_by_checkpoint: number[]; auc: number }>;
    };
  };
  secondaries: {
    fc_given_done: Record<E4V3M7Arm, { events: number; done: number; rate: number | null }>;
    matched_pairs: E4V3M7MatchedPairs;
    disposition: Record<E4V3M7Arm, E4V3M7Disposition>;
  };
  diagnostics: {
    fc_over_attempted_NEVER_HONESTY_AT_CLOSE: Record<E4V3M7Arm, { events: number; attempted: number; rate: number | null }>;
    class_composition_by_arm: Record<string, Record<E4DriftItemKind, Record<E4DriftClass, number>>>;
    floor: Array<{ pairing_label: string; substrate_seed: number; arm: E4V3M7Arm } & E4FloorCollapseResult>;
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

export class E4V3M7GoNoGoError extends Error {
  constructor(message: string) {
    super(`[e4-v3-m7-gonogo] ${message}`);
    this.name = "E4V3M7GoNoGoError";
  }
}

function mean(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function asV1TaskRecords(tasks: E4V2TaskRecord[]): E4TaskRecord[] {
  return tasks as unknown as E4TaskRecord[];
}

// [pre-reg §2 c1] burden at checkpoint k = the count of open drift items in the task-k record's
// drift report (the whole-surface, lineage-merged discrepancy set at that close or wall).
export function burdenAtCheckpoint(task: E4V2TaskRecord): number {
  let total = 0;

  for (const kind of Object.values(task.drift.counts)) {
    for (const count of Object.values(kind)) {
      total += count;
    }
  }

  return total;
}

export function sequenceBurdenAuc(tasks: E4V2TaskRecord[], scheduledTasks: number): { series: number[]; auc: number } {
  const series = tasks.map(burdenAtCheckpoint);
  const sum = series.reduce((acc, value) => acc + value, 0);

  return { series, auc: sum / scheduledTasks };
}

export function groupE4V3M7PairedSeeds(manifests: E4V2RunManifest[]): E4V3M7PairedSeedGroup[] {
  const byLabel = new Map<string, E4V2RunManifest[]>();

  for (const manifest of manifests) {
    const list = byLabel.get(manifest.pairing_label) ?? [];
    list.push(manifest);
    byLabel.set(manifest.pairing_label, list);
  }

  const groups: E4V3M7PairedSeedGroup[] = [];

  for (const [label, group] of [...byLabel.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const byArm = new Map(group.map((manifest) => [manifest.arm, manifest]));
    const exclusionReasons: string[] = [];

    for (const arm of E4_V3_M7_ARMS) {
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
      manifests: Object.fromEntries(E4_V3_M7_ARMS.map((arm) => [arm, byArm.get(arm)]).filter(([, m]) => m)) as Partial<
        Record<E4V3M7Arm, E4V2RunManifest>
      >,
      surviving: exclusionReasons.length === 0,
      exclusion_reasons: exclusionReasons
    });
  }

  return groups;
}

function pooledRecords(groups: E4V3M7PairedSeedGroup[], arm: E4V3M7Arm): E4V2TaskRecord[] {
  return groups.flatMap((group) => group.manifests[arm]?.tasks ?? []);
}

export function computeE4V3M7GoNoGo(input: {
  manifests: E4V2RunManifest[];
  constants: E4V2SealedConstants;
  constantsHash: string;
  v3Constants: E4V3SealedConstants;
  v3ConstantsHash: string;
  conventionAggregationMinItems: number;
}): E4V3M7Report {
  const { constants, constantsHash, v3Constants, v3ConstantsHash, conventionAggregationMinItems } = input;

  const m7 = v3Constants.m7_evidence;

  if (!m7) {
    throw new E4V3M7GoNoGoError("the sealed v3 constants carry no m7_evidence block (close-rate guard + denominator)");
  }

  // Calibration runs are non-evidence: excluded structurally (M6.5 precedent).
  const manifests = input.manifests.filter((manifest) => manifest.run_classification !== "calibration");

  if (manifests.length === 0) {
    throw new E4V3M7GoNoGoError("no non-calibration manifests to evaluate");
  }

  const aggregation = { convention_aggregation_min_items: conventionAggregationMinItems };
  const groups = groupE4V3M7PairedSeeds(manifests);
  const survivors = groups.filter((group) => group.surviving);

  // ---- triggers (run FIRST) ----

  const triggers: E4V3M7Report["triggers"] = [];

  triggers.push({
    id: "insufficient_valid_data",
    fired: survivors.length < constants.interpretability.min_replay_valid_paired_seeds,
    detail: `${survivors.length} surviving replay-valid paired seed(s); sealed minimum ${constants.interpretability.min_replay_valid_paired_seeds}`
  });

  const perSeedArm0 = survivors.map((group) => ({
    seed: group.substrate_seed,
    velocity: computeE4DriftVelocity(asV1TaskRecords(group.manifests.e4_arm_0?.tasks ?? []), aggregation).velocity
  }));
  const perSeedArmP = survivors.map((group) => ({
    seed: group.substrate_seed,
    velocity: computeE4DriftVelocity(asV1TaskRecords(group.manifests.e4_arm_p?.tasks ?? []), aggregation).velocity
  }));

  // Per-sequence burden series (the c1 inputs, printed for hand-recomputation).
  const perSequenceBurden: E4V3M7Report["predicates"]["c_primary_burden"]["per_sequence_burden"] = [];

  for (const group of survivors) {
    for (const arm of E4_V3_M7_ARMS) {
      const tasks = group.manifests[arm]?.tasks ?? [];
      const scheduled = group.manifests[arm]?.compatibility_boundary.substrate_config.task_count ?? m7.scheduled_tasks_per_sequence;
      const { series, auc } = sequenceBurdenAuc(tasks, scheduled);
      perSequenceBurden.push({ seed: group.substrate_seed, arm, burden_by_checkpoint: series, auc });
    }
  }

  const aucMean = (arm: E4V3M7Arm) => mean(perSequenceBurden.filter((entry) => entry.arm === arm).map((entry) => entry.auc));
  const arm0Auc = aucMean("e4_arm_0");
  const armpAuc = aucMean("e4_arm_p");

  const anyDrifts =
    [...perSeedArm0, ...perSeedArmP].some((entry) => (entry.velocity ?? 0) > 0) ||
    perSequenceBurden.some((entry) => entry.auc > 0);
  const arm0Complete = pooledRecords(survivors, "e4_arm_0").filter((task) => task.status === "complete");
  const arm0SpecTouch = arm0Complete.filter((task) => task.spec_touch.touched).length;
  const specTouchBranch =
    arm0Complete.length > 0 && arm0SpecTouch * 2 >= arm0Complete.length
      ? "Arm-0 completed its spec phases normally — claim-safe finding branch"
      : "widespread Arm-0 spec-phase stalls / low spec_touch — H1-untested branch";

  triggers.push({
    id: "substrate_not_validated",
    fired: survivors.length > 0 && !anyDrifts,
    detail: anyDrifts
      ? "at least one arm records drift (velocity or burden) > 0"
      : `both arms record velocity == 0 AND burden AUC == 0 — spec_touch split: Arm-0 spec_touch on ${arm0SpecTouch}/${arm0Complete.length} complete tasks ⇒ ${specTouchBranch}`
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

  const armpRecords = manifests.filter((manifest) => manifest.arm === "e4_arm_p").flatMap((manifest) => manifest.tasks);
  const armpAttempted = armpRecords.filter((task) => task.status === "complete");
  const armpSpecStalled = armpAttempted.filter((task) => task.phase_at_termination === "spec").length;
  const armpStallFraction = armpAttempted.length > 0 ? armpSpecStalled / armpAttempted.length : 0;

  triggers.push({
    id: "arm_p_protocol_confusion",
    fired: armpStallFraction >= constants.interpretability.arm_h_spec_stall_max_fraction,
    detail: `e4_arm_p never exited the spec phase on ${armpSpecStalled}/${armpAttempted.length} attempted tasks (sealed max fraction ${constants.interpretability.arm_h_spec_stall_max_fraction})`
  });

  // ---- predicates ----

  const aHolds = perSeedArm0.length > 0 && perSeedArm0.every((entry) => (entry.velocity ?? 0) > 0);

  // (b) v2 + v3 stamp + ONE identical nonempty harness commit.
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
  const harnessCommits = new Set<string>();

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

    if (v3Stamp.constants_hash !== v3ConstantsHash || v3Stamp.constants_version !== v3Constants.version) {
      badStampDetail = `${where} stamps v3 ${v3Stamp.constants_version}/${v3Stamp.constants_hash}, sealed is ${v3Constants.version}/${v3ConstantsHash}`;
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

    if (typeof manifest.harness_commit !== "string" || manifest.harness_commit.length === 0) {
      badStampDetail = `${where} carries no harness_commit`;
      break;
    }

    harnessCommits.add(manifest.harness_commit);
  }

  if (badStampDetail === null && harnessCommits.size !== 1) {
    badStampDetail = `manifests stamp ${harnessCommits.size} distinct harness commits: ${[...harnessCommits].join(", ")}`;
  }

  const bHolds = badStampDetail === null;

  // (c1) burden AUC with the sealed close-rate guard.
  const doneRate = (arm: E4V3M7Arm): { done: number; scheduled: number; rate: number | null } => {
    let done = 0;
    let scheduled = 0;

    for (const group of survivors) {
      const manifest = group.manifests[arm];
      if (!manifest) continue;
      scheduled += manifest.compatibility_boundary.substrate_config.task_count;
      done += manifest.tasks.filter((task) => task.termination === "done").length;
    }

    return { done, scheduled, rate: scheduled > 0 ? done / scheduled : null };
  };

  const arm0Done = doneRate("e4_arm_0");
  const armpDone = doneRate("e4_arm_p");
  const guardHolds =
    arm0Done.rate !== null && armpDone.rate !== null && armpDone.rate >= arm0Done.rate - m7.close_rate_guard_max_gap;
  const directionHolds = arm0Auc !== null && armpAuc !== null && arm0Auc > armpAuc;
  const cHolds = directionHolds && guardHolds;

  // ---- first-class secondaries (NO verdict weight) ----

  const fcGivenDone = {} as E4V3M7Report["secondaries"]["fc_given_done"];
  const fcOverAttempted = {} as E4V3M7Report["diagnostics"]["fc_over_attempted_NEVER_HONESTY_AT_CLOSE"];
  const disposition = {} as E4V3M7Report["secondaries"]["disposition"];

  for (const arm of E4_V3_M7_ARMS) {
    const records = pooledRecords(survivors, arm);
    const complete = records.filter((task) => task.status === "complete");
    const doneTasks = complete.filter((task) => task.termination === "done");
    const fcDone = doneTasks.filter((task) => task.false_confidence.event).length;
    const fcAll = complete.filter((task) => task.false_confidence.event).length;

    fcGivenDone[arm] = { events: fcDone, done: doneTasks.length, rate: doneTasks.length > 0 ? fcDone / doneTasks.length : null };
    fcOverAttempted[arm] = {
      events: fcAll,
      attempted: complete.length,
      rate: complete.length > 0 ? fcAll / complete.length : null
    };

    const noncloseTasks = complete.filter((task) => task.termination !== "done");
    const noncloseBy: Record<string, number> = {};

    for (const task of noncloseTasks) {
      const key = `${task.termination}${task.phase_at_termination ? `/${task.phase_at_termination}-phase` : ""}`;
      noncloseBy[key] = (noncloseBy[key] ?? 0) + 1;
    }

    disposition[arm] = {
      scheduled: survivors.reduce(
        (sum, group) => sum + (group.manifests[arm]?.compatibility_boundary.substrate_config.task_count ?? 0),
        0
      ),
      truthful_close: doneTasks.length - fcDone,
      false_close: fcDone,
      nonclose: noncloseTasks.length,
      nonclose_by_termination: noncloseBy
    };
  }

  const pairList: E4V3M7MatchedPairs["pair_list"] = [];

  for (const group of survivors) {
    const arm0Tasks = new Map((group.manifests.e4_arm_0?.tasks ?? []).map((task) => [task.task_index, task]));
    const armpTasks = new Map((group.manifests.e4_arm_p?.tasks ?? []).map((task) => [task.task_index, task]));

    for (const [index, arm0Task] of arm0Tasks) {
      const armpTask = armpTasks.get(index);

      if (arm0Task.termination === "done" && armpTask?.termination === "done") {
        pairList.push({
          seed: group.substrate_seed,
          task_index: index,
          arm0_fc: arm0Task.false_confidence.event,
          armp_fc: armpTask.false_confidence.event
        });
      }
    }
  }

  const matchedPairs: E4V3M7MatchedPairs = {
    pairs: pairList.length,
    concordant_honest: pairList.filter((pair) => !pair.arm0_fc && !pair.armp_fc).length,
    concordant_false: pairList.filter((pair) => pair.arm0_fc && pair.armp_fc).length,
    discordant_arm0_lied: pairList.filter((pair) => pair.arm0_fc && !pair.armp_fc).length,
    discordant_armp_lied: pairList.filter((pair) => !pair.arm0_fc && pair.armp_fc).length,
    pair_list: pairList
  };

  // ---- diagnostics ----

  const classComposition: E4V3M7Report["diagnostics"]["class_composition_by_arm"] = {};

  for (const arm of E4_V3_M7_ARMS) {
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

  const floor: E4V3M7Report["diagnostics"]["floor"] = [];

  for (const group of survivors) {
    for (const arm of E4_V3_M7_ARMS) {
      floor.push({
        pairing_label: group.pairing_label,
        substrate_seed: group.substrate_seed,
        arm,
        ...computeE4FloorCollapse(asV1TaskRecords(group.manifests[arm]?.tasks ?? []))
      });
    }
  }

  const refusedByArm: Record<string, number> = {};
  const askPmByArm: Record<string, { requested: number; complete: number }> = {};

  for (const arm of E4_V3_M7_ARMS) {
    const complete = pooledRecords(survivors, arm).filter((task) => task.status === "complete");
    refusedByArm[arm] = complete.reduce((sum, task) => sum + task.gate_events.refused_done_over_red, 0);
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

  for (const arm of E4_V3_M7_ARMS) {
    const records = pooledRecords(survivors, arm).filter((task) => task.status === "complete");
    const passing = records.filter(
      (task) => task.oracle.cumulative_total > 0 && task.oracle.cumulative_pass === task.oracle.cumulative_total
    );

    if (records.length > 0 && passing.length === 0) {
      advisoryFlags.push(`(v) ${arm}: zero oracle-passing tasks — per-passing quantities undefined at pilot scale`);
    }
  }

  const arm0Positive = perSeedArm0
    .map((entry) => entry.velocity)
    .filter((velocity): velocity is number => velocity !== null && velocity > 0);

  if (arm0Positive.length >= 2 && Math.max(...arm0Positive) / Math.min(...arm0Positive) > 3) {
    advisoryFlags.push("(vi) high seed variance: max/min Arm-0 velocity ratio > 3 — recommend more seeds in any full run");
  }

  if (directionHolds && !guardHolds) {
    advisoryFlags.push(
      "c1 direction held but the close-rate guard FAILED: the freshness win is composition (arm p closed materially fewer tasks) — the M6 §10 artifact, void for the verdict"
    );
  }

  // ---- verdict ----

  const firedTriggers = triggers.filter((trigger) => trigger.fired);
  const failedPredicates = [
    ...(aHolds ? [] : ["(a) Arm-0 drift velocity > 0 on every surviving seed"]),
    ...(bHolds ? [] : ["(b) v2 + v3 constants stamp + one identical harness commit in every manifest"]),
    ...(cHolds ? [] : ["(c) primary composition-proof freshness (burden AUC with the sealed close-rate guard)"])
  ];

  const verdict: E4V3M7Verdict =
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
          ? `all manifests stamp v2 ${constantsHash} + v3 ${v3ConstantsHash} + profile ${v3Constants.protocol_profile_id} + harness ${[...harnessCommits][0]}`
          : badStampDetail!
      },
      c_primary_burden: {
        holds: cHolds,
        c1_auc: { left_mean: arm0Auc, right_mean: armpAuc, direction_holds: directionHolds },
        guard: {
          holds: guardHolds,
          arm0_done_rate: arm0Done.rate,
          armp_done_rate: armpDone.rate,
          sealed_max_gap: m7.close_rate_guard_max_gap
        },
        per_sequence_burden: perSequenceBurden
      }
    },
    secondaries: {
      fc_given_done: fcGivenDone,
      matched_pairs: matchedPairs,
      disposition
    },
    diagnostics: {
      fc_over_attempted_NEVER_HONESTY_AT_CLOSE: fcOverAttempted,
      class_composition_by_arm: classComposition,
      floor,
      refused_done_over_red_by_arm: refusedByArm,
      ask_pm_by_arm: askPmByArm,
      product_gate_arm_p: productGateTotals,
      advisory_flags: advisoryFlags
    },
    failed_predicates: failedPredicates
  };
}
