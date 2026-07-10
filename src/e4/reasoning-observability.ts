// E4 v2-M8 reasoning-observability instrument (BUILD ONLY — no live calls made by this module).
//
// Purpose (scoping doc docs/protocols/e4-v2-m8-glm52-replication-scoping-v1.md §4/§5): when GLM 5.2
// is run thinking-ON, extended reasoning burns billed tokens that are NOT part of the agent-visible
// transcript. This module lets the (separately-authorized) §5 smoke answer two setup-time validity
// questions over RECORDED responses — never per-turn, never inside the retry ladders:
//   §4(a) is reasoning actually active?  (choices[0].message.reasoning_content non-empty, or
//         usage.completion_tokens_details.reasoning_tokens > 0)
//   §4(b) are reasoning tokens honestly counted? — does usage.completion_tokens already INCLUDE
//         reasoning_tokens (folded-in ⇒ budget already honest) or are they reported SEPARATELY /
//         excluded (⇒ an E4-side budget adjustment will be needed before calibration)?
//
// Discipline this module observes (§2, task constraints):
//   * E4-SIDE ONLY. It reads the raw OpenAI-compatible response body — the same body §2 notes is
//     already preserved in the provider exchange artifact — and touches NO sealed/shared E1
//     extraction code (src/e1-live-provider.ts is unchanged). ADR-007 allowlist: only the provider
//     plumbing types from e1-live-provider are imported.
//   * ADDITIVE. Nothing here changes transcript/text behavior. Reasoning content is read as a
//     side-channel signal for analysis and is NEVER fed back into the conversation.
//   * PURE ANALYSIS. reasoningIsActive / classifyReasoningTokenAccounting are pure functions over a
//     recorded body. The recording transport is a passthrough tee — it forwards the base transport's
//     response unchanged and only keeps a copy for later analysis.
import type {
  E1ProviderTransport,
  E1ProviderTransportRequest,
  E1ProviderTransportResponse
} from "../e1-live-provider";

// ---------------------------------------------------------------------------------------------
// Recording transport (E4-side capture of the raw response body the exchange artifact also holds)
// ---------------------------------------------------------------------------------------------

export type RecordedExchange = {
  request: E1ProviderTransportRequest;
  response: E1ProviderTransportResponse;
};

/**
 * Wrap a base transport (live fetch, or a canned test transport) so every exchange body is captured
 * for §4 analysis. The wrapper is a pure tee: it returns the base response unchanged and preserves
 * `transport_kind` (so a live base stays live and the E1 live-gate still applies). It records only —
 * the captured reasoning is never re-injected into any request.
 */
export function createRecordingTransport(base: E1ProviderTransport): {
  transport: E1ProviderTransport;
  records: RecordedExchange[];
} {
  const records: RecordedExchange[] = [];

  return {
    records,
    transport: {
      transport_kind: base.transport_kind,
      async send(request) {
        const response = await base.send(request);
        records.push({ request, response });
        return response;
      }
    }
  };
}

// ---------------------------------------------------------------------------------------------
// §4(a) — is reasoning active?
// ---------------------------------------------------------------------------------------------

/** The reasoning trace text z.ai emits when thinking is on (choices[0].message.reasoning_content). */
export function extractReasoningContent(body: unknown): string {
  const message = asRecord(asRecordArray(asRecord(body).choices)[0]).message;
  const reasoning = asRecord(message).reasoning_content;

  return typeof reasoning === "string" ? reasoning : "";
}

/**
 * The agent-visible answer text (choices[0].message.content). Tolerant, NON-throwing — unlike the
 * sealed E1 extractor this is a validity probe, so an absent/odd content field reads as "" rather
 * than raising. String or content-part array both supported.
 */
export function extractVisibleContent(body: unknown): string {
  const content = asRecord(asRecord(asRecordArray(asRecord(body).choices)[0]).message).content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((part) => (typeof asRecord(part).text === "string" ? (asRecord(part).text as string) : "")).join("");
  }

  return "";
}

