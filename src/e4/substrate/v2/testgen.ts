// v2 programmatic black-box test generation (E4V2 design §5.6.6/§5.6.7). Differences from v1
// (src/e4/substrate/testgen.ts, untouched):
//   §5.6.6 heterogeneous seed refs — seed row n's ref fields reference seed row n of the
//          referenced entity (v1 pointed every row at parent 1, which made the filtered list
//          count equal the unfiltered count and the §7 wrong-filter bank variant unkillable);
//   §5.6.7 mirror negative tests — unknown-field, type, and rule rejections at the GT-reserved
//          fixture ordinals, so the hidden oracle requires the enforcement the spec describes
//          (A6/A7 alignment); expected bodies adapted to the heterogeneous seeds.
// Fixture ordinals: GT reserves n=1/2 (seed rows) and n=9/20 (its own fixtures); the §5.5 spec
// templates reserve n=5/6. Non-seed fixture bodies keep ref → seed row 1 (only SEED rows are
// heterogeneous).
import type { E4Entity, E4EntityField, E4FieldType, E4SchemaIR } from "../ir";
import type { E4HttpTest, E4SeedRow } from "../testgen";
import { TYPE_VIOLATING_VALUES, ruleViolatingValue } from "./values";

export { type E4HttpTest } from "../testgen";

export function seedIdV2(entityName: string, n: number): string {
  return `${entityName.toLowerCase()}-seed-${n}`;
}

// The GT generator's sealed field-value derivation (§5.5 fixture-value policy reads values from
// exactly this function at the spec-reserved ordinals 5/6). Ref fields always point at seed row 1
// of the referenced entity — seed-row heterogeneity is applied by buildSeedRowV2, not here.
export function defaultValueForFieldV2(ir: E4SchemaIR, field: E4EntityField, n: number): unknown {
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
      return seedIdV2(field.ref_entity, 1);
    }
  };

  return typeDefaults[field.type]();
}

function buildSeedRowV2(ir: E4SchemaIR, entity: E4Entity, n: number): E4SeedRow {
  const row: E4SeedRow = {};

  for (const field of entity.fields) {
    if (field.name === "id") {
      row[field.name] = seedIdV2(entity.name, n);
    } else if (field.type === "ref") {
      // §5.6.6: seed row n references seed row n of the referenced entity.
      row[field.name] =
        field.ref_entity && ir.entities.some((candidate) => candidate.name === field.ref_entity)
          ? seedIdV2(field.ref_entity, n)
          : null;
    } else {
      row[field.name] = defaultValueForFieldV2(ir, field, n);
    }
  }

  return row;
}

export function generateSeedFixtureV2(ir: E4SchemaIR): Record<string, E4SeedRow[]> {
  const fixture: Record<string, E4SeedRow[]> = {};

  for (const entity of ir.entities) {
    fixture[entity.name] = [1, 2].map((n) => buildSeedRowV2(ir, entity, n));
  }

  return fixture;
}

function fixtureRow(ir: E4SchemaIR, entity: E4Entity, n: number): E4SeedRow {
  const row: E4SeedRow = {};

  for (const field of entity.fields) {
    row[field.name] = field.name === "id" ? seedIdV2(entity.name, n) : defaultValueForFieldV2(ir, field, n);
  }

  return row;
}

const ERROR_FORMAT_ENVELOPE_KEYS: Record<string, [string, string]> = {
  'Error responses are JSON bodies of the shape { "error": { "code": string, "message": string } }.': ["code", "message"],
  'Error responses are JSON bodies of the shape { "error": { "type": string, "detail": string } }.': ["type", "detail"]
};

function envelopeKeysFor(ir: E4SchemaIR): [string, string] | null {
  const convention = ir.conventions.find((candidate) => candidate.kind === "error_format");
  return convention ? (ERROR_FORMAT_ENVELOPE_KEYS[convention.statement] ?? null) : null;
}

function endpointsFor(ir: E4SchemaIR, entity: E4Entity) {
  return ir.endpoints.filter((endpoint) => endpoint.entity === entity.name);
}

function pathWithId(path: string, id: string): string {
  return path.replace("{id}", id);
}

