# Pricing Discount Lifecycle - Provider Triage Smoke Matrix v1

Matrix profile ID: `pricing-discount-provider-triage-smoke-v1`

Status: predeclared before any provider run in this matrix. No provider/model runs have been performed under this matrix. Execution requires explicit operator authorization. Post-run outcomes are documented in run cards, not in this matrix.

## Purpose and framing

The Mistral pricing demo produced the current bounded result. Qwen 3.7 Max and DeepSeek V4 Pro did not produce clean strong-control evidence under their sealed OpenRouter structured-output profiles. This matrix is a **smoke-only provider triage** for three cheaper OpenRouter alternatives that currently advertise structured-output support and agentic/coding suitability:

- `minimax/minimax-m2.7`
- `z-ai/glm-4.7`
- `moonshotai/kimi-k2.5`

These are provider reliability checks only. They do not produce causal evidence, difficulty evidence, or treatment-effect claims.

## Compatibility boundary

- Same task version: `pricing-discount-lifecycle-v0` (unchanged).
- Same protocol profile: `path-survival-primary-v1`.
- Same conditions: `context_only_spec`, `feedback_capable_spec`.
- Same budget: `max_model_turns=2`, `max_feedback_runs=1`.
- Same provider profile shape as the Mistral/Qwen/DeepSeek Pro controls, with only the model slug substituted.
- Run classification: `diagnostic_invalid` only.
- Do not pool these smoke runs with Mistral, Qwen, DeepSeek Pro, subscription/inventory, or any causal-pilot evidence.

## Provider profiles

All candidates use:

- `openrouter-loop`
- route `openrouter-chat-completions`
- parser `openrouter-response-parser-v1`
- request `openrouter-chat-request-max-tokens-v1`
- response format `model-loop-response-json-schema-v1`
- `require_parameters=true`
- retry policy `provider-retry-timeout-rate-malformed-v1`
- loop policy `model-loop-feedback-continues-after-feedback-v1`
- timeout `120000ms`
- output `4000`
- workspace `64000`
- feedback `4000`
- temperature `0.2`
- retries `1`

Expected provider profile IDs:

| Model | Provider profile ID |
| --- | --- |
| `minimax/minimax-m2.7` | `openrouter-loop-v1-modelminimax-minimax-m2.7-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1` |
| `z-ai/glm-4.7` | `openrouter-loop-v1-modelz-ai-glm-4.7-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1` |
| `moonshotai/kimi-k2.5` | `openrouter-loop-v1-modelmoonshotai-kimi-k2.5-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1` |

## Canonical commands

MiniMax M2.7:

```
bun run pilot:run \
  --task tasks/pricing-discount-lifecycle \
  --runs-root runs \
  --run-id pricing-discount-provider-triage-smoke-v1-minimax-m2.7-20260608-001 \
  --agent openrouter-loop \
  --openrouter-model minimax/minimax-m2.7 \
  --protocol-profile-id path-survival-primary-v1 \
  --max-model-turns 2 \
  --max-feedback-runs 1 \
  --run-classification diagnostic_invalid \
  --openrouter-response-format json_schema \
  --openrouter-require-parameters true \
  --provider-max-retries 1 \
  --request-timeout-ms 120000 \
  --max-output-tokens 4000 \
  --max-workspace-bytes 64000 \
  --max-feedback-output-bytes 4000 \
  --temperature 0.2
```

GLM 4.7:

```
bun run pilot:run \
  --task tasks/pricing-discount-lifecycle \
  --runs-root runs \
  --run-id pricing-discount-provider-triage-smoke-v1-glm-4.7-20260608-001 \
  --agent openrouter-loop \
  --openrouter-model z-ai/glm-4.7 \
  --protocol-profile-id path-survival-primary-v1 \
  --max-model-turns 2 \
  --max-feedback-runs 1 \
  --run-classification diagnostic_invalid \
  --openrouter-response-format json_schema \
  --openrouter-require-parameters true \
  --provider-max-retries 1 \
  --request-timeout-ms 120000 \
  --max-output-tokens 4000 \
  --max-workspace-bytes 64000 \
  --max-feedback-output-bytes 4000 \
  --temperature 0.2
```

Kimi K2.5:

```
bun run pilot:run \
  --task tasks/pricing-discount-lifecycle \
  --runs-root runs \
  --run-id pricing-discount-provider-triage-smoke-v1-kimi-k2.5-20260608-001 \
  --agent openrouter-loop \
  --openrouter-model moonshotai/kimi-k2.5 \
  --protocol-profile-id path-survival-primary-v1 \
  --max-model-turns 2 \
  --max-feedback-runs 1 \
  --run-classification diagnostic_invalid \
  --openrouter-response-format json_schema \
  --openrouter-require-parameters true \
  --provider-max-retries 1 \
  --request-timeout-ms 120000 \
  --max-output-tokens 4000 \
  --max-workspace-bytes 64000 \
  --max-feedback-output-bytes 4000 \
  --temperature 0.2
```

## Stop and reporting rules

- Run at most one smoke per candidate under this matrix.
- Stop a candidate immediately on any provider validity flag: timeout, malformed response, quota/rate limit, API failure, partial interruption, or workspace carry-forward due to provider failure.
- A clean smoke requires `valid=true`, 18 replay steps, zero mismatches, no validity flags, exact provider profile ID, `protocol_profile_id=path-survival-primary-v1`, and recorded budget `2/1`.
- If a candidate is clean, it may be proposed for a separately sealed difficulty/control boundary. Do not run difficulty or causal pilots from this smoke matrix.
- Record all clean, flagged, and partial smoke results in one run card.

## Allowed interpretation

- "Under the sealed pricing task and OpenRouter structured-output profile, model X did/did not pass a provider-reliability smoke."
- "This smoke result is provider reliability evidence only and is not causal evidence."

Disallowed: causal claims, difficulty claims, pooling with Mistral/Qwen/DeepSeek Pro outcomes, or choosing a counted model after seeing smoke outcomes without a new sealed boundary.
