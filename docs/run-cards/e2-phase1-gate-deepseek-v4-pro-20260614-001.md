# Run Card: e2-phase1-gate-deepseek-v4-pro-20260614-001

| Field | Value |
| --- | --- |
| Run ID | `e2-phase1-gate-deepseek-v4-pro-20260614-001` |
| Date | 2026-06-14 |
| Program | E2 brownfield acceptance-feedback ablation; Phase 1 (A/B feasibility + contamination gate) |
| Classification | `difficulty_probe` / `calibration` — gate result, **NOT causal evidence** |
| Commitments | `e2-phase1-pilot-commitments-v1.md` (sealed) |
| Model / route | `deepseek-v4-pro` (litellm openai-compatible) |
| Harness | `hit-sdd-bench-e2` @ `c8fe0d5` |
| Subset | feasible subsample of the sealed 40-task pool (≥60-run flake cert is only tractable on small-suite light-dep tasks; sealed-plan permitted) |

## GATE A — feasibility / flake certification: **PASS**

`MechanicalSoup__MechanicalSoup-455`: **60/60 runs completed, 134 tests, 0 flaky, flaky_fraction
0.0000 → CERTIFIED.** The eval tier is deterministic and reproducible across 60 sanitized-container
suite-runs; the oracle is trustworthy for this task. (N=1 flake-certified task — the feasible
subset; heavy-suite pool members deferred.)

## GATE B — contamination / memorization probe: **flags real contamination**

Issue-only file-path identification recall (model names the files to edit from the issue text alone,
no repo):

| Task | hit-rate | note |
| --- | ---: | --- |
| MechanicalSoup-455 | **1.00** | named both gold files exactly (`browser.py`, `form.py`) |
| astronomer/dag-factory-519 | **0.75** | 3 of 4 gold files |
| spulec/freezegun-582 | 0.50 | got `api.py`, missed `CHANGELOG` |
| mlco2/codecarbon-853 | 0.33 | |
| microsoft/graphrag-1944 | 0.00 | (predicted the right area with a doubled `graphrag/graphrag/` prefix → exact-match miss) |

**This empirically confirms the contamination-toward-null risk the deep research flagged.** Despite
all tasks being post-2025-04, DeepSeek localizes the fix from the issue alone at high rates for
popular repos — strong familiarity/memorization. **The post-cutoff date fence alone is insufficient;
GATE B is load-bearing**, exactly as predicted. Critically, **the most-contaminated task is
MechanicalSoup (1.00) — the same task that produced the earlier sub-pilot "false confidence" hint.
That directional signal must therefore be discounted** (it rode on a memorized repo).

## Caveats

- **No negative-control calibration yet.** The plan's threshold is the 95th percentile of a
  post-cutoff negative-control distribution; that control set is not yet built, so no formal
  GATE-B cutoff is applied here — only raw hit-rates. With the original heuristic (>0.6), MechanicalSoup
  (1.00) and dag-factory (0.75) would be excluded.
- The hit-rate scorer is **exact-match strict** (repo-prefix-sensitive), so it **under-flags** (graphrag
  0.00 still localized the area). Real memorization is ≥ what's shown — the gate is conservative.
- Feasible subset, not the full sealed pool.

## Decision & implications

GATE A passes (harness feasible, oracle deterministic). **GATE B works and flags real contamination
in the candidate pool** — the gate doing its job. Before the powered Phase 1.5, the commitments
addendum must: (1) build the negative-control calibration for the GATE-B threshold; (2) **screen the
pool and exclude high-memorization tasks** (and fix the scorer's repo-prefix normalization so it
doesn't under-flag); (3) flake-certify the surviving clean set. The earlier MechanicalSoup signal is
retired as contaminated. Not pooled with E1 or any other E2 run.
