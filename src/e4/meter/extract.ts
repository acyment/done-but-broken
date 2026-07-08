// Inventory extraction (architecture §2.4/§4 ADR-001/ADR-004; IMPLEMENTATION-PLAN.md M2). Three
// sources, three extractors: agent-maintained spec artifacts, the code's observable surface
// (ADR-001 registry dump), and the harness-private ground-truth IR. Never a crash — malformed
// input is recorded (`spec_unparseable` / `extraction_failed`), never thrown past this module.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  renderConventionItemId,
  renderEndpointItemId,
  renderEntityItemId,
  renderFieldItemId,
  renderValidationRuleItemId,
  type E4EndpointKind,
  type E4SchemaIR
} from "../substrate/ir";
import type { E4InventoryItem, E4SurfaceDump, E4SurfaceDumpResult, E4TruthInventoryItem } from "./types";

// ADR-004 grammar: `- \`<convention-id>\`: <statement>`. Free prose around bullets is permitted
// and unmetered — only lines matching this exact grammar are extracted.
export function parseConventionsBullets(markdown: string): Array<{ id: string; statement: string }> {
  return [...markdown.matchAll(/^- `([^`]+)`: (.+)$/gm)].map((match) => ({ id: match[1], statement: match[2].trim() }));
}

// Reads the x-e4-entity/x-e4-kind vendor extensions scaffold.ts stamps on every operation — the
// meter's real identity key. operationId/tags are for humans/tooling, not a safe machine-parse
// target (an agent could reasonably rephrase either without meaning to change anything).
function operationIdentity(operation: Record<string, unknown>): { entity: string; kind: string } | null {
  const entity = operation["x-e4-entity"];
  const kind = operation["x-e4-kind"];
  return typeof entity === "string" && typeof kind === "string" ? { entity, kind } : null;
}

function openApiPropertyToFieldDetail(property: Record<string, unknown>): { type: string; ref_entity: string | null } {
  if (typeof property.$ref === "string") {
    const refEntity = property.$ref.replace("#/components/schemas/", "");
    return { type: "ref", ref_entity: refEntity };
  }

  if (property.type === "string" && property.format === "date") {
    return { type: "date", ref_entity: null };
  }

  const mapping: Record<string, string> = { string: "string", integer: "int", number: "decimal", boolean: "bool" };
  return { type: mapping[property.type as string] ?? String(property.type), ref_entity: null };
}

function validationRuleItemsFromProperty(
  entityName: string,
  fieldName: string,
  property: Record<string, unknown>
): E4InventoryItem[] {
  const items: E4InventoryItem[] = [];

  if (property.minimum !== undefined || property.maximum !== undefined) {
    items.push({
      kind: "validation_rule",
      item_id: renderValidationRuleItemId(entityName, fieldName, "range"),
      detail: { min: property.minimum, max: property.maximum }
    });
  }
  if (property.enum !== undefined) {
    items.push({
      kind: "validation_rule",
      item_id: renderValidationRuleItemId(entityName, fieldName, "enum"),
      detail: { values: property.enum }
    });
  }
  if (property.pattern !== undefined) {
    items.push({
      kind: "validation_rule",
      item_id: renderValidationRuleItemId(entityName, fieldName, "format"),
      detail: { pattern: property.pattern }
    });
  }

  return items;
}

// Parses specs/openapi.json + specs/CONVENTIONS.md into the spec-side inventory. Malformed JSON
// never throws — it's recorded as spec_unparseable (ADR-004: "never a crash, never silently
// skipped"), which the classifier turns into an explicit meter outcome, not a stale zero-diff.
export function parseSpecInventory(specArtifacts: {
  openapi_json: string;
  conventions_md: string;
}): E4InventoryItem[] | { spec_unparseable: true } {
  let openapi: { paths?: Record<string, Record<string, unknown>>; components?: { schemas?: Record<string, unknown> } };

  try {
    openapi = JSON.parse(specArtifacts.openapi_json);
  } catch {
    return { spec_unparseable: true };
  }

  const items: E4InventoryItem[] = [];

  for (const [path, methods] of Object.entries(openapi.paths ?? {})) {
    for (const [method, operation] of Object.entries(methods)) {
      const identity = operationIdentity(operation as Record<string, unknown>);
      if (!identity) {
        // No way to recover (entity, kind) for this operation — skip rather than guess; this
        // operation simply isn't compared this run (extremely unlikely: T0 always ships the
        // vendor-extension identity, and an agent editing existing operations has no reason to
        // strip them).
        continue;
      }
      items.push({
        kind: "endpoint",
        item_id: renderEndpointItemId(identity.entity, identity.kind as E4EndpointKind),
        detail: { method: method.toUpperCase(), path }
      });
    }
  }

  for (const [entityName, schema] of Object.entries(openapi.components?.schemas ?? {})) {
    items.push({ kind: "entity", item_id: renderEntityItemId(entityName), detail: {} });

    const schemaRecord = schema as { properties?: Record<string, Record<string, unknown>>; required?: string[] };
    const required = new Set(schemaRecord.required ?? []);

    for (const [fieldName, property] of Object.entries(schemaRecord.properties ?? {})) {
      // Required-ness is a field-level comparison only (ir.ts's buildBaselineIr comment): it
      // never gets its own validation_rule item, spec-side or truth-side.
      items.push({
        kind: "field",
        item_id: renderFieldItemId(entityName, fieldName),
        detail: { ...openApiPropertyToFieldDetail(property), required: required.has(fieldName) }
      });
      items.push(...validationRuleItemsFromProperty(entityName, fieldName, property));
    }
  }

  for (const bullet of parseConventionsBullets(specArtifacts.conventions_md)) {
    items.push({ kind: "convention", item_id: renderConventionItemId(bullet.id), detail: { statement: bullet.statement } });
  }

  return items;
}

// Dynamic import() caches by resolved file path — Bun (unlike Node) ignores a query-string
// cache-buster on the same path, so re-extracting the SAME workspace after the agent edits
// registry.ts/schema.ts (the normal case: this runs once per task, same directory every time)
// would silently return the PREVIOUS task's stale module. Importing a fresh-content copy under a
// unique temp path sidesteps the cache entirely.
async function importFreshModule(sourcePath: string): Promise<Record<string, unknown>> {
  const content = await readFile(sourcePath, "utf8");
  const scratchDir = await mkdtemp(join(tmpdir(), "e4-meter-import-"));
  const scratchPath = join(scratchDir, "module.ts");

  try {
    await writeFile(scratchPath, content);
    return (await import(pathToFileURL(scratchPath).href)) as Record<string, unknown>;
  } finally {
    await rm(scratchDir, { recursive: true, force: true });
  }
}

// ADR-001: the registry IS the code-side inventory source. Dynamic-imports registry.ts/schema.ts
// straight out of the workspace; a broken export (agent dismantled the registry convention) fails
// closed — extraction_failed, never a crash, never a silent zero-discrepancy result.
export async function extractSurfaceDump(workspaceDir: string): Promise<E4SurfaceDumpResult> {
  try {
    const registryModule = (await importFreshModule(join(workspaceDir, "registry.ts"))) as { routeRegistry?: unknown };
    const schemaModule = (await importFreshModule(join(workspaceDir, "schema.ts"))) as {
      entitySchemas?: unknown;
      validationRules?: unknown;
    };

    if (!Array.isArray(registryModule.routeRegistry)) {
      return { extraction_failed: true, reason: "registry.ts does not export routeRegistry as an array" };
    }
    if (!Array.isArray(schemaModule.entitySchemas) || !Array.isArray(schemaModule.validationRules)) {
      return { extraction_failed: true, reason: "schema.ts does not export entitySchemas/validationRules as arrays" };
    }

    return {
      routes: registryModule.routeRegistry as E4SurfaceDump["routes"],
      entities: schemaModule.entitySchemas as E4SurfaceDump["entities"],
      validation_rules: schemaModule.validationRules as E4SurfaceDump["validation_rules"]
    };
  } catch (error) {
    return { extraction_failed: true, reason: String(error) };
  }
}

export function surfaceDumpToInventory(dump: E4SurfaceDump): E4InventoryItem[] {
  const items: E4InventoryItem[] = [];

  for (const route of dump.routes) {
    items.push({
      kind: "endpoint",
      item_id: renderEndpointItemId(route.entity, route.kind as E4EndpointKind),
      detail: { method: route.method, path: route.path }
    });
  }

  for (const entity of dump.entities) {
    items.push({ kind: "entity", item_id: renderEntityItemId(entity.name), detail: {} });

    for (const field of entity.fields) {
      items.push({
        kind: "field",
        item_id: renderFieldItemId(entity.name, field.name),
        detail: { type: field.type, ref_entity: field.ref_entity, required: field.required }
      });
    }
  }

  for (const rule of dump.validation_rules) {
    items.push({
      kind: "validation_rule",
      item_id: renderValidationRuleItemId(rule.entity, rule.field, rule.kind as never),
      detail: rule.detail
    });
  }

  return items;
}

export function truthInventory(ir: E4SchemaIR): E4TruthInventoryItem[] {
  const items: E4TruthInventoryItem[] = [];

  for (const entity of ir.entities) {
    items.push({ kind: "entity", item_id: renderEntityItemId(entity.name), semantic_item_uid: entity.semantic_item_uid, detail: {} });

    for (const field of entity.fields) {
      items.push({
        kind: "field",
        item_id: renderFieldItemId(entity.name, field.name),
        semantic_item_uid: field.semantic_item_uid,
        detail: { type: field.type, ref_entity: field.ref_entity ?? null, required: field.required }
      });
    }
  }

  for (const endpoint of ir.endpoints) {
    items.push({
      kind: "endpoint",
      item_id: renderEndpointItemId(endpoint.entity, endpoint.kind),
      semantic_item_uid: endpoint.semantic_item_uid,
      detail: { method: endpoint.method, path: endpoint.path }
    });
  }

  for (const rule of ir.validation_rules) {
    items.push({
      kind: "validation_rule",
      item_id: renderValidationRuleItemId(rule.entity, rule.field, rule.kind),
      semantic_item_uid: rule.semantic_item_uid,
      detail: rule.detail
    });
  }

  for (const convention of ir.conventions) {
    items.push({
      kind: "convention",
      item_id: renderConventionItemId(convention.convention_id),
      semantic_item_uid: convention.semantic_item_uid,
      detail: { statement: convention.statement }
    });
  }

  return items;
}
