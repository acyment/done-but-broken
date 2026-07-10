// E4 v3-M3 (E4V3-PRODUCT-LOOP-PROPOSAL.md §3.4): the PM spec-review step — the product arm's
// human-review analog, run at spec exit over the change's PROPOSED scenarios. The reviewer flags
// only contradictions with, or missed coverage of, COMMUNICATED requirements: what the request
// itself determined (delete/rename targets — every phrasing variant of those ops names its
// target verbatim), plus the full task delta when the agent asked for the PM brief. The review
// never volunteers new information: without the brief, brief-content rules simply cannot fire —
// which is the designed incentive to ask.
//
// The delta is derived from ground truth, but everything the review SAYS is bounded by what was
// already communicated to this agent through the request or the delivered brief.
import type { E4V2Scenario } from "../v2/scenario";
import { scenarioRequests } from "../v2/meter";
import type { E4TaskDelta } from "./task-delta";

export const E4_V3_PM_REVIEW_ID = "e4-pm-review-v1";

export type E4V3PmReviewFlag = {
  rule:
    | "contradicted_removal" // scenario expects success from a surface the request removed
    | "contradicted_rename" // scenario expects success from the pre-rename collection path
    | "unknown_field_on_added_entity" // (brief only) invented field the brief didn't communicate
    | "missed_communicated_operation"; // (brief only) communicated endpoint with no scenario
  subject: string;
  message: string;
};

function pathSegments(path: string): string[] {
  return path.split("?")[0].split("/").filter(Boolean);
}

function segmentsMatch(patternPath: string, requestPath: string): boolean {
  const pattern = pathSegments(patternPath);
  const request = pathSegments(requestPath);

  if (pattern.length !== request.length) {
    return false;
  }

  return pattern.every((segment, index) => (segment.startsWith("{") && segment.endsWith("}")) || segment === request[index]);
}

function expectsNotFound(scenario: E4V2Scenario): boolean {
  return scenario.steps.some((step) => step.kind === "assert_status" && step.status === 404);
}

function bodyKeys(scenario: E4V2Scenario): string[] {
  const keys: string[] = [];

  for (const step of scenario.steps) {
    if (step.kind !== "request_body") {
      continue;
    }

    try {
      const parsed = JSON.parse(step.body_json);

      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        keys.push(...Object.keys(parsed));
      }
    } catch {
      // remembered-placeholder or malformed literal — nothing to review
    }
  }

  return keys;
}

export function reviewE4ProposedScenarios(input: {
  delta: E4TaskDelta;
  briefDelivered: boolean;
  scenarios: E4V2Scenario[];
}): E4V3PmReviewFlag[] {
  const { delta, briefDelivered, scenarios } = input;
  const flags: E4V3PmReviewFlag[] = [];

  // (i) contradicted removals — request-determined (delete phrasings name their target).
  // A scenario may exercise removed surface only to assert it is GONE (tombstone, 404).
  for (const scenario of scenarios) {
    if (expectsNotFound(scenario)) {
      continue;
    }

    for (const request of scenarioRequests(scenario)) {
      const removed = delta.removed_endpoints.find(
        (endpoint) => endpoint.method === request.method && segmentsMatch(endpoint.path, request.path)
      );

      if (removed) {
        flags.push({
          rule: "contradicted_removal",
          subject: `${scenario.title}::${request.method} ${request.path}`,
          message: `scenario "${scenario.title}" expects ${removed.entity}'s retired ${removed.method} ${removed.path} to still work — the request removed it`
        });
      }
    }
  }

  // (ii) contradicted renames — request-determined (rename phrasings state old and new names).
  for (const rename of delta.renamed_entities) {
    const oldSegment = `${rename.old_name.toLowerCase()}s`;

    for (const scenario of scenarios) {
      if (expectsNotFound(scenario)) {
        continue;
      }

      for (const request of scenarioRequests(scenario)) {
        if (pathSegments(request.path)[0] === oldSegment) {
          flags.push({
            rule: "contradicted_rename",
            subject: `${scenario.title}::${request.path}`,
            message: `scenario "${scenario.title}" still uses the pre-rename path /${oldSegment} — the request renamed ${rename.old_name} to ${rename.new_name}`
          });
        }
      }
    }
  }

  if (!briefDelivered) {
    return flags;
  }

  // (iii) invented fields on added entities — brief-communicated field sets are exhaustive
  // ("with exactly these fields"). Only fires when the brief was delivered.
  for (const entity of delta.added_entities) {
    const communicated = new Set(entity.fields.map((field) => field.name));
    const entityRoutes = delta.added_endpoints.filter((endpoint) => endpoint.entity === entity.name);

    for (const scenario of scenarios) {
      const touchesEntity = scenarioRequests(scenario).some((request) =>
        entityRoutes.some((endpoint) => endpoint.method === request.method && segmentsMatch(endpoint.path, request.path))
      );

      if (!touchesEntity) {
        continue;
      }

      for (const key of bodyKeys(scenario)) {
        if (!communicated.has(key)) {
          flags.push({
            rule: "unknown_field_on_added_entity",
            subject: `${scenario.title}::${entity.name}.${key}`,
            message: `scenario "${scenario.title}" gives ${entity.name} a field "${key}" the brief did not communicate — the brief's field list is exhaustive`
          });
        }
      }
    }
  }

  // (iv) missed communicated operations — every endpoint the brief communicated (added surface
  // and method changes) must be exercised by at least one proposed scenario.
  const communicatedEndpoints = [
    ...delta.added_endpoints.map((endpoint) => ({ method: endpoint.method, path: endpoint.path, entity: endpoint.entity })),
    ...delta.changed_endpoints
      .filter((change) => change.old.method !== change.new.method)
      .map((change) => ({ method: change.new.method, path: change.new.path, entity: change.entity }))
  ];

  for (const endpoint of communicatedEndpoints) {
    const exercised = scenarios.some((scenario) =>
      scenarioRequests(scenario).some(
        (request) => request.method === endpoint.method && segmentsMatch(endpoint.path, request.path)
      )
    );

    if (!exercised) {
      flags.push({
        rule: "missed_communicated_operation",
        subject: `${endpoint.method} ${endpoint.path}`,
        message: `the brief communicated ${endpoint.method} ${endpoint.path} (${endpoint.entity}) but no proposed scenario exercises it`
      });
    }
  }

  return flags;
}
