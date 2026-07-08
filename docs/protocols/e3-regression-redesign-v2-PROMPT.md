# Prompt for next session (paste verbatim, then delete this file)

Draft the E3 regression-story redesign doc. DESIGN ONLY — no runs, no model spend, no
authorization implied by the doc or this prompt.

## Read first (in this order; don't re-derive what they record)

1. `docs/protocols/e3-brownfield-regression-after-several-changes-design-v1.md` — parent design
2. `docs/protocols/e3-brownfield-regression-design-addendum-a-v1.md` — P2P sentinels + overlap episodes
3. `docs/protocols/e2-fallback-claims-regression-and-tautology-v1.md` — Claim A/B framing
4. `docs/protocols/e2-claim-b-b0-b1-results-v1.md` — B0/B1 results + operator standard
5. `BACKLOG.md` — "Direction Update - 2026-07-05" entries

Live harness: `/Users/acyment/dev/hit-sdd-bench-e2` — `src/hit_sdd_e2/e3/*`,
`scripts/find_overlap_episodes.py`, `scripts/validate_p2p_sentinels.py`,
`runs/e3-episodes/*` (2 certified overlap episodes), `runs/claim-b/*`.
Memory `e3-harness-build-status` has the full state.

## Facts to take as given (2026-07-05)

- E3 calibration on certified episodes: honest null (0 true regressions; gold-prior-steps
  probe proved the scorer correct and the episodes structurally regression-resistant).
- Overlap-prone reselection: only 2 genuine same-base-commit pairs in all of SWE-bench Live
  (pvlib-clearsky, conan-conf) — BOTH certified.
- P2P sentinel instrument built + fires-validated: base 1144/1150 live, gold preserves all
  (0 false fires), sabotage on shared file trips 1144/1144. File-granularity runs (stale
  node ids abort pytest wholesale).
- Claim B closed-null: 0 tautology events in 72 measured rollouts; agent self-tests were
  near-perfectly calibrated; the live failure is DONE-CLAIMS over red/absent self-evidence
  (flash 0/10 correct done-claims, 5 red-backed; V4 Pro 17/20 with all 3 misses red-backed;
  qwen 10/10, obeyed red verdicts 6/7).
- Operator standard: only results that encompass strong models count as useful.

## The four redesign axes (session-ending analysis, operator agreed redesign is needed)

1. **Episode source.** Same-base-commit stacking is exhausted and wrong-shaped. Redesign
   around CHAINED sequential changes (each change applies to the prior state, not the frozen
   base) — opens every repo with consecutive merged PRs; requires new certification design
   (per-state environments, or env-stable windows).
2. **Sequence length + budget.** Claim A is about accumulation; k=4–8 ordered changes with
   bounded per-change budgets, else the ~3% per-change base rate
   (`path-survival-discrimination-power`) never compounds into a measurable signal.
3. **LOAD-BEARING — the causal contrast.** The P2P suite is public (it lives in the repo),
   so a treatment tool that runs it conveys no hidden information; the contrast silently
   becomes ENFORCEMENT (harness refuses done while the suite is red), not information
   access. B1's done-claim finding is direct frontier evidence FOR the enforcement claim.
   Options: (i) enforcement contrast primary; (ii) hidden accumulated acceptance bundles
   (information contrast — but regression feedback only exists on steps the agent solved);
   (iii) both as separate predeclared questions. Session recommendation to adopt unless you
   find an argument against: (i) primary, (ii) secondary.
4. **Blame attribution.** Metrics/analysis must separate "sloppy single change" (E1/E2
   already measure it) from sequence-driven breakage of earlier work.

## Deliverable

`docs/protocols/e3-regression-redesign-v2.md`, same discipline as the parent design:

- Status: DESIGN DRAFT — not authorized, not run, not sealed. New compatibility boundary;
  no pooling with E1/E2/Stage-0/pricing/etc.
- Carry over the regression definitions (true_regression / unresolved_carryforward /
  retained) and the P2P sentinel instrument unchanged.
- Explicit treatment-contrast decision (+rationale) per axis 3.
- Episode-construction spec for chains, including certification gates adapted to chained
  states, and the pool-widening ladder (same-module overlap → k>2 chains → merged-PR chains
  outside SWE-bench Live).
- k / budget spec per axis 2.
- Metrics + blame attribution per axis 4; calibration reports incidence/burden/retained
  only.
- Predeclared gates incl. a re-armed control-only calibration gate and explicit kill
  conditions; prediction template to be filled BEFORE any run.
- Staged plan, cheapest first — the 2 certified overlap episodes are usable as smoke tests
  of any new pipeline before building chain machinery.
- Cost envelope, honest limits, and exactly what each stage licenses publicly.
- Frontier models only (deepseek = V4 Pro, qwen = 3.7 Max; routes in
  `hit-sdd-bench-e2/src/hit_sdd_e2/_cli/routes.py`; keys in `hit-sdd-bench/.env`).

After drafting: add a dated BACKLOG pointer and a memory-index line. Do NOT execute
anything — no Docker, no model calls, no scans — the deliverable is the doc.
