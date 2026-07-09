// E4-owned OpenSpec wrapper (E4V2 design §4; ADR-007 allowlist extension, operator-approved
// 2026-07-09). The generic pinned-CLI plumbing (`e1-openspec-workflow.ts`) and the workflow
// harness (`e1-openspec-harness.ts`: archive step with exit-0 abort detection, deterministic
// archive-dir rename, scenario parsing/canonicalization, survival ledger) are ALLOWLISTED and
// reused as read-only libraries. The E1-BOUND pieces (`e1-openspec-constants.ts`: E1 profile id,
// E1 base-constants loader, E1 snapshot roots) are NOT imported — this module is the thin
// E4-owned replacement carrying the v2 profile identity; it is lint-enforced
// (test/e4-no-legacy-imports.test.ts forbids e1-openspec-constants for E4 modules).
import { cp, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runOpenSpecCommand, type E1OpenSpecCommandResult } from "../../e1-openspec-workflow";
import { readOpenSpecSpecOfRecord, runE1OpenSpecArchiveStep, type E1OpenSpecArchiveStepRecord } from "../../e1-openspec-harness";
import { parseOpenSpecScenarioBlocks } from "./converter";
import { bindScenario } from "./step-table";
import type { E4V2Scenario } from "./scenario";

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

// Parses + binds every scenario in a spec-of-record file map (capability → spec.md text). A
// binding failure here is fail-loud: custody binds every change scenario in both arms before it
// can reach the record, and T0 is generator-emitted, so an unbindable record scenario means
// harness corruption, not agent behavior.
export function bindSpecOfRecordScenarios(specs: Record<string, string>): E4V2Scenario[] {
  const scenarios: E4V2Scenario[] = [];

  for (const capability of Object.keys(specs).toSorted()) {
    for (const parsed of parseOpenSpecScenarioBlocks(specs[capability])) {
      const bound = bindScenario(parsed);

      if (!bound.ok) {
        throw new Error(
          `spec-of-record scenario failed to bind in capability ${capability}: ${JSON.stringify(bound.violations)}`
        );
      }

      scenarios.push(bound.scenario);
    }
  }

  return scenarios;
}

export type E4V2MergePreview =
  | { ok: true; scenarios: E4V2Scenario[]; specs: Record<string, string> }
  | { ok: false; reason: string };

// The §6.3 cumulative-set semantics WITHOUT re-implementing the CLI's merge: copy the
// workspace's openspec/ tree to a scratch dir, run the REAL archive step there, and read the
// merged spec-of-record back. The scratch copy guarantees the preview can never mutate the live
// workspace; the merge semantics are byte-true to what the task-close archive will do. With no
// change (changeName null — the §3.3 no-change path), the cumulative set is simply the current
// spec-of-record.
export async function previewE4V2MergedScenarios(input: {
  repoRoot: string;
  workspacePath: string;
  changeName: string | null;
  timeoutMs?: number;
}): Promise<E4V2MergePreview> {
  if (input.changeName === null) {
    const specs = await readOpenSpecSpecOfRecord(input.workspacePath);
    return { ok: true, scenarios: bindSpecOfRecordScenarios(specs), specs };
  }

  const scratch = await mkdtemp(join(tmpdir(), "e4-v2-merge-preview-"));

  try {
    await cp(join(input.workspacePath, "openspec"), join(scratch, "openspec"), { recursive: true });

    const record = await runE1OpenSpecArchiveStep({
      repoRoot: input.repoRoot,
      workspacePath: scratch,
      changeName: input.changeName,
      timeoutMs: input.timeoutMs
    });

    if (!record.archive_ok) {
      return { ok: false, reason: record.failure_reason ?? "archive preview failed" };
    }

    const specs = await readOpenSpecSpecOfRecord(scratch);
    return { ok: true, scenarios: bindSpecOfRecordScenarios(specs), specs };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

// Change-directory discovery support: the non-archive change names currently present in a
// workspace's openspec/changes/ tree.
export async function listE4V2ChangeNames(workspacePath: string): Promise<string[]> {
  try {
    const entries = await readdir(join(workspacePath, "openspec", "changes"), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && entry.name !== "archive")
      .map((entry) => entry.name)
      .toSorted();
  } catch {
    return [];
  }
}
