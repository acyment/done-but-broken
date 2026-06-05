import { describe, expect, test } from "bun:test";
import { CONDITION_IDS } from "../src/conditions";

describe("condition IDs", () => {
  test("the pilot exposes exactly the two allowed condition IDs", () => {
    expect(CONDITION_IDS).toEqual(["context_only_spec", "feedback_capable_spec"]);
  });

  test("legacy condition names are not active IDs", () => {
    const legacyNames = [
      "plain_agent",
      "common_sdd",
      "hit_sdd",
      "hit_sdd_three_amigos",
      "openspec_cli",
      "ordinary_tests"
    ];

    for (const legacyName of legacyNames) {
      expect(CONDITION_IDS).not.toContain(legacyName);
    }
  });
});
