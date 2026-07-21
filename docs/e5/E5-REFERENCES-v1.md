# E5 references — external prior art

**Purpose.** Papers bearing on the E5 claim (executable acceptance criteria vs prose specs for AI
coding agents), each recorded with what it *actually* establishes, not what its title or a
second-hand summary suggests. Every entry states whether it was read in full or only verified at the
citation level. Convergence, recall, and unread abstracts are not evidence — a paper earns a
load-bearing role here only after someone has read it against our specific construct.

Provenance of the initial set: surfaced by the Step 1 blind designs (2026-07-21), citation-verified
by an independent pass the same day (all eight identifiers resolved, numbers confirmed), then the
most load-bearing one was read in full. See `docs/protocols/e5-step1-blind-design-20260721/`.

---

## Read in full and assessed against our construct

### Haeri & Ghelichi, *Specification Grounding Drives Test Effectiveness for LLM Code* — arXiv:2607.06636 (v1, 2026-07-07)

**Status:** read in full (v1 HTML). **Relevance:** moderate, and narrower than its headline. **It is
NOT "the main published evidence against the E5 thesis"** — an earlier characterization in this
program that was corrected on reading (2026-07-21).

**What it measures.** 26 small single-function Python tasks (ablation uses 8 core: semver compare,
split_money, paginate, median, merge_intervals, truncate, roman_to_int, clamp). Deliberately
under-specified tickets. Code model writes one implementation from a plain prose ticket that is
**identical across all arms**. A fixed tester model (Sonnet 4.6) then writes tests; the
free/decomp/prose/spec labels vary **only what the tester is shown**. Tests execute and drive a
repair loop in **every** arm.

**The famous 0/2/27/30 (Table 3).** Measures bug *detection* — did the generated test suite catch a
naturally-occurring bug — not code correctness. free (no spec) 0/30, decomp (structure, no content)
2/30, prose (content as a paragraph) 27/30, spec (content as an enumerated checklist, one test per
rule) 30/30. The "100% vs 60%" figure that circulates is a *different* metric (final correctness) on
a *different* arm-pair (spec vs free+, Table 2) — do not conflate them.

**What it establishes:**
- **Spec *content* drives test effectiveness — large, robust, replicated.** 0 → 27 detection from
  adding content; holds across three model families; up to +50–68pp on real-library oracles;
  significant at task level (p≈0.002 for spec vs free).
- A plain English paragraph recovers ~90% of the value of a structured checklist. Enumerated format
  adds a "small margin" (the authors' own words): 27 → 30, on a single task (`split_money`), one
  tester draw, **no statistical test run** on that comparison (our own binomial ≈ p=0.25 — noise).
- Removing execution (the self-refine arm: re-read code, no tests) is actively harmful — "broke
  three correct functions while fixing none."

**What it does NOT establish, and why it is off-target as counter-evidence to E5:**
- **It never varies executability.** Both "prose" and "spec" are non-executable English fed to a
  *test writer*; the tests execute identically in both. The paper lives entirely inside the
  executable-feedback world and is structurally incapable of showing execution doesn't help.
- **Its "format" axis is paragraph-vs-bulleted-English**, not English-vs-executable-Gherkin. "Format
  adds a small margin" is about bullet-pointing, across a construct boundary from our claim.
- **It varies the test-writer's input, never the implementer's.** E5 is about specs fed to the agent
  writing code.
- **Ceiling, author-acknowledged:** "that 100% is a ceiling set by these easy tasks." Single pure
  functions; the authors scope out harder/repo-level tasks and report a clean null on well-specified
  algorithmic tasks and a HumanEval+ port.

**How E5 should use it.** Cite as evidence that **spec content grounding** drives test quality, with
the explicit caveat that it holds execution constant and never varies what the implementer sees. Its
real value to us is a warning, not a threat: it locates almost all the measured value in *content*,
and shows structure/format adds little **once a test-writing loop is assumed**. So any E5 design must
isolate *executability* and must never let the contrast quietly become *structure* — on structure,
the published evidence runs against us. The thesis survives best framed as "executable checks vs a
spec with no checks"; it is most threatened framed as "executable Gherkin vs prose, both feeding a
test-writing loop."

---

## Citation-verified only (identifier + numbers confirmed; not yet read in full)

Verified 2026-07-21 by an independent pass; treat as leads, not as settled evidence, until read.

- **ChainSWE** — arXiv:2607.02606. Dependent-chain SWE benchmark, 304 tasks / 54 repos, MIT, per-step
  F2P/P2P, oracle-state progression. **Locally screened and REJECTED as an E5 substrate** (2026-07-21):
  mean chain length 3.04, only 3 chains ≥4 steps, dependency is co-location not requirement (≈18% of
  step-pairs genuinely dependent), median 1 F2P test per step defeats a hidden/visible split. See the
  screen report in `docs/protocols/e5-step1-blind-design-20260721/`.
- **SWE-Milestone** (v1 *EvoClaw*) — arXiv:2603.13428. Prerequisite-DAG evolution benchmark, MIT,
  mature harness, native hidden-oracle (test-masking) design. **Locally screened: QUALIFIED GO for a
  private pilot** (2026-07-21), with four caveats — the dependency DAG is model-authored not per-edge
  verified (self-verifiable for free); only 3/7 repos have a stable public surface; it ships an SRS
  spec + native test suites, not `.feature` files; a real run is $30–120/chain, several times the
  remaining stop-loss. Infra is not a blocker (~100 GB free hosts the scikit-learn study; operator has
  176 GB as of 2026-07-21). See `SUBSTRATE-SCREENS-v1.md` in the Step 1 directory.
- **SWE-EVO** — arXiv:2512.18470. Real, but tasks are independent (release-to-release), not a
  dependent chain. Not an E5 fit.
- **TDAD** — arXiv:2603.17973. TDD procedural prompting without targeted test context *raised*
  regressions to 9.94%; graph-based which-tests-to-check context cut them 6.08% → 1.82%. Evidence
  that grounding, not TDD ceremony, carries the effect.
- **SpecBench** (Zhao et al., Weco AI) — arXiv:2605.21384. Reward-hacking gap (visible minus held-out)
  grows ~28pp per 10× codebase size, to 100pp above 25K LOC. Note: a distinct 2026 paper by Hamblin
  et al. (arXiv:2605.30314) is also named SpecBench — do not conflate.
- **ImpossibleBench** — arXiv:2510.20270. Frontier check-gaming 50–76% where tests are visible; hiding
  tests drops it near zero **but also degrades legitimate performance** (both clauses matter — we hide
  checks).
- **Building to the Test** (Microsoft) — arXiv:2606.28430. Agent's delivered library was dead code;
  no-oping it left the hidden-oracle score unchanged — the demo's inline copy was what ran.
- **AlphaCodium** — arXiv:2401.08500. Execution/test feedback 19% → 44% pass@5. General support for
  the execution-feedback mechanism.

**Unciteable — recall without sources.** The ChatGPT 5.6 Step 1 session produced prior-art claims
(Noble & Nagappan 2024; Fakhoury et al. ~38%; a ThoughtWorks quote; a Paul Duvall "DoubleUp!" case)
with **zero searches run**. Not verified, possibly confabulated. Do not cite without independent
sourcing.
