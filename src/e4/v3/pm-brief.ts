// E4 v3-M0 (E4V3-PRODUCT-LOOP-PROPOSAL.md §3 "PM brief"): the clarification channel's payload.
// A pure, deterministic function of the task's ground-truth delta that states the determined
// requirements detail a product manager would give when asked — exact fields, types,
// required-ness, operation surface, exact validation literals, the new convention statement.
//
// Boundaries (sealed by design, census-tested):
//   - describes ONLY the current task's delta (plus the minimum parent context a line needs);
//     never enumerates the wider surface, never mentions tests, oracles, specs, or scenarios.
//   - identical text for every arm by construction (pure function of the drawn task).
//   - `covered` reports which request-facts the text pins, using the ambiguity tagger's subject
//     strings — the v3-M0 census asserts every underdetermined fact is covered.
//
// Free-text Q&A was rejected at the proposal gate (determinism/parity); the brief is the whole
// channel.
import type { E4ChangeOpKind } from "../substrate/ops";
import type { E4EntityField, E4ValidationRule } from "../substrate/ir";
import type { E4TaskDelta } from "./task-delta";
import type { E4V3FactKind } from "./ambiguity";

export const E4_V3_PM_BRIEF_ID = "e4-pm-brief-v1";

export type E4V3BriefCoverage = { fact_kind: E4V3FactKind; subject: string };

export type E4V3PmBrief = {
  brief_id: typeof E4_V3_PM_BRIEF_ID;
  text: string;
  covered: E4V3BriefCoverage[];
};

function fieldTypeText(field: E4EntityField): string {
  switch (field.type) {
    case "ref":
      return `id of a ${field.ref_entity ?? "referenced entity"} (string)`;
    case "date":
      return "date (YYYY-MM-DD string)";
    case "decimal":
      return "decimal number";
    case "int":
      return "integer";
    case "bool":
      return "boolean";
    default:
      return field.type;
  }
}

function fieldLine(field: E4EntityField): string {
  return `${field.name} (${fieldTypeText(field)}, ${field.required ? "required" : "optional"})`;
}

function ruleDetailText(rule: E4ValidationRule): string {
  const detail = rule.detail as Record<string, unknown>;

  switch (rule.kind) {
    case "range":
      return `must be between ${String(detail.min)} and ${String(detail.max)} (inclusive)`;
    case "enum":
      return `must be one of: ${(detail.values as unknown[]).map(String).join(", ")}`;
    case "format":
      return `must match the pattern ${String(detail.pattern)}`;
    case "required":
      return "must be present";
    default:
      return JSON.stringify(detail);
  }
}

