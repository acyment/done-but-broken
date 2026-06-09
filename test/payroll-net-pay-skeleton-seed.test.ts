import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPayrollNetPayOracle } from "../src/payroll-net-pay-oracle";
import { renderSpecPacket } from "../src/renderer";
import { runPilot, type HiddenOracleRunResult } from "../src/runner";
import { loadTaskPackage } from "../src/task-package";
import { createPayrollReferenceAgent } from "./support/payroll-net-pay-agents";

const repoRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/test$/, "");
const taskDir = join(repoRoot, "tasks", "payroll-net-pay-lifecycle-skeleton-seed");
const taskId = "payroll-net-pay-lifecycle-skeleton-seed";
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

describe("payroll-net-pay-lifecycle-skeleton-seed", () => {
  test("loads as a separate draft boundary with the same checkpoint horizon", async () => {
    const task = await loadTask();

    expect(task.task_id).toBe(taskId);
    expect(task.task_version).toBe("payroll-net-pay-lifecycle-skeleton-seed-v1");
    expect(task.checkpoints).toEqual(checkpointIds);
    expect(task.analysis_plan?.status).toBe("draft");
    expect(task.analysis_plan?.promotion_gates).toContain(
      "skeleton_seed_passes_c01_c06_before_provider_run"
    );
  });

  test("keeps the content-control prompt parity from the original payroll task", async () => {
    const task = await loadTask();
    const ctx = renderSpecPacket({ task, condition_id: "context_only_spec", checkpoint_id: "C18" });
    const fb = renderSpecPacket({ task, condition_id: "feedback_capable_spec", checkpoint_id: "C18" });

    expect(ctx.public_api_contract).toBe(fb.public_api_contract);
    expect(ctx.visible_spec_text).toBe(fb.visible_spec_text);
    expect(ctx.executable_feedback_paths).toEqual([]);
    expect(fb.feedback_command).toBe("bun run spec");
    for (const eventType of eventTypes) {
      expect(ctx.prompt_text).toContain(eventType);
    }
  });

  test("every feedback example remains mirrored into the context-only prompt", async () => {
    const task = await loadTask();
    const ctx = renderSpecPacket({ task, condition_id: "context_only_spec", checkpoint_id: "C18" });
    const assetDir = join(taskDir, "feedback-assets");
    const assetFiles = (await readdir(assetDir)).filter((name) => name.endsWith(".source.ts"));
    const assetText = (
      await Promise.all(assetFiles.map((name) => readFile(join(assetDir, name), "utf8")))
    ).join("\n");
    const values = [...assetText.matchAll(/toBeCloseTo\(([-0-9.]+), 2\)/g)].map((match) => match[1]);

    for (const value of values) {
      expect(ctx.prompt_text).toContain(Number(value).toFixed(2));
    }
  });

  test("the skeleton seed passes easy base checkpoints before the first hard interaction", async () => {
    const task = await loadTask();
    const oracle = createPayrollNetPayOracle(taskId);

    for (const checkpoint_id of ["C01", "C02", "C03", "C04", "C05", "C06"]) {
      const result = await runOracle({ task, checkpoint_id, oracle });
      expect(result.status).toBe("ok");
      expect(result.checks.every((check) => check.passed)).toBe(true);
    }

    const firstHardResult = await runOracle({ task, checkpoint_id: "C07", oracle });
    expect(firstHardResult.status).toBe("failed");
    expect(firstHardResult.checks.some((check) => check.commitment_id === "socialish-ytd-wage-base-cap" && !check.passed)).toBe(true);
  });

  test("the shared reference implementation still passes the skeleton-seed oracle boundary", async () => {
    const task = await loadTask();
    const root = await mkTempRoot();
    const run = await runPilot({
      task,
      run_id: "payroll-skeleton-reference-001",
      runs_root: join(root, "runs"),
      agent: createPayrollReferenceAgent(),
      hidden_oracle: createPayrollNetPayOracle(taskId),
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

async function loadTask() {
  return loadTaskPackage(taskDir);
}

async function runOracle(input: {
  task: Awaited<ReturnType<typeof loadTaskPackage>>;
  checkpoint_id: string;
  oracle: ReturnType<typeof createPayrollNetPayOracle>;
}): Promise<HiddenOracleRunResult> {
  const root = await mkTempRoot();

  return input.oracle.run({
    condition_id: "context_only_spec",
    checkpoint_id: input.checkpoint_id,
    workspace_path: input.task.template_workspace,
    artifact_dir: root,
    hidden_oracle_path: input.task.hidden_oracle_path
  });
}

async function mkTempRoot() {
  const root = join(tmpdir(), `hit-sdd-bench-payroll-skeleton-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}
