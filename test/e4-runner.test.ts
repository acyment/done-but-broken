// M4 acceptance — per-task state machine (architecture §2.2; IMPLEMENTATION-PLAN.md M4). Scripted
// providers drive the real turn adapter, gate, and executor against the generated T0 app — no live
// providers, no spend.
import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { E1ProviderFailureError } from "../src/e1-provider-runtime";
import { validateE4Constants } from "../src/e4/constants";
import { buildE4ArmPolicies } from "../src/e4/arm-policy";
import { captureE4Snapshot } from "../src/e4/snapshot";
import { buildE4ExecutorEvidence, runE4Task, type E4TaskRunResult } from "../src/e4/runner";
import { e4ProceduralRestV1Provider, type E4GenerateResult } from "../src/e4/substrate/provider";
import { generateCumulativeTests } from "../src/e4/substrate/testgen";
import type { E4AgentProvider, E4ChatMessage } from "../src/e4/turns";
import type { E4Budgets } from "../src/e4/types";

const repoRoot = resolve(import.meta.dir, "..");
const scratchRoot = join(repoRoot, "tmp", "e4-runner-tests");
const constants = validateE4Constants(
  JSON.parse(readFileSync(join(repoRoot, "docs", "protocols", "e4-sealed-constants-v0.json"), "utf8"))
);
const policies = buildE4ArmPolicies({
  standingInstruction: constants.protocol_text!.arm_m_standing_instruction
});

const EXECUTOR_CONFIG = {
  readiness_timeout_ms: 10_000,
  request_timeout_ms: 5_000,
  readiness_poll_interval_ms: 25
};

const BUDGETS: E4Budgets = { turns_per_task: 6, verifications_per_task: 2, token_budget: 100_000, spend_cap_usd: 5 };

const generated: E4GenerateResult = await e4ProceduralRestV1Provider.generate({
  substrate_config_id: "procedural-rest-v1-default",
  substrate_seed: 42,
  task_count: 2,
  op_mix: { weights: { drift_opportunity: 0.5, additive: 0.4, behavior_preserving: 0.1 } }
});
const t0CumulativeTests = generateCumulativeTests(generated.initial_ir);

afterAll(async () => {
  await rm(scratchRoot, { recursive: true, force: true });
});

type ScriptedProvider = E4AgentProvider & { calls: E4ChatMessage[][] };

function scriptedProvider(script: string[]): ScriptedProvider {
  let index = 0;
  const calls: E4ChatMessage[][] = [];

  return {
    calls,
    async runTurn({ messages }) {
      calls.push(messages.map((message) => ({ ...message })));
      const text = script[Math.min(index, script.length - 1)];
      index += 1;

      return {
        text,
        usage: { fresh_input_tokens: 10, cached_input_tokens: 0, output_tokens: 20 },
        spend_usd: 0.01
      };
    }
  };
}

async function freshTaskSetup(): Promise<{ runRoot: string; workspaceDir: string; recordsDir: string }> {
  await mkdir(scratchRoot, { recursive: true });
  const runRoot = await mkdtemp(join(scratchRoot, "run-"));
  const workspaceDir = join(runRoot, "workspaces", "arm");

  for (const [path, contents] of Object.entries(generated.initial_workspace)) {
    const absolute = join(workspaceDir, path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, contents);
  }

  return { runRoot, workspaceDir, recordsDir: join(runRoot, "records", "arm", "task-1") };
}

function runTask(input: {
  setup: { runRoot: string; workspaceDir: string; recordsDir: string };
  provider: E4AgentProvider;
  arm?: "e4_arm_0" | "e4_arm_m" | "e4_arm_h";
  budgets?: E4Budgets;
  spend_ledger?: { spent_usd: number };
}): Promise<E4TaskRunResult> {
  return runE4Task({
    arm: policies[input.arm ?? "e4_arm_0"],
    task: generated.tasks[0],
    prior_cumulative_tests: t0CumulativeTests,
    workspace_dir: input.setup.workspaceDir,
    records_dir: input.setup.recordsDir,
    provider: input.provider,
    budgets: input.budgets ?? BUDGETS,
    spend_ledger: input.spend_ledger ?? { spent_usd: 0 },
    constants,
    rename_lineage: [],
    executor_config: EXECUTOR_CONFIG,
    captureSnapshot: () =>
      captureE4Snapshot({
        workspaceDir: input.setup.workspaceDir,
        runRoot: input.setup.runRoot,
        arm: input.arm ?? "e4_arm_0",
        taskIndex: 1
      }),
    retry_sleep: async () => {}
  });
}

const FILE_BLOCK = (path: string, content: string): string => `<<<FILE ${path}>>>\n${content}\n<<<END>>>`;
const VERIFY_BLOCK = (command: string): string => `<<<VERIFY>>>\n${command}\n<<<END>>>`;

