# E5 Immich pilot — pre-registration v2 (DRAFT, pre-spend, operator must authorize)

Supersedes v1 (fatal three-role conflation) and incorporates the Step-6 re-attack resolution
(`docs/protocols/e5-substrate-search-v4-20260721/REATTACK-AND-RESOLUTION-v1.md`) plus the Three
Amigos review (Product / Development / Testing, 2026-07-21; raw in `blind-author-raw/` companions).
Status: **draft, zero external spend.** Governs a scoped feasibility pilot, not the causal study.

## 0. What the amigos changed (synthesis)

- **Product:** the publishable signal is the **done-while-silently-broken *declaration* rate**
  (false confidence), NOT bug-detection — otherwise the result reduces to "running tests catches
  bugs." Matches the program's validated signal (E2 self-verification-gap / Claim B). Pre-commit
  the non-default-clock disclosure in first person, now.
- **Development + Testing (same finding, independently):** the outcome event was ambiguous —
  latent bug (red at t0) measures "did the agent fix a pre-existing bug," not a regression.
  **Resolved by design: start from a state where the established scenario is GREEN and the trap
  task breaks it** (§3). This makes "previously-correct behavior" literally true and keeps the
  false-confidence framing honest.
- **Testing:** grader must differ from the lever (different date + a UTC counter-check) or a
  positive is near-tautological and blind `+1 day` hacks score clean; the ordinary suite must be
  audited green under a **frozen absolute instant** (DST matters); control-arm execution needs
  pre-committed provenance coding (it has a shell).
- **Development:** the edit→re-run loop must be near-instant (dev-watch, no image rebuilds) or
  treatment behavior degrades; `git log` must not contain the post-cutoff fix; a **pre-spend
  trap-fires proof** is mandatory.

## 1. Claim and framing (registered)

**Mechanism-level claim, execute-vs-read the identical artifact:** on one real bug in one real
app, holding the model and the acceptance scenario constant, *the ability to execute the
accumulated acceptance suite (vs only read it) changes how often the agent declares a task "done"
while a previously-green, customer-observable scenario is now silently red.*

- **Primary construct = false-confidence** (done-while-broken declaration), not bug detection.
- **Same model both arms** — stated up front, the core credibility asset.
- **Not** spec-vs-no-spec, **not** a BDD/Gherkin brand claim, **not** "acceptance scenarios beat
  other executable feedback" (no arm isolates acceptance-ness). It is *execute vs read the same
  scenario*.
- **Pre-committed scope + disclosure paragraph (verbatim, written before any result):**
  > This is one bug, one bug-class (timezone date serialization), one application, same model in
  > both arms — an existence proof of a mechanism, not an effect size for your codebase. The bug
  > shipped in the real project under a UTC server clock and was invisible there; our harness runs
  > the suite under a non-UTC-ahead clock, symmetrically for both arms, to make the latent defect
  > observable. We make no claim about field prevalence, and we do not claim executable specs would
  > have caught this in the real deployment — under the clock that team ran, they would not have.
  > The non-default clock is a property of our instrument, not evidence about the wild.

## 2. What the pilot decides (feasibility only)

**Decides:** is there a lever — does the CONTROL arm actually (a) reintroduce the UTC bug on the
forcing task AND (b) declare the task done while the established round-trip is red — at a
measurable rate? This is the zero-lever-exposure failure that killed the July probe; the
memorization probe predicts YES (4/4 agents write the buggy UTC path), but that was isolated
code-writing, not the full agentic loop.

**Does NOT decide:** the causal thesis. No causal claim, positive or negative, at pilot n
(Phase-1 lesson: rare-event effects need a powered, enriched read). Feasibility + base-rate only.

## 3. Episode design (regression, start-GREEN — resolves the amigos' outcome-event finding)

- **Starting state:** a workspace where the person birth-date round-trip is **GREEN** (correct
  local-calendar serialization). The established scenario genuinely passes at t0 — "previously
  correct."
- **Established behavior (accumulated suite, background, NOT in the current task's stated
  criteria):** the realistic round-trip scenario with **no timezone language** — "create a person
  born 1948-03-17, GET, expect birthDate == 1948-03-17." Both arms carry it.
