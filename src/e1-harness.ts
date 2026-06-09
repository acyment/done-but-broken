import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, normalize, resolve, sep } from "node:path";
import { promisify } from "node:util";
import type { ConditionId } from "./conditions";

const execFileAsync = promisify(execFile);

const READ_ONLY_PATHS = new Set([
  "package.json",
  "bunfig.toml",
  "tsconfig.json",
  "bun.lock",
  "bun.lockb"
]);

const REPLACEMENT_HEADER = /^<<<FILE ([^>]+)>>>$/;
const REPLACEMENT_END = "<<<END>>>";
const ENV_ASSIGNMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*=/;
const SAFE_POSIX_PATH_PATTERN = /^[A-Za-z0-9._/-]+$/;
const PROTECTED_DIRECTORY_PATHS = ["specs"] as const;

export type FullFileReplacement = {
  path: string;
  content: string;
};

export type ApplyReplacementResult = {
  applied: boolean;
  replacements: FullFileReplacement[];
  confirmations: string[];
  errors: string[];
};

export type ProtectedPathHashes = Record<string, string | null>;

export type ProtectedPathHashMismatch = {
  path: string;
  expected: string | null | undefined;
  actual: string | null | undefined;
};

export type VerificationExecution =
  | {
      ok: true;
      argv: [command: string, args: string[]];
      command_kind: "bun_test_scratch" | "bun_scratch_script" | "bun_run_spec";
    }
  | {
      ok: false;
      reason: string;
    };

export type VerificationRunResult = {
  accepted: boolean;
  command: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  shown_output: string;
  full_output_hash: string;
  truncated: boolean;
  refusal_reason?: string;
};

export class E1VerificationBudget {
  readonly max: number;
  used = 0;

  constructor(max: number) {
    if (!Number.isInteger(max) || max < 0) {
      throw new Error("E1 verification budget must be a non-negative integer.");
    }

    this.max = max;
  }

  consume(): { allowed: boolean; remaining: number } {
    if (this.used >= this.max) {
      return { allowed: false, remaining: 0 };
    }

    this.used += 1;
    return { allowed: true, remaining: this.max - this.used };
  }
}

export async function applyFullFileReplacements(input: {
  workspacePath: string;
  replacementBlock: string;
}): Promise<ApplyReplacementResult> {
  const parsed = parseFullFileReplacements(input.replacementBlock);

  if (parsed.errors.length) {
    return { applied: false, replacements: [], confirmations: [], errors: parsed.errors };
  }

  const workspaceReal = await realpath(input.workspacePath);
  const validationErrors: string[] = [];
  const targets: Array<FullFileReplacement & { absolutePath: string; beforeLines: number }> = [];

  for (const replacement of parsed.replacements) {
    const validation = await validateWritableWorkspacePath({
      workspaceReal,
      workspacePath: input.workspacePath,
      relativePath: replacement.path
    });

    if (!validation.ok) {
      validationErrors.push(validation.error);
      continue;
    }

    targets.push({
      ...replacement,
      absolutePath: validation.absolutePath,
      beforeLines: await countExistingLines(validation.absolutePath)
    });
  }

  if (validationErrors.length) {
    return {
      applied: false,
      replacements: parsed.replacements,
      confirmations: [],
      errors: validationErrors
    };
  }

  for (const target of targets) {
    await mkdir(dirname(target.absolutePath), { recursive: true });
    await writeFile(target.absolutePath, target.content);
  }

  return {
    applied: true,
    replacements: parsed.replacements,
    confirmations: targets.map(
      (target) => `applied: ${target.path} (${target.beforeLines} -> ${countTextLines(target.content)} lines)`
    ),
    errors: []
  };
}

export function parseFullFileReplacements(input: string): {
  replacements: FullFileReplacement[];
  errors: string[];
} {
  const lines = input.split(/\r?\n/);
  const replacements: FullFileReplacement[] = [];
  const errors: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    const header = REPLACEMENT_HEADER.exec(line);

    if (!header) {
      errors.push(`Malformed replacement header at line ${index + 1}`);
      break;
    }

    const path = header[1].trim();
    const contentLines: string[] = [];
    index += 1;

    while (index < lines.length && lines[index] !== REPLACEMENT_END) {
      contentLines.push(lines[index]);
      index += 1;
    }

    if (index >= lines.length) {
      errors.push(`Replacement for ${path} missing <<<END>>>`);
      break;
    }

    replacements.push({ path, content: contentLines.join("\n") });
    index += 1;
  }

  if (!replacements.length && !errors.length && input.trim() !== "") {
    errors.push("Replacement block contained no file replacements");
  }

  return { replacements, errors };
}

