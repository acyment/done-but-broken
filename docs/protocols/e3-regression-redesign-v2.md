# E3 Regression Redesign v2: chained changes, enforcement contrast, blame attribution

Status: **DESIGN DRAFT - not authorized, not run, not sealed.** No provider, Docker, or model run
fires from this document. Date: 2026-07-05.

This is a new compatibility boundary (`e3-v2`). It is never pooled with E1, the E2
acceptance-feedback pilots, the E2 authored-spec/offline-pilot line, the Stage-0 executable-spec
probe, the Claim B B0/B1 mechanism probe, any pricing/subscription/inventory task, or the e3-v1
calibration artifacts. All of those are carried as prior evidence only. Parent documents:
`e3-brownfield-regression-after-several-changes-design-v1.md` (parent design),
`e3-brownfield-regression-design-addendum-a-v1.md` (Addendum A: overlap episodes + P2P sentinels),
`e2-fallback-claims-regression-and-tautology-v1.md` (Claim A framing),
`e2-claim-b-b0-b1-results-v1.md` (B0/B1 results + operator standard).

## 1. Why a redesign

The parent design and Addendum A were executed honestly and hit two walls in one day (2026-07-05):

1. **The episode source is exhausted.** Same-base-commit stacking — two SWE-bench Live instances
   sharing one `(repo, base_commit)` — yields exactly **2 genuine overlap pairs in all 1000
   instances** (`pvlib-clearsky-overlap`, `conan-conf-overlap`, both certified). The construction
   is also wrong-shaped for Claim A: real iterative work applies each change to the *prior state*,
   not to a frozen base. A pool of 2 cannot power anything and cannot widen.
2. **The calibration gate closed-null for a structural reason.** 0 true regressions across all
   control rollouts (DeepSeek V4 Pro, correct frontier route). The gold-prior-steps probe proved
   the scorer correct; the certified episodes were simply regression-resistant by construction
   (non-overlapping gold files; F2P-only sentinels requiring step-1 solves). Addendum A's P2P
   sentinel surface fixed the solvability dependence, but the episode pool remained the binding
   constraint.

Meanwhile the Claim B probe (mechanism_probe, 72 measured rollouts, predictions pre-committed)
closed the tautology frame null — **0 agent-written tests ever wrongly passed failing code** — and
surfaced the live frontier failure: **done-claims made over red or absent self-evidence** (V4 Pro:
3 wrong done-claims, all red-backed; qwen 3.7 Max: withheld done on 6 of 7 red verdicts; flash:
0/10 done-claims correct, 5 red-backed — cheap-tier-only, not usable under the operator standard).
That finding directly informs the causal contrast chosen in §3.

Operator standard (2026-07-05, binding on this design): **only results that encompass strong
models count as useful.** All evidence stages in this document are frontier-only.

## 2. Carried over unchanged

- **Regression state machine.** `true_regression_{j,i}` (obligation j passed after step i-1,
  fails after step i), `unresolved_carryforward_{j,i}` (failing at both), `retained_{j,i}`
  (passing at both). Primary measurement counts true regressions only; a run that never solved
  change j cannot later "regress" j.
- **The P2P sentinel instrument, exactly as built and fires-validated** (Addendum A §3):
  the step-1 instance's PASS_TO_PASS suite, run at FILE granularity in a second pytest invocation
  inside the same scoring container (stale node ids abort pytest wholesale; file-level runs
  cannot), quarantine = sentinels not PASSED at clean base, computed once per rollout.
  Fires-validation on pvlib-clearsky: base 1144/1150 live; gold preserves 1144/1144 (zero false
  fires); module-level sabotage of the shared file trips 1144/1144
  (`scripts/validate_p2p_sentinels.py`). P2P sentinels are live from step 1 by construction —
  no solvability dependence.
- **The certification gate skeleton** (`hit-sdd-bench-e2/src/hit_sdd_e2/e3/certify.py`): no-op
  gate, gold gate, cumulative gate, conflict gate, single-container sequential application with
  marker-delimited parsing. §4 extends it to chained states; it does not replace it.
- **Standing rules.** Any model-spend run requires explicit operator authorization; predictions
  committed before launch; calibration is never described as causal evidence; replay artifacts
  persisted for every scored step.

## 3. Axis 3 — the causal contrast (load-bearing decision)

### 3.1 The problem, stated plainly

The regression oracle for Claim A is the repo's own previously-passing test suite. That suite is
**public**: it lives in the agent-readable workspace, and both arms can run `pytest` on it at
will. A "treatment tool" that runs the P2P suite and returns pass/fail therefore conveys **no
hidden information** — everything it returns, the control could obtain for free with one shell
command. Any design that frames such a tool as an *information-access* contrast (the E2 framing)
is silently false: the contrast would actually be manipulating something else. Naming that
something else, and choosing it deliberately, is the redesign's central decision.

### 3.2 Decision: enforcement contrast is PRIMARY

