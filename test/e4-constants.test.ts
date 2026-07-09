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
import { canonicalizeJson } from "../src/e4/oracle-executor";
import { hashText } from "../src/snapshot";

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

  test("[M1] the on-disk draft carries M1's sealed op_mix and phrasing_pools", () => {
    const constants = validateE4Constants(JSON.parse(readFileSync(draftPath, "utf8")));

    expect(constants.op_mix).not.toBeNull();
    expect(constants.phrasing_pools?.pool_ids.length).toBeGreaterThan(0);
    expect(constants.compatibility_boundary.substrate_version).not.toBeNull();
  });

  test("[M2] the on-disk draft carries M2's sealed meter_version and convention_aggregation_min_items", () => {
    const constants = validateE4Constants(JSON.parse(readFileSync(draftPath, "utf8")));

    expect(constants.compatibility_boundary.meter_version).not.toBeNull();
    expect(constants.meter_rules.convention_aggregation_min_items).not.toBeNull();
  });

  test("[M3] the on-disk draft carries the sealed executor determinism parameters (sealed v0.3)", () => {
    const constants = validateE4Constants(JSON.parse(readFileSync(draftPath, "utf8")));

    expect(constants.executor).not.toBeNull();
    expect(constants.executor?.fixed_order).toBe(true);
    expect(constants.executor?.port).toBe(0);
    expect(constants.executor?.readiness_timeout_ms).toBeGreaterThan(0);
    expect(constants.executor?.request_timeout_ms).toBeGreaterThan(0);
  });

  test("[M3] [R1-S2/S4] the sealed Arm-H gate protocol text carries the §3.3 affirmation handshake verbatim", () => {
    const constants = validateE4Constants(JSON.parse(readFileSync(draftPath, "utf8")));
    const protocol = constants.protocol_text?.arm_h_gate_protocol ?? "";

    // The handshake must be documented, never latent: an undocumented spec-phase exit makes Arm-H
    // agents stall hunting for it, and those turns land in the freshness tax as a fake H5 penalty.
    expect(protocol).toContain("<<<DONE>>>");
    expect(protocol).toContain("byte-for-byte unchanged");
    expect(protocol).toContain("verification (smoke) command");
    expect(protocol).toContain("at least once during the spec phase");
    // Both phase contracts are described.
    expect(protocol).toContain("SPEC PHASE");
    expect(protocol).toContain("IMPLEMENTATION PHASE");
    // And the Claim-B/B1 lever: refusal semantics are stated to the agent.
    expect(protocol).toContain("refused");
  });

  test("[M3] rejects an executor seal that is present but incomplete or drifted", () => {
    const sealed = {
      readiness_timeout_ms: 10000,
      request_timeout_ms: 5000,
      readiness_poll_interval_ms: 25,
      fixed_order: true,
      port: 0,
      retry_policy: "single-attempt-no-retry-arm-independent"
    };

    expect(() => validateE4Constants({ ...validDraft(), executor: { ...sealed, fixed_order: false } })).toThrow(
      /executor must be null or a fully-populated/
    );
    expect(() => validateE4Constants({ ...validDraft(), executor: { ...sealed, port: 3000 } })).toThrow(
      /executor must be null or a fully-populated/
    );
    expect(() => validateE4Constants({ ...validDraft(), executor: { readiness_timeout_ms: 10000 } })).toThrow(
      /executor must be null or a fully-populated/
    );
    expect(() => validateE4Constants({ ...validDraft(), executor: sealed })).not.toThrow();
  });

  test("[M4] the on-disk draft seals budgets slots, feedback, snapshot cadence, and the remaining protocol_text surfaces", () => {
    const constants = validateE4Constants(JSON.parse(readFileSync(draftPath, "utf8")));
    // Budget SLOTS are load-bearing at M4; the values stay provisional until M6.5 freezes them.
    expect(constants.budgets).not.toBeNull();
    expect(constants.budgets?.turns_per_task).toBeGreaterThan(0);
    expect(constants.budgets?.verifications_per_task).toBeGreaterThan(0);
    expect(constants.budgets?.token_budget).toBeGreaterThan(0);
    expect(constants.budgets?.spend_cap_usd).toBeGreaterThan(0);
    expect(constants.feedback?.smoke_command).toBe("bun run smoke");
    expect(constants.feedback?.retry_policy.length).toBeGreaterThan(0);
    expect(constants.snapshot?.cadence).toBe("sequence_start + every_accepted_task_close");
    // [R1-S2] the four M4 text surfaces, sealed together.
    expect(constants.protocol_text?.block_grammar_id).toBe("e4-block-grammar-v1");
    expect(constants.protocol_text?.turn_protocol_id).toBe("e4-turn-protocol-v1");
    expect(constants.protocol_text?.arm_m_standing_instruction).toContain("specs/openapi.json");
    expect(constants.protocol_text?.arm_m_standing_instruction).toContain("specs/CONVENTIONS.md");
    // The noticing probe carries the brief §4 question verbatim.
    expect(constants.protocol_text?.noticing_probe_prompt).toContain(
      "was anything in the provided spec/context files inaccurate?"
    );
  });

  test("[M6] [R1-S3] the NON-BUDGET constants are FROZEN: the sealed projection hash is pinned", () => {
    // Freeze semantics: every sealed field EXCEPT the budget values (which freeze at M6.5 after
    // their only real-model contact) and the draft-version metadata is now immutable. Any edit to
    // a non-budget field fails this test; updating the pinned hash below requires a NEW GATE
    // decision recorded in docs/e4/ — never an inline fix.
    const raw = JSON.parse(readFileSync(draftPath, "utf8")) as Record<string, unknown>;
    const projection = { ...raw };
    delete projection.version;
    delete projection.budgets;

    expect(hashText(canonicalizeJson(projection))).toBe(
      "1995df5e10fc793d086d52475a438f9964ace3167b12da4346e4965504ad9a2c"
    );
    expect((raw as { version: string }).version).toBe("0.5");
  });

  test("[M4] rejects a half-sealed M4 protocol_text block", () => {
    expect(() =>
      validateE4Constants({
        ...validDraft(),
        protocol_text: { arm_h_gate_protocol: "gate text", block_grammar_id: "e4-block-grammar-v1" }
      })
    ).toThrow(/must seal all of/);
  });

  test("[M4] rejects feedback/snapshot seals that are present but malformed", () => {
    expect(() => validateE4Constants({ ...validDraft(), feedback: { smoke_command: "bun run smoke" } })).toThrow(
      /feedback must be null or/
    );
    expect(() => validateE4Constants({ ...validDraft(), snapshot: { cadence: "whenever" } })).toThrow(
      /snapshot must be null or/
    );
    expect(() =>
      validateE4Constants({
        ...validDraft(),
        feedback: { smoke_command: "bun run smoke", retry_policy: "policy" },
        snapshot: { cadence: "sequence_start + every_accepted_task_close" }
      })
    ).not.toThrow();
  });

  test("[M3] rejects protocol_text without arm_h_gate_protocol or with non-string surfaces", () => {
    expect(() => validateE4Constants({ ...validDraft(), protocol_text: {} })).toThrow(
      /arm_h_gate_protocol is required/
    );
    expect(() =>
      validateE4Constants({ ...validDraft(), protocol_text: { arm_h_gate_protocol: "text", extra: 42 } })
    ).toThrow(/must be a non-empty string/);
    expect(() =>
      validateE4Constants({ ...validDraft(), protocol_text: { arm_h_gate_protocol: "gate protocol text" } })
    ).not.toThrow();
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
