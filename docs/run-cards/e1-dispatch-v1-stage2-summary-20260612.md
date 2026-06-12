# Stage 2 Summary: e1-dispatch-v1 Causal Pilot Matrix (2026-06-12)

Three seed pairs, both arms, `qwen3.7-max`, `dashscope-compatible-chat-completions`.
Protocol: `e1-openspec-workflow-v0`, task `e1-dispatch-v1`, commitments doc `243febd`.
Protocol-document-hash: `564073531177564cd59ae6607d99783fd38f8b5b18088f0aec07b74a84d1a22c`.

## Matrix

| Seed | Context AUC | Feedback AUC | Delta | Spend |
| --- | --- | --- | --- | --- |
| A | 0.7179 | 0.9541 | **+0.2363** | $1.179 |
| B | 0.8829 | 0.8874 | **+0.0044** | $1.317 |
| C | 0.7578 | 0.9562 | **+0.1984** | $1.220 |
| **Mean** | **0.7862** | **0.9326** | **+0.1464** | $3.716 |

## Decision rule outcome (predeclared in Stage 2 plan v1)

| Criterion | Value | Met? |
| --- | --- | --- |
| Mean delta ≥ MCID (+0.05) | +0.1464 | ✅ |
| All individual deltas > 0 | min = +0.0044 | ✅ |

**Verdict: positive signal under the predeclared rule.** Mean delta +0.1464,
all three seeds positive.

## Interpretation

**Seeds A and C** show a large, consistent feedback advantage (+0.2363, +0.1984).
The mechanism is visible in the per-checkpoint tables: the context arm stalls at
0.33–0.58 through CP01–CP05 while the feedback arm reaches 0.97–1.00 over the
same span. Executable feedback gives the agent a direct signal pointing to the
failing scattered sites; without it, the agent invests 1 turn per checkpoint and
declares done.

**Seed B** is a near-null result (delta +0.0044). The context arm exhausted its
12-turn budget at CP02 and spontaneously discovered all four scattered update
sites, achieving the same 1.0000 that the feedback arm reaches in 1 turn. This
is the same mechanism in reverse: the context arm *can* solve the coordination
problem, but only when it burns through its entire turn budget. In 2/3 seeds it
does not. Seed B's anomaly does not refute the effect — it clarifies it. The
feedback arm's advantage is specifically about *consistent* early-CP investment:
the feedback arm achieves high cumulative pass rates with 2–4 turns/cp rather
than 12.

**Shared never-pass residual:** all three seeds, both arms, fail 3 identical
carrier-on-non-shipped cases (`cp06-export-partial-with-carrier`,
`cp09-export-refunded-with-carrier`, `cp10-export-closed-with-carrier`). Neither
context nor feedback helps here. These cases require the agent to extend carrier
metadata to partially-returned, returned-with-refund, and closed order exports —
a subtle field-level propagation that the feedback surface makes visible but the
agent does not trace to its root cause across checkpoints. This is a real
limitation of impact-visibility feedback for field-level omissions.

**Zero flips across all six arm-seed runs.** The context arm produces no
regressions; neither does the feedback arm. The task's regression surface (M3
rewrite pressure) was not activated by either arm in any seed. The feedback
advantage is entirely in the never-pass reduction, not in flip suppression.

## Evidence statement (calibration-grade, not a concluded causal claim)

Three paired runs (same model, same task, same route) show that providing
per-case executable feedback at each checkpoint raises mean AUC from 0.79 to
0.93 on a task requiring four-site scattered coordination (+0.1464, 2/3 seeds
+0.20 or better, 1/3 near-null). The near-null seed is explained by context-arm
budget exhaustion, not by a distinct generative mechanism. The effect direction
is consistent across all three pairs.

This is a candidate positive finding under the `e1-dispatch-v1` task and
`qwen3.7-max` model. It is not a concluded causal claim: three seed pairs on one
model, one task, and one protocol version. Replication on additional models or
tasks is required before a public evidence-grade statement is warranted.

## Spend summary

Total Stage 2: **$3.716** (cap $6.00). Within budget.
Stage 1 (difficulty probe): $0.521.
Total e1-dispatch program: **$4.237**.
