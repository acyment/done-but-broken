You reviewed R0 of the E4 "Drift Velocity" Phase-2 plan and returned findings B-1, B-2, S-1 through
S-8, and C-1 through C-4. I applied fixes in response to all of them (tagged `[R1-…]` in the doc).

This is a **reconciliation pass, not a fresh review.** Do not re-review the whole plan and do not
open new lines of attack — that's a separate reviewer's job. For **each of your own findings** below,
do exactly two things:

1. **Faithful?** Confirm the fix addresses what you actually meant — or say precisely how it misses,
   dodges, or under-delivers your point.
2. **New problem?** Flag any way the fix **introduced a new defect, relocated the original one, or
   created a by-construction artifact.** This is the higher-value half — you are best placed to see
   whether the cure is worse than the disease on the findings you raised.

Here is what changed, per finding:

**B-1 (executor conflates agent-broken servers with infra).** A server that fails to become ready
*because of agent/workspace code* is now scored as a task failure (`oracle.cumulative_pass = 0`;
sequence continues; feeds the floor rule; stays in agent-behavior accounting). `executor_error` is
reserved strictly for harness/infrastructure faults (port-bind failure, executor crash, transport
fault) → aborts + excluded from taxes. Pinned in M3 scope and §3.2.

**B-2 (velocity is a stock, not a flow).** Velocity redefined as a **flow**: count of distinct
`item_id`s **first observed** as a discrepancy, summed over `drift_opportunity` tasks ÷ count of
`drift_opportunity` tasks — *not* the sum of the meter's whole-surface per-task counts. The terminal
whole-surface count is reported separately as "drift burden at T_N." §3.1, §5; the M0 result-schema
stub pins the definition.

**S-1 (floor rule).** (i) Smoke prong made symmetric with the oracle prong — now requires **two
consecutive** readiness failures within `task_index ≤ 3`, not a single blip. (ii) Rule is evaluated
**per arm**: H4 is blocked if *either* leg's arm collapses — Arm 0 (decline leg) or Arm H (flat leg,
e.g. a gate-overhead budget spiral). (iii) Stated that pilot-H4 is a **slope-difference statement
only**; the mediation chain is deferred to the full-run pre-registration. §3.2.

**S-2 / S-4 (sealed text surfaces + affirmation handshake).** Added a `protocol_text` block to the
sealed constants: block-grammar/turn-protocol id, Arm-M standing instruction, Arm-H gate protocol
**including the behavior-preserving affirmation handshake verbatim**, and the noticing-probe prompt.
Affirmation condition (iv) ("agent invoked the smoke command") is kept but **must appear in the sealed
Arm-H protocol text** so agents don't stall hunting for the spec-phase exit (which would inflate the
freshness tax as a fake H5 penalty). §3.3, §4.

**S-3 (budgets frozen against a fake agent).** Inserted a **required, spend-gated M6.5** budget
micro-calibration (1 arm × 1 seed × ≤3 tasks, `classification: calibration`, non-evidence) before the
budgets freeze. Non-budget constants freeze at M6; budgets freeze at M6.5. (Operator made it
mandatory: sequence is M6 → M6.5 → M7.) M6/M6.5, §4.

**S-5 (H5 taxes incommensurable).** Both taxes pinned to **tokens per oracle-passing task**.
Freshness tax = (Arm-H spec-phase tokens + gate-executor tokens) ÷ (Arm-H oracle-passing tasks).
Drift tax = (Arm-0 total tokens ÷ Arm-0 passing tasks) − (Arm-H implementation-phase tokens ÷ Arm-H
passing tasks). §3.1.

**S-6 (registry-bypass never exercised live before pilot).** Added a **third** scripted fake-agent
behavior at M6 that serves a ground-truth route via directly-wired code absent from the registry, and
asserts the live executor→meter `registry_bypass` classification end-to-end before the pilot. Also
pinned the `E4ExecutorEvidence` type in the M0 type set (not invented at M2). M6, M0.

**S-7 (go/no-go (c) ambiguous / true-by-construction).** Each disjunct of (c) made individually
falsifiable. The false-confidence comparison is pinned to **propensity** — Arm-0/M `done ∧
oracle-fail` rate vs Arm-H `refused_done_over_red` per task, treated as the *same* event family
(ADR-003's `enforcement_outcome: accepted|refused`) — **not** terminal accepted-event counts (which
would make Arm H ≈ 0 by construction). (c1)'s drift-velocity comparison is labeled a heuristic screen
at n=2, no interval claims. §5.

**S-8 (go/no-go (a) gates on headline quality).** (a) relaxed to **any-class** Arm-0 velocity > 0 on
≥1 seed (coverage-gap-only drift counts as real drift). Class composition is recorded as a mandatory
**diagnostic** feeding full-run `op_mix` and comms — not a gate. §5.

**C-1** H2 "≈ 0" is descriptive at pilot; equivalence band deferred to full-run pre-registration.
**C-2** H3 reported as an ordered pair (spec-freshness, code-conformance); single-number reduction
deferred. **C-3** noticing-probe usage classified as a separate arm-uniform line, excluded from taxes.
**C-4** meter-before-executor ordering confirmed sound given S-6 + the M0 type-pin.

---

**A few of these I already suspect may have traded one problem for another — adjudicate them
explicitly:**

- **B-2:** is "first observed `item_id`" well-defined under the substrate's **rename** ops (a rename
  changes the id — new incidence or same drift relabeled)? And drift that appears → is fixed →
  reappears: one incidence or two?
- **S-1:** combined with "any single sequence of 2 seeds blocks," does per-arm blocking make H4
  **almost always blocked** at pilot scale — i.e. un-evaluable by construction?
- **S-5:** Arm 0 and Arm H pass **different sets** of tasks; is subtracting per-passing-task averages
  across two different success sets a valid baseline or a selection-effect artifact?
- **S-3:** calibrating budgets on **one arm × ≤3 tasks** — does it generalize to Arm H (extra spec
  phase + gate) and to the **late-sequence** budget pressure H4 is about?

**Output:** for each finding a one-word verdict — `faithful` / `partial` / `missed` /
`fix-introduced-new-problem` — plus one line of reasoning. Then a short ranked list of only those
where you'd want a further change before the plan proceeds. If your findings were all faithfully
resolved and the four suspicions above check out clean, say so in one line.
