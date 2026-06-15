# Run Card: e2-phase1-5-gateb-poolv2-new-deepseek-v4-pro-20260615-001

| Field | Value |
| --- | --- |
| Run ID | `e2-phase1-5-gateb-poolv2-new-deepseek-v4-pro-20260615-001` |
| Date | 2026-06-15 |
| Program | E2 brownfield ablation; GATE-B contamination screen of the pool-v2 GATE-A-new usable tasks |
| Classification | `calibration` — screening result, **NOT causal evidence** |
| Model / route | `deepseek-v4-pro` (litellm openai-compatible) |
| Harness | `hit-sdd-bench-e2` @ `334827f` |
| Input | the 10 GATE-A-usable tasks new in pool v2 (the 6 v1-validated are already GATE-B-clean in Addendum A) |

## Result — all 10 clean

- **Positive control (Zen of Python) continuation overlap = 1.000** → instrument sensitive.
- **No verbatim memorization:** every task's continuation overlap is 0.0 (attrs, kafka-python,
  black-4684, ipython-14966, LitServe) or N/A (freezegun, pycasbin, django-guardian, black-4670, PyPSA
  — changed region too short to split; screened on file-path only).
- **file-path recall ≤ 0.5** for all (attrs 0.33; freezegun/kafka-python/black/ipython 0.5;
  pycasbin/django-guardian/LitServe/PyPSA 0.0) — below the 0.75 precautionary bar.
- **Excluded: none** (verbatim memorized: 0; high localization: 0).

| instance_id | file-path | continuation | verdict |
| --- | ---: | ---: | --- |
| spulec__freezegun-582 | 0.50 | n/a | clean |
| casbin__pycasbin-392 | 0.00 | n/a | clean |
| python-attrs__attrs-1448 | 0.33 | 0.0 | clean |
| dpkp__kafka-python-2608 | 0.50 | 0.0 | clean |
| django-guardian__django-guardian-899 | 0.00 | n/a | clean |
| psf__black-4684 | 0.50 | 0.0 | clean |
| psf__black-4670 | 0.50 | n/a | clean |
| ipython__ipython-14966 | 0.50 | 0.0 | clean |
| Lightning-AI__LitServe-577 | 0.00 | 0.0 | clean |
| PyPSA__PyPSA-1325 | 0.00 | n/a | clean |

## Combined gate status (pool v2)

**16 tasks pass GATE-A (feasibility) ∩ GATE-B (contamination):** the 6 v1-validated
(codecarbon-831, drf-json-api-1283, datamodel-2461, datamodel-2408, twine-1249, kombu-2300) + these 10.

## Caveat & next

5 of 10 lack a continuation probe (short changed region) → contamination clearance rests on the
file-path signal alone for those (lower confidence; all ≤0.5). `deepseek-v4-pro`-specific.

**Next:** flake-certify (N≥60) the cert-fast subset of the 16 → seal **Addendum B (final task list)**
→ Phase-1.5. No causal run without Addendum B + operator authorization.
