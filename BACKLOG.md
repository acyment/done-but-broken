# Backlog

## Project Direction

- Goal: credible, reproducible, hard-to-fake engineering evidence for industry-facing writing, demos, and run artifacts.
- This is not peer-reviewed-publication-first. Keep the evidence hygiene; change the presentation and backlog priorities.
- Continue the explicit two-arm protocol with exactly `context_only_spec` and `feedback_capable_spec`.
- Keep the causal variable narrow: same visible semantic spec content with executable feedback off versus the same visible semantic spec content with executable feedback on.
- Keep the bounded loop budget at 2/1 for causal feedback-use runs unless a later analysis plan precommits a different equal-turn budget.
- Treat one-turn runs as difficulty probes only unless feedback can actually influence a later model turn.
- Avoid adding arms, legacy condition IDs, ordinary-test comparisons, spec-format comparisons between arms, permission-checkpoint extensions, formal statistical replication, many-model matrices, or a general benchmark platform.
- The shared-environment OpenSpec workflow under protocol profile `e1-openspec-workflow-v0` is in scope: both arms work inside the same OpenSpec-initialized workspace and the harness runs the pinned `openspec` archive step identically in both arms; the causal variable remains executable-feedback availability. It is its own non-pooled compatibility boundary. (Guardrail revision 2026-06-10, made before any OpenSpec-profile run existed.)
- The active program is the E1 frontier path: bring E1 to evidence grade, add the OpenSpec workflow profile, then design the first multi-file evidence task where frontier models do not ceiling.
- `path-survival-primary-v1` remains the metric profile rule: path survival / `regression_free_auc` is primary only for runs that explicitly declare that protocol profile. Existing clean pilots remain historical final-pass-primary evidence with retrospective AUC observations. The Stage 1 subscription/inventory validation matrix is superseded before execution (see `docs/protocols/path-survival-primary-v1-validation-matrix-supersession-v1.md`).

## Current Evidence State