describe("E4 per-task runner — arms 0/M (no gate)", () => {
  test("done over a failing hidden oracle is a false-confidence event; close runs oracle → meter → snapshot → probe", async () => {
    const setup = await freshTaskSetup();
    const provider = scriptedProvider([
      `${FILE_BLOCK("notes.txt", "did nothing real")}\n<<<DONE>>>`,
      "probe answer: the spec files looked accurate to me."
    ]);

    const result = await runTask({ setup, provider });

    expect(result.termination).toBe("done");
    expect(result.status).toBe("complete");
    expect(result.phase_at_termination).toBe("implementation");
    expect(result.gate_events).toBeNull();
    expect(result.usage.gate_executor).toBeNull();
    // Task 1's ground truth includes the drawn change; an agent that implemented nothing cannot
    // pass the full cumulative set.
    expect(result.oracle.cumulative_total).toBeGreaterThan(0);
    expect(result.oracle.cumulative_pass).toBeLessThan(result.oracle.cumulative_total);
    expect(result.false_confidence).toEqual({ event: true, enforcement_outcome: null });
    expect(result.spec_touch).toEqual({ touched: false, paths: [] });
    // Probe fired inside the task conversation, after close ([R2: R2-9c]); usage is a separate line.
    expect(result.noticing_probe_answer).toContain("probe answer");
    expect(result.probe_usage).not.toBeNull();
    expect(provider.calls.length).toBe(2);
    expect(provider.calls[1].at(-1)?.content).toBe(constants.protocol_text!.noticing_probe_prompt);
    expect(result.usage.turns).toBe(1);
    expect(result.usage.by_phase.implementation.turns).toBe(1);
    expect(result.usage.by_phase.spec.turns).toBe(0);
    // Retained artifacts: hidden oracle verdicts + drift report + turn records.
    expect(result.executor_artifacts).toContain("hidden-oracle.json");
    await stat(join(setup.recordsDir, "turns.jsonl"));
    await stat(join(setup.recordsDir, "drift-report.json"));
    await stat(join(setup.recordsDir, "probe.json"));
    expect(result.snapshot.hash.length).toBe(64);
    expect(result.drift.meter_version).toBe("e4-drift-meter-v1");
  });

  test("smoke feedback: the sealed command runs the readiness probe; anything else is refused; the budget is enforced", async () => {
    const setup = await freshTaskSetup();
    const provider = scriptedProvider([
      VERIFY_BLOCK("bun run smoke"),
      VERIFY_BLOCK("bun test scratch/evil.ts"),
      VERIFY_BLOCK("bun run smoke"),
      "<<<DONE>>>",
      "probe answer."
    ]);

    const result = await runTask({ setup, provider, budgets: { ...BUDGETS, verifications_per_task: 2 } });

    expect(result.termination).toBe("done");
    // Turn 1: valid smoke (ran). Turn 2: invalid command (refused, consumed the second slot).
    // Turn 3: valid smoke but the budget is exhausted (refused).
    expect(result.smoke_feedback_runs).toBe(1);
    expect(provider.calls[1].at(-1)?.content).toContain("smoke: the server started and answered the readiness probe (ok).");
    expect(provider.calls[2].at(-1)?.content).toContain("is not a sealed E4 command");
    expect(provider.calls[3].at(-1)?.content).toContain("verification budget is exhausted");
  });

  test("three consecutive no-op turns terminate agent_stalled (a complete close — the sequence continues)", async () => {
    const setup = await freshTaskSetup();
    const provider = scriptedProvider(["thinking...", "still thinking...", "hmm.", "probe answer."]);

    const result = await runTask({ setup, provider });

    expect(result.termination).toBe("agent_stalled");
    expect(result.status).toBe("complete");
    expect(result.usage.turns).toBe(3);
    expect(result.false_confidence.event).toBe(false);
  });

  test("the turn budget exhausts into budget_exhausted (a complete close)", async () => {
    const setup = await freshTaskSetup();
    const provider = scriptedProvider([
      FILE_BLOCK("a.txt", "one"),
      FILE_BLOCK("b.txt", "two"),
      "probe answer."
    ]);

    const result = await runTask({ setup, provider, budgets: { ...BUDGETS, turns_per_task: 2 } });

    expect(result.termination).toBe("budget_exhausted");
    expect(result.status).toBe("complete");
    expect(result.usage.turns).toBe(2);
  });

  test("provider exhaustion aborts the task as provider_error; the probe never fires", async () => {
    const setup = await freshTaskSetup();
    let attempts = 0;
    const provider: E4AgentProvider = {
      async runTurn() {
        attempts += 1;
        throw new E1ProviderFailureError({ failureKind: "api_error", message: "boom" });
      }
    };

    const result = await runTask({ setup, provider });

    expect(result.termination).toBe("provider_error");
    expect(result.status).toBe("aborted");
    expect(attempts).toBe(3); // the sealed arm-independent retry policy
    expect(result.noticing_probe_answer).toBe("");
    expect(result.probe_usage).toBeNull();
    await expect(stat(join(setup.recordsDir, "probe.json"))).rejects.toThrow();
    // The record still carries a drift report and a forensic snapshot.
    expect(result.drift.meter_version).toBe("e4-drift-meter-v1");
    expect(result.snapshot.hash.length).toBe(64);
  });

  test("a spend ledger at the cap terminates spend_cap_reached before any provider call", async () => {
    const setup = await freshTaskSetup();
    const provider = scriptedProvider(["<<<DONE>>>"]);

    const result = await runTask({ setup, provider, spend_ledger: { spent_usd: 99 } });

    expect(result.termination).toBe("spend_cap_reached");
    expect(result.status).toBe("aborted");
    expect(result.usage.turns).toBe(0);
    expect(provider.calls.length).toBe(0);
  });
});

