// v2-M0 acceptance, part 1 (E4V2 design §5.6 `procedural-rest-v2`): the substrate observability
// revision's op pins, the sealed server validation surface, heterogeneous seed refs, and the GT
// mirror negative tests. The per-op observability census lives in test/e4-v2-census.test.ts.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBaselineIr, createUidMinter, type E4SchemaIR } from "../src/e4/substrate/ir";
import { E4_OPS, createSequenceState } from "../src/e4/substrate/ops";
import {
  E4_OPS_V2,
  ERROR_FORMAT_STATEMENT_CODE_MESSAGE,
  ERROR_FORMAT_STATEMENT_TYPE_DETAIL,
  deletableFieldsV2
} from "../src/e4/substrate/v2/ops";
import { buildE4V2AppFiles, errorEnvelopeKeysV2 } from "../src/e4/substrate/v2/scaffold";
import {
  generateCumulativeTestsV2,
  generateDeltaTestsV2,
  generateSeedFixtureV2
} from "../src/e4/substrate/v2/testgen";
import { FORMAT_PATTERN_VIOLATIONS, TYPE_VIOLATING_VALUES, ruleViolatingValue } from "../src/e4/substrate/v2/values";
import { indexQueuePrng } from "./support/e4-v2-helpers";

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

async function writeAppWorkspace(ir: E4SchemaIR): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "e4-v2-substrate-"));
  tempRoots.push(dir);

  for (const [path, contents] of Object.entries(buildE4V2AppFiles(ir))) {
    await writeFile(join(dir, path), contents);
  }

  return dir;
}

// Minimal direct-HTTP harness for the validation-ORDER tests: the sealed §5.6.1 order is only
// distinguishable through the failure message, which scenario assertions deliberately never pin
// (wording-overreach rule) — so these tests speak HTTP directly.
async function withServer<T>(ir: E4SchemaIR, run: (baseUrl: string) => Promise<T>): Promise<T> {
  const dir = await writeAppWorkspace(ir);
  const proc = Bun.spawn(["bun", "server.ts"], {
    cwd: dir,
    env: { ...process.env, E4_PORT: "0" },
    stdout: "pipe",
    stderr: "pipe"
  });
  const stdout = proc.stdout as ReadableStream<Uint8Array>;
  const reader = stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let port: number | null = null;
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline && port === null) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }
    buffer += decoder.decode(chunk.value, { stream: true });
    const match = buffer.match(/listening on port (\d+)/);
    if (match) {
      port = Number(match[1]);
    }
  }

  reader.releaseLock();

  if (port === null) {
    proc.kill();
    await proc.exited;
    throw new Error("v2 server did not report a port");
  }

  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    proc.kill();
    await proc.exited;
  }
}

