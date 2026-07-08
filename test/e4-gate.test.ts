// M3 acceptance — gate half (docs/e4/IMPLEMENTATION-PLAN.md §2 M3; architecture §6 Feature 3;
// ADR-003). The executor is faked here (pure verdict tables): the gate's contract is WHEN the
// shared executor runs and WHAT is done with the verdict; the real executor has its own acceptance
// file. Includes the [R2: R2-3] purity property: the gate consults no meter or ground-truth state,
// asserted structurally against the module's imports and source.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  E4ArmHTaskGate,
  E4GateStateError,
  type E4SpecArtifactSnapshot,
  e4ConventionsGrammarOk
} from "../src/e4/gate";
import { E4_ARM_POLICIES } from "../src/e4/arm-policy";
import type { E4ExecutorResult } from "../src/e4/oracle-executor";
import type { E4HttpTest } from "../src/e4/substrate/testgen";

const repoRoot = resolve(import.meta.dir, "..");

function httpTest(testId: string): E4HttpTest {
  return {
    test_id: testId,
    description: testId,
    source_item_uid: `uid-${testId}`,
    request: { method: "GET", path: `/${testId}` },
    expected: { status: 200 }
  };
}

const DELTA = [httpTest("delta-1"), httpTest("delta-2")];
const PRIOR = [httpTest("prior-1"), httpTest("prior-2")];
const CUMULATIVE = [...PRIOR, ...DELTA];

const START_SPEC: E4SpecArtifactSnapshot = {
  openapi_json: JSON.stringify({ openapi: "3.1.0", paths: {} }),
  conventions_md: "# CONVENTIONS\n\n- `error-format`: Error responses are JSON.\n"
};

const CHANGED_SPEC: E4SpecArtifactSnapshot = {
  ...START_SPEC,
  openapi_json: JSON.stringify({ openapi: "3.1.0", paths: { "/delta-1": { get: {} } } })
};

function completedRun(tests: E4HttpTest[], failingIds: string[]): E4ExecutorResult {
  const verdicts = tests.map((test) => ({
    test_id: test.test_id,
    passed: !failingIds.includes(test.test_id),
    failures: failingIds.includes(test.test_id) ? ["status: expected 200, got 500"] : []
  }));

  return {
    kind: "completed",
    verdicts,
    pass_count: verdicts.filter((verdict) => verdict.passed).length,
    total: verdicts.length,
    transcript: [],
    server_stdout: "",
    server_stderr: ""
  };
}

// Fake executor keyed by test-set identity: delta / prior-cumulative / cumulative.
function fakeExecutor(plan: {
  delta_failing?: string[];
  prior_failing?: string[];
  cumulative_failing?: string[];
  result_override?: (tests: E4HttpTest[]) => E4ExecutorResult | null;
}): { runs: E4HttpTest[][]; run: (tests: E4HttpTest[]) => Promise<E4ExecutorResult> } {
  const runs: E4HttpTest[][] = [];

  return {
    runs,
    run: async (tests: E4HttpTest[]) => {
      runs.push(tests);
      const override = plan.result_override?.(tests);

      if (override) {
        return override;
      }

      if (tests.length === CUMULATIVE.length) {
        return completedRun(tests, plan.cumulative_failing ?? []);
      }

      if (tests[0]?.test_id.startsWith("prior")) {
        return completedRun(tests, plan.prior_failing ?? []);
      }

      return completedRun(tests, plan.delta_failing ?? []);
    }
  };
}

function makeGate(input: {
  labels?: ("drift_opportunity" | "additive" | "behavior_preserving")[];
  executor: (tests: E4HttpTest[]) => Promise<E4ExecutorResult>;
}): E4ArmHTaskGate {
  return new E4ArmHTaskGate({
    opportunity_labels: input.labels ?? ["drift_opportunity"],
    task_start_spec: START_SPEC,
    tests: { delta: DELTA, cumulative: CUMULATIVE, prior_cumulative: PRIOR },
    runExecutor: input.executor
  });
}

