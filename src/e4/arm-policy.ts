// Arm policy objects + runtime parity validator (architecture §2.3; IMPLEMENTATION-PLAN.md M0).
// Arms are policy objects, not branches: everything an arm changes is declared here and nowhere
// else, which is what makes validateE4RuntimeArmParity's allowlist meaningful.
import type { E4ArmId, E4Budgets, E4TaskPhase, E4WorkflowGuards } from "./types";

export interface E4ArmPolicy {
  readonly arm: E4ArmId;
  readonly standing_instruction: string | null; // arm M: the spec-maintenance sentence; 0/H: null
  readonly gate_enabled: boolean; // arm H only (ADR-003 state machine active)
  readonly feedback: {
    smoke: true; // all arms, always (brief §8 — load-bearing)
    acceptance_oracle: boolean; // arm H only
  };
  phaseGuards(phase: E4TaskPhase): E4WorkflowGuards;
}

const NO_RESTRICTIONS: E4WorkflowGuards = { extra_read_only_prefixes: [], extra_protected_directories: [] };

// Arm H's ADR-003 phase writability: spec phase locks code out, implementation phase locks the
// spec out. The paths mirror the substrate's own layout (ADR-001 scaffold + specs/ artifacts).
const ARM_H_SPEC_PHASE_GUARDS: E4WorkflowGuards = {
  extra_read_only_prefixes: ["src/"],
  extra_protected_directories: []
};
const ARM_H_IMPLEMENTATION_PHASE_GUARDS: E4WorkflowGuards = {
  extra_read_only_prefixes: ["specs/"],
  extra_protected_directories: []
};

export function buildE4ArmPolicies(input: { standingInstruction: string }): Record<E4ArmId, E4ArmPolicy> {
  const arm0: E4ArmPolicy = {
    arm: "e4_arm_0",
    standing_instruction: null,
    gate_enabled: false,
    feedback: { smoke: true, acceptance_oracle: false },
    phaseGuards: () => NO_RESTRICTIONS // 0/M: uniform guards, both phases identical
  };

  const armM: E4ArmPolicy = {
    arm: "e4_arm_m",
    standing_instruction: input.standingInstruction,
    gate_enabled: false,
    feedback: { smoke: true, acceptance_oracle: false },
    phaseGuards: () => NO_RESTRICTIONS
  };

  const armH: E4ArmPolicy = {
    arm: "e4_arm_h",
    standing_instruction: null,
    gate_enabled: true,
    feedback: { smoke: true, acceptance_oracle: true },
    phaseGuards: (phase) => (phase === "spec" ? ARM_H_SPEC_PHASE_GUARDS : ARM_H_IMPLEMENTATION_PHASE_GUARDS)
  };

  return { e4_arm_0: arm0, e4_arm_m: armM, e4_arm_h: armH };
}

// Provisional default set: the real arm_m_standing_instruction text seals at M4
// (e4-sealed-constants.protocol_text.arm_m_standing_instruction, [R1-S2]) and supersedes this
// placeholder. Callers that need the frozen text should build policies from sealed constants
// once M4 lands rather than relying on this default.
export const E4_ARM_POLICIES: Record<E4ArmId, E4ArmPolicy> = buildE4ArmPolicies({
  standingInstruction:
    "[provisional — sealed at M4] Keep specs/openapi.json and specs/CONVENTIONS.md in sync with every behavior change you make."
});

export type E4ArmGateChannel = {
  gate_enabled: boolean;
  acceptance_oracle_enabled: boolean;
};

// One arm's declared runtime parameters for one paired draw — the input to the parity check.
// Not a full assembled conversation (that machinery is E1-closed-world and forbidden here);
// E4's parity check compares the declared parameters an ArmPolicy is responsible for.
export type E4ArmRuntime = {
  arm: E4ArmId;
  pairing_label: string;
  task_text: string;
  budgets: E4Budgets;
  retry_policy: string;
  standing_instruction: string | null;
  gate_channel: E4ArmGateChannel | null;
};

export class E4ArmParityError extends Error {
  constructor(message: string) {
    super(`[e4-arm-parity] ${message}`);
    this.name = "E4ArmParityError";
  }
}

const REQUIRED_ARMS: readonly E4ArmId[] = ["e4_arm_0", "e4_arm_m", "e4_arm_h"];

// Following the validateE1RuntimeArmParity precedent (src/e1-no-provider-runner.ts, E1 closed-world
// — never imported here): identical task text, budgets, and retry policy are required; a delta in
// standing_instruction (M) or gate+oracle channel (H) is allowed; any other delta throws.
export function validateE4RuntimeArmParity(runtime: E4ArmRuntime[]): void {
  if (runtime.length !== REQUIRED_ARMS.length) {
    throw new E4ArmParityError(
      `expected exactly ${REQUIRED_ARMS.length} arm runtimes for one pairing_label, got ${runtime.length}`
    );
  }

  const arms = runtime.map((entry) => entry.arm);

  for (const expected of REQUIRED_ARMS) {
    if (!arms.includes(expected)) {
      throw new E4ArmParityError(`missing arm runtime for ${expected}`);
    }
  }

  if (new Set(runtime.map((entry) => entry.pairing_label)).size !== 1) {
    throw new E4ArmParityError("all arm runtimes must share one pairing_label");
  }

  const [first, ...rest] = runtime;

  for (const other of rest) {
    if (other.task_text !== first.task_text) {
      throw new E4ArmParityError(`task_text delta between ${first.arm} and ${other.arm}`);
    }

    if (JSON.stringify(other.budgets) !== JSON.stringify(first.budgets)) {
      throw new E4ArmParityError(`budgets delta between ${first.arm} and ${other.arm}`);
    }

    if (other.retry_policy !== first.retry_policy) {
      throw new E4ArmParityError(`retry_policy delta between ${first.arm} and ${other.arm}`);
    }
  }

  for (const entry of runtime) {
    const standingInstructionAllowed = entry.arm === "e4_arm_m";

    if (standingInstructionAllowed && entry.standing_instruction === null) {
      throw new E4ArmParityError("e4_arm_m must carry a non-null standing_instruction");
    }

    if (!standingInstructionAllowed && entry.standing_instruction !== null) {
      throw new E4ArmParityError(`${entry.arm} must not carry a standing_instruction (arm-M-only channel)`);
    }

    const gateChannelAllowed = entry.arm === "e4_arm_h";

    if (gateChannelAllowed && entry.gate_channel === null) {
      throw new E4ArmParityError("e4_arm_h must carry a non-null gate_channel");
    }

    if (!gateChannelAllowed && entry.gate_channel !== null) {
      throw new E4ArmParityError(`${entry.arm} must not carry a gate_channel (arm-H-only channel)`);
    }
  }
}
