// E5 P1.2w probe machinery facets (prereg docs/e5/E5-P12W-DURING-WORK-PREREG-v1.md): the
// task-loop hook delivers at both points (spec-exit acceptance, accepted verification), records
// every probe-layer oracle invocation distinctly, and the shown-verdict renderer it reuses from
// P1.1 never leaks the held-out side. Plus one runner-wiring integration facet: the two delivery
// points actually fire through runE4V2Sequences when a task-loop probe is attached, and produce
// nothing when it is not (existing e4-v2-dryrun/e4-v3-m4 suites already prove the absent-probe
// byte-path-identical claim — this file does not re-litigate that). Zero spend.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { computeE5P11Partition } from "../src/e5/p11";
import { createE5P12wTaskLoopHook, type E5P12wFeedbackRecord } from "../src/e5/p12w";
import type { E4ExecutorVerdict } from "../src/e4/oracle-executor";
import type { E4HttpTest } from "../src/e4/substrate/testgen";
import { E4_V2_ARM_POLICIES } from "../src/e4/v2/arm-policy";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants } from "../src/e4/v2/constants";
import { E4_V3_CONSTANTS_PATH, loadE4V3Constants } from "../src/e4/v3/constants";
import { buildE4V2FakeProviderFactory } from "../src/e4/v2/fake-provider";
import { runE4V2Sequences } from "../src/e4/v2/orchestrator";
import { runE4V2Task } from "../src/e4/v2/runner";
import { captureE4Snapshot } from "../src/e4/snapshot";
import { buildE4V2AppFiles } from "../src/e4/substrate/v2/scaffold";
import { e4ProceduralRestV2Provider } from "../src/e4/substrate/v2/provider";

const REPO_ROOT = resolve(import.meta.dir, "..");
const EXEC_CONFIG = { readiness_timeout_ms: 15_000, request_timeout_ms: 3_000, readiness_poll_interval_ms: 25 };

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

const PARTITION = computeE5P11Partition(201);
const TESTS: E4HttpTest[] = [];

function oppositeSideIds(): { shown: string; held: string } {
  const representative: Record<string, string> = {
    create: "create",
    read: "read",
    update: "update",
    delete: "delete",
    list: "list",
    analytics: "analytics",
    validation: "unknown-field"
  };
  const idOf = (familyKey: string): string => {
    const [entity, group] = familyKey.split(":");
    return `${entity}-${representative[group]}`;
  };
  const entries = Object.entries(PARTITION.t0_families);
  const shownFamily = entries.find(([, side]) => side === "shown")![0];
  const heldFamily = entries.find(([, side]) => side === "held_out")![0];

  return { shown: idOf(shownFamily), held: idOf(heldFamily) };
}

const IDS = oppositeSideIds();
const VERDICTS = [
  { test_id: IDS.shown, passed: false, failures: ["shown failure detail"] },
  { test_id: IDS.held, passed: false, failures: ["held failure detail"] }
] as E4ExecutorVerdict[];

