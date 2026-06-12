# e1-dispatch-v1 DeepSeek V4 Pro Stage 1 Difficulty Probe Plan v1

Date: 2026-06-12. Stage 1 difficulty probe for `e1-dispatch-v1` using DeepSeek V4 Pro.
Follows the same protocol as `e1-dispatch-v1-stage1-plan-v1.md` (Qwen 3.7 Max),
with a different model/route.

## Purpose

Replicate the Stage 1 difficulty check on a second frontier model (DeepSeek V4 Pro,
80.6% SWE-Bench Verified, NIST-evaluated). Primary question: does the context arm
ceiling (AUC ≥ 0.92) when a stronger coder model handles the task without feedback?

## Commitments document hash (protocol-document-hash)

`564073531177564cd59ae6607d99783fd38f8b5b18088f0aec07b74a84d1a22c`

Same sealed task as the Qwen 3.7 Max probes (committed at `243febd`).

## Model and route

| Parameter | Value |
|---|---|
| Model | `deepseek-v4-pro` |
| Route | `deepseek-v4-pro-direct` |
| Endpoint | `https://api.deepseek.com/v1/chat/completions` |
| Key env | `DEEPSEEK_API_KEY` |
| Condition | `context_only_spec` (context arm only at Stage 1) |

## Pricing

| Token type | Price per million |
|---|---|
| Input (cache miss) | $0.435 |
| Input (cache hit) | $0.003625 |
| Output | $0.870 |

## Gate criteria (identical to Qwen Stage 1)

| Gate | Criterion |
|---|---|
| G1 | AUC ≤ 0.92 |
| G2 | ≥1 correction CP < 0.75 |
| G3 | Never-pass or flip count > 0 |

Early-stop rule: AUC ≤ 0.75 after seed A → proceed directly to Stage 2.
Three consecutive ceiling seeds (AUC > 0.92) → domain closes for this model.

## Cost projection and cap

Estimated ~$0.19/seed (Qwen token shape scaled by DeepSeek V4 Pro pricing).
Cap: $3.00.

## Invocation template

```bash
bun run e1 -- \
  --task=dispatch \
  --arm=context \
  --live \
  --transport=live \
  --cap=3.00 \
  --classification=calibration \
  --model=deepseek-v4-pro \
  --endpoint=https://api.deepseek.com/v1/chat/completions \
  --api-key-env=DEEPSEEK_API_KEY \
  --route-id=deepseek-v4-pro-direct \
  --input-usd-per-mtok=0.435 \
  --cached-input-usd-per-mtok=0.003625 \
  --output-usd-per-mtok=0.870 \
  --protocol-document-hash=564073531177564cd59ae6607d99783fd38f8b5b18088f0aec07b74a84d1a22c \
  --run-id=e1-dispatch-deepseek-v4-pro-context-stage1-seed-a-20260612-001
```

## Classification

All Stage 1 runs are `calibration` class. Not causal evidence.

## After Stage 1

- Gates pass + AUC ≤ 0.75: proceed to Stage 2 (both arms, ≥3 seed pairs).
- Gates pass + 0.75 < AUC ≤ 0.92: run seed B to confirm.
- AUC > 0.92 (ceiling): context arm already performs well without feedback;
  the task does not discriminate this model on the context arm. Report as
  model-specific ceiling condition. Consider proceeding to Stage 2 anyway
  to measure feedback delta — a small delta here means the model doesn't
  need feedback for this task, which is informative.
