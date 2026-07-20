# Qwen 3.7 Plus

Search activated, but sources not listed

# Study Design: Executable Acceptance Criteria vs. Prose Specs for AI Coding Agents

---

## 1. DECOMPOSITION

The claim contains at least five independently-falsifiable sub-claims and two smuggled assumptions. I'll separate them.

**Sub-claim A (Format effect):** Given the same semantic content, encoding acceptance criteria as executable Gherkin scenarios (parseable, runnable) produces better agent output than encoding them as structured prose scenarios (human-readable, not directly executable). This isolates *machine-executability of the spec* as the causal variable.

*Evidence for:* Agent outputs in the Gherkin condition pass a higher fraction of held-out behavioral tests than outputs in the prose condition, on the same tasks, same model, same codebase state.
*Evidence against:* No statistically meaningful difference, or the prose condition matches/exceeds Gherkin.

**Sub-claim B (Incrementality effect):** Defining and running criteria in small increments (e.g., 2–4 scenarios per cycle, run-then-extend) produces better agent output than delivering the full specification upfront and letting the agent work in one or few large passes.

*Evidence for:* The incremental condition produces outputs where later features do not regress earlier features, and the agent converges with fewer total revision cycles.
*Evidence against:* A single well-structured upfront spec produces equivalent or better results with fewer total API calls.

**Sub-claim C (The comparator is competent):** The prose-spec condition is not a strawman. It receives a well-structured, scenario-shaped prose specification, a working project shell, and the ability to write and run its own tests.

*This is a design constraint, not a falsifiable claim, but it is the most common attack surface.* A skeptical CTO will say "your prose spec wasn't good enough" or "you didn't let the prose agent iterate." The study must document the prose spec's quality and the iteration budget explicitly.

**Sub-claim D (Evolving codebase matters):** The advantage (if any) manifests specifically on an *evolving* codebase — i.e., a sequence of dependent changes where later tasks touch code written by earlier tasks — not on isolated single-file tasks.

*Evidence for:* The gap between conditions widens as the task sequence progresses and the codebase accumulates state.
*Evidence against:* The gap is constant or absent across the sequence; any advantage is attributable to single-task performance, not codebase evolution.

**Sub-claim E (Measurability):** The difference is *measurable* — not merely anecdotal. There exists a quantitative metric (test pass rate, regression count, edit distance to reference patch, cycle count) on which the conditions differ beyond run-to-run noise.

*Evidence for:* Per-episode results show a consistent directional difference across ≥80% of episodes, or a paired statistical test yields p < 0.10 (acknowledging low power).
*Evidence against:* Results are mixed, within noise, or directionally inconsistent across episodes.

**Smuggled assumption 1:** "Gherkin-style" is doing causal work *as executable specification*, not merely as a formatting/prompting trick that happens to structure the LLM's attention. If the benefit comes purely from the rigid syntactic structure forcing the prompt into a decomposed form, then any equally rigid prose template would work as well, and the claim should be about *structured decomposition*, not *executability*.

**Smuggled assumption 2:** The claim implicitly assumes the agent's test-execution loop is the mechanism. But the agent might benefit from Gherkin simply because the Gherkin text is a better *prompt* (clearer, more constrained) rather than because the agent *runs* the scenarios as tests. These are different mechanisms with different practitioner implications.

**Unfalsifiable as stated:** "Measurably better" without a declared metric and threshold is unfalsifiable. The study must pre-register what "better" means numerically before any run.

---

## 2. THE DESIGN

### Task selection

Use a **single small open-source project** (I recommend a Python CLI tool or a small Express/FastAPI service, 800–2000 LOC) and define a **sequence of 6 dependent feature tasks** that build on each other. Example: a task-management CLI where Task 1 adds a data model, Task 2 adds CRUD, Task 3 adds filtering, Task 4 adds import/export, Task 5 adds a plugin hook, Task 6 adds a reporting command that depends on all prior work.

The dependency chain is essential. Isolated tasks cannot test Sub-claim D.

Each task has a **reference patch** (written by the researcher before any agent run) and a **held-out test suite** (10–20 assertions per task) that the agent never sees during execution. The agent sees only the specification for its current task.

### Two conditions, identical in every respect except the spec format and delivery cadence

**Condition G (Gherkin-incremental):**

- The agent receives 2–4 Gherkin scenarios for the current task.
- After implementing, the agent runs those scenarios as executable tests (via `behave` or `pytest-bdd`).
- If tests fail, the agent revises. If they pass, the researcher advances to the next batch of scenarios for the same task, then the next task.
- The agent's context window receives the passing test output as feedback.

