# Path-Survival Primary Protocol v1

Protocol/profile ID: `path-survival-primary-v1`

This protocol is for future internal validation runs only. It is not a reinterpretation of earlier final-pass-primary pilots, and it is not a public validation claim.

The predeclared internal validation schedule and interpretation rules are in `docs/protocols/path-survival-primary-v1-validation-matrix.md`.

## Scope

- Conditions are exactly `context_only_spec` and `feedback_capable_spec`.
- Both arms receive semantically equivalent visible spec content.
- Only `feedback_capable_spec` may receive executable feedback assets, a feedback command, feedback output, or feedback asset paths.
- Equal causal budget is `max_model_turns=2` and `max_feedback_runs=1`.
- Do not run provider/model experiments under this protocol until the protocol, metric profile, compatibility boundary, task versions, checkpoint lists, visible specs, feedback assets, hidden oracles, budget, model/provider profile, exclusion rules, and primary metrics are frozen.

## Metrics

Primary metric:

- `regression_free_auc` delta, feedback minus context.
- This is the mean checkpoint-level `regression_free_success` score per condition and measures path survival across the checkpoint sequence.

Secondary metrics:

- Final checkpoint pass-rate delta.
- Regression count delta.
- Checkpoint-level `regression_free_success`.
- Feedback opportunity integrity.
- Provider validity and clean-primary-evidence eligibility.
- Time to first regression if a later result schema records it.

Final checkpoint pass rate remains reported for every run, but it is no longer primary for runs whose `protocol_profile_id` is `path-survival-primary-v1`.

## Clean Evidence Rules

A run is clean path-survival evidence only when all of these are true:

- `run_classification=causal_pilot`.
- Replay and artifact inspection are valid.
- No provider, API, timeout, quota, network, malformed-response, or partial-run validity flags are present.
- `feedback_capable_spec` has complete feedback opportunity integrity: model turn, feedback run, public-safe feedback summary, and later model turn.
- The run manifest records `protocol_profile_id=path-survival-primary-v1`.
- Compatibility matches across task version, protocol version, renderer version, task seal, checkpoint list, visible spec, feedback assets, hidden oracle, budget, model/provider settings, provider execution profile, protocol profile, and metric definition.

Difficulty probes, calibration runs, diagnostic-invalid runs, provider-flagged runs, and one-turn runs are not clean causal evidence for this protocol.

## Compatibility And Non-Pooling

Do not pool across:

- Task versions or checkpoint-list changes.
- Visible spec, feedback asset, or hidden-oracle patches.
- Provider/model/profile changes.
- Loop-policy, retry-policy, request-shape, parser, response-format, or prompt-budget changes.
- Budget changes.
- Protocol or metric profile changes.
- Hidden oracle changes.
- Run classifications.
- Validity-flagged and clean runs.

Existing final-pass-primary runs remain historical observations. Their `regression_free_auc` values may be discussed as retrospective secondary observations, but those runs must not be rewritten as if they were designed with path survival as the primary metric.

## Operator Notes

- Freeze this protocol before future evidence-generating pilots.
- Use the predeclared validation matrix rather than ad hoc provider runs.
- Do not change primary metrics after seeing the next validation outcomes.
- Do not add checkpoints or alter task semantics to chase a treatment effect.
- Do not present current flat/null results as public validation of the hypothesis.
- Recommended next action: review and approve this protocol and its validation matrix, then explicitly authorize the clean internal validation runs.
