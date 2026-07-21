# Critique process — does the current experiment serve the public claim?

**Status:** proposal, unexecuted. Zero API spend at every step (steps 1–3 run on chat
subscriptions; step 4 runs on coding-agent time). Nothing here touches the $13.40 remaining
against the E5 stop-loss.

**Why this document exists.** E5's live probes manipulate *visibility of hidden acceptance-check
verdicts*. The public claim target is *executable Gherkin-style specs, authored in small
increments, beating plain SDD*. Those are different propositions. This process is designed to
establish — cheaply, and with outside eyes — whether that gap is fatal, and what the cheapest
route to a defensible post actually is.

**Design principles.**

1. **Blind before sighted.** Outside reviewers design their own study *before* seeing ours.
   Anchoring is real; a reviewer shown our design first will critique its details instead of
   questioning its existence.
2. **Attack the post before the protocol.** The audience is LinkedIn, not a program committee.
   Credibility failures (synthetic benchmark, one non-frontier model, answer-key optics) sink a
   post regardless of internal validity. Surface those first.
3. **Never ask "is this good?"** Chat models flatter. Every prompt below asks for attacks,
   alternatives, or independent construction — never for approval.
4. **Every outside claim gets refuted-or-confirmed against code.** The P0-V panel precedent
   holds: 11 of 19 external findings were false and were adjudicated out with file:line
   refutations. Expect a similar ratio here.
5. **Independence.** Run each model in a fresh session. Do not show model A's output to model B.
   Do not reveal step 1's results before running step 2.

---

## Step 0 — Build the briefing packet (me, ~1h, no spend)

Everything downstream is only as good as the packet. It must be **self-contained** (reviewers
have no repo access), **unflattering** (no internal rationalizations), and **stripped of house
vocabulary** (no "boundary", "custody", "arm_p", "disposition table" — those terms let a reviewer
pattern-match to "this looks rigorous" instead of reading what happened).

The packet has four sections, drafted in Appendix A below:

- **A1 — The claim.** What we want to say publicly, decomposed into independently-falsifiable
  sub-claims, with the audience and the standard of proof named.
- **A2 — The design as built.** What is actually manipulated, what is held constant, what the
  task looks like, what gets measured. In plain language a senior engineer could re-implement from.
- **A3 — The evidence ledger.** Every run to date, its result, its classification, its cost.
  Including the negative ones. Especially the negative ones.
- **A4 — The constraints.** Budget, models available, time, tooling that already exists.

**Gate:** operator reads A1–A4 and confirms they are accurate and not self-serving. A packet that
launders the design's weaknesses produces a critique that misses them.

---

## Step 1 — Blind independent design (3 models, deep research, ~1 day wall clock)

> ### ORDERING CORRECTION (2026-07-20): Step 1 runs BEFORE substrate selection
>
> Appendix F originally said the substrate scouts run before Step 0, "because the substrate choice
> determines what goes in the packet." **That was wrong on both counts and is superseded.**
>
> 1. **The packet describes what exists, not what is planned.** A future substrate choice does not
>    change the account of past runs. Appendix F was never actually a prerequisite for Step 0.
> 2. **More importantly, it anchors the thing the step exists to buy.** Step 1 hands reviewers only
>    the claim and the constraints and asks them to design the study from scratch — *including what
>    to run it on*. Choosing a substrate first and then asking for a blind design discards the most
>    valuable answer they could give.
>
> **Corrected order:** Step 1 (substrate question folded in as deliverable 5 of Prompt A) → then
> Appendix F's scouts, which refine under the strict literal-Gherkin filter with the shortlist Step 1
> produced as one input → then Steps 2–6.
>
> Step 1 also does not depend on the packet being finished. It consumes A1 and A4 only. Every error
> the blind audits found sat in A2 and A3, which Step 1 never sees — so a packet with a known-error
> register in its evidence sections does not block this step.
>
> **Paste-ready prompt with A1 and A4 already folded in: `STEP1-PROMPT-PASTE-READY.md`.** Use that
> rather than Appendix B, which is retained as the unmerged draft.

**Models:** three deep-research models that **have not seen this design**. Separate sessions, no
cross-contamination.

> **Contamination ledger.** As of 2026-07-20, ChatGPT and Claude have both read this proposal in
> conversation and are disqualified from this step. Their agreement with it is therefore anchoring,
> not corroboration — the exact effect this step exists to prevent, observed live. Only positions
> they held *before* seeing the design count as independent. Eligible: Qwen, Gemini, DeepSeek,
> Kimi, GLM. Both disqualified models remain eligible for steps 2 and 3, which do not require
> ignorance of the design.

**Input:** A1 + A4 only. **Not A2, not A3.** Reviewers must not know what we built.

**Output wanted:** an independently-constructed study design, a falsification standard, and prior
art. The value is the *diff* against what we built — where three independent designers converge on
something we don't have, that is a gap worth investigating.

> **Convergence is a prioritization signal, not validation and not citable evidence.** Three models
> agreeing prioritizes a question; it does not validate a design and does not establish prior art.
> Models share training data and failure modes, so agreement is weak evidence of correctness and
> strong evidence only of a common prior. Only retrieved primary sources and actual run artifacts
> support public claims. This applies retroactively to every model opinion recorded in this
> document.

**Prompt A is in Appendix B.**

---

## Step 2 — Attack the post (same 3 models, deep research, same day)

**Input:** a draft LinkedIn post with real numbers, no methodology section. Nothing else. Reviewers
see what the audience will see.

