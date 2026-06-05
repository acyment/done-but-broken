import { describe, expect, test } from "bun:test";
import {
  buildRunResultRecord,
  calculateRegressionFreeAuc,
  calculatePrimaryMetric,
  validateRunResultRecord
} from "../src/result-schema";

describe("result schema and primary metric", () => {
  test("calculates final checkpoint pass-rate and regression counts per condition", () => {
    const evaluations = [
      checkpoint("context_only_spec", "I01", [{ commitment_id: "cart-total-visible", passed: true }]),
      checkpoint("context_only_spec", "I02", [
        { commitment_id: "cart-total-visible", passed: false },
        { commitment_id: "discount-does-not-hide-total", passed: true }
      ]),
      checkpoint("feedback_capable_spec", "I01", [
        { commitment_id: "cart-total-visible", passed: true }
      ]),
      checkpoint("feedback_capable_spec", "I02", [
        { commitment_id: "cart-total-visible", passed: true },
        { commitment_id: "discount-does-not-hide-total", passed: true }
      ])
    ];

    const metric = calculatePrimaryMetric({
      checkpoints: ["I01", "I02"],
      evaluations
    });

    expect(metric.name).toBe("final_checkpoint_pass_rate");
    expect(metric.checkpoint_id).toBe("I02");
    expect(metric.by_condition.context_only_spec.pass_rate).toBe(0.5);
    expect(metric.by_condition.context_only_spec.regression_count).toBe(1);
    expect(metric.by_condition.feedback_capable_spec.pass_rate).toBe(1);
    expect(metric.by_condition.feedback_capable_spec.regression_count).toBe(0);
    expect(metric.delta_feedback_minus_context).toBe(0.5);
  });

  test("calculates regression-free AUC from checkpoint-level survival", () => {
    const evaluations = [
      checkpoint("context_only_spec", "I01", [{ commitment_id: "cart-total-visible", passed: true }]),
      checkpoint("context_only_spec", "I02", [
        { commitment_id: "cart-total-visible", passed: false },
        { commitment_id: "discount-does-not-hide-total", passed: true }
      ]),
      checkpoint("feedback_capable_spec", "I01", [
        { commitment_id: "cart-total-visible", passed: true }
      ]),
      checkpoint("feedback_capable_spec", "I02", [
        { commitment_id: "cart-total-visible", passed: true },
        { commitment_id: "discount-does-not-hide-total", passed: true }
      ])
    ];

    const metric = calculateRegressionFreeAuc({
      checkpoints: ["I01", "I02"],
      evaluations
    });

    expect(metric.name).toBe("regression_free_auc");
    expect(metric.by_condition.context_only_spec).toBe(0.5);
    expect(metric.by_condition.feedback_capable_spec).toBe(1);
    expect(metric.delta_feedback_minus_context).toBe(0.5);
  });

  test("builds and validates a compact run result record", () => {
    const result = buildRunResultRecord({
      run_id: "run-result-001",
      task_id: "sample-cart",
      checkpoints: ["I01", "I02"],
      evaluations: [
        checkpoint("context_only_spec", "I01", [{ commitment_id: "cart-total-visible", passed: true }]),
        checkpoint("context_only_spec", "I02", [
          { commitment_id: "cart-total-visible", passed: false },
          { commitment_id: "discount-does-not-hide-total", passed: true }
        ]),
        checkpoint("feedback_capable_spec", "I01", [
          { commitment_id: "cart-total-visible", passed: true }
        ]),
        checkpoint("feedback_capable_spec", "I02", [
          { commitment_id: "cart-total-visible", passed: true },
          { commitment_id: "discount-does-not-hide-total", passed: true }
        ])
      ]
    });

    expect(result.schema_version).toBe("result-schema-v1");
    expect(result.condition_summaries.context_only_spec.final_checkpoint_passed).toBe(1);
    expect(result.condition_summaries.context_only_spec.final_checkpoint_total).toBe(2);
    expect(result.condition_summaries.feedback_capable_spec.final_checkpoint_passed).toBe(2);
    expect(result.checkpoint_metrics.context_only_spec).toEqual([
      {
        checkpoint_id: "I01",
        passed: 1,
        total: 1,
        pass_rate: 1,
        regression_free_success: true
      },
      {
        checkpoint_id: "I02",
        passed: 1,
        total: 2,
        pass_rate: 0.5,
        regression_free_success: false
      }
    ]);
    expect(result.checkpoint_metrics.feedback_capable_spec[1].regression_free_success).toBe(true);
    expect(result.regression_free_auc).toEqual({
      name: "regression_free_auc",
      by_condition: {
        context_only_spec: 0.5,
        feedback_capable_spec: 1
      },
      delta_feedback_minus_context: 0.5
    });
    expect(validateRunResultRecord(result).ok).toBe(true);
  });

  test("validation rejects records missing one of the two pilot conditions", () => {
    const result = buildRunResultRecord({
      run_id: "run-result-002",
      task_id: "sample-cart",
      checkpoints: ["I01"],
      evaluations: [checkpoint("context_only_spec", "I01", [{ commitment_id: "cart-total-visible", passed: true }])]
    });

    const broken = {
      ...result,
      condition_summaries: {
        context_only_spec: result.condition_summaries.context_only_spec
      }
    };

    expect(validateRunResultRecord(broken).ok).toBe(false);
  });

  test("validation rejects result records whose metric fields do not match evaluations", () => {
    const result = buildRunResultRecord({
      run_id: "run-result-forged",
      task_id: "sample-cart",
      checkpoints: ["I01", "I02"],
      evaluations: [
        checkpoint("context_only_spec", "I01", [{ commitment_id: "cart-total-visible", passed: true }]),
        checkpoint("context_only_spec", "I02", [
          { commitment_id: "cart-total-visible", passed: false }
        ]),
        checkpoint("feedback_capable_spec", "I01", [
          { commitment_id: "cart-total-visible", passed: true }
        ]),
        checkpoint("feedback_capable_spec", "I02", [
          { commitment_id: "cart-total-visible", passed: true }
        ])
      ]
    });
    const forged = {
      ...result,
      primary_metric: {
        ...result.primary_metric,
        delta_feedback_minus_context: 0
      }
    };

    const validation = validateRunResultRecord(forged);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("primary_metric does not match evaluations");
  });

  test("validation rejects result records whose checkpoint metrics do not match evaluations", () => {
    const result = buildRunResultRecord({
      run_id: "run-result-forged-checkpoint-metrics",
      task_id: "sample-cart",
      checkpoints: ["I01"],
      evaluations: [
        checkpoint("context_only_spec", "I01", [{ commitment_id: "cart-total-visible", passed: false }]),
        checkpoint("feedback_capable_spec", "I01", [
          { commitment_id: "cart-total-visible", passed: true }
        ])
      ]
    });
    const forged = {
      ...result,
      checkpoint_metrics: {
        ...result.checkpoint_metrics,
        context_only_spec: [
          {
            checkpoint_id: "I01",
            passed: 1,
            total: 1,
            pass_rate: 1,
            regression_free_success: true
          }
        ]
      }
    };

    const validation = validateRunResultRecord(forged);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("checkpoint_metrics do not match evaluations");
  });

  test("validation rejects result records whose regression-free AUC does not match evaluations", () => {
    const result = buildRunResultRecord({
      run_id: "run-result-forged-auc",
      task_id: "sample-cart",
      checkpoints: ["I01", "I02"],
      evaluations: [
        checkpoint("context_only_spec", "I01", [{ commitment_id: "cart-total-visible", passed: true }]),
        checkpoint("context_only_spec", "I02", [
          { commitment_id: "cart-total-visible", passed: false }
        ]),
        checkpoint("feedback_capable_spec", "I01", [
          { commitment_id: "cart-total-visible", passed: true }
        ]),
        checkpoint("feedback_capable_spec", "I02", [
          { commitment_id: "cart-total-visible", passed: true }
        ])
      ]
    });
    const forged = {
      ...result,
      regression_free_auc: {
        ...result.regression_free_auc,
        delta_feedback_minus_context: 0
      }
    };

    const validation = validateRunResultRecord(forged);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("regression_free_auc does not match evaluations");
  });

  test("validation rejects duplicate or missing checkpoint evaluations per condition", () => {
    const duplicate = buildRunResultRecord({
      run_id: "run-result-duplicate",
      task_id: "sample-cart",
      checkpoints: ["I01"],
      evaluations: [
        checkpoint("context_only_spec", "I01", [{ commitment_id: "cart-total-visible", passed: true }]),
        checkpoint("context_only_spec", "I01", [{ commitment_id: "cart-total-visible", passed: true }]),
        checkpoint("feedback_capable_spec", "I01", [
          { commitment_id: "cart-total-visible", passed: true }
        ])
      ]
    });
    const missing = buildRunResultRecord({
      run_id: "run-result-missing",
      task_id: "sample-cart",
      checkpoints: ["I01", "I02"],
      evaluations: [
        checkpoint("context_only_spec", "I01", [{ commitment_id: "cart-total-visible", passed: true }]),
        checkpoint("context_only_spec", "I02", [{ commitment_id: "cart-total-visible", passed: true }]),
        checkpoint("feedback_capable_spec", "I01", [
          { commitment_id: "cart-total-visible", passed: true }
        ])
      ]
    });

    expect(validateRunResultRecord(duplicate).errors).toContain(
      "Duplicate evaluation for context_only_spec/I01"
    );
    expect(validateRunResultRecord(missing).errors).toContain(
      "Missing evaluation for feedback_capable_spec/I02"
    );
  });

  test("validation rejects duplicate check IDs within one checkpoint evaluation", () => {
    const result = buildRunResultRecord({
      run_id: "run-result-duplicate-check",
      task_id: "sample-cart",
      checkpoints: ["I01"],
      evaluations: [
        {
          condition_id: "context_only_spec",
          checkpoint_id: "I01",
          checks: [
            {
              check_id: "duplicate-check",
              commitment_id: "cart-total-visible",
              passed: true
            },
            {
              check_id: "duplicate-check",
              commitment_id: "cart-total-visible",
              passed: true
            }
          ]
        },
        checkpoint("feedback_capable_spec", "I01", [
          { commitment_id: "cart-total-visible", passed: true }
        ])
      ]
    });

    expect(validateRunResultRecord(result).errors).toContain(
      "Duplicate check_id duplicate-check for context_only_spec/I01"
    );
  });

  test("validation rejects duplicate commitment IDs within one checkpoint evaluation", () => {
    const result = buildRunResultRecord({
      run_id: "run-result-duplicate-commitment",
      task_id: "sample-cart",
      checkpoints: ["I01"],
      evaluations: [
        {
          condition_id: "context_only_spec",
          checkpoint_id: "I01",
          checks: [
            {
              check_id: "cart-total-visible-a",
              commitment_id: "cart-total-visible",
              passed: true
            },
            {
              check_id: "cart-total-visible-b",
              commitment_id: "cart-total-visible",
              passed: true
            }
          ]
        },
        checkpoint("feedback_capable_spec", "I01", [
          { commitment_id: "cart-total-visible", passed: true }
        ])
      ]
    });

    expect(validateRunResultRecord(result).errors).toContain(
      "Duplicate commitment_id cart-total-visible for context_only_spec/I01"
    );
  });

  test("validation rejects evaluations for checkpoints outside the run sequence", () => {
    const result = buildRunResultRecord({
      run_id: "run-result-extra-checkpoint",
      task_id: "sample-cart",
      checkpoints: ["I01"],
      evaluations: [
        checkpoint("context_only_spec", "I01", [{ commitment_id: "cart-total-visible", passed: true }]),
        checkpoint("feedback_capable_spec", "I01", [
          { commitment_id: "cart-total-visible", passed: true }
        ]),
        checkpoint("context_only_spec", "I99", [{ commitment_id: "ghost-commitment", passed: true }])
      ]
    });

    expect(validateRunResultRecord(result).errors).toContain(
      "Unknown evaluation checkpoint I99 for context_only_spec"
    );
  });

  test("validation rejects malformed individual check fields", () => {
    const result = buildRunResultRecord({
      run_id: "run-result-malformed-check",
      task_id: "sample-cart",
      checkpoints: ["I01"],
      evaluations: [
        {
          condition_id: "context_only_spec",
          checkpoint_id: "I01",
          checks: [
            {
              check_id: "",
              commitment_id: "cart-total-visible",
              passed: true
            },
            {
              check_id: "missing-commitment",
              commitment_id: "",
              passed: true
            },
            {
              check_id: "bad-passed",
              commitment_id: "cart-total-visible",
              passed: "yes" as unknown as boolean
            }
          ]
        },
        checkpoint("feedback_capable_spec", "I01", [
          { commitment_id: "cart-total-visible", passed: true }
        ])
      ]
    });

    const validation = validateRunResultRecord(result);

    expect(validation.errors).toContain("check_id must be a non-empty string for context_only_spec/I01");
    expect(validation.errors).toContain("commitment_id must be a non-empty string for context_only_spec/I01/missing-commitment");
    expect(validation.errors).toContain("passed must be a boolean for context_only_spec/I01/bad-passed");
  });

  test("validation rejects malformed evaluation fields", () => {
    const result = buildRunResultRecord({
      run_id: "run-result-malformed-evaluation",
      task_id: "sample-cart",
      checkpoints: ["I01"],
      evaluations: [
        checkpoint("context_only_spec", "I01", [{ commitment_id: "cart-total-visible", passed: true }]),
        checkpoint("feedback_capable_spec", "I01", [
          { commitment_id: "cart-total-visible", passed: true }
        ])
      ]
    });
    const malformed = {
      ...result,
      evaluations: [
        {
          condition_id: "",
          checkpoint_id: "",
          checks: "not-an-array"
        },
        result.evaluations[1]
      ]
    };

    const validation = validateRunResultRecord(malformed);

    expect(validation.errors).toContain("condition_id must be a non-empty string for evaluation[0]");
    expect(validation.errors).toContain("checkpoint_id must be a non-empty string for evaluation[0]");
    expect(validation.errors).toContain("checks must be an array for evaluation[0]");
  });

  test("counts behavioral drift across three checkpoints without double-counting a commitment", () => {
    const metric = calculatePrimaryMetric({
      checkpoints: ["I01", "I02", "I03"],
      evaluations: [
        checkpoint("context_only_spec", "I01", [{ commitment_id: "cart-total-visible", passed: true }]),
        checkpoint("context_only_spec", "I02", [
          { commitment_id: "cart-total-visible", passed: true },
          { commitment_id: "discount-does-not-hide-total", passed: true }
        ]),
        checkpoint("context_only_spec", "I03", [
          { commitment_id: "cart-total-visible", passed: false },
          { commitment_id: "discount-does-not-hide-total", passed: false }
        ]),
        checkpoint("feedback_capable_spec", "I01", [
          { commitment_id: "cart-total-visible", passed: true }
        ]),
        checkpoint("feedback_capable_spec", "I02", [
          { commitment_id: "cart-total-visible", passed: true },
          { commitment_id: "discount-does-not-hide-total", passed: true }
        ]),
        checkpoint("feedback_capable_spec", "I03", [
          { commitment_id: "cart-total-visible", passed: true },
          { commitment_id: "discount-does-not-hide-total", passed: true }
        ])
      ]
    });

    expect(metric.checkpoint_id).toBe("I03");
    expect(metric.by_condition.context_only_spec.pass_rate).toBe(0);
    expect(metric.by_condition.context_only_spec.regression_count).toBe(2);
    expect(metric.by_condition.feedback_capable_spec.pass_rate).toBe(1);
    expect(metric.by_condition.feedback_capable_spec.regression_count).toBe(0);
    expect(metric.delta_feedback_minus_context).toBe(1);
  });

  test("validates an actual regression fixture distinct from newly introduced failures", async () => {
    const fixture = JSON.parse(
      await Bun.file("tasks/sample-cart/fixtures/regression-result.json").text()
    );
    const validation = validateRunResultRecord(fixture);

    expect(validation.ok).toBe(true);
    expect(fixture.condition_summaries.context_only_spec.regression_count).toBe(1);
    expect(fixture.condition_summaries.context_only_spec.final_checkpoint_passed).toBe(2);
    expect(fixture.condition_summaries.context_only_spec.final_checkpoint_total).toBe(3);
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
