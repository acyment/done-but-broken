# payroll-net-pay-sonnet-4.6-output12000-retry-v1

Status: sealed provider-profile retry boundary for the payroll A2 difficulty gate.

## Reason

The first Sonnet 4.6 payroll A2 attempt, `payroll-net-pay-sonnet-4.6-a2-difficulty-001`, is replay-valid but provider-flagged:

- run classification: `difficulty_probe`
- replay: `valid=true`, 36 steps, 0 mismatches
- validity flag: `provider_malformed_response`
- workspace carried forward after provider failure: 23 checkpoints
- failure signature: malformed JSON with `Unterminated string`
- exclusion: not clean primary evidence and not a clean A2 ceiling gate

The malformed responses begin when the payroll implementation becomes large enough that the frozen 4k output cap is an operational bottleneck. This retry changes only provider prompt-pressure settings needed to make the same sealed task runnable. It does not change task version, checkpoint list, visible specs, feedback assets, hidden oracle, model, conditions, budget, metric, or interpretation rules.

## Frozen Retry Profile

- Task: `payroll-net-pay-lifecycle`
- Task version: `payroll-net-pay-lifecycle-v1`
- Freeze commit for task boundary: `8dd36432f58eaa395aa3d8b6fbbe8d922a082425`
- Run classification: `difficulty_probe`
- Conditions: `context_only_spec`, `feedback_capable_spec`
- Protocol profile: `path-survival-primary-v1`
- Budget: `--max-model-turns 2 --max-feedback-runs 1`
- Provider/model: OpenRouter, `anthropic/claude-sonnet-4.6`
- Changed from prior attempt: `--max-output-tokens 12000`, `--max-workspace-bytes 128000`
- Unchanged from prior attempt: `--request-timeout-ms 120000`, `--max-feedback-output-bytes 4000`, `--provider-max-retries 1`, `--temperature 0.2`, JSON schema response format with required parameters.
- Provider execution profile ID:
  `openrouter-loop-v1-modelanthropic-claude-sonnet-4.6-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output12000-workspace128000-feedback4000-temp0.2-retry1`

## Canonical Command

```bash
bun run pilot:run \
  --task tasks/payroll-net-pay-lifecycle \
  --runs-root runs \
  --run-id payroll-net-pay-sonnet-4.6-a2-difficulty-output12000-001 \
  --agent openrouter-loop \
  --openrouter-model anthropic/claude-sonnet-4.6 \
  --run-classification difficulty_probe \
  --protocol-profile-id path-survival-primary-v1 \
  --max-model-turns 2 \
  --max-feedback-runs 1 \
  --condition-concurrency 2 \
  --request-timeout-ms 120000 \
  --max-output-tokens 12000 \
  --max-workspace-bytes 128000 \
  --max-feedback-output-bytes 4000 \
  --openrouter-response-format json_schema \
  --openrouter-require-parameters true \
  --provider-max-retries 1 \
  --temperature 0.2
```

## Interpretation Rules

Use the original `payroll-net-pay-ceiling-test-v1` gate unchanged.

- If this retry is provider-flagged, do not treat it as a clean A2 gate.
- If it is clean and `context_only_spec` reaches 18/18, stop: the task still ceilings Sonnet under this profile.
- If it is clean and both arms are near floor, stop: the task/profile is too hard or operationally unstable.
- If it is clean and `context_only_spec` does not reach 18/18 while feedback is not floor, the task clears the strong-model ceiling gate for this provider boundary. Causal pilots still require a separate explicit authorization.
