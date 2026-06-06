# HIT SDD Bench

This is a clean experiment repo for a long-horizon agent-coding benchmark.

The research question is narrow:

> Do specs that can be used as automated feedback reduce long-run regressions and behavioral drift in agentic coding compared with equivalent specs used only as durable context?

The initial pilot has exactly two arms:

- `context_only_spec`
- `feedback_capable_spec`

Both arms receive semantically equivalent visible spec content. The only causal variable is whether that same semantic spec can also be used as automated feedback during the agent run.

## Current Scope

This repo intentionally contains only a small framework skeleton:

- canonical semantic spec records
- two-condition packet rendering
- executable-feedback gating
- a continuing-workspace runner skeleton
- workspace snapshot hashes
- on-disk task package loading
- run and checkpoint provenance hashes
- run classification, provider execution profile hashes, clean primary evidence eligibility, and provider/network validity details
- protocol profile IDs for metric compatibility boundaries
- prompt packet and feedback asset tamper checks
- per-checkpoint agent result records
- optional hidden oracle result capture
- `result-schema-v1` with final-checkpoint pass rate, regression count, checkpoint-level regression-free success, and regression-free AUC
- a fake agent used by tests
- a direct OpenRouter agent adapter for real single-shot model runs
- a bounded OpenRouter feedback-loop adapter for real model turns with visible feedback in the feedback arm
- task-specific hidden oracles for `tasks/sample-cart` and `tasks/role-permissions-calibration`
- a small pilot CLI with fake, OpenRouter, and OpenRouter feedback-loop adapter modes

It does not contain a general benchmark platform, legacy condition names, OpenSpec/Bdd/HIT-SDD arms, a full tool-loop coding-agent protocol, or multi-agent protocols.

## Task Package

The first minimal package is in `tasks/sample-cart/`:

- `task.json` defines checkpoints, workspace paths, and public contract text.
- `canonical-spec.json` is the neutral semantic spec source shared by both arms.
- `feedback-assets/` stores source files that are copied only for `feedback_capable_spec`.
- `hidden-oracle/` is outside the template workspace and is not rendered into agent-visible packets.

The sample task currently has three checkpoints: `I01`, `I02`, and `I03`. `I03` adds an item-name visibility commitment that can expose drift while preserving the same two-arm protocol.

The harder calibration package is in `tasks/role-permissions-calibration/`. It has seven checkpoints, `I01` through `I07`, over a stable `canAccessProject` API. The task starts from an owner-edit-only implementation and adds org admin edit, viewer read-only, suspension, explicit deny precedence, cross-org denial, and temporary project grant commitments. Feedback assets accumulate as a regression pack for `feedback_capable_spec`; hidden oracle cases use separate private combinations.

The next primary task draft is in `tasks/subscription-entitlements-lifecycle/`. It is a sealed semantic-spec draft for `subscription-entitlements-lifecycle-v0` with checkpoints `I01` through `I09` over subscription state transitions, temporal access, billing history, idempotency, suspension, downgrade, refund, and chargeback behavior. It includes a visible/hidden coverage manifest, fake-agent validation plan, local acceptance criteria, sealed analysis plan, visible feedback assets, reference template workspace, and executable hidden oracle.

The runner writes replay-oriented records under `runs/<run_id>/`, including `run.json` and per-checkpoint manifests with prompt packet and feedback asset hashes. `run.json` and checkpoint manifests have schema validators in the provenance module, including checkpoint-entry field checks, condition checkpoint sequence checks against the top-level checkpoint list, checkpoint hash and agent-status consistency between `run.json` and checkpoint manifests, agent status, distinct snapshot file declarations under the checkpoint artifact directory, hidden-oracle result path/hash declaration symmetry under the checkpoint artifact directory, and duplicate-entry checks before replay or artifact verification.

When a hidden oracle adapter is supplied, the runner also writes per-checkpoint `hidden-oracle-result.json` files and a run-level `result.json`. Hidden oracle files stay outside the template workspace and are not rendered into agent-visible prompt packets.

`result-schema-v1` records are rendered into `summary.md`, a compact Markdown summary of pass rates, regressions, checkpoint survival, feedback-minus-context delta, and regression-free AUC delta. `run.json` records both result and summary paths and hashes.

Generated manifests include `protocol_profile_id`. The default profile is `final-checkpoint-primary-v1`, preserving the historical final-pass-primary interpretation. Future internal validation runs may use `path-survival-primary-v1`, where `regression_free_auc` is the protocol primary metric and final checkpoint pass rate remains reported as secondary.

## Fake Pilot CLI

Run the sample task end to end with the fake agent:

```sh
bun run pilot:fake --task tasks/sample-cart --runs-root runs --run-id sample-local
```

This loads the task package, runs both pilot conditions, applies the `sample-cart` hidden oracle, and writes replayable artifacts under `runs/sample-local/`.

The CLI output includes the run manifest, result record, summary path, and final feedback-minus-context delta.

To generate a deliberately non-perfect sample-cart run:

```sh
bun run pilot:fake --task tasks/sample-cart --runs-root runs --run-id sample-failing --fake-agent-mode context-i03-item-name-drift
```

Run the seven-checkpoint role-permissions calibration task with the fake agent:

```sh
bun run pilot:fake --task tasks/role-permissions-calibration --runs-root runs --run-id role-permissions-local
```

Run the subscription lifecycle task through local fake provenance validation and hidden-oracle scoring without provider calls:

