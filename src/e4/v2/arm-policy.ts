// v2 arm policies + runtime parity validator (E4V2 design §2: TWO arms, operator decision — the
// instruction arm is dropped as observed inert). Arms are policy objects, not branches; the only
// declared delta is the EXECUTED arm's scenario-execution channel (gate red/green + the gate
// protocol text). The workflow itself — phases, custody, archive — is shared task environment
// and appears in NO policy delta.
import type { E4Budgets } from "../types";
import type { E4V2ArmId } from "./constants";
import type { E4V2ArmMode } from "./gate";

export interface E4V2ArmPolicy {
  readonly arm: E4V2ArmId;
  readonly arm_mode: E4V2ArmMode;
  readonly feedback: {
    smoke: true; // both arms, always
    scenario_execution: boolean; // executed arm only: red-check + done-claim verdicts as feedback
  };
}

export const E4_V2_ARM_POLICIES: Record<E4V2ArmId, E4V2ArmPolicy> = {
  e4_arm_0: { arm: "e4_arm_0", arm_mode: "prose", feedback: { smoke: true, scenario_execution: false } },
  e4_arm_h: { arm: "e4_arm_h", arm_mode: "executed", feedback: { smoke: true, scenario_execution: true } }
};

export type E4V2ArmRuntime = {
  arm: E4V2ArmId;
  pairing_label: string;
  task_text: string;
  budgets: E4Budgets;
  retry_policy: string;
  system_prompt_base: string; // must be byte-identical across arms
  execution_channel: string | null; // executed arm only
};

export class E4V2ArmParityError extends Error {
  constructor(message: string) {
    super(`[e4-v2-arm-parity] ${message}`);
    this.name = "E4V2ArmParityError";
  }
}

const REQUIRED_ARMS: readonly E4V2ArmId[] = ["e4_arm_0", "e4_arm_h"];

// The validateE1RuntimeArmParity / validateE4RuntimeArmParity precedent, at v2's two-arm shape:
// identical task text, budgets, retry policy, and base prompt; the execution channel is the one
// allowlisted delta and belongs to the executed arm only.
export function validateE4V2RuntimeArmParity(runtime: E4V2ArmRuntime[]): void {
  if (runtime.length !== REQUIRED_ARMS.length) {
    throw new E4V2ArmParityError(`expected exactly ${REQUIRED_ARMS.length} arm runtimes, got ${runtime.length}`);
  }

  for (const expected of REQUIRED_ARMS) {
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
    const channelAllowed = entry.arm === "e4_arm_h";

    if (channelAllowed && (entry.execution_channel === null || entry.execution_channel.length === 0)) {
      throw new E4V2ArmParityError("e4_arm_h must carry a non-empty execution channel");
    }

    if (!channelAllowed && entry.execution_channel !== null) {
      throw new E4V2ArmParityError(`${entry.arm} must not carry an execution channel (executed-arm-only delta)`);
    }
  }
}
