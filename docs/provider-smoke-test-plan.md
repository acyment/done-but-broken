# Provider Smoke-Test Plan

Purpose: verify the external provider path after timeout mitigation before another full `subscription-entitlements-lifecycle-v0` provider run.

This is not primary evidence. Treat these runs as provider reliability checks only.

## Current Mitigation Choice

Use a smaller, explicitly versioned OpenRouter loop profile before the next full provider run:

- Adapter: `openrouter-loop`
- Request timeout: `90000ms`
- Max output tokens: `8000`
- Temperature: `0.2`
- Retries: `0`
- Expected provider profile ID: `openrouter-loop-v1-timeout90000-output8000-temp0.2-retry0`

This mitigates the timeout-flagged probe by reducing output pressure and extending the per-call timeout while making the changed profile visible in manifests and compatibility hashes.

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
  --run-classification diagnostic_invalid \
  --max-model-turns 1 \
  --max-feedback-runs 0 \
  --request-timeout-ms 90000 \
  --max-output-tokens 8000 \
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
- provider profile ID exactly `openrouter-loop-v1-timeout90000-output8000-temp0.2-retry0`

Because the smoke is `diagnostic_invalid`, `clean_primary_evidence_eligible=false` is expected.

## Stop Conditions

Stop before any full provider difficulty probe if:

- any provider timeout occurs,
- any provider/API/quota/malformed-response flag appears,
- any workspace is carried forward due to provider failure,
- inspect reports artifact or replay mismatches,
- the provider profile ID or compatibility hash is not the planned profile.

Record the run as provider-flagged reliability evidence, not clean primary evidence.

## After a Clean Smoke

Only after a clean smoke, and only with explicit user authorization, run one clean `subscription-entitlements-lifecycle-v0` difficulty probe under the same provider profile. Do not mutate the subscription task in response to the timeout-flagged 9/9 probe.
