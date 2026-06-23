# E2 Phase-1 Commitments — Addendum C: second-model replication (qwen 3.7 max)

Date: 2026-06-20. Addendum to `e2-phase1-pilot-commitments-v1.md`. This seals the **pre-registered
second-model controlled replication** of the E2 Phase-1.5 acceptance-feedback ablation, run on a
model of an **independent lineage** from the original DeepSeek V4 Pro pilot.

This replication is the explicit next step named in the proto-paper
(`docs/papers/e2-executable-feedback-protopaper-v1.md` §7–8: "a second, independent-lineage
replication is pre-registered before any general claim") and in the sealed analysis plan
(`e2-phase1-5-plan-v1.md` §"Asymmetric single-model rule": "a null read must be bracketed with ≥2
models of differing self-verification strength").

Classification: GATE-B re-screen here is `calibration`. The replication run itself is `causal_pilot`,
**not yet run**, and fires only under explicit operator authorization with a spend cap.

## What changes vs. the DeepSeek pilot — and what does not

The **only** intended causal change from the sealed DeepSeek pilot is the **model**. Everything else
is held fixed: substrate (SWE-bench Live), task list (Addendum B, n=13), arms (`control` = file_editor;
`treatment` = + container-backed `run_tests`), scaffold (OpenHands), primary metric (self-verification
gap), N=10 runs/arm/task, the per-task one-sided permutation test, the family-wise error budget, and
the MCID ≥ 0.20. This run is a **new compatibility boundary** and is **never pooled** with the DeepSeek
pilot, with E1, or across substrate/profile.

| Gate | Model-relative? | Status for qwen |
| --- | --- | --- |
| GATE-A flake certification (N=60 patch-induced suite runs, ≤5% flaky, quarantine) | **No** — suite determinism in the container is agent-independent | **Carried over from Addendum B** (the certified n=13 + the `pycasbin-392` quarantined flaky test stand unchanged). |
| GATE-B contamination / memorization | **Yes** — "post-cutoff" and verbatim recall are relative to the model's training data | **Re-run for qwen 3.7 max** (this addendum). |

## Frozen model / route

| Field | Value |
| --- | --- |
| Model | `qwen3.7-max` (Alibaba Qwen; reasoning model) |
| litellm id | `openai/qwen3.7-max` (OpenAI-compatible handler + custom `base_url`) |
| Endpoint (`base_url`) | `https://ws-5dm04o3gxwrj8eud.eu-central-1.maas.aliyuncs.com/compatible-mode/v1` (operator's DashScope Model-Studio dedicated deployment, EU-central; `MODEL_LOOP_ENDPOINT` in `.env`) |
| Key env | `DASHSCOPE_API_KEY` (operator's; route id recorded, key never published) |
| Connectivity | verified 2026-06-20 (1-call litellm smoke returned clean output; route emits reasoning tokens) |
| `max_output_tokens` | **16000** (override `E2_LLM_MAX_OUT`) — raised from the DeepSeek pilot's 4096 because qwen is a reasoning model whose reasoning tokens share the output budget; 4096 risks truncating a tool call mid-turn. Applies to **both arms equally**, so the within-model causal contrast is unbiased. Operator-confirmable. |
| `temperature` / `timeout` / `num_retries` | 0.0 / 300s / 3 (scaffold defaults, identical to the DeepSeek pilot) |
| Thinking/reasoning | left **on** (model's production default) — the replication tests the frontier model as it ships |
| Harness | `hit-sdd-bench-e2` @ `f9fc5fa` + the qwen-route wiring patch to `examples/run_phase1_5.py` (frozen route registry, `E2_MODEL=qwen`, `DASHSCOPE_API_KEY` auth gate) |
| Run id | `e2-phase1-5-causal-pilot-qwen3.7-max` |

Lineage note: qwen 3.7 max and DeepSeek V4 Pro are independent lineages, satisfying the
"independent-lineage" requirement. Self-verification disposition: qwen 3.7 max ceilinged E1's small,
fully-specified refactoring tasks (billing-v2 AUC 0.9361, billing-v3 0.9628; a strong self-verifier on
small tasks). A clean read on brownfield scale is therefore informative either way; per the asymmetric
rule, interpretation is recorded below.

## GATE-B contamination re-screen (qwen 3.7 max)

Method (identical instrument to Addendum A / the DeepSeek screen, `examples/screen_pool.py`, model
swapped via the same monkeypatch seam as `_screen_flash_n9.py`): primary = verbatim
code-continuation membership-inference probe (feed the exact prefix of the largest changed source
hunk, score n-gram overlap n=5 vs the held-out suffix); positive control = the Zen of Python
(definitely-memorized, must fire); negative control = cross-task continuation overlaps (idiom/chance
floor), threshold = max(95th percentile, 0.5 absolute floor); precautionary secondary = issue-only
file-path identification recall ≥ 0.75.

Driver: `examples/_screen_qwen_n13.py`; pool: `e2-qwen-screen-pool-n13.json` (the Addendum B n=13).

<!-- GATE-B-RESULT:BEGIN -->
**Result — CLEAN, 13/13 (run 2026-06-20).** No memorization detected for qwen 3.7 max on any
certified task.

| Field | Value |
| --- | --- |
| Artifact | `e2-qwen3.7-max-contam-screen-n13-20260620-001.json` (SHA-256 `070d18cfcacfee327533f134951a5f5f4207d9aa79fddf133d008a125dfd507d`) |
| Classification | `calibration` |
| Positive control (Zen of Python) | continuation overlap **1.000** → instrument **sensitive** (it fires on real memorization) |
| Negative control | cross-task 95th-pct = 0.000 (degenerate, as expected); absolute floor 0.5; **threshold applied = 0.500** (72 cross-pairs) |
| Max verbatim continuation overlap (any task) | **0.391** (`datamodel-code-generator-2461`) — below the 0.500 threshold |
| Max file-path-id recall (any task) | **0.50** — below the 0.75 precautionary bar |
| Excluded (verbatim memorized) | **none** |
| Excluded (high localization) | **none** |
| Clean set | **13 / 13** (all of Addendum B) |

Interpretation: qwen 3.7 max cannot continue any task's changed source region verbatim and cannot
identify the edit targets from the issue text alone above chance/idiom — consistent with the tasks
being effectively post-cutoff / unseen for this model, the same standard the DeepSeek pilot met. GATE-B
passes; the full n=13 carries to the replication with no exclusions.
<!-- GATE-B-RESULT:END -->

## Final replication task list

**n = 13 — the full Addendum B certified list** (the qwen GATE-B re-screen excluded none). Identical
to the DeepSeek pilot's certified input; `casbin__pycasbin-392`'s flaky `test_performance` stays
quarantined (carried from Addendum B). The replication runs all 13.

## Analysis criterion (inherited, unchanged)

Per `e2-phase1-5-plan-v1.md`, unchanged: primary = self-verification-gap rate (declared-done AND
oracle-would-fail), unit task-run; N=10 runs/arm/task; per-task one-sided exact/permutation test;
family-wise correction with error budget P(k | arm-independent-flake null) ≤ 0.05; predeclared MCID
≥ 0.20 absolute mean gap-rate reduction (treatment vs control); a result may not be driven by a
single unreproduced flaky task (replay must confirm). Secondary: resolve-rate delta. Tertiary: P2P
regression count (logged).

## Replication interpretation rule (predeclared)

- **Positive** (criterion met) on qwen 3.7 max → a **second independent-lineage controlled positive**;
  with the DeepSeek candidate, this is the convergent evidence the program required to move beyond a
  single-model candidate. Still bounded to this model/substrate/budget; never a Level-5 generalised
  claim without the broader ladder.
- **Null** (criterion not met, clean) → the two models disagree; report both, do not average, and
  treat the cross-model picture (one positive, one null) as the honest, still-open state. Per the
  asymmetric rule, a clean qwen null does not retract the DeepSeek candidate; it bounds generality.
- **Structural failure** (flake/contamination/protocol stalls, or reasoning-token truncation of tool
  calls dominates) → no claim; record and redesign. See the operational note on `max_output_tokens`
  for a reasoning model in the readiness checklist.

## Operational note — qwen is a reasoning model (cost/time/feasibility)

Measured 2026-06-20 on this endpoint: generation throughput is healthy (~54 completion-tok/s; not a
provider bottleneck), but qwen 3.7 max emits very large reasoning traces (≈5,300 reasoning tokens for
a trivial prompt), making each call ~100 s and reasoning-token-heavy. Implications for the powered run:
(a) **cost** — reasoning tokens bill as output; 260 rollouts × up to 60 agent iterations is a large
output-token budget; (b) **time** — the dry ~13 h estimate assumed faster turns; expect substantially
longer at `--agent-cc 4`; (c) **truncation** — mitigated by `max_output_tokens=16000` (both arms).
Decision recorded above: reasoning left **on** (model as it ships). The operator may instead cap/disable
thinking before the powered run if cost/time is binding — that would be a recorded route change, applied
to both arms.

## Status

**GATE-A carried (model-independent); GATE-B re-screen CLEAN 13/13; route wired + connectivity-verified;
analysis criterion frozen; n=13 sealed.** The experiment is fully gated for qwen 3.7 max. The only
remaining step is the **qwen 3.7 max Phase-1.5 causal run** (control vs treatment), which fires solely
under explicit operator authorization with a spend cap. A 1-task integration smoke
(`e2-phase1-5-qwen3.7-max-SMOKE-...`) precedes the powered run and is not evidence.
