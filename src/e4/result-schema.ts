// E4 result schema (architecture §2.5; IMPLEMENTATION-PLAN.md M0 stub → M5 complete, §3.1).
// Recomputes each hypothesis's reportable number from task records alone — direct manifest reads,
// never turn-record archaeology (Gate-1 change 4). Every §3.1 pin is implemented here:
// [R1-B2] [R2: R2-1] drift velocity is a FLOW of discrepancy episodes on semantic_item_uid;
// [R2: R2-2] H5 taxes use attempted-task denominators, paired across arms;
// [R2: R2-8] the freshness tax carries a protocol-overhead sensitivity line;
// ADR-005 pin: status === "aborted" records are infrastructure-classified and excluded from all
// analysis denominators and numerators (velocity scans, taxes, pass rates, floor rule alike).
import type { E4RunManifest, E4TaskRecord } from "./manifest";
import type { E4Discrepancy, E4DriftDirection, E4TokenUsage } from "./types";

// The §3.1 pinned literal for empty-denominator reporting — never 0, never a negative artifact.
export const E4_UNDEFINED_AT_PILOT_SCALE = "undefined at pilot scale" as const;

type E4EpisodeKey = string; // `${semantic_item_uid}::${direction}`

function episodeKey(discrepancy: E4Discrepancy): E4EpisodeKey {
  return `${discrepancy.semantic_item_uid}::${discrepancy.direction}`;
}

function completeTasks(taskRecords: E4TaskRecord[]): E4TaskRecord[] {
  return taskRecords
    .filter((task) => task.status === "complete")
    .sort((a, b) => a.task_index - b.task_index);
}

function tokensTotal(usage: E4TokenUsage): number {
  return usage.fresh_input_tokens + usage.cached_input_tokens + usage.output_tokens;
}

export type E4DriftVelocityResult = {
  episode_onset_count: number; // after convention aggregation
  drift_opportunity_task_count: number;
  velocity: number | null; // onset_count / opportunity_count; null (undefined) if opportunity_count === 0
  drift_burden_at_t_n: number; // whole-surface item-level discrepancy count at the last task
};

// Onset scan runs over ALL (complete) tasks in the sequence (R2-9a — never restricted to
// drift_opportunity-labeled tasks); only the denominator is restricted to drift_opportunity tasks.
// [M5] optional direction filter serves H2 (both directions reported) and H3 (spec-side only).
export function computeE4DriftVelocity(
  taskRecords: E4TaskRecord[],
  constants: { convention_aggregation_min_items: number },
  options?: { direction?: E4DriftDirection }
): E4DriftVelocityResult {
  const sorted = completeTasks(taskRecords);
  const direction = options?.direction;

  let previouslyDiscrepantKeys = new Set<E4EpisodeKey>();
  let episodeOnsetCount = 0;

  for (const task of sorted) {
    const discrepantThisTask = new Map<E4EpisodeKey, E4Discrepancy[]>();

    for (const discrepancy of task.drift.discrepancies) {
      if (direction !== undefined && discrepancy.direction !== direction) {
        continue;
      }

      const key = episodeKey(discrepancy);
      const existing = discrepantThisTask.get(key);

      if (existing) {
        existing.push(discrepancy);
      } else {
        discrepantThisTask.set(key, [discrepancy]);
      }
    }

    const onsettingKeys = [...discrepantThisTask.keys()].filter((key) => !previouslyDiscrepantKeys.has(key));

    // Convention aggregation: ≥N distinct convention-kind items onsetting at the same task
    // collapse to one episode-onset for velocity; item-level counts still land in drift burden.
    const conventionOnsets = onsettingKeys.filter((key) =>
      discrepantThisTask.get(key)!.every((discrepancy) => discrepancy.kind === "convention")
    );
    const nonConventionOnsetCount = onsettingKeys.length - conventionOnsets.length;

    episodeOnsetCount +=
      conventionOnsets.length >= constants.convention_aggregation_min_items
        ? nonConventionOnsetCount + 1
        : onsettingKeys.length;

    previouslyDiscrepantKeys = new Set(discrepantThisTask.keys());
  }

  const driftOpportunityTaskCount = sorted.filter((task) =>
    task.opportunity_labels.includes("drift_opportunity")
  ).length;

  const lastTask = sorted[sorted.length - 1];
  const burdenDiscrepancies = lastTask
    ? lastTask.drift.discrepancies.filter(
        (discrepancy) => direction === undefined || discrepancy.direction === direction
      )
    : [];

  return {
    episode_onset_count: episodeOnsetCount,
    drift_opportunity_task_count: driftOpportunityTaskCount,
    velocity: driftOpportunityTaskCount > 0 ? episodeOnsetCount / driftOpportunityTaskCount : null,
    drift_burden_at_t_n: burdenDiscrepancies.length
  };
}

