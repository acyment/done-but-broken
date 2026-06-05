import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import type { AgentAdapter, AgentRunInput, AgentRunResult, AgentTranscriptEvent } from "./runner";
import type { RunValidityFlag } from "./provenance";

export const DEFAULT_OPENROUTER_MODEL = "deepseek/deepseek-v4-flash";
export const DEFAULT_OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_MAX_WORKSPACE_BYTES = 256_000;
export const DEFAULT_OPENROUTER_REQUEST_TIMEOUT_MS = 60_000;
const SKIPPED_WORKSPACE_ENTRIES = new Set([
  ".DS_Store",
  ".git",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "runs"
]);

export type FetchLike = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  }
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
}>;

export type OpenRouterAgentOptions = {
  apiKey: string;
  model?: string;
  endpoint?: string;
  appTitle?: string;
  siteUrl?: string;
  maxTokens?: number;
  temperature?: number;
  maxWorkspaceBytes?: number;
  requestTimeoutMs?: number;
  fetch?: FetchLike;
};

type OpenRouterModelResult = {
  status?: "ok" | "failed";
  notes?: string;
  files?: Array<{
    path: string;
    content: string;
  }>;
  transcript?: AgentTranscriptEvent[];
};

type WorkspaceContext = {
  text: string;
  truncated: boolean;
  bytes: number;
  file_count: number;
};

export function createOpenRouterAgent(options: OpenRouterAgentOptions): AgentAdapter {
  const apiKey = options.apiKey.trim();
  const model = options.model ?? DEFAULT_OPENROUTER_MODEL;
  const endpoint = options.endpoint ?? DEFAULT_OPENROUTER_ENDPOINT;
  const maxTokens = options.maxTokens ?? 16_000;
  const temperature = options.temperature ?? 0.2;
  const maxWorkspaceBytes = options.maxWorkspaceBytes ?? DEFAULT_MAX_WORKSPACE_BYTES;
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_OPENROUTER_REQUEST_TIMEOUT_MS;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const adapter_id = `openrouter:${model}`;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required for the OpenRouter agent adapter.");
  }

  if (!fetchImpl) {
    throw new Error("No fetch implementation is available for the OpenRouter agent adapter.");
  }

  return {
    async run(input: AgentRunInput): Promise<AgentRunResult> {
      try {
        const workspaceContext = await renderWorkspaceContext(input.workspace_path, maxWorkspaceBytes);
        const { response, responseText } = await fetchOpenRouterResponse({
          fetchImpl,
          endpoint,
          timeoutMs: requestTimeoutMs,
          init: {
            method: "POST",
            headers: requestHeaders({
              apiKey,
              appTitle: options.appTitle,
              siteUrl: options.siteUrl
            }),
            body: JSON.stringify({
              model,
              messages: requestMessages(input, workspaceContext),
              stream: false,
              temperature,
              max_completion_tokens: maxTokens
            })
          }
        });

        if (!response.ok) {
          throw new Error(
            `OpenRouter request failed: ${response.status} ${response.statusText}: ${responseText}`.trim()
          );
        }

        const openRouterPayload = parseJson(responseText, "OpenRouter response");
        const content = extractMessageContent(openRouterPayload);
        const modelResult = parseModelResult(content);
        const writtenPaths = await applyReturnedFiles(
          input.workspace_path,
          modelResult.files ?? [],
          input.packet.executable_feedback_paths
        );
        const usageDetail = usageTranscriptDetail(openRouterPayload, model);

        return {
          status: modelResult.status ?? "ok",
          adapter_id,
          notes: modelResult.notes,
          transcript: [
            {
              event: "openrouter_request",
              detail: `model=${model} workspace_files=${workspaceContext.file_count} workspace_bytes=${workspaceContext.bytes} truncated=${workspaceContext.truncated}`
            },
            {
              event: "openrouter_response",
              detail: usageDetail
            },
            {
              event: "write_workspace",
              detail: writtenPaths.join(", ") || "none"
            },
            ...(modelResult.transcript ?? [])
          ]
        };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const validityFlag = classifyOpenRouterError(detail);

        return {
          status: "failed",
          adapter_id,
          notes: detail,
          transcript: [
            {
              event: "openrouter_error",
              detail
            }
          ],
          workspace_carried_forward_due_to_provider_failure: true,
          validity_flags: validityFlag ? [validityFlag] : undefined,
          validity_details: validityFlag
            ? [
                {
                  flag: validityFlag,
                  scope: "checkpoint",
                  condition_id: input.condition_id,
                  checkpoint_id: input.checkpoint_id,
                  provider: "openrouter",
                  message: detail,
                  retryable: validityFlag === "provider_timeout" || validityFlag === "provider_quota_or_rate_limit",
                  provider_failure_phase: "pre_model_action_timeout",
                  model_turn_number: 1,
                  feedback_had_run: false,
                  model_response_received: false,
                  code_changed: false,
                  workspace_carried_forward_due_to_provider_failure: true,
                  retry_count: 0
                }
              ]
            : undefined
        };
      }
    }
  };
}

