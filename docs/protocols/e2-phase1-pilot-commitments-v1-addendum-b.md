# E2 Phase-1 Commitments — Addendum B: final flake-certified task list

Date: 2026-06-15. Addendum to `e2-phase1-pilot-commitments-v1.md` (per its Rules §"the final
flake-certified + contamination-screened task list … is sealed as a commitments addendum hashed
here"). This seals the **final Phase-1.5 task list**: the tasks that pass GATE-A (feasibility),
GATE-B (contamination), **and** GATE-A flake certification (N=60, patch-induced flake ≤5%). Built on
candidate **pool v2** (`e2-phase1-5-candidate-pool-v2-supersession-v1.md`, which supersedes v1).

Classification: `calibration` (gates). The Phase-1.5 run itself is `causal_pilot`, **not yet run**,
and fires only under explicit operator authorization.

## Provenance

| Field | Value |
| --- | --- |
| Harness | `hit-sdd-bench-e2` @ `bed6d2b` (cert run; prebake + per-task disk reclaim) |
| Pool | `e2-phase1-5-candidate-pool-v2.json` (SHA `96be2835397a626f98dba85bc0090cf66ff2b51b915a4434d397ac43d5af698c`) |
| GATE-A (feasibility) | `e2-phase1-5-gate-a-poolv2-20260615-001` |
| GATE-B (contamination) | Addendum A (6 v1-validated) + `e2-phase1-5-gateb-poolv2-new-deepseek-v4-pro-20260615-001` (10 new) |
| Flake cert | `e2-phase1-5-flake-certify-poolv2-20260615-001.json`, SHA `813c49448678461098bedfc6a527e0b550fad90af613b1ee813d29a3da6d2ba6` |

## Final certified task list (n = 13)

All 13 ran the gold-patched suite **60/60** times in the sanitized+prebaked container; all
flake-certified (flaky fraction ≤ 5%; flaky tests quarantined).

| instance_id | tests | runs | flaky | flake frac | cert wall |
| --- | ---: | ---: | ---: | ---: | ---: |
| spulec__freezegun-582 | 144 | 60/60 | 0 | 0.0000 | 3.9 m |
| pypa__twine-1249 | 228 | 60/60 | 0 | 0.0000 | 3.3 m |
| casbin__pycasbin-392 | 300 | 60/60 | 1 | 0.0033 | 3.8 m |
| django-guardian__django-guardian-899 | 295 | 60/60 | 0 | 0.0000 | 42.9 m |
| django-json-api__django-rest-framework-json-api-1283 | 387 | 60/60 | 0 | 0.0000 | 22.8 m |
| psf__black-4684 | 441 | 60/60 | 0 | 0.0000 | 91.2 m |
| psf__black-4670 | 442 | 60/60 | 0 | 0.0000 | 85.8 m |
| koxudaxi__datamodel-code-generator-2408 | 681 | 60/60 | 0 | 0.0000 | 24.6 m |
| koxudaxi__datamodel-code-generator-2461 | 714 | 60/60 | 0 | 0.0000 | 25.2 m |
| celery__kombu-2300 | 1089 | 60/60 | 0 | 0.0000 | 42.8 m |
| mlco2__codecarbon-831 | 114 | 60/60 | 0 | 0.0000 | 130.5 m |
| python-attrs__attrs-1448 | 1331 | 60/60 | 0 | 0.0000 | 18.2 m |
| dpkp__kafka-python-2608 | 1465 | 60/60 | 0 | 0.0000 | 16.4 m |

**Quarantined flaky tests** (excluded from the scored set):
`casbin__pycasbin-392::tests/test_fast_enforcer.py::TestFastEnforcer::test_performance` (timing-sensitive).

## Scoring quarantine (non-green-under-gold)

A few tasks had a small number of tests that fail **deterministically** under the gold patch in our
container (env-sensitive, not flaky; e.g. twine 2, datamodel 1 in the GATE-A smoke). These are not
flake — they fail in all 60 runs — but they are not valid `PASS_TO_PASS` here. The oracle scores only
tests that **pass under gold** (F2P + passing P2P); deterministically-failing tests are excluded from
the scored regression surface, the same way quarantined flaky tests are.

## Deferred (GATE-A/B-clean, not yet flake-certified)

3 tasks pass GATE-A∩GATE-B but were not certified (slow per-run; N=60 marginal): `ipython-14966`,
`Lightning-AI__LitServe-577`, `PyPSA__PyPSA-1325`. They may be certified later to extend n; not part
of this sealed list.

## Status

**Sealed. n = 13 flake-certified, contamination-screened, brownfield tasks** — the experiment is fully
gated. What remains is the **Phase-1.5 causal run** (control vs treatment, N=10 runs/arm/task,
one-sided permutation test per the sealed plan `e2-phase1-5-plan-v1.md`), which fires only under
explicit operator authorization with a spend cap. By the sealed asymmetric single-model rule, a
positive is candidate-frontier-positive evidence; a single-model null is inconclusive.
