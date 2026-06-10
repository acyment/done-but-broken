# Provider Smoke-Test Plan

Purpose: verify the E1 CartCalc provider path before any Billing v2 or frontier-model evidence run.

This is not primary evidence. Treat these runs as provider reliability checks only.

## Current E1 CartCalc Smoke

Step 1 must be satisfied locally against the canned transport before any real provider call:

```sh
bun run e1 -- \
  --task=cartcalc \
  --arm=context \
  --live \
  --cap=1.00 \
  --checkpoint=1 \
  --runs-root runs \
  --run-id e1-cartcalc-canned-context-cp1
```

Done means the command writes `runs/e1-cartcalc-canned-context-cp1/e1-task-package-provider-bundle.json` with:

- `schema_version=e1-task-package-provider-bundle-v0`
- `selected_conditions=["context_only_spec"]`
- `checkpoints=["1"]`
- top-level `run_identity` includes `provider_profile_id`, `provider_route_id`, provider model, endpoint, and transport kind
- per-checkpoint `run_manifest.provider_profile` includes the same `provider_route_id`
- a redacted provider exchange record
- provider usage with `fresh_input_tokens`, `cached_input_tokens`, and `output_tokens`
- a non-zero `spend_usd`, with `cost_of_record_source` labeled as `provider_reported` or `derived`
- the configured `pricing_usd_per_million_tokens` table used for the spend estimate
- hidden-oracle checkpoint scoring for CartCalc CP1

The command defaults to `--transport=canned`. `--live` enables the same spend gate that real provider calls use; it does not by itself call the network.

## Real Provider Smoke

Only after the canned command passes and secrets are registered, run one real provider smoke. Prefer a direct provider or LiteLLM endpoint for calibration/evidence; OpenRouter is acceptable only as a transport sanity check and must remain a distinct provider-route boundary.

```sh
OPENROUTER_API_KEY=sk-or-... bun run e1 -- \
  --task=cartcalc \
  --arm=context \
  --live \
  --transport=live \
  --cap=1.00 \
  --checkpoint=1 \
  --model <cheapest-approved-model-id> \
  --route-id openrouter-chat-completions \
  --runs-root runs \
  --run-id e1-cartcalc-provider-context-cp1
```

Record from stdout and the bundle:

- bundle path
- provider usage block
- dollar figure (`spend_usd`) and its derivation label
- configured price table (`pricing_usd_per_million_tokens`)
- provider route id from `run_identity.provider_route_id`
- whether the real API response shape matches the canned fixtures closely enough for the E1 compatibility layer
- whether cache-read usage is distinguishable as `cached_input_tokens`
- whether provider-reported cost is present; if absent, `cost_of_record_source=derived`

If the real call breaks, fix it as a provider-path defect and rerun the smoke. Do not promote the failure or the fix into a sealed task boundary.

## Latest E1 CartCalc Smoke Outcome

`e1-cartcalc-provider-context-cp1-20260610-003` completed the current Step 2 smoke after two defect-fix reruns:

- Bundle: `runs/e1-cartcalc-provider-context-cp1-20260610-003/e1-task-package-provider-bundle.json`
- Model/provider: OpenRouter `mistralai/mistral-small-2603`, routed provider `Venice`
- Arm/checkpoint: `context_only_spec`, CP1 only
- Status: `completed`
- Turn count: 1
- Termination: `done`
- Hidden oracle score: 4/4
- Provider usage through the compatibility layer: `fresh_input_tokens=1020`, `cached_input_tokens=48`, `output_tokens=582`
- Provider-reported OpenRouter usage cost in raw response: `0.00063675`
- Derived cap-guardrail spend from the configured price table before the hierarchy fix: `0.002188800`
- Post-fix cost hierarchy: `spend_usd` is provider-reported when `usage.cost` is present, otherwise derived from configured prices; derived spend remains recorded separately as the cap/projection guardrail.

Empirical answers:

- Real API shape matched the canned compatibility fixture shape for E1: HTTP 200, `object=chat.completion`, `choices[0].message.content` as a string, `usage.prompt_tokens`, `usage.completion_tokens`, and `usage.prompt_tokens_details.cached_tokens`.
- Cache-read usage is distinguishable through the compatibility layer: OpenRouter returned `cached_tokens=48`; the bundle recorded `cached_input_tokens=48`.
- The OpenRouter smoke was a compatibility check, not a calibration route decision. CartCalc calibration should use the planned direct/LiteLLM path unless explicitly overridden.