**Run it twice, in this order.** First on the bare post. Then on the post as it would actually ship
— with its single evidence-and-replay link. The difference between the two rounds is what separates
a genuinely fatal credibility problem from one the post's normal supporting link already answers.
Objections that survive round two are the real ones.

**Output wanted:** the top 10 public takedowns in comment voice, ranked by damage, each marked
fatal / fixable-in-one-sentence / noise.

This step catches what methodology review structurally cannot: that a procedurally generated CRUD
API reads as "toy benchmark" to a CTO, that glm-5.2 reads as "you didn't test a real model", and
that "we showed one agent the test results" reads as "you gave it the answers." All three are
credibility-fatal and none is an internal-validity flaw.

**Prompt B is in Appendix C.**

---

## Step 3 — Construct-validity audit (2 thinking models, no search, ~2h)

**Models:** one strong reasoning model with extended thinking, plus one different-family model
(e.g. GPT-5 Thinking + DeepSeek R). **Search off** — this is an argument task, not a retrieval
task, and search results add noise.

**Input:** A1 + A2 + A3. Full disclosure this time.

**Output wanted:** for each sub-claim in A1, does the manipulation in A2 actually instantiate it?
Where does the operationalization diverge from the construct? And the load-bearing question:
**if the treatment wins, what is the most boring alternative explanation?**

This is where the verdict-visibility-vs-executable-specs gap should fall out on its own. If two
independent models don't spot it unprompted, that is itself informative — it would mean the gap is
less obvious than it looks from inside.

**Prompt C is in Appendix D.**

---

## Step 4 — Code-grounded verification (Claude Code + Codex, parallel, ~2h)

**Input:** the packet plus every critique from steps 1–3, as a flat numbered list.

**Two independent agents, same task, no communication.** Each returns, per critique:
`CONFIRMED` / `REFUTED-BY-CODE` / `PARTIALLY-TRUE` with `file:line` evidence. Plus: anything in
the packet itself that the code contradicts.

Disagreements between the two agents get adjudicated by hand. Agreement on `REFUTED` retires the
finding **for the current compatibility boundary** — the constants version, meter version, and
substrate config it was checked against — in the R1–R11 style already established. It stays retired
while those hold, and returns for re-adjudication if the implementation, the claim, or the
comparison changes. "Permanently" would be wrong: the repo's own boundary discipline says findings
do not survive a boundary move automatically.

**Prompt D is in Appendix E.**

---

## Step 5 — The decision (operator + me, ~1h)

Not a findings list. A costed choice between the routes that survive. As of this writing the
plausible three are:

| Route                                          | What it claims                                                                                                     | Cost               | Risk                                                                                                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **E5 calibration-only probe** (P1.2w seed 582) | **Nothing toward the public thesis, regardless of outcome.** May guide product design only                         | ~$3–8              | Resumes only under explicit calibration authorization — never as thesis evidence                                                                                                                               |
| **Route 2 feasibility screen** (not a study)   | Only whether any substrate can support the claim at all                                                            | $6–12 + build time | The causal pilot's real cost is **unknown** until a shortlisted substrate passes local screening — literal-Gherkin parity, two-author blind authoring, and per-episode defective-variant sets are all unpriced |
| **Publish what's earned**                      | "The loop verifies self-consistency, not truth — coordinated staleness is executable specs' structural blind spot" | $0                 | It's a *negative/nuanced* result, not the win originally wanted                                                                                                                                                |

Route 3 deserves a serious look. It's already paid for, it's genuinely non-obvious, two independent
forensic passes support it, and "here's where the technique I advocate actually breaks" is a
stronger credibility play on LinkedIn than a marginal positive on a synthetic benchmark. It must be
worded as *agent-maintained scenarios with no independent truth source* — not as executable
acceptance specs failing generally, which the evidence does not support.

**On the E4 prior.** E4's NO-GO is a serious prior against Route 2 but not a veto. E4 tested agents
maintaining *their own* scenarios on a generated substrate with no independent truth source; its
durable finding is that such a loop verifies self-consistency rather than truth. A study with
*independently authored* per-increment scenarios scored against a *separate held-out oracle* is a
different and cleaner question. Do not let the NO-GO retire a question it did not ask.

### Route 2 admission gate (zero spend, runs before any build)

Route 2 does not start on a decision; it starts on passing this gate.

1. Select 4–6 real multi-change episodes.
2. Author one OpenSpec scenario delta per change, **blind to the gold patch and its tests**.
3. Compile to executable scenarios.
4. Admit an episode only if: the no-op fails, gold passes, scenarios run on the public surface,
   results are stable across repeats, and scenario outcomes predict the separate held-out oracle
   well enough to justify the study (this is C4, measured before it is assumed).
5. **Per-check discrimination (added 2026-07-21, Step 1 finding F3).** "The no-op fails" at the
   *episode* level admits suites in which one check discriminates and the rest are vacuous. Each
   individual check must be shown to fail against the empty patch. Checks that pass on a no-op are
   removed before the freeze, and the count removed is reported — a high vacuous fraction is itself
   a signal about the authoring protocol.
6. **The lever must have something to act on (F1, and `AGENTS.md`).** State the event the treatment
   acts on and its estimated base rate in this episode set, with the source named, before any spend.
   Episodes where the control arm cannot plausibly fail contribute nothing in either direction.
7. **The visible-versus-held-out gap is a headline figure, not a diagnostic (F3).** Report it per
   episode. It is the only honest measure of whether an arm is satisfying what it can see rather than
   the requirement. Sourced and verified 2026-07-21: ImpossibleBench (arXiv 2510.20270) puts frontier
   check-gaming at 50–76% where checks are visible; SpecBench (arXiv 2605.21384) finds the
   visible-minus-held-out gap grows ~28pp per 10× codebase size, reaching 100pp above 25K LOC;
   *Building to the Test* (arXiv 2606.28430) found an agent's delivered library was dead code and
   no-oping it left the score unchanged.
