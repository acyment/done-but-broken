import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScriptedAgentProvider } from "../src/e1-no-provider-runner";
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

beforeAll(async () => {
  profile = await loadE1OpenSpecProfile(PROFILE_PATH);
});

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("E1 OpenSpec workflow profile (e1-openspec-workflow-v0)", () => {
  test("profile loads and composes the sealed base constants with workflow guards", () => {
    expect(profile.profile.protocol_profile_id).toBe("e1-openspec-workflow-v0");
    expect(profile.profile.workflow_profile.openspec_version).toBe("1.4.1");
    expect(profile.constants.version).toBe("0.3.4");
    expect(profile.workflowGuards.extra_read_only_prefixes).toContain("openspec/specs/");
    expect(profile.snapshotIncludedRoots).toContain("openspec/");
    expect(profile.snapshotExcludedPathPrefixes).toContain("openspec/changes/archive/");
  });

  test("runs the OpenSpec CartCalc fixture end to end with archive steps, ledger, and guards", async () => {
    const runsRoot = await setupTempDir();
    const taskPackage = await loadE1TaskPackage(TASK_PACKAGE_PATH);
    const oraclePackage = await loadE1OraclePackage(ORACLE_PACKAGE_PATH);

    expect(taskPackage.workflow).toBe("openspec");
    expect(taskPackage.workflow_changes).toEqual({
      "2": "cp2-basis-point-discount",
      "3": "cp3-discount-cap"
    });

    const bundle = await runE1TaskPackageNoProvider({
      constants: profile.constants,
      taskPackage,
      oraclePackage,
      runsRoot,
      runId: "cartcalc-openspec-shakedown",
      openspecProfile: profile,
      arms: {
        context_only_spec: ({ checkpointId }) =>
          new ScriptedAgentProvider({
            providerId: `context-openspec-${checkpointId}`,
            script: contextScript(checkpointId)
          }),
        feedback_capable_spec: ({ checkpointId }) =>
          new ScriptedAgentProvider({
            providerId: `feedback-openspec-${checkpointId}`,
            script: feedbackScript(checkpointId)
          })
      }
    });

    expect(bundle.no_provider_run.run_summary.status).toBe("completed");
    expect(bundle.metrics.by_condition.context_only_spec).toBe(1);
    expect(bundle.metrics.by_condition.feedback_capable_spec).toBe(1);

    const workflow = bundle.openspec_workflow!;

    expect(workflow.protocol_profile_id).toBe("e1-openspec-workflow-v0");
    expect(workflow.openspec_version).toBe("1.4.1");

    // CP1 fresh-mount parity holds; after the context arm's CP2 archive drops a scenario the
    // arms legitimately diverge — recorded as outcome, not a violation, and the run continues.
    expect(workflow.scenario_parity).toEqual([
      { checkpoint_id: "1", ok: true },
      { checkpoint_id: "2", ok: true },
      { checkpoint_id: "3", ok: false }
    ]);

    const contextArchives = workflow.archive_records.context_only_spec!;
    const feedbackArchives = workflow.archive_records.feedback_capable_spec!;

    expect(contextArchives).toHaveLength(2);
    expect(feedbackArchives).toHaveLength(2);
    expect(contextArchives.every((record) => record.archive_ok)).toBe(true);
    expect(feedbackArchives.every((record) => record.archive_ok)).toBe(true);

    // The honest prose regression: the context arm's CP2 MODIFIED block omitted a previously
    // established scenario and the archive silently dropped it from the spec-of-record.
    expect(contextArchives[0].change_name).toBe("cp2-basis-point-discount");
    expect(contextArchives[0].survival_ledger.dropped_scenarios).toEqual([
      { spec: "cartcalc", requirement: "Line and cart subtotals", scenario: "Mixed cart subtotal" }
    ]);
    expect(feedbackArchives[0].survival_ledger.dropped_scenarios).toEqual([]);
    expect(feedbackArchives[0].survival_ledger.added_scenarios).toEqual([
      { spec: "cartcalc", requirement: "Basis-point discount", scenario: "Basis-point discount applied" }
    ]);
    expect(contextArchives[0].pre_spec_of_record_hash).not.toBe(contextArchives[0].post_spec_of_record_hash);

    // Archive directories are renamed deterministically (no real-date prefix survives).
    const contextWorkspace = join(runsRoot, "cartcalc-openspec-shakedown", "workspaces", "context_only_spec");
    expect(
      (await stat(join(contextWorkspace, "openspec", "changes", "archive", "cp2-basis-point-discount"))).isDirectory()
    ).toBe(true);

    // The spec-of-record is agent-read-only: the scripted CP1 write attempt was refused.
    const contextCp1 = bundle.no_provider_run.arm_bundles.context_only_spec[0];
    expect(contextCp1.turn_records[0].l0.replacement_result?.applied).toBe(false);
    expect(
      contextCp1.turn_records[0].l0.replacement_result?.errors.join("\n")
    ).toContain("openspec/specs/cartcalc/spec.md is read-only");
    expect(contextCp1.termination?.classification).toBe("done");

    // Snapshots include the openspec spec-of-record and exclude archived changes.
    const contextCp2Prompt = bundle.no_provider_run.arm_bundles.context_only_spec[1].initial_conversation
      .map((message) => message.content)
      .join("\n");
    const contextCp3Prompt = bundle.no_provider_run.arm_bundles.context_only_spec[2].initial_conversation
      .map((message) => message.content)
      .join("\n");

    expect(contextCp2Prompt).toContain("=== workspace file: openspec/specs/cartcalc/spec.md ===");
    expect(contextCp3Prompt).not.toContain("openspec/changes/archive/");
    expect(contextCp3Prompt).not.toContain("Mixed cart subtotal");
    expect(bundle.content_hash_manifest.openspec_workflow_hash).toHaveLength(64);
  }, 30000);
});