## Direct/LiteLLM Route Smoke

Before calibration uses a direct or LiteLLM route, run the same one-checkpoint CartCalc smoke through that route and record the same fields. Example LiteLLM shape:

```sh
LITELLM_API_KEY=<configured-key> bun run e1 -- \
  --task=cartcalc \
  --arm=context \
  --live \
  --transport=live \
  --cap=1.00 \
  --checkpoint=1 \
  --model <direct-provider-model-id> \
  --endpoint http://localhost:4000/v1/chat/completions \
  --route-id litellm-chat-completions \
  --api-key-env LITELLM_API_KEY \
  --runs-root runs \
  --run-id e1-cartcalc-litellm-context-cp1
```

Done means the bundle stamps `provider_route_id=litellm-chat-completions` in both top-level run identity and the checkpoint provider profile, reports whether the route exposes `usage.cost`, and shows whether cached-token usage remains distinguishable through the route.

Defects found and fixed before the clean rerun:

- `e1-cartcalc-provider-context-cp1-20260610-001`: model closed a `<<<FILE>>>` block with `<<<DONE>>>` instead of `<<<END>>>`; prompt template now explicitly states that `FILE` and `VERIFY` blocks must close with `<<<END>>>` before `<<<DONE>>>`.
- `e1-cartcalc-provider-context-cp1-20260610-002`: package-mounted workspaces lacked `scratch/`; `mountTaskWorkspace` now creates `scratch/` for every E1 condition workspace.

## Historical OpenRouter Mitigation Profile

The latest tested structured-output OpenRouter loop profile for the older fake-pilot path was:

- Adapter: `openrouter-loop`
- Model: `mistralai/mistral-small-2603`
- Route: `openrouter-chat-completions`
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Response parser: `openrouter-response-parser-v1`
- Request parameter version: `openrouter-chat-request-max-tokens-v1`
- Response format: `model-loop-response-json-schema-v1`
- Provider require parameters: `true`
- Retry policy version: `provider-retry-timeout-rate-malformed-v1`
- Model loop policy version: `model-loop-feedback-continues-after-feedback-v1`
- Request timeout: `120000ms`
- Max output tokens: `4000`
- Workspace context cap: `64000` bytes
- Feedback summary cap: `4000` bytes
- Temperature: `0.2`
- Retries: `1`
- Expected provider profile ID: `openrouter-loop-v1-modelmistralai-mistral-small-2603-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1`

This keeps the reduced output and prompt pressure from the previous mitigation, preserves parser versioning, sends OpenRouter's broadly supported `max_tokens` cap, adds OpenRouter structured outputs via `response_format: { type: "json_schema" }`, allows one retry for timeout, quota/rate-limit, or malformed-response provider failures, and changes the model route away from the Sonnet boundary for a single-model P4 expansion. Recovered provider failures are still validity-flagged. The profile also sends `provider.require_parameters=true` so routing should avoid providers that cannot satisfy the requested response format. The route, endpoint, model, parser, request parameter shape, response format, provider parameter-routing setting, retry policy, model-loop policy, prompt caps, and output settings are visible in manifests and compatibility hashes.

Official OpenRouter docs describe JSON-schema structured outputs and recommend provider parameter requirements for compatible routing:

- https://openrouter.ai/docs/guides/features/structured-outputs
- https://openrouter.ai/docs/features/provider-routing

## Previous Mitigation Attempts

The Sonnet retry-enabled structured-output profile was:

- Adapter: `openrouter-loop`
- Model: `anthropic/claude-sonnet-4.6`
- Request timeout: `120000ms`
- Max output tokens: `4000`
- Workspace context cap: `64000` bytes
- Feedback summary cap: `4000` bytes
- Response parser: `openrouter-response-parser-v1`
- Request parameter version: `openrouter-chat-request-max-tokens-v1`
- Response format: `model-loop-response-json-schema-v1`
- Provider require parameters: `true`
- Retry policy version: `provider-retry-timeout-rate-malformed-v1`
- Temperature: `0.2`
- Retries: `1`
- Expected provider profile ID: `openrouter-loop-v1-modelanthropic-claude-sonnet-4.6-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1`

