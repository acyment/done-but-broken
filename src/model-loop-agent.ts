import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { promisify } from "node:util";
import {
  DEFAULT_OPENROUTER_REQUEST_TIMEOUT_MS,
  DEFAULT_OPENROUTER_ENDPOINT,
  DEFAULT_OPENROUTER_MODEL,
  classifyOpenRouterError,
  type FetchLike
} from "./openrouter-agent";
import {
  isRecord,
  parseJson,
  renderWorkspaceContext,
  requestHeaders,
  stripJsonFence,
  toWorkspacePath,
  type WorkspaceContext
} from "./agent-shared";
import type { RunValidityDetail, RunValidityFlag } from "./provenance";
import type { AgentAdapter, AgentRunInput, AgentRunResult, AgentTranscriptEvent } from "./runner";

const execFileAsync = promisify(execFile);
const DEFAULT_MAX_WORKSPACE_BYTES = 256_000;
const DEFAULT_FEEDBACK_OUTPUT_BYTES = 12_000;

export const DEFAULT_MODEL_LOOP_POLICY = {
  max_model_turns: 3,
  max_feedback_runs: 2
} as const;

export const OPENROUTER_MODEL_LOOP_RESPONSE_SCHEMA_VERSION = "model-loop-response-json-schema-v1";

export type OpenRouterResponseFormat = "none" | "json_schema";
export type OpenAiCompatibleResponseFormat = OpenRouterResponseFormat;

export type ModelLoopCall = {
  turn_index: number;
  condition_id: AgentRunInput["condition_id"];
  checkpoint_id: string;
  prompt: string;
  feedback_available: boolean;
  feedback_summaries: string[];
};

export type ModelLoopResponse = {
  status?: "ok" | "failed";
  notes?: string;
  files?: Array<{
    path: string;
    content: string;
  }>;
  transcript?: AgentTranscriptEvent[];
  validity_flags?: RunValidityFlag[];
  validity_details?: RunValidityDetail[];
};

export type ModelLoopModel = (input: ModelLoopCall) => Promise<ModelLoopResponse | string>;

export type FeedbackCommandRunInput = {
  command: string;
  workspace_path: string;
};

export type FeedbackCommandRunResult = {
  command: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  summary?: string;
};

export type FeedbackCommandRunner = (
  input: FeedbackCommandRunInput
) => Promise<FeedbackCommandRunResult>;

export type ModelLoopAgentOptions = {
  adapter_id?: string;
  model: ModelLoopModel;
  feedbackRunner?: FeedbackCommandRunner;
  max_model_turns?: number;
  max_feedback_runs?: number;
  maxWorkspaceBytes?: number;
  maxFeedbackOutputBytes?: number;
};

export type OpenRouterFeedbackLoopAgentOptions = {
  apiKey: string;
  model?: string;
  endpoint?: string;
  appTitle?: string;
  siteUrl?: string;
  maxTokens?: number;
  temperature?: number;
  max_model_turns?: number;
  max_feedback_runs?: number;
  maxWorkspaceBytes?: number;
  maxFeedbackOutputBytes?: number;
  responseFormat?: OpenRouterResponseFormat;
  requireParameters?: boolean;
  maxProviderRetries?: number;
  requestTimeoutMs?: number;
  fetch?: FetchLike;
};

export type OpenAiCompatibleFeedbackLoopAgentOptions = {
  provider: string;
  apiKey: string;
  model: string;
  endpoint: string;
  appTitle?: string;
  siteUrl?: string;
  maxTokens?: number;
  temperature?: number;
  max_model_turns?: number;
  max_feedback_runs?: number;
  maxWorkspaceBytes?: number;
  maxFeedbackOutputBytes?: number;
  responseFormat?: OpenAiCompatibleResponseFormat;
  providerParameters?: Record<string, unknown>;
  maxProviderRetries?: number;
  requestTimeoutMs?: number;
  fetch?: FetchLike;
};

