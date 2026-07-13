// v2-M0 acceptance, part 2: the `e4-t0-gold-spec-v1` code twin (E4V2 design §5.5) — sealed
// template text, fixture policy, tombstone rule, delta/novelty semantics — and the hermetic
// per-scenario executor it is verified through. The full per-op census is
// test/e4-v2-census.test.ts; structural workspace self-checks land with v2-M1.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBaselineIr, createUidMinter, type E4SchemaIR } from "../src/e4/substrate/ir";
import { createSequenceState } from "../src/e4/substrate/ops";
import { E4_OPS_V2 } from "../src/e4/substrate/v2/ops";
import { buildE4V2AppFiles } from "../src/e4/substrate/v2/scaffold";
import {
  allScenarioRefs,
  buildFreshBody,
  capabilityNameForEntity,
  deriveChangeDelta,
  deriveSpecOfRecord,
  specFixtureId,
  specMissingId
} from "../src/e4/v2/gold-spec";
import { canonicalScenarioBody, isValueBindingAssertion, renderStepText, scenarioBulletLines, type E4V2Scenario } from "../src/e4/v2/scenario";
import { runE4V2Scenario, runE4V2ScenarioSet, resolveJsonPath } from "../src/e4/v2/scenario-executor";
import type { E4ExecutorConfig } from "../src/e4/oracle-executor";
import { indexQueuePrng } from "./support/e4-v2-helpers";

const EXEC_CONFIG: E4ExecutorConfig = {
  readiness_timeout_ms: 10_000,
  request_timeout_ms: 3_000,
  readiness_poll_interval_ms: 25
};

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

async function writeAppWorkspace(ir: E4SchemaIR): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "e4-v2-goldspec-"));
  tempRoots.push(dir);

  for (const [path, contents] of Object.entries(buildE4V2AppFiles(ir))) {
    await writeFile(join(dir, path), contents);
  }

  return dir;
}

function widgetScenarios() {
  const ir = buildBaselineIr();
  const spec = deriveSpecOfRecord(ir, null);
  const widgets = spec.capabilities.find((capability) => capability.name === "widgets")!;
  return { ir, spec, widgets };
}

