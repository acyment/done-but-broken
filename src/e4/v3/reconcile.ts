// E4 v3-M1 (E4V3-PRODUCT-LOOP-PROPOSAL.md §3.2/§3.3): spec↔code reconciliation heuristics and
// scenario-set quality floors for the product arm's gate. Everything here reads ONLY the agent's
// own artifacts — the bound spec-of-record scenarios and the code-surface dump the drift meter
// already extracts (src/e4/meter/extract.ts) — never the hidden truth. Scope honesty (recorded):
// these checks enforce INTERNAL adequacy (spec, code, and scenarios agree and exercise each
// other). Divergence-from-truth on underdetermined requests is the PM brief's job (v3-M0);
// consistent-but-wrong surfaces (M8 seed-3's update/delete gap in BOTH spec and code) are
// reachable only through the brief, not through any agent-side check.
//
// Path matching mirrors the sealed §7.5 dispatcher segment rules (a `{param}` pattern segment
// matches any request segment; literals must equal; query strings ignored).
import type { E4SurfaceDump } from "../meter/types";
import type { E4V2Scenario, E4V2Step } from "../v2/scenario"; // types only — hash-pinned module untouched
import { scenarioFloorViolations } from "../v2/step-table";
import { scenarioRequests } from "../v2/meter";

export const E4_V3_RECONCILER_ID = "e4-spec-code-reconciler-v1";

export type E4V3ReconcileCheck =
  | "route_without_scenario" // code route never exercised by any scenario (archive rot / lost coverage)
  | "scenario_route_absent" // scenario request matches no code route (stale spec claim)
  | "rule_without_rejection_scenario" // code-enforced rule with no rejecting scenario for its field
  | "rejection_scenario_without_rule" // scenario expects a 4xx rejection no code rule backs
  | "field_never_exercised" // code field never appears in any scenario body or assertion
  | "scenario_field_unknown" // scenario references a field key the code entity does not carry
  | "scenario_floor" // per-scenario base floor (delegated to the sealed step-table floors)
  | "create_round_trip_missing" // entity with a create route lacks a create→read round-trip scenario
  | "rejection_case_missing"; // entity with required fields/rules lacks any rejection scenario

export type E4V3ReconcileFinding = {
  check: E4V3ReconcileCheck;
  subject: string;
  message: string;
};

export type E4V3ReconcileReport = {
  reconciler_id: typeof E4_V3_RECONCILER_ID;
  findings: E4V3ReconcileFinding[];
  ok: boolean;
};

type DumpRoute = E4SurfaceDump["routes"][number];

// Exported for the commitment-vs-gold scorer (E5 P0-V item 7) — same sealed §7.5 segment rules.
export function pathSegmentsMatch(patternPath: string, requestPath: string): boolean {
  const patternSegments = patternPath.split("/").filter(Boolean);
  const requestSegments = requestPath.split("?")[0].split("/").filter(Boolean);

  if (patternSegments.length !== requestSegments.length) {
    return false;
  }

  return patternSegments.every((patternSegment, index) => {
    const patternIsParam = patternSegment.startsWith("{") && patternSegment.endsWith("}");
    return patternIsParam || patternSegment === requestSegments[index];
  });
}

function matchDumpRoute(request: { method: string; path: string }, routes: DumpRoute[]): DumpRoute | null {
  const literalCount = (path: string) =>
    path.split("/").filter((segment) => segment.length > 0 && !segment.startsWith("{")).length;
  const candidates = [...routes].sort((a, b) => literalCount(b.path) - literalCount(a.path));

  for (const route of candidates) {
    if (route.method === request.method && pathSegmentsMatch(route.path, request.path)) {
      return route;
    }
  }

  return null;
}

function bodyKeys(step: E4V2Step): string[] {
  if (step.kind !== "request_body") {
    return [];
  }

  try {
    const parsed = JSON.parse(step.body_json);

    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? Object.keys(parsed) : [];
  } catch {
    return [];
  }
}

// First field-like segment of an assertion json_path — list indices are skipped, and envelope
// paths ("error.…") are the convention surface, not entity fields.
function assertedFieldRoot(step: E4V2Step): string | null {
  const path =
    step.kind === "assert_field_equals" || step.kind === "assert_field_equals_remembered" || step.kind === "assert_no_field"
      ? step.json_path
      : step.kind === "remember"
        ? step.json_path
        : step.kind === "assert_field_type"
          ? step.json_path
          : null;

  if (path === null) {
    return null;
  }

  const segments = path.split(".").filter((segment) => segment.length > 0 && !/^\d+$/.test(segment));

  if (segments.length === 0 || segments[0] === "error") {
    return null;
  }

  return segments[0];
}

// A VALIDATION rejection sends a body and expects 400 — the workspace convention pins validation
// failures to 400 exactly. 404-on-missing steps (read/delete round-trips) are not validation
// claims and back no field rule.
function scenarioAssertsValidationRejection(scenario: E4V2Scenario): boolean {
  return (
    scenario.steps.some((step) => step.kind === "assert_status" && step.status === 400) &&
    scenario.steps.some((step) => step.kind === "request_body")
  );
}

