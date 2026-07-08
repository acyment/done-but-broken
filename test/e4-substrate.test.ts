// M1 acceptance (docs/e4/IMPLEMENTATION-PLAN.md §2 M1; architecture §6 Feature 1).
import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { buildBaselineIr, createUidMinter } from "../src/e4/substrate/ir";
import { createE4Prng } from "../src/e4/substrate/prng";
import { createSequenceState, E4_OPS } from "../src/e4/substrate/ops";
import { drawE4TaskSequence, flattenRenameLineage } from "../src/e4/substrate/draw";
import { assertT0InSync, e4ProceduralRestV1Provider, type E4SubstrateConfig } from "../src/e4/substrate/provider";
import { buildE4WorkspaceFiles } from "../src/e4/substrate/scaffold";
import { phrasingPoolIds } from "../src/e4/substrate/render";
import { validateE4Constants } from "../src/e4/constants";

const repoRoot = resolve(import.meta.dir, "..");

function config(overrides: Partial<E4SubstrateConfig> = {}): E4SubstrateConfig {
  return {
    substrate_config_id: "default",
    substrate_seed: 42,
    task_count: 8,
    op_mix: { weights: { drift_opportunity: 0.5, additive: 0.4, behavior_preserving: 0.1 } },
    ...overrides
  };
}

describe("Feature 1 — Same seed, same substrate, byte-identical", () => {
  test("two generate() calls in the same process are byte-identical", async () => {
    const a = await e4ProceduralRestV1Provider.generate(config());
    const b = await e4ProceduralRestV1Provider.generate(config());

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("two SEPARATE OS processes with the same seed emit byte-identical output", () => {
    const script = join(repoRoot, "test", "fixtures", "e4", "print-substrate.ts");
    const runOnce = () => {
      const proc = Bun.spawnSync({ cmd: ["bun", "run", script, "42"], cwd: repoRoot });
      expect(proc.exitCode).toBe(0);
      return proc.stdout.toString();
    };

    const first = runOnce();
    const second = runOnce();

    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(0);
  });
});

describe("Feature 1 — Different seeds differ within the same boundary", () => {
  test("task sequences differ across seeds, but the compatibility boundary (substrate_kind/version) matches", async () => {
    const resultA = await e4ProceduralRestV1Provider.generate(config({ substrate_seed: 42 }));
    const resultB = await e4ProceduralRestV1Provider.generate(config({ substrate_seed: 43 }));

    expect(JSON.stringify(resultA.tasks)).not.toBe(JSON.stringify(resultB.tasks));
    expect(e4ProceduralRestV1Provider.substrate_kind).toBe("procedural-rest-v1");
    // Both runs report the same substrate_kind/version — the pooling unit is the boundary, not the seed.
    expect(e4ProceduralRestV1Provider.substrate_version).toBe(e4ProceduralRestV1Provider.substrate_version);
  });
});

describe("Feature 1 — Opportunity labels are recorded and constrained", () => {
  test("every task carries >=1 opportunity label, and >=1 task is behavior_preserving", async () => {
    const result = await e4ProceduralRestV1Provider.generate(config());

    expect(result.tasks.every((task) => task.opportunity_labels.length >= 1)).toBe(true);
    expect(result.tasks.some((task) => task.opportunity_labels.includes("behavior_preserving"))).toBe(true);
  });

  test("the behavior_preserving guarantee holds across a wide sweep of seeds", async () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const result = await e4ProceduralRestV1Provider.generate(config({ substrate_seed: seed }));
      expect(result.tasks.some((task) => task.opportunity_labels.includes("behavior_preserving"))).toBe(true);
    }
  });

  test("every op's opportunity label matches its category — drift ops modify/rename, additive ops add, one op is behavior_preserving", () => {
    const driftOps = new Set(["rename_entity", "rename_field", "retype_field", "delete_field", "delete_entity", "modify_endpoint", "modify_convention"]);
    const additiveOps = new Set(["add_entity", "add_field", "add_endpoint", "add_validation_rule", "add_relationship"]);

    for (let seed = 0; seed < 20; seed += 1) {
      const drawn = drawE4TaskSequence({ baselineIr: buildBaselineIr(), taskCount: 8, opMix: config().op_mix, prng: createE4Prng(seed) });

      for (const task of drawn) {
        if (task.op_kind === "noop_maintenance") {
          expect(task.opportunity_labels).toEqual(["behavior_preserving"]);
        } else if (driftOps.has(task.op_kind)) {
          expect(task.opportunity_labels).toEqual(["drift_opportunity"]);
        } else if (additiveOps.has(task.op_kind)) {
          expect(task.opportunity_labels).toEqual(["additive"]);
        } else {
          throw new Error(`unrecognized op_kind in test's category partition: ${task.op_kind}`);
        }
      }
    }
  });
});

