# Run Card: e1-billing-v3-qwen37max-context-probe-v1-seed-a-20260611-001

| Field | Value |
| --- | --- |
| Run ID | `e1-billing-v3-qwen37max-context-probe-v1-seed-a-20260611-001` |
| Date | 2026-06-11 |
| Task | `e1-billing-v3`, CP01–CP18 |
| Design boundary | `billing-v3-task-design-v1.md` |
| Protocol profile | `e1-openspec-workflow-v0` (sealed 1.0.0) over base constants (sealed 1.0.0) |
| Classification | `difficulty_probe` |
| Condition | `context_only_spec` |
| Model | `qwen3.7-max` |
| Route | `dashscope-compatible-chat-completions` (direct DashScope-compatible endpoint) |
| Grade | `evidence` |
| Valid | `true` |
| Protocol document hash | `28c72f203d3d76e6dafdbda7acc3e0098824aff8b469ed9e90424fa09a9e569f` |

## Primary result

| Metric | Value | Criterion | Pass? |
| --- | --- | --- | --- |
| Regression-free AUC | **0.9628** | ≤ 0.92 | **FAIL (ceiling)** |
| On-graph drift regressions | **0** | ≥ 2 | **FAIL (none observed)** |
| `output_truncated_turn_rate` | 0.0122 | ≤ 0.10 | PASS |
| Protocol stall flag | none | none | PASS |

**Probe gate: NOT MET.** Criteria 1 and 2 both fail (ceiling side). Criterion 3 passes — failures are structural absences, not drift. Early-stop rule applied: seeds b and c are not fired.

**Third-ceiling closure rule activated.** billing-v2 ceilinged (Sonnet 4.6 AUC 0.9929, Qwen 3.7 Max AUC 0.9361); billing-v3 ceilings (Qwen 3.7 Max AUC 0.9628). The billing domain closes for frontier discrimination claims. See `AGENTS.md`.

## Run shape

| Metric | Value |
| --- | --- |
| Checkpoints | 18 |
| Turns | 82 |
| Mean turns/checkpoint | 4.56 |
| Terminations: done | 10 |
| Terminations: budget_exhausted | 8 |
| Verification requests | 64 |
| `output_truncated_turn_rate` | 0.0122 |
| `violation_turn_rate` | 0.0732 (multiple_verify_blocks=7, unclosed_file_block=1) |
| Wall time max (single CP) | 504 s |

## Per-checkpoint pass rates (cumulative hidden oracle)

| CP | Passed | Total | Pass rate |
| --- | --- | --- | --- |
| 01 | 10 | 10 | 1.0000 |
| 02 | 21 | 21 | 1.0000 |
| 03 | 32 | 32 | 1.0000 |
| 04 | 42 | 42 | 1.0000 |
| 05 | 53 | 54 | 0.9815 |
| 06 | 63 | 64 | 0.9844 |
| 07 | 76 | 79 | 0.9620 |
| 08 | 87 | 89 | 0.9775 |
| 09 | 98 | 99 | 0.9899 |
| 10 | 109 | 110 | 0.9909 |
| 11 | 119 | 120 | 0.9917 |
| 12 | 119 | 137 | **0.8686** |
| 13 | 123 | 146 | **0.8425** |
| 14 | 155 | 156 | 0.9936 |
| 15 | 160 | 167 | 0.9581 |
| 16 | 160 | 177 | **0.9040** |
| 17 | 175 | 186 | 0.9409 |
| 18 | 186 | 197 | 0.9442 |

## Spend

| Item | Value |
| --- | --- |
| Fresh input tokens | 1,419,671 |
| Cached input tokens | 4,383,872 |
| Output tokens | 178,926 |
| Derived spend | **$3.54** |
| Cap | $15 |
| Cost-of-record source | derived (DashScope-compatible endpoint) |

## Context notes

CP01–CP04 pass perfectly (1.0). CP05 introduces the first miss (1 new case failing — proration or hash edge case). CP12–CP13 show the sharpest drop: 17 new cases at CP12 (dunning + entitlement gating, `cancel_at_period_end`) all fail at first; the agent catches up at CP14 (32 previously-failing cases recovered, leaving only 1 failing). CP15–CP18 introduce the serializer (v2), finalization, allocation trace, and idempotency requirements; some cases pass, some don't. No case that once passed ever fails at a later checkpoint (zero on-graph regressions).

## Comparison table (billing domain)

| Run | Model | AUC | On-graph regressions | Criterion 3 | Gate |
| --- | --- | --- | --- | --- | --- |
| billing-v2 Sonnet v2 | Sonnet 4.6 | 0.9929 | 0 | pass | ceiling |
| billing-v2 Qwen v4 | Qwen 3.7 Max | 0.9361 | 0 | pass | ceiling |
| billing-v3 Qwen v1 (this run) | Qwen 3.7 Max | **0.9628** | **0** | pass | **ceiling** |

billing-v3 is harder than billing-v2 for Qwen (AUC 0.9628 vs 0.9361 — but note these are different tasks with different case counts and CP structures, so direct comparison is only directional). The billing domain frontier ceiling holds across two models and three probe attempts spanning two task versions.
