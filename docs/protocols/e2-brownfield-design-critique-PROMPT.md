# Red-Team Prompt: Will This Brownfield Feedback-Ablation Produce a Valid Answer — and Is It Worth Building?

*Paste everything below the line into another AI assistant (or hand to a human reviewer). Self-contained — no codebase access needed. This critiques an EXPERIMENTAL DESIGN before we spend months building a real-repo harness. Your job: find why this ablation would produce an invalid, confounded, or uninformative result — or why we shouldn't build it at all.*

---

You are an **adversarial experimental-design reviewer** for an ML-systems study. We are about to commit months to building a benchmark+harness. **Assume we're about to waste that effort; find the flaws.** Be skeptical, quantitative, and specific. If the design is sound, say where; if it's confounded or the question is already answered, say so plainly.

## The question

Does giving a **frontier coding agent** (DeepSeek V4 Pro, Claude, GPT-5-class) the ability to **execute acceptance-level spec checks** (BDD/Gherkin-style "does the code exhibit the specified behavior?", plus the prior acceptance suite) while working in a **large/brownfield repository** reduce introduced regressions and improve task success — **beyond what the agent already achieves by writing and running its own tests**? And is any benefit a **coverage effect** (it surfaces invariants in code the agent couldn't retrieve/fit in context) or a **reasoning effect** (it helps even with full relevant context)?

## How we got here (real findings, not hypotheticals)

- On **small, fully-specified, sealed tasks** (≤10 files), frontier models show **zero benefit** from executable feedback: they reconstruct the hidden acceptance suite themselves from the spec (we have a control-arm model spontaneously writing the exact hidden edge-case test before we could provide it) and produce zero regressions with or without the oracle. Four clean "ceilings" across three task families.
- Two independent deep-research reviews then found: (a) frontier models **collapse at multi-file scale** (e.g. single→multi-file success dropping ~44%→9%; 70%→25% from easy to hard benchmarks; 7+ file patches near-never solved); (b) agents' **self-generated tests are mostly observational** (print ≫ assert) and don't reconstruct the regression surface; (c) in the one study that ablated oracle signal *types*, **regression/pass-to-pass feedback was the WEAKEST signal**, while **reproduction/acceptance-level feedback was the STRONGEST** — and our prior experiments had only tested the weak one; (d) the benefit, if any, looks **coverage/context-bound**; (e) the exact ablation has **never been run**.

So the design below pivots to: **acceptance-level feedback, at brownfield scale, with a context-provision factor to separate coverage from reasoning.**

## The design under review (E2)

**Conditions.** Hold the task, the repository snapshot, and the **visible acceptance spec identical** across arms; vary only executability.
- **Factor F (feedback):** `control` = has the acceptance spec + can write/run its own tests, but **cannot** execute the hidden acceptance oracle. `treatment` = identical + **can** execute the hidden acceptance oracle each turn (per-scenario pass/fail).
- **Factor C (context), crossed:** `retrieved` = agent retrieves its own context from the repo. `curated-full` = the full relevant code (all modules the gold change touches + their callers) is provided. *Predeclared reading:* feedback helps under `retrieved` but not `curated-full` ⇒ coverage; helps under both ⇒ reasoning.

**Substrate.** Calibration: SWE-bench Verified (single-file; predeclared prediction = **null** delta — replicates the small-task finding, validates the harness). Primary: a contamination-resistant multi-file benchmark (SWE-bench Pro, ~4 files/task, and/or SWE-bench Live, ~400 files/85k LOC repos). Stress: SWE-EVO (~21 files/task), RefactorBench.

**Metrics.** Functional success (resolve rate), regression (zero-regression rate; P2P pass→fail count), agent behavior (assert vs print tests; retrieval coverage of gold-touched files). Stratified by patch scope (1 / 2–3 / 4+ files). Multi-run for nondeterminism.

**Pre-mitigated confounds.** Equalize compute/turn budget across arms (execution costs turns); harden oracles against weak-validator inflation; limit oracle output to pass/fail (no expected values) to curb test-distribution reverse-engineering; use the `curated-full` cell to isolate "execution as free reasoning step."

## Attack the design — specifically

1. **Is H0 actually beatable?** The whole program assumes frontier agents *can't* self-verify the regression surface at scale. But a strong agent has file-system retrieval, can read callers, and can write characterization (golden-master) tests over what it retrieves. Will it just RAG its way back to self-sufficiency? Under what repo size / coupling does self-verification genuinely break, vs. merely get expensive? Give a probability that the brownfield primary substrate (Pro ~4 files; Live ~400-file repos but issue-level) actually breaks it.

2. **The parity problem at brownfield scale.** In sealed tasks, "both arms see identical content" was clean. In a real repo, *the repo is the content*. What does identical-visible-content even mean here, and can we give both arms the same acceptance criteria while only `treatment` executes them — without the written spec leaking the answers (the failure mode that sank our earlier sealed design, where worked examples let the control arm self-build the oracle)? Is fair parity achievable in brownfield, or structurally impossible?

3. **Is `curated-full` circular?** If we curate the full relevant context, haven't we recreated the small-task regime where we already KNOW frontier models self-verify (zero feedback benefit)? If `curated-full` trivially reproduces the null, does the coverage-vs-reasoning contrast collapse into "of course it's coverage"? Is the factor informative or rigged?

4. **Is the treatment "acceptance feedback" or just "execution access"?** The strong-lever claim is that *acceptance/behavior-level* feedback helps. But operationally `treatment` = "can run the hidden suite." How do we attribute a delta to *BDD/acceptance specs specifically* rather than to *the agent getting to execute code more*? If we can't separate those, what claim can the experiment actually support — "BDD helps" or merely "CI/execution helps large-repo agents"?

5. **Substrate adequacy.** Is SWE-bench Pro (~4 files/task) "brownfield" enough to show the effect, or do you need genuinely huge repos (Live's ~400-file repos) where issue-level tasks may still be too local? Are the existing F2P/P2P suites strong enough to serve as the *oracle* (studies show 8–30% of "plausible" patches are actually wrong under these suites), or does weak validation make both the treatment signal and the outcome metric untrustworthy?

6. **Attribution & measurement rigor.** Can a regression be cleanly attributed to the agent's change vs. environment/flakiness on a real repo? Is "zero-regression rate" measurable with enough power given agent nondeterminism and multi-run cost? What's the minimum n for a credible paired delta at the predeclared MCID (+0.05 absolute)?

7. **Compute-budget confound — is equalization even possible?** Execution consumes turns/tokens; the treatment arm spends budget running the oracle, the control arm spends it writing its own tests. Can these be equalized without distorting one arm's natural behavior? If not, does any observed delta just reflect budget allocation?

8. **The durability/worth question.** Even if it works and the effect is coverage-bound — "feedback compensates for context the agent couldn't retrieve" — is that a *durable* claim, or one that erodes as context windows and retrieval improve (making it a moving target)? Steelman the alternative: the deep research already implies the answer; we should publish the capability-gradient finding ("feedback's value concentrates where models can't self-verify") and NOT build a months-long brownfield harness. Argue that case as strongly as you can.

## Output format

Per item: a 1–2 sentence verdict, then reasoning. End with:
- **P(the design yields a valid, attributable answer to its question) = __%**, one-line justification.
- **P(H0 — frontier agents self-verify well enough at this substrate's scale that the feedback delta is ~null) = __%.**
- **The single biggest design flaw** and the highest-leverage fix.
- **Build it, or don't (publish the capability-gradient finding instead)?** — a clear call, with the 1–2 considerations that most drive it.
