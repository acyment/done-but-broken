// v2-M0 ACCEPTANCE — the §5.6 per-op observability census (E4V2 design, Amendment 2; the
// escalation's paper census made mechanical). For every non-behavior-preserving op kind, and
// every variant its eligibility admits (each retype direction, each deletable-field class, the
// convention target, ref/non-ref list entities), applying the §5.5 delta derivation (templates
// over the post-op IR + the retirement-tombstone rule, diffed against the pre-op spec-of-record)
// must yield ≥1 NOVEL scenario that FAILS against the pre-op gold implementation, and the full
// post-op derived scenario set must pass 100% against the post-op gold implementation.
//
// Build-time design guard, never a run-time gate. Every scenario execution here is hermetic
// (fresh gold server process per scenario).
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBaselineIr, createUidMinter, type E4SchemaIR } from "../src/e4/substrate/ir";
import { createSequenceState, type E4ChangeOpKind, type E4OpResult, type E4SequenceState } from "../src/e4/substrate/ops";
import { E4_OPS_V2 } from "../src/e4/substrate/v2/ops";
import { buildE4V2AppFiles } from "../src/e4/substrate/v2/scaffold";
import { allScenarioRefs, deriveChangeDelta, deriveSpecOfRecord, type E4V2SpecOfRecord } from "../src/e4/v2/gold-spec";
import { runE4V2ScenarioSet } from "../src/e4/v2/scenario-executor";
import type { E4ExecutorConfig } from "../src/e4/oracle-executor";
import { indexQueuePrng } from "./support/e4-v2-helpers";

const EXEC_CONFIG: E4ExecutorConfig = {
  readiness_timeout_ms: 15_000,
  request_timeout_ms: 3_000,
  readiness_poll_interval_ms: 25
};
const CONCURRENCY = 6;
const TEST_TIMEOUT_MS = 120_000;

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

async function writeGoldWorkspace(ir: E4SchemaIR): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "e4-v2-census-"));
  tempRoots.push(dir);

  for (const [path, contents] of Object.entries(buildE4V2AppFiles(ir))) {
    await writeFile(join(dir, path), contents);
  }

  return dir;
}

// A census chain: a deterministic sequence of op applications (each with its planned pick
// indices), starting from the fixed T0 baseline. The LAST op is the op under census; everything
// before it constructs the eligibility context. The pre-op spec-of-record is threaded through
// the §5.5 derivation exactly as the archive loop would thread it.
type CensusStep = { op: E4ChangeOpKind; picks: number[] };

function applyChain(steps: CensusStep[]): { preIr: E4SchemaIR; priorSpec: E4V2SpecOfRecord; result: E4OpResult } {
  const state: E4SequenceState = createSequenceState();
  const minter = createUidMinter();
  let ir = buildBaselineIr();
  let spec = deriveSpecOfRecord(ir, null);
  let last: E4OpResult | null = null;
  let preIr = ir;
  let priorSpec = spec;

  for (const step of steps) {
    preIr = ir;
    priorSpec = spec;
    last = E4_OPS_V2[step.op].apply(ir, minter, indexQueuePrng(step.picks), state);
    ir = last.ir;
    spec = deriveSpecOfRecord(ir, priorSpec);
  }

  if (!last) {
    throw new Error("census chain must contain at least one op");
  }

  return { preIr, priorSpec, result: last };
}

