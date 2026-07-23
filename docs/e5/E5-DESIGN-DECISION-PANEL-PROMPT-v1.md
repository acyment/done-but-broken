Here is the experimental design for Part A, built to survive hostile practitioner scrutiny by strictly isolating executability while holding workflow, specs, and agent identity constant.

### 1. Substrate and Task Structure
**Harness:** We will fork the open-source MIT-licensed SlopCodeBench harness (arXiv:2603.24755), which already provides Docker isolation and native adapters for Claude Code and Codex CLI in their natural agentic modes.

**Task Structure:** We will construct 100 evolving repository-level task sequences (10 turns each, 1,000 total agent turns per agent). The substrate will be a moderately complex Python codebase (e.g., a markdown-to-HTML parser or financial calculation library). Each "turn" presents a new requirement that is additive but interacts with prior behavior (e.g., Turn 3 adds table parsing, which must not break the inline formatting from Turn 1). 

**Workflow:** All work happens via OpenSpec. Specifications and change deltas exist as markdown files in the repo, with scenarios written in standard Given/When/Then format.

### 2. The Two Groups and Exactly What Differs
The *only* difference between groups is whether the OpenSpec scenarios are inert text or executable checks that push back on the agent. 

*   **Group A (Control - Text Only):** The OpenSpec scenarios exist purely as readable markdown. The agent is instructed to follow the OpenSpec workflow and read the specs to understand requirements.
*   **Group B (Treatment - Executable Gate):** The identical OpenSpec markdown exists, but OpenSpec's tooling is wired to `pytest-bdd`. When the agent completes a turn, the harness runs the executable scenarios. If they fail, the agent is fed the test failure output and granted exactly one retry with rollback (matching the protocol in arXiv:2607.01855). 

### 3. What the Agent Sees Each Step
*   **System Prompt (Both):** "You are working on a repository using OpenSpec. Implement the change delta in `openspec/changes/turn-N.md`. Ensure your code aligns with the specifications in `openspec/specs/`."
*   **Group A (Control):** The agent reads the markdown spec, writes code, and signals task completion. It receives no automated behavioral feedback. (To control for iteration time, the agent is allowed one "self-reflection" turn where it can review its own diff against the text spec before finalizing).
*   **Group B (Treatment):** The agent reads the markdown spec, writes code, and runs `openspec verify`. 
    *   *If pass:* Task completes.
    *   *If fail:* The harness intercepts, rolls back the code to the last commit, and sends the agent a message: "Verification failed with the following output: [pytest-bdd trace]. Please correct your implementation." The agent retries, then completes.

### 4. How Breakage is Measured (and on what surface)
**The Referee Surface:** Breakage is measured via a frozen, hidden "Referee Test Suite" that the agents *never* see. This suite contains comprehensive edge-case tests for all 10 turns, written by the experimenters prior to the run. 

**Measurement:** After the agent completes Turn $N$, the harness applies the agent's final code state to the hidden Referee Suite. 
We measure **Silent Breakage Rate**: the percentage of Referee tests for Turns $1$ through $N-1$ that passed at the end of Turn $N-1$ but fail at the end of Turn $N$. (Per arXiv:2603.24755 and arXiv:2503.15223, we expect agents to pass their own visible tests while failing hidden ones, making this hidden grading essential).

### 5. Sample Sizes with Power Argument
We will run 100 task sequences per group, across 2 agents (Claude Opus 4.7, GPT-5.5-Codex). Total: 400 sequences, 4,000 turns.

**Power Argument:** Literature anchor arXiv:2606.05570 (TensorBench) shows frontier agents break previously-passing tests in ~16% of patches. TDAD (arXiv:2603.17973) showed executable test context roughly quartered regressions (6.08% → 1.82%), while text instructions made it worse (9.94%). 
Assuming a baseline breakage rate of 15% in Group A, we want to detect a reduction to 7.5% in Group B. Using a two-proportion z-test ($\alpha = 0.05$, power = 0.80), we need ~82 sequences per group to detect this absolute 7.5% difference. Our $n=100$ provides ample power to detect a practically significant mitigation effect, and honest nulls will be published if the effect is smaller.

### 6. Biggest Validity Threat and Neutralization
**Threat: Confounding "Executability" with "Iteration Budget."** 
Hostile critics will argue: *"Group B didn't break things because it got to see test failures and iterate; Group A was artificially handicapped by a single shot attempt."* If we don't neutralize this, we aren't proving executability is the cure; we're just proving retries help.

**Neutralization:** Group A (Control) is granted an equivalent iteration budget, but without executable feedback. After Group A signals completion, the harness prompts: *"Review your diff against the OpenSpec text scenarios. You have one retry to fix any issues you find."* Thus, both groups get two attempts at every turn. Group A relies on reading text to self-correct; Group B relies on executable pushback. This perfectly isolates the causal variable: executability.