It produced one clean difficulty probe and one clean causal pilot, but it predates explicit `model_loop_policy_version` profile IDs. It remains a valid historical boundary and must not be pooled with loop-policy-versioned profiles.

The DeepSeek retry-enabled structured-output profile was:

- Adapter: `openrouter-loop`
- Model: `deepseek/deepseek-v4-flash`
- Request timeout: `120000ms`
- Max output tokens: `4000`
- Workspace context cap: `64000` bytes
- Feedback summary cap: `4000` bytes
- Response parser: `openrouter-response-parser-v1`
- Request parameter version: `openrouter-chat-request-max-tokens-v1`
- Response format: `model-loop-response-json-schema-v1`
- Provider require parameters: `true`
- Retry policy version: `provider-retry-timeout-rate-malformed-v1`
- Temperature: `0.2`
- Retries: `1`
- Expected provider profile ID: `openrouter-loop-v1-modeldeepseek-deepseek-v4-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1`

It produced one clean small smoke, but the full subscription difficulty probe still recorded retry-recovered malformed responses. It remains historical provider reliability evidence, not a profile to reuse for the next clean-evidence attempt.

The parser-only profile was:

- Adapter: `openrouter-loop`
- Request timeout: `120000ms`
- Max output tokens: `4000`
- Workspace context cap: `64000` bytes
- Feedback summary cap: `4000` bytes
- Response parser: `openrouter-response-parser-v1`
- Temperature: `0.2`
- Retries: `0`
- Expected provider profile ID: `openrouter-loop-v1-modeldeepseek-deepseek-v4-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry0`

It produced one clean small smoke, but the full subscription difficulty probe still had provider timeouts and malformed responses. It remains historical provider reliability evidence, not a profile to reuse for the next full run.

The first timeout-mitigation profile was:

- Adapter: `openrouter-loop`
- Request timeout: `90000ms`
- Max output tokens: `8000`
- Temperature: `0.2`
- Retries: `0`
- Expected provider profile ID: `openrouter-loop-v1-timeout90000-output8000-temp0.2-retry0`

It produced one clean small smoke, but the full subscription difficulty probe still had provider timeouts. It remains historical provider reliability evidence, not a profile to reuse for the next full run.

## Local Preflight

Run local checks first:

```sh
bun test test/model-loop-agent.test.ts test/run-compatibility.test.ts test/cli.test.ts
```

Do not continue to provider smoke if local provenance, profile, or inspect tests fail.

## Provider Smoke

Use a small non-subscription smoke before any full 18-step subscription run:

```sh
OPENROUTER_API_KEY=sk-or-... bun run pilot:run \
  --task tasks/sample-cart \
  --runs-root runs \
  --run-id provider-smoke-YYYYMMDD-001 \
  --agent openrouter-loop \
  --openrouter-model mistralai/mistral-small-2603 \
  --run-classification diagnostic_invalid \
  --max-model-turns 1 \
  --max-feedback-runs 0 \
  --request-timeout-ms 120000 \
  --max-output-tokens 4000 \
  --max-workspace-bytes 64000 \
  --max-feedback-output-bytes 4000 \
  --openrouter-response-format json_schema \
  --openrouter-require-parameters true \
  --provider-max-retries 1 \
  --temperature 0.2
```

Then inspect:

```sh
bun run inspect:run --run-manifest runs/provider-smoke-YYYYMMDD-001/run.json
```

## Clean Smoke Criteria

The smoke is clean only if inspection reports:

- `valid=true`
- `mismatches=0`
- no provider validity flags
- `provider_timeout_detail_count=0`
- `workspace_carried_forward_due_to_provider_failure_checkpoints=0`
- provider profile ID exactly `openrouter-loop-v1-modelmistralai-mistral-small-2603-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1`

Because the smoke is `diagnostic_invalid`, `clean_primary_evidence_eligible=false` is expected.

## Latest Smoke Outcome

`provider-smoke-20260605-011` completed cleanly under the current loop-policy-versioned Mistral retry-enabled structured-output profile:

- `valid=true`
- `replay_steps=6`
- `mismatches=0`
- `validity_flags=none`
- `provider_timeout_detail_count=0`
- `workspace_carried_forward_due_to_provider_failure_checkpoints=0`
- `provider_profile_id=openrouter-loop-v1-modelmistralai-mistral-small-2603-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1`
- both arms final 3/3
- final checkpoint delta 0
- regression-free AUC delta 0

This remains provider reliability evidence only because the run classification is `diagnostic_invalid`.

Historical DeepSeek retry-enabled structured-output smoke: `provider-smoke-20260605-008` completed cleanly under the previous retry-enabled structured-output profile:

- `valid=true`
- `replay_steps=6`
- `mismatches=0`
- `validity_flags=none`
- `provider_timeout_detail_count=0`
- `workspace_carried_forward_due_to_provider_failure_checkpoints=0`
- `provider_profile_id=openrouter-loop-v1-modeldeepseek-deepseek-v4-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1`
- both arms final 3/3
- final checkpoint delta 0
- regression-free AUC delta 0

Historical no-retry structured-output smoke: `provider-smoke-20260605-007` completed cleanly under the versioned structured-output profile:

- `valid=true`
- `replay_steps=6`
- `mismatches=0`
- `validity_flags=none`
- `provider_timeout_detail_count=0`
- `workspace_carried_forward_due_to_provider_failure_checkpoints=0`
- `provider_profile_id=openrouter-loop-v1-modeldeepseek-deepseek-v4-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry0`
- both arms final 3/3
- final checkpoint delta 0
- regression-free AUC delta 0

`provider-smoke-20260605-005` used the initial structured-output request shape and was provider-flagged:

- `valid=true`
- `replay_steps=6`
- `mismatches=0`
- `validity_flags=provider_api_failure`
- `workspace_carried_forward_due_to_provider_failure_checkpoints=6`
- provider message: no endpoints found that could handle the requested parameters

That run exposed the unversioned `max_completion_tokens` request-shape issue. The adapter now sends `max_tokens` and records `request_parameter_version=openrouter-chat-request-max-tokens-v1`.

Historical parser-only smoke: `provider-smoke-20260605-004` completed cleanly under the parser-versioned profile:

- `valid=true`
- `replay_steps=6`
- `mismatches=0`
- `validity_flags=none`
- `provider_timeout_detail_count=0`
- `workspace_carried_forward_due_to_provider_failure_checkpoints=0`
- `provider_profile_id=openrouter-loop-v1-modeldeepseek-deepseek-v4-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry0`
- both arms final 3/3
- final checkpoint delta 0
- regression-free AUC delta 0

This remains provider reliability evidence only because the run classification is `diagnostic_invalid`.

Historical clean smoke under the pre-parser-version `120000ms`/`4000`/`64000`/`4000` profile:

- `provider-smoke-20260605-003`
- `valid=true`
- `replay_steps=6`
- `mismatches=0`
- `validity_flags=none`
- `provider_profile_id=openrouter-loop-v1-modeldeepseek-deepseek-v4-flash-routeopenrouter-chat-completions-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry0`

`provider-smoke-20260605-002` used the same stronger profile and had no provider flags, no timeout details, and no provider carry-forward, but inspection was `valid=false` because a local `sample-cart` hidden-oracle status bug wrote `status: "ok"` while checks failed. That smoke is diagnostic-invalid artifact evidence only. The status aggregation bug was fixed and covered by local tests before rerunning `provider-smoke-20260605-003`.

Historical clean smoke under the previous `90000ms`/`8000` profile:

- `provider-smoke-20260605-001`
- `valid=true`
- `replay_steps=6`
- `mismatches=0`
- `validity_flags=none`
- `provider_profile_id=openrouter-loop-v1-timeout90000-output8000-temp0.2-retry0`

## Stop Conditions

Stop before any full provider difficulty probe if:

- any provider timeout occurs,
- any provider/API/quota/malformed-response flag appears,
- any workspace is carried forward due to provider failure,
- inspect reports artifact or replay mismatches,
- the provider profile ID or compatibility hash is not the planned profile.

Record the run as provider-flagged reliability evidence, not clean primary evidence.

## After a Clean Smoke

The loop-policy-versioned Mistral smoke gate was satisfied by `provider-smoke-20260605-011`, and the full difficulty probe `subscription-entitlements-difficulty-probe-20260605-010` was clean under the same profile. This closes the provider reliability gate for that Mistral model/provider compatibility boundary.

