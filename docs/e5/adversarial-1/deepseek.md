<!-- PROVENANCE (added at ingest 2026-07-23; body below is verbatim operator paste)
  model-label: deepseek (operator-supplied filename label; version string as the operator saved it)
  mode: sequential (Part A answered, then Part B attack, one fresh chat)
  received: 2026-07-23 (file mtime)
  prompt: docs/e5/E5-DESIGN-DECISION-PANEL-PROMPT-v1.md (pasted verbatim between markers)
  status: lead with zero inherited credibility -- factual/citation claims must be re-verified before reliance
-->

We need a pragmatic, preregistered experiment that isolates the causal effect of **executable acceptance scenarios** (spec-as-test) on silent regression during multi-step AI-driven evolution. The design below leverages the open-source SlopCodeBench harness, the Verification Gate pattern from the toy-scale literature, and a workflow that uses OpenSpec’s Given/When/Then markdown format for both groups. Every detail will be frozen before a single agent run begins.

---

## 1. Substrate and Task Structure

**Substrate.** Fork SlopCodeBench (MIT license, arXiv:2603.24755). It provides:
- 50+ evolving-specification Python tasks, each spanning 4–8 checkpoints.
- Reference test suites per checkpoint, already used for strict “re-run all earlier checkpoint tests” scoring.
- Docker isolation and native adapters for Claude Code and Codex CLI.

From the SlopCodeBench corpus we curate **80 tasks** that span a range of complexity (simple CLI games, utilities, small web services) and have clearly translatable scenarios.

**Task structure.** Each task is a sequence of **K checkpoints** (K ∈ [4,8]).  
For each checkpoint we pre-author an **OpenSpec change-delta** – a markdown file containing:
- A natural-language description of the new requirement.
- **Given/When/Then scenarios** (2–6 per checkpoint) that specify the expected behaviour in a semi-formal style.

The scenarios are directly derived from the reference test suite, but the test *code* itself is **not** placed in the agent’s workspace in either group.  
The final, hidden referee uses exactly those reference tests – the scenarios are the specification; the tests are their executable form.

---

## 2. The Two Groups and Exactly What Differs

Every task is randomly assigned to one of two groups, stratified by number of checkpoints and initial codebase size.

| Group | Name | What the agent gets at each step |
|-------|------|----------------------------------|
| **Control** | Specs-as-text | The OpenSpec delta (markdown) containing the new requirement and its Given/When/Then scenarios. **No automatic test execution ever occurs.** The agent reads the scenarios as prose and can choose to write its own tests, but it never sees test results from the reference suite. After the agent signals completion, the harness immediately advances to the next checkpoint (or ends the task). |
| **Treatment** | Executable Verification Gate | The **identical** OpenSpec delta. After the agent finishes its changes, the harness executes the **reference test suites for all checkpoints up to the current one** and shows the agent the full pass/fail output (including scenario names). If any test fails, the harness **reverts** the working tree to the state before the turn, presents the failure output, and gives the agent exactly **one retry** to fix the code. After that second attempt (or if the first attempt passed all tests), the harness advances to the next checkpoint. |

The only deliberate difference is **whether the written Given/When/Then scenarios are automatically executed and used to gate progress**. Both groups use the same OpenSpec files and the same terminal-based agent interface.

---

## 3. What the Agent Sees Each Step (Both Groups)

At turn *t* (checkpoint *k*):

1. The agent is given the task description, the full repository state, and the OpenSpec change-delta for checkpoint *k*.
2. The agent reads the delta, edits files, runs linters or its own chosen tests, etc.
3. When the agent signals it is done:
   - **Control**: The harness accepts the commit and moves to checkpoint *k*+1. No feedback beyond what the agent itself produced.
   - **Treatment**: The harness runs `pytest` on the hidden test suites for checkpoints 0…k. The full stdout/stderr is injected into the agent’s context.  
     - If **all pass**: the harness commits and advances.  
     - If **any fail**: the harness resets the repository to the commit before the turn, injects the failure log, and opens a single “fix” turn. After the agent resubmits, tests are run once more; regardless of the outcome, the harness then advances.
