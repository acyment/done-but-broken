# Task Card: subscription-entitlements-lifecycle-v0

## Purpose

`subscription-entitlements-lifecycle-v0` is a sealed stateful lifecycle task for subscription billing and access control. It tests whether an implementation can preserve behavior across a cumulative sequence of subscription events without regressing earlier commitments.

The task is designed for a two-arm pilot:

- `context_only_spec`: same visible semantic spec content, no executable feedback assets.
- `feedback_capable_spec`: same visible semantic spec content, executable feedback assets available during agent work.

The causal variable is executable feedback information, not extra model turns.

## Public API Contract

```text
applyEvent(state, event): State
canAccessFeature(state, feature, now): boolean
getBillingStatus(state, now): BillingStatus
getInvoiceSummary(state): InvoiceSummary
```

## Checkpoint Sequence

| Checkpoint | Public behavior introduced | Regression pressure |
| --- | --- | --- |
| `I01` | Trial starts and grants access until `trialEnd`. | Later paid, cancel, suspension, and refund logic must not erase trial history incorrectly. |
| `I02` | Successful payment activates paid subscription and extends `currentPeriodEnd`. | Later events must preserve invoice and period history. |
| `I03` | Cancel-at-period-end preserves access until period end, then disables access. | Later reversals must not resurrect canceled or expired access. |
| `I04` | Payment failure enters grace period. | Access survives during grace but ends after the grace deadline. |
| `I05` | Retry success during grace restores active paid status. | Retry must repair past-due state without losing failure history. |
| `I06` | Duplicate event IDs are idempotent. | Replaying the same event must not double-charge or double-extend access. |
| `I07` | Fraud suspension overrides all access. | Suspension must override trial, paid, grace, cancellation, grants, and downgrade. |
| `I08` | Plan downgrade takes effect next period. | Old-plan features remain until the period boundary, then next-plan entitlements apply. |
| `I09` | Refund or chargeback creates restricted status. | Reversals restrict access and must not resurrect canceled, expired, suspended, or downgraded entitlements. |

## Feedback And Oracle Coverage

Every checkpoint has:

- visible semantic spec text in `tasks/subscription-entitlements-lifecycle/canonical-spec.json`
- a runnable visible feedback asset in `tasks/subscription-entitlements-lifecycle/feedback-assets/`
- hidden oracle coverage in `tasks/subscription-entitlements-lifecycle/hidden-oracle/`
- local acceptance criteria in `tasks/subscription-entitlements-lifecycle/local-acceptance-criteria.json`

Visible feedback is useful but not identical to the hidden oracle. Hidden oracle checks are not included in prompt packets or feedback summaries.

## Sealing Status

- Task version: `subscription-entitlements-lifecycle-v0`
- Checkpoint list: `I01` through `I09`
- Visible specs: implemented
- Feedback assets: implemented and gated
- Hidden oracle: implemented
- Template workspace: implemented
- Local fake-pilot validation: passes
- Analysis plan: sealed

The task should not be mutated in response to provider outcomes. Any checkpoint, visible spec, feedback asset, hidden oracle, budget, or model/provider change needs a compatibility boundary.

## Current Public Evidence

Current clean public-facing causal results:

| Run | Model/provider profile | Primary delta | Secondary AUC delta | Interpretation |
| --- | --- | ---: | ---: | --- |
| `docs/run-cards/subscription-entitlements-causal-pilot-20260605-002.md` | `anthropic/claude-sonnet-4.6` through OpenRouter loop | 0 | 0 | Flat primary and secondary result. |
| `docs/run-cards/subscription-entitlements-causal-pilot-20260605-003.md` | `mistralai/mistral-small-2603` through OpenRouter loop | 0 | 0.1111 | Flat primary result; feedback-capable arm had better checkpoint survival. |

Both runs were replay-valid, provider-valid, and feedback-use-valid. They support Level 4 causal pilot claims under their task/model/budget boundaries. They do not support a generalized claim across tasks, models, or budgets.
