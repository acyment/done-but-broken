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
// harness-feedback gap found by the M6 adversarial review; operator-approved plan).
const NON_BUDGET_PROJECTION_SHA256 = "8c6a4b54b608d8a114932082093e00fb771273ac95d7d57d0759023b90fcc461";

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
      "src/e4/substrate/v2/ops.ts",
      "src/e4/substrate/v2/scaffold.ts",
      "src/e4/substrate/v2/testgen.ts",
      "src/e4/substrate/v2/values.ts",
      "src/e4/v2/bank.ts",
      "src/e4/v2/converter.ts",
      "src/e4/v2/gold-spec.ts",
      "src/e4/v2/scenario-executor.ts",
      "src/e4/v2/scenario.ts",
      "src/e4/v2/step-table.ts"
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
    const { constants } = await loadSealed();

    expect(hashE4V2Bytes(await Bun.file(join(REPO_ROOT, E4_V2_CONSTANTS_PATH)).arrayBuffer())).toBe(
      "3198ee1b9b2fc6c36861108018eee8aa9a243a4d57d58629ff71489a3afe9c56"
    );
    expect(constants.version).toBe("0.4");
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
