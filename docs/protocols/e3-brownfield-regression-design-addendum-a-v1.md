# E3 Design Addendum A: overlap-prone episodes + P2P sentinel surface (v1)

**Status**: design addendum to `e3-brownfield-regression-after-several-changes-design-v1.md`.
Written 2026-07-05 after the first control-only calibration ran gate 6 to an honest null.
No run is authorized by this document. Predictions must be committed before the next
calibration run (template in §4).

## 1. What the 2026-07-05 calibration established (evidence, kept)

- **The scorer works.** The gold-prior-steps probe (gold step-1 patch applied, agent runs
  step 2) showed step-1 oracles passing and correctly labeled `retained` after step 2 —
  the true-regression / carryforward / retained separation is implemented correctly
  (`runs/e3-calibration/e3-gold-probe-20260705-140802.json`).
- **Gate 6 fired a stop, for a structural reason.** 0 true regressions across all rollouts
  (DeepSeek V4 Pro, correct frontier route). Two causes, both selection artifacts:
  (a) the certified episodes had non-overlapping gold files — the very property that made
  them easy to certify makes cross-step breakage implausible; (b) the F2P-bundle-only
  sentinel requires the agent to SOLVE step 1 before step 2 can regress it, and step-1
  solve rates were too low.

## 2. Change 1 — overlap-prone episode selection

New selector (implemented, `scripts/find_overlap_episodes.py`): same (repo, base_commit),
**≥1 shared non-test implementation file between the two gold patches** (docs/changelog
files excluded), **zero shared F2P tests** (step-1's oracle stays a valid sentinel, not
re-specified by step 2), ordered by created_at; the standard per-instance floors (F2P ≥ 1,
P2P ≥ 5, post-cutoff) unchanged. Certification gates unchanged and remain the arbiter —
overlapping gold patches can physically conflict when stacked; that is exactly what the
cumulative gate checks.

Scan result over SWE-bench Live (1000 instances): **2 genuine pairs.**
`pvlib-clearsky-overlap` (pvlib 2055→2217, shared `pvlib/clearsky.py`) — CERTIFIED
2026-07-05, all gates ok. `conan-conf-overlap` (conan 17514→17520, shared
`conan/internal/model/conf.py`) — certification pending.

The pool is thin by construction. If it proves insufficient, the predeclared widening
levers are, in order: (i) same-module/package overlap instead of same-file; (ii) k>2 step
chains from repos with many post-cutoff issues; (iii) consecutive merged-PR chains outside
SWE-bench Live (new environment class, new validity review).

## 3. Change 2 — P2P sentinel surface (the Claim A oracle, decisive)

The parent design measures regressions only on prior F2P bundles `O_j`. This addendum adds
the **step-1 instance's PASS_TO_PASS suite** (flake-quarantined, gold-fail-excluded) as
sentinel checks with the same state machine: a P2P sentinel that passed after step `i-1`
and fails after step `i` is a `true_regression`; failing at both is carryforward.

Why this is the decisive fix: P2P tests pass at base **by construction** — the agent does
not need to solve anything for them to be live sentinels. This removes the step-1-solvability
dependency that produced the null, and it is the honest version of the claim (fallback doc,
Claim A): the tripwire is the repo's own previously-working behavior, hundreds-to-thousands
of checks, not a handful of issue tests. E1's finding (~3% per-single-change base rate,
`path-survival-discrimination-power`) is the prior AGAINST this firing; overlap-prone
selection is the lever that is supposed to beat that prior. If it does not, Claim A dies
cheaply and honestly here, per the parent design's gate 6.

Scoring implementation (BUILT + VALIDATED 2026-07-05): sentinels run at FILE granularity in
a second pytest invocation inside the same scoring container — PASS_TO_PASS node ids can be
stale at the episode commit (observed: parametrizations missing at base), and a single
"not found" node id aborts an entire pytest invocation, silently zeroing the surface.
File-level runs cannot abort that way; only the sentinel ids are parsed from the merged
report. Quarantine = sentinels not PASSED at clean base (computed once per rollout).
Fires-validation (`scripts/validate_p2p_sentinels.py`, pvlib-clearsky episode):
base 1144/1150 live; gold step 1 preserves 1144/1144 (zero false fires); a module-level
raise appended to the shared file `pvlib/clearsky.py` trips **1144/1144 true regressions**.
(First validation attempt was a lesson kept for the record: a raise inserted after line 1
landed inside the module docstring — inert; sabotage must be genuinely module-level.)

## 4. Predictions (commit before the next calibration run — template)

- P(≥1 true P2P regression per control episode), pvlib-clearsky, frontier model: ____
- Same for conan-conf: ____
- Expected regression burden (sentinels newly broken per firing step): ____
- Prediction that F2P-bundle regressions stay 0 (they require step-1 solves): ____

## 5. Unchanged

Everything else in the parent design stands: regression definitions, metrics (calibration
reports incidence/burden/retained-curve only), the arms for a later causal pilot, gates 1–7
(gate 6 re-armed for the overlap episodes), no pooling with prior boundaries, and the
standing rule that any model-spend run needs explicit operator authorization.
