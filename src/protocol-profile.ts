import type { RunResultRecord } from "./result-schema";

export const FINAL_CHECKPOINT_PRIMARY_PROTOCOL_PROFILE_ID = "final-checkpoint-primary-v1";
export const PATH_SURVIVAL_PRIMARY_PROTOCOL_PROFILE_ID = "path-survival-primary-v1";

export const PROTOCOL_PROFILE_IDS = [
  FINAL_CHECKPOINT_PRIMARY_PROTOCOL_PROFILE_ID,
  PATH_SURVIVAL_PRIMARY_PROTOCOL_PROFILE_ID
] as const;

export type ProtocolProfileId = (typeof PROTOCOL_PROFILE_IDS)[number];

export function isProtocolProfileId(value: unknown): value is ProtocolProfileId {
  return typeof value === "string" && PROTOCOL_PROFILE_IDS.includes(value as ProtocolProfileId);
}

export function defaultProtocolProfileId(): ProtocolProfileId {
  return FINAL_CHECKPOINT_PRIMARY_PROTOCOL_PROFILE_ID;
}

export function protocolProfileIdOrDefault(value: unknown): ProtocolProfileId {
  return isProtocolProfileId(value) ? value : defaultProtocolProfileId();
}

export function protocolPrimaryMetricName(protocolProfileId: ProtocolProfileId): string {
  if (protocolProfileId === PATH_SURVIVAL_PRIMARY_PROTOCOL_PROFILE_ID) {
    return "regression_free_auc_delta";
  }

  return "final_checkpoint_pass_rate_delta";
}

export function protocolPrimaryDelta(
  result: RunResultRecord,
  protocolProfileId: ProtocolProfileId
): number {
  if (protocolProfileId === PATH_SURVIVAL_PRIMARY_PROTOCOL_PROFILE_ID) {
    return result.regression_free_auc.delta_feedback_minus_context;
  }

  return result.primary_metric.delta_feedback_minus_context;
}

export function protocolSecondaryDeltaLabel(protocolProfileId: ProtocolProfileId): string {
  if (protocolProfileId === PATH_SURVIVAL_PRIMARY_PROTOCOL_PROFILE_ID) {
    return "Secondary final checkpoint pass-rate delta";
  }

  return "Secondary regression-free AUC delta";
}

export function protocolSecondaryDelta(
  result: RunResultRecord,
  protocolProfileId: ProtocolProfileId
): number {
  if (protocolProfileId === PATH_SURVIVAL_PRIMARY_PROTOCOL_PROFILE_ID) {
    return result.primary_metric.delta_feedback_minus_context;
  }

  return result.regression_free_auc.delta_feedback_minus_context;
}

