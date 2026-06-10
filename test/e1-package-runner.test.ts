import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  calculateE1CheckpointMeanPassRateAuc,
  loadE1OraclePackage,
  loadE1TaskPackage,
  runE1TaskPackageNoProvider,
  validateNoReachableRealClock
} from "../src/e1-package-runner";
import { ScriptedAgentProvider } from "../src/e1-no-provider-runner";
import { loadE1Constants, type E1SealedConstants } from "../src/e1-l1-constants";

const CONSTANTS_PATH = join(
  import.meta.dir,
  "..",
  "docs",
  "protocols",
  "e1-frontier-sealed-constants-v0.2.json"
);
const TASK_PACKAGE_PATH = join(import.meta.dir, "..", "tasks", "e1-cartcalc", "task-package");
const ORACLE_PACKAGE_PATH = join(import.meta.dir, "..", "tasks", "e1-cartcalc", "oracle-package");

const tempRoots: string[] = [];
let constants: E1SealedConstants;

beforeAll(async () => {
  constants = await loadE1Constants(CONSTANTS_PATH);
});

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("E1 task/oracle package runner", () => {
  test("loads CartCalc as separate task and oracle packages with fixed virtual time", async () => {
    const taskPackage = await loadE1TaskPackage(TASK_PACKAGE_PATH);
    const oraclePackage = await loadE1OraclePackage(ORACLE_PACKAGE_PATH);

    expect(taskPackage.schema_version).toBe("e1-task-package-v0");
    expect(oraclePackage.schema_version).toBe("e1-oracle-package-v0");
    expect(taskPackage.task_id).toBe("e1-cartcalc");
    expect(oraclePackage.task_id).toBe(taskPackage.task_id);
    expect(taskPackage.virtual_now).toBe("2026-01-01T00:00:00.000Z");
    expect(oraclePackage.virtual_now).toBe(taskPackage.virtual_now);
    expect(taskPackage.package_hash).toHaveLength(64);
    expect(oraclePackage.package_hash).toHaveLength(64);
    expect(taskPackage.package_hash).not.toBe(oraclePackage.package_hash);
    expect(taskPackage.feedback_assets).toHaveLength(3);
    expect(oraclePackage.cases).toHaveLength(10);
  });

  test("rejects reachable Date.now in package-controlled files", async () => {
    const root = join(tmpdir(), `hit-sdd-e1-clock-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    tempRoots.push(root);
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "bad.ts"), "export const now = Date.now();\n");

    await expect(validateNoReachableRealClock(root)).rejects.toThrow("Date.now");
  });

  test("rejects feedback asset paths that escape the mounted workspace", async () => {
    const runsRoot = await setupTempDir();
    const taskPackage = await loadE1TaskPackage(TASK_PACKAGE_PATH);
    const oraclePackage = await loadE1OraclePackage(ORACLE_PACKAGE_PATH);
    const badTaskPackage = {
      ...taskPackage,
      feedback_assets: [{ ...taskPackage.feedback_assets[0], relative_path: "../escape.ts" }]
    };

    await expect(
      runE1TaskPackageNoProvider({
        constants,
        taskPackage: badTaskPackage,
        oraclePackage,
        runsRoot,
        runId: "cartcalc-escape",
        arms: {
          context_only_spec: () =>
            new ScriptedAgentProvider({ providerId: "context-escape", script: ["<<<DONE>>>"] }),
          feedback_capable_spec: () =>
            new ScriptedAgentProvider({ providerId: "feedback-escape", script: ["<<<DONE>>>"] })
        }
      })
    ).rejects.toThrow("escapes package root");
  });

  test("calculates the sealed checkpoint-mean cumulative pass-rate AUC", () => {
    const score = calculateE1CheckpointMeanPassRateAuc([
      { checkpoint_id: "CP1", passed: 2, total: 4 },
      { checkpoint_id: "CP2", passed: 3, total: 4 },
      { checkpoint_id: "CP3", passed: 4, total: 4 }
    ]);

    expect(score).toBe((0.5 + 0.75 + 1) / 3);
  });

  test("runs CartCalc through dev-grade no-provider package/oracle bundles with per-turn scoring", async () => {
    const runsRoot = await setupTempDir();
    const taskPackage = await loadE1TaskPackage(TASK_PACKAGE_PATH);
    const oraclePackage = await loadE1OraclePackage(ORACLE_PACKAGE_PATH);

    const bundle = await runE1TaskPackageNoProvider({
      constants,
      taskPackage,
      oraclePackage,
      runsRoot,
      runId: "cartcalc-scripted-dev",
      protocolDocumentHash: undefined,
      arms: {
        context_only_spec: ({ checkpointId }) =>
          new ScriptedAgentProvider({
            providerId: `context-${checkpointId}`,
            script: [cartCalcImplementation({ cap: checkpointId === "3" }), "<<<DONE>>>"]
          }),
        feedback_capable_spec: ({ checkpointId }) =>
          new ScriptedAgentProvider({
            providerId: `feedback-${checkpointId}`,
            script:
              checkpointId === "2"
                ? [
                    [
                      cartCalcImplementation({ cap: false, discount: false }),
                      "<<<VERIFY>>>",
                      "bun run spec -- --cp=2",
                      "<<<END>>>"
                    ].join("\n"),
                    [cartCalcImplementation({ cap: false, discount: true }), "<<<DONE>>>"].join("\n")
                  ]
                : [cartCalcImplementation({ cap: checkpointId === "3" }), "<<<DONE>>>"]
          })
      }
    });

    expect(bundle.grade).toBe("dev");
    expect(bundle.run_identity.task_package_hash).toBe(taskPackage.package_hash);
    expect(bundle.run_identity.oracle_package_hash).toBe(oraclePackage.package_hash);
    expect(bundle.oracle_scoring.cadence).toBe("every_turn_snapshot");
    expect(bundle.oracle_scoring.per_turn.feedback_capable_spec["2"]).toHaveLength(2);
    expect(bundle.oracle_scoring.per_turn.feedback_capable_spec["2"][0].summary.passed).toBeLessThan(
      bundle.oracle_scoring.per_turn.feedback_capable_spec["2"][1].summary.passed
    );
    expect(bundle.metrics.by_condition.feedback_capable_spec).toBe(1);
    expect(bundle.content_hash_manifest_hash).toHaveLength(64);
  });
});

function cartCalcImplementation(input: { cap: boolean; discount?: boolean }): string {
  const discount =
    input.discount === false
      ? "  return 0;"
      : input.cap
        ? "  const uncapped = Math.floor((subtotal * discountBps) / 10000);\n  return Math.min(uncapped, input.discountCapCents ?? uncapped);"
        : "  return Math.floor((subtotal * discountBps) / 10000);";

  return [
    "<<<FILE src/cartcalc.ts>>>",
    "export type LineItem = { sku: string; unitCents: number; quantity: number };",
    "export type QuoteInput = { items: LineItem[]; discountBps?: number; discountCapCents?: number };",
    "",
    "export function lineSubtotalCents(item: LineItem): number {",
    "  return item.unitCents * item.quantity;",
    "}",
    "",
    "export function subtotalCents(items: LineItem[]): number {",
    "  return items.reduce((sum, item) => sum + lineSubtotalCents(item), 0);",
    "}",
    "",
    "export function discountCents(input: QuoteInput): number {",
    "  const subtotal = subtotalCents(input.items);",
    "  const discountBps = input.discountBps ?? 0;",
    discount,
    "}",
    "",
    "export function totalCents(input: QuoteInput): number {",
    "  return subtotalCents(input.items) - discountCents(input);",
    "}",
    "<<<END>>>"
  ].join("\n");
}

async function setupTempDir(): Promise<string> {
  const root = join(tmpdir(), `hit-sdd-e1-package-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}
