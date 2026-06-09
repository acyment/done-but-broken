import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve, sep, join } from "node:path";
import { CONDITION_IDS, type ConditionId } from "./conditions";
import {
  buildCheckpointFeedbackOpportunityIntegrity,
  buildEvidenceStatusSummary,
  type CheckpointFeedbackOpportunityIntegrity
} from "./evidence-status";
import {
  buildProviderProfileId,
  buildRunCompatibilityProfile,
  buildTaskSealManifest,
  expectedFeedbackAssetHashes,
  MODEL_LOOP_POLICY_VERSION,
  type ModelProviderSettings,
  OPENROUTER_CHAT_REQUEST_PARAMETER_VERSION,
  type ProviderExecutionProfile,
  PROTOCOL_VERSION,
  RENDERER_VERSION,
  type RunBudget,
  type RunClassification,
  type RunCompatibilityProfile,
  type RunValidityDetail,
  type RunValidityFlag
} from "./provenance";
import {
  defaultProtocolProfileId,
  type ProtocolProfileId
} from "./protocol-profile";
import { renderSpecPacket, writeFeedbackAssets, type RenderedSpecPacket } from "./renderer";
import {
  buildRunResultRecord,
  RESULT_SCHEMA_VERSION,
  type CheckpointEvaluation,
  type OracleCheckResult
} from "./result-schema";
import { writeResultSummary } from "./result-summary";
import { hashFile, hashWorkspace, type WorkspaceSnapshot } from "./snapshot";
import type { CheckpointId, TaskDefinition } from "./task-model";

const DEFAULT_OPENROUTER_PROVIDER_ROUTE = "openrouter-chat-completions";
const DEFAULT_OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_RESPONSE_PARSER_VERSION = "openrouter-response-parser-v1";
const DEFAULT_OPENROUTER_MAX_WORKSPACE_BYTES = 256_000;
const DEFAULT_OPENROUTER_FEEDBACK_OUTPUT_BYTES = 12_000;

export type AgentRunInput = {
  condition_id: ConditionId;
  checkpoint_id: CheckpointId;
  workspace_path: string;
  artifact_dir: string;
  packet: RenderedSpecPacket;
};

export type AgentRunResult = {
  status: "ok" | "failed";
  notes?: string;
  adapter_id?: string;
  transcript?: AgentTranscriptEvent[];
  model_turns?: number;
  max_model_turns?: number;
  feedback_runs?: number;
  max_feedback_runs?: number;
  feedback_available?: boolean;
  feedback_command?: string;
  feedback_summaries?: string[];
  final_file_writes?: string[];
  feedback_assets_modified?: boolean;
  validity_flags?: RunValidityFlag[];
  validity_details?: RunValidityDetail[];
  workspace_carried_forward_due_to_provider_failure?: boolean;
};

export type AgentTranscriptEvent = {
  event: string;
  detail?: string;
};

export type AgentAdapter = {
  run(input: AgentRunInput): Promise<AgentRunResult>;
};

export type HiddenOracleRunInput = {
  condition_id: ConditionId;
  checkpoint_id: CheckpointId;
  workspace_path: string;
  artifact_dir: string;
  hidden_oracle_path: string;
};

export type HiddenOracleRunResult = {
  status: "ok" | "failed";
  checks: OracleCheckResult[];
  notes?: string;
};

export type HiddenOracleAdapter = {
  run(input: HiddenOracleRunInput): Promise<HiddenOracleRunResult>;
};

export type RunPilotInput = {
  task: TaskDefinition;
  run_id: string;
  runs_root: string;
  agent: AgentAdapter;
  hidden_oracle?: HiddenOracleAdapter;
  run_classification?: RunClassification;
  validity_flags?: RunValidityFlag[];
  validity_details?: RunValidityDetail[];
  budget?: RunBudget;
  model_provider?: ModelProviderSettings;
  provider_execution_profile?: ProviderExecutionProfile;
  exclusion_rules?: string[];
  metric_version?: string;
  protocol_profile_id?: ProtocolProfileId;
};

export type CheckpointRunResult = {
  checkpoint_id: CheckpointId;
  condition_id: ConditionId;
  artifact_dir: string;
  workspace_path: string;
  snapshot_before: WorkspaceSnapshot;
  snapshot_after: WorkspaceSnapshot;
  prompt_packet_hash: string;
  agent_result_hash: string;
  expected_feedback_asset_hashes: Record<string, string>;
  hidden_oracle_result?: HiddenOracleRunResult;
  hidden_oracle_result_hash?: string;
  agent_result: AgentRunResult;
  feedback_opportunity_integrity?: CheckpointFeedbackOpportunityIntegrity;
  timing?: CheckpointRunTiming;
};

