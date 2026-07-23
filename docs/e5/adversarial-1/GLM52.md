<!-- PROVENANCE (added at ingest 2026-07-23; body below is verbatim operator paste)
  model-label: GLM52 (operator-supplied filename label; version string as the operator saved it)
  mode: sequential (Part A answered, then Part B attack, one fresh chat)
  received: 2026-07-23 (file mtime)
  prompt: docs/e5/E5-DESIGN-DECISION-PANEL-PROMPT-v1.md (pasted verbatim between markers)
  status: lead with zero inherited credibility -- factual/citation claims must be re-verified before reliance
-->

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
*   **Engineering Time:** ~2 weeks to fork the harness, write the 100 sequences and hidden Referee suite, and wire OpenSpec to `pytest-bdd` for Group B. Pre-registration of the Referee suite is the highest-risk bottleneck.
===== PART B =====
Here is the adversarial review of your Stage 1 plan. I have assumed the role of a hostile but technically rigorous senior practitioner. 

### 1. VALIDITY AUDIT

Your three disclosed threats are real, but your framing of them leaves you exposed. Here is the deeper cut, ranked by threat severity.

**Threat #1: The "Selection Bias" of the Gate (Unaddressed)**
Your ported gate policy from 2607.01855 grants Group T a retry *only if* the accumulated suite fails, and keeps the retry only if it passes at least as many checks. This does not just provide feedback; it actively **filters out bad patches**. Group C has no such filter. 
*   **The confound:** You are not just testing "executable specs prevent breakage." You are testing "executable specs + a CI rejection filter prevent breakage." Of course Group T breaks less; you retroactively deleted their broken commits!
*   **The fix:** This is actually the *correct* real-world mechanism (CI gates block merges), but your causal claim must explicitly state that the treatment is "Executable Pushback + Rejection," not just "Executability." You cannot neutralize this without stripping the retry/rollback, which destroys the realism. Own the mechanism in the writeup.

**Threat #2: The Retry Asymmetry & Feedback vs. Compute Confound**
If Group C gets no retry, the effect is doubly confounded (feedback + compute). If Group C gets a matched retry budget ("review your diff and try again"), the confound survives in a subtler form: **objective machine feedback vs. subjective self-reflection**. 
*   **The defensible choice:** Give Group C a matched retry budget with a mandated self-reflection step. This isolates the causal variable to *the nature of the feedback* (executable assertion vs. agent introspection). Practitioners care deeply about this distinction: "Is reading my own diff as good as running a test?" 

**Threat #3: Self-Verification Policy (The "Agent Initiative" Dilution)**
If you allow agents to write and run their own tests, Group C will partially self-supply the treatment. 
*   **The defensible choice:** **Allow it.** Forbidding Claude Code from running `pytest` is artificial and instantly dismissible by practitioners. The contrast here is honestly framed as: *"Provided, accumulated executable specs vs. Agent ad-hoc initiative."* If the effect dilutes to zero, that is a profoundly useful null: it means frontier agents are already capable of generating their own regression gates, and tooling like OpenSpec adds no marginal value. That is a practitioner-credible result.

**Threat #4: Visibility Manipulation (The "Artificial Blinding" Attack)**
If Group C sees Gherkin blocks as text, a hostile commenter will say: *"Claude Code can read Gherkin. The agent could have written a `pytest-bdd` runner itself. You artificially blinded it by not telling it the specs were executable."*
*   **The fix:** Group C's system prompt must state: *"The Given/When/Then blocks in OpenSpec are design documentation only; they are not wired to an execution engine."* This mirrors reality (many teams write Gherkin but never automate it). 

**Threat #5: The "Byte-Identical" Illusion**
You specify byte-identical Gherkin. But in Group T, that Gherkin is backed by step definitions (Python code). In Group C, it is not. If the Gherkin is ambiguous, Group T's step definitions resolve the ambiguity (the tests enforce a specific interpretation). Group C might implement a valid interpretation of the prose that Group T's hidden referee marks as "broken." 
*   **The fix:** The hidden referee suite must be distinct from Group T's visible suite, and must test the *intended* behavior, not Group T's specific step-definition interpretation.

### 2. COMPARABILITY VS REALISM

**Drop the "continuation" framing.** It is neither honest nor useful.

*   **Why it's dishonest:** 2607.01855 used 542 toy tasks, weak models, and only executed the *original* turn's tests. You are using repo-scale chains, frontier agents, and an *accumulated growing* suite. The information environment is fundamentally different. Claiming continuity invites attacks on the deltas.
*   **Why it's harmful:** If your effect size is smaller than +12 points, a commenter will say "You claimed continuity, but your effect is weaker, therefore your design is flawed." 
*   **The fix:** Frame it as a **"Scale-Up Test"**. "Prior toy-scale work suggested verification gates mitigate regression. We test if this effect survives the transition to frontier agentic modes and accumulated specification surfaces." This frames the gap honestly.

### 3. THE HOSTILE COMMENTER

**Comment 1:** 
> *"Of course Group T broke less. You gave them a pre-written, ever-growing test suite and a CI gate that blocks bad commits. In reality, if I have a Gherkin spec, Claude Code can write the pytest-bdd runner itself. Your experiment just proves 'having tests is better than not having tests', which is banal."*

*   **Can we answer it?** Yes, but only via the self-verification policy. If Group C is allowed to write and run tests, and Group T *still* wins, you have proven that **provided, accumulated specs** outperform agent-initiated ad-hoc testing. If you forbid C from testing, this comment is fatal.

