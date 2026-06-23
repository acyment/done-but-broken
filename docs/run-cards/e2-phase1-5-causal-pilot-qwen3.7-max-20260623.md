# Run Card: e2-phase1-5-causal-pilot-qwen3.7-max

Second-model, independent-lineage **controlled replication** of the E2 brownfield acceptance-feedback
ablation, pre-registered in `e2-phase1-pilot-commitments-v1-addendum-c.md`. **Outcome: positive.**

## Provenance

| Field | Value |
| --- | --- |
| Program / phase | E2 Phase-1.5 (powered causal read) |
| Classification | `causal_pilot` |
| Substrate | SWE-bench Live (Addendum B certified set, n=13) |
| Model / route | `qwen3.7-max` (Alibaba Qwen, reasoning), litellm `openai/qwen3.7-max`, DashScope MaaS (EU-central), key `DASHSCOPE_API_KEY` |
| Arms | `control` = file_editor · `treatment` = file_editor + container-backed `run_tests` (only difference) |
| N | 10 runs/arm/task; 260 rollouts total |
| `max_output_tokens` | 16000 (reasoning-model headroom; both arms) |
| Harness | `hit-sdd-bench-e2` @ `f9fc5fa` + qwen-route wiring (`run_phase1_5.py` route registry, `E2_MODEL=qwen`) |
| Artifact | `e2-phase1-5-causal-pilot-qwen3.7-max.json` (SHA-256 `6484243829a5ee36f07dc44c7529807ced312a0f2a39b746fd804fafa4e2ce62`) |
| Gates | GATE-A flake-cert carried from Addendum B; GATE-B contamination re-screened for qwen — CLEAN 13/13 (`e2-qwen3.7-max-contam-screen-n13-20260620-001.json`, SHA `070d18cf…`) |
| Run dates | 2026-06-20 → 2026-06-23 |

## Verdict

| Scope | Verdict | Significant tasks | Family-wise null p |
| --- | --- | --- | --- |
| **n=9 primary** (DeepSeek-comparable, confound-free) | **`candidate_frontier_positive`** | **5/9** | **3.3×10⁻⁵** |
| All-valid (12; black-4684 excluded) | `candidate_frontier_positive` | 6/12 | 1.1×10⁻⁵ |

**Treatment eliminated the self-verification gap to 0% on every task.** Per Addendum C's predeclared
rule, a positive read on this second, independent lineage is **the convergent evidence the program
required to move beyond a single-model candidate** — DeepSeek V4 Pro and qwen 3.7 max now both show the
effect.

### Pooled rates (n=9)

| | self-verification gap | resolve |
| --- | ---: | ---: |
| control | **50%** (45/90) | 37% (33/90) |
| treatment | **0%** (0/89) | 36% (32/89) |

The benefit here is almost **purely diagnostic** (gap 50%→0%) with **resolve flat** (37%→36%) — qwen's
gap concentrates on hard tasks neither arm solves, so feedback **stops confidently-wrong shipping**
rather than solving more. (Contrast DeepSeek, which also roughly doubled resolve; qwen, the stronger
self-verifier, shows the diagnostic half of the gradient.)

## Per-task results (all 13)

| instance | ctl gap | trt gap | ctl resolve | trt resolve | note |
| --- | ---: | ---: | ---: | ---: | --- |
| mlco2__codecarbon-831 | 10/10 | 0/10 | 0/10 | 0/10 | **SIG** (n9) |
| celery__kombu-2300 | 9/10 | 0/10 | 0/10 | 0/10 | **SIG** (n9) |
| pypa__twine-1249 | 9/10 | 0/10 | 0/10 | 0/10 | **SIG** (n9) |
| koxudaxi__datamodel-code-generator-2408 | 6/10 | 0/10 | 0/10 | 0/10 | **SIG** (n9) |
| django-json-api__…-json-api-1283 | 4/10 | 0/10 | 6/10 | 10/10 | **SIG** (n9); generative |
| koxudaxi__datamodel-code-generator-2461 | 3/10 | 0/9 | 1/10 | 0/9 | n9; NS (p=0.13); 1 trt error |
| casbin__pycasbin-392 | 2/10 | 0/10 | 8/10 | 8/10 | n9; NS |
| django-guardian__django-guardian-899 | 2/10 | 0/10 | 8/10 | 4/10 | n9; NS; trt resolves fewer (budget) |
| spulec__freezegun-582 | 0/10 | 0/10 | 10/10 | 10/10 | n9; null (easy/redundant) |
| python-attrs__attrs-1448 | 6/10 | 0/10 | 1/10 | 0/10 | **SIG**; large repo (nav confound) |
| psf__black-4670 | 1/10 | 0/10 | 0/10 | 0/10 | large repo; NS |
| dpkp__kafka-python-2608 | 0/10 | 0/10 | 10/10 | 9/10 | large repo; null (qwen solves both) |
| psf__black-4684 | (0/4) | (0/0) | — | — | **EXCLUDED** — 16 docker-create infra errors, trt n=0 |

(n9 = the nine confound-free small/medium tasks = the primary analysis. attrs/kafka/black are the four
large repos carrying a navigation confound; reported in all-valid only, never as the headline.)

## Validity / replay status

- **Internal consistency: CLEAN** — 243/243 valid records: `gap = declared-done ∧ ¬resolved` holds
  everywhere; `resolved ⇔ all F2P passed` (from stored per-test outcomes); summary + family-wise
  verdict recompute exactly from records.
- **Determinism:** established by the **N=60 flake certification** (Addendum B) of these task suites.
- **Patch-replay: NOT performed** — this run stored patch *hashes* and per-test outcomes but **not the
  patch text** (workspaces were deleted), so independent re-scoring of stored patches is impossible for
  this run. Determinism rests on the flake certification. *(Harness fixed after this run to persist
  patch text → future runs are patch-replay-valid.)*

## Limitations (bound the claim)

- **Bounded** to this model / substrate / budget — not a Level-5 generalized claim. Never pooled with
  the DeepSeek pilot, E1, or across substrate/profile.
- **Smaller effect than DeepSeek** (5/9 vs 8/9 significant; p 3e-5 vs 3e-10): qwen is the stronger
  self-verifier, so its control gaps are lower on easy/medium tasks. Direction identical; magnitude
  more modest.
- **Conservative F2P-only oracle** (likely under-counts the gap) and the **named-check localization
  bundle** (treatment's `run_tests` returns test node-ids → partial localization) remain documented
  construct limitations.
- **Navigation confound** on the four large repos (attrs/kafka/black) — the reason n=9 is the primary.
- **black-4684 excluded** (infra), **datamodel-2461** treatment n=9 (1 errored rollout).

## Interpretation

Executable acceptance feedback reduces frontier false-confidence shipping on brownfield tasks under a
**second independent model lineage** (Alibaba qwen 3.7 max), replicating the DeepSeek V4 Pro candidate.
The two-lineage convergence is the pre-registered bar for moving from single-model candidate toward a
**replicated (still bounded)** finding. Honest framing for downstream docs: *replicated across two
independent lineages; diagnostic effect robust, generative effect model-dependent; bounded to this
task/model/budget; patch-replay pending a future-run harness improvement.*
