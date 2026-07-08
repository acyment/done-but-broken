// Change-op action space (architecture §4/§2.1; IMPLEMENTATION-PLAN.md M1). Each op is a pure
// IR→IR function. [R2: R2-1] rename-shaped ops preserve the touched item's semantic_item_uid and
// emit a rename-lineage entry (old rendered id → new rendered id → uid); delete-then-recreate
// ops mint a fresh uid instead. Migration/durability ops are excluded per ADR-002.
import {
  cloneIr,
  createUidMinter,
  renderEntityItemId,
  renderFieldItemId,
  type E4ConventionKind,
  type E4Entity,
  type E4EntityField,
  type E4FieldType,
  type E4SchemaIR
} from "./ir";
import type { E4Prng } from "./prng";
import type { E4OpportunityLabel } from "../types";

export type E4ChangeOpKind =
  | "add_entity"
  | "delete_entity"
  | "rename_entity"
  | "add_field"
  | "rename_field"
  | "retype_field"
  | "delete_field"
  | "add_endpoint"
  | "modify_endpoint"
  | "add_validation_rule"
  | "modify_convention"
  | "add_relationship"
  | "noop_maintenance";

export type E4RenameLineageEntry = {
  old_item_id: string;
  new_item_id: string;
  semantic_item_uid: string;
};

export type E4OpResult = {
  op_kind: E4ChangeOpKind;
  ir: E4SchemaIR;
  opportunity_label: E4OpportunityLabel;
  touched_item_uids: string[];
  rename_lineage: E4RenameLineageEntry[];
  // Structured, business-natural-safe facts about what changed (entity/field/endpoint names,
  // never file paths or testing vocabulary) — render.ts's only input, so it never has to
  // re-diff IR snapshots to find out what a task is about.
  render_context: Record<string, string>;
};

// Entities minted by add_entity within the drawn sequence — tracked so delete_entity never
// touches a baseline entity (keeps the T0 known-surface stable) and never orphans a ref field.
export type E4SequenceState = {
  addedEntityNames: Set<string>;
};

export function createSequenceState(): E4SequenceState {
  return { addedEntityNames: new Set() };
}

type UidMinter = ReturnType<typeof createUidMinter>;

const NEW_ENTITY_NAME_POOL = ["Supplier", "Warehouse", "Promotion", "Review", "Tag"] as const;
const RENAME_NOUN_POOL = ["Product", "Item", "Record", "Resource", "Entry", "Listing", "Asset"] as const;
const NEW_FIELD_POOL: ReadonlyArray<{ name: string; type: E4FieldType }> = [
  { name: "description", type: "string" },
  { name: "sku", type: "string" },
  { name: "weight_kg", type: "decimal" },
  { name: "is_featured", type: "bool" },
  { name: "notes", type: "string" },
  { name: "discount_pct", type: "int" }
];
const RENAME_FIELD_NOUN_POOL = ["label", "title", "summary", "details", "alias"] as const;
const RETYPE_TARGETS: Record<E4FieldType, E4FieldType[]> = {
  string: ["date"],
  int: ["decimal"],
  decimal: ["int"],
  bool: ["string"],
  date: ["string"],
  ref: []
};
const ENDPOINT_KIND_POOL = ["analytics"] as const;
const ENUM_FIELD_HINT = ["string"] as const;

function unusedName(pool: readonly string[], existing: ReadonlySet<string>, prng: E4Prng): string {
  const candidates = pool.filter((name) => !existing.has(name));

  if (candidates.length === 0) {
    throw new Error(`name pool exhausted (all of [${pool.join(", ")}] already in use)`);
  }

  return prng.pick(candidates);
}

function findEntity(ir: E4SchemaIR, name: string): E4Entity {
  const entity = ir.entities.find((candidate) => candidate.name === name);

  if (!entity) {
    throw new Error(`entity not found: ${name}`);
  }

  return entity;
}

// ---- add_entity -----------------------------------------------------------------------------

function isEligibleAddEntity(): boolean {
  return true;
}

