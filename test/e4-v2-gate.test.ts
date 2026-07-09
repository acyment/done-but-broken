// v2-M3 ACCEPTANCE (E4V2 design §6 as amended): the v2 task gate — custody floors (arm-uniform),
// change-level discriminating red with the pinned novelty-under-MODIFIED canonicalizer semantics
// (≥1 novel, ≥1 red, all-green refusal, green_novel recorded, NO zero-novel custody shape),
// cumulative green on the done-claim via real archive-merge semantics, openspec validate wired
// live, red failure-mode capture, and the shared workflow write guards. Everything below runs
// against REAL temp workspaces, the REAL pinned CLI, and the REAL hermetic scenario executor.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { buildBaselineIr, createUidMinter, type E4SchemaIR } from "../src/e4/substrate/ir";
import { createSequenceState } from "../src/e4/substrate/ops";
import { E4_OPS_V2 } from "../src/e4/substrate/v2/ops";
import { buildE4V2AppFiles } from "../src/e4/substrate/v2/scaffold";
import { renderE4V2ChangeFiles } from "../src/e4/v2/change-render";
import { E4V2TaskGate, extractChangeDeltaScenarios, type E4V2ArmMode } from "../src/e4/v2/gate";
import { deriveSpecOfRecord } from "../src/e4/v2/gold-spec";
import { previewE4V2MergedScenarios, runE4OpenSpecValidateChange } from "../src/e4/v2/openspec";
import { runE4V2ScenarioSet } from "../src/e4/v2/scenario-executor";
import { buildE4V2WorkspaceFiles } from "../src/e4/v2/workspace";
import type { E4ExecutorConfig } from "../src/e4/oracle-executor";
import type { E4OpportunityLabel } from "../src/e4/types";
import { indexQueuePrng } from "./support/e4-v2-helpers";

const REPO_ROOT = resolve(import.meta.dir, "..");
const EXEC_CONFIG: E4ExecutorConfig = {
  readiness_timeout_ms: 15_000,
  request_timeout_ms: 3_000,
  readiness_poll_interval_ms: 25
};

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

async function readOpenSpecTree(dir: string): Promise<Record<string, string>> {
  const tree: Record<string, string> = {};
  const root = join(dir, "openspec");

  let entries: string[];
  try {
    entries = (await readdir(root, { recursive: true })) as string[];
  } catch {
    return tree;
  }

  for (const entry of entries) {
    const full = join(root, entry);
    try {
      tree[`openspec/${entry.replaceAll("\\", "/")}`] = await readFile(full, "utf8");
    } catch {
      // directory entry
    }
  }

  return tree;
}

type GateHarness = {
  dir: string;
  gate: E4V2TaskGate;
  currentTree: () => Promise<Record<string, string>>;
};

async function setUpGate(input: {
  arm_mode: E4V2ArmMode;
  labels?: E4OpportunityLabel[];
}): Promise<GateHarness> {
  const dir = await mkdtemp(join(tmpdir(), "e4-v2-gate-"));
  tempRoots.push(dir);
  await writeFiles(dir, buildE4V2WorkspaceFiles(buildBaselineIr()));

  const gate = new E4V2TaskGate({
    arm_mode: input.arm_mode,
    opportunity_labels: input.labels ?? ["drift_opportunity"],
    task_start_openspec: await readOpenSpecTree(dir),
    validateChange: async (changeName) => {
      const result = await runE4OpenSpecValidateChange({ repoRoot: REPO_ROOT, workspacePath: dir, changeName });
      return { ok: result.exit_code === 0, detail: result.normalized_stdout.split("\n").slice(-3).join(" ") };
    },
    previewMergedScenarios: (changeName) =>
      previewE4V2MergedScenarios({ repoRoot: REPO_ROOT, workspacePath: dir, changeName }),
    runScenarios: (scenarios) =>
      runE4V2ScenarioSet({ workspace_dir: dir, scenarios, config: EXEC_CONFIG, concurrency: 6 })
  });

  return { dir, gate, currentTree: () => readOpenSpecTree(dir) };
}

