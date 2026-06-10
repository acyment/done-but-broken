# Billing v2 Task Design (v1) — `e1-billing-v2`

Date: 2026-06-10. Status: design boundary, precommitted before any task code. This document consolidates `billing-v2-frontier-branch-proposal-v0.md` into a concrete buildable design under the precommitted gates in `e1-first-evidence-task-design-gates-v0.md`. Once the package is sealed, this document's hash anchors the boundary.

## Scope reconciliation (recorded before build)

The draft proposal sketched 25–35 files / 5,000–8,000 LOC / 24 checkpoints. The operative precommitted design gates (2026-06-10) specify 5–10 source files (<450 LOC each) and 12–18 checkpoints. This design follows the gates: **10 source files, 18 checkpoints** — the proposal's CP01–CP18 primary probe, with its Phase E escalation (CP19–CP24) explicitly NOT built; if the frontier probe ceilings CP01–CP18, escalation requires a new sealed design revision, not an on-the-fly extension. The proposal's invariants, hypothesis, fairness gates, interpretation table, and MCID (+0.05 paired hidden-oracle AUC delta) carry over unchanged.

## Profile

Built under `e1-openspec-workflow-v0` (sealed 2026-06-10): both arms work in the same OpenSpec-initialized workspace; CP05+ each ship a designer-authored change request; agents maintain the change delta; the harness archives at checkpoint end. The survival ledger is a secondary descriptive metric. The protocol primary metric remains the sealed hidden-oracle `checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1`.

## Module layout (10 files, each <450 LOC)

| File | Owns | Key cross-file invariants touching it |
| --- | --- | --- |
| `src/domain/money.ts` | integer-cents arithmetic, half-even rounding, largest-remainder allocation | I-ROUND, I-TOTALS, I-ALLOC |
| `src/domain/subscription.ts` | lifecycle state machine (trial→active→past_due→canceled), plan-change scheduling | I-STATE, I-SEQ |
| `src/domain/invoice.ts` | invoice generation, line items, finalization | I-TOTALS, I-IMMUT |
| `src/domain/proration.ts` | mid-period upgrade proration lines | I-TOTALS, I-ALLOC |
| `src/domain/coupons.ts` | percent-duration coupons, fixed coupons, stacking order | I-TOTALS, I-STACK |
| `src/domain/refunds.ts` | partial refunds, refund cap, discount allocation on refunded lines | I-REFCAP, I-ALLOC |
| `src/domain/dunning.ts` | payment-failure dunning, entitlement gating | I-STATE, I-ENTITLE |
| `src/api/serializers.ts` | v1 serializer (byte-stable), v2 serializer (CP15+) | I-V1BYTES |
| `src/events/audit.ts` | audit log, per-aggregate gap-free monotonic sequence numbers, deterministic replay | I-SEQ, I-REPLAY |
| `src/billing.ts` | engine facade and the public API | all (composition root) |

## Public API contract (identical in both arms, visible from CP01)

Pure functions over an explicit immutable state value; money is integer cents; time exists only as ISO timestamps inside events (fixed `virtual_now`, no clock APIs).

```ts
applyEvent(state: BillingState, event: BillingEvent): BillingState
evaluate(events: BillingEvent[], query: Query): JsonValue   // oracle/spec entry: fold events, run query
getSubscription(state, subscriptionId): SubscriptionView
getInvoice(state, invoiceId): InvoiceView
getEntitlement(state, subscriptionId): "full" | "grace" | "none"
serializeInvoiceV1(state, invoiceId): string
serializeInvoiceV2(state, invoiceId): string                // exists from CP15
auditLog(state, aggregateId): AuditEntry[]
replayStateHash(events: BillingEvent[]): string             // deterministic replay hash
```

`evaluate` is the single oracle entry point: it folds an event array through `applyEvent` and answers one query (`{kind: "invoice"|"subscription"|"entitlement"|"serialize_v1"|"serialize_v2"|"audit_log"|"replay_hash", ...params}`). It is part of the visible contract from CP01, so hidden-oracle use of it entails nothing invisible.

Event names, field names, and worked numeric examples for every checkpoint appear in that checkpoint's visible spec in BOTH arms (the content-controlled pricing lesson).

