# E2 Executable-Spec — Stage-0 Probe Protocol (v1)

Status: **PROTOCOL DRAFT — not authorized, not run, no provider/Docker calls fire from this document.**
Building and running Stage 0 is a separate, explicitly-authorized step. Date: 2026-07-02.
Classification when executed: **`calibration` / `difficulty_probe`** — feasibility + the one open causal
question. Not causal-grade; no public claim. Pairs with the pre-registered decision rule
(`e2-executable-spec-decision-rule-v1.md`); read with the external-review-prompt doc and the offline-pilot
findings doc.

## The one question
Does "readable spec + shell + one-click run-the-checks" (treatment) beat "readable spec + shell, writes its
own tests" (control) on **hidden-correct completion** and the **false-confidence gap**? This is the only
open, decision-relevant question in the larger program; everything else is packaging around it.

## Why this shape (context)
- Prior pilots proved executable feedback ≫ a **no-execution** control (Addendum B §B8); the self-testing
  control is the un-licensed next claim. Stage 0 tests exactly that, cheaply.
- The product's wedge is the enterprise **UX** for authoring/reviewing specs, not the gherkin→executable
  translation — so **we author the specs ourselves** (good models + human review + gates); we do **not** need
  the blind-AI-authoring fidelity machinery (surface introspection, base-validation loop).
- We grade on the **authored spec** (primary) with **gold as a secondary cross-check only** — so we can reuse
  the certified SWE-bench-Live brownfield pool without the list-vs-tuple trap (gold is no longer the grader),
  and without building a new task/image pipeline.

## Arms (differ in exactly one tool)
- **Control ("plain SDD"):** readable OpenSpec spec + shell; may write and run its own tests; never sees the
  sealed check code. *(A new, harder baseline than the pilots' `file_editor`-only control.)*
- **Treatment ("BDD"):** identical, **plus** the execution-only `run_spec` tool — returns check names +
  pass/fail only, no expected values, no step source (already how `_RunSpecExecutor` behaves; keep it).

## Reuse (existing harness, as-is or nearly)
- Orchestration: `orchestrate/phase1_5.py::run_phase1_5` — task-sequential, rollout-parallel, checkpointed;
  `arms = ("control","treatment")`, `runs_per_arm`.
- Agent + arm toggle: `agent/openhands_agent.py::build_tools(arm)`; `.solve(instance, arm=, image=)`.
- Task load + pool: `_cli/dataset.py::load_by_id` + the `CERTIFIED` list; `oracle/swebench_eval.py::image_name`.
- Task classes: `authored_spec/scoring.py::TASK_CLASS` (bug/feature/mixed; Addendum B §B5).
- Authored-spec oracle + gates: `authored_spec/{execution,compiler,openspec,gates,manifest,bundle}.py`
  (pristine-checkout grading; JIT OpenSpec→Gherkin→pytest-bdd; non-triviality / tautology / flake-cert).
- Scorer: `authored_spec/scoring.py::score_authored_spec_candidate` (`self_verification_gap`, `gap_gold` gold
  cross-check, `summarize_run_spec_use` B7 telemetry).
- Analysis: `orchestrate/phase1_5_analysis.py` — per-task hit test at **MCID = 0.20**.
- Model routes: `_cli/routes.py`.

## Build (the honest, now-small cost list)
1. **Shell on BOTH arms** — make the control able to self-test (confirm/add a bash tool in `build_tools`;
   today the control is `file_editor`-only).
2. **Wire `register_run_spec_tool` into the treatment arm** (currently defined but unused) in place of
   `run_tests`; thread the sealed `AuthoredSpecBundle` + `bundle_root` into the agent (`_RunSpecExecutor`
   needs them).
3. **Route scoring through `score_authored_spec_candidate`** (authored spec = primary; gold = secondary
   cross-check) instead of the current `score_candidate`-on-gold path; capture `declared_done` and
   `self_verification_passed` from each rollout.
4. **Control-side telemetry** — log whether the control wrote tests, ran them, and whether they agree with the
   sealed checks (today `run_tests`/shell calls are not logged; only `run_spec` has a `.calls` log). Required
   for the mechanism decomposition.
5. **Author + seal ~3–6 authored-spec bundles** ourselves. Each must pass the existing gates **plus** two new
   fairness checks: an **adversarial spec-lawyer gate** (an agent builds a spec-compliant implementation that
   FAILS the checks → over-specification found → fix or lift into the readable spec) and a **k-diverse
   correct-impl gate** (several deliberately-different correct implementations must all pass). Pin any new-API
   surface (names, signatures, return types) in the *readable* spec so it is a shared requirement, not a
   hidden check quirk.
6. A thin **calibration entrypoint** that runs the control arm only.

## Tasks (favor behavior-change / observable; all carry gold → secondary cross-check available)
Candidate set from `CERTIFIED` + `TASK_CLASS`: `spulec__freezegun-582` (bug),
`koxudaxi__datamodel-code-generator-2461` (bug, CLI),
`django-json-api__django-rest-framework-json-api-1283` (mixed, HTTP), plus one `psf__black-467x` (formatting
behavior, very observable). Author specs for these; drop any that fail the fairness gates; aim to seal 3–4.

## Models
Frontier `deepseek-v4-pro` + mid-tier `deepseek-v4-flash` (same provider/key, cheap). `glm-5.2` is the spec
author, never an agent-under-test.

## Run order (also the internal-validity checklist)
1. **Author + seal specs.** Each must pass non-triviality + tautology + flake-cert + spec-lawyer + k-diverse
   gates, AND the **gold patch must pass the authored spec** (secondary cross-check / satisfiability). Drop
   tasks that cannot clear these.
2. **Control-only calibration** (a few runs/task): confirm the baseline `self_verification_gap` clears
   MCID = 0.20 on ≥1 task. If not, the probe cannot succeed at any N → **stop / reselect before any treatment
   rollouts.**
3. **Full two-arm probe:** both model tiers, small `runs_per_arm`, checkpointed. Primary = hidden-correct
   completion + false-confidence gap; secondaries (pre-registered) = time-to-green / turns / tokens; plus the
   control **mechanism decomposition** (did it write tests; did they pass its own final code; do they agree
   with the sealed checks) — this is what lets a null be read as "diligent controls self-tested equivalently"
   vs. "no gap events at all."
4. **Leak-tightness protocol test:** assert the treatment's `run_spec` output stays names + pass/fail (guards
   against a refactor that returns expected values or step source to the treatment).

## Interpretation
Feed the outcome into the pre-registered decision rule (`e2-executable-spec-decision-rule-v1.md`). A null is a
first-class result. This validates the *foundation* (do executable specs help), not the product's UX wedge.
