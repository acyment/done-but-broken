# e1-dispatch-v1 Stage 2 Causal Pilot Plan v1

Date: 2026-06-12. Authored after Stage 1 gates passed (seed A, AUC 0.7284,
run card `e1-dispatch-qwen37max-context-stage1-seed-a-20260612-001`).

## Commitments document hash (protocol-document-hash)

`564073531177564cd59ae6607d99783fd38f8b5b18088f0aec07b74a84d1a22c`

Same as Stage 1 — references `docs/protocols/e1-dispatch-v1-commitments-v1.md`
committed at `243febd`. Pass this value as `--protocol-document-hash` on every
Stage 2 run invocation.

## Purpose

Stage 2 asks the causal question: does providing executable per-case feedback
at each checkpoint raise the agent's cumulative pass rate on the e1-dispatch-v1
task? Each seed pair (both arms in one bundle) is one paired observation of the
AUC delta (feedback AUC − context AUC).

## Classification

All Stage 2 runs are `causal_pilot` class. They are causal evidence candidates
subject to the analysis rules below. They must not be described as definitive
causal evidence until the full seed matrix is reviewed.

## Model and route

| Parameter | Value |
|---|---|
| Model | `qwen3.7-max` |
| Route | `dashscope-compatible-chat-completions` |
| Key env | `DASHSCOPE_API_KEY` |
| Arms | both (`context_only_spec` + `feedback_capable_spec`) |

## Primary metric and analysis

`checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1` (regression-free AUC),
identical to Stage 1. For each seed pair:

```
delta = feedback_auc - context_auc
```

Report delta, both arm AUCs, spend, turns, and never-pass / flip counts per arm,
for each seed pair. Write a run card for each bundle.

## MCID and decision rule

Minimum clinically important difference: **+0.05 AUC**.

After ≥3 seed pairs:
- If mean delta ≥ +0.05 and all individual deltas > 0: strong positive signal.
- If mean delta ≥ +0.05 but any delta ≤ 0: mixed signal, report as such.
- If mean delta < +0.05: insufficient signal for a positive claim at this task.

No pooling across protocol boundaries. No retroactive gate changes.

## Cost projection and cap

Stage 1 context arm: $0.52 / 12 CP. Feedback arm projected ≈ $0.80 (more
verification calls, feedback assets mounted). Per seed pair cap: **$2.00**.
Three seed pairs: ≈ $3.90 projected, cap $6.00 total.

Each run invocation must include `--cap=2.00`.

## Invocation template

```bash
bun run e1 -- \
  --task=dispatch \
  --arm=both \
  --live \
  --transport=live \
  --cap=2.00 \
  --classification=causal_pilot \
  --model=qwen3.7-max \
  --endpoint=https://ws-5dm04o3gxwrj8eud.eu-central-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions \
  --api-key-env=DASHSCOPE_API_KEY \
  --route-id=dashscope-compatible-chat-completions \
  --protocol-document-hash=564073531177564cd59ae6607d99783fd38f8b5b18088f0aec07b74a84d1a22c \
  --run-id=e1-dispatch-qwen37max-both-causal-seed-a-20260612-001
```

Replace the seed letter and sequence number for subsequent pairs.

## After Stage 2

If the decision rule yields a positive signal: document the evidence in a
public-evidence-status entry and a summary run card. No Stage 3 is predefined;
further seeds, model variants, or tasks require a separate authorization.

If the signal is insufficient: report as null result for this model/task
combination. One design revision (v2) permitted under separate authorization.
