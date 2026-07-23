<!-- PROVENANCE (added at ingest 2026-07-23; body below is verbatim operator paste)
  model-label: kim26 (operator-supplied filename label; version string as the operator saved it)
  mode: sequential (Part A answered, then Part B attack, one fresh chat)
  received: 2026-07-23 (file mtime)
  prompt: docs/e5/E5-DESIGN-DECISION-PANEL-PROMPT-v1.md (pasted verbatim between markers)
  status: lead with zero inherited credibility -- factual/citation claims must be re-verified before reliance
-->

 Here is a pre-review design. I have not read Part B.

---

## 1. Substrate and Task Structure

**Substrate:** Fork the **SlopCodeBench** harness (MIT, Docker-isolated, native adapters for Claude Code and Codex CLI). It already implements checkpoint-based evolution, strict re-scoring of all earlier checkpoints, and behavioral (not just patch-text) evaluation. We add a thin **OpenSpec parser** that converts Gherkin-like `Given/When/Then` blocks in repo markdown into executable tests.

**Task selection:** Draw a **stratified random sample of 50 tasks** from SlopCodeBench (or SWE-Milestone-style tasks adapted into the harness). Stratify by domain (API, CLI, service, data pipeline) and by estimated complexity (S/M/L) to avoid ceiling or floor effects. Each task is edited to contain exactly **5 checkpoints (turns)** with monotonically growing requirements. Turn 1 is bootstrapping; turns 2–5 each add a realistic change delta.

**Workflow realism:** Every repo contains:
- `specs/main.md` — the living specification in OpenSpec format (markdown + Gherkin scenarios).
- `deltas/delta_N.md` — the change description for turn *N*.
- A standard `README.md` explaining the OpenSpec workflow.

The agent is told: "Implement the change delta. Ensure all scenarios in `specs/` are satisfied. Commit after each turn."

---

## 2. The Two Groups

| | **Group A: Executable Surface** | **Group B: Text Surface** |
|---|---|---|
| **Scenario format** | Identical OpenSpec markdown as Group B, **plus** a `tests/` directory auto-generated from *all* scenarios (past + present) | Identical OpenSpec markdown only. **No `tests/` directory.** |
| **Post-implementation feedback** | Harness runs all executable scenarios after the agent commits. Failures are reported to the agent with scenario IDs. Agent gets **exactly one retry with rollback** (the "Verification Gate" protocol from arXiv:2607.01855). | Agent commits. **No automated feedback.** To control for the retry opportunity, the agent is allowed **exactly one self-directed revision** per turn, but receives *no* signal about what is broken. |
| **Agent instruction** | "Use the test results to verify all scenarios pass." | "Carefully verify your implementation against all scenarios in the specs before finishing." |

**What differs, and only what differs:** Whether the scenario blocks are backed by an executable harness that runs automatically and pushes failure information back to the agent. The spec text, delta format, retry count (one), workflow tool, and starter code are identical.

---

## 3. What the Agent Sees Each Step

**At the start of every turn (both groups):**
- The current repo file tree.
- `specs/main.md` containing **all scenarios from all prior turns plus the new turn** (the growing verified surface).
- `deltas/delta_N.md` describing the new requirement.
- `README.md` with workflow instructions.

**After implementation (Group A only):**
- A test report: `Scenario 1.3: FAIL — expected 200, got 500`, etc.
- The option to retry once. On retry, the repo is rolled back to pre-implementation state.

**After implementation (Group B only):**
- Nothing. The agent may choose to revise once, but has no external signal.

---

## 4. How Breakage Is Measured

**Primary outcome (turn-level):**  
*Regression indicator* = 1 if **any scenario from any prior turn** fails the hidden referee harness after the current turn's implementation, else 0.  
Denominator: total number of prior-turn scenarios at that turn (the "verified surface").

**Secondary outcomes:**
- **Chain-level regression indicator:** Did this task chain ever regress?
- **Cumulative pass rate:** Proportion of all scenarios (all turns) passing at each checkpoint.
- **New-requirement success rate:** Did the current turn's new scenarios pass? (To check if verification trades off against forward progress.)