// §5.6.1 type validity mirrored for backing analysis. Remembered "{name}" placeholders parse as
// strings, so they can misread as type violations on non-string fields — acceptable: templates
// and sane agents send literals in rejection bodies.
function valueViolates(
  value: unknown,
  field: { name: string; type: string },
  rules: E4SurfaceDump["validation_rules"],
  entity: string
): boolean {
  const typeValid = (() => {
    switch (field.type) {
      case "string":
      case "ref":
        return typeof value === "string";
      case "int":
        return typeof value === "number" && Number.isInteger(value);
      case "decimal":
        return typeof value === "number" && Number.isFinite(value);
      case "bool":
        return typeof value === "boolean";
      case "date":
        return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
      default:
        return true;
    }
  })();

  if (!typeValid) {
    return true;
  }

  for (const rule of rules) {
    if (rule.entity !== entity || rule.field !== field.name) {
      continue;
    }

    if (rule.kind === "range" && typeof value === "number") {
      const detail = rule.detail as { min?: number; max?: number };

      if ((detail.min !== undefined && value < detail.min) || (detail.max !== undefined && value > detail.max)) {
        return true;
      }
    } else if (rule.kind === "enum") {
      const values = (rule.detail as { values?: unknown[] }).values ?? [];

      if (!values.some((member) => member === value)) {
        return true;
      }
    } else if (rule.kind === "format" && typeof value === "string") {
      const pattern = (rule.detail as { pattern?: string }).pattern;

      if (pattern !== undefined && !new RegExp(pattern).test(value)) {
        return true;
      }
    }
  }

  return false;
}

function scenarioMentionsField(scenario: E4V2Scenario, field: string): boolean {
  return scenario.steps.some(
    (step) => bodyKeys(step).includes(field) || assertedFieldRoot(step) === field
  );
}

// Entities the scenario's requests touch, resolved through the dump routes.
function scenarioEntities(scenario: E4V2Scenario, routes: DumpRoute[]): Set<string> {
  const entities = new Set<string>();

  for (const request of scenarioRequests(scenario)) {
    const route = matchDumpRoute(request, routes);

    if (route) {
      entities.add(route.entity);
    }
  }

  return entities;
}

