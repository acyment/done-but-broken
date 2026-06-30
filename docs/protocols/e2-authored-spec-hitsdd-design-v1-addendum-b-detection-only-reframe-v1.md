# E2 Authored-Spec Study — Addendum B: Detection-Only Reframe (v1)

Status: **DESIGN ADDENDUM — not authorized, not run, not sealed.** Layers on
`e2-authored-spec-hitsdd-design-v1.md` (the "base design") and
`e2-authored-spec-hitsdd-design-v1-addendum-a-hardening-v1.md` (Addendum A); does not replace either.
This addendum **narrows the study's claim ambition** from "win-either-way (a null is a first-class
publishable finding)" to **positive-only / detection** scope, and makes the consequent simplifications.
No provider/Docker run fires from this document.

Date: 2026-06-30. Boundary: `E2 / authored-spec / HIT-SDD v1` (unchanged — same compatibility boundary;
**never pooled** with prior E2/E1 runs).

## Why this addendum exists

Two decisions, made after the offline-pilot/seal design was complete:

1. **The goal is product evidence, not publication.** This study exists to decide whether to build a
   HIT-SDD product — i.e., whether executable acceptance feedback is worth productizing. That decision
   needs a credible **positive**; it does **not** need a defensible **null**.
2. **An adversarial multi-model review of the null-interpretation machinery (Addendum A §A2) found it
   indefensible at this scale** — a fidelity/real-miss threshold calibrated on a thin pilot, applied
   across mixed-modality tasks, with a shared spec/metric/treatment blind spot that routes weak-oracle
   nulls toward the flattering reading. Rather than harden that apparatus, we **retire it**, because the
   positive-only scope no longer needs it.

The shared-spec, blind-authoring, leak-tight, flake-certified oracle discipline from the base design and
Addendum A is **unchanged**. This addendum only changes what we claim and what the pilot must produce.

## B1. Claim policy — positive-only (sealed)

- **A positive** (H_harness: gap(plain-SDD) − gap(HIT-SDD) > 0 at MCID ≥ 0.20, family-wise) is reported
  as a bounded `causal_pilot` candidate finding supporting a HIT-SDD prototype decision (base design
  classification unchanged for positives).
- **A null** is reported as **inconclusive / underpowered** — *not* as "valid H0 / executable spec ≈
  prose spec." We make **no equivalence claim** and run **no equivalence (TOST) test**. The prior effect
  is large (control gap ~79% → treatment ~13% in the executable-feedback pilots); N = 10/arm/task detects
  a large effect but cannot bound a 0.20 effect, and we do not pretend otherwise.

## B2. Retire A2 (null-interpretation rule + sealed fidelity/real-miss thresholds)

Addendum A §A2 and its sealed numeric thresholds are **superseded** (A2 is banner-marked SUPERSEDED in
Addendum A). Consequences:
- The offline pilot **no longer sets or seals A2 thresholds** (offline-pilot protocol §8 removed, §9
  exit verdict item 3 removed — edited there directly).
- **Spec fidelity** (authored-spec verdict vs SWE-bench gold) is retained **only as descriptive
  context**, never as a sealed gate that classifies a result.

## B3. `gap_gold` — secondary guard against teaching-to-the-test (positive-protecting)

The risk that survives in positive-only mode is a **false positive**: treatment learns to satisfy the
executable authored spec without doing the real work ("teaching to the test"). For a product decision
that is the failure mode that matters most. Guard:
- Add a secondary metric **`gap_gold`** = rate of runs declaring done while the **SWE-bench gold tests**
  fail (run experimenter-side on each final patch — already computed for the fidelity cross-check).
- A positive on the primary (`gap_spec`) is credited as a **real** effect only if treatment also reduces
  `gap_gold` (real correctness), and is flagged as **teaching-to-the-test** if it moves `gap_spec` but
  not `gap_gold`. This is a **secondary guard on the primary**, not a co-primary metric.
- Honest caveat: gold is itself incomplete (it can pass some wrong patches), so `gap_gold` is a tighter
  *lower bound* on the true gap, not a perfect oracle.

## B4. Construct-neutral framing (feature-building, not just bug-catching)

The mechanism is contract-agnostic: the "self-verification gap" is **"declares done while the acceptance
contract is unmet,"** which covers **building a feature to an authored acceptance spec** — the
prototypical Gherkin/SDD use — exactly as much as fixing a bug. Replace the "done-but-broken /
regression" idiom in study-facing language with **"claimed acceptance vs. real acceptance."** The product
thesis is **build-to-spec**, and "the agent confidently said it built X, and X doesn't actually work" is
the feature-development failure HIT-SDD targets.

## B5. Bug/feature stratification (labeled secondary)

