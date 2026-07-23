# Stage-1 prereg DRAFT brief v1 — paste-ready for a fresh session

Prepared 2026-07-23 after the fork-vs-plug verdict (`docs/e5/E5-FORKPLUG-VERDICT-v1.md`,
commit `0afe419`). Session params: fresh context; **Fable, high effort** main loop;
Explore subagents for repo cross-reference sweeps; **no codex** (quota; nothing here
needs a second model). Zero spend; no runs; no clones needed (all inputs are in-repo).

---

## Paste below this line

Draft the Stage-1 pre-registration for the regression-accumulation continuation study.
**DRAFT, not freeze** — per AGENTS.md, the freeze happens only after the Step-6 re-attack
and a Three Amigos review of this draft, and every run rung (including the pilot) needs
separate explicit operator authorization. Zero model spend: reads and writing only. Do
not start the fork build; do not touch the corpus; do not re-litigate decided items.

### Read first (in order)

1. `CLAUDE.md` + `AGENTS.md` — binding. Pay specific attention to: the exposure
   precondition (pre-spend base-rate + floor + abort), the discriminating-check
   precondition, the visible-vs-hidden-gap headline rule, replay-validity, and the
   OpenSpec scoping (shared environment only, profile `e1-openspec-workflow-v0`, never a
   condition or arm).
2. `docs/e5/adversarial-1/SYNTHESIS-v1.md` — §6 deltas D1-D10 are ACCEPTED design
   inputs; §2 findings give each delta's rationale; §4 lists the hostile comments the
   prereg must answer. D10 is DECIDED: on-demand runner in arm T plus guaranteed
   completion-time run; post-hoc-gate-only rejected.
3. `docs/e5/E5-FORKPLUG-VERDICT-v1.md` — the substrate decision (FORK slop-code-bench,
   pins `13de1a7a` / problems `ef6a9dd1`), §1 resolved standing questions, §2 evidence
   table, §4 determinism probe (one flaky golden test found — flake policy is
   demonstrated necessity), §5 build list, §6 ToS posture.
4. `docs/e5/E5-REGRESSION-ACCUMULATION-CONTINUATION-DESIGN-v1.md` — the design under
   prereg, esp. §1 (verified parent-paper facts), §3 (arms, as amended by §8), §6a
   (frontier gap map), §8 (accepted deltas summary).
5. `docs/methodology/THREE-AMIGOS-DESIGN-REVIEW-v1.md` — the gates this draft feeds.

### Deliverable

`docs/e5/E5-STAGE1-PREREG-DRAFT-v1.md`, with every required number either STATED (with
its source named) or listed as a NAMED OPERATOR INPUT with a recommended default — no
silent blanks. Required sections:

1. **Claim + estimand.** ITT: "provided executable acceptance scenarios vs frontier-agent
   initiative" (D3); framing "conceptual extension with adopted design elements" (D8),
   delta table vs parent 2607.01855, parent effect sizes as directional priors only;
   claim-safe public phrasing per the framing standard.
2. **Environment + profile.** Fork pins; profile `e1-openspec-workflow-v0` declared as
   shared task-environment property (both arms same OpenSpec workspace, identical
   archive step); arm C = structural absence of execution infrastructure, "no maintained
   executable acceptance artifact supplied" (D4); arm T = identical workspace + visible
   executable suite + on-demand runner + guaranteed completion-time run (D10), feedback
   content minimized (scenario ID + pass/fail + minimal diff).
3. **Hidden referee (D1).** Primary on treatment-hidden surface only: harness checkpoint
   pytest suites + authored held-out probes; pre-registered scenario→referee coverage
   map; covered/uncovered split reported as headline (AGENTS.md rule); visible suite
   demoted to manipulation check; binding/referee code separation sealed by hash
   (author/time separation, no-shared-imports audit).
4. **Gate/revise protocol (D2/F3).** Matched revise turn both arms (C: spec-review
   ritual; T: same + authoritative results); no harness keep-best; C-final vs T-final
   primary; every attempt snapshotted and referee-graded → deterrence/feedback/selection
   decomposition as secondary curves; ported gate policy as secondary continuity
   analysis only; TDAD-trap caveat pre-registered (this contrast is executable-vs-prose
   under identical ritual, not vs nothing).
