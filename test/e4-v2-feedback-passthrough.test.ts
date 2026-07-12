// [Phase-0 learning boundary] The M6 adversarial review found live agents looping on EMPTY
// custody feedback: the pinned CLI prints validation errors to stderr (the harness relayed only
// stdout) and archive-abort teaching hints were collapsed to a fixed string. These tests pin the
// fix: agent-facing detail is never silently empty when the CLI explained itself.
import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { E1OpenSpecCommandResult } from "../src/e1-openspec-workflow";
import {
  composeOpenSpecCliDetail,
  previewE4V2MergedScenarios,
  runE4OpenSpecValidateChange
} from "../src/e4/v2/openspec";

const REPO_ROOT = resolve(import.meta.dir, "..");

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

function cliResult(partial: Partial<E1OpenSpecCommandResult>): E1OpenSpecCommandResult {
  return {
    command: ["validate"],
    exit_code: 1,
    duration_ms: 1,
    normalized_stdout: "",
    normalized_stderr: "",
    stdout_hash: "x",
    stderr_hash: "x",
    openspec_version: "1.4.1",
    ...partial
  } as E1OpenSpecCommandResult;
}

describe("composeOpenSpecCliDetail", () => {
  test("stderr-only errors survive (the M6 empty-feedback bug)", () => {
    const detail = composeOpenSpecCliDetail(
      cliResult({ normalized_stderr: "[ERROR] products/spec.md: No delta sections found.\nAdd headers such as \"## ADDED Requirements\"" })
    );

    expect(detail).toContain("No delta sections found");
    expect(detail).toContain("ADDED Requirements");
  });

  test("stderr comes before stdout and blank lines are dropped", () => {
    const detail = composeOpenSpecCliDetail(
      cliResult({
        normalized_stderr: "error line\n\n",
        normalized_stdout: "\nprogress line\n"
      })
    );

    expect(detail).toBe("error line progress line");
  });

  test("stdout-only output still flows through", () => {
    const detail = composeOpenSpecCliDetail(cliResult({ normalized_stdout: "Aborted. No files were changed." }));

    expect(detail).toBe("Aborted. No files were changed.");
  });

  test("detail is bounded: last 8 stderr + last 4 stdout lines, max 1000 chars front-kept", () => {
    const manyLines = Array.from({ length: 40 }, (_, index) => `line-${index}`).join("\n");
    const bounded = composeOpenSpecCliDetail(cliResult({ normalized_stderr: manyLines }));

    expect(bounded).toBe(Array.from({ length: 8 }, (_, index) => `line-${index + 32}`).join(" "));

    const huge = composeOpenSpecCliDetail(cliResult({ normalized_stderr: `IMPORTANT-ERROR\n${"x".repeat(5000)}` }));

    expect(huge.length).toBeLessThanOrEqual(1000);
    expect(huge).toContain("IMPORTANT-ERROR");
  });

  test("verbose stdout can never crowd out stderr (the audit's mixed-stream case)", () => {
    const detail = composeOpenSpecCliDetail(
      cliResult({
        normalized_stderr: "[ERROR] the one line that matters",
        normalized_stdout: Array.from({ length: 30 }, (_, index) => `progress-${index}`).join("\n")
      })
    );

    expect(detail).toContain("the one line that matters");
    expect(detail.startsWith("[ERROR]")).toBe(true);
    // stdout is budgeted, not dropped
    expect(detail).toContain("progress-29");
    expect(detail).not.toContain("progress-25");
  });
});

describe("live pinned-CLI passthrough (integration)", () => {
  test("a malformed change's validate errors reach the composed detail", async () => {
    const workspace = await makeWorkspace();
    await mkdir(join(workspace, "openspec", "changes", "bad-change", "specs", "cart"), { recursive: true });
    await writeFile(
      join(workspace, "openspec", "changes", "bad-change", "proposal.md"),
      ["## Why", "A malformed change for the feedback passthrough characterization.", "", "## What Changes", "- Nothing valid."].join("\n")
    );
    await writeFile(
      join(workspace, "openspec", "changes", "bad-change", "tasks.md"),
      ["## 1. Implementation", "- [x] 1.1 Nothing"].join("\n")
    );
    // No delta headers at all — the pinned CLI rejects this and explains why (on stderr).
    await writeFile(
      join(workspace, "openspec", "changes", "bad-change", "specs", "cart", "spec.md"),
      "### Requirement: Cart totals\nJust prose, no ADDED/MODIFIED/REMOVED headers.\n"
    );

    const result = await runE4OpenSpecValidateChange({
      repoRoot: REPO_ROOT,
      workspacePath: workspace,
      changeName: "bad-change"
    });

    expect(result.exit_code).not.toBe(0);

    const detail = composeOpenSpecCliDetail(result);

    expect(detail.length).toBeGreaterThan(0);
    // The CLI's own explanation must survive to the agent-facing string.
    expect(detail.toLowerCase()).toContain("delta");
  });

  test("archive-preview failure reason carries the zero-requirements teaching hint", async () => {
    const workspace = await makeWorkspace();
    await mkdir(join(workspace, "openspec", "changes", "retire-cart", "specs", "cart"), { recursive: true });
    await writeFile(
      join(workspace, "openspec", "changes", "retire-cart", "proposal.md"),
      ["## Why", "Retire the cart capability without a tombstone (the abort branch).", "", "## What Changes", "- Remove the cart capability."].join("\n")
    );
    await writeFile(
      join(workspace, "openspec", "changes", "retire-cart", "tasks.md"),
      ["## 1. Implementation", "- [x] 1.1 Remove"].join("\n")
    );
    await writeFile(
      join(workspace, "openspec", "changes", "retire-cart", "specs", "cart", "spec.md"),
      ["## REMOVED Requirements", "", "### Requirement: Cart totals"].join("\n")
    );

    const preview = await previewE4V2MergedScenarios({
      repoRoot: REPO_ROOT,
      workspacePath: workspace,
      changeName: "retire-cart"
    });

    expect(preview.ok).toBe(false);

    if (!preview.ok) {
      // The gate interpolates this reason verbatim into custody feedback
      // (`custody check failed: change "…" is not archivable: ${reason}` — pinned by the
      // existing gate test), so the hint reaching here reaches the agent.
      expect(preview.reason).toContain("archive aborted without changes");
      expect(preview.reason.toLowerCase()).toContain("at least one requirement");
    }
  });
});

async function makeWorkspace(): Promise<string> {
  const workspace = join(tmpdir(), `e4-feedback-passthrough-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(workspace);
  await mkdir(join(workspace, "openspec", "specs", "cart"), { recursive: true });
  await writeFile(
    join(workspace, "openspec", "specs", "cart", "spec.md"),
    [
      "# cart Specification",
      "",
      "## Purpose",
      "Cart pricing rules for the feedback passthrough characterization fixture.",
      "",
      "## Requirements",
      "",
      "### Requirement: Cart totals",
      "The cart SHALL compute totals from line items.",
      "",
      "#### Scenario: Line subtotal",
      "- **GIVEN** a line item with unit price 250 cents and quantity 2",
      "- **WHEN** the line subtotal is computed",
      "- **THEN** the result is 500 cents",
      ""
    ].join("\n")
  );

  return workspace;
}
