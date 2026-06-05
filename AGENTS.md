# Agent Instructions

## Package Managers

Use only:

- `bun` for JavaScript and TypeScript tooling
- `uv` for Python tooling, if Python is introduced later

Do not use:

- `npm`
- `yarn`
- `pnpm`
- `pip` directly
- `pipenv`
- `poetry`

For JavaScript and TypeScript:

- use `bun install`
- use `bun add`
- use `bun test`
- use `bun run <script>`

For Python, only when there is a concrete need:

- use `uv init`
- use `uv add`
- use `uv run`
- use `uv sync`
- create and maintain `pyproject.toml` and `uv.lock`

If both JavaScript/TypeScript and Python are present, keep the boundary clear. Bun owns runner scripts, TypeScript/JavaScript tests, and CLI scripts. `uv` owns Python utilities, analysis scripts, or optional evaluator code. Do not duplicate the same functionality in both languages unless the reason is documented in `BACKLOG.md`.

## Experiment Boundary

The active pilot has exactly two condition IDs:

- `context_only_spec`
- `feedback_capable_spec`

Do not add aliases. Do not add legacy condition names. Do not introduce HIT-SDD, OpenSpec, BDD, Gherkin, Three Amigos, or ordinary-test condition IDs in active protocol code.

The causal variable is whether the same semantic spec can be used as automated feedback during agent work. Both arms must receive semantically equivalent visible spec content. Only `feedback_capable_spec` may receive executable feedback assets or a command to run them.

The sibling repo at `../hit-sdd-bench.old` is read-only salvage material. Active runtime code must not import modules from it by relative path.

## Scientific Protocol Guardrails

- The primary experiment is the two-arm comparison between `context_only_spec` and `feedback_capable_spec`.
- The treatment is executable feedback information, not extra model turns.
- Both arms must receive the same maximum model-turn budget in causal runs.
- The context-only arm may receive a second self-review turn, but must not receive executable feedback outputs, feedback commands, or feedback asset paths.
- Real runs must be classified as `calibration`, `difficulty_probe`, `causal_pilot`, or `diagnostic_invalid`.
- A run may be treated as causal feedback-use evidence only if feedback had a possible path to influence a later model turn.
- One-turn runs where feedback cannot influence a later turn are difficulty probes only.
- Freeze task version, checkpoint list, visible specs, feedback assets, hidden oracle, budget, model/provider settings, exclusion rules, and primary metrics before causal pilot runs.
- Do not change hidden oracle or visible feedback assets after observing arm-level outcomes; if changed, create a new task version and compatibility boundary.
- Do not pool runs across task versions, feedback coverage patches, or incompatible protocol settings.
- Hidden oracle behavior must be implied by visible semantic specs.
- Visible feedback should be useful but not identical to the hidden oracle.
- Provider/network failures must be recorded as validity flags.
- Timeout-flagged provider runs are structurally useful when replay-valid, but they are not clean primary evidence.
- Do not add, remove, or reshuffle checkpoints in response to treatment outcomes; never extend a task merely to chase a feedback win.
- Do not add new arms without protocol tests for condition rendering, feedback gating, budget fairness, compatibility, and result schema behavior.
- Do not weaken same-visible-spec parity between `context_only_spec` and `feedback_capable_spec`.
- `role-permissions-calibration` is frozen as calibration-only unless explicitly versioned otherwise.

## Industry-Facing Credibility

The project is industry-facing first, not peer-reviewed-publication-first. Optimize communication and artifacts for credible, reproducible, hard-to-fake engineering evidence: replayable run cards, task cards, validity summaries, and clear demos. This does not weaken evidence hygiene.

Public claims must be tied to run classifications, validity flags, replayability, and compatibility boundaries. Underclaiming is preferred to overclaiming.

Public claim ladder:

- Level 0 — Harness claim: "The harness can run two conditions, preserve workspaces, execute hidden oracles, and replay/verify artifacts."
- Level 1 — Calibration claim: "The task package and feedback/oracle plumbing work locally."
- Level 2 — Provider reliability claim: "The external model/provider path completed cleanly under this profile."
- Level 3 — Difficulty claim: "Under this model/budget, the task appears easy/hard for both arms."
- Level 4 — Causal pilot claim: "In a sealed two-arm pilot, executable feedback improved/did not improve regression-free success under this task/model/budget."
- Level 5 — Generalized claim: "Across multiple sealed tasks/models, executable feedback tends to reduce long-horizon regressions."

The repo is not currently allowed to make Level 5 claims.

Public communication rules:

- Always state run classification.
- Do not call `calibration`, `difficulty_probe`, or `diagnostic_invalid` runs causal evidence.
- Do not describe provider-flagged runs as clean evidence.
- Do not pool incompatible runs.
- Do not hide flat results.
- Do not hide invalid runs when they are relevant to the project narrative.
- Claims about treatment effects require clean `causal_pilot` runs.
- Claims about general effectiveness require multiple compatible clean pilots or must be explicitly labeled preliminary.
- Every public result should point to replayable artifacts when possible.

Preferred wording:

- "preliminary"
- "calibration"
- "sealed task"
- "replay-valid"
- "provider-flagged"
- "not clean primary evidence"
- "under this task/model/budget"

Avoid wording:

- "proved"
- "validated" when used too strongly
- "solved"
- "benchmark shows feedback works"
- "feedback beats context" without qualification
- "scientifically proven"

## Current Scientific Direction

- Freeze `role-permissions-calibration-v0` as harness/provenance calibration.
- Do not add more permission checkpoints as the next scientific move.
- The active task family is the sealed stateful lifecycle task `subscription-entitlements-lifecycle-v0`.
- Do not mutate `subscription-entitlements-lifecycle-v0` in response to the timeout-flagged 9/9 difficulty probe.
- Do not treat the timeout-flagged 9/9 provider probe as clean evidence that the task is too easy.
- Mitigate and version provider timeout/retry/profile settings before another clean provider difficulty probe.
- Do not build a general benchmark platform yet.

## Smart TDD Policy

Use test-first development for validity-critical invariants because mistakes there can invalidate expensive agent runs.

Write tests first for:

- workspace carry-forward
- condition rendering fairness
- feedback gating
- hidden oracle isolation
- test/spec tamper detection
- primary metric calculation
- result schema
- run replay/provenance
- salvaged evaluator behavior

Concrete examples:

- Before changing packet rendering, write or update a test proving both conditions receive the same visible semantic spec text.
- Before adding feedback assets, write or update a test proving only `feedback_capable_spec` gets a runnable command and paths.
- Before changing checkpoint execution, write or update a test proving checkpoint `I02` starts from the post-`I01` workspace for the same condition.
- Before copying any useful evaluator behavior from `../hit-sdd-bench.old`, write characterization tests that pin the behavior, then copy the smallest useful code and simplify behind those tests.

Strict TDD is not required for:

- README prose
- CLI help text
- report formatting
- one-off migration scripts
- exploratory prompt wording
- charts
- temporary inspection scripts

## Scope Control

Do not build the whole benchmark yet. Do not recreate the old framework. Prefer a small, explicit two-arm protocol over a general platform.
