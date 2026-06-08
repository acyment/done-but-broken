# Run Card: pricing-discount-content-controlled-demo-v1 Mistral Matrix 20260608

## Claim Level

Level 4 preliminary causal pilot claim, limited to this sealed task/model/budget.

This matrix supports a narrow statement: on `pricing-discount-lifecycle-content-controlled-v1` under `mistralai/mistral-small-2603`, `path-survival-primary-v1`, and a 2-turn / 1-feedback budget, executable feedback improved regression-free path survival in three clean causal pilots even when both arms received the same event API and the same worked examples. The effect is smaller than the earlier `pricing-discount-demo-v1` result, which confirms that interface/worked-example disclosure explained part of the old gap.

It does not support a generalized claim about BDD, tasks, models, or agents.

## Sealed Boundary

- Matrix profile: `pricing-discount-content-controlled-demo-v1`
- Freeze commit: `3adb9ea`
- Task: `pricing-discount-lifecycle-content-controlled`
- Task version: `pricing-discount-lifecycle-content-controlled-v1`
- Analysis plan: `tasks/pricing-discount-lifecycle-content-controlled/analysis-plan.json`
- Protocol profile: `path-survival-primary-v1`
- Primary protocol metric: `regression_free_auc_delta`
- Budget: `max_model_turns=2`, `max_feedback_runs=1`
- Content control: both arms receive identical event API and worked examples; only `feedback_capable_spec` receives runnable feedback assets and `bun run spec`.

## Provider Profile

- Provider: `openrouter`
- Adapter: `openrouter-loop`
- Model: `mistralai/mistral-small-2603`
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

## Readiness Runs

Readiness runs are not causal evidence.

| Run ID | Classification | Valid | Flags | Context AUC | Feedback AUC | AUC Delta | Context Final | Feedback Final | Final Delta | Regressions C/F |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `pricing-discount-content-controlled-demo-v1-smoke-20260608-001` | `diagnostic_invalid` | yes | none | 0.2222 | 0.7778 | +0.5556 | 3/9 | 6/9 | +0.3333 | 0 / 1 |
| `pricing-discount-content-controlled-demo-v1-difficulty-probe-20260608-001` | `difficulty_probe` | yes | none | 0.3333 | 0.4444 | +0.1111 | 4/9 | 6/9 | +0.2222 | 0 / 0 |

A1 and A2 both passed the predeclared gates: replay-valid, 18 replay steps, zero mismatches, no provider/network validity flags, no provider timeouts, no provider-failure carry-forward, and exact sealed provider profile.

## Clean Causal Pilots

All three causal pilots have:

- `valid=true`
- `run_classification=causal_pilot`
- `clean_primary_evidence_eligible=true`
- `validity_flags=none`
- `feedback_opportunity_integrity=complete (9/9)`
- `replay_steps=18`
- `mismatches=0`
- Budget `2/1`
- Exact sealed provider profile

| Run ID | Context AUC | Feedback AUC | AUC Delta | Context Final | Feedback Final | Final Delta | Context Regressions | Feedback Regressions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pricing-discount-content-controlled-demo-v1-causal-pilot-20260608-001` | 0.4444 | 0.7778 | +0.3333 | 7/9 | 7/9 | 0.0000 | 0 | 0 |
| `pricing-discount-content-controlled-demo-v1-causal-pilot-20260608-002` | 0.4444 | 0.5556 | +0.1111 | 4/9 | 7/9 | +0.3333 | 0 | 0 |
| `pricing-discount-content-controlled-demo-v1-causal-pilot-20260608-003` | 0.3333 | 0.4444 | +0.1111 | 3/9 | 6/9 | +0.3333 | 1 | 0 |

Aggregate over clean causal pilots:

- Clean causal pilots: `3`
- AUC deltas: `+0.3333`, `+0.1111`, `+0.1111`
- Mean AUC delta: `+0.1852`
- Positive AUC direction: `3/3`
- Final checkpoint pass-rate deltas: `0.0000`, `+0.3333`, `+0.3333`
- Mean final checkpoint pass-rate delta: `+0.2222`
- Regression-count deltas, feedback minus context: `0`, `0`, `-1`
- Mean regression-count delta: `-0.3333`

## Predeclared Interpretation

This satisfies the matrix's **run-loop positive** criterion: feedback-capable AUC is higher in at least 2 of 3 clean causal pilots, mean AUC delta is `>= +0.10`, and there is no systematic final-pass harm.

The cleanest wording is:

> On an interface- and example-controlled pricing lifecycle task under `mistral-small` with a 2-turn / 1-feedback budget, both arms received the same concrete event API and worked examples; executable feedback improved regression-free path survival in three clean causal pilots (mean AUC delta +0.1852, positive in 3/3) and improved mean final checkpoint pass rate by +0.2222 under this task/model/budget.

The result is materially smaller than the earlier `pricing-discount-demo-v1` Mistral matrix, where mean AUC delta was `+0.4444` and mean final-pass delta was `+0.5926`. That shrink is expected and important: the old result bundled runnability with interface/worked-example disclosure. The content-controlled result shows that the executable run-loop still helped after equalizing that content, but the public story should acknowledge that content disclosure carried part of the original advantage.

## Mechanism

The context-only arm no longer stalls at the seeded `2/9` pattern seen in the original pricing task. Across the three clean causal pilots it reached `7/9`, `4/9`, and `3/9`. That is direct evidence that content parity mattered.

The feedback-capable arm reached `7/9`, `7/9`, and `6/9`. It did not reach 9/9 in any clean causal pilot, so this is not a "feedback solves the task" result. It is a path-survival and completion gain under a tight 2/1 budget.

Regression evidence is favorable but sparse: the only true regression in the clean causal set was context-side in B3. Do not headline "feedback reduces regressions" from one event; report it as a secondary mechanism observation.

## Compatibility

Do not pool this matrix with:

- `pricing-discount-demo-v1` (`pricing-discount-lifecycle-v0`)
- Gemini, Qwen, DeepSeek, or provider-triage pricing control runs
- subscription/inventory lifecycle runs
- `final-checkpoint-primary-v1` evidence
- provider-flagged or invalid runs

## Avoid

> Feedback proves BDD works.

> Feedback always reduces regressions.

> This generalizes across models/tasks.

> The original pricing v0 result and this content-controlled result can be pooled.
