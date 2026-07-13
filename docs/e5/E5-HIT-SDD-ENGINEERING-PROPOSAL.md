# E5 — HIT-SDD engineering program (proposal, v1)

**Status: PROPOSED (2026-07-13) — awaiting operator gate review. Nothing here is authorized;
every live step below is separately spend-gated per the standing rules.** This program
replaces E4's judging question with an engineering one, at explicit operator direction: the
goal is a product, and research exists to shape it.

## 0. The reframe

E4 asked *"does an executable-spec loop beat prose upkeep?"* and answered: not as built, for
identified reasons (`docs/e4/E4-ARC-CLOSEOUT-v1.md`). E5 asks the question the product needs:

> **Which combination of automated checks, increment size, and human touchpoints measurably
> improves an agent's work on an evolving codebase — and at what human cost?**

Three consequences of the reframe:

1. **The substrate becomes a test rig, not a referee.** Configurations are compared against
   each other on the same rig; rig imperfections that hit all configurations equally no
   longer poison conclusions (E4's fatal flaw was absolute claims; E5 makes none until the
   very end).
2. **Negative probe results are cheap eliminations, not verdicts.** The daily loop is $1–2
   single-seed probes (the L1–L5 learning-ladder pattern, which worked); the full sealed
   machinery is used exactly once, at the end, to validate the winning configuration for the
   public claim.
3. **The E4 failure inventory becomes the requirements list.** Everything the forensics
   found is either a lever to test or a defect to fix (§2, §3).

**The un-refuted thesis, stated as testable components:** E4 never varied increment size,
never had a human in the loop (the PM was canned text, delivered only on request), and its
checks were blind to intent by construction. HIT-SDD = checks + increments + human — all
three remain open, and two have positive prior evidence: executable acceptance FEEDBACK
(E1/dispatch-mini: feedback arm 0.88 vs context arm 0.44; E2 causal pilot: false confidence
79%→13%) and gate refusals (E4 v3-M7: 5 of 6 refusal-tasks closed truthfully).

## 1. Assets carried from E4 (no rebuild)

- The procedural REST substrate + OpenSpec workspace as the rig; chains replayable by seed;
  known-limitation inventory in the close-out §3.
- Instruments: disposition table {truthful close / false close / non-close}, fc|done,
  matched pairs, per-checkpoint burden (diagnostic only — granularity amplification is
  documented), the learning-report tool, calibration-class runs at $0.3–1.5/sequence, the
  detached launch shim, `e1:protect`.
- Discipline: classification (`calibration` = non-evidence, structurally excluded), per-step
  operator authorization, commit-never-push, external adversarial review of anything that
  will carry weight.
- The sealed-trial machinery (prereg → verdict tool → audits), parked until Phase P3.

## 2. Phase P0 — rig repair (code, zero spend, one gate act)

Fix what makes the rig noisy for EVERY configuration (all from committed findings):

1. **PATCH false disclosure**: make gold implement the disclosed partial-update semantics
   (or change the disclosure to full-replace) — 31–47% of E4-M7 counted drift.
2. **Disclosure gaps**: id-stability on rename; "new entity starts empty" is done; add the
   rename-data line to the brief.
3. **`modify_endpoint` phrasing variant 2** ("match the rest of the API") corrected to name
   the actual change.
4. **Glue-aware feedback**: when a line contains a delimiter mid-line, say so with the line
   number (the silent-ignore hole; ≈85 wasted turns, all 3 stalls).
5. **Leftover quarantine**: stale change directories moved aside at task boundary with an
   explicit resume note (the rules trap behind the swapped task).
6. **PM-review on-topic rule**: flag a change that addresses none of the current task's
   communicated operation.
7. **Root-cause-clustered burden** as a secondary readout (cluster items by
   `semantic_item_uid` families) so one divergence stops counting 8–11×.

Acceptance: census green, new rig version, twins re-pinned — the E4 hygiene pattern.

## 3. Phase P1 — the probe ladder (each ~$1–2, calibration class, separately authorized)

