# Pricing Discount Lifecycle - Content-Controlled Demo Matrix v1

Matrix profile ID: `pricing-discount-content-controlled-demo-v1`

Freeze status: draft, ready to seal. This matrix becomes sealed only when committed with the `pricing-discount-lifecycle-content-controlled-v1` task boundary before any provider run. No provider/model run is authorized by this document.

## Purpose and framing

This matrix tests the narrower claim left open by `pricing-discount-demo-v1`: whether the executable feedback run-loop helps when both arms receive the same semantic content.

Both conditions receive identical visible content:

- the same concrete pricing event API
- the same `getQuote`, `getLineTotal`, and `canApplyCoupon` surface
- the same worked input-to-output examples and expected numbers
- the same visible pricing rules and checkpoint order

The only intended treatment difference is runnability: `feedback_capable_spec` receives executable feedback assets and `bun run spec`; `context_only_spec` does not receive runnable feedback assets, feedback commands, feedback outputs, or feedback asset paths.

This is still an industry-facing pilot, not a generalized benchmark claim. It is designed to produce replayable, hard-to-fake evidence under one task/model/budget boundary.

## Compatibility boundary

- Task: `pricing-discount-lifecycle-content-controlled`
- Task version: `pricing-discount-lifecycle-content-controlled-v1`
- Matrix profile: `pricing-discount-content-controlled-demo-v1`
- Analysis plan: `pricing-discount-lifecycle-content-controlled-v1-path-survival-plan-v0` (`tasks/pricing-discount-lifecycle-content-controlled/analysis-plan.json`)
- Protocol profile: `path-survival-primary-v1`
- Primary metric: `regression_free_auc_delta`
- Budget: `max_model_turns=2`, `max_feedback_runs=1`
- Conditions: `context_only_spec`, `feedback_capable_spec`

Do not pool this matrix with `pricing-discount-lifecycle-v0`, the Mistral `pricing-discount-demo-v1` runs, Gemini no-schema runs, Qwen runs, DeepSeek runs, provider-triage smokes, subscription/inventory runs, or any `final-checkpoint-primary-v1` evidence.

## Content-control integrity

This task exists to remove the interface/example disclosure confound found in `pricing-discount-demo-v1`. The following invariants must hold before freeze and before any provider call:

- Both condition prompt packets render the same `public_api_contract`.
- Both condition prompt packets render the same `visible_spec_text`.
- The context-only prompt contains every event type and field used by feedback assets and the hidden oracle.
- The context-only prompt contains every concrete worked input-to-output example asserted by feedback assets.
- Feedback assets assert only worked examples or semantic facts already present in the shared visible spec.
- Feedback assets and `bun run spec` are available only to `feedback_capable_spec`.
- Hidden oracle cases use only documented event types and fields and are derivable from the shared visible spec.

The local validation package currently reports these checks as green; that validation is a pre-run gate, not provider evidence.

## Local validation record

Local validation before this matrix:

- Content-control parity tests: 8 passing invariants in `test/pricing-discount-content-controlled.test.ts`
- Full test suite reported by implementation pass: 191 pass / 0 fail
- Fake pilot: `valid=true`, 18 replay steps, 0 mismatches
- Reference implementation: 9/9, no regressions
- Naive discrimination: `regression_count=2`, `regression_free_auc=0.667`

The naive-agent result is a design-validation artifact only. It proves the oracle can still surface true regressions after content control; it must not be cited as evidence that executable feedback helps.

## Provider profile

- Model: `mistralai/mistral-small-2603` via OpenRouter
- Adapter: `openrouter-loop`
- Provider execution profile ID:
  `openrouter-loop-v1-modelmistralai-mistral-small-2603-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1`

Canonical run command:

