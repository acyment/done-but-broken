# Two-stage research prompts: what kinds of coding tasks make a top AI model confidently wrong?

**Status**: research prompt pair, v2 (2026-07-03). Supersedes v1 (single prompt for all modes).
**Pipeline**: run **Prompt A** on 1–2 deep-research tools first → paste their reports into
**Prompt B** → run Prompt B on 2–3 thinking models. The operator picks models/chatbots.
Both prompts are self-contained; the agents need no access to our code or prior documents.

Design notes (ours, not part of either prompt): Stage A is retrieval-shaped and produces a
structured evidence dossier; Stage B is reasoning-shaped and consumes the dossier. Anti-anchoring:
Prompt B explicitly instructs the thinking model to treat the dossier as input — grade it, discard
weak items, and propose mechanisms the dossier never mentions. That preserves the independent
mechanism-generation that unprimed critiques have historically delivered.

---
---

## PROMPT A — evidence dossier (for deep-research tools)

You are a research assistant with web access. Your ONLY job is to gather and grade **published
evidence** on a narrow question. A separate reasoning step will interpret your dossier later, so
structure and honesty about evidence quality matter more than your own conclusions.

### The question

When do top-tier AI coding models (the strongest current LLM agents, with shell access and the
ability to write and run their own tests) finish a coding task, **claim success, and be wrong**?

The distinction that matters — classify every piece of evidence into one of three regimes:

1. **Solves it** — the model is genuinely correct.
2. **Fails and knows it** — the model reports failure, hedges, or gives up.
3. **Fails and claims success** — the model's own verification returned a false green (or it
   skipped verification) and it declared the work done while acceptance criteria are violated.

**Only regime 3 is the target.** The bulk of "LLMs struggle with X" literature documents regime 2
and is nearly useless to us. Evidence must speak to *overclaiming*, not mere difficulty: per-task
data separating solve rate from claimed-success rate, self-verification blind-spot studies,
LLM-generated-test coverage/adequacy studies, agent postmortems where the agent asserted success.

### Where to look (extend freely)

- Coding-agent benchmarks that record both outcome and the agent's own success claim
  (or termination reason) per task.
- Studies of LLM self-verification, self-testing, or self-repair loops — especially failure
  analyses of *why* self-generated tests pass on wrong code.
- Test-generation research: coverage/mutation-adequacy of LLM-written tests vs. human suites.
- Domains repeatedly claimed hard for self-verification: cross-module interactions and
  regressions, wide input spaces (encodings, locales, boundary/malformed inputs), stateful and
  sequential behavior (idempotency, ordering, cleanup), deterministic concurrency, requirements
  that contradict API-name conventions or common training-data implementations, tasks with many
  distinct acceptance criteria.
- Disconfirming evidence gets equal priority: results showing frontier models' own test
  generation closes these gaps, or that overclaiming has fallen to negligible rates at the
  top tier.

### Output format (strict)

For EACH finding, one entry:

- **Claim**: one sentence, in plain language.
- **Source**: name, venue/URL, year. Prefer 2024+ for model-capability claims; older is fine for
  testing-theory claims (coverage, mutation adequacy).
- **What was actually measured**: models, tasks, n, the metric. Quote the key number.
- **Regime relevance**: 3 (overclaim shown), 2 (difficulty only), or mixed — with one line of
  justification. Be strict: if the study never separates "failed" from "claimed success while
  failing," it is regime 2.
- **Quality**: strong / moderate / weak, one line why (sample size, model tier, recency,
  directness).

Then two closing sections:

- **Gaps**: what you searched for and could NOT find. Absence of regime-3 evidence for a popular
  "hard for LLMs" claim is a first-class finding — list each such case explicitly.
- **Disconfirmations**: evidence that top-tier self-verification is good enough to close specific
  gaps.

Do not build a taxonomy, do not rank task types, do not give recommendations — that is the next
stage's job. Your dossier will be judged on regime discipline and citation accuracy.

---
---

## PROMPT B — mechanism taxonomy and task selection (for thinking models; paste dossiers below)

You are a research analyst. Your job is to figure out **what properties of a software task make a
top-tier AI coding model finish the task, declare it done, and be wrong** — while a fixed
acceptance test suite would have caught the mistake. You will reason from first principles AND
from evidence dossiers compiled by research assistants (pasted at the end). Read the whole brief
first; the failure mode we need is narrower than "hard tasks."

### Our experiment, in one paragraph