function conventionFlipFixture() {
  const baseline = buildBaselineIr();
  const t0Spec = deriveSpecOfRecord(baseline, null);
  const flipped = E4_OPS_V2.modify_convention.apply(baseline, createUidMinter(), indexQueuePrng([0]), createSequenceState());
  const change = renderE4V2ChangeFiles({
    changeName: "task-1-convention",
    postIr: flipped.ir,
    priorSpec: t0Spec,
    requestText: "Bring error responses up to the new company-wide convention."
  });

  return { baseline, t0Spec, postIr: flipped.ir, change };
}

const MINIMAL_CHANGE_SCAFFOLD = (name: string): Record<string, string> => ({
  [`openspec/changes/${name}/proposal.md`]: "## Why\nTest change.\n\n## What Changes\n- Test.\n",
  [`openspec/changes/${name}/tasks.md`]: "## 1. Implementation\n- [x] 1.1 Test.\n"
});

describe("v2-M3 — executed arm: custody + change-level red + cumulative green (the diligent flow)", () => {
  test("diligent change advances with a red novel set; done-over-red is refused; done after implementation is accepted", async () => {
    const { postIr, change } = conventionFlipFixture();
    const harness = await setUpGate({ arm_mode: "executed" });
    await writeFiles(harness.dir, change.files);

    const exit = await harness.gate.attemptSpecExit(await harness.currentTree());

    expect(exit.outcome).toBe("advanced");
    if (exit.outcome === "advanced") {
      expect(exit.custody_via).toBe("spec_change");
      expect(exit.change_name).toBe("task-1-convention");
      expect(exit.red_check?.mode).toBe("executed");
      expect(exit.red_check!.novel_total).toBeGreaterThan(0);
      expect(exit.red_check!.novel_red).toBeGreaterThan(0);
      // Every novel scenario in this change flips error-envelope keys — all red, none green.
      expect(exit.red_check!.green_novel_titles).toEqual([]);
      // The pre-implementation reds are assertion-level (routes exist; the envelope is wrong).
      expect(exit.red_check!.novel_records.every((record) => record.pre_implementation === "red")).toBe(true);
      expect(exit.red_check!.novel_records.every((record) => record.failure_mode === "assertion")).toBe(true);
      // Prior spec-of-record + carried set still green pre-implementation (recorded, not gating).
      expect(exit.red_check!.prior_green).toBe(true);
    }

    expect(harness.gate.phase()).toBe("implementation");

    // Done over red: the implementation has not changed — the novel scenarios still fail.
    const premature = await harness.gate.submitDoneClaim();
    expect(premature.outcome).toBe("refused");
    if (premature.outcome === "refused") {
      expect(premature.failing_scenario_titles.length).toBeGreaterThan(0);
      expect(premature.feedback).toContain("done-claim refused");
      expect(premature.scenarios_pass).toBeLessThan(premature.scenarios_total);
    }

    // Implement (the post-op gold app) and claim done again.
    await writeFiles(harness.dir, buildE4V2AppFiles(postIr));
    const accepted = await harness.gate.submitDoneClaim();

    expect(accepted.outcome).toBe("accepted");
    if (accepted.outcome === "accepted") {
      expect(accepted.scenarios_pass).toBe(accepted.scenarios_total);
      expect(accepted.scenarios_total).toBe(17); // the full merged cumulative set
    }

    expect(harness.gate.phase()).toBe("closed");
    const summary = harness.gate.summary();
    expect(summary.custody_failures).toBe(0);
    expect(summary.discriminating_red_refusals).toBe(0);
    expect(summary.refused_done_over_red).toBe(1);
    expect(summary.red_check?.mode).toBe("executed");
  }, 120_000);

  test("the rename/tombstone flow: REMOVED+ADDED change advances (route-absent reds) and closes green on the post-op gold", async () => {
    const baseline = buildBaselineIr();
    const t0Spec = deriveSpecOfRecord(baseline, null);
    const renamed = E4_OPS_V2.rename_entity.apply(baseline, createUidMinter(), indexQueuePrng([1, 0]), createSequenceState());
    const change = renderE4V2ChangeFiles({
      changeName: "task-1-rename",
      postIr: renamed.ir,
      priorSpec: t0Spec,
      requestText: "Rebrand Widget as Product."
    });
    const harness = await setUpGate({ arm_mode: "executed" });
    await writeFiles(harness.dir, change.files);

    const exit = await harness.gate.attemptSpecExit(await harness.currentTree());

    expect(exit.outcome).toBe("advanced");
    if (exit.outcome === "advanced") {
      const tombstone = exit.red_check!.novel_records.find((record) =>
        record.title.startsWith("Requests to retired /widgets")
      );
      expect(tombstone?.pre_implementation).toBe("red");
      // Route-absent signature (A10): the new /products surface does not exist yet.
      expect(exit.red_check!.novel_records.some((record) => record.failure_mode === "route_absent")).toBe(true);
    }

    await writeFiles(harness.dir, buildE4V2AppFiles(renamed.ir));
    const accepted = await harness.gate.submitDoneClaim();
    expect(accepted.outcome).toBe("accepted");
  }, 120_000);

  test("green novels are recorded and echoed but do NOT gate when the change also carries a red", async () => {
    const { change } = conventionFlipFixture();
    const harness = await setUpGate({ arm_mode: "executed" });
    // Add a novel-but-green scenario (asserts current behavior with fresh wording) to the delta.
    const widgetsDeltaPath = "openspec/changes/task-1-convention/specs/widgets/spec.md";
    const paddedDelta = `${change.files[widgetsDeltaPath]}\n## ADDED Requirements\n\n### Requirement: Widget seed availability\nThe service SHALL serve the seeded Widget rows.\n\n#### Scenario: The first seeded widget is served\n- **WHEN** I send a GET request to "/widgets/widget-seed-1"\n- **THEN** the response status is 200\n- **AND** the response field "name" equals "Sample name 1"\n`;
    await writeFiles(harness.dir, { ...change.files, [widgetsDeltaPath]: paddedDelta });

    const exit = await harness.gate.attemptSpecExit(await harness.currentTree());

    expect(exit.outcome).toBe("advanced");
    if (exit.outcome === "advanced") {
      expect(exit.red_check!.green_novel_titles).toEqual(["The first seeded widget is served"]);
      expect(exit.red_check!.novel_red).toBeGreaterThan(0);
    }
  }, 120_000);

  test("a change whose novel scenarios are ALL green is refused with the sealed feedback (A2's anti-tautology core)", async () => {
    const harness = await setUpGate({ arm_mode: "executed" });
    await writeFiles(harness.dir, {
      ...MINIMAL_CHANGE_SCAFFOLD("task-1-tautology"),
      "openspec/changes/task-1-tautology/specs/widgets/spec.md": [
        "## ADDED Requirements",
        "",
        "### Requirement: Widget seed availability",
        "The service SHALL serve the seeded Widget rows.",
        "",
        "#### Scenario: The first seeded widget is served",
        '- **WHEN** I send a GET request to "/widgets/widget-seed-1"',
        "- **THEN** the response status is 200",
        '- **AND** the response field "name" equals "Sample name 1"',
        ""
      ].join("\n")
    });

    const exit = await harness.gate.attemptSpecExit(await harness.currentTree());

    expect(exit.outcome).toBe("custody_failed");
    if (exit.outcome === "custody_failed") {
      expect(exit.feedback).toContain("adds no scenario that discriminates the requested change");
      expect(exit.feedback).toContain("The first seeded widget is served");
    }
    expect(harness.gate.phase()).toBe("spec");
    expect(harness.gate.summary().discriminating_red_refusals).toBe(1);
  }, 120_000);

  test("a change with ZERO novel scenarios is refused without execution (no zero-novel custody shape)", async () => {
    const harness = await setUpGate({ arm_mode: "executed" });
    // Restate an existing requirement verbatim inside a MODIFIED block: canonical forms already
    // exist in the spec-of-record, so nothing is novel — regardless of block position.
    const t0Widgets = await readFile(join(harness.dir, "openspec", "specs", "widgets", "spec.md"), "utf8");
    const listRequirement = t0Widgets.slice(t0Widgets.indexOf("### Requirement: Listing Widget records"));
    const restated = listRequirement.slice(0, listRequirement.indexOf("### Requirement:", 10) === -1 ? undefined : undefined);

    await writeFiles(harness.dir, {
      ...MINIMAL_CHANGE_SCAFFOLD("task-1-restate"),
      "openspec/changes/task-1-restate/specs/widgets/spec.md": `## MODIFIED Requirements\n\n${restated}`
    });

    const exit = await harness.gate.attemptSpecExit(await harness.currentTree());

    expect(exit.outcome).toBe("custody_failed");
    if (exit.outcome === "custody_failed") {
      expect(exit.feedback).toContain("adds no scenario that discriminates the requested change");
    }
  }, 120_000);
});

