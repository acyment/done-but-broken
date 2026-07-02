# E2 Executable-Spec — Stage-0 Build Scope (v1)

Status: **BUILD SCOPE — engineering work breakdown, nothing built or run.** Implements the Stage-0 probe
protocol (`e2-executable-spec-stage0-probe-protocol-v1.md`) under its decision rule
(`e2-executable-spec-decision-rule-v1.md`). Date: 2026-07-02. All paths are in the harness repo
(`done-but-broken-harness` / local `hit-sdd-bench-e2`), package `src/hit_sdd_e2/`.

## The one architecture decision (needs a call — affects validity, not just cost)
Today the agent runs on the **host** (`OpenHandsAgent.solve`, `agent/openhands_agent.py:147`) with **only
`file_editor`** (no shell); the treatment's `run_tests` executes in a **fresh container per call** (applies
the host `git diff`, runs the subset — `agent/container_tools.py:45-57`). The control literally cannot run
anything today. To make Stage-0's control able to **self-test**, it needs a shell. Two options:

- **(i) Host workspace + a container-backed `bash` tool** (per-call fresh container, generalizing
  `run_tests` to arbitrary commands). Reuses the current architecture; **chosen default** for Stage 0.
  *Risk:* the shell is clunky — no persisted state between commands, ~10–30 s/command. If that understates
  what a diligent control could do, it inflates the treatment's edge (a real confound). Mitigated by making
  the tool ergonomic + reporting the mechanism decomposition and time-to-verify, so the effect is visible.
- **(ii) Agent-in-container** (provision an OpenHands agent-server runtime on the SWE-bench image → real
  persistent bash + file_editor in-container). Fairer control, the "proper" path the code's docstring
  anticipates (`openhands_agent.py:11-14`), but a much bigger build. **Deferred to Stage 1** unless the
  Stage-0 fairness risk is judged unacceptable up front.

Everything below assumes **(i)**.

## Cross-cutting fix (do first — it blocks the control entirely)
**Untracked files are invisible to `git diff`.** The exec tools and the final patch all capture changes via
`git -C <workdir> diff` (`container_tools.py:47`, `authored_spec_tools.py:51`, `openhands_agent.py:168`).
A **new test file the control writes is untracked → excluded → the container never sees it → the control
cannot run its own tests.** (Same bug hides any new *source* file an agent adds, in either arm.) Fix once:
capture with `git add -A -N` (intent-to-add) before `git diff`, or `git add -A && git diff --cached`. Apply
to all three diff-capture sites. **This is a correctness fix, not just Stage-0 plumbing.**

## Work items (dependency order; "reuse" = existing, "new" = to build)

**W1 — Container-backed `bash` tool (both arms).** *new.*
- New `agent/container_bash_tool.py` mirroring `container_tools.py`: an OpenHands tool that takes the current
  (untracked-inclusive) diff, applies it in a fresh sanitized container, runs the agent-supplied command,
  returns truncated stdout/stderr + exit code.
- *Reuse:* the container-run primitive in `authored_spec/execution.py::_run_one_check` (checkout base → apply
  patch → run command, `--network none`, `--platform linux/amd64`); generalize its fixed command to an
  arbitrary one. Log each call (command + a result hash) for the mechanism decomposition.
- *Risk:* slow (per-call container); untracked handling (W0); output truncation policy.

**W2 — Stage-0 agent.** *new (a variant of `OpenHandsAgent`).*
- New `agent/stage0_agent.py` (or a mode on `OpenHandsAgent`) holding `model_route`, `api_key`, and a
  `{instance_id: (AuthoredSpecBundle, bundle_root)}` map.
- `solve()`: give **both** arms `file_editor` + the W1 `bash` tool; **treatment additionally** registers
  `run_spec` for the task's bundle via `agent/authored_spec_tools.py::register_run_spec_tool` (currently
  **unused**) — *not* `run_tests`. Update the task message/hint accordingly (control: "write and run your own
  tests with `bash`"; treatment: "…and `run_spec` runs the official checks").
- Capture telemetry into `AgentOutcome`: the treatment's `_RunSpecExecutor.calls` (needs threading the
  executor instance out — today it is created inside `register_run_spec_tool`'s `create()` and unreachable),
  and the control's `bash` test-activity (from W1's log). Keep `declared_done`/`self_verification_passed`
  as-is (`openhands_agent.py:167-171`).

