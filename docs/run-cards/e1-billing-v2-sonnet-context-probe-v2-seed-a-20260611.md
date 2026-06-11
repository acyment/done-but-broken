# Run Card: e1-billing-v2-v2 Stage 1 frontier difficulty probe, seed-a (2026-06-11)

## Claim Level

Difficulty-probe observations, not causal evidence. Per the sealed analysis plan
(`docs/protocols/e1-billing-v2-stage1-plan-v2.md`), the predeclared gate is evaluated below;
the outcome classification is **structural failures dominate (criterion 3 failed) → no
claim; redesign under a new version before more spend**. Nothing in this card supports a
treatment-effect claim. The headline AUC must not be quoted as a drift measurement: it is
high, but 25.6% of turns were lost to output truncation, so it is not a clean ceiling
measurement either.

## Run

| Run ID | Status | Disposition |
| --- | --- | --- |
| `e1-billing-v2-sonnet-context-probe-v2-seed-a-20260611-001` | `completed`, `invalid_run=false`, inspection `valid=true` (86 replay steps, 0 mismatches) | Replay-valid; gate evaluated on this run |

Identity: task `e1-billing-v2-v2`, profile `e1-openspec-workflow-v0` 1.0.0 over base
constants 1.0.0, condition `context_only_spec` only, classification `difficulty_probe`,
model `anthropic/claude-sonnet-4.6` via `openrouter-chat-completions`, grade `evidence`
with `--protocol-document-hash` of `e1-billing-v2-commitments-v2.md`
(`bb44e154ec471e7c903a03b954bebf035f61c0d69e5bbe5a8a52d96501be2d62`). Invocation carried
the Amendment 4 pricing flags ($3/$0.30/$15 per Mtok), `--max-call-cost 0.40`, `--cap
10.00`, prompt-cache breakpoints on.

Cost: provider-reported $9.08 (cost of record; derived $8.11). 5,451,212 cached vs
1,287,086 fresh input tokens (81% cached), 174,296 output tokens, 86 turns.

Inspection note (tooling defect found and fixed during this analysis): the first
`e1:inspect` pass reported `valid=false` with a single `oracle_scoring` mismatch. Diffing
recorded vs re-scored objects showed every pass/fail value identical; the only differences
were absolute scoring-tmp directory paths embedded in failure `details` strings (the
rescore necessarily runs in a different tmp root than the original run). The comparison in
`src/e1-inspect.ts` was made path-insensitive for `details` strings only (test-first, with
a tamper test proving pass/fail flips are still caught). Re-inspection: `valid=true`,
0 mismatches. Pass/fail content was never in question.

## Headline Numbers (context arm)

- Regression-free AUC (`checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1`): **0.9929**
- Checkpoint-end cumulative pass rates: CP01–CP15 all 1.000; CP16 0.9926 (135/136);
  CP17 0.9375 (135/144); CP18 0.9412 (144/153).
- Protocol health: `agent_stalled_checkpoint_rate=0` (the v1 stall pathology is gone),
  `output_truncated_turn_rate=0.2558` (22/86 turns ended `finish_reason=length` at exactly
  4000 completion tokens), mean 4.78 turns/checkpoint, `no_op_turn_rate=0.0233`,
  violation rate 0.2791 (19 `unclosed_file_block` — the truncation signature — plus 10
  `multiple_verify_blocks`, 1 each `duplicate_file_path`/`unclosed_verify_block`).
- Terminations: 15 checkpoints `done`; CP07, CP17, CP18 `budget_exhausted` (verification
  budget).

## Gate Evaluation (predeclared, sealed plan v2 §"Predeclared probe gate")

1. Mean context AUC ≤ 0.92 — **FAILED** (0.9929).
2. Mean ≥ 2 on-graph drift regressions — **FAILED**: zero regressions. No hidden-oracle
   check that passed at any checkpoint end failed at a later checkpoint end. All 9
   end-state failures are checks that never passed from their introducing checkpoint:
   `cp16-recompute-finalized-h` (I-IMMUT) and all eight CP17 `replay_hash` checks
   (I-REPLAY). These are capability/spec-hardness failures, not drift.
3. Failures are drift, not structural — **FAILED**. `output_truncated_turn_rate` 0.2558 >
   0.10, and CP07 opened with 4 consecutive length-terminated turns (3+ trips the
   Amendment 3 rule). No stall flag; source capture confirms real multi-file edits.

Predeclared outcome mapping: criterion 3 failed → **structural failures dominate → no
claim; redesign under a new version before more spend.** Seeds b and c are NOT run under
this boundary. The optional feedback-arm feasibility run is not triggered.

## Root Cause (differs from v1)

The v2 split fixed the per-file emission ceiling (gate 6 holds: largest file 1,372
estimated tokens, all turns that emit one file fit). The remaining truncation mechanism is
**multi-file batching**: the agent repeatedly tried to emit several (often all four)
billing modules in a single response — ~4,400+ tokens of code before prose — and hit the
sealed 4000-token cap mid-file. CP07 (coupons + proration integration) lost 5 of 12 turns
this way before forcing a path through. Nothing in the task tells the agent that turn
output is capped or that one-file-per-turn is the viable strategy; the README's
"keep files small" instruction addresses file size, not response packing.

## Honest Secondary Observations (descriptive only, no gate weight)

- **The drift surface did not trip a frontier model when expressibility held.** Unlike the
  v1 run (CP07 `coupons.length` on-graph regression), this run shows zero cross-checkpoint
  regressions despite 22 wasted turns. Sonnet 4.6 re-read the workspace and rebuilt
  cleanly within each checkpoint. This is directional evidence that even a truncation-free
  v3 probe may return a **context-ceiling** verdict (AUC > 0.92, < 2 regressions) rather
  than gate-pass — the predeclared "boundary result only" outcome.
- The CP17 `replay_hash` failure mode is prose-spec hardness, not drift: 7 turns, zero
  truncations, verification budget exhausted, all 8 replay-hash checks failing from
  introduction. The visible spec's hash definition appears under-determined for an agent
  that cannot execute it (the feedback arm could check it; the context arm cannot).
- Prompt caching held: 81% of input tokens cached; $9.08 all-in at Sonnet pricing —
  within the $8.92 ± envelope measured in v1.

## Artifacts

- Bundle: `runs/e1-billing-v2-sonnet-context-probe-v2-seed-a-20260611-001/` (per-turn
  workspace captures under `oracle-tmp/`).
- Inspection: `bun run e1:inspect -- --task billing-v2 --bundle <bundle>` → `valid=true`,
  0 mismatches (after the path-normalization fix in `src/e1-inspect.ts`).
- Required follow-up before any further billing-v2 spend: task revision as
  `e1-billing-v2-v3` adding an explicit one-file-per-turn output-discipline instruction to
  the mounted README (task-environment property, identical in both arms), new commitments
  document, and renewed authorization.
