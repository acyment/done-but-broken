# E2 Phase-1 Commitments — Addendum A: GATE-B contamination screen

Date: 2026-06-14. Addendum to `e2-phase1-pilot-commitments-v1.md` (per its Rules §"the final
flake-certified + contamination-screened task list … is sealed as a commitments addendum hashed here,
with the actual instance IDs and their GATE A/B results"). This addendum seals the **GATE-B
(contamination) screen** of the frozen 40-task candidate pool. **GATE-A flake certification of the
surviving set is a separate, still-pending step** (see §Status) — this addendum is *not* the final
flake-certified list.

Classification: `calibration` — a gate/screening result, **NOT causal evidence**.

## Provenance

| Field | Value |
| --- | --- |
| Run ID | `e2-phase1-5-pool-screen-deepseek-v4-pro-20260614-001` |
| Model / route | `deepseek-v4-pro`, litellm openai-compatible, `https://api.deepseek.com/v1` (key never published) |
| Harness | `hit-sdd-bench-e2` @ `f1bd931` |
| Screened pool | `e2-phase1-5-candidate-pool-v1.json` (40 instances, sealed) |
| Raw result JSON (in harness repo) | SHA-256 `46f80d1dc586a52988499e1587599cf06dd730323aed050a3f883dbd7bca356b` |

## GATE-B instrument (primary): verbatim code-continuation probe

The original issue-only **file-path-id** probe conflates *reasoning* (a strong model localizes a fix
from a well-written issue) with *memorization*, so it cannot decisively detect contamination. The
load-bearing signal is therefore a **verbatim code-continuation** probe (membership inference without
logprobs): the model is given the exact prefix of a changed source region and asked to continue it.
A model that **memorized** the file continues verbatim (high n-gram overlap with the held-out
suffix); a model seeing the repo fresh writes plausible-but-different code (low overlap). Verbatim
recall is something reasoning cannot fake.

- **Positive control (instrument sensitivity): Zen of Python continuation overlap = 1.000.** The probe
  provably fires on genuinely-memorized, non-reconstructable content. A pool-wide ≈0 is therefore a
  real null, not a broken instrument.
- **Negative control:** each task's continuation scored against *every other* task's suffix
  (756 cross pairs). This cross-repo null is **degenerate (95th pct = 0.000)** — different repos share
  almost no 5-grams — so it cannot see the within-region *predictability* floor (idiomatic code
  continues predictably without memorization). The verbatim threshold is therefore **floored at 0.5**,
  in the wide gap between the observed reconstruction ceiling (max pool overlap **0.229**) and the
  positive-control regime (1.000). **The exclusion decision is invariant for any floor in [0.3, 1.0).**

**Result: no pool task shows verbatim memorization** (every task ≤ 0.229 ≪ 0.5; the maximum,
`vacanza__holidays-2750` at 0.229, is a highly repetitive date-table region — predictability, not
recall). The earlier sub-pilot `MechanicalSoup-455` "false confidence" hint stays retired as the
most-memorized task (file-path 1.00 in the gate run); it is not in this pool.

## Secondary signal (precautionary): issue-only file-path id

File-path recall is reported as a *precautionary* familiarity signal only. One task clears the
conservative ≥0.75 bar and is excluded **precautionarily** (confounded by reasoning; not evidence of
memorization): `astronomer__dag-factory-519` (0.75).

## Sealed contamination-screened set (39 of 40)

Excluded: `astronomer__dag-factory-519` (precautionary, high file-path localization 0.75).

`* ` = continuation probe N/A (changed region too short to split into prefix + ≥15-token suffix);
screened on file-path recall only (all low). 7 such tasks, all retained.

| instance_id | file_path recall | continuation overlap | decision |
| --- | ---: | ---: | --- |
| beetbox__beets-5890 | 0.08 | 0.014 | clean |
| mlco2__codecarbon-831 | 0.00 | 0.143 | clean |
| Pyomo__pyomo-3633 | 0.08 | 0.033 | clean |
| koxudaxi__datamodel-code-generator-2408 | 0.17 | 0.000 | clean |
| jlowin__fastmcp-434 | 0.18 | 0.000 | clean |
| pyinfra-dev__pyinfra-1413 | 0.30 | 0.000 | clean |
| vacanza__holidays-2751 | 0.12 | n/a* | clean |
| beetbox__beets-5789 | 0.12 | 0.000 | clean |
| vacanza__holidays-2750 | 0.14 | 0.229 | clean |
| falconry__falcon-2498 | 0.29 | n/a* | clean |
| pybamm-team__PyBaMM-5129 | 0.43 | 0.000 | clean |
| mesonbuild__meson-14698 | 0.43 | 0.200 | clean |
| pymodbus-dev__pymodbus-2665 | 0.00 | 0.051 | clean |
| matplotlib__matplotlib-30359 | 0.20 | 0.000 | clean |
| pybamm-team__PyBaMM-5122 | 0.20 | 0.000 | clean |
| jlowin__fastmcp-455 | 0.40 | 0.000 | clean |
| koxudaxi__datamodel-code-generator-2461 | 0.20 | 0.000 | clean |
| a2aproject__a2a-python-443 | 0.00 | 0.152 | clean |
| fonttools__fonttools-3874 | 0.25 | 0.000 | clean |
| freqtrade__freqtrade-11974 | 0.25 | 0.030 | clean |
| falconry__falcon-2477 | 0.25 | 0.000 | clean |
| iterative__dvc-10856 | 0.25 | 0.026 | clean |
| BerriAI__litellm-12281 | 0.50 | 0.000 | clean |
| sdv-dev__SDV-2523 | 0.25 | 0.000 | clean |
| pyinfra-dev__pyinfra-1409 | 0.25 | n/a* | clean |
| celery__kombu-2300 | 0.00 | 0.000 | clean |
| sissbruecker__linkding-1114 | 0.50 | 0.000 | clean |
| openai__openai-agents-python-1601 | 0.00 | 0.000 | clean |
| stanfordnlp__dspy-8607 | 0.25 | n/a* | clean |
| django-json-api__django-rest-framework-json-api-1283 | 0.25 | 0.000 | clean |
| pypa__twine-1249 | 0.25 | 0.000 | clean |
| run-llama__llama_deploy-500 | 0.00 | n/a* | clean |
| MDAnalysis__mdanalysis-5066 | 0.33 | 0.047 | clean |
| albumentations-team__albumentations-2552 | 0.33 | 0.067 | clean |
| matplotlib__matplotlib-30198 | 0.33 | 0.000 | clean |
| streamlink__streamlink-6544 | 0.33 | n/a* | clean |
| fonttools__fonttools-3907 | 0.33 | n/a* | clean |
| conan-io__conan-18334 | 0.33 | 0.000 | clean |
| falconry__falcon-2459 | 0.33 | 0.000 | clean |
| **astronomer__dag-factory-519** | **0.75** | 0.027 | **EXCLUDED (precautionary)** |

## Honest limitations

- **GATE-B only.** Contamination screened; flake-certification (GATE A) of these 39 is **not done**.
- **Continuation probe N/A for 7 tasks** (short changed region) — those rest on the confounded
  file-path signal alone; treat their contamination clearance as lower-confidence.
- The continuation overlap conflates verbatim recall with code *predictability*; the floored threshold
  + positive/negative-control separation handle this, but the metric is a black-box proxy (no
  perplexity/logprobs membership inference).
- `deepseek-v4-pro` only. A clearance here is model-specific; re-screen if the run model changes.

## Status

**GATE-B contamination screen: sealed.** 39 contamination-screened tasks; 1 precautionary exclusion.
**Remaining before Phase-1.5:** flake-certify (≥60 patch-induced runs/task, upper bound ≤5%) the
clean set, select the feasible certified subset, and seal it as **Addendum B (final task list)**. No
Phase-1.5 run fires without that addendum and explicit operator authorization.
