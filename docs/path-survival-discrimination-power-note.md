# Path-Survival Discrimination-Power Note

Status: internal analysis of existing clean runs. Not a public claim. No provider/model runs were performed for this note.

This note quantifies whether the current sealed tasks, under the models/budget already run, produce enough regression signal for `regression_free_auc` (the planned `path-survival-primary-v1` primary metric) to discriminate the two arms. It reads only the persisted `result.json` artifacts of the six clean runs.

## Method

For each clean run, extract per-checkpoint `regression_free_success` for both arms from `checkpoint_metrics`, and inspect the underlying `evaluations` to classify every non-perfect checkpoint as either:

- an **initial-correctness miss**: the checkpoint's own newly introduced commitment failed on first evaluation, or
- a **true regression**: a commitment that passed at an earlier checkpoint failed at a later one.

The cumulative oracle is confirmed wired: at checkpoint `I0N` the oracle re-runs all `N` accumulated commitments (verified: `I09` evaluations contain 9 checks), so a true regression would be observable if it occurred.

## Runs included

Three clean causal pilots and three clean difficulty probes (the clean, replay-valid, non-provider-flagged set):

| Run | Boundary | ctx AUC | fb AUC | AUC delta (fb−ctx) |
| --- | --- | ---: | ---: | ---: |
| `subscription-entitlements-causal-pilot-20260605-002` | Sonnet/sub causal | 1.0000 | 1.0000 | +0.0000 |
| `subscription-entitlements-causal-pilot-20260605-003` | Mistral/sub causal | 0.8889 | 1.0000 | +0.1111 |
| `inventory-reservations-causal-pilot-20260605-001` | Mistral/inv causal | 1.0000 | 1.0000 | +0.0000 |
| `subscription-entitlements-difficulty-probe-20260605-009` | Sonnet/sub difficulty | 1.0000 | 1.0000 | +0.0000 |
| `subscription-entitlements-difficulty-probe-20260605-010` | Mistral/sub difficulty | 1.0000 | 1.0000 | +0.0000 |
| `inventory-reservations-difficulty-probe-20260605-001` | Mistral/inv difficulty | 1.0000 | 0.7778 | −0.2222 |

These are separate compatibility boundaries and are not pooled into one estimate. They are aggregated here only to count base-rate regression events, not to make a treatment claim.

## Findings

- **Regression-event base rate is ~3%.** Across 6 runs × 9 checkpoints × 2 arms = 108 arm-checkpoints, only 3 cells were not `regression_free_success` (1 context, 2 feedback).
- **Zero true regressions.** Every non-perfect cell was an initial-correctness miss of the checkpoint's own newest commitment, self-corrected at the next checkpoint:
  - Mistral/sub causal: context arm failed `trial-access-until-trial-end` at `I01` (the first commitment), passing from `I02` on.
  - Mistral/inv difficulty: feedback arm failed `cancellation-releases-unshipped-allocations` at `I05`–`I06` (the newly introduced `I05` commitment), passing from `I07` on.
  - In no run did a commitment that passed at an earlier checkpoint fail at a later checkpoint.
- **The two non-zero AUC deltas point in opposite directions** and each rests on a single transient checkpoint event: +0.1111 favors feedback (one context first-attempt miss), −0.2222 favors context (one feedback two-checkpoint miss).
- **The original primary metric is at a hard ceiling.** Final checkpoint pass-rate delta is 0 in every clean run; both arms finish 9/9 everywhere.

## Implication for `path-survival-primary-v1` Stage 1

- Under these task/model/budget boundaries, `regression_free_auc` variance comes from **first-attempt correctness on newly introduced behavior**, not from long-horizon regressions. That is not the construct the path-survival hypothesis targets.
- Stage 1 success requires mean AUC delta `>= +0.10` with feedback higher in at least 4 of 6 clean runs. The Mistral-specific evidence so far is 1 favorable (+0.1111), 1 unfavorable (−0.2222), 2 flat. With a ~3% event base rate and no true regressions observed, a flat/null Stage 1 is the most likely outcome, and any positive result would likely be carried by a small number of transient first-attempt misses rather than durable drift.
- This does not change any metric, threshold, task, or boundary. It is a pre-run feasibility caution, recorded so the Stage 1 interpretation cannot be reframed after outcomes are known.

## Recommended sequencing (no provider runs implied)

1. Decide whether Stage 1 is worth its provider cost given the ~3% base rate, or whether the higher-leverage next step is a task version explicitly designed to induce **durable** regressions (later checkpoints that can break earlier behavior), created under a new compatibility boundary and frozen before any run.
2. If Stage 1 proceeds, run it exactly as frozen; do not change metrics or thresholds after seeing outcomes.
3. Keep the distinction between "initial-correctness miss" and "true regression" in all path-survival reporting, since current AUC movement is entirely the former.
