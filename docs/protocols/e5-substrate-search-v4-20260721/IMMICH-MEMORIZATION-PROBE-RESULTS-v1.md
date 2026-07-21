# Immich memorization / discrimination probe — results v1

Scored against `IMMICH-MEMORIZATION-PROBE-PREREG-v1.md` (frozen before any output read). 4 fresh
agents (fable + opus × two task framings: bare helper, and in-context `mapPerson`), neutral task,
no mention of timezones/UTC/bugs. Zero external spend (subagent tokens only). Verbatim outputs in
`blind-author-raw/`.

## What each wrote

| Probe | Model | Framing | Implementation | Class |
|---|---|---|---|---|
| 1 | fable | bare helper | `birthDate.toISOString().slice(0, 10)` | **FALLS IN** — the exact tempting buggy path |
| 2 | opus | bare helper | `getUTCFullYear/getUTCMonth/getUTCDate`, no comment | **FALLS IN** — same UTC rollback, via UTC accessors |
| 3 | fable | `mapPerson` | `getUTC*` + comment "using UTC fields, so a DATE column … never shifts a day" | **FALLS IN** — chose UTC, *confidently and wrongly* asserted it safe |
| 4 | opus | `mapPerson` | `getUTC*`, but explicitly identified the `toISOString` rollback bug AND flagged that correctness depends on local-vs-UTC storage, asking for confirmation | **AVOIDS** (per frozen rule: "explicitly flags/handles the timezone issue") |

**Tally against the frozen rule: 3 FALLS IN / 1 AVOIDS / 0 AMBIGUOUS.** ≥ half fall in →
**per the frozen interpretation, the trap is LIVE → proceed to build the Immich episode.**

## The deeper finding (stronger than the binary count)

- **4 of 4 chose a UTC-based conversion.** None wrote the actually-correct local-calendar-field
  extraction (`getFullYear/getMonth/getDate`) or used a date library with local handling. The
  tempting path isn't just tempting — it is the *unanimous default* for date-only serialization
  across models and framings.
- **0 of 4 would silently ship correct code.** 3 ship the buggy code silently; the 4th ships the
  same buggy code but flags the risk and asks a question. So in the actual episode the control arm
  overwhelmingly regresses — exactly the discrimination the substrate needs.
- **Probe 4 is the most informative single result.** It *named the exact bug* ("the naive
  `toISOString().slice(0,10)` … can roll back to the previous day when converted to UTC") and then
  *still chose UTC*, because it assumed UTC-midnight storage — while explicitly flagging that if the
  column is local-midnight, "the getters would need to switch to local." That is the crux of the
  whole trap surfaced by the agent itself.

## Consequence for episode design (important, adopt into the design note)

Probe 4 exposes that UTC-vs-local extraction is only *unambiguously* a bug once the **storage
convention is pinned**. Immich's ground truth is local-midnight (the real fix uses local fields;
its test uses `new Date(2000,0,15)` = local midnight). But 3 of 4 agents *assumed* UTC-midnight. So
for the episode to be valid under the project's own unambiguity requirement (cf. the structural-
ceiling lesson: contestable conventions manufacture false "regressions"), the feature spec and the
pinned acceptance scenario must **define correctness by observable behavior, not by an internal
convention**:

> A person recorded as born on 15 January 2000 must be returned by the API as `"2000-01-15"`,
> regardless of the server's timezone.

This single acceptance criterion (a) makes local extraction the only correct answer and every
UTC-based path unambiguously wrong, (b) is exactly the precondition-pinned scenario the whole study
needs (it only bites under a non-UTC-ahead server — pin `TZ` in the suite), and (c) neutralizes
probe-4-style "it depends on storage convention" defenses, because the observable contract is
fixed. The convention question becomes an implementation detail the agent must get right to satisfy
a black-box scenario — which is precisely what the executable-vs-readable comparison measures.

## Verdict

- **GO on Immich.** The trap is live and, if anything, more robust than hoped: UTC is the unanimous
  default, so the control arm will regress at a high rate — good discrimination, good pilot power.
- **Memorization is NOT a threat here.** The concern was that models would spontaneously avoid the
  bug; instead they spontaneously commit it. The post-cutoff fix is not memorized in a way that
  protects the agents.
- **One design requirement is now firm:** the pinned acceptance scenario must assert TZ-invariant
  observable behavior (born 2000-01-15 → returns "2000-01-15" under a non-UTC-ahead server), which
  simultaneously pins the precondition, defines correctness unambiguously, and defeats the
  storage-convention ambiguity probe 4 raised.

## Next (zero external spend until the pilot)

1. Adopt the "observable-behavior acceptance criterion" requirement into the episode design note.
2. Settle the Option 1 / Option 2 framing (still pending) for the now-Immich-primary study.
3. Draft the pre-registration; run the re-attack (Prompt B) against the projected Immich post.
4. Then — first external spend — the scoped pilot on Immich, on operator authorization.
