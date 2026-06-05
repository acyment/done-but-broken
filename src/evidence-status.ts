import { readFile } from "node:fs/promises";

export type CheckpointFeedbackOpportunityIntegrity = {
  required: boolean;
  turn_1_completed: boolean;
  feedback_ran: boolean;
  feedback_summary_delivered: boolean;
  turn_2_completed_after_feedback: boolean;
  complete: boolean;
};

export type FeedbackOpportunityStatus = {
  status: "not_applicable" | "complete" | "incomplete";
  complete_checkpoints: number;
  required_checkpoints: number;
  incomplete_checkpoints: string[];
};

export type EvidenceStatusSummary = {
  run_classification: string;
  clean_primary_evidence_eligible: boolean;
  validity_flags: string[];
  provider_profile_id?: string;
  provider_timeout_phases: string[];
  provider_timeout_detail_count: number;
  workspace_carried_forward_due_to_provider_failure_checkpoints: number;
  feedback_opportunity_integrity: FeedbackOpportunityStatus;
};

export async function buildEvidenceStatusSummary(manifest: any): Promise<EvidenceStatusSummary> {
  const validityDetails = Array.isArray(manifest?.validity_details) ? manifest.validity_details : [];
  const validityFlags = Array.isArray(manifest?.validity_flags)
    ? manifest.validity_flags.filter((flag: unknown): flag is string => typeof flag === "string")
    : [];

  return {
    run_classification: typeof manifest?.run_classification === "string" ? manifest.run_classification : "unknown",
    clean_primary_evidence_eligible: manifest?.clean_primary_evidence_eligible === true,
    validity_flags: validityFlags,
    provider_profile_id:
      typeof manifest?.provider_execution_profile?.provider_profile_id === "string"
        ? manifest.provider_execution_profile.provider_profile_id
        : undefined,
    provider_timeout_phases: uniqueStrings(
      validityDetails
        .filter((detail: any) => detail?.flag === "provider_timeout")
        .map((detail: any) => detail?.provider_failure_phase)
    ),
    provider_timeout_detail_count: validityDetails.filter((detail: any) => detail?.flag === "provider_timeout").length,
    workspace_carried_forward_due_to_provider_failure_checkpoints: countProviderCarryForwardCheckpoints(manifest),
    feedback_opportunity_integrity: await buildFeedbackOpportunityStatus(manifest)
  };
}

export function buildCheckpointFeedbackOpportunityIntegrity(input: {
  required: boolean;
  agent_result: any;
}): CheckpointFeedbackOpportunityIntegrity {
  const turn1Completed = Number.isInteger(input.agent_result?.model_turns)
    ? input.agent_result.model_turns >= 1
    : hasTranscriptEvent(input.agent_result?.transcript, "model_turn");
  const feedbackRan = Number.isInteger(input.agent_result?.feedback_runs)
    ? input.agent_result.feedback_runs >= 1
    : hasTranscriptEvent(input.agent_result?.transcript, "feedback_run");
  const feedbackSummaryDelivered =
    Array.isArray(input.agent_result?.feedback_summaries) && input.agent_result.feedback_summaries.length > 0;
  const turn2CompletedAfterFeedback = hasFeedbackOpportunityTranscriptSequence(input.agent_result?.transcript);

  return {
    required: input.required,
    turn_1_completed: turn1Completed,
    feedback_ran: feedbackRan,
    feedback_summary_delivered: feedbackSummaryDelivered,
    turn_2_completed_after_feedback: turn2CompletedAfterFeedback,
    complete:
      !input.required ||
      (turn1Completed && feedbackRan && feedbackSummaryDelivered && turn2CompletedAfterFeedback)
  };
}

async function buildFeedbackOpportunityStatus(manifest: any): Promise<FeedbackOpportunityStatus> {
  if (manifest?.run_classification !== "causal_pilot") {
    return emptyFeedbackOpportunityStatus("not_applicable");
  }

  const feedbackCondition = manifest?.condition_results?.feedback_capable_spec;
  const checkpoints = Array.isArray(feedbackCondition?.checkpoints) ? feedbackCondition.checkpoints : [];
  const requiredCheckpoints = checkpoints.filter((checkpoint: any) =>
    checkpointRequiresFeedbackOpportunity(checkpoint)
  );

  if (requiredCheckpoints.length === 0) {
    return emptyFeedbackOpportunityStatus("not_applicable");
  }

  let complete = 0;
  const incomplete: string[] = [];

  for (const checkpoint of requiredCheckpoints) {
    const agentResult = await readAgentResult(checkpoint?.artifact_dir);
    const integrity =
      checkpoint?.feedback_opportunity_integrity ??
      buildCheckpointFeedbackOpportunityIntegrity({
        required: true,
        agent_result: agentResult
      });

    if (integrity.complete === true) {
      complete += 1;
    } else if (typeof checkpoint?.checkpoint_id === "string") {
      incomplete.push(checkpoint.checkpoint_id);
    } else {
      incomplete.push("unknown");
    }
  }

  return {
    status: complete === requiredCheckpoints.length ? "complete" : "incomplete",
    complete_checkpoints: complete,
    required_checkpoints: requiredCheckpoints.length,
    incomplete_checkpoints: incomplete
  };
}

async function readAgentResult(artifactDir: unknown) {
  if (typeof artifactDir !== "string") {
    return undefined;
  }

  try {
    return JSON.parse(await readFile(`${artifactDir}/agent-result.json`, "utf8"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    if (error instanceof SyntaxError) {
      return undefined;
    }

    throw error;
  }
}

function checkpointRequiresFeedbackOpportunity(checkpoint: any): boolean {
  return Object.keys(checkpoint?.expected_feedback_asset_hashes ?? {}).length > 0;
}

function countProviderCarryForwardCheckpoints(manifest: any): number {
  const conditionResults = manifest?.condition_results;

  if (!conditionResults || typeof conditionResults !== "object") {
    return 0;
  }

  let count = 0;

  for (const conditionResult of Object.values(conditionResults) as any[]) {
    const checkpoints = Array.isArray(conditionResult?.checkpoints) ? conditionResult.checkpoints : [];

    for (const checkpoint of checkpoints) {
      if (checkpoint?.workspace_carried_forward_due_to_provider_failure === true) {
        count += 1;
      }
    }
  }

  return count;
}

function hasTranscriptEvent(transcript: unknown, eventName: string): boolean {
  return transcriptEvents(transcript).includes(eventName);
}

function hasFeedbackOpportunityTranscriptSequence(transcript: unknown): boolean {
  const events = transcriptEvents(transcript);
  const firstModelTurn = events.indexOf("model_turn");

  if (firstModelTurn < 0) {
    return false;
  }

  const feedbackRun = events.indexOf("feedback_run", firstModelTurn + 1);

  if (feedbackRun < 0) {
    return false;
  }

  return events.indexOf("model_turn", feedbackRun + 1) >= 0;
}

function transcriptEvents(transcript: unknown): string[] {
  if (!Array.isArray(transcript)) {
    return [];
  }

  return transcript.map((event) =>
    event && typeof event === "object" && !Array.isArray(event)
      ? String((event as Record<string, unknown>).event)
      : ""
  );
}

function emptyFeedbackOpportunityStatus(status: "not_applicable"): FeedbackOpportunityStatus {
  return {
    status,
    complete_checkpoints: 0,
    required_checkpoints: 0,
    incomplete_checkpoints: []
  };
}

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
}
