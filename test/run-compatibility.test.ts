import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildTaskSealManifest,
  validateRunCompatibilityForPooling,
  validateRunManifest,
  verifyRunArtifacts
} from "../src/provenance";
import { runPilot } from "../src/runner";
import { hashFile } from "../src/snapshot";
import { createFakeAgent } from "./support/fake-agent";
import { createSampleTask } from "./support/sample-task";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("run classification and compatibility", () => {
  test("builds a task seal manifest from visible specs, feedback assets, oracle, and template hashes", async () => {
    const root = await setupTemplateWorkspace();
    const hiddenOracle = join(root, "hidden-oracle");
    await mkdir(hiddenOracle, { recursive: true });
    await writeFile(join(hiddenOracle, "private.txt"), "private oracle\n");
    const task = createSampleTask(join(root, "template"));
    task.hidden_oracle_path = hiddenOracle;
    task.task_version = "sample-long-horizon-task-v0";

    const seal = await buildTaskSealManifest(task);

    expect(seal.schema_version).toBe("task-seal-v0");
    expect(seal.task_version).toBe("sample-long-horizon-task-v0");
    expect(seal.checkpoints).toEqual(["I01", "I02"]);
    expect(seal.template_workspace_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(seal.hidden_oracle_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(seal.visible_spec_hashes.I01).toMatch(/^[a-f0-9]{64}$/);
    expect(seal.visible_spec_hashes.I02).toMatch(/^[a-f0-9]{64}$/);
    expect(seal.feedback_asset_hashes["spec/cart-total-visible.spec.ts"]).toMatch(/^[a-f0-9]{64}$/);
    expect(seal.feedback_asset_hashes["spec/discount-total.spec.ts"]).toMatch(/^[a-f0-9]{64}$/);
  });

  test("run manifests record classification, task seal, budget, model/provider, and compatibility metadata", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "compat-run-001",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      run_classification: "calibration",
      budget: {
        max_model_turns: 3,
        max_feedback_runs: 2
      },
      model_provider: {
        provider: "fake",
        model: "deterministic-fake",
        adapter_id: "fake-agent"
      }
    });
    const manifest = JSON.parse(await readFile(result.run_manifest_path, "utf8"));

    expect(validateRunManifest(manifest).ok).toBe(true);
    expect(manifest.run_classification).toBe("calibration");
    expect(manifest.validity_flags).toEqual([]);
    expect(manifest.validity_details).toEqual([]);
    expect(manifest.task_version).toBe("sample-long-horizon-task-v0");
    expect(manifest.task_seal_path).toBe(join(root, "runs", "compat-run-001", "task-seal.json"));
    expect(manifest.task_seal_hash).toBe(await hashFile(manifest.task_seal_path));
    expect(manifest.budget).toEqual({
      max_model_turns: 3,
      max_feedback_runs: 2
    });
    expect(manifest.model_provider).toEqual({
      provider: "fake",
      model: "deterministic-fake",
      adapter_id: "fake-agent"
    });
    expect(manifest.provider_execution_profile.provider_profile_id).toBe("fake-agent-v1");
    expect(manifest.clean_primary_evidence_eligible).toBe(false);
    expect(manifest.metric_version).toBe("result-schema-v1");
    expect(manifest.compatibility.task_seal_hash).toBe(manifest.task_seal_hash);
    expect(manifest.compatibility.budget_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.compatibility.model_provider_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.compatibility.provider_execution_profile_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test("run manifests derive clean primary evidence eligibility and provider execution profile boundaries", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));
    const providerExecutionProfile = {
      provider_profile_id: "openrouter-loop-v1-timeout120-retry1",
      per_call_timeout_ms: 120_000,
      retry_policy: {
        max_retries: 1,
        retryable_errors: ["timeout", "socket", "rate_limit_transient"]
      },
      max_output_tokens: 16_000,
      temperature: 0.2,
      prompt_renderer_version: "semantic-spec-renderer-v0",
      feedback_summary_version: "public-feedback-summary-v0"
    };

    const clean = await runPilot({
      task,
      run_id: "clean-causal-profile",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      run_classification: "causal_pilot",
      budget: {
        max_model_turns: 2,
        max_feedback_runs: 1
      },
      model_provider: {
        provider: "openrouter",
        model: "deepseek/deepseek-v4-flash",
        adapter_id: "openrouter-loop"
      },
      provider_execution_profile: providerExecutionProfile
    });
    const flagged = await runPilot({
      task,
      run_id: "flagged-causal-profile",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      run_classification: "causal_pilot",
      validity_flags: ["provider_timeout"],
      validity_details: [
        {
          flag: "provider_timeout",
          scope: "checkpoint",
          condition_id: "context_only_spec",
          checkpoint_id: "I01",
          provider: "openrouter",
          message: "OpenRouter request timed out after 120000ms",
          retryable: true,
          provider_failure_phase: "pre_model_action_timeout",
          model_turn_number: 1,
          feedback_had_run: false,
          model_response_received: false,
          code_changed: false,
          workspace_carried_forward_due_to_provider_failure: true,
          retry_count: 1,
          elapsed_ms: 120_000
        }
      ],
      budget: {
        max_model_turns: 2,
        max_feedback_runs: 1
      },
      model_provider: {
        provider: "openrouter",
        model: "deepseek/deepseek-v4-flash",
        adapter_id: "openrouter-loop"
      },
      provider_execution_profile: providerExecutionProfile
    });
    const cleanManifest = JSON.parse(await readFile(clean.run_manifest_path, "utf8"));
    const flaggedManifest = JSON.parse(await readFile(flagged.run_manifest_path, "utf8"));

    expect(validateRunManifest(cleanManifest).ok).toBe(true);
    expect(cleanManifest.provider_execution_profile).toEqual(providerExecutionProfile);
    expect(cleanManifest.clean_primary_evidence_eligible).toBe(true);
    expect(flaggedManifest.clean_primary_evidence_eligible).toBe(false);
    expect(flaggedManifest.validity_details[0].provider_failure_phase).toBe("pre_model_action_timeout");
    expect(flaggedManifest.validity_details[0].workspace_carried_forward_due_to_provider_failure).toBe(true);
  });

  test("default OpenRouter profile IDs version timeout, output, temperature, and retry settings", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "default-openrouter-profile-id",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      model_provider: {
        provider: "openrouter",
        model: "deepseek/deepseek-v4-flash",
        adapter_id: "openrouter-loop"
      }
    });
    const manifest = JSON.parse(await readFile(result.run_manifest_path, "utf8"));

    expect(manifest.provider_execution_profile.provider_profile_id).toBe(
      "openrouter-loop-v1-timeout60000-output16000-temp0.2-retry0"
    );
  });

  test("run manifests record provider and network validity details", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));
    const validityDetails = [
      {
        flag: "provider_timeout" as const,
        scope: "run" as const,
        provider: "openrouter",
        message: "provider timed out before returning a usable response",
        retryable: true,
        provider_failure_phase: "pre_model_action_timeout" as const,
        model_turn_number: 1,
        feedback_had_run: false,
        model_response_received: false,
        code_changed: false,
        workspace_carried_forward_due_to_provider_failure: true,
        retry_count: 0,
        elapsed_ms: 60_000
      }
    ];

    const result = await runPilot({
      task,
      run_id: "provider-validity-detail",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      validity_flags: ["provider_timeout"],
      validity_details: validityDetails,
      model_provider: {
        provider: "openrouter",
        model: "deepseek/deepseek-v4-flash",
        adapter_id: "openrouter-loop"
      }
    });
    const manifest = JSON.parse(await readFile(result.run_manifest_path, "utf8"));

    expect(validateRunManifest(manifest).ok).toBe(true);
    expect(manifest.validity_flags).toEqual(["provider_timeout"]);
    expect(manifest.validity_details).toEqual(validityDetails);
  });

  test("run manifest validation rejects unknown classifications and malformed compatibility metadata", () => {
    const validation = validateRunManifest({
      protocol_version: "two-arm-feedback-spec-v0",
      renderer_version: "semantic-spec-renderer-v0",
      run_id: "bad-classification",
      task_id: "sample-cart",
      task_version: "sample-cart-v0",
      run_classification: "ordinary_test",
      validity_flags: ["provider_timeout"],
      task_seal_path: "/tmp/run/task-seal.json",
      task_seal_hash: "not-a-hash",
      budget: {
        max_model_turns: 0,
        max_feedback_runs: -1
      },
      model_provider: {
        provider: ""
      },
      exclusion_rules: ["precommitted"],
      metric_version: "result-schema-v1",
      compatibility: {
        task_id: "sample-cart",
        task_version: "sample-cart-v0",
        protocol_version: "two-arm-feedback-spec-v0",
        renderer_version: "semantic-spec-renderer-v0",
        task_seal_hash: "a".repeat(64),
        checkpoint_list_hash: "b".repeat(64),
        visible_spec_hash: "c".repeat(64),
        feedback_asset_hash: "d".repeat(64),
        hidden_oracle_hash: "e".repeat(64),
        budget_hash: "f".repeat(64),
        model_provider_hash: "0".repeat(64),
        metric_definition_hash: "1".repeat(64)
      },
      conditions: ["context_only_spec", "feedback_capable_spec"],
      checkpoints: ["I01"],
      condition_results: {
        context_only_spec: {
          workspace_path: "/tmp/run/context_only_spec/workspace",
          checkpoints: []
        },
        feedback_capable_spec: {
          workspace_path: "/tmp/run/feedback_capable_spec/workspace",
          checkpoints: []
        }
      }
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain(
      "run_classification must be calibration, difficulty_probe, causal_pilot, or diagnostic_invalid"
    );
    expect(validation.errors).toContain("task_seal_hash must be a sha256 hex hash");
    expect(validation.errors).toContain("budget.max_model_turns must be a positive integer when provided");
    expect(validation.errors).toContain("budget.max_feedback_runs must be a non-negative integer when provided");
    expect(validation.errors).toContain("model_provider.provider must be a non-empty string when provided");
    expect(validation.errors).toContain("validity_details must include detail for provider_timeout");
    expect(validation.errors).toContain("provider_execution_profile must be an object");
    expect(validation.errors).toContain("clean_primary_evidence_eligible must be a boolean");
  });

  test("run manifest validation rejects validity details not declared by flags", () => {
    const validation = validateRunManifest({
      protocol_version: "two-arm-feedback-spec-v0",
      renderer_version: "semantic-spec-renderer-v0",
      run_id: "undeclared-validity-detail",
      task_id: "sample-cart",
      task_version: "sample-cart-v0",
      run_classification: "diagnostic_invalid",
      validity_flags: [],
      validity_details: [
        {
          flag: "provider_api_failure",
          scope: "run",
          provider: "openrouter",
          message: "API returned a transport error"
        }
      ],
      task_seal_path: "/tmp/run/task-seal.json",
      task_seal_hash: "a".repeat(64),
      budget: {
        max_model_turns: 2,
        max_feedback_runs: 1
      },
      model_provider: {
        provider: "openrouter",
        model: "deepseek/deepseek-v4-flash",
        adapter_id: "openrouter-loop"
      },
      exclusion_rules: [],
      metric_version: "result-schema-v1",
      compatibility: {
        task_id: "sample-cart",
        task_version: "sample-cart-v0",
        protocol_version: "two-arm-feedback-spec-v0",
        renderer_version: "semantic-spec-renderer-v0",
        task_seal_hash: "a".repeat(64),
        checkpoint_list_hash: "b".repeat(64),
        visible_spec_hash: "c".repeat(64),
        feedback_asset_hash: "d".repeat(64),
        hidden_oracle_hash: "e".repeat(64),
        budget_hash: "f".repeat(64),
        model_provider_hash: "0".repeat(64),
        metric_definition_hash: "1".repeat(64)
      },
      conditions: ["context_only_spec", "feedback_capable_spec"],
      checkpoints: ["I01"],
      condition_results: {
        context_only_spec: {
          workspace_path: "/tmp/run/context_only_spec/workspace",
          checkpoints: []
        },
        feedback_capable_spec: {
          workspace_path: "/tmp/run/feedback_capable_spec/workspace",
          checkpoints: []
        }
      }
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain(
      "validity_details flag provider_api_failure must be declared in validity_flags"
    );
  });

  test("run manifest validation requires causal pilots to declare an equal max-turn budget", () => {
    const validation = validateRunManifest({
      protocol_version: "two-arm-feedback-spec-v0",
      renderer_version: "semantic-spec-renderer-v0",
      run_id: "causal-missing-budget",
      task_id: "sample-cart",
      task_version: "sample-cart-v0",
      run_classification: "causal_pilot",
      validity_flags: [],
      task_seal_path: "/tmp/run/task-seal.json",
      task_seal_hash: "a".repeat(64),
      budget: {
        max_model_turns: 1,
        max_feedback_runs: 0
      },
      model_provider: {
        provider: "fake"
      },
      exclusion_rules: [],
      metric_version: "result-schema-v1",
      compatibility: {
        task_id: "sample-cart",
        task_version: "sample-cart-v0",
        protocol_version: "two-arm-feedback-spec-v0",
        renderer_version: "semantic-spec-renderer-v0",
        task_seal_hash: "a".repeat(64),
        checkpoint_list_hash: "b".repeat(64),
        visible_spec_hash: "c".repeat(64),
        feedback_asset_hash: "d".repeat(64),
        hidden_oracle_hash: "e".repeat(64),
        budget_hash: "f".repeat(64),
        model_provider_hash: "0".repeat(64),
        metric_definition_hash: "1".repeat(64)
      },
      conditions: ["context_only_spec", "feedback_capable_spec"],
      checkpoints: ["I01"],
      condition_results: {
        context_only_spec: {
          workspace_path: "/tmp/run/context_only_spec/workspace",
          checkpoints: []
        },
        feedback_capable_spec: {
          workspace_path: "/tmp/run/feedback_capable_spec/workspace",
          checkpoints: []
        }
      }
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain(
      "causal_pilot runs must declare budget.max_model_turns of at least 2"
    );
  });

  test("artifact verification enforces causal turn budget and context-only feedback isolation", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));
    const result = await runPilot({
      task,
      run_id: "causal-turn-policy",
      runs_root: join(root, "runs"),
      run_classification: "causal_pilot",
      budget: {
        max_model_turns: 2,
        max_feedback_runs: 1
      },
      agent: {
        async run(input) {
          if (input.condition_id === "context_only_spec") {
            return {
              status: "ok",
              adapter_id: "leaky-loop",
              model_turns: 1,
              max_model_turns: 3,
              feedback_available: true,
              feedback_runs: 1,
              feedback_command: "bun run spec",
              feedback_summaries: ["visible feedback leaked"]
            };
          }

          return {
            status: "ok",
            adapter_id: "loop",
            model_turns: 1,
            max_model_turns: 2,
            max_feedback_runs: 1,
            feedback_available: true,
            feedback_runs: 0,
            feedback_summaries: []
          };
        }
      }
    });

    const verification = await verifyRunArtifacts(result.run_manifest_path);

    expect(verification.ok).toBe(false);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          mismatch.path === "context_only_spec/checkpoints/I01/agent-result.json/max_model_turns" &&
          mismatch.expected === "2" &&
          mismatch.actual === "3"
      )
    ).toBe(true);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          mismatch.path === "context_only_spec/checkpoints/I01/agent-result.json/feedback_available" &&
          mismatch.expected === "false for context_only_spec"
      )
    ).toBe(true);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          mismatch.path === "context_only_spec/checkpoints/I01/agent-result.json/feedback_summaries" &&
          mismatch.expected === "empty for context_only_spec"
      )
    ).toBe(true);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          mismatch.path === "feedback_capable_spec/checkpoints/I01/agent-result.json/feedback_runs" &&
          mismatch.expected === ">= 1 for causal feedback-use evidence" &&
          mismatch.actual === "0"
      )
    ).toBe(true);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          mismatch.path === "feedback_capable_spec/checkpoints/I01/agent-result.json/model_turns" &&
          mismatch.expected === ">= 2 for causal feedback-use evidence" &&
          mismatch.actual === "1"
      )
    ).toBe(true);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          mismatch.path === "feedback_capable_spec/checkpoints/I01/agent-result.json/transcript" &&
          mismatch.expected === "model_turn, feedback_run, model_turn sequence for causal feedback-use evidence"
      )
    ).toBe(true);

    const manifest = JSON.parse(await readFile(result.run_manifest_path, "utf8"));
    const feedbackCheckpoint = manifest.condition_results.feedback_capable_spec.checkpoints[0];

    expect(feedbackCheckpoint.feedback_opportunity_integrity).toEqual({
      required: true,
      turn_1_completed: true,
      feedback_ran: false,
      feedback_summary_delivered: false,
      turn_2_completed_after_feedback: false,
      complete: false
    });
  });

  test("run and checkpoint manifests persist complete feedback opportunity integrity for causal pilots", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));
    const result = await runPilot({
      task,
      run_id: "causal-feedback-opportunity-flags",
      runs_root: join(root, "runs"),
      run_classification: "causal_pilot",
      budget: {
        max_model_turns: 2,
        max_feedback_runs: 1
      },
      agent: {
        async run(input) {
          return {
            status: "ok",
            adapter_id: "loop",
            model_turns: input.condition_id === "feedback_capable_spec" ? 2 : 1,
            max_model_turns: 2,
            max_feedback_runs: 1,
            feedback_available: input.condition_id === "feedback_capable_spec",
            feedback_runs: input.condition_id === "feedback_capable_spec" ? 1 : 0,
            feedback_summaries: input.condition_id === "feedback_capable_spec" ? ["visible feedback summary"] : [],
            transcript:
              input.condition_id === "feedback_capable_spec"
                ? [
                    { event: "model_turn", detail: "turn=1" },
                    { event: "feedback_run", detail: "run=1" },
                    { event: "model_turn", detail: "turn=2" }
                  ]
                : [{ event: "model_turn", detail: "turn=1" }]
          };
        }
      }
    });
    const manifest = JSON.parse(await readFile(result.run_manifest_path, "utf8"));
    const feedbackCheckpoint = manifest.condition_results.feedback_capable_spec.checkpoints[0];
    const checkpointManifest = JSON.parse(
      await readFile(join(feedbackCheckpoint.artifact_dir, "manifest.json"), "utf8")
    );

    expect(validateRunManifest(manifest).ok).toBe(true);
    expect(feedbackCheckpoint.feedback_opportunity_integrity).toEqual({
      required: true,
      turn_1_completed: true,
      feedback_ran: true,
      feedback_summary_delivered: true,
      turn_2_completed_after_feedback: true,
      complete: true
    });
    expect(checkpointManifest.feedback_opportunity_integrity).toEqual(
      feedbackCheckpoint.feedback_opportunity_integrity
    );
    expect((await verifyRunArtifacts(result.run_manifest_path)).ok).toBe(true);
  });

  test("pooling validation rejects incompatible task seal, budget, and provider metadata", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));
    const baseline = await runPilot({
      task,
      run_id: "compat-baseline",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      budget: {
        max_model_turns: 3,
        max_feedback_runs: 2
      },
      model_provider: {
        provider: "fake",
        model: "deterministic-fake",
        adapter_id: "fake-agent"
      }
    });
    const same = await runPilot({
      task,
      run_id: "compat-same",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      budget: {
        max_model_turns: 3,
        max_feedback_runs: 2
      },
      model_provider: {
        provider: "fake",
        model: "deterministic-fake",
        adapter_id: "fake-agent"
      }
    });
    const changedBudget = await runPilot({
      task,
      run_id: "compat-changed-budget",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      budget: {
        max_model_turns: 1,
        max_feedback_runs: 0
      },
      model_provider: {
        provider: "fake",
        model: "deterministic-fake",
        adapter_id: "fake-agent"
      }
    });
    const baselineManifest = JSON.parse(await readFile(baseline.run_manifest_path, "utf8"));
    const sameManifest = JSON.parse(await readFile(same.run_manifest_path, "utf8"));
    const changedBudgetManifest = JSON.parse(await readFile(changedBudget.run_manifest_path, "utf8"));
    const changedSealManifest = structuredClone(sameManifest);
    const changedProviderManifest = structuredClone(sameManifest);
    const changedProviderProfileManifest = structuredClone(sameManifest);

    changedSealManifest.run_id = "compat-changed-seal";
    changedSealManifest.compatibility.task_seal_hash = "0".repeat(64);
    changedProviderManifest.run_id = "compat-changed-provider";
    changedProviderManifest.compatibility.model_provider_hash = "1".repeat(64);
    changedProviderProfileManifest.run_id = "compat-changed-provider-profile";
    changedProviderProfileManifest.compatibility.provider_execution_profile_hash = "2".repeat(64);

    expect(validateRunCompatibilityForPooling([baselineManifest, sameManifest]).ok).toBe(true);

    const validation = validateRunCompatibilityForPooling([
      baselineManifest,
      changedSealManifest,
      changedBudgetManifest,
      changedProviderManifest,
      changedProviderProfileManifest
    ]);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain(
      "Incompatible run compat-changed-seal: compatibility.task_seal_hash differs from compat-baseline"
    );
    expect(validation.errors).toContain(
      "Incompatible run compat-changed-budget: compatibility.budget_hash differs from compat-baseline"
    );
    expect(validation.errors).toContain(
      "Incompatible run compat-changed-provider: compatibility.model_provider_hash differs from compat-baseline"
    );
    expect(validation.errors).toContain(
      "Incompatible run compat-changed-provider-profile: compatibility.provider_execution_profile_hash differs from compat-baseline"
    );
  });
});

async function setupTemplateWorkspace() {
  const root = await mkTempRoot();
  const template = join(root, "template");

  await mkdir(join(template, "src"), { recursive: true });
  await writeFile(join(template, "README.md"), "template workspace\n");
  await writeFile(join(template, "src", "cart.ts"), "export function cartTotal() { return 0; }\n");

  return root;
}

async function mkTempRoot() {
  const root = join(tmpdir(), `hit-sdd-bench-compat-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}
