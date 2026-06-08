# Pricing Discount Lifecycle - Gemini 2.5 Flash Smoke Matrix v1

Matrix profile ID: `pricing-discount-gemini-2.5-flash-smoke-v1`

Status: predeclared before any provider run in this matrix. No provider/model runs have been performed under this matrix. Execution requires explicit operator authorization. Post-run outcomes are documented in a run card, not in this matrix.

## Purpose and framing

This matrix is a one-model provider-reliability smoke for OpenRouter `google/gemini-2.5-flash`.

The purpose is to test whether Gemini 2.5 Flash can complete the sealed pricing task under the current OpenRouter structured-output profile without provider validity flags. This is provider reliability evidence only. It does not produce causal evidence, difficulty evidence, strong-control evidence, or treatment-effect claims.

## Compatibility boundary

- Same task version: `pricing-discount-lifecycle-v0` (unchanged).
- Same protocol profile: `path-survival-primary-v1`.
- Same conditions: `context_only_spec`, `feedback_capable_spec`.
- Same budget: `max_model_turns=2`, `max_feedback_runs=1`.
- Same provider profile shape as the Mistral/Qwen/DeepSeek Pro/provider-triage controls, with only the model slug substituted.
- Run classification: `diagnostic_invalid` only.
- Do not pool this smoke with Mistral, Qwen, DeepSeek Pro, provider-triage, subscription/inventory, or any causal-pilot evidence.

## Provider profile

The candidate uses:

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

Expected provider profile ID:

```text
openrouter-loop-v1-modelgoogle-gemini-2.5-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1
```

## Canonical command

Gemini 2.5 Flash:

```
bun run pilot:run \
  --task tasks/pricing-discount-lifecycle \
  --runs-root runs \
  --run-id pricing-discount-gemini-2.5-flash-smoke-v1-20260608-001 \
  --agent openrouter-loop \
  --openrouter-model google/gemini-2.5-flash \
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

- Run at most one Gemini 2.5 Flash smoke under this matrix.
- Stop immediately on any provider validity flag: timeout, malformed response, quota/rate limit, API failure, partial interruption, or workspace carry-forward due to provider failure.
- A clean smoke requires `valid=true`, 18 replay steps, zero mismatches, no validity flags, exact provider profile ID, `protocol_profile_id=path-survival-primary-v1`, and recorded budget `2/1`.
- If the smoke is clean, Gemini 2.5 Flash may be proposed for a separately sealed difficulty/control boundary. Do not run difficulty or causal pilots from this smoke matrix.
- Record clean, flagged, and partial smoke results in a run card.

## Allowed interpretation

- "Under the sealed pricing task and OpenRouter structured-output profile, Gemini 2.5 Flash did/did not pass a provider-reliability smoke."
- "This smoke result is provider reliability evidence only and is not causal evidence."

Disallowed: causal claims, difficulty claims, pooling with Mistral/Qwen/DeepSeek Pro/provider-triage outcomes, or choosing Gemini 2.5 Flash for a counted run without a new sealed boundary.