4. After the final checkpoint *K*, the agent’s work is done. No further interaction.

*Both groups work under an identical time limit per turn (e.g., 180 s wall-clock) and identical compute budget (e.g., 30 reasoning tokens per step).*

---

## 4. How Breakage Is Measured (Hidden Referee)

After the agent finishes the last checkpoint, we discard the working tree and **evaluate the final commit only**.

- **Referee:** Run the complete test suites for **every checkpoint 0…K** against the final codebase.
- **Primary outcome:** Binary `regression` = 1 if **any** checkpoint’s tests that were passing in the *initial* codebase for that checkpoint (or would have passed at the time the checkpoint was introduced) now **fail** at the end. This matches the “regression-affected chain” metric in arXiv:2607.01855.
- **Secondary outcomes:** Number of checkpoint-level test suites that fail, overall proportion of individual test cases passed, pass@k curves per checkpoint.

The referee is never shown to the agent in either group. For treatment agents, the feedback tests are the same artefacts, but the final evaluation is a separate scripted pass with identical test files – this is identical to how the Verification Gate paper handled measurement.

---

## 5. Sample Size and Power Argument

We use a two-group proportion test (two-sided, α = 0.05) for the primary binary outcome.

**Expected base rate.** The literature gives:
- Toy-scale (2607.01855): control regression rate 43.2%.
- Frontier-scale multi-turn benchmarks: SWE-Milestone scores collapse from >80% to 38%; SlopCodeBench checkpoint pass rate ~15%. Task-level regression rates are not directly reported, but multiple lines of evidence (TensorBench 16% single-change breakage, TDAD baseline ~6%) suggest that over 5–8 turns the **regression rate for frontier agents without verification is likely 60–80%**.

**Anticipated treatment effect.** The only comparable causal estimate comes from the Verification Gate on toy tasks: **regression-affected chains fell from 43.2% to 12.5%** (absolute reduction ≈31 pp). A frontier-scale replication would be expected to show a similar or slightly smaller absolute drop, say 30–35 pp.

**Power calculation (arcsine-transformation).**  
For p₁ = 0.70 (control), p₂ = 0.35 (treatment), h ≈ 0.716, required n per group ≈ 31 (80% power, α = 0.05 two-tailed).  
With **n = 40 per group (80 tasks total)** we have:
- 80% power to detect a drop from 70% → 31% (Δ = 39 pp).
- 80% power to detect 60% → 23% (Δ = 37 pp).
- 80% power to detect 50% → 15% (Δ = 35 pp).

If the true effect is ≥35 pp, we are well-powered; if it is closer to 30 pp, power is still ~75%. The sample size is affordable under our unmetered subscription and comfortably exceeds the smallest single-condition cell in the Verification Gate study (which had ~25 chains per mitigation). We will pre-register a minimum detectable effect of 35 pp at 80% power and commit to reporting observed power.

---

## 6. Biggest Validity Threat and How the Design Neutralises It

**Threat: Control agents may spontaneously write and run their own tests based on the given scenarios, partially mimicking the treatment and attenuating the contrast.**  
If a control agent converts the prose Given/When/Then into unit tests and executes them, the “executable specification” effect is confounded.

**Neutralisation:**
- We **never include the reference test code** in the repository visible to the agent. The control agent sees only the markdown spec. It may write its own tests from those scenarios, but those tests are:
  1. Unvalidated – they may not correctly capture the scenario semantics.
  2. Not automatically run after every turn – the agent must choose to run them; they are not enforced as a gate.