export type ConditionRunResult = {
  condition_id: ConditionId;
  workspace_path: string;
  checkpoints: CheckpointRunResult[];
};

export type CheckpointRunTiming = {
  checkpoint_ms: number;
  agent_ms: number;
  hidden_oracle_ms?: number;
};

export type PilotRunResult = {
  run_id: string;
  task_id: string;
  task_version: string;
  run_classification: RunClassification;
  validity_flags: RunValidityFlag[];
  validity_details: RunValidityDetail[];
  task_seal_path: string;
  task_seal_hash: string;
  budget: RunBudget;
  model_provider: ModelProviderSettings;
  provider_execution_profile: ProviderExecutionProfile;
  clean_primary_evidence_eligible: boolean;
  exclusion_rules: string[];
  metric_version: string;
  protocol_profile_id: ProtocolProfileId;
  compatibility: RunCompatibilityProfile;
  run_manifest_path: string;
  result_record_path?: string;
  result_record_hash?: string;
  result_summary_path?: string;
  result_summary_hash?: string;
  condition_results: Record<ConditionId, ConditionRunResult>;
};

export async function runPilot(input: RunPilotInput): Promise<PilotRunResult> {
  const condition_results = {} as Record<ConditionId, ConditionRunResult>;
  const runRoot = join(input.runs_root, input.run_id);
  const metricVersion = input.metric_version ?? RESULT_SCHEMA_VERSION;
  const protocolProfileId = input.protocol_profile_id ?? defaultProtocolProfileId();
  const budget = input.budget ?? {};
  const modelProvider = input.model_provider ?? {};
  const providerExecutionProfile =
    input.provider_execution_profile ?? defaultProviderExecutionProfile(modelProvider);
  const exclusionRules = input.exclusion_rules ?? [];
  const runClassification = input.run_classification ?? "calibration";

  await mkdir(runRoot, { recursive: true });
  const taskSealPath = join(runRoot, "task-seal.json");
  const taskSeal = await buildTaskSealManifest(input.task);
  await writeJson(taskSealPath, taskSeal);
  const taskSealHash = await hashFile(taskSealPath);
  const compatibility = buildRunCompatibilityProfile({
    task_seal: taskSeal,
    task_seal_hash: taskSealHash,
    budget,
    model_provider: modelProvider,
    provider_execution_profile: providerExecutionProfile,
    metric_version: metricVersion,
    protocol_profile_id: protocolProfileId
  });

  const conditionConcurrency = normalizeConditionConcurrency(budget.condition_concurrency ?? 1);
  const completedConditions = await runConditions({
    condition_ids: [...CONDITION_IDS],
    concurrency: conditionConcurrency,
    runCondition: async (condition_id) =>
      runConditionPipeline({
        task: input.task,
        agent: input.agent,
        hidden_oracle: input.hidden_oracle,
        run_classification: runClassification,
        runRoot,
        condition_id
      })
  });

  for (const condition of completedConditions) {
    condition_results[condition.condition_id] = condition;
  }

  const validityFlags = mergeValidityFlags(input.validity_flags ?? [], condition_results);
  const result: PilotRunResult = {
    run_id: input.run_id,
    task_id: input.task.task_id,
    task_version: taskSeal.task_version,
    run_classification: runClassification,
    validity_flags: validityFlags,
    validity_details: mergeValidityDetails(input.validity_details ?? [], condition_results),
    task_seal_path: taskSealPath,
    task_seal_hash: taskSealHash,
    budget,
    model_provider: modelProvider,
    provider_execution_profile: providerExecutionProfile,
    clean_primary_evidence_eligible: isCleanPrimaryEvidenceEligible({
      run_classification: runClassification,
      validity_flags: validityFlags,
      condition_results
    }),
    exclusion_rules: exclusionRules,
    metric_version: metricVersion,
    protocol_profile_id: protocolProfileId,
    compatibility,
    run_manifest_path: join(runRoot, "run.json"),
    condition_results
  };

  if (input.hidden_oracle) {
    result.result_record_path = join(runRoot, "result.json");
    const resultRecord = buildResultRecord(result, input.task);
    await writeJson(result.result_record_path, resultRecord);
    result.result_record_hash = await hashFile(result.result_record_path);
    result.result_summary_path = join(runRoot, "summary.md");
    const evidenceStatus = await buildEvidenceStatusSummary(runManifest(result, input.task));
    await writeResultSummary({
      output_path: result.result_summary_path,
      result: resultRecord,
      evidence_status: evidenceStatus
    });
    result.result_summary_hash = await hashFile(result.result_summary_path);
  }

  await writeJson(result.run_manifest_path, runManifest(result, input.task));

  return result;
}

