// v2-M4 ACCEPTANCE (E4V2 design §7/§7.5 + §5.5 verification split "v2-M4 calibration"): the
// re-pointed drift meter (code channel unchanged, spec channel = scenario execution vs gold with
// the amended stale_claim rule, convention coverage = error_format only), the IR-generated
// adversarial bank, the kill-score instrument, and the calibration checks — the T0 gold
// spec-of-record kills the FULL bank (score 1.0, wrong-filter dying specifically to the
// filtered-list count under heterogeneous seeds) and the meter reports ZERO spec-side
// discrepancies at T0.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { buildBaselineIr, createUidMinter, type E4SchemaIR } from "../src/e4/substrate/ir";
import { createSequenceState } from "../src/e4/substrate/ops";
import { E4_OPS_V2 } from "../src/e4/substrate/v2/ops";
import { buildE4V2AppFiles } from "../src/e4/substrate/v2/scaffold";
import {
  E4_V2_BANK_VARIANT_IDS,
  buildE4V2BankVariantFiles,
  runE4V2KillScore
} from "../src/e4/v2/bank";
import { allScenarioRefs, deriveSpecOfRecord } from "../src/e4/v2/gold-spec";
import {
  METER_VERSION_V2,
  classifyE4V2SpecChannel,
  matchTruthEndpoint,
  runE4V2DriftMeter
} from "../src/e4/v2/meter";
import { renderCapabilitySpecMarkdown, buildE4V2WorkspaceFiles } from "../src/e4/v2/workspace";
import type { E4ExecutorConfig } from "../src/e4/oracle-executor";
import type { E4ExecutorEvidence } from "../src/e4/types";
import { indexQueuePrng } from "./support/e4-v2-helpers";

const EXEC_CONFIG: E4ExecutorConfig = {
  readiness_timeout_ms: 15_000,
  request_timeout_ms: 3_000,
  readiness_poll_interval_ms: 25
};

const NO_EVIDENCE: E4ExecutorEvidence = { endpoints: [] };

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

async function writeWorkspace(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "e4-v2-meter-"));
  tempRoots.push(dir);

  for (const [path, contents] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), contents);
  }

  return dir;
}

function specSide(report: { discrepancies: Array<{ direction: string }> }) {
  return report.discrepancies.filter((discrepancy) => discrepancy.direction === "spec_vs_truth");
}

describe("v2-M4 — §5.5 calibration: the meter at T0", () => {
  test("zero spec-side discrepancies and zero code-side discrepancies on the pristine T0 workspace", async () => {
    const baseline = buildBaselineIr();
    const dir = await writeWorkspace(buildE4V2WorkspaceFiles(baseline));
    const report = await runE4V2DriftMeter({
      workspaceDir: dir,
      groundTruthIr: baseline,
      executorEvidence: NO_EVIDENCE,
      renameLineage: [],
      executorConfig: EXEC_CONFIG,
      concurrency: 6
    });

    expect(report.meter_version).toBe(METER_VERSION_V2);
    expect(report.spec_unparseable).toBe(false);
    expect(report.extraction_failed).toBe(false);
    expect(report.discrepancies).toEqual([]);
  }, 120_000);
});

