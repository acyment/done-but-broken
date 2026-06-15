# Run Card: e2-phase1-5-gate-a-poolv2-20260615-001

| Field | Value |
| --- | --- |
| Run ID | `e2-phase1-5-gate-a-poolv2-20260615-001` |
| Date | 2026-06-15 |
| Program | E2 brownfield ablation; GATE-A feasibility on candidate pool **v2** |
| Classification | `calibration` — feasibility triage, **NOT causal evidence** |
| Harness | `hit-sdd-bench-e2` @ `1ead4c3` (prebake + per-task disk reclaim) |
| Pool | `e2-phase1-5-candidate-pool-v2` (37; supersession doc SHA `96be2835…`) |
| Method | per task: sanitize + networked dependency-warm (build only) → offline gold run (`network=none`, `UV_OFFLINE=1`); fail-fast 600 s; `docker rmi` per task |

## Result — n is now reachable

**Usable (clean / near-clean with a real suite, offline-runnable, N=60-feasible): ~16 of 37.**

**6 pre-validated (v1, already GATE-B-clean in Addendum A):** codecarbon-831, drf-json-api-1283,
datamodel-code-generator-2461, datamodel-code-generator-2408, twine-1249, kombu-2300.

**10 new (GATE-A pass; GATE-B pending):**

| instance_id | tests | gold fail | wall | note |
| --- | ---: | ---: | ---: | --- |
| spulec__freezegun-582 | 144 | 0 | 9 s | clean (re-capture to JSON) |
| casbin__pycasbin-392 | 300 | 0 | 27 s | clean |
| python-attrs__attrs-1448 | 1331 | 0 | 74 s | clean |
| dpkp__kafka-python-2608 | 1565 | 0 | 93 s | clean |
| django-guardian__django-guardian-899 | 295 | 0 | 105 s | clean |
| psf__black-4684 | 441 | 0 | 174 s | clean |
| psf__black-4670 | 442 | 0 | 181 s | clean |
| ipython__ipython-14966 | 1289 | 0 | 393 s | clean (slow; N=60 marginal) |
| Lightning-AI__LitServe-577 | 280 | 0 | 1066 s | clean (slow; N=60 marginal) |
| PyPSA__PyPSA-1325 | 695 | 2 | 1122 s | near (slow; N=60 marginal) |

~13 are cert-fast (wall < 200 s incl. warm); 3 are slow (ipython, LitServe, PyPSA).

## Why v2 worked where v1 didn't

v1 (hardest-first) yielded ~6 usable; v2 (cert-feasible suite band, diverse non-network repos) yields
~16. The dirty/infeasible exclusions were overwhelmingly **network/DB libraries** whose tests need
live services (patroni 137–138 fails, mcp-atlassian 111, mcp-context-forge 83, octodns 15, pyinfra
6–11, electrum/slack-sdk 3) or **collection/config failures** (authlib, conan, llama-stack collected
≈1 test; drf-json-api-1301 Django-path; cibuildwheel patch-apply) or **missing images**
(codecarbon-853) / **slow-warm timeouts** (django-stubs, ipython-14943). The self-contained compute
libraries the re-selection targeted (black, attrs, kafka-python, freezegun, pycasbin, django-guardian,
ipython) came back clean — confirming the selection thesis.

## Operational note (disk incident)

The first v2 pass pulled a multi-GB image per task without cleanup and filled the host disk (~93%
full beforehand), crashing the OrbStack VM. Recovered by removing only this session's 49 images
(user images untouched); driver fixed to `docker rmi` per task + abort below 8 GiB free. Re-smoke ran
clean (disk recovered to 94 GiB free). The first pass's results were disk-full artifacts and discarded;
freezegun/dbbackup/graphrag from its early (pre-crash) portion were captured via monitor only.

## Next

1. **GATE-B** contamination screen the 10 new usable tasks (continuation probe + Zen positive control).
2. **Flake-certify** (N≥60) the GATE-A∩GATE-B survivors; prefer the ~13 cert-fast tasks.
3. Seal **Addendum B** (final task list) → Phase-1.5. No causal run without Addendum B + authorization.
