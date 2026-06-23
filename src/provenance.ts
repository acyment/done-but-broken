import { readFile, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { CONDITION_IDS, type ConditionId } from "./conditions";
import { buildEvidenceStatusSummary, type CheckpointFeedbackOpportunityIntegrity } from "./evidence-status";
import {
  defaultProtocolProfileId,
  isProtocolProfileId,
  type ProtocolProfileId
} from "./protocol-profile";
import { renderSpecPacket, type RenderedSpecPacket } from "./renderer";
import { RESULT_SCHEMA_VERSION, validateRunResultRecord } from "./result-schema";
import { renderResultSummary } from "./result-summary";
import { hashDirectory, hashFile, hashText, hashWorkspaceCodeFiles } from "./snapshot";
import { defaultTaskVersion, type CheckpointId, type TaskDefinition } from "./task-model";

export const PROTOCOL_VERSION = "two-arm-feedback-spec-v0";
export const RENDERER_VERSION = "semantic-spec-renderer-v0";
export const TASK_SEAL_SCHEMA_VERSION = "task-seal-v0";
export const OPENROUTER_CHAT_REQUEST_PARAMETER_VERSION = "openrouter-chat-request-max-tokens-v1";
export const OPENROUTER_RETRY_POLICY_VERSION = "provider-retry-timeout-rate-malformed-v1";
export const MODEL_LOOP_POLICY_VERSION = "model-loop-feedback-continues-after-feedback-v1";

export const RUN_CLASSIFICATIONS = [
  "calibration",
  "difficulty_probe",
  "causal_pilot",
  "diagnostic_invalid"
] as const;

export const RUN_VALIDITY_FLAGS = [
  "provider_api_failure",
  "provider_timeout",
  "provider_quota_or_rate_limit",
  "provider_malformed_response",
  "provider_partial_run_interruption"
] as const;

export const RUN_VALIDITY_SCOPES = ["run", "condition", "checkpoint"] as const;
export const PROVIDER_FAILURE_PHASES = [
  "pre_model_action_timeout",
  "post_model_action_timeout",
  "feedback_execution_timeout",
  "feedback_summary_timeout",
  "repair_turn_timeout",
  "retry_recovered_timeout",
  "nonfatal_provider_warning"
] as const;

export type RunClassification = (typeof RUN_CLASSIFICATIONS)[number];
export type RunValidityFlag = (typeof RUN_VALIDITY_FLAGS)[number];
export type RunValidityScope = (typeof RUN_VALIDITY_SCOPES)[number];
export type ProviderFailurePhase = (typeof PROVIDER_FAILURE_PHASES)[number];

export type RunValidityDetail = {
  flag: RunValidityFlag;
  scope: RunValidityScope;
  condition_id?: ConditionId;
  checkpoint_id?: CheckpointId;
  provider?: string;
  message: string;
  retryable?: boolean;
  provider_failure_phase?: ProviderFailurePhase;
  model_turn_number?: number;
  feedback_had_run?: boolean;
  model_response_received?: boolean;
  code_changed?: boolean;
  workspace_carried_forward_due_to_provider_failure?: boolean;
  hidden_oracle_current_requirement_passed?: boolean;
  hidden_oracle_prior_requirements_passed?: boolean;
  retry_count?: number;
  elapsed_ms?: number;
};

export type RunBudget = {
  max_model_turns?: number;
  max_feedback_runs?: number;
  condition_concurrency?: number;
};

export type ModelProviderSettings = {
  provider?: string;
  model?: string;
  adapter_id?: string;
};

export type ProviderExecutionProfile = {
  provider_profile_id: string;
  model_id?: string;
  provider_route?: string;
  provider_endpoint?: string;
  response_parser_version?: string;
  request_parameter_version?: string;
  response_format_version?: string;
  provider_require_parameters?: boolean;
  retry_policy_version?: string;
  model_loop_policy_version?: string;
  per_call_timeout_ms: number;
  retry_policy: {
    max_retries: number;
    retryable_errors: string[];
  };
  max_output_tokens?: number;
  max_workspace_bytes?: number;
  max_feedback_output_bytes?: number;
  temperature?: number;
  prompt_renderer_version: string;
  feedback_summary_version: string;
};

export type ProviderProfileIdInput = {
  adapter_id: string;
  model_id?: string;
  provider_route?: string;
  response_parser_version?: string;
  request_parameter_version?: string;
  response_format_version?: string;
  provider_require_parameters?: boolean;
  retry_policy_version?: string;
  model_loop_policy_version?: string;
  per_call_timeout_ms: number;
  max_output_tokens?: number;
  max_workspace_bytes?: number;
  max_feedback_output_bytes?: number;
  temperature?: number;
  max_retries: number;
};

export type TaskSealManifest = {
  schema_version: typeof TASK_SEAL_SCHEMA_VERSION;
  task_id: string;
  task_version: string;
  checkpoints: CheckpointId[];
  public_api_contract?: string;
  template_workspace_hash: string;
  visible_spec_hashes: Record<CheckpointId, string>;
  feedback_asset_hashes: Record<string, string>;
  hidden_oracle_hash: string;
  task_package_hash?: string;
  canonical_spec_hash?: string;
};

export type RunCompatibilityProfile = {
  task_id: string;
  task_version: string;
  protocol_version: string;
  renderer_version: string;
  task_seal_hash: string;
  checkpoint_list_hash: string;
  visible_spec_hash: string;
  feedback_asset_hash: string;
  hidden_oracle_hash: string;
  budget_hash: string;
  model_provider_hash: string;
  provider_execution_profile_hash: string;
  protocol_profile_id: string;
  metric_definition_hash: string;
};

export type ArtifactMismatch = {
  path: string;
  expected: string;
  actual?: string;
  reason: "missing" | "hash_mismatch" | "schema_error";
};

export type CheckpointArtifactVerification = {
  ok: boolean;
  mismatches: ArtifactMismatch[];
};

export type RunArtifactVerification = {
  ok: boolean;
  mismatches: ArtifactMismatch[];
};

export type SchemaValidation = {
  ok: boolean;
  errors: string[];
};

export type ReplayStep = {
  condition_id: ConditionId;
  checkpoint_id: CheckpointId;
  artifact_dir: string;
  workspace_path: string;
  prompt_packet_hash: string;
  agent_result_hash: string;
  hidden_oracle_result_hash?: string;
  snapshot_before_hash: string;
  snapshot_after_hash: string;
  workspace_code_after_hash?: string;
};

export type ReplayPlan = {
  protocol_version: string;
  renderer_version: string;
  run_id: string;
  task_id: string;
  steps: ReplayStep[];
};

export function expectedFeedbackAssetHashes(packet: RenderedSpecPacket): Record<string, string> {
  return Object.fromEntries(
    packet.feedback_assets.map((asset) => [asset.relative_path, hashText(asset.content)])
  );
}

export async function buildTaskSealManifest(task: TaskDefinition): Promise<TaskSealManifest> {
  const taskVersion = task.task_version ?? defaultTaskVersion(task.task_id);
  const visibleSpecHashes = Object.fromEntries(
    task.checkpoints.map((checkpoint_id) => {
      const packet = renderSpecPacket({
        task,
        condition_id: "context_only_spec",
        checkpoint_id
      });

      return [checkpoint_id, hashText(packet.visible_spec_text)];
    })
  );
  const feedbackAssetHashes = Object.fromEntries(
    [...(task.executable_feedback_assets ?? [])]
      .toSorted((left, right) => left.relative_path.localeCompare(right.relative_path))
      .map((asset) => [asset.relative_path, hashText(asset.content)])
  );

  return {
    schema_version: TASK_SEAL_SCHEMA_VERSION,
    task_id: task.task_id,
    task_version: taskVersion,
    checkpoints: [...task.checkpoints],
    public_api_contract: task.public_api_contract,
    template_workspace_hash: (await hashDirectory(task.template_workspace)).hash,
    visible_spec_hashes: visibleSpecHashes,
    feedback_asset_hashes: feedbackAssetHashes,
    hidden_oracle_hash: await hashDirectoryOrMissing(task.hidden_oracle_path),
    task_package_hash: task.package_provenance?.task_package_hash,
    canonical_spec_hash: task.package_provenance?.canonical_spec_hash
  };
}

export function buildRunCompatibilityProfile(input: {
  task_seal: TaskSealManifest;
  task_seal_hash: string;
  budget: RunBudget;
  model_provider: ModelProviderSettings;
  provider_execution_profile: ProviderExecutionProfile;
  metric_version: string;
  protocol_profile_id?: ProtocolProfileId;
}): RunCompatibilityProfile {
  const protocolProfileId = input.protocol_profile_id ?? defaultProtocolProfileId();

  return {
    task_id: input.task_seal.task_id,
    task_version: input.task_seal.task_version,
    protocol_version: PROTOCOL_VERSION,
    renderer_version: RENDERER_VERSION,
    task_seal_hash: input.task_seal_hash,
    checkpoint_list_hash: hashStable(input.task_seal.checkpoints),
    visible_spec_hash: hashStable(input.task_seal.visible_spec_hashes),
    feedback_asset_hash: hashStable(input.task_seal.feedback_asset_hashes),
    hidden_oracle_hash: input.task_seal.hidden_oracle_hash,
    budget_hash: hashStable(input.budget),
    model_provider_hash: hashStable(input.model_provider),
    provider_execution_profile_hash: hashStable(input.provider_execution_profile),
    protocol_profile_id: protocolProfileId,
    metric_definition_hash: hashStable({
      metric_version: input.metric_version,
      protocol_profile_id: protocolProfileId
    })
  };
}

export function buildProviderProfileId(input: ProviderProfileIdInput): string {
  const parts = [`${sanitizeProfileIdPart(input.adapter_id)}-v1`];

  if (input.model_id) {
    parts.push(`model${sanitizeProfileIdPart(input.model_id)}`);
  }

  if (input.provider_route) {
    parts.push(`route${sanitizeProfileIdPart(input.provider_route)}`);
  }

  if (input.response_parser_version) {
    parts.push(`parser${sanitizeProfileIdPart(input.response_parser_version)}`);
  }

  if (input.request_parameter_version) {
    parts.push(`request${sanitizeProfileIdPart(input.request_parameter_version)}`);
  }

  if (input.response_format_version) {
    parts.push(`format${sanitizeProfileIdPart(input.response_format_version)}`);
  }

  if (input.provider_require_parameters !== undefined) {
    parts.push(`requireparams${input.provider_require_parameters ? 1 : 0}`);
  }

  if (input.retry_policy_version) {
    parts.push(`retrypolicy${sanitizeProfileIdPart(input.retry_policy_version)}`);
  }

  if (input.model_loop_policy_version) {
    parts.push(`looppolicy${sanitizeProfileIdPart(input.model_loop_policy_version)}`);
  }

  parts.push(`timeout${input.per_call_timeout_ms}`);

  if (input.max_output_tokens !== undefined) {
    parts.push(`output${input.max_output_tokens}`);
  }

  if (input.max_workspace_bytes !== undefined) {
    parts.push(`workspace${input.max_workspace_bytes}`);
  }

  if (input.max_feedback_output_bytes !== undefined) {
    parts.push(`feedback${input.max_feedback_output_bytes}`);
  }

  if (input.temperature !== undefined) {
    parts.push(`temp${input.temperature}`);
  }

  parts.push(`retry${input.max_retries}`);

  return parts.join("-");
}

export function validateTaskSealManifest(manifest: unknown): SchemaValidation {
  const errors: string[] = [];
  const candidate = manifest as Partial<TaskSealManifest>;

  if (!candidate || typeof candidate !== "object") {
    return { ok: false, errors: ["task seal manifest must be an object"] };
  }

  if (candidate.schema_version !== TASK_SEAL_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${TASK_SEAL_SCHEMA_VERSION}`);
  }

  requireString(candidate.task_id, "task_id", errors);
  requireString(candidate.task_version, "task_version", errors);
  requireStringArray(candidate.checkpoints, "checkpoints", errors);
  requireHash(candidate.template_workspace_hash, "template_workspace_hash", errors);
  requireHashRecord(candidate.visible_spec_hashes, "visible_spec_hashes", errors);
  requireHashRecord(candidate.feedback_asset_hashes, "feedback_asset_hashes", errors);
  requireHash(candidate.hidden_oracle_hash, "hidden_oracle_hash", errors);

  if (candidate.public_api_contract !== undefined) {
    requireString(candidate.public_api_contract, "public_api_contract", errors);
  }

  if (candidate.task_package_hash !== undefined) {
    requireHash(candidate.task_package_hash, "task_package_hash", errors);
  }

  if (candidate.canonical_spec_hash !== undefined) {
    requireHash(candidate.canonical_spec_hash, "canonical_spec_hash", errors);
  }

  return { ok: errors.length === 0, errors };
}

export function validateRunManifest(manifest: unknown): SchemaValidation {
  const errors: string[] = [];
  const candidate = manifest as any;

  if (!candidate || typeof candidate !== "object") {
    return { ok: false, errors: ["run manifest must be an object"] };
  }

  if (candidate.protocol_version !== PROTOCOL_VERSION) {
    errors.push(`protocol_version must be ${PROTOCOL_VERSION}`);
  }

  if (candidate.renderer_version !== RENDERER_VERSION) {
    errors.push(`renderer_version must be ${RENDERER_VERSION}`);
  }

  requireString(candidate.run_id, "run_id", errors);
  requireString(candidate.task_id, "task_id", errors);
  requireString(candidate.task_version, "task_version", errors);
  requireStringArray(candidate.checkpoints, "checkpoints", errors);
  validateRunClassification(candidate.run_classification, errors);
  validateValidityFlags(candidate.validity_flags, errors);
  validateValidityDetails(candidate.validity_details, candidate.validity_flags, errors);
  requireString(candidate.task_seal_path, "task_seal_path", errors);
  requireHash(candidate.task_seal_hash, "task_seal_hash", errors);
  validateRunBudget(candidate.budget, errors);
  validateCausalPilotBudget(candidate, errors);
  validateModelProviderSettings(candidate.model_provider, errors);
  validateProviderExecutionProfile(candidate.provider_execution_profile, errors);
  validateCleanPrimaryEvidenceEligibility(candidate.clean_primary_evidence_eligible, errors);
  requireStringArray(candidate.exclusion_rules, "exclusion_rules", errors);
  validateOptionalProtocolProfileId(candidate.protocol_profile_id, "protocol_profile_id", errors);
  requireString(candidate.metric_version, "metric_version", errors);
  validateCompatibilityProfile(candidate.compatibility, errors);
  if (
    candidate.protocol_profile_id !== undefined &&
    candidate.compatibility?.protocol_profile_id !== candidate.protocol_profile_id
  ) {
    errors.push("compatibility.protocol_profile_id must match protocol_profile_id");
  }

  if (!Array.isArray(candidate.conditions) || !sameStringArray(candidate.conditions, CONDITION_IDS)) {
    errors.push("conditions must exactly match the two pilot condition IDs");
  }

  if (!candidate.condition_results || typeof candidate.condition_results !== "object") {
    errors.push("condition_results must be an object");
  } else {
    for (const key of Object.keys(candidate.condition_results)) {
      if (!CONDITION_IDS.includes(key as ConditionId)) {
        errors.push(`condition_results includes unsupported condition ${key}`);
      }
    }

    for (const conditionId of CONDITION_IDS) {
      const conditionResult = candidate.condition_results[conditionId];

      if (!conditionResult) {
        errors.push(`condition_results missing ${conditionId}`);
        continue;
      }

      requireString(conditionResult.workspace_path, `condition_results.${conditionId}.workspace_path`, errors);

      if (!Array.isArray(conditionResult.checkpoints)) {
        errors.push(`condition_results.${conditionId}.checkpoints must be an array`);
      } else {
        const seenCheckpoints = new Set<string>();
        const checkpointIds = conditionResult.checkpoints
          .map((checkpoint: any) => checkpoint?.checkpoint_id)
          .filter((checkpointId: unknown) => typeof checkpointId === "string");

        for (const [index, checkpoint] of conditionResult.checkpoints.entries()) {
          errors.push(
            ...validateRunManifestCheckpoint(
              checkpoint,
              `condition_results.${conditionId}.checkpoints[${index}]`
            )
          );

          if (typeof checkpoint?.checkpoint_id !== "string" || checkpoint.checkpoint_id.length === 0) {
            continue;
          }

          if (seenCheckpoints.has(checkpoint.checkpoint_id)) {
            errors.push(`Duplicate checkpoint entry ${conditionId}/${checkpoint.checkpoint_id}`);
            continue;
          }

          seenCheckpoints.add(checkpoint.checkpoint_id);
        }

        if (
          Array.isArray(candidate.checkpoints) &&
          candidate.checkpoints.every((checkpointId: unknown) => typeof checkpointId === "string") &&
          !sameStringArray(checkpointIds, candidate.checkpoints)
        ) {
          errors.push(`Run manifest checkpoint sequence mismatch for ${conditionId}`);
        }
      }
    }
  }

  validateResultSummaryDeclarations(candidate, errors);

  return { ok: errors.length === 0, errors };
}

function validateRunClassification(value: unknown, errors: string[]) {
  if (!RUN_CLASSIFICATIONS.includes(value as RunClassification)) {
    errors.push("run_classification must be calibration, difficulty_probe, causal_pilot, or diagnostic_invalid");
  }
}

function validateValidityFlags(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push("validity_flags must be an array");
    return;
  }

  for (const flag of value) {
    if (!RUN_VALIDITY_FLAGS.includes(flag as RunValidityFlag)) {
      errors.push(`Unsupported validity flag ${String(flag)}`);
    }
  }
}

function validateValidityDetails(
  value: unknown,
  validityFlags: unknown,
  errors: string[]
) {
  const declaredFlags = new Set(
    Array.isArray(validityFlags)
      ? validityFlags.filter((flag): flag is RunValidityFlag =>
          RUN_VALIDITY_FLAGS.includes(flag as RunValidityFlag)
        )
      : []
  );
  const details = Array.isArray(value) ? value : [];
  const detailedFlags = new Set<RunValidityFlag>();

  if (!Array.isArray(value)) {
    errors.push("validity_details must be an array");
  }

  for (const [index, detail] of details.entries()) {
    const field = `validity_details[${index}]`;

    if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
      errors.push(`${field} must be an object`);
      continue;
    }

    const candidate = detail as Partial<RunValidityDetail>;

    if (!RUN_VALIDITY_FLAGS.includes(candidate.flag as RunValidityFlag)) {
      errors.push(`${field}.flag must be a supported validity flag`);
    } else {
      detailedFlags.add(candidate.flag as RunValidityFlag);

      if (!declaredFlags.has(candidate.flag as RunValidityFlag)) {
        errors.push(`validity_details flag ${candidate.flag} must be declared in validity_flags`);
      }
    }

    if (!RUN_VALIDITY_SCOPES.includes(candidate.scope as RunValidityScope)) {
      errors.push(`${field}.scope must be run, condition, or checkpoint`);
    }

    if (candidate.condition_id !== undefined && !CONDITION_IDS.includes(candidate.condition_id)) {
      errors.push(`${field}.condition_id must be one of the two pilot condition IDs when provided`);
    }

    validateOptionalNonEmptyString(candidate.checkpoint_id, `${field}.checkpoint_id`, errors);
    validateOptionalNonEmptyString(candidate.provider, `${field}.provider`, errors);
    requireString(candidate.message, `${field}.message`, errors);
    validateOptionalProviderFailurePhase(candidate.provider_failure_phase, `${field}.provider_failure_phase`, errors);
    validateOptionalPositiveInteger(candidate.model_turn_number, `${field}.model_turn_number`, errors);
    validateOptionalBooleanField(candidate.feedback_had_run, `${field}.feedback_had_run`, errors);
    validateOptionalBooleanField(candidate.model_response_received, `${field}.model_response_received`, errors);
    validateOptionalBooleanField(candidate.code_changed, `${field}.code_changed`, errors);
    validateOptionalBooleanField(
      candidate.workspace_carried_forward_due_to_provider_failure,
      `${field}.workspace_carried_forward_due_to_provider_failure`,
      errors
    );
    validateOptionalBooleanField(
      candidate.hidden_oracle_current_requirement_passed,
      `${field}.hidden_oracle_current_requirement_passed`,
      errors
    );
    validateOptionalBooleanField(
      candidate.hidden_oracle_prior_requirements_passed,
      `${field}.hidden_oracle_prior_requirements_passed`,
      errors
    );
    validateOptionalNonNegativeInteger(candidate.retry_count, `${field}.retry_count`, errors);
    validateOptionalNonNegativeInteger(candidate.elapsed_ms, `${field}.elapsed_ms`, errors);

    if (candidate.retryable !== undefined && typeof candidate.retryable !== "boolean") {
      errors.push(`${field}.retryable must be a boolean when provided`);
    }

    if (candidate.scope === "condition" && candidate.condition_id === undefined) {
      errors.push(`${field}.condition_id must be provided for condition-scoped validity details`);
    }

    if (candidate.scope === "checkpoint") {
      if (candidate.condition_id === undefined) {
        errors.push(`${field}.condition_id must be provided for checkpoint-scoped validity details`);
      }

      if (candidate.checkpoint_id === undefined) {
        errors.push(`${field}.checkpoint_id must be provided for checkpoint-scoped validity details`);
      }
    }

    if (candidate.flag === "provider_timeout") {
      if (candidate.provider_failure_phase === undefined) {
        errors.push(`${field}.provider_failure_phase must be provided for provider_timeout details`);
      }

      if (candidate.model_response_received === undefined) {
        errors.push(`${field}.model_response_received must be provided for provider_timeout details`);
      }

      if (candidate.workspace_carried_forward_due_to_provider_failure === undefined) {
        errors.push(`${field}.workspace_carried_forward_due_to_provider_failure must be provided for provider_timeout details`);
      }
    }
  }

  for (const flag of declaredFlags) {
    if (!detailedFlags.has(flag)) {
      errors.push(`validity_details must include detail for ${flag}`);
    }
  }
}

function validateProviderExecutionProfile(value: unknown, errors: string[]) {
  const profile = value as Partial<ProviderExecutionProfile>;

  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    errors.push("provider_execution_profile must be an object");
    return;
  }

  requireString(profile.provider_profile_id, "provider_execution_profile.provider_profile_id", errors);
  validateOptionalNonEmptyString(profile.model_id, "provider_execution_profile.model_id", errors);
  validateOptionalNonEmptyString(profile.provider_route, "provider_execution_profile.provider_route", errors);
  validateOptionalNonEmptyString(profile.provider_endpoint, "provider_execution_profile.provider_endpoint", errors);
  validateOptionalNonEmptyString(
    profile.response_parser_version,
    "provider_execution_profile.response_parser_version",
    errors
  );
  validateOptionalNonEmptyString(
    profile.request_parameter_version,
    "provider_execution_profile.request_parameter_version",
    errors
  );
  validateOptionalNonEmptyString(
    profile.response_format_version,
    "provider_execution_profile.response_format_version",
    errors
  );
  validateOptionalBooleanField(
    profile.provider_require_parameters,
    "provider_execution_profile.provider_require_parameters",
    errors
  );
  validateOptionalNonEmptyString(
    profile.retry_policy_version,
    "provider_execution_profile.retry_policy_version",
    errors
  );
  validateOptionalNonEmptyString(
    profile.model_loop_policy_version,
    "provider_execution_profile.model_loop_policy_version",
    errors
  );
  validateNonNegativeInteger(profile.per_call_timeout_ms, "provider_execution_profile.per_call_timeout_ms", errors);
  requireString(profile.prompt_renderer_version, "provider_execution_profile.prompt_renderer_version", errors);
  requireString(profile.feedback_summary_version, "provider_execution_profile.feedback_summary_version", errors);

  if (profile.max_output_tokens !== undefined) {
    validatePositiveInteger(profile.max_output_tokens, "provider_execution_profile.max_output_tokens", errors);
  }

  if (profile.max_workspace_bytes !== undefined) {
    validatePositiveInteger(profile.max_workspace_bytes, "provider_execution_profile.max_workspace_bytes", errors);
  }

  if (profile.max_feedback_output_bytes !== undefined) {
    validatePositiveInteger(profile.max_feedback_output_bytes, "provider_execution_profile.max_feedback_output_bytes", errors);
  }

  if (profile.temperature !== undefined && typeof profile.temperature !== "number") {
    errors.push("provider_execution_profile.temperature must be a number when provided");
  }

  if (!profile.retry_policy || typeof profile.retry_policy !== "object" || Array.isArray(profile.retry_policy)) {
    errors.push("provider_execution_profile.retry_policy must be an object");
    return;
  }

  validateNonNegativeInteger(
    profile.retry_policy.max_retries,
    "provider_execution_profile.retry_policy.max_retries",
    errors
  );
  requireStringArray(
    profile.retry_policy.retryable_errors,
    "provider_execution_profile.retry_policy.retryable_errors",
    errors
  );
}

function validateCleanPrimaryEvidenceEligibility(value: unknown, errors: string[]) {
  if (typeof value !== "boolean") {
    errors.push("clean_primary_evidence_eligible must be a boolean");
  }
}

function validateRunBudget(value: unknown, errors: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push("budget must be an object");
    return;
  }

  const budget = value as RunBudget;

  if (
    budget.max_model_turns !== undefined &&
    (!Number.isInteger(budget.max_model_turns) || budget.max_model_turns < 1)
  ) {
    errors.push("budget.max_model_turns must be a positive integer when provided");
  }

  if (
    budget.max_feedback_runs !== undefined &&
    (!Number.isInteger(budget.max_feedback_runs) || budget.max_feedback_runs < 0)
  ) {
    errors.push("budget.max_feedback_runs must be a non-negative integer when provided");
  }

  if (
    budget.condition_concurrency !== undefined &&
    (!Number.isInteger(budget.condition_concurrency) || budget.condition_concurrency < 1)
  ) {
    errors.push("budget.condition_concurrency must be a positive integer when provided");
  }
}

function validateCausalPilotBudget(candidate: any, errors: string[]) {
  if (candidate.run_classification !== "causal_pilot") {
    return;
  }

  const maxModelTurns = candidate.budget?.max_model_turns;

  if (!Number.isInteger(maxModelTurns) || maxModelTurns < 2) {
    errors.push("causal_pilot runs must declare budget.max_model_turns of at least 2");
  }
}

function validateModelProviderSettings(value: unknown, errors: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push("model_provider must be an object");
    return;
  }

  const settings = value as ModelProviderSettings;

  validateOptionalNonEmptyString(settings.provider, "model_provider.provider", errors);
  validateOptionalNonEmptyString(settings.model, "model_provider.model", errors);
  validateOptionalNonEmptyString(settings.adapter_id, "model_provider.adapter_id", errors);
}

function validateCompatibilityProfile(value: unknown, errors: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push("compatibility must be an object");
    return;
  }

  const compatibility = value as RunCompatibilityProfile;

  requireString(compatibility.task_id, "compatibility.task_id", errors);
  requireString(compatibility.task_version, "compatibility.task_version", errors);
  requireString(compatibility.protocol_version, "compatibility.protocol_version", errors);
  requireString(compatibility.renderer_version, "compatibility.renderer_version", errors);
  requireHash(compatibility.task_seal_hash, "compatibility.task_seal_hash", errors);
  requireHash(compatibility.checkpoint_list_hash, "compatibility.checkpoint_list_hash", errors);
  requireHash(compatibility.visible_spec_hash, "compatibility.visible_spec_hash", errors);
  requireHash(compatibility.feedback_asset_hash, "compatibility.feedback_asset_hash", errors);
  requireHash(compatibility.hidden_oracle_hash, "compatibility.hidden_oracle_hash", errors);
  requireHash(compatibility.budget_hash, "compatibility.budget_hash", errors);
  requireHash(compatibility.model_provider_hash, "compatibility.model_provider_hash", errors);
  requireHash(compatibility.provider_execution_profile_hash, "compatibility.provider_execution_profile_hash", errors);
  validateOptionalProtocolProfileId(
    compatibility.protocol_profile_id,
    "compatibility.protocol_profile_id",
    errors
  );
  requireHash(compatibility.metric_definition_hash, "compatibility.metric_definition_hash", errors);
}

export function validateRunCompatibilityForPooling(manifests: unknown[]): SchemaValidation {
  const errors: string[] = [];

  if (!Array.isArray(manifests) || manifests.length === 0) {
    return {
      ok: false,
      errors: ["at least one run manifest is required for pooling compatibility validation"]
    };
  }

  for (const [index, manifest] of manifests.entries()) {
    const validation = validateRunManifest(manifest);

    for (const error of validation.errors) {
      errors.push(`run[${index}]: ${error}`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const baseline = manifests[0] as any;
  const baselineCompatibility = baseline.compatibility as RunCompatibilityProfile;

  for (const manifest of manifests.slice(1) as any[]) {
    const compatibility = manifest.compatibility as RunCompatibilityProfile;
    const runId = typeof manifest.run_id === "string" ? manifest.run_id : "unknown";

    for (const field of COMPATIBILITY_FIELDS) {
      if (compatibility[field] !== baselineCompatibility[field]) {
        errors.push(`Incompatible run ${runId}: compatibility.${field} differs from ${baseline.run_id}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

const COMPATIBILITY_FIELDS = [
  "task_id",
  "task_version",
  "protocol_version",
  "renderer_version",
  "task_seal_hash",
  "checkpoint_list_hash",
  "visible_spec_hash",
  "feedback_asset_hash",
  "hidden_oracle_hash",
  "budget_hash",
  "model_provider_hash",
  "provider_execution_profile_hash",
  "protocol_profile_id",
  "metric_definition_hash"
] as const;

function validateResultSummaryDeclarations(candidate: any, errors: string[]) {
  const fields = [
    "result_record_path",
    "result_record_hash",
    "result_summary_path",
    "result_summary_hash"
  ] as const;
  const presentFields = fields.filter((field) => candidate[field] !== undefined);

  if (presentFields.length === 0) {
    return;
  }

  if (presentFields.length !== fields.length) {
    errors.push("result_record_path, result_record_hash, result_summary_path, and result_summary_hash must be declared together");
    return;
  }

  requireString(candidate.result_record_path, "result_record_path", errors);
  requireHash(candidate.result_record_hash, "result_record_hash", errors);
  requireString(candidate.result_summary_path, "result_summary_path", errors);
  requireHash(candidate.result_summary_hash, "result_summary_hash", errors);
}

function validateRunManifestCheckpoint(checkpoint: any, field: string): string[] {
  const errors: string[] = [];

  if (!checkpoint || typeof checkpoint !== "object" || Array.isArray(checkpoint)) {
    return [`${field} must be an object`];
  }

  requireString(checkpoint.checkpoint_id, `${field}.checkpoint_id`, errors);
  requireString(checkpoint.artifact_dir, `${field}.artifact_dir`, errors);
  requireHash(checkpoint.prompt_packet_hash, `${field}.prompt_packet_hash`, errors);
  requireHash(checkpoint.agent_result_hash, `${field}.agent_result_hash`, errors);
  requireHash(checkpoint.snapshot_before_hash, `${field}.snapshot_before_hash`, errors);
  requireHash(checkpoint.snapshot_after_hash, `${field}.snapshot_after_hash`, errors);
  if (checkpoint.workspace_code_after_hash !== undefined) {
    requireHash(checkpoint.workspace_code_after_hash, `${field}.workspace_code_after_hash`, errors);
  }
  requireHashRecord(
    checkpoint.expected_feedback_asset_hashes,
    `${field}.expected_feedback_asset_hashes`,
    errors
  );

  if (checkpoint.hidden_oracle_result_hash !== undefined) {
    requireHash(checkpoint.hidden_oracle_result_hash, `${field}.hidden_oracle_result_hash`, errors);
  }

  if (
    checkpoint.agent_status !== undefined &&
    checkpoint.agent_status !== "ok" &&
    checkpoint.agent_status !== "failed"
  ) {
    errors.push(`${field}.agent_status must be ok or failed when provided`);
  }

  if (
    checkpoint.workspace_carried_forward_due_to_provider_failure !== undefined &&
    typeof checkpoint.workspace_carried_forward_due_to_provider_failure !== "boolean"
  ) {
    errors.push(`${field}.workspace_carried_forward_due_to_provider_failure must be a boolean when provided`);
  }

  validateOptionalFeedbackOpportunityIntegrity(
    checkpoint.feedback_opportunity_integrity,
    `${field}.feedback_opportunity_integrity`,
    errors
  );
  validateOptionalCheckpointTiming(checkpoint.timing, `${field}.timing`, errors);

  return errors;
}

export function validateCheckpointManifest(manifest: unknown): SchemaValidation {
  const errors: string[] = [];
  const candidate = manifest as any;

  if (!candidate || typeof candidate !== "object") {
    return { ok: false, errors: ["checkpoint manifest must be an object"] };
  }

  if (candidate.protocol_version !== PROTOCOL_VERSION) {
    errors.push(`protocol_version must be ${PROTOCOL_VERSION}`);
  }

  if (candidate.renderer_version !== RENDERER_VERSION) {
    errors.push(`renderer_version must be ${RENDERER_VERSION}`);
  }

  if (!CONDITION_IDS.includes(candidate.condition_id)) {
    errors.push("condition_id must be one of the two pilot condition IDs");
  }

  requireString(candidate.checkpoint_id, "checkpoint_id", errors);
  requireString(candidate.artifact_dir, "artifact_dir", errors);
  requireString(candidate.workspace_path, "workspace_path", errors);
  requireHash(candidate.prompt_packet_hash, "prompt_packet_hash", errors);
  requireHash(candidate.agent_result_hash, "agent_result_hash", errors);
  requireHash(candidate.snapshot_before_hash, "snapshot_before_hash", errors);
  requireHash(candidate.snapshot_after_hash, "snapshot_after_hash", errors);
  requireString(candidate.snapshot_before_path, "snapshot_before_path", errors);
  requireString(candidate.snapshot_after_path, "snapshot_after_path", errors);
  requirePathUnderArtifactDir(candidate.snapshot_before_path, "snapshot_before_path", candidate.artifact_dir, errors);
  requirePathUnderArtifactDir(candidate.snapshot_after_path, "snapshot_after_path", candidate.artifact_dir, errors);
  validateWorkspaceCodeAfterDeclaration(candidate, errors);

  if (
    typeof candidate.snapshot_before_path === "string" &&
    typeof candidate.snapshot_after_path === "string" &&
    candidate.snapshot_before_path === candidate.snapshot_after_path
  ) {
    errors.push("snapshot_before_path and snapshot_after_path must be distinct");
  }

  requireHashRecord(candidate.expected_feedback_asset_hashes, "expected_feedback_asset_hashes", errors);

  validateHiddenOracleResultDeclaration(candidate, errors);

  if (candidate.agent_status !== "ok" && candidate.agent_status !== "failed") {
    errors.push("agent_status must be ok or failed");
  }

  if (
    candidate.workspace_carried_forward_due_to_provider_failure !== undefined &&
    typeof candidate.workspace_carried_forward_due_to_provider_failure !== "boolean"
  ) {
    errors.push("workspace_carried_forward_due_to_provider_failure must be a boolean when provided");
  }

  validateOptionalFeedbackOpportunityIntegrity(
    candidate.feedback_opportunity_integrity,
    "feedback_opportunity_integrity",
    errors
  );
  validateOptionalCheckpointTiming(candidate.timing, "timing", errors);

  return { ok: errors.length === 0, errors };
}

function validateHiddenOracleResultDeclaration(candidate: any, errors: string[]) {
  const hasPath = candidate.hidden_oracle_result_path !== undefined;
  const hasHash = candidate.hidden_oracle_result_hash !== undefined;

  if (hasPath) {
    requireString(candidate.hidden_oracle_result_path, "hidden_oracle_result_path", errors);
    requirePathUnderArtifactDir(
      candidate.hidden_oracle_result_path,
      "hidden_oracle_result_path",
      candidate.artifact_dir,
      errors
    );
  }

  if (hasHash) {
    requireHash(candidate.hidden_oracle_result_hash, "hidden_oracle_result_hash", errors);
  }

  if (hasHash && !hasPath) {
    errors.push("hidden_oracle_result_path must be a non-empty string when hidden_oracle_result_hash is present");
  }

  if (hasPath && !hasHash) {
    errors.push("hidden_oracle_result_hash must be a sha256 hex hash when hidden_oracle_result_path is present");
  }
}

function validateWorkspaceCodeAfterDeclaration(candidate: any, errors: string[]) {
  const hasPath = candidate.workspace_code_after_path !== undefined;
  const hasHash = candidate.workspace_code_after_hash !== undefined;

  if (hasPath) {
    requireString(candidate.workspace_code_after_path, "workspace_code_after_path", errors);
    requirePathUnderArtifactDir(
      candidate.workspace_code_after_path,
      "workspace_code_after_path",
      candidate.artifact_dir,
      errors
    );
  }

  if (hasHash) {
    requireHash(candidate.workspace_code_after_hash, "workspace_code_after_hash", errors);
  }

  if (hasHash && !hasPath) {
    errors.push("workspace_code_after_path must be a non-empty string when workspace_code_after_hash is present");
  }

  if (hasPath && !hasHash) {
    errors.push("workspace_code_after_hash must be a sha256 hex hash when workspace_code_after_path is present");
  }
}

export async function verifyCheckpointArtifacts(input: {
  artifact_dir: string;
  workspace_path: string;
  display_path_prefix?: string;
}): Promise<CheckpointArtifactVerification> {
  const manifest = JSON.parse(await readFile(join(input.artifact_dir, "manifest.json"), "utf8"));
  const mismatches: ArtifactMismatch[] = [];
  const manifestValidation = validateCheckpointManifest(manifest);

  if (!manifestValidation.ok) {
    for (const error of manifestValidation.errors) {
      mismatches.push({
        path: displayPath(input.display_path_prefix, "manifest.json"),
        expected: "valid checkpoint manifest",
        actual: error,
        reason: "schema_error"
      });
    }

    return {
      ok: false,
      mismatches
    };
  }

  await compareFileHash({
    path: "prompt-packet.json",
    absolute_path: join(input.artifact_dir, "prompt-packet.json"),
    expected: manifest.prompt_packet_hash,
    mismatches
  });

  if (manifest.agent_result_hash) {
    await compareFileHash({
      path: "agent-result.json",
      absolute_path: join(input.artifact_dir, "agent-result.json"),
      expected: manifest.agent_result_hash,
      mismatches
    });
    await compareAgentResultMetadata({
      absolute_path: join(input.artifact_dir, "agent-result.json"),
      expected_status: manifest.agent_status,
      mismatches
    });
  }

  await compareSnapshotRecordHash({
    path: "workspace-before.json/hash",
    absolute_path: manifest.snapshot_before_path,
    expected: manifest.snapshot_before_hash,
    mismatches
  });
  await compareSnapshotRecordHash({
    path: "workspace-after.json/hash",
    absolute_path: manifest.snapshot_after_path,
    expected: manifest.snapshot_after_hash,
    mismatches
  });
  if (manifest.workspace_code_after_hash) {
    await compareWorkspaceCodeSnapshotHash({
      path: "workspace-code-after.json/hash",
      absolute_path: manifest.workspace_code_after_path,
      expected: manifest.workspace_code_after_hash,
      mismatches
    });
  }

  if (manifest.hidden_oracle_result_hash) {
    const hiddenOracleResultPath = manifest.hidden_oracle_result_path;

    await compareFileHash({
      path: "hidden-oracle-result.json",
      absolute_path: hiddenOracleResultPath,
      expected: manifest.hidden_oracle_result_hash,
      mismatches
    });
    await compareHiddenOracleCheckFields({
      absolute_path: hiddenOracleResultPath,
      mismatches
    });
  }

  for (const [path, expected] of Object.entries(
    manifest.expected_feedback_asset_hashes as Record<string, string>
  )) {
    await compareFileHash({
      path,
      absolute_path: join(input.workspace_path, path),
      expected,
      mismatches
    });
  }

  return {
    ok: mismatches.length === 0,
    mismatches
  };
}

function displayPath(prefix: string | undefined, path: string): string {
  return prefix ? `${prefix}/${path}` : path;
}

async function compareAgentResultMetadata(input: {
  absolute_path: string;
  expected_status?: unknown;
  mismatches: ArtifactMismatch[];
}) {
  try {
    const agentResult = JSON.parse(await readFile(input.absolute_path, "utf8"));
    const statusIsValid = agentResult?.status === "ok" || agentResult?.status === "failed";

    if (!statusIsValid) {
      input.mismatches.push({
        path: "agent-result.json/status",
        expected: "ok|failed",
        actual: String(agentResult?.status),
        reason: "hash_mismatch"
      });
    }

    if (
      agentResult?.adapter_id !== undefined &&
      (typeof agentResult.adapter_id !== "string" || agentResult.adapter_id.length === 0)
    ) {
      input.mismatches.push({
        path: "agent-result.json/adapter_id",
        expected: "non-empty string when provided",
        actual: String(agentResult.adapter_id),
        reason: "hash_mismatch"
      });
    }

    if (agentResult?.notes !== undefined && typeof agentResult.notes !== "string") {
      input.mismatches.push({
        path: "agent-result.json/notes",
        expected: "string when provided",
        actual: String(agentResult.notes),
        reason: "hash_mismatch"
      });
    }

    if (agentResult?.transcript !== undefined) {
      if (!Array.isArray(agentResult.transcript)) {
        input.mismatches.push({
          path: "agent-result.json/transcript",
          expected: "array when provided",
          actual: typeof agentResult.transcript,
          reason: "hash_mismatch"
        });
      } else {
        for (const [index, event] of agentResult.transcript.entries()) {
          if (!event || typeof event !== "object" || Array.isArray(event)) {
            input.mismatches.push({
              path: `agent-result.json/transcript[${index}]`,
              expected: "object",
              actual: Array.isArray(event) ? "array" : typeof event,
              reason: "hash_mismatch"
            });
            continue;
          }

          if (typeof event.event !== "string" || event.event.length === 0) {
            input.mismatches.push({
              path: `agent-result.json/transcript[${index}].event`,
              expected: "non-empty string",
              actual: String(event.event),
              reason: "hash_mismatch"
            });
          }

          if (event.detail !== undefined && typeof event.detail !== "string") {
            input.mismatches.push({
              path: `agent-result.json/transcript[${index}].detail`,
              expected: "string when provided",
              actual: String(event.detail),
              reason: "hash_mismatch"
            });
          }
        }
      }
    }

    compareOptionalNonNegativeInteger(agentResult, "model_turns", input.mismatches);
    compareOptionalPositiveInteger(agentResult, "max_model_turns", input.mismatches);
    compareOptionalNonNegativeInteger(agentResult, "feedback_runs", input.mismatches);
    compareOptionalNonNegativeInteger(agentResult, "max_feedback_runs", input.mismatches);
    compareOptionalBoolean(agentResult, "feedback_available", input.mismatches);
    compareOptionalString(agentResult, "feedback_command", input.mismatches);
    compareOptionalStringArray(agentResult, "feedback_summaries", input.mismatches);
    compareOptionalStringArray(agentResult, "final_file_writes", input.mismatches);
    compareOptionalBoolean(agentResult, "feedback_assets_modified", input.mismatches);

    if (statusIsValid && input.expected_status !== undefined && agentResult.status !== input.expected_status) {
      input.mismatches.push({
        path: "agent-result.json/status",
        expected: String(input.expected_status),
        actual: String(agentResult?.status),
        reason: "hash_mismatch"
      });
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

function compareOptionalNonNegativeInteger(
  value: Record<string, unknown>,
  field: string,
  mismatches: ArtifactMismatch[]
) {
  const actual = value[field];

  if (actual === undefined) {
    return;
  }

  if (!Number.isInteger(actual) || (actual as number) < 0) {
    mismatches.push({
      path: `agent-result.json/${field}`,
      expected: "non-negative integer when provided",
      actual: String(actual),
      reason: "hash_mismatch"
    });
  }
}

function compareOptionalPositiveInteger(
  value: Record<string, unknown>,
  field: string,
  mismatches: ArtifactMismatch[]
) {
  const actual = value[field];

  if (actual === undefined) {
    return;
  }

  if (!Number.isInteger(actual) || (actual as number) < 1) {
    mismatches.push({
      path: `agent-result.json/${field}`,
      expected: "positive integer when provided",
      actual: String(actual),
      reason: "hash_mismatch"
    });
  }
}

function compareOptionalBoolean(
  value: Record<string, unknown>,
  field: string,
  mismatches: ArtifactMismatch[]
) {
  const actual = value[field];

  if (actual === undefined) {
    return;
  }

  if (typeof actual !== "boolean") {
    mismatches.push({
      path: `agent-result.json/${field}`,
      expected: "boolean when provided",
      actual: String(actual),
      reason: "hash_mismatch"
    });
  }
}

function compareOptionalString(
  value: Record<string, unknown>,
  field: string,
  mismatches: ArtifactMismatch[]
) {
  const actual = value[field];

  if (actual === undefined) {
    return;
  }

  if (typeof actual !== "string" || actual.length === 0) {
    mismatches.push({
      path: `agent-result.json/${field}`,
      expected: "non-empty string when provided",
      actual: String(actual),
      reason: "hash_mismatch"
    });
  }
}

function compareOptionalStringArray(
  value: Record<string, unknown>,
  field: string,
  mismatches: ArtifactMismatch[]
) {
  const actual = value[field];

  if (actual === undefined) {
    return;
  }

  if (!Array.isArray(actual)) {
    mismatches.push({
      path: `agent-result.json/${field}`,
      expected: "array when provided",
      actual: typeof actual,
      reason: "hash_mismatch"
    });
    return;
  }

  for (const [index, entry] of actual.entries()) {
    if (typeof entry !== "string") {
      mismatches.push({
        path: `agent-result.json/${field}[${index}]`,
        expected: "string",
        actual: String(entry),
        reason: "hash_mismatch"
      });
    }
  }
}

async function compareSnapshotRecordHash(input: {
  path: string;
  absolute_path: string;
  expected: string;
  mismatches: ArtifactMismatch[];
}) {
  try {
    const snapshot = JSON.parse(await readFile(input.absolute_path, "utf8"));

    if (snapshot?.hash !== input.expected) {
      input.mismatches.push({
        path: input.path,
        expected: input.expected,
        actual: String(snapshot?.hash),
        reason: "hash_mismatch"
      });
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

async function compareWorkspaceCodeSnapshotHash(input: {
  path: string;
  absolute_path: string;
  expected: string;
  mismatches: ArtifactMismatch[];
}) {
  try {
    const snapshot = JSON.parse(await readFile(input.absolute_path, "utf8"));
    const files = snapshot?.files;
    const embeddedHash = typeof snapshot?.hash === "string" ? snapshot.hash : undefined;

    if (!files || typeof files !== "object" || Array.isArray(files)) {
      input.mismatches.push({
        path: input.path,
        expected: "workspace code snapshot with files",
        actual: typeof files,
        reason: "schema_error"
      });
      return;
    }

    for (const [path, file] of Object.entries(files)) {
      if (!file || typeof file !== "object" || Array.isArray(file)) {
        input.mismatches.push({
          path: `workspace-code-after.json/files/${path}`,
          expected: "object",
          actual: Array.isArray(file) ? "array" : typeof file,
          reason: "schema_error"
        });
        return;
      }

      const candidate = file as { hash?: unknown; content?: unknown };
      if (typeof candidate.content !== "string") {
        input.mismatches.push({
          path: `workspace-code-after.json/files/${path}/content`,
          expected: "string",
          actual: typeof candidate.content,
          reason: "schema_error"
        });
        return;
      }

      if (candidate.hash !== hashText(candidate.content)) {
        input.mismatches.push({
          path: `workspace-code-after.json/files/${path}/hash`,
          expected: hashText(candidate.content),
          actual: String(candidate.hash),
          reason: "hash_mismatch"
        });
        return;
      }
    }

    const recomputedHash = hashWorkspaceCodeFiles(
      files as Record<string, { hash: string; content: string }>
    );

    if (embeddedHash !== input.expected || recomputedHash !== input.expected) {
      input.mismatches.push({
        path: input.path,
        expected: input.expected,
        actual: embeddedHash && embeddedHash !== input.expected ? embeddedHash : recomputedHash,
        reason: "hash_mismatch"
      });
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

async function compareHiddenOracleCheckFields(input: {
  absolute_path: string;
  mismatches: ArtifactMismatch[];
}) {
  try {
    const result = JSON.parse(await readFile(input.absolute_path, "utf8"));

    if (result?.status !== "ok" && result?.status !== "failed") {
      input.mismatches.push({
        path: "hidden-oracle-result.json/status",
        expected: "ok|failed",
        actual: String(result?.status),
        reason: "schema_error"
      });
    }

    if (result?.notes !== undefined && typeof result.notes !== "string") {
      input.mismatches.push({
        path: "hidden-oracle-result.json/notes",
        expected: "string when provided",
        actual: String(result.notes),
        reason: "schema_error"
      });
    }

    if (!Array.isArray(result?.checks)) {
      input.mismatches.push({
        path: "hidden-oracle-result.json/checks",
        expected: "array",
        actual: typeof result?.checks,
        reason: "schema_error"
      });
      return;
    }

    if (result.checks.length === 0) {
      input.mismatches.push({
        path: "hidden-oracle-result.json/checks",
        expected: "non-empty array",
        actual: "0",
        reason: "schema_error"
      });
      return;
    }

    let hasFailingCheck = false;

    for (const [index, check] of result.checks.entries()) {
      const checkId =
        typeof check?.check_id === "string" && check.check_id.length > 0
          ? check.check_id
          : `checks[${index}]`;

      if (typeof check?.check_id !== "string" || check.check_id.length === 0) {
        input.mismatches.push({
          path: `hidden-oracle-result.json/checks[${index}].check_id`,
          expected: "non-empty string",
          actual: String(check?.check_id),
          reason: "schema_error"
        });
      }

      if (typeof check?.commitment_id !== "string" || check.commitment_id.length === 0) {
        input.mismatches.push({
          path: `hidden-oracle-result.json/checks[${index}].commitment_id`,
          expected: "non-empty string",
          actual: String(check?.commitment_id),
          reason: "schema_error"
        });
      }

      if (typeof check?.passed !== "boolean") {
        input.mismatches.push({
          path: `hidden-oracle-result.json/${checkId}.passed`,
          expected: "boolean",
          actual: String(check?.passed),
          reason: "schema_error"
        });
      } else if (!check.passed) {
        hasFailingCheck = true;
      }

      if (check?.details !== undefined && typeof check.details !== "string") {
        input.mismatches.push({
          path: `hidden-oracle-result.json/${checkId}.details`,
          expected: "string when provided",
          actual: String(check.details),
          reason: "schema_error"
        });
      }
    }

    if (hasFailingCheck && result.status === "ok") {
      input.mismatches.push({
        path: "hidden-oracle-result.json/status",
        expected: "failed when any check fails",
        actual: "ok",
        reason: "schema_error"
      });
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

export async function loadReplayPlan(runManifestPath: string): Promise<ReplayPlan> {
  const manifest = JSON.parse(await readFile(runManifestPath, "utf8"));
  const steps: ReplayStep[] = [];

  for (const condition_id of manifest.conditions as ConditionId[]) {
    const conditionResult = manifest.condition_results[condition_id];

    for (const checkpoint of conditionResult.checkpoints) {
      steps.push({
        condition_id,
        checkpoint_id: checkpoint.checkpoint_id,
        artifact_dir: checkpoint.artifact_dir,
        workspace_path: conditionResult.workspace_path,
        prompt_packet_hash: checkpoint.prompt_packet_hash,
        agent_result_hash: checkpoint.agent_result_hash,
        hidden_oracle_result_hash: checkpoint.hidden_oracle_result_hash,
        snapshot_before_hash: checkpoint.snapshot_before_hash,
        snapshot_after_hash: checkpoint.snapshot_after_hash,
        workspace_code_after_hash: checkpoint.workspace_code_after_hash
      });
    }
  }

  return {
    protocol_version: manifest.protocol_version,
    renderer_version: manifest.renderer_version,
    run_id: manifest.run_id,
    task_id: manifest.task_id,
    steps
  };
}

export async function validateReplayPlan(runManifestPath: string): Promise<SchemaValidation> {
  const errors: string[] = [];
  const manifest = JSON.parse(await readFile(runManifestPath, "utf8"));
  const runValidation = validateRunManifest(manifest);

  errors.push(...runValidation.errors);

  if (!runValidation.ok) {
    return { ok: false, errors };
  }

  for (const condition_id of manifest.conditions as ConditionId[]) {
    const conditionResult = manifest.condition_results[condition_id];
    const checkpointIds = conditionResult.checkpoints.map((checkpoint: any) => checkpoint.checkpoint_id);

    if (!sameStringArray(checkpointIds, manifest.checkpoints)) {
      errors.push(`Run manifest checkpoint sequence mismatch for ${condition_id}`);
    }

    for (const checkpoint of conditionResult.checkpoints) {
      const checkpointManifestPath = join(checkpoint.artifact_dir, "manifest.json");
      const checkpointManifest = await readJsonOrError(checkpointManifestPath, errors);

      if (!checkpointManifest) {
        continue;
      }

      errors.push(...validateCheckpointManifest(checkpointManifest).errors);

      if (
        checkpointManifest.condition_id !== condition_id ||
        checkpointManifest.checkpoint_id !== checkpoint.checkpoint_id ||
        checkpointManifest.artifact_dir !== checkpoint.artifact_dir ||
        checkpointManifest.workspace_path !== conditionResult.workspace_path
      ) {
        errors.push(`Checkpoint manifest mismatch for ${condition_id}/${checkpoint.checkpoint_id}`);
      }

      validateCheckpointManifestHashesMatchRunEntry({
        checkpointManifest,
        runCheckpoint: checkpoint,
        condition_id,
        errors
      });
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function validateCheckpointManifestHashesMatchRunEntry(input: {
  checkpointManifest: any;
  runCheckpoint: any;
  condition_id: ConditionId;
  errors: string[];
}) {
  const scope = `${input.condition_id}/${input.runCheckpoint.checkpoint_id}`;
  const hashFields = [
    "prompt_packet_hash",
    "agent_result_hash",
    "hidden_oracle_result_hash",
    "snapshot_before_hash",
    "snapshot_after_hash",
    "workspace_code_after_hash"
  ] as const;

  for (const field of hashFields) {
    if (input.checkpointManifest[field] !== input.runCheckpoint[field]) {
      input.errors.push(`Checkpoint manifest hash mismatch for ${scope} ${field}`);
    }
  }

  if (
    !hashRecordsEqual(
      input.checkpointManifest.expected_feedback_asset_hashes,
      input.runCheckpoint.expected_feedback_asset_hashes
    )
  ) {
    input.errors.push(`Checkpoint manifest hash mismatch for ${scope} expected_feedback_asset_hashes`);
  }

  if (input.checkpointManifest.agent_status !== input.runCheckpoint.agent_status) {
    input.errors.push(`Checkpoint manifest agent_status mismatch for ${scope}`);
  }

  if (
    input.checkpointManifest.workspace_carried_forward_due_to_provider_failure !==
    input.runCheckpoint.workspace_carried_forward_due_to_provider_failure
  ) {
    input.errors.push(`Checkpoint manifest workspace_carried_forward_due_to_provider_failure mismatch for ${scope}`);
  }

  if (
    JSON.stringify(input.checkpointManifest.feedback_opportunity_integrity) !==
    JSON.stringify(input.runCheckpoint.feedback_opportunity_integrity)
  ) {
    input.errors.push(`Checkpoint manifest feedback_opportunity_integrity mismatch for ${scope}`);
  }

  if (JSON.stringify(input.checkpointManifest.timing) !== JSON.stringify(input.runCheckpoint.timing)) {
    input.errors.push(`Checkpoint manifest timing mismatch for ${scope}`);
  }
}

export async function verifyRunArtifacts(runManifestPath: string): Promise<RunArtifactVerification> {
  const manifest = JSON.parse(await readFile(runManifestPath, "utf8"));
  const mismatches: ArtifactMismatch[] = [];

  await verifyTaskSealManifest(manifest, mismatches);
  await verifyTaskPackageHashes(manifest, mismatches);

  if (manifest.result_record_path && manifest.result_record_hash) {
    await comparePathExists({
      path: "result.json",
      absolute_path: manifest.result_record_path,
      mismatches
    });
    await compareFileHash({
      path: "result.json",
      absolute_path: manifest.result_record_path,
      expected: manifest.result_record_hash,
      mismatches
    });
  }

  if (manifest.result_summary_path && manifest.result_summary_hash) {
    await comparePathExists({
      path: "summary.md",
      absolute_path: manifest.result_summary_path,
      mismatches
    });
    await compareFileHash({
      path: "summary.md",
      absolute_path: manifest.result_summary_path,
      expected: manifest.result_summary_hash,
      mismatches
    });
  }

  await verifySummaryMatchesResult(manifest, mismatches);
  await verifyResultMetadataMatchesManifest(manifest, mismatches);
  await verifyResultSchema(manifest, mismatches);

  for (const condition_id of manifest.conditions as ConditionId[]) {
    const conditionResult = manifest.condition_results[condition_id];

    await comparePathExists({
      path: `${condition_id}/workspace`,
      absolute_path: conditionResult.workspace_path,
      mismatches
    });

    for (const checkpoint of conditionResult.checkpoints) {
      const checkpointManifestPath = join(checkpoint.artifact_dir, "manifest.json");
      const checkpointManifest = await readJsonOrUndefined(checkpointManifestPath);
      const snapshotBeforePath =
        typeof checkpointManifest?.snapshot_before_path === "string"
          ? checkpointManifest.snapshot_before_path
          : join(checkpoint.artifact_dir, "workspace-before.json");
      const snapshotAfterPath =
        typeof checkpointManifest?.snapshot_after_path === "string"
          ? checkpointManifest.snapshot_after_path
          : join(checkpoint.artifact_dir, "workspace-after.json");
      const workspaceCodeAfterPath =
        typeof checkpointManifest?.workspace_code_after_path === "string"
          ? checkpointManifest.workspace_code_after_path
          : undefined;

      await comparePathExists({
        path: `${condition_id}/checkpoints/${checkpoint.checkpoint_id}`,
        absolute_path: checkpoint.artifact_dir,
        mismatches
      });
      await comparePathExists({
        path: `${condition_id}/checkpoints/${checkpoint.checkpoint_id}/manifest.json`,
        absolute_path: checkpointManifestPath,
        mismatches
      });
      await comparePathExists({
        path: `${condition_id}/checkpoints/${checkpoint.checkpoint_id}/prompt-packet.json`,
        absolute_path: join(checkpoint.artifact_dir, "prompt-packet.json"),
        mismatches
      });
      await comparePathExists({
        path: `${condition_id}/checkpoints/${checkpoint.checkpoint_id}/agent-result.json`,
        absolute_path: join(checkpoint.artifact_dir, "agent-result.json"),
        mismatches
      });
      await comparePathExists({
        path: `${condition_id}/checkpoints/${checkpoint.checkpoint_id}/workspace-before.json`,
        absolute_path: snapshotBeforePath,
        mismatches
      });
      await comparePathExists({
        path: `${condition_id}/checkpoints/${checkpoint.checkpoint_id}/workspace-after.json`,
        absolute_path: snapshotAfterPath,
        mismatches
      });
      if (checkpoint.workspace_code_after_hash) {
        await comparePathExists({
          path: `${condition_id}/checkpoints/${checkpoint.checkpoint_id}/workspace-code-after.json`,
          absolute_path: workspaceCodeAfterPath ?? join(checkpoint.artifact_dir, "workspace-code-after.json"),
          mismatches
        });
      }

      if (checkpoint.hidden_oracle_result_hash) {
        const hiddenOracleResultPath =
          typeof checkpointManifest?.hidden_oracle_result_path === "string"
            ? checkpointManifest.hidden_oracle_result_path
            : undefined;

        if (hiddenOracleResultPath) {
          await comparePathExists({
            path: `${condition_id}/checkpoints/${checkpoint.checkpoint_id}/hidden-oracle-result.json`,
            absolute_path: hiddenOracleResultPath,
            mismatches
          });
        }
      }

      await compareAgentResultTurnProtocol({
        absolute_path: join(checkpoint.artifact_dir, "agent-result.json"),
        display_path_prefix: `${condition_id}/checkpoints/${checkpoint.checkpoint_id}`,
        condition_id,
        run_classification: manifest.run_classification,
        budget: manifest.budget,
        expected_feedback_asset_hashes: checkpoint.expected_feedback_asset_hashes,
        mismatches
      });

      for (const feedbackPath of Object.keys(checkpoint.expected_feedback_asset_hashes ?? {})) {
        await comparePathExists({
          path: `${condition_id}/workspace/${feedbackPath}`,
          absolute_path: join(conditionResult.workspace_path, feedbackPath),
          mismatches
        });
      }

      const verification = await verifyCheckpointArtifacts({
        artifact_dir: checkpoint.artifact_dir,
        workspace_path: conditionResult.workspace_path,
        display_path_prefix: `${condition_id}/checkpoints/${checkpoint.checkpoint_id}`
      });

      mismatches.push(...verification.mismatches);
    }
  }

  return {
    ok: mismatches.length === 0,
    mismatches
  };
}

async function verifyResultSchema(
  manifest: any,
  mismatches: ArtifactMismatch[]
): Promise<void> {
  if (!manifest.result_record_path) {
    return;
  }

  try {
    const resultRecord = JSON.parse(await readFile(manifest.result_record_path, "utf8"));
    const validation = validateRunResultRecord(resultRecord);

    for (const error of validation.errors) {
      mismatches.push({
        path: "result.json",
        expected: `valid ${RESULT_SCHEMA_VERSION} record`,
        actual: error,
        reason: "schema_error"
      });
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

async function verifyResultMetadataMatchesManifest(
  manifest: any,
  mismatches: ArtifactMismatch[]
): Promise<void> {
  if (!manifest.result_record_path) {
    return;
  }

  try {
    const resultRecord = JSON.parse(await readFile(manifest.result_record_path, "utf8"));

    compareMetadataField("result.json/run_id", manifest.run_id, resultRecord.run_id, mismatches);
    compareMetadataField("result.json/task_id", manifest.task_id, resultRecord.task_id, mismatches);

    const expectedCheckpoints = JSON.stringify(manifest.checkpoints);
    const actualCheckpoints = Array.isArray(resultRecord.checkpoints)
      ? JSON.stringify(resultRecord.checkpoints)
      : "not an array";

    if (actualCheckpoints !== expectedCheckpoints) {
      mismatches.push({
        path: "result.json/checkpoints",
        expected: expectedCheckpoints,
        actual: actualCheckpoints,
        reason: "hash_mismatch"
      });
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

function compareMetadataField(
  path: string,
  expected: unknown,
  actual: unknown,
  mismatches: ArtifactMismatch[]
) {
  if (actual !== expected) {
    mismatches.push({
      path,
      expected: String(expected),
      actual: String(actual),
      reason: "hash_mismatch"
    });
  }
}

async function verifySummaryMatchesResult(
  manifest: any,
  mismatches: ArtifactMismatch[]
): Promise<void> {
  if (!manifest.result_record_path || !manifest.result_summary_path) {
    return;
  }

  try {
    const resultRecord = JSON.parse(await readFile(manifest.result_record_path, "utf8"));
    const actualSummary = await readFile(manifest.result_summary_path, "utf8");

    if (!resultRecord?.primary_metric || !resultRecord?.condition_summaries) {
      return;
    }

    const expectedSummary = renderResultSummary(resultRecord, await buildEvidenceStatusSummary(manifest));

    if (actualSummary !== expectedSummary) {
      mismatches.push({
        path: "summary.md",
        expected: "matches result.json",
        actual: "content differs",
        reason: "hash_mismatch"
      });
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

function validateOptionalFeedbackOpportunityIntegrity(
  value: unknown,
  field: string,
  errors: string[]
) {
  if (value === undefined) {
    return;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${field} must be an object when provided`);
    return;
  }

  const integrity = value as Partial<CheckpointFeedbackOpportunityIntegrity>;

  for (const key of [
    "required",
    "turn_1_completed",
    "feedback_ran",
    "feedback_summary_delivered",
    "turn_2_completed_after_feedback",
    "complete"
  ] as const) {
    if (typeof integrity[key] !== "boolean") {
      errors.push(`${field}.${key} must be a boolean`);
    }
  }
}

function validateOptionalCheckpointTiming(value: unknown, field: string, errors: string[]) {
  if (value === undefined) {
    return;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${field} must be an object when provided`);
    return;
  }

  const timing = value as {
    checkpoint_ms?: unknown;
    agent_ms?: unknown;
    hidden_oracle_ms?: unknown;
  };

  validateNonNegativeInteger(timing.checkpoint_ms, `${field}.checkpoint_ms`, errors);
  validateNonNegativeInteger(timing.agent_ms, `${field}.agent_ms`, errors);
  validateOptionalNonNegativeInteger(timing.hidden_oracle_ms, `${field}.hidden_oracle_ms`, errors);
}

async function compareAgentResultTurnProtocol(input: {
  absolute_path: string;
  display_path_prefix: string;
  condition_id: ConditionId;
  run_classification: unknown;
  budget: unknown;
  expected_feedback_asset_hashes?: Record<string, string>;
  mismatches: ArtifactMismatch[];
}) {
  try {
    const agentResult = JSON.parse(await readFile(input.absolute_path, "utf8"));
    const budget = input.budget as RunBudget | undefined;
    const maxModelTurns = budget?.max_model_turns;

    if (
      input.run_classification === "causal_pilot" &&
      Number.isInteger(maxModelTurns) &&
      (maxModelTurns as number) >= 1
    ) {
      if (agentResult?.max_model_turns !== maxModelTurns) {
        input.mismatches.push({
          path: displayPath(input.display_path_prefix, "agent-result.json/max_model_turns"),
          expected: String(maxModelTurns),
          actual: String(agentResult?.max_model_turns),
          reason: "schema_error"
        });
      }

      if (Number.isInteger(agentResult?.model_turns) && agentResult.model_turns > maxModelTurns) {
        input.mismatches.push({
          path: displayPath(input.display_path_prefix, "agent-result.json/model_turns"),
          expected: `<= ${maxModelTurns}`,
          actual: String(agentResult.model_turns),
          reason: "schema_error"
        });
      }
    }

    if (input.condition_id === "feedback_capable_spec") {
      compareFeedbackCapableCausalEvidence({
        agentResult,
        display_path_prefix: input.display_path_prefix,
        run_classification: input.run_classification,
        expected_feedback_asset_hashes: input.expected_feedback_asset_hashes,
        mismatches: input.mismatches
      });
      return;
    }

    if (input.condition_id !== "context_only_spec") {
      return;
    }

    if (agentResult?.feedback_available === true) {
      input.mismatches.push({
        path: displayPath(input.display_path_prefix, "agent-result.json/feedback_available"),
        expected: "false for context_only_spec",
        actual: "true",
        reason: "schema_error"
      });
    }

    if (agentResult?.feedback_runs !== undefined && agentResult.feedback_runs !== 0) {
      input.mismatches.push({
        path: displayPath(input.display_path_prefix, "agent-result.json/feedback_runs"),
        expected: "0 for context_only_spec",
        actual: String(agentResult.feedback_runs),
        reason: "schema_error"
      });
    }

    if (agentResult?.feedback_command !== undefined) {
      input.mismatches.push({
        path: displayPath(input.display_path_prefix, "agent-result.json/feedback_command"),
        expected: "absent for context_only_spec",
        actual: String(agentResult.feedback_command),
        reason: "schema_error"
      });
    }

    if (Array.isArray(agentResult?.feedback_summaries) && agentResult.feedback_summaries.length > 0) {
      input.mismatches.push({
        path: displayPath(input.display_path_prefix, "agent-result.json/feedback_summaries"),
        expected: "empty for context_only_spec",
        actual: `${agentResult.feedback_summaries.length} entr${agentResult.feedback_summaries.length === 1 ? "y" : "ies"}`,
        reason: "schema_error"
      });
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

function compareFeedbackCapableCausalEvidence(input: {
  agentResult: any;
  display_path_prefix: string;
  run_classification: unknown;
  expected_feedback_asset_hashes?: Record<string, string>;
  mismatches: ArtifactMismatch[];
}) {
  if (input.run_classification !== "causal_pilot") {
    return;
  }

  if (Object.keys(input.expected_feedback_asset_hashes ?? {}).length === 0) {
    return;
  }

  if (input.agentResult?.feedback_available !== true) {
    input.mismatches.push({
      path: displayPath(input.display_path_prefix, "agent-result.json/feedback_available"),
      expected: "true for causal feedback-use evidence",
      actual: String(input.agentResult?.feedback_available),
      reason: "schema_error"
    });
  }

  if (!Number.isInteger(input.agentResult?.feedback_runs) || input.agentResult.feedback_runs < 1) {
    input.mismatches.push({
      path: displayPath(input.display_path_prefix, "agent-result.json/feedback_runs"),
      expected: ">= 1 for causal feedback-use evidence",
      actual: String(input.agentResult?.feedback_runs),
      reason: "schema_error"
    });
  }

  if (!Number.isInteger(input.agentResult?.model_turns) || input.agentResult.model_turns < 2) {
    input.mismatches.push({
      path: displayPath(input.display_path_prefix, "agent-result.json/model_turns"),
      expected: ">= 2 for causal feedback-use evidence",
      actual: String(input.agentResult?.model_turns),
      reason: "schema_error"
    });
  }

  if (
    !Array.isArray(input.agentResult?.feedback_summaries) ||
    input.agentResult.feedback_summaries.length === 0
  ) {
    input.mismatches.push({
      path: displayPath(input.display_path_prefix, "agent-result.json/feedback_summaries"),
      expected: "non-empty for causal feedback-use evidence",
      actual: Array.isArray(input.agentResult?.feedback_summaries)
        ? `${input.agentResult.feedback_summaries.length} entries`
        : String(input.agentResult?.feedback_summaries),
      reason: "schema_error"
    });
  }

  if (!hasFeedbackOpportunityTranscriptSequence(input.agentResult?.transcript)) {
    input.mismatches.push({
      path: displayPath(input.display_path_prefix, "agent-result.json/transcript"),
      expected: "model_turn, feedback_run, model_turn sequence for causal feedback-use evidence",
      actual: Array.isArray(input.agentResult?.transcript)
        ? input.agentResult.transcript.map((event: any) => String(event?.event)).join(", ")
        : String(input.agentResult?.transcript),
      reason: "schema_error"
    });
  }
}

function hasFeedbackOpportunityTranscriptSequence(transcript: unknown): boolean {
  if (!Array.isArray(transcript)) {
    return false;
  }

  const events = transcript.map((event) =>
    event && typeof event === "object" && !Array.isArray(event)
      ? String((event as Record<string, unknown>).event)
      : ""
  );
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

async function verifyTaskPackageHashes(
  manifest: any,
  mismatches: ArtifactMismatch[]
): Promise<void> {
  if (manifest.task_package_path && manifest.task_package_hash) {
    await comparePathExists({
      path: "task_package",
      absolute_path: manifest.task_package_path,
      mismatches
    });

    try {
      const actual = (await hashDirectory(manifest.task_package_path)).hash;

      if (actual !== manifest.task_package_hash) {
        mismatches.push({
          path: "task_package",
          expected: manifest.task_package_hash,
          actual,
          reason: "hash_mismatch"
        });
      }
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }
  }

  if (manifest.task_package_path && manifest.canonical_spec_hash) {
    const taskJson = await readJsonOrUndefined(join(manifest.task_package_path, "task.json"));
    const canonicalSpecPath =
      typeof taskJson?.canonical_spec === "string"
        ? join(manifest.task_package_path, taskJson.canonical_spec)
        : join(manifest.task_package_path, "canonical-spec.json");

    await comparePathExists({
      path: "canonical_spec",
      absolute_path: canonicalSpecPath,
      mismatches
    });
    await compareFileHash({
      path: "canonical_spec",
      absolute_path: canonicalSpecPath,
      expected: manifest.canonical_spec_hash,
      mismatches
    });
  }
}

async function verifyTaskSealManifest(
  manifest: any,
  mismatches: ArtifactMismatch[]
): Promise<void> {
  if (!manifest.task_seal_path || !manifest.task_seal_hash) {
    return;
  }

  await comparePathExists({
    path: "task-seal.json",
    absolute_path: manifest.task_seal_path,
    mismatches
  });
  await compareFileHash({
    path: "task-seal.json",
    absolute_path: manifest.task_seal_path,
    expected: manifest.task_seal_hash,
    mismatches
  });

  try {
    const taskSeal = JSON.parse(await readFile(manifest.task_seal_path, "utf8"));
    const validation = validateTaskSealManifest(taskSeal);

    for (const error of validation.errors) {
      mismatches.push({
        path: "task-seal.json",
        expected: `valid ${TASK_SEAL_SCHEMA_VERSION} record`,
        actual: error,
        reason: "schema_error"
      });
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

async function compareFileHash(input: {
  path: string;
  absolute_path: string;
  expected: string;
  mismatches: ArtifactMismatch[];
}) {
  try {
    const actual = await hashFile(input.absolute_path);

    if (actual !== input.expected) {
      input.mismatches.push({
        path: input.path,
        expected: input.expected,
        actual,
        reason: "hash_mismatch"
      });
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      input.mismatches.push({
        path: input.path,
        expected: input.expected,
        reason: "missing"
      });
      return;
    }

    throw error;
  }
}

async function readJsonOrError(path: string, errors: string[]): Promise<any | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      errors.push(`Missing checkpoint manifest: ${path}`);
      return undefined;
    }

    throw error;
  }
}

async function readJsonOrUndefined(path: string): Promise<any | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function comparePathExists(input: {
  path: string;
  absolute_path: string;
  mismatches: ArtifactMismatch[];
}) {
  try {
    await stat(input.absolute_path);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      input.mismatches.push({
        path: input.path,
        expected: "exists",
        reason: "missing"
      });
      return;
    }

    throw error;
  }
}

async function hashDirectoryOrMissing(path: string): Promise<string> {
  try {
    return (await hashDirectory(path)).hash;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return hashText("missing-hidden-oracle-directory");
    }

    throw error;
  }
}

function hashStable(value: unknown): string {
  return hashText(JSON.stringify(stableValue(value)));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)])
  );
}

function sanitizeProfileIdPart(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized.length > 0 ? sanitized : "unknown";
}

function requireString(value: unknown, field: string, errors: string[]) {
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`${field} must be a non-empty string`);
  }
}

function validateOptionalNonEmptyString(value: unknown, field: string, errors: string[]) {
  if (value !== undefined && (typeof value !== "string" || value.length === 0)) {
    errors.push(`${field} must be a non-empty string when provided`);
  }
}

function validateOptionalProtocolProfileId(value: unknown, field: string, errors: string[]) {
  if (value !== undefined && !isProtocolProfileId(value)) {
    errors.push(`${field} must be final-checkpoint-primary-v1 or path-survival-primary-v1`);
  }
}

function validateOptionalProviderFailurePhase(value: unknown, field: string, errors: string[]) {
  if (value !== undefined && !PROVIDER_FAILURE_PHASES.includes(value as ProviderFailurePhase)) {
    errors.push(`${field} must be a supported provider failure phase when provided`);
  }
}

function validatePositiveInteger(value: unknown, field: string, errors: string[]) {
  if (!Number.isInteger(value) || (value as number) < 1) {
    errors.push(`${field} must be a positive integer`);
  }
}

function validateNonNegativeInteger(value: unknown, field: string, errors: string[]) {
  if (!Number.isInteger(value) || (value as number) < 0) {
    errors.push(`${field} must be a non-negative integer`);
  }
}

function validateOptionalPositiveInteger(value: unknown, field: string, errors: string[]) {
  if (value !== undefined) {
    validatePositiveInteger(value, field, errors);
  }
}

function validateOptionalNonNegativeInteger(value: unknown, field: string, errors: string[]) {
  if (value !== undefined) {
    validateNonNegativeInteger(value, field, errors);
  }
}

function validateOptionalBooleanField(value: unknown, field: string, errors: string[]) {
  if (value !== undefined && typeof value !== "boolean") {
    errors.push(`${field} must be a boolean when provided`);
  }
}

function requireStringArray(value: unknown, field: string, errors: string[]) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    errors.push(`${field} must be an array of strings`);
  }
}

function requireHash(value: unknown, field: string, errors: string[]) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    errors.push(`${field} must be a sha256 hex hash`);
  }
}

function requireHashRecord(value: unknown, field: string, errors: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${field} must be an object`);
    return;
  }

  for (const [path, hash] of Object.entries(value)) {
    requireHash(hash, `${field}.${path}`, errors);
  }
}

function requirePathUnderArtifactDir(value: unknown, field: string, artifactDir: unknown, errors: string[]) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    typeof artifactDir !== "string" ||
    artifactDir.length === 0
  ) {
    return;
  }

  if (!isPathInside(artifactDir, value)) {
    errors.push(`${field} must be under artifact_dir`);
  }
}

function isPathInside(parent: string, child: string): boolean {
  const resolvedParent = resolve(parent);
  const resolvedChild = resolve(child);

  return resolvedChild.startsWith(resolvedParent + sep);
}

function hashRecordsEqual(left: unknown, right: unknown) {
  if (!left || typeof left !== "object" || Array.isArray(left)) {
    return false;
  }

  if (!right || typeof right !== "object" || Array.isArray(right)) {
    return false;
  }

  const leftEntries = Object.entries(left as Record<string, unknown>).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey)
  );
  const rightEntries = Object.entries(right as Record<string, unknown>).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey)
  );

  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

function sameStringArray(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
