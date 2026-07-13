# E4 arc close-out — capstone, brittleness assessment, forensic adjudication (v1)

**Status: arc CLOSED at operator direction (2026-07-13), after the v3-M7 evidence run, four
external adversarial reviews of its report, two external root-cause forensic reports over its
transcripts, and a code-level verification of their disputed claims. Docs-only act; zero
spend; no code, constants, or sealed artifact touched. A v4 redesign is explicitly PARKED
(§6) — nothing in this document authorizes work.** Classification discipline: this document
makes no new evidence claims; every quantitative statement cites a sealed verdict, a
committed verification artifact, or a transcript-verified forensic finding, and post-hoc
material is labelled as such.

## 1. The question and the four boundaries

The program asked: does an executable-spec workflow keep a living specification truthful and
current better than plain prose upkeep, for frontier-class models on a real OpenSpec
workspace? Four sealed, pre-registered pilots answered under four different boundaries
(each row its own Level-4 claim; never pooled, never reconciled; table carried from the
v3-M7 run report §6, v1.1):

| Boundary | Gate | Config | Verdict |
| --- | --- | --- | --- |
| v2-M7 (deepseek-v4-pro) | naked execution | austere/thinking-off | GO via velocity contrasts; the false-confidence leg did not hold |
| v2-M8 (glm-5.2) | naked execution | realistic/thinking-on | NO-GO (both legs inverted) |
| v3-M6 (glm-5.2) | product loop, pre-naturalization | realistic/thinking-on | GO on honesty (reframed by its §10: the margin was closure composition), freshness inverted |
| v3-M7 (glm-5.2) | product loop, naturalized substrate, composition-proof primary | realistic/thinking-on | NO-GO: more counted drift with the close-rate guard holding; no detectable honesty difference |

## 2. What stands (robust findings)

These survive every audit round because arm-symmetric artifacts cannot manufacture them:

1. **The loop verifies self-consistency, not truth.** The sharpest single observation in the
   program (v3-M7 seed 140 task 2, transcript- and code-verified): a requested change
   implemented in *neither* spec *nor* code produces a workspace where every check the loop
   can run — scenario execution, spec↔code reconciliation, mutation floors, PM review —
   passes, because the two stale halves agree with each other. Coordinated staleness is the
   executable-spec loop's structural blind spot.
2. **"Lying" dissolves into honest-but-wrong.** Two independent forensic reports, sampling
   all matched false-close pairs with transcript quotes, tallied **zero** closes over visible
   contrary signals (their (b) class) across 26 sampled episodes; the probes' self-reports
   were accurate about internal consistency. The model closes truthfully against everything
   it can see; the contract drifts where nothing — request, brief, spec, or gate — pinned it.
   This retro-reads the earlier boundaries too: most of what M6-era numbers called lying was
   later attributed to undisclosed conventions
   (`docs/protocols/e4-v3-fc-convention-classification-20260712.json`).
3. **Gates change what gets committed and when tasks close — not truthfulness.** M6's
   honesty margin was entirely non-closure composition (its §10); M7 guarded composition and
   found honesty dead even (fc|done 0.417 vs 0.424; 13 both-false matched pairs vs 2+1
   discordant). Where the product gate's refusals actually fired, they were productive (5 of
   6 refusal-tasks closed truthfully — forensic finding); they fired on ~1 in 5 tasks.
4. **The methodology is itself a finding.** Seal → run → external adversarial audit →
   adjudicate caught, in order: a composition artifact that had produced a GO, a
   convention-trap family explaining most measured lying, a false disclosure explaining a
   third of measured drift, and the dominant-cause error in our own post-hoc story. No
   internal review caught any of these first.

## 3. What was artifact (quantified, all cited)

- **Undisclosed-convention traps:** fully explained 41/63 M6 false-confidence events and
  9/13 learning-run events (verification artifact, committed 2026-07-12).
- **A falsely disclosed contract:** the PM brief promised partial-update PATCH semantics;
  the sealed gold rejects partial bodies (code-verified; reviewer-verified live). 29
  checkpoint items per arm = 31% of ALL v3-M7 counted drift (47% under a broader
  classification) — symmetric, contrast-neutral, absolute-reading-voiding (report v1.1 §5.5).
- **A one-character output tic meeting a diagnostic hole:** glm-5.2 glues its first protocol
  delimiter to the preceding prose sentence; the parser silently ignores such lines (see
  §5.1), mislocating every error message. ≈85 wasted turns and all 3 non-closes in v3-M7
  (forensic finding, code-verified mechanism).
- **A rules trap on leftover state** (§5.3): after a stalled task, the next task cannot
  lawfully open a fresh change — absorbing the leftover is near-forced; with a vague request
  this produced the run's one silently-swapped task.
- **Granularity amplification:** one root cause registers as 6–11 counted items and can
  persist for a whole chain; seed 140 alone carried the headline: leave-one-seed-out shrinks
  the v3-M7 gap from ~2× to ~15% (report v1.1 §5.1).

## 4. Why the absolute-measurement program is structurally brittle

The operator's question — "are we just patching?" — answered honestly: for the absolute
numbers, yes, and no amount of patching converges.

1. **Disclosure closure is unfalsifiable.** A procedurally generated hidden answer key must
   pin choices a reasonable engineer could make either way (path spelling, stored-id policy
   on rename, field required-ness, update semantics, initial data…). Fair measurement
   requires every such knob to be disclosed or neutralized — and the knob set can only be
   enumerated by finding the next one. Four audit rounds each found a new family:
   pluralization → fixture regeneration (five facets) → PATCH semantics → id-stability on
   rename → ref-field required-ness. Each fix moved the boundary; nothing proves the list
   ends.
