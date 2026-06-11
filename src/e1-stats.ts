import type { ConditionId } from "./conditions";
import type { E1NoProviderCheckpointBundle } from "./e1-no-provider-runner";

export type E1StatsGroupSummary = {
  checkpoints: number;
  turns: number;
  t_mean_turns_per_checkpoint: number | null;
  verification_requests: number;
  v_mean_verification_requests_per_checkpoint: number | null;
  verification_slots_used: number;
  no_op_turns: number;
  no_op_turn_rate: number | null;
  violation_turns: number;
  violation_turn_rate: number | null;
  violation_counts_by_code: Record<string, number>;
  terminations_by_classification: Record<string, number>;
  agent_stalled_checkpoint_rate: number | null;
  provider_tokens_per_turn: {
    fresh_input_mean: number | null;
    cached_input_mean: number | null;
    output_mean: number | null;
  };
  truncation_hits: number;
  truncation_hit_rate: number | null;
  output_truncated_turns: number;
  output_truncated_turn_rate: number | null;
  wall_time_ms_per_turn: {
    provider_call_mean: number | null;
    harness_apply_mean: number | null;
    total_mean: number | null;
    total_max: number | null;
  };
};

export type E1StatsSummary = {
  bundle_count: number;
  by_condition: Partial<Record<ConditionId, E1StatsGroupSummary>>;
  overall: E1StatsGroupSummary;
};

type ConditionBundles = Partial<Record<ConditionId, E1NoProviderCheckpointBundle[]>>;

export function extractE1ConditionBundles(bundleJson: unknown): ConditionBundles {
  const record = bundleJson as Record<string, unknown>;
  const schema = record.schema_version;

  if (schema === "e1-task-package-provider-bundle-v0") {
    return (record.provider_run as { condition_bundles: ConditionBundles }).condition_bundles;
  }

  if (schema === "e1-task-package-no-provider-bundle-v0") {
    return (record.no_provider_run as { arm_bundles: ConditionBundles }).arm_bundles;
  }

  if (schema === "e1-no-provider-run-bundle-v0") {
    return (record as unknown as { arm_bundles: ConditionBundles }).arm_bundles;
  }

  throw new Error(`Unsupported E1 bundle schema_version: ${String(schema)}`);
}

export function summarizeE1Stats(allConditionBundles: ConditionBundles[]): E1StatsSummary {
  const byCondition: Partial<Record<ConditionId, E1NoProviderCheckpointBundle[]>> = {};

  for (const conditionBundles of allConditionBundles) {
    for (const [conditionId, bundles] of Object.entries(conditionBundles) as Array<
      [ConditionId, E1NoProviderCheckpointBundle[]]
    >) {
      if (!bundles?.length) {
        continue;
      }

      byCondition[conditionId] = [...(byCondition[conditionId] ?? []), ...bundles];
    }
  }

  const summaryByCondition: Partial<Record<ConditionId, E1StatsGroupSummary>> = {};

  for (const [conditionId, bundles] of Object.entries(byCondition) as Array<
    [ConditionId, E1NoProviderCheckpointBundle[]]
  >) {
    summaryByCondition[conditionId] = summarizeGroup(bundles);
  }

  return {
    bundle_count: allConditionBundles.length,
    by_condition: summaryByCondition,
    overall: summarizeGroup(Object.values(byCondition).flat())
  };
}

export function renderE1StatsLines(summary: E1StatsSummary): string[] {
  const lines = [`bundle_count=${summary.bundle_count}`];

  lines.push(...renderGroupLines("overall", summary.overall));

  for (const [conditionId, group] of Object.entries(summary.by_condition)) {
    lines.push(...renderGroupLines(conditionId, group));
  }

  return lines;
}

