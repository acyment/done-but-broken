// `e4-t0-gold-spec-v1` (E4V2 design §5.5, sealed 2026-07-09 amendment + Amendment 2). The
// deterministic pure function from a ground-truth IR snapshot (plus, for the tombstone rule, the
// prior spec-of-record) to the OpenSpec spec-of-record scenario model. This module is the
// constants-adjacent CODE TWIN the design seals: requirement titles/SHALL statements, scenario
// titles, step sequences, fixture ordinals, violating-value literals, disjointness rules, and
// capability naming all live HERE, hash-pinned at the v2-M5 freeze.
//
// Consumers: the v2-M1 workspace generator emits this model as openspec/specs/**/spec.md; the
// v2-M0 census executes it against gold implementations; the v2-M5 diligent fake agent reuses the
// same derivation on post-op IRs to build its change deltas.
import type { E4Endpoint, E4Entity, E4SchemaIR, E4ValidationRule } from "../substrate/ir";
import { errorEnvelopeKeysV2 } from "../substrate/v2/scaffold";
import { defaultValueForFieldV2, generateSeedFixtureV2, seedIdV2 } from "../substrate/v2/testgen";
import { TYPE_VIOLATING_VALUES, ruleViolatingValue } from "../substrate/v2/values";
import { canonicalScenarioBody, type E4V2Scenario, type E4V2Step } from "./scenario";

export const E4_T0_GOLD_SPEC_ID = "e4-t0-gold-spec-v1";

// §5.5 fixture-value policy: spec-reserved ordinals (GT reserves 1/2 for seed rows, 9/20 for its
// own fixtures).
export const SPEC_FRESH_ORDINAL = 5;
export const SPEC_CHANGED_ORDINAL = 6;

export function specFixtureId(entityName: string): string {
  return `${entityName.toLowerCase()}-spec-1`;
}

export function specMissingId(entityName: string): string {
  return `${entityName.toLowerCase()}-spec-missing`;
}

export type E4V2SpecRequirement = {
  title: string;
  shall: string;
  scenarios: E4V2Scenario[];
};

export type E4V2SpecCapability = {
  name: string; // folder name = first path segment of the entity's first endpoint, lowercased
  purpose: string;
  requirements: E4V2SpecRequirement[];
  retired: boolean; // true for §5.5 retirement tombstones
};

export type E4V2SpecOfRecord = {
  capabilities: E4V2SpecCapability[];
};

export function firstPathSegment(path: string): string {
  const segment = path.split("/").filter(Boolean)[0];

  if (!segment) {
    throw new Error(`endpoint path has no first segment: ${path}`);
  }

  return segment;
}

export function capabilityNameForEntity(ir: E4SchemaIR, entity: E4Entity): string {
  const firstEndpoint = ir.endpoints.find((endpoint) => endpoint.entity === entity.name);

  if (!firstEndpoint) {
    throw new Error(`entity ${entity.name} has no endpoints — capability naming is undefined`);
  }

  return firstPathSegment(firstEndpoint.path).toLowerCase();
}

function jsonLine(value: unknown): string {
  return JSON.stringify(value);
}

function pathWithId(path: string, id: string): string {
  return path.replace("{id}", id);
}

// One fresh fixture per entity, reused across that entity's templates: every field present,
// values from the GT generator's sealed derivation at ordinal 5; id = the spec-reserved fixture
// id; ref fields reference seed row 1 of the referenced entity.
export function buildFreshBody(ir: E4SchemaIR, entity: E4Entity): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  for (const field of entity.fields) {
    body[field.name] = field.name === "id" ? specFixtureId(entity.name) : defaultValueForFieldV2(ir, field, SPEC_FRESH_ORDINAL);
  }

  return body;
}

function buildChangedBody(ir: E4SchemaIR, entity: E4Entity): Record<string, unknown> {
  const body = buildFreshBody(ir, entity);
  const firstNonIdField = entity.fields.find((field) => field.name !== "id");

  if (firstNonIdField) {
    body[firstNonIdField.name] = defaultValueForFieldV2(ir, firstNonIdField, SPEC_CHANGED_ORDINAL);
  }

  return body;
}

type EndpointsByKind = Partial<Record<E4Endpoint["kind"], E4Endpoint>>;

