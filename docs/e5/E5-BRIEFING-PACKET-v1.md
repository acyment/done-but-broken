# Briefing packet for external reviewers

> **Status (added 2026-07-20, not part of the original packet): DRAFT, KNOWN ERRORS, UNDER
> REVISION.** At least one claim marked `[VERIFIED against code]` below (§"Two corrections to
> earlier accounts", item 1, on the black-4684 exclusion) is itself incorrect — it reads a
> screening file that belongs to a different experiment. See
> `docs/protocols/e2-black4684-exclusion-note-20260720.md` for the corrected, independently
> re-verified account. The packet body below is committed as-is (a dated draft) and has not been
> edited to fix this or any other error; do not cite it without cross-checking the note above.

**Subject.** An experimental program asking whether executable acceptance scenarios beat prose
specifications for AI coding agents working on an evolving codebase.

**Purpose.** To let reviewers who have never seen the code find the flaws. It is deliberately
unflattering. Where a result is weaker than its framing, that is said here.

**Provenance.** Merged from two independent accounts written by separate models with no shared
context, each working from the repository alone. Two of their findings were checked against the
code and corrected; those corrections are marked **[VERIFIED]**. Disagreements between the two
accounts that could not be resolved are recorded as open, not silently reconciled.

**Record date.** The repository as of 2026-07-20. The program is paused for budget.

---

# A1 — The claim

The claim the program wants to publish:

> Writing acceptance criteria as executable, Gherkin-style scenarios — and defining and running
> them in small increments — produces measurably better AI-agent work on an evolving codebase than
> spec-driven development that keeps the spec as prose, even when that prose spec is well-structured
> and scenario-shaped (as OpenSpec's is).

**Audience.** Engineering leaders — people deciding how to run coding agents in production. Not a
journal.

**Standard of proof.** Higher than an attractive demo, lower than publication. A pre-specified,
replayable comparison a skeptical engineering team could reproduce, reporting throughput and
authoring cost alongside "did it pass?". Journal-scale statistical power is not required; a decision
rule declared before the run, per-episode results, uncertainty reporting, and replayable artifacts
are.

## Separately falsifiable parts

**1. The two specifications can be made genuinely equivalent.** Both conditions must receive the
same requirements, examples, API details, and clarifications. Otherwise a win could be caused by a
clearer specification rather than by execution. Necessary but hard: "equally structured" is not a
measurable property until packet contents are frozen and audited.

**2. Executing the scenarios changes agent behavior.** With task, model, workspace, tool access,
retries, and work budget held equal, access to scenario results must improve a named outcome.
Falsifiable with a paired experiment. **Not** established by comparing an agent with a test runner
against one that cannot use a shell.

**3. The scenarios are a valid acceptance contract.** They must accept more than one correct
implementation, reject relevant wrong ones, and encode no hidden conventions absent from the
readable spec. Otherwise "better" means better at satisfying the experimenter's private
assumptions. **This is a precondition, not a benefit of execution.**

**4. Small increments add value beyond execution.** Two interventions, not one. A two-arm comparison
that changes both cannot identify either. Separating them needs four conditions: prose/large,
prose/small, executable/large, executable/small. **Never tested anywhere in this record, in either
direction.**

**5. The benefit survives an evolving codebase.** Requires carried-forward changes and scoring of
preserved prior behavior, not independent bug fixes. A single task cannot establish it.

**6. The gain is worth its cost.** "Better" could mean fewer incorrect done-claims, more correct end
states, fewer later regressions, or faster recovery. These are different outcomes and can move in
opposite directions. **Human time to author, review, and maintain the scenarios is part of the
product claim, not a footnote** — and is measured nowhere in this record.

**7. The effect is not peculiar to one model, scaffold, or generated toy application.** Falsifiable
only as a bounded replication claim. "Produces" smuggles in generality no finite study can prove.

## What is unfalsifiable as written

**"Measurably better" has no metric.** The program has used at least four primary outcomes across
its history — final checkpoint pass rate; regression-free path-survival area-under-curve; the rate
of declaring done while hidden tests fail; and carried specification-versus-reality discrepancies.
**Switching between them has flipped verdicts inside a single experiment.** Any publishable version
must name one primary outcome in advance.

**"Even when the prose spec is well-structured"** assumes equivalence without saying how to test it.

**"Gherkin" risks naming a syntax as the cause.** The causal object should be a readable, auditable
specification that can or cannot be executed — not a punctuation convention. Note also that the
current implementation renders `.feature` files as a byproduct and does not execute them; execution
runs through a parsed representation. As built, the word would be false.

## Assumptions the wording smuggles in

1. **A single dominant direction is presupposed.** The record contains a sealed, pre-registered
   comparison where the executable arm scored *worse* on its own primary measure (mean carried
   discrepancies 3.50 versus 1.69 for prose).
2. **"as OpenSpec's is" implies OpenSpec is the comparator's format.** The program's own written
   rules forbid OpenSpec as an arm or as a format contrast — it is a shared environment present
   identically in both arms. **The claim as phrased describes a comparison the program has ruled out
   running.**
3. **"AI-agent" is unquantified over models.** The record shows a model × task interaction, not an
   agent property: large on a cheap model on a small task; absent on strong models on small tasks;
   large again at brownfield scale on two frontier lineages; undetectable on the sequential
   substrate on one frontier model.
4. **"Produces" is causal language.** Exactly two runs in the record are classified as clean
   controlled comparisons, and both test execution against a control that could not run anything —
   not the claim above.

**A standing constraint.** The repository holds itself to a six-rung claim ladder ending at
"generalized claim." That top rung is explicitly disallowed by its own rules, and its operating
notes state: *"The project is not ready for public validation claims that executable feedback wins
for frontier models."* A post asserting the claim above would be a top-rung claim.

---

# A2 — The design as built

**There is no finished experiment matching the claim.** Two rigs exist; only the second targets it.
Conflating them overstates what has been tested.

## Rig 1 — single-task brownfield ablation (source of the published headline)

- **Substrate.** Real GitHub issues created *after* the model's training cutoff, touching ≥2
  non-test files, suites of 100–1500 tests, ≤2 per repository. Docker images with git history
  stripped to the base commit; no network at run time. Sealed list of 13 tasks; the headline uses 9.
- **Agent.** Same scaffold, same prompt, temperature 0, 60-iteration cap, identical retries both
  arms. Wrinkle: the evaluation image is Python 3.8 and the scaffold needs 3.12+, so **the agent ran
  on the host** against an exported checkout; the patch was scored inside the container.
- **The manipulated variable.** Treatment gets one extra tool: it takes the agent's current diff,
  applies it in a fresh container, runs a hidden acceptance subset, and returns per-check pass/fail
  with test identifiers — never expected values. **The control has no shell and cannot run anything
  at all**, including its own tests. Tool calls consume the treatment's iteration budget.
- **Primary outcome.** Rate of runs declaring "done" while hidden acceptance tests would fail.
  **Recorded caveat:** the field named "self-verification passed" is *set equal to* "declared done"
  in every agent — so it measures false confidence, **not** tautological self-testing. The
  repository forbids conflating the two.
- **Statistics.** 10 runs per arm per task; per-task one-sided permutation test; a "hit" requires
  *p* < 0.05 **and** effect ≥ 0.20; combined by a binomial family-wise tail. Pre-screens: a
  per-model memorization probe and 60-repetition flake certification per suite, quarantining flaky
  and fails-under-gold tests. Pre-registered asymmetry: a one-model positive may license proceeding;
  a one-model null may not license stopping.

This is a clean manipulation of access to an existing acceptance oracle. **It is not an authored-spec
experiment**, and its control is weaker than an agent that can write and run its own tests.

## Rig 2 — the sequential procedural rig (what actually targets the claim)

- **Substrate.** A procedurally generated REST service. From a numeric seed the harness builds a
  typed schema and draws six change operations: add/rename/retype/delete entity or field, change an
  endpoint's method, add a validation rule, change a stated convention, plus at least one
  behaviour-preserving step. Each renders as a short, deliberately business-natural request. Two
  real examples: *"Add a sku field to Widget so we can capture that detail."* and *"We're revising
  how the API communicates certain details to clients — bring it up to date."*
- **Ground truth.** The internal schema after each operation is the private answer key; HTTP-level
  acceptance tests are generated from it programmatically, with no model involved, and hidden. Task
  *k+1* starts from that arm's workspace after task *k*; one fork per arm; the same seed yields an
  identical sequence in both arms.
- **Shared environment, identical in every arm.** Both arms work in the same real OpenSpec workspace
  against a pinned CLI, maintain change directories, and the harness runs the same archive step in
  both. Both get smoke feedback (does the server boot). Both have a product-manager question channel
  returning the task's *determined* requirements; whether an agent uses it is itself recorded.
- **Both arms author scenarios**, in a sealed WHEN/THEN grammar with fixed vocabulary. Both clear
  identical floors: the spec must change, the validator must pass, every scenario must bind to the
  sealed step table and carry at least one value-binding assertion.
- **THE ONLY ARM DIFFERENCE: whether those scenarios execute.**
  - *Prose arm.* Scenarios never run; "done" accepted on the agent's word.
  - *Executed arm.* Before implementation the change must contain ≥1 **new** scenario that is **red**
    against current code; at the done-claim the full cumulative set must pass or "done" is refused
    with the failing titles.
  - *Product-loop arm.* The above plus mutation testing over the agent's own code, specification/code
    reconciliation, quality floors on new scenarios, and a scripted reviewer.
- **Held constant, machine-enforced.** A parity validator refuses to start unless task text, budgets,
  retry policy, and base system prompt are byte-identical across arms; the execution channel is the
  single allow-listed difference. Sealed budgets: 27 turns, 12 verifications, 490,000 tokens, $5 per
  six-task sequence, identical in every arm.
- **Measured harness-side, never shown to the agent.** A hidden oracle run once per task close; a
  **false-confidence event** is the agent's own gate accepting "done" while the oracle fails. A drift
  meter classifying discrepancies as contradiction / coverage gap / stale claim. Scenario strength,
  measured by running the agent's suite against deterministically mutated implementations — so a
  vacuous-but-passing suite shows up as a measured outcome.
- **Analysis unit.** Matched task pairs within a seed; seeds are replicates. Never pooled across
  substrate, meter, or constants version.

**Important:** the later versions of this rig did **not** isolate "executable scenario versus equally
rich prose." They bundled scenario execution with custody rules, reconciliation, mutation checks,
review logic, and a clarification channel — changing multiple information and enforcement channels at
once.

## The current probe layer — easy to describe wrongly

The most recent run was **not** an executable-versus-prose comparison. Both arms ran the identical
product loop. The manipulated variable was *information at the close*: after a task closed, the
treatment agent saw verdicts for half the hidden suite (partitioned by semantic family via a hash
rule, fixed per seed) and got one repair cycle of 4 turns and 2 smoke runs, code files only. The
control got a budget-matched cycle of identical shape with no oracle data. Scoring was on the
held-out half. A follow-up delivering the same verdicts *during* work is built, pre-registered,
seed-scanned — and **unrun**.

---

# A3 — The evidence ledger

Classifications are load-bearing. `calibration` = the plumbing works, non-evidence in any direction.
`difficulty_probe` = the task is easy or hard for this model, not whether the treatment works.
`causal_pilot` = a controlled two-arm comparison. `diagnostic_invalid` = broken, reported anyway.
"Structurally valid and replay-valid" does not make a run clean evidence.

| Run family and what it compared | Result | Classification and cost |
|---|---|---|
| Provider smokes and difficulty series | Several structurally replay-valid; runs with timeouts, malformed responses, or provider carry-forward were flagged. The final clean difficulty probe had both arms passing 9/9 — an easy-task result. | `diagnostic_invalid` smokes and `difficulty_probe`s. Provider-flagged runs are explicitly **not** clean primary evidence. |
| Subscription and inventory controlled pilots | All clean final outcomes flat: both arms 9/9. One had a positive secondary path-survival signal but a flat primary. | Three clean `causal_pilot`s, each task/model specific. Do not support the claim. |
| Small pricing task, cheap model | Executable specs beat prose (+0.4444 mean path-survival) — but the runnable specs also disclosed the event API and worked examples. After equalizing content, the loop still helped: **+0.1852**, positive in 3/3. | Clean `causal_pilot`s, cheap-model single-file boundary. Nearest positive evidence for a run loop; **not** frontier, brownfield, or authored-scenario. |
| Strong-model ceilings | Two frontier models solved pricing 9/9 in **both** arms; a denser task 18/18 in both. One attempt died on a credit error. | `difficulty_probe` / `diagnostic_invalid`. Closed finding: **on small, fully specified tasks, frontier models self-verify well enough that executable feedback is redundant.** A proposed fifth task was killed pre-build by a five-model red team: unambiguous + fair implies self-verifiable. |
| Earlier frontier probes (dispatch, billing) | Mostly ceilinged with zero on-graph regressions. One three-pair stage showed a +0.1464 feedback signal, which its own summary calls calibration-grade. One run had heavy output truncation; a later version fixed it and still ceilinged. | Mostly `difficulty_probe`. The frontier line was closed because small, fully specified tasks were self-verifiable. Known costs: $4.24, $9.08, $3.28, $0.74 (redundant invalid rerun). |
| **Brownfield acceptance-feedback pilots** — 9 tasks × 10 rollouts/arm/task | Model A: done-but-broken **79% → 13%**; fix rate 19% → 38%; 8/9 tasks significant, family-wise *p* ≈ 3.4×10⁻¹⁰. Model B: **50% → 0%**; fix rate flat (37% → 36%); 5/9 significant. Two production CLIs were single-condition corroboration, **not** a controlled arm. | Two `causal_pilot`s, bounded to one Python substrate, one scaffold, one budget, and **a no-execution control**. They test pre-existing acceptance tests, **not authored executable scenarios**. |
| Authored-spec offline pilot | The OpenSpec → Gherkin → pytest-bdd pipeline works; blind, gold-passing, discriminating checks emerged repeatedly. But **no task reached full eligibility**, so the pre-registered rule forbade sealing the main study. | `calibration`, zero agent-under-test rollouts. **Direct evidence that authoring a fair acceptance suite is a bottleneck.** |
| Self-test tautology probe, 72 rollouts | **0 events.** Not one agent-written test wrongly passed failing code. The real failure was declaring done *over their own red results*. | Null that "kills a claim we might otherwise have built on." ~$1–2. |
| Sequential brownfield regressions | First calibration **closed null: 0 true regressions in every rollout** across three certified episodes. A gold-prior-steps probe proved the scorer correct — the episodes were structurally regression-resistant. | Calibration and build work. **No two-arm trial was ever run.** |
| **Drift-velocity program**, four sealed boundaries | See detail below. Two GO, two NO-GO, never pooled, never reconciled, all single-model. **The final evidence run returned NO-GO.** | All `pilot`. ~$36 total. **Program closed, not as a success.** |
| Current probe, one seed | Convertible pairs 5 of 6; treatment conversions **0**; control conversions **0**; paired advantage **0** — because the lever got **zero exposure**. | `calibration`, non-evidence. Status **UNDETERMINED** — not null, not kill, not keep. $4.60. |

## The drift-velocity program in detail

| Boundary | Treatment | Verdict | Spend |
|---|---|---|---|
| First | executed scenarios | **GO** on velocity — but the executed arm's own gate still accepted "done" over a failing hidden oracle on **7 of 12 tasks** | $0.94 |
| Second | executed scenarios | **NO-GO, both legs inverted.** Executed-arm false confidence **total: 12 of 12**. The prose arm ended closer to truth | $2.84 |
| Third | product loop | **GO** on false confidence only; freshness ran the opposite way | $19.83 |
| Fourth | product loop, composition guard | **NO-GO** | $8.54 |

**Why the third boundary's GO is not a win — its own report says so.** *"The loop did not make the
model more truthful — it made false done-claims harder to finish."* Of 18 matched pairs where the
product arm closed: **18 concordant, 0 discordant** — it lied exactly when prose lied. **The entire
margin is composition**: 12 product-arm tasks never closed. Restricting to closed tasks **reverses**
the freshness inversion. Seed-level sign test at n=5: *p* = 0.125. A harness defect found afterwards:
the validator printed errors to stderr while the harness relayed only stdout, so **agents saw empty
error messages**. Two of three product-gate components **never refused anything**. On the hardest
chains the product arm's final correctness fell **below** the arms it was meant to beat. Spend
overran its own estimate ($19.83 versus $9–16).

**The final evidence run.** Six seeds × six tasks × two arms, zero deviations from the seal, all
sequences complete and replay-valid.
- **Primary measure inverted.** Mean carried discrepancies **3.50** (product loop) versus **1.69**
  (prose) — the loop kept documentation *less* accurate, with the close-rate guard holding.
- **Honesty at close: no detectable difference.** 0.424 versus 0.417. Of 33 matched both-closed
  pairs: 17 concordant honest, **13 false in both arms**, 2 prose-only, 1 product-only. The report
  insists this is descriptive: "no effect was detected," never "the arms are equal."
- A pre-registered prediction failed for the first time: prose ran one seed with **zero drift end to
  end**.

**What the program found wrong with its own run** (four external adversarial reviews, two forensic
passes, one code-level verification; all four reviews reproduced every headline number and upheld
the NO-GO):
- **A falsely disclosed contract.** The product-manager brief promised partial-update semantics; the
  reference server rejects partial bodies regardless. **31% of all counted drift.** Symmetric, so it
  does not tilt the contrast, but it **voids any absolute reading** of the drift numbers.
- **One seed dominates.** Leave-one-seed-out shrinks the 2× gap to ~15%.
- **The program's own post-hoc story was refuted and retracted.** The flagship claim ("executable
  specs make misunderstanding visible; prose hides it") was refuted against the records — on the
  cited seed prose was explicit *and correct* and the product arm was wrong.
- **The sharpest finding, and it is bad for the thesis:** on one task a requested change was
  implemented in **neither spec nor code**, and closed "done" over a 12-of-26 oracle — because spec
  and code were *stale in the same way and therefore agreed*. Every check the loop can run passed.
  **The executable-spec loop verifies self-consistency, not truth.**
- Forensics over all matched false-close pairs found **zero** closes over visible contrary signals
  across 26 sampled episodes. The supported sentence is: *"the model closes truthfully against
  everything it can see, while the contract drifts where nothing pinned it."* **Not "the model
  lies."**
- A one-character output tic met a parser that silently ignores such lines: **≈85 wasted turns and
  all 3 stalls.**
- A learning ladder later concluded the third boundary's verdict structure is **"likely close to
  backwards of the post-fix reality"**, and that post-fix false confidence was driven almost entirely
  by an ambiguity channel whose largest contributor was a naive-pluralization convention punishing
  natural English. The log records the objection against itself: *"a skeptical reviewer will call
  this gotcha design."* And flatly: **"Honesty-at-close currently measures 'does the agent ask the
  PM,' not 'does the gate catch bugs.'"**

**The program's verdict on its own instrument.** The close-out answers "are we just patching?" with
*for the absolute numbers, yes, and no amount of patching converges.* Three reasons: disclosure
closure is unfalsifiable (four audit rounds each found a new family of pinned choices a reasonable
engineer could make either way); **the artifact floor exceeds the effect size** (artifacts ran 31–65%
of measured events and produced 2× swings, while the surviving treatment effect is ~15% on 6 seeds of
one stochastic model); and every fairness fix voids comparison with prior runs.

## Weaknesses of the headline result, as its own documents record them

- The control **cannot run anything**. This is acceptance-execution versus no-execution, not versus
  an agent running its own tests. The paper says the effect "should be read against that weak
  control."
- **Neither headline run is patch-replay-valid.** Patch text and session traces were not retained and
  the workspaces were deleted, so independent re-scoring is impossible. Both since fixed.
- n = 9 of 13. **Four large repositories carry a navigation confound** and are excluded: without a
  shell the control cannot explore them, so its disadvantage there is partly "can't navigate."
- The tool returns **named** check identities — localization information the control cannot get. The
  follow-up concedes it bundles verification *and* localization; the anonymized variant is designed
  and unrun.
- **The contamination screen has admitted holes:** a degenerate negative control forcing a hard-floored
  threshold; a secondary scorer that under-flags; several tasks cleared on the weaker signal alone.
  One earlier directional hint was retired because it "rode on a memorized repo."
- The production-CLI probe differs in model, scaffold, *and* tooling simultaneously.
- An earlier go/no-go gate was found **structurally invalid** by a four-model critique before it ran:
  under a real substantial effect it would fire ~4% of the time. Root cause: no null model. Removed.

## Two corrections to earlier accounts **[VERIFIED against code]**

**1. The "contaminated" artifact.** The harness repository contains a file named
`...CONTAMINATED-do-not-cite.json` carrying the same run identifier as the published pilot, over 10
tasks rather than 9, and reporting a **stronger** result (9/10 hits, *p* ≈ 1.9×10⁻¹¹). One
independent account flagged this as undocumented and inferred a navigation confound. **That inference
is wrong.** The extra task is recorded `qualified: false` in **both** pool-screen artifacts, failing
the reproduction and wiring checks — it never belonged in the pool. The exclusion was principled and
**cost the program statistical power**, since the version including it was stronger. The defect is
documentation: nothing links the file to the screen record, and the filename says "contaminated"
where the screen actually recorded a qualification failure. Those are not the same thing.

**2. The negative preliminary results are not evidence against the thesis.** A pre-registered decision
rule exists for the fair contrast — prose spec **with a shell and its own tests** versus executable
spec — and it contains a genuine kill row: *"**Do NOT build** the executable-spec value proposition.
(Operator-confirmed real stop.)"* Two preliminary runs returned `proceed: false`. **But those runs had
no treatment arm at all.** They were baseline-only checks on a **single task**, six runs each, asking
whether anyone ever declares done while broken — if nobody does, there is no gap to close and the
comparison cannot work at any sample size. The pre-registration assigns this outcome to a *different*
row, reading *"**No decision** — not evidence for or against. Reselect harder tasks."* The program did
exactly that, screening a thousand candidates and building a new pool the next day. **Arithmetic
trap:** at n=6 the achievable rates are 0, 0.167, 0.333… against a 0.20 bar, so the single observed
event **could not have cleared it regardless**.

**What survives, and matters.** The frontier model solved all six with **zero** instances of declaring
done while broken — a self-testing frontier control had nothing for the tool to fix. That is
directionally what the kill row describes, and the program's own fallback document says so: the
operator's stated intuition is that the effect *"may collapse, most plausibly: fair controls that
self-test close the gap, as the frontier calibration already showed."* **The kill row remains
untested — the two-arm fair contrast has never run.** The program's own note flags that the current
bar *"may reject true 5–15% effects"* for strong models.

## The pattern

**Adjacent evidence cannot be substituted for the desired evidence.** The headline shows a large
benefit from running existing hidden acceptance tests against a no-execution control. The sequential
program shows an agent-authored executable scenario set can be green while both code and
specification are wrong, and that several apparent effects changed after audit. The authored-spec
pipeline has not produced an eligible task set. The current program has run neither its during-work
comparison nor its prose comparison.

---

# A4 — The constraints

**Budget.** A hard stop-loss of **$18 or 8 probe-seeds, whichever comes first**, with **$4.60 spent**.
Paused for budget; further runs need fresh explicit authorization; the next probe is ~$3 per seed.

**Spend is partially recorded and no program-wide total exists.** The sequential-rig figures are
fully recorded and sum to roughly $36. The two independent accounts of this record produced
**different partial subtotals** ($36 versus $47.15) depending on which run families they included;
neither could produce a program total, and **no audited cross-program ledger exists**. For the
brownfield line — the published headline — **no per-run dollar cost was recorded for either pilot**:
the cost field is zero in all 243 records of one and absent from all 180 of the other. The only
measured figure is a 20-rollout cost probe, from which the full pilot was *estimated* at a $24 floor
and $70–150 realistically. **State the program total as unknown.**

**Cost is not why the results are weak; sample size is.** The last run's own advisory fired:
between-seed variance ratio > 3×, "any full-scale run needs more seeds."

**Models.** One mid-tier model with reasoning on is the workhorse for the sequential rig and current
program; the record also shows two DeepSeek tiers, two Qwen tiers, a Mistral small model, two frontier
models used for ceiling smokes, and two production CLIs in a corroboration role. **Every sequential
evidence claim rests on one model per boundary.** The current design concedes its mitigations are
shaped by one model's quirks and makes a cross-model transfer step a hard requirement later.
Availability of a configured route is not evidence of remaining paid capacity — an account-balance
failure and several provider timeouts are recorded.

**Team.** Effectively one person; all commits in the record repository are by a single author.
Implementation is done by AI agents under written operating rules; **the review function is performed
by panels of other models** — four on the last evidence run, seven on a rig-repair package, five on an
earlier task design. No independent human reviewer, no replication by another team, no institutional
oversight. To its credit the program says so: the close-out records that **no internal review caught
any of the four major artifacts first** — every one was found by an external panel or a forensic pass.

**Tooling that exists and is reusable.** A TypeScript/Bun harness of ~90 source modules and ~850
tests: procedural substrate generator; drift meter; scenario grammar, binder, and hermetic executor;
mutation harness and adversarial bank; OpenSpec integration against a pinned CLI; sealed-constants
files with per-module hash pinning; manifest and replay inspectors. A separate Python/Docker harness
serves the brownfield line. **A working literal-Gherkin runner exists** — real `.feature` files
executed by pytest-bdd through step definitions, vendored into containers with no network, validated
end-to-end on a real repository — but it has never been connected to a sequential or coupled episode.
It is research tooling, not a hardened evaluation platform.

**Time.** The record repository begins 2026-06-05; this packet is dated 2026-07-20 — about six and a
half weeks. The pace is itself a constraint: the entire drift-velocity program was designed, built,
run to four sealed boundaries, externally reviewed, forensically audited, and closed **between
2026-07-08 and 2026-07-13 — six days.** Reviewers should weigh how much design deliberation is
possible at that cadence — while noting the close-out attributes its recurring problem to a
structural property of the substrate, not to haste.

**A standing publication constraint.** The rules require every public statement to name the run's
classification, and forbid: calling calibration or probe runs causal evidence; calling
provider-flagged runs clean; pooling incompatible runs; hiding flat or invalid results. The last
evidence run's guardrails additionally prohibit the sentence "the model lies about being done."

---

# Uncertainties

1. **No experiment in this record tests the claim as written.** Two independent accounts reached this
   conclusion separately, from the repository alone. The nearest fair comparison — executable
   scenarios versus the *same* scenarios left unexecuted, on an evolving codebase — has produced a
   broken pilot, a marginal go, a no-go, a reframed go, and a second no-go. Never a positive on the
   primary. **No run manipulates increment size at all**, so that part of the claim has no evidence
   in either direction.
2. **Dollar cost of the two headline pilots is recorded nowhere.** Verified against raw artifacts.
   Any cost-per-result statement about the headline is an estimate. The two independent accounts
   disagree on program subtotals; no total is supportable.
3. **The sequential brownfield line's status after 2026-07-06 could not be determined.** The
   calibration artifact is `in_progress` with eleven successive re-launch logs, no successor run, no
   run card, and no tracked document narrating an outcome. **A partial result exists on disk and is
   written up nowhere:** 13 of 15 rollouts, with one episode showing true regressions in 3 of 5
   rollouts and two episodes showing zero across 8.
4. **Two accounts disagree on run classification vocabulary.** The drift-velocity reports label their
   main runs `pilot`, while the repository-wide vocabulary elsewhere uses calibration /
   difficulty_probe / causal_pilot / diagnostic_invalid. This packet preserves the original label
   rather than reclassifying. The gap is real and unresolved.
5. **Provenance of the per-task oracle.** In the last run's manifests, four of six tasks recorded zero
   *new* hidden checks — including an add-a-field task; correctness was scored cumulatively. Whether
   this is intended or a coverage gap in the test generator could not be determined, and no document
   addresses it.
6. **An identical task request appeared twice in one six-task sequence.** The generator permits
   repeats; no note says whether a verbatim repeat is intended.
7. **Three conflicting readings of the same probe result coexist.** The template classes the seed as
   "points at kill"; the readout argues it is "close to the void spirit" because the lever got zero
   exposure; the final status is "undetermined." All three are defensible under the written rules,
   which suggests the keep/kill/void template does not cleanly partition outcomes.
8. **Whether the sequential rig can ever separate two competing explanations** for the executed arm's
   higher measured drift. The report offers "the novelty floor forces it to author more precise
   claims, enlarging its countable surface" (97 items versus prose's 32) and states that whether its
   *understanding* is also worse "is NOT separable in this design." A discriminating design is
   proposed but unbuilt.
9. **How much human effort authoring and maintaining fair executable scenarios requires.** The record
   has no comparable human-time dataset, while the authored-spec pilot exposes real fidelity problems.
   This is part of the product claim and is measured nowhere.
10. **The off-topic-close classifier has been rewritten twice** after a single live exposure, and the
    version that would run next has never been exercised on real data. Any table it produces should be
    treated as unvalidated.
11. **Whether the substrate is fair is, by the program's own analysis, open and possibly
    unanswerable.** Four audit rounds each found a new family of choices the hidden answer key pins
    that a reasonable engineer could make either way. Twelve such knobs are now deliberately left
    ambiguous as measurement material. Reviewers may reasonably disagree with that call.
12. **Two working-tree documents dated 2026-07-20 were excluded from the source accounts by
    instruction.** Both are untracked, so any work they describe is outside the committed record.
