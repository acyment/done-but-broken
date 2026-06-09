# Run Card: payroll-net-pay-skeleton-seed Sonnet 4.6 A2 20260609

Status: replay-valid provider-failed A2 attempt. This is not a clean difficulty gate and must not be interpreted as task/model evidence.

## Boundary

- Protocol: `payroll-net-pay-skeleton-seed-ceiling-test-v1`
- Provider-profile freeze commit: `e87457e`
- Task: `payroll-net-pay-lifecycle-skeleton-seed`
- Task version: `payroll-net-pay-lifecycle-skeleton-seed-v1`
- Run ID: `payroll-net-pay-skeleton-seed-sonnet-4.6-a2-difficulty-output12000-001`
- Run classification: `difficulty_probe`
- Protocol profile: `path-survival-primary-v1`
- Conditions: `context_only_spec`, `feedback_capable_spec`
- Model/provider: OpenRouter `anthropic/claude-sonnet-4.6`, `openrouter-loop`
- Budget: `max_model_turns=2`, `max_feedback_runs=1`
- Provider profile:

```text
openrouter-loop-v1-modelanthropic-claude-sonnet-4.6-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output12000-workspace128000-feedback4000-temp0.2-retry1
```

## Artifact Check

- Manifest: `runs/payroll-net-pay-skeleton-seed-sonnet-4.6-a2-difficulty-output12000-001/run.json`
- Result: `runs/payroll-net-pay-skeleton-seed-sonnet-4.6-a2-difficulty-output12000-001/result.json`
- Summary: `runs/payroll-net-pay-skeleton-seed-sonnet-4.6-a2-difficulty-output12000-001/summary.md`
- Inspection: `valid=true`, `replay_steps=36`, `mismatches=0`
- Run validity flags: `provider_api_failure`
- Validity detail count: `36`
- Provider carry-forward checkpoints: `36`
- Feedback opportunity integrity: not applicable

## Provider Failure

Every checkpoint failed before any model-authored file write. OpenRouter returned `402 Payment Required` for the sealed `max_output_tokens=12000` profile:

```text
This request requires more credits, or fewer max_tokens. You requested up to 12000 tokens, but can only afford 2440.
```

Both condition pipelines therefore carried the unchanged skeleton seed through all checkpoints.

## Diagnostic Outcome

The result record shows the skeleton baseline in both arms, not model performance:

| Condition | Final passed | Pass rate | Regression-free AUC | Regressions |
| --- | ---: | ---: | ---: | ---: |
| `context_only_spec` | 8/18 | 0.4444 | 0.3333 | 0 |
| `feedback_capable_spec` | 8/18 | 0.4444 | 0.3333 | 0 |

The captured `workspace-code-after.json` artifacts contain only `src/payroll.ts` with the unchanged skeleton TODO functions. The final code-capture hash was identical across all checkpoints in both conditions.

## Gate Decision

A2 did not run cleanly. Do not use this attempt to decide ceiling, floor, drift, or feedback benefit.

The correct next action is operational, not scientific: either add OpenRouter credits for the sealed 12000-output profile or seal a new lower-token/direct-provider profile before another explicitly authorized A2 attempt. Do not run causal pilots from this result.
