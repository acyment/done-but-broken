// T0 workspace codegen (ADR-001 generated-app scaffold, ADR-002 in-memory storage, ADR-004 spec
// artifact formats; IMPLEMENTATION-PLAN.md M1). Emits a genuinely runnable bun app: one generic,
// IR-independent server (server.ts/storage.ts) driven entirely by generated data files
// (registry.ts/schema.ts/seed.ts), plus the agent-owned spec artifacts verified in-sync with the
// same ground-truth IR. Reusable for any IR snapshot — M1 only ever calls it for the T0 baseline.
import { generateSeedFixture } from "./testgen";
import type { E4Convention, E4ConventionKind, E4SchemaIR } from "./ir";

const ERROR_FORMAT_STYLE_BY_STATEMENT: Record<string, "code_message" | "type_detail"> = {
  'Error responses are JSON bodies of the shape { "error": { "code": string, "message": string } }.':
    "code_message",
  'Error responses are JSON bodies of the shape { "error": { "type": string, "detail": string } }.':
    "type_detail"
};

function errorEnvelopeStyle(ir: E4SchemaIR): "code_message" | "type_detail" {
  const convention = ir.conventions.find((candidate) => candidate.kind === "error_format");
  const style = convention ? ERROR_FORMAT_STYLE_BY_STATEMENT[convention.statement] : undefined;

  if (!style) {
    throw new Error(`unrecognized error_format convention statement: ${convention?.statement}`);
  }

  return style;
}

function registryFileContents(ir: E4SchemaIR): string {
  const routes = ir.endpoints.map((endpoint) => ({
    method: endpoint.method,
    path: endpoint.path,
    entity: endpoint.entity,
    kind: endpoint.kind
  }));

  return [
    "// GENERATED at T0 by src/e4/substrate/scaffold.ts — do not hand-edit route wiring here.",
    'export type E4RouteDefinition = {',
    '  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";',
    "  path: string;",
    "  entity: string;",
    '  kind: "create" | "read" | "update" | "delete" | "list" | "analytics";',
    "};",
    "",
    `export const routeRegistry: E4RouteDefinition[] = ${JSON.stringify(routes, null, 2)};`,
    ""
  ].join("\n");
}

function schemaFileContents(ir: E4SchemaIR): string {
  const entitySchemas = ir.entities.map((entity) => ({
    name: entity.name,
    fields: entity.fields.map((field) => ({
      name: field.name,
      type: field.type,
      ref_entity: field.ref_entity ?? null,
      required: field.required
    }))
  }));
  const validationRules = ir.validation_rules.map((rule) => ({
    entity: rule.entity,
    field: rule.field,
    kind: rule.kind,
    detail: rule.detail
  }));

  return [
    "// GENERATED at T0 by src/e4/substrate/scaffold.ts — the app's actual behavior tracks this file,",
    "// never specs/*. Editing specs/openapi.json or specs/CONVENTIONS.md does not change behavior.",
    'export type E4FieldType = "string" | "int" | "decimal" | "bool" | "date" | "ref";',
    "export type E4FieldSchema = { name: string; type: E4FieldType; ref_entity: string | null; required: boolean };",
    "export type E4EntitySchema = { name: string; fields: E4FieldSchema[] };",
    'export type E4ValidationRuleSchema = { entity: string; field: string; kind: "required" | "range" | "enum" | "format"; detail: Record<string, unknown> };',
    "",
    `export const entitySchemas: E4EntitySchema[] = ${JSON.stringify(entitySchemas, null, 2)};`,
    "",
    `export const validationRules: E4ValidationRuleSchema[] = ${JSON.stringify(validationRules, null, 2)};`,
    "",
    `export const errorEnvelopeStyle: "code_message" | "type_detail" = ${JSON.stringify(errorEnvelopeStyle(ir))};`,
    ""
  ].join("\n");
}

function seedFileContents(ir: E4SchemaIR): string {
  const fixture = generateSeedFixture(ir);

  return [
    "// GENERATED at T0 by src/e4/substrate/scaffold.ts.",
    "export const seedFixture: Record<string, Record<string, unknown>[]> = " + JSON.stringify(fixture, null, 2) + ";",
    ""
  ].join("\n");
}

const STORAGE_FILE_CONTENTS = `// In-memory store (ADR-002): the server process is the unit of state. Every executor run is
// fresh-start, so this module never persists anything to disk.
export type E4Store = Map<string, Map<string, Record<string, unknown>>>;

export function createStore(seedFixture: Record<string, Record<string, unknown>[]>): E4Store {
  const store: E4Store = new Map();

  for (const [entityName, rows] of Object.entries(seedFixture)) {
    const table = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      table.set(String(row.id), row);
    }
    store.set(entityName, table);
  }

  return store;
}
`;

