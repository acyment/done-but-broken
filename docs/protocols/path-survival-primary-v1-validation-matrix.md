# Path-Survival Primary v1 Validation Matrix

This document predeclares the next internal validation phase for `path-survival-primary-v1`. It is not a public validation claim and does not reinterpret historical `final-checkpoint-primary-v1` runs.

## Protocol

- Protocol profile: `path-survival-primary-v1`.
- Run classification: `causal_pilot`.
- Budget: `max_model_turns=2`, `max_feedback_runs=1`.
- Conditions are exactly `context_only_spec` and `feedback_capable_spec`.
- Both arms receive the same visible semantic spec content.
- Only `feedback_capable_spec` may receive executable feedback assets, feedback commands, feedback output, feedback summaries, or feedback asset paths.
- Treatment is executable feedback information, not extra model turns.
- Clean evidence rules are unchanged: replay and artifact inspection must be valid, no provider/network validity flags may be present, `clean_primary_evidence_eligible=true`, and feedback opportunity integrity must be complete for the feedback-capable arm.
- Do not pool across task versions, model/provider profiles, loop-policy versions, feedback asset patches, hidden oracle changes, budgets, protocol profiles, or metric definitions.

## Stage 1 - Primary Internal Validation

Purpose: test whether a cheaper/weaker but capable model shows path-survival benefit from executable feedback under sealed long-horizon tasks.

Predeclared matrix:

| Task version | Model/provider profile | Clean causal pilots |
| --- | --- | ---: |
| `subscription-entitlements-lifecycle-v0` | `mistralai/mistral-small-2603` | 3 |
| `inventory-reservations-lifecycle-v0` | `mistralai/mistral-small-2603` | 3 |

Stage 1 total: 6 clean causal pilots.

Stage 1 uses the same Mistral model/provider compatibility boundary for both tasks. Replacement runs may be added only under the invalid-run rules below.

## Stage 2 - Optional Ceiling Comparison

Stage 2 is optional and only begins after Stage 1 is completed, inspected, and interpreted.

Purpose: provide a ceiling/control comparison under a stronger model profile, not primary validation.

Predeclared matrix:

| Task version | Model/provider profile | Clean causal pilots |
| --- | --- | ---: |
| `subscription-entitlements-lifecycle-v0` | `anthropic/claude-sonnet-4.6` | 1 or 2 |
| `inventory-reservations-lifecycle-v0` | `anthropic/claude-sonnet-4.6` | 1 or 2 |

Stage 2 is not mandatory if Stage 1 is flat, null, invalid, or provider-limited. It must not be used to rescue a weak Stage 1 result by changing the primary interpretation after outcomes are known.

## Interpretation Rules

Primary Stage 1 support requires all of the following:

- `feedback_capable_spec` has higher `regression_free_auc` than `context_only_spec` in at least 4 of 6 clean Stage 1 runs.
- Mean AUC delta, feedback minus context, is meaningfully positive; the predeclared threshold is `>= +0.10`.
- There is no systematic final checkpoint pass-rate harm in the feedback-capable arm.
- Every included run has `clean_primary_evidence_eligible=true`.

Cautious interpretation rules:

- If final pass rate is flat but path survival improves consistently, the claim is about reduced cumulative drift and temporary regressions, not better final completion.
- If AUC direction is 3 of 6 or worse, or mean AUC delta is near zero, treat Stage 1 as null/flat.
- If the result is driven by one outlier run, do not make a strong treatment claim.
- Provider-flagged runs are excluded from clean Stage 1 evidence and may only be replaced under the rules below.
- Do not exclude inconvenient clean runs.
- Do not change primary metrics after seeing results.
- Do not mutate task semantics, visible feedback assets, hidden oracle behavior, checkpoint lists, or budgets after seeing results.

## Invalid-Run And Replacement Rules

- Provider-flagged, replay-invalid, artifact-invalid, diagnostic-invalid, or non-causal runs are recorded but excluded from clean Stage 1 evidence.
- Invalid/provider-flagged runs must remain recorded. They may be replaced for clean-evidence counting, but not deleted or hidden.
- Replacement runs are allowed only to replace invalid or provider-flagged scheduled runs, never unfavorable clean runs.
- A replacement must use the same task version, checkpoint list, visible specs, feedback assets, hidden oracle, budget, protocol profile, model/provider settings, provider execution profile, loop policy, retry policy, request shape, parser, response format, and metric definition as the invalid run it replaces.
- If two consecutive scheduled Stage 1 runs under the same provider profile are provider-flagged for the same failure mode, stop Stage 1. Do not continue by repeatedly rerunning. Revise the provider profile under a new compatibility boundary before continuing.
- Replacement counts must be reported separately from clean included run counts.

## Reporting Boundary

Allowed internal wording after clean Stage 1 completion:

- "Under this predeclared internal matrix, `path-survival-primary-v1` showed support/null results under these task/model/budget boundaries."
- "Final checkpoint pass rate was secondary under this protocol profile."
- "Historical final-pass-primary AUC values remain retrospective secondary context."

Disallowed wording:

- "The benchmark proves feedback works."
- "Existing final-pass-primary runs validate path survival."
- "Stage 2 overrides Stage 1."
- "Provider-flagged runs are clean primary evidence."
