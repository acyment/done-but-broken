// M5 acceptance — architecture Feature 5, verbatim scenarios: replay-validity is a chain property
// recomputed by recorded-event reconstruction ([R2: R2-9b], no provider calls), executor artifacts
// are retained with recomputable verdicts, and secrets never land in artifacts (fail-closed).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { validateE4Constants, hashE4ConstantsBytes } from "../src/e4/constants";
import { inspectE4ArmSequence } from "../src/e4/inspect";
import { validateE4RunManifest, type E4RunManifest } from "../src/e4/manifest";
import { runE4Run, type E4RunInput } from "../src/e4/run-orchestrator";
import { e4ProceduralRestV1Provider } from "../src/e4/substrate/provider";
import type { E4AgentProviderFactory } from "../src/e4/turns";

const repoRoot = resolve(import.meta.dir, "..");
const scratchRoot = join(repoRoot, "tmp", "e4-inspect-tests");
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
  substrate_seed: 43,
  task_count: 2,
  op_mix: { weights: { drift_opportunity: 0.5, additive: 0.4, behavior_preserving: 0.1 } }
};

const FILE_BLOCK = (path: string, content: string): string => `<<<FILE ${path}>>>\n${content}\n<<<END>>>`;

// One fixed factory for the shared run: every arm writes a file on turn 1 (so replay has real
// writes to reconstruct), then claims done (arms 0/M) or stalls out under the gate (arm H).
function scriptedFactory(text: (key: string) => string[]): E4AgentProviderFactory {
  return ({ arm, task_index }) => {
    const script = text(`${arm}:${task_index}`);
    let index = 0;

    return {
      async runTurn() {
        const turnText = script[Math.min(index, script.length - 1)];
        index += 1;

        return {
          text: turnText,
          usage: { fresh_input_tokens: 10, cached_input_tokens: 0, output_tokens: 20 },
          spend_usd: 0.01
        };
      }
    };
  };
}

const DEFAULT_SCRIPTS = (key: string): string[] => {
  if (key.startsWith("e4_arm_h")) {
    return ["<<<DONE>>>", "", "", "", "probe answer."]; // custody fails → stalls out
  }

  return [`${FILE_BLOCK(`note-${key.split(":")[1]}.txt`, `work for ${key}`)}\n<<<DONE>>>`, "probe answer."];
};

function runInput(runRoot: string, overrides: Partial<E4RunInput> = {}): E4RunInput {
  return {
    runRoot,
    constants,
    constantsHash,
    substrate: e4ProceduralRestV1Provider,
    config: CONFIG,
    pairing_label: "pair-inspect-test",
    run_classification: "dry_run",
    model: { preset: "test-fake", model_id: "fake-model", route_id: "fake-route" },
    providerFactory: scriptedFactory(DEFAULT_SCRIPTS),
    executor_config: EXECUTOR_CONFIG,
    retry_sleep: async () => {},
    ...overrides
  };
}

// One shared completed run for the read-only scenarios; tamper tests copy nothing — they re-run.
let sharedRunRoot: string;
let sharedManifests: Partial<Record<string, E4RunManifest>>;

beforeAll(async () => {
  await mkdir(scratchRoot, { recursive: true });
  sharedRunRoot = await mkdtemp(join(scratchRoot, "run-"));
  sharedManifests = (await runE4Run(runInput(sharedRunRoot))).manifests;
}, 120_000);

afterAll(async () => {
  await rm(scratchRoot, { recursive: true, force: true });
});

describe("Feature 5 — replay-validity is a chain property (recorded-event reconstruction)", () => {
  test("a completed sequence finalizes with chain_replay_valid true, and a from-scratch inspection agrees", async () => {
    for (const arm of ["e4_arm_0", "e4_arm_m", "e4_arm_h"] as const) {
      const manifest = sharedManifests[arm]!;

      // The orchestrator's own finalization already recomputed replay validity.
      expect(manifest.replay_validity.substrate_regeneration_ok).toBe(true);
      expect(manifest.replay_validity.per_task_replay_ok).toEqual([true, true]);
      expect(manifest.replay_validity.chain_replay_valid).toBe(true);

      // From scratch: regenerate the substrate from the manifest's own substrate_config (no
      // in-memory state, no provider call) and reconstruct every snapshot hash.
      const onDisk = validateE4RunManifest(
        JSON.parse(await readFile(join(sharedRunRoot, "manifests", `${arm}.json`), "utf8"))
      );
      const inspection = await inspectE4ArmSequence({ runRoot: sharedRunRoot, manifest: onDisk });

      expect(inspection.chain_replay_valid).toBe(true);
      expect(inspection.snapshot_integrity_ok).toBe(true);
      expect(inspection.executor_artifacts_present).toBe(true);
      expect(inspection.oracle_recomputation_ok).toBe(true);
      expect(inspection.problems).toEqual([]);
    }
  }, 120_000);

  test("the CLI inspects a run root and exits 0 when every sequence is chain-replay-valid", async () => {
    const proc = Bun.spawn(["bun", "run", join(repoRoot, "bin", "e4-inspect.ts"), sharedRunRoot], {
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe"
    });
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    expect(stdout).toContain("e4_arm_0: chain_replay_valid=true");
    expect(stdout).toContain("e4_arm_h: chain_replay_valid=true");
  }, 120_000);
});

