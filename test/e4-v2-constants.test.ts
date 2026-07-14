// v2-M5 acceptance, part 1: the NON-BUDGET v2 constants freeze (E4V2 design §5.4/§9). The freeze
// is executable: (a) the sha256 of the canonical non-budget projection is pinned here — any
// non-budget edit fails the suite, and updating the pin requires a new recorded gate decision;
// (b) every sealed CODE TWIN's source hash is recorded in the constants file and recomputed
// here, so editing e4-t0-gold-spec-v1, the converter, the step table, the §5.6 substrate
// semantics, the executor semantics, or the bank breaks the seal loudly; (c) the sealed
// protocol_text carries the workspace README verbatim (§5.5's M5 pin). Budget VALUES stay free
// for the v2-M6 calibration.
import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import {
  E4_V2_CONSTANTS_PATH,
  e4V2NonBudgetProjection,
  hashE4V2Bytes,
  loadE4V2Constants,
  validateE4V2Constants
} from "../src/e4/v2/constants";
import { renderE4V2Readme } from "../src/e4/v2/workspace";
import { E4_CONVERTER_ID } from "../src/e4/v2/converter";
import { E4_STEP_TABLE_ID } from "../src/e4/v2/step-table";
import { E4_T0_GOLD_SPEC_ID } from "../src/e4/v2/gold-spec";
import { E4_V2_BANK_ID } from "../src/e4/v2/bank";
import { METER_VERSION_V2 } from "../src/e4/v2/meter";
import { E4_OPENSPEC_PROFILE_ID, OPENSPEC_PINNED_VERSION } from "../src/e4/v2/openspec";
import { SUBSTRATE_KIND_V2, SUBSTRATE_VERSION_V2 } from "../src/e4/substrate/v2/ops";
import { E4_BLOCK_GRAMMAR_ID, E4_TURN_PROTOCOL_ID, E4_PROVIDER_RETRY_POLICY_TEXT } from "../src/e4/turns";

const REPO_ROOT = resolve(import.meta.dir, "..");

// The v2-M5 non-budget freeze pin. Changing ANY non-budget field of the sealed file — including
// a code-twin hash — moves this value; update it only through a new recorded gate decision.
// Lineage: 7fd13e01… (v2-M5 → v0.3) → 8c6a4b54… (v0.4, 2026-07-11 Phase-0 learning boundary:
// protocol_text.workspace_readme gained the capability-retirement/tombstone section — the
// harness-feedback gap found by the M6 adversarial review; operator-approved plan) → 79b43417…
// (v0.5, 2026-07-12 §5.7 Amendment 3 substrate naturalization: substrate_version
// procedural-rest-v2.1, re-pinned substrate/gold-spec/bank twins, + the feedback-behavior
// modules sealed as twins per the external-audit design inputs) → 303cf4c6… (v0.6, 2026-07-13
// E5 P0-V rig repair, operator-ratified: PATCH/update-semantics + parking README sections,
// workflow_protocol parking bullets, substrate_version procedural-rest-v2.2 [modify_endpoint
// phrasing variant 2 corrected in the v2-owned pool], twins re-pinned + render.ts/turns.ts
// sealed as twins) → 871a98ea… (v0.7, 2026-07-13 E5 P0-V.1 review-repair boundary,
// operator-ratified backlog Tiers 1-3: substrate_version procedural-rest-v2.3 [variants 0/2
// direction-neutral + add_entity ever-used-name draw-guard], workflow_protocol write-rule
// bullet corrected, README parked-content sentence, conditional glue wording, novel-occurrence
// plumbing in runner/turns, prng.ts sealed as a twin) -> ea8c359e... (v0.8, 2026-07-14 E5
// zero-spend runway items 1b+2b: runner.ts gains the OPTIONAL P1.2w task-loop probe seam
// ([V08: 2b], two conditional call sites; undefined-by-default, byte-path-identical when no
// caller attaches a probe) and is re-pinned as a twin; the classifier-v3 fix ([V08: 1b]) lives
// entirely in the v3 twin set and does not move this projection.
const NON_BUDGET_PROJECTION_SHA256 = "ea8c359e56b41a78a335881b2810b642a0176557d946ddecd0c276e55e82fe24";