- Core harness: condition rendering fairness, feedback gating, continuing workspaces, hidden oracle isolation, task package loading/validation, task sealing, run/checkpoint manifests, hashes, replay validation, artifact tamper detection, compatibility profiles, classification, causal max-turn enforcement, context-only feedback isolation, feedback-use evidence checks, provider/network validity flags, and `result-schema-v1`.
- Result metrics include final checkpoint pass-rate delta, regression counts, checkpoint-level `regression_free_success`, and `regression_free_auc`.
- Headline result (pricing, first credible positive evidence): on the `pricing-discount-lifecycle` family under Mistral-small, 2-turn/1-feedback, `path-survival-primary-v1`, 3 clean causal pilots per matrix, sealed before runs. `pricing-discount-demo-v1` (v0): executable, example-bearing specs beat prose-only specs — mean regression-free-AUC delta +0.4444 (3/3), final +0.5926 — but confounded because the prose arm was not shown the event API and stalled at the seed. `pricing-discount-content-controlled-demo-v1`: with the event API and worked examples equalized across both arms, the executable feedback loop still helped — mean AUC delta +0.1852 (3/3), final +0.2222, regression deltas (fb−ctx) 0/0/−1. Honest decomposition: the v0 gap was partly interface/example disclosure and partly the run-loop itself.
- Subscription and inventory remain calibration/difficulty context only: easier tasks, flat final-pass deltas (one positive retrospective secondary AUC under Mistral subscription). Not headline evidence; not pooled with pricing.
- Public evidence package committed: `docs/pricing-discount-public-narrative.md`, `docs/public-evidence-status.md`, `docs/public-evidence-matrix.md`, plus the two pricing run cards and the subscription/inventory run/task cards. Claims are bounded: single-model, single-task-family, small-n, not generalized, not pooled across boundaries.
- Strong-model content-controlled controls are sealed as separate non-pooled provider boundaries on the content-controlled task; initial A1 smokes have been operator-run. `anthropic/claude-sonnet-4.6` smoke is clean with both arms 9/9 (a possible ceiling hint, but only a `diagnostic_invalid` smoke, not causal evidence); `google/gemini-3.1-pro-preview` smoke is provider-flagged (`provider_malformed_response` + `provider_timeout`) and stopped at the clean-smoke gate — another cheaper-model structured-output reliability dead end. Difficulty probes and causal pilots for these controls are not yet run; further provider execution requires explicit authorization.
- Latest local suite: `bun test`, 193 tests, 0 failures.
- Local fake-pilot validation for `subscription-entitlements-lifecycle-v0` passes with replay, artifact verification, summaries, and hidden-oracle scoring.
- Provider probe `subscription-entitlements-difficulty-probe-20260605-003`: `difficulty_probe`, OpenRouter loop, `max_model_turns=2`, `max_feedback_runs=1`, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, both arms 9/9, delta 0, regression-free AUC delta 0.
- The provider probe had timeout flags on 10 checkpoints. It is structurally valid and replay-valid, but provider-flagged and not clean primary evidence.
- Provider probe `subscription-entitlements-difficulty-probe-20260605-004`: `difficulty_probe`, OpenRouter loop, profile `openrouter-loop-v1-timeout90000-output8000-temp0.2-retry0`, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, both arms 9/9, final delta 0, regression-free AUC delta 0.1111.
- The 004 provider probe had timeout flags on 6 checkpoints: `context_only_spec` I02/I07/I09 and `feedback_capable_spec` I06/I07/I08. It is structurally valid and replay-valid, but provider-flagged and not clean primary evidence.
- All 004 timeouts were `pre_model_action_timeout`, so no usable provider action occurred for those checkpoints and the workspace was carried forward due to provider failure. This contaminates difficulty interpretation and keeps provider reliability as the blocker.
- Provider smoke `provider-smoke-20260605-003`: `diagnostic_invalid`, OpenRouter loop, profile `openrouter-loop-v1-modeldeepseek-deepseek-v4-flash-routeopenrouter-chat-completions-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry0`, inspection `valid=true`, 6 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 3/3, final delta 0, regression-free AUC delta 0.
- This smoke is provider reliability evidence only. It is not primary evidence and says nothing causal.
- Provider probe `subscription-entitlements-difficulty-probe-20260605-005`: `difficulty_probe`, OpenRouter loop, same `120000`/`4000`/`64000`/`4000` profile as `provider-smoke-20260605-003`, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, both arms 9/9, final delta 0, regression-free AUC delta 0.
- The 005 provider probe had `provider_malformed_response` on 8 checkpoints and provider-failure carry-forward on 5 checkpoints. It is structurally valid and replay-valid, but provider-flagged and not clean primary evidence.
- Provider smoke `provider-smoke-20260605-004`: `diagnostic_invalid`, OpenRouter loop, parser-versioned profile `openrouter-loop-v1-modeldeepseek-deepseek-v4-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry0`, inspection `valid=true`, 6 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 3/3, final delta 0, regression-free AUC delta 0.
- Provider probe `subscription-entitlements-difficulty-probe-20260605-006`: `difficulty_probe`, OpenRouter loop, same parser-versioned profile as `provider-smoke-20260605-004`, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, both arms 9/9, final delta 0, regression-free AUC delta 0.
- The 006 provider probe had `provider_timeout` on 2 checkpoints, `provider_malformed_response` on 7 checkpoints, and provider-failure carry-forward on 9 checkpoints. It is structurally valid and replay-valid, but provider-flagged and not clean primary evidence.
- Provider smoke `provider-smoke-20260605-005`: `diagnostic_invalid`, first structured-output profile attempt, inspection `valid=true`, 6 replay steps, 0 artifact mismatches, but `provider_api_failure` on all 6 checkpoints because OpenRouter found no endpoint that could handle the requested parameters. This exposed an unversioned request-shape issue: the adapter was sending `max_completion_tokens`.
- Local mitigation after 005: OpenRouter requests now use `max_tokens`, and provider execution profiles version `request_parameter_version=openrouter-chat-request-max-tokens-v1`.
- Provider smoke `provider-smoke-20260605-007`: `diagnostic_invalid`, versioned structured-output profile `openrouter-loop-v1-modeldeepseek-deepseek-v4-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry0`, inspection `valid=true`, 6 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 3/3, final delta 0, regression-free AUC delta 0.
- Provider probe `subscription-entitlements-difficulty-probe-20260605-007`: `difficulty_probe`, same versioned structured-output profile as `provider-smoke-20260605-007`, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, both arms 9/9, final delta 0, regression-free AUC delta 0.
- The 007 provider probe had `provider_malformed_response` at `context_only_spec` I04 and `provider_timeout` at `context_only_spec` I08, with provider-failure carry-forward on 2 checkpoints. It is structurally valid and replay-valid, but provider-flagged and not clean primary evidence.
- Local mitigation after 007: OpenRouter loop now supports `--provider-max-retries`, records retry-recovered timeout/malformed failures as validity details on otherwise successful agent results, and versions `retry_policy_version=provider-retry-timeout-rate-malformed-v1` when retries are enabled.
- Provider smoke `provider-smoke-20260605-008`: `diagnostic_invalid`, retry-enabled structured-output profile `openrouter-loop-v1-modeldeepseek-deepseek-v4-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1`, inspection `valid=true`, 6 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 3/3, final delta 0, regression-free AUC delta 0.
- Provider probe `subscription-entitlements-difficulty-probe-20260605-008`: `difficulty_probe`, same retry-enabled profile as `provider-smoke-20260605-008`, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, both arms 9/9, final delta 0, regression-free AUC delta 0.
- The 008 provider probe had no timeouts and no provider-failure carry-forward, but it recorded retry-recovered `provider_malformed_response` details at `context_only_spec` I04, `context_only_spec` I09, and `feedback_capable_spec` I03. It is structurally valid and replay-valid, but provider-flagged and not clean primary evidence.
- Provider smoke `provider-smoke-20260605-009`: `diagnostic_invalid`, model-route changed to `anthropic/claude-sonnet-4.6` while keeping the structured-output retry profile shape, inspection `valid=true`, 6 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 3/3, final delta 0, regression-free AUC delta 0.
- Provider probe `subscription-entitlements-difficulty-probe-20260605-009`: `difficulty_probe`, same Sonnet structured-output retry profile as `provider-smoke-20260605-009`, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 9/9, final delta 0, regression-free AUC delta 0.
- The 009 probe is the first clean full provider difficulty probe in this sequence, but it is a difficulty probe only. It is not causal evidence, and the flat 9/9 result means that under this task/model/budget the task appears easy for both arms.
- The sealed analysis plan currently freezes `deepseek/deepseek-v4-flash`; the Sonnet run is a separate model/provider compatibility boundary and must not be pooled with the DeepSeek-profile runs or silently promoted into that sealed plan.
- Sonnet analysis-plan boundary added: `tasks/subscription-entitlements-lifecycle/analysis-plan.sonnet-causal-pilot-v0.json` freezes `anthropic/claude-sonnet-4.6` plus the exact structured-output retry provider profile for causal-pilot use.
- Causal pilot `subscription-entitlements-causal-pilot-20260605-001`: `causal_pilot`, same Sonnet profile, generated a summary but failed inspection because feedback opportunity integrity was incomplete and feedback-arm agent-result artifacts had schema/evidence mismatches. It is invalid and must remain diagnostic context only.
- Local mitigation after 001: model-loop runs no longer stop immediately after a passing feedback command; feedback-capable runs continue to the later model turn required for causal feedback-use evidence.
- Causal pilot `subscription-entitlements-causal-pilot-20260605-002`: `causal_pilot`, same sealed Sonnet profile, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, feedback opportunity integrity complete 9/9, both arms 9/9, final delta 0, regression-free AUC delta 0.
- The 002 causal pilot is clean primary evidence for a flat/null result under this sealed task/model/budget. It does not support a generalized feedback-effectiveness claim.
- P4 single-model expansion boundary added for `mistralai/mistral-small-2603` in `tasks/subscription-entitlements-lifecycle/analysis-plan.mistral-small-causal-pilot-v0.json`.
- Local evidence hygiene after adding the Mistral plan: provider execution profiles now include `model_loop_policy_version=model-loop-feedback-continues-after-feedback-v1` for OpenRouter loop runs, and profile IDs include a `looppolicy...` segment. This prevents pooling pre-fix loop artifacts with post-feedback-turn-preserving artifacts.
- Provider smoke `provider-smoke-20260605-010`: `diagnostic_invalid`, Mistral profile before loop-policy profile versioning, inspection clean. It is historical provider reliability context only and is superseded by `provider-smoke-20260605-011`.
- Provider smoke `provider-smoke-20260605-011`: `diagnostic_invalid`, loop-policy-versioned Mistral profile, inspection `valid=true`, 6 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 3/3, final delta 0.
- Provider probe `subscription-entitlements-difficulty-probe-20260605-010`: `difficulty_probe`, same loop-policy-versioned Mistral profile, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 9/9, final delta 0, regression-free AUC delta 0.
- Causal pilot `subscription-entitlements-causal-pilot-20260605-003`: `causal_pilot`, same sealed Mistral profile, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, feedback opportunity integrity complete 9/9, both arms 9/9, final delta 0, regression-free AUC delta 0.1111.
- The 003 Mistral causal pilot is clean primary evidence for a flat primary result and positive secondary regression-free AUC result under this sealed task/model/budget. It does not support a generalized feedback-effectiveness claim.
- P4 task-family expansion: `inventory-reservations-lifecycle-v0` exists as a sealed task package with nine checkpoints, runnable visible feedback assets, hidden-oracle coverage, local acceptance criteria, a sealed Mistral analysis plan, and one clean difficulty probe.
- Provider probe `inventory-reservations-difficulty-probe-20260605-001`: `difficulty_probe`, same loop-policy-versioned Mistral profile, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 9/9, final delta 0, regression-free AUC delta -0.2222.
- The inventory 001 probe is clean difficulty/provider evidence only. It is not causal evidence. The feedback-capable arm had temporary hidden cancellation-release misses at I05/I06 before recovering by I07.
- Causal pilot `inventory-reservations-causal-pilot-20260605-001`: `causal_pilot`, same sealed Mistral profile, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, feedback opportunity integrity complete 9/9, both arms 9/9, final delta 0, regression-free AUC delta 0.
- The inventory causal pilot is clean primary evidence for a flat/null result under this sealed task/model/budget. It does not support a generalized feedback-effectiveness claim.
- Timeout-flagged 9/9 provider probes are not evidence that the task is too easy.

