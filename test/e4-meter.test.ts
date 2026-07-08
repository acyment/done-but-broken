// M2 acceptance (docs/e4/IMPLEMENTATION-PLAN.md §2 M2; architecture §6 Feature 2 + [R2: R2-1]
// identity-semantics rows). The known-drift fixture is hand-derived (test/fixtures/e4/known-drift/
// expected-discrepancies.json) independently of the meter's own output — this is what makes "zero
// false negatives" a real check, not a tautology.
import { describe, expect, test } from "bun:test";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { e4DriftMeterV1, METER_VERSION, runE4DriftMeterOnWorkspace } from "../src/e4/meter/meter";
import { classifyE4Drift } from "../src/e4/meter/classify";
import { extractSurfaceDump, parseSpecInventory } from "../src/e4/meter/extract";
import { truthInventory } from "../src/e4/meter/extract";
import { buildBaselineIr } from "../src/e4/substrate/ir";
import { buildE4WorkspaceFiles } from "../src/e4/substrate/scaffold";
import { computeE4DriftVelocity } from "../src/e4/result-schema";
import type { E4Discrepancy, E4TaskRecord } from "../src/e4/types";

const repoRoot = resolve(import.meta.dir, "..");
const knownDriftRoot = join(repoRoot, "test", "fixtures", "e4", "known-drift");
const twinRoot = join(repoRoot, "test", "fixtures", "e4", "known-drift-twin");

async function loadFixture(root: string) {
  const groundTruthIr = JSON.parse(await readFile(join(root, "ground-truth-ir.json"), "utf8"));
  const executorEvidence = JSON.parse(await readFile(join(root, "executor-evidence.json"), "utf8"));
  const renameLineage = JSON.parse(await readFile(join(root, "rename-lineage.json"), "utf8"));
  return { groundTruthIr, executorEvidence, renameLineage, workspaceDir: join(root, "workspace") };
}

function discrepancyKey(d: { kind: string; class: string; direction: string; item_id: string; semantic_item_uid: string }): string {
  return `${d.kind}|${d.class}|${d.direction}|${d.item_id}|${d.semantic_item_uid}`;
}

describe("Feature 2 — Zero false negatives on the known-drift fixture", () => {
  test("every discrepancy in expected-discrepancies.json is reported with matching kind/class/direction/item_id/semantic_item_uid", async () => {
    const fixture = await loadFixture(knownDriftRoot);
    const expected = JSON.parse(await readFile(join(knownDriftRoot, "expected-discrepancies.json"), "utf8"));

    const report = await runE4DriftMeterOnWorkspace(fixture);
    const reportedKeys = new Set(report.discrepancies.map(discrepancyKey));

    for (const expectedDiscrepancy of expected.discrepancies) {
      expect(reportedKeys.has(discrepancyKey(expectedDiscrepancy))).toBe(true);
    }

    // Also exact-count: no unexpected extras beyond what was planted (a stronger bar than the
    // Gherkin's "every expected discrepancy is reported" alone).
    expect(report.discrepancies).toHaveLength(expected.discrepancies.length);
  });

  test("registry bypass is recorded exactly where planted", async () => {
    const fixture = await loadFixture(knownDriftRoot);
    const expected = JSON.parse(await readFile(join(knownDriftRoot, "expected-discrepancies.json"), "utf8"));

    const report = await runE4DriftMeterOnWorkspace(fixture);

    expect(report.registry_bypass).toEqual(expected.expected_registry_bypass);
  });
});

describe("Feature 2 — Zero false positives on the in-sync twin", () => {
  test("the clean twin reports zero discrepancies", async () => {
    const fixture = await loadFixture(twinRoot);
    const report = await runE4DriftMeterOnWorkspace(fixture);

    expect(report.discrepancies).toEqual([]);
    expect(report.registry_bypass).toEqual([]);
    expect(report.spec_unparseable).toBe(false);
    expect(report.extraction_failed).toBe(false);
  });
});

describe("Feature 2 — Registry bypass is reconciled, not missed", () => {
  test("the bypassed endpoint is attributed to the conventions channel, never reported as a plain endpoint gap", async () => {
    const fixture = await loadFixture(knownDriftRoot);
    const report = await runE4DriftMeterOnWorkspace(fixture);

    const endpointDiscrepanciesForBypassedRoute = report.discrepancies.filter(
      (d) => d.kind === "endpoint" && d.item_id === "endpoint:Category:analytics"
    );
    const conventionDiscrepancyForBypassedRoute = report.discrepancies.find(
      (d) => d.kind === "convention" && d.item_id === "endpoint:Category:analytics"
    );

    expect(endpointDiscrepanciesForBypassedRoute).toEqual([]);
    expect(conventionDiscrepancyForBypassedRoute).toBeDefined();
    expect(conventionDiscrepancyForBypassedRoute?.direction).toBe("code_vs_truth");
  });
});

