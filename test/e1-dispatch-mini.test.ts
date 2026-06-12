// Mechanism-proof gates for the e1-dispatch-mini probe task (calibration-class, unsealed).
//
// Gate 1: the reference implementation passes every oracle case (100% by construction).
// Gate 2 (propagation demand): a partial CP04 update — canonical status + exporter updated,
//   digest and importer left at their seed state — fails the scattered-site cases that the
//   full reference passes. This proves the correction cannot be satisfied from the
//   canonical site alone; the task demands cross-file propagation.
// Gate 3 (regression tripwire): a digest rewrite that keeps the correct status logic but
//   slips the bucket discipline (alphabetical order instead of lifecycle order) fails
//   CP02-pinned digest cases that previously passed. This proves earlier checkpoints arm
//   pass-to-fail tripwires against sloppy rewrites of scattered files.

import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { evaluate as referenceEvaluate, applyEvents } from "../tasks/e1-dispatch-mini/reference/src/dispatch";
import { emptyState } from "../tasks/e1-dispatch-mini/reference/src/dispatch-types";
import { deriveStatus as referenceDeriveStatus } from "../tasks/e1-dispatch-mini/reference/src/orders";
import { exportOrder as referenceExportOrder } from "../tasks/e1-dispatch-mini/reference/src/api/render-order";
import { statusDigest as seedStatusDigest } from "../tasks/e1-dispatch-mini/task-package/template-workspace/src/notify/digest";
import { parseOrder as seedParseOrder } from "../tasks/e1-dispatch-mini/task-package/template-workspace/src/api/parse-order";

type OracleCase = {
  check_id: string;
  checkpoint_introduced: string;
  args: [unknown[], Record<string, unknown>];
  expected: unknown;
  held_out: boolean;
};

const casesPath = join(import.meta.dir, "..", "tasks", "e1-dispatch-mini", "oracle-package", "cases.json");

async function loadCases(): Promise<OracleCase[]> {
  return JSON.parse(await readFile(casesPath, "utf8")) as OracleCase[];
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(sortKeys(left)) === JSON.stringify(sortKeys(right));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])])
    );
  }
  return value;
}

// Hybrid evaluate: reference domain + exporter, seed digest + importer. This is the
// "updated the obvious sites, forgot the scattered ones" agent at CP04+.
function partialUpdateEvaluate(events: unknown[], query: Record<string, unknown>): unknown {
  const state = applyEvents(emptyState(), events as never);

  switch (query.kind) {
    case "order_status": {
      const order = state.orders[String(query.order_id)];
      return { order_id: order.order_id, status: referenceDeriveStatus(order) };
    }
    case "export_order":
      return referenceExportOrder(state.orders[String(query.order_id)]);
    case "reimport_order":
      return seedParseOrder(referenceExportOrder(state.orders[String(query.order_id)]));
    case "status_digest":
      return seedStatusDigest(state as never);
    default:
      throw new Error(`Unknown query kind: ${String(query.kind)}`);
  }
}

// Botched digest: correct final status logic, but the rewrite slips the bucket
// discipline — buckets come out alphabetically instead of in lifecycle order.
function botchedDigest(events: unknown[]): unknown {
  const state = applyEvents(emptyState(), events as never);
  const tally = new Map<string, { count: number; total_cents: number }>();

  for (const order of Object.values(state.orders)) {
    const bucket = referenceDeriveStatus(order);
    const entry = tally.get(bucket) ?? { count: 0, total_cents: 0 };
    entry.count += 1;
    entry.total_cents += order.lines.reduce((sum, line) => sum + line.amount_cents, 0);
    tally.set(bucket, entry);
  }

  return [...tally.keys()].sort().map((status) => ({ status, ...tally.get(status)! }));
}

describe("e1-dispatch-mini mechanism gates", () => {
  test("gate 1: reference passes every oracle case", async () => {
    const cases = await loadCases();
    expect(cases.length).toBe(49);

    for (const oracleCase of cases) {
      const actual = referenceEvaluate(oracleCase.args[0] as never, oracleCase.args[1] as never);
      expect(deepEqual(actual, oracleCase.expected)).toBe(true);
    }
  });

  test("gate 2: partial CP04 update misses the scattered sites the reference covers", async () => {
    const cases = await loadCases();
    const byId = new Map(cases.map((item) => [item.check_id, item]));

    const digestCase = byId.get("cp04-digest-partial")!;
    const digestActual = partialUpdateEvaluate(digestCase.args[0], digestCase.args[1]);
    expect(deepEqual(digestActual, digestCase.expected)).toBe(false);

    const reimportCase = byId.get("cp04-reimport-partial")!;
    const reimportActual = partialUpdateEvaluate(reimportCase.args[0], reimportCase.args[1]) as Record<
      string,
      unknown
    >;
    expect(reimportActual.error).toBe("unknown_status");

    // The canonical site itself is correct under the partial update: the failure is
    // propagation, not primary logic.
    const statusCase = byId.get("cp04-status-partial")!;
    const statusActual = partialUpdateEvaluate(statusCase.args[0], statusCase.args[1]);
    expect(deepEqual(statusActual, statusCase.expected)).toBe(true);
  });

  test("gate 3: a bucket-discipline slip in a digest rewrite breaks CP02-pinned cases", async () => {
    const cases = await loadCases();
    const pinned = cases.filter(
      (item) => item.checkpoint_introduced === "2" && (item.args[1] as { kind?: string }).kind === "status_digest"
    );
    expect(pinned.length).toBeGreaterThanOrEqual(3);

    let broken = 0;

    for (const oracleCase of pinned) {
      const actual = botchedDigest(oracleCase.args[0]);
      if (!deepEqual(actual, oracleCase.expected)) {
        broken += 1;
      }
    }

    // At least one earlier-passing digest pin must flip to fail under the slip: the
    // pass-to-fail tripwire is armed.
    expect(broken).toBeGreaterThanOrEqual(1);
  });
});
