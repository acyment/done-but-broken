# E2 Protocol v2 — Large-Repo Navigation-Equalized Design (v1)

Status: **DESIGN DRAFT — not authorized, not run, not sealed.** No provider/Docker run fires from
this document. It is a **new compatibility boundary** ("Protocol v2 / nav-equalized"), never pooled
with the n=9/n=13 main pilots (Protocol v1), the budget-sensitivity study, or E1. Sealing (hash +
operator authorization + spend cap + sealed commitments) is a separate step, after the qwen
replication (`e2-phase1-pilot-commitments-v1-addendum-c.md`) completes and is reported, and after this
design is reviewed.

Date: 2026-06-21. Program: E2 (`e2-brownfield-acceptance-ablation-design-v1.md`). Companion to the
budget-sensitivity draft (`e2-budget-sensitivity-design-v1.md`).

## Why this exists (the decision)

The 4 largest certified repos — `psf__black-4684`, `psf__black-4670`, `python-attrs__attrs-1448`,
`dpkp__kafka-python-2608` — were **excluded from the DeepSeek headline (n=9)** and run
**navigation-confounded in the qwen n=13**, because the control arm (file_editor, **no shell**) cannot
*navigate* a large codebase to locate the code — so its high self-verification gap there conflates
"can't run tests" (the causal variable) with "can't explore the repo" (a navigation handicap).

We decided this is **worth building**, reframed from "optional breadth" to **the clean test of a
specific hypothesis**: *executable acceptance feedback helps most where it is hardest — large, real
brownfield repos.* If true under navigation parity, that is the strongest and most industry-relevant
claim the program can make ("on your biggest, messiest codebases, the agent stops confidently shipping
broken code"). If the effect shrinks once navigation is equalized, we learn that much of the apparent
big-repo advantage was navigation, not verification — also a real finding.

## Primary question & hypothesis

**Q:** Once both arms have equal *read-only* navigation, does executable acceptance feedback reduce the
self-verification gap on **large** repos by **at least as much as** on small/medium repos — i.e., does
the effect hold or grow with repo scale?

- **H_scale (predeclared):** the gap-reduction effect on large repos (nav-equalized) ≥ the
  small/medium effect. Motivated by the brownfield thesis (frontier models self-verify *worse* at
  scale → larger blind gap → larger feedback payoff) and our own difficulty gradient
  (freezegun 0→0, drf 40→0, twine 90→0).
- **Expectation on character:** the **diagnostic** benefit (gap↓) grows on large repos; the
  **generative** benefit (resolve↑) may *plateau* where tasks exceed the model's reach (cf. twine:
  gap 90→0 but resolve 0→0). So "better on big repos" most likely means *bigger false-confidence
  reduction*, not necessarily more solves.
- **H0:** once navigation is equalized, the large-repo effect collapses toward (or below) the
  small/medium effect — i.e., the big-repo advantage was largely navigation.

## The confound addressed, and the inviolable rule

Protocol v2 equalizes **navigation** so the only between-arms difference stays `run_tests`. The
navigation aid is added **symmetrically to both arms** and is strictly **read-only / no-execution**.
This does not relax any rule — `run_tests` remains treatment-only; budget stays equal across arms.

## Design — the `CodeBrowser` toolset (both arms)

A hermetic, read-only code browser, identical for control and treatment. Treatment additionally gets
`run_tests` (unchanged). Decided mechanisms (and the rejected ones, with reasons):

**Use:**
- `search_code(regex, glob?, max_results)` — ripgrep-style **typed** text search over **source only**;
  returns `path:line` spans + short context. Not a shell; locked against `--pre`/exec/shell-injection.
- Tree-sitter / ctags **repo map + symbol index**: `list_tree`, `read_file_range`,
  `search_symbol`, `show_definition`, `show_references` (static), `show_imports`, and a token-bounded
  `repo_map`. Pure static parse of source.

