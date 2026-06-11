# Billing v2 Task Design Boundary — v2 (emission-budget amendment)

Date precommitted: 2026-06-11, before any v2 task code. This document amends
`billing-v2-task-design-v1.md` (frozen at SHA-256
`5db61561dde688dbc1cb9b396345e931ab1cf615c621b6d965a726f0d09d8a5c`). Everything in v1 —
invariants, checkpoint list, interaction graph, friction registry, oracle strategy,
acceptance gates 1–5, MCID — carries over verbatim unless explicitly amended below. Task
version becomes `e1-billing-v2-v2`.

## Why v2 exists

The seed-a Stage 1 probe (run card
`docs/run-cards/e1-billing-v2-sonnet-context-probe-seed-a-20260611.md`) returned the
predeclared structural verdict: under the full-file-replacement protocol, the agent's
`src/billing.ts` outgrew the sealed 4000-output-token turn budget; 57.3% of turns ended
`finish_reason=length` and CP07–CP14 stalled. The v1 reference `src/billing.ts` itself
(531 lines, ~4,063 tokens by the sealed estimator) exceeds the budget, so the canonical
solution was inexpressible in one turn. This is a task-design defect, not a protocol or
model finding. v1 is burned for evidence; no further runs under it.

## Amendment 1 — module layout

`src/billing.ts` splits into three modules; all other files keep their v1 layout (12 source
files total):

| File | Contents |
| --- | --- |
| `src/billing-types.ts` | `BillingEvent`, `BillingState`, `Query`, `SubscriptionView`, `JsonValue`, `DispatchOutcome`, `emptyState`, and the shared guards/builders (`requireString`, `requireSubscription`, `requireInvoice`, `withSubscription`, `withInvoice`) |
| `src/billing-handlers.ts` | the per-event-type handlers and the `dispatch` switch |
| `src/billing.ts` | facade: `applyEvent` (idempotency + audit append), the deprecated `applyEvents` wrapper, the view/serialize/audit accessors, `replayStateHash`, and the `evaluate(events, query)` oracle/spec entry point; re-exports the public types |

Behavior is identical to v1 by construction: the split moves code without changing it. The
oracle entry point stays `src/billing.ts` / `evaluate`, so the sealed oracle cases carry
over unchanged; gate 2 (reference 100% everywhere) re-proves behavioral equivalence. The
CP01–CP04 seed workspace splits identically so the agent inherits (and the workflow change
requests assume) the bounded layout from checkpoint 1.

## Amendment 2 — per-file emission-budget gate (new acceptance gate 6)

Every source file in `reference/src/` and in the seed `template-workspace/src/` must
measure ≤ 2400 tokens by the sealed estimator (`countE1Tokens`) — 60% of the sealed
4000-output-token turn budget, leaving margin for protocol framing, agent verbosity above
reference style, and within-run growth. Enforced by a gate test that fails the package
build if any file breaches the threshold. Rationale: scripted/no-provider gates cannot
observe `max_tokens`, so expressibility must be a static property of the task.

## Amendment 3 — truncation-aware structural rule for probes

Stage 1 probe gate criterion 3 ("failures are drift, not structural") additionally fails
when `output_truncated_turn_rate` (model-output `finish_reason=length`, measured by
`bun run e1:stats`) exceeds 0.10 over a run, or when any single checkpoint shows 3+
consecutive length-terminated turns. These thresholds are predeclared here and bind the
v2 Stage 1 plan.

## Amendment 4 — run-identity hygiene

v2 evidence-grade invocations must pass the real provider pricing flags
(`--input-usd-per-mtok 3 --cached-input-usd-per-mtok 0.3 --output-usd-per-mtok 15` for
Sonnet via OpenRouter) and a realistic `--max-call-cost`, so the derived-spend cap
guardrail is meaningful; prompt-cache breakpoints (commit `baeaed7`) stay on. These do not
alter conversation content or the prompt-template hash.

## Not amended

Checkpoints CP01–CP18, the 12 invariants, the interaction graph (on-graph perturbation
sets), the friction registry, the 153-case oracle with held-out tagging, naive-agent
regressions (CP07 invoice rewrite → CP05/CP02 I-TOTALS; CP15 serializer regeneration →
CP04 I-V1BYTES), frozen-baseline and mutation gates, the probe gate numbers (mean context
AUC ≤ 0.92, mean ≥2 on-graph drift regressions), and the MCID (+0.05) are unchanged from
v1. The v1 oracle package is reusable because no evidence package was published against
the v1 commitments (the seed-a probe produced a structural no-claim verdict and hidden
case content was never revealed).