describe("Feature 5 — tampering flips the chain to false, never patched over", () => {
  test("a tampered mid-chain snapshot fails the dependent task's replay and the integrity check", async () => {
    const runRoot = await mkdtemp(join(scratchRoot, "tamper-snapshot-"));
    const { manifests } = await runE4Run(runInput(runRoot));

    expect(manifests.e4_arm_0!.replay_validity.chain_replay_valid).toBe(true);

    // Task 2's replay base is snapshot 1: corrupting it breaks reconstruction of snapshot 2.
    await writeFile(join(runRoot, "snapshots", "e4_arm_0", "task-1", "note-1.txt"), "tampered");

    const manifest = validateE4RunManifest(
      JSON.parse(await readFile(join(runRoot, "manifests", "e4_arm_0.json"), "utf8"))
    );
    const inspection = await inspectE4ArmSequence({ runRoot, manifest });

    expect(inspection.per_task_replay_ok).toEqual([true, false]);
    expect(inspection.chain_replay_valid).toBe(false);
    expect(inspection.snapshot_integrity_ok).toBe(false);
  }, 120_000);

  test("a tampered turn record (raw output no longer yields the recorded write) fails that task's replay", async () => {
    const runRoot = await mkdtemp(join(scratchRoot, "tamper-turns-"));
    await runE4Run(runInput(runRoot));

    const turnsPath = join(runRoot, "records", "e4_arm_0", "task-1", "turns.jsonl");
    const line = JSON.parse((await readFile(turnsPath, "utf8")).split("\n")[0]) as { raw_output: string };
    line.raw_output = line.raw_output.replace("work for", "rewritten history for");
    await writeFile(turnsPath, `${JSON.stringify(line)}\n`);

    const manifest = validateE4RunManifest(
      JSON.parse(await readFile(join(runRoot, "manifests", "e4_arm_0.json"), "utf8"))
    );
    const inspection = await inspectE4ArmSequence({ runRoot, manifest });

    expect(inspection.per_task_replay_ok[0]).toBe(false);
    expect(inspection.chain_replay_valid).toBe(false);
  }, 120_000);

  test("edited oracle counts are caught by verdict recomputation from the retained artifacts", async () => {
    const manifest = validateE4RunManifest(
      JSON.parse(await readFile(join(sharedRunRoot, "manifests", "e4_arm_m.json"), "utf8"))
    );
    manifest.tasks[0].oracle.cumulative_pass += 1;

    const inspection = await inspectE4ArmSequence({ runRoot: sharedRunRoot, manifest });

    expect(inspection.oracle_recomputation_ok).toBe(false);
    // The chain property itself is untouched — the lie is in the counts, not the workspace record.
    expect(inspection.chain_replay_valid).toBe(true);
  }, 120_000);
});

describe("Feature 5 — secrets never land in artifacts (emission fails closed)", () => {
  test("a model output carrying a redaction secret aborts the run before the record is written", async () => {
    const runRoot = await mkdtemp(join(scratchRoot, "secrets-"));
    const secretValue = "sk-e4-test-super-secret-value";
    const leakyFactory: E4AgentProviderFactory = () => ({
      async runTurn() {
        return {
          text: `${FILE_BLOCK("leak.txt", `the key is ${secretValue}`)}\n<<<DONE>>>`,
          usage: { fresh_input_tokens: 10, cached_input_tokens: 0, output_tokens: 20 },
          spend_usd: 0.01
        };
      }
    });

    expect(
      runE4Run(
        runInput(runRoot, {
          providerFactory: leakyFactory,
          secrets: [{ id: "e4-test-key", value: secretValue }]
        })
      )
    ).rejects.toThrow(/redaction check failed/);

    // Fail-closed means the leaky record never landed.
    await expect(readFile(join(runRoot, "records", "e4_arm_0", "task-1", "turns.jsonl"), "utf8")).rejects.toThrow();
  }, 120_000);
});
