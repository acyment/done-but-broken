import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSpecPacket } from "../src/renderer";
import { runPilot } from "../src/runner";
import { loadTaskPackage } from "../src/task-package";
import { createPricingDiscountOracle } from "../src/pricing-discount-oracle";
import { createPricingNaiveAgent, createPricingReferenceAgent } from "./support/pricing-discount-agents";

const repoRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/test$/, "");
const taskDir = join(repoRoot, "tasks", "pricing-discount-lifecycle-content-controlled");
const checkpointIds = ["I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "I09"];
const eventTypes = [
  "item_added",
  "line_sale_set",
  "bulk_rule_set",
  "coupon_applied",
  "cap_set",
  "tax_rate_set",
  "tax_exempt_set"
];
const gemini31ProProviderExecutionProfileId =
  "openrouter-loop-v1-modelgoogle-gemini-3.1-pro-preview-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1";
const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

async function loadTask() {
  return loadTaskPackage(taskDir);
}

describe("pricing-discount-lifecycle-content-controlled", () => {
  test("loads as a distinct sealed task version under path-survival-primary-v1", async () => {
    const task = await loadTask();
    expect(task.task_id).toBe("pricing-discount-lifecycle-content-controlled");
    expect(task.task_version).toBe("pricing-discount-lifecycle-content-controlled-v1");
    expect(task.checkpoints).toEqual(checkpointIds);
    expect(task.analysis_plan?.protocol_profile_id).toBe("path-survival-primary-v1");
    expect(task.analysis_plan?.primary_metric).toBe("regression_free_auc_delta");
  });

  test("registers the Gemini 3.1 Pro content-controlled control plan as a separate provider boundary", async () => {
    const task = await loadTask();
    const geminiPlan = task.analysis_plans?.find(
      (plan) =>
        plan.analysis_plan_id ===
        "pricing-discount-lifecycle-content-controlled-v1-gemini-3.1-pro-control-plan-v0"
    );

    expect(geminiPlan).toMatchObject({
      schema_version: "analysis-plan-v0",
      status: "sealed",
      task_id: "pricing-discount-lifecycle-content-controlled",
      task_version: "pricing-discount-lifecycle-content-controlled-v1",
      conditions: ["context_only_spec", "feedback_capable_spec"],
      protocol_profile_id: "path-survival-primary-v1",
      run_classifications: ["diagnostic_invalid", "difficulty_probe", "causal_pilot"],
      primary_metric: "regression_free_auc_delta",
      budget: {
        max_model_turns: 2,
        max_feedback_runs: 1
      },
      model_provider: {
        provider: "openrouter",
        model: "google/gemini-3.1-pro-preview",
        adapter_id: "openrouter-loop"
      },
      provider_execution_profile_id: gemini31ProProviderExecutionProfileId
    });
    expect(geminiPlan?.secondary_metrics).toContain("context_arm_progression_beyond_seed");
    expect(geminiPlan?.exclusion_rules).toContain(
      "do not pool Gemini 3.1 Pro runs with the Mistral pricing-discount-content-controlled-demo-v1 runs"
    );
    expect(geminiPlan?.promotion_gates).toContain(
      "gemini_3.1_pro_openrouter_slug_and_structured_output_support_confirmed_read_only"
    );
    expect(geminiPlan?.pooling_rules.compatibility_fields).toContain("provider_execution_profile_hash");
    expect(geminiPlan?.frozen_inputs).toContain("provider_execution_profile_id");
  });

  test("both conditions receive an identical event API in the prompt", async () => {
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

  test("both conditions receive identical visible spec text with the worked examples", async () => {
    const task = await loadTask();
    const ctx = renderSpecPacket({ task, condition_id: "context_only_spec", checkpoint_id: "I09" });
    const fb = renderSpecPacket({ task, condition_id: "feedback_capable_spec", checkpoint_id: "I09" });
    expect(ctx.visible_spec_text).toBe(fb.visible_spec_text);
    // Worked examples that also appear in the feedback assets must be visible to both arms.
    for (const value of ["14.40", "36.00", "22.50", "7.60", "13.00", "18.72", "0.72"]) {
      expect(ctx.visible_spec_text).toContain(value);
    }
  });

  test("every event type and example value used by feedback assets is present in the context-only prompt", async () => {
    const task = await loadTask();
    const ctx = renderSpecPacket({ task, condition_id: "context_only_spec", checkpoint_id: "I09" });
    const assetDir = join(taskDir, "feedback-assets");
    const assetFiles = (await readdir(assetDir)).filter((name) => name.endsWith(".source.ts"));
    const assetText = (
      await Promise.all(assetFiles.map((name) => readFile(join(assetDir, name), "utf8")))
    ).join("\n");

    // Every event type a feedback asset constructs must be disclosed to the context arm.
    for (const eventType of eventTypes) {
      if (assetText.includes(`type: "${eventType}"`)) {
        expect(ctx.prompt_text).toContain(eventType);
      }
    }
    // couponKind enum values used by assets must be disclosed too.
    if (assetText.includes("couponKind")) {
      expect(ctx.prompt_text).toContain("couponKind");
      expect(ctx.prompt_text).toContain("percent");
      expect(ctx.prompt_text).toContain("fixed");
    }
  });

  test("the hidden oracle uses only event types disclosed in the shared interface", async () => {
    const task = await loadTask();
    const ctx = renderSpecPacket({ task, condition_id: "context_only_spec", checkpoint_id: "I09" });
    const cases = JSON.parse(await readFile(join(taskDir, "hidden-oracle", "oracle-cases.json"), "utf8"));
    const usedTypes = new Set<string>();
    for (const testCase of cases.cases) {
      for (const event of testCase.events) {
        if (event && typeof event.type === "string") {
          usedTypes.add(event.type);
        }
      }
    }
    expect(usedTypes.size).toBeGreaterThan(0);
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
      if (checkpoint_id !== "I01" || fb.executable_feedback_paths.length > 0) {
        expect(fb.feedback_command).toBe("bun run spec");
        expect(fb.executable_feedback_paths.length).toBeGreaterThan(0);
      }
    }
  });

  test("the task still has discrimination signal: a naive agent produces true regressions", async () => {
    const task = await loadTask();
    const root = await mkTempRoot();
    const run = await runPilot({
      task,
      run_id: "pricing-content-controlled-naive-001",
      runs_root: join(root, "runs"),
      agent: createPricingNaiveAgent(),
      hidden_oracle: createPricingDiscountOracle(),
      run_classification: "calibration",
      model_provider: { provider: "fake", model: "naive", adapter_id: "pricing-naive-agent" }
    });
    const result = JSON.parse(await readFile(join(dirname(run.run_manifest_path), "result.json"), "utf8"));
    for (const conditionId of ["context_only_spec", "feedback_capable_spec"] as const) {
      expect(result.condition_summaries[conditionId].regression_count).toBeGreaterThan(0);
      expect(result.regression_free_auc.by_condition[conditionId]).toBeLessThan(1);
    }
  }, 20000);

  test("the reference implementation passes every checkpoint with no regressions", async () => {
    const task = await loadTask();
    const root = await mkTempRoot();
    const run = await runPilot({
      task,
      run_id: "pricing-content-controlled-reference-001",
      runs_root: join(root, "runs"),
      agent: createPricingReferenceAgent(),
      hidden_oracle: createPricingDiscountOracle(),
      run_classification: "calibration",
      model_provider: { provider: "fake", model: "reference", adapter_id: "pricing-reference-agent" }
    });
    const result = JSON.parse(await readFile(join(dirname(run.run_manifest_path), "result.json"), "utf8"));
    for (const conditionId of ["context_only_spec", "feedback_capable_spec"] as const) {
      expect(result.condition_summaries[conditionId].regression_count).toBe(0);
      expect(result.condition_summaries[conditionId].final_checkpoint_passed).toBe(9);
      expect(result.regression_free_auc.by_condition[conditionId]).toBe(1);
    }
  }, 20000);
});

async function mkTempRoot() {
  const root = join(tmpdir(), `hit-sdd-bench-pricing-cc-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}