function contextScript(checkpointId: string): string[] {
  if (checkpointId === "1") {
    return [
      // First turn tries to edit the spec-of-record directly; the profile refuses it.
      [
        "<<<FILE openspec/specs/cartcalc/spec.md>>>",
        "# tampered",
        "<<<END>>>"
      ].join("\n"),
      [cartCalcImplementation({ discount: false, cap: false }), "<<<DONE>>>"].join("\n")
    ];
  }

  if (checkpointId === "2") {
    return [
      [
        deltaFileBlock("cp2-basis-point-discount", CONTEXT_CP2_DELTA_DROPPING_SCENARIO),
        cartCalcImplementation({ discount: true, cap: false }),
        "<<<DONE>>>"
      ].join("\n")
    ];
  }

  return [
    [
      deltaFileBlock("cp3-discount-cap", CP3_DELTA_ADDED_CAP),
      cartCalcImplementation({ discount: true, cap: true }),
      "<<<DONE>>>"
    ].join("\n")
  ];
}

function feedbackScript(checkpointId: string): string[] {
  if (checkpointId === "1") {
    return [[cartCalcImplementation({ discount: false, cap: false }), "<<<DONE>>>"].join("\n")];
  }

  if (checkpointId === "2") {
    return [
      [
        deltaFileBlock("cp2-basis-point-discount", FEEDBACK_CP2_DELTA_COMPLETE),
        cartCalcImplementation({ discount: true, cap: false }),
        "<<<DONE>>>"
      ].join("\n")
    ];
  }

  return [
    [
      deltaFileBlock("cp3-discount-cap", CP3_DELTA_ADDED_CAP),
      cartCalcImplementation({ discount: true, cap: true }),
      "<<<DONE>>>"
    ].join("\n")
  ];
}

function deltaFileBlock(changeName: string, delta: string): string {
  return [`<<<FILE openspec/changes/${changeName}/specs/cartcalc/spec.md>>>`, delta, "<<<END>>>"].join("\n");
}

const CONTEXT_CP2_DELTA_DROPPING_SCENARIO = [
  "## MODIFIED Requirements",
  "",
  "### Requirement: Line and cart subtotals",
  "The cart SHALL compute line subtotals as unit price times quantity, cart subtotals as the sum of line subtotals, and SHALL apply a configured basis-point discount to the total, flooring the discount amount.",
  "",
  "#### Scenario: Mug line subtotal",
  "- **GIVEN** a line item with unit price 250 cents and quantity 2",
  "- **WHEN** the line subtotal is computed",
  "- **THEN** the result is 500 cents",
  "",
  "#### Scenario: Total without discount",
  "- **GIVEN** a cart with no discount configured",
  "- **WHEN** the total is computed",
  "- **THEN** the total equals the cart subtotal",
  "",
  "#### Scenario: Basis-point discount applied",
  "- **GIVEN** a cart subtotal of 800 cents and a discount of 250 basis points",
  "- **WHEN** the total is computed",
  "- **THEN** the discount is 20 cents and the total is 780 cents"
].join("\n");

const FEEDBACK_CP2_DELTA_COMPLETE = [
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

const CP3_DELTA_ADDED_CAP = [
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
  const root = join(tmpdir(), `hit-sdd-e1-openspec-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}
