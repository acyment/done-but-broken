import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashProtectedPaths, applyParsedTurnToL0 } from "../src/e1-harness";
import { classifyE1Command } from "../src/e1-l1-command";
import { loadE1Constants, type E1SealedConstants } from "../src/e1-l1-constants";
import { E1TurnParser } from "../src/e1-l1-parser";

const CONSTANTS_PATH = join(
  import.meta.dir,
  "..",
  "docs",
  "protocols",
  "e1-frontier-sealed-constants-v1.0.json"
);

let constants: E1SealedConstants;
let parser: E1TurnParser;

beforeAll(async () => {
  constants = await loadE1Constants(CONSTANTS_PATH);
  parser = new E1TurnParser(constants);
});

describe("E1 L1 parser shakedown", () => {
  test("pure prose and empty output are no-op turns without violations", () => {
    for (const output of [
      "",
      "Let me think about the proration logic.\nI will explain the invariant first.",
      "I will now emit a <<<FILE ...>>> block, followed by <<<END>>>."
    ]) {
      const parsed = parser.parse(output);
      expect(parsed.no_op, output).toBe(true);
      expect(parsed.violations, output).toEqual([]);
    }
  });

  test("parses file, verify, and done blocks while preserving file content verbatim", () => {
    const content = "export const x = 1;\n\n  // indented\nexport const y = 2;";
    const parsed = parser.parse(
      [
        "<<<FILE src/pricing.ts>>>",
        content,
        "<<<END>>>",
        "<<<VERIFY>>>",
        "bun scratch/probe.ts",
        "<<<END>>>",
        "<<<DONE>>>"
      ].join("\n")
    );

    expect(parsed.replacements).toEqual([{ path: "src/pricing.ts", content }]);
    expect(parsed.verification?.valid).toBe(true);
    expect(parsed.verification?.kind).toBe("bun_file_scratch");
    expect(parsed.verification?.conditions).toEqual([
      "context_only_spec",
      "feedback_capable_spec"
    ]);
    expect(parsed.done).toBe(true);
    expect(parsed.no_op).toBe(false);
  });

  test("trailing delimiter whitespace is tolerated but leading delimiter whitespace disqualifies", () => {
    expect(parser.parse("<<<FILE src/a.ts>>>   \nconst a = 1;   \n<<<END>>>\t").replacements).toEqual([
      { path: "src/a.ts", content: "const a = 1;   " }
    ]);

    const leading = parser.parse("  <<<DONE>>>");
    expect(leading.done).toBe(false);
    expect(leading.no_op).toBe(true);
  });

  test("protocol-looking lines inside file content remain content until END", () => {
    const content = "const s = `template`;\n<<<DONE>>>\n```ts\nnot a fence here\n```";
    const parsed = parser.parse(`<<<FILE src/weird.ts>>>\n${content}\n<<<END>>>`);
    expect(parsed.replacements).toEqual([{ path: "src/weird.ts", content }]);
    expect(parsed.done).toBe(false);
  });

  test("bare END line inside content terminates the block as the sealed limitation", () => {
    const parsed = parser.parse("<<<FILE src/a.ts>>>\nline1\n<<<END>>>\nline2\n<<<END>>>");
    expect(parsed.replacements).toEqual([{ path: "src/a.ts", content: "line1" }]);
    expect(parsed.violations.some((violation) => violation.code === "orphan_end")).toBe(true);
  });

  test("malformed delimiters and unclosed blocks are audit-visible no-ops when no valid block remains", () => {
    const cases = [
      ["<<<FILE src/a.ts>>>\nsome content", "unclosed_file_block"],
      ["<<<VERIFY>>>\nbun run spec", "unclosed_verify_block"],
      ["<<<FILE>>>\ncontent\n<<<END>>>", "unrecognized_protocol_line"],
      ["<<< VERIFY >>>\nbun run spec\n<<<END>>>", "unrecognized_protocol_line"],
      ["<<<FILE scratch/../src/evil.ts>>>\nhacked\n<<<END>>>", "file_open_invalid_path"]
    ] as const;

    for (const [output, code] of cases) {
      const parsed = parser.parse(output);
      expect(parsed.no_op, output).toBe(true);
      expect(parsed.violations.some((violation) => violation.code === code), output).toBe(true);
    }
  });

  test("nested file opener inside file block is verbatim content", () => {
    const parsed = parser.parse("<<<FILE src/a.ts>>>\n<<<FILE src/b.ts>>>\ninner\n<<<END>>>");
    expect(parsed.replacements).toEqual([{ path: "src/a.ts", content: "<<<FILE src/b.ts>>>\ninner" }]);
    expect(parsed.violations).toEqual([]);
  });

  test("invalid VERIFY block content emits no slot-consuming request", () => {
    for (const output of [
      "<<<VERIFY>>>\n\n<<<END>>>",
      "<<<VERIFY>>>\nbun run spec\nbun test scratch/a.test.ts\n<<<END>>>"
    ]) {
      const parsed = parser.parse(output);
      expect(parsed.verification, output).toBeNull();
      expect(parsed.no_op, output).toBe(true);
      expect(parsed.violations.length, output).toBeGreaterThan(0);
    }
  });

  test("block-valid VERIFY with command-invalid content emits a slot-consuming refusal request", () => {
    const parsed = parser.parse("<<<VERIFY>>>\nrm -rf /\n<<<END>>>");
    expect(parsed.verification?.valid).toBe(false);
    expect(parsed.no_op).toBe(false);
  });

  test("strips one outer markdown fence layer around valid blocks", () => {
    const inner = "<<<FILE src/a.ts>>>\nconst a = 1;\n<<<END>>>";
    const cases = [
      "```\n" + inner + "\n```",
      "```typescript\n" + inner + "\n```",
      "Here is my change:\n```ts\n" + inner + "\n```\nDone.",
      "```\nprose\n```ts\nmore prose\n" + inner + "\n```",
      "```\n" + inner + "\n`````",
      "`````\n```\n" + inner + "\n`````"
    ];

    for (const output of cases) {
      expect(parser.parse(output).replacements, output).toHaveLength(1);
    }
  });

  test("unclosed fence is info, not violation, and blocks inside still parse", () => {
    const parsed = parser.parse("```ts\n<<<FILE src/a.ts>>>\nA\n<<<END>>>");
    expect(parsed.replacements).toEqual([{ path: "src/a.ts", content: "A" }]);
    expect(parsed.info.some((entry) => entry.includes("unclosed markdown fence"))).toBe(true);
    expect(parsed.violations).toEqual([]);
  });

  test("wrong textual order still parses all valid blocks", () => {
    const parsed = parser.parse(
      "<<<DONE>>>\n<<<VERIFY>>>\nbun test scratch/regress.test.ts\n<<<END>>>\n<<<FILE src/a.ts>>>\nX\n<<<END>>>"
    );
    expect(parsed.done).toBe(true);
    expect(parsed.verification?.kind).toBe("bun_test_scratch");
    expect(parsed.replacements).toEqual([{ path: "src/a.ts", content: "X" }]);
  });

  test("chatty output with buried blocks parses deterministically", () => {
    const filler = "Reasoning paragraph about invariants.\n".repeat(20);
    const output =
      filler +
      "<<<FILE src/invoices.ts>>>\nexport const t = 1;\n<<<END>>>\n" +
      filler +
      "<<<VERIFY>>>\nbun run spec -- --cp=7\n<<<END>>>\n" +
      filler +
      "<<<DONE>>>";
    const serialized = JSON.stringify(parser.parse(output));

    for (let index = 0; index < 50; index += 1) {
      expect(JSON.stringify(parser.parse(output))).toBe(serialized);
    }
  });

  test("duplicate verify is first-wins and duplicate file path is last-wins", () => {
    const verify = parser.parse(
      "<<<VERIFY>>>\nbun run spec\n<<<END>>>\n<<<VERIFY>>>\nbun test scratch/a.test.ts\n<<<END>>>"
    );
    expect(verify.verification?.kind).toBe("spec_runner");
    expect(verify.violations).toEqual([expect.objectContaining({ code: "multiple_verify_blocks" })]);

    const file = parser.parse(
      "<<<FILE src/a.ts>>>\nfirst\n<<<END>>>\n<<<FILE src/a.ts>>>\nsecond\n<<<END>>>"
    );
    expect(file.replacements).toEqual([{ path: "src/a.ts", content: "second" }]);
    expect(file.violations).toEqual([expect.objectContaining({ code: "duplicate_file_path" })]);
  });

  test("duplicate DONE is idempotent info", () => {
    const parsed = parser.parse("<<<DONE>>>\n<<<DONE>>>");
    expect(parsed.done).toBe(true);
    expect(parsed.violations).toEqual([]);
    expect(parsed.info.some((entry) => entry.includes("duplicate DONE"))).toBe(true);
  });
});

