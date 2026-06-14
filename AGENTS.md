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

Do not add aliases. Do not add legacy condition names. Do not introduce HIT-SDD, OpenSpec, BDD, Gherkin, Three Amigos, or ordinary-test names as condition IDs or arms in active protocol code.

The causal variable is whether the same semantic spec can be used as automated feedback during agent work. Both arms must receive semantically equivalent visible spec content. Only `feedback_capable_spec` may receive executable feedback assets or a command to run them.

The OpenSpec workflow is permitted as a shared task-environment property under the named protocol profile `e1-openspec-workflow-v0`: both arms work inside the same OpenSpec-initialized workspace, both arms maintain spec deltas, and the harness runs the pinned `openspec` archive step identically in both arms at checkpoint transitions. This is not a spec-format comparison between arms — both arms see the same scenario content, and the causal variable remains executable-feedback availability. Runs under `e1-openspec-workflow-v0` form their own compatibility boundary and are never pooled with base-profile runs. This scoping was decided before any OpenSpec-profile run existed (guardrail revision of 2026-06-10).

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

- The active program is the E1 frontier path: a turn-based, full-file-replacement, multi-file protocol designed so frontier models do not ceiling the task. Bring E1 to evidence grade (Step 0 go-gate in `docs/protocols/e1-harness-calibration-step0-v0.md`) before any evidence-generating E1 run.
- **Billing domain closed (2026-06-11):** Both billing-v2 and billing-v3 ceilinged under clean frontier probes (Sonnet 4.6 AUC 0.9929; Qwen 3.7 Max billing-v2 AUC 0.9361, billing-v3 AUC 0.9628; all zero on-graph regressions). The billing domain closes for frontier discrimination claims per the third-ceiling closure rule (`e1-billing-v3-stage1-plan-v1.md`). A new task domain is required; proposing another billing version is not permitted without a domain-change justification reviewed at this level.
- **`e1-ledger` shelved (2026-06-13), do not build as written:** the proposed ledger redesign (un-exemplified interaction regression in a new sealed domain) was critique-flagged by a five-model red-team as a likely fifth clean ceiling / convention-contaminated non-finding, for *structural* reasons that apply to ALL small sealed refactoring tasks: unambiguous + fair ⇒ self-verifiable by a frontier model. Boundary retained as honest record (`docs/protocols/ledger-v1-task-design-v1.md`, status CRITIQUE-FLAGGED). See [[frontier-feedback-structural-ceiling]].
- **E1 sealed-task frontier line concluded (2026-06-13):** four clean frontier ceilings (dispatch DeepSeek 3/3; billing-v2 Sonnet+Qwen; billing-v3 Qwen 0.9628), all zero on-graph regressions. Conclusion: on small, fully-specified tasks testing **regression-style** feedback, executable feedback is redundant for frontier models (they self-verify). This is a publishable standalone capability-gradient finding (feedback value concentrates at mid-tier / un-self-verifiable specs).
- **E2 brownfield program opened (2026-06-13):** the active frontier-discrimination effort moves to a NEW program testing **acceptance-level** (not regression) executable feedback on **brownfield/multi-file** repos, where two deep-research reports show (a) frontier models collapse at scale, (b) self-tests don't reconstruct the regression surface, (c) regression feedback was the weakest oracle signal while reproduction/acceptance-level is the strongest, (d) the benefit is coverage-bound, (e) the exact ablation is unrun. Program boundary: `docs/protocols/e2-brownfield-acceptance-ablation-design-v1.md` (precommitted). E2 defines new conditions (feedback × context-provision factors), needs a real-repo Docker harness, is **never pooled** with E1 runs, and all runs are operator-authorized. The E1 "do not add new arms" guardrail is scoped to E1; E2 conditions are recorded here. See [[brownfield-deep-research-verdict]]. Substrate resolved to SWE-bench Live (post-cutoff slice). **Phase-1 pilot specced 2026-06-13** (`docs/protocols/e2-phase1-pilot-spec-v1.md`, precommit; revised after a four-model critique into an A/B feasibility+contamination GATE + a separately-powered Phase 1.5 — GATE C as a go/no-go was structurally underpowered and was removed). **Harness build started 2026-06-13** in a SEPARATE repo `hit-sdd-bench-e2` (Python/Docker, forking SWE-bench Live + an agent scaffold); the scientific record stays HERE. Shared provenance contract: `docs/protocols/e2-provenance-schema-v1.json` (the Python harness mirrors this repo's hashing byte-identically — golden-tested). **Harness validated end-to-end with real DeepSeek V4 Pro on both arms** (2026-06-14, `hit-sdd-bench-e2` @ `4c578a4`; run cards `e2-phase1-shakedown-...-001`, `e2-phase1-subpilot-...-001` — calibration, not evidence; a harder-task directional hint that control ships with false confidence where treatment's run_tests feedback does not). **Phase-1/1.5 commitments SEALED** 2026-06-14 (`e2-phase1-pilot-commitments-v1.md`): frozen 40-task enriched candidate pool, the Phase-1.5 powered analysis plan (`e2-phase1-5-plan-v1.md`; primary = self-verification gap, n≈20–40, N=10/arm, permutation test + error budget, asymmetric single-model rule), provenance contract, all hashed + the harness commit. What remains is execution under operator authorization + spend cap: Phase 1 (flake-cert + memorization GATE B → seal the addendum) then the powered Phase 1.5.
- The bounded positive result stands as-is: pricing content-controlled showed a clean run-loop benefit for a cheap/weak model (mean AUC delta +0.1852, 3/3); frontier models ceilinged all tested single-file tasks. Do not reinterpret or extend that claim without new clean evidence.
- The `path-survival-primary-v1` Stage 1 validation matrix (subscription + inventory) is superseded before execution; see `docs/protocols/path-survival-primary-v1-validation-matrix-supersession-v1.md`. Do not execute it.
- Subscription, inventory, payroll, and role-permissions task families remain calibration/difficulty/ceiling context with their existing classifications.
- Freeze `role-permissions-calibration-v0` as harness/provenance calibration.
- Do not add more permission checkpoints as the next scientific move.
- Do not mutate `subscription-entitlements-lifecycle-v0` in response to the timeout-flagged 9/9 difficulty probe.
- Do not treat the timeout-flagged 9/9 provider probe as clean evidence that the task is too easy.
- The project is not ready for public validation claims that executable feedback wins for frontier models.
- Future evidence-generating runs must declare their protocol profile (`path-survival-primary-v1` or a sealed E1 profile) and be explicitly approved.
- `regression_free_auc` is primary only for runs whose manifest declares `protocol_profile_id=path-survival-primary-v1`; older runs may mention AUC only as retrospective secondary observations.
- Do not run provider/model experiments unless explicitly authorized.
- Do not change primary metrics after observing outcomes, and preserve compatibility boundaries for task, provider, budget, loop policy, protocol profile, and metric definition.
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
