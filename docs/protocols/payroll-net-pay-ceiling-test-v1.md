# payroll-net-pay-ceiling-test-v1

Status: sealed draft for local package validation. No provider run is authorized by this document.

## Purpose

`payroll-net-pay-lifecycle-v1` is a ceiling-resistant follow-up task for the pricing result. Pricing was enough to support the bounded cheap-model-viability claim, but Sonnet/Qwen-class controls ceiled the 9-checkpoint pricing task. This protocol tests whether a longer and denser deterministic task gives strong models room to drift from prose alone while keeping the same content-control guardrail: both arms receive identical event API and worked examples; only `feedback_capable_spec` receives executable feedback assets and `bun run spec`.

The task is fictional payroll/net-pay arithmetic, not real tax law. The visible spec defines the whole policy.

## Frozen Boundary

- Task: `payroll-net-pay-lifecycle`
- Task version: `payroll-net-pay-lifecycle-v1`
- Checkpoints: `C01` through `C18`
- Conditions: `context_only_spec`, `feedback_capable_spec`
- Protocol profile: `path-survival-primary-v1`
- Budget: `--max-model-turns 2 --max-feedback-runs 1`
- Primary metric, if causal pilots are reached: `regression_free_auc_delta`
- Pooling: do not pool with pricing, subscription, inventory, `final-checkpoint-primary-v1`, or any later payroll task version.

## Canonical Command Shape

```bash
bun run pilot:run \
  --task tasks/payroll-net-pay-lifecycle \
  --runs-root runs \
  --run-id <run-id> \
  --agent openrouter-loop \
  --openrouter-model anthropic/claude-sonnet-4.6 \
  --run-classification <diagnostic_invalid|difficulty_probe|causal_pilot> \
  --protocol-profile-id path-survival-primary-v1 \
  --max-model-turns 2 \
  --max-feedback-runs 1 \
  --condition-concurrency 2 \
  --request-timeout-ms 120000 \
  --max-output-tokens 4000 \
  --max-workspace-bytes 64000 \
  --max-feedback-output-bytes 4000 \
  --openrouter-response-format json_schema \
  --openrouter-require-parameters true \
  --provider-max-retries 1 \
  --temperature 0.2
```

Equivalent direct-provider model-loop presets may be used only as a separately sealed provider boundary with the exact provider execution profile recorded before the smoke.

## Stage Plan

Stage A1: provider smoke.
Run one clean-path smoke to confirm provider, model slug, structured response handling, task load, hidden oracle, and replay path. Invalid provider/network runs are diagnostic only.

Stage A2: strong-model difficulty probe.
Run one `difficulty_probe` with the target strong model under the frozen budget. This is the ceiling gate.

Binding gate:
- If `context_only_spec` reaches `18/18`, the task failed its ceiling-resistant purpose for that model/budget. Stop. Do not run causal pilots. Iterate a new task version or publish the ceiling as the result.
- If both arms perform near floor and the feedback arm cannot make progress, stop. The task is too hard or underspecified for the budget.
- Proceed to Stage B only if the context arm does not ceiling and the task is not a floor.

Stage B: causal pilots.
Run three clean `causal_pilot` runs on the same sealed provider boundary. Use `regression_free_auc_delta` as primary. Treat the result as preliminary and bounded to this task/model/budget.

Predeclared run-loop-positive rule:
- feedback AUC higher in at least 2 of 3 counted clean pilots;
- mean delta at least `+0.10`;
- no final-checkpoint harm pattern that contradicts the AUC story.

## Interpretation

Positive: under this fictional payroll task/model/budget, executable BDD-style feedback improved long-horizon regression-free progress after content parity.

Flat/ceiling: strong models can already carry this deterministic spec from prose alone under this budget; the task is not useful for testing strong-model run-loop benefit.

Floor: the task is too hard for this budget or the spec is not operationally usable enough; redesign under a new version before causal claims.

All public claims must name run classification, validity flags, replayability, and this compatibility boundary.