5. **Event definitions (D6).** Regression-eligible only after first pass in-run;
   passed-at-j-fails-at-k transitions; scenario lifecycle metadata
   (active-from/retired-at/modified-by); non-runnable-artifact rule; refactoring
   scoping sentence (F15: backward compatibility is the explicit contract).
6. **Metrics (D9/D3).** One pre-specified scalar primary; composite guard
   (P(new passes), P(no regression), P(both)) with the pre-declared claim rule
   (hidden-surface improvement required; both agents directionally beneficial; ≤10pp
   new-requirement loss); mechanization rate m from trajectories; token/wall-clock and
   per-checkpoint/per-dollar accounting (H6).
7. **Flake policy (D7 + verdict §4).** Golden 3× flake-screen per chain BEFORE pool
   freeze (probe caught 1 flaky test in 3 chains screened; pwd_manager
   `test_edit_name_then_delete_secret`); choose and justify screen-then-fail-any vs
   majority-vote 2/3 for regression events; `test_collection_hash` equality asserts;
   warmed uv cache volume (network-flake channel).
8. **Corpus + pool.** 36 chains / 196 checkpoints (counted, verdict §2 item 7); QC
   exclusions pending for the 5 disclosed bad-golden chains; discriminating-check
   precondition per checkpoint (each suite fails on golden-of-previous-checkpoint or
   empty submission — define the no-op baseline precisely); memorization posture
   (canary GUIDs present; probe-first discipline still applies — say what, if anything,
   must run before spend); pilot and confirmatory pools separated; fable's authoring
   provision recorded for N shortfalls (provenance tagged as covariate).
9. **Exposure precondition (AGENTS.md).** Event = accumulated-surface regression in
   control; base-rate source = published SlopCodeBench v2 strict-checkpoint numbers
   (L2-verified: best agent 14.8% strict) as prior + the control-only pilot rung as the
   measured estimate; state the floor and the pre-spend abort explicitly.
10. **Pilot + escalation (D5).** Control-only base-rate rung first (size it); both-arms
    ~4-chain shakedown (excluded from analysis) before confirmatory; finite numeric
    control-conditioned ladder (chatgpt's shape as default); pilot published
    regardless; escalation = new prereg (Stage 1b).
11. **N / power / MDE honesty (D7).** Frozen N with the calculation shown; MDE statement
    (affordable N powers ≥15-25pp only); N formula conditioned on pilot-measured m
    (fable's dilution: effect ≈ Δ·(1−0.7m); m≥0.5 kills the powered design and becomes
    a publishable finding per the null-framing).
12. **Scheduling + runs.** Interleaved randomized arm order; pinned CLI versions
    (claude_code 2.0.51 / codex 0.74.0 or updated pins, stated), pinned model IDs,
    image digest; subscription auth posture per verdict §6 (Claude Max = documented
    path; codex account-auth serialized single-worker with auth.json as secret, OR
    metered API-key slice — operator input); replay-validity per AGENTS.md E4-grade
    rule (full traces, snapshots, artifacts).
13. **Analysis plan.** Mixed model with chain random effects / cluster-robust SEs;
    pre-specified scalar primary; sensitivity analyses (per-protocol, majority-vote
    flake, covered/uncovered); no pooling across incompatible boundaries.
14. **Operator-input table.** Budget cap, roster (which claude models; codex slice run
    count), codex auth mode, pilot size, floor value, N — each with a recommended
    default and the consequence of each option.
15. **Engineering build plan.** Import verdict §5's build list as the prereg's
    engineering appendix; mark which items are validity-critical and therefore TDD-first
    per AGENTS.md (feedback gating, arm parity, snapshot/replay, tamper detection,
    metric calculation, referee isolation).

### Constraints and refusals

- D1-D10 and the fork decision are settled inputs; if drafting exposes a genuine
  contradiction among them, RECORD it as an open issue for the re-attack — do not
  silently resolve it.
- Run-classification vocabulary and the claim ladder are preserved; the draft's claim
  language stays at the pilot/causal-pilot level, never Level 5.
- "Rather than buy a null" and any equivalent wording stay retired.
- The parent's 43.2→12.5 numbers appear only as directional priors.
- Commit the draft; update the program memory (state + next step = re-attack + Three
  Amigos on the draft); STOP there — no review gates in the same session, fresh eyes
  requirement per the methodology doc.