**Measurement surface:** A **hidden referee harness**, separate from any test infrastructure the agent in Group A can see. After each turn, the referee:
1. Parses the canonical Gherkin scenarios directly from `specs/main.md` (not from agent-generated files).
2. Executes them against the agent's code in a fresh Docker container.
3. Records pass/fail per scenario.

This ensures the grading surface is identical across groups and invisible to agents.

---

## 5. Sample Size and Power

We anchor on the toy-scale literature and frontier-scale damage baselines:

| Source | Baseline regression | Effect size |
|--------|---------------------|-------------|
| arXiv:2607.01855 (toy, weak models) | 43.2% chains affected | → 12.5% with gate (Cohen’s *h* ≈ 0.83) |
| TensorBench (frontier, single patch) | 16% break prior tests | — |
| SWE-Milestone (frontier, multi-turn) | 38% collapse (isolated → continuous) | — |
| TDAD | 6.08% → 1.82% regressions | — |

**Conservative assumption for frontier multi-turn:** Baseline turn-level regression rate in Group B = **25%**. Expected in Group A = **10%** (a 15 point absolute reduction, smaller than the toy-scale 30 point reduction but plausible given stronger baselines). Cohen’s *h* = 0.51.

**Design:** 50 tasks × 5 turns = **250 turn observations per agent per group**. We run both Claude Code and Codex CLI, yielding **500 turn observations per group** (1,000 total turns).

**Power:** For a mixed-effects logistic regression with random intercepts for task and agent, 500 observations per group provides >99% power to detect an odds ratio of 0.33 (25% → 10%) at α = 0.05, two-tailed. For the chain-level binary outcome (assuming 40% → 15% regression rate), 50 tasks per group yields >95% power (Cohen’s *h* ≈ 0.58).

**Conclusion:** 50 tasks is conservative. We could detect a smaller effect (e.g., 25% → 15%) with comfortable power.

---

## 6. Biggest Validity Threat and Neutralization

**Threat: Spontaneous test creation in Group B.**  
Codex CLI and Claude Code are trained to write tests. A Group B agent might read the Gherkin scenarios and generate its own `test_foo.py`, effectively self-constructing executable verification and contaminating the treatment contrast.

**Neutralization (defense in depth):**
1. **Instructional:** Explicitly prompt Group B: "Do not create automated test files. Rely on the spec text."
2. **Environmental:** Remove test frameworks (pytest, jest, etc.) from the base image in Group B. If the agent installs one, we log it.
3. **Monitoring:** The harness logs all file creations. If a Group B task contains agent-created test files, we flag it. If the rate exceeds 10%, we exclude those tasks from the primary analysis and report the rate as a sensitivity covariate.
4. **Analytical:** Run a secondary analysis including only "pure" Group B runs (no test files created) to verify the primary result is robust.

**Secondary threat: Information equivalence.** If the auto-generated tests in Group A encode implicit semantics not present in the Gherkin text, we are not isolating *executability* but *information content*.

**Neutralization:** Use a **deterministic, 1:1 Gherkin parser** (e.g., `behave` or a custom parser) where the executable test is a direct, traceable translation of the text scenario. Group A agents see both the markdown text and the generated tests, but the text is verbatim identical to Group B.

---

## 7. Expected Cost Profile

| Item | Estimate | Notes |
|------|----------|-------|
| **Model calls** | $300–600 | 50 tasks × 2 groups × 2 agents = 200 task runs. Claude Code is subscription-unmetered. Codex CLI (the "limited" vendor) consumes ~$2–4 per multi-turn task. |
| **Compute** | $100–150 | Cloud Docker runners for parallel execution (referee isolation). |
| **Human time** | 3–4 weeks | 1 week: harness fork + OpenSpec parser + task curation. 1 week: piloting + protocol freeze. 1–2 weeks: batch execution + analysis. |
| **Pre-registration** | 0 | OSF or AsPredicted. |

**Total direct spend:** ~$400–750.  
**Risk buffer:** If Codex CLI quota is tight, we can run the full 50 tasks with Claude Code (unmetered) and run Codex on a random 20-task subset for generalization checking, cutting limited-vendor costs by 60% while preserving the primary contrast.

---