describe("v2-M4 — spec channel classification (§7.5 as amended)", () => {
  test("a missed rename lands as stale_claim (lineage-merged identity) + coverage_gap sharing the endpoint uid", async () => {
    const baseline = buildBaselineIr();
    const renamed = E4_OPS_V2.rename_entity.apply(baseline, createUidMinter(), indexQueuePrng([1, 0]), createSequenceState());
    // The agent implemented the rename in code but never touched the spec: workspace = post-op
    // gold app + STALE T0 spec-of-record.
    const t0Files = buildE4V2WorkspaceFiles(baseline);
    const staleSpecFiles = Object.fromEntries(Object.entries(t0Files).filter(([path]) => path.startsWith("openspec/")));
    const dir = await writeWorkspace({ ...buildE4V2AppFiles(renamed.ir), ...staleSpecFiles });

    const lineage = renamed.rename_lineage.map((entry) => ({ ...entry }));
    const report = await runE4V2DriftMeter({
      workspaceDir: dir,
      groundTruthIr: renamed.ir,
      executorEvidence: NO_EVIDENCE,
      renameLineage: lineage,
      executorConfig: EXEC_CONFIG,
      concurrency: 6
    });

    const spec = specSide(report);
    const staleClaims = spec.filter((discrepancy) => discrepancy.class === "stale_claim");
    const coverageGaps = spec.filter((discrepancy) => discrepancy.class === "coverage_gap" && discrepancy.kind === "endpoint");

    // Every stale /widgets request resolves through the endpoint-level lineage to a REAL uid —
    // the same uid its coverage_gap twin carries, so episode keying merges them to one onset.
    expect(staleClaims.length).toBeGreaterThan(0);
    expect(staleClaims.every((discrepancy) => discrepancy.item_id.startsWith("endpoint:"))).toBe(true);
    expect(staleClaims.every((discrepancy) => discrepancy.semantic_item_uid.startsWith("uid-base-endpoint-widget"))).toBe(true);

    const staleUids = new Set(staleClaims.map((discrepancy) => discrepancy.semantic_item_uid));
    const gapUids = new Set(coverageGaps.map((discrepancy) => discrepancy.semantic_item_uid));
    expect([...staleUids].some((uid) => gapUids.has(uid))).toBe(true);
  }, 120_000);

  test("Amendment 2: a retirement tombstone that PASSES against gold is never a discrepancy", async () => {
    const baseline = buildBaselineIr();
    const state = createSequenceState();
    const minter = createUidMinter();
    const added = E4_OPS_V2.add_entity.apply(baseline, minter, indexQueuePrng([0]), state);
    const deleted = E4_OPS_V2.delete_entity.apply(added.ir, minter, indexQueuePrng([0]), state);

    // The spec-of-record correctly carries the tombstone (derived through the §5.5 pair chain).
    const t0Spec = deriveSpecOfRecord(baseline, null);
    const specAfterAdd = deriveSpecOfRecord(added.ir, t0Spec);
    const specAfterDelete = deriveSpecOfRecord(deleted.ir, specAfterAdd);
    const files: Record<string, string> = { ...buildE4V2AppFiles(deleted.ir) };

    for (const capability of specAfterDelete.capabilities) {
      files[`openspec/specs/${capability.name}/spec.md`] = renderCapabilitySpecMarkdown(capability);
    }

    const dir = await writeWorkspace(files);
    const report = await runE4V2DriftMeter({
      workspaceDir: dir,
      groundTruthIr: deleted.ir,
      executorEvidence: NO_EVIDENCE,
      renameLineage: [],
      executorConfig: EXEC_CONFIG,
      concurrency: 6
    });

    // The tombstone's GET /suppliers matches no truth route AND passes (404 + envelope) — truth,
    // not staleness; the whole report is clean.
    expect(specSide(report)).toEqual([]);
  }, 120_000);

  test("a scenario contradicting live surface lands as contradiction attributed to the matched endpoint uid", () => {
    const baseline = buildBaselineIr();
    const discrepancies = classifyE4V2SpecChannel({
      scenarios: [
        {
          title: "Wrong count expectation",
          steps: [
            { kind: "request", method: "GET", path: "/widgets" },
            { kind: "assert_status", status: 200 },
            { kind: "assert_list_length", length: 99 }
          ]
        }
      ],
      verdicts: [{ passed: false }],
      groundTruthIr: baseline,
      renameLineage: []
    });

    const contradiction = discrepancies.find((discrepancy) => discrepancy.class === "contradiction");
    expect(contradiction?.kind).toBe("endpoint");
    expect(contradiction?.item_id).toBe("endpoint:Widget:list");
    expect(contradiction?.semantic_item_uid).toBe("uid-base-endpoint-widget-list");
  });

  test("an uncovered truth endpoint is a coverage_gap; an uncovered error_format convention is a convention coverage_gap", () => {
    const baseline = buildBaselineIr();
    // One passing scenario covering only the Widget list endpoint, asserting no envelope shape.
    const discrepancies = classifyE4V2SpecChannel({
      scenarios: [
        {
          title: "List only",
          steps: [
            { kind: "request", method: "GET", path: "/widgets" },
            { kind: "assert_status", status: 200 },
            { kind: "assert_list_length", length: 2 }
          ]
        }
      ],
      verdicts: [{ passed: true }],
      groundTruthIr: baseline,
      renameLineage: []
    });

    const gapIds = discrepancies.filter((discrepancy) => discrepancy.class === "coverage_gap").map((discrepancy) => discrepancy.item_id);

    expect(gapIds).toContain("endpoint:Widget:create");
    expect(gapIds).toContain("endpoint:Category:read");
    expect(gapIds).not.toContain("endpoint:Widget:list");
    expect(gapIds).toContain("convention:error-format");
    // naming/command/structural conventions are code-side-only in v2 (§7.5 scope clarification).
    expect(gapIds).not.toContain("convention:naming-endpoints");
    expect(gapIds).not.toContain("convention:cmd-test");
    expect(gapIds).not.toContain("convention:structural-storage");
    // field/validation_rule kinds carry zero spec-side counts (recorded limitation).
    expect(discrepancies.every((discrepancy) => discrepancy.kind === "endpoint" || discrepancy.kind === "convention")).toBe(true);
  });

  test("dispatcher matching: literal-segment specificity and param/placeholder semantics", () => {
    const baseline = buildBaselineIr();

    expect(matchTruthEndpoint({ method: "GET", path: "/widgets/stats" }, baseline.endpoints)?.kind).toBe("analytics");
    expect(matchTruthEndpoint({ method: "GET", path: "/widgets/widget-spec-1" }, baseline.endpoints)?.kind).toBe("read");
    expect(matchTruthEndpoint({ method: "GET", path: "/widgets?category_id=x" }, baseline.endpoints)?.kind).toBe("list");
    expect(matchTruthEndpoint({ method: "GET", path: "/widgets/{new_id}" }, baseline.endpoints)?.kind).toBe("read");
    expect(matchTruthEndpoint({ method: "PATCH", path: "/widgets/w1" }, baseline.endpoints)).toBeNull();
    expect(matchTruthEndpoint({ method: "GET", path: "/gone" }, baseline.endpoints)).toBeNull();
  });

  test("the code channel is the v1 machinery: a registry/schema corruption fails closed as extraction_failed", async () => {
    const baseline = buildBaselineIr();
    const files = buildE4V2WorkspaceFiles(baseline);
    files["registry.ts"] = "export const wrongExport = [];\n";
    const dir = await writeWorkspace(files);

    const report = await runE4V2DriftMeter({
      workspaceDir: dir,
      groundTruthIr: baseline,
      executorEvidence: NO_EVIDENCE,
      renameLineage: [],
      executorConfig: EXEC_CONFIG,
      concurrency: 6
    });

    expect(report.extraction_failed).toBe(true);
    expect(specSide(report)).toEqual([]); // the spec side is independent and still clean
  }, 120_000);

  test("unbindable spec-of-record scenarios set the spec_unparseable diagnostic and are skipped", async () => {
    const baseline = buildBaselineIr();
    const files = buildE4V2WorkspaceFiles(baseline);
    files["openspec/specs/widgets/spec.md"] += [
      "",
      "### Requirement: Vague behavior",
      "The service SHALL behave vaguely.",
      "",
      "#### Scenario: Unbindable vagueness",
      "- **WHEN** something vague happens",
      "- **THEN** it works",
      ""
    ].join("\n");
    const dir = await writeWorkspace(files);

    const report = await runE4V2DriftMeter({
      workspaceDir: dir,
      groundTruthIr: baseline,
      executorEvidence: NO_EVIDENCE,
      renameLineage: [],
      executorConfig: EXEC_CONFIG,
      concurrency: 6
    });

    expect(report.spec_unparseable).toBe(true);
    expect(specSide(report)).toEqual([]); // the bindable T0 set still covers everything
  }, 120_000);
});

