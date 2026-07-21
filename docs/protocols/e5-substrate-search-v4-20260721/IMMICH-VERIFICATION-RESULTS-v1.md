# Immich date-timezone fossil — local verification results v1

Verification of the v4 comparison's service-shaped lead (`COMPARISON-v1.md` §4): the birth-date
UTC-rollback trap, culprit `asBirthDateString` (pre-#28810), fixed by PR #28810 (`e94e22f`,
timonrieger, merged 2026-06-03, closes user issue #28091). Executed 2026-07-21 by Claude Code,
operator-authorized. Zero model spend — git + node only (no Docker needed; the trap is a pure
function). Scripts preserved: `immich_trap.mjs`, `immich_testcheck.mjs`.

## The trap, verified — silent, precondition-dependent

Culprit (`server/src/utils/date.ts`, shipped): `asBirthDateString(x) = x.toISOString().split('T')[0]`.
`toISOString()` always converts to UTC, so a `Date` at local midnight on a server **ahead of
UTC** rolls back to the previous calendar day. Fix: encode local calendar fields
(`isoDateToDate.encode`). Ran the verbatim shipped expression vs the fix across four timezones on
the added test's own input (`new Date(2000, 0, 15)` = 15 Jan 2000 local midnight):

| Server TZ | culprit (shipped `asBirthDateString`) | fix (`asDateString`) |
|---|---|---|
| UTC | `2000-01-15` — **CORRECT** | `2000-01-15` |
| Europe/Istanbul (UTC+3, the reporter's TZ) | `2000-01-14` — **WRONG, silent** | `2000-01-15` |
| Australia/Sydney (UTC+10/11) | `2000-01-14` — **WRONG, silent** | `2000-01-15` |
| America/New_York (UTC−5, behind UTC) | `2000-01-15` — CORRECT | `2000-01-15` |

**Verdict: trap real, silent, and precondition-gated.** It fires only when the server is *ahead
of* UTC — no exception, no error, the API just returns a birth date one day early. Certification
matches: user-discovered (#28091, reporter on `TZ=Europe/Istanbul`), post-cutoff, fix adds a
regression test.

## Forced touch, verified

The defective conversion lived in a **shared helper** used by 7 serialization sites at `e94e22f^`
(`album.dto`, `asset-response.dto`, `exif.dto`, `person.dto`, `tag.dto`, `user.dto`,
`album.service`). `person.dto.ts::mapPerson` maps `birthDate: asBirthDateString(person.birthDate)`.
Any backlog task serializing a date-only field **cannot avoid** the shared helper — strong
forced-touch, stronger than gunicorn's and comparable to pandas's single-pipeline shape.

## The decisive finding — the fix's OWN regression test is a decoy under the project's CI

This is the sharpened-D3 question (design note D3-refinement: *does the establishing scenario pin
the precondition, or merely cover the feature?*) answered with unusual force, by Immich's own
infrastructure:

- The added test (`server/src/utils/date.spec.ts`) asserts `asDateString(new Date(2000,0,15)) ===
  '2000-01-15'` and **does not stub TZ**.
- Immich's server test config (`server/test/vitest.config.mjs`, lines 30–31) pins
  **`env: { TZ: 'UTC' }`**.
- Under UTC the culprit returns the *correct* date. So run under the project's own pinned test
  environment, **the regression test passes on the buggy code**:

| Test-process TZ | buggy code yields | fix's own regression test |
|---|---|---|
| **UTC (the project's pinned CI)** | `2000-01-15` | **PASSES — original bug NOT caught (decoy)** |
| Europe/Istanbul | `2000-01-14` | FAILS — bug caught |
| Australia/Sydney | `2000-01-14` | FAILS — bug caught |

The regression test validates the fix but, under the repo's UTC-pinned suite, **would never have
caught the original regression**. The precondition (a non-UTC-ahead server) is exactly what the
test environment pins *away*. This is the decoy failure mode the D3-refinement names — observed
not in a hypothetical establishing scenario but in a real, deliberately-written, merged regression
test, defeated by the project's own CI timezone pin. It is the single cleanest real-world
illustration of the experiment's core claim: **a suite that does not pin the precondition passes
on broken code, and only a suite that does can discriminate.**

## Consequence for episode construction (concrete, testable)

Immich is admissible as the service-shaped substrate, with one **mandatory, now-precise episode
constraint**: the accumulated acceptance suite must run under a **non-UTC-ahead server timezone**
(e.g. `TZ=Australia/Sydney`), and the birthDate establishing scenario must assert read-back
equality under that TZ. Run under UTC — the project's own default — the episode is a decoy in
which treatment and control look identical for the wrong reason. This is no longer a vague
"establishing-item risk"; it is a one-line environment precondition, verified, that the episode
spec must pin. It also becomes a natural instrumentation point: the blind-authoring probe can be
scored on whether a blind author, given the birthDate feature and issue text, thinks to pin the
server timezone at all.

## Standing

- **Trap: verified real, silent, service-shaped, canonical HTTP surface, post-cutoff, strong
  forced-touch.** Fills the service-shaped slot vacated by gunicorn.
- **Establishing item: birthDate/People feature, satisfied — with the mandatory TZ precondition
  now verified and specified**, not merely assumed. Immich clears the *strengthened* D3 bar
  precisely because we can state the precondition the scenario must pin.
- **Contrast with gunicorn (failed D3, wrong layer / born dead) and TimescaleDB (weak D3, nobody
  pins the int2/composite/cross-type edge):** Immich passes because the precondition is a single,
  nameable environment setting, and the establishing behavior (birthDate read-back) is long-lived
  and user-meaningful.
- **The first verified two-substrate pairing is now in hand:** pandas #64478→#66250 (library,
  verified) + Immich #28810 (service, verified). Both traps post-cutoff, genuinely different
  shapes (wrong-result numeric vs timezone-serialization), both with satisfied, precondition-aware
  establishing items.

## Caveats

- Verification used the verbatim shipped expression (`x.toISOString().split('T')[0]`) as a pure
  function, not the full built server. Faithful because the culprit is that exact pure expression;
  a full-stack API repro (Docker up with non-UTC TZ, PATCH+GET birthDate) would add end-to-end
  confirmation but cannot change the arithmetic. Recommended as a pre-run sanity check only.
- Memorization risk (claude's scorecard, 3/5): the `toISOString` UTC-rollback pattern is
  well-known; the specific fix is post-cutoff, but the class is common. The memorization-probe
  discipline applies before any paid run.
- The fix also renamed helpers (`asBirthDateString`→`asDateString`, old `asDateString`→
  `asDateTimeString`); episode reconstruction must use the `e94e22f^` names for the pre-fix state.