describe("e4-t0-gold-spec-v1 — sealed template text (§5.5)", () => {
  test("capability naming: first path segment of the entity's first endpoint, lowercased", () => {
    const ir = buildBaselineIr();

    expect(capabilityNameForEntity(ir, ir.entities[0])).toBe("categories");
    expect(capabilityNameForEntity(ir, ir.entities[1])).toBe("widgets");
  });

  test("the Widget create happy path renders the exact sealed step text", () => {
    const { widgets } = widgetScenarios();
    const happy = widgets.requirements.flatMap((requirement) => requirement.scenarios).find((scenario) => scenario.title === "Creating a Widget returns the stored entity")!;
    const freshJson = '{"id":"widget-spec-1","name":"Sample name 5","price":5.5,"in_stock":false,"category_id":"category-seed-1"}';

    expect(happy.steps.map(renderStepText)).toEqual([
      `I send a POST request to "/widgets" with body ${freshJson}`,
      "the response status is 201",
      `the response body equals ${freshJson}`,
      'I send a GET request to "/widgets/widget-spec-1"',
      "the response status is 200",
      `the response body equals ${freshJson}`
    ]);
  });

  test("bullet lines carry the openspec-gherkin keyword shape (WHEN/THEN with AND continuation)", () => {
    const { widgets } = widgetScenarios();
    const happy = widgets.requirements[0].scenarios[0];

    expect(scenarioBulletLines(happy).map((line) => line.split("**")[1])).toEqual(["WHEN", "THEN", "AND", "WHEN", "THEN", "AND"]);
  });

  test("scenario order under the create requirement: happy path, required rejection, type rejections in IR order, rule rejections in IR order", () => {
    const { widgets } = widgetScenarios();
    const createRequirement = widgets.requirements.find((requirement) => requirement.title === "Creating a Widget")!;

    expect(createRequirement.shall).toBe("The service SHALL create a Widget from a valid POST body and reject invalid create requests.");
    expect(createRequirement.scenarios.map((scenario) => scenario.title)).toEqual([
      "Creating a Widget returns the stored entity",
      "Creating a Widget without name is rejected",
      "Creating a Widget with a non-decimal price is rejected",
      "Creating a Widget with a non-bool in_stock is rejected",
      "Creating a Widget with an invalid price is rejected"
    ]);
  });

  test("the sealed violating literals land in the rejection bodies", () => {
    const { widgets } = widgetScenarios();
    const scenarios = widgets.requirements.flatMap((requirement) => requirement.scenarios);
    const typeReject = scenarios.find((scenario) => scenario.title === "Creating a Widget with a non-decimal price is rejected")!;
    const ruleReject = scenarios.find((scenario) => scenario.title === "Creating a Widget with an invalid price is rejected")!;

    expect(renderStepText(typeReject.steps[0])).toContain('"price":"1.5"');
    expect(renderStepText(ruleReject.steps[0])).toContain('"price":-1');
    expect(renderStepText(typeReject.steps[1])).toBe("the response status is 400");
    expect(renderStepText(typeReject.steps[2])).toBe('the response field "error.code" equals "validation_error"');
    expect(renderStepText(typeReject.steps[3])).toBe('the response field "error.message" is a string');
  });

  test("read/update/delete/list/filter/analytics templates render their sealed shapes", () => {
    const { widgets } = widgetScenarios();
    const titles = widgets.requirements.flatMap((requirement) => requirement.scenarios).map((scenario) => scenario.title);

    expect(titles).toEqual([
      "Creating a Widget returns the stored entity",
      "Creating a Widget without name is rejected",
      "Creating a Widget with a non-decimal price is rejected",
      "Creating a Widget with a non-bool in_stock is rejected",
      "Creating a Widget with an invalid price is rejected",
      "Fetching a missing Widget returns not found",
      "Updating a Widget persists the change",
      "Deleting a Widget removes it",
      "Creating a Widget increases the list count",
      "Filtering widgets by category_id returns only matching rows",
      "Creating a Widget increases the reported count"
    ]);

    const filter = widgets.requirements.flatMap((requirement) => requirement.scenarios).find((scenario) => scenario.title.startsWith("Filtering"))!;
    // Heterogeneous seeds: exactly 1 of the 2 Widget seed rows references category-seed-1, so the
    // filtered expectation (2) differs from the unfiltered count (3) — the wrong-filter pin.
    expect(renderStepText(filter.steps[2])).toBe('I send a GET request to "/widgets?category_id=category-seed-1"');
    expect(renderStepText(filter.steps[4])).toBe("the response list has length 2");
  });

  test("every scenario satisfies the A8 floors by construction (≥1 THEN-class step, ≥1 value-binding assertion)", () => {
    const spec = deriveSpecOfRecord(buildBaselineIr(), null);

    for (const ref of allScenarioRefs(spec)) {
      const assertions = ref.scenario.steps.filter((step) => step.kind.startsWith("assert_"));
      expect(assertions.length).toBeGreaterThanOrEqual(1);
      expect(ref.scenario.steps.some(isValueBindingAssertion)).toBe(true);
    }
  });

  test("every capability purpose clears the pinned CLI's 50-char strict floor", () => {
    const ir = buildBaselineIr();
    const withDelete = E4_OPS_V2.add_entity.apply(ir, createUidMinter(), indexQueuePrng([0]), createSequenceState());
    const spec = deriveSpecOfRecord(withDelete.ir, deriveSpecOfRecord(ir, null));

    for (const capability of spec.capabilities) {
      expect(capability.purpose.length).toBeGreaterThanOrEqual(50);
    }
  });

  test("fixture ids are disjoint from seed and GT fixture ids (§5.5 disjointness rule)", () => {
    const ir = buildBaselineIr();

    for (const entity of ir.entities) {
      const specIds = [specFixtureId(entity.name), specMissingId(entity.name)];
      const reserved = [
        `${entity.name.toLowerCase()}-seed-1`,
        `${entity.name.toLowerCase()}-seed-2`,
        `${entity.name.toLowerCase()}-new-1`,
        `${entity.name.toLowerCase()}-invalid-1`,
        `${entity.name.toLowerCase()}-does-not-exist`
      ];

      for (const id of specIds) {
        expect(reserved).not.toContain(id);
      }
    }
  });

  test("the fresh body uses spec-reserved ordinal 5 and the changed body flips only the first non-id field to ordinal 6", () => {
    const ir = buildBaselineIr();
    const widget = ir.entities[1];
    const fresh = buildFreshBody(ir, widget);

    expect(fresh).toEqual({
      id: "widget-spec-1",
      name: "Sample name 5",
      price: 5.5,
      in_stock: false,
      category_id: "category-seed-1"
    });

    const { widgets } = widgetScenarios();
    const update = widgets.requirements.flatMap((requirement) => requirement.scenarios).find((scenario) => scenario.title === "Updating a Widget persists the change")!;
    expect(renderStepText(update.steps[2])).toContain('"name":"Sample name 6"');
    expect(renderStepText(update.steps[2])).toStartWith('I send a PUT request to "/widgets/widget-spec-1"');
  });
});

