# E5 — HIT-SDD engineering program (proposal, v2)

**Status: PROPOSED (v2, 2026-07-13) — awaiting operator gate review. Nothing here is
authorized; every live step is separately spend-gated.** v1 was adversarially reviewed by two
independent external teams before any spend (their reviews and this adjudication: §9). v2
incorporates every accepted finding; the program direction — engineering the HIT-SDD thesis
instead of judging it — survived both reviews explicitly.

## 0. The reframe (amended)

E4 asked *"does an executable-spec loop beat prose upkeep?"* and answered: not as built, for
identified reasons (`docs/e4/E4-ARC-CLOSEOUT-v1.md`). E5 asks the question the product needs:

> **Which combination of automated checks, increment size, and human touchpoints measurably
> improves an agent's work on an evolving codebase — and at what human cost?**

Consequences, corrected per review:

1. **Pairwise comparison neutralizes flaws in the SCORING path only.** The v1 axiom ("rig
   flaws that hit both configurations equally stop poisoning conclusions") is false for
   flaws in the INFORMATION path: every lever changes what reaches the agent, and rig
   defects ride that channel asymmetrically. Therefore every probe carries a mandatory
   **exposure note**, written before authorization: which rig subsystems the treatment's
   information channel touches that the control's doesn't, and which known or suspected
   defects live there.
2. **Probes are cheap eliminations with a declared detection floor.** This ladder screens
   for PRODUCT-SIZED effects (visible at n≈2 seeds). A dry ladder means "the thesis is
   small at this rig/model," never "the thesis is dead" — written here so it cannot be
   read otherwise later.
3. **The E4 failure inventory is the requirements list**, split per §2 into instrument
   repairs vs product levers (v1 conflated them).

**Prior ledger (corrected per review — priors ranked honestly):**

| Lever | Prior | Class |
| --- | --- | --- |
| Executable acceptance feedback | E2 causal pilot 79%→13% false done-claims; E1 mechanism probe 0.88 vs 0.44 | strong causal (different model; feedback was DURING work, not at close) |
| Gate refusals | v3-M7: 5/6 refusal-tasks closed truthfully | conditional-on-firing observation, NO no-refusal counterfactual — mechanism prior only |
| Increment size | none | untested |
| Human PM | none | untested |
| Commitment sheet | none | design proposal, not evidence |

## 1. Assets carried from E4 (unchanged from v1)

Substrate + OpenSpec workspace as rig; disposition table, fc|done, matched pairs, burden
(diagnostic); learning-report tool; calibration-class runs; detached launch shim;
`e1:protect`; classification discipline; per-step authorization; commit-never-push; external
adversarial review of anything weight-bearing. Sealed-trial machinery parked until P3 —
**under E5's own governance identity** (own condition IDs, constants lineage, compatibility
boundary; E4 machinery is reused code, never reused identity).

## 2. Phase P0 — split per review into instrument validity vs product levers

**P0-V (instrument validity — one gate act, zero spend):**

1. **PATCH contract:** fix by DISCLOSURE (brief and README state full-replace semantics) —
   not by reimplementing gold, which would mint a new convention family (merge rules,
   explicit-null handling). Minimal blast radius.
2. **False disclosures only** — the "rename … everywhere" brief line and `modify_endpoint`
   phrasing variant 2 corrected. **Residual-ambiguity policy (new, per review):** a hidden
   convention is unfair only if NO legitimate channel can resolve it. Fix those; keep
   PM-plausible knobs (id policy, required-ness, initial data) as an explicit, committed
   **ambiguity inventory** — they are the measurement material for the ask/brief levers,
   answerable via brief content, never unconditionally disclosed.
3. **Glue-aware protocol feedback** ("text precedes a delimiter on line N") — instrument
   repair; ≈85 wasted turns and all 3 stalls.
