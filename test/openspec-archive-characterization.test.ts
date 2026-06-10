import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  OPENSPEC_PINNED_VERSION,
  assertPinnedOpenSpecVersion,
  normalizeCliOutput,
  runOpenSpecArchive
} from "../src/e1-openspec-workflow";

const REPO_ROOT = resolve(import.meta.dir, "..");

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

// Characterization tests pin the exact behavior of the pinned @fission-ai/openspec CLI that the
// e1-openspec-workflow-v0 profile depends on. If a version bump changes any of this, these tests
// are the tripwire: the profile constants must be re-sealed before any further OpenSpec-profile run.
describe("openspec archive characterization (pinned CLI)", () => {
  test("the installed package matches the pinned exact version", async () => {
    await assertPinnedOpenSpecVersion(REPO_ROOT);

    const repoPackage = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf8")) as {
      devDependencies?: Record<string, string>;
    };

    expect(repoPackage.devDependencies?.["@fission-ai/openspec"]).toBe(OPENSPEC_PINNED_VERSION);
  });

  test("the pinned CLI still ships the documented telemetry opt-out", async () => {
    const telemetrySource = await readFile(
      join(REPO_ROOT, "node_modules", "@fission-ai", "openspec", "dist", "telemetry", "index.js"),
      "utf8"
    );

    expect(telemetrySource).toContain("OPENSPEC_TELEMETRY");
    expect(telemetrySource).toContain("DO_NOT_TRACK");
    expect(telemetrySource).toContain("posthog");
  });

  test("MODIFIED replaces the whole requirement block and silently drops omitted scenarios", async () => {
    const workspace = await setupArchiveFixture({ modifiedDelta: MODIFIED_DELTA_DROPPING_SCENARIO });

    const result = await runOpenSpecArchive({
      repoRoot: REPO_ROOT,
      workspacePath: workspace,
      changeName: "drop-scenario"
    });

    expect(result.exit_code).toBe(0);
    expect(result.openspec_version).toBe("1.4.1");

    const updatedSpec = await readFile(join(workspace, "openspec", "specs", "cart", "spec.md"), "utf8");

    expect(updatedSpec).toContain("#### Scenario: Line subtotal");
    // The honest prose-regression surface: the requirement previously committed to a discount cap
    // scenario; the MODIFIED block omitted it, and the archive dropped it without any warning.
    expect(updatedSpec).not.toContain("Discount cap");
    expect(result.normalized_stdout).not.toContain("Discount cap");

    const archiveEntries = await readdir(join(workspace, "openspec", "changes", "archive"));

    expect(archiveEntries).toHaveLength(1);
    expect(archiveEntries[0]).toEndWith("-drop-scenario");
  });

  test("MODIFIED against a missing requirement aborts without changes — but still exits 0", async () => {
    const workspace = await setupArchiveFixture({
      modifiedDelta: [
        "## MODIFIED Requirements",
        "",
        "### Requirement: Nonexistent requirement",
        "The cart SHALL do something never specified before.",
        "",
        "#### Scenario: Phantom",
        "- **GIVEN** nothing",
        "- **WHEN** nothing happens",
        "- **THEN** nothing results"
      ].join("\n")
    });

    const result = await runOpenSpecArchive({
      repoRoot: REPO_ROOT,
      workspacePath: workspace,
      changeName: "drop-scenario"
    });

    // Pinned CLI defect-shaped behavior: the archive aborts ("MODIFIED failed ... not found",
    // "Aborted. No files were changed.") yet the process exits 0. Harness integration must
    // detect archive failure from the output text and the un-archived change directory,
    // never from the exit code alone.
    expect(result.exit_code).toBe(0);
    expect(result.normalized_stdout).toContain("Aborted. No files were changed.");
    expect(result.normalized_stdout).toContain("MODIFIED failed");

    const untouchedSpec = await readFile(join(workspace, "openspec", "specs", "cart", "spec.md"), "utf8");

    expect(untouchedSpec).toContain("Discount cap");

    const changeStillPresent = await readFile(
      join(workspace, "openspec", "changes", "drop-scenario", "proposal.md"),
      "utf8"
    );

    expect(changeStillPresent).toContain("## Why");
  });

  test("archive produces a byte-identical spec-of-record for identical inputs", async () => {
    const first = await setupArchiveFixture({ modifiedDelta: MODIFIED_DELTA_DROPPING_SCENARIO });
    const second = await setupArchiveFixture({ modifiedDelta: MODIFIED_DELTA_DROPPING_SCENARIO });

    await runOpenSpecArchive({ repoRoot: REPO_ROOT, workspacePath: first, changeName: "drop-scenario" });
    await runOpenSpecArchive({ repoRoot: REPO_ROOT, workspacePath: second, changeName: "drop-scenario" });

    const firstSpec = await readFile(join(first, "openspec", "specs", "cart", "spec.md"), "utf8");
    const secondSpec = await readFile(join(second, "openspec", "specs", "cart", "spec.md"), "utf8");

    expect(firstSpec).toBe(secondSpec);
  });

  test("normalizeCliOutput strips ANSI color and OSC sequences but keeps plain brackets", () => {
    expect(normalizeCliOutput("\u001b[32mok\u001b[0m done\r\n")).toBe("ok done");
    expect(normalizeCliOutput("plain [x] brackets survive")).toBe("plain [x] brackets survive");
    expect(normalizeCliOutput("\u001b]0;title\u0007text")).toBe("text");
  });
});

const MODIFIED_DELTA_DROPPING_SCENARIO = [
  "## MODIFIED Requirements",
  "",
  "### Requirement: Cart totals",
  "The cart SHALL compute totals from line items.",
  "",
  "#### Scenario: Line subtotal",
  "- **GIVEN** a line item with unit price 250 cents and quantity 2",
  "- **WHEN** the line subtotal is computed",
  "- **THEN** the result is 500 cents"
].join("\n");

async function setupArchiveFixture(input: { modifiedDelta: string }): Promise<string> {
  const workspace = join(
    tmpdir(),
    `hit-sdd-openspec-char-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  tempRoots.push(workspace);
  await mkdir(join(workspace, "openspec", "specs", "cart"), { recursive: true });
  await mkdir(join(workspace, "openspec", "changes", "drop-scenario", "specs", "cart"), {
    recursive: true
  });

  await writeFile(
    join(workspace, "openspec", "specs", "cart", "spec.md"),
    [
      "# cart Specification",
      "",
      "## Purpose",
      "Cart pricing rules.",
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
      "",
      "#### Scenario: Discount cap",
      "- **GIVEN** a cart discount that exceeds the configured cap",
      "- **WHEN** the discount is computed",
      "- **THEN** the discount equals the cap",
      ""
    ].join("\n")
  );
  await writeFile(
    join(workspace, "openspec", "changes", "drop-scenario", "proposal.md"),
    [
      "## Why",
      "Adjust the cart totals requirement to match the latest merchant policy wording decision.",
      "",
      "## What Changes",
      "- Update cart totals scenario wording."
    ].join("\n")
  );
  await writeFile(
    join(workspace, "openspec", "changes", "drop-scenario", "tasks.md"),
    ["## 1. Implementation", "- [x] 1.1 Update implementation"].join("\n")
  );
  await writeFile(
    join(workspace, "openspec", "changes", "drop-scenario", "specs", "cart", "spec.md"),
    input.modifiedDelta
  );

  return workspace;
}