8. **Record the cost of hiding checks.** ImpossibleBench's full finding is that hiding tests reduces
   cheating to near zero **but also degrades performance on the original benchmark**. This design
   hides checks, so that cost is ours. Do not quote the first clause without the second.

### Who authors blind — the authoring protocol

The obvious phrasing is "a non-participant," but this is a solo program and there is no
non-participant. Nor does "a second model with no repo access" work: a model that cannot see the
surface cannot write scenarios that run against it, and hand-transcribing the surface for it
recreates the failure that killed the previous authored-spec calibration — a wrong hand-written
signature that two independent models then faithfully reproduced. Garbage in, blind or not.

The protocol:

1. Extract the public-surface manifest **mechanically** — endpoints, signatures, invocation,
   relevant docs. Never hand-written.
2. Two model authors plus a reconciler work from that manifest and the issue text. They never see
   the known-good patch, its tests, or any held-out result.
3. **Reconciliation happens before any known-good result is revealed.** Then the scenario pack is
   hash-frozen.
4. Only after the freeze are known-good and held-out checks run. From that point the operator may
   **admit or reject the whole episode — never edit scenario content.**
5. A failure produces a new numbered version of the authoring protocol, not a silent repair of the
   scenarios.
6. **Instrument the authoring itself (added 2026-07-21, Step 1 finding F4).** Log, per episode:
   wall-clock to first draft, number of reconciliation rounds, disagreements between the two authors,
   and checks discarded at step 5 of the admission gate for failing to discriminate. This costs
   nothing — the authoring happens anyway, at zero API spend — and it is the only measurement of the
   practice's real bottleneck anywhere in the program. **Sub-claim C6 (is the gain worth its cost?)
   is currently unmeasurable for want of exactly this data.**

**On the content-equivalence trap, and why the chosen design already closes it.** A blind reviewer
raised the sharpest version of this: the executable format forces the *author* to pin exact values and
edge cases, so a separately-written prose comparator ends up genuinely vaguer, and the study measures
spec quality while reporting it as an execution effect. **Under Appendix F's decision this cannot
happen** — both arms receive the same OpenSpec source and the same hash-pinned `.feature` artifact,
both may read either, and the only difference is that treatment can execute. There is no second spec
to be vaguer. Any future variant that gives the arms *different* spec artifacts reopens this and needs
an independent completeness review of one against the other before the run.

**What remains open is the cost, not the content.** The design holds content equal by construction,
but it does so by *paying* the authoring cost in both arms and measuring it in neither. A result
saying "executing these scenarios helped" says nothing about whether producing them was worth it —
which is the question a practitioner audience actually asks. Hence step 6 above.

**What this does and does not buy.** A mechanically extracted manifest removes transcription error.
It does **not** remove semantic authoring error or selection bias — those are what steps 3–5 exist
to contain. Do not describe the hole as closed; describe it as bounded.

**Role conflict, and how it resolves.** Selecting a substrate means reading candidate PRs — diffs,
tests, the fix. That is precisely the known-good material this protocol excludes, so the selector
cannot also be an author. Resolution: the operator keeps the selection role and gives up the
authoring role. Authoring is delegated entirely to the model authors above.

The operator cannot *directly* alter scenario content, because they never author or edit it.
**Candidate-selection bias remains possible** — a selector who knows the known-good patch influences
which episodes enter the study. That channel is not closed. It is constrained by the pre-declared
screening rule, logged per episode, and reported in the writeup.

**Passing the gate is a funding decision, not a green light.** The E3-shaped version is budgeted in
this repo at "tens of dollars" for calibration and roughly double that across two arms — call it
$50–150 against $13.40 remaining. The E2 authored-spec version is roughly an order of magnitude
cheaper and its machinery is already built and tested. That fork is unresolved and is an operator
call.

**Gate:** the chosen route gets a written pre-registration before any spend, per existing repo
discipline.

---

## Step 6 — Re-attack the chosen plan (1 model, ~30min, before spend)

