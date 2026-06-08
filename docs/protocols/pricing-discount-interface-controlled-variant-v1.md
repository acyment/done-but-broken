# Pricing Discount Lifecycle - Interface-Controlled Variant Proposal v1

Status: proposal only. Not sealed, not implemented, and not authorized for provider runs.

## Purpose

The `pricing-discount-demo-v1` Mistral result is useful but confounded: the feedback-capable arm saw concrete event API examples inside runnable spec files, while the context-only arm received prose semantics and had to infer event names and fields. This variant is the clean follow-up for isolating the feedback loop.

Question: once both arms receive the same concrete pricing event interface, does executable feedback still improve implementation-and-survival under the same task family, budget, and path-survival metric?

## Proposed Boundary

- Proposed task version: `pricing-discount-lifecycle-interface-controlled-v1`
- Base task family: `pricing-discount-lifecycle`
- Conditions: exactly `context_only_spec`, `feedback_capable_spec`
- Protocol profile: `path-survival-primary-v1`
- Primary metric: `regression_free_auc_delta`
- Budget: `max_model_turns=2`, `max_feedback_runs=1`
- Compatibility: do not pool with `pricing-discount-lifecycle-v0`, the Mistral `pricing-discount-demo-v1` runs, Gemini no-schema runs, Qwen runs, DeepSeek runs, provider-triage smokes, subscription/inventory runs, or any `final-checkpoint-primary-v1` evidence.

## Interface Control

Both arms must receive the same concrete event contract before any checkpoint work:

- `item_added`: `{ id, type, sku, unitPrice, quantity }`
- `line_sale_set`: `{ id, type, sku, percentOff }`
- `bulk_rule_set`: `{ id, type, sku, minQuantity, percentOff }`
- `coupon_applied`: `{ id, type, code, couponKind, value }`, where `couponKind` is `"percent"` or `"fixed"`
- `cap_set`: `{ id, type, maxDiscountPercent }`
- `tax_rate_set`: `{ id, type, percent }`
- `tax_exempt_set`: `{ id, type, sku }`

Implementation options:

- Add an `EVENT_API.md` file to the template workspace and include its contents in both prompt packets.
- Or add equivalent TypeScript exported event types to the template workspace and render the same interface text into both prompt packets.

The event contract may include field names and allowed values. It should not include hidden oracle cases. Worked arithmetic examples should remain in semantic specs and feedback assets, but every event type and field name used by any feedback asset or hidden oracle must be present in the shared interface contract.

## Feedback Assets

The feedback-capable arm may still receive runnable spec files and `bun run spec`. The context-only arm must not receive runnable feedback assets, commands, feedback outputs, or feedback asset paths.

However, the feedback assets must not be the only place where an event type, field name, or allowed enum value is disclosed. If a runnable spec uses `coupon_applied` or `couponKind`, the shared interface contract must disclose those names identically to both conditions.

## Required Tests Before Implementation Seal

Add or update protocol tests before sealing this variant:

- Both condition prompt packets contain the identical event-interface text or hash.
- The context-only prompt contains every event type and field name used by feedback assets and the hidden oracle.
- Feedback assets are present only for `feedback_capable_spec`.
- The context-only arm receives no runnable feedback command, feedback output, or feedback asset path.
- Hidden oracle cases use only documented event types and fields.
- Feedback assets use only documented event types and fields.
- Existing visible semantic spec parity remains intact.
- Task version, checkpoint list, visible specs, feedback assets, hidden oracle, budget, provider profile, exclusion rules, and primary metrics are sealed before provider runs.

## Suggested Run Matrix

Stage A - readiness:

| # | Classification | Purpose |
| --- | --- | --- |
| A1 | `diagnostic_invalid` | Provider smoke under the selected model/profile. |
| A2 | `difficulty_probe` | Confirm both arms can use the disclosed interface and the task is not a floor/ceiling. |

Stage B - causal pilot:

| # | Classification | Count |
| --- | --- | ---: |
| B1-B3 | `causal_pilot` | 3 clean runs under the selected weak-model profile. |

No provider/model run is authorized by this proposal. The provider profile should be chosen and sealed separately after local implementation validation.

## Interpretation Rules

- If context-only improves materially after receiving the interface, the original `pricing-discount-demo-v1` advantage was substantially driven by interface/worked-example disclosure.
- If feedback-capable still wins after interface parity, the result is cleaner evidence for the feedback loop itself under this task/model/budget.
- If both arms are flat or both reach 9/9, report the task/model/budget as low-signal for this question.
- If provider/network validity flags appear, record and exclude from clean primary evidence under the existing validity rules.

Allowed wording after clean runs only:

> On an interface-controlled pricing lifecycle task under `<model>` with a 2-turn / 1-feedback budget, both arms received the same concrete event API; executable feedback [improved / did not improve] regression-free path survival under this task/model/budget.

Disallowed wording:

> The original pricing demo proved feedback alone worked.

> This variant proves generalized BDD effectiveness.

## Packaging Implication

For public communication now, lead with the honest current claim: executable, example-bearing BDD-style specs beat prose-only specs on the sealed pricing demo under Mistral. Present this interface-controlled variant as the next evidence step for skeptics who ask whether the win survives once the API is disclosed equally.
