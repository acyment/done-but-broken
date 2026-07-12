// v2 programmatic black-box test generation (E4V2 design §5.6.6/§5.6.7 + §5.7 Amendment 3).
// Differences from v1 (src/e4/substrate/testgen.ts, untouched):
//   §5.6.6 heterogeneous seed refs — seed row n's ref fields reference seed row n of the
//          referenced entity (v1 pointed every row at parent 1, which made the filtered list
//          count equal the unfiltered count and the §7 wrong-filter bank variant unkillable);
//   §5.6.7 mirror negative tests — unknown-field, type, and rule rejections at the GT-reserved
//          fixture ordinals, so the hidden oracle requires the enforcement the spec describes
//          (A6/A7 alignment); expected bodies adapted to the heterogeneous seeds.
//   §5.7   seed-data carry-forward — the oracle's seed-row expectations (paths, bodies, filter
//          values, list counts) come from the CARRIED fixture (./fixture.ts), never re-derived
//          from the post-op IR: stored ids/values survive renames the way real data does.
//          Entities with no carried rows (added mid-chain) anchor their read/update/delete
//          coverage on the oracle's own created fixtures instead of inventing pre-existing data.
//          Oracle-authored bodies (ordinals 9/20, -new-/-invalid- ids) still derive from current
//          names/types: they are writes the oracle itself makes and gets echoed back, so no
//          hidden convention is imposed on the agent.
// Fixture ordinals: GT reserves n=1/2 (seed rows) and n=9/20 (its own fixtures); the §5.5 spec
// templates reserve n=5/6.
import type { E4Entity, E4EntityField, E4FieldType, E4SchemaIR } from "../ir";
import type { E4HttpTest, E4SeedRow } from "../testgen";
import type { E4SeedFixtureV2 } from "./fixture";
import { TYPE_VIOLATING_VALUES, ruleViolatingValue } from "./values";

export { type E4HttpTest } from "../testgen";

export function seedIdV2(entityName: string, n: number): string {
  return `${entityName.toLowerCase()}-seed-${n}`;
}

