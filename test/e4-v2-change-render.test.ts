// v2-M3 support: the §5.5 pair-derivation rendered as REAL OpenSpec change directories, and the
// pinned CLI's archive semantics characterized live against those rendered changes (the
// characterization discipline: empirical CLI facts the design leans on are pinned by test —
// MODIFIED-replace, REMOVED+ADDED retirement via the tombstone, new-capability creation, and
// the empty-rebuild whole-archive abort that FORCES the tombstone to exist).
import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { buildBaselineIr, createUidMinter } from "../src/e4/substrate/ir";
import { createSequenceState } from "../src/e4/substrate/ops";
import { E4_OPS_V2 } from "../src/e4/substrate/v2/ops";
import { renderE4V2ChangeFiles } from "../src/e4/v2/change-render";
import { allScenarioRefs, deriveSpecOfRecord } from "../src/e4/v2/gold-spec";
import { canonicalScenarioBody } from "../src/e4/v2/scenario";
import { bindSpecOfRecordScenarios, runE4OpenSpecArchiveStep, runE4OpenSpecValidateChange } from "../src/e4/v2/openspec";
import { buildE4V2WorkspaceFiles } from "../src/e4/v2/workspace";
import { readOpenSpecSpecOfRecord } from "../src/e1-openspec-harness";
import { indexQueuePrng } from "./support/e4-v2-helpers";

const REPO_ROOT = resolve(import.meta.dir, "..");

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

async function writeFiles(dir: string, files: Record<string, string>): Promise<void> {
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), contents);
  }
}

async function t0WorkspaceOnDisk(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "e4-v2-change-"));
  tempRoots.push(dir);
  await writeFiles(dir, buildE4V2WorkspaceFiles(buildBaselineIr()));
  return dir;
}

describe("v2-M3 — §5.5 pair-derivation rendered as OpenSpec change files", () => {
  test("modify_convention renders MODIFIED-only deltas for both touched capabilities", () => {
    const baseline = buildBaselineIr();
    const t0Spec = deriveSpecOfRecord(baseline, null);
    const flipped = E4_OPS_V2.modify_convention.apply(baseline, createUidMinter(), indexQueuePrng([0]), createSequenceState());
    const change = renderE4V2ChangeFiles({
      changeName: "task-1-convention",
      postIr: flipped.ir,
      priorSpec: t0Spec,
      requestText: "Bring error responses up to the new company-wide convention."
    });

    const paths = Object.keys(change.files).toSorted();
    expect(paths).toEqual([
      "openspec/changes/task-1-convention/proposal.md",
      "openspec/changes/task-1-convention/specs/categories/spec.md",
      "openspec/changes/task-1-convention/specs/widgets/spec.md",
      "openspec/changes/task-1-convention/tasks.md"
    ]);

    const widgetsDelta = change.files["openspec/changes/task-1-convention/specs/widgets/spec.md"];
    expect(widgetsDelta).toContain("## MODIFIED Requirements");
    expect(widgetsDelta).not.toContain("## ADDED Requirements");
    expect(widgetsDelta).not.toContain("## REMOVED Requirements");
    expect(widgetsDelta).toContain('the response field "error.type" equals "validation_error"');
    expect(change.novel_scenario_titles).toContain("Fetching a missing Widget returns not found");
  });

  test("rename_entity renders the retirement tombstone (REMOVED + ADDED) and the new capability (ADDED)", () => {
    const baseline = buildBaselineIr();
    const t0Spec = deriveSpecOfRecord(baseline, null);
    const renamed = E4_OPS_V2.rename_entity.apply(baseline, createUidMinter(), indexQueuePrng([1, 0]), createSequenceState());
    const change = renderE4V2ChangeFiles({
      changeName: "task-1-rename",
      postIr: renamed.ir,
      priorSpec: t0Spec,
      requestText: "Rebrand Widget as Product everywhere it appears to customers."
    });

    const widgetsDelta = change.files["openspec/changes/task-1-rename/specs/widgets/spec.md"];
    expect(widgetsDelta).toContain("## ADDED Requirements");
    expect(widgetsDelta).toContain("### Requirement: Retired widgets endpoints");
    expect(widgetsDelta).toContain("The service SHALL NOT serve the retired /widgets endpoints.");
    expect(widgetsDelta).toContain("## REMOVED Requirements");
    expect(widgetsDelta).toContain("### Requirement: Creating a Widget");

    const productsDelta = change.files["openspec/changes/task-1-rename/specs/products/spec.md"];
    expect(productsDelta).toContain("## ADDED Requirements");
    expect(productsDelta).toContain("### Requirement: Creating a Product");
    expect(productsDelta).not.toContain("## REMOVED Requirements");

    // Categories are untouched by the rename — no delta file is rendered for them.
    expect(change.files["openspec/changes/task-1-rename/specs/categories/spec.md"]).toBeUndefined();
  });
});

