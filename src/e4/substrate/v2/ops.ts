// v2 change-op action space (E4V2 design §5.6 `procedural-rest-v2`, Amendment 2). Same op
// vocabulary as v1 (src/e4/substrate/ops.ts, untouched) except the four §5.6 pins — every
// non-behavior-preserving op now has an observable HTTP consequence:
//   §5.6.2 rename_entity moves paths (collection segment regenerated) and emits endpoint-level
//          rename-lineage entries alongside the entity entry;
//   §5.6.3 add_entity mints full CRUD + list (the every-entity-has-a-read invariant);
//   §5.6.4 delete_field eligibility narrows to required, non-id, non-ruled fields;
//   §5.6.5 modify_convention targets only the error_format convention (statement FLIPS between
//          the two sealed envelope statements — the v1 "(revised)" suffix branch is unreachable
//          in v2 by construction: a suffixed statement has no server-renderable envelope style,
//          which would violate §5.6's observable-consequence invariant).
// Plus one pin the M0 census itself forced (recorded in the M0 milestone note): retype_field
// excludes `id` fields in v2. v1's candidate list admitted retyping an id (string→date), which
// v1 tolerated because nothing validated types — under §5.6.1 strict validation every fixture
// policy (seed rows, GT ordinals, the §5.5 spec ids) hardcodes string-shaped ids, so an id
// retype makes the GOLD implementation fail its own GT suite and the census's post-op-green
// check. The id-exclusion principle already pins rename_field (v1) and delete_field (§5.6.4).
// All other ops are reused from the v1 registry object directly — reuse, never fork.
import {
  cloneIr,
  renderEndpointItemId,
  renderEntityItemId,
  renderFieldItemId,
  type E4Entity,
  type E4EntityField,
  type E4SchemaIR
} from "../ir";
import { E4_OPS, type E4ChangeOpKind, type E4OpDefinition, type E4OpResult, type E4SequenceState } from "../ops";
import type { E4Prng } from "../prng";
import { pluralizeEntityName } from "./pluralize";

export const SUBSTRATE_KIND_V2 = "procedural-rest-v2" as const;
// §5.7 Amendment 3 (naturalization): English pluralizer for minted paths, ref-key cascade on
// entity renames, add_endpoint override, seed-data carry-forward (see ./fixture.ts).
// v2.2 (E5 P0-V item 2): modify_endpoint phrasing variant 1 corrected in the v2-owned pool
// (./render.ts) — a phrasing-text edit is a substrate_version change by the sealed M1 rule.
// Draw semantics, PRNG consumption, and every other rendered text are byte-identical to v2.1.
export const SUBSTRATE_VERSION_V2 = "procedural-rest-v2.2";

// Same name pool as v1's add_entity (v1 keeps its copy private; the two substrates version
// their text surfaces independently — this one seals under the v2 constants lineage at v2-M5).
const NEW_ENTITY_NAME_POOL_V2 = ["Supplier", "Warehouse", "Promotion", "Review", "Tag"] as const;
const RENAME_NOUN_POOL_V2 = ["Product", "Item", "Record", "Resource", "Entry", "Listing", "Asset"] as const;

// The two sealed error-envelope statements (the §5.6.1 server and the §5.5 templates resolve
// envelope keys from exactly these strings; scaffold-v2 throws on anything else — fail loud).
export const ERROR_FORMAT_STATEMENT_CODE_MESSAGE =
  'Error responses are JSON bodies of the shape { "error": { "code": string, "message": string } }.';
export const ERROR_FORMAT_STATEMENT_TYPE_DETAIL =
  'Error responses are JSON bodies of the shape { "error": { "type": string, "detail": string } }.';

function unusedName(pool: readonly string[], existing: ReadonlySet<string>, prng: E4Prng): string {
  const candidates = pool.filter((name) => !existing.has(name));

  if (candidates.length === 0) {
    throw new Error(`name pool exhausted (all of [${pool.join(", ")}] already in use)`);
  }

  return prng.pick(candidates);
}

export function collectionSegment(entityName: string): string {
  return pluralizeEntityName(entityName); // §5.7.1: sealed English pluralizer (supersedes lower+"s")
}

