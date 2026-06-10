import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ScriptedAgentProvider,
  runE1NoProviderCheckpoint,
  type E1NoProviderCheckpointBundle
} from "../src/e1-no-provider-runner";
import { extractE1ConditionBundles, renderE1StatsLines, summarizeE1Stats } from "../src/e1-stats";
import { loadE1Constants, type E1SealedConstants } from "../src/e1-l1-constants";

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

describe("E1 stats extractor", () => {
  test("summarizes turns, verification use, no-op rate, terminations, and wall time", async () => {
    const cleanBundle = await runCheckpoint([
      ["<<<FILE src/result.ts>>>", "export const result = 1;", "<<<END>>>"].join("\n"),
      ["<<<VERIFY>>>", "bun scratch/missing.ts", "<<<END>>>"].join("\n"),
      "<<<DONE>>>"
    ]);
    const stallBundle = await runCheckpoint(["prose only", "still prose", "more prose"]);
    const summary = summarizeE1Stats([
      { context_only_spec: [cleanBundle, stallBundle] }
    ]);
    const group = summary.by_condition.context_only_spec!;

    expect(group.checkpoints).toBe(2);
    expect(group.turns).toBe(6);
    expect(group.t_mean_turns_per_checkpoint).toBe(3);
    expect(group.verification_requests).toBe(1);
    expect(group.verification_slots_used).toBe(1);
    expect(group.no_op_turns).toBe(3);
    expect(group.no_op_turn_rate).toBe(0.5);
    expect(group.terminations_by_classification.done).toBe(1);
    expect(group.terminations_by_classification.agent_stalled).toBe(1);
    expect(group.agent_stalled_checkpoint_rate).toBe(0.5);
    expect(group.provider_tokens_per_turn.fresh_input_mean).toBeNull();
    expect(group.wall_time_ms_per_turn.total_mean).not.toBeNull();
    expect(group.wall_time_ms_per_turn.total_mean!).toBeGreaterThanOrEqual(0);
    expect(group.wall_time_ms_per_turn.total_max!).toBeGreaterThanOrEqual(
      group.wall_time_ms_per_turn.provider_call_mean!
    );
    expect(summary.overall.turns).toBe(6);

    const lines = renderE1StatsLines(summary);

    expect(lines).toContain("overall.no_op_turn_rate=0.5");
    expect(lines).toContain("context_only_spec.t_mean_turns_per_checkpoint=3");
    expect(lines).toContain("context_only_spec.terminations.agent_stalled=1");
  });

  test("extracts condition bundles from provider and no-provider bundle schemas", () => {
    const checkpointBundle = { turn_records: [] } as unknown as E1NoProviderCheckpointBundle;

    expect(
      extractE1ConditionBundles({
        schema_version: "e1-task-package-provider-bundle-v0",
        provider_run: { condition_bundles: { context_only_spec: [checkpointBundle] } }
      }).context_only_spec
    ).toHaveLength(1);
    expect(
      extractE1ConditionBundles({
        schema_version: "e1-task-package-no-provider-bundle-v0",
        no_provider_run: { arm_bundles: { feedback_capable_spec: [checkpointBundle] } }
      }).feedback_capable_spec
    ).toHaveLength(1);
    expect(() => extractE1ConditionBundles({ schema_version: "unknown" })).toThrow(
      "Unsupported E1 bundle schema_version"
    );
  });
});

async function runCheckpoint(script: string[]): Promise<E1NoProviderCheckpointBundle> {
  const workspace = await setupWorkspace();

  return runE1NoProviderCheckpoint({
    constants,
    workspacePath: workspace,
    conditionId: "context_only_spec",
    checkpointId: "1",
    checkpoints: ["1"],
    provider: new ScriptedAgentProvider({ providerId: "stats-fixture", script }),
    prompt: {
      taskId: "stats-fixture",
      visibleSpecText: "Visible rule",
      checkpointSpecText: "Checkpoint rule",
      workspaceSnapshotText: "src/"
    }
  });
}

async function setupWorkspace(): Promise<string> {
  const root = await setupTempDir();
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "scratch"), { recursive: true });
  await mkdir(join(root, "specs"), { recursive: true });
  await writeFile(join(root, "package.json"), "{\"type\":\"module\"}\n");
  return root;
}

async function setupTempDir(): Promise<string> {
  const root = join(tmpdir(), `hit-sdd-e1-stats-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}