function mergeValidityFlags(
  initialFlags: RunValidityFlag[],
  conditionResults: Record<ConditionId, ConditionRunResult>
): RunValidityFlag[] {
  const flags = new Set(initialFlags);

  for (const condition of Object.values(conditionResults)) {
    for (const checkpoint of condition.checkpoints) {
      for (const flag of checkpoint.agent_result.validity_flags ?? []) {
        flags.add(flag);
      }
    }
  }

  return [...flags];
}

function mergeValidityDetails(
  initialDetails: RunValidityDetail[],
  conditionResults: Record<ConditionId, ConditionRunResult>
): RunValidityDetail[] {
  return [
    ...initialDetails,
    ...Object.values(conditionResults).flatMap((condition) =>
      condition.checkpoints.flatMap((checkpoint) => checkpoint.agent_result.validity_details ?? [])
    )
  ];
}

function defaultProviderExecutionProfile(
  modelProvider: ModelProviderSettings
): ProviderExecutionProfile {
  if (modelProvider.provider === "openrouter" && modelProvider.adapter_id === "openrouter-loop") {
    const perCallTimeoutMs = 60_000;
    const maxOutputTokens = 16_000;
    const temperature = 0.2;
    const maxRetries = 0;

    return {
      provider_profile_id: buildProviderProfileId({
        adapter_id: "openrouter-loop",
        model_id: modelProvider.model,
        provider_route: DEFAULT_OPENROUTER_PROVIDER_ROUTE,
        response_parser_version: DEFAULT_OPENROUTER_RESPONSE_PARSER_VERSION,
        request_parameter_version: OPENROUTER_CHAT_REQUEST_PARAMETER_VERSION,
        model_loop_policy_version: MODEL_LOOP_POLICY_VERSION,
        per_call_timeout_ms: perCallTimeoutMs,
        max_output_tokens: maxOutputTokens,
        max_workspace_bytes: DEFAULT_OPENROUTER_MAX_WORKSPACE_BYTES,
        max_feedback_output_bytes: DEFAULT_OPENROUTER_FEEDBACK_OUTPUT_BYTES,
        temperature,
        max_retries: maxRetries
      }),
      model_id: modelProvider.model,
      provider_route: DEFAULT_OPENROUTER_PROVIDER_ROUTE,
      provider_endpoint: DEFAULT_OPENROUTER_ENDPOINT,
      response_parser_version: DEFAULT_OPENROUTER_RESPONSE_PARSER_VERSION,
      request_parameter_version: OPENROUTER_CHAT_REQUEST_PARAMETER_VERSION,
      model_loop_policy_version: MODEL_LOOP_POLICY_VERSION,
      per_call_timeout_ms: perCallTimeoutMs,
      retry_policy: {
        max_retries: maxRetries,
        retryable_errors: ["timeout", "socket", "rate_limit_transient"]
      },
      max_output_tokens: maxOutputTokens,
      max_workspace_bytes: DEFAULT_OPENROUTER_MAX_WORKSPACE_BYTES,
      max_feedback_output_bytes: DEFAULT_OPENROUTER_FEEDBACK_OUTPUT_BYTES,
      temperature,
      prompt_renderer_version: RENDERER_VERSION,
      feedback_summary_version: "public-feedback-summary-v0"
    };
  }

  if (modelProvider.provider === "openrouter") {
    const perCallTimeoutMs = 60_000;
    const maxOutputTokens = 16_000;
    const temperature = 0.2;
    const maxRetries = 0;

    return {
      provider_profile_id: buildProviderProfileId({
        adapter_id: "openrouter-single-shot",
        model_id: modelProvider.model,
        provider_route: DEFAULT_OPENROUTER_PROVIDER_ROUTE,
        response_parser_version: DEFAULT_OPENROUTER_RESPONSE_PARSER_VERSION,
        request_parameter_version: OPENROUTER_CHAT_REQUEST_PARAMETER_VERSION,
        per_call_timeout_ms: perCallTimeoutMs,
        max_output_tokens: maxOutputTokens,
        max_workspace_bytes: DEFAULT_OPENROUTER_MAX_WORKSPACE_BYTES,
        temperature,
        max_retries: maxRetries
      }),
      model_id: modelProvider.model,
      provider_route: DEFAULT_OPENROUTER_PROVIDER_ROUTE,
      provider_endpoint: DEFAULT_OPENROUTER_ENDPOINT,
      response_parser_version: DEFAULT_OPENROUTER_RESPONSE_PARSER_VERSION,
      request_parameter_version: OPENROUTER_CHAT_REQUEST_PARAMETER_VERSION,
      per_call_timeout_ms: perCallTimeoutMs,
      retry_policy: {
        max_retries: maxRetries,
        retryable_errors: ["timeout", "socket", "rate_limit_transient"]
      },
      max_output_tokens: maxOutputTokens,
      max_workspace_bytes: DEFAULT_OPENROUTER_MAX_WORKSPACE_BYTES,
      temperature,
      prompt_renderer_version: RENDERER_VERSION,
      feedback_summary_version: "none"
    };
  }

  return {
    provider_profile_id: "fake-agent-v1",
    per_call_timeout_ms: 0,
    retry_policy: {
      max_retries: 0,
      retryable_errors: []
    },
    prompt_renderer_version: RENDERER_VERSION,
    feedback_summary_version: "none"
  };
}

