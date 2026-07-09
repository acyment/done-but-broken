// `e4-step-table-v1` (E4V2 design §5.3, sealed): the harness-owned step-pattern table binding
// parsed step text to typed step-AST nodes. Anchored regexes over fully-quoted literals; every
// step's text must FULLY match exactly one pattern (a JSON-literal capture must parse, single
// line) or the step is a grammar violation → custody failure quoting the offending line. The
// table is the code twin of the README vocabulary (src/e4/v2/step-vocabulary.ts) — one display
// string per pattern, cross-checked by test — and seals with a pinned hash at the v2-M5 freeze
// (§5.4). PATCH is the Amendment-2 request form.
//
// Keyword-class binding (§5.2/§5.3): request-class steps bind under WHEN (or AND/BUT after a
// request-class step); assertion-class steps bind under THEN (or AND/BUT after an assertion).
// GIVEN carries no legal patterns in v1 of the table — the vocabulary has no setup steps
// (per-scenario hermetic execution resets state to seed), so any GIVEN step is a violation.
import type { E4ParsedScenario, E4ParsedStep } from "./converter";
import type { E4V2AssertableJsonType, E4V2Scenario, E4V2Step } from "./scenario";

export const E4_STEP_TABLE_ID = "e4-step-table-v1";

const JSON_PATH = /^[^"]+$/; // dot-separated object path; quoted capture, no embedded quotes
const REMEMBER_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/; // substitutable as {name} — word chars only

function parseJsonLiteral(text: string): { ok: true; canonical_source: string } | { ok: false } {
  try {
    JSON.parse(text);
    return { ok: true, canonical_source: text };
  } catch {
    return { ok: false };
  }
}

type StepPatternDefinition = {
  pattern_id: string;
  step_class: "request" | "assertion";
  regex: RegExp;
  // Returns the typed node, or null when a capture fails its typed constraint (JSON must parse,
  // names must be substitutable) — a null is NOT a match.
  build(match: RegExpMatchArray): E4V2Step | null;
};

// Pattern order is part of the sealed table. Fixed-form patterns precede the JSON-literal
// trailing-capture forms they could otherwise overlap ("equals the remembered …" vs "equals
// <json-literal>"): the JSON-parse constraint already disambiguates, and the exactly-one-match
// binder below enforces it structurally.
export const E4_STEP_TABLE: readonly StepPatternDefinition[] = [
  {
    pattern_id: "request-no-body",
    step_class: "request",
    regex: /^I send a (GET|DELETE) request to "([^"]*)"$/,
    build: (match) => ({ kind: "request", method: match[1] as "GET" | "DELETE", path: match[2] })
  },
  {
    pattern_id: "request-with-body",
    step_class: "request",
    regex: /^I send a (POST|PUT|PATCH) request to "([^"]*)" with body (.+)$/,
    build: (match) => {
      const literal = parseJsonLiteral(match[3]);
      return literal.ok
        ? { kind: "request_body", method: match[1] as "POST" | "PUT" | "PATCH", path: match[2], body_json: match[3] }
        : null;
    }
  },
  {
    pattern_id: "remember-field",
    step_class: "request",
    regex: /^I remember the response field "([^"]*)" as "([^"]*)"$/,
    build: (match) =>
      JSON_PATH.test(match[1]) && REMEMBER_NAME.test(match[2])
        ? { kind: "remember", json_path: match[1], name: match[2] }
        : null
  },
  {
    pattern_id: "assert-status",
    step_class: "assertion",
    regex: /^the response status is (\d+)$/,
    build: (match) => ({ kind: "assert_status", status: Number(match[1]) })
  },
  {
    pattern_id: "assert-field-equals-remembered",
    step_class: "assertion",
    regex: /^the response field "([^"]*)" equals the remembered "([^"]*)"$/,
    build: (match) =>
      JSON_PATH.test(match[1]) && REMEMBER_NAME.test(match[2])
        ? { kind: "assert_field_equals_remembered", json_path: match[1], name: match[2] }
        : null
  },
  {
    pattern_id: "assert-field-equals",
    step_class: "assertion",
    regex: /^the response field "([^"]*)" equals (.+)$/,
    build: (match) => {
      const literal = parseJsonLiteral(match[2]);
      return JSON_PATH.test(match[1]) && literal.ok
        ? { kind: "assert_field_equals", json_path: match[1], literal_json: match[2] }
        : null;
    }
  },
  {
    pattern_id: "assert-body-equals",
    step_class: "assertion",
    regex: /^the response body equals (.+)$/,
    build: (match) => {
      const literal = parseJsonLiteral(match[1]);
      return literal.ok ? { kind: "assert_body_equals", literal_json: match[1] } : null;
    }
  },
  {
    pattern_id: "assert-no-field",
    step_class: "assertion",
    regex: /^the response has no field "([^"]*)"$/,
    build: (match) => (JSON_PATH.test(match[1]) ? { kind: "assert_no_field", json_path: match[1] } : null)
  },
  {
    pattern_id: "assert-list-length",
    step_class: "assertion",
    regex: /^the response list has length (\d+)$/,
    build: (match) => ({ kind: "assert_list_length", length: Number(match[1]) })
  },
  {
    pattern_id: "assert-field-type",
    step_class: "assertion",
    regex: /^the response field "([^"]*)" is a (string|number|boolean|array|object)$/,
    build: (match) =>
      JSON_PATH.test(match[1])
        ? { kind: "assert_field_type", json_path: match[1], json_type: match[2] as E4V2AssertableJsonType }
        : null
  }
];

