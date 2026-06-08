# Run Card: subscription-entitlements-difficulty-probe-20260605-009

## Claim Level

Level 3 difficulty claim, not causal evidence.

This run supports the narrow statement: under this task/model/budget, both conditions completed the sealed task package cleanly with replayable artifacts and no provider validity flags. It does not support a treatment-effect claim because the run classification is `difficulty_probe`, not `causal_pilot`.

## Run Identity

- Run ID: `subscription-entitlements-difficulty-probe-20260605-009`
- Run classification: `difficulty_probe`
- Task: `subscription-entitlements-lifecycle`
- Task version: `subscription-entitlements-lifecycle-v0`
- Result schema: `result-schema-v1`
- Run manifest: `runs/subscription-entitlements-difficulty-probe-20260605-009/run.json`
- Result record: `runs/subscription-entitlements-difficulty-probe-20260605-009/result.json`
- Generated summary: `runs/subscription-entitlements-difficulty-probe-20260605-009/summary.md`

## Conditions

- `context_only_spec`: visible semantic spec only; no executable feedback command, feedback output, or feedback asset paths.
- `feedback_capable_spec`: same visible semantic spec, plus executable feedback assets and public-safe feedback summaries inside the bounded loop.

The active pilot still has exactly these two condition IDs.

## Model And Provider Profile

- Provider: `openrouter`
- Adapter: `openrouter-loop`
- Model: `anthropic/claude-sonnet-4.6`
- Route: `openrouter-chat-completions`
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Response parser: `openrouter-response-parser-v1`
- Request parameter version: `openrouter-chat-request-max-tokens-v1`
- Response format version: `model-loop-response-json-schema-v1`
- Provider requires parameters: `true`
- Retry policy version: `provider-retry-timeout-rate-malformed-v1`
- Per-call timeout: `120000ms`
- Max output tokens: `4000`
- Workspace context cap: `64000` bytes
- Feedback summary cap: `4000` bytes
- Temperature: `0.2`
- Max provider retries: `1`

Provider profile ID:

```text
openrouter-loop-v1-modelanthropic-claude-sonnet-4.6-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1
```

## Budget

- Max model turns: `2`
- Max feedback runs: `1`
- Primary metric checkpoint: `I09`
- Primary metric: final checkpoint pass-rate delta, feedback minus context

Both conditions received the same maximum model-turn budget.

## Results

| Condition | Final passed | Pass rate | Regressions | Regression-free AUC |
| --- | ---: | ---: | ---: | ---: |
| `context_only_spec` | 9/9 | 1.00 | 0 | 1.00 |
| `feedback_capable_spec` | 9/9 | 1.00 | 0 | 1.00 |

- Final checkpoint delta: `0`
- Regression-free AUC delta: `0`
- Replay steps: `18`
- Replay mismatches: `0`
- Validity flags: none
- Provider timeout phases: none
- Provider timeout detail count: `0`
- Provider-failure carry-forward checkpoints: `0`
- Clean primary evidence eligible: no, because the run is not classified as `causal_pilot`

## Checkpoint Survival

| Condition | I01 | I02 | I03 | I04 | I05 | I06 | I07 | I08 | I09 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `context_only_spec` | 1/1 | 2/2 | 3/3 | 4/4 | 5/5 | 6/6 | 7/7 | 8/8 | 9/9 |
| `feedback_capable_spec` | 1/1 | 2/2 | 3/3 | 4/4 | 5/5 | 6/6 | 7/7 | 8/8 | 9/9 |

## Interpretation

This is the first clean full provider difficulty probe in the current sequence. It shows that the harness, task package, visible feedback assets, hidden oracle, provider profile, replay validation, and summary generation can complete cleanly under the Sonnet profile.

The flat 9/9 result should be reported as a clean difficulty/protocol-provider result under this task/model/budget. It should not be described as evidence that executable feedback improved outcomes.

## Compatibility Boundary

The sealed analysis plan currently names `deepseek/deepseek-v4-flash`, while this clean run used `anthropic/claude-sonnet-4.6`. This run is therefore a separate model/provider compatibility boundary. It must not be pooled with DeepSeek-profile probes and should not be silently promoted into the sealed DeepSeek plan.

## Public Wording

Preferred wording:

> In a clean difficulty probe for `subscription-entitlements-lifecycle-v0`, both arms completed 9/9 checkpoints under `anthropic/claude-sonnet-4.6` with replayable artifacts and no provider validity flags. This is not causal evidence; it is a clean provider/task execution result under this task/model/budget.

Avoid wording:

> Feedback beats context.

> The benchmark proves feedback works.

> The task is solved.
