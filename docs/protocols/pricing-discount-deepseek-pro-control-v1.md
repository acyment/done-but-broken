# Pricing Discount Lifecycle — DeepSeek Pro Control Matrix v1

Matrix profile ID: `pricing-discount-deepseek-pro-control-v1`

Status: predeclared and sealed before any provider run. No provider/model runs have been performed. DeepSeek V4 Pro slug and structured-output support were confirmed by read-only OpenRouter model metadata on 2026-06-08. Execution requires a clean smoke and explicit operator authorization. Post-run outcomes are documented in run cards, not in this matrix.

## Purpose and framing

The Mistral demo (`pricing-discount-demo-v1`) showed executable feedback turning a stalled weak model into a productive one. The Qwen strong-control gate (`pricing-discount-strong-control-v1`) produced a clean diagnostic smoke, but its difficulty probe recorded retry-recovered provider timeouts under the sealed profile, so it did not reach a counted control pilot.

This matrix tries **DeepSeek V4 Pro as a cheaper strong-control fallback** on the same sealed pricing task. It tests whether a capable, lower-cost model can pass the provider gate cleanly and whether the context-only arm stops stalling. It is a control probe, not a new demo.

Conditions remain exactly `context_only_spec` and `feedback_capable_spec`. "BDD with AI" stays a narrative layer, not a third arm.

## Control model

- Intended control: **DeepSeek V4 Pro** via OpenRouter, `openrouter-loop` adapter — chosen because it is much cheaper than Sonnet/Qwen Max, supports the structured-output path we rely on, and is stronger than the DeepSeek Flash profile that previously had reliability issues.
- **Slug verification gate (satisfied before the smoke):** the exact OpenRouter model slug and its JSON-schema / structured-output support were confirmed via a read-only model-metadata check (`GET /models`) — not a pilot run.
- Verified slug: `deepseek/deepseek-v4-pro`; normalized provider-profile slug: `deepseek-deepseek-v4-pro`.

## Compatibility boundary

- Same task version: `pricing-discount-lifecycle-v0` (unchanged; frozen exactly as in the Mistral demo — same checkpoints, visible specs, sealed `hidden-oracle/oracle-cases.json`, feedback assets).
- Same protocol: `protocol_profile_id=path-survival-primary-v1`; `primary_metric=regression_free_auc_delta`; budget `max_model_turns=2`, `max_feedback_runs=1`.
- **New model/provider boundary.** Do not pool DeepSeek Pro runs with the Mistral `pricing-discount-demo-v1` runs, the Qwen strong-control gate, subscription/inventory runs, or `final-checkpoint-primary-v1` evidence. The sealed analysis plan is `tasks/pricing-discount-lifecycle/analysis-plan.deepseek-pro-control-v0.json`.

## Design integrity (no post-hoc engineering)

- The task, checkpoints, visible specs, hidden oracle, feedback assets, budget, primary metric, and the interpretation outcomes below are frozen **before** this control runs. None will change in response to its outcome.
- Only the model changes versus the Mistral demo and Qwen control attempt; the provider execution profile shape, request parameters, retry policy, and budget are identical (model substituted).
- This is a single counted causal pilot only if the provider gate is clean: directional control evidence, reported with that weight — not re-labelled as a 3-pilot demo.

## Provider profile

Identical to the Mistral/Qwen profile with the model substituted to the verified DeepSeek Pro slug:

- `openrouter-loop`, route `openrouter-chat-completions`, parser `openrouter-response-parser-v1`, request `openrouter-chat-request-max-tokens-v1`, response format `model-loop-response-json-schema-v1`, `require_parameters=true`, retry policy `provider-retry-timeout-rate-malformed-v1`, loop policy `model-loop-feedback-continues-after-feedback-v1`, timeout `120000ms`, output `4000`, workspace `64000`, feedback `4000`, temperature `0.2`, retries `1`.
- Expected provider profile ID:
  `openrouter-loop-v1-modeldeepseek-deepseek-v4-pro-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1`