describe("v2-M3 — custody failures (arm-uniform floors)", () => {
  test("unchanged tree, multiple changes, missing delta specs, illegal steps, floor violations, unarchivable deltas", async () => {
    const harness = await setUpGate({ arm_mode: "executed" });

    // 1. Unchanged tree.
    const unchanged = await harness.gate.attemptSpecExit(await harness.currentTree());
    expect(unchanged.outcome).toBe("custody_failed");
    if (unchanged.outcome === "custody_failed") {
      expect(unchanged.feedback).toContain("unchanged since task start");
    }

    // 2. Two change directories.
    await writeFiles(harness.dir, { ...MINIMAL_CHANGE_SCAFFOLD("change-a"), ...MINIMAL_CHANGE_SCAFFOLD("change-b") });
    const twoChanges = await harness.gate.attemptSpecExit(await harness.currentTree());
    expect(twoChanges.outcome).toBe("custody_failed");
    if (twoChanges.outcome === "custody_failed") {
      expect(twoChanges.feedback).toContain("exactly one change directory");
    }
    await rm(join(harness.dir, "openspec", "changes", "change-b"), { recursive: true });

    // 3. No delta specs in the change.
    const noDeltas = await harness.gate.attemptSpecExit(await harness.currentTree());
    expect(noDeltas.outcome).toBe("custody_failed");
    if (noDeltas.outcome === "custody_failed") {
      expect(noDeltas.feedback).toContain("no delta specs");
    }

    // 4. Illegal step text — custody quotes the offending line.
    await writeFiles(harness.dir, {
      "openspec/changes/change-a/specs/widgets/spec.md": [
        "## ADDED Requirements",
        "",
        "### Requirement: Poking",
        "The service SHALL be pokeable.",
        "",
        "#### Scenario: Poking the server",
        "- **WHEN** I poke the server",
        "- **THEN** the response status is 200",
        '- **AND** the response field "ok" equals true',
        ""
      ].join("\n")
    });
    const illegalStep = await harness.gate.attemptSpecExit(await harness.currentTree());
    expect(illegalStep.outcome).toBe("custody_failed");
    if (illegalStep.outcome === "custody_failed") {
      expect(illegalStep.feedback).toContain('"I poke the server"');
      expect(illegalStep.feedback).toContain("matches no pattern");
    }

    // 5. A8 floor violation: status-only scenario (no value-binding assertion).
    await writeFiles(harness.dir, {
      "openspec/changes/change-a/specs/widgets/spec.md": [
        "## ADDED Requirements",
        "",
        "### Requirement: Weak assertions",
        "The service SHALL respond.",
        "",
        "#### Scenario: Status only",
        '- **WHEN** I send a GET request to "/widgets"',
        "- **THEN** the response status is 200",
        ""
      ].join("\n")
    });
    const weak = await harness.gate.attemptSpecExit(await harness.currentTree());
    expect(weak.outcome).toBe("custody_failed");
    if (weak.outcome === "custody_failed") {
      expect(weak.feedback).toContain("no value-binding assertion");
    }

    // 6. Unarchivable: MODIFIED against a requirement that does not exist.
    await writeFiles(harness.dir, {
      "openspec/changes/change-a/specs/widgets/spec.md": [
        "## MODIFIED Requirements",
        "",
        "### Requirement: A requirement that never existed",
        "The service SHALL never have specified this.",
        "",
        "#### Scenario: Phantom",
        '- **WHEN** I send a GET request to "/widgets"',
        "- **THEN** the response status is 200",
        '- **AND** the response list has length 2',
        ""
      ].join("\n")
    });
    const unarchivable = await harness.gate.attemptSpecExit(await harness.currentTree());
    expect(unarchivable.outcome).toBe("custody_failed");
    if (unarchivable.outcome === "custody_failed") {
      expect(unarchivable.feedback).toContain("not archivable");
    }

    expect(harness.gate.summary().custody_failures).toBe(6);
    expect(harness.gate.phase()).toBe("spec");
  }, 120_000);

  test("openspec validate is wired live: an ADDED requirement without scenarios fails custody through the CLI", async () => {
    const harness = await setUpGate({ arm_mode: "executed" });
    await writeFiles(harness.dir, {
      ...MINIMAL_CHANGE_SCAFFOLD("task-1-noscenario"),
      "openspec/changes/task-1-noscenario/specs/widgets/spec.md": [
        "## ADDED Requirements",
        "",
        "### Requirement: Scenarioless",
        "The service SHALL have this scenarioless requirement.",
        ""
      ].join("\n")
    });

    const exit = await harness.gate.attemptSpecExit(await harness.currentTree());

    expect(exit.outcome).toBe("custody_failed");
    if (exit.outcome === "custody_failed") {
      // Both the local scenario floor and the CLI would refuse this; the local check fires first
      // with the change-level "no scenarios" custody reason.
      expect(exit.feedback).toContain("custody check failed");
    }
  }, 120_000);
});

