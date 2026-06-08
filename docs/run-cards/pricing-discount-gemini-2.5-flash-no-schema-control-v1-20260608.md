# Run Card: pricing-discount-gemini-2.5-flash-no-schema-control-v1 20260608

Status: A1 smoke passed; A2 difficulty probe completed but failed the clean provider gate. B1 causal pilot was not run.

## Boundary

- Matrix profile: `pricing-discount-gemini-2.5-flash-no-schema-control-v1`
- Freeze commit: `20610bc`
- Task: `pricing-discount-lifecycle-v0`
- Protocol profile: `path-survival-primary-v1`
- Conditions: `context_only_spec`, `feedback_capable_spec`
- Model/provider: OpenRouter `google/gemini-2.5-flash`, `openrouter-loop`
- Budget: `max_model_turns=2`, `max_feedback_runs=1`
- Response format: none (`--openrouter-response-format none`, `--openrouter-require-parameters false`)
- Provider profile:

```text
openrouter-loop-v1-modelgoogle-gemini-2.5-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1
```

## A1 Smoke

Run: `pricing-discount-gemini-2.5-flash-no-schema-control-v1-smoke-20260608-001`

- Manifest: `runs/pricing-discount-gemini-2.5-flash-no-schema-control-v1-smoke-20260608-001/run.json`
- Inspection: `valid=true`, `replay_steps=18`, `mismatches=0`
- Run classification: `diagnostic_invalid`
- Clean primary evidence eligible: no
- Validity flags: none
- Provider timeout detail count: 0
- Provider carry-forward checkpoints: 0
- Budget recorded: `2/1`
- Provider profile matched the sealed Gemini 2.5 Flash no-schema profile exactly.

Diagnostic outcome:

| Condition | Final passed | Final pass rate | Regression-free AUC | Regressions |
| --- | ---: | ---: | ---: | ---: |
| `context_only_spec` | 2/9 | 0.2222 | 0.2222 | 1 |
| `feedback_capable_spec` | 9/9 | 1.0000 | 0.7778 | 1 |

A1 passed the operational smoke gate. Its numbers are diagnostic only because the run was intentionally classified `diagnostic_invalid`.

## A2 Difficulty Probe

Run: `pricing-discount-gemini-2.5-flash-no-schema-control-v1-difficulty-probe-20260608-001`

- Manifest: `runs/pricing-discount-gemini-2.5-flash-no-schema-control-v1-difficulty-probe-20260608-001/run.json`
- Inspection: `valid=true`, `replay_steps=18`, `mismatches=0`
- Run classification: `difficulty_probe`
- Clean primary evidence eligible: no
- Validity flags: `provider_malformed_response`
- Provider timeout detail count: 0
- Provider carry-forward checkpoints: 0
- Budget recorded: `2/1`
- Provider profile matched the sealed Gemini 2.5 Flash no-schema profile exactly.

Provider validity detail:

| Condition | Checkpoint | Flag | Message | Model turn | Feedback had run | Retry count | Elapsed |
| --- | --- | --- | --- | ---: | --- | ---: | ---: |
| `feedback_capable_spec` | `I08` | `provider_malformed_response` | `Model loop JSON could not be parsed as JSON: JSON Parse error: Unterminated string` | 2 | yes | 1 | 10332ms |

Diagnostic outcome:

| Condition | Final passed | Final pass rate | Regression-free AUC | Regressions |
| --- | ---: | ---: | ---: | ---: |
| `context_only_spec` | 2/9 | 0.2222 | 0.2222 | 0 |
| `feedback_capable_spec` | 9/9 | 1.0000 | 1.0000 | 0 |

The A2 artifacts are replay-valid and diagnostically useful, but the provider validity flag prevents treating A2 as clean difficulty evidence.

## Gate Decision

The predeclared gate stopped after A2. B1 was not run.

Reason: A2 recorded `provider_malformed_response`. The sealed matrix requires a clean A2 difficulty probe before executing the single counted causal pilot.

## Interpretation

Removing OpenRouter's structured-output forcing improved Gemini 2.5 Flash operational behavior enough for A1 to pass cleanly. It did not fully eliminate malformed-response risk: A2 still produced a retry-recovered malformed JSON response at feedback `I08`.

The observed A1/A2 outcome pattern is favorable to `feedback_capable_spec`, and it matches the previous implementation-completion story: context-only stalls near 2/9 while feedback-capable reaches 9/9. Because A2 is provider-flagged and B1 was not run, this matrix does not add clean causal evidence. It supports a narrower provider-reliability conclusion: Gemini 2.5 Flash no-schema is promising but not yet clean enough to promote as a strong control under the current OpenRouter loop.