**Pre-registration commitment:** Before any agent run, we freeze: (a) the exact 50-task sample, (b) the randomization schedule assigning each (Task × Agent) pair to Group A or B, (c) the Gherkin-to-test parser code, (d) the primary/secondary analysis code, and (e) the exclusion rule for spontaneous test creation. No results are viewed until data collection is complete.

===== PART B ===== 

Here is the adversarial audit.

---

## 1. VALIDITY AUDIT

You disclosed three threats. Below are the strongest threats you **missed**, ranked by damage to the causal claim.

### 1.1 The Differential Measurement Surface (Severity: Critical)
**The problem:** Your hidden referee in both groups runs "the accumulated scenario suite plus the harness's own checkpoint tests." But Group T's agent during execution sees **only** the accumulated scenario suite. Group T optimizes against surface *S* (visible scenarios), while the referee grades against surface *S+H* (scenarios + harness tests). Group C is graded on *S+H* but never sees *S* execute. 

**Why this kills causality:** You are not measuring "did executable specs prevent regression?" You are measuring "did optimizing against a visible executable suite reduce regressions against a **secret, larger** test suite?" If the harness tests (*H*) catch bugs that the scenario suite (*S*) misses, Group T gets no signal about *H* during its retry and may leave *H*-failures unfixed. If *H* is highly correlated with *S*, the treatment effect is attenuated toward zero through no fault of the executable specs. If *H* is weakly correlated, you might falsely conclude the treatment works when it only works for *S* and not *H*. 

**The asymmetry is structural:** In a drug trial, this is like giving the treatment group a blood test that only measures cholesterol, then grading both groups on cholesterol + liver enzymes. The treatment group's "optimization target" differs from the grading rubric.

**Neutralization:** The hidden referee must be **byte-identical** to the executable suite shown to Group T. If you believe harness tests add necessary behavioral coverage, run a **three-arm pilot**: Group T sees *S* only; Group T' sees *S+H*; Group C sees neither. If T and T' diverge, your effect size is not generalizable to "executable specs" but to "executable specs with incomplete coverage."

### 1.2 The Mechanical Accumulation Confound (Severity: High)
**The problem:** You have 5 checkpoints with a **growing** accumulated scenario suite. The probability of triggering any regression mechanically increases as the suite grows. But Group T's gate **purifies** the codebase at each step: a bug introduced at checkpoint 2 is caught and (maybe) fixed before checkpoint 3. Group C's latent bugs **compound**. By checkpoint 5, Group C is running against a codebase with 4 checkpoints of unfixed drift, while Group T runs against a codebase that has been (selectively) scrubbed.

**Why this is not a feature:** You are measuring a **dynamic system** where the treatment changes the substrate. If Group T's checkpoint-5 regression rate is lower, it may be because checkpoint-5's *starting state* is cleaner, not because executable specs prevented a *specific* checkpoint-5 breakage. The treatment effect at late checkpoints is confounded by early-checkpoint purification.

**Quantification:** Suppose checkpoint *k* introduces a bug with probability *p*, and the gate catches fraction *c* of them. The effective "bug load" at checkpoint 5 in Group T is ~Σ(p×(1-c)) from k=1..4, while in Group C it is ~Σp. If *c* = 0.5, Group C has **2× the latent bug density** at checkpoint 5. Your turn-level regression metric conflates "prevented this turn's breakage" with "inherited a cleaner state."

**Neutralization:** Report **state-purified curves**: for each checkpoint, measure regression rate conditional on all prior checkpoints being clean (a "survivor" analysis). Also run a **crossover simulation**: take Group T's checkpoint-4 code, give it to Group C's checkpoint-5 delta, and measure. If the effect disappears, you were measuring state purity, not turn-level prevention.

### 1.3 The Retry-Compute-Time Confound (Severity: High)
**The problem:** Group T's retry gives the agent **more tokens, more tool calls, and more wall-clock time** per checkpoint. Frontier models show performance gains with increased test-time compute (e.g., OpenAI's reasoning models, Anthropic's extended thinking). Your gate does not just provide *information*; it provides a **second roll of the dice** with the same budget. Even if you give Group C a "blind retry," the retry is unguided—worse than no information, but still extra compute. 

