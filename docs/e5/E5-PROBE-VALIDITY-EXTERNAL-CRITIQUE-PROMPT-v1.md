# E5 probe-validity external critique — operator-run prompt v1

Drafted 2026-07-22, immediately after the gitea memoprobe kill (`4ea9eb9`) and the
probe-validity discussion. Purpose: independent methodological critique of the liveness
probe's construct validity from several external thinking models, operator-run on
subscriptions (zero marginal cost), one fresh chat per model.

## Design choices (recorded)

- **Blind on our hypotheses.** The prompt does NOT mention the re-enactment-probe idea or
  the control-pilot preference. Convergence by independent models on either is the signal;
  options list item (b) says only "redesign the probe (your section 2)". Item (d) states
  the direct pilot in one neutral line because it is an already-framed decision option,
  not a probe design.
- **Scrubbed candidate identities.** No repo names, issue numbers, commit SHAs, code, or
  program codenames. Chat pastes can enter future training corpora, and the
  previous-generation-tier option would REUSE the git-forge candidate — naming it today
  could contaminate the models we would probe tomorrow. The four probe results are
  described structurally only.
- **Anti-sycophancy scaffolding:** ordered sections, per-threat verdict mapping (which of
  the four verdicts each threat undermines), forced self-red-team, "disagreement is more
  valuable than validation" close, "state assumptions instead of asking questions".

## Usage (operator)

1. Fresh chat per model, thinking/extended mode on. Suggested panel: ChatGPT (thinking),
   Gemini, Qwen, DeepSeek — diversity over count.
2. Paste the prompt between the markers verbatim. No preamble, no follow-up hints. If the
   model asks clarifying questions: reply "use your stated assumptions".
3. Capture the full output verbatim, labeled with model/version/date.
4. Returned outputs enter the repo as **leads with zero inherited credibility** (v2/v4/v5
   standing rule), synthesized in the main loop against the frozen probe record — they do
   not re-litigate the committed verdicts; they inform the next protocol design.

## The prompt (paste everything between the markers)

<!-- ==== PROMPT START ==== -->

Methodology review request: measuring whether a "trap" bug actually tempts frontier coding agents

BACKGROUND

We are building a controlled experiment on AI coding agents. An agent gets a realistic
engineering task in a real open-source codebase; the task forces it through a spot where a
real human maintainer once introduced a silent regression (a "fossil": user-reported bug,
silently wrong output, later fixed upstream — we pin the pre-fix state). Control arm: the
agent works from an ordinary prose spec. Treatment arm: identical, except acceptance checks
are executable and run as feedback. Primary question: does executable acceptance feedback
prevent or catch silent regressions the control arm ships?

For the experiment to discriminate at all, the control arm must be at genuine risk of
introducing the regression — call this "trap exposure." An expensive failed run taught us
that if no agent ever takes the tempting path, the run is undetermined at full cost. So
before building an episode on a candidate fossil, we run a cheap "liveness probe."

CURRENT PROBE DESIGN

- Take the buggy decision the human maintainer made (examples across candidates: which
  revision range feeds a commit list; which of two similar IDs keys a mapping; where
  root-dependent state lives relative to a shared cache).
- Two framings: (A) "bare" — a scrubbed skeleton: fictional project, all identifiers
  renamed, same code structure, the decision left as a TODO; (B) "in-context" — the real
  pre-fix file, project named, fix site elided as a TODO.
- Subjects: two current-frontier models from different vendors (the tier that would run
  episodes), one shot each per framing = 4 scored samples; plus 2 unscored samples from a
  previous-generation model of one vendor.
- Neutral task wording; nothing hints at bugs.
- Scoring rules frozen and committed before any run: each output is classified
  falls-in / avoids / ambiguous from the shipped code alone; >=2 of 4 scored samples
  falling in => trap "live"; fewer => candidate killed. A second axis, "memorization
  tells" (naming the real project in the bare framing, citing the real issue/fix,
  claiming prior knowledge of the bug) => kill for contamination. Contestable readings
  score against admission.