export function createModelLoopAgent(options: ModelLoopAgentOptions): AgentAdapter {
  const max_model_turns = options.max_model_turns ?? DEFAULT_MODEL_LOOP_POLICY.max_model_turns;
  const max_feedback_runs = options.max_feedback_runs ?? DEFAULT_MODEL_LOOP_POLICY.max_feedback_runs;
  const maxWorkspaceBytes = options.maxWorkspaceBytes ?? DEFAULT_MAX_WORKSPACE_BYTES;
  const maxFeedbackOutputBytes = options.maxFeedbackOutputBytes ?? DEFAULT_FEEDBACK_OUTPUT_BYTES;
  const feedbackRunner = options.feedbackRunner ?? runVisibleFeedbackCommand;

  if (max_model_turns < 1) {
    throw new Error("max_model_turns must be at least 1.");
  }

  if (max_feedback_runs < 0) {
    throw new Error("max_feedback_runs cannot be negative.");
  }

  return {
    async run(input): Promise<AgentRunResult> {
      const feedbackAvailable = Boolean(
        input.condition_id === "feedback_capable_spec" && input.packet.feedback_command
      );
      const feedbackCommand = feedbackAvailable ? input.packet.feedback_command : undefined;
      const feedbackSummaries: string[] = [];
      const transcript: AgentTranscriptEvent[] = [];
      const finalFileWrites: string[] = [];
      const providerValidityDetails: RunValidityDetail[] = [];
      let feedbackRuns = 0;
      let modelTurns = 0;
      let currentTurnStartedAt = Date.now();

      try {
        for (let turn = 1; turn <= max_model_turns; turn += 1) {
          modelTurns = turn;
          currentTurnStartedAt = Date.now();
          const workspaceContext = await renderWorkspaceContext(input.workspace_path, maxWorkspaceBytes);
          const prompt = buildTurnPrompt({
            input,
            turn,
            feedbackAvailable,
            feedbackSummaries,
            workspaceContext
          });
          const modelResponse = await normalizeModelResponse(
            await options.model({
              turn_index: turn,
              condition_id: input.condition_id,
              checkpoint_id: input.checkpoint_id,
              prompt,
              feedback_available: feedbackAvailable,
              feedback_summaries: feedbackSummaries
            })
          );
          providerValidityDetails.push(...(modelResponse.validity_details ?? []));
          const writtenPaths = await applyReturnedFiles(
            input.workspace_path,
            modelResponse.files ?? [],
            input.packet.executable_feedback_paths
          );

          finalFileWrites.push(...writtenPaths);
          transcript.push(
            {
              event: "model_turn",
              detail: `turn=${turn} writes=${writtenPaths.join(", ") || "none"}`
            },
            ...(modelResponse.transcript ?? [])
          );

          if (feedbackAvailable && feedbackCommand && feedbackRuns < max_feedback_runs && turn < max_model_turns) {
            const feedbackResult = await feedbackRunner({
              command: feedbackCommand,
              workspace_path: input.workspace_path
            });
            const feedbackSummary = summarizeFeedbackResult(
              feedbackResult,
              input.workspace_path,
              maxFeedbackOutputBytes
            );

            feedbackRuns += 1;
            feedbackSummaries.push(feedbackSummary);
            transcript.push({
              event: "feedback_run",
              detail: `run=${feedbackRuns} exit_code=${feedbackResult.exit_code}`
            });
          }
        }

        return {
          status: "ok",
          adapter_id: options.adapter_id ?? "model-loop",
          notes: `model loop completed ${modelTurns} turn(s)`,
          transcript,
          model_turns: modelTurns,
          max_model_turns,
          feedback_runs: feedbackRuns,
          max_feedback_runs,
          feedback_available: feedbackAvailable,
          feedback_command: feedbackCommand,
          feedback_summaries: feedbackSummaries,
          final_file_writes: finalFileWrites,
          feedback_assets_modified: false,
          validity_flags: uniqueValidityFlags(providerValidityDetails),
          validity_details: providerValidityDetails.length > 0 ? providerValidityDetails : undefined
        };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const feedbackAssetMutation = detail.includes("read-only feedback asset");
        const providerError = error instanceof ModelLoopProviderError ? error : undefined;
        const validityFlag = feedbackAssetMutation
          ? undefined
          : providerError?.validityDetails[0]?.flag ?? classifyOpenRouterError(detail);
        const workspaceCarriedForward = validityFlag !== undefined && finalFileWrites.length === 0;
        const modelResponseReceived = modelResponseWasReceived(validityFlag, detail);
        const terminalValidityDetails = providerError
          ? adjustTerminalProviderDetails(providerError.validityDetails, {
              codeChanged: finalFileWrites.length > 0,
              workspaceCarriedForward
            })
          : validityFlag
            ? [
                {
                  flag: validityFlag,
                  scope: "checkpoint" as const,
                  condition_id: input.condition_id,
                  checkpoint_id: input.checkpoint_id,
                  provider: "openrouter",
                  message: detail,
                  retryable: isRetryableProviderFailure(validityFlag),
                  provider_failure_phase:
                    validityFlag === "provider_timeout"
                      ? classifyProviderFailurePhase({
                          feedbackAvailable,
                          feedbackRuns,
                          modelTurns
                        })
                      : undefined,
                  model_turn_number: modelTurns || undefined,
                  feedback_had_run: feedbackRuns > 0,
                  model_response_received: modelResponseReceived,
                  code_changed: finalFileWrites.length > 0,
                  workspace_carried_forward_due_to_provider_failure: workspaceCarriedForward,
                  retry_count: 0,
                  elapsed_ms: Math.max(0, Date.now() - currentTurnStartedAt)
                }
              ]
            : [];
        const validityDetails = [...providerValidityDetails, ...terminalValidityDetails];

        return {
          status: "failed",
          adapter_id: options.adapter_id ?? "model-loop",
          notes: detail,
          transcript: [
            ...transcript,
            {
              event: "model_loop_error",
              detail
            }
          ],
          model_turns: modelTurns,
          max_model_turns,
          feedback_runs: feedbackRuns,
          max_feedback_runs,
          feedback_available: feedbackAvailable,
          feedback_command: feedbackCommand,
          feedback_summaries: feedbackSummaries,
          final_file_writes: finalFileWrites,
          feedback_assets_modified: feedbackAssetMutation,
          workspace_carried_forward_due_to_provider_failure: workspaceCarriedForward,
          validity_flags: uniqueValidityFlags(validityDetails),
          validity_details: validityDetails.length > 0 ? validityDetails : undefined
        };
      }
    }
  };
}