## Guardrails

- Precommit task version, checkpoint list, visible specs, feedback assets, hidden oracle, budget, model/provider settings, provider execution profile, exclusion rules, and metrics before real evaluation.
- Precommit `protocol_profile_id` and metric definition before future real evaluation; do not change metrics after observing outcomes.
- Do not add checkpoints after observing arm-level outcomes unless creating a new task version and compatibility boundary.
- Do not change hidden oracle behavior or visible feedback assets after observing treatment outcomes and then pool old/new runs.
- Do not pool runs across task versions, checkpoint-list changes, feedback-asset patches, hidden-oracle patches, protocol changes, model/provider changes, provider execution profile changes, budget changes, or metric-definition changes.
- Both arms must receive the same maximum model-turn budget in causal runs.
- Feedback information, not extra turns, is the treatment.
- The context-only arm may receive self-review turns, but must not receive executable feedback output, feedback commands, or feedback asset paths.
- Hidden oracle checks must test behavior implied by the visible semantic spec.
- Visible feedback should be useful but not identical to the hidden oracle.
- Runs with provider, API, timeout, quota, or network failure must be validity-flagged.
- Provider-flagged runs are stress, diagnostic, or reliability evidence, not clean primary evidence.
- A run may be classified as causal feedback-use evidence only if feedback ran and had a possible path to influence a later model turn.
- One-turn runs where feedback cannot influence a later turn are difficulty calibration only.

