# Research prompt: what kinds of coding tasks make a top AI model confidently wrong?

**Status**: research prompt, v1 (2026-07-03). Handed to external thinking agents; the operator picks
the models/chatbots. Results feed Stage-0 task-pool re-selection. This document is self-contained —
the agent reading it needs no access to our code or prior documents.

---

You are a research assistant. Your job is to figure out, with evidence, **what properties of a
software task make a top-tier AI coding model finish the task, declare it done, and be wrong** —
while a fixed acceptance test suite would have caught the mistake. Read the whole brief before
answering; the precise failure mode we need is narrower than "hard tasks."

## Our experiment, in one paragraph

We run a controlled experiment on AI coding agents. The agent works inside a real open-source
repository (an existing codebase, not a toy) and receives a written specification of a change to
make — the spec states the acceptance criteria in plain WHEN/THEN language. The agent has a shell:
it can read code, edit files, write and run its own tests. When it says it's finished, we take its
final code and grade it against a sealed executable acceptance suite that encodes exactly the
requirements stated in the written spec — nothing more. The agent never sees this suite. Our
measurement is not "did it solve the task"; it is **"did it claim success while actually failing
the acceptance criteria it was shown."** We call that a false-confidence event.

## What we just observed

On a well-scoped bug-fix task (a Python decorator crashed when test functions had a particular
parameter name), a top-tier model solved the task **6 out of 6 times** — it wrote its own tests,
checked its work, and was genuinely correct every time. No false confidence, nothing to measure.
A mid-tier model on the same task solved 3/6 and claimed success while wrong 1/6 — the effect
exists, but at the top tier this class of task is saturated.

## The central tension you must engage with

Our experiment has fairness constraints (below), and they create a trap: **a task that is
unambiguous and fully specified tends to be self-verifiable** — a strong agent can transcribe the
WHEN/THEN criteria into its own tests, run them, and catch its own mistakes before declaring done.
So naive "make it harder" fails in two ways:

- Make the task harder but still self-verifiable → the top model just iterates longer and still
  gets it right (what we observed).
- Make it harder by making it ambiguous or under-specified → the grading becomes unfair (we'd be
  failing the agent on requirements it was never told), which destroys the experiment.

The research question is therefore precise: **what breaks the link between "fully specified" and
"self-verifiable"?** Where does a strong agent's own testing systematically miss failures that a
fixed acceptance suite — encoding the same stated requirements — still catches?

## Three regimes — only one produces signal

For any task, a model lands in one of three regimes. Note carefully which one we need:

1. **Solves it** → no signal (top models on well-scoped fixes).
2. **Fails and knows it** — hedges, reports failure, runs out of budget without claiming success
   → also no signal. A task where models flounder *visibly* is useless to us.
3. **Fails and claims success** → this is the only regime that produces our measurement.

Many "hard for LLMs" task lists optimize for regime 2. We need properties that predict regime 3
specifically: the model's own verification loop returns green (or it skips verification) while the
stated acceptance criteria are violated.

## Hard constraints — any proposed task type must fit ALL of these

- **Fully specified**: every graded requirement is stated in the readable spec the agent sees.
  No hidden requirements, no "gotcha" criteria.
- **Black-box observable**: the acceptance criteria are checkable through the code's public
  interface (public API calls, CLI invocations, HTTP endpoints) — not by inspecting internals.
- **Deterministic and sandboxed**: the acceptance suite must produce the same verdict every run,
  inside an offline container. No network, no wall-clock flakiness, no hardware dependence.
- **Satisfiable**: a correct implementation exists and passes (we verify this with reference
  implementations before using a task).
- **Brownfield**: real existing codebases. Greenfield/toy problems are out of scope.
- **Graded on final code only**: process doesn't matter; only whether the finished code meets the
  stated criteria.

## Research questions

1. **Task-property taxonomy.** What properties of a coding task cause a strong model's
   self-verification to return a false green? For each property, explain the *mechanism* — why does
   the model's own testing miss it while a fixed suite catches it? Candidate directions to examine,
   extend, or refute (do not limit yourself to these):
   - The fix interacts with distant code: the change is locally correct but breaks a stated
     requirement whose effect surfaces elsewhere in the codebase (the model tests the change site,
     not the interaction).
   - Wide input spaces: the spec's criteria quantify over many input classes (encodings, locales,
     boundary shapes, malformed variants); the model samples two or three friendly cases and
     declares victory.
   - State and sequence: requirements about behavior across sequences of operations (idempotency,
     ordering, accumulated state, resource cleanup) where single-shot tests pass.
   - Concurrency and reentrancy stated as requirements, reproducible deterministically.
   - Requirements that contradict the model's priors: the spec demands behavior that differs from
     what the API's name/convention suggests, or from the most common implementation in training
     data — the model implements the *plausible* thing, tests the plausible thing, and both agree.
   - Verification cost asymmetry: checking correctness properly is expensive (large matrix of
     cases), so the model satisfices; the fixed suite pays the cost once at grading time.
   - Multiple stated criteria with a long tail: the model verifies the headline criterion and
     forgets criterion #7.
2. **Evidence.** For each property: what published evidence exists that frontier-class models
   actually fail *with confidence* there? Benchmarks with per-task solve + overclaim data,
   papers on LLM self-verification blind spots, test-generation coverage studies, postmortems,
   competition results. Distinguish evidence of regime 3 from mere difficulty (regime 2). Absence
   of evidence is a finding too — say so.
3. **Selection criteria.** Turn the taxonomy into a practical screening checklist: given a pool of
   real GitHub issues from open-source repos (bug fixes and small features with merged fixes),
   what observable signals predict a task will produce regime-3 events for a top model? What
   signals predict saturation (anti-criteria)? We can measure things like: files touched by the
   real fix, spread of the fix across the codebase, number of distinct WHEN/THEN criteria, size of
   the stated input space, whether the requirement contradicts library convention, test-suite
   latency.
4. **Archetypes.** Give 5–10 concrete task archetypes ("issue looks like X in a repo of type Y")
   ranked by expected regime-3 yield for a top model, each with the mechanism and a real-world
   example if you can find one.

## Quality bar

- Cite sources for empirical claims; separate evidence from your own reasoning.
- Actively look for disconfirming evidence — especially results showing frontier models' own test
  generation is good enough to close each proposed gap.
- If the honest answer to some direction is "top models don't confidently fail there anymore,"
  say it plainly; a shorter list of properties that survive scrutiny beats a long speculative one.
- Plain language throughout. No invented jargon.
