import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashProtectedPaths } from "../src/e1-harness";
import {
  E1CheckpointTurnState,
  E1TokenLedger,
  E1TurnAdapter,
  type E1TokenUsage
} from "../src/e1-turn-adapter";
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

describe("E1 turn adapter", () => {
  test("no-op turn increments stall input and injects the sealed notice", async () => {
    const workspace = await setupWorkspace();
    const adapter = await setupAdapter(workspace);
    const state = new E1CheckpointTurnState({ maxModelTurns: 12, maxVerificationExecutions: 6 });

    const result = await adapter.runTurn({
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1", "2", "3"],
      rawModelOutput: "I think the implementation is probably fine.",
      state
    });

    expect(result.parsed.no_op).toBe(true);
    expect(state.consecutiveNoOpTurns).toBe(1);
    expect(result.next_turn_injections).toEqual(["no valid blocks parsed"]);
    expect(result.termination).toBeNull();
    expect(result.verification_budget.used).toBe(0);
  });

  test("three consecutive no-op turns terminate as agent_stalled", async () => {
    const workspace = await setupWorkspace();
    const adapter = await setupAdapter(workspace);
    const state = new E1CheckpointTurnState({ maxModelTurns: 12, maxVerificationExecutions: 6 });

    await adapter.runTurn({
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      rawModelOutput: "prose one",
      state
    });
    await adapter.runTurn({
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      rawModelOutput: "prose two",
      state
    });
    const third = await adapter.runTurn({
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      rawModelOutput: "prose three",
      state
    });

    expect(third.termination).toEqual({
      classification: "agent_stalled",
      reason: "3 consecutive no-op turns"
    });
  });

  test("invalid VERIFY consumes a verification slot through the L0 refusal path", async () => {
    const workspace = await setupWorkspace();
    const adapter = await setupAdapter(workspace);
    const state = new E1CheckpointTurnState({ maxModelTurns: 12, maxVerificationExecutions: 6 });

    const result = await adapter.runTurn({
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      rawModelOutput: "<<<VERIFY>>>\nrm -rf /\n<<<END>>>",
      state
    });

    expect(result.parsed.verification?.valid).toBe(false);
    expect(result.verification_budget.used).toBe(1);
    expect(result.l0.verification_result?.accepted).toBe(false);
    expect(result.next_turn_injections[0]).toContain("REFUSED:");
  });

  test("malformed VERIFY emits no request and consumes no verification slot", async () => {
    const workspace = await setupWorkspace();
    const adapter = await setupAdapter(workspace);
    const state = new E1CheckpointTurnState({ maxModelTurns: 12, maxVerificationExecutions: 6 });

    const result = await adapter.runTurn({
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      rawModelOutput: "<<<VERIFY>>>\nbun run spec\nbun test scratch/a.test.ts\n<<<END>>>",
      state
    });

    expect(result.parsed.verification).toBeNull();
    expect(result.verification_budget.used).toBe(0);
    expect(result.parsed.no_op).toBe(true);
    expect(result.next_turn_injections).toEqual(["no valid blocks parsed"]);
  });

  test("read-only replacement rejection is a replacement result and resets no-op streak", async () => {
    const workspace = await setupWorkspace();
    const adapter = await setupAdapter(workspace);
    const state = new E1CheckpointTurnState({ maxModelTurns: 12, maxVerificationExecutions: 6 });
    state.consecutiveNoOpTurns = 2;

    const result = await adapter.runTurn({
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      rawModelOutput: "<<<FILE package.json>>>\n{}\n<<<END>>>",
      state
    });

    expect(result.parsed.no_op).toBe(false);
    expect(state.consecutiveNoOpTurns).toBe(0);
    expect(result.l0.replacement_result?.applied).toBe(false);
    expect(result.l0.replacement_result?.errors).toContain("package.json is read-only");
    expect(result.next_turn_injections).toEqual(["replacement rejected: package.json is read-only"]);
  });

  test("verification budget exhaustion refuses execution deterministically", async () => {
    const workspace = await setupWorkspace();
    const adapter = await setupAdapter(workspace);
    const state = new E1CheckpointTurnState({ maxModelTurns: 12, maxVerificationExecutions: 1 });

    await adapter.runTurn({
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      rawModelOutput: "<<<VERIFY>>>\nrm -rf /\n<<<END>>>",
      state
    });
    const second = await adapter.runTurn({
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      rawModelOutput: "<<<VERIFY>>>\nrm -rf /\n<<<END>>>",
      state
    });

    expect(second.l0.verification_result).toBeNull();
    expect(second.next_turn_injections).toEqual(["verification budget exhausted"]);
    expect(second.termination).toEqual({
      classification: "budget_exhausted",
      reason: "verification budget exhausted"
    });
  });

  test("post-replacement integrity mismatch terminates before verification", async () => {
    const workspace = await setupWorkspace();
    const baseline = await hashProtectedPaths(workspace);
    await writeFile(join(workspace, "specs", "visible.feature"), "Feature: changed\n");
    const adapter = new E1TurnAdapter({ constants, workspacePath: workspace, protectedPathBaseline: baseline });
    const state = new E1CheckpointTurnState({ maxModelTurns: 12, maxVerificationExecutions: 6 });

    const result = await adapter.runTurn({
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      rawModelOutput:
        "<<<FILE src/a.ts>>>\nexport const a = 1;\n<<<END>>>\n<<<VERIFY>>>\nrm -rf /\n<<<END>>>",
      state
    });

    expect(result.l0.post_replacement_integrity?.ok).toBe(false);
    expect(result.l0.verification_result).toBeNull();
    expect(result.termination?.classification).toBe("invalid_integrity");
  });

  test("post-verification integrity mismatch terminates as invalid_integrity", async () => {
    const workspace = await setupWorkspace();
    await writeFile(
      join(workspace, "scratch", "mutate.ts"),
      "import { writeFileSync } from 'node:fs';\nwriteFileSync('package.json', '{\"mutated\":true}\\n');\n"
    );
    const adapter = await setupAdapter(workspace);
    const state = new E1CheckpointTurnState({ maxModelTurns: 12, maxVerificationExecutions: 6 });

    const result = await adapter.runTurn({
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      rawModelOutput: "<<<VERIFY>>>\nbun scratch/mutate.ts\n<<<END>>>",
      state
    });

    expect(result.l0.verification_result?.protected_path_integrity?.ok).toBe(false);
    expect(result.termination?.classification).toBe("invalid_integrity");
  });

  test("done after replacement and verification is honored after applying both", async () => {
    const workspace = await setupWorkspace();
    await writeFile(
      join(workspace, "scratch", "probe.test.ts"),
      "import { expect, test } from 'bun:test';\ntest('ok', () => expect(1).toBe(1));\n"
    );
    const adapter = await setupAdapter(workspace);
    const state = new E1CheckpointTurnState({ maxModelTurns: 12, maxVerificationExecutions: 6 });

    const result = await adapter.runTurn({
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      rawModelOutput:
        "<<<DONE>>>\n<<<VERIFY>>>\nbun test scratch/probe.test.ts\n<<<END>>>\n<<<FILE src/a.ts>>>\nexport const a = 1;\n<<<END>>>",
      state
    });

    expect(await readFile(join(workspace, "src", "a.ts"), "utf8")).toBe("export const a = 1;");
    expect(result.l0.verification_result?.accepted).toBe(true);
    expect(result.termination).toEqual({ classification: "done", reason: "model declared done" });
  });

  test("token ledger records provider usage, estimator shadow, cached prefix, and injected output", async () => {
    const workspace = await setupWorkspace();
    const adapter = await setupAdapter(workspace);
    const state = new E1CheckpointTurnState({
      maxModelTurns: 12,
      maxVerificationExecutions: 6,
      tokenLedger: new E1TokenLedger({ maxCheckpointTokens: 100 })
    });
    const usage: E1TokenUsage = {
      provider: { output_tokens: 11, injected_verification_output_tokens: 5, cached_input_tokens: 99 },
      estimator: { output_tokens: 12, injected_verification_output_tokens: 4, cached_input_tokens: 88 }
    };

    const result = await adapter.runTurn({
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      rawModelOutput: "<<<DONE>>>",
      state,
      tokenUsage: usage
    });

    expect(result.token_ledger.debited_tokens).toBe(16);
    expect(result.token_ledger.cached_prefix_tokens).toBe(99);
    expect(result.token_ledger.estimator_shadow_tokens).toEqual({
      output_tokens: 12,
      injected_verification_output_tokens: 4,
      cached_input_tokens: 88
    });
    expect(result.termination).toEqual({ classification: "done", reason: "model declared done" });
  });

  test("token exhaustion terminates before applying parsed changes", async () => {
    const workspace = await setupWorkspace();
    const adapter = await setupAdapter(workspace);
    const state = new E1CheckpointTurnState({
      maxModelTurns: 12,
      maxVerificationExecutions: 6,
      tokenLedger: new E1TokenLedger({ maxCheckpointTokens: 5 })
    });

    const result = await adapter.runTurn({
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      rawModelOutput: "<<<FILE src/a.ts>>>\nexport const a = 1;\n<<<END>>>",
      state,
      tokenUsage: { provider: { output_tokens: 6, injected_verification_output_tokens: 0 } }
    });

    expect(result.termination).toEqual({
      classification: "budget_exhausted",
      reason: "token budget exhausted"
    });
    await expect(readFile(join(workspace, "src", "a.ts"), "utf8")).rejects.toThrow();
  });
});

async function setupAdapter(workspace: string): Promise<E1TurnAdapter> {
  return new E1TurnAdapter({
    constants,
    workspacePath: workspace,
    protectedPathBaseline: await hashProtectedPaths(workspace)
  });
}

async function setupWorkspace(): Promise<string> {
  const root = join(tmpdir(), `hit-sdd-e1-turn-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "scratch"), { recursive: true });
  await mkdir(join(root, "specs", "steps"), { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({ type: "module" }));
  await writeFile(join(root, "bunfig.toml"), "");
  await writeFile(join(root, "specs", "visible.feature"), "Feature: visible\n");
  return root;
}
