<!-- PROVENANCE (added at ingest 2026-07-23; body below is verbatim operator paste)
  model-label: Minimax3 (operator-supplied filename label; version string as the operator saved it)
  mode: sequential (Part A answered, then Part B attack, one fresh chat)
  received: 2026-07-23 (file mtime)
  prompt: docs/e5/E5-DESIGN-DECISION-PANEL-PROMPT-v1.md (pasted verbatim between markers)
  status: lead with zero inherited credibility -- factual/citation claims must be re-verified before reliance
-->

# Experimental Design: Executable vs. Text-Only Scenarios for Frontier Coding Agents

## Headline

A 2×2 pre-registered experiment (agent: Claude Code / Codex CLI) × (group: text-only / executable-and-feedback) on adapted SlopCodeBench tasks wrapped in OpenSpec change proposals, graded by a hidden referee running canonical test suites, with N=60 chains per cell and a pre-registered budget cap of N=80 per cell.

## Substrate and task structure

**Harness (forked)**: SlopCodeBench (arXiv:2603.24755) is MIT-licensed, has native Claude Code and Codex CLI adapters, Docker isolation, and "strict scoring" that re-runs every prior checkpoint's tests on the agent's committed state. I fork it and disable the strict-scoring loop from the agent's view, keeping it only on the referee's side.

**Tasks**: a stratified random sample from SlopCodeBench's existing checkpoint sequences. I exclude any task where the agent's "current frontier" baseline already passes every checkpoint — the floor of trivial tasks adds noise. I stratify by SlopCodeBench's reported difficulty tiers (Easy / Medium / Hard) so a result isn't driven by one bucket. Each chain has 6 checkpoints (matches arXiv:2607.01855's turn budget; trimmed from 8 because frontier cost-per-turn is much higher and 2607.01855's signal was already present at turn 6).

**Workflow layer (identical across both arms)**: every checkpoint is presented to the agent as an OpenSpec change proposal — a markdown delta in the repo with `## Scenarios` blocks written in Given/When/Then form. OpenSpec is the workflow; the spec format is the same. What changes between arms is not the spec, only whether its executable binding is run.

## The two groups and what differs

