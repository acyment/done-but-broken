# E4 Phase-2 Plan — R2 Gate-Fix Backlog

**Status: open. Created 2026-07-08** from the adjudication of five independent gate reviews of
`docs/e4/IMPLEMENTATION-PLAN.md` revision **R1** (one continuation review from the original R1
reviewer + four fresh external deep-research reviews). Only findings that were verified against the
actual R1 text survived into this backlog; rejected findings and the reasoning are recorded at the
bottom (§ "Adjudicated out") so no future agent re-litigates them.

## How to work these items (read first, zero-context agents)

- **Everything here is a documentation change.** Phase 3 has not started; **no code exists under
  `src/e4/`**. The deliverable of each item is an edit to `docs/e4/IMPLEMENTATION-PLAN.md` (and,
  where named, consistency edits to `docs/e4/E4-ARCHITECTURE.md`). Do not write TypeScript, do not
  create `src/e4/`, do not run anything that spends money.
- The plan is a **milestone contract awaiting Phase-2 gate re-review**. Mark every edit inline with
  `[R2: <item-id>]` at the point of change, mirroring how R1 changes are marked `[R1: …]`.
- Repo discipline: `AGENTS.md` is the source of truth; never touch the E1 seal
  (`docs/protocols/e1-frontier-sealed-constants-v1.0.json`), never rewrite run classifications, and
  preserve all "not authorized / spend-gated / non-evidence" language exactly.
- After completing an item, append one line to the **Changelog** section at the bottom of this file:
  `- <date> <item-id> done — <one-line summary> (<commit>)`.
- Items R2-1 and R2-2 both rewrite §3.1 of the plan; if done by different agents, do them
  sequentially (R2-1 first), not in parallel.

**Model-tier legend** (who should execute the item):

- `FRONTIER-THINKING` — Opus / Fable class. The item requires experimental-design judgment; the
  fix direction is decided but edge cases must be resolved coherently while writing.
- `FRONTIER-REGULAR` — Sonnet class. The design decision is fully made; execution is careful,
  precise technical writing with cross-references.
- `LOWER-OK` — DeepSeek Pro sufficient (Flash only where marked). Fully specified, mechanical,
  low-blast-radius edits.

---

## R2-1 — Redefine drift incidence: onset/episode semantics on stable identities `[BLOCKING]` `[FRONTIER-THINKING]`

**Source findings:** consensus of all five reviews (original reviewer's B-2 residual; "Gate verdict"
review B2 — the most complete spec; others convergent).

**Defect.** §3.1 H1 defines drift velocity as "count of distinct `item_id`s first observed as a
discrepancy … per drift opportunity". Three failure modes are unhandled:

1. **Rename double-count:** a rename op retires one `item_id` and mints another; a missed rename
   produces a stale claim (old id) + coverage gap (new id) = **two** incidences for **one** semantic
   drift event, double-weighting rename ops vs. value contradictions in the headline number.
2. **Recurrence blindness:** "first observed" counts appear→fixed→reappear as **one**, making a
   fix-and-re-break arm indistinguishable from a drift-once-and-ignore arm.
3. **Multi-item op inflation:** one cross-cutting convention change (e.g. error-format
   standardization) can touch 20+ items ⇒ 20+ incidences for one op, so velocity rewards/punishes op
   granularity.

**Required change** (edit §3.1 H1/H2, the M0 result-schema-stub paragraph, M1 scope, M2 fixture
spec, and the §6 pin table row for B-2):

- Pin **stable semantic UIDs** in the substrate IR for entities/fields/endpoints (the architecture
  already gives conventions items "stable IDs" — `E4-ARCHITECTURE.md:335`; extend the same property
  to all IR item kinds). UIDs persist across renames; a true delete-then-recreate allocates a new
  UID.
- Require the **generator to emit its rename-lineage map** as part of the substrate output (it
  executes the rename op, so the old-id→new-id mapping is free); the meter uses it so the paired
  stale-claim + coverage-gap born of one rename at one task **merge to one incidence**.
- Redefine the drift-flow unit as a **discrepancy episode**: keyed by
  `(semantic_item_uid, direction, kind/class)` with `onset_task` — an item discrepant at task k and
  not discrepant at k−1 is a **new onset**; reappearance after resolution = a **new episode**
  (counted again). Velocity = episodes with onset in the numerator window ÷ count of
  `drift_opportunity` tasks.
