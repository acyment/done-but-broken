import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { CONDITION_IDS } from "./conditions";
import type { EvidenceStatusSummary } from "./evidence-status";
import type { RunResultRecord } from "./result-schema";

export function renderResultSummary(
  result: RunResultRecord,
  evidenceStatus?: EvidenceStatusSummary
): string {
  const metric = result.primary_metric;
  const lines = [
    `# Run summary: ${result.run_id}`,
    "",
    `- Task: ${result.task_id}`,
    `- Schema: ${result.schema_version}`,
    `- Primary metric: ${metric.name} at ${metric.checkpoint_id}`,
    `- Feedback minus context delta: ${formatNumber(metric.delta_feedback_minus_context)}`,
    `- Regression-free AUC delta: ${formatNumber(result.regression_free_auc.delta_feedback_minus_context)}`,
    "",
    "| Condition | Final passed | Pass rate | Regressions |",
    "| --- | ---: | ---: | ---: |"
  ];

  for (const conditionId of CONDITION_IDS) {
    const summary = result.condition_summaries[conditionId];

    lines.push(
      `| ${conditionId} | ${summary.final_checkpoint_passed}/${summary.final_checkpoint_total} | ${formatNumber(summary.pass_rate)} | ${summary.regression_count} |`
    );
  }

  if (result.checkpoint_metrics) {
    lines.push(
      "",
      "Checkpoint regression-free success:",
      "",
      `| Condition | ${result.checkpoints.join(" | ")} |`,
      `| --- | ${result.checkpoints.map(() => "---:").join(" | ")} |`
    );

    for (const conditionId of CONDITION_IDS) {
      const metrics = result.checkpoint_metrics[conditionId] ?? [];

      lines.push(
        `| ${conditionId} | ${metrics.map(formatCheckpointMetric).join(" | ")} |`
      );
    }
  }

  if (evidenceStatus) {
    lines.push(
      "",
      "Evidence status:",
      "",
      `- Run classification: ${evidenceStatus.run_classification}`,
      `- Clean primary evidence eligible: ${formatBoolean(evidenceStatus.clean_primary_evidence_eligible)}`,
      `- Validity flags: ${formatList(evidenceStatus.validity_flags)}`,
      `- Provider profile: ${evidenceStatus.provider_profile_id ?? "unknown"}`,
      `- Provider timeout phases: ${formatList(evidenceStatus.provider_timeout_phases)}`,
      `- Provider timeout detail count: ${evidenceStatus.provider_timeout_detail_count}`,
      `- Provider carry-forward checkpoints: ${evidenceStatus.workspace_carried_forward_due_to_provider_failure_checkpoints}`,
      `- Feedback opportunity integrity: ${formatFeedbackOpportunity(evidenceStatus)}`
    );
  }

  return `${lines.join("\n")}\n`;
}

export async function writeResultSummary(input: {
  output_path: string;
  result: RunResultRecord;
  evidence_status?: EvidenceStatusSummary;
}): Promise<void> {
  await mkdir(dirname(input.output_path), { recursive: true });
  await writeFile(input.output_path, renderResultSummary(input.result, input.evidence_status));
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function formatCheckpointMetric(metric: {
  passed: number;
  total: number;
  regression_free_success: boolean;
}): string {
  return `${metric.regression_free_success ? "yes" : "no"} (${metric.passed}/${metric.total})`;
}

function formatBoolean(value: boolean): string {
  return value ? "yes" : "no";
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function formatFeedbackOpportunity(evidenceStatus: EvidenceStatusSummary): string {
  const feedback = evidenceStatus.feedback_opportunity_integrity;
  const base = `${feedback.status} (${feedback.complete_checkpoints}/${feedback.required_checkpoints})`;

  if (feedback.incomplete_checkpoints.length === 0) {
    return base;
  }

  return `${base}; incomplete: ${feedback.incomplete_checkpoints.join(", ")}`;
}
