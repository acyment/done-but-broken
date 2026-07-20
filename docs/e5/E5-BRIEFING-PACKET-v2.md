# Briefing packet for external reviewers — v2

> **Supersedes `E5-BRIEFING-PACKET-v1.md`, which is retained unedited as a dated draft with known
> errors.** v1 was assembled by a party involved in designing the program described. A blind audit
> found that **every one of its compressions ran in the same direction** — numbers quantifying how
> badly the treatment lost, classifications marking runs broken or void, table columns exposing
> small sample sizes and a model swap, and the program's own worry about its own motives. Nothing
> favourable was cut. v1 also contained a claim stamped "verified against code" that was **wrong,
> and wrong in the program's favour**. v2 restores what v1 removed and corrects that claim. It is
> longer and less flattering than v1. That is the intended direction.

**Subject.** An experimental program asking whether executable acceptance scenarios beat prose
specifications for AI coding agents working on an evolving codebase.

**Purpose.** To let reviewers who have never seen the code find the flaws. It is deliberately
unflattering. Where a result is weaker than its framing, that is said here.

**Provenance.** Merged from two independent accounts written by separate models with no shared
context, each working from the repository alone, then audited by a third that had seen neither the
merge process nor this conversation. Disagreements between accounts are recorded as open, not
silently reconciled. Facts checked directly against code are marked **[CHECKED]**; note that one v1
claim carried that mark and was still wrong, so the mark means "someone looked," not "settled."

**Record date.** The repository as of 2026-07-20. The program is paused for budget.