| | **Control (text-only)** | **Treatment (executable)** |
|---|---|---|
| Spec content the agent sees | OpenSpec delta + G/W/T scenarios (markdown) | OpenSpec delta + G/W/T scenarios (markdown) |
| Workflow tool | OpenSpec | OpenSpec |
| Agent CLI | Claude Code **or** Codex CLI | Claude Code **or** Codex CLI |
| Tools available to agent | full repo + bash + read/write | full repo + bash + read/write |
| Post-submit step | harness stores committed state, does nothing else | harness executes the G/W/T binding for **all** prior scenarios on the new state, surfaces failures, offers **exactly one retry+rollback** (matching 2607.01855's Verification Gate) |
| Referee | hidden, runs canonical suite after every turn | hidden, runs canonical suite after every turn |
| What the agent learns about the binding | nothing | diff of failing scenarios with file:line |

**What is held constant**: prompt template, tool surface, system prompt, G/W/T text, model version, temperature, seed, task order, harness plumbing, retry budget. **What is allowed to differ**: a single boolean — *run the binding after each turn and show failures, or not*.

**Why this isolates executability**: the causal claim we want to support is "executable specs prevent silent breakage." The minimal operationalization is "the harness turns the G/W/T into running assertions and surfaces the result to the agent." Control is exactly the absence of that single step. Everything else — spec format, tooling, even the existence of the scenarios as text — is identical.

## What the agent sees, each turn

1. **System prompt** (frozen pre-registration): one paragraph stating the task, the repo, the change to implement, and that the agent should commit a final state when done.
2. **OpenSpec change proposal** (delta markdown) for the current checkpoint, including its `## Scenarios` block in G/W/T form. This is the *only* place acceptance criteria appear in either arm.
3. **Repo state** at the start of the turn.
4. Agent iterates with native tools.
5. Agent emits a final commit.

After step 5:
- **Control**: harness records the commit. Nothing is run that the agent could see.
- **Treatment**: harness runs the executable binding of (a) the current checkpoint's scenarios and (b) **every prior checkpoint's scenarios** against the new state. Any failures are surfaced with file:line and the actual vs. expected output. The agent gets **one** retry; during the retry it can either edit forward or explicitly `git checkout` to the pre-turn state. After the retry (or skip), the turn ends.

The agent never sees the referee's canonical tests, never sees the binding's source code unless it asks via the repo (and the binding is stored outside the agent's working tree), and never sees a "score."

## How breakage is measured

**Referee surface (hidden)**: after every turn, on a clean container, the referee runs the canonical test suite for the **current** checkpoint and for **every prior** checkpoint. Output: per-checkpoint pass/fail.

**Primary outcome (binary, per chain)**: *regression-affected chain* = 1 if any prior checkpoint's canonical suite fails at any turn k ≥ 2; 0 otherwise. This is the same metric arXiv:2607.01855 reports (43.2% → 12.5% under their gate).

**Secondary outcomes**:
- *Per-checkpoint retention rate*: fraction of prior checkpoints still passing at turn k, averaged over k.
- *Original-checkpoint pass rate*: does the change the agent was asked to implement in this turn still work after the agent finishes? (catches agents who satisfy the new spec by breaking the old one — but only if the binding is faithful; canonical suite is the truth).
- *Completion rate*: chains that finished all 6 checkpoints without harness-aborting. Reported per arm; intent-to-treat analysis uses started chains as the denominator.

**Surface integrity**: the canonical suite is sealed before the run. The executable binding the treatment agent sees is **not** the canonical suite — it is a deterministic translation of the G/W/T block produced by a pre-registered translator with a fixed rule set. Blinding is preserved because the canonical suite lives in a separate Docker image the agent's container cannot reach.

## Sample size and power

Anchors from the literature:
- arXiv:2607.01855: 43.2% → 12.5% on the binary regression-affected metric (h ≈ 0.70). Sub-frontier models, toy scale.
- SWE-Milestone: 80% → 38% on frontier models at repo scale, but no within-paper arm comparison. The 42pp drop is descriptive, not a treatment effect.
- TDAD: 6.08% → 1.82% on a tighter intervention, but with instruction confounding.

**Working assumption**: frontier effect is **smaller** than 2607.01855's sub-frontier toy result, because (a) frontier agents already do implicit verification, and (b) real-repo bindings are noisier. I power on a 15pp reduction (e.g., 45% → 30%) on the binary outcome, α=0.05, power=0.80, two-sided. For two-proportion test, h ≈ 0.31, required n ≈ 165 per group. With agent as a blocking factor and a stratified analysis, **N = 60 chains per cell × 4 cells = 240 chains** is adequately powered for the headline 15pp effect. **Pre-registered cap: N = 80 per cell = 320 chains** if budget permits; we publish whatever n we actually reach and do not backfill.

Two agents is not a luxury — without both, "frontier agents" is a one-vendor claim and the result won't survive hostile comments.

## The biggest validity threat and how I neutralize it

**The threat: binding infidelity.** The executable binding is a translation of G/W/T prose into code. Two failure modes either kill the experiment or invert its conclusion:

- **False negatives** (binding passes, canonical fails): the experiment under-counts breakage in the treatment arm relative to control. Because the control arm never runs the binding at all, false negatives are *asymmetric* — they only blunt the treatment, biasing toward null.
- **False positives** (binding fails, canonical passes): the agent wastes its one retry on a phantom failure, degrading treatment-arm performance for no real reason. Also biases toward null.

Either way, the threat biases toward "no effect" — so a positive result is real, but a null could be artifact. That is unacceptable for a thesis-supporting claim.

**Neutralization**:

1. **Pre-registered binding rules** with a frozen translator. No tuning during the run.
2. **Sealed calibration on N=10 chains** (not in the main analysis) before the registered run starts, measuring binding-vs-canonical agreement (Cohen's κ per checkpoint, reported regardless of value). If κ < 0.6 on any difficulty tier, I pause and revise the translator before any registered data is collected. This is the one pre-registered look.
3. **Per-arm reporting of both signals**: the published headline is the canonical (referee) measurement. The binding-vs-canonical agreement is reported as a sensitivity check. If the binding has high κ and the canonical shows the effect, the result is clean. If κ is low, the result is qualified in the post.
4. **Asymmetry audit**: I pre-register that I will report the false-negative and false-positive rates per arm. If they are not approximately equal across arms, the null result is downgraded to "inconclusive under this binding."

This is the design's load-bearing piece. Without it, a null is uninterpretable; with it, a null is honest.

## Cost profile

- **Per chain**: 6 turns × ~10 min/turn (frontier agent, real repo, file edits + bash) = ~60 min of agent runtime.
- **Sequential**: 240 chains × 60 min = 240 hours. With 8-way parallelism across two machines (one per agent vendor, each with a subscription), wall clock is **~30 hours** for the primary N, ~40 hours for the capped N.
- **API spend**: ~$0 marginal on subscription for both vendors. I assume one vendor is effectively unmetered (Claude Code Max / similar) and one is rate-limited but unmetered within window. If the rate-limited vendor's quota is hit, I cap at its reachable N and report it.
- **Referee cost**: runs the canonical suite on a clean container per turn per chain. With SlopCodeBench's parallel harness, ~10–20 min wall clock per chain end-to-end including referee; well under 1 core-day per chain total. Bounded.
- **Pre-registration labor**: ~1 week to seal the binding translator, the canonical-suite seal, the prompt templates, and the analysis script. Published on OSF before the first registered run.

## Pre-registration scope (frozen before any data)

- Substrate: SlopCodeBench fork, commit hash frozen.
- Task list + difficulty stratification: frozen.
- Binding translator: rule set frozen; calibration protocol frozen.
- Canonical suite seal: per-task canonical test files + Docker image hash frozen.
- Prompt template + system prompt: frozen.
- Sample size: N=60/cell primary, N=80/cell cap, both pre-registered.
- Analysis script: per-arm regression-affected rate, two-proportion test stratified by agent and difficulty, intent-to-treat denominator. Frozen.
- Stopping rules: none mid-run. We finish whatever n we reach, then run the frozen analysis once. No peeking.

**Reporting commitment**: if the result is null, the post is the null, with the binding-κ sensitivity check and the actual n per cell. The thesis survives either outcome; a dishonest positive does not.

===== PART B ===== 

# Part B — Attack on the Stage 1 Plan

---

## 1. VALIDITY AUDIT

You disclosed three threats. They're real. Here are the ones I think you missed, ranked by how directly they threaten the headline claim.

### 1a. The binding is the treatment, and it's an artifact you control

Your headline is "executable scenarios prevent breakage." But the executable binding is a non-trivial object whose strictness, scope, and faithfulness *you* set. The effect you measure is "this binding, at this strictness, surfaced to the agent, prevents breakage" — not "executable specs per se." A hostile reader will say: "show me the sensitivity of your result to binding strictness, or your effect is a property of one knob setting, not of executable specs."

Pre-registering the binding rules doesn't dissolve this — it just moves the artifact from "chosen at analysis time" to "chosen before data collection." The strictness is still a knob. Two failure modes:

- **Binding too loose** → Group T can pass with vacuous code → the treatment's constraint is weak → you under-count the value of executable specs. Effect shrinks.
- **Binding too strict** → Group T is more constrained than Group C on edge cases that the binding happens to flag but a reasonable spec interpretation wouldn't → you've stacked the deck. Effect inflates.

**Mitigation you don't have**: pre-register 2–3 binding strictness levels (loose / medium / strict), run the main analysis at each, and report the variance. The mean is the headline; the spread is the honest uncertainty. This roughly doubles the chain count. Alternatively, keep one strictness, run a sealed N=10 calibration measuring binding-vs-canonical agreement (Cohen's κ per checkpoint), and report κ as a sensitivity check. If κ < 0.6 on any difficulty tier, the result is qualified in the post. The calibration-then-revise protocol must be pre-registered as conditional, not absolute.

### 1b. The hidden referee is contaminated by the binding

You wrote: "Hidden referee in BOTH groups, invisible, after every checkpoint: the accumulated scenario suite plus the harness's own checkpoint tests." The risk is that "the harness's own checkpoint tests" share logic with the binding. If the binding and the checkpoint tests live in the same module, use the same step definitions, or were authored by the same person within a week of each other, then the agent in Group T has been optimizing against the referee's surface for six checkpoints. The measurement is not independent of the treatment. Group C's measurement is independent because the agent never sees the binding; Group T's is not.

This is the single most under-specified commitment in your plan. State explicitly, in the pre-reg: **(a) binding and canonical suite share no code, (b) different authors or strict author-separation in time, (c) both sealed by hash before the run, (d) post-hoc audit confirms no shared imports.** Without this, "hidden referee" is a misnomer for Group T.

### 1c. Within-chain correlation in per-checkpoint metrics

You want "breakage-vs-accumulated-promise-count curves per group." A chain has 6 checkpoints. Outcomes within a chain are correlated — the agent's state at turn 4 is its committed state at turn 3, plus edits. A naive two-proportion test on per-checkpoint pass rates will understate standard errors and inflate apparent significance.

Your frozen analysis needs: chain as a random effect, checkpoint turn as a fixed effect, cluster-robust standard errors. This is not a minor implementation detail — it changes what "p < 0.05" means on your per-checkpoint curves. Pre-register the model, not just the test.

### 1d. The retry mechanism is itself a source of breakage

The gate offers rollback to the pre-turn state. If the agent in T rolls back, prior turns' accomplishments are preserved but the current turn's intended change is reverted — the agent hasn't completed the checkpoint. If the agent in T retries forward and "passes at least as many checks" but in doing so breaks a non-flagged scenario that the binding doesn't cover but the canonical suite does, the binding misses it but the canonical catches it. Either way, "regression-affected chain" is partly driven by the retry mechanism, not by the agent's edits.

**Pre-register a stratification**: report "regressions introduced by the agent's edit" vs "regressions introduced by the retry+rollback mechanism" separately. The current plan doesn't separate these, and the headline number is contaminated by the retry policy itself.

### 1e. Model state leakage across runs

Frontier agents can have session-level state, prompt-cache effects, or environmental memory. If a chain is run twice (once in C, once in T) on the same model+environment, the second run may benefit from the first via warm caches. The plan says Docker isolation but doesn't say session isolation. Make this explicit: fresh session per chain, fresh repo per chain, no shared environment state, randomized task assignment to cells, and a check that prompt-cache hit rates are similar across cells (or reported).

### 1f. The "kept only if it passes at least as many checks" rule is underspecified

Same count? Same set of passed scenarios? Cumulative over the chain, or just for the current turn's prior scenarios? The 2607.01855 paper had its own semantics; you say you "ported" the rule, but porting without re-specifying leaves the policy ambiguous. Pre-register the exact comparison: "the new attempt is kept iff, for every prior checkpoint, the new attempt's canonical run passes ≥ as many prior-checkpoint scenarios as the pre-retry attempt's canonical run, where 'passes' is judged by the canonical suite, not the binding." This makes the rule testable post-hoc.

### Re-framing of your three disclosed threats

- **(i) Retry asymmetry**: my recommendation is **don't match retries in C**. The bundle (binding + feedback + retry + rollback) is what practitioners deploy. Decomposing it is a different study, smaller n, and the headline you actually want is "deploying executable specs as practitioners would" — which includes the retry. State this explicitly: the supported claim is the bundle, not "executability per se." A small mechanistic 2×2 sub-experiment (~80 chains) can decompose the confound; if budget allows, run it as a follow-up. Otherwise, accept the bundle-claim framing.

- **(ii) Self-verification policy**: my recommendation is **allow self-verification in both groups**. The realistic contrast is "tooling-provided executable scenarios" vs "agent-initiative verification" — that's what a CTO comparing tooling would care about. Forbidding self-testing makes the result mechanistic but unrealistic; a practitioner reader will dismiss it. The mechanistic question ("would executable specs help even agents that already self-verify?") is a real question but a different study.

- **(iii) Visibility manipulation**: this is the weakest of your three disclosed threats. Hiding execution from C is *not* artificial — it's the natural state of "specs that exist as text," which is the entire baseline. The contrast is real-world-realistic. Defend this in the post; don't change the design.

### Validity threat priority order

For the headline claim, in descending order of damage:

1. Binding + feedback confounded (your (i) + my 1a) — reframed as bundle-claim.
2. Hidden referee contaminated by binding (my 1b) — requires explicit binding/canonical separation.
3. Binding strictness as experimental knob (my 1a) — requires κ sensitivity check.
4. Pilot-then-escalate as conditional power (Section 3 below).
5. Within-chain correlation (my 1c) — requires mixed-model pre-reg.
6. Retry mechanism as breakage source (my 1d) — requires stratification.
7. Self-verification policy (your (ii)) — recommend allow, claim realistic.
8. Visibility manipulation (your (iii)) — no change, defend.
9. Model state leakage (my 1e) — minor, address with session isolation.
10. Retry rule underspecification (my 1f) — pre-register exact semantics.

---

## 2. COMPARABILITY VS REALISM

The continuity with arXiv:2607.01855 is partial. Honest assessment:

**What's genuinely portable**:

- The "show failures + one retry + rollback" gate mechanism. This is the most effective single intervention in their study; adopting it is methodologically sensible. But the rule semantics must be re-specified (see 1f), not literally ported.
- The binary "regression-affected chain" metric. Borrowed cleanly. Allows your result to be put next to theirs in a table for the reader, even if you don't claim replication.

**What's not portable**:

- **Scale**: sub-frontier models on toy Python → frontier agents on SlopCodeBench tasks. A 30pp effect at toy scale doesn't transfer. The frontier baseline may already do implicit verification, partially self-supplying the treatment (see your (ii)).
- **Mode**: non-agentic → agentic. The agent decides what to read, what to run, what to ignore. Group C is not "no verification" — it's "agent-initiative verification when the agent feels like it." Different experimental unit.
- **Growing scenario surface**: in 2607.01855, only the original turn's tests run. Your Group T sees the accumulated scenario suite on every turn, so by turn 6 the surface of feedback is 6× the per-turn surface. You're testing "harness that grows with the chain" — a different intervention than theirs.
- **Retry policy**: 2607.01855's "exactly one retry" was scoped to one model family on isolated tasks. In your agentic chains, the retry interacts with prior turns in ways the original paper didn't have to model (see 1d).

**Recommendation**: drop "replication" / "continuation" / "scaling up" framing entirely. Use "follow-up with adopted design elements." State the differences in scale, mode, and scenario surface explicitly in the post. A hostile reader will say "this isn't a replication" — they'd be right. Pre-empt them.

What to keep: the borrowed gate policy (with re-specified semantics) and the borrowed binary metric (for reader reference, not for direct comparison). The reader can put your result next to 2607.01855 and see "smaller effect at frontier scale" or "comparable effect with the additional accumulated surface" — that's the value of continuity, and it doesn't require claiming continuity of design.

**Continuity with SWE-Milestone and SlopCodeBench** (which you also implicitly invoke by forking SlopCodeBench): this is stronger — you're using their harness, their task format, and their accumulated-strict-scoring as the substrate. Frame this as "SlopCodeBench substrate, OpenSpec workflow layer, our treatment contrast." The substrate is borrowed; the experimental question is new.

---

## 3. THE HOSTILE COMMENTER

Three most damaging comments, written as a senior practitioner would write them. For each: can the design answer it? If not, what change?

### Comment 1: "Your 'byte-identical scenarios' are different effective specifications."

> "You say the Gherkin is byte-identical in both groups. Fine at the file level. But Group T's scenarios are wired to a binding that produces precise pass/fail signal, and Group C's aren't. The agent in T has a different *effective* specification: 'this Gherkin + this binding = this contract.' The agent in C has: 'this Gherkin + my own interpretation = whatever I think it means.' You're not measuring 'executable vs text' — you're measuring 'executable binding + structured failure signal + retry budget vs text + nothing + no retry.' If your claim is about executability per se, you need a 2×2 (executability × feedback × retry) and the n to power it. If your claim is about 'executable specs as practitioners would deploy them,' say so — that's a real and useful claim, but it's not the one your title implies."

**Can the design answer it?** Partially. The honest answer is: "we test the realistic operationalization of executable specs, which includes the feedback loop and the retry budget, because that's the bundle practitioners would deploy. The mechanistic decomposition is a follow-up study, not this one." This is supported by the data and is the right framing for a practitioner audience.

**What change would answer it fully?** A small 2×2 sub-experiment on ~20 chains per cell: {binding runs, no-binding} × {feedback, no-feedback}. Add a third factor for retry if you can afford it. Total ~80 chains, ~⅓ of the main experiment. Pre-register the sub-experiment as the mechanistic follow-up. If the main 2-group experiment shows a positive headline, the sub-experiment decomposes it. If the main shows null, the sub-experiment is moot and you skip it.

### Comment 2: "Your pilot-then-escalate is selection bias."

> "You commit to running Stage 1 in full only if the pilot suggests breakage is occurring. That's conditional power: you run the test in conditions where you expect to see the effect. A positive Stage 1 result is then an artifact of the conditions, not a property of executable specs. Even with pre-registration, you're selecting on the pilot outcome, which is selecting on the dependent variable. This is the same problem as optional stopping — you can't fix it by writing it down in advance."

**Can the design answer it?** Partially. Pre-register three terminal analyses: (a) pilot high breakage → run Stage 1 with N=60/cell; (b) pilot low breakage → escalate to Stage 2, no Stage 1 analysis; (c) pilot ambiguous → run Stage 1 with N=80/cell. Commit to publishing whichever terminal you reach, on the pre-registered analysis, without using the pilot result to decide whether to publish.

This doesn't fully neutralize the selection concern, because the conditions of Stage 1 (a or c) are themselves selected. But it makes the selection explicit and pre-registered.

**What change would answer it fully?** Run Stage 1 regardless of pilot outcome, with the cap (N=80/cell) preserved. The pilot becomes a calibration step, not a gating decision. Cost: you might run Stage 1 in conditions where you expect null, and publish a null. That's the price of unbiased evidence. Alternative: pre-register the escalation as a *data-collection* decision (lengthen chains, move scale), not a *publishing* decision. Run Stage 1 main analysis as planned, publish the pilot separately, and the reader can combine them.

### Comment 3: "Your binding's strictness is a knob you control."

> "The executable binding is a non-trivial artifact: a Gherkin-to-code translator whose strictness, scope, and faithfulness you set. Pre-registering the rules doesn't make it 'spec-like' — it makes it your best guess. The effect size you measure depends on this knob. At loose strictness, T can pass with vacuous code, your effect shrinks, and you've under-counted the treatment's value. At strict strictness, T is more constrained than C on edge cases the binding happens to flag but a reasonable spec interpretation wouldn't, and you've stacked the deck. Either way, the effect you measure is 'this binding at this knob setting,' not 'executable specs per se.' Show me the sensitivity of your result to binding strictness, or admit your effect is a property of one specific binding at one specific knob."

**Can the design answer it?** Partially. Report the binding-κ sensitivity check (binding-vs-canonical agreement on a sealed N=10 calibration set). If κ is high (>0.7), the binding is faithful to the canonical surface and one strictness is defensible. If κ is low, the result is suspect regardless of the headline.

**What change would answer it?** Pre-register 2–3 binding strictness levels (loose / medium / strict) and report the effect at each. The mean is the headline; the variance is the honest uncertainty. This adds n (roughly 2× the chain count). With N=60/cell × 4 cells × 2 strictness = 480 chains, vs. the current 240. Real cost, real improvement. Alternative: one strictness, sealed N=10 calibration, accept that the result is "this binding at this knob" and say so.

### Other damaging comments I considered but didn't include in the top three

- **Severity blindness**: "your binary metric discards severity — a chain that breaks 1/100 tests is the same as a chain that breaks 100/100." Answer: co-primary continuous metric (per-checkpoint retention rate).
- **Referee contamination**: "your hidden referee may share code with the binding." Answer: 1b above, the binding/canonical separation.
- **Retry rule ambiguity**: "you ported the gate from 2607.01855 but didn't re-specify the rule." Answer: 1f above.

The top three are the ones that most directly attack the headline claim and that the design as written cannot fully answer without a change.

---

## 4. FORK VS PLUG

Checklist of facts to extract while reading both codebases, ranked by decision-weight. You cannot read either codebase; these are the questions to answer with the first 2–3 days of inspection.

### Tier 1: facts that would flip the decision

1. **Adapter depth in SlopCodeBench.** How deeply are Claude Code and Codex CLI integrated? Thin wrapper (`start_session()`, `submit_turn()` — one or two files, <500 lines) or deep class hierarchy with SlopCodeBench-specific types throughout (10+ files, >2000 lines, types referenced across the codebase)? Thin → plug is cheap. Deep → fork is cheaper than re-implementing the adapter layer. **This single fact probably decides the choice.** Heuristic: count files referencing the agent adapter; if it's <5, plug is competitive.

2. **OpenSpec / spec layer support in your existing harness.** Does your existing two-group harness already have an OpenSpec wrapper, or any markdown-based spec layer with Gherkin-style scenarios? If yes, plug is much easier (import SlopCodeBench task set, your harness handles the spec and the groups). If no, fork is easier (build the OpenSpec layer once, on SlopCodeBench's side, and reuse your harness's audit/pre-reg machinery).

3. **Strict scoring separability.** Where does the "re-run all prior checkpoints" logic live in SlopCodeBench? Single function (`grade_chain(chain_state)` returning a result object) or distributed across the codebase (per-checkpoint grading mixed with task execution, state management, etc.)? Single function → plug is easy (call it from your harness). Distributed → fork is easier (you'd reconstruct the logic, which is error-prone and a refactor in itself).

4. **Task definition schema.** How are SlopCodeBench tasks defined? Clean declarative format (JSON/YAML/Markdown with a clear schema) or entangled with Python code (task logic mixed with harness plumbing)? Declarative → plug is easy. Entangled → fork is easier (disentangling to import is a refactor).

### Tier 2: facts that constrain but rarely flip

5. **Docker isolation granularity.** Per-checkpoint container, per-chain, or per-task? If the granularity doesn't match your design (you need per-checkpoint for the binding run), fork is needed to modify it.

6. **Compute environment assumptions.** Docker base image, network config, volume layout, required services. Does your existing harness have the same? Mismatch forces fork (to align) or significant refactor.

7. **Pre-registration / audit machinery in SlopCodeBench.** Does it have frozen-protocol support, sealed analyses, or session logging? If yes, fork is slightly easier (one less system to integrate). If no, plug is slightly easier (your harness already has this).

8. **Two-group mechanics in your existing harness.** Stratified randomization, intent-to-treat analysis, multiple-comparisons correction, mixed-model support. If yes, plug is much easier. If no, fork is much easier (you'd port this from your harness, which is itself a project).

9. **License / dependency check.** MIT for SlopCodeBench (per the literature). Any GPL contamination in transitive dependencies? Any proprietary components that won't survive a public fork? License compatibility with your distribution plans.

### Tier 3: facts that inform but rarely decide

10. **Test coverage and code quality of SlopCodeBench.** Test-to-code ratio, recent commit activity, contributor count. Brittle fork = risky; robust fork = safe. Affects the *risk* of fork, not the *choice* between fork and plug.

11. **Size of SlopCodeBench's task set.** <50 tasks → plug is easy regardless. >200 tasks → integration cost matters more.

12. **Documentation quality.** Affects evaluation speed, not the choice.

### The single most important question

If forced to ask one question: "Can I extract `grade_chain()` and the agent adapter as callable functions from SlopCodeBench without modifying their internals?" If yes → plug is competitive. If no → fork.

### My read without reading either codebase

SlopCodeBench is purpose-built for checkpoint chains with accumulated strict scoring and native CLI adapters — this is a strong substrate match. Your plan to fork is the lower-risk default because the scoring + adapter are the load-bearing pieces and you don't want to discover mid-experiment that a port missed an edge case. The plug path is competitive only if (1) the adapter is thin AND (2) you can call `grade_chain()` from your harness's audit machinery without rewriting it. If both are true, plug wins on the audit/pre-reg machinery you already have. If either is false, fork.

---

## 5. BETTER ALTERNATIVES

### Where my Part A was wrong or under-specified

- **Power calculation error.** I claimed N=60/cell was adequately powered for a 15pp effect. Recalculation: for two-proportion test with p_C=0.45, p_T=0.30, α=0.05 two-sided, power=0.80, the required n per group is **~165**, not 60. N=60/cell is powered for effects ≥25pp (h≈0.55) at power ~0.85. For 15pp, power is ~0.30. My Part A was misleading on this — I was conflating the design (4 cells) with the analysis (per-cell). Honest correction: N=60/cell detects only large effects; for 15pp, you need N=165/cell (660 chains total) — likely over budget. **Recommendation: revise the pre-reg target to N=80/cell primary, N=120/cell cap, and explicitly state that the design is powered for ≥20pp effects. If the realistic effect is 15pp, the design is underpowered and the post must say so.**

- **I didn't address the pilot-then-escalate selection bias.** Your plan flagged this implicitly; I should have either argued for running Stage 1 unconditionally or specified the conditional analysis protocol. I did neither.

- **"Executable" was operationally vague.** You specified: binding runs, agent sees pass/fail, retry+rollback. I said "harness runs the binding and surfaces failures." Yours is better-specified; mine left room for ambiguity.

- **I didn't engage the literature's argument that the retry is part of the gate.** I recommended "one retry+rollback" without addressing whether the retry should be matched in C. Your plan correctly engages this and (correctly, in my view) declines to match — the bundle is the realistic intervention.

### Where your Stage 1 is wrong or under-specified

- **Binding strictness is not pre-registered or sensitivity-tested** (see 1a).
- **Binding and canonical suite are not explicitly separated** (see 1b).
- **Within-chain correlation in per-checkpoint metrics** (see 1c).
- **Retry mechanism as a breakage source** is not separated from agent's edits (see 1d).
- **"Byte-identical scenarios" is true at the file level but understates the operational difference** — Group T has a binding that operationalizes the Gherkin, Group C does not. The headline should acknowledge this.
- **Sample size justification** is absent in your writeup; the "scale and power" reasoning is implicit. Pin it down with explicit numbers anchored on 2607.01855's effect and a stated power target.

### The strongest merged design

Steal from each:

1. **Substrate**: your Stage 1 (SlopCodeBench fork + OpenSpec wrapper + 6 checkpoints + 2×2 with Claude Code and Codex CLI). Cleaner operationalization than mine.

2. **Treatment**: your Group T (binding runs + agent sees failures + one retry+rollback, with "passes at least as many checks" rule). Re-specify the rule per 1f.

3. **Control**: your Group C (text-only, no matched retry). **Declare explicitly**: the supported claim is "executable specs as deployed in practice" (the bundle), not "executability per se." The mechanistic decomposition is a follow-up sub-experiment (see #10).

4. **Self-verification policy**: allow in both groups. Realistic contrast.

5. **Pilot-then-escalate**: your design, but pre-register the analysis at each terminal state (high / low / ambiguous breakage) and commit to publishing the pilot separately, regardless of Stage 1 outcome. The pilot is calibration, not gating.

6. **Statistical**:
   - **Primary**: binary regression-affected chain (yours; matches 2607.01855).
   - **Co-primary**: per-checkpoint retention rate, mixed model with chain as random effect, checkpoint turn as fixed effect, cluster-robust SEs (mine, addressing 1c).
   - **Guard**: per-checkpoint task success (yours), reported per arm.
   - **Secondary**: binding-κ sensitivity check (mine), measured on a sealed N=10 calibration set, reported regardless of value.

7. **Referee separation** (1b): explicit pre-reg statement — binding and canonical suite share no code, different authors or strict time-separation, both sealed by hash before the run, post-hoc audit confirms no shared imports. **This is the single most important addition to your plan.**

8. **Sample size**: revise to N=80/cell primary, N=120/cell cap. Acknowledge the design is powered for effects ≥20pp, not 15pp. Honest about the limitation. Total: 320 chains primary, 480 cap.

9. **Continuity framing** (Section 2): drop "replication" / "continuation" of 2607.01855; use "follow-up with adopted design elements." State the differences explicitly.

10. **Mechanistic sub-experiment** (optional, if budget allows): small 2×2 on N=20/cell: {binding runs, no-binding} × {feedback, no-feedback}. Decomposes the feedback confound. ~80 chains, ~¼ of the main experiment. Pre-register as a follow-up; run only if the main 2-group experiment produces a positive headline.

The merged design is **yours plus the binding-κ check, the explicit binding/canonical separation, the mixed-model statistical layer, the sample-size honesty, and the optional mechanistic sub-experiment**.

---

## 6. RED-TEAM YOURSELF (MINE)

The most likely ways my recommendations mislead you, in order of damage:

### 6a. I mis-prioritized the binding-κ check relative to the feedback-confound

The feedback-confound (Comment 1) is the most damaging single attack on the headline claim. The binding-κ check is important but secondary. If you spend your n on the κ check (multiple binding strictnesses), the main comparison is underpowered and the headline gets noisier. The right priority: **feedback-confound first (reframe the claim honestly as the bundle)**, binding-κ second (sensitivity check or single-strictness with calibration). I had this inverted.

**Evidence that would change my mind**: if the binding-κ check is materially cheap (e.g., one strictness with a 10-chain calibration that doesn't consume main-n chains), then both fit. But if the κ check requires running multiple strictnesses on the main n, it's a real trade-off and the feedback-confound reframe should win.

### 6b. My Part A power claim was wrong

I said N=60/cell was adequately powered for a 15pp effect. It isn't. N=60/cell detects ≥25pp at adequate power; for 15pp, you need ~165/cell. I was sloppy here and the hostile commenter would catch it. If you adopted my Part A's N=60/cell, you'd run an underpowered experiment and publish a result that's more likely null than the true effect. My recommendation in Part A was actively misleading on this point.

**Evidence that would change my mind**: only if the realistic frontier effect is ≥25pp (e.g., 45% → 20%, h≈0.55), in which case N=60/cell is fine. But you have no evidence the frontier effect is that large; the only directly comparable effect (2607.01855) is at sub-frontier toy scale and the scaling is unknown. Default to the conservative power assumption and either scale up the n or state the limitation explicitly.

### 6c. My "drop matched retry in C" recommendation is potentially wrong

The literature (2607.01855) clearly bundles the retry with the verification feedback. Decomposing them is a different study. I recommended the cheaper design (no matched retry) but the bundle is what practitioners deploy and the cheaper design tests a less-supported claim. The honest call: test the bundle. The mechanistic question is a follow-up.

I corrected toward this in the merged design (Section 5) but my Part A said it more directly and was wrong.

**Evidence that would change my mind**: only if the literature's decomposition (the 2607.01855 paper's ablation between "restate all prior requirements as prose" and "Verification Gate") is taken as evidence that the retry is a separable factor. But their ablation was between two quite different interventions, not a clean retry-vs-no-retry decomposition. Don't over-interpret it.

### 6d. My pre-registered binding rules are vulnerable to "conditional pre-registration"

If the sealed N=10 calibration reveals low κ, the rules get revised before the main run. That's responsive calibration, which is methodologically defensible, but it means the pre-registration is conditional ("rules frozen conditional on κ ≥ 0.6"). If the rules get revised, the pre-registration is not absolute — the pre-registered rules and the actually-used rules differ. State this in the pre-reg explicitly: "binding rules are frozen conditional on calibration κ ≥ 0.6; if κ < 0.6, rules are revised and a new calibration is run before the main experiment; both sets of rules and both calibrations are published." This is honest but it weakens the pre-registration claim.

**Evidence that would change my mind**: only if the binding is robust to small rule changes (e.g., across multiple strictness levels, the effect is stable), in which case the conditional pre-registration is fine. But you don't know this in advance; default to disclosing the conditionality.

### 6e. My recommendation to drop "replication" framing may be too cautious

Narrative continuity with 2607.01855 is useful for the post — it gives the reader a familiar reference point. I over-rotated on defensiveness. Some continuity framing is fine if the differences are stated explicitly. "We borrow the gate policy and the binary metric from 2607.01855; the substrate, models, and scenario surface differ in ways that make this a follow-up, not a replication" is honest and useful. Don't drop the continuity entirely.

**Evidence that would change my mind**: only if a hostile reader would actually use the continuity framing against you (e.g., "you claim continuity but the differences are so large the comparison is meaningless"). This is a possible attack, but pre-empting it with explicit difference-statement is enough; dropping continuity is overkill.

### 6f. Summary: where I was wrong vs. where I was right

**Wrong**: power claim in Part A (6b), "drop matched retry" recommendation in Part A (6c), priority of binding-κ over feedback-confound (6a), over-cautious continuity framing (6e).

**Right**: explicit binding/canonical separation (1b, the single most important addition), within-chain correlation model (1c), retry mechanism as breakage source (1d), binding-κ sensitivity check as a secondary (1a, just not the top priority), honest sample-size limitations (6b, in the corrected form), allow self-verification (your (ii)), pilot-then-escalate with explicit per-terminal analysis (your design, not mine), reframe the claim as the bundle (1a + 1d).

The merged design in Section 5 is what I'd defend if challenged. My Part A alone was a weaker starting point than your Stage 1 plan; the merged design is stronger than either.