The confound-free n=9 were classified from their SWE-bench-Live `problem_statement` text (read-only;
provenance: local SWE-bench-Live cache). The pool is **balanced, not bug-dominated**:

| Task | Class | Basis |
| --- | --- | --- |
| `mlco2__codecarbon-831` | bug | `TypeError` when `force_cpu_power` set in CPU-load mode |
| `celery__kombu-2300` | feature/enhancement | extend `fetch_message_attributes` to the sync SQS path |
| `pypa__twine-1249` | feature | auto-refresh short-lived PyPI token mid-upload |
| `casbin__pycasbin-392` | feature | add `…-Ex` management APIs |
| `django-guardian__django-guardian-899` | bug | 3.0.0 ContentType-cache regression under `TransactionTestCase` |
| `django-json-api__…-1283` | bug/consistency | inflection not applied to included resources |
| `koxudaxi__datamodel-code-generator-2408` | feature | support frozen dataclasses |
| `koxudaxi__datamodel-code-generator-2461` | bug | cross-schema model-config contamination |
| `spulec__freezegun-582` | bug | crash when a parametrized arg is named `func` |

≈ 4 bug / 3 feature / 2 mixed. Tag every record `task_class ∈ {bug, feature, mixed}` and **report the
effect stratified by class as a labeled secondary**. The **primary stays the pooled within-design
contrast** — n is too thin to split for a primary claim. The pilot pair (`codecarbon-831` bug,
`kombu-2300` feature) already spans both kinds.

## B6. Sizing — detection-only

- **N = 10 runs/arm/task, unchanged.** Sufficient to detect a large effect; not powered for equivalence
  (not needed — B1).
- **n (tasks) is pilot-determined**, not chosen: the offline pilot's eligible count (A5 → A3) sets it.
  Widening the pool has **low marginal value** under positive-only and is deferred to a later
  product-validation phase, priced by the yield the pilot measures.

## B7. Treatment tool-use logging (interpretability of a positive)

Log, per treatment rollout: whether the agent **called `run_spec` before declaring done**, and whether a
**failing check changed its next action**. A positive driven by agents that barely use the tool is a red
flag; a positive with active tool-use and check-driven correction is the product signal. Add to the
trace-complete bundle (base design §"Trace-complete artifact bundle").

## B8. What a positive licenses (product boundary)

The control **cannot execute anything**, so a positive proves *executable acceptance feedback ≫
no-execution* — **not** *≫ an agent that writes and runs its own tests*. It therefore licenses
**"build a HIT-SDD prototype"**, and does **not** yet license *"HIT-SDD beats a self-testing agent"* —
a fairer, harder baseline for a later study before any launch-grade claim.

## B9. A3 minimum-n floor under positive-only (amended)

Addendum A §A3's `causal_pilot` / `difficulty_probe` thresholds were tied to a family-wise **null**
claim, which we no longer make. Amended intent (A3 is banner-marked AMENDED in Addendum A):
- **n_eligible ≥ 5–6** → report a positive as a bounded `causal_pilot` candidate finding.
- **n_eligible ≤ 4** → report descriptively only; a positive is a suggestive signal, not a bounded
  finding; do not dress it as causal.
- A null at any n is inconclusive (B1), so the floor governs only how much weight a **positive** carries.

## What this addendum does **not** change

The causal variable (executability of the contract), the two-arm structure, the shared identical spec,
the blind authoring + leak/canary + flake-cert discipline, the black-box binding discipline, the
OpenSpec→`.feature`→pytest-bdd execution path, the trace-complete bundle, the **GLM-5.2 non-participant
author (A4)**, the **scenario-granularity convention (A1)**, the MCID (≥ 0.20) and family-wise machinery
for the positive, and **no pooling** with any prior E2/E1 run are all **unchanged**. Classification
remains `causal_pilot` **for a positive**; only null-handling and the A2/A3 apparatus change.

## Seal-checklist delta (relative to Addendum A)

At seal time: **drop** the A2 thresholds and the A2 decision rule from the sealed set; **add** the
claim-policy (B1), the `gap_gold` guard (B3), the construct-neutral framing + `task_class` stratification
manifest (B4–B5), the tool-use logging fields (B7), and the amended A3 floor (B9). A1 (granularity
convention + scenario-count manifest), A4 (author identity), the spec hashes, and the trace bundle remain
sealed as before.

## Status

**DESIGN ADDENDUM, decisions recorded. Does not authorize or affect any run.** Read together with the
base design and Addendum A. It narrows the study to its product purpose: *does executing an authored
acceptance spec each loop make agents stop falsely claiming a feature/fix is done — enough to justify
building HIT-SDD?* A null answers nothing here; a clean positive is the green light.