> ## Known-error register (append-only)
>
> A second blind audit of this version found **three of its seven `[CHECKED]` facts were false** —
> the same failure mode as v1, under the same mark. Recorded here rather than silently fixed.
>
> | # | Claim | Reality | Direction |
> |---|---|---|---|
> | E1 | "neither repository has a git remote" | Both have had GitHub remotes since 2026-06-30 / 07-08. The preservation failure was unforced. | **Favourable** — supplied a structural excuse |
> | E2 | Four excluded repos have "zero records anywhere" | Three have complete 10+10 record sets in the published second-model artifact; one (`attrs-1448`) is a significant hit (effect 0.6, *p*=0.0052). See E4. | **Favourable** — contained the exclusion anomaly to one task |
> | E3 | "no commit between 2026-07-01 and 07-07" | Commits exist on 07-02, 07-03, 07-04. The real gap is 07-05→07-07, and the source said "for that module." | Unfavourable — overstated the problem |
>
> **E4 — surfaced by the audit, not previously in any account.** The published headline's *n*=9 is
> presented as prospective design. For the second model it was **post-hoc subsetting of fully
> collected data.** The artifact carries two analyses side by side: `analysis_all_valid` (12 tasks,
> 6 hits, *p* ≈ 1.11×10⁻⁵) and `analysis_n9` (9 tasks, 5 hits, *p* ≈ 3.32×10⁻⁵). **The published
> figure is the weaker one**, so this is not power-maximising selection — but it is post-hoc
> subsetting described as prospective, and reviewers are entitled to know.
>
> **The audit's structural finding.** v2's one-directional skew was broken (16 favourable
> differences versus 23 unfavourable, against v1's uniform one direction), but the *newly
> introduced* verified facts still ran 2:1 favourable, and the prominent header confession sat
> immediately adjacent to E1 — admitting the artifacts were untracked while, in the same sentence,
> supplying a false reason why it could not have been otherwise. **Loud confession adjacent to
> quiet excuse.** Reviewers should treat every `[CHECKED]` mark in this document as "someone
> looked," not "settled," and should assume further errors of this shape remain.
>
> Also still missing from v2, restored in neither version: both verbatim substrate task prompts
> (deleted, which makes substrate fairness unauditable by a reviewer), and the finding that one
> boundary's effects were "concentrated in the three seeds that drew rename cascades."
>
> **Authorship note.** v1 and v2 were both written by a party involved in designing the program.
> Three consecutive rounds produced errors under the verification mark, twice favourable. Any v3
> should be authored by someone uninvolved.

---

# A1 — The claim

> Writing acceptance criteria as executable, Gherkin-style scenarios — and defining and running
> them in small increments — produces measurably better AI-agent work on an evolving codebase than
> spec-driven development that keeps the spec as prose, even when that prose spec is well-structured
> and scenario-shaped (as OpenSpec's is).

**Audience.** Engineering leaders on **LinkedIn**. Not a journal. The intended output is a public
post, and reviewers should weigh it as such.

**Standard of proof.** Higher than an attractive demo, lower than publication. A pre-specified,
replayable comparison a skeptical engineering team could reproduce, reporting throughput and
authoring cost alongside "did it pass?". Journal-scale power is not required; a decision rule
declared before the run, per-episode results, uncertainty reporting, and replayable artifacts are.

## Separately falsifiable parts

**1. The two specifications can be made genuinely equivalent.** Both conditions must receive the
same requirements, examples, API details, and clarifications, or a win could be caused by a clearer
spec rather than by execution. "Equally structured" is not measurable until packet contents are
frozen and audited.

**2. Executing the scenarios changes agent behavior.** With task, model, workspace, tool access,
retries, and budget held equal, access to scenario results must improve a named outcome. Falsifiable
with a paired experiment. **Not** established by comparing an agent with a test runner against one
that cannot use a shell. *Record: this is the only component ever isolated cleanly here.*

**3. The scenarios are a valid acceptance contract.** They must accept more than one correct
implementation, reject relevant wrong ones, and encode no hidden conventions absent from the readable
spec. Otherwise "better" means better at satisfying the experimenter's private assumptions. **A
precondition, not a benefit of execution.**

**4. Small increments add value beyond execution.** Two interventions, not one. Separating them needs
four conditions: prose/large, prose/small, executable/large, executable/small. **Never tested
anywhere in this record, in either direction.**

**5. The benefit survives an evolving codebase.** Requires carried-forward changes and scoring of
preserved prior behavior. *Record: every sequential program here has returned inconclusive, null, or
inverted.*

**6. The gain is worth its cost.** "Better" could mean fewer incorrect done-claims, more correct end
states, fewer later regressions, or faster recovery — different outcomes that can move in opposite
directions. **Human time to author, review, and maintain the scenarios is part of the product claim,
not a footnote**, and is measured nowhere.

**7. The effect is not peculiar to one model, scaffold, or generated toy application.** Falsifiable
only as a bounded replication claim. "Produces" smuggles in generality no finite study can prove.

## What is unfalsifiable as written

**The "and" is fatal.** The claim conjoins execution and small increments. **No single experiment can
falsify it** — a null can always be blamed on the untested half. As written it is unkillable, which
is a defect, not a strength.

**"Measurably better" has no metric.** The program has used at least four primary outcomes — final
checkpoint pass rate; regression-free path-survival area-under-curve; the rate of declaring done
while hidden tests fail; and carried spec-versus-reality discrepancies. **Switching between them has
flipped verdicts inside a single experiment.** Any publishable version must name one in advance.

**"Even when the prose spec is well-structured"** assumes equivalence without saying how to test it.

**"Gherkin" risks naming a syntax as the cause.** The causal object should be a readable, auditable
specification that can or cannot be executed. **[CHECKED]** The current sequential implementation
renders `.feature` files as a byproduct and never executes them — execution runs through a parsed
representation, and the byproduct is "never parsed back" (`src/e4/v2/workspace.ts:214`). **As built,
the word "Gherkin" in a public post would be false.** A working literal-Gherkin runner does exist in
a sibling experiment but has never been connected to a sequential or coupled episode.

## Assumptions the wording smuggles in

1. **A single dominant direction is presupposed.** A sealed, pre-registered comparison exists where
   the executable arm scored *worse* on its own primary measure (mean carried discrepancies 3.50
   versus 1.69 for prose).
2. **"as OpenSpec's is" implies OpenSpec is the comparator's format.** The program's own rules forbid
   OpenSpec as an arm or format contrast — it is a shared environment present identically in both
   arms. **The claim as phrased describes a comparison the program has ruled out running.**
3. **"AI-agent" is unquantified over models.** The record shows a model × task interaction, not an
   agent property.
4. **"Produces" is causal language.** Eight runs are classified as clean controlled comparisons
   (three subscription/inventory, three pricing, two brownfield). **Six of the eight returned flat
   or cheap-model-bounded results**; the two that produced the headline test execution against a
   control that could not run anything. *(v1 and v2 both said "exactly two." That was wrong, and it
   ran against the program by understating how much controlled work exists — corrected 2026-07-20.)*

**A standing constraint.** The repository holds itself to a six-rung claim ladder ending at
"generalized claim." That top rung is explicitly disallowed by its own rules, and its operating notes
state: *"The project is not ready for public validation claims that executable feedback wins for
frontier models."* **A LinkedIn post asserting the claim above would be a top-rung claim.**

## The program's own worry about its motives — restored from v1

A pre-registered decision rule for the fair contrast opens by naming the charge it was written
against: that the program *"risks being **positioning research** — an experiment whose every outcome
ends in 'build the product anyway'."* (`docs/protocols/e2-executable-spec-decision-rule-v1.md:9`)

**[CHECKED]** That table has four rows. **Two say Build.** One of the two pre-commits a
"guardrails, not frontier correctness" pitch **specifically for the outcome where the frontier result
ties**. One says No decision. One says Do NOT build. v1 of this packet quoted only the kill row, as
evidence of good faith. Reviewers should read all four.

---

# A2 — The design as built

**There is no finished experiment matching the claim.** At least four distinct rigs appear in the
record. Conflating them overstates what has been tested.

## Rig A — small fully-specified tasks (the earliest line, now closed)

Both conditions get the same visible semantic specification and the same turn budget. The
executable-feedback condition alone receives runnable feedback assets and a command; the prose
condition may take a self-review turn but **must not see feedback output, commands, or asset paths**.
Work carries forward across checkpoints in separate workspaces; hidden checks score each checkpoint.
This is a direct test of feedback availability, not of Gherkin versus prose. **This line was closed**
after four frontier ceilings produced the finding that on small, fully specified tasks frontier models
self-verify well enough that executable feedback is redundant.

## Rig B — single-task brownfield ablation (source of the published headline)

- **Substrate.** Real GitHub issues from **SWE-bench Live**, created *after* the model's training
  cutoff, touching ≥2 non-test files, suites of 100–1500 tests, ≤2 per repository. Docker images with
  git history stripped to the base commit; no network at run time. Sealed list of 13 tasks; the
  headline uses 9.
- **Agent.** **OpenHands**, same prompt, temperature 0, 60-iteration cap, identical retries both arms.
  Wrinkle: the evaluation image is Python 3.8 and the scaffold needs 3.12+, so **the agent ran on the
  host** against an exported checkout; the patch was scored inside the container.
- **The manipulated variable.** Treatment gets one extra tool: it applies the agent's current diff in
  a fresh container, runs a hidden acceptance subset, and returns per-check pass/fail with test
  identifiers — never expected values. **The control has no shell and cannot run anything at all**,
  including its own tests. Tool calls consume the treatment's iteration budget.
- **Primary outcome.** Rate of runs declaring "done" while hidden acceptance tests would fail.
  **Recorded caveat:** the field named "self-verification passed" is *set equal to* "declared done" in
  every agent — so it measures false confidence, **not** tautological self-testing. The repository
  forbids conflating the two.
- **Statistics.** 10 runs per arm per task; per-task one-sided permutation test; a "hit" requires
  *p* < 0.05 **and** effect ≥ 0.20; combined by binomial family-wise tail. Pre-screens: a per-model
  memorization probe (Zen-of-Python positive control) and 60-repetition flake certification per suite.
  Pre-registered asymmetry: a one-model positive may license proceeding; a one-model null may not
  license stopping.

## Rig C — sequential brownfield regressions

Real multi-change episodes built from merged pull-request chains, scored for **true regressions**
(behavior that passed after step *i-1* and fails after step *i*) as distinct from unresolved carried
work. Both arms get shell and public tests. **Never ran a two-arm trial.**

## Rig D — the sequential procedural rig (what actually targets the claim)

- **Substrate.** A procedurally generated REST service. From a numeric seed the harness builds a typed
  schema and draws six change operations: add/rename/retype/delete entity or field, change an
  endpoint's method, add a validation rule, change a stated convention, plus at least one
  behaviour-preserving step. Each renders as a short, deliberately business-natural request.
- **Ground truth.** The internal schema after each operation is the private answer key; HTTP-level
  acceptance tests are generated from it programmatically, no model involved, and hidden.
- **Shared environment.** Both arms work in the same real OpenSpec workspace against a pinned CLI. Both
  get smoke feedback. Both have a product-manager question channel returning the task's *determined*
  requirements.
- **Both arms author scenarios**, in a sealed WHEN/THEN grammar with a **fixed six-primitive
  vocabulary**: send GET/POST/PUT/PATCH/DELETE with an inline JSON body; assert exact status; assert a
  field equals a JSON literal; assert list length; assert a field absent; remember a field. *Reviewers
  should weigh whether this is Gherkin BDD or an HTTP assertion mini-language, and whether the claim's
  construct is what was manipulated.*
- **THE ONLY ARM DIFFERENCE: whether those scenarios execute.**
  - *Prose arm.* Scenarios never run; "done" accepted on the agent's word.
  - *Executed arm.* Before implementation the change must contain ≥1 **new** scenario that is **red**
    against current code; at the done-claim the full cumulative set must pass or "done" is refused.
  - *Product-loop arm.* The above plus mutation testing over the agent's own code, spec/code
    reconciliation, quality floors, and a scripted reviewer. **This arm changes multiple information
    and enforcement channels at once and does not isolate execution.**
- **Held constant, machine-enforced.** A parity validator refuses to start unless task text, budgets,
  retry policy, and base system prompt are byte-identical. Sealed budgets: 27 turns, 12 verifications,
  490,000 tokens, $5 per six-task sequence.
- **Measured harness-side, never shown to the agent.** A hidden oracle per task close; a
  false-confidence event is the agent's own gate accepting "done" while the oracle fails. A drift
  meter running the agent's spec scenarios against a gold implementation and comparing code surface to
  ground truth, classifying discrepancies as contradiction / coverage gap / stale claim. **Burden** =
  open discrepancies at a checkpoint; **velocity** = new discrepancy episodes per drift-opportunity
  task. Scenario strength, measured against deterministically mutated implementations, **never fed
  back** — so a vacuous-but-passing suite shows up as a measured outcome.

### A structural bias against the treatment arm — restored from v1

An escalation note names the threat underlying the sequential results: **on changes with no external
visibility the executed arm has nothing it can legally write to exit the spec phase, and burns budget
to exhaustion while the prose arm sails through** — *"a structural arm-differential censoring
channel."*

This is not hypothetical. The substrate **guarantees at least one behaviour-preserving step per
six-task sequence**, and the executed arm's entry condition requires a *new, currently-red* scenario.
Reviewers should assess how much of the sequential results is this mechanism rather than any
property of executable specs.

## The current probe layer — easy to describe wrongly

The most recent run was **not** an executable-versus-prose comparison. Both arms ran the identical
product loop. The manipulated variable was *information at the close*: after a task closed, the
treatment agent saw verdicts for half the hidden suite and got one repair cycle of 4 turns and 2 smoke
runs. The control got a budget-matched cycle with no oracle data. Scoring was on the held-out half. A
follow-up delivering the same verdicts *during* work is built, pre-registered, seed-scanned — and
**unrun**.

---

# A3 — The evidence ledger

Classifications are load-bearing. `calibration` = plumbing works, non-evidence in any direction.
`difficulty_probe` = the task is easy or hard for this model. `causal_pilot` = a controlled two-arm
comparison. `diagnostic_invalid` = broken, reported anyway. `inconclusive_uninterpretable` = the
pilot broke and is not reported as having measured. **void** = the run was destroyed; no number from
it may be cited, pooled, or allowed to influence any later analysis choice. "Structurally valid and
replay-valid" does not make a run clean evidence.

## The published headline — single-task brownfield

| Model | Result | Classification |
|---|---|---|
| deepseek-v4-pro, n=9 | done-but-broken 70/89 = **79% → 12/90 = 13%**; fix rate 19% → 38%; 8/9 tasks significant, family-wise *p* ≈ 3.4×10⁻¹⁰ | `causal_pilot`, candidate frontier-positive |
| qwen3.7-max, n=9 | 45/90 = **50% → 0/89 = 0%**; fix rate flat 37% → 36% (purely diagnostic); 5/9 significant, *p* ≈ 3.3×10⁻⁵ | `causal_pilot`, replicated (bounded) |
| Codex GPT-5.5 / Claude Code Opus 4.8, 3 hardest tasks | same failure mode, ~67% / ~73% | `calibration` corroboration, **not a controlled arm** |

**Weaknesses the program's own documents record:**

- The control **cannot run anything**. This is acceptance-execution versus no-execution, not versus an
  agent running its own tests. The paper says the effect *"should be read against that weak control."*
- **Neither headline run is patch-replay-valid.** Patch text and full session traces were not retained
  and the workspaces were deleted, so independent re-scoring is impossible; determinism rests on flake
  certification. Both since fixed.
- n = 9 of 13. **Four large repositories carry a navigation confound** and are excluded: without a
  shell the control cannot explore them, so its disadvantage there is partly "can't navigate."
- The tool returns **named** check identities — localization information the control cannot get. The
  follow-up concedes it bundles verification *and* localization; the anonymized variant is designed and
  unrun. The oracle is the fail-to-pass subset and likely under-counts the gap.
- **The contamination screen has admitted holes:** a degenerate negative control (different repos share
  no n-grams, so it cannot see the within-region predictability floor) forcing a hard-floored
  threshold; an exact-match-strict secondary scorer that under-flags; several tasks cleared on the
  weaker signal alone. One earlier directional hint was retired because it *"rode on a memorized
  repo."*
- **The two "independent lineage" runs differ in a parameter.** The qwen replication raised the output
  cap 4,096 → 16,000 (reasoning shares the budget). Applied to both arms, so the within-model contrast
  is unaffected — but the replication is not parameter-identical to the original.
- The production-CLI probe differs in model, scaffold, *and* tooling simultaneously; the paper says it
  *"motivates, but does not settle"* the interpretation, and **model identities are whatever the local
  CLIs resolved at run time** — not pinned.
- An earlier go/no-go gate was found **structurally invalid** by a four-model critique before it ran:
  under a real substantial effect it would fire ~4% of the time (~96% false stop) while flake could
  manufacture false goes. Root cause: no null model. Removed.
- **[CHECKED] Until 2026-07-20 the artifacts backing this headline were untracked.** `.gitignore`
  excluded `e2-phase1-*.json`; the artifact-preservation convention routed raw artifacts out-of-tree as
  release assets, but that tier was never built and the evidence existed only as local files —
  **an unforced process failure, not a structural impossibility.** Both repositories have had
  configured GitHub remotes since late June (record repo 2026-06-30, harness repo 2026-07-08), so
  for 12–20 days the artifacts behind a published claim could have been preserved and were not.
  They were committed on 2026-07-20 — the same day this packet was written for external reviewers. Now tracked. Three files' hashes were cross-checked against
  `artifact_sha256` fields already committed in sealed run-cards and matched byte-for-byte.

### The black-4684 exclusion — v1's "verified" claim was wrong **[CHECKED]**

A file named `e2-phase1-5-PLUS-black4684-CONTAMINATED-do-not-cite.json` carries the **same run
identifier** as the published pilot, over **10 tasks rather than 9**, and reports a **stronger**
result (9 hits, *p* ≈ 1.9×10⁻¹¹ versus the published 8 hits, *p* ≈ 3.4×10⁻¹⁰).

**v1 of this packet claimed, marked verified, that the task "never belonged in the pool." That was
false.** It was derived from a screening file belonging to a *different experiment* — an authorability
scan over ~1000 candidates for the authored-spec line, not this pilot's contamination screen.

What actually holds:

- `psf__black-4684` **is** a member of the pilot pool (`examples/run_phase1_5.py:39`).
- It screened clean for contamination and was flake-certified over 60 runs (`flaky_fraction: 0.0`).
- In the published run its arms are **complete and clean** — 10 control, 10 treatment — and it was a
  hit (`effect: 0.9, p_value: 0.0001, meets_mcid: true`). It is **tied for third-strongest** by exact
  p-value, not the strongest; two other tasks rank at or above it. *(v1 said "strongest." Also wrong.)*
- The two files were written **two minutes apart in the same session** — not a later repair.

**Two documented exclusion rationales exist and neither fits this file.** A code comment
(`phase1_5_analysis.py:19,120`) cites a "treatment n=0" infrastructure failure — verified true for the
**qwen** run (Docker create errors) but **not** for this deepseek file, whose arms are complete. The
run-card's "navigation confound" story is verified true for two other repositories that have **zero
records anywhere** — not for this one.

**Honest state: a valid, screened, flake-certified task that was a hit was dropped from the published
result, and the record does not explain why.** Two independent attempts to explain it — v1's and the
blind audit's — each reached for a tidy story and each was wrong in different ways. It is not
established that the exclusion was improper. It is also not established that it was proper.

## Everything else

| Run family | Result | Classification and cost |
|---|---|---|
| Provider smokes and difficulty series | Several structurally replay-valid; runs with timeouts, malformed responses, or provider carry-forward flagged. One 9/9 probe is recorded **structurally valid and replay-valid, both arms passing, but provider-timeout flagged and therefore not clean primary evidence** — and **the rules forbid treating it as evidence that the task is too easy.** | `diagnostic_invalid` / `difficulty_probe`. *The two source accounts disagreed here: one called this probe "clean, an easy-task result"; the other preserved the provider-flag qualifier. This packet preserves the qualifier — it restates a standing operating note.* |
| Subscription and inventory controlled pilots | All clean final outcomes flat: both arms 9/9. One had a positive secondary path-survival signal but a flat primary. | Three clean `causal_pilot`s. Do not support the claim. |
| Small pricing task, mistral-small | Executable beat prose, mean path-survival **+0.4444** — confounded: the runnable specs also disclosed the event API and worked examples. After equalizing content the loop still helped: **+0.1852**, positive in 3/3. | Clean `causal_pilot`s, **cheap-model single-file boundary**. Nearest positive evidence for a run loop; not frontier, brownfield, or authored-scenario. |
| Strong-model ceilings | claude-sonnet-4.6 and qwen3.7-max solved pricing 9/9 in **both** arms; a denser payroll task 18/18 in both. One attempt died on a **402 credit error**. | `difficulty_probe` / `diagnostic_invalid`. Closed finding: **on small fully-specified tasks frontier models self-verify well enough that executable feedback is redundant.** A proposed fifth task was killed pre-build by a five-model red team: unambiguous + fair implies self-verifiable. |
| Earlier frontier probes (dispatch, billing) | Mostly ceilinged with zero on-graph regressions. A three-pair dispatch stage showed **+0.1464**, which its own summary calls calibration-grade candidate evidence. One run had heavy output truncation; a later version fixed it and still ceilinged. | Mostly `difficulty_probe`. Costs: $4.24 dispatch program, $9.08 truncated probe, $3.28 clean probe, **$0.74 redundant timeout rerun after an already-completed clean ceiling**. |
| Authored-spec offline pilot | The OpenSpec → Gherkin → pytest-bdd pipeline works and blind, gold-passing, discriminating checks emerged. But **0 of 2 tasks reached eligibility**, so the pre-registered rule forbade sealing the main study. | `calibration`, zero agent-under-test rollouts. See structural blocker below. |
| Self-test tautology probe, 72 rollouts (40 frontier) | **0 events.** Not one agent-written test wrongly passed failing code. The real failure was declaring done *over their own red results*. | `mechanism_probe`/calibration, **control-only and single task**; ~$1–2. A null that *"kills a claim we might otherwise have built on."* |
| Sequential brownfield (Rig C) | See below. | Calibration and build work. **No two-arm trial ever ran.** |
| Drift-velocity program (Rig D) | See below. Two GO, two NO-GO. **Final evidence run: NO-GO.** | All `pilot`. ~$36. **Closed, not as a success.** |
| Current probe, one seed | Paired advantage **0** — because the lever got **zero exposure**. | `calibration`. **UNDETERMINED** — not null, not kill, not keep. $3.03 scored **+ $1.57 on a crashed attempt** = $4.60. |

### The authored-spec structural blocker — restored from v1

The binding constraint was **author-input fidelity**: a wrong hand-written API signature propagated
verbatim into the spec and sank every scenario using it, and **a mid-tier and a frontier model made
the identical error** — the stronger model did not help, because the defect was in the input.

The fix (validate the draft against unfixed base code) is **structurally asymmetric**: it works for
bug fixes and **cannot work for feature additions, because the new API does not exist at base.**
Authoring quality also varied run to run: *"a single draft is not a stable signal."*

**This is the closest the program has come to its actual claim, and it is blocked on a problem with
no known fix for the feature-addition case.**

### Sequential brownfield (Rig C) — four defects v1 omitted

- First calibration **closed null: 0 true regressions in every rollout** across three certified
  episodes. The episodes were structurally regression-resistant — the non-overlapping-files property
  that made them certifiable made them unable to couple.
- **A framing finding that should temper the whole program.** The redesign discovered the regression
  suite it wanted to gate on is **public** — it sits in the agent-readable workspace and both arms can
  run it. A treatment tool that merely runs it conveys *no hidden information*, and the redesign states
  that any design framing such a tool as an information-access contrast **"is silently false."** The
  contrast was redefined from information to **enforcement**, and *"must never be pooled with, or
  publicly conflated with,"* the brownfield result.
- **A gold leak.** A calibration was stopped after ~1 rollout when the log showed the agent running
  `git show` on the exact gold commit: the chain construction reuses a *late* pinned image with an
  *earlier* base, so gold implementations sit in the workspace object database and resetting to base
  does not remove them. The affected probe was **retired as a measurement**.
  **[CHECKED] A verification gap:** the fix was not committed until 2026-07-08, **two days after** the
  surviving partial calibration run, and **neither repo has any commit between 2026-07-01 and 07-07**.
  Whether that run had the fix rests on prose, not on a dated commit.
- **A treatment-only smoke found one real preservation regression that the gate did not see**, because
  the gate ran a capped, non-identical test surface.
- **No run ever completed.** The artifact is still `in_progress` with eleven successive re-launch logs,
  no successor run and no run card. **[CHECKED]** Its top-level `total_regressions_observed: 1009` is
  the *sum* of 4 true regressions and 1005 sentinel breaks — misleading if quoted alone. One episode's
  step is a null oracle that *"certifies vacuously."* Treatment rollouts were never authorized.

### The drift-velocity program (Rig D) in detail

Two instrument pilots preceded the four sealed boundaries:

- One (deepseek-v4-flash, ~$0.85) fired its own abort trigger and is recorded
  **`inconclusive_uninterpretable`** — *"the pilot broke; it is not reported as having measured."* The
  failure was **arm-differential** (6/36 extraction failures), censoring drift measurement precisely
  where drift was worst.
- The other (qwen-plus, ~$1.15) returned a `go` **"by a whisker"** and produced the finding that
  motivated everything after: **enforcing code correctness does not protect the spec** — the enforced
  arm's spec drifted almost as fast as the controls', because the gate enforces that the spec
  *changed*, not that it is *true*. A prompt-only "keep the spec current" arm was **behaviorally
  inert**, point-for-point identical to no instruction, and was dropped.

| Boundary | Treatment | **Model** | **Seeds** | Verdict | Spend |
|---|---|---|---|---|---|
| v2-M7 | executed scenarios | **deepseek-v4-pro, reasoning off** | **2** | **GO** via velocity — but the executed arm's own gate still accepted "done" over a failing hidden oracle on **7 of 12 tasks** | $0.94 |
| v2-M8 | executed scenarios | **glm-5.2, reasoning on** | **2** | **NO-GO, both legs inverted.** Executed-arm false confidence **total: 12 of 12**. The prose arm ended closer to truth (**35/36 vs 30/36**) | $2.84 |
| v3-M6 | product loop | glm-5.2 | **6 planned, 5 evidence** | **GO** on false confidence only; velocity ran opposite (**2.13 prose vs 5.33 product loop**) | $19.83 |
| v3-M7 | product loop, composition guard | glm-5.2 | 6 | **NO-GO** | $8.54 |

**The GO and the first NO-GO used different models.** v1 removed the model and seed columns, and its
claim that everything was "single-model" concealed this. Boundaries 1 and 2 ran on **two seeds each**.

**One run was VOID.** A first v2-M8 attempt was killed mid-chain — not by model or provider, but
because **the harness reaped the background process when a supervising session's context was
cleared**. ≈**$1.14 sunk**, the pre-registration seal spent, **one seed permanently contaminated (its
outcome partly known)**, forcing a substitute. A binding non-derivation rule attaches: no number from
it may be cited, pooled, or allowed to influence any later analysis choice.

**One seed was excluded on provider grounds.** In v3-M6 the provider returned empty bodies for ~40
minutes across all three arms; root cause per the operator was that **the account balance had hit
zero**. The seed was excluded under the sealed gate and **never rerun**. The report argues the
exclusion was outcome-blind.

**Why the v3-M6 GO is not a win — its own report says so:**

- *"The loop did not make the model more truthful — it made false done-claims harder to finish."*
- Of 18 matched pairs where the product arm closed: **18 concordant, 0 discordant** — it lied exactly
  when prose lied. **The entire margin is composition**: 12 product-arm tasks never closed (11 budget
  walls, 1 stall). Conditional on being allowed to close, the arms lie at indistinguishable rates
  (**0.80 / 0.92 / 0.83**).
- Restricting to closed tasks **reverses** the velocity inversion (**2.13 / 1.60 / 1.40**); **74%** of
  the product arm's onsets came from tasks it never closed.
- Seed level: 3 wins, 2 ties, 0 losses — one-sided sign test at n=5, ***p* = 0.125**.
- A **harness defect** found afterwards: the validator printed errors to stderr while the harness
  relayed only stdout, so **agents saw empty error messages**.
- **A single unarchived rename registers as ~25 counted items** — *"the velocity contrasts are driven
  by 2–3 task-events, amplified."* **The headline contrast is substantially a counting artifact.**
- Two of three product-gate components — mutation floor and reviewer — **never refused anything**.
- On the hardest chains the product arm's final correctness fell **below the arms it was meant to
  beat**: one seed, **prose 26/27, executed 12/27, product 10/27**. *"Freshness enforcement is not
  competence."*
- Spend overran its own estimate (**$19.83 versus $9–16**).

A follow-up learning ladder — five low-budget rungs, all `calibration`, whose one honest-direction
pair and apparent freshness improvement **did not qualify as evidence** — then concluded that **"the
M6 verdict structure (go-on-honesty, inverted-on-freshness) is likely close to backwards of the
post-fix reality."** Post-fix false confidence was driven almost entirely by an ambiguity channel whose
largest single contributor was a naive-pluralization convention (`entrys`) punishing natural English
and discoverable only by asking. The log records the objection against itself: *"a skeptical reviewer
will call `entrys` gotcha design."* And flatly: **"Honesty-at-close currently measures 'does the agent
ask the PM,' not 'does the gate catch bugs.'"**

**The final evidence run (v3-M7).** Six seeds × six tasks × two arms, glm-5.2, $8.54, zero deviations
from the seal, all sequences complete and chain-replay-valid.

- **Primary inverted.** Mean carried discrepancies **3.50** (product loop) versus **1.69** (prose) —
  the loop kept documentation *less* accurate, with the close-rate guard holding.
- **Honesty at close: no detectable difference.** 0.424 versus 0.417. Of 33 matched both-closed pairs:
  17 concordant honest, **13 false in both arms**, 2 prose-only, 1 product-only. **No equivalence
  margin was pre-registered and three discordant pairs cannot establish equality** — the report says
  "no effect was detected," never "the arms are equal."
- A pre-registered prediction failed for the first time: prose ran one seed with **zero drift end to
  end**.
- **The gate barely engaged: 5 refusals and 2 done-over-red events across 36 tasks; the mutation floor
  never refused.** The "treatment" was barely a treatment.

**What the program found wrong with its own run** (four external adversarial reviews, two forensic
passes, one code-level verification; all four reviews reproduced every headline number and upheld the
NO-GO):

- **A falsely disclosed contract.** The PM brief promised partial-update semantics; the reference server
  rejects partial bodies regardless. **29 scored items per arm — 31% of all counted drift; a broader
  reviewer classification puts it at ~47%.** Symmetric, so it does not tilt the contrast, but it
  **voids any absolute reading** of the drift numbers.
- **One seed dominates.** Leave-one-seed-out shrinks the 2× gap to ~15%.
- **The program's own post-hoc story was refuted and retracted.** The flagship claim ("executable specs
  make misunderstanding visible; prose hides it") was refuted against the records — on the cited seed
  prose was explicit *and correct* and the product arm was wrong.
- **The sharpest finding, and it is bad for the thesis:** on one task a requested change was implemented
  in **neither spec nor code**, and closed "done" over a 12-of-26 oracle — because spec and code were
  *stale in the same way and therefore agreed*. Every check the loop can run passed. **The
  executable-spec loop verifies self-consistency, not truth.**
- Forensics over all matched false-close pairs found **zero** closes over visible contrary signals across
  26 sampled episodes. The supported sentence is: *"the model closes truthfully against everything it can
  see, while the contract drifts where nothing pinned it."* **Not "the model lies."**
- A one-character output tic (gluing a protocol delimiter to preceding prose) met a parser that silently
  ignores such lines: **≈85 wasted turns and all 3 stalls.**
- **A rules trap producing a data-integrity event.** After a stalled task the next could not lawfully
  open a fresh change directory and the harness had no delete primitive, so absorbing the leftover was
  near-forced — **producing the run's one silently-swapped task.**

**The program's verdict on its own instrument.** The close-out answers "are we just patching?" with
*for the absolute numbers, yes, and no amount of patching converges.* Three reasons: disclosure closure
is unfalsifiable (four audit rounds each found a new family of pinned choices a reasonable engineer
could make either way); **the artifact floor exceeds the effect size** (artifacts ran 31–65% of measured
events and produced 2× swings, while the surviving treatment effect is ~15% on 6 seeds of one stochastic
model); and every fairness fix voids comparison with prior runs.

### The current program — one run, paused

**Reframed from "judge the thesis" to "engineer it."** Reviewed adversarially by two external teams
before any spend and rewritten; then a seven-model panel reviewed the rig repair, producing 8 verified
findings and 11 refuted-by-code.

**Seed 220, 2026-07-14. `calibration` — non-evidence.** Convertible pairs 5 of 6; treatment conversions
**0**; control conversions **0**; paired advantage **0**.

**Read the zero honestly.** The advantage is 0 because *neither* cycle ever repaired anything, and the
treatment arm **never had a held-out failure to convert** — every treatment close was already fully
green, so the "shown verdicts" were all-PASS lists. **The lever got zero exposure.** By the template's
letter this "points at kill"; in spirit it is close to void.

The disposition table looks dramatic — **false closes 0 versus 4, pooled honesty 0 versus 5** — and
**must not be read as the lever's effect.** The arms diverged during task 2's *main work*, before the
lever delivered any information; no cycle in either arm wrote a single file. Sampling variance at one
seed.

Side observations (calibration-grade): the control carried the same two broken checks through **five
consecutive blind re-verify cycles and never found them**; two treatment cycles were **truncated to one
turn by provider timeouts**; and the off-topic-close classifier **falsely flagged all four
convention-change closes in both arms** — its first live exposure, the exact false-accusation polarity
the design had feared.

**Standing status: UNDETERMINED.** The kill-confirmation seed was not run. No keep, no kill, no void
may be claimed.

### The fair contrast: pre-registered, never run

A decision rule exists for prose spec **with a shell and its own tests** versus executable spec. Its
kill row: *"**Do NOT build** the executable-spec value proposition. (Operator-confirmed real stop.)"*

Two preliminary runs returned `proceed: false`. **[CHECKED]** These had **no treatment arm** — baseline
only, **a single task**, six runs each, asking whether anyone ever declares done while broken. The
pre-registration assigns this outcome to a different row: *"**No decision** — not evidence for or
against. Reselect harder / more-overclaim-prone tasks, **or abort**."* The recorded verdict string is
`stop_reselect_or_abort`. **Abort was equally on the table.** The program reselected. **Arithmetic
trap:** at n=6 the achievable rates are 0, 0.167, 0.333… against a 0.20 bar, so the single observed
event could not have cleared it regardless.

**What survives.** The frontier model solved all six with **zero** instances of declaring done while
broken — a self-testing frontier control had nothing for the tool to fix. That is directionally what
the kill row describes, and the program's own fallback document says so: the operator's stated intuition
is that the effect *"may collapse, most plausibly: fair controls that self-test close the gap, as the
frontier calibration already showed on freezegun-582."* **The kill row remains untested.** The program's
own note flags that the current bar *"may reject true 5–15% effects"* for strong models.

## The pattern

**Adjacent evidence cannot be substituted for the desired evidence.** The headline shows a large benefit
from running existing hidden acceptance tests against a no-execution control. The sequential program
shows an agent-authored executable scenario set can be green while both code and specification are
wrong. The authored-spec pipeline has not produced an eligible task set and is blocked structurally on
feature additions. The fair contrast has never run. **Also: the public README already headlines the
weaker acceptance-feedback result, while the claim being pursued is the stronger authored-scenario
version — a live public-communication exposure, not just a design point.**

---

# A4 — The constraints

**Budget.** Stop-loss of **$18 or 8 probe-seeds**, with **$4.60 spent** ($3.03 scored, $1.57 on a
crashed attempt). Paused; further runs need explicit authorization; next probe ~$3 per seed.

**No program-wide total exists.** Sequential-rig figures sum to roughly $36. The two independent
accounts of this record produced **different partial subtotals ($36 versus $47.15)** depending on
inclusion; neither could produce a total; **no audited cross-program ledger exists.** For the brownfield
line — the published headline — **no per-run dollar cost was recorded for either pilot**: the cost field
is zero in all 243 records of one and absent from all 180 of the other. A 20-rollout cost probe
(≈$3.75 list, ≈$1.88 discounted) yielded an *estimate* of a $24 floor and $70–150 realistically. That
program's binding cost was wall-clock, not money. **State the program total as unknown.**

**Cost is not why the results are weak; sample size is.** The last run's own advisory fired:
between-seed variance ratio > 3×, *"any full-scale run needs more seeds."*

**Models.** glm-5.2 with reasoning on (direct z.ai route) is the workhorse for the sequential rig and
current program. Also deepseek-v4-pro and -flash, qwen-plus, qwen3.7-max, mistral-small,
claude-sonnet-4.6, gemini-3.1-pro, and Codex GPT-5.5 / Claude Code Opus 4.8 via production CLIs.
**Every sequential evidence claim rests on one model per boundary, and the GO/NO-GO pair used different
models.** The claim targets frontier models; the sequential workhorse is not one. Availability of a
route is not evidence of remaining paid capacity — an account-balance failure and several provider
timeouts are recorded.

**Team.** Effectively one person; all commits by a single author. Implementation is done by AI agents
under written operating rules; **the review function is performed by panels of other models** — four on
the last evidence run, seven on a rig-repair package, five on an earlier task design, two on the current
proposal. No independent human reviewer, no replication by another team, no institutional oversight. To
its credit the program says so: **no internal review caught any of the four major artifacts first** —
every one was found by an external panel or a forensic pass.

**Tooling.** A TypeScript/Bun harness of ~90 modules and ~850 tests: procedural substrate generator;
drift meter; scenario grammar, binder and hermetic executor; mutation harness and adversarial bank;
OpenSpec integration against a pinned CLI; sealed-constants files with per-module hash pinning;
manifest and replay inspectors. A separate Python/Docker harness serves the brownfield line (SWE-bench
Live, OpenHands, flake certification, contamination screens, permutation analysis). A **working
literal-Gherkin runner** exists — real `.feature` files executed by pytest-bdd through step
definitions, vendored into containers with no network, validated end-to-end on one real repository —
**but it has never been connected to a sequential or coupled episode.** Research tooling, not a
hardened evaluation platform. A substrate-feasibility finding also stands: **many SWE-bench patches do
not stack**, which constrains any sequential design built from them.

**Time.** The record begins 2026-06-05; this packet is dated 2026-07-20 — about six and a half weeks.
The pace is itself a constraint: the entire drift-velocity program was designed, built, run to four
sealed boundaries, externally reviewed, forensically audited and closed **between 2026-07-08 and
2026-07-13 — six days.** Reviewers should weigh how much design deliberation is possible at that cadence
— while noting the close-out attributes its recurring problem to a structural property of the substrate,
not to haste.

**A standing publication constraint.** The rules require every public statement to name the run's
classification, and forbid: calling calibration or probe runs causal evidence; calling provider-flagged
runs clean; pooling incompatible runs; hiding flat or invalid results. The last evidence run's
guardrails additionally prohibit the sentence "the model lies about being done."

---

# Uncertainties

1. **No experiment in this record tests the claim as written.** Two independent accounts reached this
   separately, from the repository alone. The nearest fair comparison has produced a broken pilot, a
   marginal go, a no-go, a reframed go, and a second no-go — never a positive on the primary. **No run
   manipulates increment size at all.**
2. **Dollar cost of the two headline pilots is recorded nowhere.** The two accounts disagree on program
   subtotals; no total is supportable.
3. **The black-4684 exclusion is unexplained.** Two documented rationales exist and neither fits. Two
   independent attempts to resolve it both produced wrong answers.
4. **The sequential brownfield line's status after 2026-07-06 could not be determined**, and its one
   partial result may predate the gold-leak fix — the fix was committed two days later, with no commits
   at all in the intervening week.
5. **Run-classification vocabulary is inconsistent.** The drift-velocity reports label main runs `pilot`
   while repo-wide vocabulary uses calibration / difficulty_probe / causal_pilot / diagnostic_invalid.
   Preserved rather than reclassified. A backlog item now exists.
6. **Four of six tasks in the last run recorded zero *new* hidden checks** — including an add-a-field
   task; correctness was scored cumulatively. Intended, or a coverage gap? No document addresses it.
7. **An identical task request appeared twice in one six-task sequence.**
8. **Three conflicting readings of the same probe result coexist** — "points at kill," "close to the
   void spirit," and "undetermined." All defensible under the written rules, which suggests the
   keep/kill/void template does not cleanly partition outcomes.
9. **Whether the sequential rig can ever separate two competing explanations** for the executed arm's
   higher measured drift: "the novelty floor forces it to author more precise claims, enlarging its
   countable surface" (97 items versus prose's 32) versus worse understanding. The report states these
   are **"NOT separable in this design."** A discriminating design is proposed but unbuilt.
10. **An unresolved dispute over the first boundary's GO.** One reviewer argued it *"remains a valid GO
    on both pre-registered legs"*; the adjudication rejected that against the records. Not independently
    re-verified here.
11. **How much human effort authoring and maintaining fair executable scenarios requires** — no
    comparable dataset exists, while the authored-spec pilot exposes real fidelity problems. Part of the
    product claim, measured nowhere.
12. **The off-topic classifier has been rewritten twice** after a single live exposure; the version that
    would run next has never been exercised on real data.
13. **Whether the substrate is fair is, by the program's own analysis, open and possibly unanswerable.**
    Four audit rounds each found a new family of pinned choices a reasonable engineer could make either
    way. Twelve such knobs are now deliberately left ambiguous as measurement material. Reviewers may
    reasonably disagree with that call.
