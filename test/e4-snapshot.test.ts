// M4 acceptance — ADR-005 snapshot half: harness-side directory copies, content-hash anchors,
// hash-verified restore that fails closed on tampering.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { hashDirectory } from "../src/snapshot";
import {
  captureE4Snapshot,
  e4SnapshotDir,
  hashE4Snapshot,
  restoreE4Snapshot,
  E4SnapshotHashMismatchError
} from "../src/e4/snapshot";

const repoRoot = resolve(import.meta.dir, "..");
const scratchRoot = join(repoRoot, "tmp", "e4-snapshot-tests");

afterAll(async () => {
  await rm(scratchRoot, { recursive: true, force: true });
});

async function freshRoot(): Promise<string> {
  await mkdir(scratchRoot, { recursive: true });
  return mkdtemp(join(scratchRoot, "run-"));
}

async function writeFiles(dir: string, files: Record<string, string>): Promise<void> {
  for (const [path, contents] of Object.entries(files)) {
    const absolute = join(dir, path);
    await mkdir(join(absolute, ".."), { recursive: true });
    await writeFile(absolute, contents);
  }
}

describe("ADR-005 snapshots — dir copies, hash anchors, verified restore", () => {
  test("capture copies the workspace under runRoot/snapshots/<arm>/task-<k>/ with a hash sidecar", async () => {
    const runRoot = await freshRoot();
    const workspaceDir = join(runRoot, "workspaces", "e4_arm_0");
    await writeFiles(workspaceDir, { "server.ts": "// server", "specs/openapi.json": "{}" });

    const snapshot = await captureE4Snapshot({ workspaceDir, runRoot, arm: "e4_arm_0", taskIndex: 3 });

    expect(snapshot.path).toBe(e4SnapshotDir(runRoot, "e4_arm_0", 3));
    expect(await readFile(join(snapshot.path, "specs", "openapi.json"), "utf8")).toBe("{}");

    const sidecar = JSON.parse(await readFile(`${snapshot.path}.hash.json`, "utf8")) as { hash: string };

    expect(sidecar.hash).toBe(snapshot.hash);
    expect(snapshot.hash).toBe((await hashDirectory(snapshot.path)).hash);
  });

  test("restore verifies the anchor hash and reproduces the snapshot bytes in a fresh workspace", async () => {
    const runRoot = await freshRoot();
    const workspaceDir = join(runRoot, "workspaces", "e4_arm_0");
    await writeFiles(workspaceDir, { "server.ts": "// v1", "data.ts": "// data" });

    const snapshot = await captureE4Snapshot({ workspaceDir, runRoot, arm: "e4_arm_0", taskIndex: 1 });

    // The live workspace mutates afterward (a partial task): restore must wipe that state.
    await writeFiles(workspaceDir, { "server.ts": "// partial-task damage", "junk.ts": "// junk" });

    await restoreE4Snapshot({ snapshotDir: snapshot.path, expectedHash: snapshot.hash, workspaceDir });

    expect(await readFile(join(workspaceDir, "server.ts"), "utf8")).toBe("// v1");
    await expect(readFile(join(workspaceDir, "junk.ts"), "utf8")).rejects.toThrow();
    expect(await hashE4Snapshot(workspaceDir)).toBe(snapshot.hash);
  });

  test("a tampered snapshot fails the restore closed (never patched over)", async () => {
    const runRoot = await freshRoot();
    const workspaceDir = join(runRoot, "workspaces", "e4_arm_h");
    await writeFiles(workspaceDir, { "server.ts": "// v1" });

    const snapshot = await captureE4Snapshot({ workspaceDir, runRoot, arm: "e4_arm_h", taskIndex: 2 });
    await writeFile(join(snapshot.path, "server.ts"), "// tampered");

    expect(
      restoreE4Snapshot({ snapshotDir: snapshot.path, expectedHash: snapshot.hash, workspaceDir })
    ).rejects.toThrow(E4SnapshotHashMismatchError);
  });
});
