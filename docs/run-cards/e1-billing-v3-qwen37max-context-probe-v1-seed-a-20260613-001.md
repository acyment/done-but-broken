# Run Card: e1-billing-v3-qwen37max-context-probe-v1-seed-a-20260613-001

| Field | Value |
| --- | --- |
| Run ID | `e1-billing-v3-qwen37max-context-probe-v1-seed-a-20260613-001` |
| Date | 2026-06-13 |
| Task | `e1-billing-v3` (18 checkpoints, 197 oracle cases) |
| Classification | `difficulty_probe` |
| Condition | `context_only_spec` |
| Model / route | `qwen3.7-max`, `dashscope-compatible-chat-completions` (direct) |
| Plan | `docs/protocols/e1-billing-v3-stage1-plan-v1.md` (commitments `28c72f20`) |
| Status | **`invalid_run=true`, `provider_error`** — excluded, replaceable once |
| Spend | $0.740 (cap $15.00) |
| Reached | CP01–CP07 complete; **died 0 turns into CP08** |

## CORRECTION (2026-06-13): this run was redundant and should not have been fired

The billing-v3 Stage 1 question was **already cleanly answered on 2026-06-11** by
`e1-billing-v3-qwen37max-context-probe-v1-seed-a-20260611-001` (AUC 0.9628, zero
on-graph regressions, `valid=true`, criterion-3 PASS). That run was a **clean ceiling**;
it activated the third-ceiling closure rule and closed the billing domain
(`AGENTS.md`). This 2026-06-13 run was fired without checking for the prior completed
probe — it was unnecessary, and its provider-timeout death is moot: the Stage 1 verdict
was not "inconclusive," it was a clean ceiling two days earlier. Do not treat this run
as requiring a replacement. Recorded honestly as an operator/agent error (redundant
re-execution; $0.74 spent for no information).

## Why it is invalid

CP08 terminated `{"classification":"provider_error","reason":"provider retries
exhausted after 3 attempts: The operation timed out."}` — a transient DashScope
endpoint timeout, zero turns into the checkpoint. Not a task or harness defect:
caching engaged (962,944 cached input tokens, `cached_input_tokens > 0` confirmed),
CP01–CP07 ran normally. Per the Stage 1 plan's validity rules, a provider-flagged
run is recorded, excluded, and may be **replaced once** under the identical
boundary; two consecutive same-mode provider failures stop the probe for profile
revision.

## Partial data (CP01–CP07, descriptive only — run is invalid, do not use for the gate)

| CP | Turns | Passed/Total | Rate |
| --- | --- | --- | --- |
| CP01 | 1 | 10/10 | 1.0000 |
| CP02 | 1 | 21/21 | 1.0000 |
| CP03 | 4 | 32/32 | 1.0000 |
| CP04 | 3 | 42/42 | 1.0000 |
| CP05 | 12 | 54/54 | 1.0000 |
| CP06 | 7 | 64/64 | 1.0000 |
| CP07 | 1 | 64/79 | 0.8101 |
| CP08 | 0 | — | died (provider timeout) |

**Regressions through CP07: 0. I-REPLAY/hash regressions: 0.**

## Interpretation (limited)

The decisive part of the task was never reached. billing-v3's regression mechanism
(M2) lands the *forced* whole-file rewrites of frozen-invariant files at **CP13
(`audit.ts`), CP15 (`serializers.ts`), CP17 (`money.ts`), CP18**, and 13/18
checkpoints perturb the I-REPLAY hash spine. The run died at CP08 — before any forced
rewrite. So the CP01–CP07 result (hash spine held perfectly through CP06; CP07's dip
is a 1-turn premature-"done" leaving new cases unsolved, **not** a regression of
earlier cases) only confirms the expected baseline: a strong model maintains frozen
behavior it is **not required to touch** — the same billing-v2 observation the v3
design was built to defeat. Whether the forced rewrites break the spine is untested.

**[SUPERSEDED by the correction above.]** This run reached only CP07, before the
forced-rewrite checkpoints. But the 2026-06-11 run completed all 18 checkpoints and
returned a clean ceiling (0.9628, zero regressions), so the Stage 1 verdict is **not**
inconclusive and **no replacement is required**. The 2026-06-11 result also empirically
confirms the five-critique finding: the hash-spine/forced-rewrite design does not induce
regressions in a strong context arm — i.e., it produces a frontier null, as predicted.
