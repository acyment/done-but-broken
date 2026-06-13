# E2 Brownfield Acceptance-Feedback Ablation — Program Design Boundary (v1)

Date: 2026-06-13. **Status: precommitted program boundary, before any harness/task code.** New
program ("E2", brownfield path), distinct from the E1 sealed-task line. Authorizes no runs; runs
remain operator-authorized only. This document fixes what the program is and how a valid run is
defined, ahead of a critique round and a build.

## Why this program exists

The E1 sealed-task line established (four clean frontier ceilings + structural argument) that on
**small, fully-specified tasks testing regression-style feedback**, executable feedback is
redundant for frontier models — they self-verify by reconstructing the acceptance suite from the
spec (artifact: a control-arm model spontaneously writing the hidden oracle's edge-case test
`cp17-trace-equal-tie`). Two deep-research reports (2026-06-13,
`docs/research/brownfield-feedback-ablation-deep-research-PROMPT.md`) showed that conclusion does
**not** generalize, and that the program had been testing the weakest lever:

1. **Frontier models collapse at multi-file/brownfield scale** (replicated, step-function ~3–5
   files): SWE-bench Live (7+ files never solved), NoCode-bench (44%→9% multi), SWE-bench Pro
   (70%→25%), RefactorBench (no >6-file task solved), SWE-EVO (~25%), SWE-CI (zero-regression <0.25).
   Context overflow is a top-2 failure mode even for the strongest models.
2. **Self-generated tests do not reconstruct the regression surface at scale** (observational
   print≫assert; volume uncorrelated with success). No self-verify fallback when reasoning runs out.
3. **We tested the weakest signal.** ORACLE-SWE signal ranking: *Reproduction/acceptance-level
   feedback ≫ … ≫ Regression/pass-to-pass (weakest, +2–6%)*. E1's treatment was regression-style;
   the strongest lever — "does the code exhibit the specified behavior?" (the BDD/acceptance claim) —
   was never isolated.
4. **The benefit, if real, is coverage/context-bound, not reasoning** (ContextBench; SWE-Explore
   line-recall 0.05–0.19; AGENTS.md context files hurt ~3%).
5. **The exact ablation has not been run** — genuinely novel.

See [[brownfield-deep-research-verdict]] and [[frontier-feedback-structural-ceiling]].

## Hypothesis (precise, predeclared)

> **H1 (primary):** At brownfield scale, a frontier agent given executable **acceptance-level** spec
> feedback (BDD/Gherkin-flavored: it can execute the specified behaviors and the prior acceptance
> suite each turn) introduces fewer regressions and/or achieves higher task success than the same
> agent without that execution, **beyond what its own self-authored tests achieve.**
>
> **H2 (mechanism):** The benefit is coverage/context-bound — it appears when the regression surface
> exceeds what the agent retrieves/holds, and shrinks when the full relevant context is provided.
>
> **H0 (null, to be genuinely tested):** Even at brownfield scale, frontier agents self-verify well
> enough (via retrieval + self-tests) that provided acceptance feedback adds no significant delta.

## Conditions (the causal design)

Hold task, repository snapshot, and **visible spec content identical** across arms (E1 parity rule
carries over). Vary only executability of the hidden acceptance oracle. Two predeclared factors:

- **Factor F — feedback (primary causal variable):**
  - `control`: agent has the task + acceptance spec (behaviors in Gherkin/BDD prose), may write and
    run its own tests, **cannot** execute the hidden acceptance oracle.
  - `treatment`: identical, **plus** may execute the hidden acceptance oracle per turn (pass/fail per
    acceptance scenario — reproduction-flavored, not merely pass-to-pass regression).
- **Factor C — context provision (crossed, to separate H2 coverage from reasoning):**
  - `retrieved`: agent works from its own retrieval over the repo (naturalistic, context-bound).
  - `curated-full`: the full relevant code (all modules the gold change touches + their callers) is
    provided in context.
  - Predeclared reading: feedback helps under `retrieved` but not `curated-full` ⇒ **coverage**;
    helps under both ⇒ **reasoning**.

