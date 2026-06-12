# Run Card: e1-dispatch-mini-qwen37max-feedback-mechanism-probe-20260612-001

| Field | Value |
| --- | --- |
| Run ID | `e1-dispatch-mini-qwen37max-feedback-mechanism-probe-20260612-001` |
| Date | 2026-06-12 |
| Task | `e1-dispatch-mini` (throwaway mechanism probe, 6 checkpoints, 49 oracle cases) |
| Classification | `calibration` — **not causal evidence** (unsealed task, single pair, no seeds) |
| Condition | `feedback_capable_spec` |
| Model / route | `qwen3.7-max`, `dashscope-compatible-chat-completions` (direct) |
| Valid | `invalid_run=false` |
| Spend | $0.491 |

Companion to the context-arm probe
(`e1-dispatch-mini-qwen37max-context-mechanism-probe-20260612-001`, AUC 0.4403). Same
task package, same model, same day; the only difference is the allowlisted feedback
mount: the visible worked examples exist as runnable case files under `specs/cases/`
plus `bun run spec`.

## Result

| Metric | Context arm | Feedback arm |
| --- | --- | --- |
| AUC | 0.4403 | **0.8800** |
| Final checkpoint score | 25/49 | **49/49** |
| Never-passed cases | 24 | **0** |
| Pass→fail flips | 0 | 0 |
| Turns | 7 | 21 |
| Spend | $0.155 | $0.491 |

Per-checkpoint cumulative pass rate (feedback arm): CP1 0.60, CP2 **1.00**, CP3 0.68,
CP4 **1.00**, CP5 **1.00**, CP6 **1.00**.

## The mechanism, visible in the turn records

| CP | Verification runs | Files rewritten | End state |
| --- | --- | --- | --- |
| 1 | none | `dispatch-types.ts` only | 6/10 |
| 2 | 4× `bun run spec` | `orders.ts`, `render-order.ts`, `parse-order.ts`, `digest.ts` | 16/16 |
| 3 | none | `dispatch-types.ts` only | 17/25 |
| 4 | 4× `bun run spec` | all four source files | 34/34 |
| 5 | 3× `bun run spec` | `orders.ts`, `parse-order.ts`, `digest.ts` | 42/42 |
| 6 | 4× `bun run spec` | all four source files | 49/49 |

The two sub-1.0 checkpoints (CP1, CP3) are exactly the two where the agent skipped
verification and repeated the context arm's one-file-and-done behavior. Every checkpoint
where it ran the spec cases, it discovered the stale scattered surfaces, propagated the
change across all four files — the same `parse-order.ts` and `digest.ts` the context arm
never opened in six checkpoints — and finished at 100%, including retroactively repairing
the prior checkpoint's misses.

## Interpretation (calibration-grade)

On identical content, the executable form of the same worked examples turned persistent
cross-file propagation blindness (24 permanently failing cases) into full recovery
(49/49). The affordance that matters is executability: the context arm had the same
examples as text and never hand-checked them. AUC delta on this single uncontrolled
pair: **+0.4397**. This is mechanism validation for the full `e1-dispatch` build and a
predicted effect direction for sealed two-arm pilots — it is not causal evidence and
must not be quoted as such.