- **Control arm:** file editing + shell. May write and run its own tests, may run the repo suite
  voluntarily. Its done-claim is accepted at face value; the episode advances to the next change.
- **Treatment arm:** identical tools, identical visible packets, identical budgets, **plus a
  harness-level done-gate**: when the agent declares done on change `i`, the harness runs the
  cumulative check surface (P2P sentinel files + public tests associated with changes `1..i`).
  If any check is red, the done-claim is **refused** and the agent receives the failing file-level
  names and pass/fail only — nothing it could not have obtained by running pytest itself. The
  agent may then continue within its remaining per-change budget. Budget exhaustion force-advances
  the episode in both arms identically.

The manipulated variable is the **refusal policy** — whether "done" is a self-certified claim or
a gated one — and nothing else:

1. **Zero information asymmetry by construction.** Because the check surface is public, the
   treatment tool's output is a subset of what the control can already see. There is no hidden
   oracle content to leak, so leak-audit burden collapses to one item: the done-gate must not
   reveal *hidden F2P* content (see §3.3).
2. **The variable is demonstrably live at the frontier.** B1's done-claim finding is direct
   frontier evidence: V4 Pro made 3 wrong done-claims and all 3 were made *over a red own-test
   verdict*; even qwen's near-ideal discipline had a 1/7 leak. Agents — including strong ones —
   sometimes declare done against evidence they already hold. Enforcement targets exactly that
   behavior; a voluntary-access contrast does not.
3. **It is the product-shaped claim.** The industry question is not "would agents benefit from
   information they can already access" but "does a harness that refuses unearned done-claims
   reduce accumulated breakage, and at what cost to throughput." Both directions of the answer
   are informative.

**What this claim is and is not.** The enforcement contrast tests a *policy/product* effect, not
an *information* effect. It must never be pooled with, or publicly conflated with, E2's
information-access results ("executable feedback the control could not run"). Every public
statement from this line must name the contrast as enforcement.

### 3.3 Secondary predeclared question: hidden accumulated F2P bundles

The parent design's information contrast — hidden acceptance bundles `O_1..O_i`, treatment gets
an execution-only tool over them — is retained as a **separate, secondary predeclared question**,
with its weakness stated up front: hidden-F2P regression feedback exists only for steps the agent
actually solved, which reintroduces the step-1-solvability dependence that produced the e3-v1
null. It is measured (the scorer runs hidden F2P bundles regardless), but no run is designed
around it, and the prediction template (§8) predeclares the expectation that F2P-bundle
regressions stay at or near zero. If chained episodes produce high per-step solve rates, this
question can be promoted in a future addendum — with fresh predictions, before any such run.

If the enforcement treatment's done-gate also runs hidden F2P bundles, it would leak their
existence/verdicts and contaminate the enforcement contrast's zero-asymmetry property. Decision:
**the done-gate runs only the public surface** (P2P sentinel files + public tests). Hidden F2P
bundles are scorer-only, in both arms, always.

## 4. Axis 1 — chained-episode construction

### 4.1 Definition

An **episode** is one repo plus an ordered chain of `k` real merged changes
`c_1, c_2, ..., c_k`, where the gold patch of `c_i` applies to the state produced by golds
`c_1..c_{i-1}` — not to a frozen base. States are `S_0` (base = parent of `c_1`'s merge) through
`S_k`. The agent's workspace at step `i` contains its *own* accumulated work from steps
`1..i-1`; the visible packet for step `i` is derived from `c_i`'s real issue/PR description.

This opens every repository with consecutive merged PRs as an episode source — the pool is no
longer bounded by same-base-commit coincidences.

### 4.2 Certification gates adapted to chained states

Gates run offline, deterministic, Docker-only (no model spend), extending
`e3/certify.py`'s single-container sequential design:

- **(a) Env-stable window check** (new, metadata-level, runs before any container). The chain
  window `[c_1..c_k]` must not touch environment-defining files: `setup.py`, `setup.cfg`,
  `pyproject.toml`, `requirements*.txt`/`*.in`, lockfiles, `tox.ini`, CI workflow files,
  Dockerfiles, or pinned-version manifests. This is what licenses using **one pinned container
  image for all states `S_0..S_k`**. Chains violating it are rejected. Per-state image builds
  are explicitly out of scope for v2 (cost); recorded as a future widening lever, requiring its
  own validity review.
- **(b) Sequential-apply conflict gate.** Each gold `c_i` applies cleanly (git apply, fallback
  patch) on top of `S_{i-1}` — the chained generalization of the existing conflict gate. For
  chains taken from consecutive merged PRs on one branch this should pass by construction;
  the gate verifies it anyway.
- **(c) Per-state oracle gates (no-op + gold, per step).** Step `i`'s F2P bundle fails at
  `S_{i-1}` (with test patch applied) and passes at `S_i`. This replaces the v1 all-fail-at-base
  no-op gate: in a chain, "before the change" means the prior state, not the base.
- **(d) Cumulative preservation gate.** At every state `S_i`, all prior F2P bundles
  (`O_1..O_{i-1}`) and the full P2P sentinel surface remain green. This certifies that the *gold*
  chain contains no intentional behavior reversals — the precondition for calling an agent's
  pass-to-fail transition a regression.
- **(e) P2P sentinel quarantine at base.** Sentinel surface = the union of P2P suites of the
  chain's source instances (deduplicated by file), quarantined once at `S_0` (not PASSED at
  clean base ⇒ excluded), same file-granularity execution as Addendum A.
