# E2 Confoundability-Metric Design (v1) — predicting where agents confidently ship broken code

Status: **DESIGN DRAFT — not authorized, not run, not sealed.** No provider/Docker run fires from
this document. New compatibility boundary; never pooled with the n=9/n=13 causal pilots, the
budget-sensitivity study, Protocol v2, or E1. Sealing (hash + operator authorization + spend cap +
sealed commitments) is a separate step, after review and (recommended) a feasibility pilot.

Date: 2026-06-21. Program: E2 (`e2-brownfield-acceptance-ablation-design-v1.md`). Companion to
`e2-budget-sensitivity-design-v1.md` and `e2-protocol-v2-large-repo-navparity-design-v1.md`.

## Why this exists (the open gap)

Three independent deep-research surveys converged on one thing: the literature robustly links task
properties to **lower resolution**, and separately documents model **overconfidence**, but the
**joint** measurement — *property → confident-wrong (self-verification-gap) rate* — is **thin/unmeasured**.
Our own pilots show the gap is **predictable in principle, not random**: tasks of similar raw difficulty
diverge sharply in gap (qwen, this run: `datamodel-2408` control gap **6/10** vs `black-4670` **1/10**,
both `resolve 0/10`). A **static, answer-independent score that predicts where a capable agent will
confidently ship broken code** would therefore be a **first-class, generalizable contribution** — and it
*subsumes* task selection (once you can predict the gap, enrichment is just "rank by predicted gap").

## Goal

Build and **validate** a **confoundability score** `C(task)` — computed from answer-independent task
features — that predicts the **self-verification-gap rate** (declared-done ∧ hidden-oracle-would-fail)
for a *class* of strong self-verifier coding agents, with a non-circular labeling and a prospective
validation guard.

## Constructs

- **Confoundability (label):** the control-arm self-verification-gap rate on a task, measured over a
  **screener ensemble** of strong self-verifier models. Model-relative by nature, so the target is the
  gap for a *class* (ensemble mean / per-model), not one model.
- **Score (predictor):** `C(task)` = a function of answer-independent features, fit to predict the label.
- **Truer label via the strengthened oracle:** label the gap against a **strengthened hidden oracle**
  (original F2P + held-out P2P regression tests + a reproduction test + a mutation/"skeleton-swap"
  check that must fail on a hollowed implementation). The current F2P-only oracle *under-counts* the
  gap (plausible-but-wrong patches pass it), so it would bias labels low; the strengthened oracle gives
  a truer target.

## Candidate features (answer-independent; the convergent shortlist)

Computed from the gold patch, repo, and issue text — never from any model's run:
1. **Non-locality:** files-changed, gold-patch lines, **hunk count & spatial dispersion**.
2. **Edit-to-failure distance:** static dependency/call-graph distance between edit sites and the
   files exercising the failing behavior (indirection).
3. **Weak-observed-oracle / coverage gap:** ratio of behavior covered by *visible* tests vs the
   held-out regression surface; size of held-out P2P set.
4. **Repo/context scale:** repo file count, LOC, context required.
5. **Issue specification completeness** (fairness-bounded — see caveats): presence of repro/stack
   trace/logs vs implementation hints; spec length. *Used cautiously: ambiguity raises gap but risks
   "tricking the model"; prefer hidden-regression difficulty over ambiguous specs.*

## Method

1. **Mine** a large fresh **post-cutoff** candidate pool (SWE-bench Live / SWE-rebench-style),
   date-filtered to after each screener model's cutoff.
2. **Contamination screen** each task with our GATE-B file-path/continuation probe (the same probe the
   surveys independently recommended); drop memorized tasks.
3. **Flake-certify + strengthen the oracle** per task (F2P + held-out P2P + reproduction + mutation
   check; suite must pass on gold, fail on a hollowed impl, be deterministic over N reruns).
4. **Label:** run a **screener ensemble** (≥2–3 strong self-verifiers of *different lineages*) on the
   control arm (no test execution), N runs/task, measure the gap → per-task label.
5. **Fit** a predictor (logistic regression / IRT-style difficulty+discrimination) of the gap from the
   features; report **feature importance** (which properties drive confoundability — this is the
   literature-gap-filling result) and **held-out predictive AUC / calibration**.
6. **Prospective validation (the proof):** select *new* held-out tasks by *predicted* `C`, run them,
   and check predicted-vs-observed gap calibration. Optionally test **transfer**: does a metric fit on
   the ensemble predict the gap for a *new held-out model* not in the ensemble?

## Non-circularity guards (constraint #4)

- Features are **answer-independent** (gold patch / repo / issue only).
- Labels come from a **screener ensemble held out from any model the score will later be applied to** —
  never label with, then predict for, the same model.
- The headline claim is the **prospective** held-out-task calibration, not in-sample fit.

## Primary outcomes (predeclared)

- **Predictive performance:** held-out AUC / calibration of `C` for the gap (the metric works or it
  doesn't).
- **Feature-importance ranking** with effect sizes — the generalizable scientific output ("these
  answer-independent properties predict confident-wrong failure, by this much").
- A **null is a real result:** "static task properties do *not* robustly predict confoundability" is
  publishable and corrects the field's implicit assumption.

## Sizing & cost (honest — this is the expensive one)

Fitting/validating a predictor needs **many labeled tasks**: order **100–300 mined tasks × a 2–3 model
screener ensemble × N runs each**, plus per-task flake-cert + oracle-strengthening. That is far larger
than the causal pilots. **Stage it:** a **feasibility pilot** (~30–40 tasks, 1–2 screeners) first — if
*no* feature shows signal at that scale, do not scale up. Only expand to the full pool if the pilot
shows a predictive signal.

## Relationship to the other studies

- **Subsumes task-selection/enrichment:** the metric *is* the selection rule (rank by predicted gap).
- **Uses the oracle-strengthening upgrade** (held-out P2P + reproduction + mutation) for truer labels —
  that upgrade is also a candidate improvement to the gap metric in all E2 work.
- **Independent of** budget-sensitivity and Protocol v2 (different questions; never pooled).

## Caveats

- **The property→gap link is the hypothesis under test** — it may come back weak/null (a valid result).
- **Model-relativity:** confoundability differs across models (qwen self-verifies better than DeepSeek,
  per the live run). The robust target is a *class* of strong self-verifiers via a diverse ensemble;
  transfer to out-of-ensemble models must be validated, not assumed.
- **Ambiguity/fairness tension:** the spec-completeness feature can drift into "trickery"; keep tasks
  fair (human-screened), favor hidden-regression difficulty.
- **Label cost** is the binding constraint; the feasibility pilot gates the spend.

## Sequencing / gating

1. Current qwen replication completes and is reported.
2. Review; build the strengthened-oracle + feature-extraction harness; run the **feasibility pilot**.
3. If signal: sealed commitments + operator authorization + spend cap → full mine/label/fit/validate.

## Status

**DESIGN DRAFT, decisions recorded.** Does not authorize or affect any running pilot. The headline it
targets: *a static, answer-independent score that predicts, before any attempt, where a capable coding
agent will confidently ship broken code.*