// ---------------------------------------------------------------------------------------------
// §3.2 floor-effect rule (pinned numeric definition, Gate-1): two consecutive tasks, the first at
// task_index ≤ 3, each showing total task failure — oracle prong (cumulative 0-of-N with N > 0)
// or smoke prong (≥1 readiness failure that task; [R1-S1i] a single blip on one task never flags).
// ---------------------------------------------------------------------------------------------

export type E4FloorCollapseResult = {
  floor_collapsed: boolean;
  trigger_task_index: number | null; // first task of the collapsing pair
};

function floorProng(task: E4TaskRecord): boolean {
  const oracleProng = task.oracle.cumulative_total > 0 && task.oracle.cumulative_pass === 0;
  const smokeProng = task.smoke_readiness_failures > 0;

  return oracleProng || smokeProng;
}

export function computeE4FloorCollapse(taskRecords: E4TaskRecord[]): E4FloorCollapseResult {
  const sorted = completeTasks(taskRecords);

  for (let i = 0; i + 1 < sorted.length; i += 1) {
    const first = sorted[i];
    const second = sorted[i + 1];

    if (
      first.task_index <= 3 &&
      second.task_index === first.task_index + 1 &&
      floorProng(first) &&
      floorProng(second)
    ) {
      return { floor_collapsed: true, trigger_task_index: first.task_index };
    }
  }

  return { floor_collapsed: false, trigger_task_index: null };
}

// ---------------------------------------------------------------------------------------------
// H3 signature pair ([R1-C2]): reported as an ORDERED PAIR per arm, never one scalar — spec-side
// freshness (spec_vs_truth onset velocity; lower = fresher) and code-side conformance (oracle
// cumulative pass rate). The M-vs-H comparison is done by the report, not collapsed here.
// ---------------------------------------------------------------------------------------------

export type E4H3SignaturePair = {
  spec_side_onset_velocity: number | null;
  code_side_pass_rate: number | null;
};

export function computeE4H3SignaturePair(
  taskRecords: E4TaskRecord[],
  constants: { convention_aggregation_min_items: number }
): E4H3SignaturePair {
  const sorted = completeTasks(taskRecords);
  const specSide = computeE4DriftVelocity(taskRecords, constants, { direction: "spec_vs_truth" });
  const passTotal = sorted.reduce((sum, task) => sum + task.oracle.cumulative_total, 0);
  const passCount = sorted.reduce((sum, task) => sum + task.oracle.cumulative_pass, 0);

  return {
    spec_side_onset_velocity: specSide.velocity,
    code_side_pass_rate: passTotal > 0 ? passCount / passTotal : null
  };
}

// ---------------------------------------------------------------------------------------------
// H4 ([R1-S1iii]): slope-difference statement only at pilot scale — the per-task series plus an
// OLS slope of pass rate against task_index, gated by the per-arm floor rule.
// ---------------------------------------------------------------------------------------------

