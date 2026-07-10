// v2 arm policies + runtime parity validator (E4V2 design §2: TWO arms, operator decision — the
// instruction arm is dropped as observed inert). Arms are policy objects, not branches; the only
// declared delta is an EXECUTED arm's scenario-execution channel (gate red/green + the gate
// protocol text). The workflow itself — phases, custody, archive — is shared task environment
// and appears in NO policy delta.
//
// v3-M3 (E4V3-PRODUCT-LOOP-PROPOSAL.md §2/§3) adds the product arm e4_arm_p: executed mode plus
// the product-gate feedback channel (reconciliation + agent-side mutation + PM spec review).
// v2 callers are unchanged — the validator still defaults to the two-arm shape.
import type { E4Budgets } from "../types";
import type { E4V2ArmId } from "./constants";
import type { E4V2ArmMode } from "./gate";

export interface E4V2ArmPolicy {
  readonly arm: E4V2ArmId;
  readonly arm_mode: E4V2ArmMode;
  readonly feedback: {
    smoke: true; // all arms, always
    scenario_execution: boolean; // executed arms: red-check + done-claim verdicts as feedback
    product_gate?: boolean; // v3 product arm only; absent/false for the v2 arms
  };
}

export const E4_V2_ARM_POLICIES: Record<E4V2ArmId, E4V2ArmPolicy> = {
  e4_arm_0: { arm: "e4_arm_0", arm_mode: "prose", feedback: { smoke: true, scenario_execution: false } },
  e4_arm_h: { arm: "e4_arm_h", arm_mode: "executed", feedback: { smoke: true, scenario_execution: true } },
  e4_arm_p: {
    arm: "e4_arm_p",
    arm_mode: "executed",
    feedback: { smoke: true, scenario_execution: true, product_gate: true }
  }
};

export type E4V2ArmRuntime = {
  arm: E4V2ArmId;
  pairing_label: string;
  task_text: string;
  budgets: E4Budgets;
  retry_policy: string;
  system_prompt_base: string; // must be byte-identical across arms
  execution_channel: string | null; // executed-mode arms only
};

export class E4V2ArmParityError extends Error {
  constructor(message: string) {
    super(`[e4-v2-arm-parity] ${message}`);
    this.name = "E4V2ArmParityError";
  }
}

const REQUIRED_ARMS: readonly E4V2ArmId[] = ["e4_arm_0", "e4_arm_h"];

// The validateE1RuntimeArmParity / validateE4RuntimeArmParity precedent: identical task text,
// budgets, retry policy, and base prompt; execution channels are the allowlisted per-arm delta
// and belong to executed-mode arms only (the product arm's channel additionally carries the
// product-gate protocol, which is why channels are compared per policy, not for equality).
// Defaults to the v2 two-arm shape; the v3 orchestrator passes its three-arm set.
export function validateE4V2RuntimeArmParity(
  runtime: E4V2ArmRuntime[],
  requiredArms: readonly E4V2ArmId[] = REQUIRED_ARMS
): void {
  if (runtime.length !== requiredArms.length) {
    throw new E4V2ArmParityError(`expected exactly ${requiredArms.length} arm runtimes, got ${runtime.length}`);
  }

  for (const expected of requiredArms) {
    if (!runtime.some((entry) => entry.arm === expected)) {
      throw new E4V2ArmParityError(`missing arm runtime for ${expected}`);
    }
  }

  if (new Set(runtime.map((entry) => entry.pairing_label)).size !== 1) {
    throw new E4V2ArmParityError("all arm runtimes must share one pairing_label");
  }

  const [first, ...rest] = runtime;

  for (const other of rest) {
    if (other.task_text !== first.task_text) {
      throw new E4V2ArmParityError(`task_text delta between ${first.arm} and ${other.arm}`);
    }

    if (JSON.stringify(other.budgets) !== JSON.stringify(first.budgets)) {
      throw new E4V2ArmParityError(`budgets delta between ${first.arm} and ${other.arm}`);
    }

    if (other.retry_policy !== first.retry_policy) {
      throw new E4V2ArmParityError(`retry_policy delta between ${first.arm} and ${other.arm}`);
    }

    if (other.system_prompt_base !== first.system_prompt_base) {
      throw new E4V2ArmParityError(`system prompt base delta between ${first.arm} and ${other.arm}`);
    }
  }

  for (const entry of runtime) {
    const channelAllowed = E4_V2_ARM_POLICIES[entry.arm].arm_mode === "executed";

    if (channelAllowed && (entry.execution_channel === null || entry.execution_channel.length === 0)) {
      throw new E4V2ArmParityError(`${entry.arm} must carry a non-empty execution channel`);
    }

    if (!channelAllowed && entry.execution_channel !== null) {
      throw new E4V2ArmParityError(`${entry.arm} must not carry an execution channel (executed-arm-only delta)`);
    }
  }
}
