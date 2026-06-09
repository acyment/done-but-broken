import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const CONSTANTS_PATH = join(
  import.meta.dir,
  "..",
  "docs",
  "protocols",
  "e1-frontier-sealed-constants-v0.json"
);

describe("E1 frontier sealed constants", () => {
  test("keeps the canonical constants machine-readable and aligned with active condition IDs", async () => {
    const constants = JSON.parse(await readFile(CONSTANTS_PATH, "utf8")) as {
      protocol_id: string;
      condition_ids: string[];
      path_grammar: {
        regex: string;
        relative_only: boolean;
        forbid_windows_separator: boolean;
      };
      turn_policy: {
        no_op_notice: string;
        max_consecutive_no_op_turns: number;
        stall_classification: string;
      };
      protected_path_integrity: {
        verify_after: string[];
        mismatch_classification: string;
      };
    };

    expect(constants.protocol_id).toBe("e1-frontier-consolidated-protocol-v0");
    expect(constants.condition_ids).toEqual(["context_only_spec", "feedback_capable_spec"]);
    expect(constants.path_grammar.regex).toBe("^[A-Za-z0-9._-][A-Za-z0-9._/-]*$");
    expect(constants.path_grammar.relative_only).toBe(true);
    expect(constants.path_grammar.forbid_windows_separator).toBe(true);
    expect(new RegExp(constants.path_grammar.regex).test("scratch/probe.ts")).toBe(true);
    expect(new RegExp(constants.path_grammar.regex).test("/tmp/workspace/scratch/probe.ts")).toBe(false);
    expect(new RegExp(constants.path_grammar.regex).test("scratch\\probe.ts")).toBe(false);
    expect(constants.turn_policy.no_op_notice).toBe("no valid blocks parsed");
    expect(constants.turn_policy.max_consecutive_no_op_turns).toBe(3);
    expect(constants.turn_policy.stall_classification).toBe("agent_stalled");
    expect(constants.protected_path_integrity.verify_after).toEqual([
      "replacement_application",
      "verification_execution"
    ]);
    expect(constants.protected_path_integrity.mismatch_classification).toBe("invalid_integrity");
  });
});