describe("§5.5 retirement tombstone + delta derivation", () => {
  test("a deleted capability derives the sealed tombstone; re-adding replaces it with the full template set", () => {
    const baseline = buildBaselineIr();
    const t0Spec = deriveSpecOfRecord(baseline, null);
    const state = createSequenceState();
    const minter = createUidMinter();
    const added = E4_OPS_V2.add_entity.apply(baseline, minter, indexQueuePrng([0]), state);
    const specAfterAdd = deriveSpecOfRecord(added.ir, t0Spec);
    const deleted = E4_OPS_V2.delete_entity.apply(added.ir, minter, indexQueuePrng([0]), state);
    const specAfterDelete = deriveSpecOfRecord(deleted.ir, specAfterAdd);
    const tombstone = specAfterDelete.capabilities.find((capability) => capability.name === "suppliers")!;

    expect(tombstone.retired).toBe(true);
    expect(tombstone.requirements).toHaveLength(1);
    expect(tombstone.requirements[0].title).toBe("Retired suppliers endpoints");
    expect(tombstone.requirements[0].shall).toBe("The service SHALL NOT serve the retired /suppliers endpoints.");
    expect(tombstone.requirements[0].scenarios[0].title).toBe("Requests to retired /suppliers endpoints return not found");
    expect(tombstone.requirements[0].scenarios[0].steps.map(renderStepText)).toEqual([
      'I send a GET request to "/suppliers"',
      "the response status is 404",
      'the response field "error.code" equals "not_found"',
      'the response field "error.message" is a string'
    ]);

    // The tombstone persists while the surface stays retired…
    const specNextTask = deriveSpecOfRecord(deleted.ir, specAfterDelete);
    expect(specNextTask.capabilities.some((capability) => capability.name === "suppliers" && capability.retired)).toBe(true);

    // …and the DERIVATION still supports delete-then-re-add coherence: a re-used name replaces
    // the tombstone with the full template set. Pinned with a FRESH sequence state, because…
    const readded = E4_OPS_V2.add_entity.apply(deleted.ir, minter, indexQueuePrng([0]), createSequenceState());
    const specAfterReadd = deriveSpecOfRecord(readded.ir, specAfterDelete);
    const revived = specAfterReadd.capabilities.find((capability) => capability.name === "suppliers")!;
    expect(revived.retired).toBe(false);
    expect(revived.requirements.length).toBeGreaterThan(1);

    // …[P0V.1: V7] within ONE drawn sequence the collision is undrawable: the ever-used-name
    // draw-guard makes the re-add pick a different name, so the tombstone persists against gold
    // (the record's retirement requirement can no longer be failed by a name-recycling draw).
    const guarded = E4_OPS_V2.add_entity.apply(deleted.ir, minter, indexQueuePrng([0]), state);

    expect(guarded.render_context.entity).not.toBe("Supplier");
    const specGuarded = deriveSpecOfRecord(guarded.ir, specAfterDelete);
    expect(specGuarded.capabilities.some((capability) => capability.name === "suppliers" && capability.retired)).toBe(true);
  });

  test("novelty is canonical-form membership, not block position (§6 pinned semantics)", () => {
    const baseline = buildBaselineIr();
    const t0Spec = deriveSpecOfRecord(baseline, null);

    // noop: zero novel scenarios, everything carried, nothing removed.
    const noopDelta = deriveChangeDelta(baseline, t0Spec);
    expect(noopDelta.novel).toEqual([]);
    expect(noopDelta.removed).toEqual([]);
    expect(noopDelta.carried.length).toBe(allScenarioRefs(t0Spec).length);

    // modify_convention: exactly the error-asserting scenarios go novel.
    const flipped = E4_OPS_V2.modify_convention.apply(baseline, createUidMinter(), indexQueuePrng([0]), createSequenceState());
    const flipDelta = deriveChangeDelta(flipped.ir, t0Spec);
    const novelTitles = flipDelta.novel.map((ref) => ref.scenario.title);

    expect(novelTitles).toContain("Fetching a missing Widget returns not found");
    expect(novelTitles).toContain("Creating a Widget without name is rejected");
    expect(novelTitles).not.toContain("Creating a Widget returns the stored entity");
    expect(novelTitles).not.toContain("Creating a Widget increases the list count");
  });

  test("canonical form strips presentation (keywords, bold, bullets, case, whitespace)", () => {
    const { widgets } = widgetScenarios();
    const happy = widgets.requirements[0].scenarios[0];
    const canonical = canonicalScenarioBody(happy);

    expect(canonical).not.toContain("**");
    expect(canonical).not.toContain("WHEN");
    expect(canonical.split("\n")[0]).toStartWith("i send a post request");
  });
});