function summarizeGroup(bundles: E1NoProviderCheckpointBundle[]): E1StatsGroupSummary {
  const turns = bundles.flatMap((bundle) => bundle.turn_records);
  const verificationResults = turns.filter((turn) => turn.l0.verification_result !== null);
  const noOpTurns = turns.filter((turn) => turn.parsed.no_op);
  const violationTurns = turns.filter((turn) => turn.parsed.violations.length > 0);
  const violationCounts: Record<string, number> = {};
  const terminations: Record<string, number> = {};
  const truncationHits = verificationResults.filter((turn) => turn.l0.verification_result?.truncated).length;
  const outputTruncatedTurns = turns.filter((turn) => turnFinishReason(turn) === "length").length;

  for (const turn of turns) {
    for (const violation of turn.parsed.violations) {
      violationCounts[violation.code] = (violationCounts[violation.code] ?? 0) + 1;
    }
  }

  for (const bundle of bundles) {
    const classification = bundle.termination?.classification ?? "none";
    terminations[classification] = (terminations[classification] ?? 0) + 1;
  }

  const providerTurns = turns.filter((turn) => turn.provider_usage);
  const wallTimes = turns.map((turn) => turn.wall_time_ms).filter(Boolean);
  const stalledCheckpoints = bundles.filter(
    (bundle) => bundle.termination?.classification === "agent_stalled"
  ).length;

  return {
    checkpoints: bundles.length,
    turns: turns.length,
    t_mean_turns_per_checkpoint: ratio(turns.length, bundles.length),
    verification_requests: verificationResults.length,
    v_mean_verification_requests_per_checkpoint: ratio(verificationResults.length, bundles.length),
    verification_slots_used: bundles.reduce(
      (sum, bundle) => sum + (bundle.turn_records.at(-1)?.verification_budget.used ?? 0),
      0
    ),
    no_op_turns: noOpTurns.length,
    no_op_turn_rate: ratio(noOpTurns.length, turns.length),
    violation_turns: violationTurns.length,
    violation_turn_rate: ratio(violationTurns.length, turns.length),
    violation_counts_by_code: violationCounts,
    terminations_by_classification: terminations,
    agent_stalled_checkpoint_rate: ratio(stalledCheckpoints, bundles.length),
    provider_tokens_per_turn: {
      fresh_input_mean: mean(providerTurns.map((turn) => turn.provider_usage!.provider.fresh_input_tokens)),
      cached_input_mean: mean(providerTurns.map((turn) => turn.provider_usage!.provider.cached_input_tokens)),
      output_mean: mean(providerTurns.map((turn) => turn.provider_usage!.provider.output_tokens))
    },
    truncation_hits: truncationHits,
    truncation_hit_rate: ratio(truncationHits, verificationResults.length),
    output_truncated_turns: outputTruncatedTurns,
    output_truncated_turn_rate: ratio(outputTruncatedTurns, turns.length),
    wall_time_ms_per_turn: {
      provider_call_mean: mean(wallTimes.map((wall) => wall.provider_call_ms)),
      harness_apply_mean: mean(wallTimes.map((wall) => wall.harness_apply_ms)),
      total_mean: mean(wallTimes.map((wall) => wall.total_ms)),
      total_max: wallTimes.length ? Math.max(...wallTimes.map((wall) => wall.total_ms)) : null
    }
  };
}

function renderGroupLines(prefix: string, group: E1StatsGroupSummary): string[] {
  const lines = [
    `${prefix}.checkpoints=${group.checkpoints}`,
    `${prefix}.turns=${group.turns}`,
    `${prefix}.t_mean_turns_per_checkpoint=${formatNumber(group.t_mean_turns_per_checkpoint)}`,
    `${prefix}.verification_requests=${group.verification_requests}`,
    `${prefix}.v_mean_verification_requests_per_checkpoint=${formatNumber(group.v_mean_verification_requests_per_checkpoint)}`,
    `${prefix}.verification_slots_used=${group.verification_slots_used}`,
    `${prefix}.no_op_turn_rate=${formatNumber(group.no_op_turn_rate)}`,
    `${prefix}.violation_turn_rate=${formatNumber(group.violation_turn_rate)}`,
    `${prefix}.agent_stalled_checkpoint_rate=${formatNumber(group.agent_stalled_checkpoint_rate)}`,
    `${prefix}.truncation_hit_rate=${formatNumber(group.truncation_hit_rate)}`,
    `${prefix}.output_truncated_turn_rate=${formatNumber(group.output_truncated_turn_rate)}`,
    `${prefix}.provider_fresh_input_tokens_per_turn=${formatNumber(group.provider_tokens_per_turn.fresh_input_mean)}`,
    `${prefix}.provider_cached_input_tokens_per_turn=${formatNumber(group.provider_tokens_per_turn.cached_input_mean)}`,
    `${prefix}.provider_output_tokens_per_turn=${formatNumber(group.provider_tokens_per_turn.output_mean)}`,
    `${prefix}.wall_time_provider_call_ms_per_turn=${formatNumber(group.wall_time_ms_per_turn.provider_call_mean)}`,
    `${prefix}.wall_time_harness_apply_ms_per_turn=${formatNumber(group.wall_time_ms_per_turn.harness_apply_mean)}`,
    `${prefix}.wall_time_total_ms_per_turn=${formatNumber(group.wall_time_ms_per_turn.total_mean)}`,
    `${prefix}.wall_time_total_ms_max=${formatNumber(group.wall_time_ms_per_turn.total_max)}`
  ];

  for (const [code, count] of Object.entries(group.violation_counts_by_code)) {
    lines.push(`${prefix}.violations.${code}=${count}`);
  }

  for (const [classification, count] of Object.entries(group.terminations_by_classification)) {
    lines.push(`${prefix}.terminations.${classification}=${count}`);
  }

  return lines;
}

function turnFinishReason(turn: E1NoProviderCheckpointBundle["turn_records"][number]): string | undefined {
  const body = turn.provider_exchange?.redacted_response?.body as
    | { choices?: Array<{ finish_reason?: unknown }> }
    | undefined;
  const reason = body?.choices?.[0]?.finish_reason;

  return typeof reason === "string" ? reason : undefined;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : round(numerator / denominator);
}

function mean(values: number[]): number | null {
  return values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function formatNumber(value: number | null): string {
  return value === null ? "n/a" : String(value);
}
