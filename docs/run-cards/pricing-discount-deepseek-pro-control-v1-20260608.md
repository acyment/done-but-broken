# Run Card: pricing-discount-deepseek-pro-control-v1 DeepSeek Pro Gate 20260608

Status: provider gate stopped during A1 smoke before difficulty probe or counted causal pilot.

## Boundary

- Matrix profile: `pricing-discount-deepseek-pro-control-v1`
- Freeze commit: `8b7d662`
- Task: `pricing-discount-lifecycle-v0`
- Protocol profile: `path-survival-primary-v1`
- Conditions: `context_only_spec`, `feedback_capable_spec`
- Model/provider: OpenRouter `deepseek/deepseek-v4-pro`, `openrouter-loop`
- Budget: `max_model_turns=2`, `max_feedback_runs=1`
- Response format: `model-loop-response-json-schema-v1`
- Provider profile:

```text
openrouter-loop-v1-modeldeepseek-deepseek-v4-pro-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1
```

## A1 Smoke

Run: `pricing-discount-deepseek-pro-control-v1-smoke-20260608-001`

- Classification intent: `diagnostic_invalid`
- Status: stopped intentionally after first provider validity flag.
- Run-level manifest: none. The run was terminated before `run.json` could be written.
- Completed through `context_only_spec` checkpoint `I07`.
- Provider flag source: `runs/pricing-discount-deepseek-pro-control-v1-smoke-20260608-001/context_only_spec/checkpoints/I07/agent-result.json`

Recorded provider validity details at `context_only_spec` / `I07`:

| Flag | Message | Retry count | Elapsed |
| --- | --- | ---: | ---: |
| `provider_malformed_response` | `Model loop JSON could not be parsed as JSON: JSON Parse error: Unterminated string` | 1 | 71427ms |
| `provider_malformed_response` | `Model loop JSON could not be parsed as JSON: JSON Parse error: Unterminated string` | 1 | 78142ms |

The failed checkpoint carried the workspace forward due to provider failure and wrote no files.

## Gate Decision

A1 is provider-flagged and not a clean smoke. Therefore A2, the DeepSeek Pro difficulty probe, and B1, the single counted causal pilot, were not run under this boundary.

## Interpretation

DeepSeek V4 Pro via OpenRouter under this exact structured-output profile is not usable as clean strong-control evidence without a new predeclared provider-profile boundary. This is provider reliability evidence only; it is not causal evidence and says nothing about the treatment effect.
