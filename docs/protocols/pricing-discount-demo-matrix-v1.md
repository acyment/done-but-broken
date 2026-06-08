# Pricing Discount Lifecycle — Preliminary Industry Demo Matrix v1

Matrix profile ID: `pricing-discount-demo-v1`

Original freeze status: predeclared and sealed before any provider run. At freeze time, no provider/model runs had been performed. Execution required a clean freeze commit and explicit operator authorization. Post-run outcomes are documented in run cards, not in this matrix.

Post-run caveat (2026-06-08): artifact inspection found that this matrix does not isolate feedback-loop effects from interface/worked-example disclosure. The context-only prompt exposed prose semantics but not concrete event names and fields such as `coupon_applied`, `couponKind`, `bulk_rule_set`, `cap_set`, or `tax_rate_set`; the feedback-capable arm received runnable spec files containing those exact event calls and expected numbers. This matrix remains the frozen record for the executed contrast, but public claims from it must be framed as executable, example-bearing BDD-style specs versus prose-only specs, not as proof that feedback alone reduces regression drift.

## Purpose and framing

This is a credible, replayable **industry demo**, not a peer-reviewed study. It was designed to test whether executable spec-derived (BDD-style) feedback helps an AI coding agent **preserve earlier behavior while it implements later requirements** — i.e. catch regression drift mid-implementation — on a task where regression drift is actually plausible. The post-run caveat above narrows the public interpretation: the executed matrix is stronger as evidence that executable, example-bearing specs outperform prose-only specs than as evidence isolating feedback-loop effects.

The conditions remain exactly `context_only_spec` and `feedback_capable_spec`. "BDD with AI" is the public-narrative interpretation layer (the visible feedback is spec-derived executable checks); it is not a third arm or a new condition ID.

## Compatibility boundary

- Task family: `pricing-discount-lifecycle-v0` — a new sealed boundary.
- Sealed analysis plan: `pricing-discount-lifecycle-v0-path-survival-plan-v0` (`tasks/pricing-discount-lifecycle/analysis-plan.json`).
- `protocol_profile_id=path-survival-primary-v1`; `primary_metric=regression_free_auc_delta`; budget `max_model_turns=2`, `max_feedback_runs=1`.
- **Do not pool** pricing runs with `subscription-entitlements-lifecycle` or `inventory-reservations-lifecycle` runs, with `final-checkpoint-primary-v1` evidence, or across model/provider-profile boundaries.

## Design integrity (no post-hoc engineering)

This matters because the task was intentionally built so that a naive implementation can regress earlier behavior. That is legitimate task design only under these constraints, all of which hold:

- The task semantics, checkpoint list, visible specs, hidden oracle (sealed in `hidden-oracle/oracle-cases.json`), feedback assets, budget, primary metric, and this matrix are frozen **before** any provider run.
- Every hidden oracle case is **derivable from the visible specs** (artificiality review passed); the cap, tax, and rounding rules are specified to the cent in the visible specs with worked examples. The agent is never asked to satisfy undocumented behavior.
- The regression traps come from **natural rule interaction** in one shared pricing pipeline (precedence, stacking, rounding), not from contrived wording.
- The local naive-agent result (`regression_count=2`, `regression_free_auc=0.667`) is a **design-validation artifact** proving the task *can* surface true regressions by construction. It is NOT a provider or treatment result and must never be cited as evidence that feedback helps.
- Task semantics, checkpoints, oracle, feedback assets, budget, and the primary metric will **not** be changed in response to provider outcomes. Flat or unfavorable results will be reported.

## Provider profile

- Model: `mistralai/mistral-small-2603` via OpenRouter, `openrouter-loop` adapter.
- Frozen provider execution profile ID (identical to the existing clean Mistral pilots):
  `openrouter-loop-v1-modelmistralai-mistral-small-2603-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1`