describe("hermetic per-scenario executor", () => {
  test("the full T0 Widget create round-trip passes against the T0 gold implementation", async () => {
    const ir = buildBaselineIr();
    const dir = await writeAppWorkspace(ir);
    const { widgets } = widgetScenarios();
    const happy = widgets.requirements[0].scenarios[0];
    const verdict = await runE4V2Scenario({ workspace_dir: dir, scenario: happy, config: EXEC_CONFIG });

    expect(verdict.kind).toBe("completed");
    expect(verdict.kind === "completed" && verdict.passed).toBe(true);
  }, 30_000);

  test("a failing assertion stops the scenario, reports a fixed-vocabulary failure, and classifies the mode", async () => {
    const ir = buildBaselineIr();
    const dir = await writeAppWorkspace(ir);
    const verdict = await runE4V2Scenario({
      workspace_dir: dir,
      scenario: {
        title: "Wrong status expectation",
        steps: [
          { kind: "request", method: "GET", path: "/widgets/widget-seed-1" },
          { kind: "assert_status", status: 404 },
          { kind: "assert_field_equals", json_path: "name", literal_json: '"never-run"' }
        ]
      },
      config: EXEC_CONFIG
    });

    expect(verdict.kind).toBe("completed");
    if (verdict.kind === "completed") {
      expect(verdict.passed).toBe(false);
      expect(verdict.failures).toEqual(["status: expected 404, got 200"]);
      expect(verdict.failure_mode).toBe("assertion");
      expect(verdict.steps[2].executed).toBe(false);
    }
  }, 30_000);

  test("a request into missing surface classifies as route_absent (A10 signature)", async () => {
    const ir = buildBaselineIr();
    const dir = await writeAppWorkspace(ir);
    const verdict = await runE4V2Scenario({
      workspace_dir: dir,
      scenario: {
        title: "Route absent",
        steps: [
          { kind: "request", method: "GET", path: "/suppliers" },
          { kind: "assert_status", status: 200 }
        ]
      },
      config: EXEC_CONFIG
    });

    expect(verdict.kind === "completed" && verdict.failure_mode).toBe("route_absent");
  }, 30_000);

  test("remember + remembered-equality + no-field + field-type forms execute", async () => {
    const ir = buildBaselineIr();
    const dir = await writeAppWorkspace(ir);
    const verdict = await runE4V2Scenario({
      workspace_dir: dir,
      scenario: {
        title: "Remember round-trip",
        steps: [
          { kind: "request", method: "GET", path: "/widgets/widget-seed-1" },
          { kind: "assert_status", status: 200 },
          { kind: "remember", json_path: "name", name: "stored_name" },
          { kind: "request", method: "GET", path: "/widgets/widget-seed-1" },
          { kind: "assert_field_equals_remembered", json_path: "name", name: "stored_name" },
          { kind: "assert_no_field", json_path: "error" },
          { kind: "assert_field_type", json_path: "price", json_type: "number" }
        ]
      },
      config: EXEC_CONFIG
    });

    expect(verdict.kind === "completed" && verdict.passed).toBe(true);
  }, 30_000);

  test("remembered variables substitute into later request paths (create→fetch chain without seed overfitting)", async () => {
    const ir = buildBaselineIr();
    const dir = await writeAppWorkspace(ir);
    const verdict = await runE4V2Scenario({
      workspace_dir: dir,
      scenario: {
        title: "Chained fetch via remembered id",
        steps: [
          { kind: "request_body", method: "POST", path: "/categories", body_json: '{"id":"category-chain-1","name":"Chained"}' },
          { kind: "assert_status", status: 201 },
          { kind: "remember", json_path: "id", name: "new_id" },
          { kind: "request", method: "GET", path: "/categories/{new_id}" },
          { kind: "assert_status", status: 200 },
          { kind: "assert_field_equals", json_path: "name", literal_json: '"Chained"' }
        ]
      },
      config: EXEC_CONFIG
    });

    expect(verdict.kind === "completed" && verdict.passed).toBe(true);
  }, 30_000);

  test("per-scenario hermeticity: state created by one scenario is invisible to the next", async () => {
    const ir = buildBaselineIr();
    const dir = await writeAppWorkspace(ir);
    const create: E4V2Scenario = {
      title: "Creates a widget",
      steps: [
        { kind: "request_body", method: "POST", path: "/widgets", body_json: '{"id":"widget-hermetic-1","name":"h","price":1,"in_stock":true,"category_id":"category-seed-1"}' },
        { kind: "assert_status", status: 201 }
      ]
    };
    const checkGone: E4V2Scenario = {
      title: "The widget from the previous scenario does not exist",
      steps: [
        { kind: "request", method: "GET", path: "/widgets/widget-hermetic-1" },
        { kind: "assert_status", status: 404 }
      ]
    };

    const verdicts = await runE4V2ScenarioSet({
      workspace_dir: dir,
      scenarios: [create, checkGone],
      config: EXEC_CONFIG,
      concurrency: 1
    });

    expect(verdicts.every((verdict) => verdict.kind === "completed" && verdict.passed)).toBe(true);
  }, 30_000);

  test("a workspace that cannot boot reports readiness_failed with the agent_workspace classification", async () => {
    const ir = buildBaselineIr();
    const dir = await writeAppWorkspace(ir);
    await writeFile(join(dir, "seed.ts"), "export const seedFixture = JSON.parse('{');\n");

    const verdict = await runE4V2Scenario({
      workspace_dir: dir,
      scenario: { title: "Never runs", steps: [{ kind: "request", method: "GET", path: "/widgets" }] },
      config: EXEC_CONFIG
    });

    expect(verdict.kind).toBe("readiness_failed");
    expect(verdict.kind === "readiness_failed" && verdict.classification).toBe("agent_workspace");
  }, 30_000);

  test("resolveJsonPath walks dot-separated object paths only", () => {
    expect(resolveJsonPath({ error: { code: "x" } }, "error.code")).toBe("x");
    expect(resolveJsonPath({ error: { code: "x" } }, "error.missing")).toBeUndefined();
    expect(resolveJsonPath([{ code: "x" }], "0.code")).toBeUndefined();
    expect(resolveJsonPath(null, "a")).toBeUndefined();
  });
});
