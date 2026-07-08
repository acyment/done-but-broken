// E4 turn adapter over the L0/L1 primitives (architecture §2.2; IMPLEMENTATION-PLAN.md M4).
// Fresh conversation per task: the harness owns the message list and rebuilds it from scratch at
// every task start — nothing conversational survives a task boundary (ADR-005 makes mid-task
// crash-restarts well-defined for the same reason).
//
// ADR-007 import boundary (lint-enforced): this module uses the allowlisted L1 parser
// (src/e1-l1-parser.ts — data-driven from a constants object, so it parses E4's grammar) and
// provider plumbing, and must never import e1-turn-adapter.ts / e1-package-runner.ts — E4's
// sequencing semantics live in src/e4/runner.ts, not in E1's turn adapter.
//
// Write application is E4-OWNED, not e1-harness's applyFullFileReplacementEntries: that function
// hard-codes E1's closed world (specs/ read-only, package.json/bunfig read-only), while E4 requires
// specs/ writable in every arm (Arm 0 spontaneously maintaining the spec is a finding, not an
// error) and gates Arm-H writability per phase through E4ArmHTaskGate.evaluateWriteAccess — the
// normative write decision (gate.ts M3 note).
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import { E1TurnParser, type E1ParsedTurn } from "../e1-l1-parser";
import { renderE1WorkspaceSnapshot } from "../e1-workspace-snapshot";
import type { E4ArmPolicy } from "./arm-policy";
import type { E4ArmHTaskGate } from "./gate";
import type { E4SealedConstants } from "./constants";
import type { E4ArmId, E4TokenUsage } from "./types";

// ---------------------------------------------------------------------------------------------
// Sealed grammar / protocol identity (constants protocol_text.block_grammar_id / turn_protocol_id;
// protocol-tested against the sealed constants file so a drifted id fails a test, not a run).
// ---------------------------------------------------------------------------------------------

export const E4_BLOCK_GRAMMAR_ID = "e4-block-grammar-v1";
export const E4_TURN_PROTOCOL_ID = "e4-turn-protocol-v1";

// Part of e4-turn-protocol-v1's sequencing semantics (sealed by the protocol id, protocol-tested):
// this many consecutive no-op turns (zero valid protocol blocks) terminate the task agent_stalled.
export const E4_STALL_NO_OP_TURN_LIMIT = 3;

// Arm-independent provider retry policy — code twin of the sealed
// `feedback.retry_policy` string (protocol-tested for agreement). Retries cost neither turns nor
// tokens: only the successful attempt's usage is ever accounted.
export const E4_PROVIDER_RETRY_POLICY = {
  max_attempts: 3,
  backoff_ms: [1000, 4000]
} as const;

export const E4_PROVIDER_RETRY_POLICY_TEXT =
  "provider-retries max_attempts=3 backoff_ms=[1000,4000] arm-independent; retries cost neither turns nor tokens";

// e4-block-grammar-v1: byte-identical delimiter tokens to the E1 grammar (Gate-0 injection 2 —
// done_literal stays the bare token; DISCOVERY pinned that richer claims would need a NEW sealed
// token, and v1 deliberately adds none). The E1 parser is data-driven from this object; it reads
// exactly block_grammar {file_open_regex, verify_open_literal, end_literal, done_literal},
// fence_stripping.opener_regex, path_grammar {regex, max_length, forbidden_segments} and (via
// command classification, whose E1-specific verdict E4 ignores) command_grammar
// {checkpoint_range, scratch_path_rules}. The cast below is the ADR-007 seam: importing the
// forbidden e1-l1-constants module for its TYPE would trip the lint, so the parser's constants
// parameter is satisfied structurally with only the fields it consumes.
const E4_PARSER_CONSTANTS = {
  block_grammar: {
    file_open_regex: "^<<<FILE ([^>]+)>>>$",
    verify_open_literal: "<<<VERIFY>>>",
    end_literal: "<<<END>>>",
    done_literal: "<<<DONE>>>"
  },
  fence_stripping: {
    opener_regex: "^(`{3,})([A-Za-z0-9_+#.-]*)\\s*$"
  },
  path_grammar: {
    regex: "^[A-Za-z0-9._-][A-Za-z0-9._/-]*$",
    max_length: 200,
    forbidden_segments: [".", ".."]
  },
  command_grammar: {
    checkpoint_range: { min: 1, max: 1 },
    scratch_path_rules: { required_prefix: "scratch/", allowed_extensions: [".ts"] }
  }
} as unknown as ConstructorParameters<typeof E1TurnParser>[0];

