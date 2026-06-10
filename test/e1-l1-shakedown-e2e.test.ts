import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScriptedAgentProvider } from "../src/e1-no-provider-runner";
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

beforeAll(async () => {
  constants = await loadE1Constants(CONSTANTS_PATH);
});

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

// End-to-end Step 0 L1 shakedown: the five scripted fake-agent archetypes run through the
// full task-package loop (mounting, prompts, oracle scoring, bundle emission), not just the parser.
describe("E1 L1 end-to-end scripted shakedown", () => {
  test("fenced, chatty, wrong-precedence, and malformed-delimiter agents complete CartCalc end to end", async () => {
    const runsRoot = await setupTempDir();
    const taskPackage = await loadE1TaskPackage(TASK_PACKAGE_PATH);
    const oraclePackage = await loadE1OraclePackage(ORACLE_PACKAGE_PATH);

    const bundle = await runE1TaskPackageNoProvider({
      constants,
      taskPackage,
      oraclePackage,
      runsRoot,
      runId: "cartcalc-shakedown-mixed",
      arms: {
        context_only_spec: ({ checkpointId }) =>
          new ScriptedAgentProvider({
            providerId: `context-shakedown-${checkpointId}`,
            script:
              checkpointId === "1"
                ? [fencedTurn(cartCalcImplementation({ cap: false }))]
                : checkpointId === "2"
                  ? [wrongPrecedenceTurn(cartCalcImplementation({ cap: false }))]
                  : [[cartCalcImplementation({ cap: true }), "<<<DONE>>>"].join("\n")]
          }),
        feedback_capable_spec: ({ checkpointId }) =>
          new ScriptedAgentProvider({
            providerId: `feedback-shakedown-${checkpointId}`,
            script:
              checkpointId === "1"
                ? [chattyTurn(cartCalcImplementation({ cap: false }))]
                : checkpointId === "2"
                  ? [
                      malformedUnclosedTurn(),
                      [cartCalcImplementation({ cap: false }), "<<<DONE>>>"].join("\n")
                    ]
                  : [[cartCalcImplementation({ cap: true }), "<<<DONE>>>"].join("\n")]
          })
      }
    });

    expect(bundle.no_provider_run.run_summary.status).toBe("completed");
    expect(bundle.metrics.by_condition.context_only_spec).toBe(1);
    expect(bundle.metrics.by_condition.feedback_capable_spec).toBe(1);

    const contextCp1 = bundle.no_provider_run.arm_bundles.context_only_spec[0];
    expect(contextCp1.turn_records[0].parsed.no_op).toBe(false);
    expect(contextCp1.turn_records[0].l0.replacement_result).not.toBeNull();
    expect(contextCp1.termination?.classification).toBe("done");

    const contextCp2 = bundle.no_provider_run.arm_bundles.context_only_spec[1];
    expect(contextCp2.turn_records[0].l0.replacement_result).not.toBeNull();
    expect(contextCp2.termination?.classification).toBe("done");

    const feedbackCp1 = bundle.no_provider_run.arm_bundles.feedback_capable_spec[0];
    expect(feedbackCp1.turn_records[0].l0.replacement_result).not.toBeNull();
    expect(feedbackCp1.termination?.classification).toBe("done");

    const feedbackCp2 = bundle.no_provider_run.arm_bundles.feedback_capable_spec[1];
    expect(feedbackCp2.turn_records[0].parsed.no_op).toBe(true);
    expect(feedbackCp2.turn_records[0].parsed.violations.length).toBeGreaterThan(0);
    expect(feedbackCp2.turn_records[0].next_turn_injections.length).toBeGreaterThan(0);
    expect(feedbackCp2.turn_records).toHaveLength(2);
    expect(feedbackCp2.termination?.classification).toBe("done");
  });

  test("pure-prose agents stall every checkpoint and the run still continues to completion", async () => {
    const runsRoot = await setupTempDir();
    const taskPackage = await loadE1TaskPackage(TASK_PACKAGE_PATH);
    const oraclePackage = await loadE1OraclePackage(ORACLE_PACKAGE_PATH);
    const proseProvider = (id: string) =>
      new ScriptedAgentProvider({
        providerId: id,
        script: [
          "I think the implementation should compute subtotals first.",
          "Let me reason about discount caps for a while longer.",
          "Here is my plan in plain English without any protocol blocks."
        ]
      });

    const bundle = await runE1TaskPackageNoProvider({
      constants,
      taskPackage,
      oraclePackage,
      runsRoot,
      runId: "cartcalc-shakedown-prose",
      arms: {
        context_only_spec: ({ checkpointId }) => proseProvider(`context-prose-${checkpointId}`),
        feedback_capable_spec: ({ checkpointId }) => proseProvider(`feedback-prose-${checkpointId}`)
      }
    });

    expect(bundle.no_provider_run.run_summary.status).toBe("completed");
    expect(bundle.no_provider_run.run_summary.stall_counts_by_condition).toEqual({
      context_only_spec: 3,
      feedback_capable_spec: 3
    });

    for (const conditionBundles of Object.values(bundle.no_provider_run.arm_bundles)) {
      expect(conditionBundles).toHaveLength(3);

      for (const checkpointBundle of conditionBundles) {
        expect(checkpointBundle.termination?.classification).toBe("agent_stalled");
        expect(checkpointBundle.turn_records).toHaveLength(3);
        expect(checkpointBundle.turn_records.every((turn) => turn.parsed.no_op)).toBe(true);
      }
    }

    expect(bundle.metrics.by_condition.context_only_spec).toBe(0);
    expect(bundle.metrics.by_condition.feedback_capable_spec).toBe(0);
  });
});

function fencedTurn(implementation: string): string {
  return ["```ts", implementation, "<<<DONE>>>", "```"].join("\n");
}

function chattyTurn(implementation: string): string {
  return [
    "Great question! Let me walk through my reasoning before the edit.",
    "First, line subtotals multiply unit price by quantity. Here is the full file:",
    implementation,
    "That should satisfy every checkpoint rule we have seen so far.",
    "<<<DONE>>>",
    "Let me know if you would like any changes!"
  ].join("\n");
}

function wrongPrecedenceTurn(implementation: string): string {
  return ["<<<DONE>>>", implementation].join("\n");
}

function malformedUnclosedTurn(): string {
  return [
    "<<<FILE src/cartcalc.ts>>>",
    "export const broken = true; // this block never closes"
  ].join("\n");
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

async function setupTempDir(): Promise<string> {
  const root = join(tmpdir(), `hit-sdd-e1-shakedown-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}
