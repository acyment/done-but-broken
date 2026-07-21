# Blind-author probe — results v1 (scored against the frozen rule)

Scored against `BLIND-AUTHOR-PROBE-PREREG-v1.md` (frozen before any output was read). 4 blind
authors, 2 per substrate, models fable + opus, fresh context, no web access, feature contract only
(no bug/fix/precondition hint). Full verbatim outputs in `blind-author-raw/`. Zero external spend
(subagent tokens only).

## Scores

| Author | Substrate | Model | Score | Basis |
|---|---|---|---|---|
| A | Immich birthDate | fable | **GESTURE (1)** | Scenario 2 asserts the date round-trips "no timezone shift to 1948-03-16 or -18"; note explicitly cites "timezone-aware storage refactors routinely shift it off by one day." Names the exact failure — but no scenario controls/varies the server timezone; the assertion is under a single (default) TZ. |
| B | Immich birthDate | opus | **GESTURE (1, weak)** | Note calls the future-date boundary "timezone-fragile"; scenario 14 rejects a datetime (date-vs-datetime theme). No scenario pins a non-UTC-ahead server clock. |
| A | pandas idxmax | fable | **GESTURE (1, strong)** | Scenario 10 uses large unsigned ints `2**63+5`, `2**64-1` ("must not wrap negative through a silent signed cast"); scenario 9 tests nullable-Int64 + NA. Both axes present — but never crossed (large-uint scenario has no NA; NA scenario has small values). |
| B | pandas idxmax | opus | **GESTURE (1, weak)** | Unsigned tested only at uint8 [0,255,128]; extreme-width only at signed int64 (±2^63); NA handling small-valued. No large-unsigned + NA. |

**Tally: 0 PIN / 4 GESTURE / 0 MISS.**

## The load-bearing finding: every suite passes on the broken code

Checked each suite against the actual trap:

- **Immich (both):** the bug fires only when the server clock is ahead of UTC; neither author's
  round-trip scenario pins a non-UTC-ahead TZ, so run under the default/UTC environment **both
  suites pass on the buggy `toISOString().split('T')[0]` code.** Author A's suite passes *despite the
  author explicitly naming the one-day shift as the thing to protect* — awareness of the theme did
  not translate into a scenario that instantiates the precondition.
- **pandas (both):** the bug fires only for nullable UInt64 + NA + values above ~2^53 (the NA
  sentinel-fill promotes to float64). Author A tests large uint64 **without** NA (wrong code path,
  no fill) and NA **with** small values (no precision loss); Author B never reaches large unsigned
  values at all. **Both suites pass on the buggy code.**

So the honest result is stronger than the score table alone: **0 of 4 suites would have caught the
regression as written**, even though 4 of 4 gestured at the right theme. This is not a fluke of
weak authors — the models were frontier-tier, high-effort, and visibly thorough (15–20 scenarios
each, covering ties, nulls, empties, leap days, dtype boundaries). They simply did not instantiate
the exact precondition.

## This mirrors reality exactly

Immich's own developers, fixing this bug deliberately, added a regression test that **also** misses
under the project's UTC-pinned CI (`IMMICH-VERIFICATION-RESULTS-v1.md`). The probe reproduces, in
blind authors, the same miss the real maintainers made. The precondition-pinning failure is not a
quirk of one team; it is the default behavior of competent engineers writing acceptance tests for a
feature before a bug has taught them where the edge is.

## Interpretation (per the frozen pre-registration)

The pre-registered "both-MISS" interpretation applies in its stronger GESTURE form: silent traps
genuinely evade competent blind authors, so **the establishing scenario cannot be assumed to arise
from blind authoring** — it must be a deliberately precondition-pinned baseline artifact if the
episode is to contain a check the trap can trip. This does not sink the study, but it forces a
design decision (below) and it sharpens the honest claim.

**What it means the study can and cannot claim:**
- CAN: "executable accumulated acceptance suites catch silent regressions that reading the same
  suite does not" — *provided the suite contains a precondition-pinned check.*
- CANNOT (without more): "teams practicing executable acceptance testing would naturally have such
  a check." The probe says they usually would not. The check tends to exist only after a bug
  teaches the precondition — which is precisely why these bugs shipped.

## The design decision this forces (for the episode design note)

The establishing scenario in each episode must be **deliberately authored with the precondition
pinned** (Immich: acceptance suite runs under a non-UTC-ahead TZ; pandas: a scenario with nullable
UInt64 + NA + values > 2^53). Two honest ways to justify supplying it, to be chosen and
pre-registered before any run:

1. **Post-hoc-baseline framing:** treat the precondition-pinned check as part of the *mature*
   accumulated suite — i.e. the team already learned this edge on an earlier occurrence — and state
   plainly that the study measures the value of *running vs reading an existing good suite*, not the
   value of *authoring* one. (Cleanest; matches the design note's D5 "we pay authoring off-stage in
   both arms" stance.)
2. **Two-condition-on-the-suite framing:** run the episode both with a precondition-pinned suite
   and with a realistic blind-authored (unpinned) suite, and report both — the second is expected
   to show no arm difference (nothing to catch), which is itself the empirical value of pinning.

Recommendation: framing 1 for the primary study (it isolates the run-vs-read variable, which is the
claim), with the probe result reported as the evidence that pinning is a real, separately-valuable
practice the suite must already embody. Framing 2 is a strong follow-up but doubles cost.

## Net

- The probe did its job: it measured the precondition-pinning rate and got a clean **0/4 pinned,
  0/4 would-catch**, with 4/4 gesturing — a sharp, pre-registered, zero-external-spend result.
- It strengthens the thesis's realism (silent traps evade even careful authors) while narrowing the
  claim (the suite must already contain the pinned check; blind authoring won't supply it).
- Both verified substrates (pandas, Immich) survive — the episode simply must ship the
  precondition-pinned establishing scenario as a baseline artifact, now a documented, pre-registered
  requirement rather than an assumption.
- This is the last free measurement before a paid pilot. The design decision above should be
  settled and pre-registered before any spend.