describe("Feature 3 — implementation is blocked until custody passes", () => {
  test("app-code writes are rejected by phase guards in spec phase, recorded, and the task stays in spec phase", () => {
    const gate = makeGate({ executor: fakeExecutor({}).run });

    expect(gate.evaluateWriteAccess("server.ts").allowed).toBe(false);
    expect(gate.evaluateWriteAccess("new-helper.ts").allowed).toBe(false);
    expect(gate.evaluateWriteAccess("specs/../server.ts").allowed).toBe(false); // traversal never bypasses
    expect(gate.evaluateWriteAccess("specs/openapi.json").allowed).toBe(true);
    expect(gate.evaluateWriteAccess("specs/CONVENTIONS.md").allowed).toBe(true);

    const rejections = gate.events().filter((event) => event.type === "phase_guard_rejection");
    expect(rejections.length).toBe(3);
    expect(gate.phase()).toBe("spec");
  });

  test("guards flip in implementation phase: spec paths frozen, app code writable", async () => {
    const gate = makeGate({ executor: fakeExecutor({ delta_failing: ["delta-1"] }).run });
    await gate.attemptSpecExit(CHANGED_SPEC);

    expect(gate.phase()).toBe("implementation");
    expect(gate.evaluateWriteAccess("specs/openapi.json").allowed).toBe(false);
    expect(gate.evaluateWriteAccess("server.ts").allowed).toBe(true);
  });

  test("custody fails on unchanged spec artifacts (non-behavior-preserving) with feedback; turn loop stays in spec phase", async () => {
    const executor = fakeExecutor({});
    const gate = makeGate({ executor: executor.run });
    const result = await gate.attemptSpecExit(START_SPEC);

    expect(result.outcome).toBe("custody_failed");

    if (result.outcome === "custody_failed") {
      expect(result.feedback).toContain("unchanged since task start");
    }

    expect(gate.phase()).toBe("spec");
    expect(gate.summary().custody_failures).toBe(1);
    expect(executor.runs.length).toBe(0); // custody failure never reaches the executor
  });

  test("custody fails on unparseable spec artifacts", async () => {
    const gate = makeGate({ executor: fakeExecutor({}).run });
    const result = await gate.attemptSpecExit({ ...CHANGED_SPEC, openapi_json: "{ not json" });

    expect(result.outcome).toBe("custody_failed");
    expect(gate.phase()).toBe("spec");
  });

  test("custody fails on a malformed conventions bullet (attempted grammar must fully match)", async () => {
    const gate = makeGate({ executor: fakeExecutor({}).run });
    const malformed = { ...CHANGED_SPEC, conventions_md: "- `error-format` missing the colon separator\n" };
    const result = await gate.attemptSpecExit(malformed);

    expect(result.outcome).toBe("custody_failed");
  });
});

describe("Feature 3 — red check must be red", () => {
  test("delta red + cumulative prior green ⇒ red check passes as 'red'", async () => {
    const executor = fakeExecutor({ delta_failing: ["delta-1"] });
    const gate = makeGate({ executor: executor.run });
    const result = await gate.attemptSpecExit(CHANGED_SPEC);

    expect(result.outcome).toBe("advanced");

    if (result.outcome === "advanced") {
      expect(result.red_check).toBe("red");
      expect(result.delta_failures).toBe(1);
      expect(result.prior_cumulative_green).toBe(true);
    }

    expect(gate.phase()).toBe("implementation");
    expect(gate.summary().red_check).toBe("red");
    expect(executor.runs.length).toBe(2); // delta run + prior-cumulative run
  });

  test("a green delta set is recorded as gate_anomaly_green_red_check and the task proceeds", async () => {
    const gate = makeGate({ executor: fakeExecutor({}).run });
    const result = await gate.attemptSpecExit(CHANGED_SPEC);

    expect(result.outcome).toBe("advanced");

    if (result.outcome === "advanced") {
      expect(result.red_check).toBe("green_anomaly");
    }

    expect(gate.events().some((event) => event.type === "gate_anomaly_green_red_check")).toBe(true);
    expect(gate.phase()).toBe("implementation");
  });

  test("[R1-B1] an agent-broken server at the red check reads as delta red, never executor_error", async () => {
    const gate = makeGate({
      executor: fakeExecutor({
        result_override: () => ({
          kind: "readiness_failed",
          classification: "agent_workspace",
          reason: "server process exited (code 1) before becoming ready",
          server_stdout: "",
          server_stderr: "boom"
        })
      }).run
    });
    const result = await gate.attemptSpecExit(CHANGED_SPEC);

    expect(result.outcome).toBe("advanced");

    if (result.outcome === "advanced") {
      expect(result.red_check).toBe("red");
      expect(result.delta_failures).toBe(DELTA.length);
      expect(result.prior_cumulative_green).toBe(false);
    }
  });

  test("an infra executor_error during the red check propagates for sequence abort", async () => {
    const gate = makeGate({
      executor: fakeExecutor({
        result_override: () => ({ kind: "executor_error", classification_rationale: "executor internal crash: x" })
      }).run
    });
    const result = await gate.attemptSpecExit(CHANGED_SPEC);

    expect(result.outcome).toBe("executor_error");
    expect(gate.phase()).toBe("spec");
  });
});

