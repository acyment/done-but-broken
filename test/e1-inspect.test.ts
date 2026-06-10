import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScriptedAgentProvider } from "../src/e1-no-provider-runner";
import { inspectE1Bundle, renderE1InspectionLines, type E1InspectionReport } from "../src/e1-inspect";
import {
  loadE1OraclePackage,
  loadE1TaskPackage,
  runE1TaskPackageNoProvider
} from "../src/e1-package-runner";
import { loadE1Constants, type E1SealedConstants } from "../src/e1-l1-constants";

const CONSTANTS_PATH = join(
  import.meta.dir,
  "..",
  "docs",
  "protocols",
  "e1-frontier-sealed-constants-v1.0.json"
);
const TASK_PACKAGE_PATH = join(import.meta.dir, "..", "tasks", "e1-cartcalc", "task-package");
const ORACLE_PACKAGE_PATH = join(import.meta.dir, "..", "tasks", "e1-cartcalc", "oracle-package");

const tempRoots: string[] = [];
let constants: E1SealedConstants;
let cleanBundlePath: string;

beforeAll(async () => {
  constants = await loadE1Constants(CONSTANTS_PATH);
  const runsRoot = join(tmpdir(), `hit-sdd-e1-inspect-fixture-${Date.now()}`);
  tempRoots.push(runsRoot);
  await mkdir(runsRoot, { recursive: true });

  const taskPackage = await loadE1TaskPackage(TASK_PACKAGE_PATH);
  const oraclePackage = await loadE1OraclePackage(ORACLE_PACKAGE_PATH);

  await runE1TaskPackageNoProvider({
    constants,
    taskPackage,
    oraclePackage,
    runsRoot,
    runId: "inspect-fixture",
    arms: {
      context_only_spec: ({ checkpointId }) =>
        new ScriptedAgentProvider({
          providerId: `context-${checkpointId}`,
          script: [[cartCalcImplementation({ cap: checkpointId === "3" }), "<<<DONE>>>"].join("\n")]
        }),
      feedback_capable_spec: ({ checkpointId }) =>
        new ScriptedAgentProvider({
          providerId: `feedback-${checkpointId}`,
          script: [[cartCalcImplementation({ cap: checkpointId === "3" }), "<<<DONE>>>"].join("\n")]
        })
    }
  });

  cleanBundlePath = join(runsRoot, "inspect-fixture", "e1-task-package-bundle.json");
});

afterEach(async () => {
  for (const root of tempRoots.splice(tempRoots.indexOf(tempRoots[0]) + 1)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("E1 publication-grade bundle inspection", () => {
  test("a clean bundle replays and rescores with zero mismatches", async () => {
    const report = await inspect(cleanBundlePath);

    expect(report.valid).toBe(true);
    expect(report.mismatches).toEqual([]);
    expect(report.replay_steps).toBe(6);
    expect(report.run_status).toBe("completed");
    expect(report.run_classification).toBe("n/a");
    expect(report.metrics_by_condition.context_only_spec).toBe(1);

    const lines = renderE1InspectionLines(report);

    expect(lines).toContain("valid=true");
    expect(lines).toContain("replay_steps=6");
    expect(lines).toContain("mismatches=0");
  });

  test("tampered model output is caught by replay workspace hashes", async () => {
    const report = await inspectTampered((bundle) => {
      const record = bundle.no_provider_run.arm_bundles.context_only_spec[0].turn_records[0];
      record.raw_model_output = record.raw_model_output.replace(
        "export function totalCents",
        "export function totalCentsTampered"
      );
    });

    expect(report.valid).toBe(false);
    expect(report.mismatches.map((m) => m.kind)).toContain("replay_turn_workspace_hash");
    expect(report.mismatches.map((m) => m.kind)).toContain("content_hash_manifest");
  });

  test("tampered oracle scoring is caught by rescoring", async () => {
    const report = await inspectTampered((bundle) => {
      bundle.oracle_scoring.checkpoint_end.context_only_spec[0].summary.passed = 0;
      bundle.oracle_scoring.checkpoint_end.context_only_spec[0].summary.pass_rate = 0;
    });

    expect(report.valid).toBe(false);
    expect(report.mismatches.map((m) => m.kind)).toContain("oracle_scoring");
  });

  test("forged metrics are caught by recomputation", async () => {
    const report = await inspectTampered((bundle) => {
      bundle.metrics.by_condition.context_only_spec = 0.1234;
    });

    expect(report.valid).toBe(false);
    expect(report.mismatches.map((m) => m.kind)).toContain("metrics");
  });

  test("a tampered content-hash manifest hash is caught", async () => {
    const report = await inspectTampered((bundle) => {
      bundle.content_hash_manifest_hash = "0".repeat(64);
    });

    expect(report.valid).toBe(false);
    expect(report.mismatches.map((m) => m.kind)).toContain("content_hash_manifest_hash");
  });

  test("a forged task package hash is caught against the on-disk package", async () => {
    const report = await inspectTampered((bundle) => {
      bundle.run_identity.task_package_hash = "f".repeat(64);
    });

    expect(report.valid).toBe(false);
    expect(report.mismatches.map((m) => m.kind)).toContain("task_package_hash");
  });

  test("a constants-version drift blocks replay and is reported", async () => {
    const report = await inspectTampered((bundle) => {
      bundle.run_identity.constants_version = "0.0.1";
    });

    expect(report.valid).toBe(false);
    expect(report.mismatches.map((m) => m.kind)).toContain("constants_version");
    expect(report.replay_steps).toBe(0);
  });
});

async function inspect(bundlePath: string): Promise<E1InspectionReport> {
  const tmpRoot = join(tmpdir(), `hit-sdd-e1-inspect-tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(tmpRoot);
  await mkdir(tmpRoot, { recursive: true });

  return inspectE1Bundle({
    constants,
    bundlePath,
    taskPackagePath: TASK_PACKAGE_PATH,
    oraclePackagePath: ORACLE_PACKAGE_PATH,
    tmpRoot
  });
}

async function inspectTampered(
  tamper: (bundle: ReturnType<JSON["parse"]>) => void
): Promise<E1InspectionReport> {
  const tmpRoot = join(tmpdir(), `hit-sdd-e1-inspect-tamper-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(tmpRoot);
  await mkdir(tmpRoot, { recursive: true });
  const bundle = JSON.parse(await readFile(cleanBundlePath, "utf8"));
  tamper(bundle);
  const tamperedPath = join(tmpRoot, "tampered-bundle.json");
  await writeFile(tamperedPath, JSON.stringify(bundle, null, 2));

  return inspect(tamperedPath);
}

function cartCalcImplementation(input: { cap: boolean }): string {
  const discount = input.cap
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