export function createE4TurnParser(): E1TurnParser {
  return new E1TurnParser(E4_PARSER_CONSTANTS);
}

export type { E1ParsedTurn as E4ParsedTurn };

// ---------------------------------------------------------------------------------------------
// Provider interface (architecture §2.2 E4AgentProviderFactory). The provider is stateless with
// respect to the conversation: the harness passes the full message list on every call, which is
// what makes "fresh conversation per task" a property of message assembly, not provider state.
// ---------------------------------------------------------------------------------------------

export type E4ChatRole = "system" | "user" | "assistant";

export type E4ChatMessage = { role: E4ChatRole; content: string };

export type E4ProviderTurnResult = {
  text: string;
  usage: E4TokenUsage;
  spend_usd: number;
};

export interface E4AgentProvider {
  runTurn(input: { messages: E4ChatMessage[] }): Promise<E4ProviderTurnResult>;
}

export type E4AgentProviderFactory = (input: {
  arm: E4ArmId;
  pairing_label: string;
  task_index: number;
}) => E4AgentProvider;

// ---------------------------------------------------------------------------------------------
// Prompt rendering (e4-turn-protocol-v1). The base protocol text is identical across arms; arms
// differ ONLY through their declared policy channels (standing instruction for M, gate protocol
// for H) — the parity invariant's rendering-side half.
// ---------------------------------------------------------------------------------------------

export class E4TurnProtocolError extends Error {
  constructor(message: string) {
    super(`[e4-turns] ${message}`);
    this.name = "E4TurnProtocolError";
  }
}

function requireM4Seals(constants: E4SealedConstants): {
  smoke_command: string;
  protocol_text: Record<string, string>;
} {
  if (constants.feedback === null || constants.budgets === null || constants.protocol_text === null) {
    throw new E4TurnProtocolError("constants draft is pre-M4: feedback/budgets/protocol_text must be sealed");
  }

  return { smoke_command: constants.feedback.smoke_command, protocol_text: constants.protocol_text };
}

export function renderE4SystemPrompt(input: { constants: E4SealedConstants; arm: E4ArmPolicy }): string {
  const { smoke_command, protocol_text } = requireM4Seals(input.constants);
  const budgets = input.constants.budgets!;

  const sections = [
    `You are a software engineer working on a small TypeScript HTTP API workspace. You interact with the workspace ONLY through the protocol below (${E4_TURN_PROTOCOL_ID}, ${E4_BLOCK_GRAMMAR_ID}).`,
    [
      "Protocol:",
      "- To replace a file completely, output a block of the form:",
      "<<<FILE path/relative/to/workspace>>>",
      "...the entire new file content...",
      "<<<END>>>",
      "- To run the verification (smoke) command, output a block of the form:",
      "<<<VERIFY>>>",
      smoke_command,
      "<<<END>>>",
      `  The harness starts the workspace server (bun server.ts) on a harness-allocated port and reports whether it becomes ready. \`${smoke_command}\` is the only valid verification command.`,
      "- When you believe the task is complete, output exactly this on its own line:",
      "<<<DONE>>>",
      "- Delimiters are recognized only at the start of a line. File block content is verbatim: every line between the opener and <<<END>>> becomes the file, exactly. Anything outside protocol blocks is ignored.",
      "- Processing order within one turn is always: file replacements, then verification, then DONE."
    ].join("\n"),
    `Budgets per task: ${budgets.turns_per_task} turns, ${budgets.verifications_per_task} verification runs.`
  ];

  if (input.arm.standing_instruction !== null) {
    sections.push(input.arm.standing_instruction);
  }

  if (input.arm.gate_enabled) {
    sections.push(protocol_text.arm_h_gate_protocol);
  }

  return sections.join("\n\n");
}

