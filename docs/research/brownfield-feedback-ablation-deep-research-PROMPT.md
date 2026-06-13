# Deep Research Prompt: Does Executable Spec/Test Feedback Help Frontier Coding Agents at Brownfield Scale?

*Draft for review before running. Self-contained brief for a deep-research harness (fan-out web search → fetch primary sources → adversarially verify → cited synthesis). The goal is to resolve a specific go/no-go decision, not to survey broadly.*

---

## The decision this informs

We run controlled two-arm experiments on whether **per-case executable feedback** (an agent can run a hidden acceptance/test oracle each turn and see pass/fail) improves AI coding results vs not having it, holding the spec content identical across arms. Our finding on **small, fully-specified, sealed tasks** (≤10 files, 12–18 checkpoints): for **frontier** models (DeepSeek V4 Pro, Qwen 3.7 Max, Sonnet 4.6) the feedback is **redundant** — the model reconstructs the acceptance suite itself from the structured spec (we have direct artifacts of a control-arm model spontaneously writing the exact edge-case tests, e.g. an equal-tie rounding case, that the hidden oracle contained), and it produces **zero regressions with or without the oracle**. The benefit is real only for **weaker/mid-tier** models. The structural reason: when the correct behavior is fully determined by a spec the model can hold and enumerate, a capable model self-verifies, so executable feedback adds nothing.

The one regime that plausibly escapes this: **huge brownfield codebases**, where the spec is incomplete, the relevant behavior doesn't fit in context, and the model cannot enumerate or characterize the full interaction surface — so executable feedback may be the only access to invariants it cannot self-detect, and frontier regressions may genuinely appear.

**We must decide between:** (A) invest in building a brownfield *feedback-ablation* benchmark (same task/context, toggle executable-acceptance-feedback, measure the regression delta at the frontier); or (B) conclude the question is effectively answered (by us + the literature) and instead publish the capability-gradient finding ("executable spec feedback helps where models can't self-verify; redundant for frontier models on tractable specs"). Your research should move us toward A or B with evidence.

## Primary question

For **frontier-class coding agents (2025–2026)** operating on **large/brownfield repositories**, does access to executable test/acceptance feedback measurably reduce introduced regressions (and improve task success) **beyond what the agent achieves by writing and running its own tests** — and is that benefit a *coverage/context-bound* effect or a *reasoning* effect?

## Prioritized sub-questions

1. **Has the controlled ablation already been run?** Find any study that toggles executable-test/oracle feedback for a *frontier* agent on *brownfield/multi-file* tasks and reports a regression or success delta. If it exists, what's the effect size, attribution, and validity? (This could answer our decision directly.)

2. **Scale → frontier degradation (the empirical crux).** Quantitative, primary-source evidence that frontier coding models' correctness AND regression-safety degrade with: repository size, multi-file/cross-file coupling, and context-window pressure. Anchor and verify the specific figures we've seen cited (NoCode-bench single→multi-file collapse; SWE-Bench-Verified easy-vs-hard/multi-file slices; RefactorBench "never edited required files"). Report the *shape* of the degradation and the model tiers tested.

3. **Self-verification at scale.** Evidence on whether frontier agents spontaneously write/run their own tests, and crucially whether that self-verification **reconstructs the relevant regression surface in LARGE repos** or breaks down — i.e., does "retrieve-and-self-test" let a frontier agent RAG its way back to self-sufficiency, or do regressions persist in un-retrieved coupled code? This is the make-or-break question for the brownfield reopening.

4. **Oracle vs self-generated feedback, and BDD vs unit/CI.** Distinguish (a) externally-provided oracle feedback from agent-self-authored tests (effect sizes differ by regime), and (b) whether **behavior-level/acceptance/BDD-style specs** are better agent feedback than unit tests or raw CI. Is there ANY credible evidence base for "BDD/Gherkin-with-AI" specifically, vs generic "tests help"?

5. **Substrate survey (de-risks our methodology cost).** What brownfield agent benchmarks exist that are containerized, deterministic-enough, and carry regression/acceptance suites suitable to host a two-arm feedback ablation (SWE-bench Verified and variants, multi-file/refactor/repo-level benches, others)? For each: scale, determinism/flakiness handling, license, and whether they already separate "agent ran tests" from "agent didn't."

6. **Methodology state-of-the-art for rigor at scale.** How do current brownfield agent harnesses handle determinism, flaky tests, replay/reproducibility, and clean regression attribution (change-caused vs environmental)? What concrete practices would let us hit a sealed-protocol/replay-valid bar on a real large repo?

7. **Steelman the null.** Find the strongest evidence that executable feedback does NOT help frontier agents even at scale (they're robust self-verifiers / scale doesn't break them). We want to be talked out of building, if the evidence supports it.

## Source-quality and framing rules

- Prefer **2025–2026 primary sources** (arXiv papers with methods, official benchmark leaderboards/repos, model cards) over blogs or secondary summaries. Verify any leaderboard figure against its primary source; flag community-tracked numbers as such.
- State **effect sizes with caveats** (n, decoding, significance testing, contamination risk). Treat "weaker models benefit more" and "frontier models self-verify" as hypotheses to test against evidence, not assumptions.
- Explicitly separate **oracle-provided** from **self-generated** test feedback, and **coverage/localization** effects from **reasoning** effects, throughout.
- Call out where the evidence is thin, contradictory, or contaminated.

## Required output

1. A direct verdict on the **primary question** with the strongest supporting and contradicting evidence.
2. A **go/no-go recommendation** between decision A (build the brownfield ablation) and decision B (publish the capability-gradient finding), with the 2–3 findings that most move the needle.
3. If A: the best existing **substrate** to build on and the top methodological risks.
4. If B: the citation(s) that would let us state the frontier-redundancy conclusion as field-supported, not just our own four runs.
5. A short list of **the highest-value open questions** the literature does NOT answer (i.e., where our experiment would be genuinely novel).
