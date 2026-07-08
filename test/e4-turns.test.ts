// M4 acceptance — turn-adapter half (docs/e4/IMPLEMENTATION-PLAN.md §2 M4; architecture §2.2/§2.3).
// Protocol tests over the sealed condition-rendering surfaces ([R1-S2]): the grammar/protocol ids
// and retry-policy text in code must match the sealed constants file byte-for-byte, and the
// rendered system prompt must differ across arms ONLY through the declared policy channels.
import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { buildE4ArmPolicies } from "../src/e4/arm-policy";
import { validateE4Constants } from "../src/e4/constants";
import { E4ArmHTaskGate } from "../src/e4/gate";
import {
  applyE4Replacements,
  createE4TurnParser,
  renderE4SystemPrompt,
  renderE4TurnFeedback,
  E4_BLOCK_GRAMMAR_ID,
  E4_PROVIDER_RETRY_POLICY_TEXT,
  E4_TURN_PROTOCOL_ID
} from "../src/e4/turns";

const repoRoot = resolve(import.meta.dir, "..");
const scratchRoot = join(repoRoot, "tmp", "e4-turns-tests");
const constants = validateE4Constants(
  JSON.parse(readFileSync(join(repoRoot, "docs", "protocols", "e4-sealed-constants-v0.json"), "utf8"))
);
const policies = buildE4ArmPolicies({
  standingInstruction: constants.protocol_text!.arm_m_standing_instruction
});

afterAll(async () => {
  await rm(scratchRoot, { recursive: true, force: true });
});

async function freshDir(): Promise<string> {
  await mkdir(scratchRoot, { recursive: true });
  return mkdtemp(join(scratchRoot, "ws-"));
}

describe("e4-block-grammar-v1 over the allowlisted L1 parser", () => {
  test("parses FILE / VERIFY / DONE blocks with the sealed E1-identical tokens", () => {
    const parser = createE4TurnParser();
    const parsed = parser.parse(
      [
        "Some prose the parser ignores.",
        "<<<FILE specs/openapi.json>>>",
        '{ "openapi": "3.0.0" }',
        "<<<END>>>",
        "<<<VERIFY>>>",
        "bun run smoke",
        "<<<END>>>",
        "<<<DONE>>>"
      ].join("\n")
    );

    expect(parsed.replacements).toEqual([{ path: "specs/openapi.json", content: '{ "openapi": "3.0.0" }' }]);
    expect(parsed.verification?.raw).toBe("bun run smoke");
    expect(parsed.done).toBe(true);
    expect(parsed.no_op).toBe(false);
    expect(parsed.violations).toEqual([]);
  });

  test("strips one markdown fence layer and rejects escaping paths", () => {
    const parser = createE4TurnParser();
    const fenced = parser.parse(["```", "<<<FILE server.ts>>>", "content", "<<<END>>>", "```"].join("\n"));

    expect(fenced.replacements).toEqual([{ path: "server.ts", content: "content" }]);

    const escaping = parser.parse(["<<<FILE ../evil.ts>>>", "content", "<<<END>>>"].join("\n"));

    expect(escaping.replacements).toEqual([]);
    expect(escaping.violations.map((violation) => violation.code)).toContain("file_open_invalid_path");
  });

  test("a turn with no valid protocol blocks is a no_op (the stall-detection input)", () => {
    const parser = createE4TurnParser();

    expect(parser.parse("I think I should look at the code first.").no_op).toBe(true);
  });
});

describe("[R1-S2] sealed text surfaces — code twins match the constants file", () => {
  test("grammar/protocol ids and retry-policy text match the sealed constants verbatim", () => {
    expect(constants.protocol_text?.block_grammar_id).toBe(E4_BLOCK_GRAMMAR_ID);
    expect(constants.protocol_text?.turn_protocol_id).toBe(E4_TURN_PROTOCOL_ID);
    expect(constants.feedback?.retry_policy).toBe(E4_PROVIDER_RETRY_POLICY_TEXT);
  });

  test("the system prompt differs across arms ONLY through the declared policy channels", () => {
    const prompt0 = renderE4SystemPrompt({ constants, arm: policies.e4_arm_0 });
    const promptM = renderE4SystemPrompt({ constants, arm: policies.e4_arm_m });
    const promptH = renderE4SystemPrompt({ constants, arm: policies.e4_arm_h });

    expect(promptM).toBe(`${prompt0}\n\n${constants.protocol_text!.arm_m_standing_instruction}`);
    expect(promptH).toBe(`${prompt0}\n\n${constants.protocol_text!.arm_h_gate_protocol}`);
  });

  test("the base prompt carries the sealed smoke command, the budgets, and the protocol tokens", () => {
    const prompt = renderE4SystemPrompt({ constants, arm: policies.e4_arm_0 });

    expect(prompt).toContain(constants.feedback!.smoke_command);
    expect(prompt).toContain(`${constants.budgets!.turns_per_task} turns`);
    expect(prompt).toContain(`${constants.budgets!.verifications_per_task} verification runs`);
    expect(prompt).toContain("<<<DONE>>>");
    expect(prompt).toContain(E4_TURN_PROTOCOL_ID);
    expect(prompt).toContain(E4_BLOCK_GRAMMAR_ID);
  });
});

