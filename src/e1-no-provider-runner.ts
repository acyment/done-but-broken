import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CONDITION_IDS, type ConditionId } from "./conditions";
import { hashProtectedPaths } from "./e1-harness";
import type { E1SealedConstants } from "./e1-l1-constants";
import type {
  E1OpenAICompatibleProviderProfile,
  E1ProviderExchangeRecord,
  E1ProviderSpendRecord
} from "./e1-live-provider";
import {
  E1CheckpointTurnState,
  E1TokenLedger,
  E1TurnAdapter,
  type E1Termination,
  type E1TokenUsage,
  type E1TurnAdapterResult
} from "./e1-turn-adapter";
import {
  isE1SpendCapReachedError,
  normalizeE1ProviderException,
  type E1ProviderAttemptRecord,
  type E1SpendCapSnapshot
} from "./e1-provider-runtime";
import { assertE1NoSecretsInJson, type E1RedactionSecret } from "./e1-redaction";
import {
  stripE1SnapshotFileSections,
  stripE1WorkspaceSnapshotRegions
} from "./e1-workspace-snapshot";
import { captureWorkspaceCode, hashText, hashWorkspace, type WorkspaceCodeSnapshot } from "./snapshot";

export type E1ConversationMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type E1ConversationState = {
  thread_scope: "fresh_per_checkpoint";
  messages: E1ConversationMessage[];
};

export type E1CheckpointPromptInput = {
  taskId: string;
  visibleSpecText: string;
  checkpointSpecText: string;
  workspaceSnapshotText: string;
  workspaceSnapshotHash?: string;
  readmeText?: string;
  feedbackAssetPaths?: string[];
};

export type E1AgentProviderContext = {
  conditionId: ConditionId;
  checkpointId: string;
  turnIndex: number;
  workspacePath: string;
  messages: E1ConversationMessage[];
};

export type E1CheckpointProviderFactoryInput = {
  conditionId: ConditionId;
  checkpointId: string;
  checkpointIndex: number;
};

export type E1AgentProviderResponse = {
  text: string;
  usage?: E1TokenUsage;
  provider_attempts?: E1ProviderAttemptRecord[];
  provider_spend?: E1ProviderSpendRecord;
  provider_exchange?: E1ProviderExchangeRecord;
};

export type E1AgentProviderMetadata =
  | { provider_kind: "scripted" }
  | E1OpenAICompatibleProviderProfile;

export interface E1AgentProvider {
  readonly provider_id: string;
  readonly provider_metadata?: E1AgentProviderMetadata;
  nextTurn(context: E1AgentProviderContext): Promise<E1AgentProviderResponse>;
}

export type ScriptedAgentStep =
  | string
  | E1AgentProviderResponse
  | ((context: E1AgentProviderContext) => string | E1AgentProviderResponse | Promise<string | E1AgentProviderResponse>);

export class ScriptedAgentProvider implements E1AgentProvider {
  readonly provider_id: string;
  private index = 0;

  constructor(private readonly input: { providerId: string; script: ScriptedAgentStep[] }) {
    this.provider_id = input.providerId;
  }

  async nextTurn(context: E1AgentProviderContext): Promise<E1AgentProviderResponse> {
    const step = this.input.script[this.index];
    this.index += 1;

    if (step === undefined) {
      return { text: "<<<DONE>>>" };
    }

    const value = typeof step === "function" ? await step(context) : step;

    return typeof value === "string" ? { text: value } : value;
  }
}

export type E1NoProviderTurnRecord = E1TurnAdapterResult & {
  raw_model_output: string;
  provider_usage?: E1TokenUsage;
  provider_attempts?: E1ProviderAttemptRecord[];
  provider_spend?: E1ProviderSpendRecord;
  provider_exchange?: E1ProviderExchangeRecord;
  conversation_before_turn: E1ConversationMessage[];
  workspace_before_hash: string;
  workspace_after_hash: string;
  workspace_after_code: WorkspaceCodeSnapshot;
};

export type E1CheckpointProviderErrorRecord = {
  turn_index: number;
  classification: "provider_error";
  reason: string;
  attempts: E1ProviderAttemptRecord[];
};

