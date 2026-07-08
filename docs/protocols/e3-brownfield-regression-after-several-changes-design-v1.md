# E3 Brownfield Regression After Several Changes - Design v1

Status: **DESIGN DRAFT - not authorized, not run, not sealed.** No provider, Docker, or model run
fires from this document. Date: 2026-07-04.

This is a new compatibility boundary. It is never pooled with E1, the E2 acceptance-feedback pilots,
the E2 authored-spec/offline-pilot line, the Stage-0 executable-spec probe, or any pricing/subscription/
inventory task. It preserves those results as prior evidence and changes the next research question.

## Decision

After the latest results, the next useful experiment is not another single-issue acceptance-gap read
and not another authored-spec arm. The next useful experiment is to measure **regressions that appear
after an agent makes several changes in the same real brownfield repo**.

The E2 pilots already answered a narrower question: executable acceptance feedback can sharply reduce
single-task false confidence under a no-official-execution contrast. The July authored-spec calibration
then showed that spec-authoring fidelity can become the bottleneck before the causal question is even
reached. The remaining industry question is more operational:

> When an agent keeps modifying the same repo over multiple requested changes, how often does it break
> behavior that previously worked, and does executable feedback reduce that regression accumulation?

This better matches the risk teams care about: not just "did this one patch pass," but "after several
accepted edits, what still works?"

## Primary Question

Given a real repository, a base commit, and an ordered sequence of several real changes, does an agent
introduce regressions in previously accepted behavior as it implements later changes?

If a later causal pilot is run, the treatment question is:

> Holding repo, change sequence, visible request/spec text, agent scaffold, shell access, and budget fixed,
> does access to the official executable acceptance suite reduce true regressions across the sequence?

## Unit Of Work

The unit is an **episode**, not a single SWE-bench instance.

An episode contains:

- one real repo and one base commit
- an ordered sequence of `k` changes, target `k = 4..8`
- one visible request/spec packet per change
- one hidden acceptance bundle per change, `O_1..O_k`
- one carried-forward workspace per arm and rollout

At step `i`, the agent receives only change `i` as the new task, while the workspace contains its
previous changes from steps `1..i-1`. The scorer runs the cumulative hidden oracle set `O_1..O_i` after
the agent declares done or exhausts budget.

## Regression Definition

The core distinction is between **failure to implement** and **regression**.

- `current_change_success_i`: oracle bundle `O_i` passes after step `i`.
- `retained_success_{j,i}`: prior bundle `O_j`, where `j < i`, passes after step `i`.
- `true_regression_{j,i}`: `O_j` passed after step `i-1` and fails after step `i`.
- `unresolved_carryforward_{j,i}`: `O_j` was already failing after step `i-1` and remains failing after
  step `i`; this is not counted as a new regression.

Primary measurement is based on true regressions only. A run that never solved change `j` cannot later
"regress" `j`; it can only carry an unresolved obligation.

## Metrics

For the calibration phase:

- **Regression incidence:** probability that a later change introduces at least one `true_regression`.
- **Regression burden:** count of newly regressed prior oracle bundles per step.
- **Retained-correctness curve:** fraction of previously passed obligations still passing after each
  later step.
- **False-confidence gap:** declared done while any cumulative oracle in `O_1..O_i` fails.

For a later causal pilot, the preferred primary metric is:

**Regression-free episode survival:** the area under the per-step indicator that no true regression has
occurred so far in the episode, with treatment minus control as the contrast.

Secondary metrics:

- final cumulative pass rate
- current-change success rate
- false-confidence gap
- time/turns/tokens to first cumulative green
- regression repair rate after feedback exposes a prior failure

## Arms For A Later Causal Pilot

Do not run this until the calibration phase proves the metric fires.

- **Control:** file editing + shell/public tests. It may write and run its own tests. It never receives
  official hidden acceptance outputs, official acceptance command names, or hidden acceptance paths.
- **Treatment:** identical tools and visible specs, plus an execution-only official acceptance tool that
  runs the cumulative acceptance suite and returns check names plus pass/fail only. It does not return
  expected values, assertions, step source, or hidden files.

Both arms get the same maximum model-turn and wall-clock budget per change. Official feedback consumes
the treatment budget; it is not subsidized.