describe("E1 command grammar", () => {
  test("all sealed command templates classify with exact condition metadata", () => {
    expect(classifyE1Command("bun run spec", constants)).toMatchObject({
      valid: true,
      kind: "spec_runner",
      conditions: ["feedback_capable_spec"]
    });
    expect(classifyE1Command("bun run spec -- --cp=18", constants)).toMatchObject({
      valid: true,
      kind: "spec_runner_cp",
      cp: 18
    });
    expect(classifyE1Command("bun test scratch/regress.test.ts", constants)).toMatchObject({
      valid: true,
      kind: "bun_test_scratch",
      argv: ["bun", "test", "scratch/regress.test.ts"],
      conditions: ["context_only_spec", "feedback_capable_spec"]
    });
    expect(classifyE1Command("bun scratch/probe.ts", constants)).toMatchObject({
      valid: true,
      kind: "bun_file_scratch"
    });
  });

  test("checkpoint range and integer shape are sealed", () => {
    for (const command of [
      "bun run spec -- --cp=0",
      "bun run spec -- --cp=25",
      "bun run spec -- --cp=007",
      "bun run spec -- --cp=7.5",
      "bun run spec -- --cp=-3"
    ]) {
      expect(classifyE1Command(command, constants).valid, command).toBe(false);
    }
  });

  test("separator rule rejects tabs, double spaces, and trailing spaces", () => {
    for (const command of ["bun  run spec", "bun\trun spec", "bun run spec "]) {
      expect(classifyE1Command(command, constants).valid, command).toBe(false);
    }
  });

  test("adversarial command and path battery rejects before execution", () => {
    const cases = [
      "bun test scratch/../src/x.ts",
      "bun test /etc/passwd",
      "bun test scratch/",
      "bun test scratch/*.ts",
      "bun test scratch/a.ts; rm -rf /",
      "bun test scratch/a`whoami`.ts",
      "bun test scratch/a.ts&&bun run spec",
      "bun test $(echo scratch/a.ts)",
      "bun test scratch%2F..%2Fsrc/x.ts",
      "bun test scrаtch/a.ts",
      "bun test scratch\\a.ts",
      "bun test scratch/a.ts\u0000",
      "bun test ~/scratch/a.ts",
      "bun test -e=scratch/a.ts",
      "bun test scratch/a.js",
      "bun test src/pricing.ts",
      "bun --eval console.log(1)",
      "bun run scratch/a.ts",
      "FOO=1 bun run spec",
      "bun run spec -- --cp=18 --extra",
      "node scratch/a.ts"
    ];

    for (const command of cases) {
      const classified = classifyE1Command(command, constants);
      expect(classified.valid, command).toBe(false);
      expect(classified.refusal_reason, command).toBeTruthy();
    }
  });
});

