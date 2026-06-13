# e1-ledger-v1 Task Design (v1) — Double-Entry General Ledger, Interaction-Regression Mechanism

Date: 2026-06-13. **Status: CRITIQUE-FLAGGED — do not build without redesign.** A five-model
red-team round (2026-06-13, `ledger-v1-task-hardness-redteam-PROMPT.md`) converged that this design
is most likely a *fifth clean ceiling or a convention-contaminated non-finding* (P ≈ 60–85%), for
**structural** reasons, not tunable ones: (1) stripping literal expecteds doesn't stop the control
arm self-verifying via golden-master/characterization testing of the old primitive; (2) the
anti-shim identity-equivalence gate can't distinguish a correct refactor from a delegation shim, so
the regression surface is never forced; (3) the ledger domain's contestable conventions make
"regressions" unfair and would manufacture a treatment>control gap that measures convention-reading,
not feedback. Deeper finding: *unambiguous + fair ⇒ self-verifiable by a careful frontier model ⇒
no fair feedback win via refactoring/preservation tasks.* See
[[frontier-feedback-structural-ceiling]]. This boundary is retained as honest record; building it as
written is not recommended. Successor to the closed billing domain. This is a NEW task family in a NEW domain (`e1-ledger`), never pooled with
billing/dispatch/subscription/inventory/payroll/pricing/role-permissions runs. Operates under the
precommitted gates doc (`e1-first-evidence-task-design-gates-v0.md`: 5–10 files, 12–18
checkpoints, partial seed, hidden reference, naive-agent proof) and the sealed OpenSpec profile +
base constants.

## Why a new domain, and why this mechanism

The billing domain is **formally closed** (`AGENTS.md`, 2026-06-11): billing-v2 ceilinged under
Sonnet 4.6 (0.9929) and Qwen 3.7 Max (0.9361); billing-v3 ceilinged under Qwen 3.7 Max (0.9628),
all with **zero on-graph regressions** under clean criterion-3 probes. A new domain is required.

billing-v3's clean ceiling also **empirically confirmed** what five independent external critiques
predicted about its difficulty mechanism (a seeded FNV-1a `replayStateHash` spine + "forced"
rewrites): it does not trouble a frontier context arm. The mechanical reasons (see
`docs/protocols/billing-v3-task-hardness-redteam-PROMPT.md` and the critique synthesis):
1. **Known-answer leak (fatal in Stage 2):** literal `(events → expected)` worked examples in the
   spec let the control arm self-build the oracle; worse, the cumulative spec re-shows every prior
   checkpoint's expecteds and scratch files persist across checkpoints.
2. **Shim escape:** "forced" rewrites were additive (new function beside frozen one); a model
   preserves frozen code and adds adapters, never entering the regression surface.
3. **Transcription, not reasoning:** explicit append-only registry deltas are trivial.

The valid lever (critique consensus): **un-exemplified feature-interaction regression that lives
only in the hidden oracle**, plus **contract-modifying rewrites that route the frozen path through
new code**, plus **direct low-level-API cases**. This document instantiates that lever in the
double-entry ledger domain, which has billing-grade cross-feature entanglement (currency × rounding
× reversal × period-close × balance projection) without being billing.

This task is **not guaranteed to produce a frontier feedback win** (no fair task can — see
Residual Risk). It removes the mechanical collapses that made billing-v3 a foregone null, or it
returns an honest clean ceiling that further supports the "feedback is mid-tier" reading.

## Domain: double-entry general ledger

A ledger consumes events (open account, post journal entry, set FX rate, accrue, reverse, close
period, adjust) and answers queries via a single `evaluate(events, query)` facade. Double-entry
discipline: every journal entry's postings sum to zero in the functional currency.

### Cross-cutting invariants (cumulative from introduction)