function applyAddEntity(ir: E4SchemaIR, minter: UidMinter, prng: E4Prng, state: E4SequenceState): E4OpResult {
  const next = cloneIr(ir);
  const existingNames = new Set(next.entities.map((entity) => entity.name));
  const name = unusedName(NEW_ENTITY_NAME_POOL, existingNames, prng);

  const entityUid = minter.mint("entity");
  const idFieldUid = minter.mint("field");
  const nameFieldUid = minter.mint("field");
  const createEndpointUid = minter.mint("endpoint");
  const listEndpointUid = minter.mint("endpoint");

  next.entities.push({
    semantic_item_uid: entityUid,
    name,
    fields: [
      { semantic_item_uid: idFieldUid, name: "id", type: "string", required: true },
      { semantic_item_uid: nameFieldUid, name: "name", type: "string", required: true }
    ]
  });
  next.endpoints.push(
    { semantic_item_uid: createEndpointUid, entity: name, kind: "create", method: "POST", path: `/${name.toLowerCase()}s` },
    { semantic_item_uid: listEndpointUid, entity: name, kind: "list", method: "GET", path: `/${name.toLowerCase()}s` }
  );

  state.addedEntityNames.add(name);

  return {
    op_kind: "add_entity",
    ir: next,
    opportunity_label: "additive",
    touched_item_uids: [entityUid, idFieldUid, nameFieldUid, createEndpointUid, listEndpointUid],
    rename_lineage: [],
    render_context: { entity: name }
  };
}

// ---- delete_entity ----------------------------------------------------------------------------

function deletableEntityNames(ir: E4SchemaIR, state: E4SequenceState): string[] {
  const referenced = new Set(
    ir.entities.flatMap((entity) => entity.fields.filter((field) => field.type === "ref").map((field) => field.ref_entity))
  );

  return [...state.addedEntityNames].filter((name) => !referenced.has(name));
}

function isEligibleDeleteEntity(ir: E4SchemaIR, state: E4SequenceState): boolean {
  return deletableEntityNames(ir, state).length > 0;
}

function applyDeleteEntity(ir: E4SchemaIR, _minter: UidMinter, prng: E4Prng, state: E4SequenceState): E4OpResult {
  const next = cloneIr(ir);
  const name = prng.pick(deletableEntityNames(next, state));
  const entity = findEntity(next, name);

  const touched = [
    entity.semantic_item_uid,
    ...entity.fields.map((field) => field.semantic_item_uid),
    ...next.endpoints.filter((endpoint) => endpoint.entity === name).map((endpoint) => endpoint.semantic_item_uid),
    ...next.validation_rules.filter((rule) => rule.entity === name).map((rule) => rule.semantic_item_uid)
  ];

  next.entities = next.entities.filter((candidate) => candidate.name !== name);
  next.endpoints = next.endpoints.filter((endpoint) => endpoint.entity !== name);
  next.validation_rules = next.validation_rules.filter((rule) => rule.entity !== name);
  state.addedEntityNames.delete(name);

  return {
    op_kind: "delete_entity",
    ir: next,
    opportunity_label: "drift_opportunity",
    touched_item_uids: touched,
    rename_lineage: [],
    render_context: { entity: name }
  };
}

// ---- rename_entity ------------------------------------------------------------------------------

function isEligibleRenameEntity(ir: E4SchemaIR): boolean {
  return ir.entities.length > 0;
}

function applyRenameEntity(ir: E4SchemaIR, _minter: UidMinter, prng: E4Prng, state: E4SequenceState): E4OpResult {
  const next = cloneIr(ir);
  const entity = prng.pick(next.entities);
  const oldName = entity.name;
  const existingNames = new Set(next.entities.map((candidate) => candidate.name));
  const newName = unusedName(RENAME_NOUN_POOL, existingNames, prng);

  entity.name = newName;

  // The rename must follow into sequence-tracked bookkeeping, or a later delete_entity looks up
  // the old (now nonexistent) name and finds nothing (state.addedEntityNames would desync from ir).
  if (state.addedEntityNames.has(oldName)) {
    state.addedEntityNames.delete(oldName);
    state.addedEntityNames.add(newName);
  }

  // Cascade: any field elsewhere referencing this entity by name must follow the rename, or the
  // reference silently dangles.
  for (const other of next.entities) {
    for (const field of other.fields) {
      if (field.type === "ref" && field.ref_entity === oldName) {
        field.ref_entity = newName;
      }
    }
  }
  for (const endpoint of next.endpoints) {
    if (endpoint.entity === oldName) {
      endpoint.entity = newName;
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
      { old_item_id: renderEntityItemId(oldName), new_item_id: renderEntityItemId(newName), semantic_item_uid: entity.semantic_item_uid }
    ],
    render_context: { old_name: oldName, new_name: newName }
  };
}

// ---- add_field ------------------------------------------------------------------------------

