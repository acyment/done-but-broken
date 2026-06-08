# Pricing Discount Lifecycle - Gemini 2.5 Flash No-Schema Control Matrix v1

Matrix profile ID: `pricing-discount-gemini-2.5-flash-no-schema-control-v1`

Status: predeclared and sealed before any provider run under this matrix. The earlier `pricing-discount-gemini-2.5-flash-smoke-v1` JSON-schema smoke completed but recorded one `provider_malformed_response`, so it is not promoted. This is a new provider-profile boundary.

## Purpose and framing

The Mistral pricing demo showed executable feedback turning a stalled weak model into a productive one. Gemini 2.5 Flash is attractive as a lower-cost, recognizable control, but its first OpenRouter JSON-schema smoke was provider-flagged.

This matrix tests Gemini 2.5 Flash again under a deliberately different OpenRouter profile: no `response_format=json_schema` and no `provider.require_parameters`. The model loop still prompts for the same JSON response contract and uses the same parser, but the request does not force OpenRouter structured-output mode. The aim is to determine whether this profile can pass the provider gate cleanly, then, only if clean, run one directional control pilot.

Conditions remain exactly `context_only_spec` and `feedback_capable_spec`. "BDD with AI" stays a narrative layer, not a third arm.

## Control model

- Intended control: OpenRouter `google/gemini-2.5-flash`, `openrouter-loop`.
- Prior Gemini boundary: `pricing-discount-gemini-2.5-flash-smoke-v1` with JSON-schema response format.
- Prior result: replay-valid but provider-flagged (`provider_malformed_response` at `context_only_spec` / `I04`), so not clean provider evidence.
- New provider decision: keep Gemini 2.5 Flash and OpenRouter, remove OpenRouter JSON-schema forcing, and re-gate from a fresh smoke.

## Compatibility boundary

- Same task version: `pricing-discount-lifecycle-v0` (unchanged).
- Same protocol: `protocol_profile_id=path-survival-primary-v1`; `primary_metric=regression_free_auc_delta`.
- Same conditions: `context_only_spec`, `feedback_capable_spec`.
- Same budget: `max_model_turns=2`, `max_feedback_runs=1`.
- New provider profile: no OpenRouter response format and no provider `require_parameters`.
- New model/provider boundary: do not pool this with Mistral, Qwen, DeepSeek Pro, provider-triage, the prior Gemini JSON-schema smoke, subscription/inventory, or `final-checkpoint-primary-v1` evidence.
- Sealed analysis plan: `tasks/pricing-discount-lifecycle/analysis-plan.gemini-2.5-flash-no-schema-control-v0.json`.

## Design integrity

- The task, checkpoints, visible specs, hidden oracle, feedback assets, budget, primary metric, and interpretation outcomes below are frozen before any run in this matrix.
- Only the provider execution profile changes versus the prior Gemini JSON-schema smoke.
- This is a single counted causal pilot only if A1 and A2 are clean. If reached, it is directional control evidence, not a second demo.

## Provider profile

The candidate uses:

- `openrouter-loop`
- route `openrouter-chat-completions`
- parser `openrouter-response-parser-v1`
- request `openrouter-chat-request-max-tokens-v1`
- response format `none`
- `require_parameters=false`
- retry policy `provider-retry-timeout-rate-malformed-v1`
- loop policy `model-loop-feedback-continues-after-feedback-v1`
- timeout `120000ms`
- output `4000`
- workspace `64000`
- feedback `4000`
- temperature `0.2`
- retries `1`

Expected provider profile ID:

```text
openrouter-loop-v1-modelgoogle-gemini-2.5-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1
```

Canonical run command:

```
bun run pilot:run \
  --task tasks/pricing-discount-lifecycle \
  --runs-root runs \
  --run-id <run-id> \
  --agent openrouter-loop \
  --openrouter-model google/gemini-2.5-flash \
  --protocol-profile-id path-survival-primary-v1 \
  --max-model-turns 2 \
  --max-feedback-runs 1 \
  --run-classification <diagnostic_invalid|difficulty_probe|causal_pilot> \
  --openrouter-response-format none \
  --openrouter-require-parameters false \
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
| A1 | `diagnostic_invalid` (smoke) | 1 | Confirm the no-schema Gemini provider path is clean. Gate for everything after. |
| A2 | `difficulty_probe` | 1 (if A1 clean) | See whether Gemini's context-only arm progresses past the seed and whether the task is floor/ceiling. |
| B1 | `causal_pilot` | 1 (if A1/A2 clean) | One counted directional control pilot. |

Canonical run IDs:

- A1: `pricing-discount-gemini-2.5-flash-no-schema-control-v1-smoke-20260608-001`
- A2: `pricing-discount-gemini-2.5-flash-no-schema-control-v1-difficulty-probe-20260608-001`
- B1: `pricing-discount-gemini-2.5-flash-no-schema-control-v1-causal-pilot-20260608-001`

Stop conditions:

- If A1 is not clean (timeouts, malformed/schema failures, quota/rate, API failure, replay/artifact mismatch, or provider carry-forward), stop and do not run A2/B1.
- If A2 records any provider validity flag or replay/artifact mismatch, stop and do not run B1.
- If B1 is reached, report it as a single directional control pilot only.

## Predeclared interpretation

If B1 is reached, report `regression_free_auc` delta, `regression_count` delta, final pass-rate delta, and context-arm progression beyond I02.

- Context-only now progresses and feedback preserves more behavior: this supports the regression-drift framing for a more capable model.
- Both arms do well: executable feedback mattered more for weaker/cheaper agents under this task.
- Context still stalls and feedback progresses: the implementation-and-completion effect is not only a Mistral artifact.
- Provider gate fails: Gemini 2.5 Flash under this no-schema OpenRouter profile is operationally unsuitable for clean control evidence. Do not infer model capability or treatment effect.

## Allowed claim wording

- "Gemini 2.5 Flash [passed / did not pass] a sealed no-schema OpenRouter provider gate on the pricing task."
- "On the same sealed pricing task under Gemini 2.5 Flash, the context-only arm [did / did not] stop stalling, under this task/model/budget."
- Always qualify: single control pilot if reached, directional, sealed task, replay-valid, preliminary, not pooled with Mistral or other provider-profile boundaries.

Disallowed: pooling with Mistral/Qwen/DeepSeek/provider-triage/Gemini JSON-schema smoke; "proves"; any generalized claim; treating one control pilot as a demo.

## Execution prerequisites

Required before A1 smoke:

1. Prior Gemini JSON-schema smoke recorded and excluded as provider-flagged.
2. This matrix reviewed and approved.
3. Sealed analysis plan registered in the task package.
4. Clean freeze commit recorded for this matrix and analysis plan.
5. Explicit operator authorization for provider runs.

Required before A2/B1:

6. A clean A1 smoke with no validity flags and the exact sealed no-schema provider profile ID.
7. A clean A2 difficulty probe with no validity flags and the exact sealed no-schema provider profile ID.