- Canonical run command (must reproduce the sealed provider profile ID and declare the protocol profile so `regression_free_auc` is primary):

  ```
  bun run pilot:run \
    --task tasks/pricing-discount-lifecycle \
    --agent openrouter-loop \
    --openrouter-model mistralai/mistral-small-2603 \
    --protocol-profile-id path-survival-primary-v1 \
    --max-model-turns 2 \
    --max-feedback-runs 1 \
    --run-classification <diagnostic_invalid|difficulty_probe|causal_pilot> \
    --openrouter-response-format json_schema \
    --openrouter-require-parameters true \
    --provider-max-retries 1 \
    --request-timeout-ms 120000 \
    --max-output-tokens 4000 \
    --max-workspace-bytes 64000 \
    --max-feedback-output-bytes 4000 \
    --temperature 0.2
  ```

  A run whose manifest does not declare `protocol_profile_id=path-survival-primary-v1` is not path-survival evidence; `regression_free_auc` is only secondary for such a run.

  Errata (2026-06-08): the first sealed version of this command omitted `--max-model-turns 2 --max-feedback-runs 1`, so the runner used its defaults (`3`/`2`) instead of the frozen `2`/`1` budget. The frozen budget itself never changed (it is declared above and in the analysis plan); only the command text was incomplete. The first three provider runs of the matrix were recorded but excluded for that budget mismatch and re-run at the correct `2`/`1`. The command above is corrected.

## Compact matrix

Stage A — readiness (not causal evidence):

| # | Run classification | Purpose |
| --- | --- | --- |
| A1 | `diagnostic_invalid` (smoke) | Confirm the provider path is clean under this profile. |
| A2 | `difficulty_probe` | Confirm a capable model can make real progress on pricing and surface whether the task is too hard (floor) or too easy (ceiling) for both arms. |

Stage B — causal demo:

| # | Run classification | Count |
| --- | --- | ---: |
| B1–B3 | `causal_pilot` (Mistral) | 3 clean |
| B4 (optional) | `causal_pilot` (`anthropic/claude-sonnet-4.6`) | 0 or 1, ceiling/context only, separate non-pooled boundary |

Core total: 1 smoke + 1 difficulty probe + 3 causal pilots = 5 provider runs (+1 optional Sonnet ceiling).

## Clean-evidence rules

A causal run counts as clean demo evidence only if: `run_classification=causal_pilot`, replay- and artifact-valid, no provider/network validity flags, `clean_primary_evidence_eligible=true`, complete feedback opportunity integrity for the feedback arm, and the manifest declares `protocol_profile_id=path-survival-primary-v1`. Provider-flagged or invalid runs are recorded and excluded; replace only flagged/invalid scheduled runs, never unfavorable clean ones. If two consecutive runs fail for the same provider mode, stop and revise the provider profile under a new boundary before continuing.

## Predeclared interpretation

Report `regression_free_auc` delta (feedback − context) and `regression_count` delta as the primary demo signals; final checkpoint pass rate as secondary.

- **Demo-positive** ("feedback helped"): feedback-capable AUC higher in at least 2 of 3 clean causal pilots, mean AUC delta `>= +0.10`, the feedback arm shows fewer true regressions, and no systematic final-pass harm.
- **Flat / null**: AUC direction `<= 1/3` or mean delta near zero → report as flat under this task/model/budget.
- **Inconclusive (task too hard)**: if the difficulty probe shows both arms make little progress past the early checkpoints, treat causal results as low-power and say so; do not headline.
- **Single-outlier guard**: if the signal rests on one run, do not make a strong claim.

Do not change these thresholds after seeing outcomes.

## Allowed claim wording

- "On a sealed pricing lifecycle task under `mistral-small` with a 2-turn / 1-feedback budget, executable, example-bearing BDD-style specs [improved / did not improve] implementation-and-survival versus prose-only specs, measured by regression-free path survival across nine cumulative checkpoints."
- "Earlier subscription and inventory lifecycle tasks were easier and produced limited regression signal; they are calibration/difficulty context, not headline evidence."
- Always qualify: sealed task, replay-valid, under this model/budget, preliminary.

Disallowed: "proves"; "BDD always helps"; any generalized claim across tasks/models; pooling pricing with subscription/inventory; citing the local naive-agent design artifact as a treatment result; claiming this matrix proves feedback alone reduces regression drift once both arms know the interface.

## Execution prerequisites (all required before any provider call)

1. This matrix reviewed and approved.
2. A clean freeze commit recorded that includes the pricing task package, its sealed analysis plan, and this matrix.
3. Explicit operator authorization for provider runs.

No provider/model runs may be performed until all three are satisfied.
