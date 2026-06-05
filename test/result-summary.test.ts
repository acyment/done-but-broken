import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderResultSummary, writeResultSummary } from "../src/result-summary";
import { buildRunResultRecord, validateRunResultRecord } from "../src/result-schema";

const tempRoots: string[] = [];
const repoRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/test$/, "");

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("result summary writer", () => {
  test("renders a compact markdown summary for result-schema-v1", () => {
    const summary = renderResultSummary(
      buildRunResultRecord({
        run_id: "summary-001",
        task_id: "sample-cart",
        checkpoints: ["I01", "I02", "I03"],
        evaluations: [
          checkpoint("context_only_spec", "I03", [
            { commitment_id: "cart-total-visible", passed: true },
            { commitment_id: "discount-does-not-hide-total", passed: false }
          ]),
          checkpoint("feedback_capable_spec", "I03", [
            { commitment_id: "cart-total-visible", passed: true },
            { commitment_id: "discount-does-not-hide-total", passed: true }
          ])
        ]
      })
    );

    expect(summary).toContain("# Run summary: summary-001");
    expect(summary).toContain("- Task: sample-cart");
    expect(summary).toContain("- Primary metric: final_checkpoint_pass_rate at I03");
    expect(summary).toContain("| context_only_spec | 1/2 | 0.5 | 0 |");
    expect(summary).toContain("| feedback_capable_spec | 2/2 | 1 | 0 |");
    expect(summary).toContain("- Feedback minus context delta: 0.5");
    expect(summary).toContain("- Regression-free AUC delta: 0.3333");
    expect(summary).toContain("Checkpoint regression-free success:");
    expect(summary).toContain("| Condition | I01 | I02 | I03 |");
    expect(summary).toContain("| context_only_spec | no (0/0) | no (0/0) | no (1/2) |");
    expect(summary).toContain("| feedback_capable_spec | no (0/0) | no (0/0) | yes (2/2) |");
  });

  test("renders public evidence status when manifest metadata is provided", () => {
    const summary = renderResultSummary(
      buildRunResultRecord({
        run_id: "summary-evidence-001",
        task_id: "sample-cart",
        checkpoints: ["I01"],
        evaluations: [
          checkpoint("context_only_spec", "I01", [{ commitment_id: "cart-total-visible", passed: true }]),
          checkpoint("feedback_capable_spec", "I01", [{ commitment_id: "cart-total-visible", passed: true }])
        ]
      }),
      {
        run_classification: "causal_pilot",
        clean_primary_evidence_eligible: false,
        validity_flags: ["provider_timeout"],
        provider_profile_id: "openrouter-loop-v1-timeout90000-output8000-temp0.2-retry0",
        provider_timeout_phases: ["retry_recovered_timeout"],
        provider_timeout_detail_count: 1,
        workspace_carried_forward_due_to_provider_failure_checkpoints: 0,
        feedback_opportunity_integrity: {
          status: "complete",
          complete_checkpoints: 1,
          required_checkpoints: 1,
          incomplete_checkpoints: []
        }
      }
    );

    expect(summary).toContain("Evidence status:");
    expect(summary).toContain("- Run classification: causal_pilot");
    expect(summary).toContain("- Clean primary evidence eligible: no");
    expect(summary).toContain("- Validity flags: provider_timeout");
    expect(summary).toContain("- Provider profile: openrouter-loop-v1-timeout90000-output8000-temp0.2-retry0");
    expect(summary).toContain("- Provider timeout phases: retry_recovered_timeout");
    expect(summary).toContain("- Provider timeout detail count: 1");
    expect(summary).toContain("- Provider carry-forward checkpoints: 0");
    expect(summary).toContain("- Feedback opportunity integrity: complete (1/1)");
  });

  test("writes the summary to disk", async () => {
    const root = await mkTempRoot();
    const outputPath = join(root, "summary.md");

    await writeResultSummary({
      output_path: outputPath,
      result: buildRunResultRecord({
        run_id: "summary-002",
        task_id: "sample-cart",
        checkpoints: ["I01"],
        evaluations: [
          checkpoint("context_only_spec", "I01", [{ commitment_id: "cart-total-visible", passed: true }]),
          checkpoint("feedback_capable_spec", "I01", [
            { commitment_id: "cart-total-visible", passed: true }
          ])
        ]
      })
    });

    expect(await readFile(outputPath, "utf8")).toContain("# Run summary: summary-002");
  });

  test("renders the failing sample-cart result fixture", async () => {
    const fixture = JSON.parse(
      await readFile(join(repoRoot, "tasks", "sample-cart", "fixtures", "failing-result.json"), "utf8")
    );
    const validation = validateRunResultRecord(fixture);

    expect(validation.ok).toBe(true);

    const summary = renderResultSummary(fixture);

    expect(summary).toContain("# Run summary: sample-cart-failing-fixture");
    expect(summary).toContain("| context_only_spec | 2/3 | 0.6667 | 0 |");
    expect(summary).toContain("| feedback_capable_spec | 3/3 | 1 | 0 |");
    expect(summary).toContain("- Feedback minus context delta: 0.3333");
    expect(summary).toContain("- Regression-free AUC delta: 0.3333");
  });
});

function checkpoint(
  condition_id: "context_only_spec" | "feedback_capable_spec",
  checkpoint_id: string,
  checks: Array<{ commitment_id: string; passed: boolean }>
) {
  return {
    condition_id,
    checkpoint_id,
    checks: checks.map((check) => ({
      check_id: `${checkpoint_id}-${check.commitment_id}`,
      commitment_id: check.commitment_id,
      passed: check.passed
    }))
  };
}

async function mkTempRoot() {
  const root = join(tmpdir(), `hit-sdd-bench-summary-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}
