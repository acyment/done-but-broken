# Fake Pilot Operator Note

This note describes the current local pilot workflow. The fake adapter is for harness inspection. The direct OpenRouter adapter is a single-shot file-write path for real model smoke tests. The OpenRouter loop adapter is the current real experiment path for bounded model turns with visible feedback in `feedback_capable_spec`.

## Run

Run the three-checkpoint `sample-cart` task with both pilot conditions:

```sh
bun run pilot:fake --task tasks/sample-cart --runs-root runs --run-id sample-local
```

Print CLI help without starting a run:

```sh
bun run pilot:fake --help
```

The neutral script alias prints the same help:

```sh
bun run pilot:run --help
```

The two condition IDs are exactly:

- `context_only_spec`
- `feedback_capable_spec`

To generate a non-perfect run for summary inspection:

```sh
bun run pilot:fake --task tasks/sample-cart --runs-root runs --run-id sample-failing --fake-agent-mode context-i03-item-name-drift
```

Run the seven-checkpoint role-permissions calibration task:

```sh
bun run pilot:fake --task tasks/role-permissions-calibration --runs-root runs --run-id role-permissions-local
```

This task starts from an owner-edit-only candidate, so fake-agent runs are expected to validate the harness while failing later hidden checks in both arms.

Run the subscription lifecycle task through local fake validation without provider calls:

```sh
bun run pilot:fake --task tasks/subscription-entitlements-lifecycle --runs-root runs --run-id subscription-local
```

This task validates provenance, visible feedback assets, and hidden-oracle scoring locally. `result.json` and `summary.md` are written for this task.

The subscription task package also includes `local-acceptance-criteria.json` and sealed `analysis-plan.json`. These are pre-provider gates for auditing the local feedback/oracle implementation before any explicitly requested provider probe.

Protocol profile selection is explicit. The default generated manifest profile is `final-checkpoint-primary-v1`. Use `--protocol-profile-id path-survival-primary-v1` only for future path-survival-primary validation runs after the protocol and run matrix are reviewed and approved. Do not run provider/model experiments while freezing protocol docs or metric-profile manifests.

Do not run provider/model experiments while freezing protocol docs.

Run the same pilot with the direct OpenRouter adapter:

```sh
OPENROUTER_API_KEY=sk-or-... bun run pilot:run --task tasks/sample-cart --runs-root runs --run-id sample-openrouter --agent openrouter
```

The default OpenRouter model is `deepseek/deepseek-v4-flash`. Override it with `OPENROUTER_MODEL` or `--openrouter-model <id>`.

Run the role-permissions calibration with the bounded OpenRouter loop adapter:

```sh
OPENROUTER_API_KEY=sk-or-... bun run pilot:run --task tasks/role-permissions-calibration --runs-root runs --run-id role-permissions-openrouter-loop --agent openrouter-loop --max-model-turns 3 --max-feedback-runs 2
```

The loop default policy is `max_model_turns=3` and `max_feedback_runs=2`. In `feedback_capable_spec`, the model receives public-safe summaries from the visible feedback command. In `context_only_spec`, later turns self-review against the same visible semantic spec text without feedback output. Hidden oracle checks still run only after agent work and are never included in prompt packets or feedback summaries.

OpenRouter request behavior is part of the recorded provider execution profile. The CLI supports `--request-timeout-ms`, `--max-output-tokens`, `--max-workspace-bytes`, `--max-feedback-output-bytes`, `--openrouter-response-format`, `--openrouter-require-parameters`, `--protocol-profile-id`, and `--temperature`; changing any of these creates a different compatibility boundary and must not be pooled with prior runs. Profiles also record the model ID, provider route, endpoint, response parser version, request parameter version, response format version, provider parameter-routing requirement, prompt renderer version, feedback summary version, and retry policy.

Validity-flagged provider runs are not clean primary evidence. A causal pilot is clean primary evidence eligible only when it is classified as `causal_pilot` and has no validity flags. Timeout details record provider failure phase, feedback availability, model-response receipt, code-change state, retry count, and whether the workspace was carried forward because no usable provider action was available.

Before another full provider run, use `docs/provider-smoke-test-plan.md`. The latest loop-policy-versioned clean smoke profile is `openrouter-loop-v1-modelmistralai-mistral-small-2603-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1`; it is provider reliability evidence, not primary evidence. Any model/provider/profile change needs an explicit analysis-plan or compatibility-boundary decision before causal use.

Public-facing evidence artifacts start at `docs/public-evidence-status.md`, with a compact cross-run claim matrix at `docs/public-evidence-matrix.md`. The current set includes run cards for clean difficulty and causal runs, task cards for the sealed task families, regression-free success plots, and an explainer for why timeout-flagged 9/9 runs are not clean evidence.

The first clean Sonnet causal pilot is `subscription-entitlements-causal-pilot-20260605-002`. Inspection reports `valid=true`, zero replay mismatches, no provider validity flags, clean primary evidence eligibility, and complete feedback opportunity integrity on 9/9 checkpoints. The measured treatment result is flat under this task/model/budget: both arms passed 9/9, final delta 0, and regression-free AUC delta 0. The prior causal attempt `subscription-entitlements-causal-pilot-20260605-001` is invalid diagnostic context because feedback opportunity integrity was incomplete.

The first clean Mistral causal pilot is `subscription-entitlements-causal-pilot-20260605-003`. Inspection reports `valid=true`, zero replay mismatches, no provider validity flags, clean primary evidence eligibility, and complete feedback opportunity integrity on 9/9 checkpoints. The primary final pass-rate delta is 0, while the secondary regression-free AUC delta is 0.1111 because context-only missed I01 before recovering and feedback-capable passed from I01 onward. This is still task/model/budget-specific evidence, not a generalized benchmark claim.