export type E4H4Result = {
  series: Array<{ task_index: number; cumulative_pass_rate: number | null; termination: string }>;
  slope: number | null; // OLS over tasks with a defined pass rate; null with < 2 points
  floor: E4FloorCollapseResult;
};

export function computeE4H4(taskRecords: E4TaskRecord[]): E4H4Result {
  const sorted = completeTasks(taskRecords);
  const series = sorted.map((task) => ({
    task_index: task.task_index,
    cumulative_pass_rate:
      task.oracle.cumulative_total > 0 ? task.oracle.cumulative_pass / task.oracle.cumulative_total : null,
    termination: task.termination
  }));

  const points = series.filter((point) => point.cumulative_pass_rate !== null) as Array<{
    task_index: number;
    cumulative_pass_rate: number;
  }>;

  let slope: number | null = null;

  if (points.length >= 2) {
    const n = points.length;
    const meanX = points.reduce((sum, point) => sum + point.task_index, 0) / n;
    const meanY = points.reduce((sum, point) => sum + point.cumulative_pass_rate, 0) / n;
    const covariance = points.reduce(
      (sum, point) => sum + (point.task_index - meanX) * (point.cumulative_pass_rate - meanY),
      0
    );
    const variance = points.reduce((sum, point) => sum + (point.task_index - meanX) ** 2, 0);
    slope = variance > 0 ? covariance / variance : null;
  }

  return { series, slope, floor: computeE4FloorCollapse(taskRecords) };
}

// ---------------------------------------------------------------------------------------------
// False-confidence PROPENSITY ([R2: R2-6] via §5(c2)): binary per task — "≥1 unearned done
// attempt" — gated arms read gate_events.refused_done_over_red ≥ 1, ungated arms read the
// false_confidence event; rates over attempted (complete) tasks. Total refusal counts are a
// diagnostic, never the predicate.
// ---------------------------------------------------------------------------------------------

export type E4FalseConfidencePropensity = {
  event_task_count: number;
  attempted_task_count: number;
  rate: number | null;
  total_refusals_diagnostic: number;
};

export function computeE4FalseConfidencePropensity(taskRecords: E4TaskRecord[]): E4FalseConfidencePropensity {
  const sorted = completeTasks(taskRecords);
  const events = sorted.filter((task) =>
    task.gate_events !== null ? task.gate_events.refused_done_over_red >= 1 : task.false_confidence.event
  ).length;

  return {
    event_task_count: events,
    attempted_task_count: sorted.length,
    rate: sorted.length > 0 ? events / sorted.length : null,
    total_refusals_diagnostic: sorted.reduce((sum, task) => sum + (task.gate_events?.refused_done_over_red ?? 0), 0)
  };
}

// ---------------------------------------------------------------------------------------------
// H5 ([R1-S5] [R2: R2-2] [R2: R2-8]): both taxes in tokens, attempted-task denominators paired
// across arms (task indices complete in BOTH arms). The gate-executor cost surfaces as tokens
// only through the injected feedback, so "gate_executor tokens" is realized as the estimator-
// attributed gate-channel components (gate_protocol_interaction + oracle_feedback) injected in
// the implementation phase — the spec phase's own totals already contain its share.
// ---------------------------------------------------------------------------------------------

export type E4H5Result = {
  attempted_task_indices: number[];
  freshness_tax_tokens_per_task: number | null;
  drift_tax_tokens_per_task: number | null;
  verdict: "supported" | "not_supported" | null; // freshness < drift; null when no attempted pairs
  sensitivity: {
    freshness_without_gate_protocol_tokens_per_task: number | null;
    verdict_flips: boolean;
    reported_verdict: "supported" | "not_supported" | "sensitive to protocol overhead" | null;
  };
  pass_rates: { arm0: number | null; arm_h: number | null }; // always reported alongside, never blended
  secondary_per_oracle_passing_task: {
    arm0_tokens_per_passing_task: number | typeof E4_UNDEFINED_AT_PILOT_SCALE;
    arm_h_tokens_per_passing_task: number | typeof E4_UNDEFINED_AT_PILOT_SCALE;
  };
};