const SERVER_FILE_CONTENTS = `// Generic dispatcher (ADR-001 scaffold contract). Behavior is entirely data-driven from
// registry.ts + schema.ts + seed.ts — this file never changes across substrate configs.
import { routeRegistry, type E4RouteDefinition } from "./registry";
import { entitySchemas, validationRules, errorEnvelopeStyle } from "./schema";
import { createStore } from "./storage";
import { seedFixture } from "./seed";

const store = createStore(seedFixture);
const port = Number(process.env.E4_PORT ?? "0");

function errorBody(code: string, message: string): unknown {
  return errorEnvelopeStyle === "type_detail" ? { error: { type: code, detail: message } } : { error: { code, message } };
}

function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const patternSegments = pattern.split("/").filter(Boolean);
  const actualSegments = pathname.split("/").filter(Boolean);

  if (patternSegments.length !== actualSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternSegments.length; i += 1) {
    const patternSegment = patternSegments[i];
    const actualSegment = actualSegments[i];

    if (patternSegment.startsWith("{") && patternSegment.endsWith("}")) {
      params[patternSegment.slice(1, -1)] = actualSegment;
    } else if (patternSegment !== actualSegment) {
      return null;
    }
  }

  return params;
}

function literalSegmentCount(path: string): number {
  return path.split("/").filter((segment) => segment.length > 0 && !segment.startsWith("{")).length;
}

// More-specific (more literal-segment) routes must be tried before wildcard ones, or a route like
// GET /widgets/{id} (read) shadows GET /widgets/stats (analytics) — {id} matches "stats" too.
const routesBySpecificity = [...routeRegistry].sort((a, b) => literalSegmentCount(b.path) - literalSegmentCount(a.path));

function matchRoute(method: string, pathname: string): { route: E4RouteDefinition; params: Record<string, string> } | null {
  for (const route of routesBySpecificity) {
    if (route.method !== method) {
      continue;
    }
    const params = matchPath(route.path, pathname);
    if (params) {
      return { route, params };
    }
  }
  return null;
}

// Required-ness lives on the field schema (field.required) — validationRules never carries a
// "required" kind (see schema.ts note), so this reads entitySchemas, the same source the spec's
// \`required\` array is generated from.
function firstMissingRequiredField(entityName: string, body: Record<string, unknown>): string | null {
  const entity = entitySchemas.find((candidate) => candidate.name === entityName);
  for (const field of entity?.fields ?? []) {
    if (field.required && (body[field.name] === undefined || body[field.name] === null)) {
      return field.name;
    }
  }
  return null;
}

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const matched = matchRoute(req.method, url.pathname);

  if (!matched) {
    return Response.json(errorBody("not_found", "route not found"), { status: 404 });
  }

  const { route, params } = matched;
  const table = store.get(route.entity);

  if (!table) {
    return Response.json(errorBody("not_found", "unknown entity"), { status: 404 });
  }

  switch (route.kind) {
    case "create": {
      const body = (await req.json()) as Record<string, unknown>;
      const missingField = firstMissingRequiredField(route.entity, body);
      if (missingField) {
        return Response.json(errorBody("validation_error", \`\${missingField} is required\`), { status: 400 });
      }
      table.set(String(body.id), body);
      return Response.json(body, { status: 201 });
    }
    case "read": {
      const row = table.get(params.id);
      if (!row) {
        return Response.json(errorBody("not_found", "resource not found"), { status: 404 });
      }
      return Response.json(row, { status: 200 });
    }
    case "update": {
      if (!table.has(params.id)) {
        return Response.json(errorBody("not_found", "resource not found"), { status: 404 });
      }
      const body = (await req.json()) as Record<string, unknown>;
      table.set(params.id, body);
      return Response.json(body, { status: 200 });
    }
    case "delete": {
      if (!table.has(params.id)) {
        return Response.json(errorBody("not_found", "resource not found"), { status: 404 });
      }
      table.delete(params.id);
      return new Response(null, { status: 204 });
    }
    case "list": {
      const refField = entitySchemas.find((entity) => entity.name === route.entity)?.fields.find((field) => field.type === "ref");
      const filterValue = refField ? url.searchParams.get(refField.name) : null;
      const rows = [...table.values()].filter((row) => !filterValue || row[refField!.name] === filterValue);
      return Response.json(rows, { status: 200 });
    }
    case "analytics": {
      return Response.json({ count: table.size }, { status: 200 });
    }
    default: {
      return Response.json(errorBody("not_found", "unknown route kind"), { status: 404 });
    }
  }
}

const server = Bun.serve({ port, fetch: handle });
console.log(\`E4 app listening on port \${server.port}\`);
`;

function openApiSpec(ir: E4SchemaIR): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const endpoint of ir.endpoints) {
    const pathItem = (paths[endpoint.path] ??= {});
    pathItem[endpoint.method.toLowerCase()] = {
      operationId: `${endpoint.kind}${endpoint.entity}`,
      summary: `${endpoint.kind} ${endpoint.entity}`,
      tags: [endpoint.entity],
      // Vendor extensions carrying the meter's real identity key (entity, kind) — operationId/tags
      // are for human/tooling consumption and aren't a safe machine-parse target (an agent could
      // rephrase operationId without meaning to change anything the meter should care about).
      "x-e4-entity": endpoint.entity,
      "x-e4-kind": endpoint.kind
    };
  }

  return {
    openapi: "3.1.0",
    info: { title: "E4 generated app", version: "1.0.0" },
    paths,
    components: {
      schemas: Object.fromEntries(
        ir.entities.map((entity) => [
          entity.name,
          {
            type: "object",
            properties: Object.fromEntries(
              entity.fields.map((field) => [
                field.name,
                { ...openApiFieldSchema(field), ...validationRuleKeywords(ir, entity.name, field.name) }
              ])
            ),
            required: entity.fields.filter((field) => field.required).map((field) => field.name)
          }
        ])
      )
    }
  };
}

