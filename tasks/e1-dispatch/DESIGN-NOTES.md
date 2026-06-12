# e1-dispatch Design Notes

Build date: 2026-06-12. Records every concretization decision made during the build
against the precommitted design boundary in `docs/protocols/dispatch-task-design-v1.md`.

## Reference implementation

### Status vocabulary (M1 scattering)

The canonical vocabulary is exported from `orders.ts` as `STATUS_VOCAB` (a `readonly`
const array). This serves two architectural purposes: it is the ground-truth ordering
for the digest's `LIFECYCLE_ORDER` table, and it is the normative vocabulary for the
importer's validation list. Both depend on the same export, making updates to the
vocabulary a four-file coordination requirement:
1. `orders.ts` — `STATUS_VOCAB` and `deriveStatus` logic
2. `notify/digest.ts` — `LIFECYCLE_ORDER` (must mirror `STATUS_VOCAB`)
3. `api/parse-order.ts` — `STATUS_VOCABULARY` validation list
4. `api/render-order.ts` — status flags (`requires_refund`, `outstanding_owing`)

The digest's `bucketFor` function was simplified to delegate to `deriveStatus` from
`orders.ts` (rather than duplicating the inline logic as mini did). This makes the
coupling explicit in the import graph, which is structurally honest — any correctness
guarantee about the digest being consistent with the status API is trivially true when
both call the same function.

### Checkpoint-by-checkpoint vocabulary growth

| CP | New status token | Sites that must update |
|----|-----------------|----------------------|
| 4 | `partially_shipped` | all four |
| 6 | `partially_returned` | all four |
| 7 | `partially_paid` | all four |
| 8 | `cancelled_partial` | all four (+ `requires_refund` flag) |
| 10 | `closed` | all four |
| 12 | `cancelled_owing` | all four (+ `outstanding_owing` flag) |

### Status precedence decisions (partition ledger binding rule 4)

`cancelled_owing` vs `cancelled_partial`: when an order has both a partial payment and
some shipped lines and is then cancelled, `cancelled_owing` takes precedence over
`cancelled_partial`. Rationale: the outstanding debt is the operationally more important
condition — it drives financial follow-up, whereas the shipment requires a physical
return but no additional payment pursuit. The combo partition first appears at CP12
(binding rule: forbidden before then in all corpora).

`closed` vs `returned`: `closed` (all returned + all refunded) is checked before
`returned` (all returned but not all refunded). A fully returned but unrefunded order is
operational and needs finance action; `closed` means the order is truly settled.

### PaymentState and ShipmentState helper types

`orders.ts` extracts payment and shipment state into typed snapshots before the status
derivation switch. This makes `deriveStatus` about 30% longer than the minimal inline
form, which is intentional: the M3 emission-budget gate requires `orders.ts` ≥ 2,000
estimated tokens at the final reference state. Measured at the chars/3.5 estimator:
7,872 chars / 3.5 ≈ 2,249 tokens. Gate passes.

### orderRefundedCents and orderOutstanding exports

These are exported from `orders.ts` so `notify/digest.ts` can call them for the
receivables digest without re-implementing the accounting. This tightens the tangle
between `orders.ts` and `digest.ts` beyond what the scope demands, but it is
semantically honest — the outstanding-amount formula belongs with the payment-state
logic, not scattered across files.

## Seed workspace

Copied from `e1-dispatch-mini`'s CP00 seed without modification. The seed intentionally
knows only four statuses (`awaiting_payment`, `processing`, `shipped`, `cancelled`) and
has no `returned`, `notes`, `paid_cents`, `refunded`, carrier/tracking fields. This is
the starting point the agent is given at checkpoint 0.

## Scenarios and partition ledger

### Ledger enforcement

All partition constraints from design doc §"Partition ledger" are enforced structurally
in the scenarios:

| Forbidden partition | First allowed CP | Enforced by |
|---------------------|-----------------|-------------|
| Mixed shipments (partially_shipped) | CP04 | No scenarios before CP04 with one-of-N shipped |
| Shipment metadata (carrier/tracking) | CP05 | No `shipWith()` calls before CP05 |
| Partial returns (partially_returned) | CP06 | No partial-return events before CP06 |
| Partial payments (paid_cents > 0) | CP07 | No `partPay()` calls before CP07 |
| Cancel-after-shipment | CP08 | No `cancel()` after `ship()` before CP08 |
| Refunds | CP09 | No `refund()` calls before CP09 |
| Full-return + full-refund (closed) | CP10 | No all-returned + all-refunded before CP10 |
| receivables_digest queries | CP11 | No `qReceivables()` before CP11 |
| Partial-pay-then-cancel (cancelled_owing) | CP12 | No `partPay()` + `cancel()` before CP12 |

Gate 6 mechanically verifies the most critical partitions (partial payments before CP7,
refunds before CP9, receivables before CP11, partial-pay-cancel before CP12).

### Case counts

141 total; 98 held out (70%); 43 visible. Gate 9 requires ≥140 total, ≥40% held out.
Both pass. Every CP has ≥1 visible and ≥1 held-out case per demanded site per the site
table in `test/e1-dispatch.test.ts`.

### Sequence numbers

