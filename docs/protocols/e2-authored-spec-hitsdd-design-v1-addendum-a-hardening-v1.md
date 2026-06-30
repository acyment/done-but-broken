# E2 Authored-Spec Study — Addendum A: Pre-Seal Hardening (v1)

Status: **DESIGN ADDENDUM — not authorized, not run, not sealed.** Layers on
`e2-authored-spec-hitsdd-design-v1.md` (the "base design"); does not replace it. The base design's
decisions stand as recorded. This addendum adds four sealable commitments and one reframe that close
residual experimenter degrees of freedom **before** the offline pilot and seal. No provider/Docker run
fires from this document.

Date: 2026-06-29. Boundary: `E2 / authored-spec / HIT-SDD v1` (unchanged — same compatibility boundary
as the base design; **never pooled** with prior E2/E1 runs).

## Why this addendum exists

Two independent design critiques of the upcoming experiment converged on the same residual: because the
oracle is **experimenter-authored**, a skeptic can argue the effect is partly an artifact of how the
spec was shaped. The base design already neutralizes the *headline* form of this worry — the spec is
**identical across both arms**, so authoring bias moves only *shared* spec quality and cannot favor one
arm (base §"The acceptance oracle", §"Spec authoring"). This addendum closes the **narrower residuals
that the shared-spec argument does not cover**, and fixes the interpretation rules in advance so no call
is made post-hoc.

A framing correction that motivates the priorities below: an *easy / weak* spec biases toward the
**null** (both arms pass more → control's false-confidence shrinks → gap shrinks), which is the
conservative direction for H_harness. The dangerous degree of freedom is the **opposite** shape — a spec
that is cheap to *execute-check* but heavy to *read-and-verify* — which inflates the control gap and
manufactures effect size. A1 targets exactly that.

## A1. Scenario-granularity convention (sealed; closes the effect-size knob)

**Risk.** The base design bounds scenario *scope* to issue-stated behavior (base §"Author driver",
final caveat) but not scenario *granularity*. One observable behavior could be written as 1 scenario or
6. More scenarios → more state for the prose-reading control to track mentally → larger gap. Scenario
count is therefore a free knob on effect size, controlled by the experimenter.

**Commitment (sealed before authoring).**
- **One scenario per distinct observable outcome stated or directly entailed by the issue.** "Distinct
  observable outcome" = a separately-checkable result at the public surface (a distinct return/HTTP/CLI
  observable), not a restatement of the same outcome under cosmetic variation.
- **No scenario multiplication for emphasis.** Parameterized variations of the *same* outcome (e.g., the
  same behavior over three inputs) are **one** scenario with a parameter table, not three scenarios.
- The convention is a **named, versioned rule applied identically across all tasks** (it joins the
  Gherkin authoring skill as a sealed artifact, base §"Author driver" (3)). Authored as a standalone
  sealable artifact: `e2-authored-spec-scenario-granularity-convention-v1.md` (carries the rule, worked
  examples, and the per-task scenario-count manifest).
- **Sealed scenario-count manifest:** the per-task scenario count is fixed and hashed at seal time;
  count is **never** adjusted in response to any rollout output (this is added to the protocol tests,
  base §"Harness changes" / Protocol tests).

## A2. Null-interpretation decision rule (predeclared; a null is a first-class outcome)

> **SUPERSEDED by Addendum B (detection-only reframe, 2026-06-30).** The study is now positive-only: a
> null is reported as inconclusive/underpowered, not classified, so this rule and its sealed
> fidelity/real-miss thresholds are retired. Retained below for historical record only; do **not** seal
> or apply it. Spec fidelity survives as descriptive context only (Addendum B §B2).

**Risk.** Because the control is now genuinely strong (it reads a crisp authored spec), a **null is a
live outcome**, not a remote one. A null is ambiguous between two readings, and that ambiguity must be
resolved by predeclared numbers, not post-hoc judgement:

- **(a) Valid H0 — a real, reportable finding:** "frontier models self-verify well enough against a
  good prose spec that executing it adds nothing." This is a *more* counterintuitive and publishable
  result than another positive, and the experiment is designed to be **win-either-way**.
- **(b) Invalid — oracle failure:** the authored spec was too weak to discriminate, so the null says
  nothing about HIT-SDD.

**Predeclared decision rule (sealed).** Classify a null using metrics already collected (base §"Metrics",
external-validity = spec fidelity):

| Condition at a null result | Reading | Reported as |
| --- | --- | --- |
| Spec fidelity **high** (authored-spec verdict agrees with gold on the cleared/eligible tasks above a sealed threshold) **and** control gap is materially > 0 on ≥ some tasks | **(a) valid H0** | First-class null finding: "executable spec ≈ prose spec for this model/task family" |
| Spec fidelity **low** (real-miss rate above the sealed threshold) | **(b) oracle failure** | Not a causal result; spec construction failed; do not interpret re HIT-SDD |
| Control gap ≈ 0 on (almost) all tasks (the model already self-verifies, little false confidence to remove) | **(a) valid H0**, redundant-regime | First-class null: the prose spec already saturates self-verification here |

The fidelity and real-miss **thresholds are numeric and sealed before the run** (set during the offline
pilot, A5). A null is reported with its reading attached; we do **not** decide the reading after seeing
the gap.

## A3. Minimum-n floor (predeclared; protects against a thin pool)

