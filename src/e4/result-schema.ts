// E4 result schema stub (architecture §2.5; IMPLEMENTATION-PLAN.md M0, §3.1 H1).
// [R1-B2] [R2: R2-1] pins drift velocity as a flow of discrepancy episodes — never a count of
// rendered-name item_ids, never a sum of whole-surface per-task counts. Computes over fixtures
// only (no live meter/oracle/usage data exists before M2/M3/M5); H2 reuses this same function
// against Arm H's task records (both directions), H3–H5 need data this milestone does not own yet
// and are not stubbed here to avoid a speculative half-implementation.
import type { E4Discrepancy, E4TaskRecord } from "./types";

type E4EpisodeKey = string; // `${semantic_item_uid}::${direction}`

function episodeKey(discrepancy: E4Discrepancy): E4EpisodeKey {
  return `${discrepancy.semantic_item_uid}::${discrepancy.direction}`;
}

export type E4DriftVelocityResult = {
  episode_onset_count: number; // after convention aggregation
  drift_opportunity_task_count: number;
  velocity: number | null; // onset_count / opportunity_count; null (undefined) if opportunity_count === 0
  drift_burden_at_t_n: number; // whole-surface item-level discrepancy count at the last task
};

// Onset scan runs over ALL tasks in the sequence (R2-9a — subsumed here, not restricted to
// drift_opportunity-labeled tasks); only the denominator is restricted to drift_opportunity tasks.
export function computeE4DriftVelocity(
  taskRecords: E4TaskRecord[],
  constants: { convention_aggregation_min_items: number }
): E4DriftVelocityResult {
  const sorted = [...taskRecords].sort((a, b) => a.task_index - b.task_index);

  let previouslyDiscrepantKeys = new Set<E4EpisodeKey>();
  let episodeOnsetCount = 0;

  for (const task of sorted) {
    const discrepantThisTask = new Map<E4EpisodeKey, E4Discrepancy[]>();

    for (const discrepancy of task.drift.discrepancies) {
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

  return {
    episode_onset_count: episodeOnsetCount,
    drift_opportunity_task_count: driftOpportunityTaskCount,
    velocity: driftOpportunityTaskCount > 0 ? episodeOnsetCount / driftOpportunityTaskCount : null,
    drift_burden_at_t_n: lastTask ? lastTask.drift.discrepancies.length : 0
  };
}
