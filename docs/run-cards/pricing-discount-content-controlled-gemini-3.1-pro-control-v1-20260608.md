# Run Card: pricing-discount-content-controlled-gemini-3.1-pro-control-v1 20260608

Status: A1 smoke completed but failed the clean provider gate. A2 difficulty probe and B-series causal pilots were not run.

## Boundary

- Matrix profile: `pricing-discount-content-controlled-gemini-3.1-pro-control-v1`
- Freeze commit: `7c3cb79`
- Task: `pricing-discount-lifecycle-content-controlled`
- Task version: `pricing-discount-lifecycle-content-controlled-v1`
- Analysis plan: `tasks/pricing-discount-lifecycle-content-controlled/analysis-plan.gemini-3.1-pro-control-v0.json`
- Protocol profile: `path-survival-primary-v1`
- Conditions: `context_only_spec`, `feedback_capable_spec`
- Model/provider: OpenRouter `google/gemini-3.1-pro-preview`, `openrouter-loop`
- Budget: `max_model_turns=2`, `max_feedback_runs=1`
- Response format: `json_schema`, `provider.require_parameters=true`
- Provider profile:

```text
openrouter-loop-v1-modelgoogle-gemini-3.1-pro-preview-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1
```

## A1 Smoke

Run: `pricing-discount-content-controlled-gemini-3.1-pro-control-v1-smoke-20260608-001`

- Manifest: `runs/pricing-discount-content-controlled-gemini-3.1-pro-control-v1-smoke-20260608-001/run.json`
- Result: `runs/pricing-discount-content-controlled-gemini-3.1-pro-control-v1-smoke-20260608-001/result.json`
- Summary: `runs/pricing-discount-content-controlled-gemini-3.1-pro-control-v1-smoke-20260608-001/summary.md`
- Inspection: `valid=true`, `replay_steps=18`, `mismatches=0`
- Run classification: `diagnostic_invalid`
- Clean primary evidence eligible: no
- Validity flags: `provider_malformed_response`, `provider_timeout`
- Provider timeout phases: `pre_model_action_timeout`
- Provider timeout detail count: 1
- Provider carry-forward checkpoints: 13
- Feedback opportunity integrity: not applicable
- Provider profile matched the sealed Gemini 3.1 Pro profile exactly.

Diagnostic outcome:

| Condition | Final passed | Final pass rate | Regression-free AUC | Regressions |
| --- | ---: | ---: | ---: | ---: |
| `context_only_spec` | 3/9 | 0.3333 | 0.3333 | 0 |
| `feedback_capable_spec` | 2/9 | 0.2222 | 0.2222 | 0 |

Provider validity detail summary:

- Repeated `provider_malformed_response` details reported `Model loop JSON could not be parsed as JSON: JSON Parse error: Unterminated string`.
- One context-only `I06` call timed out after `120000ms`.
- The timeout was classified as `pre_model_action_timeout`.
- Provider failure caused workspace carry-forward at 13 checkpoints.

## Gate Decision

The predeclared A1 smoke gate failed. A2 was not run.

Reason: the matrix requires A1 to be replay-valid, artifact-valid, provider-clean, and on the exact sealed provider profile. This run was replay-valid and used the exact sealed profile, but it was not provider-clean because it recorded `provider_malformed_response` and `provider_timeout`.

## Interpretation

This run is provider reliability evidence only. It is not causal evidence, not difficulty evidence, and says nothing cleanly about the treatment effect.

Under this exact OpenRouter JSON-schema profile, Gemini 3.1 Pro Preview is not usable for the content-controlled strong-model control without a new provider-profile boundary. Per the matrix, a no-schema or endpoint-pinned retry would need to be predeclared separately before any provider run.