## Current Priorities (2026-06-10, status updated same day)

- P0 — E1 to evidence grade: all local Step 0 items are DONE as of 2026-06-10 (real workspace-snapshot injection, sealed cache-breakpoint conversation layout, publication-grade `e1:inspect` replay/tamper/classification, wall-time capture + `e1:stats`, end-to-end scripted shakedown, 10×-green two-environment stability gate — see `docs/progress-log.md` and `docs/protocols/e1-step0-*-record-v0.md`). REMAINING, operator-authorized spend: re-run cheap-model no-op check + CartCalc calibration ×2 + one frontier context run under the new prompt-template hash (~$0.05–0.20), then cost projection via `e1:stats`, then seal base constants v1.0. Pre-snapshot-fix calibration bundles are a dead compatibility boundary for sealing purposes.
- P1 — OpenSpec workflow profile `e1-openspec-workflow-v0`: built and shakedown-passed 2026-06-10 (pinned CLI, telemetry neutralized, characterization tests, harness archive step, survival ledger, fresh-mount scenario parity, CartCalc-scale fixture proving the silent MODIFIED-replace scenario drop). REMAINING before seal: `e1:inspect` replay support for the archive step between checkpoints; then optional operator-authorized cheap-model calibration of the OpenSpec fixture.
- P2 — First E1 evidence task: design gates precommitted in `docs/protocols/e1-first-evidence-task-design-gates-v0.md`. NEXT: design the multi-file task (Billing v2 candidate domain) with partial seed, hidden reference, and the naive-agent discrimination proof (≥2 true cross-checkpoint regressions) before seal; frontier difficulty probe and evidence matrix are operator-authorized gates.
- All provider runs remain operator-authorized only, with precommitted classification, profile, budget, and metrics.

## P0 - Freeze Path-Survival-Primary Protocol

- Status: protocol profile support added locally; operator approval is still required before evidence-generating provider runs.
- `matrix_freeze_commit=fe50a43de8162e1ccce21856b7119161290971c1` freezes the validation matrix only; it is not execution-ready by itself.
- Freeze Stage 1 execution state before provider runs: include protocol-profile runtime support, CLI profile selection, both Stage 1 task packages, and the matrix docs in a clean `stage1_execution_freeze_commit`.
- Protocol/profile ID: `path-survival-primary-v1`.
- Primary metric for future runs under this profile: `regression_free_auc` delta, feedback minus context.
- Secondary metrics: final checkpoint pass-rate delta, regression count delta, checkpoint-level `regression_free_success`, feedback opportunity integrity, provider validity, and clean-primary-evidence eligibility.
- Compatibility boundary includes `protocol_profile_id` and `metric_definition_hash`.
- Summaries and manifests identify the run's protocol profile and protocol primary metric.
- Existing final-pass-primary run interpretation remains unchanged; old AUC values are retrospective secondary observations only.
- Do not run providers while freezing protocol docs and manifests.

