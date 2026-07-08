# ADR-002 — Persistence of generated apps (brief §13 Q2)

**Status:** Proposed (Phase-1 gate). **Binding input:** Gate-0 injection 4 / R9 — determinism is a
primary criterion for the oracle path.

## Context

The generated REST service needs a storage layer. The choice affects (a) test determinism — the
estate's flagship property is replay-validity, and the E4 oracle runs HTTP suites against a live
server (ADR-006); (b) task richness — some change-op families (migrations, cross-restart state)
only exist with durable storage.

## Options

- **A. In-memory store, seeded fixture (chosen).** Each oracle/gate/smoke run starts the server
  fresh; state = deterministic seed-data fixture generated from the ground-truth IR + the run's
  request sequence. No disk state, no cleanup, no cross-run leakage, byte-stable behavior under
  fixed request order.
- **B. sqlite.** Richer ops (durability, migrations as tasks) but introduces a database file in the
  workspace: cross-run state to reset, file-locking and WAL nondeterminism at the margins, a native
  dependency, and a second thing snapshots must capture consistently. All solvable — none free.
- **C. JSON-file persistence.** Middle ground; still disk state per run, still reset discipline,
  and it pushes serialization conventions into the app surface where agents will "improve" them.

## Decision

**In-memory (A) for v1.** The server process is the unit of state: every executor run (smoke, gate
red, gate green, hidden oracle) is fresh-start → fixed-order request sequence → kill (ADR-006).
Seed data is a fixture emitted by the substrate generator from `substrate_seed` + the task's
ground-truth IR, loaded at startup — so "list" and "analytics" endpoints have deterministic
non-trivial answers without durable storage.

Migration/durability change-ops are **excluded from the v1 op space** (recorded in the substrate
design, architecture §5). To avoid precluding v2 (brief §6 discipline): the scaffold contract routes
all state access through a single storage module boundary, so a sqlite-backed scaffold is a
substrate-config change, not a runner change.

## Consequences

- Oracle determinism gets its strongest available foundation; R9 shrinks to server-lifecycle and
  port concerns, handled in ADR-006.
- Task richness lost: no cross-restart scenarios in v1 — acceptable; drift channels (endpoints,
  fields, validation rules, conventions) do not depend on durability.
- Snapshot/resume (ADR-005) never has to capture live data state — workspace files are the whole
  state, which keeps snapshots trivially content-hashable.
