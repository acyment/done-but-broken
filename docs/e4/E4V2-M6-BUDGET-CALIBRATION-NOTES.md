# v2-M6 — Budget calibration: notes

Mirrors `IMPLEMENTATION-PLAN.md` M6.5's recorded-notes style, for the v2 milestone named in
`E4V2-OPENSPEC-EXECUTABLE-SCENARIOS-PROPOSAL.md` §9/§10 ("v2-M6 Budget calibration on
deepseek-v4-pro (spend-gated) → budget freeze"). Two parts: Part A (no-spend build, this
document's first section) and Part B (the spend-gated calibration run itself, appended after
execution).

## Part A — no-spend build (executed 2026-07-09)

**Live-provider wiring.** `bin/e4-v2.ts` gained a `--live` calibration path reusing
`src/e4/live-provider.ts::createE4LiveProviderFactory` unchanged (it is already E4-owned,
version-agnostic provider plumbing — no v1/v2 fork needed). Classification gates, checked before
any workspace or provider construction:

- `pilot` → refused unconditionally. No v2-M7 pre-registration exists yet; lifting this refusal is
  itself the v2-M7 gate act, not something this milestone does.
- `calibration` without `--live` → refused (calibration is a live-model classification).
- `dry_run` with `--live` → refused (the fake agent is the only dry-run path).
- `--live` without `--model` → refused.

Dry-run behavior (no flags beyond the pre-existing `--seed`/`--tasks`/`--run-root`/`--gamer`) is
byte-identical to before this milestone; verified by running the existing dry-run path and by the
full `test/e4-v2-dryrun.test.ts` suite staying green untouched.

**Manifest gained a `model` field.** `E4V2RunManifest` (`src/e4/v2/manifest.ts`) had no model
identity at all — unlike the v1 manifest. This is an *additive* field, explicitly licensed by the
design's §3 carry-over rule ("manifest/inspector … carry over; field additions only") and needed
for two things this milestone requires: the budget report attributing observed appetite to a named
model, and the ratified-budgets freeze recording which model id they transfer to (§2 "budgets
ratified now transfer to v2-M7 only on that exact model id"). `runE4V2Sequences` accepts an
optional `model` input and defaults to the v1-precedent fake-agent identity
(`{preset: "fake-deterministic", model_id: "e4-fake-agent-v1", route_id: "none"}`) when omitted,
so the one existing direct caller (`test/e4-v2-dryrun.test.ts`) needed no change.
`validateE4V2Manifest` now requires the field. Neither `manifest.ts` nor `orchestrator.ts` is a
sealed v2 code twin (the frozen set is the ten modules pinned in
`docs/protocols/e4-v2-sealed-constants-v0.json`'s `code_twins`), so this addition does not touch
the non-budget freeze — confirmed by the freeze test staying green.

**Budget report tool.** `bin/e4-v2-budget-report.ts`, a straight port of the v1 precedent
(`bin/e4-budget-report.ts`) onto the v2 manifest/task-record field names (`E4V2TaskRunResult`'s
`usage.turns`/`usage.tokens`/`smoke_feedback_runs`/`gate_events`/`oracle`, `op_kind`). Same
freeze-unchanged-or-adjust-once recommendation logic as v1, refuses non-calibration manifests.
Smoke-tested against a dry-run manifest (relabeled `calibration` for the check only) — output
verified field-by-field.

**Calibration seed.** Probed seeds 1–300 at `task_count=6` against the sealed op-mix weights
(drift 0.5 / additive 0.4 / behavior_preserving 0.1) for a healthy mix: ≥2 `drift_opportunity`
tasks, ≥1 `additive` task, exactly 1 `behavior_preserving` task (the structurally guaranteed one —
`ensureBehaviorPreservingStep` forces it onto the last slot when none is drawn naturally). Chose
**seed 37**: draw = `add_relationship(additive), add_entity(additive), modify_convention(drift),
delete_entity(drift), modify_endpoint(drift), noop_maintenance(behavior_preserving)` — drift=3,
additive=2, bp=1, six *distinct* op kinds (no repeats), and includes `delete_entity`, which
exercises the §5.5 retirement-tombstone path under a live model. Verified end-to-end with the
diligent/drifting fake agents at `--seed 37 --tasks 6`: both arms `chain_replay_valid=true`,
executed arm zero drift, prose arm monotonically increasing spec-side drift — the pipeline is
healthy on this draw before any spend.

**Seed 37 is excluded from v2-M7 evidence seeds** by this designation; it must not be reused as an
evidence-run seed later.

**Tests added** (`test/e4-v2-live-calibration.test.ts`, no live calls): the four CLI classification
gates (subprocess spawn, asserting refusal text and non-zero exit — mirrors
`test/e4-live-provider.test.ts`'s CLI section); `validateE4V2Manifest` rejects a manifest missing
`model`; the orchestrator stamps the dry-run default model identity when `model` is omitted and an
explicit identity when supplied.

**Verification:** full suite 721/721 (was 716/716; +5 new), `bun run e1:protect` PASS. No sealed
v2 module touched (all ten `code_twins` hashes unchanged; the non-budget projection pin in
`test/e4-v2-constants.test.ts` is untouched and stays green).

Part A committed alone, no push. Awaiting operator spend authorization for Part B.
