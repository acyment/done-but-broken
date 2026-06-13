# Red-Team Prompt: Can This 10-Task Pilot Actually Decide Go/No-Go — or Will It Mislead?

*Paste below the line into a strong reasoning model. Self-contained. Critiques only the PILOT's decision validity — not the broader experiment design. Be adversarial: find how the pilot produces a false GO or a false NO-GO.*

---

You are an adversarial reviewer of an experiment **pilot**. The full study design is assumed sound and is out of scope. Your only job: decide whether this thin 10-task pilot can produce a **trustworthy go/no-go**, or whether it will mislead — and if so, fix it. Be quantitative.

## What the pilot is for

A two-arm coding-agent ablation will eventually test whether letting a frontier agent execute hidden acceptance/regression tests (vs. not) reduces introduced regressions in large brownfield repos. Before building the full ~1,800-run program, this **pilot** runs a thin slice as the first gate. It must answer: (A) does the Docker harness run reproducibly, (B) is contamination measurable/controllable, (C) early read — does the no-feedback arm actually regress where the feedback arm doesn't, or do frontier agents self-verify to parity?

## The pilot design (fixed; critique it)

- **~10 tasks** from SWE-bench Live, post-cutoff, filtered for regression-risk (≥2 non-test files changed, modified code covered by ≥5 existing tests).
- **1 frontier model**; **2 arms** (control = can't run hidden oracle; treatment = can); **N=5 runs/arm/task** (~100 runs).
- **Primary signal: P2P regression count** (existing passing tests that fail after the agent's patch).
- **Three predeclared gates:**
  - **GATE A (feasibility):** all 10 tasks run end-to-end in Docker; per-task flaky rate ≤5% over N=10 baseline runs; artifacts replay-valid.
  - **GATE B (contamination):** memorization probes (issue-only file-path id >60% ⇒ high; function-body 5-gram overlap >25% ⇒ high) leave ≥8/10 tasks below threshold.
  - **GATE C (H0 read):** GO if treatment shows materially fewer P2P regressions than control — operationalized as ≥1 task where control regresses an existing P2P test that treatment does not, replicated in ≥3/5 runs. `control ≈ treatment` ⇒ early "self-verification survives at scale" ⇒ reconsider the program.

## Critical context

In all PRIOR (smaller, sealed) runs, frontier models produced **zero** pass→fail regressions in both arms — regression events are rare. The pilot's primary signal (control-side P2P regressions) may therefore be a very-low-base-rate event.

## Attack the pilot — specifically

1. **Is GATE C even informative at n=10?** Given how rare control-side regressions are, estimate the expected number of qualifying regression events across 10 regression-risk-filtered tasks if the true effect is real but modest. If that expectation is ~0–1, then `control ≈ treatment` is **indistinguishable from underpowered**, and the pilot's most likely output is a **false NO-GO that kills a real effect**. Is that the case here? What n and/or regression-enrichment would make GATE C actually able to fire?

2. **False GO from noise.** With N=5 and agent nondeterminism, could a single flaky/noisy task satisfy "≥1 task, ≥3/5 runs" spuriously — producing a false GO that greenlights a doomed program? Is the criterion calibrated, or arbitrary? Propose a criterion with an explicit error budget.

3. **Are the gate thresholds sourced or guessed?** Flaky ≤5%; memorization >60% file-id / >25% 5-gram; ≥8/10 survive. Which are defensible, which are arbitrary, and what would you set them to (with reasoning)?

4. **Single-model generalizability.** A 1-model go/no-go decides a multi-model program. If this model self-verifies but another frontier model wouldn't (or vice versa), the pilot's verdict is model-specific. Does that invalidate the go/no-go, or is 1 model acceptable for a *pilot* — and which model property most determines the answer?

5. **Wrong primary signal?** Is P2P-regression-count the right thing to measure at pilot scale, given its rarity? Would a more frequent, still-valid signal — task-success delta, or "the control arm's own self-tests missed a behavior the hidden oracle caught" (even short of a full pass→fail regression) — give a more informative early read without inflating false positives?

6. **Steelman the redesign.** Make the strongest case that GATE C should be DROPPED from this pilot entirely — i.e., run it as a pure feasibility + contamination pilot (A/B only), decide go/no-go on those, and defer any H0/regression read to a separately-powered phase. Is the combined pilot trying to do something n=10 cannot?

## Output

- **Per gate (A/B/C): can it fire, and is its threshold calibrated?** One line each.
- **The single most likely way this pilot misleads** — false GO or false NO-GO — and the one change that fixes it.
- **A recalibrated minimal pilot** (n, N runs, regression-enrichment, model count, primary signal) that makes the go/no-go trustworthy — or a clear statement that the go/no-go is sound as-is.
- **Run it as specced, or redesign first?** A clear call.
