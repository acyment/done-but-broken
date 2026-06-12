# Run Card: e1-dispatch-mini-qwen37max-context-mechanism-probe-20260612-001

| Field | Value |
| --- | --- |
| Run ID | `e1-dispatch-mini-qwen37max-context-mechanism-probe-20260612-001` |
| Date | 2026-06-12 |
| Task | `e1-dispatch-mini` (throwaway mechanism probe, 6 checkpoints, 49 oracle cases) |
| Classification | `calibration` — **not causal evidence, not a sealed difficulty probe** |
| Condition | `context_only_spec` |
| Model / route | `qwen3.7-max`, `dashscope-compatible-chat-completions` (direct) |
| Grade | dev (unsealed task, no commitments doc — by design) |
| Valid | `invalid_run=false` |
| Spend | **$0.155** |

## Question this probe was built to answer

Does a frontier model, given corrections that must propagate across a scattered status
derivation (canonical `orders.ts` + inline copies in `render-order.ts` and `digest.ts` +
vocabulary list in `parse-order.ts`), fail to coordinate the propagation when the spec
describes behavior ("everywhere a status is shown") but never names the files — the
deliberate inversion of billing-v3's warned-and-frozen README style?

## Answer: yes — and more severely than predicted

| Metric | Value |
| --- | --- |
| AUC (`checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1`) | **0.4403** |
| billing-v3 same model, same harness, same profile | 0.9628 |
| billing-v2 same model | 0.9361 |
| Pass→fail flips at checkpoint end | 0 |
| Pass→fail flips at any scoring point | 0 |
| Never-passed cases | **24 / 49** |

Per-checkpoint cumulative pass rate: CP1 0.60, CP2 0.38, CP3 0.28, CP4 0.35, CP5 0.52,
CP6 0.51.

## The mechanism, observed directly

Files rewritten per checkpoint (full run): CP1 `dispatch-types.ts`; CP2 `orders.ts`;
CP3 `dispatch-types.ts`; CP4 `orders.ts`; CP5 `orders.ts` + `render-order.ts`;
CP6 `orders.ts`. **`digest.ts` and `parse-order.ts` were never touched** — including at
CP2, whose entire change request was the digest. 7 turns total (1.17/checkpoint, 12
available), all six checkpoints terminated by the model declaring done, zero truncation,
zero violations, 0–1 verification requests per checkpoint.

The 24 never-passed cases are exactly the two untouched scattered surfaces: all 10
reimport cases (importer never learned notes, returned marks, new vocabulary, refund
flag) and all 10 digest cases (buckets never gained `total_cents`), plus
`cp06-export-requires-refund` (the export's status token was correct —
`cancelled_partial` — but the flag was omitted: a one-sided update inside a single
file). Representative diff: CP6 export came back byte-identical to expected except the
missing `"requires_refund":true`.

The eight fail→pass recoveries are the same story from the other side: export cases
introduced at CP1/CP3/CP4 stayed red until the single CP5 `render-order.ts` rewrite
landed notes, returns, and partial-shipment tokens all at once.

## Interpretation (calibration-grade, one run, one model)

1. **The coordination-failure mechanism is real on this harness and model.** Same
   model, same protocol, same OpenSpec profile as billing-v3 — AUC drops from 0.96 to
   0.44 when the task's concerns are scattered and the spec stops naming the traps.
   The billing ceilings were a property of task structure, not model capability.
2. **The failure signature is omission-at-introduction, not pass→fail flips.** The
   agent under-invests (declares done after one file edit) and never discovers the
   stale coupled surfaces, because nothing in the context arm tells it. Old greens
   stayed green precisely because untouched files cannot be botched. Flip-type
   regressions would additionally require pressure that forces repeated rewrites of
   the scattered files.
3. **The treatment contrast is now mechanistically loaded.** The feedback arm runs
   exactly the cases that expose the stale surfaces each checkpoint (impact
   visibility, the TDAD mechanism). Predicted effect direction: large positive AUC
   delta. That prediction is falsifiable in a future sealed two-arm run — it is not
   evidence yet.
4. Re-verification note: recomputing per-case trajectories from `per_turn` scoring
   confirms billing-v3 seed-a had genuinely 0 pass→fail flips over 197 tracked cases
   (the original analysis is upheld with case-level data confirmed non-empty).

## Validity limits

Single run, calibration classification, unsealed task, no commitments document, no
naive-agent-vs-model comparison, one seed, one model. Nothing here is causal evidence
for the executable-feedback hypothesis; it licenses (only) investment in a full sealed
task built on this mechanism.