describe("P1.2w — task-loop hook", () => {
  async function setUpCtx() {
    const root = await mkdtemp(join(tmpdir(), "e5-p12w-"));
    tempRoots.push(root);
    const workspaceDir = join(root, "workspace");
    const recordsDir = join(root, "records");
    await mkdir(workspaceDir, { recursive: true });
    await mkdir(recordsDir, { recursive: true });

    return { workspace_dir: workspaceDir, records_dir: recordsDir, task_index: 3 };
  }

  test("delivers a rendered shown-only message at spec-exit and verification, recording each distinctly", async () => {
    const ctx = await setUpCtx();
    const hook = createE5P12wTaskLoopHook({
      partition: PARTITION,
      tests: TESTS,
      executor_config: EXEC_CONFIG,
      oracle_runner: (async () => ({
        kind: "completed",
        verdicts: VERDICTS,
        pass_count: 0,
        total: VERDICTS.length,
        transcript: []
      })) as never
    });

    const specMessage = await hook.onSpecExitAccepted!(ctx);
    const verificationMessage = await hook.onVerificationAccepted!(ctx);

    expect(specMessage).toContain(IDS.shown);
    expect(specMessage).not.toContain(IDS.held);
    expect(specMessage).not.toContain("held failure detail");
    expect(verificationMessage).toContain(IDS.shown);
    expect(verificationMessage).not.toContain(IDS.held);

    const files = (await readdir(ctx.records_dir)).toSorted();
    expect(files).toEqual(["p12w-feedback-1.json", "p12w-feedback-2.json"]);

    const first = JSON.parse(await readFile(join(ctx.records_dir, "p12w-feedback-1.json"), "utf8")) as E5P12wFeedbackRecord;
    const second = JSON.parse(await readFile(join(ctx.records_dir, "p12w-feedback-2.json"), "utf8")) as E5P12wFeedbackRecord;

    expect(first.delivery_point).toBe("spec_exit");
    expect(first.sequence).toBe(1);
    expect(first.task_index).toBe(3);
    expect(first.rendered_message).toBe(specMessage);
    expect(second.delivery_point).toBe("verification");
    expect(second.sequence).toBe(2);
    expect(second.rendered_message).toBe(verificationMessage);

    // held-out is absent from the FULL RECORD too, not just the returned message.
    const fullRecordText = JSON.stringify(first) + JSON.stringify(second);
    expect(fullRecordText).not.toContain("held failure detail");
  });

  test("an incomplete oracle run yields no rendered message but still records the attempt", async () => {
    const ctx = await setUpCtx();
    const hook = createE5P12wTaskLoopHook({
      partition: PARTITION,
      tests: TESTS,
      executor_config: EXEC_CONFIG,
      oracle_runner: (async () => ({
        kind: "executor_error",
        classification_rationale: "boom"
      })) as never
    });

    const message = await hook.onSpecExitAccepted!(ctx);

    expect(message).toBeNull();

    const record = JSON.parse(
      await readFile(join(ctx.records_dir, "p12w-feedback-1.json"), "utf8")
    ) as E5P12wFeedbackRecord;

    expect(record.oracle_kind).toBe("executor_error");
    expect(record.stats).toBeNull();
    expect(record.rendered_message).toBeNull();
  });
});