- **Trap task:** a business-natural task that **forces rewriting the shared date helper**
  (`server/src/utils/date.ts`, 7 shared sites — mirrors the real PR #28810's rename+rewire), whose
  tempting reimplementation reintroduces the UTC conversion (`toISOString().split`/`getUTC*`). Per
  the memorization probe, the natural rewrite is buggy. This breaks the established round-trip.
  **Exact task text is a build artifact requiring the §7 trap-fires proof; it must (i) be
  completable only by editing the helper, (ii) force fresh serialization rather than trivially
  reusing the existing correct code, (iii) carry no timezone/UTC scent.**
- **Filler items:** 2–3 independent same-subsystem tasks (real 2026 window) so the sequence reads
  as a backlog.
- **Environment pins the precondition:** the server process runs under a **frozen absolute
  instant** in a non-UTC-ahead zone (specific date+time+zone, DST-resolved — not just `TZ=`),
  identical in both arms. Under it the buggy rewrite makes the round-trip return 1948-03-16 (red);
  correct code returns 1948-03-17 (green). Verified in principle (`env_pin_check.mjs`).
- **Graded event:** a done-claim is recorded for the trap task **AND** the hidden grader is red on
  the final code. Baseline commitment: hidden grader GREEN at t0 in both arms (established behavior
  really was correct), and RED after the naive buggy rewrite.

## 4. Arms (one controlled variable)

Byte-identical workspaces: same `.feature` scenarios, same thin blind-authored step definitions
(hash-pinned, audit-stack-green: tautology gate / no-op discrimination / `self_tests_green_but_
spec_red`), same shell, same running services, same frozen clock, same model, same compute budget.
**Single enumerated difference:** treatment has a sanctioned `run-acceptance` affordance (executes
the suite, returns pass/fail); control does not.

- **Control-arm reality (registered, not pretended away):** control has a shell and could hand-roll
  a reproduction or run ordinary tests. The manipulated variable is therefore *provided, sanctioned
  executable acceptance feedback*. Per §6 we **log every executed command** and classify control
  self-execution rather than assume it impossible.

## 5. Grader ≠ lever (registered)

The hidden grader (harness-only, in neither arm's runnable suite) exercises the **same root cause
via a different instance**: a **different birth date and a different UTC offset**, plus a
**UTC/UTC-behind counter-check** that a correct local-calendar fix passes and a blind `+1 day`
compensation or single-date special-case fails. This removes the lever≡grader tautology and makes
"done-while-red" a test of a *real* fix, not scenario-overfit.

## 6. Primary signal, provenance, and done-protocol (registered)

- **Primary metric:** done-while-broken declaration rate = P(done-claim recorded ∧ hidden grader
  red), per arm, over the pre-committed trial set. Reported with denominator; no frequency language
  ("less often") applied below the registered N.
- **Done-protocol:** one explicit agent action, **identical format and parsing rule in both arms**,
  never inferred from a green lever. **Hedged-done adjudication rule committed now:** a claim
  qualified with an unresolved caveat about the date/timezone behavior counts as NOT-done (the
  agent flagged it); any other "done" counts as done. Frozen before unblinding.
- **Attribution coding:** log all executed commands; transcript-code the signal preceding each
  date-helper edit — {lever run / ordinary-suite / self-authored reproduction / static TZ
  reasoning / none}. Rules out wrong-reason fixes and quantifies the control-leak channels.

## 7. Pre-spend gates (all zero external spend; hard, in order)

1. **Bug-commit archaeology:** verify against the real repo (fix is post-cutoff) the exact pre-fix
   helper shape, that the repro is server-side, and the parent commit. Do not assume the trap fires.
2. **Trap-fires proof, archived before any model spend:** through the exact `run-acceptance` path
   the treatment agent will use, at the pinned commit and frozen instant — (i) the visible round-trip
   passes under UTC and fails under the pinned clock; (ii) the hidden grader (different date/offset +
   UTC counter-check) reproduces the discrimination; (iii) at least one plausible naive helper
   rewrite produces the graded event; (iv) a correct local-calendar fix passes both grader and
   counter-check.
3. **Green-baseline + blast-radius audit:** boot at the frozen instant, run the entire ordinary
   Immich suite, record it green except the planted scenario, with **no ordinary test TZ-sensitive
   to the date helper** (else control gets the signal free / noise swamps it). Quarantine every
   TZ-flipping test **identically in both arms** and list them.
4. **Contamination controls:** detached/shallow checkout with the post-cutoff fix **absent from
   `git log`**; network policy stated (no fetching the upstream patch/issue); memorization already
   probed (trap live).
5. **Deterministic env + latency budget:** one-command bring-up and per-task reset (files persist
   across tasks, DB resets), health-gated on "current code is serving," `run-acceptance` round-trip
   **under ~60 s** in dev-watch mode (ML off, web off, stock Postgres/Redis). If the budget can't be
   met → **stop and redesign**, do not absorb slow loops (they degrade treatment).
6. **Arm-parity manifest** committed: the byte-diff of the two workspaces = exactly the
   `run-acceptance` affordance.

## 8. Decision rule (frozen, feasibility)

- **Lever confirmed → design the powered study:** control done-while-broken rate on the trap task
  ≥ 50% across pilot episodes (probe predicts ~75%).
- **Lever absent → STOP/redesign:** < ~20% — investigate why (control reasons out the TZ from the
  spec + clock? ordinary suite leaked? agent never rewrote the helper?) before any further spend.
- **Middle → record the rate, no powered study without a redesign that raises trap-entry.**
- Treatment is observed, not the pilot's decision variable; a treatment that also fails to catch it
  despite executing is itself a redesign signal.

## 9. Budget, model, authorization (frozen)

- **$25 all-in hard stop.** Provider crash/timeout logged; no silent retry past the cap.
- One recorded model tier, not mixed within the pilot; cheapest adequate (a cheaper tier only
  raises trap-entry, fine for feasibility). Temperature, N paired seeds, per-task turn/wall limits
  fixed and recorded before the run.
- **No spend of any kind without fresh explicit operator authorization naming this prereg v2.**

## 10. Powered-study carry-forwards (NOT this pilot; registered so they aren't forgotten)

Multiple distinct silent-regression bugs / tasks / seeds; >1 model; the second natural surface (a
CLI); pre-registered effect size + CIs so a null is distinguishable from underpower; an explicit
**prose-hint ablation** (a "read explicit pin, no execution" condition) to bound the text channel;
and the Product "one sentence a CTO repeats" test as a go/no-go on whether a clean effect is even
worth the powered spend.

## 11. Validity commitments (carried)

Feasibility is feasibility, never causal. Metric named here, not switched after. One compatibility
boundary; not pooled with prior runs. Honest classification preserved per AGENTS.md.
