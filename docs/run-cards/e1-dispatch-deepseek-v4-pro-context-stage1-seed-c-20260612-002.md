# Run Card: e1-dispatch-deepseek-v4-pro-context-stage1-seed-c-20260612-002

| Field | Value |
| --- | --- |
| Run ID | `e1-dispatch-deepseek-v4-pro-context-stage1-seed-c-20260612-002` |
| Date | 2026-06-12 |
| Task | `e1-dispatch-v1` (12 checkpoints, 141 oracle cases) |
| Classification | `calibration` — Stage 1 difficulty probe; not causal evidence |
| Condition | `context_only_spec` |
| Model / route | `deepseek-v4-pro`, `deepseek-v4-pro-direct` (direct) |
| Grade | `evidence` (sealed task, commitments doc `243febd`) |
| Valid | `invalid_run=false`; replay `valid=true`, 98 steps, 0 mismatches |
| Spend | **$0.257** (cap $3.00) |
| Turns | 98 total; mean **8.2/checkpoint** |

## Aborted first attempt (`-001`)

`e1-dispatch-deepseek-v4-pro-context-stage1-seed-c-20260612-001` was launched at
21:32 and killed after checkpoint 3 by an environment-level failure: an unrelated
desktop process (Codex.app) leaked ~2,000 zombie processes and exhausted the system
process table, so the runner could not fork. Checkpoints 1–3 of `-001` terminated
normally before the kill; the partial run dir is preserved with no top-level bundle.
`-001` is an infrastructure-killed partial with no oracle scoring; `-002` (fresh
workspace, identical flags) is the seed C run of record.

## Stage 1 gate verdict

| Gate | Criterion | Result |
| --- | --- | --- |
| G1 | AUC ≤ 0.92 | **FAIL** — 0.9310 > 0.92 |
| G2 | ≥1 correction CP < 0.75 | **FAIL** — all correction CPs ≥ 0.8871 |
| G3 | Never-pass or flip count > 0 | pass — 10 never-passes |

**Third consecutive ceiling seed for this model** (seed A: 0.9768, seed B: 0.9824).
Per the sealed ladder in `e1-dispatch-v1-deepseek-v4-pro-stage1-plan-v1.md`, three
consecutive ceiling seeds close the dispatch domain for DeepSeek V4 Pro.

## Per-checkpoint cumulative pass rate

| Checkpoint | Type | Turns | Passed/Total | Rate |
| --- | --- | --- | --- | --- |
| CP01 | extension | 10 | 12 / 12 | **1.0000** |
| CP02 | extension | 5 | 18 / 18 | **1.0000** |
| CP03 | extension | 11 | 29 / 30 | 0.9667 |
| CP04 | correction (partially_shipped) | 11 | 40 / 41 | 0.9756 |
| CP05 | extension | 1‡ | 44 / 51 | 0.8627 |
| CP06 | correction (partially_returned) | 11 | 55 / 62 | 0.8871 |
| CP07 | extension | 11 | 67 / 74 | 0.9054 |
| CP08 | correction (cancelled_partial) | 9 | 76 / 84 | 0.9048 |
| CP09 | extension | 12† | 91 / 100 | 0.9100 |
| CP10 | correction (closed) | 2 | 103 / 113 | 0.9115 |
| CP11 | extension (receivables_digest) | 12† | 114 / 124 | 0.9194 |
| CP12 | correction (cancelled_owing) | 3 | 131 / 141 | 0.9291 |

† budget_exhausted
‡ model declared done after a single turn, missing all 7 newly introduced CP05 cases

## Never-pass cases (10)

The familiar carrier-on-non-shipped residual, plus one more carrier correction case
and a 6-case CP05 cluster the single-turn premature done never recovered:

- `cp05-export-with-carrier`
- `cp05-reimport-with-carrier`
- `cp05-export-multi-line-mixed-metadata`
- `cp05-reimport-multi-line-mixed-metadata`
- `cp05-export-carrier-only-on-shipped`
- `cp05-reimport-partial-ship-with-carrier`
- `cp06-export-partial-with-carrier`
- `cp08-export-cancel-with-carrier`
- `cp09-export-refunded-with-carrier`
- `cp10-export-closed-with-carrier`

Zero pass→fail flips.

## Comparison across seeds

| | Seed A | Seed B | Seed C |
| --- | --- | --- | --- |
| Context AUC | 0.9768 | 0.9824 | 0.9310 |
| Mean turns/cp | 8.0 | 8.9 | 8.2 |
| Budget_exhausted CPs | 3 (CP07/09/11) | 2 (CP03/09) | 2 (CP09/11) |
| Never-passes | 8 | 3 | 10 |
| Flips | 0 | 0 | 0 |
| Spend | $0.240 | $0.265 | $0.257 |

Seed C is the weakest of the three but exposes a different variance mechanism than
seeds A/B: instead of budget placement (where the 12-turn cap lands), the loss came
from a premature done declaration — one turn at CP05 left the carrier/mixed-metadata
export cluster unimplemented, and the model never revisited it in later checkpoints
despite having turn budget to spare (CP10: 2 turns, CP12: 3 turns). Monotonicity
held throughout (zero flips).

## Interpretation

Third consecutive ceiling seed: even with the CP05 premature-done loss, the context
arm stays above the 0.92 gate. Per the sealed ladder, **the dispatch domain is closed
for DeepSeek V4 Pro** — the task does not discriminate this model on the context arm.
This is a model-specific ceiling condition under the sealed plan, not evidence that
the task is easy for lower-investment models (Qwen 3.7 Max context arm: 0.7284). The
carrier-on-non-shipped residual remains the only structural context-arm hard limit
common to all DeepSeek seeds; seed C adds that a high-investment model can also leave
a whole introduced cluster behind when it self-assesses done too early, without any
executable feedback to contradict it.
