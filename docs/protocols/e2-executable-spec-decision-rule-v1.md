# E2 Executable-Spec — Stage-0 Decision Rule (v1)

Status: **PRE-REGISTERED DECISION RULE — written before running, so the outcome cannot be re-interpreted
after the fact.** Pairs with the Stage-0 probe protocol (`e2-executable-spec-stage0-probe-protocol-v1.md`).
Date: 2026-07-02. Classification of the run it governs: `calibration` / `difficulty_probe` (not causal-grade;
no public claim). Read with the external-review-prompt doc and the offline-pilot findings doc.

## Why this exists
A fierce external critique warned that this program risks being *positioning research* — an experiment whose
every outcome ends in "build the product anyway." The operator has confirmed the opposite: **a discouraging
result will genuinely stop or reshape the build.** That makes this real decision research, and the honest way
to keep it honest is to commit, in advance, to what we will claim (or retire) under each outcome. If we could
not fill this table in, that would be the tell that the experiment is theater.

## The one question Stage 0 answers
Does the executable-spec benefit **survive a control that can write and run its own tests?** Our two prior
pilots (false-confidence gap 79%→13%, etc.) used a control that could not execute *anything* — Addendum B §B8
explicitly marks the self-testing control as the un-licensed later claim. Stage 0 is that later claim, cheaply.

## What is compared, and on what
- **Control ("plain SDD"):** readable OpenSpec spec + shell; may write and run its own tests; never sees the
  sealed check code.
- **Treatment ("BDD"):** identical, **plus** an execution-only `run_spec` tool (check names + pass/fail only).

Two outcome measures, both scored experimenter-side against the sealed **authored** spec (gold used only as a
secondary cross-check), read through the mechanism decomposition in the protocol:
1. **Hidden-correct completion** — of runs the agent declared "done", how many actually satisfy the sealed
   authored checks.
2. **False-confidence gap** (`self_verification_gap`) — declared done while failing the sealed checks.

## The decision table

| Probe outcome | What it means | Decision / claim we commit to |
| --- | --- | --- |
| **Clear win on hidden-correctness AND false-confidence, on both model tiers** | Executable specs help build genuinely-correct features even vs. a self-testing control | **Build.** Headline: "executable acceptance specs → build-to-spec, fewer done-but-broken." Proceed to Stage 1 to size the effect. |
| **Win only on false-confidence, and/or only on the weaker model; top model ~ties on final correctness** | Durable value is *guardrails against false confidence* + value that *grows as agents get cheaper*; strong models can self-verify from a good spec | **Build**, but the honest pitch is **guardrails + cost/standardization, not frontier correctness.** This story is pre-committed here so a frontier-tie does not strand the claim. |
| **No win anywhere — a diligent self-testing control closes the gap entirely** | With a good SDD spec, agents that write their own tests do just as well; the executable affordance adds ~nothing | **Do NOT build** the executable-spec value proposition. (Operator-confirmed real stop.) Retire the "executable beats read-only" claim; any product must justify itself on a different value story. |
| **Uninterpretable — too few "declared-done-but-broken" events to measure (no signal at any N)** | Task calibration failure: agents rarely overclaim on these tasks, so the metric cannot fire | **No decision** — not evidence for or against. Reselect harder / more-overclaim-prone tasks, or abort. The control-only calibration pre-check (protocol step 2) is designed to catch this *before* spending on full rollouts. |

## Governing principles (also pre-registered)
- **Primary metric is mechanical** — sealed authored checks + pristine re-grade. A cheat-judge, if ever used,
  is a blind calibrated side-check confined to a sensitivity row; it never gates the primary.
- **A null is a first-class, reportable result** — the "no win" and "guardrails-only" rows are real findings,
  not failures.
- **We report the mechanism decomposition, not a single headline number** — it is the only output robust to
  both a hostile "you graded on your own tool" (against a positive) and a hostile "tiny N, miscalibrated
  tasks" (against a null).
- **This validates the foundation, not the product wedge.** A green result says "executable specs help,"
  *not* "our authoring/review UX wins" — that wedge needs its own validation with real users.