| ID | Invariant | Introduced |
| --- | --- | --- |
| I-BALANCE | every journal entry's postings sum to zero in functional currency | CP01 (seed) |
| I-SEQ | per-account posting sequence gap-free, monotonic | CP01 (seed) |
| I-REPLAY | canonical state hash reproduces (FNV-1a over registry serialization) | CP01 (seed) — **secondary defense-in-depth, not the primary lever** |
| I-ROUND | currency conversion rounded half-even at posting level | CP02 (seed) |
| I-TRIAL | trial balance sums to zero across all accounts in functional currency | CP02 (seed) |
| I-V1BYTES | v1 entry export byte-stable | CP04 (seed) |
| I-ALLOC | conversion/rounding residual allocated by largest-remainder across an entry's postings | CP05 |
| I-RATEDATE | conversion uses the rate selected by the entry's rate-date policy | CP08 |
| I-REVERSAL | accrual reversal mirrors the original exactly (negated postings, same lines) | CP10 |
| I-IMMUT | closed-period entries immutable; adjustments post to the open period | CP12 |
| I-ASOF | balance/trial queries are correct as-of any date | CP13 |

Placement rule (binding, carried from billing-v3 lessons): any invariant hard to *achieve* is
seeded or introduced ≤ CP05 when state is small; checkpoints after CP05 only *perturb* it. Late
checkpoints introduce interaction pressure, not novel hardness.

## Difficulty mechanism (the valid lever)

Each late **contract-modifying** checkpoint replaces a primitive `f(args)` that several earlier
features call with a generalized `g(argsʹ)`, and **requires the old callers re-expressed in terms
of `g` — deleting `f`'s body, not adding `g` beside it.** The visible spec shows ONE simple
**identity-case** worked example (the degenerate input where `g` reduces to `f`). The hidden oracle
then probes the **cross-product** of `g`'s new degrees of freedom against every earlier feature
that flows through it. A naive generalization satisfies the identity example but silently changes a
tie-break, a rounding path, a rate selection, or an ordering on a feature several checkpoints away
— invisible to inspection, catchable only by executing the interaction case the agent did not think
to enumerate.

"Un-exemplified" is the load-bearing fairness property: the visible example demonstrates the rule
and the identity case; it never enumerates the interaction surface. The combinatorial space
(feature × feature × edge-condition) defeats self-test enumeration within 12 turns / 6 verification
executions / 4000 output tokens, while any single missed cross-product is a control-arm regression
the feedback arm catches by execution.

### The four contract-modifying cores

**CP08′ — Rate-date policy core (`convertAmount`).**
Early conversions (CP02–CP05) use a spot rate. CP08 introduces rate-date policies
(`transaction_date | posting_date | monthly_average`) and requires **every** conversion site —
entry posting, residual allocation, later reversal/adjustment — re-expressed through a single
`convertAmount(amount, from, to, rateCtx)` where `rateCtx` carries the policy + dates. Visible
identity example: a same-day single-rate conversion where all policies coincide. Hidden
cross-products: multi-currency entry where transaction and posting dates differ × residual
allocation × trial-balance. Naive default-policy or per-posting rounding regresses
I-ROUND/I-BALANCE/I-TRIAL on earlier multi-currency entries. Frozen path forced through new code:
CP02–CP05 conversions now compute via `convertAmount`.

**CP14′ — Unified entry renderer (`renderEntry`).**
v1 export (frozen since CP04 under I-V1BYTES) and a new v2 export both re-expressed as
`renderEntry(entry, formatSpec)` calls. v1's spec encodes its quirks: omits-zero amounts, legacy
key aliases (`acct`/`amt`/`cur`), no `fx_rate`/`policy` fields. Visible identity example: v2 render
of a single-currency entry. Hidden cross-products: v1 × {multi-currency posting, residual line,
reversal entry, adjusted entry}. Naive single omit-policy / shared field-set regresses I-V1BYTES on
every multi-currency/residual entry from CP05/CP08. Analog to billing-v3 critique's CP15′.

**CP15′ — Adjustment core (`postAdjustment`).**
Both open-period in-place correction and closed-period adjustment-via-new-entry routed through one
`postAdjustment(entry, delta)`. Visible identity example: open-period correction of a
single-currency entry. Hidden cross-products: adjusting a **closed-period multi-currency** entry
must (a) leave the original byte-frozen (I-IMMUT, I-V1BYTES), (b) create a new open-period entry
that re-runs residual allocation (I-ALLOC) at the correct rate-date (I-RATEDATE), (c) keep the
trial balance zero (I-TRIAL). Naive in-place mutation or copy-without-reallocate regresses four
invariants none of which appear in the visible example.