function classifyProviderFailurePhase(input: {
  feedbackAvailable: boolean;
  feedbackRuns: number;
  modelTurns: number;
}) {
  if (input.feedbackAvailable && input.feedbackRuns > 0 && input.modelTurns > 1) {
    return "repair_turn_timeout" as const;
  }

  return "pre_model_action_timeout" as const;
}

function modelResponseWasReceived(validityFlag: ReturnType<typeof classifyOpenRouterError> | undefined, detail: string): boolean {
  if (validityFlag !== "provider_malformed_response") {
    return false;
  }

  return (
    detail.includes("Model loop JSON") ||
    detail.includes("provider response") ||
    detail.includes("response") ||
    detail.includes("message content")
  );
}

class ModelLoopProviderError extends Error {
  constructor(message: string, readonly validityDetails: RunValidityDetail[]) {
    super(message);
    this.name = "ModelLoopProviderError";
  }
}

function uniqueValidityFlags(details: RunValidityDetail[]): RunValidityFlag[] | undefined {
  if (details.length === 0) {
    return undefined;
  }

  return [...new Set(details.map((detail) => detail.flag))];
}

function isRetryableProviderFailure(flag: RunValidityFlag): boolean {
  return (
    flag === "provider_timeout" ||
    flag === "provider_quota_or_rate_limit" ||
    flag === "provider_malformed_response"
  );
}