function endpointsByKind(ir: E4SchemaIR, entity: E4Entity): EndpointsByKind {
  const map: EndpointsByKind = {};

  for (const endpoint of ir.endpoints) {
    if (endpoint.entity === entity.name && !map[endpoint.kind]) {
      map[endpoint.kind] = endpoint;
    }
  }

  return map;
}

function requireEndpoint(map: EndpointsByKind, kind: E4Endpoint["kind"], entityName: string): E4Endpoint {
  const endpoint = map[kind];

  if (!endpoint) {
    // §5.6.3's census-asserted invariant (every entity has create+read at all times) makes this
    // unreachable on procedural-rest-v2 IRs; failing loud beats emitting a partial template.
    throw new Error(`entity ${entityName} has no ${kind} endpoint — the §5.5 template requires it`);
  }

  return endpoint;
}

function rejectionAssertions(k1: string, k2: string): E4V2Step[] {
  return [
    { kind: "assert_status", status: 400 },
    { kind: "assert_field_equals", json_path: `error.${k1}`, literal_json: jsonLine("validation_error") },
    { kind: "assert_field_type", json_path: `error.${k2}`, json_type: "string" }
  ];
}

function createScenarios(ir: E4SchemaIR, entity: E4Entity, endpoints: EndpointsByKind): E4V2Scenario[] {
  const [k1, k2] = errorEnvelopeKeysV2(ir);
  const create = requireEndpoint(endpoints, "create", entity.name);
  const read = requireEndpoint(endpoints, "read", entity.name);
  const fresh = buildFreshBody(ir, entity);
  const freshJson = jsonLine(fresh);
  const scenarios: E4V2Scenario[] = [];

  // (1) Happy path with the A7 create→get round-trip.
  scenarios.push({
    title: `Creating a ${entity.name} returns the stored entity`,
    steps: [
      { kind: "request_body", method: "POST", path: create.path, body_json: freshJson },
      { kind: "assert_status", status: 201 },
      { kind: "assert_body_equals", literal_json: freshJson },
      { kind: "request", method: "GET", path: pathWithId(read.path, specFixtureId(entity.name)) },
      { kind: "assert_status", status: 200 },
      { kind: "assert_body_equals", literal_json: freshJson }
    ]
  });

  // (2) Required-field rejection: the fresh body minus the first required non-id field.
  const firstRequiredNonId = entity.fields.find((field) => field.required && field.name !== "id");

  if (firstRequiredNonId) {
    const withoutField = { ...fresh };
    delete withoutField[firstRequiredNonId.name];
    scenarios.push({
      title: `Creating a ${entity.name} without ${firstRequiredNonId.name} is rejected`,
      steps: [
        { kind: "request_body", method: "POST", path: create.path, body_json: jsonLine(withoutField) },
        ...rejectionAssertions(k1, k2)
      ]
    });
  }

  // (3) Type rejections, fields in IR order (Amendment 2; int/decimal/bool/date only).
  for (const field of entity.fields) {
    const violating = TYPE_VIOLATING_VALUES[field.type as keyof typeof TYPE_VIOLATING_VALUES];

    if (violating === undefined) {
      continue;
    }

    scenarios.push({
      title: `Creating a ${entity.name} with a non-${field.type} ${field.name} is rejected`,
      steps: [
        { kind: "request_body", method: "POST", path: create.path, body_json: jsonLine({ ...fresh, [field.name]: violating }) },
        ...rejectionAssertions(k1, k2)
      ]
    });
  }

  // (4) Rule rejections, rules in IR order (Amendment 2; sealed violating-value tables).
  for (const rule of ir.validation_rules.filter((candidate) => candidate.entity === entity.name)) {
    scenarios.push({
      title: `Creating a ${entity.name} with an invalid ${rule.field} is rejected`,
      steps: [
        {
          kind: "request_body",
          method: "POST",
          path: create.path,
          body_json: jsonLine({ ...fresh, [rule.field]: ruleViolatingValue(rule) })
        },
        ...rejectionAssertions(k1, k2)
      ]
    });
  }

  return scenarios;
}