function isEligibleAddField(ir: E4SchemaIR): boolean {
  return ir.entities.some((entity) => {
    const existingNames = new Set(entity.fields.map((field) => field.name));
    return NEW_FIELD_POOL.some((candidate) => !existingNames.has(candidate.name));
  });
}

function applyAddField(ir: E4SchemaIR, minter: UidMinter, prng: E4Prng): E4OpResult {
  const next = cloneIr(ir);
  const eligible = next.entities.filter((entity) => {
    const existingNames = new Set(entity.fields.map((field) => field.name));
    return NEW_FIELD_POOL.some((candidate) => !existingNames.has(candidate.name));
  });
  const entity = prng.pick(eligible);
  const existingNames = new Set(entity.fields.map((field) => field.name));
  const candidate = prng.pick(NEW_FIELD_POOL.filter((item) => !existingNames.has(item.name)));

  const fieldUid = minter.mint("field");
  entity.fields.push({ semantic_item_uid: fieldUid, name: candidate.name, type: candidate.type, required: false });

  return {
    op_kind: "add_field",
    ir: next,
    opportunity_label: "additive",
    touched_item_uids: [fieldUid],
    rename_lineage: [],
    render_context: { entity: entity.name, field: candidate.name }
  };
}

// ---- rename_field -----------------------------------------------------------------------------

function renameableFields(ir: E4SchemaIR): Array<{ entity: E4Entity; field: E4EntityField }> {
  return ir.entities.flatMap((entity) =>
    entity.fields.filter((field) => field.name !== "id").map((field) => ({ entity, field }))
  );
}

function isEligibleRenameField(ir: E4SchemaIR): boolean {
  return renameableFields(ir).length > 0;
}

function applyRenameField(ir: E4SchemaIR, _minter: UidMinter, prng: E4Prng): E4OpResult {
  const next = cloneIr(ir);
  const { entity, field } = prng.pick(renameableFields(next));
  const oldName = field.name;
  const existingNames = new Set(entity.fields.map((candidate) => candidate.name));
  const newName = unusedName(RENAME_FIELD_NOUN_POOL, existingNames, prng);

  field.name = newName;

  return {
    op_kind: "rename_field",
    ir: next,
    opportunity_label: "drift_opportunity",
    touched_item_uids: [field.semantic_item_uid],
    rename_lineage: [
      {
        old_item_id: renderFieldItemId(entity.name, oldName),
        new_item_id: renderFieldItemId(entity.name, newName),
        semantic_item_uid: field.semantic_item_uid
      }
    ],
    render_context: { entity: entity.name, old_name: oldName, new_name: newName }
  };
}

// ---- retype_field -----------------------------------------------------------------------------

function retypableFields(ir: E4SchemaIR): Array<{ entity: E4Entity; field: E4EntityField }> {
  return ir.entities.flatMap((entity) =>
    entity.fields
      .filter((field) => RETYPE_TARGETS[field.type].length > 0)
      .map((field) => ({ entity, field }))
  );
}

function isEligibleRetypeField(ir: E4SchemaIR): boolean {
  return retypableFields(ir).length > 0;
}

