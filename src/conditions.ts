export const CONDITION_IDS = ["context_only_spec", "feedback_capable_spec"] as const;

export type ConditionId = (typeof CONDITION_IDS)[number];

const CONDITION_ID_SET = new Set<string>(CONDITION_IDS);

export function isConditionId(value: string): value is ConditionId {
  return CONDITION_ID_SET.has(value);
}

export function assertConditionId(value: string): ConditionId {
  if (!isConditionId(value)) {
    throw new Error(`Unknown condition ID: ${value}`);
  }

  return value;
}
