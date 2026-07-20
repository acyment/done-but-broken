# E3 control-arm calibration, partial result (2026-07-20 write-up)

**Status note.** This run completed 13 of its planned 15 rollouts and was never resumed or reported.
Grep across both `hit-sdd-bench` and `hit-sdd-bench-e2` found no prior write-up of these numbers,
except a wall-clock/cost table inside `docs/e5/E5-SUBSTRATE-SCREENING-PROVENANCE-20260720.md`
(itself untracked until this same session — see Task 4 below) that was built for a different purpose
(cost/latency provenance for an unrelated substrate-screening question) and reports the same
per-rollout numbers this document re-derives independently from the source file. This document is
the first dedicated write-up.

**Classification: `calibration`, control-arm only.** This is not causal evidence and must not be
described as such — there is no treatment arm anywhere in this artifact. It is a measurement of how
often the E3 harness's control arm (no enforcement gate) produces a genuine cross-step regression on
chained brownfield episodes, run to check whether the pool could ever fire before spending on a
paired treatment arm.

## Source

`/Users/acyment/dev/hit-sdd-bench-e2/runs/e3-calibration/e3-calibration-control-20260706-163739.json`

## Run parameters (read directly from the artifact)

| Field | Value |
|---|---|
| `run_id` | `e3-calibration-control-20260706-163739` |
| `arm` | `control` (no enforcement gate; `enforce_surface_limit: null`) |
| `model_route` / `model` | `deepseek` / `openai/deepseek-v4-pro` |
| `n_episodes` (declared) | 3 |
| `n_rollouts` (declared, per episode) | 5 — so 15 rollouts were planned |
| `max_refusals` | 2 (unused in the control arm; the field exists for the enforcement arm) |
| Per-step iteration budget | 40 — read from each step's `agent_error: "max_iterations (40) reached"` field, not from a dedicated budget field (there isn't one at the top level) |
| `status` | `"in_progress"` |
| `gate_fires` | `true` (top-level field; means `total_regressions_observed > 0` across the whole run, i.e. at least one true regression fired somewhere) |
| `total_enforcement_refusals` | 0 (expected — control arm has no gate to refuse) |
| `total_regressions_observed` | 1009 (see note on this figure below) |

**Episodes actually present (3, matching `n_episodes`):**

| episode_id | repo | chain length `k` | rollouts present / planned |
|---|---|---:|---|
| `pvlib-rung4-k3-v1` | `pvlib/pvlib-python` | 3 | 5 / 5 (complete) |
| `pvlib-rung4-k6-v1` | `pvlib/pvlib-python` | 6 | 3 / 5 (**incomplete — 2 rollouts missing**) |
| `dmcg-rung4-k5-v1` | `koxudaxi/datamodel-code-generator` | 5 | 5 / 5 (complete) |

**5 + 3 + 5 = 13 of the 15 planned rollouts** — matching the "13 of 15" figure this task was given
to verify. Confirmed by direct count of the `rollouts` arrays, not just the summary field.

## Per-episode true-regression counts and sentinel-break counts

A "true regression" here (`any_true_regression` / `regression_count`) is a step where the agent's
work broke a previously-passing F2P (feature-test) bundle from an earlier step in the same chained
episode. A "sentinel break" (`p2p_regression_count`) is a broken pass-to-pass (P2P) test from the
broad public-suite sentinel surface armed at the base commit — a much larger, coarser check than the
curated F2P bundles.

| Episode | Rollouts w/ true regression | Sum of `regression_count` | Sum of `p2p_regression_count` (sentinel breaks) |
|---|---|---:|---:|
| `pvlib-rung4-k3-v1` | 0 / 5 | 0 | 0 |
| `pvlib-rung4-k6-v1` | 0 / 3 (of those completed) | 0 | 0 |
| `dmcg-rung4-k5-v1` | **3 / 5** | 4 | **1,005** (356 + 0 + 321 + 321 + 7, one figure per rollout) |
| **Total** | **3 / 13 completed rollouts** | **4** | **1,005** |