The same loop-policy-versioned Mistral profile also completed a clean inventory task-family difficulty probe: `inventory-reservations-difficulty-probe-20260605-001`. Inspection reported `valid=true`, 18 replay steps, zero mismatches, no validity flags, no provider timeouts, and zero provider-failure carry-forward checkpoints. This is difficulty/provider evidence only because the run classification is `difficulty_probe`.

It also completed a clean inventory causal pilot: `inventory-reservations-causal-pilot-20260605-001`. Inspection reported `valid=true`, 18 replay steps, zero mismatches, no validity flags, no provider timeouts, zero provider-failure carry-forward checkpoints, and complete feedback opportunity integrity on 9/9 checkpoints. This is task/model/budget-specific causal evidence only.

The Sonnet retry-enabled smoke gate was satisfied by `provider-smoke-20260605-009`, and the full difficulty probe `subscription-entitlements-difficulty-probe-20260605-009` was clean under the same profile. That boundary predates explicit `model_loop_policy_version` profile IDs and must not be pooled with loop-policy-versioned profiles.

Do not treat the Sonnet difficulty probe as causal evidence. The run classification is `difficulty_probe`, both arms passed 9/9, and the sealed analysis plan still names `deepseek/deepseek-v4-flash`. Any causal run using Sonnet needs an explicit versioned analysis-plan/profile decision before execution.

The retry-enabled smoke gate was satisfied by `provider-smoke-20260605-008`, but full difficulty probe `subscription-entitlements-difficulty-probe-20260605-008` was provider-flagged under the same profile. Do not rerun the same retry-enabled structured-output profile as a clean-evidence attempt.

The no-retry structured-output smoke gate was satisfied by `provider-smoke-20260605-007`, but full difficulty probe `subscription-entitlements-difficulty-probe-20260605-007` was provider-flagged under the same profile. Do not rerun the same versioned structured-output profile as a clean-evidence attempt.

The prior parser-versioned smoke gate was satisfied by `provider-smoke-20260605-004`, but full difficulty probe `subscription-entitlements-difficulty-probe-20260605-006` was provider-flagged under the same profile. Do not rerun the same parser-only profile as a clean-evidence attempt.

Do not rerun provider probes automatically. The next decision is whether to version the Sonnet profile for causal-pilot use, produce public credibility artifacts from the clean difficulty probe, or keep the sealed DeepSeek analysis plan and continue provider-route mitigation there.

## Latest Full Difficulty Probe Outcome

`subscription-entitlements-difficulty-probe-20260605-010` ran under the loop-policy-versioned Mistral retry-enabled structured-output profile after `provider-smoke-20260605-011`:

- `valid=true`
- `replay_steps=18`
- `mismatches=0`
- both arms final 9/9
- final checkpoint delta 0
- regression-free AUC delta 0
- `validity_flags=none`
- `provider_timeout_detail_count=0`
- `workspace_carried_forward_due_to_provider_failure_checkpoints=0`
- timeout phase: none

This is a clean full provider difficulty probe for the Mistral boundary. It is still not causal evidence because the run classification is `difficulty_probe`. The flat 9/9 result should be described as a clean difficulty/protocol-provider result under this task/model/budget, not as treatment-effect evidence.

## Previous Sonnet Full Difficulty Probe

`subscription-entitlements-difficulty-probe-20260605-009` ran under the Sonnet retry-enabled structured-output profile after `provider-smoke-20260605-009`:

- `valid=true`
- `replay_steps=18`
- `mismatches=0`
- both arms final 9/9
- final checkpoint delta 0
- regression-free AUC delta 0
- `validity_flags=none`
- `provider_timeout_detail_count=0`
- `workspace_carried_forward_due_to_provider_failure_checkpoints=0`
- timeout phase: none

This was the first clean full provider difficulty probe in the sequence. It is still not causal evidence because the run classification is `difficulty_probe`.

## Previous Retry-Enabled Structured-Output Full Probe

`subscription-entitlements-difficulty-probe-20260605-008` ran under the DeepSeek retry-enabled structured-output profile after `provider-smoke-20260605-008`:

