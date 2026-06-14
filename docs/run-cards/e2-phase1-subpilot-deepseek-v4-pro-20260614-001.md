# Run Card: e2-phase1-subpilot-deepseek-v4-pro-20260614-001

| Field | Value |
| --- | --- |
| Run ID | `e2-phase1-subpilot-deepseek-v4-pro-20260614-001` |
| Date | 2026-06-14 |
| Program | E2 brownfield acceptance-feedback ablation |
| Classification | **`calibration`** — first real two-arm data + orchestrator validation; **NOT causal evidence** |
| Substrate | SWE-bench Live: `spulec__freezegun-582`, `MechanicalSoup__MechanicalSoup-455` |
| Model / route | `deepseek-v4-pro` (litellm openai-compatible) |
| Arms | `control` (file_editor) vs `treatment` (file_editor + container-backed `run_tests`) |
| Design | **N=1 run/arm/task** (4 agent runs); flake/contamination GATES and Phase-1.5 power deferred |
| Harness | `hit-sdd-bench-e2` @ `7a9b713`, via the orchestrator (`run_phase1`) |

## Results

| Task | Arm | Resolved | P2P regressions |
| --- | --- | --- | ---: |
| freezegun-582 (easy, 1 file) | control | True | 0 |
| freezegun-582 | treatment | True | 0 |
| MechanicalSoup-455 (harder, 2 files) | control | **False** | **1** |
| MechanicalSoup-455 | treatment | **False** | **0** |

## Honest interpretation

1. **Harness validated on multiple real tasks, both arms, end-to-end** through the orchestrator with
   a real frontier model — including the executable-feedback `run_tests` tool.
2. **freezegun (easy):** both arms resolve, no regressions. DeepSeek self-solves; feedback redundant —
   consistent with the E1 finding and confirming easy single-file tasks **do not discriminate**.
3. **MechanicalSoup (harder):** neither arm resolved, **but `control` shipped a P2P regression that
   `treatment` did not.** This is a single-observation **directional hint in the predicted direction**
   (executable feedback let the agent avoid breaking an existing test) and shows the signal lives on
   harder/multi-file tasks — and that the harness captures it.

## What this is NOT

**Not evidence — N=1 run per arm.** Zero statistical power; a 1-vs-0 regression difference is at the
noise floor (per the pilot-critique's own math) and is fully attributable to agent nondeterminism /
a different patch on a single run. It is **hypothesis-generating only**. The self-verification-gap
column is omitted from the results table because `declared_done` is currently approximated `True`
(a known fidelity gap), so the gap signal here is confounded; the **regression** difference is the
meaningful (but underpowered) observation.

## What it motivates

Exactly the predeclared design: a **regression-enriched, powered Phase 1.5** (n≈20–40 harder/multi-
file tasks, N≈10/arm, permutation test) — because (a) easy tasks don't discriminate, and (b) the
harder task hints the effect is there to measure. Before that, the sealed Phase-1 (≥60-run flake
certification + memorization GATE B + frozen task set in `e2-phase1-pilot-commitments-v1.md`).

Not pooled with any E1 run nor any future E2 run of different classification.
