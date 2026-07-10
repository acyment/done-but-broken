// E4 v3-M0 (E4V3-PRODUCT-LOOP-PROPOSAL.md §3/§5): pure IR delta between two ground-truth
// snapshots, keyed on semantic_item_uid. Consumed by the ambiguity tagger and the PM brief
// renderer. Harness-side only — the pre/post IRs are the generator's private ground truth and
// none of this module's inputs or outputs ever enters an agent workspace directly (the PM brief
// text, rendered separately, is the only agent-visible derivative).
//
// v2 substrate modules are hash-pinned (code twins); this module only imports their types and
// never edits them.
import type {
  E4Entity,
  E4EntityField,
  E4Endpoint,
  E4SchemaIR,
  E4ValidationRule
} from "../substrate/ir";

export type E4V3RenamedEntity = { semantic_item_uid: string; old_name: string; new_name: string };
export type E4V3FieldWithEntity = { entity: string; field: E4EntityField };
export type E4V3RenamedField = {
  entity: string;
  semantic_item_uid: string;
  old_name: string;
  new_name: string;
};
export type E4V3RetypedField = {
  entity: string;
  field_name: string;
  semantic_item_uid: string;
  old_type: E4EntityField["type"];
  new_type: E4EntityField["type"];
};
export type E4V3ChangedEndpoint = {
  semantic_item_uid: string;
  entity: string;
  kind: E4Endpoint["kind"];
  old: { method: E4Endpoint["method"]; path: string };
  new: { method: E4Endpoint["method"]; path: string };
};
export type E4V3ChangedConvention = {
  semantic_item_uid: string;
  convention_id: string;
  kind: string;
  old_statement: string;
  new_statement: string;
};

export type E4TaskDelta = {
  added_entities: E4Entity[];
  removed_entities: E4Entity[];
  renamed_entities: E4V3RenamedEntity[];
  // Field-level diffs cover only entities present in BOTH snapshots — an added/removed entity's
  // fields are part of that entity fact, never double-counted here.
  added_fields: E4V3FieldWithEntity[];
  removed_fields: E4V3FieldWithEntity[];
  renamed_fields: E4V3RenamedField[];
  retyped_fields: E4V3RetypedField[];
  added_endpoints: E4Endpoint[];
  removed_endpoints: E4Endpoint[];
  changed_endpoints: E4V3ChangedEndpoint[];
  added_rules: E4ValidationRule[];
  removed_rules: E4ValidationRule[];
  changed_conventions: E4V3ChangedConvention[];
  is_empty: boolean;
};

function byUid<T extends { semantic_item_uid: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.semantic_item_uid, item]));
}

export function computeE4TaskDelta(preIr: E4SchemaIR, postIr: E4SchemaIR): E4TaskDelta {
  const preEntities = byUid(preIr.entities);
  const postEntities = byUid(postIr.entities);

  const added_entities = postIr.entities.filter((e) => !preEntities.has(e.semantic_item_uid));
  const removed_entities = preIr.entities.filter((e) => !postEntities.has(e.semantic_item_uid));
  const renamed_entities: E4V3RenamedEntity[] = [];

  const added_fields: E4V3FieldWithEntity[] = [];
  const removed_fields: E4V3FieldWithEntity[] = [];
  const renamed_fields: E4V3RenamedField[] = [];
  const retyped_fields: E4V3RetypedField[] = [];

  for (const post of postIr.entities) {
    const pre = preEntities.get(post.semantic_item_uid);

    if (!pre) {
      continue;
    }

    if (pre.name !== post.name) {
      renamed_entities.push({
        semantic_item_uid: post.semantic_item_uid,
        old_name: pre.name,
        new_name: post.name
      });
    }

    const preFields = byUid(pre.fields);
    const postFields = byUid(post.fields);

    for (const field of post.fields) {
      const preField = preFields.get(field.semantic_item_uid);

      if (!preField) {
        added_fields.push({ entity: post.name, field });
        continue;
      }

      if (preField.name !== field.name) {
        renamed_fields.push({
          entity: post.name,
          semantic_item_uid: field.semantic_item_uid,
          old_name: preField.name,
          new_name: field.name
        });
      }

      if (preField.type !== field.type) {
        retyped_fields.push({
          entity: post.name,
          field_name: field.name,
          semantic_item_uid: field.semantic_item_uid,
          old_type: preField.type,
          new_type: field.type
        });
      }
    }

    for (const preField of pre.fields) {
      if (!postFields.has(preField.semantic_item_uid)) {
        removed_fields.push({ entity: post.name, field: preField });
      }
    }
  }

  const preEndpoints = byUid(preIr.endpoints);
  const postEndpoints = byUid(postIr.endpoints);
  const added_endpoints = postIr.endpoints.filter((e) => !preEndpoints.has(e.semantic_item_uid));
  const removed_endpoints = preIr.endpoints.filter((e) => !postEndpoints.has(e.semantic_item_uid));
  const changed_endpoints: E4V3ChangedEndpoint[] = [];

  for (const post of postIr.endpoints) {
    const pre = preEndpoints.get(post.semantic_item_uid);

    if (pre && (pre.method !== post.method || pre.path !== post.path)) {
      changed_endpoints.push({
        semantic_item_uid: post.semantic_item_uid,
        entity: post.entity,
        kind: post.kind,
        old: { method: pre.method, path: pre.path },
        new: { method: post.method, path: post.path }
      });
    }
  }

  const preRules = byUid(preIr.validation_rules);
  const postRules = byUid(postIr.validation_rules);
  const added_rules = postIr.validation_rules.filter((r) => !preRules.has(r.semantic_item_uid));
  const removed_rules = preIr.validation_rules.filter((r) => !postRules.has(r.semantic_item_uid));

  const preConventions = byUid(preIr.conventions);
  const changed_conventions: E4V3ChangedConvention[] = [];

  for (const post of postIr.conventions) {
    const pre = preConventions.get(post.semantic_item_uid);

    if (pre && pre.statement !== post.statement) {
      changed_conventions.push({
        semantic_item_uid: post.semantic_item_uid,
        convention_id: post.convention_id,
        kind: post.kind,
        old_statement: pre.statement,
        new_statement: post.statement
      });
    }
  }

  const is_empty =
    added_entities.length === 0 &&
    removed_entities.length === 0 &&
    renamed_entities.length === 0 &&
    added_fields.length === 0 &&
    removed_fields.length === 0 &&
    renamed_fields.length === 0 &&
    retyped_fields.length === 0 &&
    added_endpoints.length === 0 &&
    removed_endpoints.length === 0 &&
    changed_endpoints.length === 0 &&
    added_rules.length === 0 &&
    removed_rules.length === 0 &&
    changed_conventions.length === 0;

  return {
    added_entities,
    removed_entities,
    renamed_entities,
    added_fields,
    removed_fields,
    renamed_fields,
    retyped_fields,
    added_endpoints,
    removed_endpoints,
    changed_endpoints,
    added_rules,
    removed_rules,
    changed_conventions,
    is_empty
  };
}
