// §5.7 Amendment 3 census (the amendment's acceptance criterion, alongside the unchanged v2-M0
// sweep in e4-v2-census.test.ts): the naturalized substrate behaves like a real data migration —
// stored ids/values survive renames, ref keys cascade, backfills/conversions are disclosed via
// the PM brief, minted paths use the sealed English pluralizer, and the gold implementation plus
// carried fixture stay self-consistent (the gold server passes the carried-fixture-derived
// hidden suite) at EVERY checkpoint of drawn chains covering the drift-relevant op kinds.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { buildBaselineIr, type E4SchemaIR } from "../src/e4/substrate/ir";
import type { E4Prng } from "../src/e4/substrate/prng";
import { E4_OPS_V2, SUBSTRATE_VERSION_V2 } from "../src/e4/substrate/v2/ops";
import { pluralizeEntityName } from "../src/e4/substrate/v2/pluralize";
import {
  RETYPE_DATE_LITERAL_V2,
  carryForwardSeedFixturesV2,
  convertStoredValueV2,
  migrateSeedFixtureV2
} from "../src/e4/substrate/v2/fixture";
import { generateCumulativeTestsV2, generateSeedFixtureV2 } from "../src/e4/substrate/v2/testgen";
import { buildE4V2AppFiles } from "../src/e4/substrate/v2/scaffold";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants } from "../src/e4/v2/constants";
import { e4ProceduralRestV2Provider } from "../src/e4/substrate/v2/provider";
import { runE4OracleExecutor, type E4ExecutorConfig } from "../src/e4/oracle-executor";
import { createSequenceState } from "../src/e4/substrate/ops";
import { computeE4TaskDelta } from "../src/e4/v3/task-delta";
import { renderE4PmBrief } from "../src/e4/v3/pm-brief";
import { tagE4RequestDeterminacy, underdeterminedFacts } from "../src/e4/v3/ambiguity";

const repoRoot = resolve(import.meta.dir, "..");
const scratchRoot = join(repoRoot, "tmp", "e4-v2-naturalization-tests");

const EXECUTOR_CONFIG: E4ExecutorConfig = {
  readiness_timeout_ms: 10_000,
  request_timeout_ms: 5_000,
  readiness_poll_interval_ms: 25
};

afterAll(async () => {
  await rm(scratchRoot, { recursive: true, force: true });
});

// A prng stub whose pick() consults a queue of choosers; next()/nextInt()/shuffle() throw — the
// ops under test only pick.
function stubPrng(pickers: Array<(candidates: unknown[]) => unknown>): E4Prng {
  let index = 0;
  const unused = (): never => {
    throw new Error("stub prng: unexpected call");
  };

  return {
    next: unused,
    nextInt: unused,
    shuffle: unused,
    pick: <T>(candidates: T[]): T => {
      const picker = pickers[index];
      index += 1;

      if (!picker) {
        throw new Error(`stub prng: pick #${index} not scripted`);
      }

      return picker(candidates as unknown[]) as T;
    }
  } as E4Prng;
}

const minter = () => {
  let n = 0;
  return { mint: (kind: string) => `uid-test-${kind}-${(n += 1)}` };
};

function applyRename(ir: E4SchemaIR, entityName: string, newName: string) {
  return E4_OPS_V2.rename_entity.apply(
    ir,
    minter(),
    stubPrng([
      (entities) => (entities as Array<{ name: string }>).find((entity) => entity.name === entityName),
      (names) => (names as string[]).find((name) => name === newName) ?? (names as string[])[0]
    ]),
    createSequenceState()
  );
}