export type E1CheckpointSpendCapRecord = {
  turn_index: number;
  classification: "spend_cap_reached";
  reason: string;
  spend: E1SpendCapSnapshot;
};

export type E1NoProviderCheckpointBundle = {
  schema_version: "e1-no-provider-checkpoint-bundle-v0";
  constants_version: string;
  constants_hash: string;
  agent_provider_id: string;
  thread_scope: "fresh_per_checkpoint";
  run_manifest: {
    condition_id: ConditionId;
    checkpoint_id: string;
    checkpoints: string[];
    task_id: string;
    provider_kind: E1AgentProviderMetadata["provider_kind"];
    provider_profile?: E1AgentProviderMetadata;
    checkpoint_start_workspace_snapshot_hash?: string;
    budget: {
      max_model_turns: number;
      max_verification_executions: number;
      max_checkpoint_tokens?: number;
    };
  };
  initial_conversation: E1ConversationMessage[];
  turn_records: E1NoProviderTurnRecord[];
  provider_error?: E1CheckpointProviderErrorRecord;
  spend_cap_reached?: E1CheckpointSpendCapRecord;
  termination: E1Termination | null;
  final_workspace_hash: string;
  final_workspace_code_hash: string;
};

export type E1ArmConversationDiffValidationResult = {
  ok: boolean;
  context_only_extra_lines: string[];
  feedback_capable_extra_lines: string[];
  context_only_forbidden_matches: string[];
};

export type E1NoProviderArmConfig = {
  conditionId: ConditionId;
  workspacePath: string;
  providerFactory: (input: E1CheckpointProviderFactoryInput) => E1AgentProvider;
};

export type E1NoProviderRunBundle = {
  schema_version: "e1-no-provider-run-bundle-v0";
  constants_version: string;
  constants_hash: string;
  checkpoints: string[];
  arm_bundles: Record<ConditionId, E1NoProviderCheckpointBundle[]>;
  run_summary: {
    status: "completed" | "invalid_integrity" | "provider_error" | "spend_cap_reached";
    stopped_at?: { condition_id: ConditionId; checkpoint_id: string };
    stall_counts_by_condition: Record<ConditionId, number>;
    budget_exhausted_counts_by_condition: Record<ConditionId, number>;
    provider_error_counts_by_condition: Record<ConditionId, number>;
    spend_cap_reached_counts_by_condition: Record<ConditionId, number>;
    verification_slots_used_by_condition: Record<ConditionId, number>;
  };
  structural_comparison: {
    checkpoint_counts_match: boolean;
    condition_ids: ConditionId[];
  };
};

export function assembleE1CheckpointConversation(input: {
  constants: E1SealedConstants;
  conditionId: ConditionId;
  checkpointId: string;
  checkpoints: string[];
  taskId: string;
  visibleSpecText: string;
  checkpointSpecText: string;
  workspaceSnapshotText: string;
  readmeText?: string;
  feedbackAssetPaths?: string[];
}): E1ConversationState {
  const genericVerification = [
    "You may request one verification command per turn with <<<VERIFY>>>.",
    "Allowed self-verification commands: bun test scratch/<test-file>.ts and bun scratch/<script>.ts."
  ];
  const feedbackLines =
    input.conditionId === "feedback_capable_spec"
      ? [
          "Provided executable feedback is available to this condition.",
          "Allowed provided feedback commands: bun run spec and bun run spec -- --cp=<checkpoint>.",
          `Feedback asset paths: ${(input.feedbackAssetPaths ?? []).join(", ") || "(none declared)"}`
        ]
      : ["Self-verification channel: use only the commands listed above."];

  // Message layout follows the two sealed cache breakpoints: the system template ends at
  // system_template_boundary, and the second message ends at checkpoint_start_repo_injection.
  return {
    thread_scope: input.constants.conversation.thread_scope,
    messages: [
      {
        role: "system",
        content: [
          "You are an E1 turn-based coding agent.",
          "Use protocol blocks exactly: <<<FILE path>>>, <<<VERIFY>>>, and <<<DONE>>>.",
          "All edits must be full-file replacements. Unified diffs are not accepted.",
          "Every protocol delimiter must be alone on its own line with no leading spaces and no trailing content.",
          "Open file blocks with exactly <<<FILE relative/path.ts>>> on one line; file content starts on the next line.",
          "Open verification blocks with exactly <<<VERIFY>>> on one line; put the command on the next line.",
          "Never write inline blocks such as <<<VERIFY>>>command<<<END>>> or <<<FILE path>>>content.",
          "Every <<<FILE path>>> or <<<VERIFY>>> block must close with <<<END>>> on its own line before any <<<DONE>>> token.",
          "When finished, write exactly <<<DONE>>> on its own line."
        ].join("\n")
      },
      {
        role: "user",
        content: [
          `Thread scope: ${input.constants.conversation.thread_scope}.`,
          `Prior checkpoint memory: ${input.constants.conversation.prior_checkpoint_memory}.`,
          "This is a fresh conversation for this checkpoint; prior checkpoint chat transcript is intentionally absent.",
          `Task: ${input.taskId}`,
          "",
          "README / Instructions:",
          input.readmeText ?? "(none)",
          "",
          "Workspace Snapshot:",
          input.workspaceSnapshotText
        ].join("\n")
      },
      {
        role: "user",
        content: [
          `Checkpoint: ${input.checkpointId} of ${input.checkpoints.join(", ")}`,
          "",
          "Visible Semantic Spec:",
          input.visibleSpecText,
          "",
          "Checkpoint Spec:",
          input.checkpointSpecText,
          "",
          ...genericVerification,
          ...feedbackLines
        ].join("\n")
      }
    ]
  };
}

