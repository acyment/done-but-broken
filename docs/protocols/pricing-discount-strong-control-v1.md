# Pricing Discount Lifecycle — Strong-Model Control Matrix v1

Matrix profile ID: `pricing-discount-strong-control-v1`

Status: predeclared and sealed before any provider run. No provider/model runs have been performed. Qwen slug and structured-output support were confirmed by read-only OpenRouter model metadata on 2026-06-08. Execution requires a clean smoke and explicit operator authorization. Post-run outcomes are documented in run cards, not in this matrix.

## Purpose and framing

The Mistral demo (`pricing-discount-demo-v1`) showed a positive, bounded result on `pricing-discount-lifecycle-v0`, but its mechanism reads as **"executable feedback rescued a stalled weak model into implementing more"** — the context-only arm never progressed past the seeded I01–I02. The nearest credibility gap is whether that is weak-model-specific or a cross-model effect.

This matrix runs a **stronger, cheaper-than-Sonnet control on the same sealed task** to test whether the context-only arm stops stalling. It is a control probe, not a new demo: it answers "does the context arm still stall on a stronger model?", which sharpens the claim either way.

Conditions remain exactly `context_only_spec` and `feedback_capable_spec`. "BDD with AI" stays a narrative layer, not a third arm.

## Control model

- Intended control: **Qwen 3.7 Max** via OpenRouter, `openrouter-loop` adapter — chosen because it is cheaper than Sonnet, supports the structured-output path we already rely on, and is strong enough to test whether the context arm stops stalling.
- **Slug verification gate (satisfied before the smoke):** the exact OpenRouter model slug and its JSON-schema / structured-output support were confirmed via a read-only model-metadata check (`GET /models`) — not a pilot run. The DeepSeek-v4-flash history is the reason: a model that cannot emit clean schema-valid responses under the frozen profile wastes runs.
- Verified slug: `qwen/qwen3.7-max`; normalized provider-profile slug: `qwen-qwen3.7-max`.

## Compatibility boundary

- Same task version: `pricing-discount-lifecycle-v0` (unchanged; frozen exactly as in the Mistral demo — same checkpoints, visible specs, sealed `hidden-oracle/oracle-cases.json`, feedback assets).
- Same protocol: `protocol_profile_id=path-survival-primary-v1`; `primary_metric=regression_free_auc_delta`; budget `max_model_turns=2`, `max_feedback_runs=1`.
- **New model/provider boundary.** Do not pool Qwen runs with the Mistral `pricing-discount-demo-v1` runs, with subscription/inventory runs, or with `final-checkpoint-primary-v1` evidence. The sealed analysis plan is `tasks/pricing-discount-lifecycle/analysis-plan.qwen-strong-control-v0.json`.

## Design integrity (no post-hoc engineering)

- The task, checkpoints, visible specs, hidden oracle, feedback assets, budget, primary metric, and the three interpretation outcomes below are frozen **before** this control runs. None will change in response to its outcome.
- Only the model changes versus the Mistral demo; the provider execution profile shape, request parameters, retry policy, and budget are identical (model substituted).
- This is a single counted causal pilot: a directional control, reported with that weight — not re-labelled as a 3-pilot demo.

## Provider profile

Identical to the Mistral demo profile with the model substituted to the verified Qwen slug:

- `openrouter-loop`, route `openrouter-chat-completions`, parser `openrouter-response-parser-v1`, request `openrouter-chat-request-max-tokens-v1`, response format `model-loop-response-json-schema-v1`, `require_parameters=true`, retry policy `provider-retry-timeout-rate-malformed-v1`, loop policy `model-loop-feedback-continues-after-feedback-v1`, timeout `120000ms`, output `4000`, workspace `64000`, feedback `4000`, temperature `0.2`, retries `1`.
- Expected provider profile ID:
  `openrouter-loop-v1-modelqwen-qwen3.7-max-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1`

Canonical run command (same as the demo, model substituted):

```
bun run pilot:run \
  --task tasks/pricing-discount-lifecycle \
  --agent openrouter-loop \
  --openrouter-model qwen/qwen3.7-max \
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
| A1 | `diagnostic_invalid` (smoke) | 1 | Confirm the Qwen provider path is clean under the structured-output profile. Gate for everything after. |
| A2 | `difficulty_probe` | 1 | See whether the stronger model's context-only arm progresses past the seed; surface floor/ceiling. |
| B1 | `causal_pilot` | 1 (if A1/A2 clean) | One counted directional control pilot. |

Stop conditions: if the smoke is not clean (timeouts/malformed/schema failures), stop and do not run difficulty/causal — Qwen is then a provider-reliability dead end like DeepSeek-flash, recorded and excluded. If two consecutive runs fail the same provider mode, stop and revise under a new boundary.

## Predeclared interpretation (single causal pilot = directional control)

Report `regression_free_auc` delta, `regression_count` delta, and final pass-rate delta, plus the context arm's progression (does it pass beyond I02?).

- **Context-only now progresses and feedback preserves more behavior:** this is the original regression-drift story — feedback helps a capable agent avoid drift while implementing. Strongest outcome.
- **Both arms do well (context implements from spec alone):** feedback mattered for the weak model, less for the stronger one. Honest narrowing: "executable specs especially help weaker/cheaper agents."
- **Context still stalls and feedback progresses:** the implementation-and-completion effect is cross-model — still a strong industry story ("executable specs make even a stronger model substantially more productive on evolving specs").

Caveat: one causal pilot is directional, not the evidential weight of the 3-pilot Mistral demo. If the outcome is ambiguous or rests on a single noisy run, escalate to the held Sonnet ceiling rather than adding more Qwen runs. Do not change these thresholds after seeing the outcome.

## Allowed claim wording

- "On the same sealed pricing task under a stronger control model (Qwen 3.7 Max), the context-only arm [did / did not] stop stalling, indicating the Mistral effect is [cross-model / weak-model-specific], under this task/model/budget."
- Always qualify: single control pilot, directional, sealed task, replay-valid, preliminary, not pooled with the Mistral demo.

Disallowed: pooling Qwen with Mistral; "proves"; any generalized claim; treating one control pilot as a demo.

## Not pursued now

- **DeepSeek (any tier):** requires adapter / provenance / JSON-mode validation work before it can produce clean evidence; not the next spend.
- **Sonnet 4.6:** held as the final recognizable ceiling, used only if Qwen leaves the question ambiguous — not the first control.

## Execution prerequisites

Required before A1 smoke:

1. Exact Qwen 3.7 Max OpenRouter slug + JSON-schema/structured-output support confirmed via read-only model metadata; slug frozen into the provider profile ID and the sealed `analysis-plan.qwen-strong-control-v0.json`.
2. This matrix reviewed and approved.
3. A clean freeze commit recorded that includes this matrix and the sealed Qwen analysis plan.
4. Explicit operator authorization for provider runs.

Required before A2/B1:

5. A clean Qwen smoke (A1), with no provider validity flags and the exact sealed provider profile ID.

No provider/model runs may be performed until the A1 prerequisites are satisfied.
