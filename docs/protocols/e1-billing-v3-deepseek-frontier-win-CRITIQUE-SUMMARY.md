# Critique Brief: Can Executable Feedback Help a Frontier Coding Model? (DeepSeek V4 Pro on billing-v3)

**Purpose of this document.** We are about to spend money running an experiment and want
adversarial critique *before* we run it. This is a self-contained brief for external reviewers
(including other AI assistants) with no access to our codebase. Please read it as a skeptic:
your job is to find the ways this experiment could mislead us, not to encourage us. Specific
questions are at the end.

---

## 1. The research question

Does giving an AI coding agent **per-case executable feedback** (it can run a hidden test
oracle each round and see exactly which cases pass/fail) materially improve its work, *for a
top-tier frontier model* — or is that benefit confined to weaker models that vanishes once a
model is strong enough to "reason it out" on its own?

This distinction matters. The 2026 literature suggests feedback *utilization* rises with
capability but absolute gains shrink at the top due to a **ceiling/redundancy effect**: a strong
model internally generates the repair signal that feedback would have provided, so feedback
becomes redundant. We have reproduced this ourselves (see §3). We want to know whether there is
a task structure where feedback remains *necessary*, not just helpful, even at the frontier.

## 2. The experimental design (two arms, one variable)

A "task" is a sequence of 18 checkpoints. At each checkpoint the agent receives a new
requirement (in a spec/BDD format), edits a shared multi-file codebase, and may take up to 12
turns. The codebase **carries forward** — checkpoint N builds on the state left by N−1. A hidden
oracle (197 test cases, cumulative) scores the workspace at each checkpoint end. The primary
metric is the mean cumulative pass rate across checkpoints ("regression-free AUC").

Two arms, **identical in everything the agent sees except one variable**:

- **`context_only_spec`** (control): the agent gets the spec text only. It may write and run its
  *own* scratch tests, but it cannot run the hidden oracle.
- **`feedback_capable_spec`** (treatment): identical spec text, **plus** the agent can execute
  the hidden oracle cases each turn and see per-case pass/fail.

The only difference is **executability of the oracle**. Both arms see the same visible content
(same spec, same worked examples). This parity is a hard rule in our protocol — we previously had
a version where the treatment arm saw *more content*, and we rebuilt it to remove that confound.

