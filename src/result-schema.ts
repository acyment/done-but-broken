import { CONDITION_IDS, type ConditionId } from "./conditions";
import type { CheckpointId } from "./task-model";

export const RESULT_SCHEMA_VERSION = "result-schema-v1";

export type OracleCheckResult = {
  check_id: string;
  commitment_id: string;
  passed: boolean;
  details?: string;
};

export type CheckpointEvaluation = {
  condition_id: ConditionId;
  checkpoint_id: CheckpointId;
  checks: OracleCheckResult[];
};

export type ConditionMetricSummary = {
  final_checkpoint_passed: number;
  final_checkpoint_total: number;
  pass_rate: number;
  regression_count: number;
};

export type CheckpointMetricSummary = {
  checkpoint_id: CheckpointId;
  passed: number;
  total: number;
  pass_rate: number;
  regression_free_success: boolean;
};

export type PrimaryMetric = {
  name: "final_checkpoint_pass_rate";
  checkpoint_id: CheckpointId;
  by_condition: Record<ConditionId, ConditionMetricSummary>;
  delta_feedback_minus_context: number;
};

export type RegressionFreeAucMetric = {
  name: "regression_free_auc";
  by_condition: Record<ConditionId, number>;
  delta_feedback_minus_context: number;
};

export type RunResultRecord = {
  schema_version: typeof RESULT_SCHEMA_VERSION;
  run_id: string;
  task_id: string;
  checkpoints: CheckpointId[];
  primary_metric: PrimaryMetric;
  condition_summaries: Record<ConditionId, ConditionMetricSummary>;
  checkpoint_metrics: Record<ConditionId, CheckpointMetricSummary[]>;
  regression_free_auc: RegressionFreeAucMetric;
  evaluations: CheckpointEvaluation[];
};

export function buildRunResultRecord(input: {
  run_id: string;
  task_id: string;
  checkpoints: CheckpointId[];
  evaluations: CheckpointEvaluation[];
}): RunResultRecord {
  const primary_metric = calculatePrimaryMetric({
    checkpoints: input.checkpoints,
    evaluations: input.evaluations
  });
  const checkpoint_metrics = calculateCheckpointMetrics({
    checkpoints: input.checkpoints,
    evaluations: input.evaluations
  });

  return {
    schema_version: RESULT_SCHEMA_VERSION,
    run_id: input.run_id,
    task_id: input.task_id,
    checkpoints: input.checkpoints,
    primary_metric,
    condition_summaries: primary_metric.by_condition,
    checkpoint_metrics,
    regression_free_auc: calculateRegressionFreeAucFromCheckpointMetrics(checkpoint_metrics),
    evaluations: input.evaluations
  };
}

export function calculatePrimaryMetric(input: {
  checkpoints: CheckpointId[];
  evaluations: CheckpointEvaluation[];
}): PrimaryMetric {
  const finalCheckpoint = input.checkpoints.at(-1);

  if (!finalCheckpoint) {
    throw new Error("At least one checkpoint is required to calculate the primary metric");
  }

  const by_condition = Object.fromEntries(
    CONDITION_IDS.map((condition_id) => [
      condition_id,
      summarizeCondition({
        condition_id,
        final_checkpoint: finalCheckpoint,
        checkpoint_order: input.checkpoints,
        evaluations: input.evaluations.filter((evaluation) => evaluation.condition_id === condition_id)
      })
    ])
  ) as Record<ConditionId, ConditionMetricSummary>;

  return {
    name: "final_checkpoint_pass_rate",
    checkpoint_id: finalCheckpoint,
    by_condition,
    delta_feedback_minus_context:
      by_condition.feedback_capable_spec.pass_rate - by_condition.context_only_spec.pass_rate
  };
}