function adjustTerminalProviderDetails(
  details: RunValidityDetail[],
  input: {
    codeChanged: boolean;
    workspaceCarriedForward: boolean;
  }
): RunValidityDetail[] {
  return details.map((detail) => ({
    ...detail,
    code_changed: input.codeChanged,
    workspace_carried_forward_due_to_provider_failure: input.workspaceCarriedForward
  }));
}

export function createOpenRouterFeedbackLoopAgent(
  options: OpenRouterFeedbackLoopAgentOptions
): AgentAdapter {
  const apiKey = options.apiKey.trim();
  const model = options.model ?? DEFAULT_OPENROUTER_MODEL;
  const endpoint = options.endpoint ?? DEFAULT_OPENROUTER_ENDPOINT;
  const maxTokens = options.maxTokens ?? 16_000;
  const temperature = options.temperature ?? 0.2;
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_OPENROUTER_REQUEST_TIMEOUT_MS;
  const responseFormat = options.responseFormat ?? "none";
  const requireParameters = options.requireParameters ?? false;
  const maxProviderRetries = options.maxProviderRetries ?? 0;
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required for the OpenRouter feedback-loop agent adapter.");
  }

  if (!fetchImpl) {
    throw new Error("No fetch implementation is available for the OpenRouter feedback-loop agent adapter.");
  }

  if (!Number.isInteger(maxProviderRetries) || maxProviderRetries < 0) {
    throw new Error("maxProviderRetries must be a non-negative integer.");
  }

  return createModelLoopAgent({
    adapter_id: `openrouter-loop:${model}`,
    max_model_turns: options.max_model_turns,
    max_feedback_runs: options.max_feedback_runs,
    maxWorkspaceBytes: options.maxWorkspaceBytes,
    maxFeedbackOutputBytes: options.maxFeedbackOutputBytes,
    model: async (call) =>
      requestChatCompletionsModelLoopResponse({
        call,
        provider: "openrouter",
        providerDisplayName: "OpenRouter",
        fetchImpl,
        endpoint,
        requestTimeoutMs,
        apiKey,
        appTitle: options.appTitle,
        siteUrl: options.siteUrl,
        model,
        maxTokens,
        temperature,
        responseFormat,
        providerParameters: requireParameters ? { require_parameters: true } : undefined,
        maxProviderRetries
      })
  });
}

export function createOpenAiCompatibleFeedbackLoopAgent(
  options: OpenAiCompatibleFeedbackLoopAgentOptions
): AgentAdapter {
  const provider = sanitizeProviderLabel(options.provider);
  const apiKey = options.apiKey.trim();
  const model = options.model.trim();
  const endpoint = options.endpoint.trim();
  const maxTokens = options.maxTokens ?? 16_000;
  const temperature = options.temperature ?? 0.2;
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_OPENROUTER_REQUEST_TIMEOUT_MS;
  const responseFormat = options.responseFormat ?? "none";
  const maxProviderRetries = options.maxProviderRetries ?? 0;
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (!apiKey) {
    throw new Error(`${provider.toUpperCase()} API key is required for the OpenAI-compatible feedback-loop agent adapter.`);
  }

  if (!model) {
    throw new Error("model is required for the OpenAI-compatible feedback-loop agent adapter.");
  }

  if (!endpoint) {
    throw new Error("endpoint is required for the OpenAI-compatible feedback-loop agent adapter.");
  }

  if (!fetchImpl) {
    throw new Error("No fetch implementation is available for the OpenAI-compatible feedback-loop agent adapter.");
  }

  if (!Number.isInteger(maxProviderRetries) || maxProviderRetries < 0) {
    throw new Error("maxProviderRetries must be a non-negative integer.");
  }

  return createModelLoopAgent({
    adapter_id: `openai-compatible-loop:${provider}:${model}`,
    max_model_turns: options.max_model_turns,
    max_feedback_runs: options.max_feedback_runs,
    maxWorkspaceBytes: options.maxWorkspaceBytes,
    maxFeedbackOutputBytes: options.maxFeedbackOutputBytes,
    model: async (call) =>
      requestChatCompletionsModelLoopResponse({
        call,
        provider,
        providerDisplayName: provider,
        fetchImpl,
        endpoint,
        requestTimeoutMs,
        apiKey,
        appTitle: options.appTitle,
        siteUrl: options.siteUrl,
        model,
        maxTokens,
        temperature,
        responseFormat,
        providerParameters: options.providerParameters,
        maxProviderRetries
      })
  });
}

