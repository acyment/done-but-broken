# E2 Phase-1 Pilot Spec (v1) — Brownfield Acceptance-Feedback Ablation

Date: 2026-06-13. **Status: precommitted pilot spec, before any harness build or run.** Phase 1 of the
E2 program (`docs/protocols/e2-brownfield-acceptance-ablation-design-v1.md`). Docs-only; authorizes no
build and no runs (both operator-gated behind a sealed commitments doc).

> **REVISED 2026-06-13 after a four-model decision-validity critique.** The original combined pilot
> put a causal "H0 read" (GATE C) on n=10. The critique converged (with matching power math) that
> GATE C was structurally invalid: under a *real, substantial* effect (p_control≈0.08, p_treat≈0.02)
> it fires only ~4% of the time → **~96% false NO-GO**, while any residual test flake manufactures
> **false GOs** via unspecified-test multiplicity (~0.79 at f=0.1 over ~20 covering tests). Root cause:
> **GATE C had no null model**, so its firing was governed by flake, not by the treatment effect; and
> the primary signal (shipped P2P regressions) is a ~0-base-rate event at this scale. **Fix applied
> here:** split into **Phase 1** (A/B feasibility + contamination — the actual gate, which n≈10 *can*
> decide) and **Phase 1.5** (a separately-powered, regression-enriched effect read); demote the H0
> read from a gate to a base-rate *measurement*; change the primary effect signal to the
> **self-verification gap**. Git preserves the pre-revision version.

## Why a pilot before the program

The E2 design is settled by research; the remaining unknowns are empirical. Rather than commit to the
full program, this pilot is a thin slice that answers what n≈10 *can* answer — is the harness
reproducible, and is contamination measurable/controllable — and *measures* (does not gate on) the
base rates needed to correctly power the effect read. A pilot's legitimate job is to break the
assumptions that would invalidate the program (broken harness, invalid replay, uncontrollable
contamination); estimating a rare-event effect is a categorically different job that needs its own
powered phase.

---

## Phase 1 — the gate (A/B only; this is what decides go/no-go)

**Scope:** replenish-screen until **10–12 clean usable tasks** (do not "tolerate 2/10 contaminated" —
replace flagged/flaky tasks until the target count is clean); **1 frontier model**; **2 arms**
(`control` = no hidden-oracle tool; `treatment` = has it), `retrieved` context only. Agent runs:
**2–3/arm/task** suffice for harness/logging smoke (5 only if you also want nondeterminism
diagnostics). The expensive LLM cost here is small; the determinism work below is cheap suite re-runs.

- **GATE A — Feasibility.** All tasks run end-to-end in Docker; every run produces replay-valid
  artifacts (hashes verify; no missing/schema-error artifacts). **Flake certified properly:** "≤5%
  over N=10" is unmeasurable (0/10 only bounds true flake at ≤~26%, rule of three) and screens the
  wrong distribution. Instead, run each task's suite **≥60 times under BOTH arms' patches** (not just
  the base commit) to certify *patch-induced* per-test flake; require an exact upper bound ≤5% (≈0
  failures in 60), and quarantine/label any flaky test out of the oracle. *Fail → fix infra.*
- **GATE B — Contamination controllable.** Memorization probes (issue-only file-path id; function-body
  overlap) with thresholds **calibrated against negative controls** — set each at the 95th percentile
  of a genuine-post-cutoff null (same probe on tasks the model demonstrably cannot have seen), not the
  guessed >60% / >25%. Prefer a loss/perplexity or canary-quiz probe over n-gram overlap (n-gram rides
  on code boilerplate). Replenish tasks until the target count falls below threshold. *Fail →
  substrate/filter rethink.*
- **Decision:** **GO** to Phase 1.5 iff A and B pass. **Do NOT issue a NO-GO from absent regressions** —
  `control ≈ treatment` at this scale is indistinguishable from underpowered and must not be read as
  "self-verification survives at scale."
- **Measure (do not gate):** per `control` run, the **self-verification gap** (§Primary signal) and a
  first estimate of the control-side regression base rate `p_c`. These size Phase 1.5.

---

## Phase 1.5 — powered effect read (only if Phase 1 passes; separately sealed + authorized)

