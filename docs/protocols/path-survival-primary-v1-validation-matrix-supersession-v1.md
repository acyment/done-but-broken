# Supersession of the Path-Survival Primary v1 Validation Matrix (Pre-Execution)

Date: 2026-06-10.

This document supersedes `docs/protocols/path-survival-primary-v1-validation-matrix.md` (Stage 1 and Stage 2) **before any Stage 1 run was executed**.

## What is being superseded

- The predeclared Stage 1 matrix: 3 clean causal pilots each on `subscription-entitlements-lifecycle-v0` and `inventory-reservations-lifecycle-v0` under the sealed Mistral profile.
- The optional Stage 2 Sonnet ceiling comparison on the same two tasks.

The matrix was frozen at `matrix_freeze_commit=fe50a43de8162e1ccce21856b7119161290971c1`. No `stage1_execution_freeze_commit` was ever created, no operator approval was given, and **zero Stage 1 provider runs occurred**. This is a clean pre-execution supersession: no outcome was observed under this matrix, so no outcome-driven reinterpretation is possible.

## Why the matrix cannot discriminate

Quantified in `docs/path-survival-discrimination-power-note.md` (read-only analysis over `runs/*/result.json`, recorded 2026-06-07):

- Across the 6 existing clean runs on these task families (9 checkpoints × 2 arms each = 108 arm-checkpoints), only 3 arm-checkpoints were non-perfect and **zero were true cross-checkpoint regressions**. Every miss was a first-attempt correctness miss of a checkpoint's own new commitment.
- Root cause: the template workspaces for these tasks seed the complete correct solution into the agent's workspace, so there is essentially no incremental work and no opportunity for regressions.
- Subsequent ceiling evidence reinforced this: `anthropic/claude-sonnet-4.6` and `qwen3.7-max` solved the content-controlled pricing task 9/9 in both arms, and Sonnet solved the 18-checkpoint payroll skeleton-seed task 18/18 in both arms.

With a near-zero regression base rate and ceiling behavior in both arms, the predeclared support criterion (mean `regression_free_auc` delta `>= +0.10`, positive direction in 4 of 6 runs) has effectively no power: the expected outcome is a null regardless of whether the treatment works. Executing the matrix would spend provider budget to confirm a foregone flat result.

## What replaces it

The successor internal-validation slot is the **first E1 evidence task matrix**: a multi-file task with scattered cross-file invariants under the E1 turn-based protocol, designed so that frontier models do not ceiling and true regressions have a real base rate (naive-agent discrimination proof required before seal). Its design gates are precommitted in `docs/protocols/e1-first-evidence-task-design-gates-v0.md`, and its run matrix must be sealed and operator-approved before any evidence-generating run, per the unchanged guardrails.

## What does not change

- All historical run classifications and interpretations stand unchanged.
- The superseded matrix document remains in place as a frozen pre-registration; it must not be edited beyond its supersession banner or deleted.
- `path-survival-primary-v1` itself is not retired as a metric profile: `regression_free_auc` remains primary only for runs whose manifest declares a protocol profile naming it. The pricing `pricing-discount-demo-v1` and `pricing-discount-content-controlled-demo-v1` matrices, which declared this profile and produced clean evidence, are unaffected.
- The pre-written Stage 1 interpretation templates (`docs/protocols/path-survival-primary-v1-stage1-prewritten-interpretations.md`) are likewise frozen, unused, and historical.