describe("v2-M3 — behavior-preserving affirmation (§3.3, both arms)", () => {
  test("byte-unchanged + smoke ≥1 advances via affirmation; the smoke-less attempt is refused; done closes green", async () => {
    const harness = await setUpGate({ arm_mode: "executed", labels: ["behavior_preserving"] });

    const withoutSmoke = await harness.gate.attemptSpecExit(await harness.currentTree());
    expect(withoutSmoke.outcome).toBe("custody_failed");
    if (withoutSmoke.outcome === "custody_failed") {
      expect(withoutSmoke.feedback).toContain("smoke");
    }

    harness.gate.recordSmokeInvocation();
    const affirmed = await harness.gate.attemptSpecExit(await harness.currentTree());
    expect(affirmed.outcome).toBe("advanced");
    if (affirmed.outcome === "advanced") {
      expect(affirmed.custody_via).toBe("behavior_preserving_affirmation");
      expect(affirmed.change_name).toBeNull();
      expect(affirmed.red_check).toBeNull();
    }

    const done = await harness.gate.submitDoneClaim();
    expect(done.outcome).toBe("accepted");
    if (done.outcome === "accepted") {
      expect(done.scenarios_total).toBe(17); // the unchanged spec-of-record set, all green on T0 gold
    }
  }, 120_000);
});

