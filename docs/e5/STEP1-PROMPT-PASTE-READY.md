# Step 1 — blind independent design: paste-ready prompt

> ## RUN 2026-07-21 — as-written text below is preserved; two defects recorded
>
> Executed against Qwen 3.7 Plus, Claude Opus 4.8 High, and ChatGPT 5.6 High in fresh chat sessions
> with no repo access. Raw responses and the comparison record:
> `docs/protocols/e5-step1-blind-design-20260721/`. **Do not silently edit the prompt text below** —
> it is the as-run artifact. Both defects are fixed in a numbered successor before any re-run.
>
> **Defect 1 — the claim omits the model tier.** The claim paragraph does not say the target is
> frontier models, and A4 merely lists both tiers as available. All three reviewers therefore designed
> for mid-tier, one reasoning explicitly that the claim is about workflow rather than model
> capability. The step answered an adjacent question. A successor must put the tier in the claim.
>
> **Defect 2 — the eligibility rule was mis-scoped (see below).**

**How to run.** Three separate deep-research sessions, three different models, **no cross-contact**.
Do not show any model another's output. Do not tell them what we built. Keep each raw response, its
cited sources, the model name and version, and the date — those are the artifacts; any summary is
derived.

**Verify deep research actually ran.** ChatGPT's 2026-07-21 session reported *"0 citations, 0
searches"* and answered the prior-art deliverable from recall; Qwen's listed no sources. **The step
returned one sourced prior-art answer out of three.** Check the session's search count before filing
a response, and mark any unsourced prior-art section as unciteable.

**Eligible models: Qwen, Gemini, DeepSeek** (substitutes: Kimi, GLM). ~~**ChatGPT and Claude are
disqualified**~~ — **corrected 2026-07-21.** The disqualification was written against *specific
conversations* in which those two had read the proposal, and assumed a reviewer with code access. A
fresh chat session with no repo access and no exposure to the design meets the requirement, and all
three 2026-07-21 responses are admissible. **The rule is: a contaminated session is disqualified, not
a model family.** Residual caveat to check before relying on this: account-level saved-memory features
can carry context across sessions, so confirm memory was off, or use an account that never discussed
the design.

**Deep research mode on.** Part of what this step buys is the prior-art search.

**What they deliberately do not get:** our design, our evidence, our substrate shortlist, our
decision to pursue literal Gherkin. If three independent designers converge on something we don't
have, that is the finding. If they converge on something we do have, that prioritises a question —
it does not validate anything and is not citable.

---

## PASTE EVERYTHING BELOW THIS LINE

You are advising a solo researcher who wants to publish a credible, practitioner-facing claim about
AI coding agents. Your job is to design the study independently. Do not assume any particular
implementation already exists — I want your design, not a review of mine.

### The claim they want to make

To an audience of engineering leaders on LinkedIn:

> "Writing acceptance criteria as executable, Gherkin-style scenarios — and defining and running
> them in small increments — produces measurably better AI-agent work on an evolving codebase than
> spec-driven development that keeps the spec as prose, even when that prose spec is well-structured
> and scenario-shaped."

The comparator is a real, competent spec-driven-development workflow, not a strawman: the prose side
gets a good structured specification, a shell, and the ability to write and run its own tests.

### Standard of proof

Practitioner-credible, not peer-reviewed. A skeptical CTO should not be able to dismiss the post in
a single comment. Journal-scale statistical power is not required — but the study still needs a
decision rule declared before the run, per-episode results rather than aggregates alone, uncertainty
or consistency reporting, replayable artifacts, and language bounded to the exact model, workflow,
and tasks tested.

### Constraints

- One person, plus agentic coding tooling.
- Roughly $15 of model API budget remaining against a hard stop-loss; more could be authorised but
  every run needs explicit approval.
- API access to mid-tier models (DeepSeek, Qwen, GLM, Mistral tiers) and to frontier models at
  higher cost. Note that a configured route is not the same as remaining paid capacity.
- Docker available. Substantial research tooling already exists but is not a hardened evaluation
  platform.
- No calendar deadline. The binding cost on past work has often been wall-clock and container time
  rather than tokens.
- The review function has so far been performed by panels of other language models. There is no
  independent human reviewer and no replicating team.

### Deliver

**1. DECOMPOSITION.** Break the claim into independently-falsifiable sub-claims. Flag any that are
unfalsifiable as stated, or that smuggle in an assumption. Be specific about what would count as
evidence for each.

**2. YOUR DESIGN.** The cheapest study that could credibly support the claim. Be concrete: what is
the task, what exactly differs between conditions, what is held constant, what is measured, how many
runs, and what result would count as a win. Name the specific confounds your design controls and how
it controls them.

**3. THE FALSIFICATION TEST.** What result would show the claim is FALSE? If your design cannot
produce that result, say so and fix the design. Then state the stop rule: at what point should the
researcher conclude the thesis does not hold and publish that instead?

**4. PRIOR ART.** Search for published evidence — papers, benchmarks, vendor studies, credible
practitioner writeups — bearing on whether executable acceptance criteria, or smaller work
increments, improve AI-agent coding outcomes. Include evidence AGAINST. Cite sources. If the claim
is already established or already refuted somewhere, say so plainly.

**5. SUBSTRATE.** What software should this run on, and why? Consider the tension between
methodological rigor (curated benchmark episodes with known-good patches, hidden tests, controllable
training-data contamination) and audience credibility (software a working engineer recognises as
real). Tell me how you would resolve that tension and what you would give up. If a curated dataset
of *dependent, multi-step* code changes with tests already exists, name it — that would remove the
most expensive part of this study.

**6. THE TRAP.** What is the most likely way a well-intentioned researcher building this study ends
up measuring something other than what they think they are measuring? Be concrete, and name the
specific mechanism.

**7. THE BORING EXPLANATION.** Assume the study comes out positive. What is the most mundane
alternative explanation, and would your design distinguish it from the intended one? If not, the
result is uninterpretable — say so.

Separate what you retrieved and verified from what you are inferring. Prioritise being useful over
being encouraging. Do not flatter the premise.

## PASTE EVERYTHING ABOVE THIS LINE

---

## After all three return

1. File each raw response with model, version, date, and sources. Do not summarise before filing.
2. Build one comparison table: where all three converge, where they split, and — most valuable —
   what any of them proposed that we do not have.
3. Only then look at our own design. Reading it first defeats the point of the step.
4. Convergence prioritises a question. It does not validate a design, does not establish prior art,
   and is not citable in public.
