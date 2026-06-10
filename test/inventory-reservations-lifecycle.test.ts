import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
import { createInventoryReservationsOracle } from "../src/inventory-reservations-oracle";
import { execFileWithSpawnRetry } from "./support/exec-file";
import { createFakeAgent } from "./support/fake-agent";

const repoRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/test$/, "");
const tempRoots: string[] = [];
const checkpointIds = ["I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "I09"];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("inventory-reservations-lifecycle task draft", () => {
  test("loads the sealed v0 semantic spec with the planned checkpoint sequence", async () => {
    const task = await loadInventoryTask();

    expect(task.task_id).toBe("inventory-reservations-lifecycle");
    expect(task.task_version).toBe("inventory-reservations-lifecycle-v0");
    expect(task.checkpoints).toEqual(checkpointIds);
    expect(task.public_api_contract).toContain("applyEvent(state, event): State");
    expect(task.public_api_contract).toContain("canReserve(state, sku, quantity, now): boolean");
    expect(task.public_api_contract).toContain("getAvailability(state, sku, now): Availability");
    expect(task.public_api_contract).toContain(
      "getReservationStatus(state, reservationId, now): ReservationStatus"
    );
    expect(task.executable_feedback_assets.map((asset) => asset.asset_id)).toEqual([
      "stock-received-visible-check",
      "reservation-hold-visible-check",
      "order-confirmation-visible-check",
      "reservation-expiration-visible-check",
      "cancellation-release-visible-check",
      "duplicate-events-visible-check",
      "shipment-consumption-visible-check",
      "backorder-fifo-visible-check",
      "returns-disposition-visible-check"
    ]);
  });

  test("loads visible-hidden coverage and keeps hidden oracle references out of rendered prompts", async () => {
    const task = await loadInventoryTask();
    const specCommitmentIds = task.canonical_spec.records.map((record) => record.commitment_id);
    const coverageCommitmentIds = task.coverage_manifest?.entries.map((entry) => entry.commitment_id);

    expect(task.coverage_manifest?.schema_version).toBe("visible-hidden-coverage-v0");
    expect(task.coverage_manifest?.task_id).toBe("inventory-reservations-lifecycle");
    expect(task.coverage_manifest?.task_version).toBe("inventory-reservations-lifecycle-v0");
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

  test("loads local acceptance criteria and a sealed analysis plan before provider runs", async () => {
    const task = await loadInventoryTask();
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

    expect(task.fake_agent_validation_plan?.schema_version).toBe("fake-agent-validation-plan-v0");
    expect(task.fake_agent_validation_plan?.task_id).toBe("inventory-reservations-lifecycle");
    expect(task.fake_agent_validation_plan?.task_version).toBe("inventory-reservations-lifecycle-v0");
    expect(new Set(task.fake_agent_validation_plan?.scenarios.map((scenario) => scenario.checkpoint_id))).toEqual(
      new Set(checkpointIds)
    );

    expect(task.local_acceptance_criteria?.schema_version).toBe("local-acceptance-criteria-v0");
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
      task_id: "inventory-reservations-lifecycle",
      task_version: "inventory-reservations-lifecycle-v0",
      conditions: ["context_only_spec", "feedback_capable_spec"],
      run_classifications: ["difficulty_probe", "causal_pilot"],
      primary_metric: "final_checkpoint_pass_rate_delta",
      budget: {
        max_model_turns: 2,
        max_feedback_runs: 1
      },
      model_provider: {
        provider: "openrouter",
        model: "mistralai/mistral-small-2603",
        adapter_id: "openrouter-loop"
      }
    });
    expect(task.analysis_plan?.secondary_metrics).toContain("regression_free_success_by_checkpoint");
    expect(task.analysis_plan?.secondary_metrics).toContain("regression_free_auc");
    expect(task.analysis_plan?.planned_metrics).toEqual([]);
    expect(task.analysis_plan?.promotion_gates).toContain("local_acceptance_criteria_all_pass");
    expect(task.analysis_plan?.promotion_gates).toContain("analysis_plan_sealed_before_provider_run");
  });

  test("renders cumulative visible specs equally while gating feedback assets to the feedback arm", async () => {
    const task = await loadInventoryTask();
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
      "spec/stock-received.spec.ts",
      "spec/reservation-hold.spec.ts",
      "spec/order-confirmation.spec.ts",
      "spec/reservation-expiration.spec.ts",
      "spec/cancellation-release.spec.ts",
      "spec/duplicate-events.spec.ts",
      "spec/shipment-consumption.spec.ts",
      "spec/backorder-fifo.spec.ts",
      "spec/returns-disposition.spec.ts"
    ]);
    expect(contextI01.visible_spec_text).toContain("SPEC-001");
    expect(contextI01.visible_spec_text).not.toContain("SPEC-002");

    for (let index = 1; index <= 9; index += 1) {
      expect(contextI09.visible_spec_text).toContain(`SPEC-00${index}`);
    }
  });

  test("runs rendered visible feedback assets against the reference workspace", async () => {
    const task = await loadInventoryTask();
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

    const { stdout, stderr } = await execFileWithSpawnRetry("bun", ["run", "spec"], {
      cwd: workspacePath,
      timeout: 10000,
      maxBuffer: 1024 * 1024
    });

    expect(`${stdout}\n${stderr}`).toContain("9 pass");
  });

  test("builds a task seal over the drafted spec and checkpoint plan", async () => {
    const task = await loadInventoryTask();
    const seal = await buildTaskSealManifest(task);

    expect(seal.schema_version).toBe("task-seal-v0");
    expect(seal.task_id).toBe("inventory-reservations-lifecycle");
    expect(seal.task_version).toBe("inventory-reservations-lifecycle-v0");
    expect(seal.checkpoints).toEqual(task.checkpoints);
    expect(Object.keys(seal.visible_spec_hashes)).toEqual(task.checkpoints);
    expect(Object.keys(seal.feedback_asset_hashes).toSorted()).toEqual([
      "spec/backorder-fifo.spec.ts",
      "spec/cancellation-release.spec.ts",
      "spec/duplicate-events.spec.ts",
      "spec/order-confirmation.spec.ts",
      "spec/reservation-expiration.spec.ts",
      "spec/reservation-hold.spec.ts",
      "spec/returns-disposition.spec.ts",
      "spec/shipment-consumption.spec.ts",
      "spec/stock-received.spec.ts"
    ]);
    expect(seal.template_workspace_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(seal.hidden_oracle_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test(
    "passes local fake pilot replay, hidden oracle, provenance, and compatibility validation",
    async () => {
      const task = await loadInventoryTask();
      const root = await mkTempRoot();
      const runsRoot = join(root, "runs");
      const modelProvider = {
        provider: "fake",
        model: "normal",
        adapter_id: "fake-agent"
      };
      const firstRun = await runPilot({
        task,
        run_id: "inventory-local-fake-001",
        runs_root: runsRoot,
        agent: createFakeAgent(),
        hidden_oracle: createInventoryReservationsOracle(),
        run_classification: "calibration",
        model_provider: modelProvider
      });
      const secondRun = await runPilot({
        task,
        run_id: "inventory-local-fake-002",
        runs_root: runsRoot,
        agent: createFakeAgent(),
        hidden_oracle: createInventoryReservationsOracle(),
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
      expect(firstManifest.result_record_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(firstManifest.result_summary_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(firstManifest.clean_primary_evidence_eligible).toBe(false);
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

          expect(checkpoint.hidden_oracle_result_hash).toMatch(/^[a-f0-9]{64}$/);
        }
      }
    },
    15000
  );
});

async function loadInventoryTask() {
  return loadTaskPackage(join(repoRoot, "tasks", "inventory-reservations-lifecycle"));
}

async function mkTempRoot() {
  const root = join(
    tmpdir(),
    `hit-sdd-bench-inventory-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  tempRoots.push(root);
  await mkdir(root, { recursive: true });

  return root;
}
