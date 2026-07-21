# Step-6 re-attack on the Immich pilot — findings and resolution v1

A skeptical-CTO agent (opus, fresh, both-framings) attacked the projected Immich post per the
standing Step-6 discipline, BEFORE any spend. It found a **fatal flaw in pre-registration v1**,
correctly. This doc records the flaw, the resolution (verified), and supersedes prereg v1.

## The flaw (verified, fatal to prereg v1)

Prereg v1 made ONE object — the pinned scenario "*a person born 2000-01-15 is returned as
2000-01-15, regardless of server timezone*" — play three roles that must be separate:

1. the thing the treatment arm **executes** (the causal lever),
2. the thing the control arm **reads** (an agent-visible spec),
3. the thing the harness **scores against** (the held-out oracle for false-done).

Collapsing these is fatal in both directions:

- **Positive result → tautological.** If the scored oracle is the object treatment can execute,
  then "the arm that can see the failing check avoids shipping with it failing" is true by
  construction. Lever and measurement instrument are the same object.
- **Null result → contaminated.** The scenario's own text ("…regardless of server timezone") *is
  the fix spelled out in prose*. A control agent reading it is handed the answer; a null can't be
  distinguished from "reading a giveaway spec was sufficient."

The memorization/content controls (same model, same text, memorization probe) were real but
defended the wrong flank — the flaw is not content leakage between arms, it's the three-role
conflation of one artifact.

## The resolution — pin the precondition by ENVIRONMENT, not by spec text (verified)

Split the three roles:

1. **Agent-visible runnable suite (both arms hold the text; treatment can execute):** the
   *realistic* acceptance scenario the blind authors actually wrote — a plain round-trip with **no
   timezone language**: "create a person born 1948-03-17, GET the person, expect birthDate ==
   1948-03-17."
2. **The precondition is pinned by the test ENVIRONMENT:** the harness runs the whole suite under
   a non-UTC-ahead server clock (e.g. `TZ=Australia/Sydney`), symmetric across both arms.
3. **Held-out grader (neither arm runs it; harness only):** a separate hidden check of the same
   observable behavior, scored under the same TZ, used for the false-done metric — distinct from
   the runnable suite so lever ≠ grader.

**Verified (`env_pin_check.mjs`):** the realistic no-TZ-language round-trip returns the correct date
under UTC (decoy) but returns `1948-03-16` — RED — under Sydney/Istanbul on the buggy code, GREEN on
the fix. So:

| Attack framing | How the resolution defuses it |
|---|---|
| A (tautology) | The visible scenario is a realistic behavioral round-trip, not the metric restated; the scored grader is a separate hidden check. Treatment catching the regression = "executing a realistic suite under a realistic-adverse environment surfaces a real regression" — the actual claim. |
| B (prose leak) | The visible scenario text contains **no timezone language**. Reading it hands the control agent nothing about the bug. The discriminator is execution-under-environment, not spec content. |

## This revises the blind-author probe reading (important, more accurate)

The blind-author probe (`BLIND-AUTHOR-PROBE-RESULTS-v1`) concluded "0/4 pinned the precondition →
realistic suites don't catch the bug." The re-attack forces a sharper, more accurate reading:
**both Immich authors DID write a round-trip scenario that catches the bug — it only fails to fire
because they (like real CI) assume a UTC environment.** The gap is *environmental*
(run the suite under a non-UTC clock), not *scenario-content*. So:

- The catching scenario arises naturally from competent authors (good news — less "supplied
  artifact" than v1 implied).
- What does NOT arise naturally is running the suite under an adverse timezone. That is the
  supplied condition — and it is a legitimate, disclosable test-hygiene choice ("run acceptance
  tests under a non-default server clock"), symmetric across arms, that leaks no hint about the bug.
- The Option-1 disclosure becomes cleaner: we supply the *environment*, not a fix-encoding spec.
  Realistic teams run under UTC (Immich's own CI pins `TZ=UTC`), which is *why* the bug shipped —
  reported as-is.

## What must change in prereg v2

1. **Agent-visible scenario = realistic round-trip, no timezone language.** Never the explicit pin.
2. **Precondition pinned by harness environment** (`TZ` ahead of UTC), identical in both arms.
3. **Held-out grader separate** from the runnable suite (hidden check of the same observable
   behavior). Lever ≠ grader, enforced.
4. **Powered-study additions the re-attack demands (beyond the feasibility pilot):** multiple
   distinct silent-regression bugs / tasks / seeds, ideally >1 model and the 2nd natural surface;
   pre-registered effect size + CIs so a null is distinguishable from underpower; and an explicit
   **prose-hint ablation** — measure how much the visible text reveals, and consider a third
   "read explicit pin, no execution" condition to bound the text channel. (Pilot stays n≈small
   feasibility; these bind the powered design.)

## Net

- The re-attack earned its keep: it caught a fatal conflation before any spend and returned the
  design to the program's own shown/held-out discipline plus a clarifying insight (environment-pin).
- The resolution is verified, not hypothetical.
- **prereg v1 is SUPERSEDED**; v2 must encode the three-way role split above before it can be
  ratified. No spend against v1.
