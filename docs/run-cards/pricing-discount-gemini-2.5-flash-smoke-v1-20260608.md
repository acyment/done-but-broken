# Run Card: pricing-discount-gemini-2.5-flash-smoke-v1 20260608

Status: smoke completed, but did not pass the clean provider smoke gate.

## Boundary

- Matrix profile: `pricing-discount-gemini-2.5-flash-smoke-v1`
- Freeze commit: `6e4b761`
- Task: `pricing-discount-lifecycle-v0`
- Protocol profile: `path-survival-primary-v1`
- Conditions: `context_only_spec`, `feedback_capable_spec`
- Model/provider: OpenRouter `google/gemini-2.5-flash`, `openrouter-loop`
- Budget: `max_model_turns=2`, `max_feedback_runs=1`
- Response format: `model-loop-response-json-schema-v1`
- Run classification: `diagnostic_invalid`
- Provider profile:

```text
openrouter-loop-v1-modelgoogle-gemini-2.5-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1
```

## Smoke

Run: `pricing-discount-gemini-2.5-flash-smoke-v1-20260608-001`

- Manifest: `runs/pricing-discount-gemini-2.5-flash-smoke-v1-20260608-001/run.json`
- Inspection: `valid=true`, `replay_steps=18`, `mismatches=0`
- Run classification: `diagnostic_invalid`
- Clean primary evidence eligible: no
- Validity flags: `provider_malformed_response`
- Provider timeout detail count: 0
- Provider carry-forward checkpoints: 0
- Budget recorded: `2/1`
- Provider profile matched the sealed Gemini 2.5 Flash profile exactly.

Provider validity detail:

| Condition | Checkpoint | Flag | Message | Retry count | Elapsed |
| --- | --- | --- | --- | ---: | ---: |
| `context_only_spec` | `I04` | `provider_malformed_response` | `Model loop JSON could not be parsed as JSON: JSON Parse error: Unterminated string` | 1 | 1609ms |

The malformed response was retry-recovered and the run completed, but the sealed smoke gate requires no provider validity flags.

## Diagnostic Outcome

These outcome numbers are reported only for transparency. Because the run is provider-flagged and classified `diagnostic_invalid`, they must not be interpreted as treatment effects.

| Condition | Final passed | Final pass rate | Regression-free AUC | Regressions |
| --- | ---: | ---: | ---: | ---: |
| `context_only_spec` | 2/9 | 0.2222 | 0.2222 | 0 |
| `feedback_capable_spec` | 0/9 | 0.0000 | 0.8889 | 8 |

The feedback-capable arm passed hidden checks through `I08` (`8/8`) and then failed all hidden checks at `I09` (`0/9`). The I09 public feedback command passed before the final model turn, but the final workspace failed the hidden oracle after the model's second write.

## Gate Decision

Gemini 2.5 Flash did not pass the clean provider smoke gate under `pricing-discount-gemini-2.5-flash-smoke-v1`.

Do not promote this run into a difficulty probe, strong-control pilot, or causal pilot. Any downstream Gemini run would require a new predeclared boundary and a different provider/profile decision.

## Interpretation

Gemini 2.5 Flash via OpenRouter under this structured-output profile is operationally better than the recent MiniMax/GLM/Kimi triage in one narrow sense: it completed quickly, with no provider timeouts and no workspace carry-forward due to provider failure. However, it still recorded a malformed-response validity flag, so it is not a clean provider smoke.

This result is provider reliability evidence only. It does not change the Mistral causal-pilot interpretation and says nothing causal about executable feedback.