## Cross-cutting invariants (cumulative from introduction)

| ID | Invariant | Introduced |
| --- | --- | --- |
| I-SEQ | audit sequence numbers gap-free, monotonic per aggregate | CP01 |
| I-ROUND | line amounts rounded half-even at line level | CP02 |
| I-TOTALS | invoice total equals the sum of rounded lines | CP02 |
| I-IDEM | duplicate event ids are no-ops (later: all event types) | CP03, generalized CP18 |
| I-V1BYTES | v1 serialization byte-stable for previously serializable records | CP04 |
| I-ALLOC | discount/refund allocation uses largest-remainder over affected lines | CP07 |
| I-STACK | percent coupon applies before fixed coupons; caps respected | CP08 |
| I-REFCAP | refunds never exceed net captured per invoice | CP10 |
| I-STATE | lifecycle transitions only along the documented machine | CP01, extended CP12 |
| I-ENTITLE | entitlement derives from state + grace policy | CP13 |
| I-IMMUT | finalized invoices immutable; recomputation produces new documents | CP16 |
| I-REPLAY | replaying the event log reproduces the state hash | CP17 |

## Checkpoints CP01–CP18 with private interaction graph

"Perturbs" lists the prior commitments each checkpoint can plausibly regress (the on-graph drift set used to classify probe failures). Template seed implements CP01–CP04 correctly; CP05+ require real work.

| CP | New behavior | Files touched | Perturbs (on-graph) |
| --- | --- | --- | --- |
| 01 | subscription creation + audit events, I-SEQ | subscription, audit, billing | — |
| 02 | invoice generation, I-ROUND, I-TOTALS | invoice, money | — |
| 03 | idempotent payment capture (I-IDEM) | billing, subscription | CP01 audit (no double events) |
| 04 | v1 invoice serialization, I-V1BYTES | serializers | — |
| 05 | mid-period upgrade proration | proration, invoice, money | CP02 I-TOTALS/I-ROUND, CP04 I-V1BYTES (new line type must serialize stably) |
| 06 | downgrade takes effect at period end | subscription | CP01 I-STATE/I-SEQ, CP05 (no proration on downgrade) |
| 07 | percent coupon with duration; I-ALLOC | coupons, invoice, money | CP02 I-TOTALS, CP05 (discount over prorated lines) |
| 08 | fixed coupon stacking (I-STACK) | coupons | CP07 (percent-first order), CP02 I-TOTALS |
| 09 | plan change while coupon active | proration, coupons | CP05 + CP07 jointly (coupon spans old/new prorated lines) |
| 10 | partial refunds, I-REFCAP | refunds, billing | CP03 capture records, CP01 I-SEQ |
| 11 | discount allocation on refunded prorated lines | refunds, coupons, money | CP07 I-ALLOC, CP10 I-REFCAP, CP05 |
| 12 | dunning entry on payment failure (I-STATE ext.) | dunning, subscription | CP01 I-STATE, CP03 (failed capture not idempotent-confused) |
| 13 | entitlement gating during past_due (I-ENTITLE) | dunning, billing | CP12, CP06 (scheduled downgrade while past_due) |
| 14 | cancellation during dunning | dunning, subscription | CP06 (cancel vs scheduled change), CP12/13 |
| 15 | v2 serializer; v1 stays byte-stable | serializers | CP04 I-V1BYTES (the classic compatibility regression), CP05/07 line serialization |
| 16 | finalized-invoice immutability (I-IMMUT) | invoice | CP02/05/07/11 (recompute paths must not mutate finalized) |
| 17 | audit replay determinism (I-REPLAY) | audit, billing | CP01 I-SEQ across ALL features; any state not derivable from events |
| 18 | duplicate-webhook idempotency for all event types | billing, refunds, dunning | CP03 generalized; CP10 (duplicate refund), CP12 (duplicate failure) |

## Friction registry (sealed before build; every row needs spec text + assertions + mutation coverage)

