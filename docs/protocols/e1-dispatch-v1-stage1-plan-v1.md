# e1-dispatch-v1 Stage 1 Difficulty Probe Plan v1

Date: 2026-06-12. Sealed Stage 1 probe plan for the `e1-dispatch-v1` task.
Authored after and referencing the sealed commitments document
(`e1-dispatch-v1-commitments-v1.md`).

## Purpose

Stage 1 answers one question: is this task difficult enough to not ceiling under
a frontier context-arm run? The gate criteria are stated before any run; if the
task ceilings cleanly on the first seed, one design revision (v2) is permitted
before the dispatch domain closes for frontier discrimination claims.

## Commitments document hash (protocol-document-hash)

`564073531177564cd59ae6607d99783fd38f8b5b18088f0aec07b74a84d1a22c`

This is the SHA-256 of `docs/protocols/e1-dispatch-v1-commitments-v1.md` as
committed at `243febd`. Pass this value as `--protocol-document-hash` on every
Stage 1 run invocation.

## Evidence basis

- `e1-dispatch-mini` context arm (calibration, 2026-06-12): AUC **0.4403**, 24/49
  never-passed. Mechanism: agent never touched `digest.ts` or `parse-order.ts`
  across 6 checkpoints; 7 turns total (1.17/checkpoint). The full dispatch task
  doubles the correction count and adds rewrite pressure (M3); context-arm AUC
  is predicted to stay well below 0.92.
- `e1-billing-v3` context arm (Qwen 3.7 Max, same model/route, 2026-06-11): AUC
  0.9628 — this confirms the model is capable of reaching high AUC on a task
  whose structure does not demand cross-file coordination. The dispatch task's
  low mini AUC is a task-structure effect, not a model capability ceiling.

## Model and route

| Parameter | Value |
|---|---|
| Model | `qwen3.7-max` |
| Route | `dashscope-compatible-chat-completions` |
| Key env | `DASHSCOPE_API_KEY` |
| Condition | `context_only_spec` (context arm only at Stage 1) |

## Gate criteria (all must pass before Stage 2 is authorized)

| Gate | Criterion | Rationale |
|---|---|---|
| G1 | AUC ≤ 0.92 on the primary seed | Below billing-v3's ceiling of 0.9628; meaningful headroom |
| G2 | At least one correction checkpoint with cumulative pass rate < 0.75 | Confirms correction-type difficulty is real, not just early CPs easy |
| G3 | Never-pass or flip count > 0 in the scoring record | Confirms a failure mechanism is active (not all-or-nothing) |

If any seed fails G1 (AUC > 0.92), it is a ceiling event for that seed.
Three consecutive ceiling seeds → dispatch domain closes for this task version.

## Early-stop rule (matching billing-v3 shape)

- After seed A: if AUC ≤ 0.75, all three gates clearly pass → proceed to Stage 2
  (further seeds not required to confirm difficulty).
- After seed A: if 0.75 < AUC ≤ 0.92, run seed B to confirm; if seed B also ≤ 0.92,
  gates pass.
- After seed A: if AUC > 0.92 (ceiling), run seed B. If seed B also > 0.92, run seed C.
  Three ceiling seeds → domain closed.
- Maximum seeds at Stage 1: 3.

## Cost projection

From mini's measured shape scaled ×2.5 for 12 checkpoints and larger files:
- Context arm: ≈ $0.60 per seed
- Stage 1 cap: $3.00 (3× projection × 3 seeds)

Each run invocation must include `--cap=3.00`.

## Invocation template

```bash
bun run e1 -- \
  --task=dispatch \
  --arm=context \
  --live \
  --transport=live \
  --cap=3.00 \
  --classification=calibration \
  --protocol-document-hash=564073531177564cd59ae6607d99783fd38f8b5b18088f0aec07b74a84d1a22c \
  --run-id=e1-dispatch-qwen37max-context-stage1-seed-a-YYYYMMDD-NNN
```

Replace `YYYYMMDD-NNN` with the date and sequence number. Use
`--run-id=...-seed-b-...` and `--run-id=...-seed-c-...` for subsequent seeds.

## Classification

All Stage 1 runs are `calibration` class. They are difficulty probes, not causal
evidence. They must not be described as causal evidence for the executable-feedback
hypothesis in any document or summary.

## After Stage 1

If gates pass: proceed to Stage 2 sealed causal pilots (≥3 seed pairs, both arms,
separate authorization required). The Stage 2 plan is authored after Stage 1 results
are reviewed.

If dispatch domain closes: one design revision to `e1-dispatch-v2` is permitted,
addressing the ceiling root cause identified from the Stage 1 run records. A new
commitments document and Stage 1 plan are required for v2 before any v2 run.

## Measurement and reporting

Per the predeclared measurement honesty in the design doc and commitments:
- Report AUC, spend, turns, and classification for each seed.
- Report flip count and never-pass count separately.
- Report files-touched-per-checkpoint profile.
- Never describe never-passes as regressions.
- Write a run card for each seed under `docs/run-cards/`.