> **AMENDED by Addendum B (detection-only reframe, 2026-06-30).** The `causal_pilot`/`difficulty_probe`
> split below was tied to a family-wise *null* claim we no longer make. Under positive-only scope the
> floor governs only how much weight a **positive** carries (Addendum B §B9). A null is inconclusive at
> any n.

**Risk.** Three eligibility gates — **black-box observability**, **gold-passes-spec**, and
**non-triviality** — plus black-box bindings, must **all** clear for a task to enter. They are
**correlated** (white-box-only gold tests tend to fail observability *and* leave the black-box spec
non-discriminating on the same tasks), so the joint survival rate can be well below any single gate's
rate. A family-wise causal_pilot at MCID ≥ 0.20 on a gutted pool is underpowered and should not be
dressed as a causal claim.

**Commitment (sealed).**
- **n_eligible ≥ 6 of 9** → proceed as `causal_pilot` (base §"Validity / classification").
- **n_eligible = 4–5** → run, but **reclassify as `difficulty_probe`** (not causal evidence); report
  descriptively, no family-wise causal claim.
- **n_eligible ≤ 3** → **do not run**; report the feasibility finding (the task family does not support
  a black-box authored-spec oracle at adequate n) and revisit task selection.
- The eligible-task list and its size are an **output of the offline pilot (A5)**, sealed before any
  rollout; tasks are **not** added or dropped after rollouts begin.

## A4. Spec author ≠ model under test (pinned; removes author–solver correlation)

**Risk.** The base design specifies an LLM authoring pipeline (base §"Author driver") but does not pin
*which* model authors. If the spec is authored by the same model (or lineage) that is later the
agent-under-test, the spec may be shaped toward what that model expects, correlating oracle and solver.

**Commitment (sealed).**
- The spec-authoring pipeline runs on a **fixed non-participant model** — a model that is **not**
  `deepseek-v4-pro` or `qwen3.7-max` (the two agents-under-test) and not their lineages.
- The authoring model identity is pinned and sealed in the provenance artifact alongside the authoring
  prompts and transcript (base §"Author driver" (3)).
- This holds across **both** lineage runs: the same non-participant author is used for the DeepSeek run
  and the Qwen replication (the spec is sealed once, before either run — base §"Sequencing").

## A5. Joint-gate survival is the primary output of the offline pilot (sharpened)

**Risk.** The base design's offline pilot (base §"Sequencing" step 1) lists the gates to exercise but
measures them as a checklist. The decision-relevant quantity is their **joint** effect, because the
gates are correlated (A3).

**Commitment.** The offline pilot's **primary reported output** is the **joint gate-survival table**
over the n=9: for each task, pass/fail on the five per-task eligibility gates {black-box observability,
gold-passes-spec, non-triviality, **tautology audit**, flake-cert} and the **single eligible/ineligible
verdict**, yielding `n_eligible`. (`run_spec` leak-tightness is a **harness-wide precondition** verified
once, not a per-task column — offline pilot protocol §6.) The pilot also fixes
the **numeric fidelity / real-miss thresholds** used by A2. The pilot report is the input to the A3
floor decision and to seal; it is itself a sealed artifact (classification: pilot/feasibility, not
causal).

> **Pilot procedure (executable detail):** `e2-authored-spec-offline-pilot-protocol-v1.md`. Note the
> two-stage structure: a first **2-task pilot** (the two hardest to observe — `codecarbon-831`,
> `kombu-2300`) proves the pipeline works and sets the A2 thresholds; the **full n=9 authoring pass**
> then produces `n_eligible` and triggers the A3 floor.

## What this addendum does **not** change

- The causal variable (executability of the contract), the two-arm structure, the shared identical spec,
  the metric machinery, the budget rule, the black-box binding discipline, and the trace-complete bundle
  requirement are all **unchanged** from the base design.
- Classification remains `causal_pilot` **conditional on A3** (n_eligible ≥ 6); otherwise as A3 directs.
- No pooling with any prior E2/E1 run (unchanged).
- This addendum **does not authorize, seal, or fire anything.** Seal still requires: base design +
  this addendum reviewed → offline pilot (A5) passed → hash + operator authorization + spend cap +
  sealed commitments.

## Seal checklist delta (additions to the base design's seal)

At seal time, the following join the sealed artifact set defined in base §"Trace-complete artifact
bundle" and §"Harness changes":

1. The **scenario-granularity convention** (named rule) + the per-task **scenario-count manifest** (A1).
2. The **null-interpretation decision rule** with **numeric fidelity / real-miss thresholds** (A2),
   thresholds fixed by the offline pilot.
3. The **minimum-n floor** and the **sealed eligible-task list** from the offline pilot (A3, A5).
4. The **pinned non-participant authoring-model identity** (A4).
5. A **protocol test** asserting scenario counts and the eligible-task list were not modified against any
   rollout output (extends base Protocol tests).

## Status

**DESIGN ADDENDUM, decisions recorded. Does not authorize or affect any run.** Read together with
`e2-authored-spec-hitsdd-design-v1.md`. The experiment it hardens targets the program's literal thesis:
*with the acceptance contract authored as a spec, does harnessing (executing) it each loop beat merely
reading it?* — now with the experimenter's remaining degrees of freedom closed and the null pre-framed
as a first-class outcome.