**Comment 2:**
> *"Your Group C was artificially handicapped. You gave it Gherkin syntax—a format explicitly designed for automation—as 'readable text'. A frontier agent seeing Gherkin will try to execute it, fail, and get confused, or waste tokens trying to wire it up. You're punishing Group C for your weird workflow choice."*

*   **Can we answer it?** Partially. The system prompt clarification (Threat #4) helps. But to fully neutralize this, you must log Group C's actions. If C never attempts to write a BDD runner, the attack fails. If C spends 30% of its tokens trying to wire up Gherkin and failing, the attack succeeds. **Action:** Log and publish agent tool calls. 

**Comment 3:**
> *"Your 'silent breakage' metric is just a rehash of SlopCodeBench's accumulated regression. But what if Group C's agent *refactored* the old code to be better, breaking the old test but improving the architecture? Group T was forced by the gate to keep the old, brittle implementation. You're punishing Group C for superior engineering."*

*   **Can we answer it?** No. This is a classic benchmarking attack. 
*   **The fix:** The task instructions must explicitly forbid refactoring prior checkpoints: *"Maintain backward compatibility with all prior behavior; do not refactor previous implementations."* Additionally, the hidden referee should include tests for *intended* behavior, not just exact implementation details.

### 4. FORK VS PLUG

You cannot read the codebases. Here is the checklist of facts to extract, ranked by decision-weight:

1.  **[Weight: 10] Agent Isolation & State Management:** Does SlopCodeBench handle the Docker container lifecycle, file system mounting, and agent CLI subprocess execution natively? (If yes, Fork. Rebuilding this is high-risk).
2.  **[Weight: 9] Accumulated Grading Logic:** Does SlopCodeBench natively support running the *accumulated* test suite for checkpoint $N$ against the code at checkpoint $N$? (If yes, Fork. This is the core metric).
3.  **[Weight: 8] Retry/Interception Mechanism:** Does SlopCodeBench's agent adapter support intercepting the agent's "I'm done" signal, running a check, and feeding failure output back for a retry? (If yes, Fork. If your harness has this and SlopCodeBench doesn't, Plug).
4.  **[Weight: 6] Problem Set Format:** Are SlopCodeBench's checkpoint chains structured as sequential, additive requirements? (If yes, Fork. You can adapt your OpenSpec specs to fit).
5.  **[Weight: 4] OpenSpec Integration:** How tightly coupled is your existing harness to OpenSpec's markdown parsing? (If very tight, Plug. SlopCodeBench won't have this).

**Recommendation:** Fork SlopCodeBench. The agent plumbing and Docker isolation are the hardest parts to build. You can write OpenSpec markdown files into the forked repo easily.

### 5. BETTER ALTERNATIES

**Part A's design is stronger on causal validity.** It explicitly matched the retry budget (mandated self-reflection) and allowed self-verification.
**Part B's plan is stronger on realism and infrastructure.** It uses SlopCodeBench, OpenSpec natively, and includes a pre-declared pilot escalation rule (excellent discipline).

**The Merged Design (The Strongest Option):**

1.  **Harness:** Fork SlopCodeBench (saves engineering time, provides Docker isolation).
2.  **Workflow:** OpenSpec workspaces with byte-identical Gherkin. 
3.  **Groups:**
    *   **Group T (Treatment):** OpenSpec Gherkin wired to `pytest-bdd`. After checkpoint, accumulated suite runs. Agent sees pass/fail + failing scenario names. Gets 1 retry with rollback (kept if >= checks pass).
    *   **Group C (Control):** OpenSpec Gherkin as text only. System prompt states specs are documentation only. **Matched retry budget:** After signaling completion, agent is prompted: "Review your diff against the OpenSpec text scenarios. You have one retry to fix any issues." 
4.  **Self-Verification:** **ALLOWED** in both groups. Agents can write and run their own tests. Log how often they do. 
5.  **Pilot:** Control-only with escalation rule (if frontier agents don't break at this scale, lengthen chains before buying a null).
6.  **Measurement:** Hidden referee suite (invisible) run after every checkpoint. Tracks "Silent Breakage Rate" (prior behavior that passed but now fails).

**Why this is strongest:** It isolates the *nature of feedback* (executable pushback vs. agent introspection) while holding compute constant. It allows agent initiative (realism). It uses existing infrastructure (efficiency). The pilot prevents wasted runs on a null.

### 6. RED-TEAM YOURSELF

**The most likely way my recommendations mislead you:**

My insistence on "allowing self-verification" (Group C writing its own tests) sounds like the high-realism, practitioner-credible choice. **But it might destroy your experiment.** 

If Claude Opus 4.7 is very good at writing its own regression tests, Group C might break very little. The contrast between Group T and Group C might shrink to a null. You would publish an honest null: *"Provided executable specs offer no marginal benefit over agent initiative."*

**Why this misleads:** Practitioners might read this and abandon spec-driven tooling. But the null might be an artifact of your specific task structure. If the tasks are simple Python functions, agents can easily write their own tests. If the tasks involve complex, multi-file stateful interactions, agents *cannot* easily write integration tests, and provided executable specs become crucial.

**What evidence would change my mind:**
If, during the control-only pilot, you observe that Group C agents *spontaneously* write comprehensive, accumulated regression suites without being prompted, and these suites catch >80% of breakages, then I am wrong. The self-verification policy is diluting the treatment to the point of uselessness, and you *must* forbid agents from running their own tests (sacrificing realism for causal clarity) to get a clean signal. 

Run the pilot. Watch what the agents do with tests. That behavior dictates the final protocol.