describe("v2-M3 — prose arm (custody identical, scenarios never executed)", () => {
  test("the same diligent change advances with custody but records no execution; done is accepted over an unimplemented change", async () => {
    const { change } = conventionFlipFixture();
    const harness = await setUpGate({ arm_mode: "prose" });
    await writeFiles(harness.dir, change.files);

    const exit = await harness.gate.attemptSpecExit(await harness.currentTree());

    expect(exit.outcome).toBe("advanced");
    if (exit.outcome === "advanced") {
      expect(exit.red_check?.mode).toBe("prose_recorded");
      expect(exit.red_check!.novel_total).toBeGreaterThan(0);
      expect(exit.red_check!.novel_red).toBeNull();
      expect(exit.red_check!.novel_records).toEqual([]);
      expect(exit.red_check!.prior_green).toBeNull();
    }

    // No implementation happened — the prose arm accepts done anyway (drift measured, not blocked).
    const done = await harness.gate.submitDoneClaim();
    expect(done.outcome).toBe("accepted");
    expect(harness.gate.summary().refused_done_over_red).toBe(0);
  }, 120_000);

  test("prose custody floors bite identically: an illegal step refuses spec-exit", async () => {
    const harness = await setUpGate({ arm_mode: "prose" });
    await writeFiles(harness.dir, {
      ...MINIMAL_CHANGE_SCAFFOLD("task-1-bad"),
      "openspec/changes/task-1-bad/specs/widgets/spec.md": [
        "## ADDED Requirements",
        "",
        "### Requirement: Bad steps",
        "The service SHALL reject bad steps.",
        "",
        "#### Scenario: Unbindable",
        "- **WHEN** something vague happens",
        "- **THEN** it works",
        ""
      ].join("\n")
    });

    const exit = await harness.gate.attemptSpecExit(await harness.currentTree());
    expect(exit.outcome).toBe("custody_failed");
  }, 120_000);
});

