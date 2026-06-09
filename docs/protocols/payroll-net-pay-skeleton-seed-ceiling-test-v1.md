# payroll-net-pay-skeleton-seed-ceiling-test-v1

Status: draft local boundary. No provider run is authorized by this document.

## Purpose

`payroll-net-pay-lifecycle-skeleton-seed-v1` is a follow-up to the original payroll ceiling-resistant task after the Sonnet difficulty probe attempt exposed two problems:

- the provider run was not a clean A2 gate because later context checkpoints hit provider/API failure;
- the context arm's early failure pattern looked structural, not hard-rule drift.

This variant keeps the same 18-checkpoint payroll rules, visible semantic spec, executable feedback assets, and hidden oracle cases. It changes the template workspace seed so both arms begin with a complete public API shape and a working base payroll chain. The intended question is whether a strong model drifts on the later coupled rules, not whether it can bootstrap the file structure.

## Boundary

- Task: `payroll-net-pay-lifecycle-skeleton-seed`
- Task version: `payroll-net-pay-lifecycle-skeleton-seed-v1`
- Checkpoints: `C01` through `C18`
- Conditions: `context_only_spec`, `feedback_capable_spec`
- Protocol profile: `path-survival-primary-v1`
- Budget: `--max-model-turns 2 --max-feedback-runs 1`
- Primary metric, if causal pilots are reached: `regression_free_auc_delta`
- Pooling: do not pool with `payroll-net-pay-lifecycle-v1` or any prior pricing, subscription, inventory, or `final-checkpoint-primary-v1` evidence.

## Local Gates

- Difficulty/causal runs persist `workspace-code-after.json` per checkpoint so structural failures are auditable.
- The skeleton seed passes `C01` through `C06` under the sealed oracle before any provider run.
- The skeleton seed fails at the first hard YTD interaction (`C07`), so it is not a hidden reference implementation.
- A no-provider fake difficulty probe must replay cleanly with 36 steps and zero mismatches.

## Next Provider Gate

After a freeze commit records this boundary, the first provider run should be a single `difficulty_probe` only. Do not run causal pilots unless the context arm is neither ceiling (`18/18`) nor floor.

Provider/model details remain a separate sealed provider boundary. If the provider profile changes from the draft analysis plan, record that profile before the smoke/difficulty probe and do not pool with earlier payroll attempts.

## A2 Interpretation Rule

The skeleton seed is the baseline for reading the strong-model difficulty probe. Before any provider run, the baseline is:

- the seed itself passes `C01` through `C06`;
- the seed plateaus below the full task at `8/18`;
- a strong context arm receives that same working base and should at least preserve the easy early rules if it is engaging the task rather than structurally breaking it.

Ceiling defeated via hard-rule drift:

- `context_only_spec` preserves the easy early rules, including at least `C01` through `C06`;
- failures are concentrated in the coupled hard-rule region: `C07` through `C10` for YTD payroll taxes and phase-out interactions, and/or `C13` through `C18` for garnishments, recomputation, rounding, and idempotency;
- `feedback_capable_spec` is materially higher under the same budget.

This pattern may support proceeding to causal pilots because the context arm did not ceiling yet also did not fail from obvious structural breakage.

Suspicious, not bankable as ceiling defeat:

- `context_only_spec` fails at or below the skeleton baseline, especially by breaking `C01` through `C06`;
- near-zero context performance is a red flag, not evidence of useful ceiling resistance;
- inspect the captured `workspace-code-after.json` files before making any difficulty claim.

If inspection shows structural failure, wrong exports, non-compiling code, missing base event handling, or loss of the provided C01-C06 behavior, classify the run as low-signal for ceiling resistance even if the headline score is low.

Floor:

- if both arms cannot clear the early rules, do not headline the run;
- treat it as evidence that this task/profile/budget is too brittle or too hard for a clean A2 gate.