// Range/enum/format validation rules round-trip as standard JSON Schema keywords, so the meter
// can extract validation_rule items from the spec side without a custom extension vocabulary.
// "required" rules have no separate keyword — they share the schema-level `required` array with
// field.required (same concept in OpenAPI; both are read back from that one array).
function validationRuleKeywords(ir: E4SchemaIR, entityName: string, fieldName: string): Record<string, unknown> {
  const keywords: Record<string, unknown> = {};

  for (const rule of ir.validation_rules) {
    if (rule.entity !== entityName || rule.field !== fieldName) {
      continue;
    }

    if (rule.kind === "range") {
      if ("min" in rule.detail) keywords.minimum = rule.detail.min;
      if ("max" in rule.detail) keywords.maximum = rule.detail.max;
    } else if (rule.kind === "enum" && "values" in rule.detail) {
      keywords.enum = rule.detail.values;
    } else if (rule.kind === "format" && "pattern" in rule.detail) {
      keywords.pattern = rule.detail.pattern;
    }
  }

  return keywords;
}

// Round-trippable enough for the meter to detect a real type mismatch: plain OpenAPI `type:
// string` collapses string/date/ref into one JSON Schema type, so date gets a `format` hint and
// ref fields use a real $ref — both distinguishable again on extraction (src/e4/meter/extract.ts).
type E4EntityFieldForSchema = E4SchemaIR["entities"][number]["fields"][number];

function openApiFieldSchema(field: E4EntityFieldForSchema): Record<string, unknown> {
  if (field.type === "ref") {
    return { $ref: `#/components/schemas/${field.ref_entity}` };
  }
  if (field.type === "date") {
    return { type: "string", format: "date" };
  }

  const mapping: Record<string, string> = { string: "string", int: "integer", decimal: "number", bool: "boolean" };
  return { type: mapping[field.type] };
}

const CONVENTION_KIND_ORDER: E4ConventionKind[] = ["naming", "error_format", "command", "structural"];

function conventionsMarkdown(ir: E4SchemaIR): string {
  const lines = ["# CONVENTIONS", "", "Normative conventions this API must follow:", ""];

  for (const kind of CONVENTION_KIND_ORDER) {
    for (const convention of ir.conventions.filter((candidate) => candidate.kind === kind)) {
      lines.push(`- \`${convention.convention_id}\`: ${convention.statement}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function readmeMarkdown(ir: E4SchemaIR): string {
  const exampleByKind = new Map<E4ConventionKind, E4Convention>();
  for (const convention of ir.conventions) {
    if (!exampleByKind.has(convention.kind)) {
      exampleByKind.set(convention.kind, convention);
    }
  }

  // Reproduced verbatim (Gate-1 pin): each line below is the EXACT bullet an agent or the meter
  // will see in specs/CONVENTIONS.md — `- \`<convention-id>\`: <statement>` — not a re-escaped
  // description of it.
  const grammarExamples = CONVENTION_KIND_ORDER.filter((kind) => exampleByKind.has(kind)).flatMap((kind) => {
    const convention = exampleByKind.get(kind)!;
    return [`  - ${kind}:`, `    - \`${convention.convention_id}\`: ${convention.statement}`];
  });

  return [
    "# Workspace conventions",
    "",
    "This app has two spec artifacts you own and must keep truthful:",
    "",
    "- `specs/openapi.json` — the API surface (OpenAPI 3.1, JSON).",
    "- `specs/CONVENTIONS.md` — normative rules, one per bullet:",
    "",
    "  ```",
    "  - `<convention-id>`: <statement>",
    "  ```",
    "",
    "  One example per convention kind, verbatim (Gate-1 pin):",
    "",
    ...grammarExamples,
    "",
    "Free prose around these bullets is fine and unmetered — only the bulleted lines above are",
    "checked. Both files start truthful; keeping them that way as you make changes is on you.",
    ""
  ].join("\n");
}

export function buildE4WorkspaceFiles(ir: E4SchemaIR): Record<string, string> {
  return {
    "server.ts": SERVER_FILE_CONTENTS,
    "storage.ts": STORAGE_FILE_CONTENTS,
    "registry.ts": registryFileContents(ir),
    "schema.ts": schemaFileContents(ir),
    "seed.ts": seedFileContents(ir),
    "specs/openapi.json": `${JSON.stringify(openApiSpec(ir), null, 2)}\n`,
    "specs/CONVENTIONS.md": conventionsMarkdown(ir),
    "README.md": readmeMarkdown(ir)
  };
}