- Add a **convention-aggregation rule**: ≥N items sharing the same convention-class discrepancy
  onsetting at the same task collapse to one incidence for velocity (N sealed in
  `e4-sealed-constants`; item-level count still reported inside "drift burden at T_N").
- Extend the **M2 known-drift fixture** requirement with four named rows: rename (missed), delete +
  re-add, fix-then-regress (two episodes expected), and one cross-cutting convention change
  (one aggregated incidence expected).

**Acceptance:** §3.1's H1 definition is reproducible by two independent implementers without
guessing identity semantics; every one of the three failure modes above has an explicit rule and an
M2 fixture row; the §6 pin table B-2 row is updated; `[R2: R2-1]` markers placed.

---

## R2-2 — Fix H5 tax denominators: attempted tasks, not each arm's own passing set `[BLOCKING]` `[FRONTIER-REGULAR]`

**Source findings:** all five reviews independently (selection bias / survivorship / collider on the
per-passing-task denominators; division-by-zero when Arm 0 passes nothing — i.e. exactly when drift
is strongest).

**Defect.** §3.1 H5 divides each arm's cost by **its own** oracle-passing task set. The two arms
pass different task subsets filtered by different failure processes, so the subtraction compares
incommensurable distributions (Arm 0 passing only easy early tasks makes its per-success cost look
low; drift tax can go negative even when Arm 0 is objectively less efficient). At maximal drift
(Arm-0 passes = 0) the formula is undefined.

**Required change** (edit §3.1 H5 and the §6 pin-table S-5 row; keep the [R1-S5] commensurable-unit
decision — the unit stays tokens, only the denominators change):

- **Primary (reportable) H5:** both taxes use **attempted tasks** as denominator — the uniform 6
  per sequence, paired across arms (aborted/infrastructure records stay excluded per the ADR-005
  pin, which then reduces the denominator identically in both arms of a pair). Freshness tax =
  (Arm-H `usage.by_phase.spec` + `usage.gate_executor` tokens) ÷ attempted tasks. Drift tax =
  (Arm-0 total tokens ÷ attempted) − (Arm-H implementation-phase tokens ÷ attempted).
- **Pass rates are reported alongside** both taxes, always (cost and success reported as two
  numbers, never blended into one denominator).
- **Guarded secondary:** the per-oracle-passing-task efficiency ratio survives only as a secondary
  diagnostic, explicitly **undefined when either arm's passing set is empty** (report "undefined at
  pilot scale", never 0, never negative-by-artifact). Optionally note matched-task-intersection as
  an exploratory view for the full run, not the pilot.

**Acceptance:** no reportable H5 quantity conditions on an arm-specific passing set; the
zero-passing case has a defined non-numeric outcome; H5's definition in §3.1 and the §6 row agree
verbatim; `[R2: R2-2]` markers placed.

---

## R2-3 — Remove hidden-oracle condition (iii) from the Arm-H behavior-preserving affirmation `[BLOCKING]` `[FRONTIER-THINKING]`

**Source finding:** "Gate verdict" review B1 — unique catch, verified against §3.3; no other
reviewer saw it.

**Defect.** §3.3 affirmation condition (iii) requires "meter spec-side delta == 0" against the
**pre-task ground-truth IR** for the affirmation to succeed. The meter is the hidden oracle. So if
Arm H drifted at task k−1 and task k is behavior-preserving, the gate's behavior at task k depends
on hidden ground truth: the refused affirmation tells the agent its spec is stale and pushes it into
the ordinary custody path (which demands a spec edit). That is an undeclared information/enforcement
channel from the oracle into the treatment arm — Arm-H spec freshness (H2) stops being a pure
outcome, and the plan's own claim that "the affirmation cannot launder drift" inverts into "the
affirmation *reveals* drift".

**Required change** (edit §3.3, its `[R1-S4]` paragraph, M3 acceptance criteria, and the §6 pin
row for the no-change affirmation):

- Delete condition (iii). Affirmation = (i) spec artifacts parse cleanly, (ii) byte-identical to
  task-start, (iv→iii) the sealed verification-command handshake. Pre-existing staleness is scored
  by the post-task meter run exactly as on any other task — never consulted by the gate.
