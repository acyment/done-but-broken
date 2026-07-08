# Claim B (tautological self-tests) — B0/B1 results write-up (v1)

**Date**: 2026-07-05. **Classification**: `mechanism_probe` (calibration family), control-only,
single task, NOT causal evidence, NOT generalizable beyond the task studied.
**Design + full tables**: `e2-claim-b-tautology-control-calibration-design-v1.md` (predictions
were committed there before launch). **Artifacts**: `hit-sdd-bench-e2/runs/claim-b/`.

## What was run

One real post-cutoff GitHub bug (freezegun-582) with a sealed authored spec as the hidden
answer key (SWE-bench gold as cross-check; the two agreed on all 60 rollouts). Shell-capable
control agents (can write and run their own tests), 20 rollouts per model: DeepSeek V4 Flash
(cheap), DeepSeek V4 Pro and Qwen 3.7 Max (frontier). For every rollout, three measured facts:
did the agent declare done; what its own tests say when re-run on its final code; what the
sealed spec says. Plus B0: the same instrumentation applied retroactively to 12 stored
calibration rollouts. Total spend ≈ $1–2.

## Findings

1. **The tautology claim is dead at every tier, including frontier.** In 72 measured rollouts
   (40 of them frontier), not one agent-written test wrongly passed failing code. Agent
   self-tests were near-perfectly calibrated against the sealed spec. This null IS a
   frontier-valid result — it kills a claim we might otherwise have built on.

2. **The dramatic failure was cheap-model-only.** Flash declared done 10 times, wrong all 10 —
   5 times while its own test was visibly failing. Under the operator's standard (results must
   encompass strong models to be useful), this is not a usable product finding.

3. **The frontier residue is real but thin on a task this easy.** V4 Pro: 17/20 done-claims
   correct; all 3 misses were made over a red own-test (15% of its claims). Qwen 3.7 Max:
   10/10 correct, and it withheld "done" on 6 of 7 red own-tests — near-ideal discipline.
   On freezegun-582 the frontier mostly solves the task and mostly respects its own evidence;
   this echoes the known ceiling pattern (`frontier-feedback-structural-ceiling`): easy,
   self-verifiable tasks leave little room for any oracle intervention to matter.

## What this licenses / forbids

- Licenses (bounded): "agent-written tests were reliable in this study; the observed failure
  mode was declaring done against or without one's own test evidence, concentrated in the
  cheap tier with a measurable frontier residue."
- Forbids: "agents write tautological tests" (0/72), any frontier-relevant product claim from
  the flash numbers, and any generalization beyond this single task without new runs.

## Disposition (2026-07-05, operator)

Only results that encompass strong models count as useful for the program. B1's frontier
signal is too thin on a solvable task to build on, and the tautology frame is closed-null.
**The program moves to the regression story** (fallback Claim A: sequential changes to one
repo, oracle = previously-passing behavior): the honest home of frontier-relevant failure,
per `e2-fallback-claims-regression-and-tautology-v1.md` and this week's E3 groundwork.
E3's certified episodes were proven structurally regression-resistant (non-overlapping files);
the next step is selecting overlap-prone episodes before any new model spend.