/** usage.completion_tokens_details.reasoning_tokens, if the body carries the side count. */
export function extractReasoningTokens(body: unknown): number | null {
  const details = asRecord(asRecord(asRecord(body).usage ?? {}).completion_tokens_details ?? {});

  return optionalNonNegativeInteger(details.reasoning_tokens);
}

/** usage.completion_tokens, if present. */
export function extractCompletionTokens(body: unknown): number | null {
  return optionalNonNegativeInteger(asRecord(asRecord(body).usage ?? {}).completion_tokens);
}

/**
 * §4(a): reasoning is active iff a non-empty reasoning_content trace is present OR the usage carries
 * a positive reasoning_tokens side count. Either signal is sufficient; z.ai documents the former as
 * the primary tell (docs.z.ai/guides/capabilities/thinking-mode).
 */
export function reasoningIsActive(body: unknown): boolean {
  if (extractReasoningContent(body).trim().length > 0) {
    return true;
  }

  const reasoningTokens = extractReasoningTokens(body);

  return reasoningTokens !== null && reasoningTokens > 0;
}

// ---------------------------------------------------------------------------------------------
// §4(b) — are reasoning tokens honestly counted?
// ---------------------------------------------------------------------------------------------

// folded    → completion_tokens already includes reasoning_tokens (standard OpenAI-compatible
//             behavior: completion_tokens = reasoning_tokens + visible_output_tokens). Budget honest.
// separate  → reasoning_tokens are reported separately AND excluded from completion_tokens. The
//             sealed budget ledger / derived cost would UNDERCOUNT ⇒ the §2 E4-side adjustment is
//             needed before calibration.
// indeterminate → not enough in the usage block to decide (no separate reasoning_tokens count, or no
//             completion_tokens). Reasoning may still be active via reasoning_content; the accounting
//             question just can't be answered from this response's usage alone.
export type ReasoningTokenAccounting = "folded" | "separate" | "indeterminate";

export type ReasoningTokenAccountingReport = {
  accounting: ReasoningTokenAccounting;
  completion_tokens: number | null;
  reasoning_tokens: number | null;
  visible_content_present: boolean;
  rationale: string;
};

/**
 * §4(b) classifier. Keyed on the arithmetic invariant of folded accounting:
 *   completion_tokens = reasoning_tokens + visible_output_tokens  ⇒  completion_tokens >= reasoning_tokens,
 * and strictly greater whenever a visible answer exists. So:
 *   - reasoning_tokens > completion_tokens                         → separate (folding is impossible)
 *   - reasoning_tokens == completion_tokens AND visible present    → separate (a visible answer exists,
 *                                                                     yet completion counts reasoning
 *                                                                     alone ⇒ visible tokens excluded)
 *   - otherwise (completion > reasoning, or equal w/ no visible)   → folded
 *   - missing reasoning_tokens or completion_tokens                → indeterminate
 * The tie-break needs no token estimator — it turns only on whether visible content is present.
 */
export function classifyReasoningTokenAccounting(body: unknown): ReasoningTokenAccountingReport {
  const completion_tokens = extractCompletionTokens(body);
  const reasoning_tokens = extractReasoningTokens(body);
  const visible_content_present = extractVisibleContent(body).trim().length > 0;

  if (reasoning_tokens === null || completion_tokens === null) {
    return {
      accounting: "indeterminate",
      completion_tokens,
      reasoning_tokens,
      visible_content_present,
      rationale:
        reasoning_tokens === null
          ? "no completion_tokens_details.reasoning_tokens side count to compare against completion_tokens"
          : "no usage.completion_tokens reported"
    };
  }

  if (reasoning_tokens > completion_tokens) {
    return {
      accounting: "separate",
      completion_tokens,
      reasoning_tokens,
      visible_content_present,
      rationale: `reasoning_tokens (${reasoning_tokens}) exceeds completion_tokens (${completion_tokens}) — folding is arithmetically impossible, so completion_tokens excludes reasoning`
    };
  }

  if (reasoning_tokens === completion_tokens && visible_content_present) {
    return {
      accounting: "separate",
      completion_tokens,
      reasoning_tokens,
      visible_content_present,
      rationale: `completion_tokens equals reasoning_tokens (${completion_tokens}) yet a visible answer is present — visible output tokens are not in completion_tokens, so reasoning is not folded together with them`
    };
  }

  return {
    accounting: "folded",
    completion_tokens,
    reasoning_tokens,
    visible_content_present,
    rationale: `completion_tokens (${completion_tokens}) >= reasoning_tokens (${reasoning_tokens}) with the surplus attributable to visible output — reasoning is folded into completion_tokens`
  };
}