export function validateE1ArmConversationDiff(input: {
  constants: E1SealedConstants;
  context: E1ConversationState;
  feedback: E1ConversationState;
  feedbackAssetPaths?: string[];
  stripWorkspaceSnapshots?: boolean;
}): E1ArmConversationDiffValidationResult {
  const context = input.stripWorkspaceSnapshots
    ? mapConversationContent(input.context, stripE1WorkspaceSnapshotRegions)
    : input.context;
  const feedback = input.stripWorkspaceSnapshots
    ? mapConversationContent(input.feedback, stripE1WorkspaceSnapshotRegions)
    : input.feedbackAssetPaths?.length
      ? mapConversationContent(input.feedback, (content) =>
          stripE1SnapshotFileSections(content, input.feedbackAssetPaths!)
        )
      : input.feedback;
  const contextLines = conversationLines(context);
  const feedbackLines = conversationLines(feedback);
  const contextOnlyLines = linesOnlyInLeft(contextLines, feedbackLines);
  const feedbackOnlyLines = linesOnlyInLeft(feedbackLines, contextLines);
  const allowlist = input.constants.arm_difference_allowlist;
  const contextOnlyExtraLines = contextOnlyLines.filter(
    (line) => !allowlist.context_only_exact_lines.includes(line)
  );
  const feedbackCapableExtraLines = feedbackOnlyLines.filter(
    (line) =>
      !allowlist.feedback_capable_exact_lines.includes(line) &&
      !allowlist.feedback_capable_line_prefixes.some((prefix) => line.startsWith(prefix))
  );
  const lowerContext = contextLines.join("\n").toLowerCase();
  const contextOnlyForbiddenMatches = allowlist.context_only_forbidden_substrings.filter((substring) =>
    lowerContext.includes(substring.toLowerCase())
  );

  return {
    ok:
      contextOnlyExtraLines.length === 0 &&
      feedbackCapableExtraLines.length === 0 &&
      contextOnlyForbiddenMatches.length === 0,
    context_only_extra_lines: contextOnlyExtraLines,
    feedback_capable_extra_lines: feedbackCapableExtraLines,
    context_only_forbidden_matches: contextOnlyForbiddenMatches
  };
}

export function appendE1TurnExchange(
  conversation: E1ConversationState,
  rawModelOutput: string,
  nextTurnInjections: string[]
): E1ConversationState {
  return {
    thread_scope: conversation.thread_scope,
    messages: [
      ...conversation.messages,
      { role: "assistant", content: rawModelOutput },
      {
        role: "user",
        content: nextTurnInjections.length
          ? `Harness output for next turn:\n${nextTurnInjections.join("\n\n")}`
          : "Harness output for next turn:\n(no harness output)"
      }
    ]
  };
}