The top-level `total_regressions_observed: 1009` does not equal either component sum on its own; it
equals their **sum** (4 + 1,005 = 1,009) exactly. This appears to be how the harness aggregates the
two distinct measures into one top-level counter — worth noting as a possible source of confusion if
this field is read in isolation, since "1009 regressions" reads very differently from "4 true
cross-step regressions and 1,005 broad-sentinel breaks concentrated in one episode." Both figures are
reported separately above; this is presented as an observation about the field, not a claim the
harness computed it wrongly.

All of the sentinel-break mass (1,005 of 1,005) and all of the true-regression events (3 of 3
rollouts) occurred in `dmcg-rung4-k5-v1` — the two pvlib episodes recorded zero of either across all
8 completed rollouts.

## Per-rollout elapsed times (`elapsed_s`, as recorded)

| Episode | Rollout 0 | Rollout 1 | Rollout 2 | Rollout 3 | Rollout 4 |
|---|---:|---:|---:|---:|---:|
| `pvlib-rung4-k3-v1` | 1001.2 | 841.9 | 691.0 | 774.9 | 837.2 |
| `pvlib-rung4-k6-v1` | 1449.6 | 1706.0 | 1503.7 | *(missing)* | *(missing)* |
| `dmcg-rung4-k5-v1` | 1020.3 | 1191.1 | 5691.2 | 1153.7 | 1023.8 |

`dmcg-rung4-k5-v1` rollout 2 (5,691.2 s ≈ 95 minutes) is a clear outlier against the other 12
rollouts (all 691–1,706 s ≈ 12–28 minutes); it is also the rollout with the highest single
`p2p_regression_count` (356). No explanation for the elapsed-time outlier is recorded in the
artifact beyond the step data itself.

No USD cost field exists anywhere in this artifact (no token counts, no billing figures) — consistent
with the `E5-SUBSTRATE-SCREENING-PROVENANCE-20260720.md` finding that per-run USD cost is unrecorded
across E3 generally.

## Which episodes are incomplete, and by how much

- `pvlib-rung4-k3-v1`: **complete** (5/5).
- `pvlib-rung4-k6-v1`: **incomplete — missing rollouts 3 and 4** (3/5 present; the array simply ends
  at index 2, with no error record or placeholder for the missing two).
- `dmcg-rung4-k5-v1`: **complete** (5/5).
- Top-level `status: "in_progress"` is consistent with the missing pvlib-k6 rollouts — the run appears
  to have stopped (or been interrupted) partway through the second episode's fifth rollout was never
  reached, and it was never resumed to completion. The file's own mtime (2026-07-06 20:21, per prior
  filesystem inspection) is roughly 3h44m after the run's start time implied by its filename
  (16:37:39), i.e. it ran for some time before stopping in this partial state.

## Per-step detail (context, not required by the task but load-bearing for reading the counts above)

Every step in every rollout that did not declare done exhausted the 40-iteration budget
(`agent_error: "max_iterations (40) reached"`). Across the 13 completed rollouts, the agent declared
done on at least one step in 10 of 13; `dmcg-rung4-k5-v1` shows a strikingly uniform pattern — step 2
is the only step ever completed (`declared_done: true`, no iteration-limit error) in all 5 of its
rollouts, with every other step in that episode hitting the iteration cap every time. This is where
the episode's 3 true regressions and all of its sentinel breaks are concentrated — the agent
repeatedly ran out of budget on most steps of this chain, and where it did make progress, it broke
prior work often enough to register 3 true regressions in 5 rollouts.

## Classification and validity context

- **Control-only.** No treatment (enforcement-gate) arm exists in this artifact or anywhere paired
  with it. This cannot be read as a control-vs-treatment comparison of any kind.
- **`calibration`**, per the surrounding design doc's own repeated use of that term for this stage
  (`docs/protocols/e3-regression-redesign-v2.md` calls the whole R2 stage "the committed N=5
  calibration" and "Gate 6"). The JSON itself carries no `classification` field (unlike several other
  E2/E3 run artifacts, e.g. the flake-certify and pool-screen files, which do self-label
  `"classification": "calibration"`). This run's classification rests on the surrounding docs and
  repo-wide convention, not a field inside the file itself — worth noting as a small, harmless gap in
  the artifact's self-description.