- We instrument the agent’s workspace to **record all test files the agent creates and all test-run commands it issues**. In the analysis we will report the proportion of control tasks where the agent wrote any test, the proportion where it ran those tests, and the nature of those tests. A secondary per-protocol analysis will exclude tasks where the control agent independently achieved a “test-and-gate” workflow, to bound the influence.
- The treatment gate runs the **authoritative, hidden tests** – the scenarios’ exact executable interpretation. Even if a control agent writes tests, they are not guaranteed to align with the hidden referee, whereas the treatment agent receives ground-truth feedback. The causal question is about the effect of the *real* executable spec, not about agent-internal testing discipline.

Thus the intent-to-treat estimate remains a valid comparison of “spec-as-automatic-enforcement” vs. “spec-as-documentation-only”.

**Additional checks:**
- Randomisation is done at the task level, stratified by checkpoint count, to avoid confounding difficulty.
- Both groups use the identical OpenSpec files, eliminating tooling-brand or spec-format confounds.
- The treatment’s extra retry gives more compute; we will run a small **ablation arm** (n = 10 tasks) where control agents also get a “blank” second turn with no test feedback, to verify that extra compute alone does not drive the result.

---

## 7. Expected Cost Profile

- **Agent calls:** Primary agent is Claude Code (Claude Opus 4.7) under a **flat-rate professional subscription** that is effectively unmetered for the study’s volume (~700–900 agent turns). Secondary replication with Codex CLI (GPT-5.3-Codex) will use a **limited-call plan**, restricted to a 20-task subset, keeping pay-per-token cost <$200.
- **Infrastructure:** We run the Docker harness on a single 64-vCPU cloud VM for two weeks. Estimated cost <$400 (or free on existing in-house hardware).
- **Total out-of-pocket:** <$600, all within practitioner-lab budgets.
- **Time:** Two researchers for 3 weeks to adapt the harness, pre-author OpenSpec deltas, validate scenarios ↔ tests, and pre-register; 1 week for the automated run; 1 week for analysis and blog-post write-up.

---

## Summary of the Experiment

- **Substrate:** 80 SlopCodeBench tasks adapted to OpenSpec deltas with Given/When/Then scenarios.
- **Control:** Scenarios as prose only, no automated enforcement.
- **Treatment:** Same prose, but an automated verification gate runs the reference tests, shows failures, and allows one retry with rollback.
- **Primary endpoint:** Task-level silent regression rate (any earlier checkpoint test broken at final state).
- **Sample size:** 40 tasks per group → 80% power to detect a 35–40 pp drop in regression rate.
- **Greatest threat (self-testing):** Neutralised by hiding reference test code, recording agent test behaviour, and running a no-feedback retry ablation.
- **Cost:** Essentially free agent calls + <$600 infrastructure.
- **Commitment:** Full pre-registration, hidden referee, zero overclaiming; null results published as-is.
===== PART B =====
## 1. VALIDITY AUDIT

I rank threats by their ability to produce a non-causal explanation for a positive treatment effect—i.e., a reduction in measured regression that is *not* due to the agent genuinely learning to avoid breaking prior behaviour.

### Ranked threats (most severe first)

**Threat 1 — Selection bias from the “kept only if it passes at least as many checks” rule**
The gate policy in Part B is *not* the Verification Gate from 2607.01855. That paper gave the agent one retry after seeing failures, but **always kept the final commit**, regardless of whether it improved. Your rule discards the retry if it doesn’t improve the pass count, effectively filtering out every checkpoint where the agent failed to fix the regression in one attempt.  
This transforms Group T into a censored sample: the final codebase for a task has survived a series of pass-filter gates, while Group C’s codebase includes every failure that occurred. The final regression measurement compares a cherry-picked, best-of-two process against an unfiltered process. The causal claim “executable verification prevents breakage” would be confounded by “we threw away the breakage after it happened.” A reduction in measured breakage could occur even if the agent’s underlying propensity to create regressions is identical, simply because the gate discards the regressed states.  
Severity: **critical**. Under this rule, even a random-number-generator “agent” that always breaks things would show lower breakage in Group T (because every time it breaks, the retry is equally likely to break, the commit is discarded, and the prior checkpoint’s state is kept). The final state would be a mixture of lucky non-breaking retries and rolled-back prior states—artificially reducing measured regressions.