RESULTS SO FAR (four candidates probed)

1. (Run in 2025 against that year's frontier tier) A timezone-handling trap: 4/4 fell in —
   live. (The candidate later died for unrelated reasons.)
2. A document-management metadata trap (the human culprit wrote the buggy code fresh):
   0/4 fell in; zero tells; both vendors' models avoided even in the scrubbed framing,
   with correct first-principles reasoning.
3. A CLI ignore-rules trap in a famous ~10-year-old codebase: killed on tells — one
   vendor's models identified the real project through the complete rename ("this mirrors
   X's design"), one reproducing identifiers the rename had removed; also only 1/4 fell
   in, and that one output reproduced, verbatim, a doc comment we had deleted from the
   prompt — recall of the historical code, not temptation.
4. A git-forge commit-listing trap (the human culprit fell in by DELETING a protective
   line during a refactor, not by writing bad code): 0/4 scored samples fell in — all
   four current-tier outputs anchored the range correctly, three explaining exactly why
   the tempting choice is wrong. Both previous-generation samples fell in, one
   reproducing the historical buggy line verbatim with a confident wrong explanation —
   the same conceptual error the human fix's comment documents.

WHERE WE ARE

The pool of probe-passing candidates is zero. Emerging pattern: mistakes real maintainers
shipped in 2023–2026 appear to be absorbed into frontier competence within roughly one
model generation; the traps stay live one tier down.

OUR OWN DOUBTS (attack or defend them)

- The probe tests writing the decision from scratch with it in full view; several fossils
  (especially #4) were introduced while modifying existing code with attention elsewhere.
  Passing a focused quiz may not predict preservation-under-refactor.
- 4 single-shot samples with a >=2/4 bar cannot distinguish "dead" from "~25%
  per-decision rate," which might still yield usable exposure in longer episodes.
- Probe subjects answer a single message; episode agents run agentically (tools, file
  exploration, multi-file edits, iteration).
- Conversely: maybe the kills are simply correct, and the fossil-trap idea has a shelf
  life of one model generation.

YOUR TASK (answer in order; label sections; where our description is ambiguous, state
your assumption and proceed rather than asking questions)

1. VALIDITY AUDIT. The strongest threats to using this probe as a predictor of trap
   exposure in real episodes — ranked, including threats we missed. For each: which of
   the four verdicts above it actually undermines, and which survive it.
2. YOUR PROBE. The measurement you would run instead to predict exposure, concrete
   enough to execute: task shape, subjects, number of replicates, scoring rules, decision
   thresholds, and guards against experimenter degrees of freedom. Budget constraint:
   model calls from two vendors' subscription plans (one vendor effectively unmetered,
   the other limited), no fine-tuning, no large paid API spend.
3. CHEAPEST DECISIVE TEST. If you could run one thing to settle whether candidate #4's
   trap has real episode exposure at the current tier, what is it, exactly, and what are
   its failure modes?
4. STOPPING RULE. How many candidates probed dead, under what design, before concluding
   the fossil-trap strategy is dead at the current model tier? If that happens: is
   running the experiment at the previous-generation tier (where traps are demonstrably
   live) scientifically respectable, or goalpost-moving? Justify.
5. OPTIONS ON OUR TABLE — rank and critique, and add any we missed:
   (a) automate fossil prospecting at scale, using the cheap probe as a first-pass filter;
   (b) redesign the probe (your section 2);
   (c) run episodes at the previous-generation tier;
   (d) a small direct pilot: agentic runs of the real modification task on the real
       repository, measuring whether the regression actually appears;
   (e) abandon fossil traps for a different way of certifying that a task is a trap.
6. RED-TEAM YOURSELF. The most likely way your recommended design misleads us, and what
   result would falsify it.

Be specific and quantitative where possible. Do not optimize for agreeing with us:
demonstrating that our reasoning is wrong is more valuable than validation.

<!-- ==== PROMPT END ==== -->
