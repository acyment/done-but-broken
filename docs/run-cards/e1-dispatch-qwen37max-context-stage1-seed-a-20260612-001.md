# Run Card: e1-dispatch-qwen37max-context-stage1-seed-a-20260612-001

| Field | Value |
| --- | --- |
| Run ID | `e1-dispatch-qwen37max-context-stage1-seed-a-20260612-001` |
| Date | 2026-06-12 |
| Task | `e1-dispatch-v1` (12 checkpoints, 141 oracle cases) |
| Classification | `calibration` — Stage 1 difficulty probe; not causal evidence |
| Condition | `context_only_spec` |
| Model / route | `qwen3.7-max`, `dashscope-compatible-chat-completions` (direct) |
| Grade | `evidence` (sealed task, commitments doc `243febd`) |
| Valid | `invalid_run=false` |
| Spend | **$0.521** (cap $3.00) |
| Turns | 38 total; mean 3.17/checkpoint |
| Terminations | done=10, budget_exhausted=2 (CP10, CP11) |

## Stage 1 gate verdict

| Gate | Criterion | Result |
| --- | --- | --- |
| G1 | AUC ≤ 0.92 | **PASS** — 0.7284 |
| G2 | ≥1 correction CP < 0.75 | **PASS** — CP01 0.3889, CP02 0.3333, CP03 0.5366, CP04 0.5098 |
| G3 | Never-pass or flip count > 0 | **PASS** — 15 never-passes, 0 flips |

**Early-stop triggered**: AUC 0.7284 ≤ 0.75 threshold — all gates clearly pass,
seed B not required. Stage 2 sealed causal pilots authorized.

## Metrics

| Metric | Value |
| --- | --- |
| AUC (`checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1`) | **0.7284** |
| Pass→fail flips | 0 |
| Never-passed cases | **15 / 141** |
| dispatch-mini same model (mechanism probe) | 0.4403 |
| billing-v3 same model (task with no scattering) | 0.9628 |

## Per-checkpoint cumulative pass rate

| Checkpoint | Type | Turns | Passed/Total | Rate |
| --- | --- | --- | --- | --- |
| CP01 | extension | 1 | 7 / 12 | 0.5833 |
| CP02 | extension | 1 | 7 / 18 | 0.3889 |
| CP03 | extension | 1 | 10 / 30 | 0.3333 |
| CP04 | correction (partially_shipped) | 2 | 22 / 41 | 0.5366 |
| CP05 | extension | 1 | 26 / 51 | 0.5098 |
| CP06 | correction (partially_returned) | 7 | 55 / 62 | 0.8871 |
| CP07 | extension | 1 | 57 / 74 | 0.7703 |
| CP08 | correction (cancelled_partial) | 6 | 83 / 84 | 0.9881 |
| CP09 | extension | 1 | 90 / 100 | 0.9000 |
| CP10 | correction (closed) | 8† | 110 / 113 | 0.9735 |
| CP11 | extension (receivables_digest) | 8† | 121 / 124 | 0.9758 |
| CP12 | correction (cancelled_owing) | 1 | 126 / 141 | 0.8936 |

† budget_exhausted — agent hit the per-checkpoint turn limit without calling done.

## Never-pass breakdown

**Carrier metadata on non-shipped exports (3 cases)** — agent correctly handled
`carrier`/`tracking` on fully-shipped lines but never extended this to orders with
partially-returned, returned, or closed states:
- `cp06-export-partial-with-carrier`
- `cp09-export-refunded-with-carrier`
- `cp10-export-closed-with-carrier`

**Cancelled_owing (12 cases)** — agent never implemented the CP12 correction; all
cancelled_owing exports, reimports, digest buckets, and receivables entries remained
at seed state:
- `cp12-export-cancelled-owing`
- `cp12-reimport-cancelled-owing`
- `cp12-digest-cancelled-owing`
- `cp12-export-owing-flag-no-requires-refund`
- `cp12-reimport-owing-flag`
- `cp12-digest-owing-separate-from-cancelled`
- `cp12-receivables-cancelled-owing-outstanding`
- `cp12-export-owing-with-shipped-line`
- `cp12-reimport-owing-with-notes`
- `cp12-digest-full-spectrum`
- `cp12-receivables-owing-vs-awaiting`
- `cp12-export-owing-multi-note`

## Failure signature

Same omission-at-introduction pattern as dispatch-mini: the agent under-invests in
scattered updates, declares done after updating the most visible site, and never
discovers the stale coupled surfaces because nothing in the context arm exposes them.

Two distinct failure channels observed:
1. **Partial propagation** — carrier metadata correctly added to shipped-line exports
   but silently omitted from the same field on other order states. The agent saw the
   pattern but applied it narrowly.
2. **Total omission** — cancelled_owing was introduced at CP12 (1 turn, done), but
   the agent's edit left it unreachable. 12 cases across all four scattered sites
   (export, reimport, digest, receivables) never passed.

No pass→fail flips: the context arm produces zero regressions. Old greens stay green
because untouched files cannot be botched. The flip channel requires M3 rewrite
pressure; it was not observed in the context arm at this task size.

## Interpretation (calibration-grade, one run, one seed)

1. **Difficulty confirmed.** AUC 0.7284 is well below the G1 ceiling (0.92) and
   below the early-stop threshold (0.75). The task is harder than billing-v3 (0.9628)
   for the same model, attributable to the scattered 4-site coordination requirement
   and the contextual-level spec (no file names, no sync demands).

2. **Failure mechanism active.** 15 never-passes confirm that propagation failure is
   the dominant mode. The coordination-failure mechanism (M1 + M2) works as designed.

3. **No evidence of M3 rewrite pressure in context arm.** Budget-exhausted CPs (10,
   11) show effort but no flips — consistent with the agent rewriting existing code
   without introducing new errors, not with the botch channel predicted by M3.

4. **Stage 2 is authorized.** All three gates pass under the early-stop rule. The
   treatment contrast is mechanistically loaded: the feedback arm runs exactly the
   cases that expose stale surfaces at each checkpoint. Predicted direction: positive
   AUC delta. That prediction is falsifiable in Stage 2 and is not evidence yet.

## Validity limits

Single run, calibration classification, context arm only. Nothing here is causal
evidence for the executable-feedback hypothesis. Stage 1 licenses Stage 2 (paired
causal pilots, ≥3 seed pairs, both arms) under separate operator authorization.