- **Gold-leak fix history (searched and confirmed accurate).**
  `docs/protocols/e3-regression-redesign-v2.md` §13.2 records that the *first* full-calibration launch
  attempt (a separate, earlier artifact,
  `runs/e3-calibration/e3-calibration-control-20260706-134545.json`, run at 13:45:45 the same day) was
  stopped after ~1 rollout because its log showed the agent running `git show <gold-commit-hash>` and
  `git log --all` — a genuine contamination channel caused by the rung-4 episode construction reusing
  a *late* pinned Docker image (containing future commits, including the gold implementations, still
  reachable in the git object database even after `git reset` to the nominal base). The fix
  (`e3/agent.create_workspace_container`: isolate the workspace to base + ancestors, delete all other
  refs, expire the reflog, prune unreachable objects) is described as applied before this run — this
  run (16:37:39) started roughly 2h52m after the gold-leaked probe (13:45:45), consistent with "fixed,
  then re-launched."
  - **A verification gap worth flagging honestly:** the e2 repo's git history has **no commits at all
    between 2026-07-01 and 2026-07-08** for the e3 module — `src/hit_sdd_e2/e3/agent.py` (which
    contains the gold-leak guard) was first committed in `657b684` on **2026-07-08**, two days after
    this run executed. This means the fix's presence at run-time (16:37:39 on 07-06) is attested only
    by the prose account in the redesign doc, not by a git commit timestamped before the run — the
    code as committed today cannot be dated to the moment this run fired. This is presented as an
    open verification gap, not a reason to doubt the fix; the retired-probe artifact
    (`...-134545.json`) and this run's clean pipeline behavior (no gold-commit-hash git operations
    visible in the available fields) are consistent with the fix having been in effect, but this
    cannot be confirmed from version control alone.
- **No successor or completed run found.** Searched both repos (`grep -r "163739"`,
  `grep -r "e3-calibration-control"`, directory listing of `runs/e3-calibration/`) for any run dated
  after 2026-07-06 20:21 (this file's last-write time) that might be a completed continuation. None
  exists. The most recent related git activity in either repo's commit history for the e3 module is
  the single retroactive batch on 2026-07-08, which added source and scripts but no new run artifact
  superseding this one. **This run appears to have been abandoned mid-flight and never picked back
  up.**

## What this run does and does not show

- It shows the E3 control arm **can** produce genuine cross-step regressions on real, chained,
  certified brownfield episodes (`dmcg-rung4-k5-v1`, 3/5 rollouts) — a live signal, unlike the earlier
  same-base-commit calibration (BACKLOG.md, 2026-07-05 entry) which closed null at 0 true regressions
  across all rollouts on the previous (non-chained) episode pool.
- It does **not** establish a rate with any precision — n=13 rollouts across 3 episodes, one of which
  supplied 100% of the observed true-regression and sentinel-break signal, is not enough to
  distinguish "this episode is unusually regression-prone" from "the pool as a whole fires at this
  rate."
- It does not, and cannot, say anything about the effect of the enforcement gate (E3's actual causal
  variable) — there is no treatment arm here to contrast against.
- It is incomplete (13/15) and was left `in_progress` with no recorded resumption.

## Sources checked

- `hit-sdd-bench-e2/runs/e3-calibration/e3-calibration-control-20260706-163739.json` (this run, full
  contents parsed programmatically)
- `hit-sdd-bench-e2/runs/e3-calibration/e3-calibration-control-20260706-134545.json` (the retired,
  gold-leaked probe referenced for contrast)
- `hit-sdd-bench-e2/runs/e3-calibration/` directory listing (mtimes, filenames, to confirm no
  successor run exists)
- `hit-sdd-bench-e2/scripts/run_e3_calibration.py` (`gate_fires` computation)
- `hit-sdd-bench-e2/src/hit_sdd_e2/e3/agent.py` and its git history (gold-leak guard; commit dates)
- `hit-sdd-bench/docs/protocols/e3-regression-redesign-v2.md` §13.1–13.2 (gold-leak discovery/fix,
  predeclared calibration design, the retired probe's own write-up)
- `hit-sdd-bench/docs/e5/E5-SUBSTRATE-SCREENING-PROVENANCE-20260720.md` (independent cross-check —
  its wall-clock table for this same run matches every number re-derived here)
- `hit-sdd-bench/BACKLOG.md` (2026-07-05 and 2026-07-06 entries, for the pre-chained-episode null
  calibration and the chronology of the rung-4/gold-leak work)