describe("E4 per-task runner — Arm H (gate active)", () => {
  test("spec phase locks code out; custody + red check advance; done-over-red is refused; refusal feedback returns the failing checks", async () => {
    const setup = await freshTaskSetup();

    // A real spec edit: mutate the T0 openapi document (parses cleanly, byte-different).
    const openapi = JSON.parse(generated.initial_workspace["specs/openapi.json"]) as Record<string, unknown>;
    openapi["x-e4-test-note"] = "spec updated for task 1";
    const specEdit = FILE_BLOCK("specs/openapi.json", JSON.stringify(openapi, null, 2));

    const provider = scriptedProvider([
      // Turn 1: tries to touch code in the spec phase (rejected) + edits the spec + requests the gate check.
      `${FILE_BLOCK("server.ts", "// premature")}\n${specEdit}\n<<<DONE>>>`,
      // Turn 2: claims done without implementing anything — must be refused over red.
      "<<<DONE>>>",
      // Turns 3-5: stalls out (three no-ops close the task without more executor churn).
      "",
      "",
      "",
      "probe answer."
    ]);

    const result = await runTask({ setup, provider, arm: "e4_arm_h" });

    expect(result.termination).toBe("agent_stalled");
    expect(result.status).toBe("complete");
    expect(result.phase_at_termination).toBe("implementation");

    // The spec-phase write to server.ts was rejected by the gate; the workspace still has T0 code.
    expect(provider.calls[1].at(-1)?.content).toContain("write rejected: server.ts");
    expect(await readFile(join(setup.workspaceDir, "server.ts"), "utf8")).toBe(
      generated.initial_workspace["server.ts"]
    );

    // Custody passed via spec change and the red check ran against the live workspace.
    expect(provider.calls[1].at(-1)?.content).toContain("gate: custody passed (spec_change)");
    expect(result.gate_events?.custody_failures).toBe(0);
    expect(["red", "green_anomaly"]).toContain(result.gate_events?.red_check ?? "");

    // The done-claim over red was refused with the failing checks as feedback (the B1 lever).
    expect(result.gate_events?.refused_done_over_red).toBe(1);
    expect(provider.calls[2].at(-1)?.content).toContain("done-claim refused");
    expect(result.false_confidence).toEqual({ event: false, enforcement_outcome: "refused" });

    // Accounting: spec-phase and implementation-phase turns are separated; the gate executor ran
    // 2 red runs (delta + prior cumulative) and 1 green run (the refused done-claim).
    expect(result.usage.by_phase.spec.turns).toBe(1);
    expect(result.usage.by_phase.implementation.turns).toBe(4);
    expect(result.usage.gate_executor).toEqual(
      expect.objectContaining({ red_runs: 2, green_runs: 1 })
    );
    expect(result.spec_touch.touched).toBe(true);
    expect(result.spec_touch.paths).toEqual(["specs/openapi.json"]);
  });
});

describe("executor evidence for the meter (Gate-1 change 1 input)", () => {
  test("an endpoint passes iff it has verdicts and every one passed", () => {
    const ir = generated.initial_ir;
    const endpoint = ir.endpoints[0];
    const tests = t0CumulativeTests.filter((entry) => entry.source_item_uid === endpoint.semantic_item_uid);

    expect(tests.length).toBeGreaterThan(0);

    const allPass = buildE4ExecutorEvidence({
      ir,
      tests: t0CumulativeTests,
      verdicts: t0CumulativeTests.map((entry) => ({ test_id: entry.test_id, passed: true }))
    });

    expect(allPass.endpoints.length).toBe(ir.endpoints.length);
    expect(allPass.endpoints.every((entry) => entry.passed)).toBe(true);

    const oneFails = buildE4ExecutorEvidence({
      ir,
      tests: t0CumulativeTests,
      verdicts: t0CumulativeTests.map((entry) => ({
        test_id: entry.test_id,
        passed: entry.test_id !== tests[0].test_id
      }))
    });

    const failedEndpoint = oneFails.endpoints.find(
      (entry) => entry.item_id === `endpoint:${endpoint.entity}:${endpoint.kind}`
    );

    expect(failedEndpoint?.passed).toBe(false);

    const noVerdicts = buildE4ExecutorEvidence({ ir, tests: t0CumulativeTests, verdicts: [] });

    expect(noVerdicts.endpoints.every((entry) => entry.passed === false)).toBe(true);
  });
});