function readScenario(ir: E4SchemaIR, entity: E4Entity, endpoints: EndpointsByKind): E4V2Scenario {
  const [k1, k2] = errorEnvelopeKeysV2(ir);
  const read = requireEndpoint(endpoints, "read", entity.name);

  return {
    title: `Fetching a missing ${entity.name} returns not found`,
    steps: [
      { kind: "request", method: "GET", path: pathWithId(read.path, specMissingId(entity.name)) },
      { kind: "assert_status", status: 404 },
      { kind: "assert_field_equals", json_path: `error.${k1}`, literal_json: jsonLine("not_found") },
      { kind: "assert_field_type", json_path: `error.${k2}`, json_type: "string" }
    ]
  };
}

function updateScenario(ir: E4SchemaIR, entity: E4Entity, endpoints: EndpointsByKind): E4V2Scenario {
  const create = requireEndpoint(endpoints, "create", entity.name);
  const read = requireEndpoint(endpoints, "read", entity.name);
  const update = requireEndpoint(endpoints, "update", entity.name);
  const freshJson = jsonLine(buildFreshBody(ir, entity));
  const changedJson = jsonLine(buildChangedBody(ir, entity));

  return {
    title: `Updating a ${entity.name} persists the change`,
    steps: [
      { kind: "request_body", method: "POST", path: create.path, body_json: freshJson },
      { kind: "assert_status", status: 201 },
      // ⟨update-method⟩ = the update endpoint's IR method, PUT or PATCH (Amendment 2).
      { kind: "request_body", method: update.method as "PUT" | "PATCH", path: pathWithId(update.path, specFixtureId(entity.name)), body_json: changedJson },
      { kind: "assert_status", status: 200 },
      { kind: "assert_body_equals", literal_json: changedJson },
      { kind: "request", method: "GET", path: pathWithId(read.path, specFixtureId(entity.name)) },
      { kind: "assert_status", status: 200 },
      { kind: "assert_body_equals", literal_json: changedJson }
    ]
  };
}

function deleteScenario(ir: E4SchemaIR, entity: E4Entity, endpoints: EndpointsByKind): E4V2Scenario {
  const [k1] = errorEnvelopeKeysV2(ir);
  const create = requireEndpoint(endpoints, "create", entity.name);
  const read = requireEndpoint(endpoints, "read", entity.name);
  const del = requireEndpoint(endpoints, "delete", entity.name);
  const freshJson = jsonLine(buildFreshBody(ir, entity));

  return {
    title: `Deleting a ${entity.name} removes it`,
    steps: [
      { kind: "request_body", method: "POST", path: create.path, body_json: freshJson },
      { kind: "assert_status", status: 201 },
      { kind: "request", method: "DELETE", path: pathWithId(del.path, specFixtureId(entity.name)) },
      { kind: "assert_status", status: 204 },
      { kind: "request", method: "GET", path: pathWithId(read.path, specFixtureId(entity.name)) },
      { kind: "assert_status", status: 404 },
      { kind: "assert_field_equals", json_path: `error.${k1}`, literal_json: jsonLine("not_found") }
    ]
  };
}

function listScenarios(ir: E4SchemaIR, entity: E4Entity, endpoints: EndpointsByKind): E4V2Scenario[] {
  const create = requireEndpoint(endpoints, "create", entity.name);
  const list = requireEndpoint(endpoints, "list", entity.name);
  const freshJson = jsonLine(buildFreshBody(ir, entity));
  const seedRows = generateSeedFixtureV2(ir)[entity.name] ?? [];
  const scenarios: E4V2Scenario[] = [
    {
      title: `Creating a ${entity.name} increases the list count`,
      steps: [
        { kind: "request_body", method: "POST", path: create.path, body_json: freshJson },
        { kind: "assert_status", status: 201 },
        { kind: "request", method: "GET", path: list.path },
        { kind: "assert_status", status: 200 },
        { kind: "assert_list_length", length: seedRows.length + 1 }
      ]
    }
  ];

  // Filtered-list template when the entity has a ref field. Discrimination REQUIRES §5.6.6's
  // heterogeneous seed refs: matching-seed-count is computed from the actual seed fixture, and
  // under heterogeneous seeding it is strictly below the unfiltered count.
  const refField = entity.fields.find((field) => field.type === "ref" && field.ref_entity);

  if (refField?.ref_entity) {
    const parentId = seedIdV2(refField.ref_entity, 1);
    const matchingSeedCount = seedRows.filter((row) => row[refField.name] === parentId).length;

    scenarios.push({
      title: `Filtering ${firstPathSegment(list.path)} by ${refField.name} returns only matching rows`,
      steps: [
        { kind: "request_body", method: "POST", path: create.path, body_json: freshJson },
        { kind: "assert_status", status: 201 },
        { kind: "request", method: "GET", path: `${list.path}?${refField.name}=${parentId}` },
        { kind: "assert_status", status: 200 },
        { kind: "assert_list_length", length: matchingSeedCount + 1 }
      ]
    });
  }

  return scenarios;
}