export async function fetchOpenRouterResponse(input: {
  fetchImpl: FetchLike;
  endpoint: string;
  init: Parameters<FetchLike>[1];
  timeoutMs: number;
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
          reject(new Error(`OpenRouter request timed out after ${input.timeoutMs}ms`));
        }, input.timeoutMs);
      })
    ]);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`OpenRouter request timed out after ${input.timeoutMs}ms`);
    }

    throw error;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export function classifyOpenRouterError(detail: string): RunValidityFlag {
  const lowered = detail.toLowerCase();

  if (lowered.includes("timed out") || lowered.includes("abort")) {
    return "provider_timeout";
  }

  if (lowered.includes("429") || lowered.includes("rate limit") || lowered.includes("quota")) {
    return "provider_quota_or_rate_limit";
  }

  if (lowered.includes("json") || lowered.includes("response")) {
    return "provider_malformed_response";
  }

  return "provider_api_failure";
}

function requestHeaders(input: {
  apiKey: string;
  appTitle?: string;
  siteUrl?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.apiKey}`,
    "Content-Type": "application/json"
  };

  if (input.appTitle) {
    headers["X-Title"] = input.appTitle;
  }

  if (input.siteUrl) {
    headers["HTTP-Referer"] = input.siteUrl;
  }

  return headers;
}

function requestMessages(input: AgentRunInput, workspaceContext: WorkspaceContext) {
  return [
    {
      role: "system",
      content: [
        "You are running inside a benchmark harness.",
        "Return only JSON. Do not wrap it in prose.",
        "The JSON shape is:",
        '{"status":"ok","notes":"short summary","files":[{"path":"relative/path","content":"full file content"}],"transcript":[{"event":"short_event","detail":"optional detail"}]}',
        "Only write paths that should change. Every path must be relative to the workspace.",
        "Do not edit executable feedback assets; they are benchmark-provided read-only files."
      ].join("\n")
    },
    {
      role: "user",
      content: [
        input.packet.prompt_text.trimEnd(),
        readOnlyFeedbackAssetText(input.packet.executable_feedback_paths),
        "",
        "Workspace snapshot:",
        workspaceContext.text || "(workspace has no readable text files)",
        "",
        "Return the files needed to satisfy this checkpoint."
      ].join("\n")
    }
  ];
}

function readOnlyFeedbackAssetText(paths: string[]): string {
  if (!paths.length) {
    return "";
  }

  return [
    "",
    "Read-only executable feedback assets:",
    ...paths.map((path) => `- ${path}`)
  ].join("\n");
}

async function renderWorkspaceContext(workspacePath: string, maxBytes: number): Promise<WorkspaceContext> {
  const root = resolve(workspacePath);
  const files = await listWorkspaceFiles(root);
  const chunks: string[] = [];
  let bytes = 0;
  let truncated = false;

  for (const file of files) {
    const absolutePath = resolve(root, file);
    const content = await readFile(absolutePath, "utf8").catch(() => undefined);

    if (content === undefined || content.includes("\u0000")) {
      continue;
    }

    const chunk = [`file: ${file}`, "```", content.trimEnd(), "```", ""].join("\n");
    const chunkBytes = Buffer.byteLength(chunk);

    if (bytes + chunkBytes > maxBytes) {
      truncated = true;
      break;
    }

    chunks.push(chunk);
    bytes += chunkBytes;
  }

  return {
    text: chunks.join("\n").trimEnd(),
    truncated,
    bytes,
    file_count: files.length
  };
}

async function listWorkspaceFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (SKIPPED_WORKSPACE_ENTRIES.has(entry.name)) {
      continue;
    }

    const absolutePath = resolve(current, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listWorkspaceFiles(root, absolutePath)));
    } else if (entry.isFile()) {
      files.push(toWorkspacePath(relative(root, absolutePath)));
    }
  }

  return files.sort();
}

function parseModelResult(content: string): OpenRouterModelResult {
  const result = parseJson(stripJsonFence(content), "OpenRouter model JSON");

  if (!isRecord(result)) {
    throw new Error("OpenRouter model JSON must be an object.");
  }

  if (result.status !== undefined && result.status !== "ok" && result.status !== "failed") {
    throw new Error("OpenRouter model JSON status must be ok or failed.");
  }

  if (result.notes !== undefined && typeof result.notes !== "string") {
    throw new Error("OpenRouter model JSON notes must be a string when present.");
  }

  if (result.files !== undefined && !Array.isArray(result.files)) {
    throw new Error("OpenRouter model JSON files must be an array when present.");
  }

  const files = (result.files ?? []).map((file, index) => {
    if (!isRecord(file) || typeof file.path !== "string" || typeof file.content !== "string") {
      throw new Error(`OpenRouter model JSON files[${index}] must include string path and content.`);
    }

    return {
      path: file.path,
      content: file.content
    };
  });

  if (result.transcript !== undefined && !Array.isArray(result.transcript)) {
    throw new Error("OpenRouter model JSON transcript must be an array when present.");
  }

  const transcript = (result.transcript ?? []).map((event, index) => {
    if (!isRecord(event) || typeof event.event !== "string") {
      throw new Error(`OpenRouter model JSON transcript[${index}] must include an event string.`);
    }

    if (event.detail !== undefined && typeof event.detail !== "string") {
      throw new Error(`OpenRouter model JSON transcript[${index}].detail must be a string when present.`);
    }

    return {
      event: event.event,
      detail: event.detail
    };
  });

  return {
    status: result.status,
    notes: result.notes,
    files,
    transcript
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
      throw new Error(`OpenRouter returned a write to read-only feedback asset: ${file.path}`);
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
    throw new Error("OpenRouter returned an empty file path.");
  }

  if (isAbsolute(normalizedPath)) {
    throw new Error(`OpenRouter returned a path that must stay inside the workspace: ${relativePath}`);
  }

  const pathParts = normalizedPath.split("/");

  if (pathParts.includes("..")) {
    throw new Error(`OpenRouter returned a path that must stay inside the workspace: ${relativePath}`);
  }

  const destination = resolve(root, normalizedPath);

  if (destination !== root && !destination.startsWith(root + sep)) {
    throw new Error(`OpenRouter returned a path that must stay inside the workspace: ${relativePath}`);
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
    return content
      .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
      .join("");
  }

  throw new Error("OpenRouter response message content must be a string.");
}

function usageTranscriptDetail(payload: unknown, fallbackModel: string): string {
  const model = isRecord(payload) && typeof payload.model === "string" ? payload.model : fallbackModel;
  const usage = isRecord(payload) && isRecord(payload.usage) ? payload.usage : undefined;

  if (!usage) {
    return `model=${model}`;
  }

  const totalTokens = typeof usage.total_tokens === "number" ? usage.total_tokens : "unknown";

  return `model=${model} total_tokens=${totalTokens}`;
}

function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);

  return match ? match[1].trim() : trimmed;
}

function parseJson(content: string, label: string): unknown {
  try {
    return JSON.parse(content);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    throw new Error(`${label} could not be parsed as JSON: ${detail}`);
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toWorkspacePath(path: string): string {
  return path.replace(/\\/g, "/").split(sep).join("/");
}
