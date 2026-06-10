import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  jsonDeepEqual,
  runE1ModuleCallCases,
  type E1ModuleCallOracleCase
} from "../src/e1-package-runner";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("E1 module-call-json-v1 oracle", () => {
  test("calls exports across multiple snapshot files and deep-compares JSON results", async () => {
    const root = await setupTempDir();
    await mkdir(join(root, "src", "domain"), { recursive: true });
    await writeFile(join(root, "package.json"), "{\"type\":\"module\"}\n");
    await writeFile(
      join(root, "src", "domain", "money.ts"),
      "export function addCents(a: number, b: number): number { return a + b; }\n"
    );
    await writeFile(
      join(root, "src", "billing.ts"),
      [
        "import { addCents } from \"./domain/money\";",
        "export function evaluate(events: Array<{ amount: number }>, query: { kind: string }) {",
        "  const total = events.reduce((sum, event) => addCents(sum, event.amount), 0);",
        "  return { kind: query.kind, total, lines: events.map((event) => ({ amount: event.amount })) };",
        "}"
      ].join("\n")
    );

    const cases: E1ModuleCallOracleCase[] = [
      {
        check_id: "total-ok",
        commitment_id: "I-TOTALS",
        checkpoint_introduced: "1",
        entry_module: "src/billing.ts",
        export: "evaluate",
        args: [[{ amount: 250 }, { amount: 100 }], { kind: "invoice" }],
        expected: { kind: "invoice", total: 350, lines: [{ amount: 250 }, { amount: 100 }] }
      },
      {
        check_id: "total-mismatch",
        commitment_id: "I-TOTALS",
        checkpoint_introduced: "1",
        entry_module: "src/billing.ts",
        export: "evaluate",
        args: [[{ amount: 250 }], { kind: "invoice" }],
        expected: { kind: "invoice", total: 999, lines: [{ amount: 250 }] },
        held_out: true
      },
      {
        check_id: "missing-export",
        commitment_id: "I-API",
        checkpoint_introduced: "1",
        entry_module: "src/billing.ts",
        export: "doesNotExist",
        args: [],
        expected: null
      }
    ];

    const results = await runE1ModuleCallCases({ snapshotRoot: root, cases });

    expect(results).toHaveLength(3);
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(false);
    expect(results[1].details).toContain("expected");
    expect(results[2].passed).toBe(false);
    expect(results[2].details).toContain("missing exported function");
  });

  test("import failures fail every case against that module with details", async () => {
    const root = await setupTempDir();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "package.json"), "{\"type\":\"module\"}\n");
    await writeFile(join(root, "src", "billing.ts"), "import { missing } from \"./nope\";\nexport const x = missing;\n");

    const results = await runE1ModuleCallCases({
      snapshotRoot: root,
      cases: [
        {
          check_id: "broken",
          commitment_id: "I-API",
          checkpoint_introduced: "1",
          entry_module: "src/billing.ts",
          export: "evaluate",
          args: [],
          expected: 1
        }
      ]
    });

    expect(results[0].passed).toBe(false);
    expect(results[0].details).toContain("module import failed");
  });

  test("entry modules cannot escape the snapshot root", async () => {
    const root = await setupTempDir();

    await expect(
      runE1ModuleCallCases({
        snapshotRoot: root,
        cases: [
          {
            check_id: "escape",
            commitment_id: "I-API",
            checkpoint_introduced: "1",
            entry_module: "../outside.ts",
            export: "evaluate",
            args: [],
            expected: 1
          }
        ]
      })
    ).rejects.toThrow("escapes package root");
  });

  test("jsonDeepEqual compares structurally, key-order independent", () => {
    expect(jsonDeepEqual({ a: 1, b: [1, { c: "x" }] }, { b: [1, { c: "x" }], a: 1 })).toBe(true);
    expect(jsonDeepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(jsonDeepEqual([1, 2], [2, 1])).toBe(false);
    expect(jsonDeepEqual("500", 500)).toBe(false);
    expect(jsonDeepEqual(null, null)).toBe(true);
  });
});

async function setupTempDir(): Promise<string> {
  const root = join(tmpdir(), `hit-sdd-e1-modcall-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}
