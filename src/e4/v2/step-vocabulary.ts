// The agent-facing §5.3 step-pattern vocabulary (E4V2 design §5.3/§5.5). These display strings
// are what the v2 workspace README carries VERBATIM (patterns, not implementations — the v1
// Gate-1 "README carries the grammar verbatim" pin, transferred) and what the sealed v2-M2 step
// table binds 1:1 to anchored regexes. One source; the README renders it, the step table
// cross-checks against it, and the M5 freeze seals it under protocol_text.
export const E4_V2_REQUEST_STEP_PATTERNS: readonly string[] = [
  'I send a GET request to "<path>"',
  'I send a DELETE request to "<path>"',
  'I send a POST request to "<path>" with body <json>',
  'I send a PUT request to "<path>" with body <json>',
  'I send a PATCH request to "<path>" with body <json>',
  'I remember the response field "<json.path>" as "<name>"'
];

export const E4_V2_ASSERTION_STEP_PATTERNS: readonly string[] = [
  "the response status is <int>",
  'the response field "<json.path>" equals <json-literal>',
  'the response field "<json.path>" equals the remembered "<name>"',
  "the response body equals <json-literal>",
  'the response has no field "<json.path>"',
  "the response list has length <int>",
  'the response field "<json.path>" is a <string|number|boolean|array|object>'
];

// A3/A8 custody floors, verbatim (checked at spec-exit in BOTH arms — spec-quality lint, not
// execution).
export const E4_V2_FLOORS_TEXT: readonly string[] = [
  "Every scenario has at least one THEN step.",
  "Every scenario has at least one value-binding assertion (a field/body equality, a forbidden-field check, or a list-length check).",
  "Statuses are exact integers (no status classes).",
  "All string literals are quoted.",
  "No step text outside the patterns above is legal."
];