## Superseded (pre-execution): P1 - Predeclared Internal Validation Runs

Superseded 2026-06-10 before any Stage 1 run was executed; see `docs/protocols/path-survival-primary-v1-validation-matrix-supersession-v1.md`. Subscription and inventory cannot discriminate path survival (full-solution template seeds, ceiling behavior, 3/108 non-perfect arm-checkpoints and zero true regressions across the 6 clean runs). The historical content below is preserved verbatim as a frozen pre-registration.

Predeclared matrix: `docs/protocols/path-survival-primary-v1-validation-matrix.md`.

Only after `path-survival-primary-v1` and the validation matrix are reviewed and approved:

- Stage 1 primary internal validation uses `subscription-entitlements-lifecycle-v0` and `inventory-reservations-lifecycle-v0`.
- Stage 1 model/provider profile is `mistralai/mistral-small-2603`.
- Stage 1 requires 3 clean causal pilots per task, 6 clean causal pilots total.
- Stage 1 support requires feedback-capable AUC higher in at least 4 of 6 clean runs, mean AUC delta `>= +0.10`, no systematic final checkpoint pass-rate harm, and all included runs `clean_primary_evidence_eligible=true`.
- Stage 2 is optional after Stage 1 is completed and interpreted: same two tasks, `anthropic/claude-sonnet-4.6`, 1 or 2 clean causal pilots per task for ceiling/control comparison only.
- Replacement runs may only replace invalid or provider-flagged scheduled runs under the same compatibility settings; do not replace unfavorable clean runs.
- Provider-flagged and invalid runs must be recorded, excluded from clean primary evidence, and not silently deleted.
- Keep `max_model_turns=2` and `max_feedback_runs=1`; avoid task semantic changes, checkpoint additions, hidden-oracle patches, feedback-asset patches, or metric changes in response to outcomes.

## P2 - Public Narrative Decision

- Do not publish current flat/null results as validation.
- Do not run providers randomly until one positive result appears.
- Do not add task checkpoints reactively.
- Do not change primary metrics after seeing validation results.
- Do not pool protocol-v1 final-pass-primary evidence with `path-survival-primary-v1` evidence without an explicit compatibility decision.
- Publish only if future path-survival-primary results are materially stronger, clean, replayable, and replicated enough for the claim level.

## Frozen Calibration Artifact

`role-permissions-calibration-v0`

- Purpose: harness, provenance, feedback-loop, and difficulty calibration only.
- Status: frozen as calibration-only; not the primary task.
- Checkpoints: `I01` owner edit, `I02` org admin edit, `I03` viewer read-only, `I04` suspended users blocked, `I05` explicit deny overrides allow, `I06` cross-org access forbidden, `I07` temporary project grants.
- Do not add `I08+` unless creating a separately versioned generated or sealed task family.
- Existing runs remain calibration or diagnostic evidence only and must not be promoted to causal evidence.

## Active Task

`subscription-entitlements-lifecycle-v0`

- Status: full task package exists and loads.
- Implemented: visible specs, checkpoints `I01`-`I09`, runnable visible feedback assets, reference template workspace, executable hidden oracle, local acceptance criteria, and sealed analysis plan.
- Local validation: no-provider fake-pilot replay, provenance, compatibility validation, visible feedback execution, hidden-oracle reference checks, targeted hidden-oracle regression checks, summaries, and hidden-oracle scoring pass.
- Do not mutate the task in response to the timeout-flagged provider result.

Checkpoint sequence:

- `I01` trial starts and grants access until `trialEnd`.
- `I02` successful payment activates paid subscription and extends `currentPeriodEnd`.
- `I03` cancel-at-period-end preserves access until period end, then disables access.
- `I04` payment failure enters grace period; access survives during grace but ends after grace.
- `I05` retry success during grace restores active paid status without losing period history.
- `I06` duplicate event IDs are idempotent and must not double-charge or double-extend access.
- `I07` fraud suspension overrides trial, paid, grace, cancellation, grants, and downgrade.
- `I08` plan downgrade takes effect next period; old entitlements remain until period end.
- `I09` refund/chargeback creates restricted status and must not resurrect canceled access.

