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

**Mechanism validation is therefore inconclusive and a replacement seed-a run is
required** before the Stage 1 ceiling/regression verdict can be read, or before the
DeepSeek V4 Pro probe is justified on the cheap-validation-first logic.