async function requestChatCompletionsModelLoopResponse(input: {
  call: ModelLoopCall;
  provider: string;
  providerDisplayName: string;
  fetchImpl: FetchLike;
  endpoint: string;
  requestTimeoutMs: number;
  apiKey: string;
  appTitle?: string;
  siteUrl?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  responseFormat: OpenAiCompatibleResponseFormat;
  providerParameters?: Record<string, unknown>;
  maxProviderRetries: number;
}): Promise<ModelLoopResponse> {
  const failedAttemptDetails: RunValidityDetail[] = [];

  for (let attempt = 0; attempt <= input.maxProviderRetries; attempt += 1) {
    const attemptStartedAt = Date.now();

    try {
      const requestBody = {
        model: input.model,
        messages: [
          {
            role: "system",
            content: [
              "You are running inside a bounded benchmark harness.",
              "Return only JSON. Do not wrap it in prose.",
              "Use empty strings or empty arrays when a field has no useful value.",
              "The JSON shape is:",
              '{"status":"ok","notes":"short summary","files":[{"path":"relative/path","content":"full file content"}],"transcript":[{"event":"short_event","detail":"optional detail"}]}'
            ].join("\n")
          },
          {
            role: "user",
            content: input.call.prompt
          }
        ],
        stream: false,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
        ...(input.responseFormat === "json_schema"
          ? { response_format: modelLoopResponseFormatJsonSchema() }
          : {}),
        ...(input.providerParameters ? { provider: input.providerParameters } : {})
      };

      const { response, responseText } = await fetchProviderResponse({
        fetchImpl: input.fetchImpl,
        endpoint: input.endpoint,
        timeoutMs: input.requestTimeoutMs,
        providerDisplayName: input.providerDisplayName,
        init: {
          method: "POST",
          headers: requestHeaders({
            apiKey: input.apiKey,
            appTitle: input.appTitle,
            siteUrl: input.siteUrl
          }),
          body: JSON.stringify(requestBody)
        }
      });

      if (!response.ok) {
        throw new Error(
          `${input.providerDisplayName} loop request failed: ${response.status} ${response.statusText}: ${responseText}`.trim()
        );
      }

      const modelResponse = parseModelResult(extractMessageContent(parseJson(responseText, "provider response")));
      const recoveredDetails = recoveredRetryDetails(failedAttemptDetails);

      return {
        ...modelResponse,
        validity_flags: uniqueValidityFlags(recoveredDetails),
        validity_details: recoveredDetails.length > 0 ? recoveredDetails : undefined
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const validityFlag = classifyOpenRouterError(detail);
      const canRetry = isRetryableProviderFailure(validityFlag) && attempt < input.maxProviderRetries;
      const retryCount = Math.min(attempt + 1, input.maxProviderRetries);
      const failureDetail = providerFailureDetail({
        call: input.call,
        detail,
        validityFlag,
        retryable: isRetryableProviderFailure(validityFlag),
        retryCount,
        elapsedMs: Math.max(0, Date.now() - attemptStartedAt),
        provider: input.provider
      });

      failedAttemptDetails.push(failureDetail);

      if (!canRetry) {
        throw new ModelLoopProviderError(detail, failedAttemptDetails);
      }
    }
  }

  throw new Error(`${input.providerDisplayName} retry loop exited unexpectedly.`);
}

function providerFailureDetail(input: {
  call: ModelLoopCall;
  provider: string;
  detail: string;
  validityFlag: RunValidityFlag;
  retryable: boolean;
  retryCount: number;
  elapsedMs: number;
}): RunValidityDetail {
  return {
    flag: input.validityFlag,
    scope: "checkpoint",
    condition_id: input.call.condition_id,
    checkpoint_id: input.call.checkpoint_id,
    provider: input.provider,
    message: input.detail,
    retryable: input.retryable,
    provider_failure_phase:
      input.validityFlag === "provider_timeout"
        ? classifyProviderFailurePhase({
            feedbackAvailable: input.call.feedback_available,
            feedbackRuns: input.call.feedback_summaries.length,
            modelTurns: input.call.turn_index
          })
        : undefined,
    model_turn_number: input.call.turn_index,
    feedback_had_run: input.call.feedback_summaries.length > 0,
    model_response_received: modelResponseWasReceived(input.validityFlag, input.detail),
    code_changed: false,
    workspace_carried_forward_due_to_provider_failure: false,
    retry_count: input.retryCount,
    elapsed_ms: input.elapsedMs
  };
}

async function fetchProviderResponse(input: {
  fetchImpl: FetchLike;
  endpoint: string;
  init: Parameters<FetchLike>[1];
  timeoutMs: number;
  providerDisplayName: string;
}): Promise<{
  response: Awaited<ReturnType<FetchLike>>;
  responseText: string;
}> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      (async () => {
        const response = await input.fetchImpl(input.endpoint, {
          ...input.init,
          signal: controller.signal
        });
        const responseText = await response.text();

        return { response, responseText };
      })(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error(`${input.providerDisplayName} request timed out after ${input.timeoutMs}ms`));
        }, input.timeoutMs);
      })
    ]);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${input.providerDisplayName} request timed out after ${input.timeoutMs}ms`);
    }

    throw error;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function sanitizeProviderLabel(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized.length > 0 ? sanitized : "openai-compatible";
}

function recoveredRetryDetails(details: RunValidityDetail[]): RunValidityDetail[] {
  return details.map((detail) => ({
    ...detail,
    retryable: true,
    provider_failure_phase:
      detail.flag === "provider_timeout" ? "retry_recovered_timeout" : detail.provider_failure_phase,
    code_changed: false,
    workspace_carried_forward_due_to_provider_failure: false
  }));
}

function modelLoopResponseFormatJsonSchema() {
  return {
    type: "json_schema",
    json_schema: {
      name: "model_loop_response",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          status: {
            type: "string",
            enum: ["ok", "failed"]
          },
          notes: {
            type: "string"
          },
          files: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                path: {
                  type: "string"
                },
                content: {
                  type: "string"
                }
              },
              required: ["path", "content"]
            }
          },
          transcript: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                event: {
                  type: "string"
                },
                detail: {
                  type: "string"
                }
              },
              required: ["event", "detail"]
            }
          }
        },
        required: ["status", "notes", "files", "transcript"]
      }
    }
  } as const;
}

async function normalizeModelResponse(response: ModelLoopResponse | string): Promise<ModelLoopResponse> {
  if (typeof response === "string") {
    return parseModelResult(response);
  }

  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new Error("Model loop response must be an object or JSON string.");
  }

  const parsed = parseModelResult(JSON.stringify(response));

  return {
    ...parsed,
    validity_flags: response.validity_flags,
    validity_details: response.validity_details
  };
}

function buildTurnPrompt(input: {
  input: AgentRunInput;
  turn: number;
  feedbackAvailable: boolean;
  feedbackSummaries: string[];
  workspaceContext: WorkspaceContext;
}): string {
  const promptLines = [
    `Task: ${input.input.packet.task_id}`,
    `Checkpoint: ${input.input.checkpoint_id}`,
    `Condition: ${input.input.condition_id}`,
    `Turn: ${input.turn}`,
    "",
    "Visible semantic spec:",
    input.input.packet.visible_spec_text.trimEnd(),
    ""
  ];

  if (input.input.packet.public_api_contract) {
    promptLines.push("Public API contract:", input.input.packet.public_api_contract, "");
  }

  if (input.feedbackAvailable) {
    promptLines.push(
      "Executable feedback is available for this condition.",
      `Feedback command: ${input.input.packet.feedback_command}`,
      "Do not edit executable feedback assets; they are benchmark-provided read-only files.",
      "Read-only executable feedback assets:",
      ...input.input.packet.executable_feedback_paths.map((path) => `- ${path}`),
      ""
    );

    for (const [index, summary] of input.feedbackSummaries.entries()) {
      promptLines.push(`Feedback result ${index + 1}:`, summary, "");
    }
  } else if (input.turn > 1) {
    promptLines.push(
      "Self-review against the visible semantic spec only.",
      "No executable feedback output is available in this condition.",
      ""
    );
  } else {
    promptLines.push(
      "Use the semantic spec as durable context. No executable feedback output is provided.",
      ""
    );
  }

  promptLines.push(
    "Workspace snapshot:",
    input.workspaceContext.text || "(workspace has no readable text files)",
    "",
    "Return only JSON file writes needed for this turn."
  );

  return promptLines.join("\n").trimEnd() + "\n";
}

export async function runVisibleFeedbackCommand(
  input: FeedbackCommandRunInput
): Promise<FeedbackCommandRunResult> {
  const [executable, ...args] = splitCommand(input.command);

  if (!executable) {
    throw new Error("Feedback command is empty.");
  }

  try {
    const result = await execFileAsync(executable, args, {
      cwd: input.workspace_path,
      timeout: 15_000,
      maxBuffer: 1024 * 1024
    });

    return {
      command: input.command,
      exit_code: 0,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    const childError = error as {
      code?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };

    return {
      command: input.command,
      exit_code: typeof childError.code === "number" ? childError.code : 1,
      stdout: childError.stdout ?? "",
      stderr: childError.stderr ?? childError.message ?? ""
    };
  }
}

function summarizeFeedbackResult(
  result: FeedbackCommandRunResult,
  workspacePath: string,
  maxFeedbackOutputBytes: number
): string {
  if (result.summary) {
    return sanitizeFeedbackText(result.summary, workspacePath, maxFeedbackOutputBytes);
  }

  return sanitizeFeedbackText(
    [
      `command: ${result.command}`,
      `exit_code: ${result.exit_code}`,
      "stdout:",
      result.stdout,
      "stderr:",
      result.stderr
    ].join("\n"),
    workspacePath,
    maxFeedbackOutputBytes
  );
}

function sanitizeFeedbackText(text: string, workspacePath: string, maxBytes: number): string {
  const workspace = resolve(workspacePath);
  const sanitized = text
    .split("\n")
    .filter((line) => isPublicFeedbackLine(line, workspace))
    .map((line) => line.replaceAll(workspace, "<workspace>"))
    .join("\n")
    .trim();

  const buffer = Buffer.from(sanitized);

  if (buffer.byteLength <= maxBytes) {
    return sanitized;
  }

  return `${buffer.subarray(0, maxBytes).toString("utf8")}\n[feedback output truncated]`;
}

function isPublicFeedbackLine(line: string, workspacePath: string): boolean {
  const lowered = line.toLowerCase();

  if (
    lowered.includes("hidden-oracle") ||
    lowered.includes("private_oracle") ||
    lowered.includes("private oracle") ||
    /[a-z0-9-]+:i\d\d:[a-z0-9-]+/i.test(line)
  ) {
    return false;
  }

  const lineForPathScan = line.replaceAll("<workspace>", workspacePath);
  const absolutePaths = lineForPathScan.match(/\/[^\s:)]+/g) ?? [];

  return absolutePaths.every((path) => path.startsWith(workspacePath) || path.startsWith("<workspace>"));
}

function parseModelResult(content: string): ModelLoopResponse {
  const result = parseJson(stripJsonFence(content), "Model loop JSON");

  if (!isRecord(result)) {
    throw new Error("Model loop JSON must be an object.");
  }

  if (result.status !== undefined && result.status !== "ok" && result.status !== "failed") {
    throw new Error("Model loop JSON status must be ok or failed.");
  }

  if (result.notes !== undefined && typeof result.notes !== "string") {
    throw new Error("Model loop JSON notes must be a string when present.");
  }

  if (result.files !== undefined && !Array.isArray(result.files)) {
    throw new Error("Model loop JSON files must be an array when present.");
  }

  if (result.transcript !== undefined && !Array.isArray(result.transcript)) {
    throw new Error("Model loop JSON transcript must be an array when present.");
  }

  return {
    status: result.status,
    notes: result.notes,
    files: (result.files ?? []).map(parseFileWrite),
    transcript: (result.transcript ?? []).map(parseTranscriptEvent)
  };
}

function parseFileWrite(file: unknown, index: number): { path: string; content: string } {
  if (!isRecord(file) || typeof file.path !== "string" || typeof file.content !== "string") {
    throw new Error(`Model loop JSON files[${index}] must include string path and content.`);
  }

  return {
    path: file.path,
    content: file.content
  };
}

function parseTranscriptEvent(event: unknown, index: number): AgentTranscriptEvent {
  if (!isRecord(event) || typeof event.event !== "string" || event.event.length === 0) {
    throw new Error(`Model loop JSON transcript[${index}] must include an event string.`);
  }

  if (event.detail !== undefined && typeof event.detail !== "string") {
    throw new Error(`Model loop JSON transcript[${index}].detail must be a string when present.`);
  }

  return {
    event: event.event,
    detail: event.detail
  };
}

async function applyReturnedFiles(
  workspacePath: string,
  files: Array<{ path: string; content: string }>,
  readOnlyFeedbackPaths: string[]
): Promise<string[]> {
  const readOnlyPaths = new Set(readOnlyFeedbackPaths.map(toWorkspacePath));
  const writes = files.map((file) => {
    const workspacePathForFile = toWorkspacePath(file.path);

    if (readOnlyPaths.has(workspacePathForFile)) {
      throw new Error(`Model loop returned a write to read-only feedback asset: ${file.path}`);
    }

    return {
      workspacePathForFile,
      destination: workspaceDestination(workspacePath, workspacePathForFile),
      content: file.content
    };
  });
  const writtenPaths: string[] = [];

  for (const write of writes) {
    await mkdir(dirname(write.destination), { recursive: true });
    await writeFile(write.destination, write.content);
    writtenPaths.push(write.workspacePathForFile);
  }

  return writtenPaths;
}

function workspaceDestination(workspacePath: string, relativePath: string): string {
  const root = resolve(workspacePath);
  const normalizedPath = toWorkspacePath(relativePath);

  if (!normalizedPath.trim()) {
    throw new Error("Model loop returned an empty file path.");
  }

  if (isAbsolute(normalizedPath)) {
    throw new Error(`Model loop returned a path that must stay inside the workspace: ${relativePath}`);
  }

  if (normalizedPath.split("/").includes("..")) {
    throw new Error(`Model loop returned a path that must stay inside the workspace: ${relativePath}`);
  }

  const destination = resolve(root, normalizedPath);

  if (destination !== root && !destination.startsWith(root + sep)) {
    throw new Error(`Model loop returned a path that must stay inside the workspace: ${relativePath}`);
  }

  return destination;
}

function extractMessageContent(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    throw new Error("OpenRouter response must include a choices array.");
  }

  const firstChoice = payload.choices[0];

  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    throw new Error("OpenRouter response must include choices[0].message.");
  }

  const content = firstChoice.message.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content.map(extractTextPart).join("");

    if (text.length > 0) {
      return text;
    }
  }

  throw new Error("OpenRouter response message content must be a string or text content array.");
}

function extractTextPart(part: unknown): string {
  if (typeof part === "string") {
    return part;
  }

  if (isRecord(part) && typeof part.text === "string") {
    return part.text;
  }

  return "";
}

function splitCommand(command: string): string[] {
  return command.match(/"[^"]+"|'[^']+'|\S+/g)?.map((part) => part.replace(/^['"]|['"]$/g, "")) ?? [];
}