describe("Feature 3 — done over red is refused (Claim-B/B1)", () => {
  async function gateInImplementation(plan: Parameters<typeof fakeExecutor>[0]) {
    const executor = fakeExecutor({ delta_failing: ["delta-1"], ...plan });
    const gate = makeGate({ executor: executor.run });
    await gate.attemptSpecExit(CHANGED_SPEC);
    return { gate, executor };
  }

  test("done over red: refused, refused_done_over_red increments, failing results injected, loop continues", async () => {
    const { gate } = await gateInImplementation({ cumulative_failing: ["delta-1", "prior-2"] });
    const result = await gate.submitDoneClaim();

    expect(result.outcome).toBe("refused");

    if (result.outcome === "refused") {
      expect(result.enforcement_outcome).toBe("refused");
      expect(result.failing_test_ids.toSorted()).toEqual(["delta-1", "prior-2"]);
      expect(result.feedback).toContain("delta-1");
      expect(result.oracle).toEqual({ delta_pass: 1, delta_total: 2, cumulative_pass: 2, cumulative_total: 4 });
    }

    expect(gate.phase()).toBe("implementation"); // the turn loop continues
    expect(gate.summary().refused_done_over_red).toBe(1);

    // A second premature claim is refused again — refusal is per-claim, not one-shot.
    const second = await gate.submitDoneClaim();
    expect(second.outcome).toBe("refused");
    expect(gate.summary().refused_done_over_red).toBe(2);
  });

  test("done over green is accepted and the task closes with enforcement_outcome=accepted", async () => {
    const { gate } = await gateInImplementation({ cumulative_failing: [] });
    const result = await gate.submitDoneClaim();

    expect(result.outcome).toBe("accepted");

    if (result.outcome === "accepted") {
      expect(result.enforcement_outcome).toBe("accepted");
      expect(result.oracle).toEqual({ delta_pass: 2, delta_total: 2, cumulative_pass: 4, cumulative_total: 4 });
    }

    expect(gate.phase()).toBe("closed");
    expect(() => gate.evaluateWriteAccess("server.ts").allowed).not.toThrow();
    expect(gate.evaluateWriteAccess("server.ts").allowed).toBe(false);
  });

  test("[R1-B1] an agent-broken server at the green check refuses the claim, all checks failing", async () => {
    const { gate } = await gateInImplementation({
      result_override: (tests) =>
        tests.length === CUMULATIVE.length
          ? {
              kind: "readiness_failed",
              classification: "agent_workspace",
              reason: "server not ready within 900ms (readiness timeout)",
              server_stdout: "",
              server_stderr: ""
            }
          : null
    });
    const result = await gate.submitDoneClaim();

    expect(result.outcome).toBe("refused");

    if (result.outcome === "refused") {
      expect(result.oracle.cumulative_pass).toBe(0);
      expect(result.feedback).toContain("failed to become ready");
    }
  });

  test("a done-claim in spec phase is a state error (the runner routes it to attemptSpecExit)", async () => {
    const gate = makeGate({ executor: fakeExecutor({}).run });

    expect(gate.submitDoneClaim()).rejects.toThrow(E4GateStateError);
  });
});

