# e1-billing-v2 Stage 1 Frontier Difficulty Probe — Sealed Analysis Plan (v1)

Date sealed: 2026-06-11. Predeclared before any provider run on this task. Execution requires explicit operator authorization; this document only fixes what an authorized run means.

## Boundary

| Field | Value |
| --- | --- |
| Task | `e1-billing-v2` version `e1-billing-v2-v1`, checkpoints CP01–CP18 |
| Protocol profile | `e1-openspec-workflow-v0` (sealed 1.0.0) over base constants `e1-frontier-sealed-constants-v1.0.json` (sealed 1.0.0) |
| Run classification | `difficulty_probe` (not causal evidence) |
| Condition | `context_only_spec` only; 3 runs with pairing labels `seed-a`, `seed-b`, `seed-c` |
| Model/route | `anthropic/claude-sonnet-4.6` via OpenRouter chat completions (`openrouter-chat-completions`) — the historically clean provider profile in this repo |
| Budgets | sealed constants: 12 turns/checkpoint, 6 verification executions/checkpoint, 4000 output tokens/turn |
| Primary metric | hidden-oracle `checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1` (regression-free AUC) |
| Bundle grade | evidence requires the sealed constants plus `--protocol-document-hash` of this plan's commitments doc at invocation |

Hashes for every sealed artifact are published in `e1-billing-v2-commitments-v1.md` (commit-then-reveal: the oracle package stays private until publication; it is executed only against captured snapshots).

## Predeclared probe gate (pass = the task is frontier-valid for Stage 2)

All of, evaluated over the 3 clean context runs:

1. Mean context regression-free AUC ≤ 0.92.
2. Mean ≥ 2 on-graph drift regressions per run — a regression is a hidden-oracle check that passes at some checkpoint end and fails at a later checkpoint end; "on-graph" means the failing checkpoint lists the check's introducing checkpoint in its perturbation set in the design doc's interaction graph (`billing-v2-task-design-v1.md`).
3. Failures are drift, not structural: early invariants are broadly preserved, no protocol-usability stall flag (sealed stall-reporting rule), and source-code capture confirms real multi-file edits.

Outcomes (no reinterpretation after results):

- **Gate passes** → Stage 2 causal pilots may be proposed (separate authorization; MCID +0.05 paired hidden-oracle AUC delta; two-look group-sequential rule per the design doc).
- **Context ceilings (AUC > 0.92 or < 2 on-graph regressions)** → boundary result only. No on-the-fly escalation: extending the task requires a new sealed design revision and task version.
- **Structural failures dominate** → no claim; task invalid for frontier drift; redesign under a new version before more spend.
- An optional single `feedback_capable_spec` feasibility run is pre-authorized to follow only if the gate passes, classification `calibration`.

## Validity rules

- Clean run = inspection `valid=true` via `bun run e1:inspect -- --task billing-v2` (full replay including archive steps), no provider validity flags, no carry-forward.
- Provider-flagged or invalid runs are recorded, excluded, and may be replaced once under the identical boundary; two consecutive same-mode provider failures stop the probe for profile revision under a new boundary.
- No pooling with CartCalc, pricing, payroll, subscription, or inventory runs, nor across model/route/profile/task-version changes.
- The survival ledger (OpenSpec scenario drops) is secondary descriptive context, never the gate.

## Isolated competence (NOT part of the probe)

Required before Stage 2 causal pilots only, per checkpoint, context-channel, one seed (second seed on failure; `capability_limited` only at 0/2). Harness support exists (`--baseline-dir` + `--checkpoint`, baseline overlay recorded in the bundle and replay-verified). Precondition: the per-checkpoint reference stage trajectory must be built and frozen first — stages `cp04`, `cp09`, `cp14` exist (`tasks/e1-billing-v2/materialize-stage.ts`); the remaining 14 per-checkpoint stages are a build gate before Stage 2 entry, each verified by the frozen-baseline property (passes ≤ k−1, fails ≥1 new case at k).

## Cost

Sonnet 4.6 via OpenRouter (~$3/M input, $15/M output). Per run: 18 checkpoints × t turns; the billing workspace snapshot is materially larger than CartCalc (10 source files re-injected fresh at each checkpoint start, cached within a checkpoint). Planning range using calibrated t∈[2, 8]: roughly $1.50–$8 per run, $5–$25 for the 3-seed probe. The operator sets `--cap` per invocation; a run hitting the cap is `spend_cap_reached`, excluded, and rerun under a fresh identity only with renewed authorization.

## Invocation template (requires explicit authorization)

```
bun run e1 -- --task=billing-v2 --arm=context --live --transport=live \
  --model anthropic/claude-sonnet-4.6 --route-id openrouter-chat-completions \
  --api-key-env OPENROUTER_API_KEY --classification=difficulty_probe \
  --cap <operator-cap> --protocol-document-hash <commitments-doc-sha256> \
  --run-id e1-billing-v2-sonnet-context-probe-seed-a-<date>-001
```

(Plus the OpenRouter Sonnet pricing flags for the derived-spend guardrail; provider-reported cost remains cost-of-record when present.)