- Rewrite the fall-through paragraph: an agent that **edited** the spec on a behavior-preserving
  task fails (ii) and falls through to ordinary custody (spec changed + parses); an agent that did
  nothing affirms and proceeds regardless of inherited staleness. Verify and state explicitly that
  no deadlock path remains (with (iii) gone, a do-nothing agent with inherited drift can always
  exit the spec phase via the handshake).
- Re-state the H2-falsifiability argument without (iii): the meter runs post-task regardless, so
  desync introduced *or retained* on a behavior-preserving task still lands in Arm-H drift.
- Check M3's sealed `arm_h_gate_protocol` text description (§4 `protocol_text`) still matches the
  reduced condition set.

**Acceptance:** the Arm-H gate consults zero meter/ground-truth state anywhere in §3.3 or M3; the
falsifiability paragraph is rewritten and internally consistent; `[R2: R2-3]` markers placed.

---

## R2-4 — Rescope M6.5: full-length Arm-H calibration sequence + spend-refusal path `[BLOCKING]` `[FRONTIER-REGULAR]`

**Source findings:** all five reviews (arm unspecified); original reviewer's S-3 fix (full-length
Arm-H) adopted; "Gate verdict" B4's spend-refusal rule adopted. Note: two reviews proposed per-arm
budgets — **rejected**, because M0's arm-parity scenario requires identical budgets across arms;
do not introduce per-arm budgets.

**Defect.** M6.5 says "1 arm × 1 seed × 2–3 tasks" without naming the arm, while budget values are
shared across all arms (parity invariant). Calibrating on Arm 0 (cheapest) starves Arm H (extra
spec phase + gate protocol + oracle feedback), manufacturing budget-exhaustion failures that trip
the §3.2 floor rule and fake an H5 penalty. ≤3 tasks also never samples the late-sequence regime
(tasks 4–6: larger surface, longer files) that H4 is specifically about.

**Required change** (edit the M6.5 section, its Gherkin, the milestone summary table row, §4's
budget-freeze note, and the §6 pin-table S-3 row):

- M6.5 = **one full-length Arm-H sequence: 6 tasks × 1 seed**, `run_classification: calibration`,
  non-evidence, spend-gated as before. Rationale to state in the doc: Arm H upper-bounds every
  arm's budget appetite (it is the only arm with spec-phase + gate + oracle-feedback costs), and a
  full-length run samples the late-sequence pressure a ≤3-task run misses. Marginal cost: single
  dollars against a tens-of-dollars pilot.
- Optional (state as optional): a 1-task Arm-0 sanity run alongside, same classification.
- Budgets remain **one shared set across arms** (parity), ratified-or-adjusted-once from the Arm-H
  observation; Arms 0/M being comparatively slack is acknowledged in the doc as intentional and
  harmless (slack cannot manufacture failures; tightness can).
- Add the **spend-refusal rule**: if M6.5 authorization is declined, the program **halts cleanly
  after M6** with status "pilot not authorized — budgets unfrozen"; no partial freeze, no fallback
  to fake-agent-derived budget values.

**Acceptance:** the calibration arm, length, seed count, classification, shared-budget rationale,
and refusal path are all explicit; the "≤3 tasks" text is gone everywhere (Gherkin included);
`[R2: R2-4]` markers placed.

---

## R2-5 — Operationalize the executor-error / agent-broken boundary `[SHOULD-FIX, do at this gate]` `[FRONTIER-REGULAR]`

**Source findings:** four of five reviews. **Adopt the agent-caused default** (original reviewer +
"Gate verdict" S1); explicitly **reject** the inverted default proposed by the "Adversarial Pass 2"
review (default-to-`executor_error` re-opens the original R1-B1 hole: an agent's infinite loop
presenting as a readiness timeout would be excluded from taxes and the floor rule).

**Defect.** M3 pins the principle (agent-caused readiness failure = task failure; `executor_error`
= infra only, aborts + excluded) but gives no runtime discriminator. Ambiguous presentations —
agent infinite loop → health-check timeout, EMFILE, OOM — could be misclassified as infra and
silently excluded, biasing H4/H5.

**Required change** (edit M3 scope + acceptance criteria, §3.2's [R1-B1] paragraph, and the M0/M5
manifest-schema field lists):