describe("Feature 3 — behavior-preserving tasks skip the red check (§3.3 affirmation)", () => {
  test("unchanged spec + smoke invocation ⇒ affirmation; custody passes, red check skipped, no executor run", async () => {
    const executor = fakeExecutor({});
    const gate = makeGate({ labels: ["behavior_preserving"], executor: executor.run });
    gate.recordSmokeInvocation();
    const result = await gate.attemptSpecExit(START_SPEC);

    expect(result.outcome).toBe("advanced");

    if (result.outcome === "advanced") {
      expect(result.custody_via).toBe("behavior_preserving_affirmation");
      expect(result.red_check).toBe("skipped_behavior_preserving");
      expect(result.prior_cumulative_green).toBeNull();
    }

    expect(executor.runs.length).toBe(0); // no red run — and no meter/ground-truth consulted either
    expect(gate.events().some((event) => event.type === "behavior_preserving_affirmed")).toBe(true);
    expect(gate.summary().red_check).toBe("skipped_behavior_preserving");
  });

  test("affirmation refused without the verification-command handshake (condition iii)", async () => {
    const gate = makeGate({ labels: ["behavior_preserving"], executor: fakeExecutor({}).run });
    const result = await gate.attemptSpecExit(START_SPEC);

    expect(result.outcome).toBe("custody_failed");

    if (result.outcome === "custody_failed") {
      expect(result.feedback).toContain("verification (smoke) command");
    }

    // The handshake requires a deliberate act in the SPEC phase — an implementation-phase smoke
    // run would not count, and inaction never exits the phase ([R1-S4]).
    expect(gate.phase()).toBe("spec");
  });

  test("an edited spec on a behavior-preserving task falls through to ordinary custody; red check still skipped", async () => {
    const executor = fakeExecutor({});
    const gate = makeGate({ labels: ["behavior_preserving"], executor: executor.run });
    const result = await gate.attemptSpecExit(CHANGED_SPEC);

    expect(result.outcome).toBe("advanced");

    if (result.outcome === "advanced") {
      expect(result.custody_via).toBe("spec_change");
      expect(result.red_check).toBe("skipped_behavior_preserving");
    }

    expect(executor.runs.length).toBe(0);
  });

  test("[R2: R2-3] inherited unparseable spec blocks the affirmation via parse (i), not via any ground-truth read", async () => {
    const brokenStart = { openapi_json: "{ broken", conventions_md: START_SPEC.conventions_md };
    const gate = new E4ArmHTaskGate({
      opportunity_labels: ["behavior_preserving"],
      task_start_spec: brokenStart,
      tests: { delta: [], cumulative: CUMULATIVE, prior_cumulative: PRIOR },
      runExecutor: fakeExecutor({}).run
    });
    gate.recordSmokeInvocation();
    const result = await gate.attemptSpecExit(brokenStart);

    expect(result.outcome).toBe("custody_failed");

    if (result.outcome === "custody_failed") {
      expect(result.feedback).toContain("parse");
    }
  });
});

describe("Feature 3 — arms 0 and M never gate", () => {
  test("gate machinery is an arm-H-only declared channel", () => {
    expect(E4_ARM_POLICIES.e4_arm_0.gate_enabled).toBe(false);
    expect(E4_ARM_POLICIES.e4_arm_m.gate_enabled).toBe(false);
    expect(E4_ARM_POLICIES.e4_arm_h.gate_enabled).toBe(true);
    expect(E4_ARM_POLICIES.e4_arm_0.feedback.acceptance_oracle).toBe(false);
    expect(E4_ARM_POLICIES.e4_arm_m.feedback.acceptance_oracle).toBe(false);
  });
});

describe("[R2: R2-3] the gate consults no meter or ground-truth state (testable property of gate.ts)", () => {
  const source = readFileSync(join(repoRoot, "src", "e4", "gate.ts"), "utf8");
  const importSpecifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);

  test("gate.ts never imports the meter, the ground-truth IR, or the substrate provider", () => {
    for (const specifier of importSpecifiers) {
      expect(specifier).not.toContain("meter");
      expect(specifier).not.toContain("substrate/ir");
      expect(specifier).not.toContain("substrate/provider");
      expect(specifier).not.toContain("substrate/draw");
      expect(specifier).not.toContain("substrate/ops");
    }
  });

  test("gate.ts imports are exactly the sequencing surface (types, manifest types, test shapes, executor result shapes)", () => {
    const allowed = new Set(["node:path", "./types", "./manifest", "./substrate/testgen", "./oracle-executor"]);

    for (const specifier of importSpecifiers) {
      expect(allowed.has(specifier)).toBe(true);
    }
  });

  test("gate.ts never references ground-truth or meter types by name", () => {
    expect(source).not.toContain("E4SchemaIR");
    expect(source).not.toContain("E4DriftReport");
    expect(source).not.toContain("ground_truth_ir");
  });

  test("the conventions grammar check is gate-local and matches the ADR-004 grammar", () => {
    expect(e4ConventionsGrammarOk("- `error-format`: Errors are JSON.\n")).toBe(true);
    expect(e4ConventionsGrammarOk("prose\n\n- `a-rule`: statement\n- plain prose bullet is fine\n")).toBe(true);
    expect(e4ConventionsGrammarOk("- `broken` missing colon\n")).toBe(false);
    expect(e4ConventionsGrammarOk("no bullets at all\n")).toBe(false);
  });
});
