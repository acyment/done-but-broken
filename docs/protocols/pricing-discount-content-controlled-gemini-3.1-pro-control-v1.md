# Pricing Discount Content-Controlled - Gemini 3.1 Pro Control Matrix v1

Matrix profile ID: `pricing-discount-content-controlled-gemini-3.1-pro-control-v1`

Freeze status: draft, ready to seal. This matrix becomes sealed only when committed with the Gemini 3.1 Pro analysis plan before any provider run. No provider/model run is authorized by this document.

## Purpose and framing

This matrix runs the already sealed content-controlled pricing task on a stronger, day-to-day plausible coding model: OpenRouter `google/gemini-3.1-pro-preview`.

The purpose is not to create a new generalized benchmark claim. It tests whether the content-controlled Mistral result survives under a stronger model/provider boundary where both arms receive the same interface and worked examples, and only `feedback_capable_spec` receives runnable feedback assets.

Conditions remain exactly `context_only_spec` and `feedback_capable_spec`. "BDD with AI" stays a narrative layer, not a third arm.

## Model metadata

Read-only OpenRouter metadata check on 2026-06-08:

- Model slug: `google/gemini-3.1-pro-preview`
- Display name: Google: Gemini 3.1 Pro Preview
- Endpoints observed: Google AI Studio and Google Vertex
- Context length: 1,048,576
- Max completion tokens: 65,536
- Advertised supported parameters include `response_format` and `structured_outputs`
- OpenRouter listed price: `$2 / 1M` input tokens, `$12 / 1M` output tokens

The matrix uses OpenRouter default routing. If a future run needs a pinned upstream endpoint or a no-schema fallback, that is a new provider-profile boundary.

## Compatibility boundary

- Task: `pricing-discount-lifecycle-content-controlled`
- Task version: `pricing-discount-lifecycle-content-controlled-v1`
- Matrix profile: `pricing-discount-content-controlled-gemini-3.1-pro-control-v1`
- Analysis plan: `pricing-discount-lifecycle-content-controlled-v1-gemini-3.1-pro-control-plan-v0` (`tasks/pricing-discount-lifecycle-content-controlled/analysis-plan.gemini-3.1-pro-control-v0.json`)
- Protocol profile: `path-survival-primary-v1`
- Primary metric: `regression_free_auc_delta`
- Budget: `max_model_turns=2`, `max_feedback_runs=1`
- Conditions: `context_only_spec`, `feedback_capable_spec`

Do not pool this matrix with the Mistral `pricing-discount-content-controlled-demo-v1` runs, `pricing-discount-lifecycle-v0`, Gemini 2.5 Flash runs, Qwen runs, DeepSeek runs, provider-triage smokes, subscription/inventory runs, or any `final-checkpoint-primary-v1` evidence.

## Content-control integrity

This matrix inherits the content-control requirements from `pricing-discount-content-controlled-demo-v1`:

- Both condition prompt packets render the same `public_api_contract`.
- Both condition prompt packets render the same `visible_spec_text`.
- The context-only prompt contains every event type and field used by feedback assets and the hidden oracle.
- The context-only prompt contains every concrete worked input-to-output example asserted by feedback assets.
- Feedback assets assert only worked examples or semantic facts already present in the shared visible spec.
- Feedback assets and `bun run spec` are available only to `feedback_capable_spec`.
- Hidden oracle cases use only documented event types and fields and are derivable from the shared visible spec.

These checks are local validity gates, not provider evidence.

## Provider profile

- Model: `google/gemini-3.1-pro-preview` via OpenRouter
- Adapter: `openrouter-loop`
- Response format: `json_schema`
- OpenRouter `provider.require_parameters`: `true`
- Provider execution profile ID:
  `openrouter-loop-v1-modelgoogle-gemini-3.1-pro-preview-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1`

Canonical run command:

