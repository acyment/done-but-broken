// M4 acceptance — architecture Feature 4, verbatim scenarios: state carries forward, arm parity
// allowlist-enforced, crash-resume restores the chain, smoke feedback arm-uniform. Scripted
// providers, real substrate/executor/meter, zero spend.
import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { E4ArmParityError, buildE4ArmPolicies, validateE4RuntimeArmParity } from "../src/e4/arm-policy";
import { validateE4Constants, hashE4ConstantsBytes } from "../src/e4/constants";
import { validateE4RunManifest } from "../src/e4/manifest";
import { buildE4ArmRuntimes, runE4Run, type E4RunInput } from "../src/e4/run-orchestrator";
import { E4SnapshotHashMismatchError } from "../src/e4/snapshot";
import { e4ProceduralRestV1Provider } from "../src/e4/substrate/provider";
import type { E4AgentProvider, E4AgentProviderFactory, E4ChatMessage, E4ProviderTurnResult } from "../src/e4/turns";
import type { E4ArmId } from "../src/e4/types";

const repoRoot = resolve(import.meta.dir, "..");
const scratchRoot = join(repoRoot, "tmp", "e4-orchestrator-tests");
const constantsBytes = readFileSync(join(repoRoot, "docs", "protocols", "e4-sealed-constants-v0.json"));
const constants = validateE4Constants(JSON.parse(constantsBytes.toString("utf8")));
const constantsHash = hashE4ConstantsBytes(constantsBytes);

const EXECUTOR_CONFIG = {
  readiness_timeout_ms: 10_000,
  request_timeout_ms: 5_000,
  readiness_poll_interval_ms: 25
};

const CONFIG = {
  substrate_config_id: "procedural-rest-v1-default",
  substrate_seed: 42,
  task_count: 2,
  op_mix: { weights: { drift_opportunity: 0.5, additive: 0.4, behavior_preserving: 0.1 } }
};

afterAll(async () => {
  await rm(scratchRoot, { recursive: true, force: true });
});

async function freshRunRoot(): Promise<string> {
  await mkdir(scratchRoot, { recursive: true });
  return mkdtemp(join(scratchRoot, "run-"));
}

// Scripts are keyed "<arm>:<task_index>"; every provider call past the script's end repeats the
// last entry (which doubles as the noticing-probe answer).
type ScriptTable = Record<string, string[]>;

type CallLog = Map<string, E4ChatMessage[][]>;

function scriptedFactory(scripts: ScriptTable): { factory: E4AgentProviderFactory; calls: CallLog } {
  const calls: CallLog = new Map();

  const factory: E4AgentProviderFactory = ({ arm, task_index }) => {
    const key = `${arm}:${task_index}`;
    const script = scripts[key] ?? ["<<<DONE>>>", "probe answer."];
    let index = 0;
    const log: E4ChatMessage[][] = [];
    calls.set(key, log);

    const provider: E4AgentProvider = {
      async runTurn({ messages }) {
        log.push(messages.map((message) => ({ ...message })));
        const text = script[Math.min(index, script.length - 1)];
        index += 1;

        return {
          text,
          usage: { fresh_input_tokens: 10, cached_input_tokens: 0, output_tokens: 20 },
          spend_usd: 0.01
        };
      }
    };

    return provider;
  };

  return { factory, calls };
}

function runInput(runRoot: string, factory: E4AgentProviderFactory, resume = false): E4RunInput {
  return {
    runRoot,
    constants,
    constantsHash,
    substrate: e4ProceduralRestV1Provider,
    config: CONFIG,
    pairing_label: "pair-orchestrator-test",
    run_classification: "dry_run",
    model: { preset: "test-fake", model_id: "fake-model", route_id: "fake-route" },
    providerFactory: factory,
    resume,
    executor_config: EXECUTOR_CONFIG,
    retry_sleep: async () => {}
  };
}

const FILE_BLOCK = (path: string, content: string): string => `<<<FILE ${path}>>>\n${content}\n<<<END>>>`;
const SMOKE = "<<<VERIFY>>>\nbun run smoke\n<<<END>>>";

