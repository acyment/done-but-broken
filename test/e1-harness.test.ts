import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  E1VerificationBudget,
  applyFullFileReplacements,
  buildVerificationExecution,
  truncateHeadTail,
  runVerificationRequest
} from "../src/e1-harness";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("E1 harness mechanics", () => {
  test("applies multi-file full replacements atomically", async () => {
    const workspace = await setupE1Workspace();

    const result = await applyFullFileReplacements({
      workspacePath: workspace,
      replacementBlock: [
        "<<<FILE src/a.ts>>>",
        "export const a = 1;",
        "<<<END>>>",
        "<<<FILE src/b.ts>>>",
        "",
        "<<<END>>>"
      ].join("\n")
    });

    expect(result.applied).toBe(true);
    expect(result.replacements.map((entry) => entry.path)).toEqual(["src/a.ts", "src/b.ts"]);
    expect(await readFile(join(workspace, "src", "a.ts"), "utf8")).toBe("export const a = 1;");
    expect(await readFile(join(workspace, "src", "b.ts"), "utf8")).toBe("");
  });

  test("rejects malformed and read-only replacements without partial writes", async () => {
    const workspace = await setupE1Workspace();
    await writeFile(join(workspace, "src", "keep.ts"), "original\n");

    const malformed = await applyFullFileReplacements({
      workspacePath: workspace,
      replacementBlock: "<<<FILE src/keep.ts>>>\nchanged\n"
    });
    expect(malformed.applied).toBe(false);
    expect(malformed.errors[0]).toContain("missing <<<END>>>");
    expect(await readFile(join(workspace, "src", "keep.ts"), "utf8")).toBe("original\n");

    const readOnly = await applyFullFileReplacements({
      workspacePath: workspace,
      replacementBlock: [
        "<<<FILE src/keep.ts>>>",
        "changed",
        "<<<END>>>",
        "<<<FILE package.json>>>",
        "{}",
        "<<<END>>>"
      ].join("\n")
    });
    expect(readOnly.applied).toBe(false);
    expect(readOnly.errors).toContain("package.json is read-only");
    expect(await readFile(join(workspace, "src", "keep.ts"), "utf8")).toBe("original\n");
  });

  test("builds argv-templated Bun commands without shell execution", async () => {
    const workspace = await setupE1Workspace();
    await writeFile(join(workspace, "scratch", "probe.ts"), "console.log('ok');\n");
    const workspaceReal = await realpath(workspace);

    const probe = await buildVerificationExecution({
      workspacePath: workspace,
      conditionId: "context_only_spec",
      command: "bun scratch/probe.ts",
      checkpoints: ["1", "2", "3"]
    });
    expect(probe.ok).toBe(true);
    expect(probe.ok && probe.argv).toEqual([
      "bun",
      ["--no-install", join(workspaceReal, "scratch", "probe.ts")]
    ]);

    const spec = await buildVerificationExecution({
      workspacePath: workspace,
      conditionId: "feedback_capable_spec",
      command: "bun run spec -- --cp=2",
      checkpoints: ["1", "2", "3"]
    });
    expect(spec.ok).toBe(true);
    expect(spec.ok && spec.argv).toEqual(["bun", ["--no-install", "run", "spec", "--", "--cp=2"]]);
  });

  test("rejects command escapes and feedback command access from context arm", async () => {
    const workspace = await setupE1Workspace();
    await writeFile(join(workspace, "scratch", "a.ts"), "console.log('ok');\n");
    await symlink(join(workspace, "src"), join(workspace, "scratch", "src-link"));

    const rejected = [
      "bun scratch/../src/x.ts",
      `${join(workspace, "src", "x.ts")}`,
      "bun scratch/src-link/escape.ts",
      "bun scratch/*.ts",
      "bun scratch/a.ts; rm -rf /",
      "bun scratch/`whoami`.ts",
      "bun scratch/a.ts && true",
      "bun scratch/$(whoami).ts",
      "FOO=1 bun scratch/a.ts",
      "bun --eval console.log(1)",
      "bun run spec",
      "bun test src/",
      "bun test",
      "bun run spec -- --cp=not-an-int"
    ];

    for (const command of rejected) {
      const result = await buildVerificationExecution({
        workspacePath: workspace,
        conditionId: "context_only_spec",
        command,
        checkpoints: ["1", "2", "3"]
      });
      expect(result.ok, command).toBe(false);
    }

    const badCheckpoint = await buildVerificationExecution({
      workspacePath: workspace,
      conditionId: "feedback_capable_spec",
      command: "bun run spec -- --cp=not-an-int",
      checkpoints: ["1", "2", "3"]
    });
    expect(badCheckpoint.ok).toBe(false);
  });

  test("verification refusals consume slots and execution stops at the cap", async () => {
    const budget = new E1VerificationBudget(2);

    expect(budget.consume()).toEqual({ allowed: true, remaining: 1 });
    expect(budget.consume()).toEqual({ allowed: true, remaining: 0 });
    expect(budget.consume()).toEqual({ allowed: false, remaining: 0 });
    expect(budget.used).toBe(2);
  });

  test("hashes full output while showing deterministic head and tail", () => {
    const output = Array.from({ length: 20 }, (_, index) => `line-${index}`).join("\n");
    const truncated = truncateHeadTail({
      text: output,
      limit: 40,
      head: 20,
      tail: 12
    });

    expect(truncated.truncated).toBe(true);
    expect(truncated.shown).toContain("[... truncated ");
    expect(truncated.shown.startsWith("line-0\nline-1\nline-2")).toBe(true);
    expect(truncated.shown.endsWith("18\nline-19")).toBe(true);
    expect(truncated.full_output_hash).toHaveLength(64);
  });

  test("runs accepted Bun test commands and records shown output plus full hash", async () => {
    const workspace = await setupE1Workspace();
    await writeFile(
      join(workspace, "scratch", "example.test.ts"),
      "import { expect, test } from 'bun:test';\ntest('works', () => expect(1).toBe(1));\n"
    );

    const result = await runVerificationRequest({
      workspacePath: workspace,
      conditionId: "context_only_spec",
      command: "bun test scratch/",
      checkpoints: ["1", "2", "3"],
      outputLimit: 2000
    });

    expect(result.accepted).toBe(true);
    expect(result.exit_code).toBe(0);
    expect(result.full_output_hash).toHaveLength(64);
    expect(result.shown_output).toContain("1 pass");
  });
});

async function setupE1Workspace(): Promise<string> {
  const root = join(tmpdir(), `hit-sdd-e1-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "scratch"), { recursive: true });
  await mkdir(join(root, "specs", "steps"), { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({ type: "module" }));
  await writeFile(join(root, "bunfig.toml"), "");
  return root;
}
