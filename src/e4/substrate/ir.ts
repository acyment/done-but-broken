// Typed schema IR (architecture §2.1/§4; IMPLEMENTATION-PLAN.md M1). The IR after each op is the
// harness's private per-turn ground truth — never mounted into an agent workspace. Every item kind
// carries a stable semantic_item_uid ([R2: R2-1]) that survives renames; a true delete-then-recreate
// allocates a fresh one.
export type E4FieldType = "string" | "int" | "decimal" | "bool" | "date" | "ref";

export type E4EntityField = {
  semantic_item_uid: string;
  name: string;
  type: E4FieldType;
  ref_entity?: string; // entity name this field references, when type === "ref"
  required: boolean;
};

export type E4Entity = {
  semantic_item_uid: string;
  name: string;
  fields: E4EntityField[];
};

export type E4EndpointMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// "list" implicitly supports query-string filtering on any ref field (folded in, not a separate
// route — two registered routes for the same method+path would be unreachable/ambiguous, and
// documenting them as two spec operations while the registry has one would break T0's in-sync
// invariant before any agent touches anything).
export type E4EndpointKind = "create" | "read" | "update" | "delete" | "list" | "analytics";

export type E4Endpoint = {
  semantic_item_uid: string;
  entity: string; // entity name this endpoint operates on
  kind: E4EndpointKind;
  method: E4EndpointMethod;
  path: string; // e.g. "/widgets/{id}"
};

export type E4ValidationRuleKind = "required" | "range" | "enum" | "format";

export type E4ValidationRule = {
  semantic_item_uid: string;
  entity: string;
  field: string;
  kind: E4ValidationRuleKind;
  detail: Record<string, unknown>; // e.g. { min, max } for range, { values } for enum, { pattern } for format
};

export type E4ConventionKind = "naming" | "error_format" | "command" | "structural";

export type E4Convention = {
  semantic_item_uid: string;
  convention_id: string; // stable rendered id, ADR-004 grammar — e.g. "error-format"
  kind: E4ConventionKind;
  statement: string; // the normative statement text
};

export type E4SchemaIR = {
  entities: E4Entity[];
  endpoints: E4Endpoint[];
  validation_rules: E4ValidationRule[];
  conventions: E4Convention[];
};

// Canonical rendered identity strings — what a rename-lineage entry's old/new item_id looks like.
// Entity/field/endpoint identity strings are name/path-derived (they change on rename); UIDs never do.
export function renderEntityItemId(entityName: string): string {
  return `entity:${entityName}`;
}

export function renderFieldItemId(entityName: string, fieldName: string): string {
  return `field:${entityName}.${fieldName}`;
}

// Identity is (entity, kind) — NOT path, and NOT method+path. A REST resource has at most one
// "update" (etc.) operation per entity in this substrate, so (entity, kind) is unambiguous; method
// AND path are both comparable ATTRIBUTES. This is what lets a method change (e.g. PUT -> PATCH on
// Widget's update endpoint) surface as a single contradiction rather than a stale-claim/coverage-gap
// pair (architecture §6 Feature 2's "an endpoint contradiction (method mismatch)" fixture cell) —
// path-only or method+path identity would either collapse distinct same-path operations (GET/PUT/
// DELETE /widgets/{id}) into one item, or treat every method change as a fake identity change.
export function renderEndpointItemId(entityName: string, kind: E4EndpointKind): string {
  return `endpoint:${entityName}:${kind}`;
}

export function renderValidationRuleItemId(entityName: string, fieldName: string, kind: E4ValidationRuleKind): string {
  return `rule:${entityName}.${fieldName}.${kind}`;
}

export function renderConventionItemId(conventionId: string): string {
  return `convention:${conventionId}`;
}

export function cloneIr(ir: E4SchemaIR): E4SchemaIR {
  return {
    entities: ir.entities.map((entity) => ({ ...entity, fields: entity.fields.map((field) => ({ ...field })) })),
    endpoints: ir.endpoints.map((endpoint) => ({ ...endpoint })),
    validation_rules: ir.validation_rules.map((rule) => ({ ...rule, detail: { ...rule.detail } })),
    conventions: ir.conventions.map((convention) => ({ ...convention }))
  };
}

// Deterministic identity minting: given a fixed seed, the op sequence draw is deterministic, so a
// simple monotonic counter mints the same UIDs in the same order every time — no Math.random,
// no clock, no process-specific state.
export function createUidMinter(startingAt = 1): { mint(kind: string): string } {
  let counter = startingAt;

  return {
    mint(kind: string): string {
      const uid = `uid-task-${kind}-${counter}`;
      counter += 1;
      return uid;
    }
  };
}