**Threat 2 — Retry asymmetry (compute confound)**
You give Group T exactly one extra attempt per checkpoint with full test output; Group C gets a single attempt. This bundles *feedback* with *extra compute*. If the treatment reduces breakage, we cannot tell whether it’s because of the information or because the agent gets a second chance to fix things. Your disclosed mitigation (give Group C a matched retry without verification) is partly valid, but a blank retry is not equivalent: without any information, the agent might just make different errors, increasing breakage in C and artificially widening the gap. The clean comparison is *same compute, different information*, which requires giving C an equally costly but non-verification activity—something no simple policy achieves. Severity: high, and interacts with Threat 1 because the “keep only if better” rule makes the extra compute even more powerful.

**Threat 3 — Teaching-to-the-test (scenario overfitting)**
The gate executes the accumulated Gherkin scenario suite, which is a subset of the hidden referee (the referee adds harness checkpoint tests). The agent sees failing scenario names and can patch directly to satisfy those specific assertions. The measured reduction in regressions on the *scenario* portion of the referee is then partly a test-memorization effect rather than a general behavioral correctness improvement. The harness-only tests provide a partial check, but they are only a subset; if the gate-induced fixing is shallow, you may still claim the treatment “prevents breakage” when it only prevents breakage on the exact examples it shows. Severity: moderate-high.

**Threat 4 — Pilot escalation rule and optional stopping**
The pre-declared rule “if frontier agents don’t break anything, lengthen chains or move to Stage 2 rather than buy a null” introduces a potential for post-hoc difficulty tuning. Even if the rule is pre-registered, the decision to escalate depends on the observed breakage rate in the control pilot. This creates a dependence between the sample and the hypothesis-testing procedure: you are effectively selecting a task difficulty that generates a non-null result. The causal effect estimate will then be conditional on that difficulty selection, and a hostile reader can dismiss it as “they just dialled up the difficulty until the effect appeared.” Severity: moderate, but easily fixed by fixing the task set before the pilot and committing to publish the pilot’s breakage rate regardless.

**Threat 5 — Guard metric (per-checkpoint task success) as a post-hoc narrative tool**
You say “guard metric: per-checkpoint task success, so the gate isn’t just blocking progress.” If that metric shows Group T completes fewer new checkpoints, you might still publish the breakage reduction as positive, but a critic will point out the gate made the agent overly conservative. If you then adjust the gate policy (e.g., relax “kept only if better”) based on this metric, you’ve broken pre-registration. Even without adjusting, the ambiguity of “preventing breakage by doing nothing” undermines the practical message. Severity: moderate.

---

## 2. COMPARABILITY VS REALISM

The “continuity with 2607.01855” framing is **useful but must be narrowed** to avoid overclaiming. The original study used:
- Toy Python tasks (not real projects),
- Sub-frontier models (not Claude Opus / GPT-5 class),
- A gate that ran only the *original* turn’s tests (not the accumulated suite),
- A non-agentic setting (no file system, no tools, single prompt-per-turn).

Your Stage 1 changes all four dimensions: frontier agents, more complex SlopCodeBench tasks, accumulated scenario execution, and an agentic loop. This is not a direct replication; it is a **generalisation test** of the Verification Gate principle. Calling it a “continuation” is acceptable if you explicitly label it as “conceptual replication at frontier scale with accumulated specifications” and do not imply that the earlier effect size should be expected unchanged. I would drop the phrase “ported from 2607.01855’s gate” because your gate policy (the keep-only-if-better rule) is *not* the one they used. The honest link is: “inspired by the Verification Gate’s finding that executable feedback, not restatement, reduced regressions; we test whether executable specifications in the form of a growing test suite have a similar effect when used by modern coding agents.”