// The first (and only task-authored) user message: the business-natural change request plus a full
// workspace snapshot. Included roots = [""] — every workspace file (app code at the root, specs/,
// README.md) is agent-visible in every arm; the walk's excluded directories (node_modules, .git,
// harness-logs, coverage) never occur in a generated E4 workspace anyway.
export async function renderE4TaskMessage(input: { nl_request: string; workspaceDir: string }): Promise<string> {
  const snapshot = await renderE1WorkspaceSnapshot(input.workspaceDir, { includedRoots: [""] });

  return `Task:\n${input.nl_request}\n\nCurrent workspace state:\n${snapshot.text}`;
}

// ---------------------------------------------------------------------------------------------
// Write application (E4-owned; see module header). Paths arriving here already passed the L1
// path grammar (relative, no dot segments, safe alphabet); the checks below are defense in depth
// plus the Arm-H phase-guard routing.
// ---------------------------------------------------------------------------------------------

export type E4AppliedReplacement = { path: string; content: string };

export type E4RejectedReplacement = { path: string; reason: string };

export type E4ApplyResult = {
  applied: E4AppliedReplacement[];
  rejected: E4RejectedReplacement[];
  confirmations: string[];
};

export async function applyE4Replacements(input: {
  workspaceDir: string;
  replacements: Array<{ path: string; content: string }>;
  gate: E4ArmHTaskGate | null;
}): Promise<E4ApplyResult> {
  const applied: E4AppliedReplacement[] = [];
  const rejected: E4RejectedReplacement[] = [];
  const confirmations: string[] = [];

  for (const replacement of input.replacements) {
    const normalized = normalize(replacement.path);

    if (normalized.startsWith("..") || normalized.startsWith(sep) || normalized.startsWith("/")) {
      rejected.push({ path: replacement.path, reason: "path escapes the workspace" });
      continue;
    }

    if (input.gate !== null) {
      const decision = input.gate.evaluateWriteAccess(replacement.path);

      if (!decision.allowed) {
        rejected.push({
          path: replacement.path,
          reason: `not writable in the ${input.gate.phase()} phase (gate protocol)`
        });
        continue;
      }
    }

    const absolute = join(input.workspaceDir, normalized);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, replacement.content);
    applied.push({ path: replacement.path, content: replacement.content });
    confirmations.push(`applied: ${replacement.path}`);
  }

  return { applied, rejected, confirmations };
}

// ---------------------------------------------------------------------------------------------
// Turn feedback assembly (part of e4-turn-protocol-v1; deterministic given the turn's events).
// ---------------------------------------------------------------------------------------------

export type E4TurnFeedbackSections = {
  confirmations: string[];
  rejections: E4RejectedReplacement[];
  violations: Array<{ code: string; line: number; detail: string }>;
  verification: string | null;
  gate: string | null;
  no_op: boolean;
};

export function renderE4TurnFeedback(sections: E4TurnFeedbackSections): string {
  const lines: string[] = [];

  for (const confirmation of sections.confirmations) {
    lines.push(confirmation);
  }

  for (const rejection of sections.rejections) {
    lines.push(`write rejected: ${rejection.path} — ${rejection.reason}`);
  }

  for (const violation of sections.violations) {
    lines.push(`protocol violation (${violation.code}, line ${violation.line}): ${violation.detail}`);
  }

  if (sections.verification !== null) {
    lines.push(sections.verification);
  }

  if (sections.gate !== null) {
    lines.push(sections.gate);
  }

  if (lines.length === 0 && sections.no_op) {
    lines.push(
      "no valid protocol blocks recognized in your last output. Use <<<FILE path>>> ... <<<END>>>, <<<VERIFY>>> ... <<<END>>>, or <<<DONE>>>."
    );
  }

  return lines.join("\n");
}
