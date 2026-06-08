# Run Card: pricing-discount-strong-control-v1 Qwen Gate 20260608

Status: provider gate stopped before counted causal pilot.

## Boundary

- Matrix profile: `pricing-discount-strong-control-v1`
- Freeze commit: `134c817`
- Task: `pricing-discount-lifecycle-v0`
- Protocol profile: `path-survival-primary-v1`
- Conditions: `context_only_spec`, `feedback_capable_spec`
- Model/provider: OpenRouter `qwen/qwen3.7-max`, `openrouter-loop`
- Budget: `max_model_turns=2`, `max_feedback_runs=1`
- Response format: `model-loop-response-json-schema-v1`
- Provider profile:

```text
openrouter-loop-v1-modelqwen-qwen3.7-max-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1
```

## A1 Smoke

Run: `pricing-discount-strong-control-v1-qwen-smoke-20260608-001`

- Classification: `diagnostic_invalid`
- Manifest: `runs/pricing-discount-strong-control-v1-qwen-smoke-20260608-001/run.json`
- Inspection: `valid=true`, `replay_steps=18`, `mismatches=0`
- Validity flags: none
- Provider timeout detail count: 0
- Provider carry-forward checkpoints: 0
- Clean primary evidence eligible: no (diagnostic smoke)
- Budget recorded: `2/1`
- Provider profile matched the sealed Qwen profile exactly.

Observed diagnostic outcome:

| Condition | Final pass rate | Regression-free AUC | Regressions |
| --- | ---: | ---: | ---: |
| `context_only_spec` | 2/9 | 0.2222 | 0 |
| `feedback_capable_spec` | 9/9 | 1.0000 | 0 |

This is provider reliability evidence only. It is not causal evidence.

## A2 Difficulty Probe

Run: `pricing-discount-strong-control-v1-qwen-difficulty-probe-20260608-001`

- Classification intent: `difficulty_probe`
- Status: stopped intentionally after first provider validity flag to avoid additional provider spend.
- Run-level manifest: none. The run was terminated before `run.json` could be written.
- Completed through `context_only_spec` checkpoint `I08`.
- Provider flag source: `runs/pricing-discount-strong-control-v1-qwen-difficulty-probe-20260608-001/context_only_spec/checkpoints/I08/agent-result.json`

Recorded provider validity details at `context_only_spec` / `I08`:

| Model turn | Flag | Phase | Retry count | Elapsed |
| ---: | --- | --- | ---: | ---: |
| 1 | `provider_timeout` | `retry_recovered_timeout` | 1 | 120012ms |
| 2 | `provider_timeout` | `retry_recovered_timeout` | 1 | 120020ms |

The model ultimately returned an `ok` agent result for I08 after retries, but retry-recovered provider timeouts are validity flags under the sealed exclusion rules.

## Gate Decision

A2 is provider-flagged and not clean difficulty evidence. Therefore B1, the single counted Qwen causal pilot, was not run under this boundary.

## Interpretation

The Qwen structured-output path can complete a full diagnostic smoke cleanly, but the full difficulty gate was not clean under the sealed `120000ms` timeout and retry policy. The Qwen boundary therefore does not currently provide clean strong-model control evidence.

This does not change the Mistral result interpretation. It only says that Qwen 3.7 Max via OpenRouter under this exact profile is operationally too slow/unreliable for the next counted control without a new predeclared provider-profile boundary.