describe("§5.7.1 — sealed English pluralizer", () => {
  test("pluralizes naturally and reproduces the T0 baseline segments byte-identically", () => {
    expect(pluralizeEntityName("Entry")).toBe("entries");
    expect(pluralizeEntityName("Category")).toBe("categories");
    expect(pluralizeEntityName("Listing")).toBe("listings");
    expect(pluralizeEntityName("Warehouse")).toBe("warehouses");
    expect(pluralizeEntityName("Widget")).toBe("widgets");
    expect(pluralizeEntityName("Asset")).toBe("assets");

    const baseline = buildBaselineIr();
    const segments = new Set(baseline.endpoints.map((endpoint) => endpoint.path.split("/")[1]));
    for (const entity of baseline.entities) {
      expect(segments.has(pluralizeEntityName(entity.name))).toBe(true);
    }
  });

  test("rename_entity moves paths to the pluralized segment; add_endpoint mints on it too", () => {
    const baseline = buildBaselineIr();
    const renamed = applyRename(baseline, "Widget", "Entry");
    const entryPaths = renamed.ir.endpoints.filter((e) => e.entity === "Entry").map((e) => e.path);

    expect(entryPaths.every((path) => path.startsWith("/entries"))).toBe(true);

    const withStats = E4_OPS_V2.add_endpoint.apply(
      renamed.ir,
      minter(),
      stubPrng([(candidates) => (candidates as Array<{ entity: { name: string } }>).find((c) => c.entity.name === "Category")]),
      createSequenceState()
    );
    const stats = withStats.ir.endpoints.find((endpoint) => endpoint.kind === "analytics" && endpoint.entity === "Category");

    expect(stats?.path).toBe("/categories/stats"); // NOT /categorys/stats (the seed-41 trap)
  });

  test("the version string marks the naturalization boundary (v2.2 = E5 P0-V phrasing repair)", () => {
    expect(SUBSTRATE_VERSION_V2).toBe("procedural-rest-v2.2");
  });
});

describe("§5.7.2/§5.7.3 — seed data carries forward through renames", () => {
  test("stored ids, ref values, and field values survive an entity rename; ref keys cascade with lineage", () => {
    const baseline = buildBaselineIr();
    const t0 = generateSeedFixtureV2(baseline);
    const renamed = applyRename(baseline, "Category", "Listing");
    const migrated = migrateSeedFixtureV2(t0, baseline, renamed.ir);

    // Fixture key follows the entity; stored ids keep their creation-time prefix.
    expect(Object.keys(migrated).toSorted()).toEqual(["Listing", "Widget"]);
    expect(migrated.Listing.map((row) => row.id)).toEqual(["category-seed-1", "category-seed-2"]);

    // The ref KEY cascades (category_id -> listing_id); its VALUES do not move.
    expect(migrated.Widget[0].listing_id).toBe("category-seed-1");
    expect(migrated.Widget[0].category_id).toBeUndefined();
    expect(renamed.rename_lineage.some((entry) => entry.old_item_id.includes("category_id") && entry.new_item_id.includes("listing_id"))).toBe(
      true
    );

    // The hidden suite requests the CARRIED id at the NEW pluralized path.
    const tests = generateCumulativeTestsV2(renamed.ir, migrated);
    const read = tests.find((candidate) => candidate.test_id === "Listing-read");
    expect(read?.request.path).toBe("/listings/category-seed-1");
    expect((read?.expected.body as Record<string, unknown>).id).toBe("category-seed-1");

    // Filtered list binds to the carried parent id, not a re-derived one.
    const filtered = tests.find((candidate) => candidate.test_id === "Widget-list-filtered");
    expect(filtered?.request.path).toBe("/widgets?listing_id=category-seed-1");
  });

  test("rename_field keeps stored values (no Sample re-derivation)", () => {
    const baseline = buildBaselineIr();
    const t0 = generateSeedFixtureV2(baseline);
    const result = E4_OPS_V2.rename_field.apply(
      baseline,
      minter(),
      stubPrng([
        (candidates) =>
          (candidates as Array<{ entity: { name: string }; field: { name: string } }>).find(
            (c) => c.entity.name === "Category" && c.field.name === "name"
          ),
        (names) => (names as string[]).find((name) => name === "alias") ?? (names as string[])[0]
      ]),
      createSequenceState()
    );
    const migrated = migrateSeedFixtureV2(t0, baseline, result.ir);

    expect(migrated.Category[0].alias).toBe(t0.Category[0].name); // value untouched, key renamed
  });

  test("sealed stored-value conversions: identity, truncation, disclosed literals", () => {
    expect(convertStoredValueV2(3, "int", "decimal")).toBe(3);
    expect(convertStoredValueV2(1.5, "decimal", "int")).toBe(1);
    expect(convertStoredValueV2(-1.5, "decimal", "int")).toBe(-1);
    expect(convertStoredValueV2("Sample name 1", "string", "date")).toBe(RETYPE_DATE_LITERAL_V2);
    expect(convertStoredValueV2(false, "bool", "string")).toBe("false");
    expect(convertStoredValueV2("2026-01-01", "date", "string")).toBe("2026-01-01");
    expect(() => convertStoredValueV2("x", "string", "int" as never)).toThrow(/unsupported/);
  });

  test("added entities start with NO rows and the suite re-anchors on oracle-created fixtures", () => {
    const baseline = buildBaselineIr();
    const t0 = generateSeedFixtureV2(baseline);
    const result = E4_OPS_V2.add_entity.apply(
      baseline,
      minter(),
      stubPrng([(names) => (names as string[]).find((name) => name === "Promotion") ?? (names as string[])[0]]),
      createSequenceState()
    );
    const migrated = migrateSeedFixtureV2(t0, baseline, result.ir);

    expect(migrated.Promotion).toEqual([]);

    const tests = generateCumulativeTestsV2(result.ir, migrated);
    const read = tests.find((candidate) => candidate.test_id === "Promotion-read");
    const create2 = tests.find((candidate) => candidate.test_id === "Promotion-create-2");
    const del = tests.find((candidate) => candidate.test_id === "Promotion-delete");

    expect(read?.request.path).toBe("/promotions/promotion-new-1");
    expect(create2).toBeDefined();
    expect(del?.request.path).toBe("/promotions/promotion-new-2");
  });
});

