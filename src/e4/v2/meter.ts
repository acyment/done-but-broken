// v2 drift meter (E4V2 design §7.5, pinned; v2-M4). Two channels, one report shape:
//
//   code_vs_truth — UNCHANGED from v1: the registry/schema surface-dump extraction, all five
//     item kinds, the registry-bypass reconciliation, and fail-closed extraction carry over
//     verbatim by REUSING the v1 extract/classify machinery (the v2 app's dump format is
//     byte-compatible; §5.6 makes it behaviorally stricter only).
//
//   spec_vs_truth — re-based on scenario EXECUTION, not static parsing: the spec-of-record's
//     scenarios (post-archive, the living spec) run against the task's GOLD implementation,
//     harness-side and hidden (gold never touches the agent). Classification at endpoint
//     granularity plus conventions:
//       contradiction — a scenario FAILS against gold and every request matches a truth route;
//         attributed to the matched endpoint(s), uid = the endpoint's IR uid.
//       stale_claim  — a scenario FAILS against gold and ≥1 request matches NO truth route;
//         item_id = `endpoint:<METHOD> <path>` of the unmatched request; identity through the
//         rename-lineage merge, else a stable spec-only pseudo-identity. Amendment 2: a
//         scenario that PASSES against gold is never a discrepancy, matched or not — a §5.5
//         retirement tombstone correctly asserts negative space.
//       coverage_gap — a truth endpoint matched by NO scenario request; and a truth
//         error_format convention with no scenario asserting the sealed envelope-key paths.
//     Field/validation_rule kinds are deliberately NOT measured spec-side (recorded
//     limitation); naming/command/structural conventions are code-side-only (§7.5 scope
//     clarification).
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyE4Drift, type E4RenameLineageLookupEntry } from "../meter/classify";
import { extractSurfaceDump, surfaceDumpToInventory, truthInventory } from "../meter/extract";
import type { E4Endpoint, E4SchemaIR } from "../substrate/ir";
import { renderEndpointItemId } from "../substrate/ir";
import { buildE4V2AppFiles, envelopeKeysForStatement } from "../substrate/v2/scaffold";
import type { E4ExecutorConfig } from "../oracle-executor";
import type { E4Discrepancy, E4DriftClass, E4DriftItemKind, E4DriftReport, E4ExecutorEvidence } from "../types";
import { parseOpenSpecScenarioBlocks } from "./converter";
import { bindScenario } from "./step-table";
import type { E4V2Scenario, E4V2Step } from "./scenario";
import { runE4V2ScenarioSet } from "./scenario-executor";
import { readOpenSpecSpecOfRecord } from "../../e1-openspec-harness";

export const METER_VERSION_V2 = "e4-drift-meter-v2";

const ALL_KINDS: E4DriftItemKind[] = ["endpoint", "entity", "field", "validation_rule", "convention"];

function buildCounts(discrepancies: E4Discrepancy[]): Record<E4DriftItemKind, Record<E4DriftClass, number>> {
  const counts = Object.fromEntries(
    ALL_KINDS.map((kind) => [kind, { contradiction: 0, coverage_gap: 0, stale_claim: 0 }])
  ) as Record<E4DriftItemKind, Record<E4DriftClass, number>>;

  for (const discrepancy of discrepancies) {
    counts[discrepancy.kind][discrepancy.class] += 1;
  }

  return counts;
}

type ScenarioRequest = { method: string; path: string };

export function scenarioRequests(scenario: E4V2Scenario): ScenarioRequest[] {
  const requests: ScenarioRequest[] = [];

  for (const step of scenario.steps) {
    if (step.kind === "request") {
      requests.push({ method: step.method, path: step.path });
    } else if (step.kind === "request_body") {
      requests.push({ method: step.method, path: step.path });
    }
  }

  return requests;
}

function literalSegmentCount(path: string): number {
  return path.split("/").filter((segment) => segment.length > 0 && !segment.startsWith("{")).length;
}

