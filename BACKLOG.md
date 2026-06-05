# Backlog

## Project Direction

- Goal: credible, reproducible, hard-to-fake engineering evidence for industry-facing writing, demos, and run artifacts.
- This is not peer-reviewed-publication-first. Keep the evidence hygiene; change the presentation and backlog priorities.
- Continue the explicit two-arm protocol with exactly `context_only_spec` and `feedback_capable_spec`.
- Keep the causal variable narrow: same visible semantic spec content with executable feedback off versus the same visible semantic spec content with executable feedback on.
- Keep the bounded loop budget at 2/1 for causal feedback-use runs unless a later analysis plan precommits a different equal-turn budget.
- Treat one-turn runs as difficulty probes only unless feedback can actually influence a later model turn.
- Avoid adding arms, legacy condition IDs, ordinary-test comparisons, spec-format comparisons, permission-checkpoint extensions, formal statistical replication, many-model matrices, or a general benchmark platform while clean provider execution is the bottleneck.

## Current Evidence State

- Core harness: condition rendering fairness, feedback gating, continuing workspaces, hidden oracle isolation, task package loading/validation, task sealing, run/checkpoint manifests, hashes, replay validation, artifact tamper detection, compatibility profiles, classification, causal max-turn enforcement, context-only feedback isolation, feedback-use evidence checks, provider/network validity flags, and `result-schema-v1`.
- Result metrics include final checkpoint pass-rate delta, regression counts, checkpoint-level `regression_free_success`, and `regression_free_auc`.
- Latest local suite: `bun test`, 142 tests, 0 failures.
- Local fake-pilot validation for `subscription-entitlements-lifecycle-v0` passes with replay, artifact verification, summaries, and hidden-oracle scoring.
- Provider probe `subscription-entitlements-difficulty-probe-20260605-003`: `difficulty_probe`, OpenRouter loop, `max_model_turns=2`, `max_feedback_runs=1`, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, both arms 9/9, delta 0, regression-free AUC delta 0.
- The provider probe had timeout flags on 10 checkpoints. It is structurally valid and replay-valid, but provider-flagged and not clean primary evidence.
- The timeout-flagged 9/9 provider probe is not evidence that the task is too easy.

## Guardrails

- Precommit task version, checkpoint list, visible specs, feedback assets, hidden oracle, budget, model/provider settings, provider execution profile, exclusion rules, and metrics before real evaluation.
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
- Provider timeout, retry, max-output, temperature, and profile settings are versioned in provider profile IDs and compatibility hashes.
- Keep tests current for validity-flagged causal pilots being ineligible for clean primary evidence.
- Keep tests current for provider execution profile changes preventing pooling.

## P1 - Clean Execution Path

- Do not run more full provider experiments until timeout mitigation is chosen.
- Timeout mitigation path chosen for the next smoke: reduce output pressure to `8000`, use `90000ms` per-call timeout, keep retries at `0`, and version the profile as `openrouter-loop-v1-timeout90000-output8000-temp0.2-retry0`.
- Provider smoke-test plan added at `docs/provider-smoke-test-plan.md`.
- After provider smoke is clean, run one clean `subscription-entitlements-lifecycle-v0` difficulty probe.
- Treat provider-flagged probes as non-primary evidence.

## P2 - Public Credibility Artifacts

- Add a generated or manually maintained public run card.
- Add a public task card for `subscription-entitlements-lifecycle-v0`.
- Add an evidence-status dashboard or summary page.
- Add a regression-free success plot.
- Add a short explainer: "why the timeout-flagged 9/9 run is not clean evidence."
- Frame these as public communication and credibility artifacts, not scientific proof.
- Every public result should state classification, validity flags, model/provider profile, task version, budget, replay/artifact status, and compatibility boundary.

## P3 - Causal Pilot

- Only after clean provider execution, run a sealed `causal_pilot`.
- Require provider-valid, replay-valid, artifact-valid, and feedback-use-valid status.
- Require feedback-capable causal checkpoints to show `model_turn -> feedback_run -> model_turn` opportunity integrity.
- Report conservative treatment interpretation under this task/model/budget.
- Do not hide flat, null, invalid, or provider-flagged results if they are relevant to the project narrative.

## P4 - Expansion / Later

- More task families.
- More models.
- Additional arms.
- BDD vs OpenSpec or spec-format comparisons.
- Formal statistical replication.
- Many-model matrices.
- General benchmark platform work.

These are later because the current bottleneck is clean provider execution plus public-legible evidence artifacts.

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
- Do not compare spec formats.
- Do not tune hidden oracle or visible feedback after seeing arm-level outcomes.
- Do not pool pre-patch and post-patch runs.
- Do not count one-turn no-feedback runs as feedback-use evidence.
- Do not weaken `context_only_spec`.
- Do not weaken same-visible-spec parity.
- Do not make the subscription task hard through arbitrary hidden gotchas.
- Do not run provider experiments automatically.
- Do not run another clean difficulty probe until timeout/provider settings are mitigated and versioned.
- Do not treat timeout-flagged provider runs as clean evidence.
- Do not import active runtime code from `../hit-sdd-bench.old`.
- Do not recreate the old benchmark framework.

## Tool Boundary

Bun owns runner scripts, TypeScript/JavaScript tests, and CLI scripts.

Python is not needed now. If it becomes necessary for analysis or optional evaluator utilities, `uv` must own Python dependencies and lockfiles, and the reason must be documented here before adding it.
