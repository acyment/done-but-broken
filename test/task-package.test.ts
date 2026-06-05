import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSpecPacket } from "../src/renderer";
import { runPilot } from "../src/runner";
import {
  loadTaskPackage,
  validateAnalysisPlanJson,
  validateCanonicalSpecJson,
  validateCoverageManifestJson,
  validateFakeAgentValidationPlanJson,
  validateFeedbackAssetManifestJson,
  validateLocalAcceptanceCriteriaJson,
  validateTaskPackageCrossReferences,
  validateTaskPackageJson
} from "../src/task-package";
import { createFakeAgent } from "./support/fake-agent";

const repoRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/test$/, "");
const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("task package loading", () => {
  test("loads the sample task from disk without leaking hidden oracle paths into packets", async () => {
    const task = await loadTaskPackage(join(repoRoot, "tasks", "sample-cart"));

    expect(task.task_id).toBe("sample-cart");
    expect(task.checkpoints).toEqual(["I01", "I02", "I03"]);
    expect(task.template_workspace).toEndWith("tasks/sample-cart/template-workspace");
    expect(task.hidden_oracle_path).toEndWith("tasks/sample-cart/hidden-oracle");
    expect(task.hidden_oracle_path.startsWith(task.template_workspace)).toBe(false);
    expect(task.package_provenance?.task_package_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(task.package_provenance?.canonical_spec_hash).toMatch(/^[a-f0-9]{64}$/);

    const contextPacket = renderSpecPacket({
      task,
      condition_id: "context_only_spec",
      checkpoint_id: "I02"
    });
    const feedbackPacket = renderSpecPacket({
      task,
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I02"
    });
    const contextI03Packet = renderSpecPacket({
      task,
      condition_id: "context_only_spec",
      checkpoint_id: "I03"
    });
    const feedbackI03Packet = renderSpecPacket({
      task,
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I03"
    });

    expect(contextPacket.visible_spec_text).toBe(feedbackPacket.visible_spec_text);
    expect(contextPacket.prompt_text).not.toContain("hidden-oracle");
    expect(feedbackPacket.prompt_text).not.toContain("hidden-oracle");
    expect(contextPacket.feedback_assets).toEqual([]);
    expect(feedbackPacket.feedback_assets).toHaveLength(2);
    expect(contextI03Packet.visible_spec_text).toBe(feedbackI03Packet.visible_spec_text);
    expect(contextI03Packet.visible_spec_text).toContain("SPEC-003");
    expect(contextI03Packet.executable_feedback_paths).toEqual([]);
    expect(feedbackI03Packet.executable_feedback_paths).toEqual([
      "spec/cart-total-visible.spec.ts",
      "spec/discount-total.spec.ts",
      "spec/item-names-visible.spec.ts"
    ]);
  });

  test("writes package provenance into the run manifest", async () => {
    const root = await mkTempRoot();
    const task = await loadTaskPackage(join(repoRoot, "tasks", "sample-cart"));

    const result = await runPilot({
      task,
      run_id: "run-package-001",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });

    expect(result.run_manifest_path).toBe(join(root, "runs", "run-package-001", "run.json"));

    const runManifest = JSON.parse(await Bun.file(result.run_manifest_path).text());

    expect(runManifest.protocol_version).toBe("two-arm-feedback-spec-v0");
    expect(runManifest.renderer_version).toBe("semantic-spec-renderer-v0");
    expect(runManifest.task_id).toBe("sample-cart");
    expect(runManifest.conditions).toEqual(["context_only_spec", "feedback_capable_spec"]);
    expect(runManifest.task_package_path).toBe(task.package_provenance?.task_package_path);
    expect(runManifest.task_package_hash).toBe(task.package_provenance?.task_package_hash);
    expect(runManifest.canonical_spec_hash).toBe(task.package_provenance?.canonical_spec_hash);
  });

  test("rejects packages with hidden oracle paths inside the template workspace", async () => {
    const packageRoot = await createMinimalPackage({
      hidden_oracle_path: "template-workspace/hidden-oracle"
    });

    await expect(loadTaskPackage(packageRoot)).rejects.toThrow("hidden_oracle_path must be outside");
  });

  test("rejects packages that declare legacy condition IDs", async () => {
    const packageRoot = await createMinimalPackage({
      condition_ids: ["plain_agent"]
    });

    await expect(loadTaskPackage(packageRoot)).rejects.toThrow("Unsupported condition IDs");
  });

  test("validates task package JSON shapes without loading files", () => {
    expect(
      validateTaskPackageJson({
        task_id: "minimal-task",
        checkpoints: ["I01"],
        template_workspace: "template-workspace",
        canonical_spec: "canonical-spec.json",
        hidden_oracle_path: "hidden-oracle"
      }).ok
    ).toBe(true);

    expect(validateTaskPackageJson({ task_id: "missing-fields" }).errors).toContain(
      "checkpoints must be a non-empty array"
    );
    expect(
      validateTaskPackageJson({
        task_id: "duplicate-checkpoints",
        checkpoints: ["I01", "I01"],
        template_workspace: "template-workspace",
        canonical_spec: "canonical-spec.json",
        hidden_oracle_path: "hidden-oracle"
      }).errors
    ).toContain("Duplicate checkpoint I01");
    expect(
      validateCanonicalSpecJson(
        {
          records: [
            {
              spec_id: "SPEC-001",
              checkpoint_introduced: "I02",
              commitment_id: "commitment",
              title: "Commitment",
              intent: "Intent",
              active_checkpoints: ["I01"]
            }
          ]
        },
        ["I01"]
      ).errors
    ).toContain("Unknown checkpoint_introduced for SPEC-001");
    expect(
      validateCanonicalSpecJson(
        {
          records: [
            {
              spec_id: "SPEC-001",
              checkpoint_introduced: "I01",
              commitment_id: "commitment",
              title: "Commitment",
              intent: "Intent",
              active_checkpoints: ["I01"],
              feedback_binding: {
                asset_id: "asset",
                checkpoint_id: "I99"
              }
            }
          ]
        },
        ["I01"]
      ).errors
    ).toContain("Unknown feedback binding checkpoint I99 for SPEC-001");
    expect(
      validateCanonicalSpecJson(
        {
          records: [
            {
              spec_id: "SPEC-001",
              checkpoint_introduced: "I02",
              commitment_id: "commitment",
              title: "Commitment",
              intent: "Intent",
              active_checkpoints: ["I01"]
            }
          ]
        },
        ["I01", "I02"]
      ).errors
    ).toContain("active_checkpoints cannot include checkpoints before introduction for SPEC-001");
    expect(
      validateCanonicalSpecJson(
        {
          records: [
            {
              spec_id: "SPEC-001",
              checkpoint_introduced: "I02",
              commitment_id: "commitment",
              title: "Commitment",
              intent: "Intent",
              active_checkpoints: ["I02"],
              feedback_binding: {
                asset_id: "asset",
                checkpoint_id: "I01"
              }
            }
          ]
        },
        ["I01", "I02"]
      ).errors
    ).toContain("feedback_binding.checkpoint_id cannot be before checkpoint_introduced for SPEC-001");
    expect(
      validateFeedbackAssetManifestJson(
        [
          {
            asset_id: "asset",
            checkpoint_introduced: "I01",
            relative_path: "../escape.spec.ts",
            source_path: "asset.source.ts"
          }
        ],
        ["I01"]
      ).errors
    ).toContain("Feedback asset relative_path must stay inside the workspace: ../escape.spec.ts");
    expect(
      validateCanonicalSpecJson(
        {
          records: [
            {
              spec_id: "SPEC-001",
              checkpoint_introduced: "I01",
              commitment_id: "commitment-one",
              title: "Commitment",
              intent: "Intent",
              active_checkpoints: ["I01"]
            },
            {
              spec_id: "SPEC-001",
              checkpoint_introduced: "I01",
              commitment_id: "commitment-two",
              title: "Commitment",
              intent: "Intent",
              active_checkpoints: ["I01"]
            }
          ]
        },
        ["I01"]
      ).errors
    ).toContain("Duplicate spec_id SPEC-001");
    expect(
      validateCanonicalSpecJson(
        {
          records: [
            {
              spec_id: "SPEC-001",
              checkpoint_introduced: "I01",
              commitment_id: "commitment",
              title: "Commitment",
              intent: "Intent",
              active_checkpoints: ["I01"]
            },
            {
              spec_id: "SPEC-002",
              checkpoint_introduced: "I01",
              commitment_id: "commitment",
              title: "Commitment",
              intent: "Intent",
              active_checkpoints: ["I01"]
            }
          ]
        },
        ["I01"]
      ).errors
    ).toContain("Duplicate commitment_id commitment");
    expect(
      validateFeedbackAssetManifestJson(
        [
          {
            asset_id: "asset",
            checkpoint_introduced: "I01",
            relative_path: "asset-one.spec.ts",
            source_path: "asset-one.source.ts"
          },
          {
            asset_id: "asset",
            checkpoint_introduced: "I01",
            relative_path: "asset-two.spec.ts",
            source_path: "asset-two.source.ts"
          }
        ],
        ["I01"]
      ).errors
    ).toContain("Duplicate feedback asset_id asset");
  });

  test("validates cross-file feedback bindings against feedback assets", async () => {
    expect(
      validateTaskPackageCrossReferences({
        canonical_spec: {
          records: [
            {
              spec_id: "SPEC-001",
              checkpoint_introduced: "I01",
              commitment_id: "commitment",
              title: "Commitment",
              intent: "Intent",
              active_checkpoints: ["I01"],
              feedback_binding: {
                asset_id: "missing-asset"
              }
            }
          ]
        },
        feedback_assets: []
      }).errors
    ).toContain("Feedback binding missing-asset for SPEC-001 has no matching feedback asset");

    const packageRoot = await createPackageWithMissingFeedbackAsset();

    await expect(loadTaskPackage(packageRoot)).rejects.toThrow(
      "Feedback binding missing-asset for SPEC-001 has no matching feedback asset"
    );
  });

  test("validates coverage and fake-agent validation plan references", () => {
    const canonical_spec = {
      records: [
        {
          spec_id: "SPEC-001",
          checkpoint_introduced: "I01",
          commitment_id: "known-commitment",
          title: "Known commitment",
          intent: "Known behavior",
          active_checkpoints: ["I01"]
        }
      ]
    };
    const coverageValidation = validateCoverageManifestJson(
      {
        schema_version: "visible-hidden-coverage-v0",
        task_id: "task",
        task_version: "task-v0",
        entries: [
          {
            spec_id: "SPEC-999",
            commitment_id: "unknown-commitment",
            checkpoint_introduced: "I99",
            visible_feedback: { status: "maybe" },
            hidden_oracle: { status: "planned", refs: [], check_ids: [] }
          }
        ]
      },
      {
        task_id: "task",
        task_version: "task-v0",
        checkpoints: ["I01"],
        canonical_spec
      }
    );
    const planValidation = validateFakeAgentValidationPlanJson(
      {
        schema_version: "fake-agent-validation-plan-v0",
        task_id: "task",
        task_version: "task-v0",
        scenarios: [
          {
            scenario_id: "bad-checkpoint",
            checkpoint_id: "I99",
            purpose: "bad reference",
            expected_agent_mode: "scripted-reference"
          }
        ]
      },
      {
        task_id: "task",
        task_version: "task-v0",
        checkpoints: ["I01"]
      }
    );

    expect(coverageValidation.errors).toContain(
      "coverage_manifest.entries must match canonical spec commitment order"
    );
    expect(coverageValidation.errors).toContain(
      "coverage unknown-commitment.commitment_id must reference a canonical spec commitment"
    );
    expect(coverageValidation.errors).toContain(
      "coverage unknown-commitment.visible_feedback.status must be planned, implemented, or absent"
    );
    expect(coverageValidation.errors).toContain(
      "coverage unknown-commitment.hidden_oracle.refs must be a non-empty array of strings"
    );
    expect(planValidation.errors).toContain(
      "fake-agent scenario bad-checkpoint.checkpoint_id must reference a known checkpoint"
    );
    expect(planValidation.errors).toContain("fake_agent_validation_plan must cover checkpoint I01");
  });

  test("validates local acceptance criteria and analysis plan references", () => {
    const canonical_spec = {
      records: [
        {
          spec_id: "SPEC-001",
          checkpoint_introduced: "I01",
          commitment_id: "known-commitment",
          title: "Known commitment",
          intent: "Known behavior",
          active_checkpoints: ["I01"]
        }
      ]
    };
    const coverage_manifest = {
      schema_version: "visible-hidden-coverage-v0" as const,
      task_id: "task",
      task_version: "task-v0",
      entries: [
        {
          spec_id: "SPEC-001",
          checkpoint_introduced: "I01",
          commitment_id: "known-commitment",
          visible_feedback: {
            status: "planned" as const,
            asset_id: "known-visible-check",
            relative_path: "spec/known.spec.ts"
          },
          hidden_oracle: {
            status: "planned" as const,
            refs: ["hidden-oracle/known-private.txt"],
            check_ids: ["known-private"]
          }
        }
      ]
    };
    const fake_agent_validation_plan = {
      schema_version: "fake-agent-validation-plan-v0" as const,
      task_id: "task",
      task_version: "task-v0",
      scenarios: [
        {
          scenario_id: "known-reference",
          checkpoint_id: "I01",
          purpose: "reference scenario",
          expected_agent_mode: "scripted-reference"
        }
      ]
    };
    const acceptanceValidation = validateLocalAcceptanceCriteriaJson(
      {
        schema_version: "local-acceptance-criteria-v0",
        task_id: "task",
        task_version: "task-v0",
        criteria: [
          {
            criterion_id: "bad-visible",
            target: "visible_feedback_asset",
            checkpoint_id: "I99",
            commitment_id: "unknown-commitment",
            required_before: "causal_pilot",
            description: "bad criterion",
            evidence: ["coverage-manifest.json"]
          },
          {
            criterion_id: "bad-fake",
            target: "fake_agent_validation",
            checkpoint_id: "I01",
            scenario_id: "missing-scenario",
            required_before: "difficulty_probe",
            description: "bad scenario",
            evidence: ["local:fake"]
          }
        ]
      },
      {
        task_id: "task",
        task_version: "task-v0",
        checkpoints: ["I01"],
        canonical_spec,
        coverage_manifest,
        fake_agent_validation_plan
      }
    );
    const analysisValidation = validateAnalysisPlanJson(
      {
        schema_version: "analysis-plan-v0",
        status: "draft",
        task_id: "task",
        task_version: "task-v0",
        conditions: ["context_only_spec"],
        run_classifications: ["causal_pilot"],
        primary_metric: "final_checkpoint_pass_rate_delta",
        secondary_metrics: [],
        planned_metrics: [],
        budget: {
          max_model_turns: 1,
          max_feedback_runs: -1
        },
        model_provider: {
          provider: "",
          model: "model",
          adapter_id: "adapter"
        },
        exclusion_rules: [],
        pooling_rules: {
          compatibility_fields: ["task_id"],
          reject_validity_flags: true
        },
        promotion_gates: []
      },
      {
        task_id: "task",
        task_version: "task-v0"
      }
    );

    expect(acceptanceValidation.errors).toContain(
      "local acceptance criterion bad-visible.checkpoint_id must reference a known checkpoint"
    );
    expect(acceptanceValidation.errors).toContain(
      "local acceptance criterion bad-visible.commitment_id must reference a canonical spec commitment"
    );
    expect(acceptanceValidation.errors).toContain(
      "local acceptance criteria must include visible_feedback_asset criterion for known-commitment"
    );
    expect(acceptanceValidation.errors).toContain(
      "local acceptance criteria must include hidden_oracle criterion for known-commitment"
    );
    expect(acceptanceValidation.errors).toContain(
      "local acceptance criterion bad-fake.scenario_id must reference a fake-agent validation scenario"
    );
    expect(acceptanceValidation.errors).toContain(
      "local acceptance criteria evidence entries must be local evidence references"
    );
    expect(analysisValidation.errors).toContain(
      "analysis_plan.conditions must exactly match the two pilot condition IDs"
    );
    expect(analysisValidation.errors).toContain(
      "analysis_plan.run_classifications must include difficulty_probe before provider promotion"
    );
    expect(analysisValidation.errors).toContain("analysis_plan.budget.max_model_turns must be at least 2");
    expect(analysisValidation.errors).toContain(
      "analysis_plan.budget.max_feedback_runs must be a non-negative integer"
    );
    expect(analysisValidation.errors).toContain(
      "analysis_plan.model_provider.provider must be a non-empty string"
    );
    expect(analysisValidation.errors).toContain(
      "analysis_plan.pooling_rules.compatibility_fields must include task_version"
    );
    expect(analysisValidation.errors).toContain("analysis_plan.promotion_gates must be a non-empty array of strings");
  });
});

async function createMinimalPackage(overrides: Record<string, unknown>) {
  const root = await mkTempRoot();
  const packageRoot = join(root, "task");

  await mkdir(join(packageRoot, "template-workspace"), { recursive: true });
  await mkdir(join(packageRoot, "hidden-oracle"), { recursive: true });
  await writeFile(join(packageRoot, "template-workspace", "README.md"), "template\n");
  await writeFile(join(packageRoot, "hidden-oracle", "private.test.ts"), "private\n");
  await writeFile(
    join(packageRoot, "canonical-spec.json"),
    JSON.stringify(
      {
        records: [
          {
            spec_id: "SPEC-001",
            checkpoint_introduced: "I01",
            commitment_id: "commitment",
            title: "Minimal commitment",
            intent: "Keep the loader focused.",
            active_checkpoints: ["I01"]
          }
        ]
      },
      null,
      2
    )
  );
  await writeFile(
    join(packageRoot, "task.json"),
    JSON.stringify(
      {
        task_id: "minimal-task",
        checkpoints: ["I01"],
        template_workspace: "template-workspace",
        canonical_spec: "canonical-spec.json",
        hidden_oracle_path: "hidden-oracle",
        ...overrides
      },
      null,
      2
    )
  );

  return packageRoot;
}

async function createPackageWithMissingFeedbackAsset() {
  const root = await mkTempRoot();
  const packageRoot = join(root, "task");

  await mkdir(join(packageRoot, "template-workspace"), { recursive: true });
  await mkdir(join(packageRoot, "hidden-oracle"), { recursive: true });
  await mkdir(join(packageRoot, "feedback-assets"), { recursive: true });
  await writeFile(join(packageRoot, "template-workspace", "README.md"), "template\n");
  await writeFile(join(packageRoot, "hidden-oracle", "private.txt"), "private\n");
  await writeFile(join(packageRoot, "feedback-assets", "manifest.json"), "[]\n");
  await writeFile(
    join(packageRoot, "canonical-spec.json"),
    JSON.stringify(
      {
        records: [
          {
            spec_id: "SPEC-001",
            checkpoint_introduced: "I01",
            commitment_id: "commitment",
            title: "Minimal commitment",
            intent: "Keep the loader focused.",
            active_checkpoints: ["I01"],
            feedback_binding: {
              asset_id: "missing-asset"
            }
          }
        ]
      },
      null,
      2
    )
  );
  await writeFile(
    join(packageRoot, "task.json"),
    JSON.stringify(
      {
        task_id: "minimal-task",
        checkpoints: ["I01"],
        template_workspace: "template-workspace",
        canonical_spec: "canonical-spec.json",
        feedback_assets: "feedback-assets/manifest.json",
        hidden_oracle_path: "hidden-oracle"
      },
      null,
      2
    )
  );

  return packageRoot;
}

async function mkTempRoot() {
  const root = join(tmpdir(), `hit-sdd-bench-package-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}
