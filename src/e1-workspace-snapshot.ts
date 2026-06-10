import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { hashText } from "./snapshot";

export const E1_WORKSPACE_SNAPSHOT_RENDERER_ID = "e1-workspace-snapshot-v1" as const;
export const E1_SNAPSHOT_INCLUDED_ROOTS = ["scratch/", "specs/", "src/"] as const;
export const E1_SNAPSHOT_EXCLUDED_DIRECTORIES = new Set(["node_modules", ".git", "harness-logs", "coverage"]);

const SNAPSHOT_BEGIN = `=== workspace snapshot begin (${E1_WORKSPACE_SNAPSHOT_RENDERER_ID}) ===`;
const SNAPSHOT_END = "=== workspace snapshot end ===";

export type E1WorkspaceSnapshot = {
  renderer_id: typeof E1_WORKSPACE_SNAPSHOT_RENDERER_ID;
  text: string;
  hash: string;
  file_paths: string[];
};

export async function renderE1WorkspaceSnapshot(workspacePath: string): Promise<E1WorkspaceSnapshot> {
  return renderE1WorkspaceSnapshotFromFiles(await collectE1SnapshotFiles(workspacePath));
}

export function renderE1WorkspaceSnapshotFromFiles(files: Record<string, string>): E1WorkspaceSnapshot {
  const paths = Object.keys(files).toSorted(compareBytewise);
  const lines: string[] = [SNAPSHOT_BEGIN];

  if (paths.length === 0) {
    lines.push(`(no files under ${E1_SNAPSHOT_INCLUDED_ROOTS.join(", ")})`);
  } else {
    lines.push("Files:");

    for (const path of paths) {
      lines.push(`- ${path}`);
    }

    for (const path of paths) {
      lines.push("", fileSectionOpen(path), files[path].replace(/\n$/, ""), fileSectionClose(path));
    }
  }

  lines.push(SNAPSHOT_END);
  const text = lines.join("\n");

  return {
    renderer_id: E1_WORKSPACE_SNAPSHOT_RENDERER_ID,
    text,
    hash: hashText(text),
    file_paths: paths
  };
}

export async function collectE1SnapshotFiles(workspacePath: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  for (const filePath of await walkFiles(workspacePath)) {
    const relativePath = relative(workspacePath, filePath).split(sep).join("/");

    if (!E1_SNAPSHOT_INCLUDED_ROOTS.some((root) => relativePath.startsWith(root))) {
      continue;
    }

    files[relativePath] = await readFile(filePath, "utf8");
  }

  return files;
}

export function stripE1WorkspaceSnapshotRegions(text: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  let insideSnapshot = false;

  for (const line of lines) {
    if (!insideSnapshot && line === SNAPSHOT_BEGIN) {
      insideSnapshot = true;
      continue;
    }

    if (insideSnapshot) {
      if (line === SNAPSHOT_END) {
        insideSnapshot = false;
      }

      continue;
    }

    kept.push(line);
  }

  return kept.join("\n");
}

export function stripE1SnapshotFileSections(text: string, paths: string[]): string {
  const pathSet = new Set(paths);
  const lines = text.split("\n");
  const kept: string[] = [];
  let closingMarker: string | null = null;

  for (const line of lines) {
    if (closingMarker) {
      if (line === closingMarker) {
        closingMarker = null;
      }

      continue;
    }

    const listMatch = line.match(/^- (.+)$/);

    if (listMatch && pathSet.has(listMatch[1])) {
      continue;
    }

    const openMatch = line.match(/^=== workspace file: (.+) ===$/);

    if (openMatch && pathSet.has(openMatch[1])) {
      closingMarker = fileSectionClose(openMatch[1]);
      continue;
    }

    kept.push(line);
  }

  return kept.join("\n");
}

function fileSectionOpen(path: string): string {
  return `=== workspace file: ${path} ===`;
}

function fileSectionClose(path: string): string {
  return `=== end workspace file: ${path} ===`;
}

function compareBytewise(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (E1_SNAPSHOT_EXCLUDED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      files.push(...(await walkFiles(join(directory, entry.name))));
      continue;
    }

    if (entry.isFile()) {
      files.push(join(directory, entry.name));
    }
  }

  return files;
}
