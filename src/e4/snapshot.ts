// ADR-005 snapshot/resume machinery: harness-side directory copies, content-hash-anchored via the
// allowlisted src/snapshot.ts hashing (transfer map: as-is). Snapshots live under
// runRoot/snapshots/<arm>/task-<k>/ — outside every agent-readable mount — and are the replay
// anchors the manifest records per task. No VCS in the workspace, ever (the E3 gold-leak class is
// structurally absent: there is no object database to leak future state through).
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { hashDirectory } from "../snapshot";
import type { E4ArmId } from "./types";

export class E4SnapshotError extends Error {
  constructor(message: string) {
    super(`[e4-snapshot] ${message}`);
    this.name = "E4SnapshotError";
  }
}

export class E4SnapshotHashMismatchError extends E4SnapshotError {
  constructor(input: { snapshotDir: string; expected: string; actual: string }) {
    super(
      `snapshot hash mismatch at ${input.snapshotDir}: expected ${input.expected}, computed ${input.actual} — refusing to restore (ADR-005: anything unreplayable flips chain_replay_valid, it is never patched over)`
    );
    this.name = "E4SnapshotHashMismatchError";
  }
}

export function e4SnapshotDir(runRoot: string, arm: E4ArmId, taskIndex: number): string {
  return join(runRoot, "snapshots", arm, `task-${taskIndex}`);
}

function sidecarPath(snapshotDir: string): string {
  return `${snapshotDir}.hash.json`;
}

// Copy the live workspace to the snapshot location and hash the copy (hashing the copy, not the
// source, anchors exactly the bytes that a later restore will produce). The content-hash manifest
// is written as a sidecar NEXT to the snapshot directory so the hash never includes itself.
export async function captureE4Snapshot(input: {
  workspaceDir: string;
  runRoot: string;
  arm: E4ArmId;
  taskIndex: number;
}): Promise<{ hash: string; path: string }> {
  const snapshotDir = e4SnapshotDir(input.runRoot, input.arm, input.taskIndex);

  await rm(snapshotDir, { recursive: true, force: true });
  await mkdir(dirname(snapshotDir), { recursive: true });
  await cp(input.workspaceDir, snapshotDir, { recursive: true });

  const { hash, files } = await hashDirectory(snapshotDir);
  await writeFile(sidecarPath(snapshotDir), `${JSON.stringify({ hash, files }, null, 2)}\n`);

  return { hash, path: snapshotDir };
}

export async function hashE4Snapshot(snapshotDir: string): Promise<string> {
  return (await hashDirectory(snapshotDir)).hash;
}

// ADR-005 resume: verify the snapshot's content hash against the recorded anchor BEFORE restoring;
// a mismatch throws rather than silently continuing on corrupt state. The restore target is wiped
// first — the restored workspace is a fresh directory containing exactly the snapshot's bytes.
export async function restoreE4Snapshot(input: {
  snapshotDir: string;
  expectedHash: string;
  workspaceDir: string;
}): Promise<void> {
  const actual = await hashE4Snapshot(input.snapshotDir);

  if (actual !== input.expectedHash) {
    throw new E4SnapshotHashMismatchError({
      snapshotDir: input.snapshotDir,
      expected: input.expectedHash,
      actual
    });
  }

  await rm(input.workspaceDir, { recursive: true, force: true });
  await mkdir(dirname(input.workspaceDir), { recursive: true });
  await cp(input.snapshotDir, input.workspaceDir, { recursive: true });
}