describe("Feature 4 — full 3-arm dry run: state carries forward, smoke is arm-uniform, manifests assemble", () => {
  test("runs 2 tasks per arm and satisfies the Feature 4 invariants", async () => {
    const runRoot = await freshRunRoot();

    // Turn 1 runs smoke (its feedback is delivered on turn 2's request); the task then ends on a
    // later turn — terminal-turn feedback is computed but never delivered (the conversation ends).
    const taskOneScript = [
      `${SMOKE}\n${FILE_BLOCK("e4-marker.txt", "carried forward")}`,
      "<<<DONE>>>",
      "probe answer one."
    ];
    const taskTwoScript = ["<<<DONE>>>", "probe answer two."];
    const armHTaskTwoScript = ["<<<DONE>>>", "", "", "", "probe answer two."]; // custody fails (spec untouched) → stalls out

    const { factory, calls } = scriptedFactory({
      "e4_arm_0:1": taskOneScript,
      "e4_arm_m:1": taskOneScript,
      // Arm H: smoke on turn 1; DONE over an untouched spec on turn 2 (custody failure); stalls out.
      "e4_arm_h:1": [SMOKE, "<<<DONE>>>", "", "", "", "probe answer one."],
      "e4_arm_0:2": taskTwoScript,
      "e4_arm_m:2": taskTwoScript,
      "e4_arm_h:2": armHTaskTwoScript
    });

    const { manifests } = await runE4Run(runInput(runRoot, factory));
    const arms: E4ArmId[] = ["e4_arm_0", "e4_arm_m", "e4_arm_h"];

    for (const arm of arms) {
      const manifest = manifests[arm]!;

      // Manifest assembly: validates, one record per task, boundary + pairing recorded.
      expect(() => validateE4RunManifest(JSON.parse(JSON.stringify(manifest)))).not.toThrow();
      expect(manifest.tasks.length).toBe(2);
      expect(manifest.pairing_label).toBe("pair-orchestrator-test");
      expect(manifest.substrate_seed).toBe(42);
      expect(manifest.compatibility_boundary.constants_hash).toBe(constantsHash);
      expect(manifest.budgets).toEqual(constants.budgets!);
      expect(manifest.resume_events).toEqual([]);
      expect(manifest.replay_validity.substrate_regeneration_ok).toBe(true);
      // [M5] the sequence finalizes by recomputing replay validity from the retained records.
      expect(manifest.replay_validity.per_task_replay_ok).toEqual([true, true]);
      expect(manifest.replay_validity.chain_replay_valid).toBe(true);
      expect(manifest.tasks.every((task) => task.status === "complete")).toBe(true);

      // The on-disk manifest matches the returned one (incremental durability).
      const onDisk = validateE4RunManifest(
        JSON.parse(await readFile(join(runRoot, "manifests", `${arm}.json`), "utf8"))
      );

      expect(onDisk.tasks.length).toBe(2);

      // Scenario: state carries forward — task 2 starts from the workspace as-is with a FRESH
      // conversation (2 messages: system + task, no assistant history).
      const taskTwoCalls = calls.get(`${arm}:2`)!;

      expect(taskTwoCalls[0].length).toBe(2);
      expect(taskTwoCalls[0].some((message) => message.role === "assistant")).toBe(false);

      // Snapshots anchor the chain: task-0 (sequence start) through task-2.
      for (const taskIndex of [0, 1, 2]) {
        await stat(join(runRoot, "snapshots", arm, `task-${taskIndex}`));
      }
    }

    // State carries forward (workspace half): arms 0/M wrote e4-marker.txt in task 1; task 2's
    // opening snapshot must show it.
    for (const arm of ["e4_arm_0", "e4_arm_m"] as const) {
      expect(calls.get(`${arm}:2`)![0][1].content).toContain("e4-marker.txt");
      expect(manifests[arm]!.tasks[0].termination).toBe("done");
      // done over a failing oracle in the ungated arms = the false-confidence phenomenon.
      expect(manifests[arm]!.tasks[0].false_confidence.event).toBe(true);
    }

    // Scenario: smoke feedback is arm-uniform — same command, same budget cost, same output text.
    const smokeFeedback = (arm: E4ArmId): string | undefined =>
      calls
        .get(`${arm}:1`)!
        .flatMap((messages) => messages)
        .find((message) => message.role === "user" && message.content.includes("smoke:"))
        ?.content.split("\n")
        .find((line) => line.startsWith("smoke:"));

    const smokeLines = (["e4_arm_0", "e4_arm_m", "e4_arm_h"] as const).map(smokeFeedback);

    expect(smokeLines[0]).toBe("smoke: the server started and answered the readiness probe (ok).");
    expect(new Set(smokeLines).size).toBe(1);

    for (const arm of arms) {
      expect(manifests[arm]!.tasks[0].smoke_feedback_runs).toBe(1);
    }

    // Arm-H channels stay arm-local: gate events/usage exist only there.
    expect(manifests.e4_arm_h!.tasks[0].gate_events).not.toBeNull();
    expect(manifests.e4_arm_h!.tasks[0].gate_events?.custody_failures).toBeGreaterThan(0);
    expect(manifests.e4_arm_0!.tasks[0].gate_events).toBeNull();
    expect(manifests.e4_arm_m!.tasks[0].gate_events).toBeNull();
    expect(manifests.e4_arm_h!.tasks[0].phase_at_termination).toBe("spec");
    expect(manifests.e4_arm_h!.tasks[0].gate_events?.red_check).toBeNull();
  }, 120_000);
});