describe("Feature 2 — Broken surface dump fails closed", () => {
  test("a workspace whose registry export is removed reports extraction_failed and no code-side inventory, never a crash", async () => {
    const scratchDir = join(repoRoot, "tmp", "e4-meter-test-broken-registry");
    await rm(scratchDir, { recursive: true, force: true });
    const ir = buildBaselineIr();
    const files = buildE4WorkspaceFiles(ir);

    for (const [rel, content] of Object.entries(files)) {
      const full = join(scratchDir, rel);
      await Bun.write(full, content);
    }
    await writeFile(join(scratchDir, "registry.ts"), "// the agent deleted the registry export\n");

    const report = await runE4DriftMeterOnWorkspace({
      workspaceDir: scratchDir,
      groundTruthIr: ir,
      executorEvidence: { endpoints: [] },
      renameLineage: []
    });

    expect(report.extraction_failed).toBe(true);
    expect(report.discrepancies.some((d) => d.direction === "code_vs_truth")).toBe(false);

    await rm(scratchDir, { recursive: true, force: true });
  });

  test("a spec artifact that isn't valid JSON reports spec_unparseable, never a crash", () => {
    const inventory = parseSpecInventory({ openapi_json: "{ not valid json", conventions_md: "" });

    expect(inventory).toEqual({ spec_unparseable: true });
  });
});

describe("Feature 2 — Meter version is stamped and frozen", () => {
  test("every classification carries the same meter_version, matching the meter's own declared version", async () => {
    const fixture = await loadFixture(knownDriftRoot);
    const report = await runE4DriftMeterOnWorkspace(fixture);

    expect(report.meter_version).toBe(METER_VERSION);
    expect(report.meter_version).toBe(e4DriftMeterV1.meter_version);
  });
});

