# Substrate-Selection Prompt: Is "Real Popular OSS Project + Hidden Own-Suite Oracle" the Right Substrate — or Does Something Beat It?

*Draft for review. Self-contained brief. Best run as a deep-research query (the substrate facts — contamination status, post-cutoff data availability, repo sizes, suite quality, licensing — are verifiable and should be checked, not asserted) or sent to strong reasoning models. Decision-first and adversarial: the candidate must be stress-tested and ranked, NOT validated.*

---

You are helping select the experimental substrate for a controlled study, and you must be **adversarial, not affirming**. A candidate approach is proposed below. **Do not default to endorsing it.** Your job is to (a) find the ways it produces an invalid or uninformative result, (b) rank it against the real alternatives, and (c) recommend the substrate + protocol most likely to yield a valid answer. If a different choice dominates the candidate, say so plainly.

## The study

A two-arm ablation: does giving a **frontier coding agent** (DeepSeek V4 Pro / Claude / GPT-5-class) the ability to **execute acceptance/regression test feedback** while working in a **large, brownfield repository** reduce introduced regressions and improve task success **beyond what it achieves by writing/running its own tests**? Arms hold task and repo identical; the only manipulated variable is whether the agent can execute the hidden test oracle. A secondary factor varies context provision (the agent's own retrieval vs. curated-full relevant code) to separate a *coverage* effect from a *reasoning* effect.

## What is already established (do not re-derive)

- On small, fully-specified tasks, frontier models show ~zero benefit from executable feedback — they reconstruct the acceptance suite from the spec and don't regress. The effect, if any, lives at brownfield scale.
- Frontier models collapse at multi-file scale (single→multi success ~44%→9%; easy→hard ~70%→25%; 7+ file patches near-never solved).
- Self-generated tests are mostly observational (print ≫ assert) and don't reconstruct the regression surface.
- The exact brownfield feedback-ablation has not been published; the closest substrate recommendation from prior research was **SWE-bench Live** (fresh, post-cutoff, Dockerized, real repos ~400 files/85k LOC, real suites), with SWE-bench Pro for external validity and SWE-bench Verified flagged as contaminated.

## The candidate approach (to stress-test, not validate)

Start from a **real, popular OSS project with good existing test coverage**; **hide that test suite from the agent** and use it as the regression/acceptance oracle. Control arm can't run it; treatment arm can.

## Required questions (answer each; quantify where possible)

1. **Contamination, and the direction of its bias.** Popular, well-tested projects are heavily represented in training data (code, tests, issue/PR history). Argue whether this **biases the result toward the null** (the model recalls the existing behavior, so the hidden suite carries no new information, making feedback look redundant even if it would help on unseen code). How large is this effect likely to be, and does it make "popular project" close to the *worst* choice for *detecting* a feedback benefit? How would you measure/bound memorization for a given project+task?

2. **The "well-tested but not memorized" sweet spot.** If contamination biases toward null, what substrate threads the needle — post-training-cutoff commits/issues on otherwise-mature projects (SWE-bench Live's approach), rigorous-but-less-famous projects, or something else? What is actually available post-cutoff with good suites, and at what scale?

3. **"Hidden suite" ≠ "hidden acceptance criteria."** Hiding `tests/` does not hide the behavioral contract if it's inferable from source + docs + READMEs — which is exactly how frontier models self-verify. For real OSS projects, how much of the regression surface is self-derivable from non-test artifacts, and does that collapse the two arms even at scale?

4. **Task definition and regression-risk selection.** Real repos don't ship "tasks." How do you obtain changes with a known-correct outcome the hidden suite verifies, AND select for tasks that genuinely *risk* breaking existing covered behavior (many real changes are additive/isolated and would show no feedback effect)? What does this selection cost, and does it reintroduce the benchmark-construction problems the candidate was meant to avoid?

5. **Oracle choice.** Is the project's **own full suite** the right oracle, a **hardened/relevant subset**, or a **synthesized** one? Weigh suite quality (real suites are strong) against flakiness, external deps, runtime, and the fact that passing the existing suite ≠ no behavioral regression (differential-testing evidence shows ~30% of "plausible" patches are still wrong).

6. **Determinism/rigor at real scale.** Containerization, flaky-test handling, clean attribution of a regression to the change vs. environment, and statistical power under agent nondeterminism. Which existing harnesses solve these well enough to build on?

7. **Build-from-project vs. use-existing-benchmark.** Compare the candidate (curate a substrate from a chosen real project) against simply using SWE-bench Live / Pro / SWE-EVO / RefactorBench. Rank them for THIS study on: contamination resistance, brownfield scale, oracle quality, regression-risk density, determinism, and effort.

## Output format

- A **ranked recommendation** of substrates for this specific ablation, with the top choice justified on the six dimensions above.
- **The conditions under which the candidate ("popular OSS + hidden own-suite") is the RIGHT call vs. the WRONG call** — be explicit about both.
- **The single factor most likely to invalidate the candidate**, and the concrete protocol step that neutralizes it (or a statement that it can't be neutralized).
- If you'd build a fresh substrate from a real project anyway: name 2–3 specific candidate projects (with post-cutoff task sources and suite/scale characteristics) and why.