```sh
bun run pilot:run \
  --task tasks/pricing-discount-lifecycle-content-controlled \
  --runs-root runs \
  --run-id <run-id> \
  --agent openrouter-loop \
  --openrouter-model google/gemini-3.1-pro-preview \
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
| A1 | `smoke-20260608-001` | `diagnostic_invalid` | Confirm the Gemini 3.1 Pro provider path is clean under the sealed JSON-schema profile. |
| A2 | `difficulty-probe-20260608-001` | `difficulty_probe` | Confirm the task is neither obvious floor nor obvious ceiling for Gemini 3.1 Pro under the 2/1 budget. |

Stage B - causal pilots:

| # | Run ID suffix | Classification | Count |
| --- | --- | --- | ---: |
| B1-B3 | `causal-pilot-20260608-001` through `003` | `causal_pilot` | 3 clean |

Canonical run ID prefix: `pricing-discount-content-controlled-gemini-3.1-pro-control-v1-`.

Core total: 1 smoke + 1 difficulty probe + 3 causal pilots = 5 provider runs, only after explicit operator authorization.

## Gates

- Do not run A2 unless A1 is replay-valid, artifact-valid, provider-clean, and uses the exact sealed profile.
- Do not run B1-B3 unless A2 is replay-valid, artifact-valid, provider-clean, and shows the task is neither obvious floor nor obvious ceiling.
- Do not replace an unfavorable clean causal run.
- Replace only invalid/provider-flagged scheduled runs, and record the excluded run.
- If two consecutive runs fail for the same provider mode, stop and revise the provider profile under a new boundary before continuing.
- If Gemini repeats the malformed-response pattern seen in earlier Gemini 2.5 Flash attempts, stop this matrix. A no-schema or endpoint-pinned retry must be predeclared as a new boundary.

A causal run counts as clean primary evidence only if: `run_classification=causal_pilot`, replay- and artifact-valid, no provider/network validity flags, `clean_primary_evidence_eligible=true`, complete feedback opportunity integrity for the feedback arm, budget `2/1`, the exact sealed provider profile, and `protocol_profile_id=path-survival-primary-v1`.

## Predeclared interpretation

Report `regression_free_auc_delta` (feedback - context) as primary. Report final checkpoint pass-rate delta, regression-count delta, context-arm progression beyond I02, and checkpoint-by-checkpoint path survival as secondary/mechanism metrics.

- **Strong-model run-loop positive**: feedback-capable AUC higher in at least 2 of 3 clean causal pilots, mean AUC delta `>= +0.10`, and no systematic final-pass harm. This supports the bounded claim that runnable BDD-style feedback helped even after interface/example parity on a stronger coding model.
- **Flat / null**: AUC direction `<= 1/3` or mean delta near zero. Report as no observed run-loop benefit under this task/model/budget.
- **Inconclusive (too hard)**: if A2 shows both arms make little progress past the seed despite content parity, treat causal pilots as low-signal and do not headline.
- **Inconclusive (too easy)**: if A2 shows both arms reach near-ceiling performance, treat causal pilots as low-signal and do not headline.
- **Provider-gated**: if A1 or A2 is provider-flagged, report provider reliability only; do not infer model capability or treatment effect.
- **Regression mechanism**: if feedback-capable wins by implementation/completion but has equal or more true regressions, say so. Do not claim feedback reduces regressions unless regression-count evidence supports it.

Do not change these thresholds after seeing provider outcomes.

## Allowed claim wording

Allowed after clean causal pilots only:

- "On an interface- and example-controlled pricing lifecycle task under Gemini 3.1 Pro with a 2-turn / 1-feedback budget, both arms received the same concrete event API and worked examples; executable feedback [improved / did not improve] regression-free path survival under this task/model/budget."
- "This is a stronger-model replication boundary for the Mistral content-controlled result, not pooled evidence."
- "The result remains preliminary and bounded to this task/model/provider/profile/budget."

Disallowed:

- "Proves feedback works."
- "BDD always helps."
- "This generalizes across tasks/models."
- "Feedback reduces regressions" unless the regression-count mechanism supports it.
- Pooling with Mistral, pricing v0, subscription/inventory, or provider-triage runs.

## Execution prerequisites

All are required before any provider call:

1. Gemini 3.1 Pro slug and structured-output support confirmed by read-only metadata.
2. This matrix reviewed and approved.
3. The alternate Gemini analysis plan is registered in the task package.
4. A clean freeze commit records the analysis plan, task package registration, tests, and this matrix.
5. Explicit operator authorization for provider runs.

No provider/model run may be performed until all five are satisfied.