export type E4StepBindingViolation = {
  scenario_title: string;
  step_text: string; // the offending line's step text, quoted back in custody feedback
  reason: string; // fixed-vocabulary violation strings
};

export type E4ScenarioBindResult =
  | { ok: true; scenario: E4V2Scenario }
  | { ok: false; violations: E4StepBindingViolation[] };

type MatchedStep = { definition: StepPatternDefinition; node: E4V2Step };

function matchStepText(text: string): MatchedStep[] {
  const matches: MatchedStep[] = [];

  for (const definition of E4_STEP_TABLE) {
    const match = text.match(definition.regex);

    if (!match) {
      continue;
    }

    const node = definition.build(match);

    if (node !== null) {
      matches.push({ definition, node });
    }
  }

  return matches;
}

// Binds one parsed scenario against the sealed table: every step must fully match exactly one
// pattern AND sit under a legal keyword for its class. Violations carry fixed-vocabulary
// reasons and the offending step text (custody feedback quotes the line).
export function bindScenario(parsed: E4ParsedScenario): E4ScenarioBindResult {
  const violations: E4StepBindingViolation[] = [];
  const steps: E4V2Step[] = [];
  let previousClass: "request" | "assertion" | null = null;

  for (const step of parsed.steps) {
    const matches = matchStepText(step.text);

    if (matches.length === 0) {
      violations.push({
        scenario_title: parsed.title,
        step_text: step.text,
        reason: "step text matches no pattern in the sealed step table"
      });
      previousClass = null;
      continue;
    }

    if (matches.length > 1) {
      violations.push({
        scenario_title: parsed.title,
        step_text: step.text,
        reason: `step text matches more than one pattern (${matches.map((entry) => entry.definition.pattern_id).join(", ")})`
      });
      previousClass = null;
      continue;
    }

    const { definition, node } = matches[0];
    const keywordOk =
      definition.step_class === "request"
        ? step.keyword === "When" || ((step.keyword === "And" || step.keyword === "But") && previousClass === "request")
        : step.keyword === "Then" || ((step.keyword === "And" || step.keyword === "But") && previousClass === "assertion");

    if (!keywordOk) {
      violations.push({
        scenario_title: parsed.title,
        step_text: step.text,
        reason:
          definition.step_class === "request"
            ? `request step bound under ${step.keyword} — request steps are WHEN (or AND after a WHEN)`
            : `assertion step bound under ${step.keyword} — assertion steps are THEN (or AND after a THEN)`
      });
      previousClass = null;
      continue;
    }

    steps.push(node);
    previousClass = definition.step_class;
  }

  if (violations.length > 0) {
    return { ok: false, violations };
  }

  return { ok: true, scenario: { title: parsed.title, steps } };
}

// A3/A8 custody floors over a BOUND scenario (spec-quality lint, checked at spec-exit in both
// arms; statuses-are-integers and quoted-literals hold by construction once binding succeeded).
export function scenarioFloorViolations(scenario: E4V2Scenario): string[] {
  const violations: string[] = [];
  const requestSteps = scenario.steps.filter(
    (step) => step.kind === "request" || step.kind === "request_body" || step.kind === "remember"
  );
  const assertionSteps = scenario.steps.filter(
    (step) => step.kind !== "request" && step.kind !== "request_body" && step.kind !== "remember"
  );
  const valueBinding = scenario.steps.filter(
    (step) =>
      step.kind === "assert_field_equals" ||
      step.kind === "assert_field_equals_remembered" ||
      step.kind === "assert_body_equals" ||
      step.kind === "assert_no_field" ||
      step.kind === "assert_list_length"
  );

  if (requestSteps.length === 0) {
    violations.push("scenario sends no request");
  }

  if (assertionSteps.length === 0) {
    violations.push("scenario has no THEN assertion");
  }

  if (valueBinding.length === 0) {
    violations.push("scenario has no value-binding assertion");
  }

  return violations;
}
