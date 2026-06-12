# Run Card: e1-dispatch-qwen37max-both-causal-seed-b-20260612-001

| Field | Value |
| --- | --- |
| Run ID | `e1-dispatch-qwen37max-both-causal-seed-b-20260612-001` |
| Date | 2026-06-12 |
| Task | `e1-dispatch-v1` (12 checkpoints, 141 oracle cases) |
| Classification | `causal_pilot` — Stage 2 seed pair B |
| Arms | `context_only_spec` + `feedback_capable_spec` |
| Model / route | `qwen3.7-max`, `dashscope-compatible-chat-completions` (direct) |
| Grade | `evidence` (sealed task, commitments doc `243febd`) |
| Valid | `invalid_run=false` |
| Spend | **$1.317** (cap $2.00) |
| Turns | context 61 (mean 5.1/cp), feedback 33 (mean 2.8/cp) |
| Terminations | context: done=10, budget_exhausted=2 (CP02, CP11); feedback: done=12 |

## Primary result

| Metric | Context arm | Feedback arm | Delta |
| --- | --- | --- | --- |
| AUC | **0.8829** | **0.8874** | **+0.0044** |
| Never-passed cases | 3 / 141 | 3 / 141 | 0 |
| Pass→fail flips | 0 | 0 | — |

**Near-null delta.** The context arm exhausted its per-checkpoint budget at CP02
(12 turns, 1.0000) and CP11, achieving unusually high early-CP performance.
The +0.0044 delta is below the MCID and operationally negligible.

## Per-checkpoint cumulative pass rate

| Checkpoint | Type | Context turns / rate | Feedback turns / rate |
| --- | --- | --- | --- |
| CP01 | extension | 1 / 0.5833 | 1 / 0.5833 |
| CP02 | extension | 12† / **1.0000** | 1 / **1.0000** |
| CP03 | extension | 1 / 0.7000 | 1 / 0.7000 |
| CP04 | correction (partially_shipped) | 6 / 0.9756 | 1 / 0.6341 |
| CP05 | extension | 1 / 0.8627 | 6 / **1.0000** |
| CP06 | correction (partially_returned) | 7 / 0.8871 | 3 / 0.9839 |
| CP07 | extension | 1 / 0.7703 | 1 / 0.8514 |
| CP08 | correction (cancelled_partial) | 6 / 0.9881 | 4 / 0.9881 |
| CP09 | extension | 1 / 0.9000 | 4 / 0.9800 |
| CP10 | correction (closed) | 6 / 0.9735 | 1 / 0.9735 |
| CP11 | extension (receivables_digest) | 12† / 0.9758 | 5 / 0.9758 |
| CP12 | correction (cancelled_owing) | 7 / 0.9787 | 5 / 0.9787 |

† budget_exhausted — agent hit the 12-turn per-checkpoint limit.

## Never-pass cases (both arms, 3 each)

Same carrier-on-non-shipped residual as seeds A and C:
- `cp06-export-partial-with-carrier`
- `cp09-export-refunded-with-carrier`
- `cp10-export-closed-with-carrier`

## What happened in this seed

**Context arm CP02 (12 turns, budget_exhausted, 1.0000):** the agent spontaneously
discovered all four scattered update sites at CP02 and spent 12 turns reaching
perfect cumulative pass rate. This is the same result the feedback arm achieves
in 1–6 turns across seeds — but here the context arm found it without feedback by
exhausting its budget. The discovery was not driven by visible failing cases; the
agent appears to have kept iterating until it had updated all files.

This represents a different failure mode: the context arm *can* solve the
coordination problem given unlimited turns, but the default investment level
(1–2 turns, done) leaves it unsolved in 2/3 seeds. Feedback raises the
*consistent* per-checkpoint success rate without requiring budget exhaustion.

**Feedback arm CP04 (1 turn, 0.6341):** unusually poor. The feedback arm missed
the partially_shipped correction in 1 turn here, whereas seeds A and C achieved
0.9756–1.0000 at CP04. Recovered by CP05. This seed demonstrates that the
feedback arm is not monotonically superior — it can undershoot on specific
checkpoints.

## Comparison across seeds

| | A context | A feedback | B context | B feedback | C context | C feedback |
| --- | --- | --- | --- | --- | --- | --- |
| AUC | 0.7179 | 0.9541 | **0.8829** | 0.8874 | 0.7578 | 0.9562 |
| Delta | +0.2363 | | +0.0044 | | +0.1984 | |
| Turns/cp | 2.5 | 2.7 | **5.1** | 2.8 | 2.8 | 4.1 |
| Budget_exhausted | 1 | 0 | **2** | 0 | 0 | 0 |

Seed B's context arm used 2× the turns of seeds A and C (5.1 vs 2.5–2.8) and
twice hit the 12-turn budget cap. The high context AUC is an artifact of that
extended effort, not a different qualitative result.

## Validity limits

One of three required seed pairs. The near-null delta is important evidence about
the mechanism: the feedback advantage is real on average but is eliminated in
seeds where the context arm is allowed to exhaust its turn budget. See the Stage 2
summary run card for the full three-pair matrix verdict.
