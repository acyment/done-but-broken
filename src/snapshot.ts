import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export type WorkspaceSnapshot = {
  hash: string;
  files: Record<string, string>;
};

const IGNORED_DIRECTORIES = new Set([".git", "node_modules"]);

export async function hashWorkspace(workspace_path: string): Promise<WorkspaceSnapshot> {
  return hashDirectory(workspace_path);
}

export async function hashDirectory(directory: string): Promise<WorkspaceSnapshot> {
  const filePaths = await collectFiles(directory);
  const files: Record<string, string> = {};

  for (const filePath of filePaths.toSorted()) {
    const content = await readFile(filePath);
    const relativePath = relative(directory, filePath).split(sep).join("/");

    files[relativePath] = hashBytes(content);
  }

  const hash = hashText(JSON.stringify(files));

  return { hash, files };
}

export async function hashFile(path: string): Promise<string> {
  return hashBytes(await readFile(path));
}

export function hashText(value: string): string {
  return hashBytes(value);
}

function hashBytes(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      files.push(...(await collectFiles(join(directory, entry.name))));
      continue;
    }

    if (entry.isFile()) {
      files.push(join(directory, entry.name));
    }
  }

  return files;
}