export function validateRunResultRecord(record: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const candidate = record as Partial<RunResultRecord>;

  if (!candidate || typeof candidate !== "object") {
    return { ok: false, errors: ["record must be an object"] };
  }

  if (candidate.schema_version !== RESULT_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${RESULT_SCHEMA_VERSION}`);
  }

  if (typeof candidate.run_id !== "string" || candidate.run_id.length === 0) {
    errors.push("run_id must be a non-empty string");
  }

  if (typeof candidate.task_id !== "string" || candidate.task_id.length === 0) {
    errors.push("task_id must be a non-empty string");
  }

  if (!Array.isArray(candidate.checkpoints) || candidate.checkpoints.length === 0) {
    errors.push("checkpoints must be a non-empty array");
  }

  assertPilotConditionRecord("condition_summaries", candidate.condition_summaries, errors);
  assertPilotConditionRecord("primary_metric.by_condition", candidate.primary_metric?.by_condition, errors);
  validateRegressionFreeAucShape(candidate.regression_free_auc, errors);

  if (candidate.checkpoint_metrics !== undefined) {
    assertPilotConditionRecord("checkpoint_metrics", candidate.checkpoint_metrics, errors);
    errors.push(...validateCheckpointMetricShapes(candidate.checkpoint_metrics));
  }

  let hasMalformedEvaluations = false;

  if (!Array.isArray(candidate.evaluations)) {
    errors.push("evaluations must be an array");
  } else {
    if (Array.isArray(candidate.checkpoints)) {
      errors.push(
        ...validateEvaluationCoverage(
          candidate.checkpoints,
          candidate.evaluations as CheckpointEvaluation[]
        )
      );
    }

    for (const [index, evaluation] of (candidate.evaluations as Array<Partial<CheckpointEvaluation>>).entries()) {
      const shapeErrors = validateEvaluationShape(evaluation, index);
      errors.push(...shapeErrors);

      if (shapeErrors.length > 0) {
        hasMalformedEvaluations = true;
        continue;
      }

      if (!CONDITION_IDS.includes(evaluation.condition_id as ConditionId)) {
        errors.push(`unsupported evaluation condition_id: ${evaluation.condition_id}`);
      }

      errors.push(...validateCheckShapes(evaluation));
      errors.push(...validateUniqueCheckIds(evaluation));
      errors.push(...validateUniqueCommitmentIds(evaluation));
    }
  }

  if (
    Array.isArray(candidate.checkpoints) &&
    candidate.checkpoints.length > 0 &&
    Array.isArray(candidate.evaluations) &&
    !hasMalformedEvaluations &&
    candidate.primary_metric &&
    candidate.condition_summaries &&
    candidate.regression_free_auc
  ) {
    const expectedMetric = calculatePrimaryMetric({
      checkpoints: candidate.checkpoints,
      evaluations: candidate.evaluations as CheckpointEvaluation[]
    });
    const expectedRegressionFreeAuc = calculateRegressionFreeAuc({
      checkpoints: candidate.checkpoints,
      evaluations: candidate.evaluations as CheckpointEvaluation[]
    });

    if (!primaryMetricsEqual(candidate.primary_metric as PrimaryMetric, expectedMetric)) {
      errors.push("primary_metric does not match evaluations");
    }

    if (
      !conditionSummariesEqual(
        candidate.condition_summaries as Record<ConditionId, ConditionMetricSummary>,
        expectedMetric.by_condition
      )
    ) {
      errors.push("condition_summaries do not match evaluations");
    }

    if (candidate.checkpoint_metrics !== undefined) {
      const expectedCheckpointMetrics = calculateCheckpointMetrics({
        checkpoints: candidate.checkpoints,
        evaluations: candidate.evaluations as CheckpointEvaluation[]
      });

      if (
        !checkpointMetricsEqual(
          candidate.checkpoint_metrics as Record<ConditionId, CheckpointMetricSummary[]>,
          expectedCheckpointMetrics
        )
      ) {
        errors.push("checkpoint_metrics do not match evaluations");
      }
    }

    if (
      !regressionFreeAucMetricsEqual(
        candidate.regression_free_auc as RegressionFreeAucMetric,
        expectedRegressionFreeAuc
      )
    ) {
      errors.push("regression_free_auc does not match evaluations");
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function calculateCheckpointMetrics(input: {
  checkpoints: CheckpointId[];
  evaluations: CheckpointEvaluation[];
}): Record<ConditionId, CheckpointMetricSummary[]> {
  return Object.fromEntries(
    CONDITION_IDS.map((condition_id) => [
      condition_id,
      input.checkpoints.map((checkpoint_id) => {
        const evaluation = input.evaluations.find(
          (candidate) =>
            candidate.condition_id === condition_id && candidate.checkpoint_id === checkpoint_id
        );
        const checks = evaluation?.checks ?? [];
        const passed = checks.filter((check) => check.passed).length;
        const total = checks.length;

        return {
          checkpoint_id,
          passed,
          total,
          pass_rate: total === 0 ? 0 : passed / total,
          regression_free_success: total > 0 && passed === total
        };
      })
    ])
  ) as Record<ConditionId, CheckpointMetricSummary[]>;
}

export function calculateRegressionFreeAuc(input: {
  checkpoints: CheckpointId[];
  evaluations: CheckpointEvaluation[];
}): RegressionFreeAucMetric {
  return calculateRegressionFreeAucFromCheckpointMetrics(
    calculateCheckpointMetrics({
      checkpoints: input.checkpoints,
      evaluations: input.evaluations
    })
  );
}

function validateEvaluationShape(
  evaluation: Partial<CheckpointEvaluation>,
  index: number
): string[] {
  const errors: string[] = [];
  const field = `evaluation[${index}]`;

  if (!evaluation || typeof evaluation !== "object" || Array.isArray(evaluation)) {
    return [`${field} must be an object`];
  }

  if (typeof evaluation.condition_id !== "string" || evaluation.condition_id.length === 0) {
    errors.push(`condition_id must be a non-empty string for ${field}`);
  }

  if (typeof evaluation.checkpoint_id !== "string" || evaluation.checkpoint_id.length === 0) {
    errors.push(`checkpoint_id must be a non-empty string for ${field}`);
  }

  if (!Array.isArray(evaluation.checks)) {
    errors.push(`checks must be an array for ${field}`);
  } else if (evaluation.checks.length === 0) {
    errors.push(`checks must be a non-empty array for ${field}`);
  }

  return errors;
}

function summarizeCondition(input: {
  condition_id: ConditionId;
  final_checkpoint: CheckpointId;
  checkpoint_order: CheckpointId[];
  evaluations: CheckpointEvaluation[];
}): ConditionMetricSummary {
  const finalEvaluation = input.evaluations.find(
    (evaluation) => evaluation.checkpoint_id === input.final_checkpoint
  );
  const finalChecks = finalEvaluation?.checks ?? [];
  const finalPassed = finalChecks.filter((check) => check.passed).length;
  const finalTotal = finalChecks.length;
  const regressionCount = countRegressions(input.checkpoint_order, input.evaluations);

  return {
    final_checkpoint_passed: finalPassed,
    final_checkpoint_total: finalTotal,
    pass_rate: finalTotal === 0 ? 0 : finalPassed / finalTotal,
    regression_count: regressionCount
  };
}

function countRegressions(
  checkpointOrder: CheckpointId[],
  evaluations: CheckpointEvaluation[]
): number {
  const passedCommitments = new Set<string>();
  const regressedCommitments = new Set<string>();
  const evaluationsByCheckpoint = new Map(
    evaluations.map((evaluation) => [evaluation.checkpoint_id, evaluation])
  );

  for (const checkpoint of checkpointOrder) {
    const evaluation = evaluationsByCheckpoint.get(checkpoint);

    if (!evaluation) {
      continue;
    }

    for (const check of evaluation.checks) {
      if (check.passed) {
        passedCommitments.add(check.commitment_id);
        continue;
      }

      if (passedCommitments.has(check.commitment_id)) {
        regressedCommitments.add(check.commitment_id);
      }
    }
  }

  return regressedCommitments.size;
}

function assertPilotConditionRecord(
  field: string,
  value: unknown,
  errors: string[]
) {
  if (!value || typeof value !== "object") {
    errors.push(`${field} must be an object`);
    return;
  }

  const keys = Object.keys(value);

  for (const conditionId of CONDITION_IDS) {
    if (!keys.includes(conditionId)) {
      errors.push(`${field} missing ${conditionId}`);
    }
  }

  for (const key of keys) {
    if (!CONDITION_IDS.includes(key as ConditionId)) {
      errors.push(`${field} includes unsupported condition ${key}`);
    }
  }
}

function validateEvaluationCoverage(
  checkpoints: CheckpointId[],
  evaluations: CheckpointEvaluation[]
): string[] {
  const errors: string[] = [];
  const counts = new Map<string, number>();
  const knownCheckpoints = new Set(checkpoints);

  for (const evaluation of evaluations) {
    if (!evaluation || typeof evaluation !== "object") {
      continue;
    }

    if (
      typeof evaluation?.checkpoint_id === "string" &&
      evaluation.checkpoint_id.length > 0 &&
      !knownCheckpoints.has(evaluation.checkpoint_id)
    ) {
      errors.push(`Unknown evaluation checkpoint ${evaluation.checkpoint_id} for ${evaluation.condition_id}`);
    }

    const key = `${evaluation.condition_id}/${evaluation.checkpoint_id}`;

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (const conditionId of CONDITION_IDS) {
    for (const checkpoint of checkpoints) {
      const key = `${conditionId}/${checkpoint}`;
      const count = counts.get(key) ?? 0;

      if (count === 0) {
        errors.push(`Missing evaluation for ${key}`);
      } else if (count > 1) {
        errors.push(`Duplicate evaluation for ${key}`);
      }
    }
  }

  return errors;
}

function validateCheckShapes(evaluation: Partial<CheckpointEvaluation>): string[] {
  const errors: string[] = [];
  const scope = `${evaluation.condition_id}/${evaluation.checkpoint_id}`;

  if (!Array.isArray(evaluation.checks)) {
    errors.push(`checks must be an array for ${scope}`);
    return errors;
  }

  for (const check of evaluation.checks as Array<Partial<OracleCheckResult>>) {
    const checkId =
      typeof check?.check_id === "string" && check.check_id.length > 0
        ? check.check_id
        : "unknown-check";

    if (typeof check?.check_id !== "string" || check.check_id.length === 0) {
      errors.push(`check_id must be a non-empty string for ${scope}`);
    }

    if (typeof check?.commitment_id !== "string" || check.commitment_id.length === 0) {
      errors.push(`commitment_id must be a non-empty string for ${scope}/${checkId}`);
    }

    if (typeof check?.passed !== "boolean") {
      errors.push(`passed must be a boolean for ${scope}/${checkId}`);
    }
  }

  return errors;
}

function validateCheckpointMetricShapes(value: unknown): string[] {
  const errors: string[] = [];

  if (!value || typeof value !== "object") {
    return errors;
  }

  for (const conditionId of CONDITION_IDS) {
    const metrics = (value as Record<string, unknown>)[conditionId];

    if (!Array.isArray(metrics)) {
      errors.push(`checkpoint_metrics.${conditionId} must be an array`);
      continue;
    }

    for (const [index, metric] of metrics.entries()) {
      const scope = `checkpoint_metrics.${conditionId}[${index}]`;

      if (!metric || typeof metric !== "object" || Array.isArray(metric)) {
        errors.push(`${scope} must be an object`);
        continue;
      }

      const candidate = metric as Partial<CheckpointMetricSummary>;

      if (typeof candidate.checkpoint_id !== "string" || candidate.checkpoint_id.length === 0) {
        errors.push(`${scope}.checkpoint_id must be a non-empty string`);
      }

      if (typeof candidate.passed !== "number") {
        errors.push(`${scope}.passed must be a number`);
      }

      if (typeof candidate.total !== "number") {
        errors.push(`${scope}.total must be a number`);
      }

      if (typeof candidate.pass_rate !== "number") {
        errors.push(`${scope}.pass_rate must be a number`);
      }

      if (typeof candidate.regression_free_success !== "boolean") {
        errors.push(`${scope}.regression_free_success must be a boolean`);
      }
    }
  }

  return errors;
}

function validateRegressionFreeAucShape(value: unknown, errors: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push("regression_free_auc must be an object");
    return;
  }

  const candidate = value as Partial<RegressionFreeAucMetric>;

  if (candidate.name !== "regression_free_auc") {
    errors.push("regression_free_auc.name must be regression_free_auc");
  }

  assertPilotConditionRecord("regression_free_auc.by_condition", candidate.by_condition, errors);

  for (const conditionId of CONDITION_IDS) {
    if (typeof candidate.by_condition?.[conditionId] !== "number") {
      errors.push(`regression_free_auc.by_condition.${conditionId} must be a number`);
    }
  }

  if (typeof candidate.delta_feedback_minus_context !== "number") {
    errors.push("regression_free_auc.delta_feedback_minus_context must be a number");
  }
}

function validateUniqueCheckIds(evaluation: Partial<CheckpointEvaluation>): string[] {
  const seen = new Set<string>();
  const errors: string[] = [];

  for (const check of evaluation.checks ?? []) {
    if (typeof check.check_id !== "string" || check.check_id.length === 0) {
      continue;
    }

    if (seen.has(check.check_id)) {
      errors.push(
        `Duplicate check_id ${check.check_id} for ${evaluation.condition_id}/${evaluation.checkpoint_id}`
      );
      continue;
    }

    seen.add(check.check_id);
  }

  return errors;
}

function validateUniqueCommitmentIds(evaluation: Partial<CheckpointEvaluation>): string[] {
  const seen = new Set<string>();
  const errors: string[] = [];

  for (const check of evaluation.checks ?? []) {
    if (typeof check.commitment_id !== "string" || check.commitment_id.length === 0) {
      continue;
    }

    if (seen.has(check.commitment_id)) {
      errors.push(
        `Duplicate commitment_id ${check.commitment_id} for ${evaluation.condition_id}/${evaluation.checkpoint_id}`
      );
      continue;
    }

    seen.add(check.commitment_id);
  }

  return errors;
}

function primaryMetricsEqual(left: PrimaryMetric, right: PrimaryMetric): boolean {
  return (
    left.name === right.name &&
    left.checkpoint_id === right.checkpoint_id &&
    nearlyEqual(left.delta_feedback_minus_context, right.delta_feedback_minus_context) &&
    conditionSummariesEqual(left.by_condition, right.by_condition)
  );
}

function regressionFreeAucMetricsEqual(
  left: RegressionFreeAucMetric,
  right: RegressionFreeAucMetric
): boolean {
  return (
    left.name === right.name &&
    CONDITION_IDS.every((conditionId) =>
      nearlyEqual(left.by_condition?.[conditionId], right.by_condition[conditionId])
    ) &&
    nearlyEqual(left.delta_feedback_minus_context, right.delta_feedback_minus_context)
  );
}

function conditionSummariesEqual(
  left: Record<ConditionId, ConditionMetricSummary>,
  right: Record<ConditionId, ConditionMetricSummary>
): boolean {
  return CONDITION_IDS.every((conditionId) =>
    conditionSummaryEqual(left[conditionId], right[conditionId])
  );
}

function conditionSummaryEqual(
  left: ConditionMetricSummary | undefined,
  right: ConditionMetricSummary | undefined
): boolean {
  return Boolean(
    left &&
      right &&
      left.final_checkpoint_passed === right.final_checkpoint_passed &&
      left.final_checkpoint_total === right.final_checkpoint_total &&
      nearlyEqual(left.pass_rate, right.pass_rate) &&
      left.regression_count === right.regression_count
  );
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 1e-12;
}

function checkpointMetricsEqual(
  left: Record<ConditionId, CheckpointMetricSummary[]>,
  right: Record<ConditionId, CheckpointMetricSummary[]>
): boolean {
  return CONDITION_IDS.every((conditionId) => {
    const leftMetrics = left[conditionId] ?? [];
    const rightMetrics = right[conditionId] ?? [];

    return (
      leftMetrics.length === rightMetrics.length &&
      leftMetrics.every((leftMetric, index) =>
        checkpointMetricEqual(leftMetric, rightMetrics[index])
      )
    );
  });
}

function checkpointMetricEqual(
  left: CheckpointMetricSummary | undefined,
  right: CheckpointMetricSummary | undefined
): boolean {
  return Boolean(
    left &&
      right &&
      left.checkpoint_id === right.checkpoint_id &&
      left.passed === right.passed &&
      left.total === right.total &&
      nearlyEqual(left.pass_rate, right.pass_rate) &&
      left.regression_free_success === right.regression_free_success
  );
}

function calculateRegressionFreeAucFromCheckpointMetrics(
  checkpointMetrics: Record<ConditionId, CheckpointMetricSummary[]>
): RegressionFreeAucMetric {
  const by_condition = Object.fromEntries(
    CONDITION_IDS.map((conditionId) => {
      const metrics = checkpointMetrics[conditionId] ?? [];
      const score =
        metrics.length === 0
          ? 0
          : metrics.filter((metric) => metric.regression_free_success).length / metrics.length;

      return [conditionId, score];
    })
  ) as Record<ConditionId, number>;

  return {
    name: "regression_free_auc",
    by_condition,
    delta_feedback_minus_context:
      by_condition.feedback_capable_spec - by_condition.context_only_spec
  };
}
