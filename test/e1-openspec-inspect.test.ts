import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScriptedAgentProvider } from "../src/e1-no-provider-runner";
import { inspectE1Bundle, type E1InspectionReport } from "../src/e1-inspect";
import { loadE1OpenSpecProfile, type E1OpenSpecProfile } from "../src/e1-openspec-constants";
import {
  loadE1OraclePackage,
  loadE1TaskPackage,
  runE1TaskPackageNoProvider
} from "../src/e1-package-runner";

const PROFILE_PATH = join(
  import.meta.dir,
  "..",
  "docs",
  "protocols",
  "e1-openspec-workflow-constants-v0.json"
);
const TASK_PACKAGE_PATH = join(import.meta.dir, "..", "tasks", "e1-cartcalc-openspec", "task-package");
const ORACLE_PACKAGE_PATH = join(import.meta.dir, "..", "tasks", "e1-cartcalc-openspec", "oracle-package");

const tempRoots: string[] = [];
let profile: E1OpenSpecProfile;
let cleanBundlePath: string;

beforeAll(async () => {
  profile = await loadE1OpenSpecProfile(PROFILE_PATH);
  const runsRoot = join(tmpdir(), `hit-sdd-e1-os-inspect-${Date.now()}`);
  tempRoots.push(runsRoot);
  await mkdir(runsRoot, { recursive: true });

  const taskPackage = await loadE1TaskPackage(TASK_PACKAGE_PATH);
  const oraclePackage = await loadE1OraclePackage(ORACLE_PACKAGE_PATH);
  const agentScript = (checkpointId: string): string[] => {
    if (checkpointId === "1") {
      return [[cartCalcImplementation({ discount: false, cap: false }), "<<<DONE>>>"].join("\n")];
    }

    if (checkpointId === "2") {
      return [
        [
          deltaFileBlock("cp2-basis-point-discount", CP2_DELTA),
          cartCalcImplementation({ discount: true, cap: false }),
          "<<<DONE>>>"
        ].join("\n")
      ];
    }

    return [
      [
        deltaFileBlock("cp3-discount-cap", CP3_DELTA),
        cartCalcImplementation({ discount: true, cap: true }),
        "<<<DONE>>>"
      ].join("\n")
    ];
  };

  await runE1TaskPackageNoProvider({
    constants: profile.constants,
    taskPackage,
    oraclePackage,
    runsRoot,
    runId: "openspec-inspect-fixture",
    openspecProfile: profile,
    arms: {
      context_only_spec: ({ checkpointId }) =>
        new ScriptedAgentProvider({ providerId: `c-${checkpointId}`, script: agentScript(checkpointId) }),
      feedback_capable_spec: ({ checkpointId }) =>
        new ScriptedAgentProvider({ providerId: `f-${checkpointId}`, script: agentScript(checkpointId) })
    }
  });

  cleanBundlePath = join(runsRoot, "openspec-inspect-fixture", "e1-task-package-bundle.json");
});

afterAll(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("E1 inspection replays the OpenSpec archive step", () => {
  test("a clean OpenSpec bundle replays archive steps with zero mismatches", async () => {
    const report = await inspect(cleanBundlePath);

    expect(report.mismatches).toEqual([]);
    expect(report.valid).toBe(true);
    expect(report.replay_steps).toBe(6);
  }, 30000);

  test("a tampered survival ledger is caught by archive replay", async () => {
    const bundle = JSON.parse(await readFile(cleanBundlePath, "utf8"));
    bundle.openspec_workflow.archive_records.context_only_spec[0].survival_ledger.added_scenarios = [];
    const report = await inspectTampered(bundle);

    expect(report.valid).toBe(false);
    expect(report.mismatches.map((m) => m.kind)).toContain("replay_openspec_archive");
    expect(report.mismatches.map((m) => m.kind)).toContain("content_hash_manifest");
  }, 30000);

  test("a tampered post-archive spec-of-record hash is caught", async () => {
    const bundle = JSON.parse(await readFile(cleanBundlePath, "utf8"));
    bundle.openspec_workflow.archive_records.feedback_capable_spec[1].post_spec_of_record_hash = "0".repeat(64);
    const report = await inspectTampered(bundle);

    expect(report.valid).toBe(false);
    expect(
      report.mismatches.some(
        (m) => m.kind === "replay_openspec_archive" && m.detail.includes("post_spec_of_record_hash")
      )
    ).toBe(true);
  }, 30000);

  test("inspection requires the profile for openspec task packages", async () => {
    const tmpRoot = await setupTempDir();

    await expect(
      inspectE1Bundle({
        constants: profile.constants,
        bundlePath: cleanBundlePath,
        taskPackagePath: TASK_PACKAGE_PATH,
        oraclePackagePath: ORACLE_PACKAGE_PATH,
        tmpRoot
      })
    ).rejects.toThrow("openspecProfile is required");
  });
});

async function inspect(bundlePath: string): Promise<E1InspectionReport> {
  const tmpRoot = await setupTempDir();

  return inspectE1Bundle({
    constants: profile.constants,
    bundlePath,
    taskPackagePath: TASK_PACKAGE_PATH,
    oraclePackagePath: ORACLE_PACKAGE_PATH,
    tmpRoot,
    openspecProfile: profile
  });
}

async function inspectTampered(bundle: unknown): Promise<E1InspectionReport> {
  const tmpRoot = await setupTempDir();
  const tamperedPath = join(tmpRoot, "tampered-bundle.json");
  await writeFile(tamperedPath, JSON.stringify(bundle, null, 2));

  return inspect(tamperedPath);
}

function deltaFileBlock(changeName: string, delta: string): string {
  return [`<<<FILE openspec/changes/${changeName}/specs/cartcalc/spec.md>>>`, delta, "<<<END>>>"].join("\n");
}

const CP2_DELTA = [
  "## ADDED Requirements",
  "",
  "### Requirement: Basis-point discount",
  "The cart SHALL apply a configured basis-point discount to the subtotal, flooring the discount amount.",
  "",
  "#### Scenario: Basis-point discount applied",
  "- **GIVEN** a cart subtotal of 800 cents and a discount of 250 basis points",
  "- **WHEN** the total is computed",
  "- **THEN** the discount is 20 cents and the total is 780 cents"
].join("\n");

const CP3_DELTA = [
  "## ADDED Requirements",
  "",
  "### Requirement: Discount cap",
  "The cart SHALL cap the computed discount at the configured maximum discount amount.",
  "",
  "#### Scenario: Discount capped",
  "- **GIVEN** a discount that would exceed the configured cap",
  "- **WHEN** the discount is computed",
  "- **THEN** the discount equals the cap"
].join("\n");

function cartCalcImplementation(input: { discount: boolean; cap: boolean }): string {
  const discount = !input.discount
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
  const root = join(tmpdir(), `hit-sdd-e1-os-inspect-tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}
