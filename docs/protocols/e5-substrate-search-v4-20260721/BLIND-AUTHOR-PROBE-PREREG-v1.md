# Blind-author probe — pre-registered scoring rule (frozen before any output read)

Written by Claude Code 2026-07-21, **before reading any author output**. Purpose: measure whether
competent authors, writing acceptance scenarios for a feature from its public contract alone (no
bug, no fix, no precondition hint), naturally pin the precondition each verified trap needs to
fire. If they do, the accumulated suite discriminates and the study has legs. If they don't, that
is itself the finding: the treatment's whole advantage would hinge on a precondition authors don't
write unprompted.

## Setup

- 4 blind authors: 2 per substrate (Immich birthDate, pandas idxmax), two different models
  (fable, opus), fresh context, instructed not to search or identify the project.
- Each got ONLY the mechanically-extracted public feature contract (see `IMMICH-VERIFICATION-
  RESULTS-v1.md`, `PANDAS-VERIFICATION-RESULTS-v1.md` for the traps they were NOT shown).
- Task: "write the acceptance scenarios your team would actually commit," realistic set, not
  token happy-path, not exhaustive fuzz. The neutral "hard/honest" framing — no nudge toward
  edge cases or environments.

## What the trap needs (the hidden precondition, not shown to authors)

- **Immich:** the birth-date bug fires only when the SERVER'S CLOCK is set AHEAD of UTC. Under
  UTC (the default) the buggy code returns the correct date. Pinning = a scenario that controls or
  varies the server timezone to a non-UTC-ahead value, OR asserts the stored date reads back
  identically regardless of server timezone.
- **pandas:** the idxmax bug fires only for LARGE unsigned integers (above 2**63) in a nullable
  UInt64 column, in the presence of an NA, via the DataFrame (not Series) path. Pinning = a
  scenario using large unsigned integer values (beyond signed-64 range) in a nullable integer
  column WITH a missing value.

## Scoring rule (frozen)

Each author's scenario set is scored on a 3-level scale for whether it would CATCH the trap:

- **PIN (2):** contains at least one scenario that fully instantiates the precondition — for
  Immich, controls/varies server TZ (or asserts TZ-invariance of stored dates); for pandas, uses
  large unsigned ints beyond 2**63 in a nullable int column with NA. Such a suite catches the
  trap; treatment and control would differ only if the arm actually runs it.
- **GESTURE (1):** raises the precondition's THEME without instantiating it — for Immich, mentions
  timezones/DST/date-vs-datetime at all but never pins a non-UTC-ahead server clock; for pandas,
  tests "large numbers" or integer overflow or unsigned types OR NA-handling, but not the specific
  large-unsigned-with-NA combination. A suite like this MIGHT catch the trap depending on exact
  values — recorded as partial, resolved case-by-case against the actual values written.
- **MISS (0):** happy-path and ordinary edge cases only (nulls, empties, ties, future-date
  validation, small/negative numbers), no gesture at the precondition. This suite passes on the
  broken code — the decoy outcome, matching what shipped in reality.

## Pre-registered interpretation (declared before results)

- **Both substrates score MISS on both authors (most likely, per the Immich real-world evidence
  that even the fix's own added test missed under UTC):** strong result FOR the thesis in one
  sense (silent traps genuinely evade competent blind authors → the failure mode is real and
  common) and a hard constraint on the study (the episode MUST supply the precondition-pinned
  scenario as part of the established baseline; it cannot be assumed to arise from blind authoring).
  This does not sink the study — the establishing scenario can be authored with the precondition
  pinned as a deliberate baseline artifact — but it means the "does blind authoring naturally
  cover it" question is answered NO, and the writeup must say so.
- **At least one PIN on a substrate:** that substrate's establishing item is naturally satisfiable
  by competent authors — the strongest possible position; the accumulated suite would plausibly
  exist in the real world.
- **Split (one substrate pins, the other misses):** informative about which surface's precondition
  is "obvious" (timezones are a known gotcha; large-unsigned-int-with-NA is more obscure) — likely
  Immich pins more readily than pandas, which would itself be a reportable finding about where
  silent traps hide best.

**No outcome is a failure of the probe.** The probe's job is to measure the precondition-pinning
rate; every result tells the episode design something concrete and is reported as-is.

## What happens next regardless of outcome

- The result feeds the episode design note (does the establishing scenario need to be a
  deliberately precondition-pinned baseline artifact, or can blind authoring be relied on?).
- It does NOT gate on spend; it is the last zero-cost measurement before any paid pilot.
- Author outputs are recorded verbatim; scoring is applied once, against this rule, and not
  re-litigated to fit a preferred story.