**The quantitative trap:** If Claude Code's success rate improves by, say, 8% purely from a second pass (regardless of feedback), your ~15-point effect size is inflated by ~50%. You cannot disentangle "feedback" from "compute."

**Neutralization:** Add a **Group C+**: text-only, but given a **randomly selected** prior scenario to "focus on" during their retry (no pass/fail signal, just a prompt: "pay special attention to scenario 2.3"). This matches the *attentional* and *computational* load of Group T's retry without the informational content. If Group C+ moves halfway to Group T, your effect is partly compute/attention, not verification.

### 1.4 The Spontaneous-Test Creation Asymmetry (Severity: Medium-High)
You flagged this, but your likely mitigation (instructional + monitoring) is **underpowered**. Claude Code and Codex CLI are RLHF'd to write tests when they see Gherkin. In a pilot of 20 Group C tasks, if even **3 agents** write tests, your exclusion threshold (if you planned one) forces you to either drop 15% of your sample post-hoc (destroying randomization) or keep them (diluting the contrast).

**The deeper issue:** "Forbidden" is unrealistic; "allowed" is uncontrolled. But there is a **third option** you missed: **instrumented permission**. Give both groups a `verify.sh` script that *can* run tests, but in Group C it is a no-op that returns "Manual verification required." In Group T it runs the real suite. This makes the *workflow* identical (both groups type `./verify.sh`), but the *information content* differs. If Group C agents write their own tests anyway, you log it, but the workflow realism is preserved.

---

## 2. COMPARABILITY VS REALISM

**Verdict: The "continuation" framing is dishonest and dangerous. Drop it.**

You are not continuing 2607.01855. You are **inverting every design parameter** that defined its effect:

| Parameter | 2607.01855 | Your Stage 1 |
|---|---|---|
| Task scale | Toy functions (≤50 LOC) | SlopCodeBench tasks (realistic multi-file) |
| Model capability | Sub-frontier (6 models, 40–73% failure) | Frontier (Claude Code, Codex CLI) |
| Agent architecture | Fixed 8-turn prompt loop | Native agentic mode with tools |
| Test surface | Original turn's tests only | **Accumulated, growing** suite |
| Gate target | Original tests | Accumulated suite + harness tests |
| Effect mechanism | Model sees failure output | Model sees failure + **optimizes via tool use** |

The 2607.01855 gate gave a **30-point absolute reduction** (43.2% → 12.5%) on weak models with tiny tasks. Your frontier agents on realistic tasks have a **different damage mechanism**: they don't forget requirements; they make **architectural trade-offs** that satisfy the new delta while violating old constraints in subtle ways. The toy-scale gate worked because models were sloppy; the frontier gate, if it works, works because **feedback redirects search** during tool use. These are different causal pathways.

**Honest framing:** "2607.01855 established the phenomenon at toy scale. We test whether the mechanism survives frontier agentic deployment on realistic checkpoint chains. We anchor power on an **independent prior** (TensorBench's 16% single-patch breakage, SWE-Milestone's 38% multi-turn collapse) and treat 2607.01855 as proof-of-concept, not as a direct benchmark."

**Why this matters:** If you claim continuity, a hostile reader will force you to explain why every parameter inversion is valid. If you claim independent replication, the burden shifts to "is this a robust finding across scales?"—a much stronger position.

---

## 3. THE HOSTILE COMMENTER

Here are the three most damaging comments, verbatim, and whether your design can answer them.

### Comment 1
> "This proves nothing about executable specs. Group C is a strawman. No engineering team gives an AI agent a Gherkin spec and says 'don't write tests.' In the real world, both groups would have tests—the question is who writes them. Your 'treatment' is just 'we gave them tests' vs 'we forbade tests.' The honest comparison is 'executable specs provided upfront' vs 'agent writes its own tests from the spec.' Until you run that, you're measuring an artificial constraint, not a tooling decision."