function isCleanPrimaryEvidenceEligible(input: {
  run_classification: RunClassification;
  validity_flags: RunValidityFlag[];
  condition_results: Record<ConditionId, ConditionRunResult>;
}): boolean {
  if (input.run_classification !== "causal_pilot" || input.validity_flags.length > 0) {
    return false;
  }

  const feedbackCheckpoints = input.condition_results.feedback_capable_spec?.checkpoints ?? [];

  return feedbackCheckpoints.every((checkpoint) => {
    const integrity = checkpoint.feedback_opportunity_integrity;
    return integrity?.required !== true || integrity.complete === true;
  });
}

function checkpointManifest(checkpoint: CheckpointRunResult) {
  return {
    protocol_version: PROTOCOL_VERSION,
    renderer_version: RENDERER_VERSION,
    condition_id: checkpoint.condition_id,
    checkpoint_id: checkpoint.checkpoint_id,
    artifact_dir: checkpoint.artifact_dir,
    workspace_path: checkpoint.workspace_path,
    prompt_packet_hash: checkpoint.prompt_packet_hash,
    agent_result_hash: checkpoint.agent_result_hash,
    expected_feedback_asset_hashes: checkpoint.expected_feedback_asset_hashes,
    hidden_oracle_result_path: checkpoint.hidden_oracle_result_hash
      ? join(checkpoint.artifact_dir, "hidden-oracle-result.json")
      : undefined,
    hidden_oracle_result_hash: checkpoint.hidden_oracle_result_hash,
    snapshot_before_path: join(checkpoint.artifact_dir, "workspace-before.json"),
    snapshot_after_path: join(checkpoint.artifact_dir, "workspace-after.json"),
    snapshot_before_hash: checkpoint.snapshot_before.hash,
    snapshot_after_hash: checkpoint.snapshot_after.hash,
    agent_status: checkpoint.agent_result.status,
    workspace_carried_forward_due_to_provider_failure:
      checkpoint.agent_result.workspace_carried_forward_due_to_provider_failure,
    feedback_opportunity_integrity: checkpoint.feedback_opportunity_integrity,
    timing: checkpoint.timing
  };
}

