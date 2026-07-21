# Substrate search v3 — scout clarifications

Prompt: `docs/e5/SUBSTRATE-SEARCH-V3-PASTE-READY.md`. Same convention as v2: all scouts get
identical answers; reuse recorded answers verbatim if a question repeats; append new exchanges
with date and scout.

---

## Exchange 1 — 2026-07-21 (asking scout: qwen, version to be recorded by operator)

**Q1.** Should the part-1 critique focus solely on internal logical gaps in the selection
criteria (e.g., over-reliance on regression-fix PRs as proxies for silent edges), or also
include practical operational blind spots (e.g., assumptions about local reproducibility or
budget constraints affecting verification)?

**A1.** Internal logical gaps first and foremost; that is where the value was last round (the
loud-edge hole was a logic flaw in the criteria, caught by a scout, and it retargeted the
entire search). Your example — over-reliance on regression-fix PRs as proxies for silent
edges — is exactly the class wanted: a way the criteria could select the wrong thing while
appearing to work. Operational blind spots are welcome ONLY when they change what to nominate:
if a criterion cannot actually be verified at a solo-operator budget, that is a flaw in the
criteria, not an ops footnote, and belongs in the critique. Not wanted: generic feasibility
hedging (builds can be slow, budgets are tight, models vary) that would read the same
regardless of which criteria had been written.

**Q2.** Should each candidate prioritize sequences with at least one fossil-record regression
(type-a evidence), or are strong inferences (type-c) acceptable if they come with clear,
low-effort knockout verification paths?

**A2.** Fossils are prioritized but not required; the scorecard already prices this
(fossil > discussion > inference). The distinction that matters: a fossil certifies silence
(it shipped, users hit it, no test caught it); an inference merely predicts it, and last round
taught us predicted properties often die on contact. A type-c nomination is acceptable IF the
knockout path is named concretely — the file, the function, the one-line disable, and which
tests are expected to stay green. "Disable A's validation and B's suite should pass" with named
symbols is a nomination; "the tests probably don't cover this" without a target is not. An
ideal slate mixes: anchor candidates on type-a evidence, spend type-c nominations only where
the mechanism is unusually clean or the surface unusually credible. The fossil is evidence,
not the goal — the goal is a silent edge usable inside a work sequence; the fossil is how the
silence is proven cheaply.

**Q3.** For the part-5 supply question: a qualitative assessment based on observed repository
patterns, or a rough quantitative estimate ("1 usable edge per ~X repos scanned")?

**A3.** Both, but the quantitative half only with an honest denominator. Required: qualitative
concentration patterns ("silent edges cluster in validation layers, wrong-result paths of data
libraries, tool verdicts"), because that guides where the next search hour goes. Welcome: a
rate estimate, but only as "we scanned N repos / ran M queries and found K usable" drawn from
the actual search log (deliverable 4 provides the log to cite). Do not manufacture a
denominator; an invented "1 per X repos" is worse than no number. If the scan is too small to
support a rate, say so and give the qualitative answer only.
