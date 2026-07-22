# Gate §7.2 trap-fires proof — FINDING v1: **FAILED at leg (i), design-invalidating**

Date: 2026-07-22. Zero external spend (git + node + docker + curl only; no model calls).
Governing prereg: `docs/e5/E5-IMMICH-PILOT-PREREG-v2.md` §7.2. Raw evidence: `raw-20260722/`.

## Verdict

**The planned trap does not fire end-to-end at the pinned commit.** Through the exact
`run-acceptance` path the treatment agent would use — pinned commit `4a8c3b6` (parent of fix
`e94e22f`), shipped buggy helper verbatim, server a bare node process under the frozen instant
`2026-01-15T12:00:00+11:00` in `Australia/Sydney` (ahead of UTC, DST-resolved AEDT) — the
person birth-date round-trip **PASSES**. Prereg §7.2(i) requires it to FAIL under the pinned
clock. It does not, and the reason is structural, not a stack bug: **no server timezone makes
this round-trip return the wrong date at this commit.** Legs (ii)–(iv) are moot; per prereg
§7.5 discipline ("stop and redesign, do not absorb") and the AGENTS.md exposure precondition,
this stops the pilot build pending operator decision. No spend has occurred.

## The mechanism (driver-level, proven)

The prior verification (`IMMICH-VERIFICATION-RESULTS-v1.md`) proved the pure-function
arithmetic: `toISOString().split('T')[0]` rolls a **local-midnight** Date back one day on a
server ahead of UTC. The arithmetic stands. What fails is the input-type assumption:

1. `person.birthDate` is a Postgres **`date`** column (raw evidence: `\d person`). The API
   stores the DTO's string (`"1948-03-17"`) without any Date construction on the write path
   (create and update both — `PersonCreateSchema` keeps `birthDate` a plain `z.string()`).
2. On read, Immich's driver stack (postgres.js via `@immich/sql-tools` `createPostgres`,
   session `TimeZone: 'UTC'`) parses the wire value with `parse: (x) => new Date(x)`.
   `new Date('1948-03-17')` is an ISO **date-only** form, which ECMAScript parses as
   **UTC midnight** — not local midnight.
3. `toISOString()` of a UTC-midnight Date returns the same calendar date under every server
   TZ. Driver probe under `TZ=Australia/Sydney` (`raw-20260722/driver-probe-output.txt`):
   `birthDate.toISOString() === '1948-03-17T00:00:00.000Z'`, local rendering 10:00 AEST,
   `getHours() = 10` (local midnight would be 0), culprit output `'1948-03-17'` — **correct**.