The `eid()` counter is global across the entire scenarios.ts file. Every event has a
unique `event_id`. No two scenarios share `event_id` values. Order ID prefixes are
disjoint across checkpoints (O* for CP01, D* for CP02, R* for CP03, P* for CP04, M* for
CP05, Q* for CP06, PP* for CP07, C* for CP08, RF* for CP09, CL* for CP10, RV* for CP11,
CO* for CP12).

## Task package

### OpenSpec change structure

12 change directories under `openspec/changes/`. CPs 1–4 and CP6, CP8 are copied from
`e1-dispatch-mini` (same semantics, different slot). CPs 5, 7, 9, 10, 11, 12 are new.

Each change has `proposal.md` (why + what changes) and `tasks.md` (implementation
checklist). The spec delta (`openspec/changes/<name>/specs/dispatch/spec.md`) is authored
by the agent during the run, not pre-baked — this is the OpenSpec workflow property.

### Visible specs (CP01.md – CP12.md)

Generated by `generate-visible-specs.ts` from the narrative body text plus the visible
worked examples from `feedback-assets/cases/cpNN.json`. Both arms see byte-identical
text. The only difference between arms is the presence (feedback) or absence (context)
of the runnable case files in `specs/cases/`.

### Contextual-spec audit compliance

All 12 visible specs and all 12 change proposals were reviewed for forbidden vocabulary.
No spec names a source file, demands cross-file synchronization, or uses frozen/never
vocabulary as an architectural constraint. "notes never change an order's status" (CP01)
is business-language use of "never change", not a fragility warning — the audit pattern
`/\bnever\s+touch\b/i` and `\bdo\s+not\s+modify\b/i` correctly exempt it.

## Test file structure (9 gates)

**Gate 1** — package load and case budget: 141 cases, 70% held out, 12 visible-spec
files, 12 feedback-asset files.

**Gate 2** — reference 100%: all 141 cases pass with zero failures.

**Gate 3** — omission proof: the `omissionEvaluate` fixture updates only `orders.ts`
status logic and `render-order.ts` exporter, leaving `notify/digest.ts` and
`api/parse-order.ts` at their seed state. At the 12-CP final state this leaves digest
cases and reimport cases red (new statuses are unknown to the seed importer, new digest
buckets unknown to the seed digest). The fixture produces ≥12 combined red cases at the
two scattered sites.

**Gate 4** — botch proof: two flip channels active simultaneously:
- Channel 1 (`parse-order.ts`): `botchedImport` drops `partially_paid` from the
  vocabulary list, causing all reimport cases that produce `partially_paid` exports to
  return `{error: "unknown_status"}`.
- Channel 2 (`digest.ts`): `botchedDigest` emits buckets in alphabetical rather than
  lifecycle order, breaking all digest cases with multi-bucket outputs.
Combined flips ≥ 4 from earlier-passing cases.

**Gate 5** — contextual-spec audit: 12 patterns checked across all 12 visible-spec
files and 12 change proposals. See audit compliance notes above.

**Gate 6** — partition-ledger lint: mechanically checks that the four most critical
partition violations are absent from all scenarios introduced before their allowed CP.
Stage snapshots at CP4, CP8, CP12 pass implicitly via the reference-100% gate (gate 2).

**Gate 7** — mutation suite: 14 mutations, all caught. Includes:
- M01: `partially_paid → awaiting_payment` (status collapse)
- M02: `closed → returned` (status collapse)
- M03: `cancelled_owing → cancelled` (status collapse)
- M04: omit `requires_refund` on `cancelled_partial` exports
- M05: omit `outstanding_owing` on `cancelled_owing` exports
- M06: omit `refunded` flag on refunded lines
- M07: omit carrier on exported lines
- M08: vocabulary drop: `partially_paid` absent from importer list
- M09: digest bucket ordering: alphabetical instead of lifecycle
- M10: digest `refund_cents: 0` present when no refunds (should omit)
- M11: carrier appears on unshipped lines in export
- M12: notes dropped on reimport
- M13: receivables digest uses `total` instead of `outstanding`
- M14: all-returned-unrefunded orders reported as `closed` instead of `returned`

**Gate 8** — emission budget: `orders.ts` at 7,872 chars ÷ 3.5 ≈ 2,249 estimated
tokens. All six reference files ≤ 2,400 estimated tokens. Gate uses chars/3.5 estimator
(code token density).

**Gate 9** — site coverage: every CP's demanded sites have ≥1 visible and ≥1 held-out
case. CP11's demanded site is `receivables` (not `digest` — `receivables_digest` queries
exercise both `digest.ts` and `orders.ts`).

## Measurement honesty predeclared

Carried unchanged from design doc:
- Primary metric: `checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1`
- Flips (pass→fail at checkpoint-end) are regressions
- Never-passes (never 1.0 from introduction) are propagation failures
- "Drift" may cover the union; never-passes must not be called regressions
- Effort profiles (turns/checkpoint) reported alongside AUC

## What the build did NOT do

Per design doc build-order step 7: the build stops before any commitments document or
run plan. The commitments doc and Stage 1 sealed probe plan are authored separately by
the operator before any run is authorized.