```sh
bun run pilot:run \
  --task tasks/pricing-discount-lifecycle-content-controlled \
  --runs-root runs \
  --run-id <run-id> \
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

A run whose manifest does not declare `protocol_profile_id=path-survival-primary-v1` is not path-survival-primary evidence.

## Compact matrix

Stage A - readiness, not causal evidence:

| # | Run ID suffix | Classification | Purpose |
| --- | --- | --- | --- |
| A1 | `smoke-20260608-001` | `diagnostic_invalid` | Confirm the provider path is clean under the sealed content-controlled Mistral profile. |
| A2 | `difficulty-probe-20260608-001` | `difficulty_probe` | Confirm both arms can use the disclosed API/examples and the task is not a floor or ceiling for this model/budget. |

Stage B - causal pilots:

| # | Run ID suffix | Classification | Count |
| --- | --- | --- | ---: |
| B1-B3 | `causal-pilot-20260608-001` through `003` | `causal_pilot` | 3 clean |

Canonical run ID prefix: `pricing-discount-content-controlled-demo-v1-`.

Core total: 1 smoke + 1 difficulty probe + 3 causal pilots = 5 provider runs, only after explicit operator authorization.

## Gates

- Do not run A2 unless A1 is replay-valid, artifact-valid, provider-clean, and uses the exact sealed profile.
- Do not run B1-B3 unless A2 is replay-valid, artifact-valid, provider-clean, and shows the task is neither obvious floor nor obvious ceiling.
- Do not replace an unfavorable clean causal run.
- Replace only invalid/provider-flagged scheduled runs, and record the excluded run.
- If two consecutive runs fail for the same provider mode, stop and revise the provider profile under a new boundary before continuing.

A causal run counts as clean primary evidence only if: `run_classification=causal_pilot`, replay- and artifact-valid, no provider/network validity flags, `clean_primary_evidence_eligible=true`, complete feedback opportunity integrity for the feedback arm, budget `2/1`, the exact sealed provider profile, and `protocol_profile_id=path-survival-primary-v1`.

## Predeclared interpretation

Report `regression_free_auc_delta` (feedback - context) as primary. Report final checkpoint pass-rate delta, regression-count delta, and checkpoint-by-checkpoint path survival as secondary/mechanism metrics.

- **Run-loop positive**: feedback-capable AUC higher in at least 2 of 3 clean causal pilots, mean AUC delta `>= +0.10`, and no systematic final-pass harm. Because interface and worked examples are shared, this is cleaner evidence for executable feedback under this task/model/budget.
- **Flat / null**: AUC direction `<= 1/3` or mean delta near zero. Report as no observed run-loop benefit under this task/model/budget.
- **Inconclusive (too hard)**: if A2 shows both arms make little progress past the seed despite content parity, treat causal pilots as low-signal and do not headline.
- **Inconclusive (too easy)**: if A2 shows both arms reach near-ceiling performance, treat causal pilots as low-signal and do not headline.
- **Regression mechanism**: if feedback-capable wins by implementation/completion but has equal or more true regressions, say so. Do not claim feedback reduces regressions unless regression-count evidence supports it.
- **Single-outlier guard**: if the signal rests on one run, do not make a strong claim.

Do not change these thresholds after seeing provider outcomes.

## Allowed claim wording

Allowed after clean causal pilots only:

- "On an interface- and example-controlled pricing lifecycle task under `mistral-small` with a 2-turn / 1-feedback budget, both arms received the same concrete event API and worked examples; executable feedback [improved / did not improve] regression-free path survival under this task/model/budget."
- "This isolates runnability better than `pricing-discount-demo-v1`, which bundled executable feedback with interface/worked-example disclosure."
- "Earlier pricing `v0` results remain useful as evidence that executable, example-bearing specs beat prose-only specs, but they are not pooled with this content-controlled variant."

Disallowed:

- "Proves feedback works."
- "BDD always helps."
- "This generalizes across tasks/models."
- "Feedback reduces regressions" unless the regression-count mechanism supports it.
- Pooling with `pricing-discount-demo-v1`, subscription/inventory, or provider-triage runs.

## Execution prerequisites

All are required before any provider call:

1. Content-controlled task package reviewed.
2. This matrix reviewed and approved.
3. A clean freeze commit records the task package, analysis plan, tests, runner support, and this matrix.
4. Explicit operator authorization for provider runs.

No provider/model run may be performed until all four are satisfied.