Fixed protocol per probe: one seed (fresh, by mechanical rule), the two configurations under
comparison, 3–6 tasks, full budgets, readout = disposition table + fc|done + oracle
end-state + burden(diagnostic) + **human-minutes consumed**; keep/kill decision recorded in
a learning log (`docs/e5/E5-LEARNING-LOG.md`, same format as E4's).

Ranked by prior evidence and product value:

- **L1 — Truth-visible close (the highest-prior lever).** At the done-claim, show the agent
  the executable ACCEPTANCE results (the hidden suite's verdicts, not just its own
  scenarios) and allow one repair cycle. This is the product feature "acceptance tests run
  in the loop" and the direct descendant of the program's strongest positive result.
  Question: does it convert false closes into repairs (E2 said yes at 79→13%)?
- **L2 — Increment size.** Same chain content delivered as (a) E4-sized tasks vs (b) one
  operation split into spec-step → implementation-step → data-migration-step. The
  "small increments" half of the thesis, never yet tested.
- **L3 — Human-answered ASK_PM.** Operator plays PM for one session (bounded, ~30 min):
  free-text answers to agent questions, logged verbatim. Against: canned brief. Measures
  the H in HIT-SDD where E4's failures clustered (ambiguity knobs).
- **L4 — Brief auto-injection.** The canned brief delivered unconditionally at task start
  (no asking needed). Cheap comparison point for L3: how much of the human's value is just
  "the information arrived"?
- **L5 — Commitment sheet.** Both configurations fill an identical structured commitment
  form (fields, required-ness, id policy, data migration) before implementing; one executes
  scenarios, one doesn't. The reviewers' 2×2, resolving "execution reveals mistakes" vs
  "execution changes commitments".

Stop-loss: global probe budget **$15** or 8 probes, whichever first; then a mandatory
synthesis gate with the operator.

## 4. Phase P2 — candidate assembly (~$3–5, authorized at the synthesis gate)

Compose the surviving levers into ONE candidate product configuration; run a 2–3 seed
shakedown against the P0 baseline. Output: the draft product-requirements document — each
validated lever mapped to a concrete feature:

| Lever | Product feature |
| --- | --- |
| Truth-visible close | acceptance-test runner wired into the agent loop (CI-grade) |
| Increment policy | change-slicing rules in the workflow (spec/impl/migration steps) |
| Human ASK routing | a PM inbox: agent questions surfaced at ambiguity points, answered async |
| Commitment sheet | spec-first change template the agent must fill before code |
| Hygiene items | agent-harness UX: precise protocol feedback, stale-state quarantine |

## 5. Phase P3 — one sealed validation trial (separate authorization, ~$10–20)

Only if P2 looks strong: full pre-registration (E4 machinery verbatim — composition-proof
primary, disposition table mandatory, external audits after), candidate configuration vs
P0 baseline, fresh seeds, claim ceiling Level 4. **This run, and only this run, feeds the
public claim** — and its credibility rides on the honestly documented E4 graveyard behind
it.

## 6. Metrics and honesty rules

- **Primary for probes and the trial: the disposition table** — truthful closes up,
  false closes down, at bounded human-minutes. Oracle end-state as the work-quality
  companion. Burden = diagnostic only (root-cause-clustered where it matters).
- fc-over-attempted never presented as honesty (E4 §10 rule, binding forever).
- Probes are calibration class: no claims, any direction, logged either way.
- All E4 claim-language guardrails (`E4-ARC-CLOSEOUT-v1.md` §7) bind every artifact.
- Human-minutes are measured and reported wherever a human participates — product viability
  is benefit **per human minute**, and hiding the denominator would be the new version of
  the old sins.

## 7. Open items for the gate review (operator decisions)

1. **Model**: stay on glm-5.2 (continuity, cheap, known quirks) vs switch to the model class
   the product will actually target. Recommendation: glm-5.2 through P1, revisit at P2.
2. **Human-PM protocol for L3**: live operator session vs scripted answers derived from the
   brief with disclosure discipline. Recommendation: live once (it's the thesis), scripted
   for replication.
3. **Probe budget cap** ($15/8 probes proposed) and P0 scope confirmation.
4. Whether E4's `e4_arm_h`-style naked-execution config joins any probe as a third point
   (adds cost; usually unnecessary — levers are compared pairwise).