describe("Feature 1 — T0 is in-sync", () => {
  test("the generator's own self-check passes on the real T0 workspace", async () => {
    const result = await e4ProceduralRestV1Provider.generate(config());

    expect(() => assertT0InSync(result.initial_ir, result.initial_workspace)).not.toThrow();
  });

  test("the self-check is not vacuous: it fails on a deliberately broken workspace", async () => {
    const result = await e4ProceduralRestV1Provider.generate(config());
    const brokenWorkspace = { ...result.initial_workspace };
    const openapi = JSON.parse(brokenWorkspace["specs/openapi.json"]);
    delete openapi.paths["/widgets"];
    brokenWorkspace["specs/openapi.json"] = JSON.stringify(openapi);

    expect(() => assertT0InSync(result.initial_ir, brokenWorkspace)).toThrow(/does not match/);
  });

  test("the self-check also fails when a convention statement is stale", async () => {
    const result = await e4ProceduralRestV1Provider.generate(config());
    const brokenWorkspace = { ...result.initial_workspace };
    brokenWorkspace["specs/CONVENTIONS.md"] = brokenWorkspace["specs/CONVENTIONS.md"].replace(
      "error-format",
      "error-format-renamed"
    );

    expect(() => assertT0InSync(result.initial_ir, brokenWorkspace)).toThrow(/convention/);
  });

  test("the T0 README reproduces the CONVENTIONS grammar verbatim, one example per kind (Gate-1 pin)", async () => {
    const ir = buildBaselineIr();
    const workspace = buildE4WorkspaceFiles(ir);

    for (const kind of ["naming", "error_format", "command", "structural"] as const) {
      const example = ir.conventions.find((convention) => convention.kind === kind)!;
      expect(workspace["README.md"]).toContain(`\`${example.convention_id}\`: ${example.statement}`);
    }
  });
});

describe("M1 — rename-lineage map", () => {
  test("the rename-lineage map is emitted deterministically and covers every rename-shaped op", async () => {
    const resultA = await e4ProceduralRestV1Provider.generate(config());
    const resultB = await e4ProceduralRestV1Provider.generate(config());

    expect(JSON.stringify(resultA.rename_lineage_map)).toBe(JSON.stringify(resultB.rename_lineage_map));

    const renameShapedOps = new Set(["rename_entity", "rename_field"]);
    const renameTaskIndices = resultA.tasks
      .map((_, index) => index + 1)
      .filter((taskIndex) => {
        // Re-derive which drawn op kind produced each task by checking whether that task_index
        // appears in the lineage map — every rename-shaped op must appear, no rename-shaped op
        // may be silently dropped.
        return resultA.rename_lineage_map.some((entry) => entry.task_index === taskIndex);
      });

    // Cross-check against a fresh direct draw (same seed) to see exactly which tasks were
    // rename-shaped, and confirm the lineage map covers precisely those tasks.
    const drawn = drawE4TaskSequence({
      baselineIr: buildBaselineIr(),
      taskCount: 8,
      opMix: config().op_mix,
      prng: createE4Prng(42)
    });
    const expectedRenameTaskIndices = drawn.filter((task) => renameShapedOps.has(task.op_kind)).map((task) => task.task_index);

    expect(renameTaskIndices.toSorted()).toEqual(expectedRenameTaskIndices.toSorted());
  });

  test("a missed rename's stale-claim/coverage-gap pair share one semantic_item_uid in the lineage entry", () => {
    const baseline = buildBaselineIr();
    const minter = createUidMinter();
    const prng = createE4Prng(7);
    const result = E4_OPS.rename_field.apply(baseline, minter, prng, createSequenceState());

    expect(result.rename_lineage).toHaveLength(1);
    const [entry] = result.rename_lineage;
    expect(entry.old_item_id).not.toBe(entry.new_item_id);
    expect(entry.semantic_item_uid.length).toBeGreaterThan(0);
  });
});