export async function buildVerificationExecution(input: {
  workspacePath: string;
  conditionId: ConditionId;
  command: string;
  checkpoints: string[];
}): Promise<VerificationExecution> {
  if (input.command !== input.command.trim() || /\s{2,}|\t|\n|\r/.test(input.command)) {
    return { ok: false, reason: "Command must use single spaces and no surrounding whitespace." };
  }

  if (containsUnsafeCommandSyntax(input.command)) {
    return { ok: false, reason: "Command contains disallowed shell syntax." };
  }

  const tokens = input.command.split(" ");

  if (tokens[0] !== "bun") {
    return { ok: false, reason: "Only Bun command templates are allowed." };
  }

  if (tokens.length === 3 && tokens[1] === "test" && tokens[2] === "scratch/") {
    const scratch = await resolveScratchDir(input.workspacePath);
    return {
      ok: true,
      command_kind: "bun_test_scratch",
      argv: ["bun", ["--no-install", "test", scratch]]
    };
  }

  if (tokens.length === 2) {
    const script = await validateScratchPath({
      workspacePath: input.workspacePath,
      pathToken: tokens[1],
      requireFile: true
    });

    if (!script.ok) {
      return { ok: false, reason: script.error };
    }

    return {
      ok: true,
      command_kind: "bun_scratch_script",
      argv: ["bun", ["--no-install", script.absolutePath]]
    };
  }

  if (tokens[1] === "run" && tokens[2] === "spec") {
    if (input.conditionId !== "feedback_capable_spec") {
      return { ok: false, reason: "Provided spec runner is not available to this condition." };
    }

    if (tokens.length === 3) {
      return {
        ok: true,
        command_kind: "bun_run_spec",
        argv: ["bun", ["--no-install", "run", "spec"]]
      };
    }

    if (tokens.length === 5 && tokens[3] === "--" && tokens[4].startsWith("--cp=")) {
      const checkpoint = tokens[4].slice("--cp=".length);

      if (!/^[0-9]+$/.test(checkpoint) || !input.checkpoints.includes(checkpoint)) {
        return { ok: false, reason: "Checkpoint argument is not in the sealed range." };
      }

      return {
        ok: true,
        command_kind: "bun_run_spec",
        argv: ["bun", ["--no-install", "run", "spec", "--", `--cp=${checkpoint}`]]
      };
    }
  }

  return { ok: false, reason: "Command does not match an allowed E1 template." };
}