function runManifest(result: PilotRunResult, task: TaskDefinition) {
  return {
    protocol_version: PROTOCOL_VERSION,
    renderer_version: RENDERER_VERSION,
    run_id: result.run_id,
    task_id: result.task_id,
    task_version: result.task_version,
    run_classification: result.run_classification,
    validity_flags: result.validity_flags,
    validity_details: result.validity_details,
    clean_primary_evidence_eligible: result.clean_primary_evidence_eligible,
    conditions: [...CONDITION_IDS],
    checkpoints: task.checkpoints,
    task_seal_path: result.task_seal_path,
    task_seal_hash: result.task_seal_hash,
    task_package_path: task.package_provenance?.task_package_path,
    task_package_hash: task.package_provenance?.task_package_hash,
    canonical_spec_hash: task.package_provenance?.canonical_spec_hash,
    budget: result.budget,
    model_provider: result.model_provider,
    provider_execution_profile: result.provider_execution_profile,
    exclusion_rules: result.exclusion_rules,
    protocol_profile_id: result.protocol_profile_id,
    metric_version: result.metric_version,
    compatibility: result.compatibility,
    result_record_path: result.result_record_path,
    result_record_hash: result.result_record_hash,
    result_summary_path: result.result_summary_path,
    result_summary_hash: result.result_summary_hash,
    condition_results: Object.fromEntries(
      CONDITION_IDS.map((condition_id) => [
        condition_id,
        {
          workspace_path: result.condition_results[condition_id].workspace_path,
          checkpoints: result.condition_results[condition_id].checkpoints.map((checkpoint) => ({
            checkpoint_id: checkpoint.checkpoint_id,
            artifact_dir: checkpoint.artifact_dir,
            prompt_packet_hash: checkpoint.prompt_packet_hash,
            agent_result_hash: checkpoint.agent_result_hash,
            expected_feedback_asset_hashes: checkpoint.expected_feedback_asset_hashes,
            hidden_oracle_result_hash: checkpoint.hidden_oracle_result_hash,
            snapshot_before_hash: checkpoint.snapshot_before.hash,
            snapshot_after_hash: checkpoint.snapshot_after.hash,
            agent_status: checkpoint.agent_result.status,
            workspace_carried_forward_due_to_provider_failure:
              checkpoint.agent_result.workspace_carried_forward_due_to_provider_failure,
            feedback_opportunity_integrity: checkpoint.feedback_opportunity_integrity,
            timing: checkpoint.timing
          }))
        }
      ])
    )
  };
}

function checkpointFeedbackOpportunityIntegrity(input: {
  run_classification: RunClassification;
  condition_id: ConditionId;
  expected_feedback_asset_hashes: Record<string, string>;
  agent_result: AgentRunResult;
}): CheckpointFeedbackOpportunityIntegrity | undefined {
  if (input.run_classification !== "causal_pilot") {
    return undefined;
  }

  return buildCheckpointFeedbackOpportunityIntegrity({
    required:
      input.condition_id === "feedback_capable_spec" &&
      Object.keys(input.expected_feedback_asset_hashes).length > 0,
    agent_result: input.agent_result
  });
}

function buildResultRecord(result: PilotRunResult, task: TaskDefinition) {
  return buildRunResultRecord({
    run_id: result.run_id,
    task_id: result.task_id,
    checkpoints: task.checkpoints,
    evaluations: collectHiddenOracleEvaluations(result)
  });
}

function collectHiddenOracleEvaluations(result: PilotRunResult): CheckpointEvaluation[] {
  return CONDITION_IDS.flatMap((condition_id) =>
    result.condition_results[condition_id].checkpoints
      .filter((checkpoint) => checkpoint.hidden_oracle_result)
      .map((checkpoint) => ({
        condition_id,
        checkpoint_id: checkpoint.checkpoint_id,
        checks: checkpoint.hidden_oracle_result!.checks
      }))
  );
}

