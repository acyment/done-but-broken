# E2 Executable-Spec Experiment — External-Review Prompt (v1)

Status: **working artifact** (a prompt, not a protocol). Hand this to an external reviewing agent that has
access to both repositories, to pressure-test the redesigned experiment (executable "BDD" spec vs read-only
"SDD" spec, on brownfield repos, with the authored Gherkin spec as the sole oracle). Date: 2026-07-02.
Supersedes the GitHub-issue / gold-matching substrate; see the offline-pilot findings doc + Addendum C for
why. Paste everything in the fenced block below.

**Update (2026-07-02):** the fierce-critique on this prompt landed a verdict — *don't run the full design;
run a cheap staged probe first*. The redesigned experiment below is now **Stage-1 material**; the immediate
next step is the **Stage-0 probe** (`e2-executable-spec-stage0-probe-protocol-v1.md`) governed by a
pre-registered **decision rule** (`e2-executable-spec-decision-rule-v1.md`).

```
You are helping design a rigorous experiment, and you have our codebase available. Inspect it first, then
engage with the open problems at the end. Ground every suggestion in what actually exists — don't reason
purely in the abstract, and don't just restate our setup back to us. Most important: if the whole design is
misconceived, say so plainly — we want a teardown, not encouragement (see the FINAL section, which overrides
the rest).

## You have our repositories — use them before answering
- Harness repo (GitHub: acyment/done-but-broken-harness; local: hit-sdd-bench-e2) — the working code.
  Look especially at src/hit_sdd_e2/authored_spec/: execution.py (Docker runner — checks out a repo at a
  commit, applies a patch, runs pytest-bdd checks in the real image), openspec.py + compiler.py (the JIT
  OpenSpec → Gherkin → pytest-bdd converter), the run_spec executor the agent-under-test calls (this IS the
  "executable" arm), gates.py (task admission: non-triviality/fails-on-no-op, a mutation-style tautology
  audit, flake-cert), surface.py (public-API introspection), base_validation.py (an author-time red-first
  loop).
- Record repo (GitHub: acyment/done-but-broken; local: hit-sdd-bench) — design + findings under
  docs/protocols/, especially the offline-pilot findings doc and "Addendum C".
Say concretely which pieces transfer to the design below, which to drop, which must be built.

## The product and the hypothesis
We're building a developer tool around EXECUTABLE Gherkin acceptance specs: teams describe features as
runnable Gherkin scenarios (backed by step definitions → real automated tests), and AI coding agents
implement features against them.

Hypothesis: an agent that can EXECUTE the acceptance spec — run it, see pass/fail, iterate — builds
features more correctly, and especially avoids "done but broken" (declaring a task complete while it
actually fails the spec), than an agent that has the same acceptance criteria only in readable form. We
care about that false-confidence "done but broken" gap most of all.

## Strategic context (why this matters, and where OpenSpec fits)
This experiment is meant to produce evidence for a future product that positions BDD (behavior-driven
development — acceptance criteria written as EXECUTABLE Gherkin behavior specs) as a better, complementary
evolution of SDD (spec-driven development — writing a spec first and implementing to it, e.g. the OpenSpec
tool/format). The product thesis: the same "spec-first" discipline is materially more effective when the
spec is EXECUTABLE (BDD) than when it is read-only documentation (SDD). So the two arms are deliberately
"plain SDD" (read the spec) vs. "executable BDD" (run the spec), and a credible win maps directly onto
"BDD is a better version of SDD."

OpenSpec is the shared spec vehicle. It's a real, industry-standard SDD format (a proposal with Purpose /
Requirements / Scenarios written as WHEN/THEN — "almost-Gherkin"). Using it keeps the SDD baseline honest —
a genuine SDD workflow, not a strawman prose paragraph. Both arms receive the same OpenSpec spec. The
treatment additionally gets that spec's scenarios auto-converted (our JIT OpenSpec → Gherkin → pytest-bdd
converter) into a runnable executable spec it can execute; the control gets only the readable OpenSpec
document. So "the same spec, executable vs. read-only" is literally "a BDD layer on top of the OpenSpec SDD
spec."

## One relevant prior result (a hypothesis to pressure-test, not a settled fact)
An earlier, differently-designed version of this work found that giving an agent executable acceptance
feedback sharply cut false-confidence and roughly doubled solve rate for one model — but the effect shrank
for strong frontier models that had shell access: they COULD write and run their own tests, yet often
didn't, so the benefit mostly appeared when the acceptance contract was actually provided and wired for
them. This cuts both ways for the "core threat" question below: it's why we suspect a provided/wired spec
matters, but it also means a diligent control could close the gap. (Single-model, not broadly validated.)
Full history is in the record repo under docs/protocols/ if you want it.

## Hard constraints (decided; do not try to relax these)
1. Not testing "spec vs no spec." The value under test is EXECUTABILITY of the spec, not writing specs. The
   product presents executable behavior specs (BDD) as better than read-only specs (SDD).
2. Brownfield only. Real, existing, messy codebases; feature-ADDITION tasks hard enough to stress frontier
   models. (Toy/greenfield → both arms score ~100% → no measurable difference.)
3. The executable Gherkin spec is the SOLE functional oracle. No hidden test suite. Gherkin is spec and
   test in one artifact: a hidden test either encodes a real requirement (belonged in the spec), or it
   doesn't (unfair to grade on), or it probes internals (breaks black-box). If a behavior matters, it must
   be in the readable OpenSpec spec.
4. Do NOT grade by matching a reference ("gold") solution. That produced false failures — spec asserts a
   tuple, reference returns a list; both valid, correct code rejected for style. Grade against spec
   behavior only.
5. Anti-gaming lives in a THOROUGH spec — the readable OpenSpec scenarios state general rules, and the step
   definitions verify those rules over many varied/generated inputs so passing requires genuinely building
   the feature — NOT in a hidden oracle.

## The two arms (realistic — get it right)
BOTH arms get: the brownfield app repo (full read/write code access, like any developer) + the feature's
acceptance criteria as the readable OpenSpec spec (Purpose / Requirements / WHEN-THEN scenarios stating the
general rules, with a few illustrative examples; NO step-definition/test code) + all normal tools (shell;
may write and run their own tests).

TREATMENT ("BDD") additionally gets: those same OpenSpec scenarios auto-converted into a runnable Gherkin
executable spec (step definitions) it can execute to check its work. That executability is the product's
contribution.

CONTROL ("plain SDD") never receives the step-definition code. If it wants to verify itself, it writes its
own tests from the readable OpenSpec spec — exactly what a developer without the product does today.

Contrast: "here is the spec, plus a one-click way to run it against your work" vs. "here is the spec — good
luck." (The old idea of giving the control the exact step-definition code but disabling execution is
UNREALISTIC — nobody has someone's un-runnable test code lying around — so it's out.)

## Grading, and the fairness rule that replaces a hidden oracle
Both arms' final code is graded by us against the executable spec (the step definitions), experimenter-side.
Neither arm's own tests are used for grading — we run OUR sealed checks on whatever code each ships, so a
control that writes no tests is graded identically. The control never SEES the step-definition code but is
graded by it; this is fair — and NOT a hidden oracle — ONLY IF the checks verify exactly the requirements in
the readable OpenSpec spec both arms received, and NOTHING MORE.

That "nothing more" is the linchpin. If a check pins a design choice the readable spec left open (asserts a
list where the spec only said "the set of matching policies"), a correct control that chose a tuple FAILS —
and worse, because only the treatment can see/run the checks, the treatment would discover and satisfy that
hidden requirement while the control couldn't, MANUFACTURING a fake win. So we validate the checks in BOTH
directions at task admission: broken implementations must FAIL (non-vacuity, mutation-style), and several
independent, deliberately-DIFFERENT correct implementations must all PASS (non-over-specification). If any
legitimate alternative fails, the checks over-specify → fix them, or lift the requirement into the readable
spec so both arms have it. If we can't accept every valid implementation while rejecting broken ones, the
task's spec is genuinely ambiguous → drop the task.

## The conundrum (cheating)
Pass/fail can't distinguish a GENUINE implementation from a CHEAT: special-casing the test conditions,
degenerate code that satisfies the checks without implementing the feature, and — since only the treatment
can SEE and RUN the checks — hardcoding to them or tampering with them. Some is catchable mechanically: lock
the checks and re-grade every submission with a pristine copy and freshly generated inputs (defeats
tampering and naive hardcoding). But subtler semantic cheating survives a mechanical re-grade. For that we
think we need an EXTERNAL, arms-length judge (a separate agent or human) that reads each implementation and
rules honest vs. cheated — an integrity check on the implementation, NOT a hidden test (it adds no
requirements). Because only the treatment can see/run the checks, gaming is ASYMMETRIC: the judge matters
most for the treatment — is its advantage real building, or better gaming?

## Open design axis — who authors the step definitions?
- Option A (our default): We author the executable spec (OpenSpec scenarios + wired step definitions) and
  seal it. Treatment runs it; control gets the readable OpenSpec spec only; the agent writes only the
  feature. Aligns with "the product provides wired executable specs," and the cheat-judge only has to check
  the feature.
- Option B: The agent turns the readable OpenSpec/Gherkin into its own step definitions, then implements —
  closer to some BDD workflows. But under our constraints it's unclear how to grade it fairly: grading
  against the agent's own checks is circular/gameable, and grading against checks neither arm authored is
  the hidden oracle we ruled out. Is there a coherent Option B, or does it collapse into A?

## What we want from you
1. Is the external cheat-judge the right residual solution (on top of the mechanical re-grade), or is there
   a cleaner way to keep the comparison honest without a subjective judge, given hidden tests and
   gold-matching are out?
2. Resolve the step-definition authorship axis: is A the only coherent option under our constraints, or is
   there a real, gradeable B? Recommend one.
3. If the judge is an AI (for cost/scale), how do we keep IT reliable and non-gameable? Concrete protocol.
4. THE CORE THREAT: the control has the concrete, complete readable OpenSpec spec AND can write and run its
   own tests. So the treatment's only real edge is catching its own mistakes against the official provided
   checks. Will that gap survive on hard brownfield features? Is a small/null result a genuine finding
   (writing your own tests from a good SDD spec is nearly as good as being handed runnable ones) or a sign
   the experiment can't detect what we care about? Design it so the result is interpretable either way.
5. THE FAIRNESS LINCHPIN: an over-specified check advantages the treatment (which can see it) over the
   control (which can't), manufacturing a fake effect. How do we author checks that pin EXACTLY the readable
   spec's requirements and nothing more, and validate the "nothing more"? Is "several independent
   correct-but-different implementations must all pass" sufficient, or is there a stronger method?
6. Which of our existing machinery (see the repos) transfers to this design, which to drop, which to build?
7. What are we missing — the failure mode that could sink "executable Gherkin = sole oracle + readable
   OpenSpec control + mechanical re-grade + external cheat-judge, on brownfield repos"?
8. Does the design credibly support the strategic claim "BDD (executable specs) beats plain SDD (read-only
   specs)"? Where is that mapping weakest, and how would you strengthen it?
9. Steelman the skeptic who says the cheat-judge just reintroduces the subjectivity/hidden-oracle problem
   we were trying to avoid — then answer them, or concede.

Respect the hard constraints in every suggestion (except in the FINAL section below, where you may attack
them). Keep proposals runnable with a few model families and tens of tasks, not thousands.

## FINAL AND OVERRIDING — is this worth running at all? (fierce critique invited, and it may be warranted)
We have iterated on this design for a long time and have absorbed our own assumptions. We want an outside
teardown, not validation. This section overrides the rest: you have full permission to conclude the
experiment is misconceived and should NOT be run, and to attack even the "hard constraints." Do not be
constructive for its own sake — if it's flawed, say kill it, and say why.
- Attack the premise. Is "an executable acceptance spec beats the same spec read-only" a real, non-obvious,
  decision-relevant question — or is the answer already known / trivially yes / hopelessly confounded, such
  that no result changes what a rational person would build?
- Attack interpretability. Is there ANY outcome (positive, null, or mixed) a hostile senior engineer would
  accept rather than explain away? If both a positive and a null are dismissible, the experiment is theater
  — say so.
- Attack the constraints. Do our self-imposed rules (sole authored oracle, no hidden tests, no gold-matching,
  black-box only, brownfield only) paint us into a corner where the experiment cannot measure the thing the
  product decision actually rests on? Which constraint should we break, and what does breaking it buy?
- Attack the confounds we've waved away: spec quality dominates the outcome; the control can just self-test;
  brownfield noise swamps the effect; the cheat-judge is irreducibly subjective; small N; task selection bias.
- The bottom line we want, stated plainly: what is the single most likely reason this entire effort is
  wasted, how large is that risk, and — if you were spending our money — would you (a) run this, (b) run a
  cheaper/different experiment (specify it), or (c) skip experimentation and just ship the product and learn
  from real usage? Pick one and defend it.
```