**Stage 1** (this brief's immediate subject) runs the **control arm only** to ask: does a
frontier model, *without* feedback, actually fail this task in the specific way we predict
(silent regressions)? If the control arm already aces it, there is no headroom for feedback to
help and the task cannot demonstrate anything — so Stage 1 is a go/no-go gate.

**Stage 2** (only if Stage 1 passes) runs **both arms, paired**, to measure the feedback effect
size. A win = treatment AUC exceeds control AUC by at least +0.05 (our pre-registered MCID),
consistently across seeds.

## 3. Why we believe the frontier ceilings — and why this task might be different

On a prior task (`dispatch`), difficulty came from **scattered coordination**: a change had to
be propagated to ~4 sites across the codebase. A mid-tier model (Qwen 3.7 Max) benefited a lot
from feedback (+0.15 mean AUC across 3 paired seeds). But the frontier model (DeepSeek V4 Pro)
**ceilinged the control arm** (AUC 0.93–0.98 across 3 seeds) — it simply spent ~8 turns per
checkpoint brute-force-searching the codebase until it had updated every site. Feedback had
nothing to add because exhaustive search found everything anyway.

**The lesson:** "find the scattered sites" difficulty is brute-forceable by a patient strong
model. Scaling it up (more sites) just buys more search.

**The new task (`billing-v3`)** is built around a different difficulty that we argue is *not*
brute-forceable:

- A **deterministic state-hash** function (`replayStateHash`) is seeded into the codebase from
  checkpoint 1 and specified with worked examples. It serializes the full accumulated domain
  state in a canonical field order and hashes it (FNV-1a). Hidden test cases re-check this hash
  cumulatively at every checkpoint.
- 13 of 18 checkpoints **extend the state**, each requiring an exact addition to the canonical
  field registry (field name, owning aggregate, position). Both arms are told exactly what to
  add and are given a worked example (input event list → expected hash).
- 4 late checkpoints **force a whole-file rewrite** of a file that owns frozen, byte-stable
  behavior (e.g. the serializer, the money/allocation module). The new requirement cannot be
  satisfied without restructuring the file, so the agent **must** re-emit code that carries
  invariants specified many checkpoints earlier.

**The hypothesized asymmetry:** a hash cannot be verified by reading. If, during a forced
rewrite, the agent drops or reorders one registry field, *every prior checkpoint's hash case
silently flips from pass to fail* — a real regression attributable to that checkpoint. The
control arm has no way to detect this (it would have to mentally compute FNV-1a). The feedback
arm runs the case, sees red, and fixes it. No amount of extra turns helps the control arm,
because the failure is invisible to inspection. This is the property we claim survives at the
frontier.

We verified mechanically (without any model) that: the reference implementation scores 100% at
every checkpoint; a "naive" agent that rewrites carelessly produces ≥4 regressions across ≥3
files that the oracle catches; and every reference/seed file fits within the model's output
token budget (the largest is ~1,734 estimated tokens vs a 4,000-token turn limit) — this last
point fixes a defect in a previous task version where the file grew too large to re-emit in one
turn, producing a *structural* failure we mistook for difficulty.

## 4. The pre-registered decision rule (no post-hoc reinterpretation)

Stage 1 passes (task is "frontier-valid", proceed to Stage 2) **iff all three**:
1. Mean control AUC ≤ 0.92 (there is headroom), **and**
2. Mean ≥ 2 "on-graph" regressions per run (the predicted silent-regression mechanism actually
   fires — "on-graph" = the failing checkpoint is one we pre-listed as perturbing that case),
   **and**
3. Failures are *drift*, not *structural* — specifically: < 10% of turns hit the output-token
   limit, no 3+ consecutive truncated turns, no usability stall, and source capture confirms
   real multi-file edits.

Outcomes are fixed in advance: pass → Stage 2; **clean ceiling** (criterion 1 or 2 fails but 3
passes) → we declare the billing domain closed for frontier discrimination and **stop** (we do
not iterate into a bigger task); **structural failure** (criterion 3 fails) → no claim, redesign.

## 5. Honest threats to validity (our own list — please extend it)

1. **The win is not guaranteed and that is by design.** If DeepSeek rewrites the frozen files
   carefully and never slips the registry, the control arm shows zero regressions, Stage 1 fails
   criterion 2, and there is no win. We accept this: the only way to *guarantee* a feedback win
   is an unfair task (e.g. a genuinely ambiguous spec where the oracle encodes an unguessable
   choice), which our no-ambiguity rule forbids. We want a *fair* win or an honest null.
2. **Is the forced rewrite genuinely forced?** A model might satisfy the new requirement with a
   minimal localized edit instead of the intended restructure, dodging the regression surface
   (this happened on a prior task). Reviewers: scrutinize whether "forced" is actually forced.
3. **"On-graph" attribution.** We count a regression only if the breaking checkpoint is in our
   pre-declared perturbation set for that case. Is this too lenient (any late break counts) or
   too strict (real regressions we didn't predict are excluded)?
4. **Single model, single task, one protocol version.** Even a clean Stage 2 win is one data
   point. We do not claim generality from it.
5. **Mechanism not yet validated end-to-end.** Our cheap pre-check on the weaker model (Qwen)
   died on a provider timeout at checkpoint 8 — *before* the first forced rewrite — so we have
   not yet observed the regression mechanism fire on *any* model. We plan to re-run it before
   spending on DeepSeek.
6. **Caching/config.** DeepSeek caches prompt prefixes server-side automatically; we leave our
   Anthropic-style cache-control markers on (they were harmless and caching engaged in prior
   runs). Could this interact with anything that affects validity? We think not, but flag it.
7. **Cumulative scoring rewards late repair.** A model can declare a checkpoint "done" in 1 turn
   and fix it within a later checkpoint's budget. We measure at checkpoint end. Does this mask or
   distort the feedback effect?
8. **Is FNV-1a-hash-matching a fair proxy for "real engineering value"?** We argue it models the
   real and common case of byte-stable serialization / replay determinism that humans also can't
   eyeball-verify. Is that a stretch?

## 6. Specific questions for critics

- **Q1.** Is the hash-spine + forced-rewrite mechanism a *fair* and *non-brute-forceable* way to
  create a frontier-relevant feedback advantage, or is it a disguised "gotcha" that merely
  withholds information the control arm can't compute? Where is the line?
- **Q2.** Given the control arm can write and run *its own* scratch tests, what stops a frontier
  model from writing its own hash-regression test and self-detecting the breakage — collapsing
  the arms? (We believe it won't think to, but that is an assumption. How would you test it?)
- **Q3.** Is the pre-registered Stage 1 gate (AUC ≤ 0.92 **and** ≥2 on-graph regressions **and**
  drift-not-structural) the right gate? What failure mode does it miss?
- **Q4.** What is the strongest *alternative explanation* for a positive Stage 2 delta that is
  **not** "executable feedback helps"? (e.g., turn-economy artifacts, the treatment arm spending
  turns differently, oracle-execution acting as a free extra reasoning step.)
- **Q5.** If DeepSeek cleanly ceilings billing-v3 too, we plan to declare the billing domain
  closed and stop. Is that the right call, or is there a fair task-design lever we are missing
  that would keep a frontier feedback advantage *available* without becoming unfair?
- **Q6.** Are there confounds in measuring "regressions" via a cumulative hidden oracle that we
  should control for?

---

### Appendix: fixed parameters

- Model: DeepSeek V4 Pro (direct API). Control model in prior work: Qwen 3.7 Max. Both also
  compared historically against Sonnet 4.6.
- Budgets: 12 turns/checkpoint, 6 oracle executions/checkpoint (treatment arm), 4,000 output
  tokens/turn.
- Task: 18 checkpoints, 197 hidden oracle cases (41.6% held out from any visible example), 10
  source files, BDD/OpenSpec-style spec format identical across arms.
- Metric: mean cumulative hidden-assertion pass rate across checkpoints ("regression-free AUC").
- Win threshold (Stage 2): paired AUC delta ≥ +0.05, consistent across seeds.
- Classification of these runs: `difficulty_probe` (Stage 1) — explicitly **not** a causal claim
  until Stage 2 replicates.