describe("Feature 4 — arm parity is allowlist-enforced", () => {
  test("orchestrator-built runtimes pass; any delta outside the allowlist throws", async () => {
    const generated = await e4ProceduralRestV1Provider.generate(CONFIG);
    const policies = buildE4ArmPolicies({
      standingInstruction: constants.protocol_text!.arm_m_standing_instruction
    });
    const runtimes = buildE4ArmRuntimes({
      policies,
      generated,
      constants,
      pairing_label: "pair-parity-test"
    });

    expect(() => validateE4RuntimeArmParity(runtimes)).not.toThrow();

    const tamperedBudgets = runtimes.map((runtime) =>
      runtime.arm === "e4_arm_h"
        ? { ...runtime, budgets: { ...runtime.budgets, turns_per_task: runtime.budgets.turns_per_task + 1 } }
        : runtime
    );

    expect(() => validateE4RuntimeArmParity(tamperedBudgets)).toThrow(E4ArmParityError);

    const tamperedTaskText = runtimes.map((runtime) =>
      runtime.arm === "e4_arm_0" ? { ...runtime, task_text: `${runtime.task_text} (easier)` } : runtime
    );

    expect(() => validateE4RuntimeArmParity(tamperedTaskText)).toThrow(E4ArmParityError);
  });
});

