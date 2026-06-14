# Run Card: e2-phase1-5-flake-smoke-20260614-001

| Field | Value |
| --- | --- |
| Run ID | `e2-phase1-5-flake-smoke-20260614-001` |
| Date | 2026-06-14 |
| Program | E2 brownfield ablation; GATE-A feasibility smoke (pre-certification triage) |
| Classification | `calibration` — feasibility triage, **NOT causal evidence** |
| Harness | `hit-sdd-bench-e2` @ `f1bd931` (+ `flake_smoke.py`) |
| Input | the 13 lightest-suite tasks of the Addendum-A contamination-screened set |
| Method | one gold-patched suite run per task, `network=none`, base eval image, 1500 s timeout |

## Purpose

Before committing the heavy N≥60 flake certification, triage which contamination-screened tasks are
even **runnable** as a clean deterministic oracle: does the image pull, does the gold-patched suite
run offline, and is it green? N=1 (not certification). Ranked lightest-suite-first by P2P.

## Result — feasible clean oracles are scarce under the sealed `network=none` policy

| verdict | n | tasks |
| --- | ---: | --- |
| **clean** (gold suite all-pass, offline) | 2 | `mlco2__codecarbon-831` (114/0, 266 s), `django-json-api__…json-api-1283` (387/0, 120 s) |
| **near-clean** (1 quarantinable failure) | 1 | `koxudaxi__datamodel-code-generator-2461` (711/1, 285 s) |
| **dirty** (non-green gold suite in-container) | 4 | `llama_deploy-500` (10 fail), `twine-1249` (2), `dspy-8607` (21, network), `linkding-1114` (3) |
| **infeasible** (install-time network / timeout) | 6 | `meson-14698` (timeout 1500 s), `a2a-python-443`, `openai-agents-python-1601`, `datamodel-code-generator-2408`, `fastmcp-434`, `fastmcp-455` |

## The dominant blocker: `network=none`

6 of 13 SWE-bench-Live images **install dependencies from PyPI at test time** (errors:
`error sending request for url (https://pypi.org/simple/hatchling/)`, `(Connect)`), so they cannot
run under the sealed offline oracle policy. This is a property of the upstream images, not the task.
A further 4 have a non-green gold suite in-container (2–21 failing tests; cause unverified —
runtime-network tests like dspy's LLM calls, or env/locale). Only **2 (+1 near) of the lightest 13**
present a clean, deterministic, offline oracle.

## Implication

GATE-A under the current sealed parameters yields a **very thin feasible set** — far below the
Phase-1.5 target of n≈20–40. The honest options (decision pending, operator's call):

1. **Thin certified pilot now** — N=60-certify the 2–3 clean tasks (codecarbon, drf-json-api,
   datamodel-2461 after quarantine). Proves GATE-A end-to-end; underpowered for the powered read.
2. **Pre-bake dependencies in the sanitize step** — allow network *during image build*, install deps,
   then seal and run the suite offline. Would likely recover the 6 install-time-network tasks
   (not dspy's runtime-network tests). **Touches the sealed oracle/sanitization policy** → requires a
   new commitments version, not a silent change.
3. **Smoke the heavier 26** — diminishing returns (slower, equally network-exposed).

No certification or policy change is made by this run. The smoke is recorded as calibration only;
the contamination-screened set (Addendum A) is unchanged.