function replaceCollectionSegment(path: string, newSegment: string): string {
  const segments = path.split("/").filter(Boolean);
  segments[0] = newSegment;
  return `/${segments.join("/")}`;
}

type UidMinter = { mint(kind: string): string };

// ---- add_entity (§5.6.3: full CRUD + list) ------------------------------------------------------

function applyAddEntityV2(ir: E4SchemaIR, minter: UidMinter, prng: E4Prng, state: E4SequenceState): E4OpResult {
  const next = cloneIr(ir);
  const existingNames = new Set(next.entities.map((entity) => entity.name));
  const name = unusedName(NEW_ENTITY_NAME_POOL_V2, existingNames, prng);
  const collection = `/${collectionSegment(name)}`;

  const entityUid = minter.mint("entity");
  const idFieldUid = minter.mint("field");
  const nameFieldUid = minter.mint("field");

  next.entities.push({
    semantic_item_uid: entityUid,
    name,
    fields: [
      { semantic_item_uid: idFieldUid, name: "id", type: "string", required: true },
      { semantic_item_uid: nameFieldUid, name: "name", type: "string", required: true }
    ]
  });

  const endpointShapes = [
    { kind: "create", method: "POST", path: collection },
    { kind: "read", method: "GET", path: `${collection}/{id}` },
    { kind: "update", method: "PUT", path: `${collection}/{id}` },
    { kind: "delete", method: "DELETE", path: `${collection}/{id}` },
    { kind: "list", method: "GET", path: collection }
  ] as const;
  const endpointUids: string[] = [];

  for (const shape of endpointShapes) {
    const uid = minter.mint("endpoint");
    endpointUids.push(uid);
    next.endpoints.push({ semantic_item_uid: uid, entity: name, kind: shape.kind, method: shape.method, path: shape.path });
  }

  state.addedEntityNames.add(name);

  return {
    op_kind: "add_entity",
    ir: next,
    opportunity_label: "additive",
    touched_item_uids: [entityUid, idFieldUid, nameFieldUid, ...endpointUids],
    rename_lineage: [],
    render_context: { entity: name }
  };
}

// ---- rename_entity (§5.6.2: paths follow the rename; endpoint-level lineage) --------------------

function applyRenameEntityV2(ir: E4SchemaIR, _minter: UidMinter, prng: E4Prng, state: E4SequenceState): E4OpResult {
  const next = cloneIr(ir);
  const entity = prng.pick(next.entities);
  const oldName = entity.name;
  const existingNames = new Set(next.entities.map((candidate) => candidate.name));
  const newName = unusedName(RENAME_NOUN_POOL_V2, existingNames, prng);

  // Endpoint-level lineage entries are computed against the OLD rendered ids before the cascade
  // rewrites endpoint.entity/path. Each affected endpoint contributes TWO entries with the same
  // preserved semantic_item_uid: the (entity, kind) form the §7.5 code-side channel renders, and
  // the `endpoint:<METHOD> <path>` form the §7.5 spec-side stale_claim rule renders for an
  // unmatched scenario request — both must resolve through the same lineage merge.
  const newSegment = collectionSegment(newName);
  const endpointLineage = next.endpoints
    .filter((endpoint) => endpoint.entity === oldName)
    .flatMap((endpoint) => [
      {
        old_item_id: renderEndpointItemId(oldName, endpoint.kind),
        new_item_id: renderEndpointItemId(newName, endpoint.kind),
        semantic_item_uid: endpoint.semantic_item_uid
      },
      {
        old_item_id: `endpoint:${endpoint.method} ${endpoint.path}`,
        new_item_id: `endpoint:${endpoint.method} ${replaceCollectionSegment(endpoint.path, newSegment)}`,
        semantic_item_uid: endpoint.semantic_item_uid
      }
    ]);

  entity.name = newName;

  if (state.addedEntityNames.has(oldName)) {
    state.addedEntityNames.delete(oldName);
    state.addedEntityNames.add(newName);
  }

  // §5.7.3 ref-key cascade: a referencing field named exactly lower(oldName)+"_id" follows the
  // rename to lower(newName)+"_id" (a field custom-renamed earlier no longer matches and keeps
  // its name). Emits field-level lineage (uid preserved) so the meter merges identity instead of
  // scoring delete+add. Stored VALUES never move — that is the fixture carry-forward's contract.
  const cascadedFieldLineage: Array<{ old_item_id: string; new_item_id: string; semantic_item_uid: string }> = [];
  const conventionalRefKey = `${oldName.toLowerCase()}_id`;
  const cascadedRefKey = `${newName.toLowerCase()}_id`;

  for (const other of next.entities) {
    for (const field of other.fields) {
      if (field.type === "ref" && field.ref_entity === oldName) {
        field.ref_entity = newName;

        if (field.name === conventionalRefKey) {
          cascadedFieldLineage.push({
            old_item_id: renderFieldItemId(other.name, field.name),
            new_item_id: renderFieldItemId(other.name, cascadedRefKey),
            semantic_item_uid: field.semantic_item_uid
          });
          field.name = cascadedRefKey;
        }
      }
    }
  }

  for (const endpoint of next.endpoints) {
    if (endpoint.entity === oldName) {
      endpoint.entity = newName;
      endpoint.path = replaceCollectionSegment(endpoint.path, newSegment);
    }
  }

  for (const rule of next.validation_rules) {
    if (rule.entity === oldName) {
      rule.entity = newName;
    }
  }

  return {
    op_kind: "rename_entity",
    ir: next,
    opportunity_label: "drift_opportunity",
    touched_item_uids: [entity.semantic_item_uid],
    rename_lineage: [
      { old_item_id: renderEntityItemId(oldName), new_item_id: renderEntityItemId(newName), semantic_item_uid: entity.semantic_item_uid },
      ...endpointLineage,
      ...cascadedFieldLineage
    ],
    render_context: { old_name: oldName, new_name: newName }
  };
}

