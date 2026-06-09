import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadE1Constants, providerSealBlockers, validateE1Constants } from "../src/e1-l1-constants";

const CONSTANTS_PATH = join(
  import.meta.dir,
  "..",
  "docs",
  "protocols",
  "e1-frontier-sealed-constants-v0.2.json"
);

describe("E1 frontier sealed constants", () => {
  test("loads through the strict runtime validator and matches active condition IDs", async () => {
    const constants = await loadE1Constants(CONSTANTS_PATH);

    expect(constants.schema).toBe("e1-sealed-constants");
    expect(constants.version).toBe("0.2.0");
    expect(constants.condition_ids).toEqual(["context_only_spec", "feedback_capable_spec"]);
    expect(constants.path_grammar.regex).toBe("^[A-Za-z0-9._-][A-Za-z0-9._/-]*$");
    expect(constants.path_grammar.relative_only).toBe(true);
    expect(constants.path_grammar.no_trailing_slash).toBe(true);
    expect(constants.path_grammar.no_double_slash).toBe(true);
    expect(new RegExp(constants.path_grammar.regex).test("scratch/probe.ts")).toBe(true);
    expect(new RegExp(constants.path_grammar.regex).test("/tmp/workspace/scratch/probe.ts")).toBe(false);
    expect(new RegExp(constants.path_grammar.regex).test("scratch\\probe.ts")).toBe(false);
    expect(constants.turn_protocol.consecutive_noop_stall_threshold).toBe(3);
    expect(constants.turn_protocol.stall_classification).toBe("agent_stalled");
    expect(constants.audit.integrity_rule).toContain("replacement application");
    expect(constants.audit.integrity_rule).toContain("verification execution");
    expect(providerSealBlockers(constants)).toEqual(["token_estimator"]);
  });

  test("rejects missing and unknown top-level fields so docs and runtime cannot drift", async () => {
    const raw = JSON.parse(await readFile(CONSTANTS_PATH, "utf8"));
    delete raw.block_grammar;
    expect(() => validateE1Constants(raw)).toThrow("missing required key: block_grammar");

    const withUnknown = JSON.parse(await readFile(CONSTANTS_PATH, "utf8"));
    withUnknown.experimental_extra = true;
    expect(() => validateE1Constants(withUnknown)).toThrow("unknown top-level key");
  });

  test("rejects malformed regexes and sealed policy flips", async () => {
    const badRegex = JSON.parse(await readFile(CONSTANTS_PATH, "utf8"));
    badRegex.path_grammar.regex = "([unclosed";
    expect(() => validateE1Constants(badRegex)).toThrow("does not compile");

    const flipped = JSON.parse(await readFile(CONSTANTS_PATH, "utf8"));
    flipped.block_grammar.multiple_verify_policy = "last_wins";
    expect(() => validateE1Constants(flipped)).toThrow("multiple_verify_policy must be first_wins");
  });

  test("rejects command templates that use condition aliases", async () => {
    const raw = JSON.parse(await readFile(CONSTANTS_PATH, "utf8"));
    raw.command_grammar.templates[0].conditions = ["context", "feedback"];
    expect(() => validateE1Constants(raw)).toThrow("non-protocol condition id");
  });
});