describe("E1 L1 to L0 integration", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    for (const root of tempRoots.splice(0)) {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("applies parsed replacements and executes parsed verification through L0", async () => {
    const workspace = await setupIntegrationWorkspace(tempRoots);
    await writeFile(
      join(workspace, "scratch", "probe.test.ts"),
      "import { expect, test } from 'bun:test';\ntest('integrated', () => expect(1).toBe(1));\n"
    );
    const baseline = await hashProtectedPaths(workspace);
    const parsed = parser.parse(
      "<<<FILE src/a.ts>>>\nexport const a = 1;\n<<<END>>>\n<<<VERIFY>>>\nbun test scratch/probe.test.ts\n<<<END>>>"
    );

    const result = await applyParsedTurnToL0({
      workspacePath: workspace,
      conditionId: "context_only_spec",
      parsedTurn: parsed,
      checkpoints: ["1", "2", "3"],
      protectedPathBaseline: baseline,
      outputLimit: 2000
    });

    expect(result.replacement_result?.applied).toBe(true);
    expect(await readFile(join(workspace, "src", "a.ts"), "utf8")).toBe("export const a = 1;");
    expect(result.post_replacement_integrity).toEqual({ ok: true });
    expect(result.verification_result?.accepted).toBe(true);
    expect(result.verification_result?.exit_code).toBe(0);
  });

  test("read-only replacement rejection is an L0 result, not a parser no-op", async () => {
    const workspace = await setupIntegrationWorkspace(tempRoots);
    const parsed = parser.parse("<<<FILE package.json>>>\n{}\n<<<END>>>");

    expect(parsed.no_op).toBe(false);
    const result = await applyParsedTurnToL0({
      workspacePath: workspace,
      conditionId: "context_only_spec",
      parsedTurn: parsed,
      checkpoints: ["1"]
    });

    expect(result.replacement_result?.applied).toBe(false);
    expect(result.replacement_result?.errors).toContain("package.json is read-only");
    expect(result.verification_result).toBeNull();
  });

  test("command-invalid parsed verification reaches L0 refusal path", async () => {
    const workspace = await setupIntegrationWorkspace(tempRoots);
    const parsed = parser.parse("<<<VERIFY>>>\nrm -rf /\n<<<END>>>");

    expect(parsed.verification?.valid).toBe(false);
    const result = await applyParsedTurnToL0({
      workspacePath: workspace,
      conditionId: "context_only_spec",
      parsedTurn: parsed,
      checkpoints: ["1"]
    });

    expect(result.verification_result?.accepted).toBe(false);
    expect(result.verification_result?.refusal_reason).toBeTruthy();
  });
});

async function setupIntegrationWorkspace(tempRoots: string[]): Promise<string> {
  const root = join(tmpdir(), `hit-sdd-e1-l1-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "scratch"), { recursive: true });
  await mkdir(join(root, "specs", "steps"), { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({ type: "module" }));
  await writeFile(join(root, "bunfig.toml"), "");
  return root;
}