export async function runE1NoProviderCheckpoint(input: {
  constants: E1SealedConstants;
  workspacePath: string;
  conditionId: ConditionId;
  checkpointId: string;
  checkpoints: string[];
  provider: E1AgentProvider;
  prompt: E1CheckpointPromptInput;
  artifactDir?: string;
  maxModelTurns?: number;
  maxVerificationExecutions?: number;
  maxCheckpointTokens?: number;
  timeoutMs?: number;
  outputLimit?: number;
  redactionSecrets?: E1RedactionSecret[];
}): Promise<E1NoProviderCheckpointBundle> {
  const protectedPathBaseline = await hashProtectedPaths(input.workspacePath);
  const maxModelTurns = input.maxModelTurns ?? input.constants.turn_protocol.max_turns_per_checkpoint;
  const maxVerificationExecutions =
    input.maxVerificationExecutions ??
    input.constants.turn_protocol.max_verification_executions_per_checkpoint;
  const state = new E1CheckpointTurnState({
    maxModelTurns,
    maxVerificationExecutions,
    tokenLedger: new E1TokenLedger({ maxCheckpointTokens: input.maxCheckpointTokens })
  });
  const adapter = new E1TurnAdapter({
    constants: input.constants,
    workspacePath: input.workspacePath,
    protectedPathBaseline,
    timeoutMs: input.timeoutMs,
    outputLimit: input.outputLimit ?? input.constants.turn_protocol.verification_output_token_cap
  });
  let conversation = assembleE1CheckpointConversation({
    constants: input.constants,
    conditionId: input.conditionId,
    checkpointId: input.checkpointId,
    checkpoints: input.checkpoints,
    ...input.prompt
  });
  const initialConversation = conversation.messages;
  const turnRecords: E1NoProviderTurnRecord[] = [];
  let providerError: E1CheckpointProviderErrorRecord | undefined;
  let spendCapReached: E1CheckpointSpendCapRecord | undefined;
  let termination: E1Termination | null = null;
  const providerMetadata = input.provider.provider_metadata ?? { provider_kind: "scripted" as const };

  while (!termination && state.turnsUsed < state.maxModelTurns) {
    const turnIndex = state.turnsUsed + 1;
    const workspaceBefore = await hashWorkspace(input.workspacePath);
    let response: E1AgentProviderResponse;

    try {
      response = await input.provider.nextTurn({
        conditionId: input.conditionId,
        checkpointId: input.checkpointId,
        turnIndex,
        workspacePath: input.workspacePath,
        messages: conversation.messages
      });
    } catch (error) {
      if (isE1SpendCapReachedError(error)) {
        spendCapReached = {
          turn_index: turnIndex,
          classification: "spend_cap_reached",
          reason: error.message,
          spend: error.spend
        };
        termination = { classification: "spend_cap_reached", reason: error.message };
        break;
      }

      const normalized = normalizeE1ProviderException(error);
      providerError = {
        turn_index: turnIndex,
        classification: "provider_error",
        reason: normalized.reason,
        attempts: normalized.attempts
      };
      termination = { classification: "provider_error", reason: normalized.reason };
      break;
    }

    const adapterResult = await adapter.runTurn({
      conditionId: input.conditionId,
      checkpointId: input.checkpointId,
      checkpoints: input.checkpoints,
      rawModelOutput: response.text,
      state,
      tokenUsage: response.usage
    });
    const workspaceAfter = await hashWorkspace(input.workspacePath);
    const workspaceAfterCode = await captureWorkspaceCode(input.workspacePath);

    turnRecords.push({
      ...adapterResult,
      raw_model_output: response.text,
      ...(response.usage ? { provider_usage: response.usage } : {}),
      ...(response.provider_attempts ? { provider_attempts: response.provider_attempts } : {}),
      ...(response.provider_spend ? { provider_spend: response.provider_spend } : {}),
      ...(response.provider_exchange ? { provider_exchange: response.provider_exchange } : {}),
      conversation_before_turn: conversation.messages,
      workspace_before_hash: workspaceBefore.hash,
      workspace_after_hash: workspaceAfter.hash,
      workspace_after_code: workspaceAfterCode
    });

    termination = adapterResult.termination;
    conversation = appendE1TurnExchange(conversation, response.text, adapterResult.next_turn_injections);
  }

  if (!termination && state.turnsUsed >= state.maxModelTurns) {
    termination = { classification: "budget_exhausted", reason: "model turn budget exhausted" };
  }

  const finalWorkspace = await hashWorkspace(input.workspacePath);
  const finalWorkspaceCode = await captureWorkspaceCode(input.workspacePath);
  const bundle: E1NoProviderCheckpointBundle = {
    schema_version: "e1-no-provider-checkpoint-bundle-v0",
    constants_version: input.constants.version,
    constants_hash: hashText(JSON.stringify(input.constants)),
    agent_provider_id: input.provider.provider_id,
    thread_scope: conversation.thread_scope,
    run_manifest: {
      condition_id: input.conditionId,
      checkpoint_id: input.checkpointId,
      checkpoints: input.checkpoints,
      task_id: input.prompt.taskId,
      provider_kind: providerMetadata.provider_kind,
      ...(providerMetadata.provider_kind !== "scripted" ? { provider_profile: providerMetadata } : {}),
      ...(input.prompt.workspaceSnapshotHash
        ? { checkpoint_start_workspace_snapshot_hash: input.prompt.workspaceSnapshotHash }
        : {}),
      budget: {
        max_model_turns: maxModelTurns,
        max_verification_executions: maxVerificationExecutions,
        ...(input.maxCheckpointTokens !== undefined
          ? { max_checkpoint_tokens: input.maxCheckpointTokens }
          : {})
      }
    },
    initial_conversation: initialConversation,
    turn_records: turnRecords,
    ...(providerError ? { provider_error: providerError } : {}),
    ...(spendCapReached ? { spend_cap_reached: spendCapReached } : {}),
    termination,
    final_workspace_hash: finalWorkspace.hash,
    final_workspace_code_hash: finalWorkspaceCode.hash
  };

  assertE1NoSecretsInJson(bundle, input.redactionSecrets ?? []);

  if (input.artifactDir) {
    await mkdir(input.artifactDir, { recursive: true });
    await writeFile(join(input.artifactDir, "checkpoint-bundle.json"), `${JSON.stringify(bundle, null, 2)}\n`);
  }

  return bundle;
}