describe("v2-M4 — adversarial bank + kill score (§7, A1)", () => {
  test("§5.5 calibration: the T0 gold spec-of-record kills the FULL bank — score 1.0, variant by variant", async () => {
    const baseline = buildBaselineIr();
    const scenarios = allScenarioRefs(deriveSpecOfRecord(baseline, null)).map((ref) => ref.scenario);
    const report = await runE4V2KillScore({
      groundTruthIr: baseline,
      scenarios,
      executorConfig: EXEC_CONFIG,
      concurrency: 6
    });

    expect(report.kill_score).toBe(1);
    expect(report.variants).toHaveLength(E4_V2_BANK_VARIANT_IDS.length);

    for (const variant of report.variants) {
      expect(variant.killed).toBe(true);
    }

    // The wrong-filter variant must die to the filtered-list count under heterogeneous seeds —
    // the exact defect Amendment 2's §5.6.6 fixed (under uniform seed refs the filtered and
    // unfiltered counts coincide and this variant is unkillable at T0).
    const wrongFilter = report.variants.find((variant) => variant.variant_id === "wrong-filter")!;
    expect(wrongFilter.failing_scenario_titles).toEqual(["Filtering widgets by category_id returns only matching rows"]);
  }, 240_000);

  test("bank generation is deterministic and anchored fail-loud", () => {
    const baseline = buildBaselineIr();

    for (const variantId of E4_V2_BANK_VARIANT_IDS) {
      const a = buildE4V2BankVariantFiles(baseline, variantId);
      const b = buildE4V2BankVariantFiles(baseline, variantId);
      expect(a["server.ts"]).toBe(b["server.ts"]);
      expect(a["server.ts"]).not.toBe(buildE4V2AppFiles(baseline)["server.ts"]);
    }
  });

  test("a weak (status-only-ish) scenario set scores low: the strength instrument discriminates", async () => {
    const baseline = buildBaselineIr();
    // A lazy-but-floor-passing set: status + a single weak value binding on the list length,
    // never touching validation, mutation consequences, echoes, or filters.
    const weakScenarios = [
      {
        title: "The list endpoint answers",
        steps: [
          { kind: "request", method: "GET", path: "/widgets" },
          { kind: "assert_status", status: 200 },
          { kind: "assert_list_length", length: 2 }
        ]
      }
    ] as never[];

    const report = await runE4V2KillScore({
      groundTruthIr: baseline,
      scenarios: weakScenarios,
      executorConfig: EXEC_CONFIG,
      concurrency: 6
    });

    expect(report.kill_score).toBeLessThanOrEqual(1 / 6 + 0.0001);
  }, 240_000);
});