- Pin a **closed infra enumeration**: `executor_error` iff one of {workspace-process spawn failure
  before agent code runs, harness port-allocation/bind failure, executor internal crash, OS-level
  transport fault} — and **every other readiness failure defaults to agent/workspace-caused**
  (scored `oracle.cumulative_pass = 0`, sequence continues). Induction argument to include: T0
  boots by the generator's self-check (M1) and M6 proves the pipeline end-to-end, so a task-k
  readiness failure on a previously-booting app is agent-authored unless it matches the closed
  infra list.
- Add the **clean-workspace reproducibility test** as the tie-breaker for ambiguous cases: if the
  failure reproduces on a pristine (pre-agent) workspace under the same executor, it is infra;
  otherwise agent-caused.
- Add a required **`classification_rationale`** string field to every `executor_error` record (M0
  type, M5 manifest) so post-hoc audit can reclassify.
- Extend M3 acceptance with five named fixtures: broken `package.json`, server compile error,
  infinite startup loop (presents as readiness timeout ⇒ must classify agent-caused), port-bind
  failure (⇒ infra), executor crash (⇒ infra).

**Acceptance:** the infra class is closed and enumerated; the default direction is stated in one
sentence; the five fixtures are in M3's acceptance criteria; `classification_rationale` appears in
the schema field lists; `[R2: R2-5]` markers placed.

---

## R2-6 — Pin go/no-go (c2) as binary-per-task on both sides `[SHOULD-FIX]` `[LOWER-OK — DeepSeek Pro]`

**Source findings:** original reviewer S-7 fix (adopted); "Second Independent Gate Review" #6
diagnosed the same mismatch but its replacement metric (plain oracle-fail rates) is **rejected** —
it would discard the enforcement-propensity contrast the design deliberately built on ADR-003's
`enforcement_outcome`.

**Defect.** §5 (c2) compares Arm-0/M false-confidence propensity (`done ∧ oracle-fail` — terminal,
≤1 per task) against Arm-H's `refused_done_over_red` **per task** — a counter that can reach the
retry budget (≈3) per task. The mismatched ranges inflate Arm-H's side and bias (c2) toward not
firing (false no-go direction).

**Required change** (edit only the (c2) cell of the §5 go/no-go table + the sentence after it):
both sides become **binary per task** — "≥1 unearned done attempt during the task" (for Arms 0/M:
a done accepted while the hidden oracle fails; for Arm H: ≥1 `refused_done_over_red` event) —
compared as rates over attempted tasks. Total refusal counts are retained as a reported diagnostic,
not part of the predicate. Keep the existing "same underlying event family / no
decorative-by-construction disjunct" language.

**Acceptance:** both sides of (c2) have range {0,1} per task; refusal-count diagnostic named;
`[R2: R2-6]` marker placed.

---

## R2-7 — Add an `inconclusive_uninterpretable` pilot outcome class `[SHOULD-FIX]` `[FRONTIER-THINKING]`