export function computeE4H5(input: { arm0: E4TaskRecord[]; arm_h: E4TaskRecord[] }): E4H5Result {
  const arm0Complete = completeTasks(input.arm0);
  const armHComplete = completeTasks(input.arm_h);
  const armHByIndex = new Map(armHComplete.map((task) => [task.task_index, task]));
  const attempted = arm0Complete
    .map((task) => task.task_index)
    .filter((index) => armHByIndex.has(index));
  const arm0Attempted = arm0Complete.filter((task) => attempted.includes(task.task_index));
  const armHAttempted = attempted.map((index) => armHByIndex.get(index)!);
  const n = attempted.length;

  const passRate = (tasks: E4TaskRecord[]): number | null => {
    const total = tasks.reduce((sum, task) => sum + task.oracle.cumulative_total, 0);
    const pass = tasks.reduce((sum, task) => sum + task.oracle.cumulative_pass, 0);

    return total > 0 ? pass / total : null;
  };

  const perPassing = (tasks: E4TaskRecord[]): number | typeof E4_UNDEFINED_AT_PILOT_SCALE => {
    const passing = tasks.filter(
      (task) => task.oracle.cumulative_total > 0 && task.oracle.cumulative_pass === task.oracle.cumulative_total
    );

    if (passing.length === 0) {
      return E4_UNDEFINED_AT_PILOT_SCALE;
    }

    const totalTokens = tasks.reduce((sum, task) => sum + tokensTotal(task.usage.tokens), 0);

    return totalTokens / passing.length;
  };

  if (n === 0) {
    return {
      attempted_task_indices: [],
      freshness_tax_tokens_per_task: null,
      drift_tax_tokens_per_task: null,
      verdict: null,
      sensitivity: {
        freshness_without_gate_protocol_tokens_per_task: null,
        verdict_flips: false,
        reported_verdict: null
      },
      pass_rates: { arm0: passRate(arm0Attempted), arm_h: passRate(armHAttempted) },
      secondary_per_oracle_passing_task: {
        arm0_tokens_per_passing_task: perPassing(arm0Attempted),
        arm_h_tokens_per_passing_task: perPassing(armHAttempted)
      }
    };
  }

  let freshnessSum = 0;
  let gateProtocolSum = 0;
  let armHImplementationSum = 0;

  for (const task of armHAttempted) {
    const spec = task.usage.by_phase.spec;
    const implementation = task.usage.by_phase.implementation;

    freshnessSum +=
      tokensTotal(spec.tokens) +
      implementation.gate_protocol_interaction_tokens +
      implementation.oracle_feedback_tokens;
    gateProtocolSum += spec.gate_protocol_interaction_tokens + implementation.gate_protocol_interaction_tokens;
    armHImplementationSum += tokensTotal(implementation.tokens);
  }

  const arm0TotalSum = arm0Attempted.reduce((sum, task) => sum + tokensTotal(task.usage.tokens), 0);

  const freshnessTax = freshnessSum / n;
  const driftTax = arm0TotalSum / n - armHImplementationSum / n;
  const verdict: "supported" | "not_supported" = freshnessTax < driftTax ? "supported" : "not_supported";

  const freshnessWithout = (freshnessSum - gateProtocolSum) / n;
  const verdictWithout: "supported" | "not_supported" = freshnessWithout < driftTax ? "supported" : "not_supported";
  const flips = verdict !== verdictWithout;

  return {
    attempted_task_indices: attempted,
    freshness_tax_tokens_per_task: freshnessTax,
    drift_tax_tokens_per_task: driftTax,
    verdict,
    sensitivity: {
      freshness_without_gate_protocol_tokens_per_task: freshnessWithout,
      verdict_flips: flips,
      reported_verdict: flips ? "sensitive to protocol overhead" : verdict
    },
    pass_rates: { arm0: passRate(arm0Attempted), arm_h: passRate(armHAttempted) },
    secondary_per_oracle_passing_task: {
      arm0_tokens_per_passing_task: perPassing(arm0Attempted),
      arm_h_tokens_per_passing_task: perPassing(armHAttempted)
    }
  };
}