The local-midnight Date the trap needs (`new Date(2000, 0, 15)` — the fix's own test input)
never occurs on this path. Empirical confirmation on the live server under the pinned clock
(`raw-20260722/leg-i-observed-pass.txt`): POST→GET and PUT→GET both return `1948-03-17`;
the cucumber `--strict` suite passes (exit 0) on the buggy code.

## Why the archaeology missed it

`IMMICH-VERIFICATION-RESULTS-v1.md` §Caveats said a full-stack repro "cannot change the
arithmetic." True — but it changed the *operand*. The fix's regression test constructs a
local-midnight Date directly; the runtime read path constructs a UTC-midnight Date. The
verification inherited the test's input construction, not the runtime's. (This gate exists
because of exactly this class of gap; it did its job before any spend.)

Two subsidiary observations, recorded because they matter to any redesign:

- **Upstream's own regression test is doubly a decoy**: (a) the suite pins `TZ: 'UTC'`
  (already documented), and (b) its input (`new Date(2000, 0, 15)`, local midnight) is not
  what the live person path produces. It validates the helper in isolation, against an input
  the endpoint never sees.
- **Where local-time Dates DO flow at this commit**: `timestamp without time zone` columns
  (e.g. `asset.localDateTime`) — postgres.js parses their zone-less wire form
  (`'2020-06-01 14:30:00'`) as LOCAL time, and the pre-fix `asDateString` (`toISOString`)
  UTC-shifts them. That is the observable timezone bug the fix title ("respect timezone in
  iso date string encoding") is actually about; it surfaces on the asset/EXIF/album-date
  paths, which require asset upload + the microservices worker + EXIF ingestion — a
  substantially different episode than the person round-trip. The original user repro
  (#28091: birth date shifts one day earlier **on every save**, server platform, v2.7.5,
  `/etc/localtime` mounted) does not reproduce at the pinned commit through the JSON API
  (PUT→GET is stable; `raw-20260722/leg-i-observed-pass.txt`); its client payload format at
  v2.7.5 was not reconstructed.

## What this invalidates, and what survives

Invalidated (prereg v2 §3, as written):
- The trap task premise "the tempting reimplementation reintroduces the UTC conversion →
  breaks the established round-trip." At this commit the buggy and fixed helpers are
  **observably indistinguishable on the person round-trip** under any server TZ. Zero lever
  exposure — the P1.1 failure class, caught pre-spend this time.
- The memorization-probe inference "4/4 agents write the buggy UTC path" still holds for
  *code shape*, but the shape is not observably wrong on this surface.

Survives (usable under any redesign on this substrate):
- The full dev-watch stack (see README status table): pinned toolchain, deps stack,
  frozen-clock launcher, staleness-proof health gate, DB snapshot/reset, admin/API-key
  bootstrap, hidden-grader machinery, cucumber `--strict` glue wired to the live API.
- **§7.5 latency budget MET**: edit→recompile→restart→health-gate→verdict = **31 s**
  (no-edit acceptance run: ~2 s). Under the ~60 s budget.
- **§7.1 archaeology confirmations**: fix `e94e22f3f8a1…`, parent `4a8c3b60bedb…`, trap
  expression verbatim at the pinned commit, POST/GET/PUT `/people` work with ML disabled.
- **§7.4 contamination posture**: the substrate checkout is a single-commit shallow detached
  fetch; `git log` contains exactly `4a8c3b6` (fix absent by construction).
- The clock-pin approach (server-process-only; see §7.3 note below on why it must not leak
  into the agent's test shell).

## Options for the operator (no recommendation encoded in artifacts)

1. **Re-anchor the trap on the surface where local-time Dates actually flow**
   (`asset.localDateTime` / EXIF / album date ranges): real, silent, precondition-gated —
   but requires asset-upload fixtures, the microservices worker, EXIF tooling, and a new
   establishing scenario; a materially different episode needing fresh Three Amigos +
   re-attack + a prereg v3.
2. **Drop Immich as primary substrate** and fall back per the design note's standings
   (pandas = corroborating-only under D7; CLI candidates recency-back-burnered) — i.e.
   reopen the substrate search for a service-shaped fossil whose repro survives an
   end-to-end check. Any future §7.1 archaeology must include a live end-to-end repro at
   the pinned commit as an admission requirement, not a recommended sanity check.
3. **Salvage the person-birthDate scenario with a different trap mechanism** only if one
   can be *certified* (not constructed): none was found this session; the write path never
   constructs a Date, and the read path's Date is UTC-midnight by driver design.

## Suite audit note (gate §7.3, run this session)

- Under the agent-shell env (`TZ=Australia/Sydney`, no clock shim): see
  `raw-20260722/ordinary-suite-agent-env.log` (result recorded in the README table).
- The server suite's own config pins `TZ: 'UTC'` for test processes, so ordinary tests are
  structurally TZ-insensitive (nothing to quarantine) *and* structurally blind to any
  TZ-serialization trap — the certified decoy property, unchanged.
- The pin-clock shim must never ride on the agent's test commands: under
  `NODE_OPTIONS=--require pin-clock.cjs`, vitest worker threads see cross-realm `Date`
  identity and 5 unrelated tests fail as instrument artifacts
  (`raw-20260722/ordinary-suite-pilot-env.log`). The launcher scoping in `stack/lib.sh`
  (env applied only to the server process) is therefore load-bearing and is now documented.
