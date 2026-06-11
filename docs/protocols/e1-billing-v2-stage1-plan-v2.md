# e1-billing-v2 Stage 1 Frontier Difficulty Probe — Sealed Analysis Plan (v2)

Date sealed: 2026-06-11. Supersedes `e1-billing-v2-stage1-plan-v1.md` after the v1 probe's
predeclared structural verdict (run card
`docs/run-cards/e1-billing-v2-sonnet-context-probe-seed-a-20260611.md`); v1 task runs are
burned and never pooled with v2. Execution requires explicit operator authorization; this
document only fixes what an authorized run means.

## Boundary

| Field | Value |
| --- | --- |
| Task | `e1-billing-v2` version `e1-billing-v2-v2`, checkpoints CP01–CP18 |
| Design boundary | `billing-v2-task-design-v1.md` as amended by `billing-v2-task-design-v2.md` |
| Protocol profile | `e1-openspec-workflow-v0` (sealed 1.0.0) over base constants `e1-frontier-sealed-constants-v1.0.json` (sealed 1.0.0) |
| Run classification | `difficulty_probe` (not causal evidence) |
| Condition | `context_only_spec` only; 3 runs with pairing labels `seed-a`, `seed-b`, `seed-c`, fired sequentially with a read between runs |
| Model/route | `anthropic/claude-sonnet-4.6` via OpenRouter chat completions (`openrouter-chat-completions`) |
| Budgets | sealed constants: 12 turns/checkpoint, 6 verification executions/checkpoint, 4000 output tokens/turn |
| Primary metric | hidden-oracle `checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1` (regression-free AUC) |
| Bundle grade | evidence requires the sealed constants plus `--protocol-document-hash` of this plan's commitments doc at invocation |

Hashes for every sealed artifact are published in `e1-billing-v2-commitments-v2.md`
(commit-then-reveal; the oracle package stays private until publication and executes only
against captured snapshots).

## Predeclared probe gate (pass = the task is frontier-valid for Stage 2)

All of, evaluated over the 3 clean context runs:

1. Mean context regression-free AUC ≤ 0.92.
2. Mean ≥ 2 on-graph drift regressions per run — a regression is a hidden-oracle check
   that passes at some checkpoint end and fails at a later checkpoint end; "on-graph"
   means the failing checkpoint lists the check's introducing checkpoint in its
   perturbation set in the frozen interaction graph (`billing-v2-task-design-v1.md`).
3. Failures are drift, not structural — all of:
   - no protocol-usability stall flag (sealed stall-reporting rule);
   - `output_truncated_turn_rate` ≤ 0.10 per run (model-output `finish_reason=length`,
     measured by `bun run e1:stats`), and no checkpoint with 3+ consecutive
     length-terminated turns (design v2, Amendment 3);
   - source-code capture confirms real multi-file edits.

Outcomes (no reinterpretation after results):

- **Gate passes** → Stage 2 causal pilots may be proposed (separate authorization; MCID
  +0.05 paired hidden-oracle AUC delta; two-look group-sequential rule per the design doc).
- **Context ceilings (AUC > 0.92 or < 2 on-graph regressions)** → boundary result only. No
  on-the-fly escalation: extending the task requires a new sealed design revision and task
  version.
- **Structural failures dominate (criterion 3 fails)** → no claim; redesign under a new
  version before more spend.
- An optional single `feedback_capable_spec` feasibility run is pre-authorized to follow
  only if the gate passes, classification `calibration`.

## Validity rules

- Clean run = inspection `valid=true` via `bun run e1:inspect -- --task billing-v2` (full
  replay including archive steps), no provider validity flags, no carry-forward.
- Provider-flagged or invalid runs are recorded, excluded, and may be replaced once under
  the identical boundary; two consecutive same-mode provider failures stop the probe for
  profile revision under a new boundary.
- No pooling with v1 billing runs, CartCalc, pricing, payroll, subscription, or inventory
  runs, nor across model/route/profile/task-version changes.
- The survival ledger (OpenSpec scenario drops) is secondary descriptive context, never
  the gate.

## Isolated competence (NOT part of the probe)

Unchanged from v1 plan: required before Stage 2 causal pilots only, per checkpoint,
context-channel, one seed (second seed on failure; `capability_limited` only at 0/2).
Stages `cp04`, `cp09`, `cp14` exist in the v2 split layout
(`tasks/e1-billing-v2/materialize-stage.ts`); the remaining per-checkpoint stages are a
build gate before Stage 2 entry.

## Cost (measured, not projected)

The v1 seed-a-002 run measured the real cost envelope with prompt caching live: $8.92 for
18 checkpoints (79% of input tokens cached, 89 turns). v2 runs should land at or below
this (the split layout reduces per-file rewrite sizes). Per-run cap: the operator sets
`--cap` per invocation; `--max-call-cost 0.40` so the derived-spend guardrail stops a run
before the cap can be breached by one call. A run hitting the cap is `spend_cap_reached`,
excluded, and rerun under a fresh identity only with renewed authorization.

## Invocation template (requires explicit authorization)

```
bun run e1 -- --task=billing-v2 --arm=context --live --transport=live \
  --model anthropic/claude-sonnet-4.6 --route-id openrouter-chat-completions \
  --api-key-env OPENROUTER_API_KEY --classification=difficulty_probe \
  --input-usd-per-mtok 3 --cached-input-usd-per-mtok 0.3 --output-usd-per-mtok 15 \
  --max-call-cost 0.40 --cap <operator-cap> \
  --protocol-document-hash <commitments-v2-doc-sha256> \
  --run-id e1-billing-v2-sonnet-context-probe-v2-seed-a-<date>-001
```

Prompt-cache breakpoints default on for live transport (`--prompt-cache off` to disable;
do not disable for evidence runs). Provider-reported cost remains cost-of-record when
present; the configured prices drive only the cap guardrail.