function analyticsScenario(ir: E4SchemaIR, entity: E4Entity, endpoints: EndpointsByKind): E4V2Scenario {
  const create = requireEndpoint(endpoints, "create", entity.name);
  const analytics = requireEndpoint(endpoints, "analytics", entity.name);
  const freshJson = jsonLine(buildFreshBody(ir, entity));
  const seedCount = (generateSeedFixtureV2(ir)[entity.name] ?? []).length;

  return {
    title: `Creating a ${entity.name} increases the reported count`,
    steps: [
      { kind: "request_body", method: "POST", path: create.path, body_json: freshJson },
      { kind: "assert_status", status: 201 },
      { kind: "request", method: "GET", path: analytics.path },
      { kind: "assert_status", status: 200 },
      { kind: "assert_field_equals", json_path: "count", literal_json: jsonLine(seedCount + 1) }
    ]
  };
}

// One requirement template per endpoint kind (title + one-sentence SHALL statement, §5.5).
const REQUIREMENT_TEMPLATES: Record<E4Endpoint["kind"], { title: (name: string) => string; shall: (name: string) => string }> = {
  create: {
    title: (name) => `Creating a ${name}`,
    shall: (name) => `The service SHALL create a ${name} from a valid POST body and reject invalid create requests.`
  },
  read: {
    title: (name) => `Fetching a ${name}`,
    shall: (name) => `The service SHALL return an existing ${name} by id and report not found for a missing id.`
  },
  update: {
    title: (name) => `Updating a ${name}`,
    shall: (name) => `The service SHALL persist valid updates submitted for an existing ${name}.`
  },
  delete: {
    title: (name) => `Deleting a ${name}`,
    shall: (name) => `The service SHALL remove an existing ${name} and stop serving it.`
  },
  list: {
    title: (name) => `Listing ${name} records`,
    shall: (name) => `The service SHALL list stored ${name} records.`
  },
  analytics: {
    title: (name) => `Reporting ${name} statistics`,
    shall: (name) => `The service SHALL report summary statistics over stored ${name} records.`
  }
};

function scenariosForEndpoint(ir: E4SchemaIR, entity: E4Entity, endpoints: EndpointsByKind, kind: E4Endpoint["kind"]): E4V2Scenario[] {
  switch (kind) {
    case "create":
      return createScenarios(ir, entity, endpoints);
    case "read":
      return [readScenario(ir, entity, endpoints)];
    case "update":
      return [updateScenario(ir, entity, endpoints)];
    case "delete":
      return [deleteScenario(ir, entity, endpoints)];
    case "list":
      return listScenarios(ir, entity, endpoints);
    case "analytics":
      return [analyticsScenario(ir, entity, endpoints)];
  }
}

export function deriveEntityCapability(ir: E4SchemaIR, entity: E4Entity): E4V2SpecCapability {
  const byKind = endpointsByKind(ir, entity);
  const requirements: E4V2SpecRequirement[] = [];

  // One `### Requirement:` per endpoint of this entity, in IR endpoint order.
  for (const endpoint of ir.endpoints.filter((candidate) => candidate.entity === entity.name)) {
    const template = REQUIREMENT_TEMPLATES[endpoint.kind];
    requirements.push({
      title: template.title(entity.name),
      shall: template.shall(entity.name),
      scenarios: scenariosForEndpoint(ir, entity, byKind, endpoint.kind)
    });
  }

  return {
    name: capabilityNameForEntity(ir, entity),
    purpose: `This specification pins the observable HTTP behavior of the ${entity.name} endpoints served by this application.`,
    requirements,
    retired: false
  };
}

