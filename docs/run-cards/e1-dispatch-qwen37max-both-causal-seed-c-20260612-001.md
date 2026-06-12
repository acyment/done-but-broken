# Run Card: e1-dispatch-qwen37max-both-causal-seed-c-20260612-001

| Field | Value |
| --- | --- |
| Run ID | `e1-dispatch-qwen37max-both-causal-seed-c-20260612-001` |
| Date | 2026-06-12 |
| Task | `e1-dispatch-v1` (12 checkpoints, 141 oracle cases) |
| Classification | `causal_pilot` — Stage 2 seed pair C |
| Arms | `context_only_spec` + `feedback_capable_spec` |
| Model / route | `qwen3.7-max`, `dashscope-compatible-chat-completions` (direct) |
| Grade | `evidence` (sealed task, commitments doc `243febd`) |
| Valid | `invalid_run=false` |
| Spend | **$1.220** (cap $2.00) |
| Turns | context 34 (mean 2.8/cp), feedback 49 (mean 4.1/cp) |
| Terminations | context: done=12; feedback: done=12 |

## Primary result

| Metric | Context arm | Feedback arm | Delta |
| --- | --- | --- | --- |
| AUC | **0.7578** | **0.9562** | **+0.1984** |
| Never-passed cases | 3 / 141 | 5 / 141 | +2 |
| Pass→fail flips | 0 | 0 | — |

## Per-checkpoint cumulative pass rate

| Checkpoint | Type | Context turns / rate | Feedback turns / rate |
| --- | --- | --- | --- |
| CP01 | extension | 1 / 0.5833 | 1 / **1.0000** |
| CP02 | extension | 2 / 0.5556 | 2 / **1.0000** |
| CP03 | extension | 1 / 0.4333 | 1 / 0.7000 |
| CP04 | correction (partially_shipped) | 1 / 0.4390 | 7 / 0.9756 |
| CP05 | extension | 1 / 0.4314 | 10 / **1.0000** |
| CP06 | correction (partially_returned) | 7 / 0.9839 | 4 / 0.9839 |
| CP07 | extension | 1 / 0.8514 | 7 / 0.9865 |
| CP08 | correction (cancelled_partial) | 1 / 0.9881 | 1 / 0.9881 |
| CP09 | extension | 1 / 0.9000 | 3 / 0.9600 |
| CP10 | correction (closed) | 6 / 0.9735 | 3 / 0.9558 |
| CP11 | extension (receivables_digest) | 8 / 0.9758 | 8 / 0.9597 |
| CP12 | correction (cancelled_owing) | 5 / 0.9787 | 2 / 0.9645 |

## Never-pass cases

**Context arm (3)** — same carrier-on-non-shipped residual as seed A:
- `cp06-export-partial-with-carrier`
- `cp09-export-refunded-with-carrier`
- `cp10-export-closed-with-carrier`

**Feedback arm (5)** — carrier residual (3) plus 2 additional misses:
- `cp06-export-partial-with-carrier`
- `cp09-export-refunded-with-carrier`
- `cp10-export-closed-with-carrier`
- `cp09-reimport-refund-on-cancel-partial`
- `cp09-digest-cancelled-partial-with-refund`

The 2 extra feedback never-passes (CP09 cases) indicate that this seed's feedback
arm, despite 10 turns at CP05, did not fully resolve the cancelled-partial + refund
interaction introduced at CP09. The context arm resolved these at CP08 (correction)
and the cases passed in the context arm from CP08 forward.

## Comparison with seed A

| | Seed A context | Seed A feedback | Seed C context | Seed C feedback |
| --- | --- | --- | --- | --- |
| AUC | 0.7179 | 0.9541 | 0.7578 | 0.9562 |
| Delta | +0.2363 | | +0.1984 | |
| Never-pass | 3 | 3 | 3 | 5 |
| Feedback turns/cp | — | 2.67 | — | 4.08 |

Seed C's feedback arm worked harder (4.1 turns/cp vs 2.7 in seed A) and ended
with a slightly lower AUC and 2 extra never-passes. The delta is smaller but still
substantially above the MCID. Context arm performance is consistent (0.72 vs 0.76).

## Validity limits

One of three required seed pairs. Both deltas positive and above MCID. Seed B
pending; full Stage 2 decision after all three pairs reviewed.