2. **The artifact floor exceeds the effect size.** Every evidence run's headline was
   materially reshaped by a post-hoc discovery (M6: feedback bug + composition; M7: glue
   stalls + rules trap + PATCH disclosure). Artifact magnitudes ran 31–65% of measured
   events and 2× swings; the surviving treatment effect is ~15% at n=6 seeds on one
   stochastic model whose conventions coin-flip across arms (required-ness flipped between
   arms on the same seed). Absolute claims from this instrument sit below its own noise
   floor.
3. **The metric treadmill.** Every fairness improvement (naturalization, composition
   guards, granularity fixes if attempted) is a compatibility-boundary move that voids
   comparison with prior runs — so the absolute numbers can never accumulate across
   boundaries; only within-boundary contrasts and mechanism findings survive.

The contrast-and-mechanism half of the program is NOT brittle: §2's findings were produced
*by* this architecture and are robust to everything §3 lists.

## 5. Forensic adjudication (two external reports vs the code)

Two independent root-cause reports (DeepSeek; a fresh Fable/codex session) were verified
against the harness source (read-only, 2026-07-13). Where they disagreed:

1. **The stall mechanism.** Confirmed: delimiters are recognized only at line start
   (`src/e1-l1-parser.ts:131-159` via the grammar at `src/e4/turns.ts:57-76`); a
   prose-glued opener is **silently ignored** (no feedback at all), so the model only ever
   saw errors pointing at the wrong line, and the one instructive template
   (`src/e4/turns.ts:279-283`) fires solely on zero-block turns — and never mentions ASK_PM.
   DeepSeek's "first-block parser bug" mechanism is refuted; Fable's model-tic +
   diagnostic-hole account is confirmed; DeepSeek's conclusion (harness-fixable) stands.
2. **ASK_PM salience.** DeepSeek's "buried affordance" is refuted: the bullet is the LAST
   base instruction (`src/e4/v2/orchestrator.ts:105`; mid-prompt only in the product arm,
   yet ask rates were identical across arms). The limiter is the policy Fable documented:
   one-shot at turn 1, parameter-scoped, never fired by plan-checkable knobs. DeepSeek's
   context-dilution hypothesis (H6) is also refuted: every task is a fresh conversation
   (`src/e4/v2/runner.ts:271-274`).
3. **The missed structural trap (found in this verification; neither report has it).**
   Custody requires **exactly one** change directory at spec exit
   (`src/e4/v2/gate.ts:269-274`) and the protocol has **no deletion primitive** (FILE is
   full-file write only). After task 1's stall left a change directory, task 2 could not
   lawfully open a clean change — completing or absorbing the leftover was near-forced. The
   "silently swapped task" is substantially rule-trapped; both reports' attention/
   assimilation accounts describe the surface of a constraint.
4. **Gate-forced contract rewrite — refuted.** Fable attributed seed-121 task-6's harmful
   scenario rewrite to the novelty floor; the novelty/red refusals are explicitly skipped on
   behavior-preserving tasks (`src/e4/v2/gate.ts:347-356, 403-414`). The agent rewrote the
   disclosed-contract scenario by choice; the gate ratified but did not compel it.
5. **PM review has no on-topic rule — confirmed** (`src/e4/v3/pm-review.ts:69-174`): it
   checks contradictions with request-determined facts, and brief-gated invented/missed
   rules; a change that ignores the current task entirely passes silently when no brief was
   delivered. This is the second half of the swapped-task mechanism.
6. Both reports' honest-close tallies ((a)/(b)/(c) with (b)=0) are accepted; DeepSeek's
   13/14 false-close counts are corrected to the sealed tool's 15/36 and 14/33 where cited.

## 6. The parked v4 sketch (recorded, NOT planned, nothing authorized)

If the program is ever resumed, the reviews converge on a redesign that asks a *new*
question with the brittleness lessons built in — each item its own gate act:

- **2×2 commitment-sheet design:** both arms emit an identical structured commitment sheet
  (fields, required-ness, id policy, data migration); execution only in the treatment arm.
  Separates "execution reveals mistakes" from "the loop changes what agents commit to".
- **Root-cause-level scoring** (cluster counted items by underlying divergence) in place of
  symptom counts; publishes both.
- **Auto-injected briefs** on every task (removes the ask-policy confound; ASK_PM becomes a
  measured behavior, not a validity condition).
- **Harness hygiene:** glue-aware feedback ("text precedes a delimiter on line N"), leftover
  quarantine at task boundaries with an explicit resume affordance, request-echo required at
  close, PM-review on-topic rule, truth-visibility variant (show the drift meter post-close
  as a feedback condition — which changes the question from measurement to intervention).

## 7. Claim-language guardrails for any public artifact

The v3-M7 report §8 (v1.1) rules apply verbatim, plus:

- Never "the model lies about being done." The supported sentence is: **"the model closes
  truthfully against everything it can see, while the contract drifts where nothing pinned
  it."**
- Any artifact-share figure (65% of M6 fc; 31–47% of M7 drift; ~15% leave-one-out) carries
  its citation; the benchmark-self-artifact caution is part of the story, not a footnote —
  it is, arguably, the most broadly useful export of the program: **anyone evaluating an
  agent workflow on a handful of demos is sampling a distribution whose single draws
  routinely contradict the six-scenario sealed answer, and anyone building an agent
  benchmark should assume their own conventions are the largest effect in it until proven
  otherwise.**
- Four boundaries, four separate Level-4 claims, one model per claim; no pooling, no
  "model class", no Level-5 phrasing; calibrations, dry runs, learning rungs, and the void
  run are never evidence.
- The public post remains a separate, operator-gated act.
