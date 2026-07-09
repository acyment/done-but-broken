// Typed scenario/step model for the v2 executable-spec pipeline (E4V2 design §5.2/§5.3). A
// scenario is an ordered list of typed steps; each step renders to EXACTLY one sealed §5.3
// step-pattern instance. The v2-M2 converter + sealed step table parse agent-authored markdown
// back into this same model — text in, typed AST out — so the §5.5 gold templates (which are
// built directly as typed steps) and agent scenarios execute through one engine.
import { canonicalizeOpenSpecScenarioText } from "../../e1-openspec-harness";

export type E4V2AssertableJsonType = "string" | "number" | "boolean" | "array" | "object";

export type E4V2Step =
  // Request-class steps (WHEN / AND-after-WHEN):
  | { kind: "request"; method: "GET" | "DELETE"; path: string }
  | { kind: "request_body"; method: "POST" | "PUT" | "PATCH"; path: string; body_json: string } // single-line JSON literal
  | { kind: "remember"; json_path: string; name: string }
  // Assertion-class steps (THEN / AND-after-THEN):
  | { kind: "assert_status"; status: number }
  | { kind: "assert_field_equals"; json_path: string; literal_json: string }
  | { kind: "assert_field_equals_remembered"; json_path: string; name: string }
  | { kind: "assert_body_equals"; literal_json: string }
  | { kind: "assert_no_field"; json_path: string }
  | { kind: "assert_list_length"; length: number }
  | { kind: "assert_field_type"; json_path: string; json_type: E4V2AssertableJsonType };

export type E4V2Scenario = {
  title: string;
  steps: E4V2Step[];
};

const REQUEST_STEP_KINDS = new Set(["request", "request_body", "remember"]);

export function isRequestClassStep(step: E4V2Step): boolean {
  return REQUEST_STEP_KINDS.has(step.kind);
}

// Value-binding assertion forms per the §5.3 strength classes (custody-floor input, A3/A8):
// field/body equality, forbidden-field, and list-length bind values; status and type checks are
// weak.
export function isValueBindingAssertion(step: E4V2Step): boolean {
  return (
    step.kind === "assert_field_equals" ||
    step.kind === "assert_field_equals_remembered" ||
    step.kind === "assert_body_equals" ||
    step.kind === "assert_no_field" ||
    step.kind === "assert_list_length"
  );
}

// Renders one typed step to its sealed §5.3 pattern instance — these strings ARE the vocabulary
// the workspace README documents and the v2-M2 step table re-parses.
export function renderStepText(step: E4V2Step): string {
  switch (step.kind) {
    case "request":
      return `I send a ${step.method} request to "${step.path}"`;
    case "request_body":
      return `I send a ${step.method} request to "${step.path}" with body ${step.body_json}`;
    case "remember":
      return `I remember the response field "${step.json_path}" as "${step.name}"`;
    case "assert_status":
      return `the response status is ${step.status}`;
    case "assert_field_equals":
      return `the response field "${step.json_path}" equals ${step.literal_json}`;
    case "assert_field_equals_remembered":
      return `the response field "${step.json_path}" equals the remembered "${step.name}"`;
    case "assert_body_equals":
      return `the response body equals ${step.literal_json}`;
    case "assert_no_field":
      return `the response has no field "${step.json_path}"`;
    case "assert_list_length":
      return `the response list has length ${step.length}`;
    case "assert_field_type":
      return `the response field "${step.json_path}" is a ${step.json_type}`;
  }
}

// Bolded keyword bullets in the openspec-gherkin-v1 surface shape (§5.1): the first step of a
// class run gets its concrete keyword (WHEN for request-class, THEN for assertion-class); each
// subsequent step of the SAME class binds via AND.
export function scenarioBulletLines(scenario: E4V2Scenario): string[] {
  const lines: string[] = [];
  let previousClassIsRequest: boolean | null = null;

  for (const step of scenario.steps) {
    const requestClass = isRequestClassStep(step);
    const keyword = previousClassIsRequest === requestClass ? "AND" : requestClass ? "WHEN" : "THEN";
    lines.push(`- **${keyword}** ${renderStepText(step)}`);
    previousClassIsRequest = requestClass;
  }

  return lines;
}

// Canonical form for the §6 novelty check, computed via the estate canonicalizer precedent
// (`e1-openspec-scenario-canonicalizer-v1`: strip Gherkin keywords, bold markers, bullets, case,
// whitespace). Canonical identity is the step BODY only — retitling an otherwise-identical
// scenario is presentation, not novelty (the same rule the E1 survival ledger applies).
export function canonicalScenarioBody(scenario: E4V2Scenario): string {
  return canonicalizeOpenSpecScenarioText(scenarioBulletLines(scenario).join("\n"));
}