| # | Friction | Visible acknowledgment | Covering assertions | Mutation proof |
| --- | --- | --- | --- | --- |
| 1 | v1 serializer has a fixed legacy field order and omits-null style that must never change | README + CP04 spec sentence | CP04/CP15 byte-equality cases | v1 field reorder caught by oracle |
| 2 | `money.allocate` (largest-remainder) is the only sanctioned way to split discounts/refunds across lines; naive per-line rounding drifts by cents | CP07 spec worked example showing a 1-cent remainder | CP07/CP11 allocation cases with adversarial remainders | per-line-rounding mutation caught |
| 3 | the engine facade re-exports a deprecated `applyEvents` (plural) wrapper that must keep working | README line | hidden cases calling `evaluate` (which uses the fold) + one visible scenario referencing the wrapper | wrapper removal caught |

No other intentional friction. Difficulty must come from cumulative cross-file interaction, never ambiguity.

## Oracle strategy

New generic oracle kind `module-call-json-v1` (harness change, test-first): each case declares `{check_id, commitment_id, checkpoint_introduced, entry_module, export, args, expected}`; the scorer imports the entry module from the captured snapshot, calls the export with JSON args, and deep-compares the JSON result. Billing cases all call `evaluate(events, query)`.

- Cases generated from the sealed reference implementation by a parameterized generator (amounts, rates, dates, remainders as inputs); the generator ships in the eventual evidence package.
- ≥30% of cases per checkpoint are held-out (same rules, different values/properties than the visible runnable assets), tagged `held_out: true` for the visible-to-hidden gap metric.
- Every visible runnable assertion also exists as an oracle case (entailment audit gate: every step-definition assertion maps to visible spec text or worked examples).

## Acceptance gates before seal (from the precommitted gates doc, made concrete)

1. Package loads/validates; fresh-mount parity (incl. OpenSpec scenario parity) passes on all 18 checkpoints.
2. Reference scripted agent: 100% cumulative hidden oracle at every checkpoint, zero regressions.
3. **Naive-agent discrimination proof** — a plausible-but-careless scripted fixture produces ≥2 true cross-checkpoint, cross-file regressions with the exact regressed-commitment set asserted in tests. Planned regressions: (a) at CP07 it rewrites invoice discount application ignoring prorated lines → regresses CP05's prorated I-TOTALS (coupons.ts change breaking invoice/proration behavior); (b) at CP15 it regenerates the v1 serializer "cleanly" adding the new field → regresses CP04 I-V1BYTES (serializers.ts). A third candidate: at CP18 generalized idempotency reset breaks CP10's refund cap accounting.
4. Frozen-baseline check: a workspace correct through CP(k−1) fails CP(k)'s new checks and passes all old checks, for every k.
5. Mutation suite: 3–5 seeded plausible regressions per phase (A: CP01–04, B: CP05–09, C: CP10–14, D: CP15–18), oracle catch rate ≥90%.
6. Cost projection: from the sealed calibration constants (flash t=1.83 baseline; planning bound t=8), 18 checkpoints × 2 arms × seeds within the operator ceiling, including frontier-lane pricing at evidence-matrix seal time.
7. Predeclared frontier-probe interpretation: per the proposal — probe gate passes only if mean context regression-free AUC ≤ 0.92 AND ≥2 on-graph drift regressions per run AND failures are on-graph (per the interaction graph above), not structural. MCID for causal pilots: +0.05 paired hidden-oracle AUC delta. Outcome table and "parity at higher self-verification cost" rung as in the proposal.

## Build order

1. Harness: `module-call-json-v1` oracle kind (test-first, generic, no billing knowledge).
2. Reference implementation (10 files) + `evaluate` facade, written against this design.
3. Oracle case generator + cases for CP01–CP18 (visible-entailed + held-out).
4. Visible specs (per-checkpoint GWT scenarios + worked examples + API/event documentation), OpenSpec template state (seed spec-of-record for CP01–CP04, change requests for CP05–CP18), runnable feedback assets (`bun run spec`, per-checkpoint filters).
5. Reference and naive scripted fixtures; gates 1–5 as tests.
6. Seal: task version `e1-billing-v2-v1`, hashes committed, then operator authorization for isolated-competence diagnostics and the Stage 1 frontier probe (separate authorizations).
