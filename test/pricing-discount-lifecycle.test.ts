import { afterEach, describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  buildTaskSealManifest,
  loadReplayPlan,
  validateReplayPlan,
  validateRunCompatibilityForPooling,
  validateRunManifest,
  verifyRunArtifacts
} from "../src/provenance";
import { renderSpecPacket, writeFeedbackAssets } from "../src/renderer";
import { runPilot } from "../src/runner";
import { hashFile } from "../src/snapshot";
import { loadTaskPackage } from "../src/task-package";
import { createPricingDiscountOracle } from "../src/pricing-discount-oracle";
import { createFakeAgent } from "./support/fake-agent";
import { createPricingNaiveAgent, createPricingReferenceAgent } from "./support/pricing-discount-agents";

const repoRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/test$/, "");
const tempRoots: string[] = [];
const checkpointIds = ["I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "I09"];
const mistralProviderExecutionProfileId =
  "openrouter-loop-v1-modelmistralai-mistral-small-2603-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1";
const qwenStrongControlProviderExecutionProfileId =
  "openrouter-loop-v1-modelqwen-qwen3.7-max-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1";
const deepseekProControlProviderExecutionProfileId =
  "openrouter-loop-v1-modeldeepseek-deepseek-v4-pro-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1";
const gemini25FlashNoSchemaControlProviderExecutionProfileId =
  "openrouter-loop-v1-modelgoogle-gemini-2.5-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1";
const execFileAsync = promisify(execFile);

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("pricing-discount-lifecycle task", () => {
  test("loads the sealed v0 semantic spec with the planned checkpoint sequence", async () => {
    const task = await loadPricingTask();

    expect(task.task_id).toBe("pricing-discount-lifecycle");
    expect(task.task_version).toBe("pricing-discount-lifecycle-v0");
    expect(task.checkpoints).toEqual(checkpointIds);
    expect(task.public_api_contract).toContain("applyEvent(state, event): State");
    expect(task.public_api_contract).toContain("getQuote(state): Quote");
    expect(task.public_api_contract).toContain("getLineTotal(state, sku): number");
    expect(task.public_api_contract).toContain("canApplyCoupon(state, code): boolean");
    expect(task.executable_feedback_assets.map((asset) => asset.asset_id)).toEqual([
      "base-subtotal-visible-check",
      "line-sale-visible-check",
      "order-coupon-visible-check",
      "bulk-tier-visible-check",
      "coupon-idempotency-visible-check",
      "fixed-coupon-visible-check",
      "discount-cap-visible-check",
      "tax-visible-check",
      "rounding-visible-check"
    ]);
  });

  test("loads visible-hidden coverage and keeps hidden oracle references out of rendered prompts", async () => {
    const task = await loadPricingTask();
    const specCommitmentIds = task.canonical_spec.records.map((record) => record.commitment_id);
    const coverageCommitmentIds = task.coverage_manifest?.entries.map((entry) => entry.commitment_id);

    expect(task.coverage_manifest?.schema_version).toBe("visible-hidden-coverage-v0");
    expect(coverageCommitmentIds).toEqual(specCommitmentIds);

    for (const entry of task.coverage_manifest?.entries ?? []) {
      expect(entry.visible_feedback.status).toBe("implemented");
      expect(entry.visible_feedback.asset_id).toMatch(/-visible-check$/);
      expect(entry.hidden_oracle.status).toBe("implemented");
      expect(entry.hidden_oracle.check_ids.length).toBeGreaterThan(0);
      expect(entry.hidden_oracle.refs.every((ref) => ref.startsWith("hidden-oracle/"))).toBe(true);
    }

    const i09Packet = renderSpecPacket({
      task,
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I09"
    });

    expect(i09Packet.prompt_text).not.toContain("hidden-oracle/");
    expect(i09Packet.prompt_text).not.toContain("private");
  });

  test("loads local acceptance criteria and a sealed path-survival analysis plan", async () => {
    const task = await loadPricingTask();
    const coverageCommitments = task.coverage_manifest?.entries.map((entry) => entry.commitment_id) ?? [];
    const fakeScenarioIds =
      task.fake_agent_validation_plan?.scenarios.map((scenario) => scenario.scenario_id) ?? [];
    const visibleCriteria = new Set(
      task.local_acceptance_criteria?.criteria
        .filter((criterion) => criterion.target === "visible_feedback_asset")
        .map((criterion) => criterion.commitment_id)
    );
    const hiddenCriteria = new Set(
      task.local_acceptance_criteria?.criteria
        .filter((criterion) => criterion.target === "hidden_oracle")
        .map((criterion) => criterion.commitment_id)
    );
    const fakeCriteria = new Set(
      task.local_acceptance_criteria?.criteria
        .filter((criterion) => criterion.target === "fake_agent_validation")
        .map((criterion) => criterion.scenario_id)
    );

    expect(new Set(task.fake_agent_validation_plan?.scenarios.map((scenario) => scenario.checkpoint_id))).toEqual(
      new Set(checkpointIds)
    );
    expect([...visibleCriteria]).toEqual(coverageCommitments);
    expect([...hiddenCriteria]).toEqual(coverageCommitments);
    expect([...fakeCriteria]).toEqual(fakeScenarioIds);

    expect(task.analysis_plan).toMatchObject({
      schema_version: "analysis-plan-v0",
      status: "sealed",
      task_id: "pricing-discount-lifecycle",
      task_version: "pricing-discount-lifecycle-v0",
      conditions: ["context_only_spec", "feedback_capable_spec"],
      protocol_profile_id: "path-survival-primary-v1",
      provider_execution_profile_id: mistralProviderExecutionProfileId,
      primary_metric: "regression_free_auc_delta"
    });
    expect(task.analysis_plan?.secondary_metrics).toContain("regression_count_delta");
    expect(task.analysis_plan?.pooling_rules.compatibility_fields).toContain("protocol_profile_id");
    expect(task.analysis_plan?.pooling_rules.compatibility_fields).toContain("provider_execution_profile_hash");
    expect(task.analysis_plan?.frozen_inputs).toContain("provider_execution_profile_id");

    const qwenPlan = task.analysis_plans?.find(
      (plan) => plan.analysis_plan_id === "pricing-discount-lifecycle-v0-qwen-strong-control-plan-v0"
    );

    expect(qwenPlan).toMatchObject({
      schema_version: "analysis-plan-v0",
      status: "sealed",
      task_id: "pricing-discount-lifecycle",
      task_version: "pricing-discount-lifecycle-v0",
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
        model: "qwen/qwen3.7-max",
        adapter_id: "openrouter-loop"
      },
      provider_execution_profile_id: qwenStrongControlProviderExecutionProfileId
    });
    expect(qwenPlan?.secondary_metrics).toContain("context_arm_progression_beyond_seed");
    expect(qwenPlan?.exclusion_rules).toContain(
      "do not pool Qwen runs with the Mistral pricing-discount-demo-v1 runs"
    );
    expect(qwenPlan?.promotion_gates).toContain("qwen_slug_and_structured_output_support_confirmed_read_only");
    expect(qwenPlan?.pooling_rules.compatibility_fields).toContain("provider_execution_profile_hash");
    expect(qwenPlan?.frozen_inputs).toContain("provider_execution_profile_id");

    const deepseekProPlan = task.analysis_plans?.find(
      (plan) => plan.analysis_plan_id === "pricing-discount-lifecycle-v0-deepseek-pro-control-plan-v0"
    );

    expect(deepseekProPlan).toMatchObject({
      schema_version: "analysis-plan-v0",
      status: "sealed",
      task_id: "pricing-discount-lifecycle",
      task_version: "pricing-discount-lifecycle-v0",
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
        model: "deepseek/deepseek-v4-pro",
        adapter_id: "openrouter-loop"
      },
      provider_execution_profile_id: deepseekProControlProviderExecutionProfileId
    });
    expect(deepseekProPlan?.secondary_metrics).toContain("context_arm_progression_beyond_seed");
    expect(deepseekProPlan?.exclusion_rules).toContain(
      "do not pool DeepSeek Pro runs with the Qwen pricing-discount-strong-control-v1 runs"
    );
    expect(deepseekProPlan?.promotion_gates).toContain(
      "deepseek_pro_slug_and_structured_output_support_confirmed_read_only"
    );
    expect(deepseekProPlan?.pooling_rules.compatibility_fields).toContain("provider_execution_profile_hash");
    expect(deepseekProPlan?.frozen_inputs).toContain("provider_execution_profile_id");

    const gemini25FlashNoSchemaPlan = task.analysis_plans?.find(
      (plan) => plan.analysis_plan_id === "pricing-discount-lifecycle-v0-gemini-2.5-flash-no-schema-control-plan-v0"
    );

    expect(gemini25FlashNoSchemaPlan).toMatchObject({
      schema_version: "analysis-plan-v0",
      status: "sealed",
      task_id: "pricing-discount-lifecycle",
      task_version: "pricing-discount-lifecycle-v0",
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
        model: "google/gemini-2.5-flash",
        adapter_id: "openrouter-loop"
      },
      provider_execution_profile_id: gemini25FlashNoSchemaControlProviderExecutionProfileId
    });
    expect(gemini25FlashNoSchemaPlan?.secondary_metrics).toContain("context_arm_progression_beyond_seed");
    expect(gemini25FlashNoSchemaPlan?.exclusion_rules).toContain(
      "do not pool Gemini 2.5 Flash no-schema runs with the Gemini 2.5 Flash json-schema smoke"
    );
    expect(gemini25FlashNoSchemaPlan?.promotion_gates).toContain("clean_provider_smoke_completed");
    expect(gemini25FlashNoSchemaPlan?.pooling_rules.compatibility_fields).toContain(
      "provider_execution_profile_hash"
    );
    expect(gemini25FlashNoSchemaPlan?.frozen_inputs).toContain("provider_execution_profile_id");
  });

  test("renders cumulative visible specs equally while gating feedback assets to the feedback arm", async () => {
    const task = await loadPricingTask();
    const contextI09 = renderSpecPacket({ task, condition_id: "context_only_spec", checkpoint_id: "I09" });
    const feedbackI09 = renderSpecPacket({ task, condition_id: "feedback_capable_spec", checkpoint_id: "I09" });
    const contextI01 = renderSpecPacket({ task, condition_id: "context_only_spec", checkpoint_id: "I01" });

    expect(contextI09.visible_spec_text).toBe(feedbackI09.visible_spec_text);
    expect(contextI09.executable_feedback_paths).toEqual([]);
    expect(feedbackI09.feedback_command).toBe("bun run spec");
    expect(feedbackI09.executable_feedback_paths).toEqual([
      "spec/base-subtotal.spec.ts",
      "spec/line-sale.spec.ts",
      "spec/order-coupon.spec.ts",
      "spec/bulk-tier.spec.ts",
      "spec/coupon-idempotency.spec.ts",
      "spec/fixed-coupon.spec.ts",
      "spec/discount-cap.spec.ts",
      "spec/tax.spec.ts",
      "spec/rounding.spec.ts"
    ]);
    expect(contextI01.visible_spec_text).toContain("SPEC-001");
    expect(contextI01.visible_spec_text).not.toContain("SPEC-002");

    for (let index = 1; index <= 9; index += 1) {
      expect(contextI09.visible_spec_text).toContain(`SPEC-00${index}`);
    }
  });

  test("runs rendered visible feedback assets against the reference implementation", async () => {
    const task = await loadPricingTask();
    const root = await mkTempRoot();
    const workspacePath = join(root, "workspace");
    const packet = renderSpecPacket({ task, condition_id: "feedback_capable_spec", checkpoint_id: "I09" });

    await cp(task.template_workspace, workspacePath, { recursive: true });
    // The template only implements I01-I02; deploy the full reference so the visible
    // feedback assets (which cover all nine checkpoints) can be exercised.
    await cp(
      join(repoRoot, "tasks", "pricing-discount-lifecycle", "hidden-oracle", "reference", "pricing.ts"),
      join(workspacePath, "src", "pricing.ts")
    );
    await writeFeedbackAssets({ workspace_path: workspacePath, packet });

    const { stdout, stderr } = await execFileAsync("bun", ["run", "spec"], {
      cwd: workspacePath,
      timeout: 15000,
      maxBuffer: 1024 * 1024
    });

    expect(`${stdout}\n${stderr}`).toContain("12 pass");
  });

  test("builds a task seal over the spec, feedback assets, and reference oracle", async () => {
    const task = await loadPricingTask();
    const seal = await buildTaskSealManifest(task);

    expect(seal.schema_version).toBe("task-seal-v0");
    expect(seal.task_id).toBe("pricing-discount-lifecycle");
    expect(seal.checkpoints).toEqual(task.checkpoints);
    expect(Object.keys(seal.visible_spec_hashes)).toEqual(task.checkpoints);
    expect(Object.keys(seal.feedback_asset_hashes).toSorted()).toEqual([
      "spec/base-subtotal.spec.ts",
      "spec/bulk-tier.spec.ts",
      "spec/coupon-idempotency.spec.ts",
      "spec/discount-cap.spec.ts",
      "spec/fixed-coupon.spec.ts",
      "spec/line-sale.spec.ts",
      "spec/order-coupon.spec.ts",
      "spec/rounding.spec.ts",
      "spec/tax.spec.ts"
    ]);
    expect(seal.template_workspace_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(seal.hidden_oracle_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test(
    "passes local fake pilot replay, provenance, and compatibility validation",
    async () => {
      const task = await loadPricingTask();
      const root = await mkTempRoot();
      const runsRoot = join(root, "runs");
      const modelProvider = { provider: "fake", model: "normal", adapter_id: "fake-agent" };
      const firstRun = await runPilot({
        task,
        run_id: "pricing-local-fake-001",
        runs_root: runsRoot,
        agent: createFakeAgent(),
        hidden_oracle: createPricingDiscountOracle(),
        run_classification: "calibration",
        model_provider: modelProvider
      });
      const secondRun = await runPilot({
        task,
        run_id: "pricing-local-fake-002",
        runs_root: runsRoot,
        agent: createFakeAgent(),
        hidden_oracle: createPricingDiscountOracle(),
        run_classification: "calibration",
        model_provider: modelProvider
      });
      const firstManifest = JSON.parse(await readFile(firstRun.run_manifest_path, "utf8"));
      const secondManifest = JSON.parse(await readFile(secondRun.run_manifest_path, "utf8"));
      const replayPlan = await loadReplayPlan(firstRun.run_manifest_path);

      expect(validateRunManifest(firstManifest)).toEqual({ ok: true, errors: [] });
      expect(await validateReplayPlan(firstRun.run_manifest_path)).toEqual({ ok: true, errors: [] });
      expect(await verifyRunArtifacts(firstRun.run_manifest_path)).toMatchObject({ ok: true });
      expect(validateRunCompatibilityForPooling([firstManifest, secondManifest])).toEqual({
        ok: true,
        errors: []
      });
      expect(firstManifest.task_seal_hash).toBe(await hashFile(firstManifest.task_seal_path));
      expect(replayPlan.steps).toHaveLength(18);
    },
    20000
  );

  test(
    "naive agent produces true regressions, demonstrating discrimination power",
    async () => {
      const task = await loadPricingTask();
      const root = await mkTempRoot();
      const run = await runPilot({
        task,
        run_id: "pricing-naive-001",
        runs_root: join(root, "runs"),
        agent: createPricingNaiveAgent(),
        hidden_oracle: createPricingDiscountOracle(),
        run_classification: "calibration",
        model_provider: { provider: "fake", model: "naive", adapter_id: "pricing-naive-agent" }
      });
      const result = JSON.parse(await readFile(join(dirname(run.run_manifest_path), "result.json"), "utf8"));

      // The intended true regressions, and ONLY these: the fixed-coupon commitment
      // (broken by the hardcoded cap at I07) and the line-sale commitment (broken by
      // per-stage rounding at I09). Asserting the exact set keeps this usable as a
      // promotion gate: unintended extra regressions would fail it.
      const expectedRegressions = [
        "fixed-coupon-applies-after-percent-coupons",
        "line-sale-reduces-line-total"
      ];

      for (const conditionId of ["context_only_spec", "feedback_capable_spec"] as const) {
        expect(result.condition_summaries[conditionId].regression_count).toBe(2);
        expect(result.regression_free_auc.by_condition[conditionId]).toBeCloseTo(6 / 9, 10);
        expect(trueRegressions(result, conditionId)).toEqual(expectedRegressions);
      }
    },
    20000
  );

  test(
    "reference agent passes every checkpoint with no regressions",
    async () => {
      const task = await loadPricingTask();
      const root = await mkTempRoot();
      const run = await runPilot({
        task,
        run_id: "pricing-reference-001",
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
    },
    20000
  );
});

// Returns the commitments that passed at an earlier checkpoint and then failed at a
// later one (a true regression), sorted for stable comparison. This mirrors the
// harness regression_count definition but lets the test assert the exact set.
function trueRegressions(result: any, conditionId: string): string[] {
  const byCheckpoint = new Map<string, any>();

  for (const evaluation of result.evaluations as Array<any>) {
    if (evaluation.condition_id === conditionId) {
      byCheckpoint.set(evaluation.checkpoint_id, evaluation);
    }
  }

  const passedEver = new Set<string>();
  const regressed = new Set<string>();

  for (const checkpointId of result.checkpoints as string[]) {
    const evaluation = byCheckpoint.get(checkpointId);
    if (!evaluation) {
      continue;
    }

    for (const check of evaluation.checks) {
      if (check.passed) {
        passedEver.add(check.commitment_id);
      } else if (passedEver.has(check.commitment_id)) {
        regressed.add(check.commitment_id);
      }
    }
  }

  return [...regressed].toSorted();
}

async function loadPricingTask() {
  return loadTaskPackage(join(repoRoot, "tasks", "pricing-discount-lifecycle"));
}

async function mkTempRoot() {
  const root = join(
    tmpdir(),
    `hit-sdd-bench-pricing-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  tempRoots.push(root);
  await mkdir(root, { recursive: true });

  return root;
}
