# Run Card: e1-billing-v2-qwen37max-context-probe-v4-seed-a-20260611-001

Date: 2026-06-11  
Protocol: `e1-openspec-workflow-v0` over `e1-frontier-sealed-constants-v1.0`  
Plan: `e1-billing-v2-stage1-plan-v4.md`  
Commitments: `e1-billing-v2-commitments-v4.md` (`65c79853bc2fd397bcdd7033ba36de1a6f80dd57ce585884dab267df529fe5b2`)  
Classification: `difficulty_probe` (not causal evidence)  
Task version: `e1-billing-v2-v3` (Amendment 5 one-file-per-turn README)  
Model: `qwen3.7-max` direct to DashScope-compatible endpoint (`dashscope-compatible-chat-completions`)  
Condition: `context_only_spec`

## Summary

Context ceiling. Criterion 3 (structural) **passes** — v3 Amendment 5 eliminated the truncation problem entirely. Criteria 1 and 2 both fail on the ceiling side (AUC above threshold, zero regressions). Early-stop rule applied: seeds b/c not fired.

## Run stats

| Field | Value |
| --- | --- |
| Grade | `evidence` |
| `invalid_run` | `false` |
| `valid` (inspect) | `true` |
| Checkpoints | 18/18 completed |
| Turns | 88 |
| `output_truncated_turn_rate` | **0.0227** (was 0.2558 in v2) |
| `truncation_hit_rate` | 0.0000 |
| `no_op_turn_rate` | 0.0455 |
| `violation_turn_rate` | 0.1705 |
| `agent_stalled_checkpoint_rate` | 0.0556 (1 stalled) |
| `budget_exhausted` terminations | 5 |
| `done` terminations | 12 |
| Fresh input tokens | 1,407,098 |
| Cached input tokens | **3,934,848** (caching engaged) |
| Output tokens | 142,369 |
| Spend (derived) | **$3.28** |
| `cost_of_record_source` | `derived` |

## Gate evaluation

| Criterion | Threshold | Result | Outcome |
| --- | --- | --- | --- |
| 1. Regression-free AUC | ≤ 0.92 | **0.9361** | **FAILS** (ceiling) |
| 2. On-graph regressions | ≥ 2 | **0** | **FAILS** (ceiling) |
| 3a. `output_truncated_turn_rate` | ≤ 0.10 | **0.0227** | PASSES |
| 3b. No 3+ consecutive length-terminations | — | 0 truncations | PASSES |
| 3c. Real multi-file edits | — | confirmed | PASSES |

**Gate verdict: context ceiling.** Criterion 3 passes cleanly; criteria 1 and 2 fail on the ceiling side.

## Early-stop rule

Criterion 3 clean + AUC 0.9361 > 0.92 + zero on-graph regressions → boundary verdict determined from seed-a alone. Seeds b and c are not fired per the predeclared rule in `e1-billing-v2-stage1-plan-v4.md`.

## Per-checkpoint cumulative pass rates

| CP | Passed/Total | Pass rate |
| --- | --- | --- |
| CP01 | 8/8 | 100.0% |
| CP02 | 17/17 | 100.0% |
| CP03 | 25/25 | 100.0% |
| CP04 | 33/33 | 100.0% |
| CP05 | 33/43 | 76.7% |
| CP06 | 51/51 | 100.0% |
| CP07 | 59/62 | 95.2% |
| CP08 | 59/70 | 84.3% |
| CP09 | 60/78 | 76.9% |
| CP10 | 85/87 | 97.7% |
| CP11 | 93/95 | 97.9% |
| CP12 | 101/103 | 98.1% |
| CP13 | 109/111 | 98.2% |
| CP14 | 109/119 | 91.6% |
| CP15 | 112/128 | 87.5% |
| CP16 | 132/136 | 97.1% |
| CP17 | 132/144 | 91.7% |
| CP18 | 141/153 | 92.2% |

## Never-passing checks at CP18 (12)

All 12 checks that never passed across the full run:

| Check ID | Commitment | Notes |
| --- | --- | --- |
| `cp09-alloc-three-lines` | I-ALLOC | 3-line largest-remainder edge case (visible) |
| `cp09-alloc-three-lines-h` | I-ALLOC | 3-line hidden variant |
| `cp16-recompute-new-doc` | I-IMMUT | Recompute must create new doc with `-r1` suffix (visible) |
| `cp16-recompute-finalized-h` | I-IMMUT | Hidden recompute immutability variant |
| `cp17-hash-basic` | I-REPLAY | Replay hash all 8 checks fail (same as Sonnet v2) |
| `cp17-hash-invoice` | I-REPLAY | — |
| `cp17-hash-duplicate-capture` | I-REPLAY | — |
| `cp17-hash-complex` | I-REPLAY | — |
| `cp17-hash-basic-h` | I-REPLAY | — |
| `cp17-hash-renewal-h` | I-REPLAY | — |
| `cp17-hash-dunning-h` | I-REPLAY | — |
| `cp17-hash-finalized-h` | I-REPLAY | — |

Qwen 3.7 Max fails 3 more commitment classes than Sonnet v2 (which failed only I-REPLAY, 9 checks). The CP09 I-ALLOC three-line edge case and CP16 I-IMMUT recompute-creates-new-doc are new failures. Despite this Qwen is still well above the 0.92 AUC ceiling.

## Amendment 5 effectiveness

The one-file-per-turn instruction reduced `output_truncated_turn_rate` from **0.2558** (v2 Sonnet) to **0.0227** (v4 Qwen). Structural criterion passes cleanly for the first time.

## Comparison: Sonnet v2 vs Qwen v4

| Metric | Sonnet v2 | Qwen v4 |
| --- | --- | --- |
| Model | `claude-sonnet-4-6` | `qwen3.7-max` |
| Amendment | v2 (file split) | v3 (one-file-per-turn) |
| AUC | 0.9929 | 0.9361 |
| Regressions | 0 | 0 |
| `output_truncated_turn_rate` | 0.2558 (structural fail) | 0.0227 (passes) |
| Never-passing checks | 9 (I-REPLAY only) | 12 (I-REPLAY + I-ALLOC + I-IMMUT) |
| Spend | ~$9.08 (Sonnet direct would be less) | $3.28 |

Runs are not pooled (different models; Sonnet v2 also had criterion-3 failure making it non-evidence-grade).

## Verdict

**Context ceiling.** Qwen 3.7 Max solves the billing-v2 task (v3 boundary) too completely for frontier discrimination: AUC 0.9361 with zero cross-checkpoint regressions. This is consistent with the directional signal from Sonnet v2 (AUC 0.9929, zero regressions despite structural failure). Both frontier models saturate the task. No Stage 2 causal pilots are warranted; the task requires redesign with harder discrimination before further spend.

No on-the-fly escalation: extending the task requires a new sealed design revision and task version per the predeclared outcomes in the plan.