**Recommendation:** Loosen the continuity claim, specify precisely what is replicated and what is new, and avoid implying that any observed effect size directly validates the earlier paper.

---

## 3. THE HOSTILE COMMENTER

**Comment 1 — Selection bias fatal flaw**
> “This experiment doesn’t measure whether verification prevents silent breakage; it measures what happens when you throw away every commit that fails tests. The treatment group gets to replay each checkpoint and discard the bad outcomes, while the control group’s mistakes stick. Of course the final codebase has fewer regressions—it’s a filter, not a prevention mechanism. I can get the same result by letting a human inspect the code at each step and revert if they see a bug. That’s not ‘executable specs prevent breakage,’ it’s ‘you didn’t measure breakage because you rolled back.’”

*Can the design answer this?*  
Not in its current form. The gate’s selective retention makes it impossible to separate feedback from filtering. **Change required:** The gate must accept the retry’s output unconditionally, exactly as 2607.01855 did. The “at least as many checks” rule should be dropped for the primary contrast. If you want to model a realistic CI gate that rejects regressions, run a separate arm with that policy and label it “CI-blocking” rather than “verification feedback.” The core causal question—does seeing executable feedback cause the agent to avoid breaking things in the first place?—requires that the codebase after a retry is always the agent’s best attempt, win or lose.

**Comment 2 — Toy tasks don’t convince me about real codebases**
> “SlopCodeBench tasks are still isolated scripts under 500 lines. My team’s codebase has 200k lines with interdependencies you can’t capture in a Gherkin scenario. You’re showing me that Claude can fix a single-file CLI game when you show it the failing test—that’s table stakes. Show me this working on a repository where a change in module A silently breaks a contract in module B that no scenario captured, and then we’ll talk.”

*Can the design answer this?*  
Not with Stage 1 alone. Stage 2 is explicitly designed for this, but Stage 1’s results will be dismissed by practitioners who equate “scale” with “realism.” To partially inoculate Stage 1, you can:
- Select the most structurally complex SlopCodeBench tasks (multi-file, with imports and stateful interactions) and report results separately for that subset.
- Include a “specification surface coverage” metric: what fraction of the referee’s harness tests correspond to scenarios the agent sees? If the harness tests capture cross-module regressions that no scenario covers, you can show whether the gate’s benefit extends beyond the explicitly specified behaviour.
- Frame Stage 1 as “necessary condition: if executable specs don’t help even at this scale, they won’t help at real scale; Stage 2 follows.”

**Comment 3 — Agent writes its own tests anyway, so the contrast is fake**
> “Claude Code generates pytest tests all the time. I bet your control agents often wrote unit tests from the Gherkin scenarios and ran them. If half the control group effectively got a self-administered treatment, your ‘null’ comparison is contaminated. You didn’t forbid test-writing, so what are you really comparing?”

*Can the design answer this?*  
Yes, if you instrument and report it fully, as my Part A design specified. You must log every test file created and every test-run command in both groups, and report the proportion of control tasks where the agent autonomously executed tests that covered at least one scenario. You can then do a per-protocol analysis excluding those tasks and show the treatment effect remains. If the effect disappears in the per-protocol subset, you’ve learned that self-testing closes the gap—still a valid and useful result. Without this instrumentation, the commenter is right.

---

## 4. FORK VS PLUG — Decision Checklist

The core trade-off: forking SlopCodeBench gives you battle-tested agent adapters and exact grading logic, but locks you into its architecture; importing tasks into your own harness gives you full control over group machinery but risks grading inconsistencies and agent-interface bugs. The following items, read from both codebases, should decide.

1. **(Highest weight) Grading integrity:** Does SlopCodeBench’s existing “strict re-run all earlier checkpoint tests” grading exactly match your intended hidden referee? Are the test suites per checkpoint idempotent, isolated, and resistant to pollution from later changes? If the harness grading can be reused unchanged, forking dominates. If it requires modifications that could introduce errors, importing and rewriting a smaller grading module might be safer. *Action:* Run the harness on 5 tasks manually and diff the grading output against a ground-truth manual run.

