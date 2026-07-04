# Fallback claims: where to go if the main wedge collapses (v1)

**Status**: parked claims, written down 2026-07-04 at the operator's request. Context: the main
wedge experiment (same authored spec in both arms, one arm can run it — "harnessed beats plain
SDD") is days from its first two-arm data, and the operator's stated intuition is that it may
collapse (most plausibly: fair controls that self-test close the gap, as the frontier calibration
already showed on freezegun-582). This doc preserves the two fallback claims with their evidence
state and concrete re-entry paths, so no re-derivation is needed later.

**Standing discipline**: nothing here is a made claim. Both are candidate claims with partial
evidence; each names what would have to be run before any public statement.

---

## Claim B (pull forward first — cheapest, strongest evidence base)

**"Agents grade their own homework: without an independent executable contract, agent-written
tests are systematically tautological — they encode the implementation, not the requirement."**

### Why this is the right first fallback
- It is the MECHANISM behind the main wedge, not a competitor to it. If the wedge holds, this
  explains it; if the wedge collapses at the frontier, this claim survives (frontier models
  saturate small-task OUTCOMES while their self-tests remain observational — few assertions,
  many prints).
- It does not require the two-arm harness, powered task pools, or blind spec authoring.

### Evidence already in hand (2026-07-04)
1. **Published**: tests generated from incorrect code wrongly pass that code ~34.8% of the time,
   47% worse fault detection (Huang et al., arXiv 2409.09464); LLM suites reach human-level
   coverage with ~4x worse fault detection (arXiv 2606.08588); frontier agents average ~5
   assertions vs ~25 prints per task (Chen et al.); full dossier in
   `e2-frontier-gap-task-selection-synthesis-v1.md` §2 (mechanism A, evidence-backed).
2. **Our own authoring pipeline as a specimen**: the spec author (GLM-5.2, then Opus 4.8)
   repeatedly produced tautological checks — green-on-broken-code scenarios that required
   building the green-at-base prune and the tautology gate at all. The failure was so systematic
   it shaped the harness. Logs: stage0-screen v1–v5, harness repo.
3. **Our own run data (unanalyzed)**: control-arm rollouts (freezegun calibrations: 6 frontier +
   6 flash runs) log every bash call; controls write their own tests. Directly measurable, zero
   new spend: did the agent's self-written tests PASS on final code that the sealed spec FAILED?
   Each such event is a measured tautology-in-the-wild.

### Re-entry path (in order, cheapest first)
1. Zero-compute: mine existing calibration transcripts (bash_call_log) — classify control
   verification behavior (wrote tests? ran repo suite? print-only?) and cross those against
   sealed-spec verdicts. The flash run with gap=1/6 is the first candidate tautology event.
2. Cheap: rerun control-only calibration at higher n on the sealed pool, scoring a new secondary
   per run: `self_tests_green_but_spec_red` (tautology event rate per model tier).
3. The claim-grade experiment: same tasks, control arm only, two measured quantities per run —
   (a) agent's own final test verdict, (b) sealed-spec verdict. Publishable shape: "in X% of
   'done' claims the agent's own tests were green while the stated acceptance criteria failed;
   the rate for [mid-tier] is Y, for [frontier] Z." No treatment arm needed at all.

### Honest limits
- It is a mechanism/diagnosis claim, not a product-outcome claim. It licenses "independent
  executable contracts address a real, measured failure mode" — not "HIT-SDD wins."
- Fairness caveat: an agent may reasonably scope its tests narrower than the spec; a tautology
  event requires the sealed spec to encode only requirements the agent was shown (our seal
  discipline already guarantees this).

---

## Claim A (the regression claim — park until the iterative environment exists)

**"Executable specs prevent regressions: without a maintained executable harness, iterative
change accumulates silent breakage."**

### Why it is parked, with receipts
- E1 ran this to ground on single-shot tasks: **~3% regression base rate on clean runs, zero
  confirmed true regressions** (`path-survival-discrimination-power` finding). You cannot show
  protection against something that almost never happens per single change.
- Engineering regression-prone single tasks failed review twice (billing-v2 ceiling:
  `late-hardness-cannot-regress`; billing-v3 hash-spine self-defeat:
  `billing-v3-hash-spine-discriminator-flaw`). The 2026-06-13 critique consensus: no fair
  frontier feedback win via refactoring/regression tasks on single changes
  (`frontier-feedback-structural-ceiling`).

### Why it is NOT dead — two structural advantages waiting
1. **No blind authoring needed.** The regression oracle is the repo's own existing (pass-to-pass)
   test suite. The entire spec-authoring bottleneck that consumed Stage-0 (four failed frontier
   screens, the lawyer-gate tension) does not exist for this claim.
2. **The honest home of the "I" in HIT-SDD.** Nothing in the program yet tests the Iterative
   half: one agent making a SEQUENCE of changes to the same codebase, where change 10 silently
   breaks the behavior change 3 introduced. Regressions that are ~3%-rare per single change
   accumulate across a sequence; the per-sequence base rate can be high enough to power. The
   Stage-B synthesis independently flagged "preservation clauses + slow/partially-red suites" as
   a frontier blindness channel with a literature gap (`e2-frontier-gap-task-selection-synthesis-v1.md`
   §2 M6) — sequences are where that channel compounds.

### Re-entry path
1. Design first (no build): a multi-change sequential environment — one repo, an ordered backlog
   of 5–10 related changes (real merged-PR chains are a candidate source), both arms do the whole
   sequence; treatment's harness re-runs the accumulated executable spec each change; control has
   shell + the same spec as prose. Primary measure: surviving-behavior count at sequence end
   (graded by the accumulated spec + the repo suite), plus per-change silent-regression events.
2. Reuse before building: E1's path-survival machinery (checkpoints, per_turn.checks,
   `regression_free_auc`) already exists in this repo and is the natural scorer skeleton; the
   protocol-profile discipline (`path-survival-primary-v1`) still applies — any evidence run
   needs a declared reviewed profile and explicit authorization (CLAUDE.md standing rule).
3. Prediction to write down BEFORE running: mid-tier shows sequence regressions early; frontier
   the interesting unknown (single-change data says rare; nobody has measured accumulation under
   budget pressure across a sequence).

### Honest limits
- A new environment class = new validity review (task-sequence realism, order effects,
  budget-per-change fairness) before any evidence run.
- The June structural critique applies until sequences demonstrably reopen the base rate: if
  accumulated regressions are still ~0 for fair sequences at the frontier, this claim dies the
  same death at higher cost — hence design + a cheap probe first, never a full build on intuition.

---

## Relationship to the main wedge (decision map)

| Main-wedge outcome | What these claims become |
| --- | --- |
| Wedge holds (mid-tier or broader) | B = the mechanism section of the same story; A = the follow-up program for the Iterative half |
| Wedge collapses at frontier only | Lead with mid-tier wedge + B as mechanism; A unchanged |
| Wedge collapses everywhere (operator's stated intuition) | B becomes the primary near-term public claim (cheap, evidenced, survives saturation); A becomes the primary EXPERIMENTAL program (sequential environment) |

Related memory: `frontier-feedback-structural-ceiling`, `path-survival-discrimination-power`,
`late-hardness-cannot-regress`, `billing-v3-hash-spine-discriminator-flaw`,
`brownfield-deep-research-verdict`. Related docs: the Stage-B synthesis + shortlist docs (this
directory), Addendum B (detection-only framing), `public-post-framing-standard` memory for
claim-safe language.
