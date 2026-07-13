// v2 turn adapter (E4V2 design §2/§6; v2-M5). Reuses the v1 adapter's sealed grammar/parser,
// retry policy, stall rule, provider interface, and feedback assembly (src/e4/turns.ts — all
// arm- and version-neutral), and replaces the two v1-shaped pieces:
//   prompt rendering — the base protocol now documents the shared OpenSpec workflow (both arms;
//     the workflow is task-environment, not treatment), and the EXECUTED arm's declared policy
//     channel adds only the scenario-execution mechanics (whether the spec runs is the arms'
//     only difference);
//   write application — every FILE replacement routes through the v2 gate's shared workflow
//     guards in BOTH arms (openspec/specs and the archive are harness-owned everywhere).
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import { renderE1WorkspaceSnapshot } from "../../e1-workspace-snapshot";
import type { E4V2TaskGate } from "./gate";
import type { E4V2SealedConstants } from "./constants";
import type { E4V2ArmPolicy } from "./arm-policy";

export {
  createE4TurnParser,
  renderE4TurnFeedback,
  E4_BLOCK_GRAMMAR_ID,
  E4_TURN_PROTOCOL_ID,
  E4_STALL_NO_OP_TURN_LIMIT,
  E4_PROVIDER_RETRY_POLICY,
  E4_PROVIDER_RETRY_POLICY_TEXT,
  E4TurnProtocolError,
  type E4AgentProvider,
  type E4AgentProviderFactory,
  type E4ChatMessage,
  type E4ProviderTurnResult,
  type E4ParsedTurn
} from "../turns";
import { E4TurnProtocolError } from "../turns";

// Base protocol text vs the arm's declared policy channel, separated for the prompt-overhead
// diagnostic (base is arm-identical by construction; the v2 parity validator checks it).
export function renderE4V2SystemPromptParts(input: {
  constants: E4V2SealedConstants;
  arm: E4V2ArmPolicy;
}): { base: string; channel: string | null } {
  const text = input.constants.protocol_text;
  const budgets = input.constants.budgets;

  const base = [
    `You are a software engineer working on a small TypeScript HTTP API workspace. You interact with the workspace ONLY through the protocol below (${text.turn_protocol_id}, ${text.block_grammar_id}).`,
    [
      "Protocol:",
      "- To replace a file completely, output a block of the form:",
      "<<<FILE path/relative/to/workspace>>>",
      "...the entire new file content...",
      "<<<END>>>",
      "- To run the verification (smoke) command, output a block of the form:",
      "<<<VERIFY>>>",
      input.constants.feedback.smoke_command,
      "<<<END>>>",
      `  The harness starts the workspace server (bun server.ts) on a harness-allocated port and reports whether it becomes ready. \`${input.constants.feedback.smoke_command}\` is the only valid verification command.`,
      "- When you believe the current phase's work is complete, output exactly this on its own line:",
      "<<<DONE>>>",
      "- Delimiters are recognized only at the start of a line. File block content is verbatim. Anything outside protocol blocks is ignored.",
      "- Processing order within one turn is always: file replacements, then verification, then DONE."
    ].join("\n"),
    text.workflow_protocol,
    `Budgets per task: ${budgets.turns_per_task} turns, ${budgets.verifications_per_task} verification runs.`
  ].join("\n\n");

  const channel = input.arm.arm_mode === "executed" ? text.executed_arm_gate_protocol : null;

  return { base, channel };
}

export function renderE4V2SystemPrompt(input: { constants: E4V2SealedConstants; arm: E4V2ArmPolicy }): string {
  const { base, channel } = renderE4V2SystemPromptParts(input);
  return channel === null ? base : `${base}\n\n${channel}`;
}

export async function renderE4V2TaskMessage(input: { nl_request: string; workspaceDir: string }): Promise<string> {
  const snapshot = await renderE1WorkspaceSnapshot(input.workspaceDir, { includedRoots: [""] });
  return `Task:\n${input.nl_request}\n\nCurrent workspace state:\n${snapshot.text}`;
}

// ---------------------------------------------------------------------------------------------
// Write application (v2): the gate's shared workflow guards apply in BOTH arms.
// ---------------------------------------------------------------------------------------------

// [P0V.1: V1] prior_content is the file's bytes immediately before this write (null = the file
// did not exist) — the off-topic classifier's novel-occurrence rule compares against it.
export type E4V2AppliedReplacement = { path: string; content: string; prior_content: string | null };
export type E4V2RejectedReplacement = { path: string; reason: string };

export type E4V2ApplyResult = {
  applied: E4V2AppliedReplacement[];
  rejected: E4V2RejectedReplacement[];
  confirmations: string[];
};

export async function applyE4V2Replacements(input: {
  workspaceDir: string;
  replacements: Array<{ path: string; content: string }>;
  // structural: the v3 product gate exposes the same guard surface (v3-M3)
  gate: Pick<E4V2TaskGate, "evaluateWriteAccess" | "phase">;
}): Promise<E4V2ApplyResult> {
  const applied: E4V2AppliedReplacement[] = [];
  const rejected: E4V2RejectedReplacement[] = [];
  const confirmations: string[] = [];

  for (const replacement of input.replacements) {
    const normalized = normalize(replacement.path);

    if (normalized.startsWith("..") || normalized.startsWith(sep) || normalized.startsWith("/")) {
      rejected.push({ path: replacement.path, reason: "path escapes the workspace" });
      continue;
    }

    const decision = input.gate.evaluateWriteAccess(replacement.path);

    if (!decision.allowed) {
      rejected.push({
        path: replacement.path,
        reason: `not writable in the ${input.gate.phase()} phase (workflow guards)`
      });
      continue;
    }

    const absolute = join(input.workspaceDir, normalized);
    let priorContent: string | null = null;

    try {
      priorContent = await readFile(absolute, "utf8");
    } catch {
      priorContent = null; // new file
    }

    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, replacement.content);
    applied.push({ path: replacement.path, content: replacement.content, prior_content: priorContent });
    confirmations.push(`applied: ${replacement.path}`);
  }

  return { applied, rejected, confirmations };
}

