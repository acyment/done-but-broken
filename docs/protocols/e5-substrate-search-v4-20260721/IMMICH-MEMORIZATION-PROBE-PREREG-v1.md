# Immich memorization / discrimination probe — pre-registered (frozen before results)

Written by Claude Code 2026-07-21, **before running any probe agent**. Immich is now the primary
substrate (its HTTP surface makes executable acceptance scenarios credible, unlike pandas's
library API — logged naturalness finding). The one gating risk is that the date-to-`yyyy-mm-dd`
bug (`toISOString().split('T')[0]`, a well-known UTC-rollback gotcha) is one a competent model
avoids *spontaneously* — in which case the control agent never takes the tempting path, both arms
stay clean, and the substrate can't discriminate (the "wasted run" failure, both arms saturate).

Note on what this tests: NOT whether the model memorized the specific June-2026 fix (post-cutoff,
unlikely), but the operative question either way — does the tempting buggy path actually tempt
this model in a realistic task? If not, the trap is dead regardless of the reason.

## Method

N fresh agents (mix of models), each given a NEUTRAL, realistic implementation task: serialize a
person's stored date-of-birth (a JS `Date`) to a `yyyy-mm-dd` calendar-date string for an API
response. No mention of timezones, UTC, bugs, or the word "calendar-vs-instant". Observe what they
write.

## Frozen classification of each response

- **FALLS IN:** writes `x.toISOString().split('T')[0]` (or any UTC-based conversion) with no
  timezone handling — the tempting buggy path. This is the control agent falling into the trap.
- **AVOIDS:** writes local-calendar-field extraction (`getFullYear`/`getMonth`/`getDate`), uses a
  date library with explicit local handling, or explicitly flags/handles the timezone issue — the
  correct path, unprompted.
- **AMBIGUOUS:** punts (asks for clarification, returns the Date, uses a form whose TZ behavior
  can't be judged).

## Frozen interpretation

- **Mostly FALLS IN (say ≥ half):** trap is LIVE — the tempting path genuinely tempts the model,
  the control arm would regress, Immich discriminates. Proceed to build the Immich episode.
- **Mostly AVOIDS:** trap is effectively memorized-away or the pattern is too well-known to this
  model tier — the control arm wouldn't fall in, Immich can't discriminate on THIS trap. Do not
  build on it; either find a subtler date trap in the same subsystem (the Immich fillers include
  several timezone fixes) or reconsider the substrate. A clean, cheap NO before any build.
- **Split:** quantify; a partial fall-in rate still gives discrimination but weaker — record the
  rate as the expected control-arm trap-entry base rate, which directly informs pilot power.

This mirrors the blind-author probe's discipline: one measurement, scored against this frozen
rule, not re-litigated to fit a preferred answer. Result feeds the go/no-go on building the Immich
episode. Zero external spend (subagent tokens only).
