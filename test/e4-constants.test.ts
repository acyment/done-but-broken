// M0 acceptance (docs/e4/IMPLEMENTATION-PLAN.md §2 M0): E4 constants validate and hash under their
// own lineage, never touching validateE1Constants or the E1 seal file.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  type E4SealedConstants,
  E4ConstantsValidationError,
  hashE4ConstantsBytes,
  loadE4Constants,
  validateE4Constants
} from "../src/e4/constants";

const repoRoot = resolve(import.meta.dir, "..");
const draftPath = join(repoRoot, "docs", "protocols", "e4-sealed-constants-v0.json");

function validDraft(): E4SealedConstants {
  return {
    schema: "e4-sealed-constants",
    version: "0",
    compatibility_boundary: {
      substrate_config_id: null,
      substrate_kind: "procedural-rest-v1",
      substrate_version: null,
      meter_version: null
    },
    op_mix: null,
    phrasing_pools: null,
    executor: null,
    protocol_text: null,
    budgets: null,
    feedback: null,
    snapshot: null,
    floor_effect: { task_index_max: 3, consecutive_zero_tasks: 2, per_arm: true },
    meter_rules: { convention_aggregation_min_items: null },
    interpretability: {
      min_replay_valid_paired_seeds: 2,
      extraction_failed_max_fraction: 0.1,
      arm_h_spec_stall_max_fraction: 0.5
    }
  };
}