// §5.5 retirement tombstone (Amendment 2): phrased on the CAPABILITY name — the entity may no
// longer exist in the IR. Forced by the pinned CLI's empty-rebuild archive abort; also the novel
// red scenario for delete_entity / rename_entity changes.
export function deriveTombstoneCapability(ir: E4SchemaIR, capabilityName: string): E4V2SpecCapability {
  const [k1, k2] = errorEnvelopeKeysV2(ir);

  return {
    name: capabilityName,
    purpose: `This specification records that the ${capabilityName} endpoints have been retired and must no longer be served.`,
    requirements: [
      {
        title: `Retired ${capabilityName} endpoints`,
        shall: `The service SHALL NOT serve the retired /${capabilityName} endpoints.`,
        scenarios: [
          {
            title: `Requests to retired /${capabilityName} endpoints return not found`,
            steps: [
              { kind: "request", method: "GET", path: `/${capabilityName}` },
              { kind: "assert_status", status: 404 },
              { kind: "assert_field_equals", json_path: `error.${k1}`, literal_json: jsonLine("not_found") },
              { kind: "assert_field_type", json_path: `error.${k2}`, json_type: "string" }
            ]
          }
        ]
      }
    ],
    retired: true
  };
}

// The full derivation: a pure function of ⟨IR snapshot, prior spec-of-record⟩. Live capabilities
// in IR entity order; then, for every prior capability whose folder name matches the first path
// segment of NO current endpoint, the retirement tombstone (in prior order). A re-added entity's
// derivation replaces its tombstone with the full template set by construction. Pass prior=null
// for the T0 baseline.
export function deriveSpecOfRecord(ir: E4SchemaIR, prior: E4V2SpecOfRecord | null): E4V2SpecOfRecord {
  const live = ir.entities.map((entity) => deriveEntityCapability(ir, entity));
  const liveSegments = new Set(ir.endpoints.map((endpoint) => firstPathSegment(endpoint.path).toLowerCase()));
  const tombstones = (prior?.capabilities ?? [])
    .filter((capability) => !liveSegments.has(capability.name))
    .map((capability) => deriveTombstoneCapability(ir, capability.name));

  return { capabilities: [...live, ...tombstones] };
}

export type E4V2ScenarioRef = {
  capability: string;
  requirement: string;
  scenario: E4V2Scenario;
};

export function allScenarioRefs(spec: E4V2SpecOfRecord): E4V2ScenarioRef[] {
  return spec.capabilities.flatMap((capability) =>
    capability.requirements.flatMap((requirement) =>
      requirement.scenarios.map((scenario) => ({ capability: capability.name, requirement: requirement.title, scenario }))
    )
  );
}

export type E4V2ChangeDelta = {
  spec: E4V2SpecOfRecord; // the full post-op derived spec-of-record (incl. tombstones)
  novel: E4V2ScenarioRef[]; // canonical form absent from the prior spec-of-record (§6 novelty)
  carried: E4V2ScenarioRef[]; // canonical form already present in the prior spec-of-record
  removed: E4V2ScenarioRef[]; // prior scenarios whose canonical form is absent post-op
};

// The §5.5 pair-derivation: templates over the post-op IR + the retirement-tombstone rule,
// diffed against the pre-task spec-of-record under the §6 canonicalizer novelty semantics.
export function deriveChangeDelta(postIr: E4SchemaIR, priorSpec: E4V2SpecOfRecord): E4V2ChangeDelta {
  const spec = deriveSpecOfRecord(postIr, priorSpec);
  const priorRefs = allScenarioRefs(priorSpec);
  const priorCanonical = new Set(priorRefs.map((ref) => canonicalScenarioBody(ref.scenario)));
  const postRefs = allScenarioRefs(spec);
  const postCanonical = new Set(postRefs.map((ref) => canonicalScenarioBody(ref.scenario)));

  return {
    spec,
    novel: postRefs.filter((ref) => !priorCanonical.has(canonicalScenarioBody(ref.scenario))),
    carried: postRefs.filter((ref) => priorCanonical.has(canonicalScenarioBody(ref.scenario))),
    removed: priorRefs.filter((ref) => !postCanonical.has(canonicalScenarioBody(ref.scenario)))
  };
}
