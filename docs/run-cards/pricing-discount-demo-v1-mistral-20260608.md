# Run Card: pricing-discount-demo-v1 Mistral Matrix 20260608

## Claim Level

Level 4 preliminary causal pilot claim, limited to this sealed task/model/budget.

This matrix supports a narrow statement: on `pricing-discount-lifecycle-v0` under `mistralai/mistral-small-2603`, `path-survival-primary-v1`, and a 2-turn / 1-feedback budget, executable spec-derived feedback improved regression-free path survival and final checkpoint pass rate in three clean causal pilots. It does not satisfy the full predeclared "demo-positive" label because one clean feedback-capable run had two regression events, so the "feedback arm shows fewer true regressions" guard is mixed rather than positive.

It does not support a generalized claim about BDD, feedback, tasks, models, or agents.

## Sealed Boundary

- Matrix profile: `pricing-discount-demo-v1`
- Freeze commit: `145d5ac`
- Task: `pricing-discount-lifecycle`
- Task version: `pricing-discount-lifecycle-v0`
- Analysis plan: `tasks/pricing-discount-lifecycle/analysis-plan.json`
- Protocol profile: `path-survival-primary-v1`
- Primary protocol metric: `regression_free_auc_delta`
- Budget: `max_model_turns=2`, `max_feedback_runs=1`

## Provider Profile

- Provider: `openrouter`
- Adapter: `openrouter-loop`
- Model: `mistralai/mistral-small-2603`
- Route: `openrouter-chat-completions`
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

## Corrected Readiness Runs

| Run ID | Classification | Valid | Flags | Budget | AUC Delta | Final Delta | Notes |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| `pricing-discount-demo-v1-smoke-20260608-002` | `diagnostic_invalid` | yes | none | 2/1 | +0.7778 | +0.7778 | Provider path clean; not causal evidence. |
| `pricing-discount-demo-v1-difficulty-probe-20260608-002` | `difficulty_probe` | yes | none | 2/1 | +0.5556 | +0.5556 | Task is not a floor/ceiling; not causal evidence. |

## Clean Causal Pilots

All three clean causal pilots have:

- `valid=true`
- `run_classification=causal_pilot`
- `clean_primary_evidence_eligible=true`
- `validity_flags=none`
- `feedback_opportunity_integrity=complete (9/9)`
- Budget `2/1`

| Run ID | Context AUC | Feedback AUC | AUC Delta | Context Final | Feedback Final | Final Delta | Context Regressions | Feedback Regressions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pricing-discount-demo-v1-causal-pilot-20260608-002` | 0.2222 | 0.7778 | +0.5556 | 0.2222 | 0.7778 | +0.5556 | 0 | 0 |
| `pricing-discount-demo-v1-causal-pilot-20260608-003` | 0.2222 | 0.4444 | +0.2222 | 0.2222 | 0.6667 | +0.4444 | 0 | 2 |
| `pricing-discount-demo-v1-causal-pilot-20260608-004` | 0.2222 | 0.7778 | +0.5556 | 0.2222 | 1.0000 | +0.7778 | 0 | 0 |

Aggregate over clean causal pilots:

- Clean causal pilots: `3`
- AUC deltas: `+0.5556`, `+0.2222`, `+0.5556`
- Mean AUC delta: `+0.4444`
- Positive AUC direction: `3/3`
- Mean final checkpoint pass-rate delta: `+0.5926`
- Regression-count deltas, feedback minus context: `0`, `+2`, `0`
- Mean regression-count delta: `+0.6667`

## Excluded Runs

These runs are recorded but excluded from the sealed matrix evidence because they used runner defaults `max_model_turns=3`, `max_feedback_runs=2` instead of the frozen 2/1 budget:

| Run ID | Classification | Reason Excluded |
| --- | --- | --- |
| `pricing-discount-demo-v1-smoke-20260608-001` | `diagnostic_invalid` | Budget mismatch: 3/2 instead of frozen 2/1. |
| `pricing-discount-demo-v1-difficulty-probe-20260608-001` | `difficulty_probe` | Budget mismatch: 3/2 instead of frozen 2/1. |
| `pricing-discount-demo-v1-causal-pilot-20260608-001` | `causal_pilot` | Budget mismatch: 3/2 instead of frozen 2/1; also not clean primary evidence eligible because feedback opportunity was incomplete at `I01`. |

The corrected replacement runs explicitly passed `--max-model-turns 2 --max-feedback-runs 1`.

## Mechanism (companion analysis)

The `path-survival-primary-v1` protocol requires distinguishing improved first-attempt implementation from reduced long-horizon regressions. The artifacts make the mechanism clear, and it is not "feedback removed regressions":

- The context-only arm scored exactly `2/9` final and AUC `0.2222` with `0` regressions in **every** clean run. Inspecting its agent results, the weak model frequently returns "no file changes needed" and never successfully progresses beyond the seeded I01-I02 behavior. Its low AUC is **failure to complete the later requirements**, not regression of earlier-passing behavior.
- The feedback-capable arm ran feedback at every checkpoint and made substantive workspace edits across the later checkpoints: every clean run edited I03-I08, two of three edited I09, and I01-I02 needed no edits because the seed already satisfied those checks. It implemented `6/9`-`9/9`. So the AUC and final-pass advantage is primarily an **implementation-and-completion** effect: executable feedback turned a stalled weak agent into a productive one, and it preserved earlier behavior across the sequence in 2 of 3 runs.
- The only true regressions in the entire clean set were on the **feedback** side: in `causal-pilot-003`, the feedback agent passed I01-I04 then, while adding the discount cap at I07, regressed two earlier commitments (`order-percent-coupon-on-post-line-subtotal` and `fixed-coupon-applies-after-percent-coupons`) and did not recover within the 2/1 budget. This is exactly the interaction trap the task was designed to surface.

Honest reading: under this model/budget, executable spec-derived feedback **enabled implementation and largely preserved behavior** where the context-only weak model stalled. It is **not** evidence that feedback reduces regressions; if anything, the only regressions observed occurred while the better-progressing feedback arm took on harder, interacting checkpoints.

## Interpretation

Under the sealed pricing task, Mistral profile, and 2/1 budget, executable spec-derived feedback improved the primary path-survival signal in all three clean causal pilots. The result is not flat and not a single-outlier signal. As the mechanism section explains, the gain is driven by the feedback arm implementing and preserving far more of the spec while the context-only arm stalled at the seed, not by feedback removing regressions.

The full predeclared "demo-positive" label is not satisfied because the feedback arm did not show fewer true regressions by `regression_count`; one clean feedback-capable run had two regression events. The most accurate wording is:

> In a sealed pricing lifecycle pilot under `mistral-small` with a 2-turn / 1-feedback budget, executable spec-derived (BDD-style) feedback let the agent implement and preserve far more of the spec than context-only specs in three clean runs (regression-free path-survival AUC +0.44, final checkpoint pass rate +0.59, positive in 3/3). Without executable feedback the weak model largely stalled at the starting point. This is an implementation-and-survival gain under this task/model/budget, not evidence that feedback removes regressions: the only true regressions observed were in one feedback-capable run. Earlier lifecycle tasks were easier and produced limited regression signal.

Avoid:

> Feedback proves BDD works.

> Feedback always reduces regressions.

> This is generalized benchmark evidence.