async function loadSealed() {
  return loadE4V2Constants(join(REPO_ROOT, E4_V2_CONSTANTS_PATH));
}

describe("v2-M5 — non-budget constants freeze", () => {
  test("the sealed file validates and its non-budget projection hash matches the pin", async () => {
    const { constants } = await loadSealed();

    expect(hashE4V2Bytes(e4V2NonBudgetProjection(constants))).toBe(NON_BUDGET_PROJECTION_SHA256);
  });

  test("budget VALUES are outside the freeze: editing them never moves the projection", async () => {
    const { constants } = await loadSealed();
    const edited = structuredClone(constants);
    edited.budgets = { turns_per_task: 99, verifications_per_task: 42, token_budget: 1, spend_cap_usd: 100 };
    edited.version = "0.2";

    expect(hashE4V2Bytes(e4V2NonBudgetProjection(edited))).toBe(NON_BUDGET_PROJECTION_SHA256);
  });

  test("every sealed code twin's recorded hash matches the module's current source bytes", async () => {
    const { constants } = await loadSealed();
    const twins = Object.keys(constants.code_twins).toSorted();

    expect(twins).toEqual([
      "src/e4/substrate/prng.ts", // [P0V.1: D6] de-facto guard made de-jure
      "src/e4/substrate/v2/fixture.ts",
      "src/e4/substrate/v2/ops.ts",
      "src/e4/substrate/v2/pluralize.ts",
      "src/e4/substrate/v2/render.ts",
      "src/e4/substrate/v2/scaffold.ts",
      "src/e4/substrate/v2/testgen.ts",
      "src/e4/substrate/v2/values.ts",
      "src/e4/v2/bank.ts",
      "src/e4/v2/converter.ts",
      "src/e4/v2/fake-provider.ts",
      "src/e4/v2/gate.ts",
      "src/e4/v2/gold-spec.ts",
      "src/e4/v2/openspec.ts",
      "src/e4/v2/runner.ts",
      "src/e4/v2/scenario-executor.ts",
      "src/e4/v2/scenario.ts",
      "src/e4/v2/step-table.ts",
      "src/e4/v2/turns.ts",
      "src/e4/v2/workspace.ts"
    ]);

    for (const twin of twins) {
      const bytes = await Bun.file(join(REPO_ROOT, twin)).arrayBuffer();
      expect(`${twin}:${hashE4V2Bytes(bytes)}`).toBe(`${twin}:${constants.code_twins[twin]}`);
    }
  });

  test("the sealed identities are the code modules' own ids (no drift between file and code)", async () => {
    const { constants } = await loadSealed();
    const boundary = constants.compatibility_boundary;

    expect(boundary.substrate_kind).toBe(SUBSTRATE_KIND_V2);
    expect(boundary.substrate_version).toBe(SUBSTRATE_VERSION_V2);
    expect(boundary.meter_version).toBe(METER_VERSION_V2);
    expect(boundary.converter_id).toBe(E4_CONVERTER_ID);
    expect(boundary.step_table_id).toBe(E4_STEP_TABLE_ID);
    expect(boundary.t0_gold_spec_id).toBe(E4_T0_GOLD_SPEC_ID);
    expect(boundary.bank_id).toBe(E4_V2_BANK_ID);
    expect(constants.protocol_profile_id).toBe(E4_OPENSPEC_PROFILE_ID);
    expect(constants.openspec.version).toBe(OPENSPEC_PINNED_VERSION);
    expect(constants.protocol_text.block_grammar_id).toBe(E4_BLOCK_GRAMMAR_ID);
    expect(constants.protocol_text.turn_protocol_id).toBe(E4_TURN_PROTOCOL_ID);
    expect(constants.feedback.retry_policy).toBe(E4_PROVIDER_RETRY_POLICY_TEXT);
  });

  test("protocol_text.workspace_readme is the generator's README, verbatim (§5.5 M5 pin)", async () => {
    const { constants } = await loadSealed();

    expect(constants.protocol_text.workspace_readme).toBe(renderE4V2Readme());
  });

  test("the validator is not vacuous: schema/arms/pins/twin-shape violations throw", async () => {
    const { constants } = await loadSealed();

    const wrongSchema = structuredClone(constants) as Record<string, unknown>;
    wrongSchema.schema = "e4-sealed-constants";
    expect(() => validateE4V2Constants(wrongSchema)).toThrow(/schema mismatch/);

    const threeArms = structuredClone(constants) as { arms: string[] };
    threeArms.arms = ["e4_arm_0", "e4_arm_m", "e4_arm_h"];
    expect(() => validateE4V2Constants(threeArms)).toThrow(/two-arm/);

    const badTwin = structuredClone(constants) as { code_twins: Record<string, string> };
    badTwin.code_twins["src/e4/v2/converter.ts"] = "not-a-hash";
    expect(() => validateE4V2Constants(badTwin)).toThrow(/sha256/);

    const badFloor = structuredClone(constants) as { floor_effect: { task_index_max: number } };
    badFloor.floor_effect.task_index_max = 4;
    expect(() => validateE4V2Constants(badFloor)).toThrow(/§3.2/);

    const missingReadme = structuredClone(constants) as { protocol_text: Record<string, string> };
    delete missingReadme.protocol_text.workspace_readme;
    expect(() => validateE4V2Constants(missingReadme)).toThrow(/workspace_readme/);
  });

  test("[v2-M6/v2-M8] v0 is FULLY FROZEN: the complete file hash is pinned (budgets ratified per model)", async () => {
    // Freeze lineage: provisional 0.1 27/12/490000/5 (v2-M5)
    //   → v0.2 27/12/490000/5 (v2-M6, deepseek-v4-pro, seed 37, classification=calibration;
    //     observed appetite: max turns/task=8, max tokens/task=142778, max verifications/task=3,
    //     sequence spend $0.127716 — every wall well under cap, so the freeze rule's "fits with
    //     headroom" branch applies and the provisional VALUES freeze unchanged; only `version`
    //     moves to mark the freeze event.
    //     docs/protocols/e4-v2-m6-calibration-manifest-20260709-001.json).
    //     v0.2 full-file hash was d762bacc126618d086cea6416b1ec4d8f87d561a5bb366e4a0a8149d0e06836b —
    //     the constants_hash every v2-M7 evidence manifest stamps (historical; to re-run the M7
    //     verdict, pass `--constants` pointing at the archived v0.2, e.g.
    //     `git show de9a679:docs/protocols/e4-v2-sealed-constants-v0.json`).
    //   → v0.3 27/12/490000/5 (v2-M8, glm-5.2 THINKING-ON, seed 37, classification=calibration;
    //     observed appetite: max turns/task=6, max tokens/task=122626, max verifications/task=3,
    //     sequence spend $0.642259 (run 1) / max turns 5, max tokens 116246, max verifications 1,
    //     spend $0.617758 (run 2, with the §4 reasoning-observability recorder: reasoning active
    //     35/35 calls, token accounting folded on every call, zero truncation at max_tokens 32000)
    //     — no wall hit in either run, "fits with headroom" branch again: VALUES freeze unchanged,
    //     only `version` moves to mark GLM's own freeze event.
    //     docs/protocols/e4-v2-m8-glm-calibration-manifest-20260710-001.json).
    // This is the constants_hash every v2-M8 evidence manifest must stamp; immutable without a
    // new gate. Budgets are MODEL-PINNED: they transfer to an evidence run only on the exact model
    // id they were ratified on (deepseek-v4-pro per v0.2 / glm-5.2 thinking-on per v0.3 — recorded
    // in docs/e4/E4V2-M6-BUDGET-CALIBRATION-NOTES.md and
    // docs/e4/E4V2-M8-GLM-BUDGET-CALIBRATION-NOTES.md, not a JSON field, same as the v1 M6.5 pin).
    //   → v0.4 27/12/490000/5 (2026-07-11, Phase-0 learning boundary, operator-approved plan:
    //     budgets UNTOUCHED; protocol_text.workspace_readme gained the capability-retirement
    //     tombstone section after the M6 adversarial review found the harness fed agents empty
    //     validate errors and undocumented retirement mechanics. v0.3 full-file hash was
    //     2f78f53479e300ef4eb7ee654283dba26a9095cf252b661d20deb51232b5e11c — the constants_hash
    //     every v2-M8 AND v3-M6 evidence manifest stamps (historical; re-run those verdicts with
    //     `--constants` pointing at the archived v0.3, e.g.
    //     `git show 5ed1d87:docs/protocols/e4-v2-sealed-constants-v0.json`).
    //   → v0.5 27/12/490000/5 (2026-07-12, §5.7 Amendment 3 substrate naturalization: budgets
    //     UNTOUCHED; substrate_version → procedural-rest-v2.1, twins re-pinned + feedback-behavior
    //     modules sealed. v0.4 full-file hash was
    //     3198ee1b9b2fc6c36861108018eee8aa9a243a4d57d58629ff71489a3afe9c56 — recorded at 01f7942;
    //     the pre-seal calibration rung must re-check budget headroom on the new substrate before
    //     any evidence run).
    //   → v0.6 27/12/490000/5 (2026-07-13, E5 P0-V rig repair, operator-ratified §7 gate:
    //     budgets UNTOUCHED; disclosure/feedback/scoring repairs only — README update-semantics +
    //     parking sections, workflow parking bullets, substrate_version procedural-rest-v2.2,
    //     PARKED.md custody primitive, glue-aware feedback, twins extended. v0.5 full-file hash
    //     was 93d0bf88a49729f02adc8322b6367212da77bfe45548e7354d3b7277d3e67a72 — the base every
    //     v3-M7 evidence manifest's extends block pins (historical; re-run that verdict with
    //     `--constants` on the archived v0.5, e.g.
    //     `git show 9d2dd8b:docs/protocols/e4-v2-sealed-constants-v0.json`).
    //   → v0.7 27/12/490000/5 (2026-07-13, E5 P0-V.1 review-repair boundary, operator-ratified
    //     backlog Tiers 1-3 with fix tracks V1a/V2a/V7a: budgets UNTOUCHED; instrument/text
    //     repairs only — see the v3 budgets_note entry for the item list and the V8 correction
    //     of record. v0.6 full-file hash was
    //     4ea57eefcc37bac3f31531a0748894afcc48c6ca2a7edec2e44cdd404b45cbcd (historical; re-run
    //     against `git show 784e0ff:docs/protocols/e4-v2-sealed-constants-v0.json`).
    //   -> v0.8 27/12/490000/5 (2026-07-14, E5 zero-spend runway items 1b+2b): budgets UNTOUCHED;
    //     runner.ts gains the OPTIONAL P1.2w task-loop probe seam ([V08: 2b]) and is re-pinned as
    //     a twin. v0.7 full-file hash was
    //     32c6c25e8d7a74cbd58176e753c76186bc028f5088ad17c67e9dd91721590060 (historical; re-run
    //     against `git show 188f372:docs/protocols/e4-v2-sealed-constants-v0.json`).
    const { constants } = await loadSealed();

    expect(hashE4V2Bytes(await Bun.file(join(REPO_ROOT, E4_V2_CONSTANTS_PATH)).arrayBuffer())).toBe(
      "2bba1b0f8f3969d42bbb2ca7e6e6b354060cf261adf1330b5ddd24659b8ad888"
    );
    expect(constants.version).toBe("0.8");
    expect(constants.budgets).toEqual({
      turns_per_task: 27,
      verifications_per_task: 12,
      token_budget: 490000,
      spend_cap_usd: 5
    });
  });

  test("the v1 seal is untouched by the v2 lineage (different schema, different file)", async () => {
    const v1 = JSON.parse(await Bun.file(join(REPO_ROOT, "docs/protocols/e4-sealed-constants-v0.json")).text()) as {
      schema: string;
    };

    expect(v1.schema).toBe("e4-sealed-constants");
    expect(() => validateE4V2Constants(v1)).toThrow();
  });
});