**CP17′ — Weighted residual allocator (`allocateResidual`).**
Replace `allocateLargestRemainder(residual, postings)` with
`allocateResidual(residual, weights, opts)` (tie-break + rounding mode); route conversion residual
(CP05) and adjustment residual (CP15′) through it; uniform weights must reproduce the old
lowest-index largest-remainder tie-break exactly. Visible identity: `allocateResidual(1,[1,1,1],
default) → [1,0,0]` (or domain-correct equivalent). Hidden cross-products: equal-magnitude
postings + odd residual (tie-break), three-posting adversarial remainder, residual on a
closed-period adjustment. Naive tie-break flip / per-share round passes the identity but regresses
I-ALLOC/I-BALANCE on earlier entries. Direct analog to billing-v3 critique's CP17′.

**Plus the audit-projection trap (CP11′ — `projectLedger`).** Generalize per-account posting log
and the audit feed to derive from one ordered record stream via `projectLedger(records, view)`, and
re-express per-account `accountLog` through it. Trap: deriving per-account `seq` from a global
counter regresses I-SEQ + I-REPLAY on multi-account scenarios (visible example is single-account,
where global and per-account seq coincide).

Ordering: CP08′ (rate-date) → CP11′ (projection) → CP14′ (renderer) → CP15′ (adjustment, old
allocator) → CP17′ (allocator generalization re-routes CP15′'s residual path too). This makes CP17′
perturb CP05/CP08/CP15 and maximizes the "achieved-then-threatened" surface.

## Checkpoints CP01–CP18 with private interaction graph

"Perturbs" is the on-graph drift set for probe classification. Seed implements CP01–CP04.

| CP | New behavior | Files touched | Perturbs (on-graph) |
| --- | --- | --- | --- |
| 01 | (seed) accounts + journal entry + balance invariant + per-account audit + canonical registry + `replayStateHash` | accounts, postings, audit, ledger | — |
| 02 | (seed) single-currency invoice→entry + half-even rounding + trial balance | postings, money | — |
| 03 | (seed) idempotent entry posting (duplicate event no-ops) | postings, ledger | — |
| 04 | (seed) v1 entry export (byte-frozen) | serializers | — |
| 05 | multi-currency entry; spot conversion; residual largest-remainder (I-ALLOC) | currency, money, postings | CP02 I-ROUND/I-TRIAL, CP04 I-V1BYTES, CP01 I-REPLAY |
| 06 | inter-account transfer entry | postings | CP01 I-BALANCE/I-SEQ, CP05 |
| 07 | revaluation entry on rate change | currency, postings | CP05, CP02 I-TRIAL, CP01 I-REPLAY |
| 08 | **rate-date policy core — forces all conversions through `convertAmount`** | currency, postings, money | CP05/CP07 conversions, CP02 I-ROUND, CP01 I-REPLAY |
| 09 | accrual entry | reversals, postings | CP01 I-BALANCE, CP06 |
| 10 | accrual reversal (I-REVERSAL) | reversals | CP09, CP08 rate-date on reversal, CP01 I-REPLAY |
| 11 | **ledger projection core — forces `accountLog` through `projectLedger`** | audit, ledger | CP01 I-SEQ+I-REPLAY across all features, CP06/CP09 records |
| 12 | period close + immutability (I-IMMUT) | periods, ledger | CP01 I-STATE, CP02/05 entries frozen |
| 13 | as-of-date balance/trial queries (I-ASOF) | balance | CP02 I-TRIAL, CP05/07 dated entries, CP01 I-REPLAY |
| 14 | **v2 export via unified `renderEntry` core** | serializers | CP04 I-V1BYTES, CP05/08 multi-currency lines |
| 15 | **adjustment core — closed-period adjust-via-new-entry through `postAdjustment`** | postings, periods, ledger | CP12 I-IMMUT, CP05 I-ALLOC, CP08 I-RATEDATE, CP04 I-V1BYTES, CP01 I-REPLAY |
| 16 | multi-line accrual with partial reversal | reversals, postings | CP09/CP10, CP15 adjustment of accrual |
| 17 | **weighted residual allocator — forces `allocateResidual` everywhere** | money | CP05 I-ALLOC, CP15 residual, CP08 amounts, CP02 I-ROUND, CP01 I-REPLAY |
| 18 | generalized idempotency (MODIFIES CP03 contract + callers) | ledger, postings, reversals | CP03 generalized, CP10 reversal dedup, CP15 adjustment dedup, CP01 I-REPLAY |

Contract-modifying CPs: 08, 11, 14, 15, 17 (+ CP18 contract-modifying idempotency). I-REPLAY
perturbed by ≥11 of CP05–CP18 (secondary metric).

## Visible-spec policy (kills the known-answer leak; arms stay identical-text)

Binding rules, enforced in the generator and audited by a gate:
1. **Strip `expected` from worked-example blocks.** Worked examples render the `evaluate(events,
   query)` *inputs* and the *rule* prose only ("the engine computes the result") — never a literal
   expected value. This removes the leak even under cumulative concatenation.
2. **Current-checkpoint, single-feature identity examples only.** No interaction cross-product is
   ever shown as a worked example; the cumulative spec shows prior checkpoints' rules/GWT prose but
   never prior literal expecteds.
3. **Interaction cases are held-out.** Every cross-product scenario is `visible:false`; target
   ≥ 50% held-out, concentrated on interaction cases.
4. Both arms receive identical cumulative spec text. The feedback arm's edge is unchanged because
   the feedback runner reads `oracle-package/cases.json` for pass/fail, never the spec text.

## Anti-shim gate (the load-bearing new gate; replaces billing-v3's marker-only gate 4)

Per contract-modifying CP (08′/11′/14′/15′/17′/18):
- **4a Call-graph routing (static):** assert the reference frozen entry point *calls* the new core
  and the old loop/builder body survives *only* inside the core (`{file, must_call,
  must_not_contain}`).
- **4b Shim-rejection (dynamic — the core proof that the rewrite is unavoidable):** construct a
  "shim baseline" = the CP(k−1) stage snapshot (frozen files verbatim) + the minimal additive patch
  a dodging agent would write (`g` beside frozen `f`, only the new query wired to `g`). Assert ≥1
  CP-k **visible** case FAILS. Made mechanical via an **identity-equivalence visible case** (e.g.
  `renderEntry(e, V1_SPEC) === serializeEntryV1(e)`; `allocateResidual(r,w,default)` shares used by
  the conversion path; `convertAmount(a,x,y,spotCtx) === oldSpotConvert(a,x,y)`): a shim that lets
  `f` and `g` diverge fails it; the intended rewrite passes it. **If any shim passes all visible
  cases, the gate fails and that CP is redesigned.**
- **4c Frozen-region-changed:** assert the frozen function's source region differs CP(k−1)→CP-k.

## Low-level-API oracle cases (zero runner change — generator-only)

The runner already honors per-case `entry_module`/`export`. Add `sLow(...)` cases that call
`convertAmount`, `allocateResidual`, `renderEntry`, `projectLedger`, `postAdjustment` directly
(identity visible, cross-products held-out), expected computed from the reference module export.
Blocks the facade-only/central-wrapper dedup dodge and reinforces 4b; sharpens the treatment arm's
feedback to the broken primitive. Facade `evaluate` cases remain (the realistic surface).

## Acceptance gates (must pass before seal)

1. **Package validity**: load/validate, fresh-mount OpenSpec scenario parity, all 18 checkpoints;
   per-file token ceiling ≤ 2400 est. tokens (carried from billing — the billing-v2 emission-budget
   defect must not recur).
2. **Reference proof**: scripted reference scores 100% cumulative hidden oracle at every checkpoint,
   both arms, over the enlarged case set (incl. low-level + held-out interaction cases).
3. **Naive-agent proof (re-aimed to generalizations)**: a plausible naive *generalization* per core
   (default rate-date; single omit-policy renderer; copy-don't-reallocate adjustment; tie-break-flip
   allocator; global-seq projection) produces **≥4 cross-checkpoint regressions across ≥3 files**,
   on-graph, AND **regressed ∩ visible = ∅** (every regression is an un-exemplified held-out
   interaction), AND the naive fixture **passes every visible case of the breaking checkpoint** (the
   control agent has no signal from visible text).
4. **Anti-shim gate** 4a/4b/4c above, per contract-modifying CP.
5. **Spine-threat (secondary)**: I-REPLAY perturbed by ≥10 of CP05–CP18 (defense-in-depth; not the
   primary lever).
6. **Frozen-baseline + shim-baseline**: CP(k−1)-correct workspace passes all ≤k−1 cases and fails
   only CP-k's new cases; the additive shim baseline passes ≤k−1 but fails ≥1 CP-k visible case.
7. **Mutation suite**: ≥3 per phase, ≥90% catch (target 100%), including interaction-routing
   mutations (rate-date default, renderer omit-policy, allocator tie/round, projection global-seq,
   adjustment in-place).
8. **Cost projection** within the operator ceiling for 18 CP × 2 arms × seeds.
9. **Predeclared frontier-probe interpretation** (in the Stage 1 plan): gate passes only if mean
   context regression-free AUC ≤ 0.92 AND ≥2 on-graph regressions AND failures are drift, not
   structural. Clean-ceiling and structural outcomes predeclared; **no third-ceiling closure
   precommitment for the ledger domain until a clean ledger probe exists** (do not pre-close a
   domain that hasn't been probed).

## Residual-risk audit (recorded honestly)

1. **Self-derived interaction tests (central residual):** a frontier model can write its own scratch
   tests; if it *reasons* "v1 must omit a zero residual line" and re-derives the correct expected, it
   self-detects. No fair task closes this (critique threat #1). Mitigation is **breadth**: ~5 cores ×
   ~3 surfaces ≈ 15 independent un-exemplified cross-products; perfect self-enumeration within the
   turn/verification/token budget is implausible, while any single miss is a control regression the
   feedback arm catches. The bound is probabilistic coverage, not a guarantee.
2. **Brute-force fuzzing with persistent scratch:** only helps if the model's re-derived oracle is
   itself correct — re-deriving every primitive correctly = solving the task unaided, an honest null,
   absorbed by the clean-ceiling rule.
3. **Hash self-reconstruction (billing-v3's fatal leak) — closed:** expecteds stripped, interaction
   hashes held-out; the hash is demoted to secondary.
4. **Facade-only fixing — mitigated** by low-level cases (§) + 4a routing + per-(primitive×caller)
   held-out interaction coverage in the entailment audit.
5. **Turn-economy confound (Stage 2 validity):** treatment's oracle execution is a free reasoning
   step — out of scope here; flagged for the Stage 2 plan (e.g. equalize scratch-execution budgets).

## Profile, metric, module layout

- Profile `e1-openspec-workflow-v0` (sealed 1.0.0) over base constants `e1-frontier-sealed-constants-v1.0.json` (sealed 1.0.0). Both arms in one OpenSpec workspace; executable feedback the only causal variable.
- Primary metric: `checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1` (regression-free AUC).
- Module layout (10 files, each ≤ 2400 est. tokens): `src/domain/accounts.ts`, `postings.ts`, `currency.ts`, `money.ts`, `periods.ts`, `reversals.ts`, `balance.ts`; `src/events/audit.ts` (registry + `replayStateHash` + `projectLedger`); `src/api/serializers.ts` (`renderEntry` v1/v2); `src/ledger.ts` (facade, `evaluate`).
- Oracle: `module-call-json-v1`, cases call `evaluate(events, query)` plus low-level module exports; expected computed from the sealed reference; ≥50% held-out.

## Governance

`e1-ledger-v1` is a fresh domain that **honors the billing-domain closure** — it does not reopen or
extend billing, and is never pooled with any billing/dispatch/subscription/inventory/payroll/
pricing run. It carries no third-ceiling precommitment until a clean ledger probe exists.

## Build order

1. This design boundary (committed before any task code) + an `AGENTS.md` "Current Scientific
   Direction" note recording the new ledger domain and that billing stays closed.
2. Reference implementation (10 files) with the five contract-modifying cores; CP01–CP04 seed; stage
   snapshots (cp04/cp09/cp14 analogs) + shim-baseline variants.
3. `oracle-package/scenarios.ts` (identity-visible + held-out interaction + low-level `sLow` +
   identity-equivalence cases) and `generate-cases.ts` (per-case `entry_module`/`export`).
4. `generate-visible-specs.ts` (strip expecteds; current-CP single-feature examples) + OpenSpec
   change requests CP05–CP18 stating each contract change ("re-express f via g; delete f's body").
5. `test/e1-ledger-v1.test.ts`: gates 1–9; gate 4b (shim-rejection) and gate 3 (`regressed ∩ visible
   = ∅`) are load-bearing.
6. Seal `e1-ledger-v1-commitments-v1.md`; author a Stage 1 frontier probe plan (DeepSeek V4 Pro
   and/or Qwen 3.7 Max, context arm). Provider runs remain operator-authorized only.
