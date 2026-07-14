// E5 P0-V acceptance (E5-HIT-SDD-ENGINEERING-PROPOSAL.md §2, operator-ratified §7 gate): one
// facet test per rig repair, per the E4 hygiene pattern. Items: (1) PATCH fixed by DISCLOSURE,
// (2) false disclosures corrected + determinacy consequences, (3) glue-aware protocol feedback,
// (4) lawful PARKED.md park primitive, (5) off-topic close scoring, (6) root-cause-clustered
// burden, (7) commitment-vs-gold scorer.
//
// [P0V.1] Extended at the P0-V.1 review-repair boundary (operator-ratified Tiers 1-3 of
// docs/e5/E5-P0V-REVIEW-BACKLOG-v1.md): item 2 now pins all three direction-neutral variants
// (V2a); item 5 pins classifier v2 (V1a: word-boundary, novel-occurrence, scenario-block
// predominance, the maintenance unexpected_change_work flag); plus new facet suites for the V7a
// draw-guard, the V4 analytics shape literal, and the V3/S1/S4 sealed-text repairs.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { buildBaselineIr, createUidMinter } from "../src/e4/substrate/ir";
import { createSequenceState, type E4ChangeOpKind } from "../src/e4/substrate/ops";
import { createE4Prng } from "../src/e4/substrate/prng";
import { renderTaskText } from "../src/e4/substrate/render";
import { E4_OPS_V2 } from "../src/e4/substrate/v2/ops";
import { MODIFY_ENDPOINT_POOL_ID_V2, renderTaskTextV2 } from "../src/e4/substrate/v2/render";
import { renderE4V2ChangeFiles } from "../src/e4/v2/change-render";
import { E4V2TaskGate, type E4V2ArmMode } from "../src/e4/v2/gate";
import { deriveSpecOfRecord } from "../src/e4/v2/gold-spec";
import { previewE4V2MergedScenarios, runE4OpenSpecValidateChange } from "../src/e4/v2/openspec";
import { runE4V2ScenarioSet } from "../src/e4/v2/scenario-executor";
import { detectE4V2GluedDelimiters, renderE4TurnFeedback } from "../src/e4/v2/turns";
import { buildE4V2WorkspaceFiles, renderE4V2Readme } from "../src/e4/v2/workspace";
import type { E4ExecutorConfig } from "../src/e4/oracle-executor";
import type { E4Discrepancy } from "../src/e4/types";
import type { E4OpportunityLabel } from "../src/e4/types";
import { renderE4PmBrief } from "../src/e4/v3/pm-brief";
import { buildE4OnTopicSubjects, classifyE4TaskCloseTopic } from "../src/e4/v3/on-topic";
import { computeE4V3RootCauseBurden } from "../src/e4/v3/root-cause";
import { scoreE4V3CommitmentSheet, type E4V3CommitmentSheet } from "../src/e4/v3/commitment";
import { computeE4V3LearningReport, renderE4V3LearningReport } from "../src/e4/v3/learning-report";
import type { E4TaskDelta } from "../src/e4/v3/task-delta";
import type { E4V2RunManifest, E4V2TaskRecord } from "../src/e4/v2/manifest";
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

// ---------------------------------------------------------------------------------------------
// Item 1 — PATCH contract fixed by DISCLOSURE (README + brief; gold untouched).
// ---------------------------------------------------------------------------------------------