function entityCrudTestsV2(ir: E4SchemaIR, entity: E4Entity): E4HttpTest[] {
  const tests: E4HttpTest[] = [];
  const endpoints = endpointsFor(ir, entity);
  const envelopeKeys = envelopeKeysFor(ir);

  const create = endpoints.find((endpoint) => endpoint.kind === "create");
  if (create) {
    const newRow = fixtureRow(ir, entity, 9);
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
      request: { method: read.method, path: pathWithId(read.path, seedIdV2(entity.name, 1)) },
      expected: { status: 200, body: buildSeedRowV2(ir, entity, 1) }
    });

    if (envelopeKeys) {
      tests.push({
        test_id: `${entity.name}-read-missing`,
        description: `reading a nonexistent ${entity.name} reports the error envelope`,
        source_item_uid: read.semantic_item_uid,
        request: { method: read.method, path: pathWithId(read.path, `${entity.name.toLowerCase()}-does-not-exist`) },
        expected: { status: 404, error_envelope_keys: envelopeKeys }
      });
    }
  }

  const update = endpoints.find((endpoint) => endpoint.kind === "update");
  if (update) {
    const updatedRow = buildSeedRowV2(ir, entity, 2);
    const firstNonIdField = entity.fields.find((field) => field.name !== "id");
    if (firstNonIdField) {
      updatedRow[firstNonIdField.name] = defaultValueForFieldV2(ir, firstNonIdField, 20);
    }
    tests.push({
      test_id: `${entity.name}-update`,
      description: `update an existing ${entity.name}`,
      source_item_uid: update.semantic_item_uid,
      request: { method: update.method, path: pathWithId(update.path, seedIdV2(entity.name, 2)), body: updatedRow },
      expected: { status: 200, body: updatedRow }
    });
  }

  const del = endpoints.find((endpoint) => endpoint.kind === "delete");
  if (del) {
    tests.push({
      test_id: `${entity.name}-delete`,
      description: `delete an existing ${entity.name}`,
      source_item_uid: del.semantic_item_uid,
      request: { method: del.method, path: pathWithId(del.path, seedIdV2(entity.name, 2)) },
      expected: { status: 204 }
    });

    const readAfterDelete = endpoints.find((endpoint) => endpoint.kind === "read");
    if (readAfterDelete && envelopeKeys) {
      tests.push({
        test_id: `${entity.name}-read-after-delete`,
        description: `a deleted ${entity.name} is gone`,
        source_item_uid: del.semantic_item_uid,
        request: { method: readAfterDelete.method, path: pathWithId(readAfterDelete.path, seedIdV2(entity.name, 2)) },
        expected: { status: 404, error_envelope_keys: envelopeKeys }
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

    const refField = entity.fields.find((field) => field.type === "ref");
    if (refField?.ref_entity) {
      tests.push({
        test_id: `${entity.name}-list-filtered`,
        description: `list ${entity.name} records filtered by ${refField.name}`,
        source_item_uid: list.semantic_item_uid,
        request: { method: list.method, path: `${list.path}?${refField.name}=${seedIdV2(refField.ref_entity, 1)}` },
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

function requiredFieldTestsV2(ir: E4SchemaIR, entity: E4Entity): E4HttpTest[] {
  const create = endpointsFor(ir, entity).find((endpoint) => endpoint.kind === "create");
  if (!create) {
    return [];
  }

  const envelopeKeys = envelopeKeysFor(ir);

  return entity.fields
    .filter((field) => field.required && field.name !== "id")
    .map((field) => {
      const invalidRow = fixtureRow(ir, entity, 9);
      invalidRow.id = `${entity.name.toLowerCase()}-invalid-1`;
      delete invalidRow[field.name];

      return {
        test_id: `${entity.name}-${field.name}-required`,
        description: `creating a ${entity.name} without ${field.name} is rejected`,
        source_item_uid: field.semantic_item_uid,
        request: { method: create.method, path: create.path, body: invalidRow },
        expected: { status: 400, ...(envelopeKeys ? { error_envelope_keys: envelopeKeys } : {}) }
      };
    });
}

// §5.6.7 mirror negative tests: the hidden oracle now REQUIRES the §5.6.1 enforcement surface.
// One unknown-field rejection per entity with a create endpoint, one type rejection per typed
// (int/decimal/bool/date) field, one rule rejection per validation rule — all at GT-reserved
// fixture ordinals, sharing the sealed violating-value tables with the §5.5 spec templates.
function negativeValidationTestsV2(ir: E4SchemaIR, entity: E4Entity): E4HttpTest[] {
  const create = endpointsFor(ir, entity).find((endpoint) => endpoint.kind === "create");
  if (!create) {
    return [];
  }

  const envelopeKeys = envelopeKeysFor(ir);
  const envelope = envelopeKeys ? { error_envelope_keys: envelopeKeys } : {};
  const tests: E4HttpTest[] = [];

  const unknownFieldRow = fixtureRow(ir, entity, 9);
  unknownFieldRow.id = `${entity.name.toLowerCase()}-invalid-1`;
  unknownFieldRow.unexpected = "unexpected";
  tests.push({
    test_id: `${entity.name}-unknown-field`,
    description: `creating a ${entity.name} with an unknown field is rejected`,
    source_item_uid: create.semantic_item_uid,
    request: { method: create.method, path: create.path, body: unknownFieldRow },
    expected: { status: 400, ...envelope }
  });

  for (const field of entity.fields) {
    const violating = TYPE_VIOLATING_VALUES[field.type as keyof typeof TYPE_VIOLATING_VALUES];
    if (violating === undefined) {
      continue; // string/ref fields: any JSON string is type-valid — no violating literal exists.
    }
    const row = fixtureRow(ir, entity, 9);
    row.id = `${entity.name.toLowerCase()}-invalid-1`;
    row[field.name] = violating;
    tests.push({
      test_id: `${entity.name}-${field.name}-type`,
      description: `creating a ${entity.name} with a non-${field.type} ${field.name} is rejected`,
      source_item_uid: field.semantic_item_uid,
      request: { method: create.method, path: create.path, body: row },
      expected: { status: 400, ...envelope }
    });
  }

  for (const rule of ir.validation_rules.filter((candidate) => candidate.entity === entity.name)) {
    const row = fixtureRow(ir, entity, 9);
    row.id = `${entity.name.toLowerCase()}-invalid-1`;
    row[rule.field] = ruleViolatingValue(rule);
    tests.push({
      test_id: `${entity.name}-${rule.field}-${rule.kind}-rule`,
      description: `creating a ${entity.name} with an invalid ${rule.field} is rejected`,
      source_item_uid: rule.semantic_item_uid,
      request: { method: create.method, path: create.path, body: row },
      expected: { status: 400, ...envelope }
    });
  }

  return tests;
}

export function generateCumulativeTestsV2(ir: E4SchemaIR): E4HttpTest[] {
  return ir.entities.flatMap((entity) => [
    ...entityCrudTestsV2(ir, entity),
    ...requiredFieldTestsV2(ir, entity),
    ...negativeValidationTestsV2(ir, entity)
  ]);
}

export function generateDeltaTestsV2(ir: E4SchemaIR, touchedItemUids: string[]): E4HttpTest[] {
  const touched = new Set(touchedItemUids);
  return generateCumulativeTestsV2(ir).filter((test) => touched.has(test.source_item_uid));
}