**Governance flag:** this defines new conditions. The E1 "do not add new arms" guardrail is scoped to
E1; E2 conditions are a new-program decision that must be **recorded at the AGENTS.md level** before
runs, and E2 results are **never pooled** with E1's two arms, nor across substrate/model/profile.

## Substrate

- **Calibration control:** SWE-bench Verified (mostly single-file). Predeclared prediction: **null
  feedback delta** for frontier models — replicates the E1 finding on a standard benchmark and
  validates the harness. A non-null here is a harness red flag.
- **Primary brownfield: SWE-bench Live, post-cutoff slice (RESOLVED by two independent deep-research
  reports, 2026-06-13).** Filtered to instances created after the model training cutoff (≥ ~Apr 2025
  for current frontier models), large repos (~400+ files). Ranked #1 on the gating dimensions
  (contamination resistance + brownfield scale + determinism), with the lowest build effort (harness
  + Docker images exist). Pro is #2 (best contamination resistance via private repos, but its human
  task-augmentation "specifies everything needed to pass the suite," which **erodes the hidden-oracle
  signal** for this study; sanitize its future-git-history mining loophole) — use as external-validity
  confirmation if access permits. Verified = calibration-only (predict null).
- **The candidate ("popular OSS + hide its own suite") is NOT the default** — both reports judge it
  near-worst for *detecting* the effect: training familiarity biases toward a **false null** (the
  model recalls the behavior, so the hidden suite adds no information). Done rigorously (post-cutoff
  tasks, sanitized snapshot, regression-risk filtering, hardened oracle) it *converges on Live*. Good
  instinct, wrong instantiation.
- **Stress (secondary):** SWE-EVO (release-scale evolution, ~21 files/874 tests) — natural
  regression-risk generator, use as external-validity set; RefactorBench is a poor fit (refactors have
  low regression risk; repos heavily memorized) — diagnostic only.

## Metrics (three families, predeclared)

- **Functional success:** resolve rate (F2P), stratified by patch scope (1 / 2–3 / 4+ files).
- **Regression (primary for the goal):** zero-regression rate, regression count (P2P pass→fail), and
  a continuous fix/break ratio for heavy suites. On-graph attribution where the substrate supports it.
- **Agent behavior:** self-test authoring (assert vs print), retrieval/coverage of the gold-touched
  files, turns/tokens spent.
- **Primary metric + MCID:** paired feedback delta on the regression metric, MCID predeclared (start
  +0.05 absolute zero-regression-rate; finalize in the sealed plan). Group-sequential, multi-run.

## Methodology / rigor (RESOLVED from two deep-research reports, 2026-06-13)

- **Contamination control (the single most likely study-killer — both reports):** post-cutoff tasks
  only; **memorization probes as a first-class covariate** — run issue-only file-path identification +
  function-body reproduction per task/model, report the memorization rate, and analyze effect
  heterogeneity by it (exclude or down-weight high-memorization tasks). SWE-Bench Illusion: 76%
  file-id from issue alone on Verified vs ~53% novel; up to 35% 5-gram overlap.
- **Adversarial snapshot sanitization:** strip future commits/remotes/branches/tags/reflog; block
  network. Agents have provably exploited `git log --all` for future commits in both SWE-bench and
  Pro's OSS set — assume you must sanitize; do not trust upstream images.
- **Regression-risk filter (mandatory; pre-register before any run):** keep only tasks with ≥2–3
  non-test files modified, non-trivial P2P, and modified code covered by ≥5 existing tests / high
  call-graph coupling. ~15–25% of instances survive → target **50–80 tasks**.
- **Oracle = full developer suite, hardened (not raw, not synthesized):** online feedback to
  `treatment` = a fast hidden *subset* (tests covering modified paths); offline evaluation = **full
  suite + PatchDiff/UTBoost differential testing**. Score on **PatchDiff-verified correctness, not raw
  suite-pass** — PatchDiff: 7.8% of plausible patches fail the full suite, 29.6% diverge, ~11% wrong;
  UTBoost: 345 wrongly-passed (40.9% Lite, 24.4% Verified). The ~30% weak-oracle gap is exactly where
  feedback should help.