describe("v2-M3 — pinned CLI archive characterization over rendered changes", () => {
  test("a MODIFIED-only change validates, archives, and the merged record equals the derived model's scenario set", async () => {
    const baseline = buildBaselineIr();
    const t0Spec = deriveSpecOfRecord(baseline, null);
    const flipped = E4_OPS_V2.modify_convention.apply(baseline, createUidMinter(), indexQueuePrng([0]), createSequenceState());
    const dir = await t0WorkspaceOnDisk();
    const change = renderE4V2ChangeFiles({
      changeName: "task-1-convention",
      postIr: flipped.ir,
      priorSpec: t0Spec,
      requestText: "Bring error responses up to the new company-wide convention."
    });
    await writeFiles(dir, change.files);

    const validation = await runE4OpenSpecValidateChange({ repoRoot: REPO_ROOT, workspacePath: dir, changeName: "task-1-convention" });
    expect(validation.exit_code).toBe(0);

    const record = await runE4OpenSpecArchiveStep({ repoRoot: REPO_ROOT, workspacePath: dir, changeName: "task-1-convention" });
    expect(record.archive_ok).toBe(true);

    const mergedScenarios = bindSpecOfRecordScenarios(await readOpenSpecSpecOfRecord(dir));
    const modelScenarios = allScenarioRefs(deriveSpecOfRecord(flipped.ir, t0Spec)).map((ref) => ref.scenario);

    expect(new Set(mergedScenarios.map(canonicalScenarioBody))).toEqual(new Set(modelScenarios.map(canonicalScenarioBody)));
  }, 60_000);

  test("the rename tombstone change archives: REMOVED+ADDED rebuilds widgets to the tombstone and mints products", async () => {
    const baseline = buildBaselineIr();
    const t0Spec = deriveSpecOfRecord(baseline, null);
    const renamed = E4_OPS_V2.rename_entity.apply(baseline, createUidMinter(), indexQueuePrng([1, 0]), createSequenceState());
    const dir = await t0WorkspaceOnDisk();
    const change = renderE4V2ChangeFiles({
      changeName: "task-1-rename",
      postIr: renamed.ir,
      priorSpec: t0Spec,
      requestText: "Rebrand Widget as Product."
    });
    await writeFiles(dir, change.files);

    const record = await runE4OpenSpecArchiveStep({ repoRoot: REPO_ROOT, workspacePath: dir, changeName: "task-1-rename" });
    expect(record.archive_ok).toBe(true);

    const merged = await readOpenSpecSpecOfRecord(dir);
    expect(Object.keys(merged).toSorted()).toEqual(["categories", "products", "widgets"]);
    expect(merged.widgets).toContain("### Requirement: Retired widgets endpoints");
    expect(merged.widgets).not.toContain("Creating a Widget returns the stored entity");
    expect(merged.products).toContain("#### Scenario: Creating a Product returns the stored entity");

    // The merged scenario SET matches the §5.5 derived model (purposes may differ — the archive
    // keeps the pre-existing Purpose text; scenarios are the semantic content the gate and meter
    // read).
    const mergedScenarios = bindSpecOfRecordScenarios(merged);
    const modelScenarios = allScenarioRefs(deriveSpecOfRecord(renamed.ir, t0Spec)).map((ref) => ref.scenario);
    expect(new Set(mergedScenarios.map(canonicalScenarioBody))).toEqual(new Set(modelScenarios.map(canonicalScenarioBody)));
  }, 60_000);

  test("PINNED CLI FACT: a change that would rebuild a capability to zero requirements aborts the WHOLE archive with exit 0", async () => {
    const dir = await t0WorkspaceOnDisk();
    const baseline = buildBaselineIr();
    const t0Spec = deriveSpecOfRecord(baseline, null);
    const widgets = t0Spec.capabilities.find((capability) => capability.name === "widgets")!;
    const removeAll = [
      "## REMOVED Requirements",
      "",
      ...widgets.requirements.flatMap((requirement) => [`### Requirement: ${requirement.title}`, "**Reason**: Retired.", ""])
    ].join("\n");

    await writeFiles(dir, {
      "openspec/changes/remove-all/proposal.md": "## Why\nRetire widgets.\n\n## What Changes\n- Remove widget requirements.\n",
      "openspec/changes/remove-all/tasks.md": "## 1. Implementation\n- [x] 1.1 Remove.\n",
      "openspec/changes/remove-all/specs/widgets/spec.md": removeAll
    });

    const record = await runE4OpenSpecArchiveStep({ repoRoot: REPO_ROOT, workspacePath: dir, changeName: "remove-all" });

    expect(record.archive_ok).toBe(false);
    expect(record.exit_code).toBe(0); // the exit-0 abort quirk class — never trust exit codes alone
    const untouched = await readOpenSpecSpecOfRecord(dir);
    expect(untouched.widgets).toContain("Creating a Widget returns the stored entity");
  }, 60_000);
});