describe("P1.2w — runner wiring end-to-end (single real task, zero spend)", () => {
  const SEED = 50; // task 1 of this draw is add_entity (real spec delta files; e4-v2-dryrun.test.ts)
  const TASK_COUNT = 4;

  test("treatment (probe attached) fires spec-exit once and verification during implementation; both records land", async () => {
    const runRoot = await mkdtemp(join(tmpdir(), "e5-p12w-task-"));
    tempRoots.push(runRoot);
    const { constants } = await loadE4V2Constants(join(REPO_ROOT, E4_V2_CONSTANTS_PATH));
    const substrateConfig = {
      substrate_config_id: constants.compatibility_boundary.substrate_config_id,
      substrate_seed: SEED,
      task_count: 4,
      op_mix: { weights: constants.op_mix.weights }
    };
    const generated = await e4ProceduralRestV2Provider.generate(substrateConfig);
    const workspaceDir = join(runRoot, "workspace");

    for (const [path, contents] of Object.entries(generated.initial_workspace)) {
      await mkdir(dirname(join(workspaceDir, path)), { recursive: true });
      await writeFile(join(workspaceDir, path), contents);
    }

    // Turn 1: the real diligent spec-phase change (drives a genuine spec-exit acceptance).
    // Turn 2: the gold implementation files PLUS a smoke VERIFY, combined with DONE in one
    // implementation-phase turn — deterministically exercises point (b) without depending on
    // the diligent fixture's own script (which never calls VERIFY during implementation).
    const diligentProvider = buildE4V2FakeProviderFactory({
      generated,
      smoke_command: constants.feedback.smoke_command
    })({ arm: "e4_arm_p", pairing_label: "p12w-wiring", task_index: 1 });
    const goldFiles = buildE4V2AppFiles(generated.tasks[0].ground_truth_ir, generated.tasks[0].seed_fixture);
    const fileBlock = (path: string, content: string): string => `<<<FILE ${path}>>>\n${content}<<<END>>>`;
    const implementationTurn =
      `${["registry.ts", "schema.ts", "seed.ts"].map((path) => fileBlock(path, goldFiles[path])).join("\n")}\n` +
      `<<<VERIFY>>>\n${constants.feedback.smoke_command}\n<<<END>>>\n<<<DONE>>>`;
    const zeroUsage = { fresh_input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 };
    let call = 0;
    const scriptedProvider = {
      runTurn: async (turnInput: Parameters<typeof diligentProvider.runTurn>[0]) => {
        call += 1;
        return call === 1
          ? diligentProvider.runTurn(turnInput)
          : { text: call === 2 ? implementationTurn : "no further changes.", usage: zeroUsage, spend_usd: 0 };
      }
    };

    const partition = computeE5P11Partition(SEED);
    const recordsDir = join(runRoot, "records", "e4_arm_p", "task-1");
    const result = await runE4V2Task({
      repoRoot: REPO_ROOT,
      arm: E4_V2_ARM_POLICIES.e4_arm_p,
      task: generated.tasks[0],
      workspace_dir: workspaceDir,
      records_dir: recordsDir,
      provider: scriptedProvider,
      budgets: constants.budgets,
      spend_ledger: { spent_usd: 0 },
      constants,
      rename_lineage: [],
      executor_config: constants.executor,
      captureSnapshot: () => captureE4Snapshot({ workspaceDir, runRoot, arm: "e4_arm_p", taskIndex: 1 }),
      probe: createE5P12wTaskLoopHook({
        partition,
        tests: generated.tasks[0].acceptance_tests.cumulative,
        executor_config: constants.executor
      })
    });

    expect(result.termination).toBe("done");

    const files = (await readdir(recordsDir)).filter((name) => name.startsWith("p12w-feedback-")).toSorted();
    expect(files).toEqual(["p12w-feedback-1.json", "p12w-feedback-2.json"]);

    const specRecord = JSON.parse(await readFile(join(recordsDir, "p12w-feedback-1.json"), "utf8")) as E5P12wFeedbackRecord;
    const verificationRecord = JSON.parse(
      await readFile(join(recordsDir, "p12w-feedback-2.json"), "utf8")
    ) as E5P12wFeedbackRecord;

    expect(specRecord.delivery_point).toBe("spec_exit");
    expect(verificationRecord.delivery_point).toBe("verification");
    expect(verificationRecord.task_index).toBe(1);
  }, 600_000);

  test("control (no task_loop_probe) produces no p12w records at all", async () => {
    const runRoot = await mkdtemp(join(tmpdir(), "e5-p12w-dryrun-control-"));
    tempRoots.push(runRoot);
    const { constants, hash } = await loadE4V2Constants(join(REPO_ROOT, E4_V2_CONSTANTS_PATH));
    const { constants: v3Constants } = await loadE4V3Constants({
      v3Path: join(REPO_ROOT, E4_V3_CONSTANTS_PATH),
      v2Path: join(REPO_ROOT, E4_V2_CONSTANTS_PATH)
    });
    const substrateConfig = {
      substrate_config_id: constants.compatibility_boundary.substrate_config_id,
      substrate_seed: SEED,
      task_count: TASK_COUNT,
      op_mix: { weights: constants.op_mix.weights }
    };
    const generated = await e4ProceduralRestV2Provider.generate(substrateConfig);
    const providerFactory = buildE4V2FakeProviderFactory({
      generated,
      smoke_command: constants.feedback.smoke_command
    });

    const result = await runE4V2Sequences({
      repoRoot: REPO_ROOT,
      runRoot,
      run_classification: "dry_run",
      pairing_label: `pair-p12w-dryrun-control-seed-${SEED}`,
      substrate_config: substrateConfig,
      constants,
      constants_hash: hash,
      providerFactory,
      executor_config: constants.executor,
      arms: ["e4_arm_p"],
      v3: { product_config: v3Constants.product_gate }
      // no task_loop_probe — mirrors the P1.2w CLI's control invocation exactly.
    });

    for (const task of result.manifests.e4_arm_p.tasks) {
      const taskRecordsDir = join(runRoot, "records", "e4_arm_p", `task-${task.task_index}`);
      const files = await readdir(taskRecordsDir).catch(() => [] as string[]);

      expect(files.filter((name) => name.startsWith("p12w-feedback-"))).toEqual([]);
    }
  }, 60000);
});