### 7. Expected Cost Profile
*   **Compute/Infrastructure:** Minimal. SlopCodeBench harness runs locally via Docker.
*   **API/Subscription Costs:** Low. We use Claude Code (unmetered vendor subscription) and Codex CLI (subscription-covered). Assuming an average of ~50k tokens per turn (including retries), 4,000 turns yields ~200M tokens. This fits well within subscription rate limits over a 2-week execution window, resulting in $0 marginal API spend.
*   **Engineering Time:** ~2 weeks to fork the harness, write the 100 sequences and hidden Referee suite, and wire OpenSpec to `pytest-bdd` for Group B. Pre-registration of the Referee suite is the highest-risk bottleneck.# E5 continuation-design adversarial panel — operator-run prompt v1

Drafted 2026-07-23, after the continuation design note (`e537b50` state). Purpose:
direction-level adversarial evaluation of the Stage-1 design decision by several external
thinking models, operator-run on subscriptions, one fresh chat per model. **Supersedes the
probe-validity panel prompt (v1, `4de6d08`) — that question was overtaken by the pivot to
the continuation design; do not run it.**

## Design choices (recorded)

- **Blind-first structure:** Part A asks each model to design the experiment itself from
  goal + constraints + verified literature, before Part B reveals our plan for attack.
  Convergence on our choices = validation; divergence = information.
