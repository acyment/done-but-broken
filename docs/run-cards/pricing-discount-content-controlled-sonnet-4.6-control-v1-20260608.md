# Run Card: pricing-discount-content-controlled-sonnet-4.6-control-v1 20260608

Status: A1 smoke passed cleanly. A2 difficulty probe and B-series causal pilots were not run in this step.

## Boundary

- Matrix profile: `pricing-discount-content-controlled-sonnet-4.6-control-v1`
- Freeze commit: `00e0484`
- Task: `pricing-discount-lifecycle-content-controlled`
- Task version: `pricing-discount-lifecycle-content-controlled-v1`
- Analysis plan: `tasks/pricing-discount-lifecycle-content-controlled/analysis-plan.sonnet-4.6-control-v0.json`
- Protocol profile: `path-survival-primary-v1`
- Conditions: `context_only_spec`, `feedback_capable_spec`
- Model/provider: OpenRouter `anthropic/claude-sonnet-4.6`, `openrouter-loop`
- Budget: `max_model_turns=2`, `max_feedback_runs=1`
- Response format: `json_schema`, `provider.require_parameters=true`
- Provider profile:

```text
openrouter-loop-v1-modelanthropic-claude-sonnet-4.6-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1
```

## A1 Smoke

Run: `pricing-discount-content-controlled-sonnet-4.6-control-v1-smoke-20260608-001`

- Manifest: `runs/pricing-discount-content-controlled-sonnet-4.6-control-v1-smoke-20260608-001/run.json`
- Result: `runs/pricing-discount-content-controlled-sonnet-4.6-control-v1-smoke-20260608-001/result.json`
- Summary: `runs/pricing-discount-content-controlled-sonnet-4.6-control-v1-smoke-20260608-001/summary.md`
- Inspection: `valid=true`, `replay_steps=18`, `mismatches=0`
- Run classification: `diagnostic_invalid`
- Clean primary evidence eligible: no
- Validity flags: none
- Provider timeout phases: none
- Provider timeout detail count: 0
- Provider carry-forward checkpoints: 0
- Feedback opportunity integrity: not applicable
- Provider profile matched the sealed Sonnet 4.6 profile exactly.

Diagnostic outcome:

| Condition | Final passed | Final pass rate | Regression-free AUC | Regressions |
| --- | ---: | ---: | ---: | ---: |
| `context_only_spec` | 9/9 | 1.0000 | 1.0000 | 0 |
| `feedback_capable_spec` | 9/9 | 1.0000 | 1.0000 | 0 |

## Gate Decision

The predeclared A1 smoke gate passed.

This opens the A2 difficulty-probe gate under the matrix, but A2 was not run in this step. A2 still requires explicit operator authorization.

## Interpretation

This run is provider reliability evidence only. It is not causal evidence and should not be pooled with Mistral, Gemini, pricing v0, subscription, inventory, Qwen, DeepSeek, or provider-triage runs.

The diagnostic outcome also shows a possible ceiling pattern: both arms completed 9/9 with no regressions. The matrix already treats near-ceiling A2 behavior as low-signal for causal pilots. A2 is still the predeclared difficulty probe needed to decide whether continuing to B-series causal pilots is useful.