// Dispatcher matching rules (§7.5): method + segment-wise path match, literal-segment
// specificity first. A route's `{param}` segment matches any request segment — including a
// scenario's `{remembered}` placeholder, which is an id-shaped runtime value and therefore
// never matches a LITERAL route segment.
function pathSegmentsMatch(patternPath: string, requestPath: string): boolean {
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

export function matchTruthEndpoint(request: ScenarioRequest, endpoints: E4Endpoint[]): E4Endpoint | null {
  const candidates = [...endpoints].sort((a, b) => literalSegmentCount(b.path) - literalSegmentCount(a.path));

  for (const endpoint of candidates) {
    if (endpoint.method === request.method && pathSegmentsMatch(endpoint.path, request.path)) {
      return endpoint;
    }
  }

  return null;
}

// A stale claim's item_id carries the CONCRETE unmatched request (`endpoint:GET
// /widgets/widget-spec-1`), while rename-lineage entries carry the PATTERN form
// (`endpoint:GET /widgets/{id}`) — resolution matches the request against each lineage
// pattern with the same dispatcher segment rules, falling back to exact-id equality, else to
// the stable spec-only pseudo-identity (a persisting stale claim never re-onsets).
function resolveStaleIdentity(itemId: string, renameLineage: E4RenameLineageLookupEntry[]): string {
  const requestMatch = itemId.match(/^endpoint:([A-Z]+) (.+)$/);

  for (const entry of renameLineage) {
    if (entry.old_item_id === itemId) {
      return entry.semantic_item_uid;
    }

    const lineageMatch = entry.old_item_id.match(/^endpoint:([A-Z]+) (.+)$/);

    if (
      requestMatch &&
      lineageMatch &&
      lineageMatch[1] === requestMatch[1] &&
      pathSegmentsMatch(lineageMatch[2], requestMatch[2])
    ) {
      return entry.semantic_item_uid;
    }
  }

  return `spec-only:${itemId}`;
}

function isEnvelopeShapeAssertion(step: E4V2Step, keys: [string, string]): boolean {
  const paths = [`error.${keys[0]}`, `error.${keys[1]}`];

  return (
    (step.kind === "assert_field_equals" && paths.includes(step.json_path)) ||
    (step.kind === "assert_field_equals_remembered" && paths.includes(step.json_path)) ||
    (step.kind === "assert_field_type" && paths.includes(step.json_path))
  );
}

export type E4V2SpecOfRecordScenarios = {
  scenarios: E4V2Scenario[];
  unbindable_count: number;
};

export async function readBoundSpecOfRecordScenarios(workspaceDir: string): Promise<E4V2SpecOfRecordScenarios> {
  const specs = await readOpenSpecSpecOfRecord(workspaceDir);
  const scenarios: E4V2Scenario[] = [];
  let unbindableCount = 0;

  for (const capability of Object.keys(specs).toSorted()) {
    for (const parsed of parseOpenSpecScenarioBlocks(specs[capability])) {
      const bound = bindScenario(parsed);

      if (bound.ok) {
        scenarios.push(bound.scenario);
      } else {
        unbindableCount += 1;
      }
    }
  }

  return { scenarios, unbindable_count: unbindableCount };
}

// Spec-side classification given executed verdicts against gold.
export function classifyE4V2SpecChannel(input: {
  scenarios: E4V2Scenario[];
  verdicts: Array<{ passed: boolean }>;
  groundTruthIr: E4SchemaIR;
  renameLineage: E4RenameLineageLookupEntry[];
}): E4Discrepancy[] {
  const { scenarios, verdicts, groundTruthIr, renameLineage } = input;
  const discrepancies = new Map<string, E4Discrepancy>();
  const coveredEndpointUids = new Set<string>();

  const push = (discrepancy: E4Discrepancy): void => {
    const key = `${discrepancy.kind}|${discrepancy.class}|${discrepancy.item_id}`;

    if (!discrepancies.has(key)) {
      discrepancies.set(key, discrepancy);
    }
  };

  scenarios.forEach((scenario, index) => {
    const requests = scenarioRequests(scenario);
    const matched: E4Endpoint[] = [];
    const unmatched: ScenarioRequest[] = [];

    for (const request of requests) {
      const endpoint = matchTruthEndpoint(request, groundTruthIr.endpoints);

      if (endpoint) {
        matched.push(endpoint);
        coveredEndpointUids.add(endpoint.semantic_item_uid);
      } else {
        unmatched.push(request);
      }
    }

    // Amendment 2: a scenario that PASSES against gold is never a discrepancy.
    if (verdicts[index]?.passed) {
      return;
    }

    if (unmatched.length > 0) {
      for (const request of unmatched) {
        const itemId = `endpoint:${request.method} ${request.path.split("?")[0]}`;
        push({
          kind: "endpoint",
          class: "stale_claim",
          direction: "spec_vs_truth",
          item_id: itemId,
          semantic_item_uid: resolveStaleIdentity(itemId, renameLineage),
          detail: { found: `scenario: ${scenario.title}` }
        });
      }
      return;
    }

    for (const endpoint of matched) {
      push({
        kind: "endpoint",
        class: "contradiction",
        direction: "spec_vs_truth",
        item_id: renderEndpointItemId(endpoint.entity, endpoint.kind),
        semantic_item_uid: endpoint.semantic_item_uid,
        detail: { expected: `${endpoint.method} ${endpoint.path}`, found: `scenario: ${scenario.title}` }
      });
    }
  });

  for (const endpoint of groundTruthIr.endpoints) {
    if (!coveredEndpointUids.has(endpoint.semantic_item_uid)) {
      push({
        kind: "endpoint",
        class: "coverage_gap",
        direction: "spec_vs_truth",
        item_id: renderEndpointItemId(endpoint.entity, endpoint.kind),
        semantic_item_uid: endpoint.semantic_item_uid,
        detail: { expected: `${endpoint.method} ${endpoint.path}` }
      });
    }
  }

  // Convention coverage (§7.5 scope clarification): error_format kind only.
  for (const convention of groundTruthIr.conventions.filter((candidate) => candidate.kind === "error_format")) {
    const keys = envelopeKeysForStatement(convention.statement);
    const covered =
      keys !== null &&
      scenarios.some((scenario) => scenario.steps.some((step) => isEnvelopeShapeAssertion(step, keys)));

    if (!covered) {
      push({
        kind: "convention",
        class: "coverage_gap",
        direction: "spec_vs_truth",
        item_id: `convention:${convention.convention_id}`,
        semantic_item_uid: convention.semantic_item_uid,
        detail: { expected: convention.statement }
      });
    }
  }

  return [...discrepancies.values()];
}

export type E4V2DriftMeterInput = {
  workspaceDir: string; // the agent workspace (openspec/specs read; registry/schema dump read)
  groundTruthIr: E4SchemaIR;
  executorEvidence: E4ExecutorEvidence;
  renameLineage: E4RenameLineageLookupEntry[];
  executorConfig: E4ExecutorConfig;
  concurrency?: number;
};

export async function runE4V2DriftMeter(input: E4V2DriftMeterInput): Promise<E4DriftReport> {
  // ---- code channel: v1 machinery verbatim (spec side masked off) ----
  const surfaceDump = await extractSurfaceDump(input.workspaceDir);
  const codeReport = classifyE4Drift({
    triple: {
      spec: { spec_unparseable: true }, // mask: the v1 spec channel does not exist in v2
      code: "extraction_failed" in surfaceDump ? surfaceDump : surfaceDumpToInventory(surfaceDump),
      truth: truthInventory(input.groundTruthIr)
    },
    executorEvidence: input.executorEvidence,
    renameLineage: input.renameLineage,
    meterVersion: METER_VERSION_V2
  });

  // ---- spec channel: execute the living spec against the hidden gold implementation ----
  const { scenarios, unbindable_count } = await readBoundSpecOfRecordScenarios(input.workspaceDir);
  const goldDir = await mkdtemp(join(tmpdir(), "e4-v2-meter-gold-"));
  let specDiscrepancies: E4Discrepancy[] = [];

  try {
    for (const [path, contents] of Object.entries(buildE4V2AppFiles(input.groundTruthIr))) {
      await writeFile(join(goldDir, path), contents);
    }

    const verdicts = await runE4V2ScenarioSet({
      workspace_dir: goldDir,
      scenarios,
      config: input.executorConfig,
      concurrency: input.concurrency ?? 4
    });

    specDiscrepancies = classifyE4V2SpecChannel({
      scenarios,
      verdicts: verdicts.map((verdict) => ({ passed: verdict.kind === "completed" && verdict.passed })),
      groundTruthIr: input.groundTruthIr,
      renameLineage: input.renameLineage
    });
  } finally {
    await rm(goldDir, { recursive: true, force: true });
  }

  const discrepancies = [...specDiscrepancies, ...codeReport.discrepancies];

  return {
    meter_version: METER_VERSION_V2,
    discrepancies,
    // v2 semantics: true when ≥1 spec-of-record scenario failed to parse/bind under the sealed
    // grammar (those scenarios are skipped and contribute no coverage) — diagnostic, like v1.
    spec_unparseable: unbindable_count > 0,
    extraction_failed: codeReport.extraction_failed,
    registry_bypass: codeReport.registry_bypass,
    counts: buildCounts(discrepancies)
  };
}
