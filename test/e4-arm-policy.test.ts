// M0 acceptance (docs/e4/IMPLEMENTATION-PLAN.md §2 M0): arm parity allows only the declared
// channels; e4_arm_* IDs are unjoinable with E1/E2 vocabularies by construction.
import { describe, expect, test } from "bun:test";
import {
  buildE4ArmPolicies,
  E4_ARM_POLICIES,
  E4ArmParityError,
  type E4ArmRuntime,
  validateE4RuntimeArmParity
} from "../src/e4/arm-policy";

const BUDGETS = { turns_per_task: 10, verifications_per_task: 5, token_budget: 100000, spend_cap_usd: 5 };

function baseRuntime(): E4ArmRuntime[] {
  return [
    {
      arm: "e4_arm_0",
      pairing_label: "pair-1",
      task_text: "Add a /widgets endpoint.",
      budgets: BUDGETS,
      retry_policy: "sealed-v1",
      standing_instruction: null,
      gate_channel: null
    },
    {
      arm: "e4_arm_m",
      pairing_label: "pair-1",
      task_text: "Add a /widgets endpoint.",
      budgets: BUDGETS,
      retry_policy: "sealed-v1",
      standing_instruction: "Keep the spec in sync.",
      gate_channel: null
    },
    {
      arm: "e4_arm_h",
      pairing_label: "pair-1",
      task_text: "Add a /widgets endpoint.",
      budgets: BUDGETS,
      retry_policy: "sealed-v1",
      standing_instruction: null,
      gate_channel: { gate_enabled: true, acceptance_oracle_enabled: true }
    }
  ];
}

describe("Arm parity allows only the declared channels", () => {
  test("identical task text, budgets, and retry policy across all three arms validates", () => {
    expect(() => validateE4RuntimeArmParity(baseRuntime())).not.toThrow();
  });

  test("a delta in standing_instruction (M) is allowed", () => {
    const runtime = baseRuntime();
    runtime[1].standing_instruction = "A different, still arm-M-only sentence.";

    expect(() => validateE4RuntimeArmParity(runtime)).not.toThrow();
  });

  test("a delta in the gate+oracle channel (H) is allowed", () => {
    const runtime = baseRuntime();
    runtime[2].gate_channel = { gate_enabled: true, acceptance_oracle_enabled: false };

    expect(() => validateE4RuntimeArmParity(runtime)).not.toThrow();
  });

  test("a task_text delta throws", () => {
    const runtime = baseRuntime();
    runtime[1].task_text = "A different task entirely.";

    expect(() => validateE4RuntimeArmParity(runtime)).toThrow(/task_text delta/);
  });

  test("a budgets delta throws", () => {
    const runtime = baseRuntime();
    runtime[2].budgets = { ...BUDGETS, token_budget: 999 };

    expect(() => validateE4RuntimeArmParity(runtime)).toThrow(/budgets delta/);
  });

  test("a retry_policy delta throws", () => {
    const runtime = baseRuntime();
    runtime[0].retry_policy = "unsealed-v2";

    expect(() => validateE4RuntimeArmParity(runtime)).toThrow(/retry_policy delta/);
  });

  test("standing_instruction leaking onto arm 0 throws (any other delta)", () => {
    const runtime = baseRuntime();
    runtime[0].standing_instruction = "arm 0 should never have this";

    expect(() => validateE4RuntimeArmParity(runtime)).toThrow(E4ArmParityError);
    expect(() => validateE4RuntimeArmParity(runtime)).toThrow(/must not carry a standing_instruction/);
  });

  test("gate_channel leaking onto arm M throws (any other delta)", () => {
    const runtime = baseRuntime();
    runtime[1].gate_channel = { gate_enabled: true, acceptance_oracle_enabled: true };

    expect(() => validateE4RuntimeArmParity(runtime)).toThrow(/must not carry a gate_channel/);
  });

  test("arm M missing its standing_instruction throws", () => {
    const runtime = baseRuntime();
    runtime[1].standing_instruction = null;

    expect(() => validateE4RuntimeArmParity(runtime)).toThrow(/must carry a non-null standing_instruction/);
  });

  test("arm H missing its gate_channel throws", () => {
    const runtime = baseRuntime();
    runtime[2].gate_channel = null;

    expect(() => validateE4RuntimeArmParity(runtime)).toThrow(/must carry a non-null gate_channel/);
  });

  test("a duplicate arm for one pairing_label throws", () => {
    const runtime = baseRuntime();
    runtime[1] = { ...runtime[0] };

    // Duplicating arm 0 in place of arm M both loses a required arm and creates a duplicate;
    // the missing-required-arm check fires first (a more specific, more actionable message).
    expect(() => validateE4RuntimeArmParity(runtime)).toThrow(/missing arm runtime for e4_arm_m/);
  });

  test("a genuine duplicate (all three arms present once, plus a fourth entry) throws", () => {
    const runtime = [...baseRuntime(), { ...baseRuntime()[0] }];

    expect(() => validateE4RuntimeArmParity(runtime)).toThrow(/expected exactly 3/);
  });

  test("mismatched pairing_label across arms throws", () => {
    const runtime = baseRuntime();
    runtime[2].pairing_label = "pair-2";

    expect(() => validateE4RuntimeArmParity(runtime)).toThrow(/must share one pairing_label/);
  });

  test("fewer or more than three runtimes throws", () => {
    expect(() => validateE4RuntimeArmParity(baseRuntime().slice(0, 2))).toThrow(/expected exactly 3/);
  });
});

