# Run Card: e1-dispatch-deepseek-v4-pro-context-stage1-seed-b-20260612-001

| Field | Value |
| --- | --- |
| Run ID | `e1-dispatch-deepseek-v4-pro-context-stage1-seed-b-20260612-001` |
| Date | 2026-06-12 |
| Task | `e1-dispatch-v1` (12 checkpoints, 141 oracle cases) |
| Classification | `calibration` — Stage 1 difficulty probe; not causal evidence |
| Condition | `context_only_spec` |
| Model / route | `deepseek-v4-pro`, `deepseek-v4-pro-direct` (direct) |
| Grade | `evidence` (sealed task, commitments doc `243febd`) |
| Valid | `invalid_run=false`; replay `valid=true`, 107 steps, 0 mismatches |
| Spend | **$0.265** (cap $3.00) |
| Turns | 107 total; mean **8.9/checkpoint** |

## Stage 1 gate verdict

| Gate | Criterion | Result |
| --- | --- | --- |
| G1 | AUC ≤ 0.92 | **FAIL** — 0.9824 > 0.92 |
| G2 | ≥1 correction CP < 0.75 | **FAIL** — all CPs ≥ 0.9667 |
| G3 | Never-pass or flip count > 0 | pass — 3 never-passes |

**Second consecutive ceiling seed for this model** (seed A: 0.9768). Per the sealed
ladder in `e1-dispatch-v1-deepseek-v4-pro-stage1-plan-v1.md`, seed C runs next;
three consecutive ceiling seeds close the dispatch domain for this model.

## Per-checkpoint cumulative pass rate

| Checkpoint | Type | Turns | Passed/Total | Rate |
| --- | --- | --- | --- | --- |
| CP01 | extension | 9 | 12 / 12 | **1.0000** |
| CP02 | extension | 6 | 18 / 18 | **1.0000** |
| CP03 | extension | 12† | 29 / 30 | 0.9667 |
| CP04 | correction (partially_shipped) | 6 | 40 / 41 | 0.9756 |
| CP05 | extension | 11 | 50 / 51 | 0.9804 |
| CP06 | correction (partially_returned) | 10 | 61 / 62 | 0.9839 |
| CP07 | extension | 8 | 73 / 74 | 0.9865 |
| CP08 | correction (cancelled_partial) | 7 | 83 / 84 | 0.9881 |
| CP09 | extension | 12† | 98 / 100 | 0.9800 |
| CP10 | correction (closed) | 9 | 110 / 113 | 0.9735 |
| CP11 | extension (receivables_digest) | 9 | 121 / 124 | 0.9758 |
| CP12 | correction (cancelled_owing) | 8 | 138 / 141 | 0.9787 |

† budget_exhausted

## Never-pass cases (3)

Carrier on non-shipped states only — the same 3-case residual as every Qwen run and
seed A:
- `cp06-export-partial-with-carrier`
- `cp09-export-refunded-with-carrier`
- `cp10-export-closed-with-carrier`

Zero pass→fail flips.

## Comparison with seed A

| | Seed A | Seed B |
| --- | --- | --- |
| Context AUC | 0.9768 | **0.9824** |
| Mean turns/cp | 8.0 | 8.9 |
| Budget_exhausted CPs | 3 (CP07/09/11) | 2 (CP03/09) |
| Never-passes | 8 | **3** |
| Flips | 0 | 0 |
| Spend | $0.240 | $0.265 |

Seed B solved everything seed A's budget-exhausted checkpoints missed (the 4 CP11
receivables cases and the CP12 owing case), converging on the carrier-on-non-shipped
residual as the only context-arm hard limit. The seed-A→seed-B difference is pure
budget-placement variance: where the 12-turn cap lands determines which (if any)
non-carrier cases are missed.

## Interpretation

Confirms seed A's finding at higher strength: DeepSeek V4 Pro self-corrects through
turn investment (8.9 mean turns/checkpoint) and nearly maximizes the context-arm AUC
without any feedback. The carrier-on-non-shipped cases remain a model-independent
context-arm hard limit. The task does not discriminate this model on the context
arm; this is a model-specific ceiling condition under the sealed plan, not evidence
that the task is easy for lower-investment models (Qwen 3.7 Max context arm: 0.7284).
