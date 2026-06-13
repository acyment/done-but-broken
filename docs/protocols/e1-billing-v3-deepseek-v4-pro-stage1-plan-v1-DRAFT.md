# e1-billing-v3 DeepSeek V4 Pro Stage 1 Frontier Difficulty Probe — Plan v1 (DRAFT FOR CRITIQUE)

Date drafted: 2026-06-13. **Status: DRAFT — not sealed, no commitments computed, authorizes
no runs.** This plan is published for external critique before any DeepSeek V4 Pro spend on
billing-v3. It mirrors the sealed Qwen 3.7 Max plan (`e1-billing-v3-stage1-plan-v1.md`) with a
different model/route. The task package itself is already sealed and unchanged
(`e1-billing-v3-commitments-v1.md`, hashes verified no-drift 2026-06-13); only the
model/route/pricing/cost boundary differs here.

## Why DeepSeek V4 Pro, and why now

The program's open question is whether per-case executable feedback helps a **top frontier
model**, or whether the benefit is a mid-tier-only effect that vanishes as a model's natural
turn-investment rises (the literature-confirmed ceiling/redundancy effect; see
`docs/research/executable-feedback-frontier-hardness-synthesis-v1.md`). DeepSeek V4 Pro is the
strongest model we have characterized: it **ceilinged the `e1-dispatch-v1` context arm 3/3
seeds** (AUC 0.9310–0.9824) by brute-forcing scattered-coordination difficulty with 8
turns/checkpoint. A demonstration that feedback helps *this* model on *this* task is the
credible frontier result the program needs; a win on a weaker model is not.

billing-v3's difficulty is a **different kind** from dispatch's, chosen precisely because
dispatch's "find the scattered sites" difficulty is brute-forceable: more turns = exhaustive
search finds the sites. billing-v3 instead concentrates on a **seeded deterministic hash spine**
(`replayStateHash`, FNV-1a over a canonical state serialization, specified and seeded from
CP01) that 13/18 checkpoints perturb, combined with **forced whole-file rewrites** of frozen
files (CP13 `audit.ts`, CP15 `serializers.ts`, CP17 `money.ts`, CP18 idempotency). The
hypothesized asymmetry: **you cannot verify a hash by reading** — no amount of turn investment
substitutes for executing it — so a registry slip during a forced rewrite silently breaks every
prior checkpoint's hash case, invisibly to the context arm and visibly to the feedback arm.

## Boundary

| Field | Value |
| --- | --- |
| Task | `e1-billing-v3`, CP01–CP18 (sealed; commitments `e1-billing-v3-commitments-v1.md`) |
| Design boundary | `billing-v3-task-design-v1.md` (sealed, hash `55c995d4…`) |
| Protocol profile | `e1-openspec-workflow-v0` (sealed 1.0.0) over base constants `e1-frontier-sealed-constants-v1.0.json` (sealed 1.0.0) |
| Run classification | `difficulty_probe` (not causal evidence) |
| Condition | `context_only_spec` only; up to 3 runs `seed-a/b/c`, sequential with a read between, early-stop rule applies |
| Model / route | `deepseek-v4-pro`, route `deepseek-v4-pro-direct`, endpoint `https://api.deepseek.com/v1/chat/completions`, key env `DEEPSEEK_API_KEY` |
| Budgets | sealed constants: 12 turns/checkpoint, 6 verification executions/checkpoint, 4000 output tokens/turn (unchanged from the Qwen plan) |
| Pricing | input $0.435 / cached $0.003625 / output $0.870 per Mtok (as used in the dispatch DeepSeek runs) |
| Primary metric | hidden-oracle `checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1` (regression-free AUC) |

A verdict under this plan is a statement about **DeepSeek V4 Pro on billing-v3**, never pooled
with any Qwen, Sonnet, billing-v2, or dispatch observation, nor across model/route/profile/
task-version changes.

## Predeclared probe gate (pass = the task is frontier-valid for a Stage 2 causal pilot)

Identical criteria to the Qwen plan, evaluated over the clean context runs:

1. Mean context regression-free AUC **≤ 0.92**.
2. Mean **≥ 2 on-graph drift regressions** per run — a regression is a hidden-oracle check that
   passes at some checkpoint end and fails at a later checkpoint end; "on-graph" means the
   failing checkpoint lists the check's introducing checkpoint in its perturbation set in the
   frozen interaction graph.
3. Failures are **drift, not structural** — all of: no protocol-usability stall flag;
   `output_truncated_turn_rate` ≤ 0.10 per run and no checkpoint with 3+ consecutive
   length-terminated turns; source capture confirms real multi-file edits.

Outcomes (no reinterpretation after results):