- **Primary signal — the self-verification gap (not shipped P2P regressions).** Per `control` run:
  *(the hidden oracle would fail) AND (the agent's own verification passed / it declared done)*. This
  is the mechanistic quantity the experiment is about, occurs far more often than a shipped P2P
  regression, and is objective (scored against the golden oracle). **Unit = task-run** (a single bug
  fails many tests; model test counts as overdispersed secondary data, not independent observations).
  Secondary = task-success delta (different construct — resolution, where the ceiling bites — keep
  secondary). Tertiary = shipped P2P regression count (logged, not gated).
- **Regression enrichment (highest-leverage change).** Filtering for "≥5 covering tests" does NOT move
  the base rate. Engineer `p_c ≈ 0.3–0.4` by construction: seeded/mutation-style regressions or
  historically-regressing tasks (changes known to have caused a regression), plus ≥1 **canary** task
  with a known injected regression to prove the harness detects a regression when one exists.
- **Sizing:** **n ≈ 20–40** enriched tasks, **N ≈ 10/arm** (N=5 leaves the most-extreme observable
  split 5/0 at p=0.004, but 3/0 at p=0.083 — below the noise floor; N≈10 gives headroom, e.g.
  6/10-vs-0/10 ≈ 0.0054).
- **Criterion (with a null model + error budget).** Per task, a one-sided permutation/Fisher test on
  the paired arm outcomes; family-wise correction across tasks; pre-registered total error budget
  (GO requires k significant tasks where P(k | arm-independent-flake null) ≤ 0.05). A result may not be
  driven by a single unreproduced flaky task — replay must confirm the same failure on the same
  artifact in clean containers.
- **Asymmetric single-model rule.** 1 model is acceptable, but: a **positive may GO; a single-model
  null may NOT NO-GO** (a one-model null is inconclusive — the verdict is confounded by that model's
  self-verification disposition). Choose the model **adversarially to your own NO-GO**: the *lowest*
  spontaneous self-verifier available, because a null there is the most informative null and a positive
  most cleanly demonstrates the mechanism. (A strong self-verifier guarantees a null → false NO-GO.)
  If C-grade evidence is wanted, bracket with ≥2 models of differing self-verification strength.

---

## Harness shape (build-ready)

- **Base:** fork SWE-bench Live's evaluation harness (Docker image per instance, F2P+P2P runner,
  time-machine dependency pinning). Agent scaffold: **OpenHands** (Live's validated setup) — verify it
  exposes tool-config for the feedback toggle; fall back to SWE-agent.
- **Feedback channel = a toggleable tool.** `treatment` gets a `run_tests` tool executing the **fast
  hidden subset** (tests covering the modified paths) returning **per-scenario pass/fail**
  (acceptance/reproduction-flavored; no expected values, no full-suite dump). `control` lacks it (it
  may still run its OWN tests via the shell). Only difference between arms.
- **Capture the agent's own verification state.** To compute the self-verification gap, log when the
  agent runs its own tests, what it concluded, and when it declares done — then score that final state
  against the golden oracle offline.
- **Adversarial snapshot sanitization (mandatory):** strip future commits/remotes/branches/tags/reflog;
  block network. Agents have exploited `git log --all` for future/fix commits in SWE-bench and Pro's
  OSS set — sanitize and verify no `git show <fix>` path exists.
- **Compute-budget equalization** across arms (running the oracle consumes budget); record per-run
  budget for budget-normalized reporting.
- **Artifact capture (mirror provenance discipline, not code):** per run — sanitized snapshot hash,
  container image ID, agent trajectory + self-verification state, the patch, feedback-tool calls, full
  + subset test results. Validate hashes on replay. Mirror `src/provenance.ts` concepts
  (`RunCompatibilityProfile`, `ReplayPlan`, `RUN_VALIDITY_FLAGS`); extend validity scopes/phases for
  container concerns. Built fresh — repo is in-process today.

## Memorization-probe procedure (Phase 1 GATE B input)

Per task/model, before the ablation: issue-only file-path identification + a loss/canary memorization
probe (preferred over n-gram). **Thresholds set as the 95th percentile of a genuine-post-cutoff
negative-control distribution**, not fixed guesses. Report the memorization score per task as a
covariate; replace tasks above threshold.

## Determinism shakedown (Phase 1 GATE A input)

Run each selected instance's suite **≥60 times under both arms' patches** (cheap — no LLM); exclude
tests with inconsistent results from the subset and the oracle; certify the exact patch-induced-flake
upper bound ≤5%.

## Classification, pre-registration, budget

- **Classification:** Phase 1 is `calibration` (harness/determinism) + `difficulty_probe` (contamination
  controllability + base-rate measurement). Phase 1.5 is a separately-classified effect read; neither
  is `causal_pilot`-grade evidence (the full program is).
- **Pre-registration:** seal `e2-phase1-pilot-commitments-v1.md` (commit-then-reveal SHA-256 of: this
  spec, the frozen clean task list, the negative-control-calibrated thresholds, the flake/sanitization
  manifests, the harness commit) before running. Phase 1.5 gets its own sealed commitments doc with the
  enrichment set, N, the permutation-test criterion, and the error budget — fixed before any 1.5 run.
- **Budget:** Phase 1 LLM cost is small (~10 tasks × 2 arms × ~3 runs ≈ 60 agent runs; the ≥60 suite
  re-runs are non-LLM). Phase 1.5 ≈ 20–40 tasks × 2 arms × 10 runs ≈ 400–800 agent runs (1 model).
  Both operator-authorized with per-run + overall caps in the commitments docs.

## Reuse vs build-new

- **Reuse (discipline, not code):** run-card layout (`docs/run-cards/`); classification + validity
  concepts (`src/provenance.ts`); commitments/sealed-plan pattern
  (`docs/protocols/e1-billing-v2-commitments-v4.md`, `…-stage1-plan-v4.md`); evidence recording
  (`docs/public-evidence-status.md`, `docs/progress-log.md`).
- **Build new:** Docker runner + agent-scaffold fork, the toggleable `run_tests` tool, self-verification
  state capture, snapshot sanitization, the (calibrated) memorization probe, the ≥60-run patch-induced
  flake loop, the permutation-test analysis, container-aware artifact capture/replay.

## What this pilot explicitly does NOT establish

A `causal_pilot`-grade result, any public claim, the context (coverage-vs-reasoning) separation, the
PatchDiff-hardened correctness metric, or multi-model generality. Phase 1 decides only harness
feasibility + contamination controllability and *measures* base rates; Phase 1.5 produces a powered
early effect read under an explicit null model, not a program-level conclusion.
