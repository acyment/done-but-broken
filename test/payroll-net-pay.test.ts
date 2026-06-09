import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPayrollNetPayOracle } from "../src/payroll-net-pay-oracle";
import { renderSpecPacket } from "../src/renderer";
import { runPilot } from "../src/runner";
import { loadTaskPackage } from "../src/task-package";
import { createPayrollNaiveAgent, createPayrollReferenceAgent } from "./support/payroll-net-pay-agents";

const repoRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/test$/, "");
const taskDir = join(repoRoot, "tasks", "payroll-net-pay-lifecycle");
const checkpointIds = Array.from({ length: 18 }, (_, index) => `C${String(index + 1).padStart(2, "0")}`);
const eventTypes = [
  "pay_period_started",
  "pre_tax_deduction_set",
  "post_tax_deduction_set",
  "benefit_elected",
  "bonus_paid",
  "bonus_voided",
  "prior_ytd_set",
  "garnishment_order_set",
  "additional_withholding_set"
];
const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

async function loadTask() {
  return loadTaskPackage(taskDir);
}

describe("payroll-net-pay-lifecycle", () => {
  test("loads as a sealed ceiling-resistant task under path-survival-primary-v1", async () => {
    const task = await loadTask();
    expect(task.task_id).toBe("payroll-net-pay-lifecycle");
    expect(task.task_version).toBe("payroll-net-pay-lifecycle-v1");
    expect(task.checkpoints).toEqual(checkpointIds);
    expect(task.analysis_plan?.protocol_profile_id).toBe("path-survival-primary-v1");
    expect(task.analysis_plan?.primary_metric).toBe("regression_free_auc_delta");
    expect(task.analysis_plan?.promotion_gates).toContain(
      "strong_model_difficulty_probe_context_arm_not_18_of_18_before_causal_pilots"
    );
  });

  test("both conditions receive an identical payroll event API in the prompt", async () => {
    const task = await loadTask();

    for (const checkpoint_id of checkpointIds) {
      const ctx = renderSpecPacket({ task, condition_id: "context_only_spec", checkpoint_id });
      const fb = renderSpecPacket({ task, condition_id: "feedback_capable_spec", checkpoint_id });
      expect(ctx.public_api_contract).toBe(fb.public_api_contract);
      for (const eventType of eventTypes) {
        expect(ctx.public_api_contract).toContain(eventType);
      }
    }
  });

  test("both conditions receive identical visible spec text with worked examples", async () => {
    const task = await loadTask();
    const ctx = renderSpecPacket({ task, condition_id: "context_only_spec", checkpoint_id: "C18" });
    const fb = renderSpecPacket({ task, condition_id: "feedback_capable_spec", checkpoint_id: "C18" });

    expect(ctx.visible_spec_text).toBe(fb.visible_spec_text);
    for (const value of ["339.23", "249.69", "272.31", "60.00", "19.50", "16.92", "363.85"]) {
      expect(ctx.visible_spec_text).toContain(value);
    }
  });

  test("every event type and example value used by feedback assets is present in the context-only prompt", async () => {
    const task = await loadTask();
    const ctx = renderSpecPacket({ task, condition_id: "context_only_spec", checkpoint_id: "C18" });
    const assetDir = join(taskDir, "feedback-assets");
    const assetFiles = (await readdir(assetDir)).filter((name) => name.endsWith(".source.ts"));
    const assetText = (
      await Promise.all(assetFiles.map((name) => readFile(join(assetDir, name), "utf8")))
    ).join("\n");
    const values = [...assetText.matchAll(/toBeCloseTo\(([-0-9.]+), 2\)/g)].map((match) => match[1]);

    for (const eventType of eventTypes) {
      if (assetText.includes(`"type": "${eventType}"`)) {
        expect(ctx.prompt_text).toContain(eventType);
      }
    }
    for (const value of values) {
      expect(ctx.prompt_text).toContain(Number(value).toFixed(2));
    }
  });

  test("the hidden oracle uses only event types disclosed in the shared interface", async () => {
    const task = await loadTask();
    const ctx = renderSpecPacket({ task, condition_id: "context_only_spec", checkpoint_id: "C18" });
    const cases = JSON.parse(await readFile(join(taskDir, "hidden-oracle", "oracle-cases.json"), "utf8"));
    const usedTypes = new Set<string>();

    for (const testCase of cases.cases) {
      for (const event of testCase.events) {
        if (event && typeof event.type === "string") {
          usedTypes.add(event.type);
        }
      }
    }

    expect(usedTypes.size).toBe(eventTypes.length);
    for (const eventType of usedTypes) {
      expect(ctx.public_api_contract).toContain(eventType);
    }
  });

  test("feedback assets remain gated to the feedback-capable condition", async () => {
    const task = await loadTask();

    for (const checkpoint_id of checkpointIds) {
      const ctx = renderSpecPacket({ task, condition_id: "context_only_spec", checkpoint_id });
      const fb = renderSpecPacket({ task, condition_id: "feedback_capable_spec", checkpoint_id });
      expect(ctx.executable_feedback_paths).toEqual([]);
      expect(ctx.feedback_command).toBeUndefined();
      expect(ctx.prompt_text).not.toContain("Executable feedback");
      expect(fb.feedback_command).toBe("bun run spec");
      expect(fb.executable_feedback_paths.length).toBeGreaterThan(0);
    }
  });

  test("the task has discrimination signal: a naive agent produces true regressions", async () => {
    const task = await loadTask();
    const root = await mkTempRoot();
    const run = await runPilot({
      task,
      run_id: "payroll-naive-001",
      runs_root: join(root, "runs"),
      agent: createPayrollNaiveAgent(),
      hidden_oracle: createPayrollNetPayOracle(),
      run_classification: "calibration",
      model_provider: { provider: "fake", model: "payroll-naive", adapter_id: "payroll-naive-agent" }
    });
    const result = JSON.parse(await readFile(join(dirname(run.run_manifest_path), "result.json"), "utf8"));

    for (const conditionId of ["context_only_spec", "feedback_capable_spec"] as const) {
      expect(result.condition_summaries[conditionId].regression_count).toBeGreaterThan(0);
      expect(result.regression_free_auc.by_condition[conditionId]).toBeLessThan(1);
    }
  }, 30000);

  test("the reference implementation passes every checkpoint with no regressions", async () => {
    const task = await loadTask();
    const root = await mkTempRoot();
    const run = await runPilot({
      task,
      run_id: "payroll-reference-001",
      runs_root: join(root, "runs"),
      agent: createPayrollReferenceAgent(),
      hidden_oracle: createPayrollNetPayOracle(),
      run_classification: "calibration",
      model_provider: { provider: "fake", model: "payroll-reference", adapter_id: "payroll-reference-agent" }
    });
    const result = JSON.parse(await readFile(join(dirname(run.run_manifest_path), "result.json"), "utf8"));

    for (const conditionId of ["context_only_spec", "feedback_capable_spec"] as const) {
      expect(result.condition_summaries[conditionId].regression_count).toBe(0);
      expect(result.condition_summaries[conditionId].final_checkpoint_passed).toBe(18);
      expect(result.regression_free_auc.by_condition[conditionId]).toBe(1);
    }
  }, 30000);
});

async function mkTempRoot() {
  const root = join(tmpdir(), `hit-sdd-bench-payroll-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}
