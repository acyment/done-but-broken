# Immich pilot harness — build artifact (PRE-SPEND, not yet runnable end-to-end)

Governed by `docs/e5/E5-IMMICH-PILOT-PREREG-v2.md`. **No pilot has been run and none is
authorized.** This directory holds build artifacts produced under the zero-external-spend gates
(prereg §7). It does NOT stand up Immich and does not, by itself, prove the trap fires.

## Status

| Piece | State |
|---|---|
| Gate §7.1 archaeology (fix commit, pre-fix helper, server-side, API contract) | DONE — fix `e94e22f` (2026-06-03), parent `4a8c3b6`; trap = inline `x.toISOString().split('T')[0]` in `server/src/utils/date.ts` |
| Acceptance glue (this dir) | DONE + audited (dev+QA pair, `docs/methodology/THREE-AMIGOS-DESIGN-REVIEW-v1.md` sibling practice) |
| Immich dev-watch stack (server + Postgres/Redis, ML off, web off, <60s reload) | **NOT BUILT** — the multi-day build the Development amigo flagged |
| Gate §7.2 trap-fires proof (through this glue, under the frozen clock) | **BLOCKED on the stack** |
| Gate §7.3 green-baseline suite audit under the frozen instant | NOT DONE |
| Gates §7.4–7.6 (contamination checkout, latency, arm-parity manifest) | NOT DONE |

## What's here

- `features/person_birthdate.feature` — the realistic round-trip scenario. **No timezone
  language by design**; it discriminates the trap only via the harness environment (server clock
  ahead of UTC), never via its text (re-attack resolution).
- `features/support/world.ts`, `features/step_definitions/person_birthdate.steps.ts` — the
  step glue: an **inert adapter** (POST /people, GET /people/{id}, raw `===` on the returned date
  string). No date math, no timezone handling, no reinterpretation — by construction, so a
  server-side date drift fails the step rather than being masked.
- `cucumber.mjs` — config with **`strict: true`** (mandatory).

## Audit-stack status of the glue (dev+QA pair, both blind to the trap)

- **Inert (no smuggled logic):** PASS — the comparison is `assert.strictEqual(birthDate, expected)`
  on exactly the scenario's value; no constant/branch/parse/normalize.
- **Fails on wrong output / null / empty:** PASS.
- **Deterministic, no Date/parse path:** PASS.
- **Honest failure surface:** hardened (explicit id presence check, `encodeURIComponent`,
  non-null object guard, awaited async, clear messages).
- The QA reviewer, blind to the timezone trap, independently noted that any server-side date
  reformatting "will (correctly) show up as a failure — do not fix that in the glue." The trap-
  detection property arises from inertness, not from knowledge of the bug.

## Harness guarantees this glue depends on (must be provided by the stack, NOT pushed into the glue)

1. **`--strict` mode** (in `cucumber.mjs`) — else undefined steps false-green.
2. **Pass/fail from the process exit code**, never stdout scraping.
3. **Fresh World per scenario** (cucumber default; do not override).
4. **Backend data isolation + real persistence** — the GET must return the person the POST created;
   pre-existing "Ada / 1948-03-17" records must not satisfy a fetch. The glue anchors on the id the
   POST returns, which is correct only if POST returns that person's id.
5. **Env:** `IMMICH_BASE_URL`, `IMMICH_API_KEY` set in the runner.
6. **Node ≥ 18** (global `fetch`).
7. **The `birthDate` serialization contract is a literal `YYYY-MM-DD` string** — the study/backend
   owns this; the glue does zero date interpretation on purpose.

## Not to be run against a model / provider

Building and locally executing this glue against a self-hosted Immich instance is zero-external-spend
engineering. Running the two-arm pilot (agents, model calls) requires fresh operator authorization
naming prereg v2.