// The full openspec/** file map (workspace-relative → bytes) — the v2 gate's custody input.
export async function readE4V2OpenSpecTree(workspaceDir: string): Promise<Record<string, string>> {
  const tree: Record<string, string> = {};
  const root = join(workspaceDir, "openspec");
  let entries: string[];

  try {
    entries = (await readdir(root, { recursive: true })) as string[];
  } catch {
    return tree;
  }

  for (const entry of entries.toSorted()) {
    try {
      tree[`openspec/${entry.replaceAll(sep, "/")}`] = await readFile(join(root, entry), "utf8");
    } catch {
      // directory entry
    }
  }

  return tree;
}

export function assertV2ConstantsRunnable(constants: E4V2SealedConstants): void {
  if (!constants.budgets || !constants.protocol_text?.workflow_protocol) {
    throw new E4TurnProtocolError("v2 constants are not runnable: budgets/protocol_text must be present");
  }
}

// ---------------------------------------------------------------------------------------------
// Glue-aware protocol feedback (E5 P0-V item 3). The sealed E1 parser recognizes delimiters only
// at the start of a line and flags lines that START with "<<<" but match no token — the one
// SILENT case (E4-ARC-CLOSEOUT §5.1, ≈85 wasted turns + all 3 stalls) is a delimiter glued
// AFTER prose ("Here's the file: <<<FILE x>>>"), which parses as ignorable text. This detector
// mirrors the parser's block-span walk (same line split, same trailing-whitespace strip, same
// sealed opener/closer forms) so file/verify block CONTENT is never flagged, and reports the
// glued line as a synthetic protocol violation merged into the ordinary feedback channel. The
// sealed parser core (src/e1-l1-parser.ts) is byte-untouched; parse results, the no-op rule,
// and the stall rule are unchanged — this adds feedback text only.
// ---------------------------------------------------------------------------------------------

const E4_V2_GLUE_FILE_OPEN_RE = /^<<<FILE ([^>]+)>>>$/;
const E4_V2_GLUE_VERIFY_LITERAL = "<<<VERIFY>>>";
const E4_V2_GLUE_END_LITERAL = "<<<END>>>";
const E4_V2_GLUE_TOKENS = ["<<<FILE ", "<<<VERIFY>>>", "<<<END>>>", "<<<DONE>>>"] as const;

export type E4V2GluedDelimiterViolation = { code: "delimiter_glued"; line: number; detail: string };

export function detectE4V2GluedDelimiters(rawOutput: string): E4V2GluedDelimiterViolation[] {
  const lines = rawOutput.split("\n");
  const violations: E4V2GluedDelimiterViolation[] = [];
  // In-block glued END candidates are reported only if the block never closes (otherwise they
  // are legitimate verbatim content of a properly closed block).
  let pendingInBlock: E4V2GluedDelimiterViolation[] = [];
  let inBlock = false;

  const gluedToken = (delimiter: string): { token: string; at: number } | null => {
    for (const token of E4_V2_GLUE_TOKENS) {
      const at = delimiter.indexOf(token);

      if (at > 0) {
        return { token: token === "<<<FILE " ? "<<<FILE …>>>" : token, at };
      }
    }

    return null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = index + 1;
    const delimiter = lines[index].replace(/[ \t\r]+$/, "");

    if (inBlock) {
      if (delimiter === E4_V2_GLUE_END_LITERAL) {
        inBlock = false;
        pendingInBlock = [];
      } else {
        const glued = gluedToken(delimiter);

        if (glued && glued.token === E4_V2_GLUE_END_LITERAL) {
          // [P0V.1: S4] conditional wording: the prose arm accepts done-claims unconditionally,
          // so an imperative "put X on its own line" could induce the very protocol action a
          // merely-narrated delimiter never intended.
          pendingInBlock.push({
            code: "delimiter_glued",
            line,
            detail: `text precedes the delimiter ${glued.token} on line ${line}; delimiters are recognized only at the start of a line — if this was meant to close the block, put ${glued.token} on its own line`
          });
        }
      }
      continue;
    }

    if (E4_V2_GLUE_FILE_OPEN_RE.test(delimiter) || delimiter === E4_V2_GLUE_VERIFY_LITERAL) {
      inBlock = true;
      continue;
    }

    if (delimiter.startsWith("<<<")) {
      continue; // the sealed parser already reports these (unrecognized_protocol_line / orphan_end)
    }

    const glued = gluedToken(delimiter);

    if (glued) {
      // [P0V.1: S4] conditional wording — see above.
      violations.push({
        code: "delimiter_glued",
        line,
        detail: `text precedes the delimiter ${glued.token} on line ${line}; delimiters are recognized only at the start of a line — if this was meant as a protocol command, put it on its own line`
      });
    }
  }

  return [...violations, ...(inBlock ? pendingInBlock : [])].toSorted((a, b) => a.line - b.line);
}