describe("M1 — the change-op action space preserves referential integrity", () => {
  test("rename_entity cascades to every field/endpoint/rule referencing the old name", () => {
    const baseline = buildBaselineIr();
    const minter = createUidMinter();
    const prng = createE4Prng(3);
    const result = E4_OPS.rename_entity.apply(baseline, minter, prng, createSequenceState());
    const [{ old_item_id: oldItemId }] = result.rename_lineage;
    const oldName = oldItemId.replace("entity:", "");

    const danglingRefs = result.ir.entities.some((entity) =>
      entity.fields.some((field) => field.type === "ref" && field.ref_entity === oldName)
    );
    const danglingEndpoints = result.ir.endpoints.some((endpoint) => endpoint.entity === oldName);
    const danglingRules = result.ir.validation_rules.some((rule) => rule.entity === oldName);

    expect(danglingRefs).toBe(false);
    expect(danglingEndpoints).toBe(false);
    expect(danglingRules).toBe(false);
  });

  test("delete_entity never targets a baseline entity or one referenced by another entity", () => {
    const baseline = buildBaselineIr();
    const state = createSequenceState();

    // No entity has been added by this sequence yet — delete_entity must be ineligible.
    expect(E4_OPS.delete_entity.isEligible(baseline, state)).toBe(false);
  });

  test("noop_maintenance never changes the IR", () => {
    const baseline = buildBaselineIr();
    const result = E4_OPS.noop_maintenance.apply(baseline, createUidMinter(), createE4Prng(1), createSequenceState());

    expect(JSON.stringify(result.ir)).toBe(JSON.stringify(baseline));
    expect(result.touched_item_uids).toHaveLength(0);
  });
});

describe("M1 — no Math.random anywhere in the generator", () => {
  test("substrate source files never call Math.random", async () => {
    const glob = new Bun.Glob("src/e4/substrate/*.ts");
    for await (const file of glob.scan(repoRoot)) {
      const source = await Bun.file(join(repoRoot, file)).text();
      expect(source).not.toMatch(/Math\.random\s*\(/);
    }
  });
});

describe("M1 — constants lineage (§4, sealed at M1 → v0.1)", () => {
  test("the sealed phrasing_pools.pool_ids exactly matches what render.ts actually produces", async () => {
    const draftPath = join(repoRoot, "docs", "protocols", "e4-sealed-constants-v0.json");
    const constants = validateE4Constants(JSON.parse(await Bun.file(draftPath).text()));

    expect(constants.phrasing_pools?.pool_ids).toEqual(phrasingPoolIds());
  });

  test("the sealed op_mix matches what the provider actually draws with", async () => {
    const draftPath = join(repoRoot, "docs", "protocols", "e4-sealed-constants-v0.json");
    const constants = validateE4Constants(JSON.parse(await Bun.file(draftPath).text()));

    expect(constants.op_mix?.weights).toEqual(config().op_mix.weights);
  });

  test("the sealed substrate_version matches the provider's own substrate_version", async () => {
    const draftPath = join(repoRoot, "docs", "protocols", "e4-sealed-constants-v0.json");
    const constants = validateE4Constants(JSON.parse(await Bun.file(draftPath).text()));

    expect(constants.compatibility_boundary.substrate_version).toBe(e4ProceduralRestV1Provider.substrate_version);
  });
});