// ---------------------------------------------------------------------------------------------
// §5(iv) — truncation check (reasoning headroom for max_tokens)
// ---------------------------------------------------------------------------------------------

/** True if the provider stopped for length (choices[0].finish_reason === "length") — a max_tokens
 * ceiling hit that, under thinking-on, may have truncated a reasoning turn (§5 iv). */
export function responseWasTruncated(body: unknown): boolean {
  return asRecord(asRecordArray(asRecord(body).choices)[0]).finish_reason === "length";
}

// ---------------------------------------------------------------------------------------------
// Combined per-response signal
// ---------------------------------------------------------------------------------------------

export type ReasoningSignals = {
  reasoning_active: boolean;
  reasoning_content_present: boolean;
  visible_content_present: boolean;
  truncated: boolean;
  completion_tokens: number | null;
  reasoning_tokens: number | null;
  accounting: ReasoningTokenAccounting;
  accounting_rationale: string;
  // true iff the §2 E4-side budget adjustment is needed (accounting === "separate"). Consumed by the
  // (currently inert) adjustment seam below.
  adjustment_needed: boolean;
};

export function extractReasoningSignals(body: unknown): ReasoningSignals {
  const accounting = classifyReasoningTokenAccounting(body);

  return {
    reasoning_active: reasoningIsActive(body),
    reasoning_content_present: extractReasoningContent(body).trim().length > 0,
    visible_content_present: accounting.visible_content_present,
    truncated: responseWasTruncated(body),
    completion_tokens: accounting.completion_tokens,
    reasoning_tokens: accounting.reasoning_tokens,
    accounting: accounting.accounting,
    accounting_rationale: accounting.rationale,
    adjustment_needed: accounting.accounting === "separate"
  };
}

// ---------------------------------------------------------------------------------------------
// SEAM (task 4) — conditional reasoning-token budget adjustment. NOT BUILT YET.
// ---------------------------------------------------------------------------------------------

/**
 * SEAM — the E4-side reasoning-token budget adjustment (§2, §4b). Intentionally INERT.
 *
 * DO NOT ACTIVATE until the real §5 smoke classifies accounting as "separate" AND the change is
 * separately authorized. Until then this returns the provider-reported output-token count UNCHANGED,
 * so the budget ledger and the derived cost are byte-identical to today's behavior.
 *
 * When the smoke confirms separation, the fix plugs in HERE: add the side-reported reasoning_tokens
 * to the output-token count (and, at the cost seam upstream, to the derived cost) so the sealed
 * per-task budget counts the reasoning tokens that were billed but excluded from completion_tokens.
 * That is a data-gated change; keep this function inert (and its test green) until then.
 */
export function adjustOutputTokensForReasoning(input: {
  output_tokens: number;
  signals: Pick<ReasoningSignals, "accounting" | "reasoning_tokens" | "adjustment_needed">;
}): { output_tokens: number; adjusted: boolean; reason: string } {
  // INERT SEAM — see doc comment. No adjustment is applied yet, even when adjustment_needed is true;
  // activating it is gated on real smoke data and its own authorization.
  return {
    output_tokens: input.output_tokens,
    adjusted: false,
    reason: "seam-inert-pending-smoke-data-and-authorization"
  };
}

// ---------------------------------------------------------------------------------------------
// local helpers (E4-side copies — no dependency on sealed E1 extraction internals)
// ---------------------------------------------------------------------------------------------

function optionalNonNegativeInteger(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}