describe("Feature 4 — crash-resume restores the chain", () => {
  // A provider that THROWS is correctly laundered into a provider_error abort by the sealed retry
  // policy — that is a classified outcome, not a crash. A harness crash is an UNCLASSIFIED error
  // mid-task: simulated here as a malformed provider result that detonates inside the runner's
  // accounting (exactly the shape of a real harness bug or SIGKILL: durable state stops at the
  // last flushed record).
  function crashingFactory(base: ScriptTable): E4AgentProviderFactory {
    const { factory } = scriptedFactory(base);

    return (input) => {
      const provider = factory(input);

      if (input.arm === "e4_arm_0" && input.task_index === 2) {
        let turn = 0;

        return {
          async runTurn(request) {
            turn += 1;

            if (turn === 2) {
              return { text: "simulated harness crash" } as unknown as E4ProviderTurnResult;
            }

            return provider.runTurn(request);
          }
        };
      }

      return provider;
    };
  }

  const CRASH_SCRIPTS: ScriptTable = {
    "e4_arm_0:1": [`${FILE_BLOCK("e4-marker.txt", "task one")}\n<<<DONE>>>`, "probe answer."],
    // Task 2 writes partial state on turn 1, then the harness crashes on turn 2.
    "e4_arm_0:2": [FILE_BLOCK("partial.txt", "half-finished"), "<<<DONE>>>", "probe answer."]
  };

  test("a crash mid-task resumes from the verified snapshot; the partial task lands under aborted/ with a resume_event", async () => {
    const runRoot = await freshRunRoot();

    await expect(runE4Run(runInput(runRoot, crashingFactory(CRASH_SCRIPTS)))).rejects.toThrow();

    // The crash left task 1 durable and task 2 partial (turn records but no manifest record).
    const crashed = validateE4RunManifest(
      JSON.parse(await readFile(join(runRoot, "manifests", "e4_arm_0.json"), "utf8"))
    );

    expect(crashed.tasks.length).toBe(1);
    await stat(join(runRoot, "records", "e4_arm_0", "task-2"));

    const { factory: resumeFactory, calls: resumeCalls } = scriptedFactory({
      "e4_arm_0:2": ["<<<DONE>>>", "probe answer after resume."]
    });

    const { manifests } = await runE4Run(runInput(runRoot, resumeFactory, true));
    const resumed = manifests.e4_arm_0!;

    // Task 4 of the scenario template maps to task 2 here: snapshot 1's hash was verified before
    // restore, task 2 restarted fresh, the partial records moved under aborted/.
    expect(resumed.tasks.length).toBe(2);
    expect(resumed.resume_events).toEqual([
      {
        restored_snapshot_task_index: 1,
        restored_snapshot_hash: crashed.tasks[0].snapshot.hash,
        resumed_at_task_index: 2,
        aborted_task_index: 2
      }
    ]);
    // The partial task-2 turn records (turn 1 wrote partial.txt) live under aborted/, retained for
    // forensics; the fresh task-2 records are the resumed attempt and never saw that write.
    const abortedTurns = await readFile(
      join(runRoot, "aborted", "e4_arm_0", "task-2-resume-1", "turns.jsonl"),
      "utf8"
    );
    const freshTurns = await readFile(join(runRoot, "records", "e4_arm_0", "task-2", "turns.jsonl"), "utf8");

    expect(abortedTurns).toContain("partial.txt");
    expect(freshTurns).not.toContain("partial.txt");

    // The partial write was discarded by the restore: task 2 restarted from snapshot 1.
    await expect(stat(join(runRoot, "snapshots", "e4_arm_0", "task-2", "partial.txt"))).rejects.toThrow();
    expect(resumeCalls.get("e4_arm_0:2")![0][1].content).toContain("e4-marker.txt");
    expect(resumeCalls.get("e4_arm_0:2")![0][1].content).not.toContain("partial.txt");

    // [M5] the resumed chain is replay-valid ACROSS the seam: task 2's fresh records replay over
    // the verified snapshot 1, and the seam anchor matches the recorded hash.
    expect(resumed.replay_validity.chain_replay_valid).toBe(true);

    // Arms the crashed run never reached started fresh on resume and completed.
    expect(manifests.e4_arm_m!.tasks.length).toBe(2);
    expect(manifests.e4_arm_h!.tasks.length).toBe(2);
    expect(manifests.e4_arm_m!.resume_events).toEqual([]);
  }, 120_000);

  test("a tampered snapshot fails the resume closed, before any state is touched", async () => {
    const runRoot = await freshRunRoot();

    await expect(runE4Run(runInput(runRoot, crashingFactory(CRASH_SCRIPTS)))).rejects.toThrow();

    await writeFile(join(runRoot, "snapshots", "e4_arm_0", "task-1", "e4-marker.txt"), "tampered");

    const { factory } = scriptedFactory({});

    await expect(runE4Run(runInput(runRoot, factory, true))).rejects.toThrow(E4SnapshotHashMismatchError);

    // Fail-closed: the partial task records were NOT moved.
    await stat(join(runRoot, "records", "e4_arm_0", "task-2"));
  }, 120_000);
});