**Can you answer it?** No. Your design explicitly creates an artificial Group C.  
**What change would answer it?** Add **Group C+**: identical to Group C, but the agent is explicitly instructed to write and run its own tests from the Gherkin before committing. Compare Group T vs Group C+ as the **real-world policy contrast**. Group C (forbidden) becomes a mechanistic decomposition: it isolates the "information" effect (feedback vs no feedback) from the "who writes tests" effect. Report both contrasts.

### Comment 2
> "Your hidden referee runs tests the agent in Group T never saw during its retry. So Group T optimized for surface X, and you graded it on surface X+Y. If Group T's regressions are low, maybe it just got lucky that X correlates with Y. If they're high, maybe X is a bad proxy. You didn't measure 'executable specs prevent breakage'—you measured 'executable specs prevent breakage against a secret test suite.' That's not a feature of the tool; that's a feature of your grading."

**Can you answer it?** Only if you make the referee identical to the visible suite.  
**What change would answer it?** Either (a) make the hidden referee **identical** to the accumulated scenario suite shown to Group T, or (b) add a **Group T-full** that sees *S+H* during execution and retry. If Group T and Group T-full are identical, the secret-suite criticism dies. If they diverge, you have discovered something important about spec completeness, but you cannot claim a clean causal effect for "executable specs" generically.

### Comment 3
> "50 tasks on SlopCodeBench is a benchmark study, not an engineering study. Real repos don't have 5 neat checkpoints with Gherkin scenarios. They have 500 commits, ambiguous requirements, and tests that flake. Your Stage 2 is vaporware—'later, separately designed'—so you're asking us to upend our tooling budget based on a toy benchmark with a promise. Show me the same effect on a real repo with real milestone sequences, or admit this is just academic calibration."

**Can you answer it?** Not with Stage 1 alone.  
**What change would answer it?** You cannot fix this in Stage 1. The only defense is **intellectual honesty**: pre-register Stage 1 as a "mechanism-validation study" and explicitly state that **no tooling recommendation follows until Stage 2 confirms the effect on repository-scale sequences**. Better yet, swap the framing: Stage 1 is not the main event; it is a **pruned pilot** to decide whether Stage 2 is worth the cost. If Stage 1 is null, you save Stage 2 budget. If positive, you have a causal mechanism to test at scale.

---

## 4. FORK VS PLUG

Ranked checklist of facts to extract from both codebases. **Decision-weight descends.**

1. **Grading logic coupling:** In SlopCodeBench, is the "strict accumulated re-scoring" hard-coded into the task definitions, or is it a swappable grader module? If you must rewrite core scoring to add your hidden referee (*S+H*), the fork advantage evaporates. **(Weight: 9/10)**
2. **Retry/rollback driver support:** Does SlopCodeBench's agent adapter expose a hook for "execute → evaluate → conditionally rollback → retry," or is the agent loop fire-and-commit? If you must hack the driver loop, your own harness (if it has native A/B group machinery) may be cheaper. **(Weight: 8/10)**
3. **Task export cleanliness:** Can SlopCodeBench's problem set be dumped as a flat directory per task (starter code, canonical solution, checkpoint deltas, canonical tests) without importing its Docker orchestration? If yes, "plug" is trivial. If tasks are entangled with the harness's internal checkpoint runner, fork is forced. **(Weight: 8/10)**
4. **Native A/B audit infrastructure:** Does your existing harness already implement randomization locking, pre-registration checksums, and tamper-evident logs? If yes, replicating that in a fork is 2+ weeks of work. If no, the fork's ready-made plumbing is worth more. **(Weight: 7/10)**
5. **OpenSpec parser integration point:** Where does the Gherkin-to-test translation live? If SlopCodeBench expects raw Python test files, you need a pre-processor. If your harness already has a spec-driven workflow layer, the integration is native. **(Weight: 6/10)**
6. **Agent adapter drift:** How often does SlopCodeBench update its Claude Code/Codex CLI adapters to match vendor CLI changes? If frequently, maintaining a fork is a tax. If rarely, the adapter value is high. **(Weight: 5/10)**

**Decision rule:** If facts 1–3 favor SlopCodeBench (clean export, swappable grader, hackable driver), **fork**. If your harness already has strong audit infrastructure (fact 4) and SlopCodeBench is entangled (facts 1–3 negative), **plug** the task corpus into yours.