- **Public artifacts stay named** (papers, benchmarks, OpenSpec) — that's what makes the
  evaluation informative. Withheld: internal codenames, program history, and the specific
  product ambition (described only as "industry evidence supporting executable-specification
  tooling for coding agents").
- **Disclosed doubts included** (retry-budget fairness, self-verification policy,
  visibility-manipulation realism) so panels dig past what we already know.
- **Hostile-commenter section** — the actual threat model is a skeptical practitioner
  under a LinkedIn post, not a journal reviewer.
- Panels cannot read the codebases; their fork-vs-plug input is a checklist of what to
  look for, not a verdict — the codebase-reading pass decides.

## Usage (operator)

Fresh chat per model, thinking/extended mode on; paste verbatim between the markers; no
follow-up hints (if asked, reply "use your stated assumptions"); capture full outputs
labeled with model/version/date. Returned outputs = leads with zero inherited credibility,
synthesized in the main loop; they inform the prereg, never rewrite committed records.

## The prompt (paste everything between the markers)

<!-- ==== PROMPT START ==== -->

Adversarial design review: a controlled experiment on AI coding agents and executable specifications

CONTEXT AND GOAL

We want to produce practitioner-credible causal evidence on this question: when an AI
coding agent evolves software over many steps, does giving it executable acceptance
scenarios (checks that run and push back) prevent the silent breakage of previously
working behavior, compared to the same scenarios existing only as readable text? The
output channel is public posts for a practitioner audience (CTOs, engineers), NOT a
peer-reviewed paper — but the evidence must survive hostile scrutiny in public comments.
The work supports a broader thesis about executable-specification tooling for coding
agents. We hold ourselves to pre-registered, frozen protocols and zero overclaiming;
honest nulls get published.

VERIFIED LITERATURE (we checked these against the papers ourselves)

1. arXiv:2607.01855 (July 2026): 542 toy Python tasks, each extended through 8 fixed
   requirement-evolution turns; 6 sub-frontier models; 40–73% of task chains lose
   previously-correct behavior. Only the ORIGINAL turn's tests are ever executed — later
   requirements exist as prose only, so the verified surface never grows. Two mitigations
   compared: restating all prior requirements as prose each turn (+~4 points) vs a
   "Verification Gate" that runs the original tests after each turn, shows failures, and
   allows exactly one retry with rollback (+~12 points; regression-affected chains
   43.2%→12.5%). Combining both was no better than the gate alone. Their conclusion:
   verification, not restatement, is the active ingredient.
2. SWE-Milestone (arXiv:2603.13428): 12 current frontier models (Claude Opus/Sonnet
   4.5–4.6, GPT-5.2/5.3-Codex, Gemini 3/3.1) driven through real agent CLIs (Claude Code,
   Codex CLI, etc.) on repository-level milestone sequences: scores collapse from >80%
   (isolated tasks) to 38% (continuous). No mitigation tested.
3. SlopCodeBench (arXiv:2603.24755): 15 agents incl. Claude Opus 4.7 and GPT-5.5 extend
   their own code across evolving-specification checkpoints; strict scoring re-runs all
   earlier checkpoints' tests; best agent passes 14.8% of checkpoints. Prompting-based
   mitigations improved initial quality but "do not slow the degradation". Open-source
   MIT harness with Docker isolation and native adapters for Claude Code and Codex CLI.
4. TensorBench (arXiv:2606.05570): on a hard real repository, Claude Opus 4.7 breaks
   previously-passing tests in 16% of its patches (single changes).
5. TDAD (arXiv:2603.17973): executable test context cut regressions 6.08%→1.82%;
   test-driven-development INSTRUCTIONS without executable context made regressions
   WORSE (9.94%).
6. PatchDiff (arXiv:2503.15223): 29.6% of "solved" benchmark patches behaviorally
   diverge from the intended fix. METR (2026-03): ~half of benchmark-passing AI PRs
   would not be merged by human maintainers.

Summary of the gap: at toy scale with weak models, both the damage AND the cure
(executable verification) are measured. At frontier scale with realistic work, the damage
is measured three ways and no verification-style cure has ever been tested.

CONSTRAINTS

- Agents: current frontier coding agents in their natural agentic mode (Claude Code and
  Codex CLI; file access, tools, iteration) — because that is the setting practitioners
  care about.
- Budget: subscription-covered model calls (one vendor effectively unmetered, the other
  limited); no fine-tuning; no large paid API spend; experiment infrastructure preferably
  forked/adapted from existing open-source harnesses rather than built from scratch.
- Workflow realism: specs live in a real spec-driven workflow tool (OpenSpec: specs and
  change deltas as markdown files in the repo, with scenario blocks in Given/When/Then
  form). Both experimental groups must use the identical workflow — the comparison must
  isolate executability of scenarios, never spec format or tooling brand.
- Discipline: everything frozen/pre-registered before runs; hidden grading (agents never
  see the referee); results published honestly including nulls.

PART A — YOUR DESIGN (answer before reading Part B; do not peek ahead)

Given only the above: design the strongest experiment you can that answers the causal
question credibly for this audience within these constraints. Specify: substrate and task
structure; the two groups and exactly what differs; what the agent sees each step in each
group; how breakage is measured (and on what surface); sample sizes with a power argument
anchored on the literature's effect sizes; the biggest validity threat and how your
design neutralizes it; expected cost profile.

PART B — OUR ACTUAL PLAN (now attack it)

Stage 1: fork the SlopCodeBench harness (checkpoint chains, Docker, strict accumulated
regression grading, Claude Code + Codex CLI adapters). Wrap each chain in an OpenSpec
workspace. Every checkpoint's requirements are expressed as Gherkin scenario blocks,
byte-identical in both groups. Group C (text-only): scenarios are readable spec text;
nothing executes; no verification output reaches the agent. Group T (executable): after
each checkpoint, the full accumulated scenario suite runs; the agent sees pass/fail and
failing scenario names, and gets exactly one retry, kept only if it passes at least as
many checks (ported from 2607.01855's gate). Hidden referee in BOTH groups, invisible,
after every checkpoint: the accumulated scenario suite plus the harness's own checkpoint
tests — giving breakage-vs-accumulated-promise-count curves per group. Guard metric:
per-checkpoint task success, so the gate isn't just blocking progress. Before the full
A/B: a control-only pilot with a pre-declared escalation rule (if frontier agents don't
break anything at this scale, lengthen chains or move to Stage 2 rather than buy a null).
Stage 2 (later, separately designed): the same contrast at repository scale via
milestone-style sequences on a real codebase.

Attack tasks, in order; label sections:

1. VALIDITY AUDIT. Rank the strongest threats to the causal claim in Stage 1. We disclose
   three we already see — go deeper and find what we missed: (i) the retry asymmetry: the
   gate grants Group T an extra attempt per checkpoint; should Group C get a matched
   retry budget without verification info, and does "feedback" vs "extra compute"
   confound survive either choice? (ii) self-verification policy: realistic agents can
   write and run their own tests; if allowed in both groups, Group C can partially
   self-supply the treatment (diluting the contrast toward zero — or making it the
   honest real-world contrast "provided executable scenarios vs agent initiative"); if
   forbidden, realism suffers. Which policy yields the more defensible claim? (iii)
   visibility manipulation: does hiding execution from Group C create an artificial
   setting a hostile reader can dismiss?
2. COMPARABILITY VS REALISM. We claim continuity with 2607.01855 (ported gate policy,
   analogous metrics) while changing task scale, models, agentic mode, and the growing
   scenario surface. Is the "continuation" framing honest and useful, or should the link
   be loosened/dropped?
3. THE HOSTILE COMMENTER. Write, verbatim, the three most damaging comments a skeptical
   senior practitioner could leave under a public post reporting a positive Stage-1
   result. For each: can this design answer it? If not, what change would?
4. FORK VS PLUG. We can either fork the SlopCodeBench harness (grading + agent plumbing
   ready; we add the OpenSpec layer and the two groups) or import its problem set into
   our own existing two-group experiment harness (our group/workflow/audit machinery
   native; grading to port). You cannot read either codebase: give the checklist of
   facts we should extract while reading both that should decide this, ranked by
   decision-weight.
5. BETTER ALTERNATIVES. If Part A's design differs materially from ours, argue which is
   stronger and why; steal freely from both to propose the best merged design.
6. RED-TEAM YOURSELF. The most likely way your own recommendations mislead us, and what
   evidence would change your mind.

Be specific and quantitative. State assumptions instead of asking questions. Do not
optimize for agreeing with us: demonstrating that our plan is wrong is more valuable
than validating it.

<!-- ==== PROMPT END ==== -->
