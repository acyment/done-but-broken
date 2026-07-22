# Immich pilot harness — build artifact (PRE-SPEND; **§7.2 gate FAILED; Batch A re-anchor verification KILLED option 1 — blocked on operator decision**)

Governed by `docs/e5/E5-IMMICH-PILOT-PREREG-v2.md`. **No pilot has been run and none is
authorized.** This directory holds build artifacts produced under the zero-external-spend gates
(prereg §7). 2026-07-22: the stack was built and the §7.2 trap-fires proof was RUN — it
**FAILED at leg (i)**: the planned trap has zero end-to-end exposure at the pinned commit
(`proof/GATE-7-2-FINDING-v1.md`). The episode design in prereg v2 §3 is invalidated as
written; nothing here authorizes proceeding without a redesign + fresh review.

## Status (2026-07-22)

| Piece | State |
|---|---|
| Gate §7.1 archaeology | DONE — fix `e94e22f3f8a1…` (2026-06-03), parent `4a8c3b60bedb…`; helper verbatim at pinned commit; POST/GET/PUT `/people` verified live with ML off |
| Acceptance glue (this dir) | DONE + audited; `cucumber.mjs` got a v12 config-shape rider (2026-07-22, semantics unchanged — see file comment; the mis-shape was caught by `--strict` failing loud, the guarantee working) |
| Immich dev-watch stack (`stack/`) | **BUILT & VERIFIED** — bare-node server (API worker only), pinned toolchain (node 24.15.0 / pnpm 10.33.4, vendored), pinned Postgres+Redis digests, frozen clock `2026-01-15T12:00:00+11:00 Australia/Sydney` (server process only), staleness-proof health gate, DB template snapshot/reset, admin+API-key bootstrap |
| Gate §7.5 latency budget (<~60 s) | **MET** — edit→recompile→restart→health-gate→verdict = 31 s; no-edit acceptance run ~2 s |
| Gate §7.2 trap-fires proof | **RUN — FAILED at leg (i), design-invalidating.** Round-trip PASSES on buggy code under the pinned ahead-of-UTC clock; driver hands the helper a UTC-midnight Date, so the culprit is observably correct on this surface under every TZ. Full mechanism + options: `proof/GATE-7-2-FINDING-v1.md` |
| Gate §7.3 suite audit | DONE — ordinary server suite **89/89 files green** under `TZ=Australia/Sydney` agent-shell env (`proof/raw-20260722/ordinary-suite-agent-env.log`); zero TZ-flipping tests to quarantine (suite self-pins `TZ=UTC` — also the certified native-suite-blindness property). Pin-clock shim must never ride agent test commands (5 cross-realm artifacts otherwise; see finding §7.3 note) |
| Gate §7.4 contamination | Checkout posture DONE — substrate is a single-commit shallow detached fetch of the parent; `git log` = exactly `4a8c3b6`, fix absent by construction. Network-policy statement for a live run: deferred with the redesign |
| Gate §7.6 arm-parity manifest | N/A until a redesigned episode exists |
| Batch A re-anchor verification (2026-07-22) | **RUN — KILL for option 1.** The fix is behaviorally a rename on every timestamp surface (its only real change is the birthDate date-only encoder, already zero-exposure), and every timestamp column is `timestamptz` → byte-identical API output under Sydney vs UTC, proven end-to-end on the shipped code. No trap exists to re-anchor on. Memo: `proof/BATCH-A-FINDING-v1.md`; evidence: `proof/raw-20260722-batch-a/`. Batches B–D moot; operator decides option 2 |

## Stack quick reference (`stack/`)

`start-deps.sh` (pinned Postgres 15433 / Redis 16380) → `start-server.sh` (dev-watch, pilot
clock; `--tz/--instant/--no-pin` for proof/grader runs only) → `bootstrap-admin.sh` (writes
`.secrets/api_key`) → `snapshot-db.sh` / `reset-db.sh` (template-based per-task reset) →
`run-acceptance.sh` (health gate + cucumber `--strict`; exit code is the verdict; exit 2 =
env-not-ready, distinct from red). `grade.sh` + `grader/grader.mjs` = the hidden grader
(different date, +09:00 phase, UTC counter-check phase). `set-helper-state.py` switches the
date helper between proof states (buggy/green/naive/plusone). The substrate checkout lives in
`substrate/immich` (gitignored).

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
