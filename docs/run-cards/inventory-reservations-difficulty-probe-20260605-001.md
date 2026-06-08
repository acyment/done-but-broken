# Run Card: inventory-reservations-difficulty-probe-20260605-001

## Claim Level

Level 3 difficulty/provider claim, limited to this sealed task/model/budget.

This run belongs to the historical final-pass-primary profile and is not causal evidence. Its `regression_free_auc` result is secondary difficulty context, not primary `path-survival-primary-v1` evidence.

This run supports the narrow statement: under `inventory-reservations-lifecycle-v0`, the Mistral Small provider profile, and the 2/1 loop budget, both arms reached 9/9 at the final checkpoint in a clean provider run. The feedback-capable arm had temporary hidden-oracle misses at `I05` and `I06` before recovering by `I07`, so the secondary regression-free AUC delta was negative.

This is not causal evidence. The run classification is `difficulty_probe`, not `causal_pilot`.

## Run Identity

- Run ID: `inventory-reservations-difficulty-probe-20260605-001`
- Run classification: `difficulty_probe`
- Task: `inventory-reservations-lifecycle`
- Task version: `inventory-reservations-lifecycle-v0`
- Analysis plan: `tasks/inventory-reservations-lifecycle/analysis-plan.json`
- Result schema: `result-schema-v1`
- Run manifest: `runs/inventory-reservations-difficulty-probe-20260605-001/run.json`
- Result record: `runs/inventory-reservations-difficulty-probe-20260605-001/result.json`
- Generated summary: `runs/inventory-reservations-difficulty-probe-20260605-001/summary.md`

## Conditions

- `context_only_spec`: visible semantic spec only; no executable feedback command, feedback output, or feedback asset paths.
- `feedback_capable_spec`: same visible semantic spec, executable feedback assets available during agent work.

Because this is a `difficulty_probe`, feedback opportunity integrity is not treated as causal-pilot evidence.

## Model And Provider Profile

- Provider: `openrouter`
- Adapter: `openrouter-loop`
- Model: `mistralai/mistral-small-2603`
- Route: `openrouter-chat-completions`
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Response parser: `openrouter-response-parser-v1`
- Request parameter version: `openrouter-chat-request-max-tokens-v1`
- Response format version: `model-loop-response-json-schema-v1`
- Provider requires parameters: `true`
- Retry policy version: `provider-retry-timeout-rate-malformed-v1`
- Model loop policy version: `model-loop-feedback-continues-after-feedback-v1`
- Per-call timeout: `120000ms`
- Max output tokens: `4000`
- Workspace context cap: `64000` bytes
- Feedback summary cap: `4000` bytes
- Temperature: `0.2`
- Max provider retries: `1`

Provider profile ID:

```text
openrouter-loop-v1-modelmistralai-mistral-small-2603-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1
```

## Budget

- Max model turns: `2`
- Max feedback runs: `1`
- Primary metric checkpoint: `I09`
- Primary metric: final checkpoint pass-rate delta, feedback minus context

Both conditions received the same maximum model-turn budget.

## Inspection Result

`bun run inspect:run --run-manifest runs/inventory-reservations-difficulty-probe-20260605-001/run.json` reported:

- `valid=true`
- `replay_steps=18`
- `mismatches=0`
- `run_classification=difficulty_probe`
- `clean_primary_evidence_eligible=false`
- `validity_flags=none`
- `provider_timeout_phases=none`
- `provider_timeout_detail_count=0`
- `workspace_carried_forward_due_to_provider_failure_checkpoints=0`
- `feedback_opportunity_integrity=not_applicable (0/0)`

## Results

| Condition | Final passed | Pass rate | Regressions | Regression-free AUC |
| --- | ---: | ---: | ---: | ---: |
| `context_only_spec` | 9/9 | 1.00 | 0 | 1.00 |
| `feedback_capable_spec` | 9/9 | 1.00 | 0 | 0.7778 |

- Primary final checkpoint delta: `0`
- Secondary regression-free AUC delta: `-0.2222`

## Checkpoint Survival

| Condition | I01 | I02 | I03 | I04 | I05 | I06 | I07 | I08 | I09 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `context_only_spec` | 1/1 | 2/2 | 3/3 | 4/4 | 5/5 | 6/6 | 7/7 | 8/8 | 9/9 |
| `feedback_capable_spec` | 1/1 | 2/2 | 3/3 | 4/4 | 4/5 | 5/6 | 7/7 | 8/8 | 9/9 |

The feedback-capable arm missed the hidden cancellation-release commitment at `I05` and still carried that miss at `I06`, then recovered by `I07`. The context-only arm passed every checkpoint.

## Interpretation

This is a clean difficulty probe for the inventory task family. It suggests the final inventory task is solvable under this model/profile/budget for both arms, but not uniformly trivial because the feedback-capable arm had temporary hidden-oracle misses before recovering.

Do not cite this as causal evidence. A causal-pilot claim requires a run classified as `causal_pilot` with complete feedback opportunity integrity and no validity flags.

## Public Wording

Preferred wording:

> In a clean inventory difficulty probe under `mistralai/mistral-small-2603`, both arms finished 9/9, with final pass-rate delta 0. The feedback-capable arm had temporary I05/I06 misses before recovering, so secondary regression-free AUC favored context-only in this probe.

Avoid wording:

> Feedback hurt performance.

> The inventory benchmark proves context beats feedback.

> This is causal evidence.