describe("v2-M3 — shared workflow write guards", () => {
  test("spec phase: only files inside a named change are writable; the record and archive are never writable; impl phase freezes openspec/", async () => {
    const harness = await setUpGate({ arm_mode: "executed" });

    expect(harness.gate.evaluateWriteAccess("openspec/changes/task-1/proposal.md").allowed).toBe(true);
    expect(harness.gate.evaluateWriteAccess("openspec/changes/task-1/specs/widgets/spec.md").allowed).toBe(true);
    expect(harness.gate.evaluateWriteAccess("openspec/specs/widgets/spec.md").allowed).toBe(false);
    expect(harness.gate.evaluateWriteAccess("openspec/changes/archive/old/spec.md").allowed).toBe(false);
    expect(harness.gate.evaluateWriteAccess("openspec/changes/loose-file.md").allowed).toBe(false);
    expect(harness.gate.evaluateWriteAccess("server.ts").allowed).toBe(false);
    expect(harness.gate.evaluateWriteAccess("../outside.ts").allowed).toBe(false);
    expect(harness.gate.evaluateWriteAccess("/absolute.ts").allowed).toBe(false);

    // Advance to implementation via the diligent change.
    const { change } = conventionFlipFixture();
    await writeFiles(harness.dir, change.files);
    const exit = await harness.gate.attemptSpecExit(await harness.currentTree());
    expect(exit.outcome).toBe("advanced");

    expect(harness.gate.evaluateWriteAccess("server.ts").allowed).toBe(true);
    expect(harness.gate.evaluateWriteAccess("registry.ts").allowed).toBe(true);
    expect(harness.gate.evaluateWriteAccess("openspec/changes/task-1-convention/specs/widgets/spec.md").allowed).toBe(false);
    expect(harness.gate.evaluateWriteAccess("openspec/specs/widgets/spec.md").allowed).toBe(false);

    const rejections = harness.gate.events().filter((event) => event.type === "phase_guard_rejection");
    expect(rejections.length).toBeGreaterThan(0);
  }, 120_000);
});

describe("v2-M3 — delta-section scenario extraction (§6.2.iv)", () => {
  test("scenarios under REMOVED sections play no role; ADDED and MODIFIED contribute", () => {
    const delta = [
      "## ADDED Requirements",
      "",
      "### Requirement: Added",
      "The service SHALL add.",
      "",
      "#### Scenario: Added scenario",
      '- **WHEN** I send a GET request to "/widgets"',
      "- **THEN** the response status is 200",
      "",
      "## REMOVED Requirements",
      "",
      "### Requirement: Removed",
      "",
      "#### Scenario: Removed scenario",
      '- **WHEN** I send a GET request to "/gone"',
      "- **THEN** the response status is 404",
      "",
      "## MODIFIED Requirements",
      "",
      "### Requirement: Modified",
      "The service SHALL modify.",
      "",
      "#### Scenario: Modified scenario",
      '- **WHEN** I send a DELETE request to "/widgets/w1"',
      "- **THEN** the response status is 204"
    ].join("\n");

    const scenarios = extractChangeDeltaScenarios(delta);

    expect(scenarios.map((scenario) => scenario.title)).toEqual(["Added scenario", "Modified scenario"]);
  });
});