4. **A lawful park/abandon primitive for change directories** — repairs the verified
   lawlessness (exactly-one-dir rule + no delete primitive) while KEEPING leftover mess as
   realistic product stress; auto-quarantine (v1 item 5) is withdrawn — it baked a §4
   product feature into the baseline.
5. **Off-topic close as a SCORING category** in the disposition table (the referee currently
   cannot see a swapped task). The live on-topic GATE (v1 item 6) is withdrawn from P0 and
   re-typed as a product lever (P1.6).
6. **Root-cause-clustered burden** as a frozen secondary readout.
7. **Commitment-vs-gold scorer** (needed by P1.5 if run; cheap, built on the reconcile
   machinery).

**P0 acceptance (strengthened):** census green + twins re-pinned + **one external
adversarial pass over the P0 diff and ALL brief/README text before probe 1** (the last false
disclosure was a brief line; zero spend, operator-run) + P0 repair effort logged in
operator-minutes (the program's first acceptance-suite-authoring cost datapoint, §4).

## 3. Phase P1 — the probe ladder (restructured per review)

**Fixed protocol per probe:** 6-task, ambiguity-enriched seeds by a recorded outcome-blind
mechanical rule (raises target-event rate instead of buying seeds); decision unit = MATCHED
TASK PAIRS within seed, never seed aggregates; pre-committed keep/kill template per probe
before authorization; **KEEP may be provisional on one seed (P2 re-tests it); KILL requires
a second seed; a probe where the target event never occurred (no false closes to convert, no
questions asked) is VOID, not a kill.** Readout: disposition table (incl. off-topic
category) + fc|done + oracle end-state on the held-out partition + burden (diagnostic) +
human-minutes + the probe's exposure note. Probe base = the P0-V product loop (see §5
baseline definitions). Rungs renamed P1.x (E4's ladder owns "L").

**Tier 1 (run first, powered):**

- **P1.1 — Truth-visible close, split-oracle design.** Per task the hidden suite is
  partitioned into SHOWN and HELD-OUT halves by semantic family; at the done-claim the
  agent sees SHOWN verdicts and gets one repair cycle; **the control gets a budget-matched
  "re-verify before final close" cycle with no oracle data** (removes the extra-compute
  confound). Primary readout scored on HELD-OUT + full key; every repair diff classified
  {generalizing repair / shown-check-only patch / known-quirk compliance} against the P0
  defect inventory. **Kill-scope clause (pre-registered): a null kills "at-close
  visibility" only — the evidenced E1/E2 mechanism was feedback DURING work, and a
  during-work variant is the designated follow-up, not collateral damage.**
- **P1.2 — Increment size, operation-level scoring.** E4-sized tasks vs
  spec→implementation→migration steps. **Scoring unit = the original operation in BOTH
  arms** (an operation closes truthfully iff its final step does and its oracle is green
  there; burden checkpoints at operation boundaries only) — otherwise the split arm's ~3×
  checkpoints change the accounting, not the work.

**Tier 2 (order fixed per review: injection before human):**

- **P1.3 — Brief auto-injection** (re-typed: this is the information-content control AND a
  candidate product default). If injection alone closes the ambiguity-failure class, P1.4
  and its contamination problem are unnecessary.
- **P1.4 — Scripted-PM interactivity** (only if P1.3 leaves residual ambiguity failures).
  **Role inversion per review:** the replicable primary arm is SCRIPTED
  answers-with-disclosure-discipline from a pre-frozen PM knowledge sheet (brief facts +
  named business-level facts; everything else answered "I don't know — use your
  judgment"); every answer logged and post-classified {in-sheet / don't-know / leaked},
  leaked answers VOID the episode. The live operator session is a labeled **ceiling probe**
  (perfect-information PM): kill-capable, never keep-capable. Human-minutes reported with a
  sensitivity row at a fixed per-answer time constant. A **mid-task re-ask nudge** ships as
  part of this rung's design (the one-shot turn-1 ask policy otherwise gives the lever no
  exposure).

**Cheap config rungs (~$1.5 each, may interleave):**

- **P1.5 — Request-echo at close** (from the parked v4 list; attacks the swapped-task and
  unexamined-intent modes at near-zero human cost).
- **P1.6 — BP-task change scrutiny** (the re-typed on-topic/refusal lever). Note the naive
  version — requiring a failing novel scenario on maintenance tasks — is incoherent (a noop
  has no delta to discriminate; that is WHY the rig skips it). The designed rung: on
  behavior-preserving tasks, changes that MODIFY existing scenario semantics require
  justification or trigger review.

**Deferred:** P1.7 commitment sheet — v1's design held the sheet constant and varied
execution, so it could never test the sheet (review: refuted). Runs only as a true 2×2 if
Tier-1 results warrant, else the sheet is used as a scoring instrument only.

**Stop-loss:** $18 or 8 probe-seeds, whichever first (raised from $15 to fund kill-needs-2;
operator confirms at gate) → mandatory synthesis gate.

## 4. Phase P2 — candidate assembly (amended)

**Pre-declared composition rule (new):** substitute pairs resolved before assembly (P1.3 vs
P1.4 — never both unless P1.4 beat P1.3 directly); interaction cautions carried (P1.1's
visibility must be step-type-aware if composed with P1.2 — a spec-only step's suite is red
by construction and this model never closes over visible red); expected sub-additivity
stated in advance. One or two mandatory interaction probes if Tier-1 winners overlap
mechanistically. Then a 2–3 seed shakedown of the frozen bundle **plus one transfer rung:
each surviving lever once, one seed, on the product's target model** (the E4 quirk inventory
is glm-5.2-shaped; a PRD written from one model's quirk mitigations is not a PRD).

Output: **an evidence-status table, not a "validated features" list** — per lever: behavior
demonstrated / product capability still assumed / failure modes not exercised / next
engineering test. Known standing gaps (named now, per review): acceptance-suite AUTHORING
cost and error rate (the product's real bottleneck — first datapoint = P0's logged
repair-minutes; the E4 record itself is the sharpest evidence that authoring correct suites
is hard); slice DISCOVERY (the rig's generator slices; the probe tests whether slices help);
async PM latency (probes are synchronous; a turn-delayed answer variant is cheap if P1.3/4
survive).

## 5. Phase P3 — one sealed trial (redefined per review)

**Baselines defined (v1 left this open — review X2):** probe base = P0-V product loop; P3
comparator = **prose upkeep** (continuity with E4's question and with practice); the
naked-execution config appears ONCE at P2 as an anchor, never per-probe, never at P3.

**Primary (resolving v1's §5/§6 contradiction — review X1, accepted in full):** the
**disposition table as a scalar matched-pairs predicate** (paired truthful-close advantage
over both-closed pairs, McNemar-style, with the close-rate guard), **plus a sealed freshness
non-inferiority guard** (candidate burden AUC not worse than comparator by more than a
pre-set margin, leave-one-seed-out robust). The metric switch from E4's freshness-primary is
hereby DECLARED and will be acknowledged in the prereg and any public artifact, alongside
the four E4 verdicts: E5 selects and validates on honesty-of-closure with freshness
guarded, because a config that closes truthfully over a faster-rotting spec would be the
mirror image of the M6 composition sin.

**Power, precommitted before any P1 outcome exists:** minimum worthwhile effect set at the
synthesis gate; seed count derived from the required discordant-pair rate (M7 yielded 33
pairs from 6 seeds — pairs are the real n); a leave-one-seed-out robustness gate (the
verdict must survive every LOSO — this would have caught seed-140 dominance pre-publication);
the variance advisory escalated to a binding magnitude ban. **If the budget caps seeds below
the derived count, P3 is labeled a "sealed large-effect screen", not a validation** — the
claim ceiling drops accordingly. Fresh seeds AND a SHOWN/HELD-OUT evaluator partition carried
from P1.1 (fresh seeds hold out instances, not conventions — review finding, accepted).

## 6. Metrics and honesty rules (amended)

- Primary as defined in §5 — a decision rule, not a table ("up/down/bounded" was three
  unweighted directions; review: refuted).
- Reported always: full disposition table (with off-topic closes), fc|done, matched pairs,
  oracle end-states, burden series + root-cause-clustered burden, human-minutes AND
  question count, response latency, tokens, dollars, wall-clock.
- fc-over-attempted never presented as honesty (binding forever).
- Probes are calibration class: non-evidence, any direction, logged either way, VOID rules
  honored.
- Human-minutes measured wherever a human participates; benefit-per-human-minute reported
  with the sensitivity constant; a zero-human-minute config reports the numerator alone.

## 7. Open items for the gate review

1. **Model:** glm-5.2 through P1 (economics) + the mandatory P2 transfer rung —
   recommendation unchanged, now with the transfer rung as a hard requirement.
2. **PM protocol:** scripted-primary + live-ceiling (review-inverted; recommended).
3. **Budget:** $18 / 8 probe-seeds (raised from v1's $15 to fund kill-needs-2-seeds).
4. **Naked-execution anchor at P2 once** (recommended; replaces v1's open item 4).
5. **P0-V external pass:** operator runs it through the review panel before probe 1
   (recommended; zero spend).

## 8. What v1's reviewers explicitly upheld

The engineering-over-judging direction; probes-as-eliminations (with the new decision
rules); the asset and discipline carry; P0 items 1/3/4/7 (as re-scoped); truth-visible close
as the highest-prior lever concept; the fc-over-attempted ban; the human-minutes denominator
rule; the stop-loss's existence; "only the sealed trial feeds a public claim" (with the
held-out evaluator condition).

## 9. Adjudication log (v1 → v2, 2026-07-13)

Two independent substantive external reviews were received (ChatGPT; a second review
delivered twice under different labels — treated as one). One additional model returned a
prompt echo with no findings. Convergent verdict: direction survives, v1 draft does not.
Accepted (all incorporated above): pairwise-neutralization axiom refuted for information-path
flaws → exposure notes (§0.1); evaluator capture → SHOWN/HELD-OUT partition + repair
classification + pre-run audits (§3 P1.1, §5); L1 circular scoring + compute confound →
split-oracle + budget-matched control (§3); single-seed keep/kill refuted with event-rate
math (truth-repair base rate ~9–11% ⇒ ~55% zero-event probability at one seed) →
matched-pairs unit, kill-needs-2, VOID rule, ambiguity-enriched seeds, detection floor (§3);
operator-as-PM double-sided contamination → role inversion, knowledge sheet, leak audit,
minutes sensitivity (§3 P1.4); P0 conflation → P0-V split, quarantine withdrawn for a lawful
park primitive, on-topic gate re-typed as lever + scoring category (§2); L5 tested nothing →
deferred/relabeled (§3); composition non-additivity → pre-declared rule + P1.3-before-P1.4
ordering + interaction probes (§4); §5/§6 primary contradiction → disposition-primary as
scalar paired predicate + freshness non-inferiority guard + declared metric switch (§5);
baseline undefined → probe base / P3 comparator / anchor defined (§5); P3 power → pairs-based
precommit + LOSO gate + honest "screen" fallback label (§5); refusal prior over-claimed →
prior ledger (§0); missing rungs → request-echo added, BP-scrutiny added WITH the coherence
correction (naive red-on-noop is impossible by design — the reviewers' "config flag" framing
was wrong in mechanism, right in intent); L1 kill-scope clause (§3); model-transfer rung
(§4); rung renaming (P1.x); PRD → evidence-status table + authoring-cost instrumentation
(§4); E5 governance identity (§1). Partially adopted: held-out OPERATION TEMPLATES for P3
(impractical at budget; the check-level partition + fresh seeds adopted; template-level
holdout recorded as a stretch goal). Rejected: none of substance.