## Next Sealed Task Family

`inventory-reservations-lifecycle-v0`

- Status: local sealed task package exists and loads.
- Implemented: visible specs, checkpoints `I01`-`I09`, runnable visible feedback assets, reference template workspace, executable hidden oracle, local acceptance criteria, and sealed Mistral analysis plan.
- Local validation: targeted package tests, visible feedback execution, task sealing, hidden-oracle reference checks, targeted hidden-oracle regression checks, and no-provider fake-pilot replay/provenance/compatibility validation pass.
- Provider status: clean difficulty probe `inventory-reservations-difficulty-probe-20260605-001` and clean causal pilot `inventory-reservations-causal-pilot-20260605-001` have run under the sealed Mistral profile. Cite the causal pilot only as task/model/budget-specific evidence.

Checkpoint sequence:

- `I01` stock receipts increase on-hand and sellable inventory.
- `I02` reservations hold stock until expiration.
- `I03` order confirmation converts held reservations to committed stock.
- `I04` reservation expiration releases held stock back to sellable inventory.
- `I05` cancellation releases unshipped held, committed, or backordered allocations.
- `I06` duplicate event IDs are idempotent.
- `I07` shipment consumes committed stock and later cancellation does not restore it.
- `I08` restock fills backorders FIFO by full reservation.
- `I09` sellable returns restore inventory; damaged returns do not.

## P0 - Evidence Hygiene / Provider Validity

- Status: implemented/verified locally for manifest recording, generated summaries, inspection output, checkpoint carry-forward, checkpoint feedback opportunity integrity, and provider profile compatibility.
- Derived `clean_primary_evidence_eligible` appears in manifests, generated summaries, and `inspect-run` output.
- Timeout causality classification covers:
  - pre-model-action timeout
  - post-model-action timeout
  - feedback execution timeout
  - feedback summary timeout
  - repair-turn timeout
  - retry-recovered timeout
  - nonfatal provider warning
- Checkpoint-level carried-forward workspace due to provider failure is recorded and verified.
- Checkpoint-level feedback opportunity integrity for causal pilots is recorded and verified:
  - turn 1 completed
  - feedback ran
  - feedback summary delivered
  - turn 2 completed after feedback
- Manifest-level `clean_primary_evidence_eligible` now also requires complete feedback opportunity integrity when a causal pilot has feedback assets.
- Provider model, route, endpoint, response parser, request parameter shape, response format, provider parameter-routing requirement, timeout, retry, max-output, workspace context cap, feedback summary cap, temperature, and profile settings are versioned in provider profile metadata and compatibility hashes.
- Keep tests current for validity-flagged causal pilots being ineligible for clean primary evidence.
- Keep tests current for provider execution profile changes preventing pooling.

## P1 - Clean Execution Path

