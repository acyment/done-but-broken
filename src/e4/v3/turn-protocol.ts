// E4 v3-M3 (E4V3-PRODUCT-LOOP-PROPOSAL.md §3 "PM brief", operator-ratified realization): the
// clarification channel's transport is a turn-protocol token — the agent asks the way it claims
// done, so WHO ASKED, WHEN is a recorded observable in every arm (a workspace file would make
// reading invisible; free-text Q&A was rejected at the proposal gate for determinism/parity).
//
// e4-turn-protocol-v2 = the sealed v1 grammar (FILE / VERIFY / DONE — parser byte-untouched)
// plus exactly one new token, recognized by a PRE-PASS that strips it before the v1 parser runs.
// Same delimiter discipline: start-of-line, whole-line literal. Processing order within a turn:
// file replacements, verification, PM brief, then DONE (the sealed v1 order with the brief
// slotted before DONE).
export const E4_V3_TURN_PROTOCOL_ID = "e4-turn-protocol-v2";
export const E4_V3_ASK_PM_LITERAL = "<<<ASK_PM>>>";

export type E4V3AskPmPrePass = {
  text: string; // raw output with ASK_PM lines removed — what the sealed v1 parser sees
  ask_pm: boolean;
};

export function extractAskPm(rawText: string): E4V3AskPmPrePass {
  const lines = rawText.split(/\r\n|\r|\n/);
  const kept: string[] = [];
  let askPm = false;

  for (const line of lines) {
    if (line.trimEnd() === E4_V3_ASK_PM_LITERAL) {
      askPm = true;
      continue;
    }

    kept.push(line);
  }

  return { text: askPm ? kept.join("\n") : rawText, ask_pm: askPm };
}

// Appended to the arm-identical BASE prompt in v3 runs (shared task environment — the brief is
// available identically in every arm; profile e4-openspec-workflow-v2). Draft wording; seals
// under the v3 constants protocol_text at the v3 freeze.
export const E4_V3_ASK_PM_PROTOCOL_TEXT = [
  "- If the task request leaves out details you need (fields, exact validation rules, which operations to provide), you can ask the product manager for the precise requirements by outputting exactly this on its own line:",
  E4_V3_ASK_PM_LITERAL,
  "  The PM's written brief for the current task is returned as feedback. Asking costs a normal turn and is available at any point in the task."
].join("\n");