async function assertCensus(steps: CensusStep[]): Promise<void> {
  const { preIr, priorSpec, result } = applyChain(steps);
  const postIr = result.ir;

  // §5.6.3 census-asserted substrate invariant: every entity has create + read at all times
  // (the create template's round-trip GET is total by construction).
  for (const entity of postIr.entities) {
    const kinds = new Set(postIr.endpoints.filter((endpoint) => endpoint.entity === entity.name).map((endpoint) => endpoint.kind));
    expect(kinds.has("create")).toBe(true);
    expect(kinds.has("read")).toBe(true);
  }

  const delta = deriveChangeDelta(postIr, priorSpec);

  // ≥1 novel scenario in the derived delta…
  expect(delta.novel.length).toBeGreaterThanOrEqual(1);

  // …of which ≥1 is RED against the pre-op gold implementation.
  const preDir = await writeGoldWorkspace(preIr);
  const novelVerdicts = await runE4V2ScenarioSet({
    workspace_dir: preDir,
    scenarios: delta.novel.map((ref) => ref.scenario),
    config: EXEC_CONFIG,
    concurrency: CONCURRENCY
  });

  // Gold implementations always boot — a non-completed verdict here is a census bug, not a red.
  expect(novelVerdicts.filter((verdict) => verdict.kind !== "completed").map((verdict) => verdict.title)).toEqual([]);
  const redTitles = novelVerdicts.filter((verdict) => verdict.kind === "completed" && !verdict.passed).map((verdict) => verdict.title);
  expect(redTitles.length).toBeGreaterThanOrEqual(1);

  // The FULL post-op derived set (templates + tombstones) passes 100% against the post-op gold.
  const postDir = await writeGoldWorkspace(postIr);
  const postVerdicts = await runE4V2ScenarioSet({
    workspace_dir: postDir,
    scenarios: allScenarioRefs(delta.spec).map((ref) => ref.scenario),
    config: EXEC_CONFIG,
    concurrency: CONCURRENCY
  });
  const notGreen = postVerdicts
    .filter((verdict) => verdict.kind !== "completed" || !verdict.passed)
    .map((verdict) => `${verdict.title}: ${verdict.kind === "completed" ? verdict.failures.join("; ") : verdict.kind}`);

  expect(notGreen).toEqual([]);
}

describe("§5.6 per-op observability census — additive ops", () => {
  test("add_entity (non-ref list entity; red via absent routes; full CRUD green post-op)", async () => {
    await assertCensus([{ op: "add_entity", picks: [0] }]);
  }, TEST_TIMEOUT_MS);

  test("add_field: string field (red via unknown-field strictness pre-op)", async () => {
    await assertCensus([{ op: "add_field", picks: [1, 0] }]); // Widget + description
  }, TEST_TIMEOUT_MS);

  test("add_field: decimal field", async () => {
    await assertCensus([{ op: "add_field", picks: [1, 2] }]); // Widget + weight_kg
  }, TEST_TIMEOUT_MS);

  test("add_field: bool field", async () => {
    await assertCensus([{ op: "add_field", picks: [1, 3] }]); // Widget + is_featured
  }, TEST_TIMEOUT_MS);

  test("add_field: int field", async () => {
    await assertCensus([{ op: "add_field", picks: [1, 5] }]); // Widget + discount_pct
  }, TEST_TIMEOUT_MS);

  test("add_endpoint (analytics; red via absent route)", async () => {
    await assertCensus([{ op: "add_endpoint", picks: [0] }]); // Category analytics
  }, TEST_TIMEOUT_MS);

  test("add_validation_rule (format; red via the sealed rule-violating literal accepted pre-op)", async () => {
    await assertCensus([{ op: "add_validation_rule", picks: [3] }]); // v1 candidates [Cat.id, Cat.name, W.id, W.name] → Widget.name
  }, TEST_TIMEOUT_MS);

  test("add_relationship (ref list entity gains the discriminating filtered-list template)", async () => {
    await assertCensus([{ op: "add_relationship", picks: [0] }]); // Category → Widget
  }, TEST_TIMEOUT_MS);
});