**Condition P (Prose-structured):**

- The agent receives the *same semantic content* as a structured prose specification: numbered scenarios in natural language, with Given/When/Then phrasing but as paragraphs, not parseable syntax.
- The agent receives the same project shell, the same file tree, the same prior-task code.
- The agent is instructed to write its own unit tests based on the prose spec, run them, and iterate.
- The agent gets the same number of revision cycles as Condition G.

**What is held constant:**

- Same model (one mid-tier model for all runs; I'd pick Qwen2.5-Coder-32B or DeepSeek-Coder-V2 at the tier the researcher has paid capacity for — not a frontier model, both for cost and because the claim is about *workflow*, not model capability).
- Same system prompt template, differing only in the spec block.
- Same codebase state at the start of each task (restored from git checkpoint).
- Same maximum revision cycles per task (e.g., 5).
- Same held-out test suite for evaluation (never shown to the agent).
- Same temperature (0 or near-0 for determinism; if the API doesn't allow 0, use the lowest available and run each episode twice).

**What is measured per episode (per task per condition):**

1. **Pass rate on held-out tests** (primary metric). Binary per test, reported as fraction.
2. **Regression count:** Of the held-out tests for *all prior tasks*, how many now fail after the current task's changes?
3. **Cycles to convergence:** How many revise-and-rerun cycles before the agent's own tests pass (or the cycle cap is hit).
4. **Diff size:** Lines changed vs. reference patch. Not a quality metric per se, but a sanity check on whether the agent is rewriting the world.

**Number of runs:**
6 tasks × 2 conditions × 2 repetitions (for noise) = **24 agent episodes**. At a mid-tier model, each episode is roughly 3–8K output tokens plus tool-call overhead. Total token budget is roughly 300K–600K tokens. At DeepSeek or Qwen pricing, this is **$0.50–$2.00**. Well within the $15 budget even with 3× contingency for failed runs and debugging.

The researcher should also run **2 pilot episodes** (one per condition, Task 1 only) to validate the harness before committing the full sequence.

**Decision rule (pre-registered before any run):**

- The claim is *supported* if Condition G has a higher held-out pass rate on ≥5 of 6 tasks AND the cumulative regression count across Tasks 3–6 is lower in G than P in both repetitions.
- The claim is *not supported* if Condition G and P are within 5 percentage points on held-out pass rate across the full sequence, or if P matches or exceeds G on ≥4 of 6 tasks.
- The claim is *inconclusive* if results are mixed and the two repetitions disagree on direction.

**Reporting:** Publish per-episode results in a table, not just aggregates. Include the raw agent transcripts (or at minimum the final diffs and test outputs) as supplementary material. State the exact model name, API endpoint, date, temperature, and prompt templates.

### Confounds controlled and how

| Confound                                                    | Control                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt quality difference (Gherkin is just a better prompt) | The prose spec uses identical Given/When/Then semantics, same scenario count, same detail level. The only structural difference is syntactic parsability.                                                                                                                                                               |
| Agent gets more information in one condition                | Both conditions receive the same semantic content. Gherkin's executability is the only addition.                                                                                                                                                                                                                        |
| Iteration budget asymmetry                                  | Both conditions get the same max revision cycles. The prose agent writes and runs its own tests.                                                                                                                                                                                                                        |
| Codebase contamination across tasks                         | Git checkpoint and restore before each task. The agent for Task N starts from the *reference* implementation of Tasks 1..N-1, not from its own prior output. (This isolates each task. A secondary "cumulative" run where the agent builds on its own prior output can test Sub-claim D more directly, but costs more.) |
| Model stochasticity                                         | Two repetitions per episode. Low temperature.                                                                                                                                                                                                                                                                           |
| Researcher degrees of freedom in evaluation                 | Held-out tests are written *before* any agent run and are fixed. The decision rule is declared before the run.                                                                                                                                                                                                          |

---

## 3. THE FALSIFICATION TEST

**The claim is FALSE if:**

- Condition P (prose) matches or exceeds Condition G (Gherkin) on held-out test pass rate across the 6-task sequence, in both repetitions. This would mean executable format adds nothing over well-structured prose when the agent can write its own tests.
- The regression count does not differ between conditions across Tasks 3–6. This would mean the "evolving codebase" framing (Sub-claim D) is not doing any work.
- The difference between conditions disappears when the prose agent is given the same test-run feedback loop (i.e., the researcher writes the tests for the prose agent too, rather than having the agent write its own). This would mean the benefit is from *having pre-written executable tests*, not from the Gherkin format per se — a different and less interesting claim.

**Can this design produce that result?** Yes. The prose agent is explicitly given the ability to write and run tests. If it writes good tests and iterates effectively, it will match Gherkin. The design does not handicap the prose condition.

**The falsification test I cannot run:** I cannot distinguish "Gherkin is better because it's executable" from "Gherkin is better because its rigid syntax structures the LLM's attention more effectively than free prose." To separate these, I would need a third condition: Gherkin scenarios that are *not* executed (just fed as text to the agent, which writes its own tests from them). This costs 6 more episodes (~$0.50) and I recommend adding it if budget allows. If Gherkin-as-text matches Gherkin-executed, the mechanism is prompt structure, not executability. The claim as stated would be misleading.

**Stop rule:** If after the 2 pilot episodes (Task 1, both conditions), the held-out pass rates are identical and the agent transcripts show no qualitative difference in approach, **stop and do not run the full sequence.** Write up the null result. If after the first full repetition (12 episodes), the direction is inconsistent (G wins 3 tasks, P wins 3 tasks), **stop and do not run the second repetition.** Report the null. The $15 budget is not the binding constraint; the researcher's time and credibility are.

---

## 4. PRIOR ART

I must be honest about the boundary of my knowledge here. I can cite what I am confident exists and flag where I am inferring.

**What I am confident exists:**

- **SWE-bench (Jimenez et al., 2023, Princeton/CMU):** A benchmark of 2,294 real GitHub issues with gold patches and test suites. Widely used for evaluating coding agents. Relevant because it provides dependent, multi-file tasks with held-out tests. However, it is designed for single-issue resolution, not sequential dependent feature development on an evolving codebase. It does not test spec format.

- **HumanEval and MBPP (Chen et al., 2021; Austin et al., 2021):** Single-function code generation benchmarks. Not relevant to this claim — no evolving codebase, no spec format variation.

- **Aider's benchmark blog posts (Paul Gauthier, 2023–2025):** Practitioner evaluations of coding agents on real repos. Relevant as a methodological model (per-task pass rates, real repos, reproducible) but does not test spec format.

- **Cucumber/Behave documentation and BDD literature (Gojko Adzic, *Specification by Example*, 2011; Dan North's original BDD writings, 2006):** Argues that executable specifications improve human team outcomes. This is the intellectual ancestor of the claim. However, I am not aware of a controlled study that isolates the *format* effect from the *process* effect for human teams, let alone for AI agents.

- **Devin, Cursor, Windsurf, Copilot Workspace vendor evaluations (2024–2025):** Vendor-published benchmarks exist but are not controlled comparisons of spec format. They test "can the agent do the task" not "does the spec format matter."

**What I am inferring but cannot verify with certainty:**

- I believe there is **no published controlled study** that directly compares Gherkin-executable vs. prose-structured specifications as input to an AI coding agent on a multi-step evolving codebase. If such a study exists, it is likely a preprint or blog post from late 2024 or 2025 that I cannot confirm. The researcher should search arXiv, the ICSE/FSE/ASE 2024–2025 proceedings, and engineering blogs (particularly from Cucumber/SmartBear, GitHub, and Anthropic) before running the study.

- There is practitioner folklore (blog posts, conference talks) suggesting that "giving the AI tests to pass" improves output quality. This is consistent with the claim but does not isolate spec format from the effect of having *any* executable oracle.

**Evidence AGAINST the claim (or complicating it):**

- **Prompt engineering literature** broadly suggests that structured, constrained prompts improve LLM output. Gherkin is a highly constrained format. The benefit may be entirely attributable to prompt structure, not executability. This is the most serious threat to the claim's intended interpretation.

- **SWE-bench results** show that agent performance is dominated by model capability and context window size, not by task framing. If the model is good enough, spec format may be irrelevant. This suggests the effect (if any) will be small and model-dependent.

- **The "tests as specification" literature in software engineering** (e.g., work on test-driven development effectiveness) shows mixed results for humans. TDD helps with design but does not consistently improve final code quality over writing tests after. By analogy, giving the agent executable specs upfront may not beat letting it write its own tests from prose.

**Bottom line:** The claim is **not already established** in the literature I can identify. It is also **not already refuted.** It is, as far as I can tell, an open empirical question. This is good for the researcher — the study would be novel. But the researcher should verify this with a targeted literature search before building the harness.

---

## 5. SUBSTRATE

### The tension

Methodological rigor wants: curated tasks with known-good patches, hidden tests, controlled contamination, reproducible environments. Audience credibility wants: a codebase a working engineer recognizes, real file structures, real dependencies, real `git log`.

### Resolution

**Use a real, small, real open-source project as the substrate, but curate the task sequence and write the reference patches and held-out tests yourself.**

Concretely:

1. **Pick a real project.** I recommend something like `todo-cli` (a Python Click-based CLI), a small FastAPI CRUD service, or a minimal Express.js task manager. It should be small enough that the full codebase fits comfortably in the agent's context window (under 2K LOC at the start). It should use a standard test framework (`pytest`, `jest`). It should be a project a LinkedIn-reading engineering leader would recognize as "a real thing someone would build."

2. **Fork it and create a stripped-down starting point.** Remove features beyond a basic skeleton. This is your Task 0 state.

3. **Write the 6-task sequence, reference patches, and held-out tests yourself.** This is the curation step. The tasks should be realistic ("add CSV import," "add a plugin system") not synthetic ("implement function f(x) = ...").

4. **Run everything in Docker.** A `Dockerfile` per condition that installs the project, the test framework, and (for Condition G) `pytest-bdd` or `behave`. The agent operates inside the container. The researcher evaluates outside it using the held-out suite.

5. **Use `git` for state management.** Checkpoint after each reference task. Restore to checkpoint before each agent episode. This gives you reproducibility and isolation.

### What you give up

- You give up the scale and contamination-control of SWE-bench. Your 6 tasks are hand-crafted by one person. A reviewer can say "you designed the tasks to favor Gherkin." Mitigation: publish the task descriptions, reference patches, and held-out tests in full. Let the reader judge whether the tasks are fair.
- You give up multi-language, multi-framework generalizability. You are testing one language, one framework, one model. The claim must be bounded accordingly.
- You give up statistical power. 6 tasks × 2 reps is 12 data points per condition. You cannot run a meaningful t-test. You can report per-episode results and note consistency.

### Existing curated datasets of dependent, multi-step code changes

**This is the key question.** As of my knowledge:

- **SWE-bench** has dependent tasks (issues in the same repo) but does not structure them as a *sequence* where each builds on the last. You could extract a chain, but the dependency structure is implicit and the tasks are bug fixes, not feature additions.
- **SWE-bench Verified** (a curated subset) is cleaner but same limitation.
- **RepoBench (Liu et al., 2023)** tests next-line prediction in real repos, not multi-step agent tasks.
- **CodePlan (Ramakrishna et al., 2024, Microsoft Research)** explicitly addresses *dependent* code changes across a codebase (change one interface, propagate to dependents). This is closer to the "evolving codebase" requirement. However, it is about type-driven propagation, not feature development from specs.
- **I am not aware of a curated dataset specifically designed as a sequence of dependent feature-development tasks with Gherkin-style acceptance criteria and held-out tests.** If one exists, it is very recent or niche. The researcher should check the MSR 2025 and ICSE 2025 proceedings.

**Practical recommendation:** Building the 6-task sequence by hand on a small real project will take the researcher 4–8 hours. This is the most expensive part of the study in wall-clock time, but it is unavoidable given the absence of a ready-made dataset. The $15 API budget is not the bottleneck; the task design is.

### Agent harness

Do not build a custom agent framework. Use an existing agentic coding tool that the researcher already has access to and that supports:

- File read/write in a Docker container
- Shell command execution (to run tests)
- Multi-turn conversation with tool use

Options: **Aider** (open-source, supports multiple backends, has a benchmark mode), **OpenHands** (formerly OpenDevin), or a direct API loop with tool-use if the researcher already has one. The choice of harness must be held constant across conditions and named in the writeup.

For Gherkin execution specifically: `pytest-bdd` (Python) or `behave` (Python) or `jest-cucumber` (JS) inside the container. The agent in Condition G writes code, then runs `pytest --gherkin` (or equivalent), sees pass/fail, and iterates.

---

## 6. THE TRAP

**The most likely measurement error: the researcher measures the effect of prompt structure and attributes it to executability.**

Here is the specific mechanism:

Gherkin syntax is highly constrained. `Given`, `When`, `Then` on fixed lines, one step per line, no ambiguity in structure. Prose, even well-structured prose, allows paragraph-level variation, subordinate clauses, implicit context. When you feed Gherkin to an LLM, you are feeding it a *more constrained, more decomposed prompt*. The LLM's attention is forced into a specific structure. The LLM generates more focused, step-by-step code because the input was step-by-step.

Meanwhile, the prose spec, even with identical semantic content, allows the LLM to "read" it as a holistic description and generate code in a less decomposed fashion.

**The executability — the fact that the Gherkin scenarios are actually *run* as tests — may contribute nothing beyond what the structured prompt already provides.** The agent in Condition G gets test pass/fail feedback, yes, but the agent in Condition P *also* writes and runs its own tests. If the prose agent writes decent tests (and mid-tier coding models can write decent unit tests from a clear prose spec), the feedback loop is equivalent.

**The researcher will see Gherkin win and conclude "executable specs are better." But the actual cause may be "more rigidly structured prompts are better."** These have completely different practitioner implications. The first says "adopt BDD tooling." The second says "structure your prompts more carefully, format doesn't matter."

**How to detect this:** Run the third condition I mentioned in Section 3 — Gherkin-as-text, not executed. If Gherkin-as-text ≈ Gherkin-executed > Prose, the mechanism is prompt structure, not executability. The claim as stated is misleading.

**A secondary trap:** The researcher writes the Gherkin scenarios and the prose spec. Despite best efforts, the Gherkin scenarios may be *more specific* than the prose spec because the Gherkin format forces the researcher to specify exact values, exact edge cases, exact expected outputs. The prose spec may inadvertently leave more room for interpretation. This is a spec-quality confound, not a format effect. Mitigation: have the prose spec reviewed (even by another LLM) for completeness against the Gherkin spec before the run.

---

## 7. THE BORING EXPLANATION

Assume the study comes out positive: Gherkin-incremental beats prose-structured across 5 of 6 tasks, with lower regression counts.

**The most mundane explanation: the incremental delivery cadence is doing all the work, and the Gherkin format is irrelevant.**

Condition G delivers 2–4 scenarios at a time. Condition P delivers the full spec upfront. The agent in Condition G is solving a smaller, more focused problem at each step. The agent in Condition P is solving a larger problem with more degrees of freedom.

This is not a finding about executable specifications. This is a finding about *task decomposition and reduced cognitive load for the LLM*, which is well-known in prompt engineering. Any practitioner who has used coding agents knows that smaller, focused prompts produce better output than large, sprawling ones.

**Does the design distinguish these?** Not fully. To separate format from cadence, you would need four conditions:

- Gherkin + incremental
- Gherkin + all-at-once
- Prose + incremental
- Prose + all-at-once

This doubles the episode count to 48. At mid-tier pricing, still under $5. But it doubles the researcher's wall-clock time for running and evaluating.

**My recommendation:** Run the 2×2 if budget allows. If not, run the primary 2-condition design but *acknowledge in the writeup that the design cannot separate format from cadence*, and frame the claim accordingly: "Gherkin-incremental as a combined workflow" rather than "Gherkin format specifically."

**Second boring explanation:** The researcher wrote the reference patches and held-out tests. The Gherkin scenarios were derived from the same mental model that produced the reference patches. The held-out tests may be *closer in structure to the Gherkin scenarios* than to the prose spec, because the researcher thinks in Given/When/Then when writing both. The agent in Condition G is essentially being tested on a distribution closer to its training input. This is a subtle form of data leakage through the evaluator.

**Does the design distinguish this?** No, not without an independent test writer. This is an inherent limitation of a solo study. The researcher should acknowledge it.

**If the study cannot distinguish the intended mechanism from these boring explanations, the result is interpretable only as "this combined workflow produced better outputs in this specific setup." The causal claim about executability specifically is not supported.** The LinkedIn post should say that, or it will be dismissed by the first commenter who thinks about it for thirty seconds.

---

## Summary of Recommendations

1. **Run the study.** The question is genuinely open, the cost is low, and a null result is publishable and interesting.
2. **Pre-register the decision rule and metric** before any agent run. Post the decision rule in the writeup.
3. **Add the Gherkin-as-text third condition** if at all possible. It costs ~$0.50 and resolves the most dangerous confound.
4. **Bound the claim ruthlessly.** "Using Qwen2.5-Coder-32B via Aider on a 6-task Python CLI sequence, a Gherkin-incremental workflow produced X% higher held-out test pass rates than a prose-structured workflow. This was consistent across N of 6 tasks. We cannot separate the format effect from the cadence effect. We tested one model, one language, one project."
5. **Publish the artifacts.** Prompts, transcripts, diffs, test outputs, Dockerfiles, the held-out suite. All of it. A skeptical CTO should be able to re-run the study in an afternoon.
6. **If the result is null, publish that.** "We tested whether executable Gherkin specs improve AI agent output vs. structured prose specs. In our setup, they did not. Here is the data." This is more credible than a positive result with caveats, and it is more useful to the audience.
7. **Do not use LLM panels as the primary evaluator.** The held-out test suite (pass/fail, automated) is the primary metric. LLM review can be a secondary qualitative check, but the quantitative claim rests on the test suite. A CTO will trust `pytest` output; they will not trust "a panel of three LLMs rated the code 4.2/5."