export async function replayE1NoProviderCheckpointBundle(input: {
  constants: E1SealedConstants;
  workspacePath: string;
  bundle: E1NoProviderCheckpointBundle;
}): Promise<{ final_workspace_hash: string; final_workspace_code_hash: string }> {
  const protectedPathBaseline = await hashProtectedPaths(input.workspacePath);
  const state = new E1CheckpointTurnState({
    maxModelTurns: input.bundle.run_manifest.budget.max_model_turns,
    maxVerificationExecutions: input.bundle.run_manifest.budget.max_verification_executions,
    tokenLedger: new E1TokenLedger({
      maxCheckpointTokens: input.bundle.run_manifest.budget.max_checkpoint_tokens
    })
  });
  const adapter = new E1TurnAdapter({
    constants: input.constants,
    workspacePath: input.workspacePath,
    protectedPathBaseline,
    outputLimit: input.constants.turn_protocol.verification_output_token_cap
  });

  for (const record of input.bundle.turn_records) {
    await adapter.runTurn({
      conditionId: input.bundle.run_manifest.condition_id,
      checkpointId: input.bundle.run_manifest.checkpoint_id,
      checkpoints: input.bundle.run_manifest.checkpoints,
      rawModelOutput: record.raw_model_output,
      state,
      tokenUsage: record.provider_usage
    });
  }

  return {
    final_workspace_hash: (await hashWorkspace(input.workspacePath)).hash,
    final_workspace_code_hash: (await captureWorkspaceCode(input.workspacePath)).hash
  };
}