describe("E4 write application (E4-owned; specs/ writable, gate-routed for Arm H)", () => {
  test("without a gate, specs/ and root code files are both writable (Arm 0 spontaneously maintaining the spec is a finding)", async () => {
    const dir = await freshDir();
    const result = await applyE4Replacements({
      workspaceDir: dir,
      replacements: [
        { path: "specs/openapi.json", content: "{}" },
        { path: "server.ts", content: "// server" },
        { path: "nested/new/file.ts", content: "// nested" }
      ],
      gate: null
    });

    expect(result.rejected).toEqual([]);
    expect(result.applied.map((entry) => entry.path)).toEqual(["specs/openapi.json", "server.ts", "nested/new/file.ts"]);
    expect(await readFile(join(dir, "specs", "openapi.json"), "utf8")).toBe("{}");
    expect(await readFile(join(dir, "nested", "new", "file.ts"), "utf8")).toBe("// nested");
  });

  test("with an Arm-H gate in the spec phase, only specs/ paths are writable — the gate is the normative decision", async () => {
    const dir = await freshDir();
    const gate = new E4ArmHTaskGate({
      opportunity_labels: ["additive"],
      task_start_spec: { openapi_json: "{}", conventions_md: "- `c-1`: statement" },
      tests: { delta: [], cumulative: [], prior_cumulative: [] },
      runExecutor: async () => {
        throw new Error("executor must not run during write evaluation");
      }
    });

    const result = await applyE4Replacements({
      workspaceDir: dir,
      replacements: [
        { path: "specs/openapi.json", content: '{ "changed": true }' },
        { path: "server.ts", content: "// illegal in spec phase" }
      ],
      gate
    });

    expect(result.applied.map((entry) => entry.path)).toEqual(["specs/openapi.json"]);
    expect(result.rejected).toEqual([
      { path: "server.ts", reason: "not writable in the spec phase (gate protocol)" }
    ]);
    await expect(readFile(join(dir, "server.ts"), "utf8")).rejects.toThrow();
  });

  test("paths escaping the workspace are rejected as defense in depth", async () => {
    const dir = await freshDir();
    const result = await applyE4Replacements({
      workspaceDir: dir,
      replacements: [{ path: "../outside.ts", content: "// escape" }],
      gate: null
    });

    expect(result.applied).toEqual([]);
    expect(result.rejected[0]?.reason).toBe("path escapes the workspace");
  });
});

describe("turn feedback assembly", () => {
  test("a pure no-op turn gets the protocol nudge", () => {
    const feedback = renderE4TurnFeedback({
      confirmations: [],
      rejections: [],
      violations: [],
      verification: null,
      gate: null,
      no_op: true
    });

    expect(feedback).toContain("no valid protocol blocks recognized");
  });

  test("sections render in a fixed order: confirmations, rejections, violations, verification, gate", () => {
    const feedback = renderE4TurnFeedback({
      confirmations: ["applied: a.ts"],
      rejections: [{ path: "specs/x.json", reason: "not writable in the implementation phase (gate protocol)" }],
      violations: [{ code: "orphan_end", line: 3, detail: "END with no open block" }],
      verification: "smoke: the server started and answered the readiness probe (ok).",
      gate: "gate: custody passed (spec_change); entering the implementation phase.",
      no_op: false
    });

    expect(feedback.split("\n")).toEqual([
      "applied: a.ts",
      "write rejected: specs/x.json — not writable in the implementation phase (gate protocol)",
      "protocol violation (orphan_end, line 3): END with no open block",
      "smoke: the server started and answered the readiness probe (ok).",
      "gate: custody passed (spec_change); entering the implementation phase."
    ]);
  });
});