// ---- add_endpoint (§5.7.1 override: pluralized analytics path) ----------------------------------

// v1's applyAddEndpoint mints `/${lower(name)}s/stats`, which under the naive rule could sit
// beside the entity's own existing collection path with a DIFFERENT spelling (/categorys/stats
// vs /categories) — the seed-41 trap. v2.1 anchors the analytics path on the entity's pluralized
// collection segment.
function applyAddEndpointV2(ir: E4SchemaIR, minter: UidMinter, prng: E4Prng): E4OpResult {
  const next = cloneIr(ir);
  const candidates = next.entities.flatMap((entity) => {
    const existingKinds = new Set(
      next.endpoints.filter((endpoint) => endpoint.entity === entity.name).map((endpoint) => endpoint.kind)
    );
    return (["analytics"] as const).filter((kind) => !existingKinds.has(kind)).map((kind) => ({ entity, kind }));
  });
  const { entity, kind } = prng.pick(candidates);
  const endpointUid = minter.mint("endpoint");
  const path = `/${collectionSegment(entity.name)}/stats`;

  next.endpoints.push({ semantic_item_uid: endpointUid, entity: entity.name, kind, method: "GET", path });

  return {
    op_kind: "add_endpoint",
    ir: next,
    opportunity_label: "additive",
    touched_item_uids: [endpointUid],
    rename_lineage: [],
    render_context: { entity: entity.name, kind }
  };
}

// ---- delete_field (§5.6.4: required, non-id, non-ruled only) ------------------------------------

export function deletableFieldsV2(ir: E4SchemaIR): Array<{ entity: E4Entity; field: E4EntityField }> {
  const ruledFields = new Set(ir.validation_rules.map((rule) => `${rule.entity}.${rule.field}`));

  return ir.entities.flatMap((entity) =>
    entity.fields
      .filter((field) => field.required && field.name !== "id" && !ruledFields.has(`${entity.name}.${field.name}`))
      .map((field) => ({ entity, field }))
  );
}