async function postWidget(baseUrl: string, body: Record<string, unknown>): Promise<{ status: number; json: any }> {
  const response = await fetch(`${baseUrl}/widgets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, json: await response.json().catch(() => null) };
}

const VALID_WIDGET = {
  id: "widget-test-1",
  name: "anvil",
  price: 12.5,
  in_stock: true,
  category_id: "category-seed-1"
};

describe("§5.6 v2 op pins", () => {
  test("add_entity mints full CRUD + list (§5.6.3)", () => {
    const result = E4_OPS_V2.add_entity.apply(buildBaselineIr(), createUidMinter(), indexQueuePrng([0]), createSequenceState());
    const supplierEndpoints = result.ir.endpoints.filter((endpoint) => endpoint.entity === "Supplier");

    expect(supplierEndpoints.map((endpoint) => `${endpoint.kind}:${endpoint.method} ${endpoint.path}`).toSorted()).toEqual([
      "create:POST /suppliers",
      "delete:DELETE /suppliers/{id}",
      "list:GET /suppliers",
      "read:GET /suppliers/{id}",
      "update:PUT /suppliers/{id}"
    ]);
  });

  test("rename_entity regenerates every collection segment and emits endpoint-level lineage (§5.6.2)", () => {
    // entities [Category, Widget] → index 1 = Widget; rename pool index 0 = Product.
    const result = E4_OPS_V2.rename_entity.apply(buildBaselineIr(), createUidMinter(), indexQueuePrng([1, 0]), createSequenceState());
    const productPaths = result.ir.endpoints.filter((endpoint) => endpoint.entity === "Product").map((endpoint) => endpoint.path);

    expect(productPaths.toSorted()).toEqual(["/products", "/products", "/products/{id}", "/products/{id}", "/products/{id}", "/products/stats"].toSorted());
    expect(result.ir.endpoints.some((endpoint) => endpoint.path.startsWith("/widgets"))).toBe(false);

    // One entity entry + one entry per affected endpoint, semantic_item_uid preserved.
    expect(result.rename_lineage[0]).toEqual({
      old_item_id: "entity:Widget",
      new_item_id: "entity:Product",
      semantic_item_uid: "uid-base-entity-widget"
    });
    // Two rendered-id forms per affected endpoint (§7.5): (entity, kind) for the code-side
    // channel and `endpoint:<METHOD> <path>` for spec-side stale_claim identity resolution.
    const endpointEntries = result.rename_lineage.slice(1);
    expect(endpointEntries).toHaveLength(12);
    expect(endpointEntries.map((entry) => entry.old_item_id)).toContain("endpoint:Widget:analytics");
    expect(endpointEntries.map((entry) => entry.new_item_id)).toContain("endpoint:Product:analytics");
    expect(endpointEntries.map((entry) => entry.old_item_id)).toContain("endpoint:GET /widgets/stats");
    expect(endpointEntries.map((entry) => entry.new_item_id)).toContain("endpoint:GET /products/stats");
    expect(endpointEntries.every((entry) => entry.semantic_item_uid.startsWith("uid-base-endpoint-widget"))).toBe(true);
  });

  test("delete_field is eligible only for required, non-id, non-ruled fields (§5.6.4)", () => {
    const candidates = deletableFieldsV2(buildBaselineIr()).map(({ entity, field }) => `${entity.name}.${field.name}`);

    // price is ruled (range), id fields excluded, and no optional field exists at baseline.
    expect(candidates).toEqual(["Category.name", "Widget.name", "Widget.in_stock", "Widget.category_id"]);
  });

  test("an optional field is never deletable in v2", () => {
    const withOptional = E4_OPS_V2.add_field.apply(buildBaselineIr(), createUidMinter(), indexQueuePrng([1, 0]), createSequenceState());
    const candidates = deletableFieldsV2(withOptional.ir).map(({ field }) => field.name);

    expect(candidates).not.toContain("description");
  });

  test("modify_convention targets only error_format and flips between the two sealed statements (§5.6.5)", () => {
    const baseline = buildBaselineIr();
    const once = E4_OPS_V2.modify_convention.apply(baseline, createUidMinter(), indexQueuePrng([0]), createSequenceState());
    const flipped = once.ir.conventions.find((convention) => convention.kind === "error_format")!;

    expect(once.render_context.kind).toBe("error_format");
    expect(flipped.statement).toBe(ERROR_FORMAT_STATEMENT_TYPE_DETAIL);

    const twice = E4_OPS_V2.modify_convention.apply(once.ir, createUidMinter(), indexQueuePrng([0]), createSequenceState());
    const flippedBack = twice.ir.conventions.find((convention) => convention.kind === "error_format")!;

    expect(flippedBack.statement).toBe(ERROR_FORMAT_STATEMENT_CODE_MESSAGE);
    expect(errorEnvelopeKeysV2(twice.ir)).toEqual(["code", "message"]);
  });

  test("modify_convention is ineligible when no error_format convention exists", () => {
    const ir = buildBaselineIr();
    ir.conventions = ir.conventions.filter((convention) => convention.kind !== "error_format");

    expect(E4_OPS_V2.modify_convention.isEligible(ir, createSequenceState())).toBe(false);
  });

  test("ops outside the §5.6 pins are reused from the v1 registry object, not forked", () => {
    for (const kind of ["add_field", "rename_field", "add_endpoint", "modify_endpoint", "add_validation_rule", "add_relationship", "noop_maintenance", "delete_entity"] as const) {
      expect(E4_OPS_V2[kind]).toBe(E4_OPS[kind]);
    }
  });

  test("retype_field excludes id fields in v2 (census-forced pin: fixture policies hardcode string ids)", () => {
    // v2 candidates over the baseline: non-id fields with a retype target —
    // [Category.name, Widget.name, Widget.price, Widget.in_stock]; never an id.
    const result = E4_OPS_V2.retype_field.apply(buildBaselineIr(), createUidMinter(), indexQueuePrng([0, 0]), createSequenceState());

    expect(result.render_context).toEqual({ entity: "Category", field: "name", new_type: "date" });
    expect(E4_OPS_V2.retype_field).not.toBe(E4_OPS.retype_field);
  });

  test("v2 substrate modules never call Math.random", async () => {
    const repoRoot = join(import.meta.dir, "..");
    for (const glob of ["src/e4/substrate/v2/*.ts", "src/e4/v2/*.ts"]) {
      for await (const file of new Bun.Glob(glob).scan(repoRoot)) {
        const source = await Bun.file(join(repoRoot, file)).text();
        expect(source).not.toMatch(/Math\.random\s*\(/);
      }
    }
  });
});

describe("§5.6.6 heterogeneous seed refs", () => {
  test("seed row n references seed row n of the referenced entity", () => {
    const fixture = generateSeedFixtureV2(buildBaselineIr());

    expect(fixture.Widget[0].category_id).toBe("category-seed-1");
    expect(fixture.Widget[1].category_id).toBe("category-seed-2");
  });

  test("the filtered list count is strictly below the unfiltered count at T0 (the wrong-filter discrimination pin)", () => {
    const fixture = generateSeedFixtureV2(buildBaselineIr());
    const matching = fixture.Widget.filter((row) => row.category_id === "category-seed-1").length;

    expect(matching).toBeLessThan(fixture.Widget.length);
  });
});

describe("§5.6.1 server validation surface (sealed check order)", () => {
  test("valid create passes; each check class rejects with 400 validation_error; first failure wins in the sealed order", async () => {
    await withServer(buildBaselineIr(), async (baseUrl) => {
      const ok = await postWidget(baseUrl, VALID_WIDGET);
      expect(ok.status).toBe(201);

      // unknown field
      const unknown = await postWidget(baseUrl, { ...VALID_WIDGET, extra: 1 });
      expect(unknown.status).toBe(400);
      expect(unknown.json.error.code).toBe("validation_error");
      expect(unknown.json.error.message).toBe("unknown field: extra");

      // missing required
      const { name: _dropped, ...withoutName } = VALID_WIDGET;
      const missing = await postWidget(baseUrl, withoutName);
      expect(missing.status).toBe(400);
      expect(missing.json.error.message).toBe("name is required");

      // required beats type: null is treated as absent
      const nullRequired = await postWidget(baseUrl, { ...VALID_WIDGET, name: null });
      expect(nullRequired.json.error.message).toBe("name is required");

      // type
      const badType = await postWidget(baseUrl, { ...VALID_WIDGET, price: "1.5" });
      expect(badType.status).toBe(400);
      expect(badType.json.error.message).toBe("price must be a decimal");

      // rule (range min 0)
      const badRule = await postWidget(baseUrl, { ...VALID_WIDGET, price: -1 });
      expect(badRule.status).toBe(400);
      expect(badRule.json.error.message).toBe("price is invalid");

      // sealed order: unknown field beats missing required beats type beats rule
      const unknownAndMissing = await postWidget(baseUrl, { ...withoutName, extra: 1 });
      expect(unknownAndMissing.json.error.message).toBe("unknown field: extra");

      const missingAndBadType = await postWidget(baseUrl, { ...withoutName, price: "1.5" });
      expect(missingAndBadType.json.error.message).toBe("name is required");

      const typeBeatsRule = await postWidget(baseUrl, { ...VALID_WIDGET, price: "not even numeric", in_stock: "yes" });
      expect(typeBeatsRule.json.error.message).toBe("price must be a decimal");

      // decimal admits integers (§5.6.1)
      const intPrice = await postWidget(baseUrl, { ...VALID_WIDGET, price: 12 });
      expect(intPrice.status).toBe(201);
    });
  }, 30_000);

  test("update bodies run the same validation surface", async () => {
    await withServer(buildBaselineIr(), async (baseUrl) => {
      const put = async (body: Record<string, unknown>) => {
        const response = await fetch(`${baseUrl}/widgets/widget-seed-1`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        });
        return { status: response.status, json: await response.json().catch(() => null) };
      };

      const ok = await put({ ...VALID_WIDGET, id: "widget-seed-1" });
      expect(ok.status).toBe(200);

      const unknown = await put({ ...VALID_WIDGET, id: "widget-seed-1", extra: true });
      expect(unknown.status).toBe(400);
      expect(unknown.json.error.message).toBe("unknown field: extra");

      const badBool = await put({ ...VALID_WIDGET, id: "widget-seed-1", in_stock: "yes" });
      expect(badBool.status).toBe(400);
      expect(badBool.json.error.message).toBe("in_stock must be a bool");
    });
  }, 30_000);

  test("the error envelope follows the error_format convention (type_detail after a v2 modify_convention)", async () => {
    const flipped = E4_OPS_V2.modify_convention.apply(buildBaselineIr(), createUidMinter(), indexQueuePrng([0]), createSequenceState());

    await withServer(flipped.ir, async (baseUrl) => {
      const missing = await postWidget(baseUrl, {});
      expect(missing.status).toBe(400);
      expect(missing.json.error.type).toBe("validation_error");
      expect(typeof missing.json.error.detail).toBe("string");
      expect(missing.json.error.code).toBeUndefined();
    });
  }, 30_000);

  test("date fields require the sealed ^\\d{4}-\\d{2}-\\d{2}$ shape", async () => {
    // Retype Widget.name string→date: retypable [Cat.name, W.name, W.price, W.in_stock] → 1.
    const retyped = E4_OPS_V2.retype_field.apply(buildBaselineIr(), createUidMinter(), indexQueuePrng([1, 0]), createSequenceState());

    await withServer(retyped.ir, async (baseUrl) => {
      const good = await postWidget(baseUrl, { ...VALID_WIDGET, name: "2026-07-09" });
      expect(good.status).toBe(201);

      const bad = await postWidget(baseUrl, { ...VALID_WIDGET, name: "not-a-date" });
      expect(bad.status).toBe(400);
      expect(bad.json.error.message).toBe("name must be a date");
    });
  }, 30_000);
});

describe("v2 dump-format compatibility (§7.5 code channel unchanged)", () => {
  test("registry.ts and schema.ts export byte-identical data to the v1 scaffold for the same IR", async () => {
    const { buildE4WorkspaceFiles } = await import("../src/e4/substrate/scaffold");
    const ir = buildBaselineIr();
    const v1Files = buildE4WorkspaceFiles(ir);
    const v2Files = buildE4V2AppFiles(ir);

    const extractJsonBlocks = (source: string) =>
      [...source.matchAll(/=\s(\[[\s\S]*?\]|\{[\s\S]*?\});?\n/g)].map((match) => match[1]);

    expect(extractJsonBlocks(v2Files["registry.ts"])).toEqual(extractJsonBlocks(v1Files["registry.ts"]));
    // schema.ts: entitySchemas and validationRules are identical; errorEnvelopeStyle too.
    expect(extractJsonBlocks(v2Files["schema.ts"])).toEqual(extractJsonBlocks(v1Files["schema.ts"]));
  });

  test("v2 emits no specs/openapi.json and no specs/CONVENTIONS.md (§5.5 workspace shape)", () => {
    const files = buildE4V2AppFiles(buildBaselineIr());

    expect(Object.keys(files).toSorted()).toEqual(["registry.ts", "schema.ts", "seed.ts", "server.ts", "storage.ts"]);
  });
});

describe("§5.6.7 GT testgen v2 mirror negative tests", () => {
  test("unknown-field, type, and rule rejection tests are emitted at GT-reserved ordinals", () => {
    const tests = generateCumulativeTestsV2(buildBaselineIr());
    const ids = tests.map((candidate) => candidate.test_id);

    expect(ids).toContain("Widget-unknown-field");
    expect(ids).toContain("Widget-price-type");
    expect(ids).toContain("Widget-in_stock-type");
    expect(ids).toContain("Widget-price-range-rule");

    const unknownField = tests.find((candidate) => candidate.test_id === "Widget-unknown-field")!;
    expect(unknownField.expected.status).toBe(400);
    expect((unknownField.request.body as Record<string, unknown>).unexpected).toBe("unexpected");
    expect((unknownField.request.body as Record<string, unknown>).id).toBe("widget-invalid-1");

    const typeTest = tests.find((candidate) => candidate.test_id === "Widget-price-type")!;
    expect((typeTest.request.body as Record<string, unknown>).price).toBe(TYPE_VIOLATING_VALUES.decimal);

    const ruleTest = tests.find((candidate) => candidate.test_id === "Widget-price-range-rule")!;
    expect((ruleTest.request.body as Record<string, unknown>).price).toBe(-1);
  });

  test("string and ref fields get no type-rejection test (no violating literal exists)", () => {
    const ids = generateCumulativeTestsV2(buildBaselineIr()).map((candidate) => candidate.test_id);

    expect(ids).not.toContain("Widget-name-type");
    expect(ids).not.toContain("Widget-category_id-type");
  });

  test("delta filtering keys the new negative tests to their IR items", () => {
    // add_validation_rule on Widget.name (v1 candidates [Cat.id, Cat.name, W.id, W.name] → 3).
    const result = E4_OPS_V2.add_validation_rule.apply(buildBaselineIr(), createUidMinter(), indexQueuePrng([3]), createSequenceState());
    const delta = generateDeltaTestsV2(result.ir, result.touched_item_uids);

    expect(delta.map((candidate) => candidate.test_id)).toEqual(["Widget-name-format-rule"]);
  });

  test("the update expectation follows heterogeneous seed refs (row 2 references parent 2)", () => {
    const tests = generateCumulativeTestsV2(buildBaselineIr());
    const update = tests.find((candidate) => candidate.test_id === "Widget-update")!;

    expect((update.expected.body as Record<string, unknown>).category_id).toBe("category-seed-2");
  });
});

describe("sealed violating-value tables", () => {
  test("the §5.5 literals are pinned", () => {
    expect(TYPE_VIOLATING_VALUES).toEqual({ int: 1.5, decimal: "1.5", bool: "yes", date: "not-a-date" });
    expect(FORMAT_PATTERN_VIOLATIONS["^[\\w -]{1,80}$"]).toBe("!");
    expect("!").not.toMatch(new RegExp("^[\\w -]{1,80}$"));
  });

  test("ruleViolatingValue: range uses min−1, max+1 only when min is absent, format uses the pool, enum uses the sealed non-member", () => {
    expect(ruleViolatingValue({ kind: "range", detail: { min: 0 } })).toBe(-1);
    expect(ruleViolatingValue({ kind: "range", detail: { max: 10 } })).toBe(11);
    expect(ruleViolatingValue({ kind: "range", detail: { min: 0, max: 10 } })).toBe(-1);
    expect(ruleViolatingValue({ kind: "format", detail: { pattern: "^[\\w -]{1,80}$" } })).toBe("!");
    expect(ruleViolatingValue({ kind: "enum", detail: { values: ["a"] } })).toBe("__not_a_member__");
    expect(() => ruleViolatingValue({ kind: "format", detail: { pattern: "^unknown$" } })).toThrow(/sealed violation table/);
  });
});
