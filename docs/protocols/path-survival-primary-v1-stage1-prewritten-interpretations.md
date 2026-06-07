# Path-Survival Primary v1 — Stage 1 Pre-Written Interpretations

Status: pre-registered interpretation templates. Written **before** Stage 1 execution so the reading of results cannot be reframed after outcomes are known. Not a public claim. No provider/model runs were performed for this document.

This document fixes, in advance, how each possible Stage 1 outcome will be described. It does not change any metric, threshold, task, budget, or boundary defined in `path-survival-primary-v1.md` and `path-survival-primary-v1-validation-matrix.md`. If those documents and this one ever disagree, the protocol and matrix govern the rules; this document only governs wording.

## Frozen decision rule (restated, not changed)

Stage 1 = 6 clean causal pilots: 3 × `subscription-entitlements-lifecycle-v0` + 3 × `inventory-reservations-lifecycle-v0`, all under `mistralai/mistral-small-2603`, budget `max_model_turns=2` / `max_feedback_runs=1`, protocol profile `path-survival-primary-v1`.

Primary metric: `regression_free_auc` delta (feedback − context).

This frozen Stage 1 matrix covers only the subscription and inventory tasks. The newer
`pricing-discount-lifecycle-v0` task (built to actually produce true regressions) is NOT
part of this matrix and must not be silently added to it. Before pricing can enter any
evidence-generating phase, publish a separately versioned matrix (e.g.
`path-survival-primary-v1` Stage 1b or a `-v2` matrix) that declares the pricing
task/model/budget boundary and its own decision rule, and have it reviewed and approved.
Pricing runs must not be pooled with subscription/inventory runs or with
`final-checkpoint-primary-v1` evidence.

**Support** requires ALL of:

- feedback-capable AUC strictly higher in `>= 4 of 6` clean runs,
- mean AUC delta `>= +0.10`,
- no systematic final checkpoint pass-rate harm in the feedback arm,
- every included run `clean_primary_evidence_eligible=true`.

A run is eligible only if clean and replay-valid with complete feedback opportunity integrity. Provider-flagged/invalid runs are recorded, excluded, and replaceable only under the matrix replacement rules. Replacement counts are reported separately.

## Mandatory companion analysis for every outcome

Because the pre-run discrimination-power check (`docs/path-survival-discrimination-power-note.md`) found a ~3% regression-event base rate and **zero true regressions** across prior clean runs, every Stage 1 interpretation MUST additionally report, per non-perfect checkpoint:

- whether the failure was an **initial-correctness miss** (the checkpoint's own newest commitment failed first time) or a **true regression** (an earlier-passing commitment later failed), and
- how many distinct checkpoint events drive the AUC delta.

This classification is descriptive bookkeeping, not a new metric or gate. It exists so a positive AUC result carried entirely by first-attempt misses is not described as path-survival / regression evidence.

## Outcome A — Null / flat (current most-likely outcome)

Triggered when AUC direction is `<= 3 of 6`, or mean AUC delta is near zero / below `+0.10`, or the result is dominated by one outlier run.

Allowed wording:

> Under the predeclared `path-survival-primary-v1` Stage 1 matrix (`mistralai/mistral-small-2603`, two sealed lifecycle tasks, 2/1 budget), executable feedback did not show a path-survival benefit. The mean `regression_free_auc` delta did not reach the predeclared `+0.10` threshold, and feedback was higher in fewer than 4 of 6 clean runs. Final checkpoint pass rate remained flat (secondary). This is a clean, replay-valid null result under these task/model/budget boundaries; it is not a generalized claim that executable feedback does not help.

Required companion sentence:

> AUC movement in this matrix came predominantly from initial-correctness misses on newly introduced commitments rather than from true regressions of earlier behavior, consistent with the pre-run discrimination-power finding.

Do NOT write: "feedback does not work", "the benchmark disproves feedback", or any generalized negative.

## Outcome B — Support (treatment-positive)

Triggered only when ALL frozen support conditions are met simultaneously.

Allowed wording:

> Under the predeclared `path-survival-primary-v1` Stage 1 matrix (`mistralai/mistral-small-2603`, two sealed lifecycle tasks, 2/1 budget), executable feedback improved `regression_free_auc` relative to the same visible spec without executable feedback: higher in at least 4 of 6 clean runs, mean delta `>= +0.10`, with no systematic final-pass harm. This is a preliminary, task/model/budget-specific Level 4 causal-pilot result, not a generalized benchmark claim.

Mandatory qualifier before any positive result is published:

> The companion analysis must confirm whether the AUC advantage reflects avoided **true regressions** or faster **initial correctness**. If it is predominantly initial-correctness, the result is described as "executable feedback improved first-attempt commitment correctness across the checkpoint sequence," NOT as "executable feedback reduced long-horizon regressions." A long-horizon-regression claim requires at least some true-regression events that feedback demonstrably avoided.

Do NOT escalate to Level 5 or pool across boundaries. Stage 2 (Sonnet) remains an optional ceiling/control and must not be used to rescue or reinterpret Stage 1.

## Outcome C — Mixed / underpowered

Triggered when direction is favorable but the threshold is not met, or the signal rests on one or two transient checkpoint events, or runs split by task (e.g. subscription favorable, inventory unfavorable).

Allowed wording:

> Stage 1 produced a directional but underpowered signal. It does not meet the predeclared support threshold and is treated as null for claim purposes. The most likely explanation, given the low regression base rate, is insufficient discrimination power rather than a confirmed small effect.

Next step for Outcome C is a task-difficulty redesign under a new compatibility boundary, not repeated reruns of the same matrix in search of significance.

## Outcome D — Provider-limited / invalid

Triggered when runs are provider-flagged, replay-invalid, or have incomplete feedback opportunity integrity. Per the matrix, if two consecutive scheduled runs under the same provider profile fail for the same mode, stop Stage 1 and revise the provider profile under a new boundary before continuing.

Allowed wording:

> Stage 1 could not be completed as clean primary evidence due to provider/execution validity flags. Affected runs are recorded and excluded; clean-evidence counting is incomplete. No causal interpretation is made.

## Anti-drift commitments

- Do not change the `+0.10` threshold, the 4-of-6 direction rule, the primary metric, the tasks, the budget, or the boundaries after seeing results.
- Do not exclude inconvenient clean runs.
- Do not relabel an initial-correctness effect as a regression effect.
- Do not present any Stage 1 outcome as public validation of the path-survival hypothesis without the claim-level review required by `AGENTS.md`.