describe("E4 constants validate and hash under their own lineage", () => {
  test("the on-disk v0 draft validates", () => {
    expect(() => validateE4Constants(JSON.parse(readFileSync(draftPath, "utf8")))).not.toThrow();
  });

  test("[M1] the on-disk draft carries M1's sealed op_mix and phrasing_pools (v0.1)", () => {
    const constants = validateE4Constants(JSON.parse(readFileSync(draftPath, "utf8")));

    expect(constants.version).toBe("0.1");
    expect(constants.op_mix).not.toBeNull();
    expect(constants.phrasing_pools?.pool_ids.length).toBeGreaterThan(0);
    expect(constants.compatibility_boundary.substrate_version).not.toBeNull();
  });

  test("loadE4Constants validates and hashes the draft; the hash is stable across loads", async () => {
    const first = await loadE4Constants(draftPath);
    const second = await loadE4Constants(draftPath);

    expect(first.hash).toBe(second.hash);
    expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.constants.schema).toBe("e4-sealed-constants");
  });

  test("hashing is a pure function of the bytes, independent of any process/module state", () => {
    const bytes = readFileSync(draftPath);
    const first = hashE4ConstantsBytes(bytes);
    const second = hashE4ConstantsBytes(readFileSync(draftPath));

    expect(first).toBe(second);
  });

  test("this module never imports validateE1Constants or reads the E1 seal file", () => {
    const source = readFileSync(join(repoRoot, "src", "e4", "constants.ts"), "utf8");
    const importSpecifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);

    expect(importSpecifiers.some((specifier) => specifier.includes("e1-l1-constants"))).toBe(false);
    expect(source).not.toMatch(/validateE1Constants\s*\(/);
    expect(source).not.toContain("e1-frontier-sealed-constants-v1.0.json");
  });

  test("rejects a root that is not an object", () => {
    expect(() => validateE4Constants(null)).toThrow(E4ConstantsValidationError);
    expect(() => validateE4Constants([1, 2, 3])).toThrow(E4ConstantsValidationError);
  });

  test("rejects a missing required top-level key", () => {
    const { floor_effect: _dropped, ...rest } = validDraft();

    expect(() => validateE4Constants(rest)).toThrow(/missing required key: floor_effect/);
  });

  test("rejects an unknown top-level key", () => {
    expect(() => validateE4Constants({ ...validDraft(), extra_field: true })).toThrow(
      /unknown top-level key: extra_field/
    );
  });

  test("rejects a schema mismatch", () => {
    expect(() => validateE4Constants({ ...validDraft(), schema: "e1-sealed-constants" })).toThrow(
      /schema mismatch/
    );
  });

  test("rejects a version that is not a draft-v0 string", () => {
    expect(() => validateE4Constants({ ...validDraft(), version: "1.0.0" })).toThrow(/draft-v0 string/);
  });

  test("accepts an incremented draft version", () => {
    expect(() => validateE4Constants({ ...validDraft(), version: "0.3" })).not.toThrow();
  });

  test("rejects a compatibility_boundary with the wrong substrate_kind", () => {
    const draft = validDraft();

    expect(() =>
      validateE4Constants({
        ...draft,
        compatibility_boundary: { ...draft.compatibility_boundary, substrate_kind: "other" }
      })
    ).toThrow(/substrate_kind must be procedural-rest-v1/);
  });

  test("accepts a fully-sealed compatibility_boundary once M1/M2 land", () => {
    const draft = validDraft();

    expect(() =>
      validateE4Constants({
        ...draft,
        compatibility_boundary: {
          substrate_config_id: "procedural-rest-v1-default",
          substrate_kind: "procedural-rest-v1",
          substrate_version: "v1",
          meter_version: "v1"
        }
      })
    ).not.toThrow();
  });

  test("[M1] rejects op_mix that is present but incomplete", () => {
    expect(() =>
      validateE4Constants({ ...validDraft(), op_mix: { weights: { drift_opportunity: 0.5 } } })
    ).toThrow(/op_mix must be null or a fully-populated/);
  });

  test("[M1] accepts a fully-populated op_mix seal", () => {
    expect(() =>
      validateE4Constants({
        ...validDraft(),
        op_mix: {
          weights: { drift_opportunity: 0.5, additive: 0.4, behavior_preserving: 0.1 },
          min_behavior_preserving_tasks: 1
        }
      })
    ).not.toThrow();
  });

  test("[M1] rejects phrasing_pools that are present but malformed", () => {
    expect(() =>
      validateE4Constants({ ...validDraft(), phrasing_pools: { pool_ids: [1, 2] } })
    ).toThrow(/phrasing_pools must be null or a fully-populated/);
  });

  test("[M1] accepts a fully-populated phrasing_pools seal", () => {
    expect(() =>
      validateE4Constants({ ...validDraft(), phrasing_pools: { pool_ids: ["add-entity-v1"] } })
    ).not.toThrow();
  });

  test("rejects budgets that are present but incomplete", () => {
    expect(() =>
      validateE4Constants({ ...validDraft(), budgets: { turns_per_task: 10 } })
    ).toThrow(/budgets must be null or a fully-populated/);
  });

  test("accepts fully-populated budgets", () => {
    expect(() =>
      validateE4Constants({
        ...validDraft(),
        budgets: { turns_per_task: 10, verifications_per_task: 5, token_budget: 100000, spend_cap_usd: 5 }
      })
    ).not.toThrow();
  });

  test("rejects a floor_effect that drifts from the §3.2 pin", () => {
    const draft = validDraft();

    expect(() =>
      validateE4Constants({
        ...draft,
        floor_effect: { ...draft.floor_effect, task_index_max: 4 }
      })
    ).toThrow(/§3\.2 pin/);
  });

  test("rejects an interpretability block that drifts from the §5.1 / R2-7 pin", () => {
    const draft = validDraft();

    expect(() =>
      validateE4Constants({
        ...draft,
        interpretability: { ...draft.interpretability, extraction_failed_max_fraction: 0.2 }
      })
    ).toThrow(/§5\.1 pin/);
  });

  test("rejects a negative meter_rules.convention_aggregation_min_items", () => {
    const draft = validDraft();

    expect(() =>
      validateE4Constants({
        ...draft,
        meter_rules: { convention_aggregation_min_items: -1 }
      })
    ).toThrow(/convention_aggregation_min_items/);
  });
});