- Status: clean full provider difficulty probe achieved under the Sonnet model-route mitigation in `subscription-entitlements-difficulty-probe-20260605-009`. The previous DeepSeek retry-enabled structured-output profile remains provider-flagged and is not clean primary evidence.
- First timeout mitigation path tried: reduce output pressure to `8000`, use `90000ms` per-call timeout, keep retries at `0`, and version the profile as `openrouter-loop-v1-timeout90000-output8000-temp0.2-retry0`.
- Provider smoke-test plan added at `docs/provider-smoke-test-plan.md`.
- Previous provider smoke outcome under the first mitigation profile: `valid=true`, 6 replay steps, 0 mismatches, no validity flags, no timeout details, no provider carry-forward, and matching provider profile ID.
- Full difficulty-probe outcome under the same profile: `valid=true`, 18 replay steps, 0 mismatches, both arms 9/9, final delta 0, but `provider_timeout` on 6 checkpoints with 6 provider-failure carry-forwards.
- At that point, a clean difficulty probe had not been achieved. Do not advance to causal pilot from the 004 run.
- Local mitigation implemented before the next provider attempt: provider execution profiles now explicitly record model ID, route, endpoint, workspace context cap, and feedback summary cap; CLI exposes `--max-workspace-bytes` and `--max-feedback-output-bytes`.
- Intermediate provider smoke `provider-smoke-20260605-002` under the stronger profile had no provider flags, but inspection was `valid=false` because the sample-cart hidden oracle emitted `status: "ok"` with failed checks. That was a local smoke-oracle schema bug, not provider evidence.
- The sample-cart oracle status bug was fixed and covered by tests. Rerun `provider-smoke-20260605-003` was clean under the stronger profile.
- Full difficulty probe `subscription-entitlements-difficulty-probe-20260605-005` under that profile removed timeout flags, but exposed malformed provider/model responses. Do not advance to causal pilot from the 005 run.
- Local parser mitigation implemented after 005: OpenRouter loop accepts text-part message content arrays, malformed JSON details no longer receive timeout-phase labels, and provider execution profiles now include `response_parser_version`.
- Parser-versioned provider smoke `provider-smoke-20260605-004` was clean, but full difficulty probe `subscription-entitlements-difficulty-probe-20260605-006` still had provider timeouts and malformed responses.
- Structured-output provider smoke `provider-smoke-20260605-005` failed at provider routing because the request used `max_completion_tokens`; this is recorded as provider-flagged reliability evidence.
- Request-shape mitigation implemented after 005: use OpenRouter `max_tokens` and version `request_parameter_version=openrouter-chat-request-max-tokens-v1`.
- Structured-output provider smoke `provider-smoke-20260605-007` was clean under profile `openrouter-loop-v1-modeldeepseek-deepseek-v4-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry0`.
- Full difficulty probe `subscription-entitlements-difficulty-probe-20260605-007` under that profile was provider-flagged with one malformed response and one timeout in `context_only_spec`.
- Retry-policy mitigation implemented after 007: OpenRouter loop can retry timeout, quota/rate-limit, and malformed-response provider failures once; recovered failures remain validity-flagged with retry details and therefore do not count as clean primary evidence.
- Retry-enabled provider smoke `provider-smoke-20260605-008` was clean under profile `openrouter-loop-v1-modeldeepseek-deepseek-v4-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1`.
- Full difficulty probe `subscription-entitlements-difficulty-probe-20260605-008` under that profile eliminated timeouts and provider carry-forward, but still recorded retry-recovered malformed responses.
- Do not rerun the same DeepSeek retry-enabled structured-output profile as a clean-evidence attempt.
- Model-route mitigation after 008: OpenRouter model metadata was inspected and `anthropic/claude-sonnet-4.6` was chosen because it supports the current required request parameters (`max_tokens`, `response_format`, `structured_outputs`, and `temperature`) without another request-shape change.
- Provider smoke `provider-smoke-20260605-009` was clean under profile `openrouter-loop-v1-modelanthropic-claude-sonnet-4.6-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1`.
- Full difficulty probe `subscription-entitlements-difficulty-probe-20260605-009` under that Sonnet profile was clean: `valid=true`, 18 replay steps, 0 mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 9/9, final delta 0, regression-free AUC delta 0.
- This closes the clean execution bottleneck for the Sonnet provider profile only. It does not clean or pool prior DeepSeek provider-flagged probes.
- The current sealed analysis plan names `deepseek/deepseek-v4-flash`; any causal run under the Sonnet profile requires an explicit versioned analysis-plan/profile decision before execution.
- Treat provider-flagged probes as non-primary evidence.

## P2 - Public Credibility Artifacts

- Status: initial public credibility artifact set added for the clean Sonnet difficulty probe and clean Sonnet causal pilot.
- Public run card: `docs/run-cards/subscription-entitlements-difficulty-probe-20260605-009.md`.
- Causal pilot run card: `docs/run-cards/subscription-entitlements-causal-pilot-20260605-002.md`.
- Mistral causal pilot run card: `docs/run-cards/subscription-entitlements-causal-pilot-20260605-003.md`.
- Inventory causal pilot run card: `docs/run-cards/inventory-reservations-causal-pilot-20260605-001.md`.
- Public task card: `docs/task-cards/subscription-entitlements-lifecycle-v0.md`.
- Evidence-status dashboard: `docs/public-evidence-status.md`.
- Public evidence matrix: `docs/public-evidence-matrix.md`.
- Regression-free success plot: `docs/plots/regression-free-success-20260605-009.md`.
- Causal pilot regression-free success plot: `docs/plots/regression-free-success-causal-pilot-20260605-002.md`.
- Mistral causal pilot regression-free success plot: `docs/plots/regression-free-success-causal-pilot-20260605-003.md`.
- Inventory causal pilot regression-free success plot: `docs/plots/regression-free-success-inventory-causal-pilot-20260605-001.md`.
- Timeout-flagged 9/9 explainer: `docs/explainers/timeout-flagged-9-of-9-is-not-clean-evidence.md`.
- Frame these as public communication and credibility artifacts, not scientific proof.
- Every public result should state classification, validity flags, model/provider profile, task version, budget, replay/artifact status, and compatibility boundary.
- Do not average or pool clean causal pilots across task/model/profile boundaries unless a future analysis plan precommits that pooled estimate.

## P3 - Causal Pilot