2. **Agent adapter reliability:** Does SlopCodeBench’s Claude Code and Codex CLI adapter faithfully capture the agent’s full terminal environment (including tool calls, file edits, test runs) without silent truncation or environment leakage? An adapter that drops tool outputs or injects artefacts will produce spurious results. If the adapters are robust and battle-tested by the SlopCodeBench authors, forking saves enormous debugging time. If they are brittle, writing your own minimal adapters in your harness might be faster. *Action:* Run a known task with verbose logging and trace every tool call; verify the agent’s view matches a raw CLI log.

3. **Difficulty of adding the OpenSpec layer:** Can you cleanly inject an OpenSpec change-delta file at each checkpoint without modifying the harness’s task-loading logic in ways that break grading? A harness that expects a fixed task structure and uses its own file templating may resist the addition of an extra markdown file that evolves per turn. If the SlopCodeBench harness’s task format is extensible (e.g., a directory with a manifest), forking is easy. If it hard-codes a single prompt, you’ll spend more time fighting the harness than building your own. *Action:* Attempt to implement the OpenSpec injection for one task in the fork and measure how many lines of harness code must change.

4. **Isolation and reproducibility:** Does the SlopCodeBench Docker setup guarantee that no agent can accidentally write to a shared volume or leave state that contaminates the next checkpoint? Are agent runs truly deterministic given a seed? Your two-group machinery requires bulletproof isolation so that Treatment and Control runs are independently reproducible. If the harness already pins all dependencies and cleans containers between turns, forking is safe. If not, your own harness with clean-room Docker management might be required.

5. **Support for hidden referee:** SlopCodeBench already runs the full checkpoint suite for grading; can that be executed silently *after* the agent finishes, without the agent ever seeing its output, while still capturing per-checkpoint breakage curves? The harness likely treats grading as a post-hoc step, which is exactly what you need. Verify that the grading output is structured enough to produce breakage-vs-checkpoint curves. *Action:* Run a complete agent task and extract a per-checkpoint pass/fail vector from the existing logs.

6. **Licensing and long-term maintainability:** If you fork, you inherit the MIT license and can modify freely. If you import tasks into your own harness, you own the pipeline but must maintain agent adapters yourself. Given your constraints (subscription-covered models, no large paid API spend, small team), forking reduces maintenance burden. This favors fork unless items 1–3 raise red flags.

**Weighted recommendation:** Read items 1–3 first. If SlopCodeBench’s grading is perfect, adapters are solid, and OpenSpec injection is <50 lines of change, fork it. Otherwise, extract the task corpus and build a minimal harness from your existing machinery—the higher control over group assignment and logging is worth the extra work.

---

## 5. BETTER ALTERNATIVES — Part A vs Part B and a Merged Design

Part A’s design is stronger for the specific causal claim because:
- It uses unconditional retry (always keep the retry), eliminating the Threat 1 selection bias.
- It includes an ablation arm to quantify the pure extra-compute effect, directly addressing Threat 2.
- It mandates instrumentation of agent self-testing, neutering Threat 3.
- It fixes the task set before any pilot, removing Threat 4.
- It explicitly measures per-checkpoint success as a secondary outcome without letting it contaminate the primary.

Part B’s actual plan introduces the “kept only if better” rule, which fatally confounds the primary effect with a performance filter. It also lacks the ablation arm and self-testing instrumentation. The pilot escalation rule adds flexibility but risks the appearance of p-hacking unless the escalation is to a pre-registered separate experiment, not a re-use of the same sample.

