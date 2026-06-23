// Shared helpers for the OpenRouter single-shot adapter (`openrouter-agent.ts`) and the bounded
// feedback-loop adapter (`model-loop-agent.ts`). These were byte-identical copies in both files;
// extracted verbatim here so there is one source of truth. Behavior-preserving.
//
// Note: both adapters are calibration-only (not tamper-hardened eval sandboxes) — see README.

import { readFile, readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

export type WorkspaceContext = {
  text: string;
  truncated: boolean;
  bytes: number;
  file_count: number;
};

const SKIPPED_WORKSPACE_ENTRIES = new Set([
  ".DS_Store",
  ".git",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "runs"
]);

export function requestHeaders(input: {
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

export async function renderWorkspaceContext(workspacePath: string, maxBytes: number): Promise<WorkspaceContext> {
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

export async function listWorkspaceFiles(root: string, current = root): Promise<string[]> {
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

export function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);

  return match ? match[1].trim() : trimmed;
}

export function parseJson(content: string, label: string): unknown {
  try {
    return JSON.parse(content);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    throw new Error(`${label} could not be parsed as JSON: ${detail}`);
  }
}

export function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toWorkspacePath(path: string): string {
  return path.replace(/\\/g, "/").split(sep).join("/");
}