**Source findings:** three reviews convergent ("Gate verdict" S5 most complete; second-review S-5;
"Second Independent" #7's minimum-valid-sequences rule folded in).

**Defect.** §5 defines go vs. no-go only, and declares "a no-go means the instrument is sound but
the signal is absent." Several outcomes are neither, and reporting them as a clean no-go would
overclaim: an all-arms-zero-drift result cannot distinguish "agents maintain specs" from "substrate
too easy" (the construct-validity concern two reviews raised); n=2 can degrade to n=1 after
exclusions; H5 can be undefined; instrumentation artifacts can dominate.

**Required change** (add a §5 subsection "Pilot outcome classes", update the `bin/e4-gonogo.ts`
description + M6's go/no-go Gherkin to emit three-valued output):

- Third executable outcome `inconclusive_uninterpretable`, with **named machine-checkable
  reasons**, at minimum: (i) fewer than 2 complete, replay-valid paired seeds per arm survive
  exclusions; (ii) **all arms zero drift velocity** ⇒ classified "substrate not validated — H1
  untested", explicitly *not* a clean scientific null (this is the pre-committed interpretation of
  the zero-drift case; heavier substrate redesign stays out of v1 per §8); (iii) `extraction_failed`
  on more than a pinned fraction of task records; (iv) Arm-H protocol confusion dominating (e.g.
  agent never exits the spec phase on a majority of tasks); (v) H5 denominators undefined under the
  R2-2 guarded-secondary rule alone (primary attempted-task H5 remains defined). Add a
  high-seed-variance **note** (max/min ratio across seeds > 3 ⇒ recommend more seeds) as advisory,
  not a class.
- State the reporting rule: `no-go` may only be claimed when none of the named reasons fire.
- Thresholds you must pick (e.g. the extraction-failed fraction) get sealed into
  `e4-sealed-constants` §4 — add the field to the constants shape.

**Acceptance:** three-valued outcome wired through §5, the gonogo-tool description, and M6's
Gherkin; every reason is checkable from manifests alone; zero-drift is pinned to "substrate not
validated"; `[R2: R2-7]` markers placed.

---

## R2-8 — Decompose Arm-H usage; H5 sensitivity to protocol overhead `[SHOULD-FIX]` `[FRONTIER-REGULAR]`

**Source findings:** three reviews convergent ("Gate verdict" S7 decomposition; second review S-6
sensitivity analysis; "Adversarial Pass 2" context-load concern — its context-reset fix is
**rejected** because it would alter the treatment itself; measurement, not redesign).

**Defect.** Arm H receives more than enforcement: gate-protocol text, red/green oracle feedback,
refusal feedback. §3.1 lumps these into `usage.by_phase.spec` + `usage.gate_executor`, so the
freshness tax can hide a protocol-parsing/tutoring tax, and comparisons phrased as "the cost of
keeping specs fresh" overclaim.

**Required change** (edit §3.1 H5's freshness-tax paragraph, the M0/M5 manifest field lists, and
§4 if a field is sealed):

- Split Arm-H usage accounting into three named components: **spec-authoring tokens**,
  **gate-protocol interaction tokens** (handshake, refusals, custody exchanges), and
  **oracle-feedback tokens** (red/green result payloads). Manifest `usage.by_phase` gains these
  sub-fields; all remain direct manifest reads (Gate-1 change 4), never turn-record archaeology.
- Report **prompt-overhead tokens per arm** (sealed protocol/instruction text length) as a manifest
  diagnostic.
- Add one **sensitivity line** to H5's pre-registered analysis: freshness tax computed with and
  without the gate-protocol-interaction component; if the H5 verdict flips between the two, H5 is
  reported as "sensitive to protocol overhead", not as a clean verdict.

**Acceptance:** three components named in §3.1 and the manifest field list; sensitivity rule stated
in one sentence inside H5; `[R2: R2-8]` markers placed.

---

## R2-9 — Batch of small verified pins (one PR) `[SHOULD-FIX, mechanical]` `[LOWER-OK — DeepSeek Pro; (d) Flash-viable]`

Each sub-item is a fully specified, small edit to `docs/e4/IMPLEMENTATION-PLAN.md`. Do them all in
one pass; mark each `[R2: R2-9x]`.

- **(a) Onset scan window** (source: "Second Independent" #5, unique catch): in §3.1 H1, state that
  the onset/first-observed scan runs over **all** tasks in the sequence; only the **denominator**
  is restricted to `drift_opportunity`-labeled tasks. (Prevents drift first surfacing on a
  non-opportunity task — e.g. cascading staleness — from being silently dropped.)
- **(b) Replay = recorded-event replay** (source: "Gate verdict" S6; two other reviews misread this
  as requiring model re-execution): in M5, state explicitly that `chain_replay_valid` means the
  inspector reconstructs each snapshot-k hash from snapshot k−1 **plus recorded turn/tool event
  logs — no provider calls, ever** (the `inspectE1Bundle` precedent), and add to M5's scope that
  the artifact bundle must retain event logs sufficient for this (file writes, command invocations,
  stdout/stderr, exit codes, gate/oracle artifacts, exact task/protocol text).
- **(c) Noticing-probe sequencing pin** (source: "Gate verdict" C2; a harder "contamination"
  version of this claim was rejected — see Adjudicated out): in §3.1's noticing-probe bullet and/or
  M4, pin that the probe fires strictly **after** task closure and the task snapshot, inside the
  task's conversation (which is discarded — fresh conversation per task), so its answer can never
  leak into any subsequent state. Architecture already sequences it `oracle → meter → probe`
  (`E4-ARCHITECTURE.md:132`); make the plan text match.
- **(d) Run-count wording** (source: "Gate verdict" C4): §5 and M7 say "36 sequential runs"; the
  actual structure is **6 arm-sequences (3 arms × 2 seeds) of 6 tasks = 36 task-runs**. Fix the
  wording in both places — exclusion and replay-validity accounting hang off the sequence count.
- **(e) §5(b) wording**: the criterion row says "zero false negatives" but the executable predicate
  ("the M2 known-drift-fixture test passes at the frozen meter version") includes the clean twin's
  zero-false-positive scenario. Amend the row's prose to "zero false negatives on the known-drift
  fixture **and zero false positives on its clean twin**" so prose and predicate match.
- **(f) Conventions-scope comms note** (source: "Adversarial Pass 2", downgraded — its
  "unmeasurable" claim misread ADR-004's constrained grammar): add one sentence to M2 or §8 stating
  that v1's conventions channel measures **grammar-constrained, machine-checkable conventions
  only**; soft/qualitative conventions (naming taste, layering style) are out of scope and no
  external claim may imply otherwise.

**Acceptance:** all six edits present, each ≤3 sentences, no semantic changes beyond those
specified.

---

## R2-10 — Substrate difficulty diagnostics (optional, non-gating) `[CONSIDER]` `[FRONTIER-REGULAR]`

**Source findings:** the substrate construct-validity concern raised by two reviews as blocking and
two as consider. Adjudicated: the pilot-scale answer is R2-7(ii)'s pre-committed zero-drift
interpretation; substrate *redesign* (ambiguous/implicit ops) is a **full-run/v2 question**. What
remains for v1 is cheap diagnostics so the full-run decision is informed.

**Required change** (add to M1 scope + the pilot report requirements in §5, non-gating):

- The generator emits a per-sequence **difficulty diagnostic block**: op-type shares (drift /
  additive / behavior-preserving / rename / convention), average IR items touched per op, and a
  crude NL-opacity proxy (e.g. whether the NL rendering names the changed item verbatim vs.
  paraphrases — derivable from the renderer's phrasing-pool choice, which is already seeded and
  recorded).
- The pilot report must state which channels/op-types produced the observed drift (§5(a)'s
  class-composition diagnostic already exists — extend it with op-type attribution), so a
  "drift came only from trivial bookkeeping" reading is checkable rather than deniable.
- Add one line to §8 (not-in-v1): implicit/ambiguous drift ops (semantic-inference tasks) are a v2
  `op_mix` lever, informed by these diagnostics.

**Acceptance:** diagnostics are emit-and-report only (no gate depends on them); §8 line added;
`[R2: R2-10]` markers placed.

---

## Adjudicated out (do NOT implement; recorded to prevent re-litigation)

- **"Replay-validity is impossible with non-deterministic LLMs" (blocking claim):** misreading.
  M5 follows the `inspectE1Bundle` precedent — replay of *recorded* events, no model re-invocation.
  Resolved by clarifying pin R2-9(b) only.
- **"Noticing probe contaminates the control arms" (blocking claim):** the architecture fires the
  probe after oracle+meter at task close, and M4 gives each task a fresh conversation — there is no
  cross-task working memory to prime. Resolved by sequencing pin R2-9(c) only.
- **Relaxing the H4 floor rule to "both seeds must collapse":** rejected. §3.2's conservatism is
  deliberate, pre-registered, and H4 is not in the go/no-go; the relaxation trades false-block for
  false-pass on a non-gating hypothesis.
- **Defaulting ambiguous readiness failures to `executor_error`:** rejected; inverts R1-B1 and
  re-opens the masked-agent-failure hole (see R2-5 for the adopted default).
- **Replacing (c2) with plain oracle-fail-rate comparison:** rejected; discards the
  enforcement-propensity contrast (see R2-6).
- **Requiring monotonic drift-burden increase in criterion (a):** rejected; reintroduces
  stock-thinking that R1-B2 removed and over-gates a signal-detection pilot.
- **Per-arm budget values:** rejected; violates the M0 arm-parity invariant (identical budgets
  across arms). See R2-4.
- **Mid-task context reset/summarization for Arm H:** rejected; alters the treatment. Measurement
  version adopted as R2-8.
- **"Conventions channel is unmeasurable by deterministic diff":** misreading of ADR-004's
  constrained normative grammar + stable-ID conventions IR. Comms-scope note adopted as R2-9(f).
- **"Affirmation handshake is theater, remove custody-signal claims":** already conceded verbatim
  in the plan's [R1-S4] ("a protocol handshake, not a signal"). No change.

## Changelog

(append completed items here)

- 2026-07-08 **R2-1 done** — drift incidence = episode onsets keyed `(semantic_item_uid, direction)`
  with rename-lineage merging (generator emits the map, M1), reappearance-=-new-episode, and sealed
  convention aggregation (`meter_rules.convention_aggregation_min_items`, §4); pinned in §3.1 H1,
  M0 stub, M1 scope+acceptance, M2 fixture (4 identity-semantics rows) + acceptance
  (item_id → semantic_item_uid), §6 B-2 row. **Note:** the H1 rewrite also states the all-tasks
  onset-scan window with the opportunity-restricted denominator, which **subsumes R2-9(a)** — the
  R2-9 agent should verify and mark (a) no-change-needed rather than re-edit. Working tree only,
  not committed.
- 2026-07-08 **R2-3 done** — hidden-oracle affirmation condition ("meter spec-side delta == 0")
  removed from §3.3; conditions renumbered to (i) parse / (ii) byte-identical / (iii) handshake;
  rationale + no-deadlock + H2-falsifiability paragraphs rewritten (launder/reveal symmetry);
  `[R1-S4]` renumbered; M3 acceptance now requires the gate to consult no meter/ground-truth state
  as a testable property; §6 affirmation pin row updated. Working tree only, not committed.
- 2026-07-08 **R2-7 done** — new §5.1 `inconclusive_uninterpretable` outcome class: 4 hard triggers
  (min 2 replay-valid paired seeds; all-arms-zero drift ⇒ "substrate not validated — H1 untested",
  with the any-arm-drifts carve-out making an Arm-0 zero a real null; extraction_failed > 0.10;
  Arm-H spec-phase stall ≥ 0.50) + 2 advisory flags (per-passing H5 undefined; seed variance > 3×);
  `bin/e4-gonogo.ts` three-valued (exit 0/1/2) in §5, M6 Gherkin, M7 acceptance; thresholds sealed
  in §4 `interpretability`. Flag (v) phrased forward-compatibly with R2-2's zero-denominator guard.
  Working tree only, not committed.
- 2026-07-08 (all three) — R2 revision-summary paragraph added to the plan header after the R1
  paragraph, listing applied vs. still-open items.
- 2026-07-08 **R2-2 done** — H5's primary reportable form switched to **attempted-task**
  denominators on both taxes (uniform 6 per sequence, paired, aborted-excluded per ADR-005); pass
  rates reported alongside always; the per-oracle-passing-task ratio demoted to a guarded secondary,
  "undefined at pilot scale" (never 0, never negative) whenever either arm's passing set is empty —
  wording matched verbatim to §5.1 advisory flag (v); matched-task-intersection noted as an
  exploratory full-run-only view. §3.1 H5 and §6 S-5 row both updated. Drafted jointly with R2-8 in
  one H5 rewrite per the backlog header's instruction. Working tree only, not committed.
- 2026-07-08 **R2-4 done** — M6.5 rescoped from "1 arm × 1 seed × 2–3 tasks" to **one full-length
  Arm-H sequence (6 tasks × 1 seed)**, with rationale (Arm H upper-bounds budget appetite; only a
  full-length run samples the late-sequence H4 regime); optional 1-task Arm-0 sanity run kept
  alongside; shared-budget-across-arms parity invariant restated explicitly (per-arm budgets
  rejected); added the spend-refusal rule (declined authorization ⇒ program halts cleanly after M6,
  status "pilot not authorized — budgets unfrozen", no partial freeze, no fake-agent-derived
  fallback). Updated: M6.5 heading/scope/Gherkin, milestone summary table row, §6 S-3 row. No stale
  "≤3 tasks"/"2–3 tasks" text remains anywhere in the plan (verified by grep). Working tree only, not
  committed.
- 2026-07-08 **R2-5 done** — executor-error/agent-broken boundary operationalized: closed infra
  enumeration (workspace-spawn-before-agent-code, port-bind failure, executor crash, transport fault)
  with every other readiness failure defaulting to agent-caused (inverse default explicitly rejected,
  citing the backlog's "Adjudicated out" entry); clean-workspace-reproducibility test added as the
  tie-breaker for ambiguous presentations; required `classification_rationale` string field added to
  `executor_error` records (M0 type list, M5 manifest scope); five named M3 fixtures added (broken
  `package.json`, compile error, infinite-startup-loop ⇒ agent-caused, port-bind ⇒ infra, executor
  crash ⇒ infra). Updated: M3 (a) scope + (b) acceptance, §3.2's [R1-B1] paragraph, M0/M5 manifest
  field lists. Working tree only, not committed.
- 2026-07-08 **R2-6 done** — go/no-go (c2) redefined as **binary-per-task on both sides**: "≥1
  unearned done attempt during the task" (Arms 0/M: done accepted while hidden oracle fails; Arm H:
  ≥1 `refused_done_over_red` event), compared as rates over attempted tasks; total refusal counts
  retained as a named diagnostic, not part of the predicate; "same event family / no
  decorative-by-construction disjunct" language kept verbatim. Only the (c2) clause and its
  immediately following sentence in the §5 go/no-go table were touched, per the item's scope. Working
  tree only, not committed.
- 2026-07-08 **R2-8 done** — Arm-H usage decomposed into three named, directly-read `usage.by_phase`
  sub-fields (spec-authoring / gate-protocol-interaction / oracle-feedback tokens); per-arm
  prompt-overhead-tokens (sealed `protocol_text` length) added as a manifest diagnostic; H5
  sensitivity line added (freshness tax computed with/without the gate-protocol-interaction
  component; a flip is reported as "sensitive to protocol overhead" rather than a clean verdict).
  Drafted jointly with R2-2 in the same H5 rewrite (§3.1); manifest field lists updated at M0/M5; no
  new §4 sealed field was needed (prompt-overhead is a diagnostic, not a sealed constant). Working
  tree only, not committed.
- 2026-07-08 **R2-9 done (batch of six)** — (a) verified **no-change-needed**: §3.1 H1 (applied under
  R2-1) already states the onset scan runs over all tasks with only the denominator restricted to
  `drift_opportunity` tasks — exactly the required pin, so (a) was not re-edited. (b) M5 scope now
  states explicitly that `chain_replay_valid` reconstructs each snapshot-k hash from snapshot k−1 plus
  recorded turn/tool event logs alone, **no provider call ever**, and requires the retained artifact
  bundle to carry file writes/command invocations/stdout-stderr/exit codes/gate-oracle
  artifacts/exact task-protocol text. (c) §3.1's noticing-probe bullet now pins that the probe fires
  strictly after task closure inside the (discarded) task conversation, matching the architecture's
  `oracle → meter → probe` sequencing. (d) "36 sequential runs" replaced with "6 arm-sequences (3 arms
  × 2 seeds) of 6 tasks = 36 task-runs" in §5, M7, and (for consistency) §7's footprint line — verified
  by grep that no "36 sequential runs" text remains. (e) §5(b)'s criterion-column prose amended to
  "zero false negatives on the known-drift fixture and zero false positives on its clean twin" to
  match the executable predicate. (f) added a one-sentence conventions-scope comms note to §8:
  v1's conventions channel measures grammar-constrained, machine-checkable conventions only. Working
  tree only, not committed.
- 2026-07-08 **R2-10 done** — M1 scope gains a non-gating per-sequence **difficulty diagnostic
  block** (op-type shares, average IR items touched per op, NL-opacity proxy from the renderer's
  seeded phrasing-pool choice); §5(a)'s class-composition diagnostic extended with op-type
  attribution so a "drift came only from trivial bookkeeping" reading is checkable from the pilot
  report; one line added to §8 naming implicit/ambiguous drift ops as a v2 `op_mix` lever informed by
  these diagnostics. All emit-and-report only; no gate depends on them. Working tree only, not
  committed.
- 2026-07-08 **All ten R2 items now applied** — the plan header's Revision R2 paragraph was rewritten
  from "partial: R2-1/R2-3/R2-7" to "complete: all ten backlog items", summarizing each. Internal
  consistency verified: no stale "≤3 tasks"/"2–3 tasks"/"36 sequential runs" text remains anywhere in
  `IMPLEMENTATION-PLAN.md` (grep-checked); the "undefined at pilot scale" H5 zero-denominator phrase
  is identical across §3.1, §5.1 flag (v), and the §6 S-5 row; §3.1 H1's all-tasks-scan/
  opportunity-restricted-denominator statement matches the §6 B-2 row's summary. No pin-table row was
  added for R2-5/R2-6/R2-8/R2-9/R2-10, matching their required-change scopes (none named a §6 edit).