export function reconcileE4SpecAndCode(input: {
  dump: E4SurfaceDump;
  scenarios: E4V2Scenario[];
}): E4V3ReconcileReport {
  const { dump, scenarios } = input;
  const findings: E4V3ReconcileFinding[] = [];

  const requestsByScenario = scenarios.map((scenario) => ({
    scenario,
    requests: scenarioRequests(scenario)
  }));

  // 1. Every code route is exercised by at least one scenario.
  for (const route of dump.routes) {
    const exercised = requestsByScenario.some(({ requests }) =>
      requests.some((request) => route.method === request.method && pathSegmentsMatch(route.path, request.path))
    );

    if (!exercised) {
      findings.push({
        check: "route_without_scenario",
        subject: `${route.method} ${route.path}`,
        message: `code registers ${route.method} ${route.path} (${route.entity}:${route.kind}) but no scenario exercises it`
      });
    }
  }

  // 2. Every scenario request resolves to a code route — EXCEPT in scenarios asserting 404,
  // whose unmatched requests are deliberate negative-space claims (the §5.5 retirement
  // tombstone; the same exemption the drift meter's stale_claim rule applies).
  for (const { scenario, requests } of requestsByScenario) {
    if (scenario.steps.some((step) => step.kind === "assert_status" && step.status === 404)) {
      continue;
    }

    for (const request of requests) {
      if (!matchDumpRoute(request, dump.routes)) {
        findings.push({
          check: "scenario_route_absent",
          subject: `${request.method} ${request.path}`,
          message: `scenario "${scenario.title}" sends ${request.method} ${request.path}, which matches no code route`
        });
      }
    }
  }

  // 3./4. Validation rules and rejection scenarios back each other, VALUE-AWARE: a body field
  // backs a rejection only when its literal value actually violates the field's declared type
  // (§5.6.1 type checks) or a code rule on it; a required field backs by OMISSION (the sealed
  // required-rejection template sends a body without it); unknown body keys back the unknown-key
  // mechanism. Mention alone cannot discriminate — invalid-value templates carry a full valid
  // body around the one violating field.
  const rejectionBacking = new Map<string, E4V2Scenario[]>(); // `${entity}::${field}` -> scenarios

  for (const scenario of scenarios) {
    if (!scenarioAssertsValidationRejection(scenario)) {
      continue;
    }

    let scenarioBacked = false;
    const touchedEntities = new Set<string>();

    for (const step of scenario.steps) {
      if (step.kind !== "request_body") {
        continue;
      }

      const route = matchDumpRoute({ method: step.method, path: step.path }, dump.routes);
      const dumpEntity = route ? dump.entities.find((candidate) => candidate.name === route.entity) : undefined;

      if (!route || !dumpEntity) {
        continue;
      }

      touchedEntities.add(route.entity);
      let bodyValues: Record<string, unknown>;

      try {
        const parsed = JSON.parse(step.body_json);
        bodyValues = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch {
        bodyValues = {};
      }

      const keys = Object.keys(bodyValues);
      const knownNames = new Set(dumpEntity.fields.map((field) => field.name));
      const unknownKeys = keys.filter((key) => !knownNames.has(key));
      const omittedRequired = dumpEntity.fields.filter((field) => field.required && !keys.includes(field.name));
      const violating = dumpEntity.fields.filter(
        (field) =>
          keys.includes(field.name) &&
          valueViolates(bodyValues[field.name], field, dump.validation_rules, route.entity)
      );

      for (const field of [...omittedRequired, ...violating]) {
        const key = `${route.entity}::${field.name}`;
        rejectionBacking.set(key, [...(rejectionBacking.get(key) ?? []), scenario]);
      }

      if (unknownKeys.length > 0 || omittedRequired.length > 0 || violating.length > 0) {
        scenarioBacked = true;
      }
    }

    if (touchedEntities.size > 0 && !scenarioBacked) {
      findings.push({
        check: "rejection_scenario_without_rule",
        subject: scenario.title,
        message: `scenario "${scenario.title}" expects a validation rejection but its body violates no code type, rule, required field, or unknown-key check`
      });
    }
  }

  for (const rule of dump.validation_rules) {
    // The checker asks for a rejection case per (entity, field), not per rule kind — kind-level
    // discrimination is the mutation harness's job (v3-M2).
    if (!rejectionBacking.has(`${rule.entity}::${rule.field}`)) {
      findings.push({
        check: "rule_without_rejection_scenario",
        subject: `${rule.entity}.${rule.field}:${rule.kind}`,
        message: `code enforces a ${rule.kind} rule on ${rule.entity}.${rule.field} but no scenario asserts a rejection for that field`
      });
    }
  }

  // 5./6. Field-level reconciliation.
  for (const entity of dump.entities) {
    for (const field of entity.fields) {
      const exercised = scenarios.some((scenario) => scenarioMentionsField(scenario, field.name));

      if (!exercised) {
        findings.push({
          check: "field_never_exercised",
          subject: `${entity.name}.${field.name}`,
          message: `code carries ${entity.name}.${field.name} but no scenario mentions it`
        });
      }
    }
  }

  for (const { scenario, requests } of requestsByScenario) {
    if (scenarioAssertsValidationRejection(scenario)) {
      continue; // sending a bogus key to prove rejection is legitimate spec behavior
    }

    const entities = new Set<string>();

    for (const request of requests) {
      const route = matchDumpRoute(request, dump.routes);

      if (route) {
        entities.add(route.entity);
      }
    }

    for (const step of scenario.steps) {
      for (const key of bodyKeys(step)) {
        const knownSomewhere = [...entities].some((entity) =>
          dump.entities.find((candidate) => candidate.name === entity)?.fields.some((field) => field.name === key)
        );

        if (entities.size > 0 && !knownSomewhere) {
          findings.push({
            check: "scenario_field_unknown",
            subject: `${scenario.title}::${key}`,
            message: `scenario "${scenario.title}" sends field "${key}" which no touched code entity carries`
          });
        }
      }
    }
  }

  // 7. Per-scenario base floors (sealed step-table floors, surfaced as findings).
  for (const scenario of scenarios) {
    for (const violation of scenarioFloorViolations(scenario)) {
      findings.push({
        check: "scenario_floor",
        subject: scenario.title,
        message: `scenario "${scenario.title}": ${violation}`
      });
    }
  }

  // 8./9. Entity-level set floors.
  for (const entity of dump.entities) {
    const createRoute = dump.routes.find((route) => route.entity === entity.name && route.kind === "create");

    if (!createRoute) {
      continue;
    }

    const roundTrip = scenarios.some((scenario) => {
      const requests = scenarioRequests(scenario);
      const createIndex = requests.findIndex(
        (request) => request.method === "POST" && pathSegmentsMatch(createRoute.path, request.path)
      );

      if (createIndex === -1) {
        return false;
      }

      return requests
        .slice(createIndex + 1)
        .some((request) => request.method === "GET" && matchDumpRoute(request, dump.routes)?.entity === entity.name);
    });

    if (!roundTrip) {
      findings.push({
        check: "create_round_trip_missing",
        subject: entity.name,
        message: `${entity.name} has a create route but no scenario creates one and reads it back`
      });
    }

    const needsRejection =
      entity.fields.some((field) => field.required) ||
      dump.validation_rules.some((rule) => rule.entity === entity.name);
    const hasRejection = scenarios.some(
      (scenario) =>
        scenarioAssertsValidationRejection(scenario) && scenarioEntities(scenario, dump.routes).has(entity.name)
    );

    if (needsRejection && !hasRejection) {
      findings.push({
        check: "rejection_case_missing",
        subject: entity.name,
        message: `${entity.name} enforces validation but no scenario asserts any rejection for it`
      });
    }
  }

  return { reconciler_id: E4_V3_RECONCILER_ID, findings, ok: findings.length === 0 };
}