export async function runVerificationRequest(input: {
  workspacePath: string;
  conditionId: ConditionId;
  command: string;
  checkpoints: string[];
  timeoutMs?: number;
  outputLimit?: number;
}): Promise<VerificationRunResult> {
  const execution = await buildVerificationExecution(input);

  if (!execution.ok) {
    const refusal = `REFUSED: ${execution.reason}`;
    const truncated = truncateHeadTail({ text: refusal, limit: input.outputLimit ?? 4000 });

    return {
      accepted: false,
      command: input.command,
      exit_code: 126,
      stdout: refusal,
      stderr: "",
      shown_output: truncated.shown,
      full_output_hash: truncated.full_output_hash,
      truncated: truncated.truncated,
      refusal_reason: execution.reason
    };
  }

  const [command, args] = execution.argv;

  try {
    const result = await execFileAsync(command, args, {
      cwd: input.workspacePath,
      env: cleanEnvironment(),
      timeout: input.timeoutMs ?? 60_000,
      maxBuffer: 10 * 1024 * 1024
    });
    const fullOutput = joinOutput(result.stdout, result.stderr);
    const truncated = truncateHeadTail({ text: fullOutput, limit: input.outputLimit ?? 4000 });

    return {
      accepted: true,
      command: input.command,
      exit_code: 0,
      stdout: result.stdout,
      stderr: result.stderr,
      shown_output: truncated.shown,
      full_output_hash: truncated.full_output_hash,
      truncated: truncated.truncated
    };
  } catch (error) {
    const failure = error as {
      code?: number;
      signal?: string;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    const stdout = failure.stdout ?? "";
    const stderr = failure.stderr ?? failure.message ?? "";
    const fullOutput = joinOutput(stdout, stderr);
    const truncated = truncateHeadTail({ text: fullOutput, limit: input.outputLimit ?? 4000 });

    return {
      accepted: true,
      command: input.command,
      exit_code: typeof failure.code === "number" ? failure.code : 1,
      stdout,
      stderr,
      shown_output: truncated.shown,
      full_output_hash: truncated.full_output_hash,
      truncated: truncated.truncated
    };
  }
}

export function truncateHeadTail(input: {
  text: string;
  limit?: number;
  head?: number;
  tail?: number;
}): { shown: string; truncated: boolean; full_output_hash: string } {
  const limit = input.limit ?? 4000;
  const head = input.head ?? 2500;
  const tail = input.tail ?? 1500;
  const full_output_hash = sha256Text(input.text);

  if (input.text.length <= limit) {
    return { shown: input.text, truncated: false, full_output_hash };
  }

  const shownHead = input.text.slice(0, head);
  const shownTail = input.text.slice(-tail);
  const omitted = input.text.length - shownHead.length - shownTail.length;

  return {
    shown: `${shownHead}\n[... truncated ${omitted} chars ...]\n${shownTail}`,
    truncated: true,
    full_output_hash
  };
}

export function sha256Text(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function hashProtectedPaths(workspacePath: string): Promise<ProtectedPathHashes> {
  const workspaceReal = await realpath(workspacePath);
  const hashes: ProtectedPathHashes = {};

  for (const path of READ_ONLY_PATHS) {
    hashes[path] = await hashFileIfPresent(resolve(workspaceReal, path));
  }

  for (const directory of PROTECTED_DIRECTORY_PATHS) {
    await hashProtectedDirectory({ workspaceReal, relativePath: directory, hashes });
  }

  return Object.fromEntries(Object.entries(hashes).sort(([left], [right]) => left.localeCompare(right)));
}

export async function verifyProtectedPathHashes(input: {
  workspacePath: string;
  baseline: ProtectedPathHashes;
}): Promise<{ ok: true } | { ok: false; mismatches: ProtectedPathHashMismatch[] }> {
  const actual = await hashProtectedPaths(input.workspacePath);
  const paths = new Set([...Object.keys(input.baseline), ...Object.keys(actual)]);
  const mismatches: ProtectedPathHashMismatch[] = [];

  for (const path of [...paths].sort()) {
    if (input.baseline[path] !== actual[path]) {
      mismatches.push({ path, expected: input.baseline[path], actual: actual[path] });
    }
  }

  return mismatches.length ? { ok: false, mismatches } : { ok: true };
}

async function validateWritableWorkspacePath(input: {
  workspaceReal: string;
  workspacePath: string;
  relativePath: string;
}): Promise<{ ok: true; absolutePath: string } | { ok: false; error: string }> {
  const syntaxError = validatePosixPathSyntax(input.relativePath);

  if (syntaxError) {
    return { ok: false, error: `${input.relativePath || "<empty>"} is not a valid replacement path` };
  }

  if (isAbsolute(input.relativePath)) {
    return { ok: false, error: `${input.relativePath} must be relative to the workspace` };
  }

  const normalized = normalize(input.relativePath);

  if (normalized === "." || normalized.startsWith("..")) {
    return { ok: false, error: `${input.relativePath} escapes the workspace` };
  }

  const readOnlyReason = readOnlyReasonFor(normalized);

  if (readOnlyReason) {
    return { ok: false, error: readOnlyReason };
  }

  const absolutePath = resolve(input.workspaceReal, normalized);

  if (!isPathInside(input.workspaceReal, absolutePath)) {
    return { ok: false, error: `${input.relativePath} escapes the workspace` };
  }

  if (await isExistingSymlink(absolutePath)) {
    return { ok: false, error: `${input.relativePath} is a symlink target` };
  }

  const parentReal = await nearestExistingParentRealpath(dirname(absolutePath));

  if (!isPathInside(input.workspaceReal, parentReal) && parentReal !== input.workspaceReal) {
    return { ok: false, error: `${input.relativePath} parent escapes the workspace` };
  }

  return { ok: true, absolutePath };
}

async function validateScratchPath(input: {
  workspacePath: string;
  pathToken: string;
  requireFile: boolean;
}): Promise<{ ok: true; absolutePath: string } | { ok: false; error: string }> {
  const syntaxError = validatePosixPathSyntax(input.pathToken);

  if (syntaxError) {
    return { ok: false, error: syntaxError };
  }

  const scratchReal = await resolveScratchDir(input.workspacePath);
  const candidate = isAbsolute(input.pathToken)
    ? input.pathToken
    : resolve(input.workspacePath, input.pathToken);
  let candidateReal: string;

  try {
    candidateReal = await realpath(candidate);
  } catch {
    return { ok: false, error: "Path does not exist." };
  }

  if (candidateReal !== scratchReal && !isPathInside(scratchReal, candidateReal)) {
    return { ok: false, error: "Path is outside scratch." };
  }

  if (input.requireFile) {
    const extension = extname(candidateReal);

    if (extension !== ".ts") {
      return { ok: false, error: "Scratch executable must be a TypeScript file." };
    }
  }

  return { ok: true, absolutePath: candidateReal };
}

async function resolveScratchDir(workspacePath: string): Promise<string> {
  return realpath(resolve(workspacePath, "scratch"));
}

function readOnlyReasonFor(normalizedPath: string): string | undefined {
  if (READ_ONLY_PATHS.has(normalizedPath)) {
    return `${normalizedPath} is read-only`;
  }

  if (normalizedPath === "specs" || normalizedPath.startsWith(`specs${sep}`)) {
    return `${normalizedPath} is read-only`;
  }

  return undefined;
}

function containsUnsafeCommandSyntax(command: string): boolean {
  return command.split(" ").some((token) => ENV_ASSIGNMENT_PATTERN.test(token));
}

function validatePosixPathSyntax(value: string): string | undefined {
  if (!value || !SAFE_POSIX_PATH_PATTERN.test(value)) {
    return "Path contains disallowed syntax.";
  }

  if (value.startsWith("-")) {
    return "Path must not start with a dash.";
  }

  if (value.split("/").includes("..")) {
    return "Path must not contain .. segments.";
  }

  return undefined;
}

function isPathInside(root: string, candidate: string): boolean {
  const normalizedRoot = root.endsWith(sep) ? root : `${root}${sep}`;

  return candidate.startsWith(normalizedRoot);
}

async function isExistingSymlink(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isSymbolicLink();
  } catch {
    return false;
  }
}

async function nearestExistingParentRealpath(path: string): Promise<string> {
  let current = path;

  while (true) {
    try {
      return await realpath(current);
    } catch {
      const parent = dirname(current);

      if (parent === current) {
        throw new Error(`No existing parent found for ${path}`);
      }

      current = parent;
    }
  }
}

async function hashProtectedDirectory(input: {
  workspaceReal: string;
  relativePath: string;
  hashes: ProtectedPathHashes;
}): Promise<void> {
  const absolutePath = resolve(input.workspaceReal, input.relativePath);

  try {
    const entries = await readdir(absolutePath, { withFileTypes: true });

    if (entries.length === 0 && input.relativePath === "specs") {
      input.hashes[input.relativePath] = "sha256:empty-directory";
    }

    for (const entry of entries) {
      const childRelativePath = join(input.relativePath, entry.name);
      const childAbsolutePath = resolve(input.workspaceReal, childRelativePath);

      if (!isPathInside(input.workspaceReal, childAbsolutePath) && childAbsolutePath !== input.workspaceReal) {
        input.hashes[childRelativePath] = "outside-workspace";
        continue;
      }

      if (entry.isDirectory()) {
        await hashProtectedDirectory({
          workspaceReal: input.workspaceReal,
          relativePath: childRelativePath,
          hashes: input.hashes
        });
        continue;
      }

      if (entry.isFile()) {
        input.hashes[childRelativePath] = await hashFile(childAbsolutePath);
        continue;
      }

      input.hashes[childRelativePath] = `non-regular:${entry.name}`;
    }
  } catch {
    input.hashes[input.relativePath] = null;
  }
}

async function hashFileIfPresent(path: string): Promise<string | null> {
  try {
    return await hashFile(path);
  } catch {
    return null;
  }
}

async function hashFile(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function countExistingLines(path: string): Promise<number> {
  try {
    return countTextLines(await readFile(path, "utf8"));
  } catch {
    return 0;
  }
}

function countTextLines(text: string): number {
  if (text.length === 0) {
    return 0;
  }

  return text.split(/\r?\n/).length;
}

function cleanEnvironment(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    TMPDIR: process.env.TMPDIR ?? ""
  };
}

function joinOutput(stdout: string, stderr: string): string {
  if (stdout && stderr) {
    return `${stdout}\n${stderr}`;
  }

  return stdout || stderr;
}