// The T0 baseline is FIXED (not seed-dependent) — only the task sequence drawn atop it varies by
// substrate_seed. This keeps a stable "known surface" that the M2 known-drift fixture and the
// difficulty diagnostics (R2-10) can reason about independent of seed.
export function buildBaselineIr(): E4SchemaIR {
  return {
    entities: [
      {
        semantic_item_uid: "uid-base-entity-category",
        name: "Category",
        fields: [
          { semantic_item_uid: "uid-base-field-category-id", name: "id", type: "string", required: true },
          { semantic_item_uid: "uid-base-field-category-name", name: "name", type: "string", required: true }
        ]
      },
      {
        semantic_item_uid: "uid-base-entity-widget",
        name: "Widget",
        fields: [
          { semantic_item_uid: "uid-base-field-widget-id", name: "id", type: "string", required: true },
          { semantic_item_uid: "uid-base-field-widget-name", name: "name", type: "string", required: true },
          { semantic_item_uid: "uid-base-field-widget-price", name: "price", type: "decimal", required: true },
          { semantic_item_uid: "uid-base-field-widget-in-stock", name: "in_stock", type: "bool", required: true },
          {
            semantic_item_uid: "uid-base-field-widget-category-id",
            name: "category_id",
            type: "ref",
            ref_entity: "Category",
            required: true
          }
        ]
      }
    ],
    endpoints: [
      { semantic_item_uid: "uid-base-endpoint-category-create", entity: "Category", kind: "create", method: "POST", path: "/categories" },
      { semantic_item_uid: "uid-base-endpoint-category-read", entity: "Category", kind: "read", method: "GET", path: "/categories/{id}" },
      { semantic_item_uid: "uid-base-endpoint-category-update", entity: "Category", kind: "update", method: "PUT", path: "/categories/{id}" },
      { semantic_item_uid: "uid-base-endpoint-category-delete", entity: "Category", kind: "delete", method: "DELETE", path: "/categories/{id}" },
      { semantic_item_uid: "uid-base-endpoint-category-list", entity: "Category", kind: "list", method: "GET", path: "/categories" },
      { semantic_item_uid: "uid-base-endpoint-widget-create", entity: "Widget", kind: "create", method: "POST", path: "/widgets" },
      { semantic_item_uid: "uid-base-endpoint-widget-read", entity: "Widget", kind: "read", method: "GET", path: "/widgets/{id}" },
      { semantic_item_uid: "uid-base-endpoint-widget-update", entity: "Widget", kind: "update", method: "PUT", path: "/widgets/{id}" },
      { semantic_item_uid: "uid-base-endpoint-widget-delete", entity: "Widget", kind: "delete", method: "DELETE", path: "/widgets/{id}" },
      { semantic_item_uid: "uid-base-endpoint-widget-list", entity: "Widget", kind: "list", method: "GET", path: "/widgets" },
      { semantic_item_uid: "uid-base-endpoint-widget-stats", entity: "Widget", kind: "analytics", method: "GET", path: "/widgets/stats" }
    ],
    // Required-ness lives on the field itself (field.required) — never duplicated as a
    // validation_rule kind, since OpenAPI's `required` array is the one place that concept can
    // be expressed; a separate "required" rule here would either mirror it exactly (redundant) or
    // drift from it (unrepresentable, since there's no second required-ness keyword to hold it).
    validation_rules: [
      {
        semantic_item_uid: "uid-base-rule-widget-price-range",
        entity: "Widget",
        field: "price",
        kind: "range",
        detail: { min: 0 }
      }
    ],
    conventions: [
      {
        semantic_item_uid: "uid-base-convention-naming",
        convention_id: "naming-endpoints",
        kind: "naming",
        statement: "Endpoint paths use lowercase plural nouns (e.g. /widgets, /categories)."
      },
      {
        semantic_item_uid: "uid-base-convention-error-format",
        convention_id: "error-format",
        kind: "error_format",
        statement: 'Error responses are JSON bodies of the shape { "error": { "code": string, "message": string } }.'
      },
      {
        semantic_item_uid: "uid-base-convention-command",
        convention_id: "cmd-test",
        kind: "command",
        statement: "Run `bun run spec` to execute the acceptance test suite against a running server."
      },
      {
        semantic_item_uid: "uid-base-convention-structural",
        convention_id: "structural-storage",
        kind: "structural",
        statement: "All persistent state access goes through src/storage.ts; no module reads or writes state directly."
      }
    ]
  };
}