export async function runE1NoProviderRun(input: {
  constants: E1SealedConstants;
  checkpoints: string[];
  arms: E1NoProviderArmConfig[];
  promptFactory: (input: {
    conditionId: ConditionId;
    checkpointId: string;
    checkpointIndex: number;
  }) => E1CheckpointPromptInput | Promise<E1CheckpointPromptInput>;
  artifactDir?: string;
  maxModelTurns?: number;
  maxVerificationExecutions?: number;
  maxCheckpointTokens?: number;
  timeoutMs?: number;
  outputLimit?: number;
  redactionSecrets?: E1RedactionSecret[];
}): Promise<E1NoProviderRunBundle> {
  const arms = orderedUniqueArms(input.arms);
  const armBundles = emptyArmBundleRecord();
  const stallCounts = emptyConditionNumberRecord();
  const budgetExhaustedCounts = emptyConditionNumberRecord();
  const providerErrorCounts = emptyConditionNumberRecord();
  const spendCapReachedCounts = emptyConditionNumberRecord();
  const verificationSlots = emptyConditionNumberRecord();
  let stoppedAt: { condition_id: ConditionId; checkpoint_id: string } | undefined;
  let runStatus: E1NoProviderRunBundle["run_summary"]["status"] = "completed";

  for (let checkpointIndex = 0; checkpointIndex < input.checkpoints.length; checkpointIndex += 1) {
    const checkpointId = input.checkpoints[checkpointIndex];
    const promptsByCondition = {} as Record<ConditionId, E1CheckpointPromptInput>;

    for (const arm of arms) {
      promptsByCondition[arm.conditionId] = await input.promptFactory({
        conditionId: arm.conditionId,
        checkpointId,
        checkpointIndex
      });
    }

    validateE1RuntimeArmParity({
      constants: input.constants,
      checkpointId,
      checkpoints: input.checkpoints,
      promptsByCondition
    });

    for (const arm of arms) {
      const checkpointBundle = await runE1NoProviderCheckpoint({
        constants: input.constants,
        workspacePath: arm.workspacePath,
        conditionId: arm.conditionId,
        checkpointId,
        checkpoints: input.checkpoints,
        provider: arm.providerFactory({
          conditionId: arm.conditionId,
          checkpointId,
          checkpointIndex
        }),
        prompt: promptsByCondition[arm.conditionId],
        artifactDir: input.artifactDir
          ? join(input.artifactDir, arm.conditionId, `checkpoint-${checkpointId}`)
          : undefined,
        maxModelTurns: input.maxModelTurns,
        maxVerificationExecutions: input.maxVerificationExecutions,
        maxCheckpointTokens: input.maxCheckpointTokens,
        timeoutMs: input.timeoutMs,
        outputLimit: input.outputLimit,
        redactionSecrets: input.redactionSecrets
      });

      armBundles[arm.conditionId].push(checkpointBundle);
      verificationSlots[arm.conditionId] += lastVerificationSlotCount(checkpointBundle);

      if (checkpointBundle.termination?.classification === "agent_stalled") {
        stallCounts[arm.conditionId] += 1;
      }

      if (checkpointBundle.termination?.classification === "budget_exhausted") {
        budgetExhaustedCounts[arm.conditionId] += 1;
      }

      if (checkpointBundle.termination?.classification === "provider_error") {
        providerErrorCounts[arm.conditionId] += 1;
        runStatus = "provider_error";
        stoppedAt = { condition_id: arm.conditionId, checkpoint_id: checkpointId };
        break;
      }

      if (checkpointBundle.termination?.classification === "spend_cap_reached") {
        spendCapReachedCounts[arm.conditionId] += 1;
        runStatus = "spend_cap_reached";
        stoppedAt = { condition_id: arm.conditionId, checkpoint_id: checkpointId };
        break;
      }

      if (checkpointBundle.termination?.classification === "invalid_integrity") {
        runStatus = "invalid_integrity";
        stoppedAt = { condition_id: arm.conditionId, checkpoint_id: checkpointId };
        break;
      }
    }

    if (stoppedAt) {
      break;
    }
  }

  const bundle: E1NoProviderRunBundle = {
    schema_version: "e1-no-provider-run-bundle-v0",
    constants_version: input.constants.version,
    constants_hash: hashText(JSON.stringify(input.constants)),
    checkpoints: input.checkpoints,
    arm_bundles: armBundles,
    run_summary: {
      status: runStatus,
      ...(stoppedAt ? { stopped_at: stoppedAt } : {}),
      stall_counts_by_condition: stallCounts,
      budget_exhausted_counts_by_condition: budgetExhaustedCounts,
      provider_error_counts_by_condition: providerErrorCounts,
      spend_cap_reached_counts_by_condition: spendCapReachedCounts,
      verification_slots_used_by_condition: verificationSlots
    },
    structural_comparison: {
      checkpoint_counts_match: new Set(Object.values(armBundles).map((bundles) => bundles.length)).size === 1,
      condition_ids: CONDITION_IDS.slice()
    }
  };

  assertE1NoSecretsInJson(bundle, input.redactionSecrets ?? []);

  if (input.artifactDir) {
    await mkdir(input.artifactDir, { recursive: true });
    await writeFile(join(input.artifactDir, "run-bundle.json"), `${JSON.stringify(bundle, null, 2)}\n`);
  }

  return bundle;
}

