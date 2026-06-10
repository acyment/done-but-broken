import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  E1_WORKSPACE_SNAPSHOT_RENDERER_ID,
  collectE1SnapshotFiles,
  renderE1WorkspaceSnapshot,
  renderE1WorkspaceSnapshotFromFiles
} from "../src/e1-workspace-snapshot";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("E1 workspace snapshot renderer", () => {
  test("renders only included roots, byte-ordered, with full contents and sentinels", async () => {
    const workspace = await setupTempDir();
    await mkdir(join(workspace, "src"), { recursive: true });
    await mkdir(join(workspace, "specs"), { recursive: true });
    await mkdir(join(workspace, "scratch"), { recursive: true });
    await mkdir(join(workspace, "node_modules", "dep"), { recursive: true });
    await writeFile(join(workspace, "src", "b.ts"), "export const b = 2;\n");
    await writeFile(join(workspace, "src", "a.ts"), "export const a = 1;\n");
    await writeFile(join(workspace, "specs", "cp1.md"), "Spec text\n");
    await writeFile(join(workspace, "scratch", "probe.test.ts"), "// probe\n");
    await writeFile(join(workspace, "package.json"), "{}\n");
    await writeFile(join(workspace, "node_modules", "dep", "index.js"), "ignored\n");

    const snapshot = await renderE1WorkspaceSnapshot(workspace);

    expect(snapshot.renderer_id).toBe(E1_WORKSPACE_SNAPSHOT_RENDERER_ID);
    expect(snapshot.file_paths).toEqual(["scratch/probe.test.ts", "specs/cp1.md", "src/a.ts", "src/b.ts"]);
    expect(snapshot.text).toContain("=== workspace snapshot begin (e1-workspace-snapshot-v1) ===");
    expect(snapshot.text).toContain("=== workspace snapshot end ===");
    expect(snapshot.text).toContain("- src/a.ts");
    expect(snapshot.text).toContain("=== workspace file: src/a.ts ===");
    expect(snapshot.text).toContain("export const a = 1;");
    expect(snapshot.text).toContain("=== end workspace file: src/a.ts ===");
    expect(snapshot.text).not.toContain("package.json");
    expect(snapshot.text).not.toContain("node_modules");
    expect(snapshot.text.indexOf("workspace file: src/a.ts")).toBeLessThan(
      snapshot.text.indexOf("workspace file: src/b.ts")
    );
  });

  test("is deterministic and matches the pure file-map renderer", async () => {
    const workspace = await setupTempDir();
    await mkdir(join(workspace, "src"), { recursive: true });
    await writeFile(join(workspace, "src", "x.ts"), "export const x = 1;\n");

    const first = await renderE1WorkspaceSnapshot(workspace);
    const second = await renderE1WorkspaceSnapshot(workspace);
    const pure = renderE1WorkspaceSnapshotFromFiles({ "src/x.ts": "export const x = 1;\n" });

    expect(first.text).toBe(second.text);
    expect(first.hash).toBe(second.hash);
    expect(first.hash).toHaveLength(64);
    expect(pure.text).toBe(first.text);
    expect(pure.hash).toBe(first.hash);
  });

  test("renders an explicit empty marker when no files exist under included roots", async () => {
    const workspace = await setupTempDir();
    await mkdir(join(workspace, "scratch"), { recursive: true });
    await writeFile(join(workspace, "README.md"), "not included\n");

    const snapshot = await renderE1WorkspaceSnapshot(workspace);

    expect(snapshot.file_paths).toEqual([]);
    expect(snapshot.text).toContain("(no files under scratch/, specs/, src/)");
    expect(snapshot.text).not.toContain("README.md");
  });

  test("collectE1SnapshotFiles returns the same file map the directory renderer uses", async () => {
    const workspace = await setupTempDir();
    await mkdir(join(workspace, "specs", "steps"), { recursive: true });
    await writeFile(join(workspace, "specs", "steps", "s.ts"), "// step\n");

    const files = await collectE1SnapshotFiles(workspace);

    expect(files).toEqual({ "specs/steps/s.ts": "// step\n" });
    expect(renderE1WorkspaceSnapshotFromFiles(files).hash).toBe((await renderE1WorkspaceSnapshot(workspace)).hash);
  });
});

async function setupTempDir(): Promise<string> {
  const root = join(tmpdir(), `hit-sdd-e1-snap-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}