- **(f) Intent audit (manual).** Reject chains where a later change *legitimately* revises
  behavior an earlier change introduced (reading the PR discussions/changelogs, not just tests).
  Gate (d) catches the test-visible cases mechanically; the audit catches semantically intended
  revisions whose tests were also updated.
- **(g) Flake certification.** Repeated runs of the full cumulative surface at `S_k`; flaky
  checks quarantined before sealing (unchanged from parent gate 2).
- **(h) Leak audit.** Hidden F2P test patches and bundle node-ids absent from agent-readable
  workspace; done-gate output limited to public-surface file names + pass/fail (unchanged in
  spirit from parent gate 4, narrowed per §3.3).

### 4.3 Overlap requirement and the pool-widening ladder

The e3-v1 null taught that certifiable-but-decoupled episodes cannot regress. Chains must be
selected for **coupling**, predeclared in this order (widen only when the prior rung is
exhausted or fails certification):

1. **Same-file overlap chains:** ≥1 shared non-test implementation file between at least two
   golds in the chain (docs/changelog excluded) — the Addendum A criterion, applied to chains.
2. **Same-module/package overlap:** golds touch different files within the same package/module
   directory. Weaker coupling, larger pool.
3. **k>2 chains inside SWE-bench Live repos** with many post-cutoff issues, ordered by
   `created_at`, chained via merged-PR history rather than shared base commits.
4. **Merged-PR chains outside SWE-bench Live** (any repo with a stable pinned environment and
   consecutive merged PRs). This is a **new environment class**: it requires building/pinning
   the container ourselves and a fresh validity review (env reproducibility, post-cutoff
   discipline, contamination screen) before any episode from it is certified.

Rungs 1–3 reuse SWE-bench Live images and metadata; rung 4 is the true pool-opener and the most
expensive. The design expectation is that rung 3 already yields enough chains, because chaining
removes the same-base-commit constraint that produced the pool-of-2.

## 5. Axis 2 — sequence length and budgets

- **k = 4–8 target; 4–6 for the first certified chains.** k=2 is permitted only for pipeline
  smokes on the two existing certified overlap episodes (§9 R0), never as evidence.
- **Rationale (power arithmetic, written before any run):** E1's clean-run prior is ~3% regression
  probability per single change (`path-survival-discrimination-power`). Under that null prior,
  P(≥1 true regression per episode) ≈ 1-(0.97)^(k-1): ~9% at k=4, ~14% at k=6, ~19% at k=8.
  Overlap-prone chain selection (§4.3) plus the P2P sentinel surface (hundreds of live checks vs
  a handful of F2P tests) are the two levers that must beat this prior. If they do not, Claim A
  dies here, cheaply (§8 kill condition).
- **Per-change budget, identical in both arms:** a fixed model-turn cap and wall-clock cap per
  change (set at seal time from R0 smoke telemetry; the e3-v1 calibration budgets are the
  starting point). Done-gate executions in the treatment arm **consume the treatment agent's
  per-change budget** — enforcement is not subsidized. Budget exhaustion force-advances both arms
  identically; the workspace carries forward as-is.
- **No unbounded retry loops:** the done-gate may refuse at most `R` times per change
  (predeclared at seal; default candidate R=2, echoing the program's bounded 2/1 loop
  discipline); after R refusals the episode force-advances even if the agent keeps claiming done.

## 6. Axis 4 — metrics and blame attribution

### 6.1 Calibration metrics (the only metrics calibration reports)

- **Regression incidence:** P(≥1 true regression per episode), and per step.
- **Regression burden:** count of newly regressed obligations (P2P sentinel files + prior F2P
  bundles, reported separately) per step.
- **Retained-correctness curve:** fraction of previously-passing obligations still passing after
  each step.

Calibration reports incidence/burden/retained only. No arm contrasts, no causal language, no AUC.

### 6.2 Blame attribution (new, required in every scored rollout)

The headline claim is about **sequence-driven breakage of earlier work**, not sloppy single
changes (E1/E2 already measure those). Every true-regression event is attributed:

- **Conditioning on current-change outcome:** regression events are reported conditioned on
  `current_change_success_i`. A step that both fails its own change *and* breaks prior work is a
  sloppy-change event; the headline stratum is regressions at steps where the agent *succeeded*
  on its own change — competent-looking work that silently broke earlier behavior.
