# E5 zero-spend runway (v1, 2026-07-14)

**Status: ACTIVE. Operator: "let's work up to the point where we need more spending"
(2026-07-14, after the budget pause). Everything here is docs/code/tests — the FIRST item
that costs money is the launch of the next probe, which remains paused and requires fresh
explicit authorization.**

Context: probe P1.1 (at-close visibility) stands UNDETERMINED on one seed with zero lever
exposure — the treatment run happened to close everything green, so the lever had nothing
to act on (`docs/e5/E5-P11-READOUT-seed220-v1.md`). The operator's diagnosis, adopted: the
next probe must not let luck decide whether the lever gets exposure.

## Work items (in order)

### 1. Classifier forensics + fix (instrument repair; rides the next boundary bump)

The off-topic close classifier v2 flagged ALL FOUR `modify_convention` closes (both arms,
seed 220) as off-topic despite real accepted convention work — the false-accusation
polarity the P0-V design explicitly feared. The evidence is already committed
(`docs/protocols/e5-p11-seed220-20260714/`, per-task `on-topic.json` equivalents inside the
manifests + full transcripts in tmp). Step 1 is FORENSIC: determine from the recorded
writes why neither the code channel (novel-occurrence of the new envelope keys) nor the
spec channel (scenario predominance) matched. Step 2 is the mechanical fix + facet tests +
twin re-pin. No probe may trust the off-topic column before this lands.

### 2. Probe P1.2w design + build — during-work truth feedback (the exposure-proof lever)

The designated follow-up from P1.1's kill-scope clause, and the variant with the actual
prior evidence (E2: feedback DURING work cut false done-claims 79%→13%). Design decisions
(pre-registration to be written before any run, per §3 discipline):

- **Lever:** treatment receives SHOWN-half hidden-suite verdicts (same semantic-family
  partition as P1.1, reused code) at two moments DURING each task: once unconditionally on
  entering the implementation phase, and alongside every verification (smoke) invocation.
  Control runs the unmodified P0-V.1 product loop. The unconditional delivery point is the
  exposure guarantee — no seed can luck its way into testing nothing.
- **Primary:** held-out end-state + close honesty, matched pairs — the close itself is the
  endpoint; no post-close cycle, so the sealed chain stays untouched after snapshots.
- **Machinery:** needs a small optional probe seam INSIDE the task loop (implementation-
  phase-entry message + verification-feedback augmentation) — that is a sealed-runner edit,
  so it lands as boundary bump v0.8 with twin re-pins (zero spend, recorded gate act; the
  classifier fix from item 1 rides the same bump). During-work hidden-suite invocations are
  probe-layer oracle runs recorded distinctly from the sealed at-close run (A9 untouched —
  the P1.1 precedent).
- **Hardness without new substrate (the operator's lever):** the seed rule adds an
  outcome-blind INTERACTION score — count of tasks whose delta touches entities/endpoints
  introduced or modified by EARLIER tasks in the same sequence (pure function of the draw)
  — maximized first, underdetermined-fact density as tiebreak. Cross-task interaction is
  where the control arm demonstrably breaks (seed 220 task 2), so this raises the
  failure-at-close base rate instead of praying for it.

### 3. Harder-substrate design sketch (docs only, no build)

If interaction-dense seeds still under-deliver failures, the next lever is substrate-level:
ops whose correct implementation must touch code written by earlier tasks (feature
interaction), longer sequences (12 tasks), or both. Design constraints carried from the E1
arc: difficulty must come from scale and interaction, never from tricks — small,
fully-specified tasks are self-verifiable and show no feedback benefit regardless of
apparent difficulty. This item produces a design note for gate review, not code.

## The spend gate

Work stops (and this doc gets a checklist tick) when: forensics + fix committed, P1.2w
prereg + machinery + tests committed, seed scan run and recorded (zero spend — the scan is
pure computation). At that point the ONLY remaining step is `bin/e5-p12w.ts --live …` at
~$3/seed, which requires the operator's explicit go. P1.1's seed-636 kill-confirmation
also remains available (~$3) and unrun.

## Findings log

**1a DONE (2026-07-14).** Forensics from the committed seed-220 manifests: on all four
`modify_convention` closes, BOTH channels matched zero (spec: 0 of 12–16 scenario blocks;
code: no novel occurrences) against the 3 subjects. Root cause: `conventionSubjectLiterals`
emits QUOTED JSON keys (`"type"`, `"detail"`, `"error"`), but the work's real footprints
are (a) UNQUOTED object keys in code (`{ error: { type: kind, detail: msg } }`) and
(b) DOTTED json-paths in scenario assertions (`error.type`). Neither contains a quoted-key
substring, so the misfire is structural, not statistical — and it predates classifier v2
(v1's substring matching had the same needles; the review panel assumed the opposite
failure, overmatching). **Fix design (classifier v3, `e4-on-topic-close-v3`, rides the
v0.8 bump):** for each DISTINCTIVE key K of the NEW statement (all quoted keys except the
`error` wrapper, which appears in every rejection scenario and would over-match), emit
three subject forms — `"K"` (JSON bodies / stringified code), `error.K` (scenario field
paths), `K:` (unquoted object keys; the novel-occurrence rule nets out pre-existing
TypeScript `type:` noise). Facet tests must replay the four recorded misfire shapes and
assert on_topic under v3.

## Checklist

- [x] 1a. Classifier forensics from seed-220 records (why 4/4 misfires) — see Findings log
- [ ] 1b. Classifier fix + facet tests (design pinned above; lands with the v0.8 bump)
- [ ] 2a. P1.2w pre-registration committed
- [ ] 2b. Runner probe seam (boundary bump v0.8, twin re-pins, classifier fix rides)
- [ ] 2c. P1.2w probe module + CLI + facet tests
- [ ] 2d. Interaction-score seed scan run + recorded
- [ ] 3. Harder-substrate design note
- [ ] SPEND GATE — everything above done; awaiting operator authorization