**W3 — Authored-spec scorer adapter.** *new thin wrapper; reuses the scorer.*
- `run_phase1_5` calls a single `scorer(inst, patch, arm=, declared_done=, self_verification_passed=, image=,
  timeout=, quarantine=)` (`orchestrate/phase1_5.py:153-155`). Build a factory that closes over the
  `{instance_id: (bundle, bundle_root)}` map and dispatches to
  `authored_spec/scoring.py::score_authored_spec_candidate` (authored spec = primary; `gap_gold` = the gold
  **secondary** cross-check). It ignores `quarantine` (authored checks carry their own flake-cert). Returns
  `AuthoredSpecScoreRecord` (`.arm`, `.self_verification_gap`, `.to_dict()` — compatible with the records +
  `phase1_5_analysis`).

**W4 — Spec authoring + sealing pipeline.** *reuse authoring/gates; new fairness gates + seal enforcement.*
- Author ~3–4 specs ourselves (good models + human review). Run each through existing gates
  (`authored_spec/gates.py`: non-triviality, tautology, flake-cert) **plus two new gates**: an **adversarial
  spec-lawyer** (an agent builds a spec-compliant impl that FAILS the checks → over-spec found) and a
  **k-diverse correct-impl** gate (several deliberately-different correct impls must all pass). Pin any
  new-API surface in the *readable* OpenSpec.
- **Enforce the seal (currently dead):** set `sealed_at` at seal time and call `validate_bundle_hash` /
  `assert_sealed_before_rollout` at grade time — all three are defined with **no callers** today
  (`authored_spec/bundle.py`). Gold patch must pass the sealed spec (satisfiability + cross-check).

**W5 — Control-only calibration entrypoint.** *new thin driver.*
- `examples/run_stage0_calibration.py`: runs the **control arm only** over the sealed tasks (reusing W2/W3),
  reports `self_verification_gap` per task vs **MCID = 0.20** (`orchestrate/phase1_5_analysis.py`). Gate: if
  no task clears MCID, **stop before any treatment rollouts.**

**W6 — Two-arm probe driver.** *reuse `run_phase1_5`; new example.*
- `examples/run_stage0.py` modeled on `examples/run_phase1_5.py`: the Stage-0 task list (3–4 sealed),
  `agent = Stage0Agent(bundles=…)`, `scorer =` the W3 factory, `runs_per_arm = small`, both model routes
  (`deepseek-v4-pro`, `deepseek-v4-flash`). Orchestration (`run_phase1_5`), checkpointing, image build/reclaim
  are reused as-is.

**W7 — Mechanism decomposition + secondaries.** *extend analysis.*
- Extend `phase1_5_analysis` (or a Stage-0 analysis) to read: did the control write/run tests (W2 telemetry),
  time-to-green / turns / tokens (from `usage` + conversation length), and the run_spec telemetry
  (`summarize_run_spec_use`). Lets a null split into "diligent controls self-tested equivalently" vs. "no gap
  events".

**W8 — Leak-tightness protocol test.** *new test.*
- A unit/protocol test asserting `run_spec`'s observation stays check-names + pass/fail (no expected values /
  step source) — guards against a refactor that leaks the oracle to the treatment.

## Sequencing
W0 (untracked fix) → W1 (bash) → W2 (agent) in parallel with W3 (scorer) and W4 (specs). Then W5
(calibration, a real go/no-go) → W6 (probe) → W7 (analysis). W8 anytime. **W4 and W5 are the true gates:** if
we cannot seal ≥1 fair spec, or the control-only gap does not clear MCID, we stop before the expensive part.

## Rough sizing (relative, not a commitment)
Small: W0, W3, W8. Medium: W1, W5, W6, W7. Medium-large: W2 (telemetry threading + tool wiring), W4 (the two
new fairness gates + human spec review + seal enforcement). Total is roughly a couple of focused weeks of
build + spec authoring before the (cheap) calibration run — far short of the quarter the full design implied.

## Biggest risks (watch these)
1. **Control-shell fidelity (the architecture decision above)** — a clunky bash understates the control and
   fakes a treatment win. Ergonomics + time-to-verify reporting mitigate; escalate to option (ii) if needed.
2. **Too few gap events** — W5 catches it cheaply before W6.
3. **Fair-spec authoring** — W4's spec-lawyer + k-diverse gates are new; if a task can't clear them, drop it.
4. **Untracked-file capture (W0)** — get it wrong and the control silently can't self-test, faking a win.

## Not in scope (explicitly)
No rollouts, no provider/Docker calls, no spec authoring runs from this document — building + running Stage 0
is a separate, explicitly-authorized step. The cheat-judge, the full brownfield task factory, and
agent-in-container (option ii) are Stage-1 material.
