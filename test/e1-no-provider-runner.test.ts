import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ScriptedAgentProvider,
  assembleE1CheckpointConversation,
  replayE1NoProviderCheckpointBundle,
  runE1NoProviderCheckpoint
} from "../src/e1-no-provider-runner";
import { loadE1Constants, type E1SealedConstants } from "../src/e1-l1-constants";
import { captureWorkspaceCode } from "../src/snapshot";

const CONSTANTS_PATH = join(
  import.meta.dir,
  "..",
  "docs",
  "protocols",
  "e1-frontier-sealed-constants-v0.2.json"
);

const tempRoots: string[] = [];
let constants: E1SealedConstants;

beforeAll(async () => {
  constants = await loadE1Constants(CONSTANTS_PATH);
});

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("E1 no-provider runner", () => {
  test("assembles fresh per-checkpoint conversations with identical visible content and gated feedback", () => {
    const base = {
      constants,
      checkpointId: "2",
      checkpoints: ["1", "2"],
      taskId: "stub",
      visibleSpecText: "Visible rule A\nVisible rule B",
      checkpointSpecText: "Checkpoint 2 rule",
      workspaceSnapshotText: "src/index.ts\nscratch/probe.test.ts"
    };

    const context = assembleE1CheckpointConversation({
      ...base,
      conditionId: "context_only_spec"
    });
    const feedback = assembleE1CheckpointConversation({
      ...base,
      conditionId: "feedback_capable_spec",
      feedbackAssetPaths: ["specs/steps/stub.steps.ts"]
    });
    const nextCheckpoint = assembleE1CheckpointConversation({
      ...base,
      conditionId: "context_only_spec",
      checkpointId: "3",
      checkpointSpecText: "Checkpoint 3 rule"
    });

    expect(context.thread_scope).toBe("fresh_per_checkpoint");
    expect(context.messages.map((message) => message.content).join("\n")).toContain("Visible rule A");
    expect(feedback.messages.map((message) => message.content).join("\n")).toContain("Visible rule A");
    expect(context.messages.map((message) => message.content).join("\n")).not.toContain("bun run spec");
    expect(feedback.messages.map((message) => message.content).join("\n")).toContain("bun run spec");
    expect(nextCheckpoint.messages.map((message) => message.content).join("\n")).not.toContain(
      "Checkpoint 2 rule"
    );
  });

  test("runs a clean scripted checkpoint and emits a replayable bundle", async () => {
    const workspace = await setupWorkspace();
    const artifactDir = await setupTempDir();
    const provider = new ScriptedAgentProvider({
      providerId: "scripted-clean",
      script: [
        [
          "<<<FILE src/result.ts>>>",
          "export const result = 'done';",
          "<<<END>>>",
          "<<<DONE>>>"
        ].join("\n")
      ]
    });

    const bundle = await runE1NoProviderCheckpoint({
      constants,
      workspacePath: workspace,
      artifactDir,
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      provider,
      prompt: basePrompt()
    });

    expect(bundle.termination).toEqual({ classification: "done", reason: "model declared done" });
    expect(bundle.constants_hash).toHaveLength(64);
    expect(bundle.run_manifest.budget).toMatchObject({
      max_model_turns: constants.turn_protocol.max_turns_per_checkpoint,
      max_verification_executions: constants.turn_protocol.max_verification_executions_per_checkpoint
    });
    expect(bundle.turn_records).toHaveLength(1);
    expect(bundle.turn_records[0].parsed.done).toBe(true);
    expect(JSON.parse(await readFile(join(artifactDir, "checkpoint-bundle.json"), "utf8"))).toMatchObject({
      schema_version: "e1-no-provider-checkpoint-bundle-v0",
      agent_provider_id: "scripted-clean"
    });

    const replayWorkspace = await setupWorkspace();
    const replay = await replayE1NoProviderCheckpointBundle({
      constants,
      workspacePath: replayWorkspace,
      bundle
    });
    expect(replay.final_workspace_code_hash).toBe((await captureWorkspaceCode(workspace)).hash);
  });

  test("classifies scripted no-op stalls after the sealed threshold", async () => {
    const workspace = await setupWorkspace();
    const provider = new ScriptedAgentProvider({
      providerId: "scripted-stall",
      script: ["thinking aloud", "still no block", "one more prose turn"]
    });

    const bundle = await runE1NoProviderCheckpoint({
      constants,
      workspacePath: workspace,
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      provider,
      prompt: basePrompt()
    });

    expect(bundle.termination?.classification).toBe("agent_stalled");
    expect(bundle.turn_records).toHaveLength(3);
    expect(bundle.turn_records.every((record) => record.parsed.no_op)).toBe(true);
  });

  test("terminates on token budget exhaustion before applying parsed changes", async () => {
    const workspace = await setupWorkspace();
    const provider = new ScriptedAgentProvider({
      providerId: "scripted-token-burner",
      script: [
        {
          text: "<<<FILE src/should-not-exist.ts>>>\nexport const value = 1;\n<<<END>>>",
          usage: { provider: { output_tokens: 10 } }
        }
      ]
    });

    const bundle = await runE1NoProviderCheckpoint({
      constants,
      workspacePath: workspace,
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      provider,
      prompt: basePrompt(),
      maxCheckpointTokens: 5
    });

    expect(bundle.termination).toEqual({
      classification: "budget_exhausted",
      reason: "token budget exhausted"
    });
    await expect(readFile(join(workspace, "src", "should-not-exist.ts"), "utf8")).rejects.toThrow();
  });

  test("records replacement refusal while allowing the next scripted turn to continue", async () => {
    const workspace = await setupWorkspace();
    const provider = new ScriptedAgentProvider({
      providerId: "scripted-readonly-vandal",
      script: [
        "<<<FILE package.json>>>\n{\"mutated\":true}\n<<<END>>>",
        "<<<DONE>>>"
      ]
    });

    const bundle = await runE1NoProviderCheckpoint({
      constants,
      workspacePath: workspace,
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      provider,
      prompt: basePrompt(),
      maxModelTurns: 2
    });

    expect(bundle.turn_records[0].l0.replacement_result?.applied).toBe(false);
    expect(bundle.turn_records[0].next_turn_injections).toEqual([
      "replacement rejected: package.json is read-only"
    ]);
    expect(bundle.termination?.classification).toBe("done");
    expect(await readFile(join(workspace, "package.json"), "utf8")).toBe("{\"type\":\"module\"}\n");
  });

  test("classifies post-verification protected-path mutation as invalid_integrity", async () => {
    const workspace = await setupWorkspace();
    const provider = new ScriptedAgentProvider({
      providerId: "scripted-execution-vandal",
      script: [
        [
          "<<<FILE scratch/mutate.ts>>>",
          "import { writeFileSync } from 'node:fs';",
          "writeFileSync('package.json', '{\"mutated\":true}\\n');",
          "<<<END>>>",
          "<<<VERIFY>>>",
          "bun scratch/mutate.ts",
          "<<<END>>>"
        ].join("\n")
      ]
    });

    const bundle = await runE1NoProviderCheckpoint({
      constants,
      workspacePath: workspace,
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      provider,
      prompt: basePrompt()
    });

    expect(bundle.termination?.classification).toBe("invalid_integrity");
    expect(bundle.turn_records[0].l0.verification_result?.protected_path_integrity?.ok).toBe(false);
  });

  test("scripted agents can branch on injected verification output", async () => {
    const workspace = await setupWorkspace();
    const provider = new ScriptedAgentProvider({
      providerId: "scripted-reactive",
      script: [
        [
          "<<<FILE src/value.ts>>>",
          "export const value = false;",
          "<<<END>>>",
          "<<<FILE scratch/value.test.ts>>>",
          "import { expect, test } from 'bun:test';",
          "import { value } from '../src/value';",
          "test('value is true', () => expect(value).toBe(true));",
          "<<<END>>>",
          "<<<VERIFY>>>",
          "bun test scratch/value.test.ts",
          "<<<END>>>"
        ].join("\n"),
        (context) => {
          const transcript = context.messages.map((message) => message.content).join("\n");
          expect(transcript).toContain("exit_code: 1");

          return [
            "<<<FILE src/value.ts>>>",
            "export const value = true;",
            "<<<END>>>",
            "<<<DONE>>>"
          ].join("\n");
        }
      ]
    });

    const bundle = await runE1NoProviderCheckpoint({
      constants,
      workspacePath: workspace,
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      provider,
      prompt: basePrompt(),
      maxModelTurns: 2
    });

    expect(bundle.termination?.classification).toBe("done");
    expect(await readFile(join(workspace, "src", "value.ts"), "utf8")).toBe(
      "export const value = true;"
    );
    expect(bundle.turn_records[0].l0.verification_result?.exit_code).toBe(1);
  });
});

function basePrompt() {
  return {
    taskId: "stub-task",
    visibleSpecText: "Feature: stub\n  Scenario: visible behavior",
    checkpointSpecText: "Checkpoint 1: implement the visible behavior.",
    workspaceSnapshotText: "src/, scratch/, specs/",
    readmeText: "Use the E1 protocol blocks."
  };
}

async function setupWorkspace(): Promise<string> {
  const root = await setupTempDir();
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "scratch"), { recursive: true });
  await mkdir(join(root, "specs", "steps"), { recursive: true });
  await writeFile(join(root, "package.json"), "{\"type\":\"module\"}\n");
  await writeFile(join(root, "bunfig.toml"), "");
  await writeFile(join(root, "specs", "visible.feature"), "Feature: visible\n");
  return root;
}

async function setupTempDir(): Promise<string> {
  const root = join(tmpdir(), `hit-sdd-e1-runner-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}
