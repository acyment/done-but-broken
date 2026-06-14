# E2 Phase-1.5 — Powered Effect Read, Sealed Analysis Plan (v1)

Date: 2026-06-14. Sealed analysis plan for the **powered** two-arm read of the E2 brownfield
acceptance-feedback ablation, pre-registered before any Phase-1.5 run. Executes only after Phase 1
(the A/B feasibility + contamination gate, `e2-phase1-pilot-spec-v1.md`) passes, and only under
explicit operator authorization. Hashes published in `e2-phase1-pilot-commitments-v1.md`.

## Question

Does giving a frontier coding agent executable **acceptance-level** feedback (the `run_tests` tool,
which runs the hidden acceptance subset in the authoritative container) reduce the rate at which it
**ships false confidence** on brownfield tasks — i.e. declares done while the oracle would fail —
relative to no such feedback, beyond what it self-verifies?

## Boundary

| Field | Value |
| --- | --- |
| Program | E2 (`e2-brownfield-acceptance-ablation-design-v1.md`) |
| Substrate | SWE-bench Live, frozen candidate pool `e2-phase1-5-candidate-pool-v1.json` (40 multi-file post-cutoff regression-risk instances, 30 repos) |
| Harness | `hit-sdd-bench-e2` @ the commit hashed in the commitments doc |
| Model / route | `deepseek-v4-pro` (litellm openai-compatible, `https://api.deepseek.com/v1`) |
| Arms | `control` (file_editor) vs `treatment` (file_editor + container-backed `run_tests`); `retrieved` context |
| Classification | `causal_pilot` (powered effect read) |

## Primary signal (predeclared) — the self-verification gap

**Self-verification gap** = a run where the agent **declared done** (called `finish` →
`execution_status == FINISHED`) AND the hidden oracle would **fail** (not resolved, or a P2P
regression). Unit = **task-run**. Chosen over shipped P2P regressions because the sub-pilot
(`e2-phase1-subpilot-...-001`) showed it is more frequent and more stable run-to-run (the gap held
across repeats where the shipped-regression count varied 1→0). It is the mechanistic quantity: the
agent ships something it believes correct; treatment's executable feedback is hypothesized to catch
it.

- **Secondary:** task-success (resolve) delta, treatment − control.
- **Tertiary (logged, not gated):** shipped P2P regression count.

## Hypothesis & directional prediction

H1: `treatment` self-verification-gap rate < `control` rate (executable feedback lets the agent
detect-and-fix its false-confidence shipments before declaring done). H0: rates equal.

## Design & sizing

- **n ≈ 20–40 tasks** from the frozen pool surviving Phase-1 (flake-certified + below the
  memorization-GATE-B threshold); replenish from the pool to the target if some fail the gates.
- **N = 10 runs/arm/task** (the sub-pilot's N=1 is at the noise floor; N≈10 gives a 6/10-vs-0/10
  paired split p≈0.0054 — enough headroom to detect "control ships the gap ~60% of runs, treatment
  ~0%").
- **Compute-budget equalised across arms** (running `run_tests` consumes the agent's iteration
  budget); record per-run budget for budget-normalised reporting.
- **Enrichment:** the pool is metadata-enriched for hardness (multi-file, large P2P), which yields a
  high gap base rate by construction (hard tasks → frequent declare-done-but-wrong). Canary tasks
  (a seeded known regression in ≥1 task) confirm the harness detects a regression when present.

## Criterion (null model + error budget; no post-hoc reinterpretation)

Per task, compare the N control vs N treatment gap outcomes with a one-sided exact/permutation test
(under H0 the 2N outcomes are exchangeable); correct family-wise across tasks; **GO/positive requires
k tasks individually significant where P(k | arm-independent-flake null) ≤ 0.05**, AND a predeclared
**MCID** of ≥ 0.20 absolute reduction in mean gap rate (treatment vs control). A result may not be
driven by a single unreproduced flaky task — replay must confirm.

## Asymmetric single-model rule

DeepSeek V4 Pro is the frontier target. **A significant positive constitutes a candidate frontier
positive** (the win the program sought). **A single-model null does NOT close the question** — it is
inconclusive (the verdict is confounded by this model's self-verification disposition); a null read
must be bracketed with ≥2 models of differing self-verification strength before any "feedback doesn't
help frontier" statement. (Per critique: pick a low self-verifier to make a null most informative;
DeepSeek is chosen as the in-scope frontier model, so a null here is explicitly non-closing.)

## Predeclared outcomes

- **Positive** (criterion met) → candidate frontier-positive: *executable acceptance feedback reduces
  frontier false-confidence shipping on brownfield tasks under this model/substrate*. `causal_pilot`,
  bounded, replication-pending; never a Level-5 generalised claim.
- **Null** (criterion not met, clean) → inconclusive for DeepSeek V4 Pro; report, bracket with more
  models before any frontier-null statement.
- **Structural failure** (flake/contamination/protocol stalls dominate) → no claim; redesign.

## Validity rules

Post-cutoff + memorization GATE B; flake-certified tasks only; budget-equalised; replay-valid (patch
re-scored in a clean container reproduces recorded hashes); `declared_done` captured from
`FINISHED` status. Never pooled with E1, with Phase-1 calibration/shakedown runs, or across
model/substrate/profile.

## Cost (honest) & feasibility

This is the expensive run: n≈20–40 × 2 arms × 10 runs ≈ 400–800 OpenHands+DeepSeek agentic runs
(minutes + tokens each), plus Phase-1 flake certification (≥60 container suite-runs/task) and
memorization probes. Many GB of images, many hours, real money. The plan permits **subsampling the
40-task pool to a feasible n** (recorded) and a per-run + overall spend cap fixed at authorization;
DeepSeek V4 Pro is cheap per token, but the agentic + container compute is the binding cost.

## Invocation prerequisites (before any Phase-1.5 run)

1. Phase 1 passes (GATE A flake + GATE B contamination) on the chosen subset.
2. Seal the final flake-certified, contamination-screened task list (an addendum hashed into the
   commitments doc) — the candidate pool here is the pre-gate frozen input.
3. Explicit operator authorization + spend cap.