describe("§5.7.4 — the PM brief discloses every fixture-migration duty", () => {
  test("add_field: null backfill line; retype string→date: the sealed literal line", () => {
    const baseline = buildBaselineIr();
    const addField = E4_OPS_V2.add_field.apply(
      baseline,
      minter(),
      stubPrng([
        (entities) => (entities as Array<{ name: string }>).find((entity) => entity.name === "Widget"),
        (candidates) => (candidates as Array<{ name: string }>).find((c) => c.name === "description") ?? (candidates as unknown[])[0]
      ]),
      createSequenceState()
    );
    const addDelta = computeE4TaskDelta(baseline, addField.ir);
    const addBrief = renderE4PmBrief({ opKind: "add_field", delta: addDelta });

    expect(addBrief.text).toContain("Existing Widget records carry description = null until they are updated.");
    expect(addBrief.covered.some((entry) => entry.fact_kind === "fixture_migration")).toBe(true);

    const retype = E4_OPS_V2.retype_field.apply(
      baseline,
      minter(),
      stubPrng([
        (candidates) =>
          (candidates as Array<{ entity: { name: string }; field: { name: string } }>).find(
            (c) => c.entity.name === "Category" && c.field.name === "name"
          ),
        (types) => (types as string[]).find((t) => t === "date") ?? (types as string[])[0]
      ]),
      createSequenceState()
    );
    const retypeDelta = computeE4TaskDelta(baseline, retype.ir);
    const retypeBrief = renderE4PmBrief({ opKind: "retype_field", delta: retypeDelta });

    expect(retypeBrief.text).toContain(`Existing Category.name values are reset to ${RETYPE_DATE_LITERAL_V2}.`);

    // The determinacy census invariant holds for the new fact kind: every underdetermined fact
    // is brief-covered.
    const facts = tagE4RequestDeterminacy({ opKind: "retype_field", namesItemVerbatim: true, delta: retypeDelta });
    const covered = new Set(retypeBrief.covered.map((entry) => `${entry.fact_kind}:${entry.subject}`));
    for (const fact of underdeterminedFacts(facts)) {
      expect(covered.has(`${fact.fact_kind}:${fact.subject}`)).toBe(true);
    }
  });

  test("add_relationship: positional linking line + carried backfill row-n → parent-row-n", () => {
    const baseline = buildBaselineIr();
    const t0 = generateSeedFixtureV2(baseline);
    const result = E4_OPS_V2.add_relationship.apply(
      baseline,
      minter(),
      stubPrng([
        (pairs) =>
          (pairs as Array<{ from: { name: string }; to: { name: string } }>).find(
            (pair) => pair.from.name === "Category" && pair.to.name === "Widget"
          )
      ]),
      createSequenceState()
    );
    const migrated = migrateSeedFixtureV2(t0, baseline, result.ir);

    expect(migrated.Category[0].widget_id).toBe("widget-seed-1");
    expect(migrated.Category[1].widget_id).toBe("widget-seed-2");

    const delta = computeE4TaskDelta(baseline, result.ir);
    const brief = renderE4PmBrief({ opKind: "add_relationship", delta });
    expect(brief.text).toContain("Link existing records by position");
    expect(brief.covered.some((entry) => entry.fact_kind === "fixture_migration")).toBe(true);
  });
});