- **Gate passes** → a Stage 2 two-arm causal pilot on DeepSeek V4 Pro may be proposed (separate
  authorization; MCID +0.05 paired hidden-oracle AUC delta; two-look group-sequential rule).
  **This is the path to the frontier win.**
- **Clean ceiling** (criterion 1 or 2 fails, criterion 3 passes) → boundary result; the
  third-ceiling closure logic applies. If DeepSeek V4 Pro also ceilings billing-v3 cleanly, the
  billing domain is closed for frontier discrimination and a genuinely new mechanism — not a
  larger task — is required. **This would mean the frontier win is not available via this task
  family**, and we stop rather than iterate.
- **Structural failures dominate** (criterion 3 fails) → no claim; redesign before more spend.

## Early-stop rule (predeclared)

If seed-a returns a clean (criterion-3-passing) run with AUC > 0.92 **and** zero on-graph
regressions, seeds b/c are not fired — the ceiling boundary is already determined. Stops early
only on the ceiling side, never to rescue a pass. A provider-flagged/invalid seed-a may be
replaced once; two consecutive same-mode provider failures stop the probe for profile revision.

## Sequencing dependency (recommended, not binding)

The cheap Qwen mechanism-validation (`e1-billing-v3-stage1-plan-v1.md`) should return a **clean,
complete** seed-a showing the forced-rewrite checkpoints (CP13+) actually induce hash
regressions, before this DeepSeek probe is fired. The first Qwen attempt
(`…-20260613-001`) died at CP08 on a provider timeout — **before any forced rewrite** — so the
mechanism is not yet validated end-to-end on any model. Rationale: a clean Qwen ceiling (zero
regressions even for a weaker model) would predict a DeepSeek ceiling and make the DeepSeek spend
wasteful. A Qwen regression is necessary-but-not-sufficient for a DeepSeek regression (DeepSeek
is more careful and may reproduce the registry correctly where Qwen slips). This ordering is a
spend-efficiency recommendation; the operator may override it.

## Cost (projected from the dispatch DeepSeek runs)

Dispatch DeepSeek V4 Pro: 12 checkpoints / 98 turns / **$0.257** (caching engaged: 2.53M cached
input tokens at $0.003625). billing-v3 is larger (18 checkpoints, 197 vs 141 oracle cases, 10
files, bigger growing workspace snapshot). Projection: **≈ $0.60–1.00/run** with caching,
**≈ $2.50/run** worst-case zero caching. Per-call guardrail `--max-call-cost 0.10`. Suggested
cap: **$4** for the first run (ample headroom), $2 once caching is confirmed.

Prompt caching: DeepSeek applies automatic server-side prefix caching, reported in
`usage.prompt_tokens_details`. The dispatch runs used the runner default (prompt-cache on) and
caching engaged. This plan mirrors that (no `--prompt-cache off`). The first run must confirm
`cached_input_tokens > 0`; if not, stop and investigate before further seeds. *(Open config
question flagged for critique — see the critique summary.)*

## Invocation template (requires explicit authorization; not sealed yet)

```
bun run e1 -- --task=billing-v3 --arm=context --live --transport=live \
  --model deepseek-v4-pro --endpoint https://api.deepseek.com/v1/chat/completions \
  --route-id deepseek-v4-pro-direct --api-key-env DEEPSEEK_API_KEY \
  --classification=difficulty_probe \
  --input-usd-per-mtok 0.435 --cached-input-usd-per-mtok 0.003625 --output-usd-per-mtok 0.870 \
  --max-call-cost 0.10 --cap <operator-cap> \
  --protocol-document-hash <sealed-commitments-or-this-plan-hash-once-sealed> \
  --run-id e1-billing-v3-deepseek-v4-pro-context-probe-v1-seed-a-20260613-001
```

## Before this runs (seal checklist, after critique is incorporated)

1. Incorporate external critique; revise the design/plan if warranted.
2. Author `e1-billing-v3-deepseek-v4-pro-commitments-v1.md` (or extend the existing commitments
   doc with the DeepSeek route row), commit-then-reveal, and compute the
   `--protocol-document-hash`.
3. Confirm the Qwen mechanism-validation completed clean (recommended sequencing).
4. Obtain explicit operator authorization + cap.

## Post-run (per the sealed-plan discipline)

1. `bun run e1:inspect -- --task billing-v3` → confirm `valid=true` (full replay incl. archive).
2. `bun run e1:stats -- --bundle <run-id>` → record AUC, on-graph regression count,
   `output_truncated_turn_rate`, `cached_input_tokens`.
3. Write a `difficulty_probe` run card. Apply the early-stop / closure rules.
