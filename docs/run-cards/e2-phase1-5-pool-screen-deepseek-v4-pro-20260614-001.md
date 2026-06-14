# Run Card: e2-phase1-5-pool-screen-deepseek-v4-pro-20260614-001

| Field | Value |
| --- | --- |
| Run ID | `e2-phase1-5-pool-screen-deepseek-v4-pro-20260614-001` |
| Date | 2026-06-14 |
| Program | E2 brownfield acceptance-feedback ablation; GATE-B contamination re-screen of the full pool |
| Classification | `calibration` — screening result, **NOT causal evidence** |
| Commitments | `e2-phase1-pilot-commitments-v1.md` + **Addendum A** (this screen, sealed) |
| Model / route | `deepseek-v4-pro` (litellm openai-compatible) |
| Harness | `hit-sdd-bench-e2` @ `f1bd931` |
| Pool | `e2-phase1-5-candidate-pool-v1` (40 frozen instances) |
| Raw JSON SHA-256 | `46f80d1dc586a52988499e1587599cf06dd730323aed050a3f883dbd7bca356b` |

## What this run does

Re-screens the **entire** 40-task candidate pool for memorization (the prior gate run probed only a
5-task subset). Probes are LLM-only (no Docker), so the full pool is in reach. It replaces the
confounded file-path-id probe as the decisive signal with a **verbatim code-continuation** probe and
calibrates it with explicit positive + negative controls.

## GATE B — contamination: **PASS (clean), instrument validated**

- **Positive control — Zen of Python continuation overlap = 1.000.** The probe provably detects
  verbatim memorization of non-reconstructable content; a pool-wide ≈0 is a real null, not a dead probe.
- **Negative control** (cross-task continuation, 756 pairs) is **degenerate (95th pct = 0.000)** — a
  known limitation: different repos share no 5-grams, so it can't see the within-region predictability
  floor. Threshold floored at **0.5**, in the gap between the reconstruction ceiling (max pool overlap
  **0.229**) and the positive-control regime (1.0). **Decision invariant for any floor in [0.3, 1.0).**
- **No pool task shows verbatim memorization** (all ≤ 0.229). The maximum (`vacanza__holidays-2750`,
  0.229) is a repetitive date-table region — predictability, not recall.
- **Secondary file-path id** (precautionary, confounded by reasoning): only `astronomer__dag-factory-519`
  clears the conservative ≥0.75 bar → **precautionarily excluded**.

**Screened clean set: 39 / 40.** Full per-task table + caveats in Addendum A
(`docs/protocols/e2-phase1-pilot-commitments-v1-addendum-a.md`).

## Why this changes the earlier read

The gate run's high file-path hits (MechanicalSoup 1.00, dag-factory 0.75) looked like heavy
contamination. The continuation probe shows that **the pool is essentially free of verbatim
memorization** — strong issue-only file-path recall on popular repos is mostly *reasoning/localization*,
not recall. The post-2025-04 date fence is doing more work than the file-path probe alone suggested.
This does **not** rescue MechanicalSoup-455 (file-path 1.00, and not in this pool); its earlier "false
confidence" hint stays retired.

## Caveats

- **GATE-B only** — flake certification (GATE A) of the 39 is not done; this is not the final task list.
- 7 tasks have no continuation probe (changed region too short to split) → file-path-only screen,
  lower confidence.
- Continuation overlap is a black-box proxy (no perplexity/logprobs membership inference); conflates
  verbatim recall with code predictability, handled by the floored threshold + controls.
- `deepseek-v4-pro`-specific; re-screen if the run model changes. Not pooled with E1 or any other run.

## Decision & next step

GATE B passes with a validated instrument and a sealed 39-task contamination-screened set (Addendum A).
**Next (separately authorized):** GATE-A flake-certify the clean set (≥60 patch-induced runs/task,
upper bound ≤5%), select the feasible certified subset, seal **Addendum B (final task list)**, then
run Phase 1.5.
