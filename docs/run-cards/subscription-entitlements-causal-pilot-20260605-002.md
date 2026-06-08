# Run Card: subscription-entitlements-causal-pilot-20260605-002

## Claim Level

Level 4 causal pilot claim, limited to this sealed task/model/budget.

This run belongs to the historical final-pass-primary profile. Any `regression_free_auc` discussion is secondary retrospective context, not primary `path-survival-primary-v1` evidence.

This run supports the narrow statement: in a clean sealed two-arm pilot for `subscription-entitlements-lifecycle-v0` under the Sonnet provider profile and 2/1 loop budget, executable feedback did not improve final checkpoint pass rate or regression-free AUC because both arms completed all checkpoints.

It does not support a generalized claim about feedback across tasks, models, or budgets.

## Run Identity

- Run ID: `subscription-entitlements-causal-pilot-20260605-002`
- Run classification: `causal_pilot`
- Task: `subscription-entitlements-lifecycle`
- Task version: `subscription-entitlements-lifecycle-v0`
- Analysis plan: `tasks/subscription-entitlements-lifecycle/analysis-plan.sonnet-causal-pilot-v0.json`
- Result schema: `result-schema-v1`
- Run manifest: `runs/subscription-entitlements-causal-pilot-20260605-002/run.json`
- Result record: `runs/subscription-entitlements-causal-pilot-20260605-002/result.json`
- Generated summary: `runs/subscription-entitlements-causal-pilot-20260605-002/summary.md`

## Conditions

- `context_only_spec`: visible semantic spec only; no executable feedback command, feedback output, or feedback asset paths.
- `feedback_capable_spec`: same visible semantic spec, executable feedback assets available, and public-safe feedback summaries delivered before a later model turn.

The feedback-capable arm completed the required `model_turn -> feedback_run -> model_turn` opportunity sequence on all 9 checkpoints.

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

## Inspection Result

`bun run inspect:run --run-manifest runs/subscription-entitlements-causal-pilot-20260605-002/run.json` reported:

- `valid=true`
- `replay_steps=18`
- `mismatches=0`
- `run_classification=causal_pilot`
- `clean_primary_evidence_eligible=true`
- `validity_flags=none`
- `provider_timeout_phases=none`
- `provider_timeout_detail_count=0`
- `workspace_carried_forward_due_to_provider_failure_checkpoints=0`
- `feedback_opportunity_integrity=complete (9/9)`

## Results

| Condition | Final passed | Pass rate | Regressions | Regression-free AUC |
| --- | ---: | ---: | ---: | ---: |
| `context_only_spec` | 9/9 | 1.00 | 0 | 1.00 |
| `feedback_capable_spec` | 9/9 | 1.00 | 0 | 1.00 |

- Final checkpoint delta: `0`
- Regression-free AUC delta: `0`

## Checkpoint Survival

| Condition | I01 | I02 | I03 | I04 | I05 | I06 | I07 | I08 | I09 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `context_only_spec` | 1/1 | 2/2 | 3/3 | 4/4 | 5/5 | 6/6 | 7/7 | 8/8 | 9/9 |
| `feedback_capable_spec` | 1/1 | 2/2 | 3/3 | 4/4 | 5/5 | 6/6 | 7/7 | 8/8 | 9/9 |

## Interpretation

This is a clean causal pilot with a flat result. Under this task/model/budget, executable feedback did not improve final pass rate or regression-free survival because both arms already completed the full checkpoint sequence.

The result should be reported, not hidden. It is evidence about this sealed pilot only; it is not a generalized benchmark claim.

## Invalid Prior Attempt

`subscription-entitlements-causal-pilot-20260605-001` should remain diagnostic-invalid. Inspection found incomplete feedback opportunity integrity because the loop stopped after a passing feedback run and did not produce the required post-feedback model turn. The loop behavior was fixed before this `002` run.

## Public Wording

Preferred wording:

> In a clean sealed causal pilot for `subscription-entitlements-lifecycle-v0` under the Sonnet OpenRouter profile and 2/1 budget, both arms completed 9/9 checkpoints. Executable feedback produced no measured improvement on final pass rate or regression-free AUC in this run.

Avoid wording:

> Feedback does not work.

> Feedback beats context.

> The benchmark is solved.
