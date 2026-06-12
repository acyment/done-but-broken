# Run Card: e1-dispatch-deepseek-v4-pro-context-stage1-seed-a-20260612-001

| Field | Value |
| --- | --- |
| Run ID | `e1-dispatch-deepseek-v4-pro-context-stage1-seed-a-20260612-001` |
| Date | 2026-06-12 |
| Task | `e1-dispatch-v1` (12 checkpoints, 141 oracle cases) |
| Classification | `calibration` — Stage 1 difficulty probe; not causal evidence |
| Condition | `context_only_spec` |
| Model / route | `deepseek-v4-pro`, `deepseek-v4-pro-direct` (direct) |
| Grade | `evidence` (sealed task, commitments doc `243febd`) |
| Valid | `invalid_run=false` |
| Spend | **$0.240** (cap $3.00) |
| Turns | 96 total; mean **8.0/checkpoint** |

## Stage 1 gate verdict

| Gate | Criterion | Result |
| --- | --- | --- |
| G1 | AUC ≤ 0.92 | **FAIL** — 0.9768 > 0.92 |
| G2 | ≥1 correction CP < 0.75 | **FAIL** — all CPs ≥ 0.94 |
| G3 | Never-pass or flip count > 0 | pass — 8 never-passes |

**Ceiling condition.** The context arm already scores 0.9768 without any feedback.
Per the Stage 1 plan: domain does not close (one model's ceiling does not close the
task), but Stage 2 pairs for this model are not expected to show a meaningful delta.

## Per-checkpoint cumulative pass rate

| Checkpoint | Type | Turns | Passed/Total | Rate |
| --- | --- | --- | --- | --- |
| CP01 | extension | 7 | 12 / 12 | **1.0000** |
| CP02 | extension | 3 | 18 / 18 | **1.0000** |
| CP03 | extension | 10 | 29 / 30 | 0.9667 |
| CP04 | correction (partially_shipped) | 7 | 40 / 41 | 0.9756 |
| CP05 | extension | 9 | 50 / 51 | 0.9804 |
| CP06 | correction (partially_returned) | 8 | 61 / 62 | 0.9839 |
| CP07 | extension | 12† | 73 / 74 | 0.9865 |
| CP08 | correction (cancelled_partial) | 10 | 83 / 84 | 0.9881 |
| CP09 | extension | 12† | 98 / 100 | 0.9800 |
| CP10 | correction (closed) | 2 | 110 / 113 | 0.9735 |
| CP11 | extension (receivables_digest) | 12† | 117 / 124 | 0.9435 |
| CP12 | correction (cancelled_owing) | 4 | 133 / 141 | 0.9433 |

† budget_exhausted

## Never-pass cases (8)

Carrier on non-shipped states (same 3-case residual as all Qwen runs):
- `cp06-export-partial-with-carrier`
- `cp09-export-refunded-with-carrier`
- `cp10-export-closed-with-carrier`

Receivables digest edge cases (4 — budget_exhausted at CP11, 12 turns):
- `cp11-receivables-fully-paid-omitted`
- `cp11-receivables-mixed-buckets`
- `cp11-receivables-after-partial-refund`
- `cp11-receivables-cancelled-partial-ship-outstanding`

Cancelled_owing partial miss (1):
- `cp12-export-owing-with-shipped-line`

## Key finding: investment depth, not capability

DeepSeek V4 Pro spent a mean of **8.0 turns/checkpoint** — 2.5–3× more than Qwen
3.7 Max's mean of 2.5–3.2 turns/checkpoint across seeds A–C. Every checkpoint
where Qwen declared done after 1 turn, DeepSeek invested 7–12 turns before
declaring done (or hitting the budget cap). The 4-site coordination requirement
that stalled Qwen was solved by turn-investment alone, without any feedback.

Qwen 3.7 Max context arm: mean **0.79 AUC**, 3 carrier never-passes, 12 CP12 never-passes.
DeepSeek V4 Pro context arm: **0.9768 AUC**, 3 carrier + 4 receivables + 1 owing never-passes.

The carrier-on-non-shipped cases (3) persist in both models. They are a hard limit
for the context arm independent of model strength or turn budget.

## Comparison with Qwen 3.7 Max

| | Qwen 3.7 Max (Stage 1) | DeepSeek V4 Pro |
| --- | --- | --- |
| Context AUC | 0.7284 | **0.9768** |
| Mean turns/cp | 3.2 | **8.0** |
| Budget_exhausted CPs | 2 | **3** |
| Never-passes | 15 | 8 |
| Flips | 0 | 0 |
| Spend | $0.521 | $0.240 |

## Interpretation

The failure mode exploited by e1-dispatch (agent under-invests, declares done after
1–2 file edits, misses scattered sites) is specific to models that default to low
turn-investment. DeepSeek V4 Pro self-corrects through more turns rather than
needing feedback to point out missing cases. The feedback advantage measured in
Qwen Stage 2 (+0.1464 mean delta) would likely be near-zero for DeepSeek V4 Pro
because the context arm already nearly maximizes the AUC.

This is informative, not a null result. It means:
1. The feedback effect is **model-dependent** — it helps models that under-invest.
2. As coding model capability increases (and natural turn-investment increases),
   the per-case feedback signal becomes redundant.
3. The Qwen 3.7 Max finding remains valid for its model tier; it does not generalise
   to top-tier coders on this task at this complexity level.

The open question for the research program: at what task complexity does even a
high-investment model need feedback to avoid scatter failures? A harder task
(more files, longer chains, more checkpoints) might reproduce the failure mode
in DeepSeek V4 Pro.