// The GT generator's sealed field-value derivation (§5.5 fixture-value policy reads values from
// exactly this function at the spec-reserved ordinals 5/6). Ref fields point at the CARRIED
// parent seed row 1 when a fixture is provided (§5.7); without one (T0 generation, where carried
// and derived coincide) they point at the derived seed row 1 id.
export function defaultValueForFieldV2(
  ir: E4SchemaIR,
  field: E4EntityField,
  n: number,
  fixture?: E4SeedFixtureV2
): unknown {
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
      if (fixture) {
        return (fixture[field.ref_entity]?.[0]?.id as string | undefined) ?? null;
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

// T0 seed generation ONLY (§5.7): every post-T0 fixture state comes from carrying this one
// forward via migrateSeedFixtureV2 — never from re-deriving rows against a later IR.
export function generateSeedFixtureV2(ir: E4SchemaIR): Record<string, E4SeedRow[]> {
  const fixture: Record<string, E4SeedRow[]> = {};

  for (const entity of ir.entities) {
    fixture[entity.name] = [1, 2].map((n) => buildSeedRowV2(ir, entity, n));
  }

  return fixture;
}

function fixtureRow(ir: E4SchemaIR, entity: E4Entity, n: number, fixture?: E4SeedFixtureV2): E4SeedRow {
  const row: E4SeedRow = {};

  for (const field of entity.fields) {
    row[field.name] = field.name === "id" ? seedIdV2(entity.name, n) : defaultValueForFieldV2(ir, field, n, fixture);
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

function entityCrudTestsV2(ir: E4SchemaIR, entity: E4Entity, fixture: E4SeedFixtureV2): E4HttpTest[] {
  const tests: E4HttpTest[] = [];
  const endpoints = endpointsFor(ir, entity);
  const envelopeKeys = envelopeKeysFor(ir);
  const rows = fixture[entity.name] ?? [];
  const hasRows = rows.length > 0;

  const create = endpoints.find((endpoint) => endpoint.kind === "create");
  const newRow = fixtureRow(ir, entity, 9, fixture);
  newRow.id = `${entity.name.toLowerCase()}-new-1`;

  if (create) {
    tests.push({
      test_id: `${entity.name}-create`,
      description: `create a ${entity.name}`,
      source_item_uid: create.semantic_item_uid,
      request: { method: create.method, path: create.path, body: newRow },
      expected: { status: 201, body: newRow }
    });
  }

  // §5.7: read/update/delete anchor on carried seed rows when they exist; entities with no
  // carried rows (added mid-chain) anchor on the -new-1/-new-2 rows the oracle itself creates
  // (the create test above runs first; §5.6.3 guarantees create exists wherever read does).
  const readTargetRow = hasRows ? rows[0] : newRow;
  const writeTargetRow = hasRows ? (rows[1] ?? rows[0]) : newRow;

  const read = endpoints.find((endpoint) => endpoint.kind === "read");
  if (read) {
    tests.push({
      test_id: `${entity.name}-read`,
      description: `read an existing ${entity.name}`,
      source_item_uid: read.semantic_item_uid,
      request: { method: read.method, path: pathWithId(read.path, String(readTargetRow.id)) },
      expected: { status: 200, body: readTargetRow }
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
    const updatedRow: E4SeedRow = { ...writeTargetRow };
    const firstNonIdField = entity.fields.find((field) => field.name !== "id");
    if (firstNonIdField) {
      updatedRow[firstNonIdField.name] = defaultValueForFieldV2(ir, firstNonIdField, 20, fixture);
    }
    tests.push({
      test_id: `${entity.name}-update`,
      description: `update an existing ${entity.name}`,
      source_item_uid: update.semantic_item_uid,
      request: { method: update.method, path: pathWithId(update.path, String(updatedRow.id)), body: updatedRow },
      expected: { status: 200, body: updatedRow }
    });
  }

  const del = endpoints.find((endpoint) => endpoint.kind === "delete");
  if (del) {
    let deleteTargetId = String(writeTargetRow.id);

    if (!hasRows && create) {
      // Row-less entity: mint a second oracle-owned row so the delete never removes the one row
      // the list test still needs.
      const secondRow = fixtureRow(ir, entity, 20, fixture);
      secondRow.id = `${entity.name.toLowerCase()}-new-2`;
      deleteTargetId = String(secondRow.id);
      tests.push({
        test_id: `${entity.name}-create-2`,
        description: `create a second ${entity.name} (delete fixture)`,
        source_item_uid: create.semantic_item_uid,
        request: { method: create.method, path: create.path, body: secondRow },
        expected: { status: 201, body: secondRow }
      });
    }

    tests.push({
      test_id: `${entity.name}-delete`,
      description: `delete an existing ${entity.name}`,
      source_item_uid: del.semantic_item_uid,
      request: { method: del.method, path: pathWithId(del.path, deleteTargetId) },
      expected: { status: 204 }
    });

    const readAfterDelete = endpoints.find((endpoint) => endpoint.kind === "read");
    if (readAfterDelete && envelopeKeys) {
      tests.push({
        test_id: `${entity.name}-read-after-delete`,
        description: `a deleted ${entity.name} is gone`,
        source_item_uid: del.semantic_item_uid,
        request: { method: readAfterDelete.method, path: pathWithId(readAfterDelete.path, deleteTargetId) },
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
      const parentId = (fixture[refField.ref_entity]?.[0]?.id as string | undefined) ?? null;

      // §5.7: filter by the CARRIED parent row-1 id. Skipped when the parent has no carried rows
      // (a ref backfilled with nulls has nothing determinate to filter by).
      if (parentId !== null) {
        tests.push({
          test_id: `${entity.name}-list-filtered`,
          description: `list ${entity.name} records filtered by ${refField.name}`,
          source_item_uid: list.semantic_item_uid,
          request: { method: list.method, path: `${list.path}?${refField.name}=${parentId}` },
          expected: { status: 200, array_min_length: 1 }
        });
      }
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

function requiredFieldTestsV2(ir: E4SchemaIR, entity: E4Entity, fixture: E4SeedFixtureV2): E4HttpTest[] {
  const create = endpointsFor(ir, entity).find((endpoint) => endpoint.kind === "create");
  if (!create) {
    return [];
  }

  const envelopeKeys = envelopeKeysFor(ir);

  return entity.fields
    .filter((field) => field.required && field.name !== "id")
    .map((field) => {
      const invalidRow = fixtureRow(ir, entity, 9, fixture);
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
function negativeValidationTestsV2(ir: E4SchemaIR, entity: E4Entity, fixture: E4SeedFixtureV2): E4HttpTest[] {
  const create = endpointsFor(ir, entity).find((endpoint) => endpoint.kind === "create");
  if (!create) {
    return [];
  }

  const envelopeKeys = envelopeKeysFor(ir);
  const envelope = envelopeKeys ? { error_envelope_keys: envelopeKeys } : {};
  const tests: E4HttpTest[] = [];

  const unknownFieldRow = fixtureRow(ir, entity, 9, fixture);
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
    const row = fixtureRow(ir, entity, 9, fixture);
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
    const row = fixtureRow(ir, entity, 9, fixture);
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

// The optional fixture defaults to T0-style regeneration, which is byte-identical to the carried
// fixture at T0 and ONLY there — every post-op caller (provider, meter, fake provider, template
// derivation) passes the carried fixture explicitly; the §5.7 census pins the live semantics.
export function generateCumulativeTestsV2(ir: E4SchemaIR, fixture?: E4SeedFixtureV2): E4HttpTest[] {
  const seedFixture = fixture ?? generateSeedFixtureV2(ir);
  return ir.entities.flatMap((entity) => [
    ...entityCrudTestsV2(ir, entity, seedFixture),
    ...requiredFieldTestsV2(ir, entity, seedFixture),
    ...negativeValidationTestsV2(ir, entity, seedFixture)
  ]);
}

export function generateDeltaTestsV2(ir: E4SchemaIR, touchedItemUids: string[], fixture?: E4SeedFixtureV2): E4HttpTest[] {
  const touched = new Set(touchedItemUids);
  return generateCumulativeTestsV2(ir, fixture).filter((test) => touched.has(test.source_item_uid));
}
