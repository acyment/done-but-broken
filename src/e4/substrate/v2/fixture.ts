// §5.7 Amendment 3: seed-data carry-forward (data-migration semantics).
//
// v2.0 regenerated the whole seed fixture from the post-op IR at every task, which silently
// demanded that agents rewrite stored primary keys on entity renames, re-derive stored string
// values from renamed field names, backfill added fields with exact derived literals, and pin
// date values to 2026-01-01 — none of it disclosed anywhere agent-visible. Under v2.1 the seed
// fixture is generated ONCE at T0 and migrated forward per op by the sealed rules below, the
// way a real data migration would behave:
//   - renames never touch stored data (ids keep their creation-time prefix; values unchanged);
//     only keys move (fixture map key follows the entity; a renamed field renames its row key;
//     the §5.7.3 ref-key cascade renames referencing keys with values intact);
//   - added fields backfill null (add_field mints optional fields only), except added ref
//     fields, which link row n → carried parent row n (null when no counterpart) — preserving
//     §5.6.6 filtered-list killability; both disclosed via the §5.7.4 PM-brief lines;
//   - retypes convert stored values by the sealed table in convertStoredValueV2 (the
//     representation-changing conversions are brief-disclosed);
//   - deletes drop keys/rows; added entities start EMPTY (no invented pre-existing data).
// Migration is uid-keyed against a single-op IR delta and byte-deterministic.
import type { E4EntityField, E4FieldType, E4SchemaIR } from "../ir";
import type { E4SeedRow } from "../testgen";

export type E4SeedFixtureV2 = Record<string, E4SeedRow[]>;

// Sealed stored-value conversion table for retype_field (§5.7.2). Only the RETYPE_TARGETS_V2
// directions can occur; anything else is a substrate bug — fail loud.
export const RETYPE_DATE_LITERAL_V2 = "2026-01-01";

export function convertStoredValueV2(value: unknown, oldType: E4FieldType, newType: E4FieldType): unknown {
  if (value === null || value === undefined) {
    return value ?? null;
  }
  if (oldType === newType) {
    return value;
  }
  if (oldType === "int" && newType === "decimal") {
    return value; // every int is an admissible decimal; JSON representation identical
  }
  if (oldType === "decimal" && newType === "int") {
    return Math.trunc(Number(value)); // sealed: truncation toward zero (brief-disclosed)
  }
  if (oldType === "string" && newType === "date") {
    return RETYPE_DATE_LITERAL_V2; // sealed literal (brief-disclosed)
  }
  if (oldType === "bool" && newType === "string") {
    return String(value); // "true" / "false" (brief-disclosed)
  }
  if (oldType === "date" && newType === "string") {
    return value; // already a string; representation unchanged
  }
  throw new Error(`convertStoredValueV2: unsupported retype direction ${oldType} -> ${newType}`);
}

function fieldByUid(fields: E4EntityField[], uid: string): E4EntityField | undefined {
  return fields.find((field) => field.semantic_item_uid === uid);
}

// Migrate the carried fixture across ONE op's IR delta (preIr -> postIr). Added ref fields
// resolve their parent rows against the pre-op fixture — a single op never both adds a ref
// field and renames its target entity, so pre-op and post-op parent names coincide for the
// lookup (asserted by the census).
export function migrateSeedFixtureV2(fixture: E4SeedFixtureV2, preIr: E4SchemaIR, postIr: E4SchemaIR): E4SeedFixtureV2 {
  const out: E4SeedFixtureV2 = {};

  for (const postEntity of postIr.entities) {
    const preEntity = preIr.entities.find((candidate) => candidate.semantic_item_uid === postEntity.semantic_item_uid);

    if (!preEntity) {
      out[postEntity.name] = []; // added entity: no pre-existing data
      continue;
    }

    const rows = fixture[preEntity.name] ?? [];
    out[postEntity.name] = rows.map((row, index) => {
      const migrated: E4SeedRow = {};

      for (const postField of postEntity.fields) {
        const preField = fieldByUid(preEntity.fields, postField.semantic_item_uid);

        if (!preField) {
          if (postField.type === "ref" && postField.ref_entity) {
            const parentRows = fixture[postField.ref_entity] ?? [];
            migrated[postField.name] = (parentRows[index]?.id as string | undefined) ?? null;
          } else {
            migrated[postField.name] = null;
          }
          continue;
        }

        migrated[postField.name] = convertStoredValueV2(row[preField.name] ?? null, preField.type, postField.type);
      }

      return migrated;
    });
  }

  return out;
}

// Carry the T0 fixture through a full drawn chain: returns one fixture per task index
// (position k = the fixture after task k+1's op). Pure and byte-deterministic.
export function carryForwardSeedFixturesV2(
  t0Fixture: E4SeedFixtureV2,
  initialIr: E4SchemaIR,
  taskIrs: E4SchemaIR[]
): E4SeedFixtureV2[] {
  const fixtures: E4SeedFixtureV2[] = [];
  let current = t0Fixture;
  let previousIr = initialIr;

  for (const ir of taskIrs) {
    current = migrateSeedFixtureV2(current, previousIr, ir);
    fixtures.push(current);
    previousIr = ir;
  }

  return fixtures;
}
