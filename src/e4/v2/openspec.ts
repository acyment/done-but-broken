// E4-owned OpenSpec wrapper (E4V2 design §4; ADR-007 allowlist extension, operator-approved
// 2026-07-09). The generic pinned-CLI plumbing (`e1-openspec-workflow.ts`) and the workflow
// harness (`e1-openspec-harness.ts`: archive step with exit-0 abort detection, deterministic
// archive-dir rename, scenario parsing/canonicalization, survival ledger) are ALLOWLISTED and
// reused as read-only libraries. The E1-BOUND pieces (`e1-openspec-constants.ts`: E1 profile id,
// E1 base-constants loader, E1 snapshot roots) are NOT imported — this module is the thin
// E4-owned replacement carrying the v2 profile identity; it is lint-enforced
// (test/e4-no-legacy-imports.test.ts forbids e1-openspec-constants for E4 modules).
import { runOpenSpecCommand, type E1OpenSpecCommandResult } from "../../e1-openspec-workflow";
import { runE1OpenSpecArchiveStep, type E1OpenSpecArchiveStepRecord } from "../../e1-openspec-harness";

export { OPENSPEC_PINNED_VERSION } from "../../e1-openspec-workflow";
export { E1_OPENSPEC_SCENARIO_CANONICALIZER_ID as E4_V2_SCENARIO_CANONICALIZER_ID } from "../../e1-openspec-harness";

// The v2 shared-environment profile id (§2): both arms in the same OpenSpec workspace, the
// harness-run archive step identical in both arms, execution of the spec as the only arm
// difference. Follows the blessed e1-openspec-workflow-v0 shape; seals into the v2 constants
// lineage at the v2-M5 freeze.
export const E4_OPENSPEC_PROFILE_ID = "e4-openspec-workflow-v1" as const;

// The §5.5/v2-M1 structural validation invocation, probed against the pinned CLI 1.4.1: a bare
// openspec/specs tree validates (no project.md needed); --strict turns warnings into failures
// (Purpose ≥50 chars); requirements need SHALL/MUST and ≥1 scenario.
export async function runE4OpenSpecValidateSpecs(input: {
  repoRoot: string;
  workspacePath: string;
  timeoutMs?: number;
}): Promise<E1OpenSpecCommandResult> {
  return runOpenSpecCommand({
    repoRoot: input.repoRoot,
    workspacePath: input.workspacePath,
    args: ["validate", "--specs", "--strict", "--no-interactive"],
    timeoutMs: input.timeoutMs
  });
}

// Validates one change (the gate's custody wiring, v2-M3): deltas parse and the change is
// archivable in shape.
export async function runE4OpenSpecValidateChange(input: {
  repoRoot: string;
  workspacePath: string;
  changeName: string;
  timeoutMs?: number;
}): Promise<E1OpenSpecCommandResult> {
  return runOpenSpecCommand({
    repoRoot: input.repoRoot,
    workspacePath: input.workspacePath,
    args: ["validate", input.changeName, "--strict", "--no-interactive"],
    timeoutMs: input.timeoutMs
  });
}

// The harness-owned task-close archive step, identical in both arms (§4): failure detected from
// output text + change-dir persistence (never the exit code — the pinned CLI exits 0 on abort),
// dated archive dir renamed deterministically, survival ledger recorded.
export async function runE4OpenSpecArchiveStep(input: {
  repoRoot: string;
  workspacePath: string;
  changeName: string;
  timeoutMs?: number;
}): Promise<E1OpenSpecArchiveStepRecord> {
  return runE1OpenSpecArchiveStep(input);
}
