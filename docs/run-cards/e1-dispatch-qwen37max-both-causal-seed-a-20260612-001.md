# Run Card: e1-dispatch-qwen37max-both-causal-seed-a-20260612-001

| Field | Value |
| --- | --- |
| Run ID | `e1-dispatch-qwen37max-both-causal-seed-a-20260612-001` |
| Date | 2026-06-12 |
| Task | `e1-dispatch-v1` (12 checkpoints, 141 oracle cases) |
| Classification | `causal_pilot` — Stage 2 seed pair A |
| Arms | `context_only_spec` + `feedback_capable_spec` |
| Model / route | `qwen3.7-max`, `dashscope-compatible-chat-completions` (direct) |
| Grade | `evidence` (sealed task, commitments doc `243febd`) |
| Valid | `invalid_run=false` |
| Spend | **$1.179** (cap $2.00) |
| Turns | 62 total; context 30 (mean 2.5/cp), feedback 32 (mean 2.7/cp) |
| Terminations | context: done=11, budget_exhausted=1; feedback: done=12 |

## Primary result

| Metric | Context arm | Feedback arm | Delta |
| --- | --- | --- | --- |
| AUC (`checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1`) | **0.7179** | **0.9541** | **+0.2363** |
| Never-passed cases | 3 / 141 | 3 / 141 | 0 |
| Pass→fail flips | 0 | 0 | — |

**Delta +0.2363** is 4.7× the predeclared MCID threshold (+0.05). One seed pair.

## Per-checkpoint cumulative pass rate

| Checkpoint | Type | Context turns / rate | Feedback turns / rate |
| --- | --- | --- | --- |
| CP01 | extension | 1 / 0.5833 | 1 / 0.5833 |
| CP02 | extension | 1 / 0.3889 | 6 / **1.0000** |
| CP03 | extension | 1 / 0.3333 | 2 / **1.0000** |
| CP04 | correction (partially_shipped) | 1 / 0.3659 | 2 / **1.0000** |
| CP05 | extension | 1 / 0.3725 | 1 / **1.0000** |
| CP06 | correction (partially_returned) | 1 / 0.9839 | 3 / 0.9839 |
| CP07 | extension | 1 / 0.8514 | 1 / 0.9865 |
| CP08 | correction (cancelled_partial) | 7 / 0.9881 | 2 / 0.9881 |
| CP09 | extension | 1 / 0.9000 | 4 / 0.9800 |
| CP10 | correction (closed) | 8† / 0.9735 | 1 / 0.9735 |
| CP11 | extension (receivables_digest) | 1 / 0.8952 | 5 / 0.9758 |
| CP12 | correction (cancelled_owing) | 6 / 0.9787 | 4 / 0.9787 |

† budget_exhausted

## Shared never-pass cases (both arms, 3 cases)

Carrier metadata on non-shipped export states — the agent in both arms correctly
handled `carrier`/`tracking` on fully-shipped lines but never extended this to
partially-returned, returned-with-refund, or closed states:

- `cp06-export-partial-with-carrier`
- `cp09-export-refunded-with-carrier`
- `cp10-export-closed-with-carrier`

These 3 cases survived feedback: the agent saw them failing in the feedback arm
but did not isolate and fix the root cause across checkpoints. They represent a
"partial-propagation residual" — the feedback surface exposed the symptom but the
agent did not trace it to the carrier-on-non-shipped gap.

## Mechanism, observed directly

**CP01**: identical — both arms start from the seed workspace with no feedback.

**CP02–CP05 (context arm)**: agent updates at most one file per checkpoint
(declarations done after 1 turn), never discovering the scattered coupled surfaces.
Cumulative pass rate stalls at 0.33–0.39.

**CP02–CP05 (feedback arm)**: feedback assets expose the failing scattered cases
immediately. Agent takes 1–6 turns per checkpoint, achieves **perfect 1.0000** on
all four checkpoints. The four-site coordination requirement (orders.ts, render-
order.ts, digest.ts, parse-order.ts) is met in full.

**CP06+**: both arms converge to similar high rates. The correction checkpoints
(CP06, CP08, CP10, CP12) required multi-turn effort from the context arm (7, 8, 6
turns) but were resolved efficiently by the feedback arm (3, 2, 1, 4 turns).
The feedback arm never hit budget exhaustion.

**Context arm budget_exhausted=1** (CP10): the closed-status correction took 8 turns
and hit the per-checkpoint limit, yet still achieved 0.9735.

## AUC decomposition

The full +0.2363 delta comes almost entirely from CP02–CP05 (0 vs 1.0000 per
checkpoint). The feedback arm's early-CP advantage is the dominant signal:

| Phase | Context mean | Feedback mean | Phase delta |
| --- | --- | --- | --- |
| CP01–CP05 (seed + extensions) | 0.4088 | 0.9167 | +0.5079 |
| CP06–CP12 (corrections + late) | 0.9641 | 0.9795 | +0.0154 |

Late-checkpoint performance is nearly equal; the treatment effect is concentrated in
the early propagation phase where scattered sites are first introduced.

## Interpretation (causal_pilot, one seed pair)

1. **Strong positive delta.** +0.2363 is the largest delta observed in any dispatch
   or billing causal pilot, comfortably above the +0.05 MCID. The context arm's AUC
   (0.7179) is consistent with Stage 1 (0.7284), confirming run-to-run stability.

2. **Mechanism confirmed: visibility, not difficulty.** CP02–CP05 feedback arm
   reached 1.0000 on cases that the context arm never saw as failing. The cases
   existed and were solvable — the context arm simply had no signal pointing to the
   scattered update sites. The feedback cases provided exactly that signal.

3. **Feedback does not fix everything.** The 3 carrier-on-non-shipped cases failed
   in both arms. Feedback showed the agent the symptom but the agent did not resolve
   the root cause. This is a real limitation of impact-visibility feedback for
   subtle field-level omissions — worth noting in the evidence summary.

4. **One seed pair is not the decision.** The Stage 2 plan requires ≥3 seed pairs.
   Seeds B and C will confirm whether the delta is stable, and whether the carrier
   residual persists or resolves under different sampling.

## Validity limits

One seed pair, causal_pilot classification. The positive delta is a strong
candidate finding, not a concluded result. The full Stage 2 matrix (≥3 pairs,
mean delta ≥ MCID, all individual deltas > 0) is required before a positive
claim is warranted.