async function runConditionPipeline(input: {
  task: TaskDefinition;
  agent: AgentAdapter;
  hidden_oracle?: HiddenOracleAdapter;
  run_classification: RunClassification;
  runRoot: string;
  condition_id: ConditionId;
}): Promise<ConditionRunResult> {
  const conditionRoot = join(input.runRoot, input.condition_id);
  const workspace_path = join(conditionRoot, "workspace");
  const checkpoints: CheckpointRunResult[] = [];

  await rm(workspace_path, { recursive: true, force: true });

  for (const [index, checkpoint_id] of input.task.checkpoints.entries()) {
    const checkpointStartedAt = Date.now();

    if (index === 0) {
      await cp(input.task.template_workspace, workspace_path, { recursive: true });
    }

    const artifact_dir = join(conditionRoot, "checkpoints", checkpoint_id);
    await mkdir(artifact_dir, { recursive: true });

    const snapshot_before = await hashWorkspace(workspace_path);
    const packet = renderSpecPacket({
      task: input.task,
      condition_id: input.condition_id,
      checkpoint_id
    });

    const promptPacketPath = join(artifact_dir, "prompt-packet.json");
    await writeJson(promptPacketPath, packet);
    const prompt_packet_hash = await hashFile(promptPacketPath);
    const expected_feedback_asset_hashes = expectedFeedbackAssetHashes(packet);
    await writeFeedbackAssets({ workspace_path, packet });

    const agentStartedAt = Date.now();
    const agent_result = await input.agent.run({
      condition_id: input.condition_id,
      checkpoint_id,
      workspace_path,
      artifact_dir,
      packet
    });
    const agentMs = elapsedMs(agentStartedAt);
    const agentResultPath = join(artifact_dir, "agent-result.json");
    await writeJson(agentResultPath, agent_result);
    const agent_result_hash = await hashFile(agentResultPath);

    const snapshot_after = await hashWorkspace(workspace_path);
    const hiddenOracleStartedAt = Date.now();
    const hiddenOracle = input.hidden_oracle
      ? await runHiddenOracle({
          hidden_oracle: input.hidden_oracle,
          task: input.task,
          condition_id: input.condition_id,
          checkpoint_id,
          workspace_path,
          artifact_dir
        })
      : undefined;
    const hiddenOracleMs = input.hidden_oracle ? elapsedMs(hiddenOracleStartedAt) : undefined;

    const checkpointResult: CheckpointRunResult = {
      checkpoint_id,
      condition_id: input.condition_id,
      artifact_dir,
      workspace_path,
      snapshot_before,
      snapshot_after,
      prompt_packet_hash,
      agent_result_hash,
      expected_feedback_asset_hashes,
      hidden_oracle_result: hiddenOracle?.result,
      hidden_oracle_result_hash: hiddenOracle?.hash,
      agent_result,
      feedback_opportunity_integrity: checkpointFeedbackOpportunityIntegrity({
        run_classification: input.run_classification,
        condition_id: input.condition_id,
        expected_feedback_asset_hashes,
        agent_result
      }),
      timing: {
        checkpoint_ms: elapsedMs(checkpointStartedAt),
        agent_ms: agentMs,
        hidden_oracle_ms: hiddenOracleMs
      }
    };

    await writeJson(join(artifact_dir, "workspace-before.json"), snapshot_before);
    await writeJson(join(artifact_dir, "workspace-after.json"), snapshot_after);
    await writeJson(join(artifact_dir, "manifest.json"), checkpointManifest(checkpointResult));

    checkpoints.push(checkpointResult);
  }

  return {
    condition_id: input.condition_id,
    workspace_path,
    checkpoints
  };
}

async function runConditions(input: {
  condition_ids: ConditionId[];
  concurrency: number;
  runCondition: (condition_id: ConditionId) => Promise<ConditionRunResult>;
}): Promise<ConditionRunResult[]> {
  if (input.concurrency >= input.condition_ids.length) {
    return Promise.all(input.condition_ids.map((condition_id) => input.runCondition(condition_id)));
  }

  const results: ConditionRunResult[] = [];

  for (const condition_id of input.condition_ids) {
    results.push(await input.runCondition(condition_id));
  }

  return results;
}

function normalizeConditionConcurrency(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("budget.condition_concurrency must be a positive integer.");
  }

  return Math.min(value, CONDITION_IDS.length);
}

function elapsedMs(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function runHiddenOracle(input: {
  hidden_oracle: HiddenOracleAdapter;
  task: TaskDefinition;
  condition_id: ConditionId;
  checkpoint_id: CheckpointId;
  workspace_path: string;
  artifact_dir: string;
}): Promise<{ result: HiddenOracleRunResult; hash: string }> {
  assertHiddenOracleOutsideAgentReadableWorkspace(input.task, input.workspace_path);

  const result = await input.hidden_oracle.run({
    condition_id: input.condition_id,
    checkpoint_id: input.checkpoint_id,
    workspace_path: input.workspace_path,
    artifact_dir: input.artifact_dir,
    hidden_oracle_path: input.task.hidden_oracle_path
  });
  const resultPath = join(input.artifact_dir, "hidden-oracle-result.json");

  await writeJson(resultPath, result);

  return {
    result,
    hash: await hashFile(resultPath)
  };
}

function assertHiddenOracleOutsideAgentReadableWorkspace(task: TaskDefinition, workspace_path: string) {
  if (
    isPathInside(task.template_workspace, task.hidden_oracle_path) ||
    isPathInside(workspace_path, task.hidden_oracle_path)
  ) {
    throw new Error("hidden_oracle_path must be outside the agent-readable workspace");
  }
}

function isPathInside(parent: string, child: string): boolean {
  const resolvedParent = resolve(parent);
  const resolvedChild = resolve(child);

  return resolvedChild === resolvedParent || resolvedChild.startsWith(resolvedParent + sep);
}