function conversationLines(conversation: E1ConversationState): string[] {
  return conversation.messages.flatMap((message) => message.content.split("\n")).filter((line) => line !== "");
}

export function validateE1RuntimeArmParity(input: {
  constants: E1SealedConstants;
  checkpointId: string;
  checkpoints: string[];
  promptsByCondition: Record<ConditionId, E1CheckpointPromptInput>;
}): void {
  // Snapshot content legitimately diverges between arms once agents have edited their own
  // workspaces, so runtime parity strips snapshot regions and validates the template remainder.
  const diff = validateE1ArmConversationDiff({
    constants: input.constants,
    context: assembleE1CheckpointConversation({
      constants: input.constants,
      conditionId: "context_only_spec",
      checkpointId: input.checkpointId,
      checkpoints: input.checkpoints,
      ...input.promptsByCondition.context_only_spec
    }),
    feedback: assembleE1CheckpointConversation({
      constants: input.constants,
      conditionId: "feedback_capable_spec",
      checkpointId: input.checkpointId,
      checkpoints: input.checkpoints,
      ...input.promptsByCondition.feedback_capable_spec
    }),
    stripWorkspaceSnapshots: true
  });

  if (!diff.ok) {
    throw new Error(
      `E1 runtime arm parity failed at checkpoint ${input.checkpointId}: ${JSON.stringify(diff)}`
    );
  }
}

function mapConversationContent(
  conversation: E1ConversationState,
  transform: (content: string) => string
): E1ConversationState {
  return {
    thread_scope: conversation.thread_scope,
    messages: conversation.messages.map((message) => ({ ...message, content: transform(message.content) }))
  };
}

function linesOnlyInLeft(left: string[], right: string[]): string[] {
  const rightCounts = countLines(right);
  const only: string[] = [];

  for (const line of left) {
    const count = rightCounts.get(line) ?? 0;

    if (count > 0) {
      rightCounts.set(line, count - 1);
      continue;
    }

    only.push(line);
  }

  return only;
}

function countLines(lines: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const line of lines) {
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }

  return counts;
}

function orderedUniqueArms(arms: E1NoProviderArmConfig[]): E1NoProviderArmConfig[] {
  const byCondition = new Map(arms.map((arm) => [arm.conditionId, arm]));

  if (byCondition.size !== arms.length) {
    throw new Error("E1 no-provider run arms must not contain duplicate condition IDs.");
  }

  for (const conditionId of CONDITION_IDS) {
    if (!byCondition.has(conditionId)) {
      throw new Error(`E1 no-provider run missing arm: ${conditionId}`);
    }
  }

  return CONDITION_IDS.map((conditionId) => byCondition.get(conditionId)!);
}

function emptyArmBundleRecord(): Record<ConditionId, E1NoProviderCheckpointBundle[]> {
  return {
    context_only_spec: [],
    feedback_capable_spec: []
  };
}

function emptyConditionNumberRecord(): Record<ConditionId, number> {
  return {
    context_only_spec: 0,
    feedback_capable_spec: 0
  };
}

function lastVerificationSlotCount(bundle: E1NoProviderCheckpointBundle): number {
  const lastTurn = bundle.turn_records.at(-1);

  return lastTurn?.verification_budget.used ?? 0;
}