describe("§5.7.8 — gold + carried fixture self-consistency at every checkpoint (drawn chains)", () => {
  test(
    "chains covering the drift-relevant op kinds: the gold app seeded with the carried fixture passes the carried-derived hidden suite after every task",
    async () => {
      const { constants } = await loadE4V2Constants(join(repoRoot, E4_V2_CONSTANTS_PATH));
      const TARGET_OPS = new Set([
        "rename_entity",
        "rename_field",
        "retype_field",
        "delete_field",
        "delete_entity",
        "add_entity",
        "add_field",
        "add_relationship",
        "add_endpoint"
      ]);
      const uncovered = new Set(TARGET_OPS);
      const chosen: Array<Awaited<ReturnType<typeof e4ProceduralRestV2Provider.generate>>> = [];

      for (let seed = 1; seed <= 150 && uncovered.size > 0 && chosen.length < 10; seed += 1) {
        const generated = await e4ProceduralRestV2Provider.generate({
          substrate_config_id: constants.compatibility_boundary.substrate_config_id,
          substrate_seed: seed,
          task_count: 4,
          op_mix: { weights: constants.op_mix.weights }
        });
        const ops = generated.tasks.map((task) => task.op_kind);

        if (ops.filter((op) => uncovered.has(op)).length >= (chosen.length < 4 ? 2 : 1)) {
          chosen.push(generated);
          for (const op of ops) {
            uncovered.delete(op);
          }
        }
      }

      expect([...uncovered]).toEqual([]); // fail loud if the scan stops covering the op space

      for (const generated of chosen) {
        // Independent carry-forward recomputation must equal the provider's own.
        const recomputed = carryForwardSeedFixturesV2(
          generateSeedFixtureV2(generated.initial_ir),
          generated.initial_ir,
          generated.tasks.map((task) => task.ground_truth_ir)
        );

        for (const [index, task] of generated.tasks.entries()) {
          expect(JSON.stringify(task.seed_fixture)).toBe(JSON.stringify(recomputed[index]));

          const files = buildE4V2AppFiles(task.ground_truth_ir, task.seed_fixture);
          await mkdir(scratchRoot, { recursive: true });
          const dir = await mkdtemp(join(scratchRoot, "ckpt-"));

          for (const [relativePath, contents] of Object.entries(files)) {
            const absolute = join(dir, relativePath);
            await mkdir(dirname(absolute), { recursive: true });
            await writeFile(absolute, contents);
          }

          const result = await runE4OracleExecutor({
            workspace_dir: dir,
            tests: task.acceptance_tests.cumulative,
            config: EXECUTOR_CONFIG
          });

          expect(result.kind).toBe("completed");

          if (result.kind === "completed") {
            const failing = result.verdicts.filter((verdict) => !verdict.passed).map((verdict) => verdict.test_id);
            expect({ seed_ops: generated.tasks.map((t) => t.op_kind).join("|"), task: task.task_index, failing }).toEqual({
              seed_ops: generated.tasks.map((t) => t.op_kind).join("|"),
              task: task.task_index,
              failing: []
            });
          }
        }
      }
    },
    180_000
  );
});