The first clean inventory causal pilot is `inventory-reservations-causal-pilot-20260605-001`. Inspection reports `valid=true`, zero replay mismatches, no provider validity flags, clean primary evidence eligibility, and complete feedback opportunity integrity on 9/9 checkpoints. Both arms passed all checkpoints, with primary final pass-rate delta 0 and secondary regression-free AUC delta 0. This is task/model/budget-specific evidence, not a generalized benchmark claim.

Run the stubbed loop tests without real network access:

```sh
bun test test/model-loop-agent.test.ts
```

Direct OpenRouter is used before an opencode CLI bridge because it fits the repository's `AgentAdapter` contract and keeps request/response provenance under the harness. An opencode bridge is deferred until the experiment needs a full opencode session with its own provider auth, config, and tool-loop state.

## Inspect

Validate a completed run:

```sh
bun run inspect:run --run-manifest runs/sample-local/run.json
```

The inspection command validates the run manifest, provider execution profile, clean primary evidence eligibility, provider/network validity details, paired result/summary declarations, checkpoint manifests, checkpoint hash and agent-status consistency with `run.json`, declared artifact paths, artifact hashes, replay plan, result record, summary hash, checkpoint-level provider-failure carry-forward, and causal feedback-use evidence for feedback-capable causal pilots. Feedback-capable causal pilots must show a persisted `model_turn -> feedback_run -> model_turn` transcript sequence before they can count as causal feedback-use evidence.

Inspection also prints public evidence-status fields: run classification, protocol profile ID, clean primary evidence eligibility, validity flags, provider profile ID, provider timeout phases, timeout detail count, provider-failure carry-forward checkpoint count, and feedback opportunity integrity.

Print inspection help without loading a manifest:

```sh
bun run inspect:run --help
```

Invalid runs exit non-zero and print actionable lines such as `valid=false`, `error=<reason>`, and `mismatch=<artifact>:<reason>`.

The compact malformed-manifest output fixture is tracked at `test/fixtures/malformed-inspect-output.txt`.
The result metadata drift fixture is tracked at `test/fixtures/result-metadata-drift-mismatch.txt`.
The agent-result status drift fixture is tracked at `test/fixtures/agent-status-drift-mismatch.txt`.
The workspace snapshot drift fixture is tracked at `test/fixtures/workspace-snapshot-drift-mismatch.txt`.
The invalid checkpoint manifest schema-error fixture is tracked at `test/fixtures/invalid-checkpoint-manifest-schema-error.txt`.
The checkpoint path-containment schema-error fixture is tracked at `test/fixtures/checkpoint-path-containment-schema-error.txt`.
The one-sided result/summary declaration fixture is tracked at `test/fixtures/one-sided-result-summary-declaration-error.txt`.
The missing declared hidden-oracle result fixture is tracked at `test/fixtures/missing-declared-hidden-oracle-result-mismatch.txt`.
The hidden-oracle failed-status mismatch fixture is tracked at `test/fixtures/hidden-oracle-failed-status-mismatch.txt`.
The replay checkpoint hash drift fixture is tracked at `test/fixtures/replay-checkpoint-hash-drift-error.txt`.
The replay agent-status drift fixture is tracked at `test/fixtures/replay-agent-status-drift-error.txt`.

## Artifact Map

The run root is `runs/<run_id>/`.

- `runs/<run_id>/run.json`: run manifest and provenance entry point. It records run classification, validity flags, clean primary evidence eligibility, model/provider settings, protocol profile, provider execution profile, and compatibility hashes.
- `runs/<run_id>/task-seal.json`: task sealing manifest with checkpoint order, visible spec hashes, feedback asset hashes, hidden oracle hash, template workspace hash, package hashes, and public API contract.
- `runs/<run_id>/result.json`: `result-schema-v1` result record when hidden oracle checks run.
- `runs/<run_id>/summary.md`: Markdown result summary, including evidence-status metadata when hidden-oracle results are present.
- `runs/<run_id>/<condition>/workspace/`: continuing workspace for one condition.
- `runs/<run_id>/<condition>/checkpoints/<checkpoint_id>/manifest.json`: checkpoint manifest; declares agent status, snapshot file paths, provider-failure workspace carry-forward state, feedback opportunity integrity for causal pilots, and hidden-oracle result path/hash pairs when hidden-oracle results are present. Declared checkpoint artifact paths must stay under the checkpoint artifact directory.
- `runs/<run_id>/<condition>/checkpoints/<checkpoint_id>/prompt-packet.json`: rendered prompt packet.
- `runs/<run_id>/<condition>/checkpoints/<checkpoint_id>/agent-result.json`: agent result record; status, notes, adapter ID, and transcript schema fields are validated, and status must match checkpoint manifest `agent_status`.
- `runs/<run_id>/<condition>/checkpoints/<checkpoint_id>/hidden-oracle-result.json`: hidden oracle checks, when enabled; the verifier uses the path declared by the checkpoint manifest. Status, notes, non-empty checks, check details, and check fields are schema-validated during artifact verification. If any check fails, status must be `failed`.
- `runs/<run_id>/<condition>/checkpoints/<checkpoint_id>/workspace-before.json`: pre-checkpoint workspace snapshot; the verifier uses the path declared by the checkpoint manifest, and its `hash` must match the checkpoint manifest.
- `runs/<run_id>/<condition>/checkpoints/<checkpoint_id>/workspace-after.json`: post-checkpoint workspace snapshot; the verifier uses the path declared by the checkpoint manifest, and its `hash` must match the checkpoint manifest.

Checkpoint `workspace-before.json` and `workspace-after.json` declarations must be distinct.
