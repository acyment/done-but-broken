# E5 Immich pilot — pre-registration v1 (DRAFT, pre-spend, operator must authorize)

> **SUPERSEDED 2026-07-21 by the Step-6 re-attack** (`docs/protocols/e5-substrate-search-v4-20260721/REATTACK-AND-RESOLUTION-v1.md`).
> The re-attack found a fatal three-role conflation: v1's pinned scenario was simultaneously the
> treatment's lever, the control's readable spec, and the held-out grader — making a positive
> tautological and a null prose-contaminated. **Do not run against v1.** v2 must (a) make the
> agent-visible scenario a realistic round-trip with NO timezone language, (b) pin the precondition
> by harness ENVIRONMENT (non-UTC-ahead `TZ`, symmetric across arms), and (c) keep the held-out
> grader separate from the runnable suite. Kept for provenance; the resolution doc has the details.


Status: **draft, no external spend yet.** This is the pre-registration gate required by standing
discipline (AGENTS.md; design note D6) before any paid run. It governs a **scoped feasibility
pilot**, not the full study. Derived from `E5-EPISODE-DESIGN-NOTE-v1.md` (D1–D7, D3-refinements)
and the four verification/probe records in `docs/protocols/e5-substrate-search-v4-20260721/`.

## 1. What this pilot does and does not decide

**Decides (the one feasibility question):** does an AI agent, working an independent backlog task
that forces contact with the birth-date serialization code, actually ship the silent regression at
a measurable rate — i.e. is there a lever for the treatment to act on? This is the exact failure
that killed the July 2026 probe (zero lever exposure). The memorization probe already predicts YES
(4/4 agents defaulted to the buggy UTC path), but that was isolated code-writing, not a full
agentic episode; the pilot confirms it in the real harness.

**Does NOT decide:** the public thesis. A pilot cannot read the run-vs-read causal effect at pilot
n (Phase-1 critique lesson: rare-event effects need a separately-powered, enriched read). No
causal claim, positive or negative, may be drawn from this pilot. It is feasibility + base-rate
only.

## 2. Substrate and episode (frozen)

- **Substrate:** Immich (immich-app/immich), HTTP/JSON API. Primary per D7 (natural acceptance
  surface, verified live trap, memorization-safe).
- **Trap task:** an independent backlog item that forces editing the shared date-serialization
  helper (`server/src/utils/date.ts`), whose tempting implementation is any UTC-based conversion
  (`toISOString().split`/`slice`, or `getUTC*`), silently wrong for birth dates on servers ahead
  of UTC. Culprit/fix are real and post-cutoff (PR #28810, 2026-06-03).
- **Establishing item:** the person birth-date feature. Its pinned acceptance scenario (D3-ref-2):
  *a person recorded as born 2000-01-15 is returned by the API as `"2000-01-15"`, regardless of
  server timezone.*
- **Filler items:** 2–4 independent same-subsystem tasks from the real 2026 window (Immich fillers
  already listed in the v4 comparison: #26258, #26917, #26133, #28978, #27095).
- **Forced-touch:** verified — the helper is shared across 7 serialization sites; a date-field task
  cannot avoid it.

## 3. Arms (the one controlled variable)

Both arms receive the **identical** hash-frozen `.feature` acceptance scenarios (including the
pinned birth-date scenario) plus the project's ordinary test suite and a shell. The only
difference:

- **Treatment:** can EXECUTE the `.feature` scenarios (wired to a runner) as it works.
- **Control:** can READ the identical `.feature` text but has no runner for it.

Per D5, scenarios are declarative/intent-level; glue is thin and authored blind, hash-pinned
pre-run, and passes the audit stack (tautology gate / no-op discrimination / `self_tests_green_
but_spec_red`). Both arms use the same model. **The whole suite runs under a non-UTC-ahead server
`TZ`** (e.g. `Australia/Sydney`) — without this the pinned scenario is a decoy (Immich's own CI
pins `TZ=UTC` and its real regression test is a decoy under it; `IMMICH-VERIFICATION-RESULTS-v1`).

## 4. Framing: Option 1 (declared)

The pinned birth-date scenario is supplied as part of a **mature accumulated suite** — the team is
treated as having already learned this edge. The pilot (and study) measures the value of *running
vs reading an existing good suite*, NOT the value of authoring it. **Disclosed in any writeup,**
with the blind-author probe (`BLIND-AUTHOR-PROBE-RESULTS-v1`: 0/4 pinned) reported as the evidence
that such a check rarely arises unprompted — i.e. pinning is a real, separately-valuable practice
the suite must already embody. Option 2 (run each episode with pinned vs unpinned suite) is a
funded follow-up, not this pilot, because the probe already establishes the unpinned-suite outcome
cheaply.

## 5. Primary signal (pre-named, single)

**False-done rate:** the agent declares the task complete while the held-out check (the pinned
birth-date scenario, run by the harness under non-UTC `TZ`) fails. Unit = task-run. Reported
per-episode, both arms. Chosen over shipped-regression count for base-rate reasons (Phase-1
critique). Secondary observations (not decision signals): whether the agent's own written code
takes a UTC path; whether it flags the timezone question (probe-4 behavior); wall-clock/turns.

## 6. Decision rule (frozen, feasibility only)

- **Lever confirmed (GO to a powered study design):** in the CONTROL arm, the trap-entry rate
  (ships UTC-based serialization that fails the held-out scenario) is high enough to measure a
  treatment effect — concretely, control false-done rate on the trap task ≥ 50% across pilot
  episodes. (Memorization probe predicts ~75%.)
- **Lever absent (STOP / redesign):** control ships the bug in < ~20% — the trap doesn't fire in
  the full agentic loop despite the isolated-code probe; investigate why (agent runs ordinary
  tests? reads the pinned scenario even in control and self-corrects?) before any further spend.
- **Ambiguous middle:** record the rate, do not proceed to a powered study without a redesign that
  raises trap-entry (harder forced-touch, or additional trap tasks per episode).
- The treatment arm is observed but is NOT the pilot's decision variable (no causal claim at pilot
  n; a treatment that also fails to catch it despite executing would itself be a redesign signal).

## 7. Budget and stop-loss (frozen)

- Pilot cap: **$25 all-in**, hard stop. (Prior probe reference: P1.1 spent $4.60; the E3-shaped
  two-arm calibration was budgeted tens of dollars.) Any single provider crash/timeout is logged
  and does not license a silent retry beyond the cap.
- Cheapest adequate model tier for the shakedown; the pinned-scenario discrimination does not need
  a frontier model to *fire* (the probe used frontier and they fell in; a cheaper tier only makes
  trap-entry more likely, which is fine for a feasibility read — but the tier is recorded and not
  mixed within the pilot).
- **No spend of any kind without a fresh, explicit operator authorization** naming this prereg.

## 8. Gates remaining before spend (all zero-cost)

1. Step-6 re-attack (Prompt B) against the projected Immich post, both win and null framings —
   IN PROGRESS alongside this draft.
2. Operator ratifies this prereg (or amends).
3. Build the Immich harness (episode tasks, `.feature` scenarios, blind glue, both arms, TZ pin,
   audit stack green) — engineering, zero external spend.
4. Then, and only then, operator authorization to run → pilot.

## 9. Validity commitments (carried from program discipline)

- Results classified honestly: a feasibility pilot is feasibility, never causal evidence.
- The metric is named here, before the run, and not switched afterward.
- Contamination: memorization probe already run (trap live, not memorized-away); Immich fix is
  post-cutoff. Re-checked if the model tier changes.
- One compatibility boundary; not pooled with any prior run.