// ---------------------------------------------------------------------------------------------
// Whole-run convenience: one reportable block per hypothesis from the three paired manifests.
// ---------------------------------------------------------------------------------------------

export type E4HypothesisReport = {
  h1_arm0_velocity: E4DriftVelocityResult;
  h2_armh_velocity: {
    all: E4DriftVelocityResult;
    spec_vs_truth: E4DriftVelocityResult;
    code_vs_truth: E4DriftVelocityResult;
  };
  h3_pairs: { arm_m: E4H3SignaturePair; arm_h: E4H3SignaturePair; arm_0: E4H3SignaturePair };
  h4: { arm_0: E4H4Result; arm_h: E4H4Result; blocked_floor_confounded: boolean };
  h5: E4H5Result;
  false_confidence_propensity: { arm_0: E4FalseConfidencePropensity; arm_m: E4FalseConfidencePropensity; arm_h: E4FalseConfidencePropensity };
};

export function computeE4HypothesisReport(input: {
  manifests: { arm_0: E4RunManifest; arm_m: E4RunManifest; arm_h: E4RunManifest };
  constants: { convention_aggregation_min_items: number };
}): E4HypothesisReport {
  const { manifests, constants } = input;

  // [M6.5] calibration runs are non-evidence (estate precedent): no H number is ever computed
  // over one. Structural, not caller discipline.
  for (const manifest of Object.values(manifests)) {
    if (manifest.run_classification === "calibration") {
      throw new Error(
        `[e4-result-schema] ${manifest.run_id} is calibration-classified (non-evidence) and cannot enter a hypothesis computation`
      );
    }
  }
  const h4Arm0 = computeE4H4(manifests.arm_0.tasks);
  const h4ArmH = computeE4H4(manifests.arm_h.tasks);

  return {
    h1_arm0_velocity: computeE4DriftVelocity(manifests.arm_0.tasks, constants),
    h2_armh_velocity: {
      all: computeE4DriftVelocity(manifests.arm_h.tasks, constants),
      spec_vs_truth: computeE4DriftVelocity(manifests.arm_h.tasks, constants, { direction: "spec_vs_truth" }),
      code_vs_truth: computeE4DriftVelocity(manifests.arm_h.tasks, constants, { direction: "code_vs_truth" })
    },
    h3_pairs: {
      arm_0: computeE4H3SignaturePair(manifests.arm_0.tasks, constants),
      arm_m: computeE4H3SignaturePair(manifests.arm_m.tasks, constants),
      arm_h: computeE4H3SignaturePair(manifests.arm_h.tasks, constants)
    },
    // [R1-S1ii] per-arm rule, either leg: an Arm-0 collapse confounds the decline leg exactly as
    // an Arm-H collapse confounds the flat leg.
    h4: {
      arm_0: h4Arm0,
      arm_h: h4ArmH,
      blocked_floor_confounded: h4Arm0.floor.floor_collapsed || h4ArmH.floor.floor_collapsed
    },
    h5: computeE4H5({ arm0: manifests.arm_0.tasks, arm_h: manifests.arm_h.tasks }),
    false_confidence_propensity: {
      arm_0: computeE4FalseConfidencePropensity(manifests.arm_0.tasks),
      arm_m: computeE4FalseConfidencePropensity(manifests.arm_m.tasks),
      arm_h: computeE4FalseConfidencePropensity(manifests.arm_h.tasks)
    }
  };
}