function applyDeleteFieldV2(ir: E4SchemaIR, _minter: UidMinter, prng: E4Prng): E4OpResult {
  const next = cloneIr(ir);
  const { entity, field } = prng.pick(deletableFieldsV2(next));

  entity.fields = entity.fields.filter((candidate) => candidate.semantic_item_uid !== field.semantic_item_uid);

  return {
    op_kind: "delete_field",
    ir: next,
    opportunity_label: "drift_opportunity",
    touched_item_uids: [field.semantic_item_uid],
    rename_lineage: [],
    render_context: { entity: entity.name, field: field.name }
  };
}

// ---- retype_field (census-forced pin: non-id fields only) ---------------------------------------

const RETYPE_TARGETS_V2: Record<string, string[]> = {
  string: ["date"],
  int: ["decimal"],
  decimal: ["int"],
  bool: ["string"],
  date: ["string"],
  ref: []
};

function retypableFieldsV2(ir: E4SchemaIR): Array<{ entity: E4Entity; field: E4EntityField }> {
  return ir.entities.flatMap((entity) =>
    entity.fields
      .filter((field) => field.name !== "id" && (RETYPE_TARGETS_V2[field.type] ?? []).length > 0)
      .map((field) => ({ entity, field }))
  );
}

function applyRetypeFieldV2(ir: E4SchemaIR, _minter: UidMinter, prng: E4Prng): E4OpResult {
  const next = cloneIr(ir);
  const { entity, field } = prng.pick(retypableFieldsV2(next));
  const newType = prng.pick(RETYPE_TARGETS_V2[field.type]) as E4EntityField["type"];
  field.type = newType;

  return {
    op_kind: "retype_field",
    ir: next,
    opportunity_label: "drift_opportunity",
    touched_item_uids: [field.semantic_item_uid],
    rename_lineage: [],
    render_context: { entity: entity.name, field: field.name, new_type: newType }
  };
}

// ---- modify_convention (§5.6.5: error_format only; statement flips) -----------------------------

function errorFormatConventions(ir: E4SchemaIR) {
  return ir.conventions.filter((convention) => convention.kind === "error_format");
}

function applyModifyConventionV2(ir: E4SchemaIR, _minter: UidMinter, prng: E4Prng): E4OpResult {
  const next = cloneIr(ir);
  const convention = prng.pick(errorFormatConventions(next));

  if (convention.statement === ERROR_FORMAT_STATEMENT_CODE_MESSAGE) {
    convention.statement = ERROR_FORMAT_STATEMENT_TYPE_DETAIL;
  } else if (convention.statement === ERROR_FORMAT_STATEMENT_TYPE_DETAIL) {
    convention.statement = ERROR_FORMAT_STATEMENT_CODE_MESSAGE;
  } else {
    throw new Error(`modify_convention (v2): unrecognized error_format statement: ${convention.statement}`);
  }

  return {
    op_kind: "modify_convention",
    ir: next,
    opportunity_label: "drift_opportunity",
    touched_item_uids: [convention.semantic_item_uid],
    rename_lineage: [],
    render_context: { convention_id: convention.convention_id, kind: convention.kind }
  };
}

// ---- registry -----------------------------------------------------------------------------------

export const E4_OPS_V2: Record<E4ChangeOpKind, E4OpDefinition> = {
  ...E4_OPS,
  add_entity: { isEligible: () => true, apply: applyAddEntityV2 },
  rename_entity: { isEligible: (ir) => ir.entities.length > 0, apply: applyRenameEntityV2 },
  add_endpoint: {
    isEligible: (ir) =>
      ir.entities.some(
        (entity) => !ir.endpoints.some((endpoint) => endpoint.entity === entity.name && endpoint.kind === "analytics")
      ),
    apply: (ir, minter, prng) => applyAddEndpointV2(ir, minter, prng)
  },
  delete_field: {
    isEligible: (ir) => deletableFieldsV2(ir).length > 0,
    apply: (ir, minter, prng) => applyDeleteFieldV2(ir, minter, prng)
  },
  retype_field: {
    isEligible: (ir) => retypableFieldsV2(ir).length > 0,
    apply: (ir, minter, prng) => applyRetypeFieldV2(ir, minter, prng)
  },
  modify_convention: {
    isEligible: (ir) => errorFormatConventions(ir).length > 0,
    apply: (ir, minter, prng) => applyModifyConventionV2(ir, minter, prng)
  }
};
