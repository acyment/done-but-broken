# Run Card: e2-phase1-5-gate-a-feasibility-20260614-002 (consolidated)

| Field | Value |
| --- | --- |
| Run ID | `e2-phase1-5-gate-a-feasibility-20260614-002` |
| Date | 2026-06-14 |
| Program | E2 brownfield ablation; GATE-A feasibility (offline + dependency-prebake) |
| Classification | `calibration` — feasibility triage, **NOT causal evidence** |
| Harness | `hit-sdd-bench-e2` @ `4a106ad` (prebake) |
| Supersedes (conclusion of) | `e2-phase1-5-flake-smoke-20260614-001` (offline-only triage) |
| Inputs | Addendum-A clean set; offline smoke (13) + prebaked re-smoke (9) + mid-band prebaked (7) = 20 tasks examined |

## What was done

Triaged the contamination-screened tasks for a clean, deterministic, offline oracle. Built the
**dependency-prebake** mechanism (network warm at image-build time only → sealed self-contained image;
run-time stays `network=none` + `UV_OFFLINE=1`, leak policy unchanged) to recover tasks whose images
install deps at test time. One gold-patched run per task (N=1, not certification).

## Result — usable cert-feasible set is small

**Usable (clean / near-clean, offline-runnable, suite small enough for N=60): 6 of 20 examined.**

| instance_id | suite (tests) | gold fail | verdict |
| --- | ---: | ---: | --- |
| `mlco2__codecarbon-831` | 114 | 0 | **clean** |
| `django-json-api__…json-api-1283` | 387 | 0 | **clean** |
| `koxudaxi__datamodel-code-generator-2461` | 714 | 1 | near (quarantine 1) |
| `koxudaxi__datamodel-code-generator-2408` | 681 | 1 | near (quarantine 1) — recovered by prebake (tox) |
| `pypa__twine-1249` | 228 | 2 | near (quarantine 2) |
| `celery__kombu-2300` | 1089 | 1 | near (quarantine 1) |

**Excluded (14):** dirty gold suites (`llama_deploy` 10, `dspy` 21, `linkding` 3, `a2a` 15,
`openai-agents` 22, `fastmcp-455` 6, `SDV` 5, `pymodbus` 32, `beets-5789` 12) or infeasible
(`fastmcp-434` uv-frozen lockfile; `meson` timeout; `beets-5890` test patch won't apply; `pybamm-5129`
/`-5122` heavy warm timeout).

## Prebake worked, but yield was modest

The prebake recovered 4 network-infeasible tasks to **offline-runnable** (a2a, openai-agents,
fastmcp-455, datamodel-2408). But the install-time-network tasks are largely the SAME network-centric
libraries whose **tests make runtime network calls** (a2a, openai-agents, fastmcp) → still dirty after
recovery. Only `datamodel-2408` (a code generator, no runtime network) became usable. Mechanism
validated (`UV_OFFLINE=1` + warmed venv); applicability limited by runtime-network test dirtiness.

## The honest conclusion: the powered n is not reachable from this pool

The Phase-1.5 target is n≈20–40. GATE-A yields **~6 cert-feasible usable tasks**, and examining the
remaining 19 is low-yield: they are almost all **huge suites** (matplotlib 8 k, mdanalysis 20 k,
pyomo 8 k, albumentations 9 k, holidays 5 k, conan 4.5 k, fonttools 4.4 k, freqtrade 3.9 k,
falcon 3.6 k, dvc 3 k, streamlink 6 k) → **N=60 certification is infeasible** regardless of
cleanliness. The few mid-band leftovers (litellm 1829, pyinfra 1201/1208) are network-risk / hang.

**Root cause:** the candidate pool was selected **sorted hardest-first** (by `non_test_files` and
`P2P` descending) to maximize regression surface — which is precisely **anti-correlated with N=60
cert-feasibility**. The small-suite tail that is cert-feasible skews network-centric/dirty.

## Decision (pending operator)

No certification or Addendum B sealed yet. Options:

1. **Re-select a cert-feasibility-oriented pool** (recommended) — re-filter SWE-bench-Live for
   **moderate** suite size (~200–1500 tests), multi-file regression-risk, post-cutoff, non-network
   repos; re-run contamination + smoke; assemble n≈15–25. New commitments version. The path to a real
   powered read.
2. **Thin pilot at n≈6** — N=60-certify the 6 usable, run Phase-1.5 underpowered/exploratory. By the
   sealed asymmetric single-model rule a null is inconclusive; n=6 is exploratory, not a powered win.
3. **Relax N=60** — lower the flake-cert bar to admit some heavier suites. Protocol change; weakens
   the determinism guarantee.