**Merged design — the strongest version:**
- **Gate policy (from Part A):** After each checkpoint, run the accumulated scenario suite, show pass/fail and failing scenario names, revert, and give exactly one retry. **Keep the retry’s output unconditionally**, regardless of whether it passes more, fewer, or the same number of checks. This isolates feedback from filtering.
- **Retry-equity ablation (from Part A):** A third arm with N=20 (using a limited model budget) where Control agents get a second, no-feedback retry with an instruction to “review and improve your code.” This quantifies the pure extra-compute contribution. If the treatment effect remains after subtracting the ablation arm’s improvement, the feedback-specific effect is identified.
- **Self-testing instrumentation (Part A):** Log all test-file creation and test-run commands. Report the proportion of control runs with self-testing. Offer a pre-registered per-protocol analysis excluding those runs.
- **Task set and pilot (improved Part B):** Pre-register the full 80-task set. Run the control-only pilot to verify that frontier agents produce a non-trivial breakage rate at this chain length (>20% of tasks with at least one regression, as a reasonable floor). If breakage is below that, report the pilot result as a genuine null (“frontier agents are too robust at this scale for executable specs to show a benefit”) and proceed to the pre-designed Stage 2 repository experiment—do not re-use or lengthen the same tasks post-hoc.
- **Hidden referee (Part B + Part A):** Use the SlopCodeBench harness’s full checkpoint tests that were never shown to any agent as a second, clean measure. Report the treatment effect on both the scenario-derived tests and the pure harness tests separately. This bounds the overfitting component.
- **Guard metric:** Report per-checkpoint forward success (does the agent implement the new requirement?) for both groups as a descriptive complement, never as a criterion for keeping or discarding data.

This merged design is stronger because it answers the precise causal question “does executable feedback reduce silent breakage?” without the selection filter, quantifies the compute confound, and precommits to publishing a null if the baseline breakage is too low.

---

## 6. RED-TEAM YOURSELF

The most likely way my recommendations mislead you is **over-emphasising internal validity at the expense of realism, producing a result that practitioners dismiss as a lab artifact.** My merged design’s unconditional-retry gate is internally clean but means a “treatment” agent can produce a final codebase that *fails all scenario tests*, while a real CI system would never accept that commit. A practitioner reading the study might say: “This ‘verification gate’ doesn’t actually gate anything; it’s just a test-run report. My CI pipeline blocks failing builds. Your experiment doesn’t tell me whether *blocking* regressions prevents silent breakage, only whether *showing* them does.” If the treatment effect under my unconditional-retry design is small because agents ignore the feedback and don’t fix the regression, a CI-blocking policy might show a much larger practical benefit—but that benefit is partly mechanical filtering, not agent learning. I might be steering you toward a pure measurement that answers a question no practitioner asks.

The evidence that would change my mind:
- If the control-only pilot shows that agents, when left alone, actually *do* regress frequently (≥60% of tasks), and if the ablation arm shows that a blank retry without feedback produces zero improvement, then the unconditional-retry gate’s feedback is the only difference—and the absence of CI-blocking can be explained as a deliberate experimental choice to isolate the feedback channel. That story holds up.
- If, instead, the pilot shows breakage rates around 20–30%, and the ablation arm reveals that a simple “try again” cuts breakage by 10 points, then the compute confound dominates, and my design’s insistence on a clean isolation might yield a muddy result that fails to detect the feedback effect. In that case, I would switch recommendation: make the primary comparison a realistic CI-blocking gate (only allow commits that pass all accumulated tests) vs. a text-only spec, and be transparent that the mechanism combines feedback and mechanical blocking. The causal claim would then be: “a CI gate that runs executable specs reduces the final regression rate by X%,” acknowledging the blend of prevention and filtering.

I should also acknowledge that my confidence in the unconditional-retry policy rests on the assumption that agents will use the feedback to *internally* avoid breaking things in the future, which may be stronger in frontier models than in sub-frontier ones. If frontier models treat each turn independently and simply patch the specific failure, the within-task learning may be minimal, and the benefit would be purely per-checkpoint patching—effectively a filtering effect even without the explicit “keep only if better” rule. That would make my crisp causal separation less meaningful than I claim.