import { afterEach, describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
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
import { createFakeAgent } from "./support/fake-agent";

const repoRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/test$/, "");
const tempRoots: string[] = [];
const execFileAsync = promisify(execFile);

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("subscription-entitlements-lifecycle task draft", () => {
  test("loads the sealed v0 semantic spec with the planned checkpoint sequence", async () => {
    const task = await loadTaskPackage(join(repoRoot, "tasks", "subscription-entitlements-lifecycle"));

    expect(task.task_id).toBe("subscription-entitlements-lifecycle");
    expect(task.task_version).toBe("subscription-entitlements-lifecycle-v0");
    expect(task.checkpoints).toEqual([
      "I01",
      "I02",
      "I03",
      "I04",
      "I05",
      "I06",
      "I07",
      "I08",
      "I09"
    ]);
    expect(task.public_api_contract).toContain("applyEvent(state, event): State");
    expect(task.public_api_contract).toContain("canAccessFeature(state, feature, now): boolean");
    expect(task.public_api_contract).toContain("getBillingStatus(state, now): BillingStatus");
    expect(task.public_api_contract).toContain("getInvoiceSummary(state): InvoiceSummary");
    expect(task.executable_feedback_assets.map((asset) => asset.asset_id)).toEqual([
      "trial-access-visible-check",
      "payment-activation-visible-check",
      "cancel-at-period-end-visible-check",
      "payment-failure-grace-visible-check",
      "retry-success-visible-check",
      "duplicate-events-visible-check",
      "fraud-suspension-visible-check",
      "downgrade-next-period-visible-check",
      "refund-chargeback-visible-check"
    ]);
  });

  test("loads the visible-hidden coverage manifest for every semantic commitment", async () => {
    const task = await loadTaskPackage(join(repoRoot, "tasks", "subscription-entitlements-lifecycle"));
    const specCommitmentIds = task.canonical_spec.records.map((record) => record.commitment_id);
    const coverageCommitmentIds = task.coverage_manifest?.entries.map((entry) => entry.commitment_id);

    expect(task.coverage_manifest?.schema_version).toBe("visible-hidden-coverage-v0");
    expect(task.coverage_manifest?.task_id).toBe("subscription-entitlements-lifecycle");
    expect(task.coverage_manifest?.task_version).toBe("subscription-entitlements-lifecycle-v0");
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

  test("loads a fake-agent validation plan covering every checkpoint before runnable validation exists", async () => {
    const task = await loadTaskPackage(join(repoRoot, "tasks", "subscription-entitlements-lifecycle"));
    const plannedCheckpoints = new Set(
      task.fake_agent_validation_plan?.scenarios.map((scenario) => scenario.checkpoint_id)
    );

    expect(task.fake_agent_validation_plan?.schema_version).toBe("fake-agent-validation-plan-v0");
    expect(task.fake_agent_validation_plan?.task_id).toBe("subscription-entitlements-lifecycle");
    expect(task.fake_agent_validation_plan?.task_version).toBe("subscription-entitlements-lifecycle-v0");

    for (const checkpoint of task.checkpoints) {
      expect(plannedCheckpoints.has(checkpoint)).toBe(true);
    }

    expect(task.fake_agent_validation_plan?.scenarios).toContainEqual({
      scenario_id: "happy-path-through-downgrade-and-reversal",
      checkpoint_id: "I09",
      purpose: "Exercise all cumulative lifecycle commitments through refund or chargeback without provider calls.",
      expected_agent_mode: "scripted-reference"
    });
  });

  test("loads local acceptance criteria and a sealed analysis plan for probe preparation", async () => {
    const task = await loadTaskPackage(join(repoRoot, "tasks", "subscription-entitlements-lifecycle"));
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

    expect(task.local_acceptance_criteria?.schema_version).toBe("local-acceptance-criteria-v0");
    expect(task.local_acceptance_criteria?.task_id).toBe("subscription-entitlements-lifecycle");
    expect(task.local_acceptance_criteria?.task_version).toBe("subscription-entitlements-lifecycle-v0");
    expect([...visibleCriteria]).toEqual(coverageCommitments);
    expect([...hiddenCriteria]).toEqual(coverageCommitments);
    expect([...fakeCriteria]).toEqual(fakeScenarioIds);
    expect(
      task.local_acceptance_criteria?.criteria.every((criterion) =>
        criterion.evidence.some((item) => item.startsWith("local:"))
      )
    ).toBe(true);

    expect(task.analysis_plan).toMatchObject({
      schema_version: "analysis-plan-v0",
      status: "sealed",
      task_id: "subscription-entitlements-lifecycle",
      task_version: "subscription-entitlements-lifecycle-v0",
      conditions: ["context_only_spec", "feedback_capable_spec"],
      run_classifications: ["difficulty_probe", "causal_pilot"],
      primary_metric: "final_checkpoint_pass_rate_delta",
      budget: {
        max_model_turns: 2,
        max_feedback_runs: 1
      },
      model_provider: {
        provider: "openrouter",
        model: "deepseek/deepseek-v4-flash",
        adapter_id: "openrouter-loop"
      }
    });
    expect(task.analysis_plan?.secondary_metrics).toContain("regression_free_success_by_checkpoint");
    expect(task.analysis_plan?.secondary_metrics).toContain("regression_free_auc");
    expect(task.analysis_plan?.planned_metrics).toEqual([]);
    expect(task.analysis_plan?.promotion_gates).toContain("local_acceptance_criteria_all_pass");
    expect(task.analysis_plan?.promotion_gates).toContain("hidden_oracle_reference_candidate_passes");
    expect(task.analysis_plan?.promotion_gates).toContain("analysis_plan_sealed_before_provider_run");
    expect(task.analysis_plan?.pooling_rules.compatibility_fields).toEqual([
      "task_id",
      "task_version",
      "protocol_version",
      "renderer_version",
      "task_seal_hash",
      "checkpoint_list_hash",
      "visible_spec_hash",
      "feedback_asset_hash",
      "hidden_oracle_hash",
      "budget_hash",
      "model_provider_hash",
      "provider_execution_profile_hash",
      "metric_definition_hash"
    ]);

    const sonnetPlan = task.analysis_plans?.find(
      (plan) => plan.analysis_plan_id === "subscription-entitlements-lifecycle-v0-sonnet-causal-pilot-plan-v0"
    );
    expect(sonnetPlan).toMatchObject({
      schema_version: "analysis-plan-v0",
      status: "sealed",
      task_id: "subscription-entitlements-lifecycle",
      task_version: "subscription-entitlements-lifecycle-v0",
      conditions: ["context_only_spec", "feedback_capable_spec"],
      run_classifications: ["difficulty_probe", "causal_pilot"],
      budget: {
        max_model_turns: 2,
        max_feedback_runs: 1
      },
      model_provider: {
        provider: "openrouter",
        model: "anthropic/claude-sonnet-4.6",
        adapter_id: "openrouter-loop"
      },
      provider_execution_profile_id:
        "openrouter-loop-v1-modelanthropic-claude-sonnet-4.6-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1"
    });
    expect(sonnetPlan?.promotion_gates).toContain("clean_provider_difficulty_probe_completed");
    expect(sonnetPlan?.frozen_inputs).toContain("provider_execution_profile_id");

    const mistralPlan = task.analysis_plans?.find(
      (plan) => plan.analysis_plan_id === "subscription-entitlements-lifecycle-v0-mistral-small-causal-pilot-plan-v0"
    );
    expect(mistralPlan).toMatchObject({
      schema_version: "analysis-plan-v0",
      status: "sealed",
      task_id: "subscription-entitlements-lifecycle",
      task_version: "subscription-entitlements-lifecycle-v0",
      conditions: ["context_only_spec", "feedback_capable_spec"],
      run_classifications: ["difficulty_probe", "causal_pilot"],
      budget: {
        max_model_turns: 2,
        max_feedback_runs: 1
      },
      model_provider: {
        provider: "openrouter",
        model: "mistralai/mistral-small-2603",
        adapter_id: "openrouter-loop"
      },
      provider_execution_profile_id:
        "openrouter-loop-v1-modelmistralai-mistral-small-2603-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1"
    });
    expect(mistralPlan?.frozen_inputs).toContain("provider_execution_profile_id");
  });

  test("renders cumulative visible specs equally while gating feedback assets to the feedback arm", async () => {
    const task = await loadTaskPackage(join(repoRoot, "tasks", "subscription-entitlements-lifecycle"));
    const contextI09 = renderSpecPacket({
      task,
      condition_id: "context_only_spec",
      checkpoint_id: "I09"
    });
    const feedbackI09 = renderSpecPacket({
      task,
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I09"
    });
    const contextI01 = renderSpecPacket({
      task,
      condition_id: "context_only_spec",
      checkpoint_id: "I01"
    });

    expect(contextI09.visible_spec_text).toBe(feedbackI09.visible_spec_text);
    expect(contextI09.executable_feedback_paths).toEqual([]);
    expect(feedbackI09.feedback_command).toBe("bun run spec");
    expect(feedbackI09.executable_feedback_paths).toEqual([
      "spec/trial-access.spec.ts",
      "spec/payment-activation.spec.ts",
      "spec/cancel-at-period-end.spec.ts",
      "spec/payment-failure-grace.spec.ts",
      "spec/retry-success.spec.ts",
      "spec/duplicate-events.spec.ts",
      "spec/fraud-suspension.spec.ts",
      "spec/downgrade-next-period.spec.ts",
      "spec/refund-chargeback.spec.ts"
    ]);
    expect(contextI01.visible_spec_text).toContain("SPEC-001");
    expect(contextI01.visible_spec_text).not.toContain("SPEC-002");

    for (let index = 1; index <= 9; index += 1) {
      expect(contextI09.visible_spec_text).toContain(`SPEC-00${index}`);
    }
  });

  test("runs rendered visible feedback assets against the reference workspace", async () => {
    const task = await loadTaskPackage(join(repoRoot, "tasks", "subscription-entitlements-lifecycle"));
    const root = await mkTempRoot();
    const workspacePath = join(root, "workspace");
    const packet = renderSpecPacket({
      task,
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I09"
    });

    await cp(task.template_workspace, workspacePath, { recursive: true });
    await writeFeedbackAssets({
      workspace_path: workspacePath,
      packet
    });

    const { stdout, stderr } = await execFileAsync("bun", ["run", "spec"], {
      cwd: workspacePath,
      timeout: 10000,
      maxBuffer: 1024 * 1024
    });

    expect(`${stdout}\n${stderr}`).toContain("9 pass");
  });

  test("builds a task seal over the drafted spec and checkpoint plan", async () => {
    const task = await loadTaskPackage(join(repoRoot, "tasks", "subscription-entitlements-lifecycle"));
    const seal = await buildTaskSealManifest(task);

    expect(seal.schema_version).toBe("task-seal-v0");
    expect(seal.task_id).toBe("subscription-entitlements-lifecycle");
    expect(seal.task_version).toBe("subscription-entitlements-lifecycle-v0");
    expect(seal.checkpoints).toEqual(task.checkpoints);
    expect(Object.keys(seal.visible_spec_hashes)).toEqual(task.checkpoints);
    expect(Object.keys(seal.feedback_asset_hashes).toSorted()).toEqual([
      "spec/cancel-at-period-end.spec.ts",
      "spec/downgrade-next-period.spec.ts",
      "spec/duplicate-events.spec.ts",
      "spec/fraud-suspension.spec.ts",
      "spec/payment-activation.spec.ts",
      "spec/payment-failure-grace.spec.ts",
      "spec/refund-chargeback.spec.ts",
      "spec/retry-success.spec.ts",
      "spec/trial-access.spec.ts"
    ]);
    expect(seal.template_workspace_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(seal.hidden_oracle_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test("passes no-provider fake pilot replay, provenance, and compatibility validation", async () => {
    const task = await loadTaskPackage(join(repoRoot, "tasks", "subscription-entitlements-lifecycle"));
    const root = await mkTempRoot();
    const runsRoot = join(root, "runs");
    const modelProvider = {
      provider: "fake",
      model: "normal",
      adapter_id: "fake-agent"
    };
    const firstRun = await runPilot({
      task,
      run_id: "subscription-local-fake-001",
      runs_root: runsRoot,
      agent: createFakeAgent(),
      run_classification: "calibration",
      model_provider: modelProvider
    });
    const secondRun = await runPilot({
      task,
      run_id: "subscription-local-fake-002",
      runs_root: runsRoot,
      agent: createFakeAgent(),
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

    expect(firstManifest.run_classification).toBe("calibration");
    expect(firstManifest.model_provider).toEqual(modelProvider);
    expect(firstManifest.result_record_path).toBeUndefined();
    expect(firstManifest.result_summary_path).toBeUndefined();
    expect(firstManifest.task_seal_hash).toBe(await hashFile(firstManifest.task_seal_path));
    expect(replayPlan.steps).toHaveLength(18);

    for (const conditionId of ["context_only_spec", "feedback_capable_spec"] as const) {
      const condition = firstManifest.condition_results[conditionId];

      expect(condition.checkpoints.map((checkpoint: any) => checkpoint.checkpoint_id)).toEqual(task.checkpoints);

      for (const checkpoint of condition.checkpoints) {
        const promptPacket = JSON.parse(
          await readFile(join(checkpoint.artifact_dir, "prompt-packet.json"), "utf8")
        );

        expect(promptPacket.prompt_text).not.toContain("hidden-oracle");
        if (conditionId === "context_only_spec") {
          expect(promptPacket.executable_feedback_paths).toEqual([]);
          expect(promptPacket.feedback_command).toBeUndefined();
        } else {
          expect(promptPacket.feedback_command).toBe("bun run spec");
          expect(promptPacket.executable_feedback_paths.length).toBeGreaterThan(0);
        }

        expect(checkpoint.hidden_oracle_result_hash).toBeUndefined();
      }
    }

    const incompatibleVersion = structuredClone(secondManifest);

    incompatibleVersion.run_id = "subscription-local-fake-incompatible-version";
    incompatibleVersion.compatibility.task_version = "subscription-entitlements-lifecycle-v1";

    expect(validateRunCompatibilityForPooling([firstManifest, incompatibleVersion])).toEqual({
      ok: false,
      errors: [
        "Incompatible run subscription-local-fake-incompatible-version: compatibility.task_version differs from subscription-local-fake-001"
      ]
    });
  });
});

async function mkTempRoot() {
  const root = join(
    tmpdir(),
    `hit-sdd-bench-subscription-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  tempRoots.push(root);
  await mkdir(root, { recursive: true });

  return root;
}