function applyRetypeField(ir: E4SchemaIR, _minter: UidMinter, prng: E4Prng): E4OpResult {
  const next = cloneIr(ir);
  const { entity, field } = prng.pick(retypableFields(next));
  const newType = prng.pick(RETYPE_TARGETS[field.type]);
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

// ---- delete_field -----------------------------------------------------------------------------

function deletableFields(ir: E4SchemaIR): Array<{ entity: E4Entity; field: E4EntityField }> {
  const ruledFieldUids = new Set(ir.validation_rules.map((rule) => `${rule.entity}.${rule.field}`));

  return ir.entities.flatMap((entity) =>
    entity.fields
      .filter((field) => field.name !== "id" && !ruledFieldUids.has(`${entity.name}.${field.name}`))
      .map((field) => ({ entity, field }))
  );
}

function isEligibleDeleteField(ir: E4SchemaIR): boolean {
  return deletableFields(ir).length > 0;
}

function applyDeleteField(ir: E4SchemaIR, _minter: UidMinter, prng: E4Prng): E4OpResult {
  const next = cloneIr(ir);
  const { entity, field } = prng.pick(deletableFields(next));

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

// ---- add_endpoint -----------------------------------------------------------------------------

function addEndpointCandidates(ir: E4SchemaIR): Array<{ entity: E4Entity; kind: (typeof ENDPOINT_KIND_POOL)[number] }> {
  return ir.entities.flatMap((entity) => {
    const existingKinds = new Set(ir.endpoints.filter((endpoint) => endpoint.entity === entity.name).map((endpoint) => endpoint.kind));
    return ENDPOINT_KIND_POOL.filter((kind) => !existingKinds.has(kind)).map((kind) => ({ entity, kind }));
  });
}

function isEligibleAddEndpoint(ir: E4SchemaIR): boolean {
  return addEndpointCandidates(ir).length > 0;
}

function applyAddEndpoint(ir: E4SchemaIR, minter: UidMinter, prng: E4Prng): E4OpResult {
  const next = cloneIr(ir);
  const { entity, kind } = prng.pick(addEndpointCandidates(next));
  const endpointUid = minter.mint("endpoint");
  const path = `/${entity.name.toLowerCase()}s/stats`;

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

// ---- modify_endpoint --------------------------------------------------------------------------

function isEligibleModifyEndpoint(ir: E4SchemaIR): boolean {
  return ir.endpoints.some((endpoint) => endpoint.kind === "update");
}

function applyModifyEndpoint(ir: E4SchemaIR, _minter: UidMinter, prng: E4Prng): E4OpResult {
  const next = cloneIr(ir);
  const endpoint = prng.pick(next.endpoints.filter((candidate) => candidate.kind === "update"));

  // Path-only identity (ir.ts): a method change is an attribute contradiction on the SAME item,
  // not an identity change — no rename-lineage entry.
  endpoint.method = endpoint.method === "PUT" ? "PATCH" : "PUT";

  return {
    op_kind: "modify_endpoint",
    ir: next,
    opportunity_label: "drift_opportunity",
    touched_item_uids: [endpoint.semantic_item_uid],
    rename_lineage: [],
    render_context: { entity: endpoint.entity, method: endpoint.method, path: endpoint.path }
  };
}

// ---- add_validation_rule ------------------------------------------------------------------------

function ruleCandidates(ir: E4SchemaIR): Array<{ entity: E4Entity; field: E4EntityField }> {
  const ruled = new Set(ir.validation_rules.map((rule) => `${rule.entity}.${rule.field}`));

  return ir.entities.flatMap((entity) =>
    entity.fields
      .filter((field) => ENUM_FIELD_HINT.includes(field.type as (typeof ENUM_FIELD_HINT)[number]))
      .filter((field) => !ruled.has(`${entity.name}.${field.name}`))
      .map((field) => ({ entity, field }))
  );
}

function isEligibleAddValidationRule(ir: E4SchemaIR): boolean {
  return ruleCandidates(ir).length > 0;
}

function applyAddValidationRule(ir: E4SchemaIR, minter: UidMinter, prng: E4Prng): E4OpResult {
  const next = cloneIr(ir);
  const { entity, field } = prng.pick(ruleCandidates(next));
  const ruleUid = minter.mint("rule");

  next.validation_rules.push({
    semantic_item_uid: ruleUid,
    entity: entity.name,
    field: field.name,
    kind: "format",
    detail: { pattern: "^[\\w -]{1,80}$" }
  });

  return {
    op_kind: "add_validation_rule",
    ir: next,
    opportunity_label: "additive",
    touched_item_uids: [ruleUid],
    rename_lineage: [],
    render_context: { entity: entity.name, field: field.name }
  };
}

// ---- modify_convention --------------------------------------------------------------------------

function isEligibleModifyConvention(ir: E4SchemaIR): boolean {
  return ir.conventions.length > 0;
}

const ALTERNATE_STATEMENTS: Record<E4ConventionKind, string> = {
  naming: "Endpoint paths use kebab-case plural nouns (e.g. /widgets, /widget-categories).",
  error_format: 'Error responses are JSON bodies of the shape { "error": { "type": string, "detail": string } }.',
  command: "Run `bun run e4:verify` to execute the acceptance test suite against a running server.",
  structural: "All persistent state access goes through src/db.ts; no module reads or writes state directly."
};

function applyModifyConvention(ir: E4SchemaIR, _minter: UidMinter, prng: E4Prng): E4OpResult {
  const next = cloneIr(ir);
  const convention = prng.pick(next.conventions);
  const alternate = ALTERNATE_STATEMENTS[convention.kind];

  convention.statement = convention.statement === alternate ? `${alternate} (revised)` : alternate;

  return {
    op_kind: "modify_convention",
    ir: next,
    opportunity_label: "drift_opportunity",
    touched_item_uids: [convention.semantic_item_uid],
    rename_lineage: [],
    render_context: { convention_id: convention.convention_id, kind: convention.kind }
  };
}

// ---- add_relationship ---------------------------------------------------------------------------

function relationshipCandidates(ir: E4SchemaIR): Array<{ from: E4Entity; to: E4Entity }> {
  const pairs: Array<{ from: E4Entity; to: E4Entity }> = [];

  for (const from of ir.entities) {
    for (const to of ir.entities) {
      if (from.name === to.name) {
        continue;
      }
      const alreadyLinked = from.fields.some((field) => field.type === "ref" && field.ref_entity === to.name);
      if (!alreadyLinked) {
        pairs.push({ from, to });
      }
    }
  }

  return pairs;
}

function isEligibleAddRelationship(ir: E4SchemaIR): boolean {
  return relationshipCandidates(ir).length > 0;
}

function applyAddRelationship(ir: E4SchemaIR, minter: UidMinter, prng: E4Prng): E4OpResult {
  const next = cloneIr(ir);
  const { from, to } = prng.pick(relationshipCandidates(next));
  const fromEntity = findEntity(next, from.name);
  const fieldUid = minter.mint("field");
  const fieldName = `${to.name.toLowerCase()}_id`;

  fromEntity.fields.push({ semantic_item_uid: fieldUid, name: fieldName, type: "ref", ref_entity: to.name, required: false });

  return {
    op_kind: "add_relationship",
    ir: next,
    opportunity_label: "additive",
    touched_item_uids: [fieldUid],
    rename_lineage: [],
    render_context: { from: from.name, to: to.name }
  };
}

// ---- noop_maintenance ---------------------------------------------------------------------------

function applyNoopMaintenance(ir: E4SchemaIR): E4OpResult {
  return {
    op_kind: "noop_maintenance",
    ir: cloneIr(ir),
    opportunity_label: "behavior_preserving",
    touched_item_uids: [],
    rename_lineage: [],
    render_context: {}
  };
}

// ---- registry -------------------------------------------------------------------------------

export type E4OpDefinition = {
  isEligible(ir: E4SchemaIR, state: E4SequenceState): boolean;
  apply(ir: E4SchemaIR, minter: UidMinter, prng: E4Prng, state: E4SequenceState): E4OpResult;
};

export const E4_OPS: Record<E4ChangeOpKind, E4OpDefinition> = {
  add_entity: { isEligible: isEligibleAddEntity, apply: applyAddEntity },
  delete_entity: { isEligible: isEligibleDeleteEntity, apply: applyDeleteEntity },
  rename_entity: { isEligible: (ir) => isEligibleRenameEntity(ir), apply: (ir, minter, prng, state) => applyRenameEntity(ir, minter, prng, state) },
  add_field: { isEligible: (ir) => isEligibleAddField(ir), apply: (ir, minter, prng) => applyAddField(ir, minter, prng) },
  rename_field: { isEligible: (ir) => isEligibleRenameField(ir), apply: (ir, minter, prng) => applyRenameField(ir, minter, prng) },
  retype_field: { isEligible: (ir) => isEligibleRetypeField(ir), apply: (ir, minter, prng) => applyRetypeField(ir, minter, prng) },
  delete_field: { isEligible: (ir) => isEligibleDeleteField(ir), apply: (ir, minter, prng) => applyDeleteField(ir, minter, prng) },
  add_endpoint: { isEligible: (ir) => isEligibleAddEndpoint(ir), apply: (ir, minter, prng) => applyAddEndpoint(ir, minter, prng) },
  modify_endpoint: { isEligible: (ir) => isEligibleModifyEndpoint(ir), apply: (ir, minter, prng) => applyModifyEndpoint(ir, minter, prng) },
  add_validation_rule: {
    isEligible: (ir) => isEligibleAddValidationRule(ir),
    apply: (ir, minter, prng) => applyAddValidationRule(ir, minter, prng)
  },
  modify_convention: { isEligible: (ir) => isEligibleModifyConvention(ir), apply: (ir, minter, prng) => applyModifyConvention(ir, minter, prng) },
  add_relationship: { isEligible: (ir) => isEligibleAddRelationship(ir), apply: (ir, minter, prng) => applyAddRelationship(ir, minter, prng) },
  noop_maintenance: { isEligible: () => true, apply: (ir) => applyNoopMaintenance(ir) }
};