Canonical run command:

```
bun run pilot:run \
  --task tasks/pricing-discount-lifecycle \
  --agent openrouter-loop \
  --openrouter-model deepseek/deepseek-v4-pro \
  --protocol-profile-id path-survival-primary-v1 \
  --max-model-turns 2 \
  --max-feedback-runs 1 \
  --run-classification <diagnostic_invalid|difficulty_probe|causal_pilot> \
  --openrouter-response-format json_schema \
  --openrouter-require-parameters true \
  --provider-max-retries 1 \
  --request-timeout-ms 120000 \
  --max-output-tokens 4000 \
  --max-workspace-bytes 64000 \
  --max-feedback-output-bytes 4000 \
  --temperature 0.2
```

## Compact matrix

| # | Run classification | Count | Purpose |
| --- | --- | ---: | --- |
| A1 | `diagnostic_invalid` (smoke) | 1 | Confirm the DeepSeek Pro provider path is clean under the structured-output profile. Gate for everything after. |
| A2 | `difficulty_probe` | 1 (if A1 clean) | See whether the stronger model's context-only arm progresses past the seed; surface floor/ceiling. |
| B1 | `causal_pilot` | 1 (if A1/A2 clean) | One counted directional control pilot. |

Stop conditions: if the smoke is not clean (timeouts/malformed/schema failures), stop and do not run difficulty/causal. If the difficulty probe records any provider validity flag, stop and do not run B1. If two consecutive runs fail the same provider mode, stop and revise under a new boundary.

## Predeclared interpretation (single causal pilot = directional control)

Report `regression_free_auc` delta, `regression_count` delta, final pass-rate delta, and the context arm's progression beyond I02.

- **Context-only now progresses and feedback preserves more behavior:** this is the original regression-drift story — feedback helps a capable agent avoid drift while implementing.
- **Both arms do well:** feedback mattered for the weak model, less for the stronger one. Honest narrowing: "executable specs especially help weaker/cheaper agents."
- **Context still stalls and feedback progresses:** the implementation-and-completion effect is not only a Mistral artifact.
- **Provider gate fails:** DeepSeek Pro under this exact OpenRouter profile is operationally unsuitable for clean control evidence; do not infer model capability or treatment effect.

Caveat: one causal pilot is directional, not the evidential weight of the 3-pilot Mistral demo. If DeepSeek Pro is ambiguous or provider-flagged, escalate to the held Sonnet ceiling rather than adding more unplanned DeepSeek runs.

## Allowed claim wording

- "On the same sealed pricing task under DeepSeek V4 Pro, the context-only arm [did / did not] stop stalling, under this task/model/budget."
- "DeepSeek V4 Pro [passed / did not pass] the sealed provider gate under this OpenRouter structured-output profile."
- Always qualify: single control pilot if reached, directional, sealed task, replay-valid, preliminary, not pooled with Mistral or Qwen.

Disallowed: pooling DeepSeek Pro with Mistral/Qwen; "proves"; any generalized claim; treating one control pilot as a demo.

## Execution prerequisites

Required before A1 smoke:

1. Exact DeepSeek V4 Pro OpenRouter slug + JSON-schema/structured-output support confirmed via read-only model metadata; slug frozen into the provider profile ID and the sealed `analysis-plan.deepseek-pro-control-v0.json`.
2. This matrix reviewed and approved.
3. A clean freeze commit recorded that includes this matrix and the sealed DeepSeek Pro analysis plan.
4. Explicit operator authorization for provider runs.

Required before A2/B1:

5. A clean DeepSeek Pro smoke (A1), with no provider validity flags and the exact sealed provider profile ID.
6. A clean DeepSeek Pro difficulty probe (A2), with no provider validity flags and the exact sealed provider profile ID.

No provider/model runs may be performed until the A1 prerequisites are satisfied.