export function renderE4PmBrief(input: { opKind: E4ChangeOpKind; delta: E4TaskDelta }): E4V3PmBrief {
  const { opKind, delta } = input;
  const lines: string[] = [];
  const covered: E4V3BriefCoverage[] = [];
  const cover = (fact_kind: E4V3FactKind, subject: string) => covered.push({ fact_kind, subject });

  // Any brief names its targets precisely, so target identity is always pinned.
  cover("target_identity", opKind);

  for (const entity of delta.added_entities) {
    const endpoints = delta.added_endpoints
      .filter((endpoint) => endpoint.entity === entity.name)
      .map((endpoint) => `${endpoint.method} ${endpoint.path}${endpoint.kind === "list" ? " (list)" : ""}`);
    const rules = delta.added_rules.filter((rule) => rule.entity === entity.name);

    lines.push(
      `New entity ${entity.name} with exactly these fields: ${entity.fields.map(fieldLine).join("; ")}.`
    );
    lines.push(
      endpoints.length > 0
        ? `${entity.name} operations to provide: ${endpoints.join("; ")}.`
        : `${entity.name} needs no endpoints beyond what is stated elsewhere in this brief.`
    );

    for (const rule of rules) {
      lines.push(`Validation on ${entity.name}.${rule.field}: ${ruleDetailText(rule)}.`);
    }

    cover("entity_field_set", entity.name);
    cover("entity_operation_surface", entity.name);

    for (const field of entity.fields) {
      cover("field_type", `${entity.name}.${field.name}`);
      cover("field_required", `${entity.name}.${field.name}`);
    }
  }

  for (const entity of delta.removed_entities) {
    const endpoints = delta.removed_endpoints
      .filter((endpoint) => endpoint.entity === entity.name)
      .map((endpoint) => `${endpoint.method} ${endpoint.path}`);

    lines.push(
      `Remove ${entity.name} entirely: its fields, its validation rules, and its endpoints` +
        (endpoints.length > 0 ? ` (${endpoints.join("; ")})` : "") +
        ` all go away.`
    );
    cover("removal_scope", entity.name);
  }

  for (const rename of delta.renamed_entities) {
    const movedPaths = delta.changed_endpoints
      .filter((change) => change.entity === rename.new_name)
      .map((change) => `${change.new.method} ${change.new.path}`);

    lines.push(
      `Rename entity ${rename.old_name} to ${rename.new_name} everywhere` +
        (movedPaths.length > 0 ? `; endpoint paths follow the new name: ${movedPaths.join("; ")}` : "") +
        `.`
    );
    cover("rename_mapping", `${rename.old_name} -> ${rename.new_name}`);
  }

  for (const { entity, field } of delta.added_fields) {
    lines.push(`${entity} gains a field: ${fieldLine(field)}.`);

    if (field.type === "ref") {
      const filteredList = delta.added_endpoints.find(
        (endpoint) => endpoint.kind === "list" && endpoint.entity === entity
      );

      lines.push(
        `${entity}.${field.name} references a ${field.ref_entity}; the ${entity} list supports filtering by it` +
          (filteredList ? ` via ${filteredList.method} ${filteredList.path}` : ` via its query string`) +
          `.`
      );
      cover("relationship_field_shape", `${entity}.${field.name}`);
    }

    cover("field_type", `${entity}.${field.name}`);
    cover("field_required", `${entity}.${field.name}`);
  }

  for (const { entity, field } of delta.removed_fields) {
    lines.push(`Remove the field ${entity}.${field.name}; it is no longer accepted or returned.`);
    cover("removal_scope", `${entity}.${field.name}`);
  }

  for (const rename of delta.renamed_fields) {
    lines.push(`Rename ${rename.entity}.${rename.old_name} to ${rename.new_name}; same meaning, new name.`);
    cover("rename_mapping", `${rename.entity}.${rename.old_name} -> ${rename.new_name}`);
  }

  for (const retype of delta.retyped_fields) {
    lines.push(
      `Change ${retype.entity}.${retype.field_name} from ${retype.old_type} to ${retype.new_type}.`
    );
    cover("field_type", `${retype.entity}.${retype.field_name}`);
  }

  for (const endpoint of delta.added_endpoints) {
    const parentAdded = delta.added_entities.some((entity) => entity.name === endpoint.entity);

    if (parentAdded) {
      continue; // rendered with its entity above
    }

    if (endpoint.kind === "analytics") {
      lines.push(
        `New endpoint ${endpoint.method} ${endpoint.path}: returns summary counts over ${endpoint.entity} records.`
      );
      cover("analytics_endpoint_shape", `${endpoint.method} ${endpoint.path}`);
    } else if (endpoint.kind === "list") {
      lines.push(`New endpoint ${endpoint.method} ${endpoint.path} listing ${endpoint.entity} records.`);
      cover("relationship_field_shape", `${endpoint.method} ${endpoint.path}`);
    } else {
      lines.push(`New endpoint ${endpoint.method} ${endpoint.path} (${endpoint.kind}) for ${endpoint.entity}.`);
    }
  }

  for (const endpoint of delta.removed_endpoints) {
    const parentRemoved = delta.removed_entities.some((entity) => entity.name === endpoint.entity);

    if (!parentRemoved) {
      lines.push(`Retire the endpoint ${endpoint.method} ${endpoint.path}.`);
      cover("removal_scope", `${endpoint.method} ${endpoint.path}`);
    }
  }

  for (const change of delta.changed_endpoints) {
    if (change.old.method !== change.new.method) {
      lines.push(
        `The ${change.entity} ${change.kind} operation becomes ${change.new.method} ${change.new.path}` +
          (change.new.method === "PATCH" ? ` (partial update: only the provided fields change)` : ``) +
          `.`
      );
    } else if (!delta.renamed_entities.some((rename) => rename.new_name === change.entity)) {
      lines.push(`The ${change.entity} ${change.kind} endpoint moves to ${change.new.method} ${change.new.path}.`);
    } else {
      continue; // path move already stated with the rename line
    }

    cover("endpoint_method_form", `${change.entity}:${change.kind}`);
  }

  for (const rule of delta.added_rules) {
    if (delta.added_entities.some((entity) => entity.name === rule.entity)) {
      continue; // rendered with its entity above
    }

    lines.push(
      `New validation on ${rule.entity}.${rule.field}: ${ruleDetailText(rule)}. Reject violations with the API's standard error response.`
    );
    cover("validation_rule_detail", `${rule.entity}.${rule.field}:${rule.kind}`);
  }

  for (const rule of delta.removed_rules) {
    if (delta.removed_entities.some((entity) => entity.name === rule.entity)) {
      continue;
    }

    lines.push(`Drop the ${rule.kind} validation on ${rule.entity}.${rule.field}.`);
    cover("removal_scope", `${rule.entity}.${rule.field}:${rule.kind}`);
  }

  for (const convention of delta.changed_conventions) {
    lines.push(
      `The API-wide convention "${convention.convention_id}" changes. The new rule, verbatim: ${convention.new_statement}`
    );
    cover("convention_statement", convention.convention_id);
  }

  if (delta.is_empty) {
    lines.push(`No functional change is requested for this task.`);
    cover("no_change", "sequence-maintenance");
  }

  const text = [
    `PM BRIEF (requested clarification — precise requirements for the current task)`,
    ...lines.map((line) => `- ${line}`),
    `Nothing beyond the above is being asked; no other behavior should change.`
  ].join("\n");

  return { brief_id: E4_V3_PM_BRIEF_ID, text, covered };
}
