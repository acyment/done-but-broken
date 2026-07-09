# ADR-007 — How E1 and E4 coexist in this repo (brief §13 Q7)

**Status:** Proposed (Phase-1 gate). **Binding inputs:** Gate-0 Q4 (enforced legacy-import check is
a Phase-1 deliverable), R1/R2, DISCOVERY §1.2 (two parallel run systems) and §1.4 (layered-profile
precedent).

## Context

Brief §13 Q7 asks: shared core vs E4 wrapper; module boundaries; how the E1 seal stays untouched.
The repo facts that constrain the answer: (a) E1's closed-world surfaces — `validateE1Constants`,
`conditions.ts`, task-package validation, gating string-equality — **reject** anything E4-shaped by
design; (b) the OpenSpec profile already demonstrates the coexistence pattern (own schema string,
own validator, layered by reference on the base seal, zero edits to it); (c) a legacy `runPilot`
stack exists, green but superseded, that E4 must not extend (Gate-0 Q4).

## Options

- **A. Refactor toward a shared core** (generalize conditions/constants/runner for N experiments).
  Rejected: every generalization touches seal-pinned modules; the E1 guarantee would rest on "the
  refactor was faithful" instead of "the files did not change". Maximum risk, zero E4-specific gain.
- **B. Full fork** (E4 copies everything it needs). Rejected: duplicates tested L0 mechanics and
  provider plumbing, and drift between copies becomes its own bug class.
- **C. Wrapper over a read-only library allowlist (chosen).**

## Decision

**E4 is a wrapper: new modules under an `e4` namespace, importing a declared allowlist of existing
modules as a read-only library, following the layered-profile precedent for constants.**

### Layout

- `src/e4/` — all E4 source (runner state machine, gate, arm policy, drift meter, substrate,
  oracle executor, manifest schema, E4 constants validator, conditions).
- `bin/e4.ts` (+ `bin/e4-inspect.ts` later) — CLI entry points.
- `test/e4-*.test.ts` — E4 test suites; `test/fixtures/e4/` — fixtures incl. the known-drift fixture.
- `docs/protocols/e4-sealed-constants-*.json` — the E4 constants lineage (schema
  `"e4-sealed-constants"`, own validator, own draft→sealed progression; layers on nothing E1).
- `tasks/` is not used by E4 v1 (substrates are generated, not authored packages).

### Import allowlist (dependency direction: `e4 → e1-libs`, never the reverse)

E4 modules MAY import (read-only, never modified by E4 milestones):

- **L0 mechanics:** `src/e1-harness.ts` (replacement application, command validation, workflow
  guards, verification execution).
- **L1 grammar:** `src/e1-l1-parser.ts` — data-driven from a constants object, so it parses E4's
  grammar given E4 constants; `done_literal` stays the bare token (Gate-0 injection 2).
- **Provider plumbing:** `src/e1-live-provider.ts`, `src/e1-provider-runtime.ts`,
  `src/model-provider-presets.ts`, token estimator/ledger modules, `src/e1-redaction.ts`.
- **Provenance primitives:** `src/snapshot.ts`, `src/e1-workspace-snapshot.ts`.
- **OpenSpec workflow libraries (v2-M1 amendment, operator-approved 2026-07-09 at the E4 v2
  design gate):** `src/e1-openspec-workflow.ts` (pinned-CLI plumbing: version pin, telemetry-off
  env, output normalization) and `src/e1-openspec-harness.ts` (archive step with exit-0 abort
  detection + deterministic archive rename, scenario parsing, the
  `e1-openspec-scenario-canonicalizer-v1` canonicalizer, survival ledger) — generic per the v2
  exploration, reused read-only. The E1-BOUND pieces stay out: `src/e1-openspec-constants.ts`
  (E1 profile id, E1 base-constants loader, E1 snapshot roots) is added to the forbidden set
  below; E4 carries its own thin wrapper (`src/e4/v2/openspec.ts`, profile
  `e4-openspec-workflow-v1`).

E4 modules MUST NOT import:

- **Legacy stack (Gate-0 Q4, enforced):** `src/runner.ts`, `src/openrouter-agent.ts`,
  `src/model-loop-agent.ts`, `src/fake-agent.ts`, `src/task-package.ts`, `src/provenance.ts`
  (legacy-layout replay machinery), `src/index.ts` (re-exports the legacy stack),
  `bin/run-fake-pilot.ts`, `bin/inspect-run.ts`.
- **E1 orchestrators and E1-closed-world modules:** `src/e1-package-runner.ts`,
  `src/e1-no-provider-runner.ts`, `src/e1-turn-adapter.ts`, `src/e1-l1-constants.ts` (validator
  hardcodes E1 schema/conditions), `src/conditions.ts`, `src/result-schema.ts`. E4 builds its own
  equivalents; the E1 versions stay bit-identical. (The turn adapter is deliberately on this list:
  it encodes E1's termination/continuation semantics against E1 conditions — E4's sequencing state
  machine subsumes its role.)
- **E1-bound OpenSpec profile module (v2-M1 amendment):** `src/e1-openspec-constants.ts` — its
  loader validates the E1 profile schema/id and resolves the E1 base seal; E4 uses
  `src/e4/v2/openspec.ts` instead.

**Enforcement (shipped with this ADR, per Gate-0 Q4 + Gate-1 change 3):**
`test/e4-no-legacy-imports.test.ts` scans every E4 module (`src/e4/**`, `bin/e4*`, `test/e4-*`) and
fails on any import resolving into the forbidden set; the scanner is itself unit-tested against
synthetic violations so the check can never pass vacuously. **The entire normative forbidden set —
the legacy stack AND the E1-orchestrator/closed-world list above — is lint-enforced from Phase 1**
(Gate-1 rejected deferred enforcement: a normative-but-unenforced rule is spec-code drift, and this
repo of all repos doesn't ship that).

### How the E1 seal stays structurally protected

1. **No shared mutable surface:** E4 never edits an allowlisted module; any E1-file edit requires an
   explicit gate-reviewed decision (R1). The seal is test-pinned (DISCOVERY C5), so violations are
   mechanically detectable.
2. **Per-milestone triad check (Gate-0 Q2, shipped with this ADR):** `bun run e1:protect` = full
   `bun test` green + sealed-constants file SHA-256 unchanged + one canned-transport `e1` smoke run
   into gitignored `tmp/` (end-to-end path protection that value-pinning alone doesn't give).
3. **Constants lineage isolation:** `e4-sealed-constants` is a different schema string; E1's loader
   path in `bin/e1.ts` stays hardcoded to the v1.0 file; neither validator accepts the other's file.
4. **Pooling isolation by construction:** `e4_arm_*` condition IDs + the manifest's compatibility
   boundary (constants version, meter version, substrate config) make E4 rows unjoinable with
   E1/E2/E3 data, per the amended AGENTS.md.

## Consequences

- E4 rebuilds a thin layer (turn adaptation, conditions, result schema) it could theoretically
  share — the deliberate price of keeping "E1 unchanged" a file-level fact rather than a
  code-review judgment.
- The allowlist is normative for Phase 2/3: any needed module outside it is a gate question, not a
  quiet import.