describe("P0-V item 1 — PATCH full-replace disclosure", () => {
  test("the README states full-replace update semantics for PUT and PATCH alike", () => {
    const readme = renderE4V2Readme();

    expect(readme).toContain("## Update semantics");
    expect(readme).toContain("replace the whole stored record");
    expect(readme).toContain("`PUT` and `PATCH` alike");
    expect(readme).toContain("no\npartial updates");
  });

  test("the brief's PATCH line states full-replace, never partial-update", () => {
    const delta = emptyDelta({
      changed_endpoints: [
        {
          semantic_item_uid: "ep-update-1",
          entity: "Widget",
          kind: "update",
          old: { method: "PUT", path: "/widgets/{id}" },
          new: { method: "PATCH", path: "/widgets/{id}" }
        }
      ]
    });
    const brief = renderE4PmBrief({ opKind: "modify_endpoint", delta });

    expect(brief.text).toContain("becomes PATCH /widgets/{id}");
    expect(brief.text).toContain("the request body must still be the complete record");
    expect(brief.text).toContain("replaces the stored record in full");
    expect(brief.text).not.toContain("partial update: only the provided fields change");
    expect(brief.covered.some((entry) => entry.fact_kind === "endpoint_method_form")).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// Item 2 — false disclosures corrected; v2 render override; v1 substrate untouched.
// ---------------------------------------------------------------------------------------------

describe("P0-V item 2 (+[P0V.1: V2]) — modify_endpoint pool corrected in a v2-owned pool", () => {
  const RENDER_CONTEXTS: Partial<Record<E4ChangeOpKind, Record<string, string>>> = {
    add_entity: { entity: "Review" },
    delete_entity: { entity: "Widget" },
    rename_entity: { old_name: "Widget", new_name: "Item" },
    add_field: { entity: "Widget", field: "notes" },
    rename_field: { entity: "Widget", old_name: "name", new_name: "title" },
    retype_field: { entity: "Widget", field: "price", new_type: "int" },
    delete_field: { entity: "Widget", field: "notes" },
    add_endpoint: { entity: "Widget" },
    modify_endpoint: { entity: "Widget", method: "PATCH", path: "/widgets/{id}" },
    add_validation_rule: { entity: "Widget", field: "details" },
    modify_convention: { convention_id: "error_format", kind: "error_format" },
    add_relationship: { from: "Widget", to: "Category" },
    noop_maintenance: {}
  };

  test("PRNG stream and every non-modify_endpoint text are byte-identical to the v1 renderer", () => {
    const kinds = Object.keys(RENDER_CONTEXTS) as E4ChangeOpKind[];
    const variantsSeen = new Set<number>();

    for (let seed = 0; seed < 25; seed += 1) {
      const v1Prng = createE4Prng(seed);
      const v2Prng = createE4Prng(seed);

      // three passes per seed so a stream misalignment would corrupt LATER renders too
      for (let round = 0; round < 3; round += 1) {
        for (const opKind of kinds) {
          const input = { opKind, renderContext: RENDER_CONTEXTS[opKind]! };
          const v1 = renderTaskText(input, v1Prng);
          const v2 = renderTaskTextV2(input, v2Prng);

          if (opKind !== "modify_endpoint") {
            expect(v2).toEqual(v1);
            continue;
          }

          expect(v2.pool_id).toBe(MODIFY_ENDPOINT_POOL_ID_V2);
          expect(v2.names_item_verbatim).toBe(v1.names_item_verbatim);

          // [P0V.1: V2] all three variants are corrected; index selection stays aligned with
          // the v1 pool (same single PRNG draw), so the v1 text identifies the drawn index.
          if (v1.text.includes("the API now uses")) {
            variantsSeen.add(0);
            expect(v2.text).toBe(
              "The way clients update a Widget is changing — use a different request method for those updates from now on."
            );
          } else if (v1.text.includes("match the rest of the API")) {
            variantsSeen.add(1);
            expect(v2.text).toBe("Switch how clients update a Widget record — the request method for updates is changing.");
          } else {
            variantsSeen.add(2);
            expect(v1.text).toContain("One of our update endpoints");
            expect(v2.text).toBe("One of our update endpoints needs its request method changed.");
          }
        }
      }
    }

    expect([...variantsSeen].toSorted()).toEqual([0, 1, 2]); // every corrected variant exercised
  });

  test("[P0V.1: V2] no v2 modify_endpoint render is direction-false or contradicts the README", () => {
    const prng = createE4Prng(7);

    for (let index = 0; index < 200; index += 1) {
      const rendered = renderTaskTextV2(
        { opKind: "modify_endpoint", renderContext: { entity: "Widget", method: "PUT", path: "/widgets/{id}" } },
        prng
      );

      expect(rendered.text).not.toContain("match the rest of the API");
      // No variant may claim which convention is the newer one (direction-false on PATCH→PUT
      // re-draws) or mention partial updates (contradicts the README's full-replace disclosure).
      expect(rendered.text.toLowerCase()).not.toContain("partial update");
      expect(rendered.text.toLowerCase()).not.toContain("partial-update");
      expect(rendered.text).not.toContain("now uses");
      expect(rendered.text).not.toContain("PATCH");
      expect(rendered.text).not.toContain("PUT");
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Item 3 — glue-aware protocol feedback (sealed parser byte-untouched).
// ---------------------------------------------------------------------------------------------

describe("P0-V item 3 — glued-delimiter detection", () => {
  test("a prose-glued DONE is reported with its line number", () => {
    const violations = detectE4V2GluedDelimiters("Everything looks complete.\nSo I will finish here: <<<DONE>>>");

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ code: "delimiter_glued", line: 2 });
    expect(violations[0].detail).toContain("text precedes the delimiter <<<DONE>>> on line 2");
    // [P0V.1: S4] conditional, not imperative: the feedback must never read as an instruction
    // to emit the delimiter (the prose arm accepts done-claims unconditionally).
    expect(violations[0].detail).toContain("if this was meant as a protocol command");
    expect(violations[0].detail).not.toMatch(/— put .* on its own line$/);
  });

  test("a prose-glued FILE opener is reported; the feedback channel renders it", () => {
    const violations = detectE4V2GluedDelimiters("Here is the file: <<<FILE server.ts>>>\ncode\n<<<END>>>");

    expect(violations.some((violation) => violation.detail.includes("<<<FILE …>>>"))).toBe(true);

    const feedback = renderE4TurnFeedback({
      confirmations: [],
      rejections: [],
      violations,
      verification: null,
      gate: null,
      no_op: true
    });

    expect(feedback).toContain("protocol violation (delimiter_glued");
    expect(feedback).toContain("text precedes the delimiter");
  });

  test("delimiters quoted inside a properly closed FILE block are NOT flagged", () => {
    const text = ["<<<FILE tasks.md>>>", "- output <<<DONE>>> when finished", "run <<<VERIFY>>> to check", "<<<END>>>"].join("\n");

    expect(detectE4V2GluedDelimiters(text)).toHaveLength(0);
  });

  test("a glued END inside a never-closing block is flagged (the block cannot close)", () => {
    const text = ["<<<FILE server.ts>>>", "const x = 1; <<<END>>>"].join("\n");
    const violations = detectE4V2GluedDelimiters(text);

    expect(violations).toHaveLength(1);
    // [P0V.1: S4] the in-block variant is conditional too.
    expect(violations[0].detail).toContain("if this was meant to close the block");
  });

  test("lines starting with <<< are left to the sealed parser; clean protocol turns are silent", () => {
    expect(detectE4V2GluedDelimiters("<<<DONE>>> extra trailing words")).toHaveLength(0);
    expect(detectE4V2GluedDelimiters("<<<FILE a.ts>>>\nbody\n<<<END>>>\n<<<DONE>>>")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Item 4 — lawful PARKED.md park primitive (operator-approved design note).
// ---------------------------------------------------------------------------------------------

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
    try {
      tree[`openspec/${entry.replaceAll("\\", "/")}`] = await readFile(join(root, entry), "utf8");
    } catch {
      // directory entry
    }
  }

  return tree;
}

async function setUpParkGate(input: {
  arm_mode: E4V2ArmMode;
  labels?: E4OpportunityLabel[];
  leftoverFiles?: Record<string, string>;
}) {
  const dir = await mkdtemp(join(tmpdir(), "e5-p0v-park-"));
  tempRoots.push(dir);
  await writeFiles(dir, buildE4V2WorkspaceFiles(buildBaselineIr()));

  if (input.leftoverFiles) {
    await writeFiles(dir, input.leftoverFiles); // present BEFORE task start
  }

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
    runScenarios: (scenarios) => runE4V2ScenarioSet({ workspace_dir: dir, scenarios, config: EXEC_CONFIG, concurrency: 6 })
  });

  return { dir, gate, currentTree: () => readOpenSpecTree(dir) };
}

const LEFTOVER = {
  "openspec/changes/task-1-leftover/proposal.md": "## Why\nStalled predecessor.\n\n## What Changes\n- Unfinished.\n",
  "openspec/changes/task-1-leftover/specs/widgets/spec.md": "## MODIFIED Requirements\n(half-built, unparseable)\n"
};

function validChangeFixture(changeName: string) {
  const baseline = buildBaselineIr();
  const t0Spec = deriveSpecOfRecord(baseline, null);
  const flipped = E4_OPS_V2.modify_convention.apply(baseline, createUidMinter(), indexQueuePrng([0]), createSequenceState());

  return renderE4V2ChangeFiles({
    changeName,
    postIr: flipped.ir,
    priorSpec: t0Spec,
    requestText: "Bring error responses up to the new company-wide convention."
  });
}

describe("P0-V item 4 — PARKED.md park primitive", () => {
  test("park the leftover + open a clean change: custody passes, the park is recorded", async () => {
    const harness = await setUpParkGate({ arm_mode: "prose", leftoverFiles: LEFTOVER });
    await writeFiles(harness.dir, { "openspec/changes/task-1-leftover/PARKED.md": "Parked: stalled predecessor.\n" });
    await writeFiles(harness.dir, validChangeFixture("task-2-convention").files);

    const exit = await harness.gate.attemptSpecExit(await harness.currentTree());

    expect(exit.outcome).toBe("advanced");
    if (exit.outcome === "advanced") {
      expect(exit.change_name).toBe("task-2-convention");
    }
    expect(harness.gate.summary().parks).toBe(1);
    expect(harness.gate.events().some((event) => event.type === "change_parked" && event.change_name === "task-1-leftover")).toBe(
      true
    );
  });

  test("marker-only diff on a non-maintenance task is refused with parking-aware feedback", async () => {
    const harness = await setUpParkGate({ arm_mode: "prose", leftoverFiles: LEFTOVER });
    await writeFiles(harness.dir, { "openspec/changes/task-1-leftover/PARKED.md": "Parked.\n" });

    const exit = await harness.gate.attemptSpecExit(await harness.currentTree());

    expect(exit.outcome).toBe("custody_failed");
    if (exit.outcome === "custody_failed") {
      expect(exit.feedback).toContain("only PARKED.md markers were written");
    }
  });

  test("editing a parked directory carries no change work (every changed dir parked → refusal)", async () => {
    const harness = await setUpParkGate({ arm_mode: "prose", leftoverFiles: LEFTOVER });
    await writeFiles(harness.dir, {
      "openspec/changes/task-1-leftover/PARKED.md": "Parked.\n",
      "openspec/changes/task-1-leftover/specs/widgets/spec.md": "## MODIFIED Requirements\n(edited while parked)\n"
    });

    const exit = await harness.gate.attemptSpecExit(await harness.currentTree());

    expect(exit.outcome).toBe("custody_failed");
    if (exit.outcome === "custody_failed") {
      expect(exit.feedback).toContain("every changed directory is parked");
    }
  });

  test("two ACTIVE changed directories are still refused, naming the parked exclusion affordance", async () => {
    const harness = await setUpParkGate({ arm_mode: "prose" });
    await writeFiles(harness.dir, validChangeFixture("task-2-a").files);
    await writeFiles(harness.dir, validChangeFixture("task-2-b").files);

    const exit = await harness.gate.attemptSpecExit(await harness.currentTree());

    expect(exit.outcome).toBe("custody_failed");
    if (exit.outcome === "custody_failed") {
      expect(exit.feedback).toContain("exactly one active change directory");
      expect(exit.feedback).toContain("PARKED.md");
    }
  });

  test("maintenance task: marker-only diff still reaches the byte-unchanged affirmation path", async () => {
    const harness = await setUpParkGate({
      arm_mode: "prose",
      labels: ["behavior_preserving"],
      leftoverFiles: LEFTOVER
    });
    await writeFiles(harness.dir, { "openspec/changes/task-1-leftover/PARKED.md": "Parked.\n" });
    harness.gate.recordSmokeInvocation();

    const exit = await harness.gate.attemptSpecExit(await harness.currentTree());

    expect(exit.outcome).toBe("advanced");
    if (exit.outcome === "advanced") {
      expect(exit.custody_via).toBe("behavior_preserving_affirmation");
    }
    expect(harness.gate.summary().parks).toBe(1);
  });

  test("the README and the workflow protocol document the affordance", async () => {
    const readme = renderE4V2Readme();

    expect(readme).toContain("## Parking a leftover change");
    // [P0V.1: S1] the irreversible corner is disclosed: marker only, no other files.
    expect(readme).toContain("The `PARKED.md` marker alone suffices");

    const constants = JSON.parse(
      await readFile(join(REPO_ROOT, "docs/protocols/e4-v2-sealed-constants-v0.json"), "utf8")
    ) as { protocol_text: { workflow_protocol: string } };

    expect(constants.protocol_text.workflow_protocol).toContain("PARKED.md");
    expect(constants.protocol_text.workflow_protocol).toContain("exactly one active (non-parked) change directory");
    // [P0V.1: V3] the write-rule bullet states the ENFORCED rule: writes are lawful in any
    // change directory; custody demands a single active change at exit.
    expect(constants.protocol_text.workflow_protocol).toContain("Only files inside change directories under openspec/changes/");
    expect(constants.protocol_text.workflow_protocol).not.toContain("Only files inside one change directory");
    expect(constants.protocol_text.workflow_protocol).toContain("single active change directory");
  });
});

// ---------------------------------------------------------------------------------------------
// Item 5 — off-topic close as a scoring category.
// ---------------------------------------------------------------------------------------------

function emptyDelta(overrides: Partial<E4TaskDelta> = {}): E4TaskDelta {
  return {
    added_entities: [],
    removed_entities: [],
    renamed_entities: [],
    added_fields: [],
    removed_fields: [],
    renamed_fields: [],
    retyped_fields: [],
    added_endpoints: [],
    removed_endpoints: [],
    changed_endpoints: [],
    added_rules: [],
    removed_rules: [],
    changed_conventions: [],
    is_empty: false,
    ...overrides
  } as E4TaskDelta;
}

const RENAME_DELTA = emptyDelta({
  renamed_entities: [{ semantic_item_uid: "ent-1", old_name: "Widget", new_name: "Item" }]
});

const CONVENTION_DELTA = emptyDelta({
  changed_conventions: [
    {
      semantic_item_uid: "conv-1",
      convention_id: "error_format",
      kind: "error_format",
      old_statement: 'Error responses are JSON bodies of the shape { "error": { "code": string, "message": string } }.',
      new_statement: 'Error responses are JSON bodies of the shape { "error": { "type": string, "detail": string } }.'
    }
  ]
});

describe("P0-V item 5 (+[P0V.1: V1], +[V08: 1b]) — off-topic close classification, classifier v3", () => {
  const RENAME_SCENARIO_ON_TOPIC =
    "## ADDED Requirements\n### Requirement: Items are served at the new paths\n" +
    '#### Scenario: read a renamed record\n- **WHEN** I send a GET request to "/items/widget-spec-1"\n- **THEN** the response status is 200\n';
  const UNRELATED_SCENARIO =
    "## MODIFIED Requirements\n### Requirement: Categories validate names\n" +
    '#### Scenario: reject a bad category name\n- **WHEN** I send a POST request to "/categories" with body {}\n- **THEN** the response status is 400\n';

  test("scenarios that address the rename are on_topic; unrelated work is off_topic", () => {
    const subjects = buildE4OnTopicSubjects(RENAME_DELTA);

    expect(subjects).toContain("Item");
    expect(subjects).toContain("widgets");

    const onTopic = classifyE4TaskCloseTopic({
      delta_is_empty: false,
      subjects,
      change_spec_contents: [RENAME_SCENARIO_ON_TOPIC],
      code_writes: []
    });

    expect(onTopic.classification).toBe("on_topic");
    expect(onTopic.spec_channel).toMatchObject({ scenario_blocks: 1, matched_blocks: 1, predominant: true });

    const offTopic = classifyE4TaskCloseTopic({
      delta_is_empty: false,
      subjects,
      change_spec_contents: [UNRELATED_SCENARIO],
      code_writes: [{ path: "server.ts", content: "registerRoute('GET', '/categories', listCategories);", task_start_content: null }]
    });

    expect(offTopic.classification).toBe("off_topic");
    expect(offTopic.matched_subjects).toHaveLength(0);
  });

  test("[P0V.1: V1] a subject mention in a heading alone no longer classifies on_topic", () => {
    // Classifier v1's verified blindness: one mention anywhere — a change-title heading was
    // enough — laundered any off-topic close. v2 scores the scenario blocks (the behavioral
    // payload) by predominance.
    const report = classifyE4TaskCloseTopic({
      delta_is_empty: false,
      subjects: buildE4OnTopicSubjects(RENAME_DELTA),
      change_spec_contents: [
        "## ADDED Requirements\n### Requirement: Item work\n" +
          '#### Scenario: tidy the category list\n- **WHEN** I send a GET request to "/categories"\n- **THEN** the response status is 200\n'
      ],
      code_writes: []
    });

    expect(report.classification).toBe("off_topic");
    expect(report.spec_channel).toMatchObject({ scenario_blocks: 1, matched_blocks: 0, predominant: false });
  });

  test("[P0V.1: V1] a minority on-topic scenario does not launder a predominantly off-topic change", () => {
    const report = classifyE4TaskCloseTopic({
      delta_is_empty: false,
      subjects: buildE4OnTopicSubjects(RENAME_DELTA),
      change_spec_contents: [RENAME_SCENARIO_ON_TOPIC, UNRELATED_SCENARIO, UNRELATED_SCENARIO],
      code_writes: []
    });

    expect(report.classification).toBe("off_topic");
    expect(report.spec_channel).toMatchObject({ scenario_blocks: 3, matched_blocks: 1, predominant: false });
  });

  test("[P0V.1: V1] code writes count only NOVEL occurrences, word-bounded", () => {
    const subjects = buildE4OnTopicSubjects(RENAME_DELTA); // Widget → Item
    const startContent = "registerRoute('GET', '/widgets', listWidgets);\n";

    // Rewriting a file that already mentioned the old name is NOT evidence of addressing it.
    const rewriteOnly = classifyE4TaskCloseTopic({
      delta_is_empty: false,
      subjects,
      change_spec_contents: [],
      code_writes: [{ path: "server.ts", content: `${startContent}const unrelated = 1;\n`, task_start_content: startContent }]
    });

    expect(rewriteOnly.classification).toBe("off_topic");
    expect(rewriteOnly.code_channel.novel_matched_subjects).toHaveLength(0);

    // Introducing the NEW collection path is.
    const novel = classifyE4TaskCloseTopic({
      delta_is_empty: false,
      subjects,
      change_spec_contents: [],
      code_writes: [
        { path: "server.ts", content: "registerRoute('GET', '/items', listWidgets);\n", task_start_content: startContent }
      ]
    });

    expect(novel.classification).toBe("on_topic");
    expect(novel.code_channel.novel_matched_subjects).toContain("items");

    // Word boundary: an embedded identifier is not a mention.
    const embedded = classifyE4TaskCloseTopic({
      delta_is_empty: false,
      subjects,
      change_spec_contents: [],
      code_writes: [{ path: "report.ts", content: "const ItemizedReport = 1;", task_start_content: null }]
    });

    expect(embedded.classification).toBe("off_topic");
  });

  test("[P0V.1: V1] modify_endpoint blindness closed: a pre-existing method verb no longer matches", () => {
    const methodFlipDelta = emptyDelta({
      changed_endpoints: [
        {
          semantic_item_uid: "ep-1",
          entity: "Widget",
          kind: "update",
          old: { method: "PUT", path: "/widgets/{id}" },
          new: { method: "PATCH", path: "/widgets/{id}" }
        }
      ]
    });
    const subjects = buildE4OnTopicSubjects(methodFlipDelta);

    expect(subjects).toContain("PATCH");

    // v1's verified hole: "PATCH" appeared somewhere in virtually every server file, so any
    // whole-file rewrite matched. Under the novel-occurrence rule it no longer does.
    const startContent = "// supports PATCH already\nregisterRoute('PATCH', '/other', handler);\n";
    const rewrite = classifyE4TaskCloseTopic({
      delta_is_empty: false,
      subjects,
      change_spec_contents: [],
      code_writes: [{ path: "server.ts", content: `${startContent}const unrelated = 1;\n`, task_start_content: startContent }]
    });

    expect(rewrite.classification).toBe("off_topic");

    const addressed = classifyE4TaskCloseTopic({
      delta_is_empty: false,
      subjects,
      change_spec_contents: [],
      code_writes: [
        { path: "server.ts", content: `${startContent}registerRoute('PATCH', '/widgets/{id}', updateWidget);\n`, task_start_content: startContent }
      ]
    });

    expect(addressed.classification).toBe("on_topic");
  });

  test("convention tasks match on the NEW statement's quoted keys, novel in code", () => {
    const subjects = buildE4OnTopicSubjects(CONVENTION_DELTA);

    expect(subjects).toContain('"detail"');

    const addressed = classifyE4TaskCloseTopic({
      delta_is_empty: false,
      subjects,
      change_spec_contents: [],
      code_writes: [
        {
          path: "server.ts",
          content: 'res.end(JSON.stringify({ error: { "type": kind, "detail": message } }));',
          task_start_content: 'res.end(JSON.stringify({ error: { "code": kind, "message": message } }));'
        }
      ]
    });

    expect(addressed.classification).toBe("on_topic");

    const swapped = classifyE4TaskCloseTopic({
      delta_is_empty: false,
      subjects,
      change_spec_contents: ["## ADDED Requirements\nsomething unrelated entirely\n"],
      code_writes: [{ path: "server.ts", content: "const unrelated = true;", task_start_content: null }]
    });

    expect(swapped.classification).toBe("off_topic");
  });

  // [V08: 1b] Findings log 1a (docs/e5/E5-ZERO-SPEND-RUNWAY-v1.md): all four seed-220
  // modify_convention closes (treatment tasks 1/3, control tasks 1/3, 1-indexed folder names)
  // misfired off_topic under classifier v2 even though the accepted change genuinely addressed
  // the convention flip. Forensics: the code channel's real footprint was UNQUOTED object keys
  // (`error: { type: kind, detail: msg }`) and the spec channel's real footprint was DOTTED
  // scenario-assertion paths (`error.type`) — neither matched the v2 quoted-literal-only
  // subjects (`"type"`, `"detail"`). Each case below replays one recorded misfire's shape
  // (statement direction + real scenario_blocks count from manifest-{treatment,control}.json)
  // and asserts v3 now classifies it on_topic.
  const REVERT_DELTA = emptyDelta({
    changed_conventions: [
      {
        semantic_item_uid: "conv-1",
        convention_id: "error_format",
        kind: "error_format",
        old_statement: CONVENTION_DELTA.changed_conventions[0].new_statement,
        new_statement: CONVENTION_DELTA.changed_conventions[0].old_statement
      }
    ]
  });

  function dottedScenarioBlocks(total: number, onTopicCount: number, dottedKeys: [string, string]): string[] {
    const [type_, detail_] = dottedKeys;
    const onTopic =
      '#### Scenario: reject an invalid record\n- **WHEN** I send a POST request to "/widgets" with body {}\n' +
      `- **THEN** the response field "${type_}" is a string\n- **AND** the response field "${detail_}" is a string\n`;
    const unrelated =
      '#### Scenario: list widgets\n- **WHEN** I send a GET request to "/widgets"\n- **THEN** the response status is 200\n';

    return Array.from({ length: total }, (_, index) => (index < onTopicCount ? onTopic : unrelated));
  }

  function unquotedErrorBody(type_: string, detail_: string): string {
    return `function errorBody(kind, message) { return { error: { ${type_}: kind, ${detail_}: message } }; }`;
  }

  test.each([
    ["treatment task 1 (error-format)", CONVENTION_DELTA, ["type", "detail"] as [string, string], ["code", "message"] as [string, string], 13],
    ["treatment task 3 (error-format-revert)", REVERT_DELTA, ["code", "message"] as [string, string], ["type", "detail"] as [string, string], 16],
    ["control task 1 (error-format)", CONVENTION_DELTA, ["type", "detail"] as [string, string], ["code", "message"] as [string, string], 12],
    ["control task 3 (error-format-revert)", REVERT_DELTA, ["code", "message"] as [string, string], ["type", "detail"] as [string, string], 14]
  ])("[V08: 1b] replays the seed-220 misfire: %s — real unquoted/dotted footprints now on_topic", (
    _label,
    delta,
    newKeys,
    oldKeys,
    scenarioBlocks
  ) => {
    const subjects = buildE4OnTopicSubjects(delta);
    const [newType, newDetail] = newKeys;
    const [oldType, oldDetail] = oldKeys;

    // Spec channel alone: dotted assertion paths, majority of the recorded scenario_blocks count.
    const specOnly = classifyE4TaskCloseTopic({
      delta_is_empty: false,
      subjects,
      change_spec_contents: dottedScenarioBlocks(scenarioBlocks, Math.ceil(scenarioBlocks / 2) + 1, newKeys),
      code_writes: []
    });

    expect(specOnly.classification).toBe("on_topic");
    expect(specOnly.spec_channel.predominant).toBe(true);

    // Code channel alone: unquoted object-literal keys, novel vs. the old statement's keys.
    const codeOnly = classifyE4TaskCloseTopic({
      delta_is_empty: false,
      subjects,
      change_spec_contents: [],
      code_writes: [
        {
          path: "server.ts",
          content: unquotedErrorBody(newType, newDetail),
          task_start_content: unquotedErrorBody(oldType, oldDetail)
        }
      ]
    });

    expect(codeOnly.classification).toBe("on_topic");
    expect(codeOnly.code_channel.novel_matched_subjects.length).toBeGreaterThan(0);

    // The real recorded misfire shape: BOTH channels present together, matching the actual close.
    const combined = classifyE4TaskCloseTopic({
      delta_is_empty: false,
      subjects,
      change_spec_contents: dottedScenarioBlocks(scenarioBlocks, Math.ceil(scenarioBlocks / 2) + 1, newKeys),
      code_writes: [
        {
          path: "server.ts",
          content: unquotedErrorBody(newType, newDetail),
          task_start_content: unquotedErrorBody(oldType, oldDetail)
        }
      ]
    });

    expect(combined.classification).toBe("on_topic");
  });

  test("[P0V.1: V1] maintenance closes stay not_applicable, but authored work is flagged", () => {
    const clean = classifyE4TaskCloseTopic({
      delta_is_empty: true,
      subjects: [],
      change_spec_contents: [],
      code_writes: []
    });

    expect(clean.classification).toBe("not_applicable");
    expect(clean.unexpected_change_work).toBe(false);

    // Byte-identical rewrites are not work.
    const byteIdentical = classifyE4TaskCloseTopic({
      delta_is_empty: true,
      subjects: [],
      change_spec_contents: [],
      code_writes: [{ path: "server.ts", content: "same bytes", task_start_content: "same bytes" }]
    });

    expect(byteIdentical.unexpected_change_work).toBe(false);

    // The absorption scenario: a full change authored under a no-change task, matching a
    // stalled predecessor's subjects — v1 was blind here by construction.
    const absorbed = classifyE4TaskCloseTopic({
      delta_is_empty: true,
      subjects: [],
      change_spec_contents: [
        "## ADDED Requirements\n### Requirement: Suppliers list\n" +
          '#### Scenario: list suppliers\n- **WHEN** I send a GET request to "/suppliers"\n- **THEN** the response status is 200\n'
      ],
      code_writes: [{ path: "server.ts", content: "registerRoute('GET', '/suppliers', listSuppliers);", task_start_content: null }],
      prior_task_subjects: ["Supplier", "suppliers"]
    });

    expect(absorbed.classification).toBe("not_applicable");
    expect(absorbed.unexpected_change_work).toBe(true);
    expect(absorbed.prior_task_subject_matches).toEqual(["suppliers"]);
  });

  test("the disposition table scores off-topic closes as their own category", () => {
    const manifest = fakeManifest("e4_arm_0", 7, [
      fakeTask(1, { termination: "done", fc: false, on_topic: "on_topic" }),
      fakeTask(2, { termination: "done", fc: true, on_topic: "off_topic" }),
      fakeTask(3, { termination: "budget_exhausted", fc: false, phase: "spec" })
    ]);
    const report = computeE4V3LearningReport([manifest]);
    const arm = report.arms[0];

    expect(arm.disposition).toMatchObject({
      scheduled: 3,
      truthful_close: 1,
      false_close: 0,
      off_topic_close: 1,
      off_topic_fc_events: 1,
      nonclose: 1,
      on_topic_unavailable: 0
    });
  });
});

// ---------------------------------------------------------------------------------------------
// Item 6 — root-cause-clustered burden (frozen secondary, published alongside raw).
// ---------------------------------------------------------------------------------------------

function discrepancy(input: Partial<E4Discrepancy> & Pick<E4Discrepancy, "item_id" | "semantic_item_uid">): E4Discrepancy {
  return {
    kind: "endpoint",
    class: "stale_claim",
    direction: "spec_vs_truth",
    detail: {},
    ...input
  } as E4Discrepancy;
}

describe("P0-V item 6 — root-cause-clustered burden", () => {
  test("a rename blast (old-path stale claims + new-surface symptoms) collapses to ONE cluster", () => {
    const drift = {
      discrepancies: [
        // stale claims against the OLD collection paths (concrete request form)
        discrepancy({ item_id: "endpoint:GET /widgets/widget-spec-1", semantic_item_uid: "ep-read" }),
        discrepancy({ item_id: "endpoint:PUT /widgets/widget-spec-1", semantic_item_uid: "ep-update" }),
        // symptoms on the NEW surface (canonical form) sharing the same endpoint uids
        discrepancy({ item_id: "endpoint:Item:read", semantic_item_uid: "ep-read", class: "coverage_gap" }),
        discrepancy({ item_id: "endpoint:Item:update", semantic_item_uid: "ep-update", class: "coverage_gap" }),
        // entity/field symptoms of the same rename
        discrepancy({ item_id: "entity:Item", semantic_item_uid: "ent-1", kind: "entity", class: "contradiction" }),
        discrepancy({ item_id: "field:Item.name", semantic_item_uid: "f-1", kind: "field", class: "coverage_gap" }),
        // one UNRELATED convention divergence
        discrepancy({ item_id: "convention:error_format", semantic_item_uid: "conv-1", kind: "convention", class: "contradiction" })
      ]
    };

    const burden = computeE4V3RootCauseBurden(drift);

    expect(burden.raw_burden).toBe(7);
    expect(burden.clustered_burden).toBe(2);

    const renameCluster = burden.clusters.find((cluster) => cluster.families.includes("family:widgets"));

    expect(renameCluster?.families).toContain("family:items");
    expect(renameCluster?.item_count).toBe(6);
    expect(burden.clusters.some((cluster) => cluster.root === "convention:error_format")).toBe(true);
  });

  test("unrelated families stay separate; empty reports cluster to zero", () => {
    const twoRoots = computeE4V3RootCauseBurden({
      discrepancies: [
        discrepancy({ item_id: "endpoint:Widget:read", semantic_item_uid: "ep-1", class: "coverage_gap" }),
        discrepancy({ item_id: "entity:Category", semantic_item_uid: "ent-c", kind: "entity", class: "contradiction" })
      ]
    });

    expect(twoRoots.clustered_burden).toBe(2);
    expect(computeE4V3RootCauseBurden({ discrepancies: [] }).clustered_burden).toBe(0);
  });

  test("the learning report publishes raw AND clustered series side by side", () => {
    const record = fakeTask(1, { termination: "done", fc: true, on_topic: "on_topic" });
    record.drift.discrepancies = [
      discrepancy({ item_id: "endpoint:GET /widgets/widget-spec-1", semantic_item_uid: "ep-read" }),
      discrepancy({ item_id: "endpoint:Item:read", semantic_item_uid: "ep-read", class: "coverage_gap" })
    ];

    const report = computeE4V3LearningReport([fakeManifest("e4_arm_0", 7, [record])]);
    const arm = report.arms[0];

    expect(arm.burden_series_raw).toEqual([2]);
    expect(arm.burden_series_clustered).toEqual([1]);
    expect(arm.burden_auc_raw).toBeCloseTo(2, 10);
    expect(arm.burden_auc_clustered).toBeCloseTo(1, 10);

    // [P0V.1: D5] cluster sizes are carried and printed, and the readout is labeled by its
    // mechanism so a reader sees how many items each cluster collapsed.
    expect(arm.burden_cluster_sizes).toEqual([[2]]);

    const rendered = renderE4V3LearningReport(report);

    expect(rendered).toContain("family-collapsed [1(2)]");
    expect(rendered).not.toContain("root-cause-clustered [");
  });
});

// ---------------------------------------------------------------------------------------------
// [P0V.1: V7] add_entity ever-used-name draw-guard.
// ---------------------------------------------------------------------------------------------

describe("P0-V.1 item V7 — add_entity never recycles an ever-used entity name", () => {
  test("add(X) → delete(X) → add draws a DIFFERENT name (tombstone revival undrawable)", () => {
    const state = createSequenceState();
    const minter = createUidMinter();

    const added = E4_OPS_V2.add_entity.apply(buildBaselineIr(), minter, indexQueuePrng([0]), state);
    const addedName = added.render_context.entity;

    const deleted = E4_OPS_V2.delete_entity.apply(added.ir, minter, indexQueuePrng([0]), state);

    expect(deleted.render_context.entity).toBe(addedName);

    const readded = E4_OPS_V2.add_entity.apply(deleted.ir, minter, indexQueuePrng([0]), state);

    expect(readded.render_context.entity).not.toBe(addedName);
  });

  test("add(X) → rename(X→Y) → add draws a DIFFERENT name (retired paths stay retired)", () => {
    const state = createSequenceState();
    const minter = createUidMinter();

    const added = E4_OPS_V2.add_entity.apply(buildBaselineIr(), minter, indexQueuePrng([0]), state);
    const addedName = added.render_context.entity;
    const entityIndex = added.ir.entities.findIndex((entity) => entity.name === addedName);

    const renamed = E4_OPS_V2.rename_entity.apply(added.ir, minter, indexQueuePrng([entityIndex, 0]), state);

    expect(renamed.render_context.old_name).toBe(addedName);

    const readded = E4_OPS_V2.add_entity.apply(renamed.ir, minter, indexQueuePrng([0]), state);

    expect(readded.render_context.entity).not.toBe(addedName);
  });

  test("eligibility mirrors the guard: an exhausted pool disables add_entity instead of crashing", () => {
    const state = createSequenceState();
    const minter = createUidMinter();
    let ir = buildBaselineIr();

    for (let index = 0; index < 5; index += 1) {
      ir = E4_OPS_V2.add_entity.apply(ir, minter, indexQueuePrng([0]), state).ir;
    }

    expect(E4_OPS_V2.add_entity.isEligible(ir, state)).toBe(false);

    // Deleting one frees the IR slot but NOT the ledger — the name stays retired.
    const deleted = E4_OPS_V2.delete_entity.apply(ir, minter, indexQueuePrng([0]), state);

    expect(E4_OPS_V2.add_entity.isEligible(deleted.ir, state)).toBe(false);
    expect(() => E4_OPS_V2.add_entity.apply(deleted.ir, minter, indexQueuePrng([0]), state)).toThrow(/name pool exhausted/);
  });
});

// ---------------------------------------------------------------------------------------------
// [P0V.1: V4] analytics brief line pins the response shape it claims to answer.
// ---------------------------------------------------------------------------------------------

describe("P0-V.1 item V4 — analytics brief shape literal", () => {
  test("the analytics line carries the count-shape literal and covers analytics_endpoint_shape", () => {
    const delta = emptyDelta({
      added_endpoints: [
        {
          semantic_item_uid: "ep-stats",
          entity: "Widget",
          kind: "analytics",
          method: "GET",
          path: "/widgets/stats"
        } as E4TaskDelta["added_endpoints"][number]
      ]
    });
    const brief = renderE4PmBrief({ opKind: "add_endpoint", delta });

    expect(brief.brief_id).toBe("e4-pm-brief-v3");
    expect(brief.text).toContain('{"count": <number of records>}');
    expect(brief.covered.some((entry) => entry.fact_kind === "analytics_endpoint_shape")).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// Item 7 — commitment-vs-gold scorer.
// ---------------------------------------------------------------------------------------------

describe("P0-V item 7 — commitment-vs-gold scorer", () => {
  const GOLD = emptyDelta({
    renamed_entities: [{ semantic_item_uid: "ent-1", old_name: "Widget", new_name: "Item" }],
    added_rules: [
      {
        semantic_item_uid: "rule-1",
        entity: "Item",
        field: "details",
        kind: "format",
        detail: { pattern: "^[\\w -]{1,80}$" }
      } as E4TaskDelta["added_rules"][number]
    ],
    changed_endpoints: [
      {
        semantic_item_uid: "ep-1",
        entity: "Item",
        kind: "update",
        old: { method: "PUT", path: "/items/{id}" },
        new: { method: "PATCH", path: "/items/{id}" }
      }
    ]
  });

  test("a gold-faithful sheet scores all-matched with nothing missed or invented", () => {
    const sheet: E4V3CommitmentSheet = {
      renamed_entities: [{ old_name: "Widget", new_name: "Item" }],
      added_rules: [{ entity: "Item", field: "details", kind: "format", detail: { pattern: "^[\\w -]{1,80}$" } }],
      changed_endpoints: [{ old_method: "PUT", new_method: "PATCH", path: "/items/{id}" }]
    };

    const score = scoreE4V3CommitmentSheet({ sheet, delta: GOLD });

    expect(score.counts).toEqual({ matched: 3, contradicted: 0, invented: 0, missed: 0 });
  });

  test("wrong values contradict; absent claims are missed; extra claims are invented", () => {
    const sheet: E4V3CommitmentSheet = {
      renamed_entities: [{ old_name: "Widget", new_name: "Product" }], // wrong target name
      added_rules: [{ entity: "Item", field: "details", kind: "format" }], // no literal committed
      added_fields: [{ entity: "Item", field: { name: "made_up", type: "string", required: false } }] // invented
      // changed_endpoints omitted entirely → missed
    };

    const score = scoreE4V3CommitmentSheet({ sheet, delta: GOLD });

    expect(score.counts.contradicted).toBe(2);
    expect(score.counts.invented).toBe(1);
    expect(score.counts.missed).toBe(1);
    expect(score.missed[0]).toMatchObject({ category: "changed_endpoint" });
  });

  test("no-change commitments score against emptiness in both directions", () => {
    const noop = emptyDelta({ is_empty: true });

    expect(scoreE4V3CommitmentSheet({ sheet: { no_change: true }, delta: noop }).counts).toEqual({
      matched: 1,
      contradicted: 0,
      invented: 0,
      missed: 0
    });
    expect(scoreE4V3CommitmentSheet({ sheet: { no_change: true }, delta: GOLD }).counts.contradicted).toBe(1);
    expect(scoreE4V3CommitmentSheet({ sheet: {}, delta: noop }).counts.missed).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------
// Shared manifest fixtures (mirrors the learning-instrument test shapes).
// ---------------------------------------------------------------------------------------------

function fakeTask(
  taskIndex: number,
  input: { termination: string; fc: boolean; phase?: string; on_topic?: "on_topic" | "off_topic" | "not_applicable" | null }
): E4V2TaskRecord {
  return {
    task_index: taskIndex,
    op_kind: "rename_entity",
    opportunity_labels: ["drift_opportunity"],
    nl_request: "x",
    termination: input.termination,
    phase_at_termination: input.phase ?? "implementation",
    status: "complete",
    gate_events: { custody_failures: 0, discriminating_red_refusals: 0, refused_done_over_red: 0, red_check: null, parks: 0 },
    oracle: { delta_pass: 0, delta_total: 1, cumulative_pass: 0, cumulative_total: 1 },
    false_confidence: { event: input.fc, enforcement_outcome: null },
    archive: { attempted: false, change_name: null, archive_ok: false, failure_reason: null, survival_ledger: null },
    drift: {
      meter_version: "e4-drift-meter-v2",
      discrepancies: [],
      spec_unparseable: false,
      extraction_failed: false,
      registry_bypass: [],
      counts: {}
    },
    kill_score: { bank_id: "e4-adversarial-bank-v1", kill_score: 1, scenarios_total: 1, variants: [] },
    scenario_census: { spec_of_record_scenarios: 1, unbindable_scenarios: 0 },
    noticing_probe_answer: "No.",
    spec_touch: { touched: true, paths: [] },
    usage: {
      turns: 1,
      tokens: { fresh_input_tokens: 1, cached_input_tokens: 1, output_tokens: 1 },
      wall_clock_ms: 1,
      spend_usd: 0.01,
      by_phase: {
        spec: { turns: 1, tokens: { fresh_input_tokens: 1, cached_input_tokens: 1, output_tokens: 1 } },
        implementation: { turns: 0, tokens: { fresh_input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 } }
      }
    },
    probe_usage: null,
    snapshot: { hash: "x", path: "x" },
    executor_artifacts: [],
    pm_brief: { requested: false, first_turn: null },
    product_gate: null,
    on_topic:
      input.on_topic === undefined || input.on_topic === null
        ? null
        : { on_topic_id: "e4-on-topic-close-v3", classification: input.on_topic, matched_subjects: [], subject_count: 3 }
  } as unknown as E4V2TaskRecord;
}

function fakeManifest(arm: string, seed: number, tasks: E4V2TaskRecord[]): E4V2RunManifest {
  return {
    schema: "e4-v2-run-manifest",
    schema_version: 1,
    run_classification: "calibration",
    protocol_profile_id: "e4-openspec-workflow-v2",
    arm,
    arm_mode: arm === "e4_arm_0" ? "prose" : "executed",
    pairing_label: `pair-p0v-seed-${seed}`,
    model: { preset: "fake", model_id: "fake", route_id: "none" },
    compatibility_boundary: {
      constants_version: "0.7",
      constants_hash: "x",
      substrate_kind: "procedural-rest-v2",
      substrate_version: "procedural-rest-v2.3",
      meter_version: "e4-drift-meter-v2",
      converter_id: "e4-openspec-gherkin-v1",
      step_table_id: "e4-step-table-v1",
      t0_gold_spec_id: "e4-t0-gold-spec-v1",
      bank_id: "e4-adversarial-bank-v1",
      substrate_config: {
        substrate_config_id: "v2-default",
        substrate_seed: seed,
        task_count: tasks.length,
        op_mix: { weights: { drift_opportunity: 0.5, additive: 0.4, behavior_preserving: 0.1 } }
      }
    },
    initial_snapshot: { hash: "x", path: "x" },
    tasks,
    usage_totals: {
      turns: tasks.length,
      tokens: { fresh_input_tokens: 1, cached_input_tokens: 1, output_tokens: 1 },
      spend_usd: 0.03
    },
    replay_validity: { chain_replay_valid: true, substrate_regeneration_ok: true },
    status: "complete"
  } as unknown as E4V2RunManifest;
}