- Status: complete for the first Sonnet sealed causal pilot, the Mistral subscription causal pilot, and the Mistral inventory causal pilot.
- The Sonnet analysis-plan boundary is sealed in `tasks/subscription-entitlements-lifecycle/analysis-plan.sonnet-causal-pilot-v0.json`.
- Clean causal pilot `subscription-entitlements-causal-pilot-20260605-002` is provider-valid, replay-valid, artifact-valid, and feedback-use-valid.
- Clean causal pilot `subscription-entitlements-causal-pilot-20260605-003` is provider-valid, replay-valid, artifact-valid, and feedback-use-valid under the Mistral subscription boundary.
- Clean causal pilot `inventory-reservations-causal-pilot-20260605-001` is provider-valid, replay-valid, artifact-valid, and feedback-use-valid under the Mistral inventory boundary.
- Feedback-capable checkpoints show complete `model_turn -> feedback_run -> model_turn` opportunity integrity on 9/9 checkpoints.
- Treatment interpretation: flat/null on the primary final-pass-rate metric across the clean causal pilots so far. Secondary AUC is flat for Sonnet subscription and Mistral inventory, and positive for Mistral subscription.
- Do not hide flat, null, invalid, or provider-flagged results if they are relevant to the project narrative.

## P4 - Expansion / Later

- More task families: initial expansion added with `inventory-reservations-lifecycle-v0`; clean difficulty probe and clean causal pilot completed. Do not add another task family without a precommitted reason and scope.
- More models: initial single-model expansion completed with the sealed Mistral Small profile. Do not turn this into a many-model matrix without a separate precommitted plan.
- Additional arms.
- Spec-format comparisons between arms (the shared-environment OpenSpec workflow under `e1-openspec-workflow-v0` is NOT this — it is in scope and tracked under Current Priorities P1).
- Formal statistical replication.
- Many-model matrices.
- General benchmark platform work.

These are later because the current bottleneck is bringing E1 to evidence grade plus public-legible evidence artifacts.

## Test-First Backlog

Write or update tests before implementing each validity-critical change:

- Both arms receive the same visible semantic spec text.
- Only `feedback_capable_spec` receives feedback assets, commands, and paths.
- Both arms receive equal maximum model turns.
- `context_only_spec` second turns receive no feedback summary.
- `feedback_capable_spec` second turns receive feedback summaries only if feedback was run.
- Checkpoint `I02` starts from the post-`I01` workspace for the same condition.
- Hidden oracle files are absent from the agent-readable workspace.
- Hidden oracle checks cannot be accessed by feedback assets.
- Hidden oracle outputs are recorded but not leaked into subsequent prompt packets.
- Result replay detects tampering in prompt packets, feedback assets, result files, summaries, snapshots, agent results, and hidden oracle outputs.
- Task-version mismatch prevents pooling.
- Patched feedback assets create a new compatibility boundary.
- One-turn/no-feedback runs cannot be classified as causal feedback-use runs.
- `regression_free_success` calculation is correct.
- `regression_free_auc` calculation is correct.
- Provider failure is validity-flagged.
- Provider execution profile changes prevent pooling.
- Validity-flagged causal pilots are not clean primary evidence eligible.
- Provider timeout details include failure phase, feedback availability, model-response receipt, code-change state, retry count, and workspace carry-forward.
- Feedback-capable causal pilots require a persisted feedback-opportunity transcript sequence.

## Do-Not-Do-Next

- Do not add more `role-permissions-calibration` checkpoints as the next move.
- Do not add new arms or aliases.
- Do not compare spec formats between arms. The shared-environment OpenSpec workflow under `e1-openspec-workflow-v0` (same scenario content both arms, executable feedback as the only causal variable) is in scope and is not a spec-format comparison.
- Do not tune hidden oracle or visible feedback after seeing arm-level outcomes.
- Do not pool pre-patch and post-patch runs.
- Do not count one-turn no-feedback runs as feedback-use evidence.
- Do not weaken `context_only_spec`.
- Do not weaken same-visible-spec parity.
- Do not make the subscription task hard through arbitrary hidden gotchas.
- Do not run provider experiments automatically.
- Do not run another difficulty probe as a repeated evidence attempt unless it answers a new predeclared model/provider profile question.
- Do not treat timeout-flagged provider runs as clean evidence.
- Do not import active runtime code from `../hit-sdd-bench.old`.
- Do not recreate the old benchmark framework.

## Tool Boundary

Bun owns runner scripts, TypeScript/JavaScript tests, and CLI scripts.

Python is not needed now. If it becomes necessary for analysis or optional evaluator utilities, `uv` must own Python dependencies and lockfiles, and the reason must be documented here before adding it.