We run a controlled experiment on AI coding agents. The agent works inside a real open-source
repository (an existing codebase, not a toy) and receives a written specification of a change to
make — the spec states the acceptance criteria in plain WHEN/THEN language. The agent has a shell:
it can read code, edit files, write and run its own tests. When it says it's finished, we take its
final code and grade it against a sealed executable acceptance suite that encodes exactly the
requirements stated in the written spec — nothing more. The agent never sees this suite. Our
measurement is not "did it solve the task"; it is **"did it claim success while actually failing
the acceptance criteria it was shown."** We call that a false-confidence event.

### What we observed

On a well-scoped bug-fix task, a top-tier model solved the task **6 out of 6 times** — it wrote
its own tests, checked its work, and was genuinely correct every time. Nothing to measure. A
mid-tier model on the same task solved 3/6 and claimed success while wrong 1/6 — the effect
exists, but at the top tier this class of task is saturated.

### The central tension

Our fairness constraints create a trap: **a task that is unambiguous and fully specified tends to
be self-verifiable** — a strong agent can transcribe the WHEN/THEN criteria into its own tests,
run them, and catch its own mistakes before declaring done. Naive "make it harder" fails both
ways: harder-but-self-verifiable means the top model iterates longer and still wins;
harder-via-ambiguity makes our grading unfair and destroys the experiment. So the question is
precise: **what breaks the link between "fully specified" and "self-verifiable"?** Where does a
strong agent's own testing systematically return a false green that a fixed suite — encoding the
same stated requirements — still catches?

### Three regimes — only one produces signal

1. **Solves it** → no signal.
2. **Fails and knows it** (hedges, reports failure, exhausts budget without claiming success)
   → also no signal. Tasks where models flounder *visibly* are useless to us.
3. **Fails and claims success** → the only regime that produces our measurement.

### Hard constraints — every proposed task type must fit ALL of these

- **Fully specified**: every graded requirement is stated in the readable spec the agent sees.
- **Black-box observable**: criteria checkable through the public interface (public API, CLI,
  HTTP) — never by inspecting internals.
- **Deterministic and sandboxed**: same verdict every run, offline container, no flakiness.
- **Satisfiable**: a correct implementation exists and passes.
- **Brownfield**: real existing codebases.
- **Graded on final code only.**

### How to use the evidence dossiers (pasted below)

The dossiers were compiled by retrieval-focused assistants. Treat them as **input, not ground
truth**:

- Re-grade regime relevance yourself; downgrade or discard anything that is regime-2-only.
- Where a mechanism you believe in has NO dossier support, say so explicitly and keep it as a
  clearly-labeled hypothesis — a mechanism without evidence can still be worth a cheap empirical
  probe on our side.
- Where the dossier contradicts a mechanism, engage with the contradiction; don't silently drop
  either side.
- Propose mechanisms the dossiers never mention. Retrieval has blind spots; finding what it
  missed is part of your job.

### Deliverables

1. **Mechanism taxonomy.** Properties of a task that cause a strong model's self-verification to
   return a false green. For each: the mechanism (why the model's own tests miss it while a fixed
   suite catches it), the supporting or contradicting dossier entries, and a verdict —
   *evidence-backed*, *hypothesis worth probing*, or *rejected*.
2. **Screening checklist.** Given a pool of real GitHub issues (bug fixes and small features with
   merged fixes in open-source repos), what observable signals predict regime-3 events for a top
   model? What signals predict saturation (anti-criteria)? Prefer signals we can measure cheaply:
   spread of the real fix across files, number of distinct WHEN/THEN criteria, size of the stated
   input space, whether the requirement contradicts library convention, cost of thorough
   verification vs. a quick check.
3. **Task archetypes.** 5–10 concrete archetypes ("issue looks like X in a repo of type Y"),
   ranked by expected regime-3 yield for a top model, each with its mechanism and — where the
   dossier provides one — a real-world example.
4. **The honest bottom line.** If your analysis concludes that top-tier models no longer produce
   regime-3 events at meaningful rates on ANY task class fitting our constraints, say so plainly
   and say what that implies (the measurable effect may live only at mid-tier). A true negative
   is more valuable to us than a padded taxonomy.

### Quality bar

Plain language, no invented jargon. Separate evidence from reasoning. Actively try to break your
own taxonomy before submitting it.

---

## [PASTE THE STAGE-A DOSSIER(S) BELOW THIS LINE]