describe("[R2: R2-1] identity-semantics rows resolve to their pinned episode counts", () => {
  const NO_AGGREGATION = { convention_aggregation_min_items: 3 };

  function taskRecordFromDiscrepancies(taskIndex: number, discrepancies: E4Discrepancy[]): E4TaskRecord {
    return {
      task_index: taskIndex,
      opportunity_labels: ["drift_opportunity"],
      termination: "done",
      phase_at_termination: "implementation",
      gate_events: null,
      oracle: { delta_pass: 1, delta_total: 1, cumulative_pass: taskIndex, cumulative_total: taskIndex },
      false_confidence: { event: false, enforcement_outcome: null },
      smoke_feedback_runs: 1,
      drift: {
        meter_version: METER_VERSION,
        discrepancies,
        spec_unparseable: false,
        extraction_failed: false,
        registry_bypass: [],
        counts: {
          endpoint: { contradiction: 0, coverage_gap: 0, stale_claim: 0 },
          entity: { contradiction: 0, coverage_gap: 0, stale_claim: 0 },
          field: { contradiction: 0, coverage_gap: 0, stale_claim: 0 },
          validation_rule: { contradiction: 0, coverage_gap: 0, stale_claim: 0 },
          convention: { contradiction: 0, coverage_gap: 0, stale_claim: 0 }
        }
      },
      noticing_probe_answer: "n/a",
      spec_touch: { touched: false, paths: [] },
      usage: {
        turns: 1,
        tokens: { fresh_input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 },
        wall_clock_ms: 0,
        spend_usd: 0,
        by_phase: {
          spec: { turns: 0, tokens: { fresh_input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 }, wall_clock_ms: 0 },
          implementation: {
            turns: 1,
            tokens: { fresh_input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 },
            wall_clock_ms: 0
          }
        },
        gate_executor: null
      },
      snapshot: { hash: `hash-${taskIndex}`, path: `fixture/task-${taskIndex}` },
      executor_artifacts: [],
      status: "complete",
      classification_rationale: null
    };
  }

  test("missed rename: the real meter's reconciled pair resolves to ONE episode", async () => {
    const fixture = await loadFixture(knownDriftRoot);
    const report = await runE4DriftMeterOnWorkspace(fixture);
    const renamePairDiscrepancies = report.discrepancies.filter(
      (d) => d.semantic_item_uid === "uid-fx-field-widget-in-stock"
    );

    expect(renamePairDiscrepancies).toHaveLength(2); // the coverage_gap + stale_claim pair

    const result = computeE4DriftVelocity(
      [taskRecordFromDiscrepancies(1, []), taskRecordFromDiscrepancies(2, renamePairDiscrepancies)],
      NO_AGGREGATION
    );

    expect(result.episode_onset_count).toBe(1);
  });

  test("delete-then-re-add: the real meter's two independent identities resolve to TWO episodes", async () => {
    const fixture = await loadFixture(knownDriftRoot);
    const report = await runE4DriftMeterOnWorkspace(fixture);
    const deleteThenReaddDiscrepancies = report.discrepancies.filter(
      (d) => d.item_id === "field:Widget.notes" || d.item_id === "field:Widget.category_id"
    );

    expect(deleteThenReaddDiscrepancies).toHaveLength(2);
    expect(new Set(deleteThenReaddDiscrepancies.map((d) => d.semantic_item_uid)).size).toBe(2); // distinct UIDs

    const result = computeE4DriftVelocity(
      [taskRecordFromDiscrepancies(1, []), taskRecordFromDiscrepancies(2, deleteThenReaddDiscrepancies)],
      NO_AGGREGATION
    );

    expect(result.episode_onset_count).toBe(2);
  });

  test("fix-then-regress: a full extract→classify pipeline run 3 times (discrepant, resolved, discrepant again) yields TWO episodes", () => {
    const truthIrV1 = buildBaselineIr();
    const specArtifacts = buildE4WorkspaceFiles(truthIrV1);

    // Task 1: spec is stale (still says "in_stock"); truth already renamed it to "available".
    const truthIrRenamed = {
      ...truthIrV1,
      entities: truthIrV1.entities.map((entity: any) =>
        entity.name === "Widget"
          ? { ...entity, fields: entity.fields.map((f: any) => (f.name === "in_stock" ? { ...f, name: "available" } : f)) }
          : entity
      )
    };
    const staleTriple = {
      spec: parseSpecInventory({
        openapi_json: specArtifacts["specs/openapi.json"],
        conventions_md: specArtifacts["specs/CONVENTIONS.md"]
      }),
      code: { extraction_failed: true, reason: "not exercised in this test" },
      truth: truthInventory(truthIrRenamed)
    };
    const task1 = classifyE4Drift({
      triple: staleTriple,
      executorEvidence: { endpoints: [] },
      renameLineage: [{ old_item_id: "field:Widget.in_stock", new_item_id: "field:Widget.available", semantic_item_uid: "uid-base-field-widget-in-stock" }],
      meterVersion: METER_VERSION
    });

    // Task 2: agent fixes the spec (renders it from the same renamed truth) — resolved.
    const fixedSpecArtifacts = buildE4WorkspaceFiles(truthIrRenamed);
    const fixedTriple = {
      spec: parseSpecInventory({
        openapi_json: fixedSpecArtifacts["specs/openapi.json"],
        conventions_md: fixedSpecArtifacts["specs/CONVENTIONS.md"]
      }),
      code: { extraction_failed: true, reason: "not exercised in this test" },
      truth: truthInventory(truthIrRenamed)
    };
    const task2 = classifyE4Drift({ triple: fixedTriple, executorEvidence: { endpoints: [] }, renameLineage: [], meterVersion: METER_VERSION });

    // Task 3: agent's spec regresses again (reverts to the stale copy) — a NEW onset.
    const task3 = classifyE4Drift({
      triple: staleTriple,
      executorEvidence: { endpoints: [] },
      renameLineage: [{ old_item_id: "field:Widget.in_stock", new_item_id: "field:Widget.available", semantic_item_uid: "uid-base-field-widget-in-stock" }],
      meterVersion: METER_VERSION
    });

    const records = [
      taskRecordFromDiscrepancies(1, task1.discrepancies),
      taskRecordFromDiscrepancies(2, task2.discrepancies),
      taskRecordFromDiscrepancies(3, task3.discrepancies)
    ];

    const result = computeE4DriftVelocity(records, NO_AGGREGATION);

    expect(task2.discrepancies).toEqual([]); // genuinely resolved at task 2
    expect(result.episode_onset_count).toBe(2);
  });
});

describe("M2 — constants lineage (§4, sealed at M2 → v0.2)", () => {
  test("the sealed meter_version and convention_aggregation_min_items match the running code", async () => {
    const { validateE4Constants } = await import("../src/e4/constants");
    const draftPath = join(repoRoot, "docs", "protocols", "e4-sealed-constants-v0.json");
    const constants = validateE4Constants(JSON.parse(await readFile(draftPath, "utf8")));

    expect(constants.compatibility_boundary.meter_version).toBe(METER_VERSION);
    expect(constants.meter_rules.convention_aggregation_min_items).toBe(3);
  });
});