- `valid=true`
- `replay_steps=18`
- `mismatches=0`
- both arms final 9/9
- final checkpoint delta 0
- regression-free AUC delta 0
- `validity_flags=provider_malformed_response`
- `provider_timeout_detail_count=0`
- `workspace_carried_forward_due_to_provider_failure_checkpoints=0`
- timeout phase: none

Provider-flagged checkpoints:

- `context_only_spec`: I04 malformed response, I09 malformed response
- `feedback_capable_spec`: I03 malformed response

This is structurally valid and replay-valid, but provider-flagged due to retry-recovered malformed responses. It is not clean primary evidence and does not justify moving to causal pilot.

## Previous No-Retry Structured-Output Full Probe

`subscription-entitlements-difficulty-probe-20260605-007` ran under the no-retry versioned structured-output profile after `provider-smoke-20260605-007`:

- `valid=true`
- `replay_steps=18`
- `mismatches=0`
- both arms final 9/9
- final checkpoint delta 0
- regression-free AUC delta 0
- `validity_flags=provider_malformed_response,provider_timeout`
- `provider_timeout_detail_count=1`
- `workspace_carried_forward_due_to_provider_failure_checkpoints=2`
- timeout phase: `pre_model_action_timeout`

Provider-flagged checkpoints:

- `context_only_spec`: I04 malformed response, I08 timeout

This is structurally valid and replay-valid, but provider-flagged. It is not clean primary evidence and does not justify moving to causal pilot.

## Previous Parser-Versioned Full Probe

`subscription-entitlements-difficulty-probe-20260605-006` ran under the parser-versioned `120000ms`/`4000`/`64000`/`4000` profile after `provider-smoke-20260605-004`:

- `valid=true`
- `replay_steps=18`
- `mismatches=0`
- both arms final 9/9
- final checkpoint delta 0
- regression-free AUC delta 0
- `validity_flags=provider_timeout,provider_malformed_response`
- `provider_timeout_detail_count=2`
- `workspace_carried_forward_due_to_provider_failure_checkpoints=9`
- timeout phase: `pre_model_action_timeout`

Provider-flagged checkpoints:

- `context_only_spec`: I03 timeout, I05 malformed, I06 timeout, I07 malformed, I08 malformed, I09 malformed
- `feedback_capable_spec`: I03 malformed, I04 malformed, I07 malformed

This is structurally valid and replay-valid, but provider-flagged. It is not clean primary evidence and does not justify moving to causal pilot.

## Previous Malformed-Response Difficulty Probe

`subscription-entitlements-difficulty-probe-20260605-005` ran under the pre-parser-version `120000ms`/`4000`/`64000`/`4000` profile after `provider-smoke-20260605-003`:

- `valid=true`
- `replay_steps=18`
- `mismatches=0`
- both arms final 9/9
- final checkpoint delta 0
- regression-free AUC delta 0
- `validity_flags=provider_malformed_response`
- `provider_timeout_detail_count=0`
- `workspace_carried_forward_due_to_provider_failure_checkpoints=5`

Malformed-response details:

- `context_only_spec`: I01, I02, I03, I05, I06, I08, I09
- `feedback_capable_spec`: I08

This is structurally valid and replay-valid, but provider-flagged. It is not clean primary evidence and does not justify moving to causal pilot. The local mitigation after this run accepts OpenRouter text-part content arrays, stops labeling malformed JSON as a timeout phase, and versions `response_parser_version` in provider profiles.

## Previous Timeout-Flagged Difficulty Probe

`subscription-entitlements-difficulty-probe-20260605-004` ran under the previous `90000ms`/`8000` profile after `provider-smoke-20260605-001`:

- `valid=true`
- `replay_steps=18`
- `mismatches=0`
- both arms final 9/9
- final checkpoint delta 0
- regression-free AUC delta 0.1111
- `validity_flags=provider_timeout`
- `provider_timeout_detail_count=6`
- `workspace_carried_forward_due_to_provider_failure_checkpoints=6`
- timeout phase: `pre_model_action_timeout`

Timed-out checkpoints:

- `context_only_spec`: I02, I07, I09
- `feedback_capable_spec`: I06, I07, I08

This is structurally valid and replay-valid, but provider-flagged. It is not clean primary evidence and does not justify moving to causal pilot.
Because every timeout happened before a usable model action, the workspace was carried forward on affected checkpoints. That carry-forward contamination means the 9/9 final score is not a clean difficulty signal.