- **Which obligation broke:** the prior step `j` (or sentinel file) whose behavior regressed.
- **Touch attribution:** whether the agent's step-`i` diff touched the file(s) backing the broken
  obligation at step `i`, at an earlier step, or never (collateral breakage through an interface).
- **Repair tracking:** whether a regression introduced at step `i` is later repaired (returns to
  green at some `S_{i'}`, `i' > i`) without the obligation being re-specified.

### 6.3 Predeclared causal-pilot metrics (not run from this document)

- **Primary:** regression-free episode survival — area under the per-step indicator that no true
  regression (P2P sentinel or prior-F2P) has occurred yet, enforcement minus control, paired by
  episode and step.
- **Secondary:** final cumulative pass rate; current-change success rate (the throughput cost of
  enforcement — a *decrease* under treatment is a real finding, not a nuisance);
  done-claim calibration (fraction of done-claims backed by green evidence — the direct bridge to
  B1's finding, now on sequences); post-refusal repair rate (treatment only: fraction of refusals
  followed by a green re-claim within budget); tokens/turns to accepted-done per change.
- No pooling across repos, models, scaffolds, or chain versions unless predeclared.

## 7. Arms summary (for the later sealed pilot)

| | Control | Treatment (enforcement) |
|---|---|---|
| Tools | file edit + shell | identical |
| Visible packets | identical | identical |
| Self-testing | voluntary, unrestricted | voluntary, unrestricted |
| Done-claim | accepted at face value | gated on public cumulative surface (P2P sentinel files + public tests); red ⇒ refused, file-level names + pass/fail returned; ≤R refusals per change |
| Hidden F2P bundles | scorer-only | scorer-only (never run by the done-gate) |
| Budget | fixed per change | identical; gate executions and refusal turns consume it |

## 8. Predeclared gates, kill conditions, prediction template

Gates 1–5 and 7 of the parent design apply as adapted in §4.2 (offline certification, flake,
conflict/intent, leak, replay, seal). Gate 6 is re-armed as follows:

- **Gate 6 (re-armed control-only calibration).** Before any two-arm rollout: run control-only
  calibration on ≥2 certified chains (k≥4), frontier routes only, N≥5 rollouts per episode.
  Proceed to a sealed pilot only if true P2P-sentinel regressions fire at a predeclared minimum
  rate (to be committed with the predictions below; candidate threshold: ≥1 true regression in
  ≥30% of control episodes). Below threshold ⇒ stop.
- **Kill condition (explicit, program-level).** If frontier control rollouts on certified
  overlap-prone chains at k≥4 still produce ~0 true regressions, Claim A is declared dead at the
  frontier for this environment class, and the program stops paying for it. That outcome would be
  the third structural null in this line (billing-v2/v3 engineering, e3-v1 stacking) and is
  publishable as an honest negative: under these budgets, frontier agents' iterative changes
  rarely break previously-working public behavior even when changes are file-coupled.
- **Prediction template — MUST be filled and committed before any run:**
  - P(≥1 true P2P regression per control episode), per certified chain, per model: ____
  - Expected regression burden (sentinel files newly broken per firing step): ____
  - P(≥1 prior-F2P-bundle regression per control episode) (expected ≈0, §3.3): ____
  - Fraction of regression events in the current-change-SUCCESS stratum (§6.2): ____
  - For the later pilot only: expected sign and rough size of the enforcement effect on
    regression-free survival, and expected throughput cost (current-change success delta): ____

### 8.1 Committed predictions for R2 (2026-07-06, BEFORE any R2 run)

Frozen scope this block commits to: **control arm only**, frontier route **DeepSeek V4 Pro**,
the two certified rung-4 episodes `pvlib-rung4-k3-v1` and `pvlib-rung4-k6-v1`, **N=5 rollouts per
episode**, per-change budget **40 model iterations** (the R0-smoke setting), done-gate inactive
(control). Sentinel surface = the episode's stored `sentinel_p2p` (1215 / 1193), quarantined
per-rollout. Adopted **Gate-6 threshold: ≥1 true P2P regression in ≥30% of control episodes**;
adopted **R=2** for the later treatment pilot. These are point predictions with wide intervals;
they exist to be scored against, not to be right.

- **P(≥1 true P2P regression per control episode), V4 Pro:** `pvlib-rung4-k3-v1` ≈ **0.40**;
  `pvlib-rung4-k6-v1` ≈ **0.60**. Rationale: the E1 null prior (~9%/14% at k=4/6) is computed for
  a handful of F2P tests; the ~1200-check sentinel surface widens the tripwire enormously (any
  collateral break in a touched module fires it) and these pvlib chains recur through
  spectrum/irradiance/albedo. The R0 smoke already tripped exactly 1 sentinel on the one step the
  agent completed. **I predict Gate 6 FIRES on both episodes** (both above the 30% threshold) and
  the kill condition is NOT hit.