```sh
bun run pilot:fake --task tasks/subscription-entitlements-lifecycle --runs-root runs --run-id subscription-local
```

## Real Agent Adapters

The real adapters call OpenRouter directly through its chat completions API. They default to `deepseek/deepseek-v4-flash` and can be changed with `OPENROUTER_MODEL` or `--openrouter-model`.

`--agent openrouter` is the original single-shot file-write adapter. It is useful for smoke-testing real model connectivity, but it is not the executable-feedback experiment path because the model does not see feedback during its work.

```sh
OPENROUTER_API_KEY=sk-or-... bun run pilot:run --task tasks/sample-cart --runs-root runs --run-id sample-openrouter --agent openrouter
```

`--agent openrouter-loop` is the bounded feedback-loop adapter. Its default policy is `max_model_turns=3` and `max_feedback_runs=2`. In `feedback_capable_spec`, the loop runs the rendered visible feedback command between model turns and feeds a public-safe feedback summary back to the model. In `context_only_spec`, it uses the same visible semantic spec text for self-review and does not expose executable feedback output.

```sh
OPENROUTER_API_KEY=sk-or-... bun run pilot:run --task tasks/role-permissions-calibration --runs-root runs --run-id role-permissions-openrouter-loop --agent openrouter-loop --max-model-turns 3 --max-feedback-runs 2
```

OpenRouter request settings are recorded as a provider execution profile. `--request-timeout-ms`, `--max-output-tokens`, and `--temperature` are compatibility boundaries and must not be pooled across different profile hashes.

`--protocol-profile-id path-survival-primary-v1` selects the future path-survival primary metric profile for local or explicitly authorized runs. Do not use it for provider/model experiments until the protocol and run matrix are reviewed and approved.

Both adapters send the rendered packet plus a bounded text snapshot of the current workspace and expect a JSON response containing full file contents to write. Returned paths must be relative and stay inside the condition workspace. Model writes to executable feedback assets are rejected before any workspace writes are applied.

Provider/API/timeout/quota/network failures are validity-flagged. Timeout details include failure phase, whether feedback had run, whether a model response was received, whether code changed, retry count, and whether the next checkpoint carried the workspace forward because no usable provider action was available. Validity-flagged provider runs are not clean primary evidence.

No real network request is made by automated tests. OpenRouter tests use mocked fetch implementations, including the loop tests:

```sh
bun test test/model-loop-agent.test.ts
```

Direct OpenRouter is the first implementation because it fits the existing `AgentAdapter` contract and keeps provenance simple. An opencode CLI bridge is deferred until the benchmark needs a full tool-using coding-agent session with opencode auth/config/session handling.

To inspect and validate a completed run:

```sh
bun run inspect:run --run-manifest runs/sample-local/run.json
```

Both CLIs support `--help`. The inspection command validates the run manifest, replay plan, declared artifact paths, and artifact hashes, then prints the result and summary paths. Invalid runs exit non-zero and include `valid=false` plus `error=` or `mismatch=` lines.

`verifyRunArtifacts` also checks the task package hash and canonical spec hash recorded in `run.json` against the current on-disk task package, requires result and summary declarations to be present together with valid path/hash fields, verifies that `result.json` run metadata matches `run.json`, catches agent-result schema/status drift against checkpoint manifests, enforces causal feedback-use evidence for feedback-capable causal pilots, validates checkpoint-level provider-failure workspace carry-forward, validates agent notes, validates hidden-oracle status, notes, non-empty checks, check details, and check fields, confirms workspace snapshot records match manifest snapshot hashes, uses declared workspace snapshot and hidden-oracle result paths, and reports invalid checkpoint manifests as schema errors before dependent artifact reads. Feedback-capable causal pilots must show a persisted `model_turn -> feedback_run -> model_turn` transcript sequence before counting as causal feedback-use evidence. Hidden-oracle status must be `failed` whenever any check fails. `validateRunResultRecord` recomputes the primary metric and regression-free AUC from evaluations so forged metric fields are rejected and validates evaluation and oracle check fields.

## Metric Interpretation

Pass rate and regression count answer different questions.

Pass rate measures behavior at the final checkpoint. It is the number of passing checks at the final checkpoint divided by the number of active final-checkpoint checks.

Regression count measures commitments that passed earlier for the same condition and failed later. A newly introduced failing commitment lowers pass rate, but it is not counted as a regression until it has passed in an earlier checkpoint and then fails later.

Checkpoint `regression_free_success` is recorded in `result.json` and summarized in `summary.md`. It is true when all hidden-oracle checks active at that checkpoint pass, so it can drive a cumulative behavior-survival line across checkpoints.

`regression_free_auc` is the mean checkpoint-level `regression_free_success` score per condition. It summarizes how much of the checkpoint sequence survived without a failing hidden-oracle checkpoint.

Under the default historical profile, the primary comparison is the final-checkpoint pass-rate delta:

```text
feedback_capable_spec pass rate - context_only_spec pass rate
```

Under `path-survival-primary-v1`, the protocol primary comparison is `regression_free_auc` delta. Existing clean pilots were not designed with this profile as primary; their AUC values remain retrospective secondary observations unless a future compatibility decision says otherwise.

## Commands

Use Bun for JavaScript and TypeScript work:

```sh
bun install
bun test
```

Python is not used in the initial skeleton. If Python is added later, it must be managed with `uv`.

Charts and old benchmark behavior are intentionally out of scope for the current fake-pilot skeleton.
