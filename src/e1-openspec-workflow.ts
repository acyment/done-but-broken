import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { hashText } from "./snapshot";

export const OPENSPEC_PINNED_VERSION = "1.4.1" as const;
export const OPENSPEC_PACKAGE_NAME = "@fission-ai/openspec" as const;

// Telemetry is neutralized fail-closed on every invocation: the pinned CLI ships posthog-node,
// and these env vars are its documented opt-outs. CI=1 plus piped stdio also disable spinners/TTY prompts.
const OPENSPEC_ENV_OVERRIDES = {
  OPENSPEC_TELEMETRY: "0",
  DO_NOT_TRACK: "1",
  NO_COLOR: "1",
  FORCE_COLOR: "0",
  CI: "1"
} as const;

export type E1OpenSpecCommandResult = {
  openspec_version: typeof OPENSPEC_PINNED_VERSION;
  argv: string[];
  exit_code: number;
  normalized_stdout: string;
  normalized_stderr: string;
  stdout_hash: string;
  stderr_hash: string;
};

export async function assertPinnedOpenSpecVersion(repoRoot: string): Promise<void> {
  const packageJsonPath = join(
    resolve(repoRoot),
    "node_modules",
    "@fission-ai",
    "openspec",
    "package.json"
  );
  const installed = JSON.parse(await readFile(packageJsonPath, "utf8")) as { version?: string };

  if (installed.version !== OPENSPEC_PINNED_VERSION) {
    throw new Error(
      `Installed ${OPENSPEC_PACKAGE_NAME} version ${String(installed.version)} does not match the pinned ${OPENSPEC_PINNED_VERSION}`
    );
  }
}

export async function runOpenSpecCommand(input: {
  repoRoot: string;
  workspacePath: string;
  args: string[];
  timeoutMs?: number;
}): Promise<E1OpenSpecCommandResult> {
  await assertPinnedOpenSpecVersion(input.repoRoot);

  const binPath = join(
    resolve(input.repoRoot),
    "node_modules",
    "@fission-ai",
    "openspec",
    "bin",
    "openspec.js"
  );
  const argv = ["bun", binPath, ...input.args];
  const child = Bun.spawn(argv, {
    cwd: resolve(input.workspacePath),
    env: { ...process.env, ...OPENSPEC_ENV_OVERRIDES },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe"
  });
  const timeoutMs = input.timeoutMs ?? 30_000;
  const timeout = setTimeout(() => child.kill(), timeoutMs);
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ]);
  clearTimeout(timeout);

  const normalizedStdout = normalizeCliOutput(stdout);
  const normalizedStderr = normalizeCliOutput(stderr);

  return {
    openspec_version: OPENSPEC_PINNED_VERSION,
    argv,
    exit_code: exitCode,
    normalized_stdout: normalizedStdout,
    normalized_stderr: normalizedStderr,
    stdout_hash: hashText(normalizedStdout),
    stderr_hash: hashText(normalizedStderr)
  };
}

export async function runOpenSpecArchive(input: {
  repoRoot: string;
  workspacePath: string;
  changeName: string;
  timeoutMs?: number;
}): Promise<E1OpenSpecCommandResult> {
  return runOpenSpecCommand({
    repoRoot: input.repoRoot,
    workspacePath: input.workspacePath,
    args: ["archive", input.changeName, "--yes"],
    timeoutMs: input.timeoutMs
  });
}

export function normalizeCliOutput(raw: string): string {
  return raw
    .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "")
    .replace(/\u001b\][^\u0007]*\u0007/g, "")
    .replace(/\r/g, "")
    .trimEnd();
}