- **Determinism:** Docker per instance; flaky detection (N=10 baseline runs, exclude inconsistent);
  pin deps; freeze environments.
- **Equalize compute budget across arms** (running the oracle consumes turns/tokens — a first-order
  confound; equalize or report budget-normalized).
- **Power:** **N≥5 runs per task per cell, paired per-task analysis.** Illustrative: 60 tasks × 2 arms
  × 5 runs × 3 models ≈ 1,800 runs (~$900–3,600), >80% power for a 15-pt effect at σ≈0.2.
- **Pre-registration:** filter criteria, models, N, and primary outcome (PatchDiff-verified
  correctness) registered before any run.
- **Sealing/replay:** seal the sanitized repo snapshot + task set + hardened oracle; record full
  trajectories for replay and the agent-behavior metrics.

## Predeclared confounds + mitigations

1. **Signal mismatch (undersell):** thin per-turn binary may undersell vs a rich reproduction oracle.
   *Mitigation:* feedback is acceptance/reproduction-flavored by design, not bare pass/fail.
2. **Validator weakness:** weak suites inflate/contaminate. *Mitigation:* oracle hardening above.
3. **Compute-budget confound:** *Mitigation:* equalize budgets across arms.
4. **Curriculum / test-distribution leakage:** treatment could probe the oracle to reverse-engineer
   hidden cases. *Mitigation:* limit oracle output to acceptance pass/fail (no expected values), cap
   probing, log it as an agent-behavior metric.
5. **Oracle-as-free-reasoning-step:** execution forces serialization, a generic benefit.
   *Mitigation:* the `curated-full` cell + self-test-equalization isolate this; report it honestly if
   present (it generalizes to "execution helps," still a valid but narrower claim).
6. **Contamination:** *Mitigation:* contamination-resistant primary substrate; treat Verified results
   as calibration only.

## Classification + run discipline

Runs classified `calibration` (harness/determinism shakedown), `difficulty_probe` (does the substrate
discriminate / does self-verification hold at scale), or `causal_pilot` (paired feedback delta), per
the existing scheme. Evidence-grade runs require a sealed plan + commitments hash. No pooling across
classification, substrate, model, or context-factor cell. All runs operator-authorized.

## Build order (each phase operator-authorized; critique round before Phase 0 build)

0. **Critique round** on this boundary (red-team prompt, as with E1/ledger) + AGENTS.md governance
   note opening the E2 program.
1. **Harness spike + determinism/sealing proof:** stand up a Docker-based two-arm runner on ~10
   tasks; prove reproducibility, oracle hardening, budget-equalization, trajectory capture.
2. **Calibration on Verified:** confirm the predicted **null** feedback delta (frontier self-verifies
   on single-file) — internal-validity check tying E2 to the E1 finding.
3. **Brownfield difficulty probe:** does the primary substrate discriminate, and does self-verification
   break down at multi-file scale (the make-or-break, H0)?
4. **Causal pilot:** paired acceptance-feedback ablation, crossed with the context factor, on the
   brownfield substrate; the H1/H2 measurement.

## What could kill it (honest)

- **H0 holds at scale:** frontier agents retrieve-and-self-test their way back to self-sufficiency
  even multi-file. Cheapest early test: Phase 3 (or a pre-Phase-0 mini-pilot on a handful of
  genuinely multi-file tasks).
- **Rigor bar unreachable** on real repos (flakiness, attribution). Phase 1 is the go/no-go gate.
- **Effect is purely "execution helps,"** not acceptance-spec-specific — the `curated-full` cell and
  budget-equalization are designed to catch this; if so, the honest claim narrows.

## Concurrent standalone (no dependency on E2 outcome)

The E1 capability-gradient finding ("executable spec feedback's value concentrates where models can't
self-verify; redundant for frontier models on tractable specs") is publishable now, supported by
ORACLE-SWE (regression-weakest), Rethinking-Agent-Generated-Tests, and the E1 `cp17-trace-equal-tie`
artifact. Recommended to write up independently of E2.