describe("Arm policy objects (architecture §2.3)", () => {
  test("arm 0 and arm M never gate and always run smoke feedback", () => {
    expect(E4_ARM_POLICIES.e4_arm_0.gate_enabled).toBe(false);
    expect(E4_ARM_POLICIES.e4_arm_m.gate_enabled).toBe(false);
    expect(E4_ARM_POLICIES.e4_arm_0.feedback.smoke).toBe(true);
    expect(E4_ARM_POLICIES.e4_arm_m.feedback.smoke).toBe(true);
    expect(E4_ARM_POLICIES.e4_arm_0.feedback.acceptance_oracle).toBe(false);
    expect(E4_ARM_POLICIES.e4_arm_m.feedback.acceptance_oracle).toBe(false);
  });

  test("only arm H gates and receives acceptance-oracle feedback", () => {
    expect(E4_ARM_POLICIES.e4_arm_h.gate_enabled).toBe(true);
    expect(E4_ARM_POLICIES.e4_arm_h.feedback.acceptance_oracle).toBe(true);
  });

  test("only arm M carries a standing_instruction", () => {
    expect(E4_ARM_POLICIES.e4_arm_0.standing_instruction).toBeNull();
    expect(E4_ARM_POLICIES.e4_arm_h.standing_instruction).toBeNull();
    expect(E4_ARM_POLICIES.e4_arm_m.standing_instruction).not.toBeNull();
  });

  test("arm 0 and arm M have uniform phase guards, identical across both phases", () => {
    expect(E4_ARM_POLICIES.e4_arm_0.phaseGuards("spec")).toEqual(E4_ARM_POLICIES.e4_arm_0.phaseGuards("implementation"));
    expect(E4_ARM_POLICIES.e4_arm_m.phaseGuards("spec")).toEqual(E4_ARM_POLICIES.e4_arm_m.phaseGuards("implementation"));
  });

  test("arm H's phase guards differ: spec phase locks code, implementation phase locks the spec", () => {
    const specGuards = E4_ARM_POLICIES.e4_arm_h.phaseGuards("spec");
    const implGuards = E4_ARM_POLICIES.e4_arm_h.phaseGuards("implementation");

    expect(specGuards).not.toEqual(implGuards);
    expect(specGuards.extra_read_only_prefixes).toContain("src/");
    expect(implGuards.extra_read_only_prefixes).toContain("specs/");
  });

  test("buildE4ArmPolicies threads the given standing instruction verbatim into arm M", () => {
    const policies = buildE4ArmPolicies({ standingInstruction: "a distinctly different sentence" });

    expect(policies.e4_arm_m.standing_instruction).toBe("a distinctly different sentence");
  });
});

describe("e4_arm_* IDs are unjoinable with E1/E2 vocabularies", () => {
  test("no e4_arm_* id equals any E1/E2 condition id, by construction", () => {
    const e1E2ConditionIds = ["context_only_spec", "feedback_capable_spec"];
    const e4ArmIds = Object.keys(E4_ARM_POLICIES);

    for (const id of e4ArmIds) {
      expect(e1E2ConditionIds).not.toContain(id);
      expect(id.startsWith("e4_arm_")).toBe(true);
    }
  });
});
