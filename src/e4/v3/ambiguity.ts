// E4 v3-M0 (E4V3-PRODUCT-LOOP-PROPOSAL.md §3 "ambiguity tagging"): tags which facts of a task's
// ground-truth delta the rendered NL request pins (determined) vs leaves open (underdetermined).
//
// Motivating diagnostics (M8, no claim weight): "Tighten up what counts as a valid details on
// Widget." never states the sealed pattern; "Product wants a Promotion list added…" never states
// fields or operation surface. The tagger makes that structure explicit so (a) the PM brief can
// be census-verified to cover every underdetermined fact, and (b) reports can split drift by
// request-determinacy channel.
//
// Facts are derived FROM the actual delta (never from op-kind priors alone); determinacy comes
// from the sealed table below plus the renderer's own verbatim flag for target identity. Unknown
// (op, fact) combinations default to underdetermined — fail-open toward "the brief must cover
// it", never toward silently calling something determined.
import type { E4ChangeOpKind } from "../substrate/ops";
import type { E4TaskDelta } from "./task-delta";

// v2 (E5 P0-V item 2): rename_entity gains a fixture_migration fact (stored-id policy — the M7
// id-migration mirror trap; the brief now answers it), and modify_endpoint's
// endpoint_method_form drops to underdetermined — after the phrasing-pool correction the pool
// no longer uniformly states PATCH semantics, and the table's own rule ("determined only when
// every variant states it") forces the honest entry. The brief covers both facts.
export const E4_V3_DETERMINACY_TABLE_ID = "e4-request-determinacy-v2";

export type E4V3FactKind =
  | "target_identity" // WHICH item the request is about
  | "entity_field_set" // which fields a new entity carries
  | "entity_operation_surface" // which endpoints a new entity gets
  | "field_type"
  | "field_required"
  | "validation_rule_detail" // exact rule kind + literals (pattern/range/enum)
  | "convention_statement" // the new normative statement text
  | "endpoint_method_form" // e.g. update becomes PATCH partial-update
  | "analytics_endpoint_shape" // path + response shape of a summary endpoint
  | "relationship_field_shape" // ref-field name/required/list-filter behavior
  | "removal_scope" // what a delete removes
  | "rename_mapping" // old name -> new name
  | "fixture_migration" // §5.7.4: what happens to EXISTING stored records under this change
  | "no_change";

export type E4V3Determinacy = "determined" | "underdetermined";

export type E4V3RequestFact = {
  fact_kind: E4V3FactKind;
  subject: string; // human-readable anchor, e.g. "Promotion", "Widget.details"
  determinacy: E4V3Determinacy;
};

// Sealed determinacy of CONTENT facts per op kind, judged against the sealed phrasing pools
// (substrate/render.ts): a fact is "determined" only when every variant of the pool states it
// or it follows from the named item plus the workspace's visible conventions. target_identity
// is never in this table — it comes from the rendered variant's names_item_verbatim flag.
const CONTENT_DETERMINACY: Partial<Record<E4ChangeOpKind, Partial<Record<E4V3FactKind, E4V3Determinacy>>>> = {
  add_entity: {
    entity_field_set: "underdetermined", // no variant names fields
    entity_operation_surface: "underdetermined", // "a Promotion list" does not pin full CRUD
    field_required: "underdetermined",
    field_type: "underdetermined",
    validation_rule_detail: "underdetermined",
    fixture_migration: "underdetermined" // whether the new entity ships with data is never stated
  },
  delete_entity: {
    removal_scope: "determined" // "remove it from the product entirely"
  },
  rename_entity: {
    rename_mapping: "determined", // both variants state old and new names
    fixture_migration: "underdetermined" // whether stored ids/values move is never stated (P0-V)
  },
  add_field: {
    field_type: "underdetermined",
    field_required: "underdetermined",
    fixture_migration: "underdetermined" // requests never state what existing records get
  },
  rename_field: {
    rename_mapping: "determined"
  },
  retype_field: {
    field_type: "underdetermined", // "a wider range of values" pins direction, not the type
    fixture_migration: "underdetermined" // representation-changing conversions are never stated
  },
  delete_field: {
    removal_scope: "determined"
  },
  add_endpoint: {
    analytics_endpoint_shape: "underdetermined" // "a quick summary view" pins nothing concrete
  },
  modify_endpoint: {
    endpoint_method_form: "underdetermined" // post-P0-V pool no longer uniformly states the form
  },
  add_validation_rule: {
    validation_rule_detail: "underdetermined" // "tighten up what counts as valid" pins no literal
  },
  modify_convention: {
    convention_statement: "underdetermined" // "a convention changed" names neither which nor how
  },
  add_relationship: {
    relationship_field_shape: "underdetermined", // field name/required/filterability unstated
    field_required: "underdetermined",
    field_type: "determined", // "linkable to a <Entity>" pins a reference
    fixture_migration: "underdetermined" // how existing rows get linked is never stated
  },
  noop_maintenance: {
    no_change: "determined"
  }
};

function contentDeterminacy(opKind: E4ChangeOpKind, factKind: E4V3FactKind): E4V3Determinacy {
  return CONTENT_DETERMINACY[opKind]?.[factKind] ?? "underdetermined";
}

