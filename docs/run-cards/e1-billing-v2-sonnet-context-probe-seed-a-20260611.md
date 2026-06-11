# Run Card: e1-billing-v2 Stage 1 frontier difficulty probe, seed-a (2026-06-11)

## Claim Level

Difficulty-probe observations, not causal evidence. Per the sealed analysis plan
(`docs/protocols/e1-billing-v2-stage1-plan-v1.md`), the predeclared gate is evaluated below;
the outcome classification is **structural failures dominate → no claim; task invalid for
frontier drift in its current version; redesign under a new version before more spend**.
Nothing in this card supports a treatment-effect claim, and the headline AUC must not be
quoted as a drift measurement (it is confounded by a protocol-budget ceiling; see Gate
Evaluation).

## Runs

| Run ID | Status | Disposition |
| --- | --- | --- |
| `e1-billing-v2-sonnet-context-probe-seed-a-20260611-001` | `provider_error` (HTTP 402 at CP14 turn 9 — OpenRouter account exhausted) | Invalid; recorded and excluded per plan; replaced once under the identical boundary |
| `e1-billing-v2-sonnet-context-probe-seed-a-20260611-002` | `completed`, `invalid_run=false`, inspection `valid=true` (89 replay steps, 0 mismatches) | Clean structurally; gate evaluated on this run |

Common identity (both runs): task `e1-billing-v2-v1`, profile `e1-openspec-workflow-v0` 1.0.0
over base constants 1.0.0, condition `context_only_spec` only, classification
`difficulty_probe`, model `anthropic/claude-sonnet-4.6` via `openrouter-chat-completions`,
grade `evidence` with `--protocol-document-hash` of `e1-billing-v2-commitments-v1.md`
(`2bad483b2f138962a6a4854458de1149d2bdfd9f1e50b0e61b5694a7e73efcca`).

Run `-001` additionally had two invocation defects fixed before `-002`: pricing flags were
omitted (derived-spend guardrail used default $1/$2 per Mtok instead of Sonnet's $3/$15, so
the $10 cap could not fire before account exhaustion at $15.51), and the live transport sent
no `cache_control` breakpoints (0 cached tokens). `-002` ran with correct pricing flags,
`--max-call-cost 0.40`, and prompt-cache breakpoints (commit `baeaed7`): 4,108,716 cached vs
1,072,620 fresh input tokens, provider-reported spend $8.92, under the $10 cap.

## Headline Numbers (seed-a-002, context arm)

- Regression-free AUC (`checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1`): **0.6055**
- Checkpoint-end cumulative pass rates: CP01–06 all 1.000; CP07 0.258; frozen at exactly 16
  passed checks through CP14 (0.135); CP15 0.883; CP18 0.837.
- Protocol health: `agent_stalled_checkpoint_rate=0.4444` (8/18 checkpoints, CP07–CP14
  inclusive), `output_truncated_turn_rate=0.573` (51/89 turns ended `finish_reason=length`
  at exactly 4000 completion tokens), mean 4.94 turns/checkpoint.

## Gate Evaluation (predeclared, sealed plan §"Predeclared probe gate")

1. Mean context AUC ≤ 0.92 — numerically met (0.6055), **but not attributable to drift**
   (see 3).
2. ≥ 2 on-graph drift regressions — met. At CP07 end, 46 checks that passed at CP06 end
   fail; the regressed set includes CP02 I-TOTALS and CP05 proration checks, which are
   exactly CP07's frozen perturbation set in the design doc's interaction graph. Mechanism
   confirmed from the captured workspace: the CP07 coupons integration introduced a
   `TypeError: undefined is not an object (evaluating 'coupons.length')` thrown for invoices
   without coupons — an applied-code, cross-file, on-graph regression, invisible to the
   context arm (no executable feedback), persisting through CP14.
3. Failures are drift, not structural — **FAILED**. The sealed stall-reporting rule flagged
   8/18 checkpoints. Root cause established from raw model outputs: by CP06 the agent's
   `src/billing.ts` had grown to ~12,957 chars (~2,850 estimated tokens; plausibly ≥4,000
   real tokens with protocol framing), and under the full-file-replacement protocol every
   attempt to re-emit it hit the sealed 4000-output-token turn cap mid-file
   (`finish_reason=length`, no `<<<END>>>`), so no edit applied and checkpoints stalled.
   The frozen score of exactly 16 passes from CP07–CP14 measures this emission ceiling, not
   regression behavior. At CP15 the agent autonomously split the facade into
   `billing-types.ts` / `billing-handlers.ts` (billing.ts → 5,885 chars) and recovered to
   0.883.

Predeclared outcome mapping: **structural failures dominate → no claim; task invalid for
frontier drift; redesign under a new version before more spend.** Seeds b and c are NOT run
under this boundary. The optional feedback-arm feasibility run is not triggered (gate did
not pass).

## Design Defect Established

The reference solution's own `src/billing.ts` is 531 lines / ~4,063 estimated tokens —
larger than the sealed 4000-token turn output budget. The task design (`<~450 LOC per file`)
and the sealed protocol budget are in direct conflict: the canonical solution cannot be
emitted as a single full-file replacement in one turn. No pre-seal gate caught this because
scripted/no-provider gate runs do not enforce `max_tokens`; it is only observable live.
A measurement gap compounded it: `e1:stats` `truncation_hit_rate` measured verification-output
truncation only; model-output truncation (`finish_reason=length`) was unmeasured until
`output_truncated_turn_rate` was added during this analysis (the -001 calibration showed
0 for a run that, in hindsight, also had length-terminated turns).

## Honest Secondary Observations (descriptive only, no gate weight)

- The CP07 `coupons.length` regression is a genuine instance of the mechanism under study:
  a frontier model in the context arm broke six checkpoints of prior commitments with one
  careless integration and could not observe the breakage. In run `-001` (different
  trajectory, same boundary) CP07 also regressed on-graph (0.823 at CP07 end) and recovered
  at CP08 — the drift surface is real when the emission ceiling does not bind.
- The CP15 spontaneous file split is protocol-adaptive behavior worth noting for v2 design:
  given room, the model escapes the ceiling by restructuring.
- Prompt caching held within checkpoints (79% of input tokens cached); full-run cost $8.92
  at Sonnet pricing.

## Artifacts

- Bundles: `runs/e1-billing-v2-sonnet-context-probe-seed-a-20260611-001/`,
  `runs/e1-billing-v2-sonnet-context-probe-seed-a-20260611-002/` (per-turn workspace
  captures under `oracle-tmp/`).
- Inspection: `bun run e1:inspect -- --task billing-v2 --bundle <bundle>` → `valid=true` on
  `-002`.
- Required follow-up before any further billing-v2 spend: task redesign as
  `e1-billing-v2-v2` with a per-file emission-budget design gate (every reference and seed
  file comfortably below the turn output budget by the sealed estimator, with margin for
  protocol framing and growth), a live-observable truncation gate in the stall rules, new
  commitments document, and renewed authorization.