describe("§5.6 per-op observability census — drift ops", () => {
  test("rename_entity on a referencing entity (Widget→Product: paths move, tombstone + new capability)", async () => {
    await assertCensus([{ op: "rename_entity", picks: [1, 0] }]);
  }, TEST_TIMEOUT_MS);

  test("rename_entity on a referenced entity (Category→Product: ref fixtures follow)", async () => {
    await assertCensus([{ op: "rename_entity", picks: [0, 0] }]);
  }, TEST_TIMEOUT_MS);

  test("rename_field (red via unknown-field strictness on the old-name body)", async () => {
    await assertCensus([{ op: "rename_field", picks: [1, 0] }]); // Widget.name → label
  }, TEST_TIMEOUT_MS);

  test("retype_field string→date", async () => {
    await assertCensus([{ op: "retype_field", picks: [1, 0] }]); // Widget.name
  }, TEST_TIMEOUT_MS);

  test("retype_field decimal→int (red via the type-rejection template)", async () => {
    await assertCensus([{ op: "retype_field", picks: [2, 0] }]); // Widget.price
  }, TEST_TIMEOUT_MS);

  test("retype_field bool→string", async () => {
    await assertCensus([{ op: "retype_field", picks: [3, 0] }]); // Widget.in_stock
  }, TEST_TIMEOUT_MS);

  test("retype_field int→decimal", async () => {
    await assertCensus([
      { op: "add_field", picks: [1, 5] }, // Widget.discount_pct (int)
      { op: "retype_field", picks: [4, 0] }
    ]);
  }, TEST_TIMEOUT_MS);

  test("retype_field date→string", async () => {
    await assertCensus([
      { op: "retype_field", picks: [1, 0] }, // Widget.name → date
      { op: "retype_field", picks: [1, 0] } // Widget.name (date) → string
    ]);
  }, TEST_TIMEOUT_MS);

  test("delete_field: string class (red via missing-required pre-op)", async () => {
    await assertCensus([{ op: "delete_field", picks: [1] }]); // Widget.name
  }, TEST_TIMEOUT_MS);

  test("delete_field: string class on the minimal entity (required-rejection template drops out)", async () => {
    await assertCensus([{ op: "delete_field", picks: [0] }]); // Category.name
  }, TEST_TIMEOUT_MS);

  test("delete_field: bool class", async () => {
    await assertCensus([{ op: "delete_field", picks: [2] }]); // Widget.in_stock
  }, TEST_TIMEOUT_MS);

  test("delete_field: ref class (filtered-list template drops out; list stays green)", async () => {
    await assertCensus([{ op: "delete_field", picks: [3] }]); // Widget.category_id
  }, TEST_TIMEOUT_MS);

  test("delete_field: date class", async () => {
    await assertCensus([
      { op: "retype_field", picks: [1, 0] }, // Widget.name → date
      { op: "delete_field", picks: [1] } // Widget.name (date, required, non-ruled)
    ]);
  }, TEST_TIMEOUT_MS);

  test("delete_entity (retirement tombstone is the novel red scenario)", async () => {
    await assertCensus([
      { op: "add_entity", picks: [0] }, // Supplier
      { op: "delete_entity", picks: [0] }
    ]);
  }, TEST_TIMEOUT_MS);

  test("modify_endpoint PUT→PATCH (the Amendment-2 PATCH form makes the post-state expressible)", async () => {
    await assertCensus([{ op: "modify_endpoint", picks: [1] }]); // Widget update
  }, TEST_TIMEOUT_MS);

  test("modify_endpoint PATCH→PUT (the reverse flip)", async () => {
    await assertCensus([
      { op: "modify_endpoint", picks: [1] },
      { op: "modify_endpoint", picks: [1] }
    ]);
  }, TEST_TIMEOUT_MS);

  test("modify_convention on error_format (every error-asserting template goes novel and red)", async () => {
    await assertCensus([{ op: "modify_convention", picks: [0] }]);
  }, TEST_TIMEOUT_MS);

  test("modify_convention flipped back (second application stays observable — no dead '(revised)' branch in v2)", async () => {
    await assertCensus([
      { op: "modify_convention", picks: [0] },
      { op: "modify_convention", picks: [0] }
    ]);
  }, TEST_TIMEOUT_MS);
});

describe("census anchors", () => {
  test("T0 baseline: the full derived spec-of-record passes 100% against the T0 gold implementation", async () => {
    const baseline = buildBaselineIr();
    const spec = deriveSpecOfRecord(baseline, null);
    const dir = await writeGoldWorkspace(baseline);
    const verdicts = await runE4V2ScenarioSet({
      workspace_dir: dir,
      scenarios: allScenarioRefs(spec).map((ref) => ref.scenario),
      config: EXEC_CONFIG,
      concurrency: CONCURRENCY
    });
    const notGreen = verdicts
      .filter((verdict) => verdict.kind !== "completed" || !verdict.passed)
      .map((verdict) => `${verdict.title}: ${verdict.kind === "completed" ? verdict.failures.join("; ") : verdict.kind}`);

    expect(notGreen).toEqual([]);
  }, TEST_TIMEOUT_MS);

  test("noop_maintenance derives ZERO novel scenarios (behavior-preserving tasks keep the §3.3 affirmation path)", () => {
    const baseline = buildBaselineIr();
    const spec = deriveSpecOfRecord(baseline, null);
    const result = E4_OPS_V2.noop_maintenance.apply(baseline, createUidMinter(), indexQueuePrng([]), createSequenceState());
    const delta = deriveChangeDelta(result.ir, spec);

    expect(delta.novel).toEqual([]);
    expect(delta.removed).toEqual([]);
  });
});