Run Prompt B again against the *chosen* route's projected post, with placeholder numbers in both
directions (imagine it wins / imagine it's null). If the projected win still draws fatal comments,
the route is wrong and no amount of spend fixes it. Cheap insurance immediately before the only
step that costs money.

---

# Appendix A — Briefing packet (DRAFT — operator must verify before use)

> Accuracy here is load-bearing. Every number below is drawn from the repo record; the operator
> should confirm each before this packet leaves the machine.

## A1 — The claim

We want to publish, to a practitioner audience of engineering leaders, a defensible version of:

> Writing acceptance criteria as executable, Gherkin-style scenarios — and defining and running
> them in small increments — produces measurably better AI-agent work on an evolving codebase than
> spec-driven development that keeps the spec as prose, even when that prose spec is
> well-structured and scenario-shaped (as OpenSpec's is).

Decomposed into independently-falsifiable parts:

- **C1 — Execution.** A spec that is *run* as an acceptance gate beats the same spec merely *read*.

- **C2 — Increment size.** Authoring and running those scenarios in small slices beats doing it in
  larger units of work. **Currently untested in every design on the table, including the ones
  proposed to replace this one.**
  
  **C1 and C2 must not be tested in the same cheap study.** Crossing them needs four conditions and
  enough runs per cell to separate the main effects; the budget does not reach. Route 2 picks ONE:
  test C1 (same scenarios, run vs read) and strike "small increments" from the published claim; or
  make C2 the target, with *both* arms able to execute scenarios on different pre-declared
  schedules. **A C1-only win is not evidence that small increments help** — that inference is the
  single most likely way this program overclaims, and it is banned here in advance.
  
  Recommended order: C1 first. If execution does not help at all, the cadence of execution is moot.

- **C3 — Fair comparator.** The baseline is a real, competent SDD workflow, not a strawman.

- **C4 — Transfer.** Passing the visible scenario suite translates to correctness on an
  independently held-out oracle. Without this, a treatment win is teaching-to-the-test and the
  headline is false even when the numbers are real. E5's shown/held-out partition already
  instruments a version of this; any replacement design needs its own.
  
  **C4's floor is sealed before candidate screening begins, not judged afterward.** "Predicts well
  enough" is a dangling judgment that lets you pick the episode whose numbers flatter you — that is
  selection on the outcome. The rule: the known-good patch passes both visible scenarios and
  held-out checks; the do-nothing patch fails both; and a fixed set of behaviorally defective
  variants meets a minimum visible-to-held-out agreement rate. The threshold itself may be
  calibrated, but it must be **sealed before any candidate's results can influence which episode
  gets selected.** Episodes missing the floor are dropped however attractive they look.
  
  **E4's adversarial bank is a design precedent, not reusable machinery.** It generates broken
  implementations from the procedural substrate's ground-truth internal representation; a real
  repository has no such representation to generate from. Each candidate episode therefore needs its
  own pre-declared, episode-specific defective-variant set — hand-authored — or it fails C4. This is
  a per-episode authoring cost, and it has been under-priced twice in this document.

**Standard of proof:** practitioner-credible, not peer-reviewed. A skeptical CTO reading the post
should not be able to dismiss it in a single comment. The aim is not journal-scale generalization —
but that is not a licence to be loose with numbers. It still requires a decision rule declared
before the run, per-episode outcomes rather than aggregates only, uncertainty or consistency
information, replayable artifacts, and language bounded to the exact model, workflow, and tasks
tested.

**A word on "Gherkin."** The E4 implementation rendered `.feature` files as a byproduct and never
executed them — execution ran through a parsed representation of the OpenSpec scenarios. Saying
"Gherkin" in a post would therefore be false as things stand. Either Route 2 actually compiles and
runs the `.feature` artifacts, making the word literally true, or the claim says **"runnable
acceptance scenarios, expressed in OpenSpec/Gherkin-compatible form."** This is an operator
decision, not a wording preference: the audience this post targets cares about that word.

**Audience:** engineering leaders on LinkedIn. Assume they have not read a methods section, have
seen many overclaimed AI benchmarks, and will pattern-match to "vendor demo" at the first smell.

## A2 — The design as built

**Task substrate.** A procedurally generated TypeScript HTTP CRUD service. A fixed starting point
(two entities, eleven endpoints) evolves through a seeded sequence of six tasks — add a field,
rename an entity, change an endpoint's method, add a validation rule, and so on. Each task is
handed to the agent as a deliberately vague natural-language request, the way a PM might phrase it.
A hidden answer key (the correct implementation, plus an HTTP acceptance suite) is generated
alongside and never shown to the agent.

**Environment, identical in both arms.** Both arms work in a real OpenSpec workspace, using the
real OpenSpec CLI. Both write scenarios in OpenSpec's `#### Scenario:` / WHEN / THEN format. Both
get the same task text, same budgets, same prompts, same PM-question channel. The harness runs the
archive step identically for both. A `.feature` file is generated as a byproduct but never
executed and never read back — Gherkin is a rendering, not the execution path.

**What was manipulated in E4 (closed).** Whether the agent's own scenarios were *executed as the
acceptance gate*. In the prose arm, a "done" claim was accepted unconditionally. In the executed
arm, "done" was accepted only when the full scenario set passed. Everything else identical.

**What is manipulated in E5 (current).** Both arms now run the executed loop. The difference is
whether the agent is shown pass/fail verdicts from *the hidden acceptance suite* — the answer key
it did not write. Roughly half the hidden checks are designated visible (split by a hash of the
seed, fixed per run); the rest are never shown and are what the agent is scored on. P1.1 delivered
those verdicts once, after the agent declared done, with one repair window. P1.2w (built, unrun)
delivers them during work instead.

**Outcome measures.** Primarily: did the agent claim "done" while the hidden suite was still
failing (called false confidence), scored on the held-out checks the agent never saw. Secondarily:
a drift meter that diffs the spec and the code against the hidden truth and counts contradictions,
coverage gaps, and stale claims.

**Model.** glm-5.2 with thinking enabled, via z.ai. Budgets are pinned to that exact model and
route; any other model requires re-ratifying them.

## A3 — Evidence ledger

| Run                         | What it compared                             | Result                                                                                                                                                                                |
| --------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E4 v2-M7 (deepseek-v4-pro)  | prose spec vs executed spec                  | GO on freshness; the honesty half did not hold                                                                                                                                        |
| E4 v2-M8 (glm-5.2)          | same                                         | **NO-GO** — both measures inverted                                                                                                                                                    |
| E4 v3-M6 (glm-5.2)          | prose vs executed, full product loop         | GO on honesty, but the margin turned out to be *which tasks closed*, not honesty; freshness inverted                                                                                  |
| E4 v3-M7 (glm-5.2)          | same, with that composition flaw fixed       | **NO-GO** — more drift, no honesty difference                                                                                                                                         |
| E5 P1.1, seed 220 (glm-5.2) | verdicts-at-close vs a content-free re-check | **Undetermined.** Paired advantage 0 — but the treatment arm closed every task green, so the lever was never exercised. No file was written in any repair cycle in either arm. $4.60. |

**Robust findings that survived E4** (two independent forensic passes, 26 sampled episodes):

- The loop verifies *self-consistency*, not truth. Where a requested change landed in neither the
  spec nor the code, every check the loop can run passes — the two stale halves agree with each
  other. Coordinated staleness is the structural blind spot.
- Zero instances of the agent claiming done over *visible* contrary evidence. The supported
  sentence is "the model closes truthfully against everything it can see, while the contract drifts
  where nothing pinned it." Not "the model lies."
- Gates changed *what got committed and when tasks closed* — not truthfulness.

**Acknowledged instrument problems.**

- Artifact magnitudes ran 31–65% of measured events; the surviving effect was ~15% at n=6 seeds.
  Absolute claims sit below the instrument's own noise floor.
- The off-topic classifier misfired on 4 of 4 applicable tasks in the one E5 run. Fixed, but the
  fix has never seen live data.
- The set of ambiguities the hidden answer key pins is not provably closed — four audit rounds each
  found a new family.
- Spec *authoring* cost and error rate — the practice's real bottleneck — is measured nowhere.

## A4 — Constraints

- **Budget:** $13.40 of an $18 API stop-loss remains. The program is paused pending explicit
  authorization to spend.
- **Team:** one person, plus agentic coding tools.
- **Existing tooling:** a working harness that generates the task sequence, runs both arms, executes
  OpenSpec scenarios as HTTP tests, and scores against a hidden suite. Reusable.
- **Models:** direct API access to glm-5.2, deepseek-v4-pro, qwen-plus, and frontier models at
  higher cost.
- **Time:** no external deadline.

---

# Appendix B — Prompt A (Step 1, blind design)

```
You are advising a solo researcher who wants to publish a credible, practitioner-facing claim
about AI coding agents. Your job is to design the study independently. Do not assume any
particular implementation already exists — I want your design, not a review of mine.

THE CLAIM THEY WANT TO MAKE, to an audience of engineering leaders on LinkedIn:

  "Writing acceptance criteria as executable, Gherkin-style scenarios — and defining and running
  them in small increments — produces measurably better AI-agent work on an evolving codebase
  than spec-driven development that keeps the spec as prose, even when that prose spec is
  well-structured and scenario-shaped."

The comparator is a real, competent spec-driven-development workflow (OpenSpec), not a strawman.
The standard of proof is practitioner-credible, not peer-reviewed: a skeptical CTO should not be
able to dismiss the post in a single comment. Journal-scale statistical power is not required, but
the study still needs a decision rule declared before the run, per-episode results rather than
aggregates alone, uncertainty or consistency reporting, and replayable artifacts.

CONSTRAINTS: one person; ~$15 of model API budget remaining; agentic coding tooling available;
no deadline; API access to both mid-tier and frontier models.

Please deliver:

1. DECOMPOSITION. Break the claim into independently-falsifiable sub-claims. Flag any that are
   unfalsifiable as stated, or that smuggle in an assumption.

2. YOUR DESIGN. The cheapest study that could credibly support the claim. Be specific: what is
   the task, what exactly differs between conditions, what is held constant, what is measured,
   how many runs, and what result would count as a win. Name the specific confounds your design
   controls and how.

3. THE FALSIFICATION TEST. What result would show the claim is FALSE? If your design cannot
   produce that result, say so and fix the design.

4. PRIOR ART. Search for published evidence — papers, benchmarks, vendor studies, credible
   practitioner writeups — bearing on whether executable acceptance criteria or smaller work
   increments improve AI-agent coding outcomes. Include evidence AGAINST. Cite sources. If the
   claim is already established or already refuted somewhere, say so plainly.

5. THE TRAP. What is the most likely way a well-intentioned researcher building this study ends
   up measuring something other than what they think they are measuring? Be concrete.

Prioritize being useful over being encouraging.
```

---

# Appendix C — Prompt B (Step 2, attack the post)

> Fill in the draft post with the real numbers from whichever route is being tested before
> pasting. Give reviewers the post *only* — no methodology, no caveats, no packet.

```
Below is a draft LinkedIn post from a consultant who works on AI-assisted software development.
It will be read by engineering leaders — CTOs, VPs of Engineering, staff engineers — who have
seen a lot of overclaimed AI benchmarks and are primed to be skeptical.

Your job: write the ten most damaging public comments this post would receive. Not private
methodological notes — actual comments, in the voice of a skeptical senior engineer or CTO who
has read only the post.

For each, mark it:
  FATAL       — this comment ends the post's credibility; no reply saves it
  FIXABLE     — a single added sentence or one extra piece of evidence defuses it
  NOISE       — sounds sharp, doesn't land

Rank by damage. Then answer three questions:

  a) What is the single sentence in this post that a hostile reader quotes to dismiss the whole
     thing?
  b) What would the author need to have done differently — not said differently — for the FATAL
     comments to be unavailable?
  c) Is there a weaker claim, fully supported by the same work, that would draw no FATAL comments
     and still be worth posting? Write it.

--- DRAFT POST ---
[PASTE POST HERE]
--- END ---
```

---

# Appendix D — Prompt C (Step 3, construct validity)

```
You are auditing whether an experiment measures what its authors believe it measures. Reason
carefully; do not search the web. Be adversarial — your value here is finding the gap between
the construct and its operationalization, not confirming the design is reasonable.

[PASTE PACKET SECTIONS A1, A2, A3]

Please deliver:

1. CONSTRUCT MAPPING. For each sub-claim in section A1, state whether the manipulation described
   in A2 actually instantiates it. Where it does not, name precisely what the manipulation
   instantiates instead. Be literal about this — do not give credit for intent.

2. THE BORING EXPLANATION. Assume the current experiment produces a clean positive result for the
   treatment arm. What is the most mundane alternative explanation? Rank the candidates. Would
   this design distinguish them from the intended explanation? If not, the result is
   uninterpretable — say so.

3. GENERALIZATION. What is the widest population of real-world situations to which a positive
   result here would honestly extend? Consider: the task is procedurally generated rather than a
   real codebase; sequences are six tasks long; one model; hidden requirements the agent could
   not have inferred.

4. THE UNMEASURED VARIABLE. Section A3 notes that the cost and error rate of AUTHORING acceptance
   scenarios is measured nowhere, and that authoring correct scenarios appears to be hard. If
   authoring cost and authoring error are the dominant terms in real-world outcomes, what does
   that do to the claim? Could the claim be true in this experiment and false in practice?

5. THE ONE CHANGE. If you could change exactly one thing about this design to make its results
   bear on the intended claim, what is it, and why that one?

6. SALVAGE. Given the evidence ledger in A3 — including the negative results — what is the
   strongest claim that is ALREADY fully supported by work completed? State it as a single
   sentence a practitioner would find worth reading.
```

---

# Appendix E — Prompt D (Step 4, code verification)

> Run this against Claude Code and Codex separately, in parallel, without letting either see the
> other's output.

```
This repository implements the experiment described in the attached packet. Attached also is a
numbered list of external critiques written by reviewers who had NO code access. Reviewers
without code access reliably invent flaws that do not exist — in a previous panel on this repo,
11 of 19 findings were false and were retired with file:line refutations.

Your job is verification, not agreement.

TASK 1 — Audit the packet itself. For every factual assertion in packet sections A2 and A3, check
it against the code and the run records. Report any assertion the code contradicts, understates,
or overstates, with file:line. The packet is a draft; assume it contains errors.

TASK 2 — Adjudicate each numbered critique. For each, return exactly one of:

  CONFIRMED        — the code exhibits this problem. Cite file:line.
  REFUTED-BY-CODE  — the code demonstrably does not. Cite the file:line that refutes it.
  PARTIALLY-TRUE   — state precisely which part holds and which does not, with citations.
  UNDECIDABLE      — cannot be settled from code alone; state what evidence would settle it.

Do not soften a REFUTED into a PARTIALLY-TRUE to be diplomatic. A false finding retired with
evidence is more valuable than a hedged one kept alive.

TASK 3 — What did every reviewer miss? Having read the code, name any problem that would change
the interpretation of results and that appears nowhere in the critique list.

Rank your TASK 2 CONFIRMED findings and your TASK 3 findings together, by how much each would
change what can honestly be published.

--- PACKET ---
[PASTE]
--- CRITIQUES ---
[PASTE NUMBERED LIST]
--- END ---
```

---

# Appendix F — Prompt E (substrate selection)

> **SUPERSEDED ORDERING (corrected 2026-07-20).** This appendix originally ran *before* Step 0. It
> now runs **after Step 1**. Choosing a substrate before the blind design step anchors reviewers on
> the one question they were most valuable for answering independently; and the packet, which
> describes past runs, never depended on a future substrate choice. Step 1's Prompt A now carries the
> substrate question as deliverable 5, and its shortlist feeds this pass as one input among others.
> See the ordering correction at Step 1.

**Runs after Step 1.** Zero spend — deep research on chat subscriptions. This pass refines Step 1's
substrate answers under the strict literal-Gherkin filter; it is not the first time the question is
asked.

> ## FROZEN 2026-07-20 — before any scout has run
> 
> The criteria, hard exclusions, scorecard dimensions, and Pass 3 checks below are sealed. **They
> are not amended after seeing nominations.** If a nomination fails on a criterion that looks
> unfair in hindsight, it fails; the criterion changes only in a numbered successor version, which
> re-runs the scouts from scratch.

**Execution discipline.**

1. **Freeze before the first scout runs.** Done above. No amendment to criteria after nominations
   are visible.
2. **Preserve provenance.** Keep each scout's raw response verbatim, its cited sources, the model
   name and version, and the date. These are the artifacts; the merged table is derived.
3. **Score incumbents on the same rubric.** The three already-certified episodes get scored against
   this exact rubric — pass / fail / unknown, with evidence per line — identically to any scout
   nomination. **No prediction about their outcome is permitted in advance**, and none in this
   document should be read as one.
4. **Local scoring does not feed back into the prompt.** Scoring the incumbents cannot alter the
   scout prompt. The prompt is frozen; incumbent results are just more rows.
5. **One merged table to the critics.** Merge all scout outputs plus incumbents into a single
   candidate table. Pass 2 critics receive **only that table** — never the raw scout responses,
   never this document.
6. **Every nomination is unverified until Pass 3 passes.** A web-research nomination is a lead. No
   candidate is admitted, and no cost estimate from one is trusted, until the local mechanical
   checks succeed against a real clone.

**Models:** three fresh web-research models as scouts (Qwen, Gemini, DeepSeek or Kimi), separate
sessions. ChatGPT and Claude serve only as **second-pass critics** on the assembled candidate table
— not as independent scouts.

### Blocking decision: settle "Gherkin" before running this

If the published claim must literally earn the word *Gherkin*, two things follow, and the second is
the expensive one.

1. Any candidate where `.feature` execution could only ever be a rendered byproduct — rather than
   the runner the treatment arm actually uses — is disqualified up front.
2. **Both arms must receive the same semantic scenario content in the same artifact.** Either both
   see the `.feature` files, or a pinned OpenSpec→Gherkin conversion is visible and hashable to
   both. If treatment gets `.feature` files while control gets OpenSpec markdown, "Gherkin" becomes
   entangled with a format-and-context difference and the study no longer isolates execution. The
   only permitted difference is: **treatment can execute the suite and receives bounded results.**

That parity requirement raises the build cost of earning the word considerably. **Answer this
first; the search is not well-posed until it is settled.**

**DECISION (2026-07-20): earn literal Gherkin.** Borrowing the word later, after building on a
parsed-scenario path, would be retrofitting the headline onto the evidence. If the claim cannot
honestly use the word, the headline changes now rather than at publication.

The design that earns it while preserving the causal contrast:

- Both arms receive the same OpenSpec source **and** the same pinned, generated `.feature` artifact.
- Both arms may read either artifact.
- **Only treatment** receives the command to execute the `.feature` suite, and its bounded results.
- The `.feature` artifact is hash-pinned to its OpenSpec source, so semantic parity between the two
  representations is testable rather than asserted.

The causal variable stays *execution*, not format.

**Pre-declared stop rule.** Run the scouts under the strict filter. **If no credible candidate
survives at an affordable cost, Route 2 stops and the E4 limitation gets published instead.**
Weakening the construct midstream to keep Route 2 alive is not an available move.

Authoring roles and the selection/authoring conflict are governed by the authoring protocol in
Step 5's admission gate — see *Who authors blind*.

**Deliberately withheld from the prompt:** our existing candidate pool (114 scanned chains across
143 repos, 3 certified episodes in 2 repos), and our own criteria list. If independent searches
nominate repos in the same family we already scanned, that is weak but genuine support for the pool
we have. If they derive criteria we did not, that is the finding.

**What deep research can and cannot settle.** It can surface candidate repos, existing curated
datasets, and prior art on episode construction. It *cannot* verify the mechanical properties that
actually disqualify a substrate — Docker build time, suite runtime and flakiness, whether dependent
change chains exist with file coupling, whether the public surface is stable across the chain. Those
get screened locally against the existing chain scanner afterward. Do not let a model's confident
recommendation substitute for that screen.

**Highest-value possible find:** an existing curated dataset of *dependent, multi-step* changes with
tests. SWE-bench and its descendants are single-issue. If sequences already exist somewhere, it
removes the most expensive part of Route 2 — building certified episodes by hand.

> ### FOUND 2026-07-21 — two incumbents added, frozen criteria untouched
>
> Step 1 surfaced and local verification confirmed two datasets that meet the dependent-multi-step
> requirement. **This does not amend anything sealed above** — the criteria, hard exclusions,
> scorecard dimensions and Pass 3 checks are unchanged, the scout prompt is unchanged, and our own
> candidate pool stays withheld from the scouts as before. These enter as **incumbents to be scored
> on the same rubric as everything else**, per execution-discipline point 3.
>
> - **ChainSWE** (arXiv 2607.02606) — 304 problems, 54 Python projects, per-step fail-to-pass and
>   pass-to-pass lists, MIT, HuggingFace, reuses pre-built SWE-bench Docker images. Ships the
>   oracle-state-progression control we would otherwise have to build. **Known weakness: its chains
>   are co-location dependency, not requirement dependency** — assembled by AST overlap and
>   clean-patch-application, so step *N* touches step *N*-1's code without needing its behaviour.
>   Filter before trusting the chain property.
> - **SWE-Milestone** (arXiv 2603.13428, published as *EvoClaw* in v1 — cite by ID and current title)
>   — prerequisite DAG with explicit constraints rather than inferred overlap, per-task isolated
>   evaluation snapshots, MIT, DockerHub, adapters for four agent frameworks. **The better fit for
>   genuine prerequisite dependency and the most mature harness.**
> - **SWE-EVO** (arXiv 2512.18470) — real and useful as a long-horizon multi-file substrate, but its
>   tasks are **independent**, each from a pre-release base snapshot. Does not meet the requirement.
>
> **The half that is still ours to build: hidden per-step checks.** None of the three hides tests by
> default; ChainSWE and SWE-EVO expose fail-to-pass lists as part of the instance, which is exactly
> the confound the reward-hacking literature was built to study. A visible/held-out split must be
> constructed over whichever substrate is chosen. That is real work — and far less than building the
> chain substrate by hand.
>
> Pass 3's local mechanical checks apply to these two exactly as to any scout nomination. A verified
> paper and a released MIT dataset are still a lead, not an admission.
>
> **SCREENED 2026-07-21 (partial Pass 3, $0):** ChainSWE **REJECTED** (3 usable chains, co-location
> not dependency, 1 test/step); SWE-Milestone **QUALIFIED GO for a private pilot** with four caveats
> (model-authored DAG needing free self-verification; 3/7 repos with a public surface; SRS+native
> suites not `.feature`; ~180 GB images and $30–120/chain — several × the remaining stop-loss). The
> container-level Pass 3 checks (leave-one-out edges, no-op-fails, gold-passes, transfer floor) were
> NOT run — no disk-adequate host. Full report:
> `docs/protocols/e5-step1-blind-design-20260721/SUBSTRATE-SCREENS-v1.md`.

### Pass 1 — scouts (three fresh models, separate sessions)

```
You are helping select the software substrate for a small, practitioner-facing experiment on AI
coding agents. I want your independent judgment. Do not assume any particular repository or
dataset is already in play.

THE EXPERIMENT. An AI coding agent works through a sequence of related changes to an existing
codebase — four to eight changes, each building on the last, carried forward in one workspace. Two
conditions, identical in every other respect: in one, the agent can execute a written acceptance
specification for each change as it works; in the other, it can read the same specification but
cannot run it. Both retain normal shell and public-test access. We measure, against tests the agent
never sees, whether it introduces regressions and whether it declares work finished while those
hidden tests fail.

THE AUDIENCE. Results go to a LinkedIn post read by CTOs and staff engineers, not to a journal. It
must survive public attack. A reader who thinks "that benchmark looks nothing like my codebase"
has already dismissed it.

THE TENSION I want you to resolve, not dodge: methodological rigor pulls toward curated benchmark
episodes with known-good patches, hidden tests, and controllable training-data contamination.
Audience credibility pulls toward software a working engineer recognizes as real. These usually
conflict. Tell me how you would resolve it and what you would give up.

CONSTRAINTS: one person; a low-tens-of-dollars model budget; Docker available; agentic tooling
already built; no deadline.

A CANDIDATE IS NOT A REPOSITORY NAME. To count, a candidate must identify all of:
  - an exact open-source repository;
  - a specific base commit, plus 4–8 chronological, mutually compatible changes (PRs, issues, or
    commits) that build on one another;
  - a public API, CLI, or HTTP boundary that acceptance scenarios can execute against;
  - a plausible independent held-out oracle — historical tests, later verification, or equivalent;
  - a containerized or otherwise reproducible local test path;
  - a credible story for engineering leaders.

HARD EXCLUSIONS: synthetic or generated projects as the main substrate; change sequences that
deliberately invalidate earlier behavior; anything requiring external services you cannot stand up
locally; repositories where scenarios could only assert private implementation details; any
suggestion without exact repository and commit/PR links.

Please deliver:

1. CRITERIA. Derive the selection criteria yourself, from the experiment's requirements. Rank them,
   and mark hard disqualifiers versus preferences. I have my own list and am deliberately not
   showing it to you — the difference is what I am buying.

2. EXISTING DATASETS. Search hard for curated datasets of MULTI-STEP or SEQUENTIAL code changes
   with tests — dependent commits or pull requests, not one-issue-one-patch. Cover SWE-bench and
   its descendants, agent-training environments, regression-testing corpora, and the continuous-
   integration research literature. For each: contents, size, license, whether steps are genuinely
   dependent, and whether hidden tests can be separated from visible ones. If nothing suitable
   exists, say so plainly — that is a valuable answer, and finding one would remove the most
   expensive part of this study.

3. NOMINATIONS. Three to five candidates meeting the full definition above. Favor variety of domain
   over piling up similar candidates. For each, state its most likely disqualifier and how a
   skeptical CTO would react to seeing it named in a post.

4. SCORECARD. Score each candidate 0–5 on: real-world credibility; quality of the 4–8 change
   sequence; executability of scenarios against the public surface; viability of an independent
   held-out oracle; reproducibility and expected solo-operator cost; and risk that passing the
   visible scenarios merely teaches to the test.

5. CONTAMINATION. Which candidates are most likely memorized by current frontier models, and how
   would you check rather than assume?

6. THE PUBLIC SURFACE PROBLEM. Which candidate kinds make scenario execution against a stable
   public interface easy, which make it nearly impossible, and what surface characteristics should
   be a hard filter?

7. THE COST FRONTIER. Name the cheapest candidate that could still support the claim, and the
   strongest candidate even if it costs considerably more.

8. WHAT WOULD MAKE YOU WALK AWAY. Is there a class of substrate you would refuse to run this on,
   even if it scored well otherwise? And if no candidate can support the claim at this budget, say
   so plainly and name the strongest narrower claim that a viable candidate could support.

Cite primary sources — repository, commits, PRs, CI configuration, release notes, official docs.
Separate what you verified from what you are inferring. Do not flatter the premise.
```

### Pass 2 — critics (ChatGPT and Claude, given the merged candidate table only)

```
Assume the attached candidates are being considered as the substrate for a public claim about AI
coding agents. Attack their suitability.

Which one would a skeptical CTO find least toy-like? Which is most likely to fail the transfer
test — where passing the visible acceptance scenarios does not predict correctness on held-out
tests? Cite the evidence in the supplied table. Separately, list what cannot be settled from this
table and requires local verification.

--- CANDIDATE TABLE ---
[PASTE MERGED SHORTLIST + SCORECARDS]
--- END ---
```

### Pass 3 — local, mechanical, non-negotiable

No model recommendation substitutes for these. Run against the top candidates only:

1. Clone and build the candidate.
2. Verify the exact historical change chain — that the changes are real, ordered, and dependent.
3. Confirm a real `.feature` runner reaches the public boundary.
4. Prove the do-nothing patch fails and the known-good patch passes, on both visible scenarios and
   held-out checks.
5. Run the pre-declared defective variants and measure visible-to-held-out agreement against the
   floor set in C4.

> **For SWE-Milestone specifically, checks 2 and 4 are pre-registered and frozen (2026-07-21) in
> `docs/protocols/e5-step1-blind-design-20260721/SWE-MILESTONE-VERIFICATION-SPEC-v1.md`** — a
> zero-model-spend leave-one-out edge verification on scikit-learn that settles the one disqualifier a
> container run can settle (is the dependency DAG real requirement dependency or co-location?), plus
> per-check no-op discrimination and an on-disk calibration. Checks 3 (`.feature` runner) and 5
> (defective-variant transfer floor) remain deferred — they need authored material, not just execution.
> Passing the spec's gate is a lead into Step 5, not a commitment to Route 2.