- **Expected regression burden (sentinel tests newly broken per firing step):** median ~**3**
  tests (often a single test file; occasionally a shared-signature/import break collapses a whole
  file's collection → tens). The smoke's firing step broke 1.
- **P(≥1 prior-F2P-bundle regression per control episode):** ≈ **0.05** (near zero, per §3.3) —
  it requires the agent to have first SOLVED a prior step's F2P and then broken it; frontier solve
  rates on these hard pvlib tasks are low (in the smoke the agent failed step 1 outright).
- **Fraction of regression events in the current-change-SUCCESS stratum (§6.2):** ≈ **0.40** — I
  expect incomplete/failed changes to break more than clean successful ones, so a minority (but a
  substantial one) of regressions land in the competent-looking "succeeded yet regressed" stratum
  that is the headline.
- **Later pilot only (enforcement effect, not run here):** sign **positive** on regression-free
  survival (the gate forces repair before advancing), rough size **+0.10 to +0.20** on the
  per-step regression-free-survival AUC, with a **throughput cost of about −0.05 to −0.15** on
  current-change success (budget spent on refusals/repair). Wide interval: the smoke showed
  frontier agents often never reach a done-claim, which bounds how often the gate can act.

### 8.2 Committed predictions for the second-repo episode (2026-07-06, BEFORE the full run)

`dmcg-rung4-k5-v1` was added after §8.1, so its predictions are committed here, before it is run.
Same frozen scope (control arm, V4 Pro, N=5, 40-iter budget), 653 sentinels. These are informed by
the R2 probe (§13.1), which showed the curated F2P oracle — not the broad P2P surface — is the
sensitive detector once the agent solves an early step.

- **P(≥1 true regression per control episode):** ≈ **0.45**. Rationale: k=5 with two
  regression-fix steps (#2404, `_deep_merge`) that touch fragile shared parser behavior; datamodel
  tasks are relatively self-contained, so solve rates (hence live F2P tripwires) may run a little
  higher than pvlib.
- **Firing surface:** **F2P bundles**, per the probe update. **P2P sentinels expected ≈0** (the
  broad public suite is robust). Report both separately.
- **Expected regression burden (tests newly broken per firing step):** median ~**2**.
- **Fraction of regression events in the current-change-SUCCESS stratum:** ≈ **0.40**.
- **Across all three episodes I predict the run clears the Gate-6 threshold** (≥1 true regression in
  ≥30% of control episodes) and the kill condition is NOT hit — the probe already produced one true
  regression on `pvlib-rung4-k3-v1`.

## 9. Staged plan (cheapest first)

- **R0 — pipeline smoke on existing assets (no new machinery, no evidence).** Wire the done-gate
  and chained scoring into the runner; smoke on the two certified overlap episodes
  (`pvlib-clearsky-overlap`, `conan-conf-overlap`) as k=2 episodes. Purpose: prove the
  enforcement tool, refusal accounting, blame attribution, and replay artifacts work end-to-end
  before any chain machinery is built. Explicitly non-evidence (k=2, wrong episode class).
  Requires operator authorization (model spend), but at B1-scale cost.
- **R1 — chain construction (build only, no model spend).** Chain selector over merged-PR history
  (rungs 1–3 of §4.3); chained certification per §4.2; certify 2–3 chains at k≥4. Docker time
  only.
- **R2 — control-only calibration (Gate 6, authorization required).** Frontier routes only:
  `deepseek` = DeepSeek V4 Pro, `qwen` = Qwen 3.7 Max, as frozen in
  `hit-sdd-bench-e2/src/hit_sdd_e2/_cli/routes.py` (keys in `hit-sdd-bench/.env`). Predictions
  committed first. Reports incidence/burden/retained + blame attribution only.
- **R3 — sealed two-arm enforcement pilot (only if Gate 6 fires).** Seal chains, budgets, R,
  models, metrics, analysis; paired rollouts per §6.3.

No flash-tier evidence runs at any stage (operator standard). Flash is not used even for smokes:
B1 showed it cannot solve tasks in this class, so its smoke telemetry would not transfer.

## 10. Cost envelope

Anchor: the B0/B1 probe measured 72 rollouts for ≈$1–2 total on these routes; wall-clock and
Docker time dominate, not tokens.

- R0: ~4–8 rollouts × k=2 — single dollars, hours of Docker time.
- R1: zero model spend; certification containers only.
- R2: 2 models × 2–3 chains × 5 rollouts × k=4–6 changes ≈ 120–360 scored change-steps —
  roughly an order of magnitude more container executions than B1; expect tens of dollars of
  API spend and the real cost in scoring wall-clock (each step scores the full cumulative
  surface). If scoring time becomes the binding constraint, the predeclared mitigation is
  scoring only changed-state checkpoints, never subsampling the sentinel surface.
- R3: roughly 2× R2 per model (two arms). Sealed budget committed at seal time.

## 11. Honest limits and what each stage licenses publicly

- **The enforcement claim is a policy/product claim, not an information claim.** It can never be
  stated as "agents lacked information"; it must be stated as "a harness that refuses unearned
  done-claims did/did not reduce accumulated breakage, at this throughput cost." It does not
  license "HIT-SDD wins," any spec-authoring claim, or any statement about hidden-oracle
  information value (that is E2's boundary).
- Single environment class (chained merged PRs in pinned pytest repos), ≤2 models, one scaffold,
  bounded budgets. No generalized claim from any single stage.
- Regression feedback via hidden F2P remains structurally weak (§3.3); the P2P sentinel surface
  measures preservation of *pre-existing* behavior, not of the agent's own new features — the
  claim must be worded accordingly ("previously working behavior," not "earlier work" generally,
  except where prior-F2P events actually fire).
- **Stage licenses:** R0/R1 license nothing publicly (pipeline artifacts only). R2 licenses
  bounded incidence statements ("under model X, budget B, on chains C, frontier control runs
  broke previously-passing behavior at rate r") and, if the kill condition triggers, the honest
  negative above. R3 licenses one bounded causal statement about the enforcement effect under the
  sealed configuration — in either direction. Nothing licenses a leaderboard, a benchmark
  platform, or pooling across boundaries.

## 12. Scan result (2026-07-05, metadata-only, no spend)

The R1 chain selector (`hit-sdd-bench-e2/scripts/find_chain_episodes.py`, rungs 1–2 of §4.3)
was run over SWE-bench Live to falsify the central premise that chaining opens the pool. It does:

- **802 instances** pass floors + the instance-level env-stable gate across **143 repos**.
- **114 candidate chains** at k≥3; **98** have ≥1 file-coupled step (rung 1).
- Top candidates reach k=8 with large P2P sentinel surfaces (sphinx ≈1979, xarray ≈6322,
  pvlib ≈1131, matplotlib ≈8046), and `distinct_base_commits ≈ k` — confirming these are true
  cross-history chains, not same-base coincidences.
- pvlib chains extend the already-certified `pvlib-clearsky-overlap` episode, making pvlib the
  natural first chained-certification target (image + P2P sentinels already validated).

This is a strong GO on episode source: the pool moves from 2 same-base pairs to ~100 candidate
chains. Caveats carried to certification: (a) `created_at` order is a git-history proxy — whether
golds actually stack cleanly on the prior state is decided by the conflict gate in Docker;
(b) stacking golds on the first instance's base is a plausible synthetic sequence, not a verified
replay of the real merge order — the intent audit (§4.2 gate (f)) is where that is checked.
Output: `hit-sdd-bench-e2/runs/e3-chains/chain-scan-v1.json`.

## 13. Execution results (2026-07-05, R0 + R1-scout)

Ran the cheapest stages to de-risk the design. Frontier route DeepSeek V4 Pro throughout.

**Scan (metadata, no spend):** strong GO, recorded in §12.

**R0 done-gate wiring (code, tested):** enforcement gate built in
`hit-sdd-bench-e2/src/hit_sdd_e2/e3/agent.py` (intercepts the `done` tool, runs the public
sentinel files in the agent's own container via `pytest -rfE`, refuses on red up to
`max_refusals` with failing file names fed back), threaded `arm`/enforcement through
`e3/runner.py` and `scripts/run_e3_calibration.py` (`--arm treatment`). Control path unchanged;
14/14 e3 tests pass; gate parser unit-tested (green/red/dedup/tail-truncation).

**R0 smoke (authorized, ~$1–2, treatment arm, certified pvlib-clearsky episode, n=1, capped
12-file surface — NON-EVIDENCE plumbing test):** pipeline works end to end. Findings:
- First observed E3 true P2P regression: the agent's step-2 change broke 1 previously-passing
  sentinel in `pvlib/tests/test_clearsky.py` (1143/1144). The Addendum-A sentinel instrument
  fires on a real agent change.
- **Gate/scorer parity caveat (design-relevant):** the agent passed the enforcement gate
  (refusals=0) yet the scorer recorded the regression. Two causes, both must be fixed before the
  pilot: (a) the capped 12-file surface did not include `test_clearsky.py` (33 sentinel files
  total) — the pilot gate MUST run the full cumulative surface, never a subset; (b) the gate runs
  sentinels in the agent's container (no hidden test patches) while the scorer runs a fresh
  container with them — gate and scorer must evaluate sentinels identically or treatment can pass
  the gate yet be scored red.
- On the hard step-1 task the frontier agent exhausted its 40-iteration budget without a
  done-claim, so the gate's refusal path was not exercised in-Docker (unit-tested separately);
  observing it live needs an easier episode or a higher budget.

**R1-scout — chained certification (Docker, no spend):**
- Built a chain materializer (`scripts/build_chain_episode.py`) and the chain selector
  (`scripts/find_chain_episodes.py`, §12).
- **Certifier F2P-robustness fix (merged):** the existing certifier ran F2P by exact node-id and
  a single stale parametrization id (e.g. `test_get_reference_spectra[ASTM…]`) aborted the whole
  pytest run, zeroing all F2P to MISSING — the same failure Addendum A fixed for P2P sentinels.
  Fixed in `e3/certify.py`: F2P now run at FILE granularity with function-level id reconciliation
  (`_status_for`, unit-tested incl. prefix-safety). This is a prerequisite for certifying any
  episode whose F2P are parametrized, chained or not.
- **Chain-stacking finding (the load-bearing R1 result):** with the fix, the pvlib k=4 chain
  (2039→2041→2048→2055) certifies step 1 cleanly (`patch=True, f2p=True, cumulative_ok=True`) but
  step 2's gold does not apply on the step-1 gold state (`patch=False`) — a genuine conflict.
  Ancestry check confirmed 2039's base is NOT an ancestor of 2041's base: **SWE-bench Live
  instances are each authored against independent bases, so stacking their golds on one base is a
  synthetic composition that conflicts.**

**Design update (evidence-backed):** the tension is structural — carrying the agent's work
forward across steps requires all steps to share one base (so diffs apply), but a shared base
forces stacking independently-authored golds, which conflict. True chained changes (each authored
against the prior state) exist only in real merge history. Therefore **rung 4 of the §4.3 ladder
(consecutive merged-PR chains reconstructed from git history) is REQUIRED, not optional**; rungs
1–3 (SWE-bench Live) can only certify the rare chains whose instance bases happen to be linear.
The next R1 step is to either (a) brute-force certify the 114 candidates to harvest the
linear-base minority, or (b) build the rung-4 merged-PR chain constructor (per-state or
env-stable-window certification). Recommendation: (b), since (a)'s yield is bounded by the same
independence problem. The certifier fix and enforcement wiring carry forward to either.

**R1 rung-4 constructor built + first chain certified (2026-07-06, Docker, no spend).** Chose
path (b). Built `scripts/build_merged_pr_chain.py` (extracts gold/test patches + computes F2P
from real first-parent history inside the pinned image; golds = consecutive range diffs, so they
stack by construction) and `scripts/certify_chain_episode.py` (feeds inline-patch episodes into
the shared certify gate machine). First rung-4 episode **`pvlib-rung4-k3-v1` CERTIFIES all gates
green**: three consecutive pvlib feature merges (#2053 transformer efficiency → #2048 Agrivoltaics
PAR → #2088 JRC spectral factor), base `1eecaa38`, image reused from pvlib-2055. Every step
`patch=True, f2p=True, cumulative_ok=True` (10 F2P total across the chain); no gold conflicts, no
gold-chain regressions. This is the first certified chained episode with genuine sequential
structure and confirms the rung-4 construction is sound where SWE-bench independent-base stacking
was not (`runs/e3-chains/pvlib-rung4-k3-v1.json`).

**R2 staging complete (2026-07-06, Docker + code, no spend, no run authorized).** All three open
items closed:
- (i) **Inline-episode support** in `run_e3_calibration.py` (`_is_inline_episode` /
  `_inline_step_data` / `_dataset_step_data`) plus an explicit `image` threaded through
  `e3/runner.py` and `e3/agent.py` (`_episode_image`; rung-4 episodes have no instance id).
  Backward compatible — SWE-bench episodes still route to the dataset path; 14/14 e3 tests pass;
  inline loading validated end-to-end without spend (step data, F2P, patches, image all resolve).
- (ii) **Sentinel computation at base** (`scripts/compute_e3_sentinels.py`): runs the repo's test
  suite at the episode base in the pinned image, keeps PASSED, excludes the chain's F2P, writes
  `sentinel_p2p` back to the episode. The runner quarantines it per-rollout as usual.
- (iii) **k=6 chain built + certified.** `pvlib-rung4-k6-v1`: six consecutive pvlib feature merges
  (#2072 → #2039 → #2094 → #2095 → #2053 → #2048), base `734ac82`, all six steps
  `patch/f2p/cumulative` green (step 3, #2094 "map_variables=True by default", is a null-oracle
  step — 0 F2P, certifies vacuously, still a live change against the sentinel surface).

**Three certified rung-4 episodes across two repos are now R2-ready** (`runs/e3-chains/`):

| episode | repo | k | total F2P | P2P sentinels @ base | null-oracle steps |
|---|---|---|---|---|---|
| `pvlib-rung4-k3-v1` | pvlib/pvlib-python | 3 | 10 | 1215 | none |
| `pvlib-rung4-k6-v1` | pvlib/pvlib-python | 6 | 25 | 1193 | step 3 |
| `dmcg-rung4-k5-v1` | koxudaxi/datamodel-code-generator | 5 | 25 | 653 | none |

The second repo (`dmcg-rung4-k5-v1`, 2026-07-06 — added on the "widen first" decision) certified all
5 steps **on the first try**, confirming the rung-4 constructor generalizes beyond pvlib with no
per-repo special-casing (the build script takes `--image`/`--repo`/`--milestones`; sentinel roots
derive from the chain's test files). Two of its five steps are regression-fix PRs (#2404 regex, the
`_deep_merge` list-mutation fix), which are well-suited to a regression study. A calibration on
`{pvlib, datamodel}` is no longer single-repo.

Everything needed for R2 control-only calibration on these episodes is wired and tested; only the
predeclared prediction commit (§8) and explicit operator authorization for model spend remain.
Known hardening item for R2: the runner's scorer still runs F2P by exact node-id (safe for rung-4,
whose ids are exact-from-pytest); if a future episode hits MISSING F2P, port the certifier's
`_status_for` file-granularity reconciliation into `e3/runner._score_in_docker`.

## 13.2 Gold-leak discovered and fixed (2026-07-06, CRITICAL)

The first full-calibration launch was stopped after ~1 rollout, and its log exposed a
**contamination channel**: the agent ran `git show 3f2daab` (the exact step-3 gold commit) and
`git log --all`. Cause: rung-4 reuses a *late* pinned image (e.g. pvlib-2055, HEAD after all
milestones) with an *earlier* base, so the future milestone commits — the gold implementations —
sit in the workspace's object database; `git reset` to base does not remove them. The agent could
retrieve the gold for any step with one command.

Fixed in `e3/agent.create_workspace_container` (**gold-leak guard**): after resetting to base, the
workspace is isolated to base and its ancestors — a lone branch is pointed at base, every other
ref/remote/pseudo-ref is deleted, the reflog is expired, and unreachable objects are pruned. Verified
in the pvlib image: `git show <milestone>` errors and the object is pruned, while base stays
reachable so diff capture is unaffected. Applies to all agent workspaces (harmless for episodes
without future commits in-image). This is specific to the rung-4 late-image construction; the
per-instance-image e1/e2 pilots do not have it.

**Consequence:** the §13.1 probe below is **retired as a measurement** — the agent had gold access,
so its regression is not an honest signal. The full calibration is re-run under the fix.

## 13.1 R2 pipeline probe (2026-07-06, authorized, control-only, NON-EVIDENCE — RETIRED, gold-leaked)

**Superseded: this probe ran BEFORE the §13.2 gold-leak fix; the agent could read gold from git
history, so nothing here is a valid regression measurement. Kept only for the pipeline-wiring
validation (sentinel arming, scoring, state machine), which is unaffected.**

Operator authorized a cheap probe — **not** the committed Gate-6 calibration. Scope: control arm,
V4 Pro, `pvlib-rung4-k3-v1` only, **N=2**, 40-iter budget. Purpose: confirm the rung-4 calibration
fires end-to-end and get an early read. n=2 / single episode ⇒ nothing here is calibration
evidence; Gate 6 still requires ≥2 episodes at N≥5.

**Pipeline: validated.** Inline episode loaded, explicit image resolved, sentinels armed
**1215/1215 live at base, 0 quarantined** (the precomputed surface exactly matches the runner's
base evaluation), agent ran, cumulative scoring + regression state machine produced clean labels.

**First sequence-driven true regression on a real chain (rollout 0).** The agent solved step 1
(#2053 transformer efficiency — both F2P green), stalled on step 2 (budget-exhausted, step-1 tests
`retained`), then on step 3 (#2088 JRC spectral) its work **broke step 1's transformer tests** —
labeled `true_regression` (bundle_step 1 → current_step 3). Compounding it, step 3's *own* F2P all
failed while the agent declared done — a false done-claim (the B1 phenomenon) riding on top of the
regression. Rollout 1: agent solved steps 1 and 3, no regression. So **1 true regression in 2
rollouts**, stochastic.

**Prediction check (§8.1), honestly scored:** I predicted the **P2P** sentinel surface would be the
firing surface (~0.40) and **F2P**-bundle regressions near-zero (~0.05). The probe inverted this:
**P2P 0/1215 broke in every step of both rollouts** (the broad public suite is robust — the E1
prior holds), while the regression fired on the **curated F2P oracle**. The mechanism is the honest
one: the frontier agent *did* solve step 1, which made its F2P a live tripwire, and a later step
broke it. Update for the design: on these episodes the specific feature-test bundles, not the broad
P2P surface, are the sensitive regression detector — because frontier solve rates are high enough
to keep prior F2P live (the exact dependence Addendum A worried about, resolved in the favourable
direction here). The committed N=5 two-episode calibration should report P2P and F2P incidence
separately and expect F2P to dominate.

Artifacts: `runs/e3-calibration/e3-calibration-control-20260706-134545.json`,
`runs/e3-chains/r2probe-k3-control.log`.

## 14. Non-goals

- No generalized benchmark platform, no model leaderboard.
- No public causal claim from calibration; no hidden-oracle tuning after seeing outcomes.
- No authored-spec arm anywhere in e3-v2 (that remains the parked E2 line).
- No conflation of the enforcement contrast with E2 information-access results, and no
  conflation of B1's done-claim finding with the closed-null tautology claim (0/72; the
  distinction is load-bearing and public statements must preserve it).
- No cheap-tier evidence runs.