This contrast is deliberately stronger than the E2 no-execution control. It asks whether official
acceptance feedback still matters when the control can self-test, but cannot see or run the official
contract.

## Task Selection

Prefer existing brownfield repos and historical changes over experimenter-authored oracles.

Eligible episode requirements:

- the repo builds and tests reproducibly in a pinned container
- the selected change sequence applies cleanly in chronological order from the base commit
- each change has an isolated acceptance bundle that fails on the pre-change state and passes on the
  gold state
- the gold sequence passes all cumulative prior bundles after every later gold change
- later gold changes do not intentionally invalidate earlier behavior
- the visible request/spec text implies every hidden acceptance behavior
- the episode has enough non-locality that regressions are plausible, not guaranteed

Candidate sources:

- SWE-bench Live repos with multiple post-cutoff issues in the same project
- selected open-source repos with consecutive PRs and stable test environments
- internal synthetic sequencing only as calibration, not as public causal evidence

## Gates Before Any Model Spend

1. **Offline oracle certification:** no-op fails the current bundle, gold passes current and cumulative
   bundles, and later gold changes preserve prior bundles.
2. **Flake certification:** run each bundle and cumulative suite repeatedly in the pinned container;
   quarantine or drop flaky checks before sealing.
3. **Conflict audit:** reject sequences where later requested behavior legitimately changes earlier
   expected behavior.
4. **Leak audit:** hidden oracle files and commands are absent from the agent-readable workspace; the
   treatment tool returns only bounded names plus pass/fail.
5. **Replay requirement:** persist patch text, final workspace snapshot hashes, run transcripts, and
   score outputs so every step can be re-scored in a clean container.
6. **Control-only calibration:** run a small number of control episodes first. If true regressions are
   rare or zero, stop and reselect episodes before any treatment rollouts.
7. **Seal:** freeze repo commits, sequence order, visible packets, oracle bundles, flake quarantines,
   model/provider/scaffold, budgets, exclusions, metrics, and analysis before causal runs.

## Analysis Shape

Calibration should answer only whether the task family produces measurable true regressions and whether
the scorer separates regressions from unresolved carryforward.

A causal pilot should use paired episode/task structure:

- `N` rollouts per arm per episode, target `N = 5..10` after calibration
- paired comparison by episode and step
- primary analysis on regression-free episode survival
- secondary analysis on current-change success and false-confidence gap
- no pooling across repos, models, tool scaffolds, or sequence versions unless predeclared

## Why This Supersedes The Immediate Authored-Spec Push

The authored-spec work remains useful, but it is not the highest-leverage next causal study. It adds
an oracle-construction problem before the regression question is measured. E3 can start from historical
repo tests and real change sequences, then later plug in authored specs once the regression metric and
episode harness are proven.

The product-relevant claim also becomes sharper:

- weaker claim: executable feedback catches single-task false confidence
- stronger operational claim: executable feedback reduces regression accumulation as agents keep
  changing the same codebase

E3 is designed to test the stronger claim.

## Non-Goals

- no generalized benchmark platform
- no model leaderboard
- no new public causal claim from calibration
- no pooling with E2 or E1
- no hidden-oracle tuning after seeing arm outcomes
- no authoring-quality claim about HIT-SDD until authored specs are explicitly introduced and sealed

## Immediate Build Plan

1. Build an offline episode manifest format and scorer in the harness: base commit, ordered changes,
   oracle bundle paths, cumulative score records, and regression/carryforward labels.
2. Certify one tiny two-change smoke episode with injected patches to prove the scorer detects
   pass-to-fail regressions and does not count unresolved carryforward.
3. Select 2 candidate repos with 4 real sequential changes each; run offline gold/no-op/conflict gates.
4. Run control-only calibration with the production agent scaffold and shell access.
5. If true regressions fire above the predeclared minimum rate, seal a small two-arm causal pilot.

## Claim Ladder

- **Calibration:** the sequential brownfield harness can measure true regressions after several changes.
- **Difficulty/regression-incidence:** under this model/scaffold/budget, multi-change episodes produce
  a measurable regression burden.
- **Causal pilot:** official executable acceptance feedback reduces or does not reduce regression-free
  episode survival under the sealed task/model/budget.
- **Generalized claim:** not allowed from a single repo family, model, scaffold, or pilot.
