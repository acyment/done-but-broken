// Programmatic black-box test generation (architecture §4; IMPLEMENTATION-PLAN.md M1), no LLM.
// From the post-op IR: happy-path CRUD round-trips, list/filter assertions, validation-rule
// negative cases, and error-format assertions derived from the conventions IR. Emitted as delta +
// cumulative sets per task (cumulative = the no-regression encoding).
//
// Design note: create requests carry a client-supplied `id` (rather than a server-assigned one).
// Combined with in-memory storage that is always fresh-start (ADR-002) and a fully IR-derived seed
// fixture, every test in the cumulative set is regenerated as a pure function of the IR snapshot —
// no request-response chaining, no counter-position bookkeeping, byte-deterministic by construction.
import type { E4Entity, E4EntityField, E4FieldType, E4SchemaIR } from "./ir";

export type E4HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type E4HttpRequestSpec = {
  method: E4HttpMethod;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export type E4HttpExpectation = {
  status: number;
  body?: unknown; // exact match, canonicalized (ADR-006); absent = not checked
  array_min_length?: number; // for list/filter assertions, where exact-body match would be brittle
  headers?: Record<string, string>;
};

export type E4HttpTest = {
  test_id: string;
  description: string;
  source_item_uid: string; // the IR item this test exercises — delta filtering keys off this
  request: E4HttpRequestSpec;
  expected: E4HttpExpectation;
};

export type E4SeedRow = Record<string, unknown>;

export function generateSeedFixture(ir: E4SchemaIR): Record<string, E4SeedRow[]> {
  const fixture: Record<string, E4SeedRow[]> = {};

  for (const entity of ir.entities) {
    fixture[entity.name] = [1, 2].map((n) => buildSeedRow(ir, entity, n));
  }

  return fixture;
}

function buildSeedRow(ir: E4SchemaIR, entity: E4Entity, n: number): E4SeedRow {
  const row: E4SeedRow = {};

  for (const field of entity.fields) {
    row[field.name] = field.name === "id" ? seedId(entity.name, n) : defaultValueForField(ir, field, n);
  }

  return row;
}

function seedId(entityName: string, n: number): string {
  return `${entityName.toLowerCase()}-seed-${n}`;
}

function defaultValueForField(ir: E4SchemaIR, field: E4EntityField, n: number): unknown {
  const typeDefaults: Record<E4FieldType, () => unknown> = {
    string: () => `Sample ${field.name} ${n}`,
    int: () => n,
    decimal: () => n + 0.5,
    bool: () => n % 2 === 0,
    date: () => "2026-01-01",
    ref: () => {
      if (!field.ref_entity || !ir.entities.some((entity) => entity.name === field.ref_entity)) {
        return null;
      }
      return seedId(field.ref_entity, 1);
    }
  };

  return typeDefaults[field.type]();
}

const ERROR_FORMAT_SHAPES: Record<string, unknown> = {
  'Error responses are JSON bodies of the shape { "error": { "code": string, "message": string } }.':
    { error: { code: "not_found", message: "resource not found" } },
  'Error responses are JSON bodies of the shape { "error": { "type": string, "detail": string } }.':
    { error: { type: "not_found", detail: "resource not found" } }
};

function errorEnvelopeShape(statement: string): unknown | null {
  return ERROR_FORMAT_SHAPES[statement] ?? null;
}

function endpointsFor(ir: E4SchemaIR, entity: E4Entity) {
  return ir.endpoints.filter((endpoint) => endpoint.entity === entity.name);
}

function pathWithId(path: string, id: string): string {
  return path.replace("{id}", id);
}

function entityCrudTests(ir: E4SchemaIR, entity: E4Entity): E4HttpTest[] {
  const tests: E4HttpTest[] = [];
  const endpoints = endpointsFor(ir, entity);
  const errorFormatConvention = ir.conventions.find((convention) => convention.kind === "error_format");
  const errorShape = errorFormatConvention ? errorEnvelopeShape(errorFormatConvention.statement) : null;

  const create = endpoints.find((endpoint) => endpoint.kind === "create");
  if (create) {
    const newRow = buildSeedRow(ir, entity, 9);
    newRow.id = `${entity.name.toLowerCase()}-new-1`;
    tests.push({
      test_id: `${entity.name}-create`,
      description: `create a ${entity.name}`,
      source_item_uid: create.semantic_item_uid,
      request: { method: create.method, path: create.path, body: newRow },
      expected: { status: 201, body: newRow }
    });
  }

  const read = endpoints.find((endpoint) => endpoint.kind === "read");
  if (read) {
    tests.push({
      test_id: `${entity.name}-read`,
      description: `read an existing ${entity.name}`,
      source_item_uid: read.semantic_item_uid,
      request: { method: read.method, path: pathWithId(read.path, seedId(entity.name, 1)) },
      expected: { status: 200, body: buildSeedRow(ir, entity, 1) }
    });

    if (errorShape) {
      tests.push({
        test_id: `${entity.name}-read-missing`,
        description: `reading a nonexistent ${entity.name} reports the error envelope`,
        source_item_uid: read.semantic_item_uid,
        request: { method: read.method, path: pathWithId(read.path, `${entity.name.toLowerCase()}-does-not-exist`) },
        expected: { status: 404, body: errorShape }
      });
    }
  }

  const update = endpoints.find((endpoint) => endpoint.kind === "update");
  if (update) {
    const updatedRow = buildSeedRow(ir, entity, 2);
    const firstNonIdField = entity.fields.find((field) => field.name !== "id");
    if (firstNonIdField) {
      updatedRow[firstNonIdField.name] = defaultValueForField(ir, firstNonIdField, 20);
    }
    tests.push({
      test_id: `${entity.name}-update`,
      description: `update an existing ${entity.name}`,
      source_item_uid: update.semantic_item_uid,
      request: { method: update.method, path: pathWithId(update.path, seedId(entity.name, 2)), body: updatedRow },
      expected: { status: 200, body: updatedRow }
    });
  }

  const del = endpoints.find((endpoint) => endpoint.kind === "delete");
  if (del) {
    tests.push({
      test_id: `${entity.name}-delete`,
      description: `delete an existing ${entity.name}`,
      source_item_uid: del.semantic_item_uid,
      request: { method: del.method, path: pathWithId(del.path, seedId(entity.name, 2)) },
      expected: { status: 204 }
    });

    const readAfterDelete = endpoints.find((endpoint) => endpoint.kind === "read");
    if (readAfterDelete && errorShape) {
      tests.push({
        test_id: `${entity.name}-read-after-delete`,
        description: `a deleted ${entity.name} is gone`,
        source_item_uid: del.semantic_item_uid,
        request: { method: readAfterDelete.method, path: pathWithId(readAfterDelete.path, seedId(entity.name, 2)) },
        expected: { status: 404, body: errorShape }
      });
    }
  }

  const list = endpoints.find((endpoint) => endpoint.kind === "list");
  if (list) {
    tests.push({
      test_id: `${entity.name}-list`,
      description: `list ${entity.name} records`,
      source_item_uid: list.semantic_item_uid,
      request: { method: list.method, path: list.path },
      expected: { status: 200, array_min_length: 1 }
    });

    // "list" folds in query-string filtering on any ref field — not a separate registered route
    // (two routes on the same method+path would be unreachable/ambiguous), so this is the same
    // source_item_uid as the plain list test above.
    const refField = entity.fields.find((field) => field.type === "ref");
    if (refField?.ref_entity) {
      tests.push({
        test_id: `${entity.name}-list-filtered`,
        description: `list ${entity.name} records filtered by ${refField.name}`,
        source_item_uid: list.semantic_item_uid,
        request: { method: list.method, path: `${list.path}?${refField.name}=${seedId(refField.ref_entity, 1)}` },
        expected: { status: 200, array_min_length: 1 }
      });
    }
  }

  const analytics = endpoints.find((endpoint) => endpoint.kind === "analytics");
  if (analytics) {
    tests.push({
      test_id: `${entity.name}-analytics`,
      description: `summary numbers for ${entity.name}`,
      source_item_uid: analytics.semantic_item_uid,
      request: { method: analytics.method, path: analytics.path },
      expected: { status: 200 }
    });
  }

  return tests;
}

// Required-ness is modeled once, at the field level (field.required) — never duplicated as a
// validation_rule kind, or OpenAPI's single `required` array can't represent both without one
// silently drifting from the other (there is no separate JSON Schema keyword for "business rule
// required" vs "structurally required"). validation_rules stays for range/enum/format only.
function requiredFieldTests(ir: E4SchemaIR, entity: E4Entity): E4HttpTest[] {
  const create = endpointsFor(ir, entity).find((endpoint) => endpoint.kind === "create");
  if (!create) {
    return [];
  }

  const errorFormatConvention = ir.conventions.find((convention) => convention.kind === "error_format");
  const errorShape = errorFormatConvention ? errorEnvelopeShape(errorFormatConvention.statement) : null;

  return entity.fields
    .filter((field) => field.required && field.name !== "id")
    .map((field) => {
      const invalidRow = buildSeedRow(ir, entity, 9);
      invalidRow.id = `${entity.name.toLowerCase()}-invalid-1`;
      delete invalidRow[field.name];

      return {
        test_id: `${entity.name}-${field.name}-required`,
        description: `creating a ${entity.name} without ${field.name} is rejected`,
        source_item_uid: field.semantic_item_uid,
        request: { method: create.method, path: create.path, body: invalidRow },
        expected: { status: 400, ...(errorShape ? { body: errorShape } : {}) }
      };
    });
}

export function generateCumulativeTests(ir: E4SchemaIR): E4HttpTest[] {
  return ir.entities.flatMap((entity) => [...entityCrudTests(ir, entity), ...requiredFieldTests(ir, entity)]);
}

export function generateDeltaTests(ir: E4SchemaIR, touchedItemUids: string[]): E4HttpTest[] {
  const touched = new Set(touchedItemUids);
  return generateCumulativeTests(ir).filter((test) => touched.has(test.source_item_uid));
}