---

## 5. BETTER ALTERNATIVES

Your plan is stronger than my Part A on **workflow realism** (OpenSpec integration, guard metric) and **pragmatism** (pilot escalation). My Part A is stronger on **measurement hygiene** (identical hidden referee, stratification, environmental controls for Group C). 

**Merged design:**

| Element | Source | Rationale |
|---|---|---|
| **Substrate** | Your plan: Fork SlopCodeBench | Native frontier-agent adapters are too costly to rebuild. |
| **Task sampling** | My plan: Stratified random sample of 50 by domain/complexity | Prevents ceiling/floor effects; required for practitioner generalization claims. |
| **Groups** | Your plan: Group C (text) vs Group T (executable) | Clean causal contrast. |
| **Group C+ (new)** | My plan + your realism concern | Add a third arm where Group C writes its own tests. This answers Comment 1. |
| **Referee** | My plan: Identical to visible suite in Group T | Your *S+H* referee is indefensible. If harness tests are necessary, run them as a **secondary analysis** ("generalization to hidden requirements") not as the primary grading surface. |
| **Gate policy** | Your plan: Retry kept if passes ≥ as many checks | Adopted, but clarify the metric: "best of two attempts" per checkpoint. |
| **Group C retry** | My plan: One blind retry | Matches computational budget. Add my **Group C+ random-focus** to isolate compute vs information. |
| **Environmental control** | My plan: Remove test frameworks from Group C image | If >10% of Group C tasks install frameworks, report it as a **compliance failure** rather than excluding (exclusion destroys randomization). |
| **Pilot** | Your plan: Control-only with escalation rule | Keep this, but pre-register the escalation rule exactly: "If <20% of checkpoint-3 chains show regression in the control pilot, lengthen to 8 checkpoints or increase complexity tier." |

**Primary analysis:** Mixed-effects logistic regression on turn-level regression, with random intercepts for task and agent, fixed effect for group, and checkpoint number as a covariate.  
**Secondary:** Chain-level survival analysis (time-to-first-regression).  
**Guard metric:** Per-checkpoint new-requirement success rate (must not trade off).

---

## 6. RED-TEAM YOURSELF

**How I am most likely misleading you:**

1. **Overstating the hidden-referee threat.** If SlopCodeBench's "harness tests" are actually just **deterministic, mechanical translations** of the Gherkin scenarios (e.g., "Given/When/Then" compiled to pytest with zero semantic addition), then *S+H* ≈ *S*, and my "differential surface" critique is a phantom. I am assuming *H* adds novel coverage; if it does not, your original design is cleaner than I claim.

2. **Pushing for Group C+ (self-tests) when it destroys power.** Adding a third arm splits your sample. With 50 tasks, you go from 25 per group to ~16 per group. If the self-test arm shows an intermediate effect, you have a cool decomposition but no significant pairwise contrast. I may be privileging "answer the hostile commenter" over "publish a significant result."

3. **Underestimating the value of the 2607.01855 continuity frame.** Practitioners trust sequences. If you honestly say "this is a different scale, different mechanism," you may lose the audience that 2607.01855 earned. My advice to drop the continuity frame might make the post less credible to CTOs who need an anchor.

**Evidence that would change my mind:**

- **If you can show me** that in a 5-task pilot, Group C agents write their own tests in <5% of checkpoints, I would drop the environmental-control and Group C+ recommendations as over-engineering.
- **If you can show me** that SlopCodeBench's harness tests are 1:1 compilations of the Gherkin with no added behavioral assertions, I would withdraw the differential-surface critique and endorse your original referee design.
- **If a power simulation** (using your actual pilot data as input) shows that a three-arm design needs >80 tasks to detect the expected effect, I would retract the Group C+ arm and accept the two-arm design with the "strawman" criticism as an unavoidable limitation.

**Final note:** The most dangerous advice I could give is to let the perfect be the enemy of the publishable. Your original plan, despite its flaws, produces **a real causal contrast** on a realistic substrate with frontier tools. My merged design is stronger, but if it adds 3 weeks of implementation and 50% more compute, the null risk rises. **A flawed pre-registered experiment beats a perfect one that never ships.**