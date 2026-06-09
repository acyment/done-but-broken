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