**Reject (recorded so we don't drift):**
- **LSP / language servers** (pyright, pylsp, jedi): they emit **diagnostics / type errors** on the
  agent's edits — an execution-adjacent pass/fail signal that violates the read-only constraint.
  Tree-sitter/ctags give the same navigation without a diagnostics channel, so LSP is dominated.
- **Python `ast` / import-based static tools**: can **execute** module-level code on import. Use
  tree-sitter (C-binding parse, no runtime).

**Leak guards (decided, mandatory):**
1. **Exclude all test files** from the search corpus *and* the symbol index (`tests/`, `test_*.py`,
   `*_test.py`, `spec/`). Otherwise the agent greps the hidden acceptance tests → total oracle leak.
2. **Build the index on the pristine base commit and FREEZE it.** The file_editor may read the agent's
   current files, but navigation/symbol queries must **not** re-index edits or report parse/type
   errors on changes — that would be edit-level validation feedback.
3. **No `.git`, PR refs, future commits, generated logs, or prior-attempt artifacts** in the browsable
   tree. Index from a clean source snapshot with an audited file manifest.
4. **Build the index outside the agent container**, mount read-only; the tool schema must be
   structurally incapable of returning exit codes, tracebacks, diagnostics, or pass/fail.

## Arms, scope, models

- **Control:** `file_editor` + `CodeBrowser`.
- **Treatment:** `file_editor` + `CodeBrowser` + `run_tests`.
- **Tasks:** the 4 large repos above.
- **Models:** **both** `deepseek-v4-pro` and `qwen3.7-max` (DeepSeek never ran these; qwen ran them
  confounded). Both under identical Protocol v2.
- **N = 10 runs/arm/task** (matches the main pilot). 4 tasks × 2 arms × 10 × 2 models = **160 rollouts**.

## Decided fork: interactive nav, not a fixed working set

We chose **interactive symmetric read-only navigation** (the `CodeBrowser`) over the alternative of a
**fixed shared localization working set + anonymized checks**, because interactive nav is most faithful
to "a real agent on a real repo" and **most continuous with the small-repo design** (where the agent
also self-localized, just with weaker tools). The fixed-working-set design is retained as an
**optional robustness arm** if a reviewer objects that fixing localization is artificial.

## The two-directional confound (decided construct)

`run_tests` bundles **(a) verification** and **(b) localization** — the returned **check node-ids**
(e.g. `…::test_handles_empty_payload`) tell treatment *what* is broken, a localization nudge control
cannot get. Confirmed present in the current harness (`container_tools.py` returns named node-ids +
pass/fail) across all tasks.

**Decision:** the **realistic named-check version is the PRIMARY construct** — descriptive acceptance
scenario names are part of how executable acceptance feedback (BDD/spec) actually works, not a confound
to scrub. We **own the bundle explicitly** and run an **anonymized-checks variant** (`check_1…check_n`,
indices only) as a **labeled robustness secondary** to decompose verification vs feedback-as-localizer.
This is a global property (relevant to v1 too); it is recorded here because nav parity + anonymized
checks together would isolate pure verification on large repos if we want that read.

## Compatibility & analysis (decided)

- **New boundary.** Protocol v2 control ≠ Protocol v1 control (CodeBrowser added), so **do not** compare
  large-repo control to small-repo control as the same condition, and **do not** pool absolute rates
  into one "all repos" number.
- **Valid quantity:** the **within-design contrast** (control gap − treatment gap), well-defined in each
  design regardless of baseline.
- **Combine without re-running the smalls:** a **mixed-effects logistic model** with task/repo random
  effects, a `design` indicator (v1 vs v2), repo-scale, and a **design×treatment** (and scale×treatment)
  **interaction** — the interaction term is the direct test of H_scale. Report a **stratified
  forest plot** (small/medium v1 effect; large v2 effect), not a single pooled ATE.

## Validation — proving navigation parity *and nothing more*

Using the gold patch as a **measurement** instrument (experimenter-side only; never shown to the agent):
1. **Localization recall (manipulation check):** per arm × repo, did the agent read/edit ≥ the gold
   files? Parity iff **control recall ≈ treatment recall and both high**; report unconditioned recall too.
2. **Stratify the gap by correct localization** (L = edited ≥ gold files): if the `run_tests` effect
   persists within L=correct, it is acting on **verification, not navigation** — the clean separation.
3. **Did `run_tests` move localization?** Compare recall control vs treatment; with named checks expect
   treatment ≥ control (that's the bundle); the anonymized variant should null this.
4. **Log/placebo audit:** no tool call executes anything; no diagnostics; no test path ever read; index
   built on pristine repo; test files absent from every searchable corpus/symbol index; matched-arm
   working sets identical; **canary scan** — `FAILED|PASSED|Traceback|AssertionError|pytest|mypy|pyright`
   must not appear in any control transcript except where literal in source.
5. **Pre-register** estimands, the named-vs-anonymized choice, and the gold-recall conditioning before
   running.

## Reporting/provenance upgrade from the LLM empirical-guidelines audit

Audit note (2026-06-24): comparing E2 against the LLM-in-SE empirical reporting guidance
(`arXiv:2508.15503`) found that the completed Protocol v1 pilots are strong on pre-registration,
classification, contamination/flake gates, bounded claims, and model/config reporting, but are not
session-trace complete. They preserved per-run outcomes, per-test results, usage, artifact hashes, and
the final patch hash; the pilot run-cards already disclose that patch text was not retained for
patch-level replay. Full OpenHands conversation traces, exact rendered prompts, and complete runtime
tool-call logs were not preserved as first-class artifacts.

Protocol v2 and any later E2 evidence-grade run therefore require a **trace-complete artifact bundle**
before the run can be called replay/reporting complete:

- Exact prompt artifacts: prompt template, per-run rendered user prompt, OpenHands/scaffold version,
  any system/developer prompt text exposed by the scaffold, and model route/config (`model`, endpoint,
  temperature, timeout, retries, max output, reasoning mode).
- Complete tool catalog by arm: tool names, schemas/descriptions, and arm availability for
  `file_editor`, `CodeBrowser`, and `run_tests`; record the named-check vs anonymized-check variant.
- Runtime trace: ordered conversation/messages, tool calls, tool arguments, tool results, feedback-tool
  calls, agent termination status, and any agent plan object the scaffold exposes.
- Replay artifacts: final patch **text** as well as hash, sanitized snapshot/container image IDs, scored
  test outcomes, quarantines, validity flags, usage/cost per rollout, and the analysis record.
- Storage convention: raw bundles live in the harness artifact release; this scientific-record repo
  keeps run-cards, summaries, hashes, and links. If privacy/proprietary constraints ever prevent full
  trace release, publish a redaction manifest plus representative trace examples and downgrade the
  reproducibility claim accordingly.

This is a prospective reporting requirement, not a retroactive validity change for Protocol v1. The
completed pilots remain bounded `causal_pilot` evidence as documented; future runs should close the
session-trace/prompt-reporting gap before making stronger reproducibility claims.

## Cost (honest)

160 rollouts on the **heaviest** repos (slow, reasoning-token-heavy for qwen; large image pulls), plus
real engineering for the `CodeBrowser` (tree-sitter index + locked search tool + audit harness). Multi-
day wall-clock; spend cap fixed at authorization. The anonymized-checks robustness variant, if run,
adds another arm-set.

## Harness changes required

- `CodeBrowser` toolset (search + tree-sitter/ctags index) registered for **both** arms; index built
  outside the container and mounted read-only; schema cannot return runtime/diagnostic output.
- Test-file exclusion + pristine-snapshot index builder + file manifest allowlist.
- New protocol-profile id; per-record tagging (`design=v2`, `nav_aid=codebrowser`) so v1/v2 never pool.
- Reuse the existing oracle/scoring/`usage` capture, but extend provenance with the trace-complete
  artifact bundle above (full rendered prompt, tool catalog, ordered tool/runtime trace, final patch
  text, and image/snapshot identifiers). This is required for future evidence-grade Protocol v2 runs.
- Protocol tests: read-only/no-exec guarantee, test-file exclusion, frozen-index (no edit re-index),
  tool-symmetry across arms, canary-absence, and artifact completeness checks for prompt/tool/trace
  capture.

## Sequencing / gating

1. Current qwen replication completes and is reported (n=9 primary + n=13 with the nav confound flagged).
2. This design reviewed; build the `CodeBrowser` + validation harness; pilot the leak guards offline.
3. Sealed commitments + operator authorization + spend cap.
4. Run **both models** on the 4 large repos under Protocol v2; report as a stratified large-repo result
   testing H_scale.

## Status

**DESIGN DRAFT, decisions recorded.** Does not authorize or affect any running pilot. The headline it
targets: *under navigation parity, does executable acceptance feedback help most on the largest, most
realistic codebases?*
