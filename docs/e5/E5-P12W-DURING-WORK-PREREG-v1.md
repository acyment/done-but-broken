# E5 probe P1.2w — during-work truth feedback (pre-registration, v1)

**Status: PRE-REGISTERED 2026-07-14, committed before any run. NO RUN IS AUTHORIZED — the
program is paused for spend; this document exists so the launch is one operator "go" away
(zero-spend runway item 2a). Classification: `calibration`.** Everything not stated here is
inherited unchanged from `docs/e5/E5-P11-TRUTH-VISIBLE-CLOSE-PREREG-v1.md`: the
semantic-family SHOWN/HELD-OUT partition (§2.3, same code), model/route/budgets (§2.5),
readout template incl. D1/D2/D3/D9/S3 landings (§3), VOID rule and kill-needs-two-seeds
discipline (§4), deviations-ledger rule (§6).

## 1. Question and evidence position

Does ground-truth acceptance feedback DURING work — not at the close — reduce false closes
and held-out failures? This is the variant with the actual prior evidence (E2 causal pilot:
feedback during work cut false done-claims 79%→13%; E1 mechanism probe 0.88 vs 0.44), and
it is exposure-proof by design: delivery does not depend on the agent failing at the close.

## 2. Design delta vs P1.1

- **Arms:** both run the P0-V.1 product loop (`e4_arm_p`). TREATMENT additionally receives
  the SHOWN-half hidden-suite verdicts (current workspace state, probe-layer oracle run,
  recorded distinctly from the sealed at-close run) at exactly two moments per task:
  (a) once, unconditionally, in the feedback of the turn where the spec-phase exit is
  accepted (the exposure guarantee — every task tests the lever), and (b) appended to the
  feedback of every accepted verification (smoke) invocation during the implementation
  phase. CONTROL runs the loop unmodified. Held-out ids, counts, and failure text are never
  rendered (same renderer, same absence tests).
- **No post-close cycle in either arm.** The close is the endpoint; the sealed chain is
  untouched after snapshots (the P1.1 chain-replay concern does not arise).
- **Budget matching:** turn/verification/token budgets are the sealed values, identical by
  construction. The treatment's verdict text inflates its input tokens; tokens are a
  reported row, not a matched resource — recorded as this probe's known asymmetry (it is
  the information itself, i.e. the causal variable).
- **Machinery:** one optional probe seam inside the sealed task loop (delivery points (a)
  and (b)) — lands as boundary bump v0.8 with twin re-pins; the classifier-v3 fix (runway
  finding 1a) rides the same bump. Probe-layer oracle invocations during work are recorded
  per task as `p12w-feedback-*.json` with full rendered text (D9 screen input).
- **Primary:** matched task pairs; per pair, (i) close honesty (false-close vs truthful,
  with the D1 pooled figure) and (ii) held-out end-state at close. KEEP (provisional, one
  seed): treatment ahead by ≥2 pairs on pooled honesty OR held-out end-state, with ≥1
  transcript showing a repair traceable to delivered verdicts. KILL (two seeds): treatment
  ahead by ≤0 on both readouts on both seeds. VOID: fewer than 2 pairs where ANY arm's
  close carries a held-out failure or false close (the event this lever acts on never
  occurred at usable rate).
- **Seeds (outcome-blind rule, revised for hardness):** scan 200–999 under the P1.1 floor,
  score = INTERACTION count (tasks whose delta touches an entity or endpoint introduced or
  modified by an earlier task in the same sequence — a pure function of the draw), tiebreak
  = underdetermined-fact density, then ascending seed. Seeds 220/636/829 are excluded
  (P1.1's set). Top-3 recorded before launch: #1 runs, #2 kill-confirmation, #3 VOID
  reserve. Scan output committed with the machinery.
- **Sequence length:** 6 tasks (unchanged). Lever 1 of the harder-substrate note (12
  tasks) is available as a pre-declared variant if the operator prefers paying ~2× for
  more pairs per seed; the choice is made at launch, before any outcome exists.

## 3. Exposure note (§0.1)

The treatment channel touches: the shown-verdict renderer (same as P1.1, same absence
tests); the probe seam's feedback composition (new surface — defect risk: leaking held-out
content through the smoke-feedback path; mitigated by rendering only through the tested
renderer); the during-work oracle runs (compute is harness-side; agents never execute the
suite). Instrument-watch: the off-topic column is untrusted until classifier v3 lands
(finding 1a) — the disposition table ships with the v3 classifier or with the column
explicitly caveated. Known rig defects riding the channel: none open at prereg time.

## 4. Cost

~$1.5–2.5 per arm-pair per seed at seed-220 rates (no post-close cycles, but during-work
oracle runs add harness wall-clock, not model spend). Ceiling: $8 including a possible
second seed. Requires fresh operator authorization; nothing in this document permits spend.

## 5. Deviations ledger

- (none yet)