export function tagE4RequestDeterminacy(input: {
  opKind: E4ChangeOpKind;
  namesItemVerbatim: boolean;
  delta: E4TaskDelta;
}): E4V3RequestFact[] {
  const { opKind, namesItemVerbatim, delta } = input;
  const facts: E4V3RequestFact[] = [];
  const add = (fact_kind: E4V3FactKind, subject: string) =>
    facts.push({ fact_kind, subject, determinacy: contentDeterminacy(opKind, fact_kind) });

  facts.push({
    fact_kind: "target_identity",
    subject: opKind,
    determinacy: namesItemVerbatim ? "determined" : "underdetermined"
  });

  for (const entity of delta.added_entities) {
    add("entity_field_set", entity.name);
    add("entity_operation_surface", entity.name);
    // §5.7 + v3-M7 pre-seal rung: gold's new entities start EMPTY; both live arms invented seed
    // rows and pinned scenarios on them — a residual-ambiguity fact the brief must cover.
    add("fixture_migration", entity.name);
    for (const field of entity.fields) {
      add("field_type", `${entity.name}.${field.name}`);
      add("field_required", `${entity.name}.${field.name}`);
    }
  }

  for (const entity of delta.removed_entities) {
    add("removal_scope", entity.name);
  }

  for (const rename of delta.renamed_entities) {
    add("rename_mapping", `${rename.old_name} -> ${rename.new_name}`);
    // P0-V: what happens to stored ids/values under the rename (gold keeps them) is a fact the
    // request never pins — the M7 id-migration mirror trap, now brief-answerable.
    add("fixture_migration", `${rename.old_name} -> ${rename.new_name}`);
  }

  for (const { entity, field } of delta.added_fields) {
    if (field.type === "ref") {
      add("relationship_field_shape", `${entity}.${field.name}`);
    }
    add("field_type", `${entity}.${field.name}`);
    add("field_required", `${entity}.${field.name}`);
    // §5.7.4: existing rows must gain the field somehow; the request never says how.
    add("fixture_migration", `${entity}.${field.name}`);
  }

  for (const { entity, field } of delta.removed_fields) {
    add("removal_scope", `${entity}.${field.name}`);
  }

  for (const rename of delta.renamed_fields) {
    add("rename_mapping", `${rename.entity}.${rename.old_name} -> ${rename.new_name}`);
  }

  for (const retype of delta.retyped_fields) {
    add("field_type", `${retype.entity}.${retype.field_name}`);

    if (retypeChangesStoredRepresentation(retype.old_type, retype.new_type)) {
      add("fixture_migration", `${retype.entity}.${retype.field_name}`);
    }
  }

  for (const endpoint of delta.added_endpoints) {
    // Endpoints minted as part of an added entity are that entity's operation-surface fact;
    // standalone additions (analytics) are their own shape fact.
    const parentAdded = delta.added_entities.some((e) => e.name === endpoint.entity);

    if (!parentAdded && endpoint.kind === "analytics") {
      add("analytics_endpoint_shape", `${endpoint.method} ${endpoint.path}`);
    } else if (!parentAdded && endpoint.kind === "list") {
      // filtered-list surface minted by add_relationship
      add("relationship_field_shape", `${endpoint.method} ${endpoint.path}`);
    }
  }

  for (const endpoint of delta.removed_endpoints) {
    const parentRemoved = delta.removed_entities.some((e) => e.name === endpoint.entity);

    if (!parentRemoved) {
      add("removal_scope", `${endpoint.method} ${endpoint.path}`);
    }
  }

  for (const change of delta.changed_endpoints) {
    const parentRenamed = delta.renamed_entities.some((r) => r.new_name === change.entity);

    if (change.old.method !== change.new.method) {
      add("endpoint_method_form", `${change.entity}:${change.kind}`);
    } else if (!parentRenamed) {
      // path change not explained by an entity rename in the same delta
      add("endpoint_method_form", `${change.entity}:${change.kind}`);
    }
  }

  for (const rule of delta.added_rules) {
    const parentAdded = delta.added_entities.some((e) => e.name === rule.entity);

    if (!parentAdded) {
      add("validation_rule_detail", `${rule.entity}.${rule.field}:${rule.kind}`);
    }
  }

  for (const rule of delta.removed_rules) {
    const parentRemoved = delta.removed_entities.some((e) => e.name === rule.entity);

    if (!parentRemoved) {
      add("removal_scope", `${rule.entity}.${rule.field}:${rule.kind}`);
    }
  }

  for (const convention of delta.changed_conventions) {
    add("convention_statement", convention.convention_id);
  }

  if (delta.is_empty) {
    add("no_change", "sequence-maintenance");
  }

  return facts;
}

// §5.7.2 sealed conversion table: these directions change what a stored value looks like, so
// the PM brief must state the outcome (int→decimal and date→string are JSON-identity).
export function retypeChangesStoredRepresentation(
  oldType: E4TaskDelta["retyped_fields"][number]["old_type"],
  newType: E4TaskDelta["retyped_fields"][number]["new_type"]
): boolean {
  return (
    (oldType === "decimal" && newType === "int") ||
    (oldType === "string" && newType === "date") ||
    (oldType === "bool" && newType === "string")
  );
}

export function underdeterminedFacts(facts: E4V3RequestFact[]): E4V3RequestFact[] {
  return facts.filter((fact) => fact.determinacy === "underdetermined");
}
