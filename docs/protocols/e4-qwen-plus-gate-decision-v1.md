# E4 gate decision — pilot model change to qwen-plus (v1)

**Date:** 2026-07-08. **Operator directive:** "Qwen-plus" (this session), selecting among the
recorded M7 path-forward options after the flash-tier pilot returned
`inconclusive_uninterpretable` (`instrument_degraded`). The directive is recorded as (a) the model
decision and (b) spend authorization for the two runs this gate implies: one re-ratification
calibration and one pilot rerun (both single-digit dollars; live prices verified 2026-07-08:
qwen-plus ≈ $0.26–0.40/M input, $0.78–1.20/M output).

## Decision

1. **The brief's "Devstral-class (mid/cheap tier)" is realized as `qwen-plus`** (Alibaba Model
   Studio, served to this estate via the EU MaaS workspace endpoint in `.env`
   `MODEL_LOOP_ENDPOINT`; probe-verified; `enable_thinking: false` via request extras;
   DASHSCOPE_API_KEY). Rationale: genuinely mid-tier, agent-capable, one of the estate's
   characterized lineages (E2/E3), cheapest of the live-priced band, zero key friction. A true
   Devstral run remains available under a future gate if naming fidelity is ever worth the key.
2. **The v0 constants budget freeze is reopened for exactly ONE ratification** on qwen-plus (the
   M6.5 model-id pin: budgets transfer only on the same model id). Procedure identical to M6.5:
   one full-length 6-task Arm-H calibration sequence, `run_classification: calibration`,
   non-evidence, adjust-once from observed appetite, then re-freeze as **v0.7** with a new
   pinned full-file hash. No non-budget field changes (the M6 projection hash must hold).
3. **Calibration seed stays 45** — deliberately the same draw the flash calibration used, giving a
   direct two-model appetite comparison on identical tasks; seed 45 remains excluded from all
   pilots. Pilot seeds will be fresh (≠ 45/46/49) and declared in pre-registration v2 before
   launch, along with the trigger-2 `spec_touch` split and the arm-level workspace-breakage-rate
   secondary carried from the flash pilot's findings.

## Ratification result (2026-07-09, run executed, $0.54)

Run `calibration-pair-calibration-seed-45-e4_arm_h` (qwen-plus, provenance
`docs/protocols/e4-m65b-qwen-calibration-manifest-20260709-001.json`, chain_replay_valid): the
v0.6 budgets bound again — turn wall 18 hit twice (oracles 21/22, 19/21), token wall 324,954 >
310,000, verification budget saturated 8/8 on four tasks. Adjust-once (report formula):
**turns 18→27, verifications 8→12, token_budget 310k→490k, spend cap $5 unchanged. Constants
v0.7, full-file sha256 `b4d2e9df5c0ae0952ccc5aedcd5655b04a0e3fccf96b7110d5989893ef3781a9`** —
the hash every qwen-plus pilot manifest must stamp. The M6 non-budget projection hash held
unchanged through this second ratification.

Two observations recorded for the pilot report: (i) qwen-plus walls on the SAME seed-45 late
tasks as flash, 1–2 checks short each time — a task-property signature (stubborn or subtly
ambiguous checks), which the enlarged headroom lets the pilot disambiguate (budget-starved vs
genuinely unreachable); (ii) 30 done-over-red refusals — qwen-plus DOES repeatedly claim done
over red under hard tasks, contradicting the B1-study-derived expectation that its done-claims
are near-always earned; c2 may be livelier at pilot than predicted.
