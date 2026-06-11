# Billing v3 Task Design (v1) — `e1-billing-v3`

Date: 2026-06-11. Status: design boundary, precommitted before any task code. Successor to
`billing-v2-task-design-v1.md` (+ amendments v2/v3) after the billing-v2 boundary closed as
a frontier context ceiling under two models: Sonnet 4.6 (probe v2, structural-flagged, AUC
0.9929, zero regressions) and Qwen 3.7 Max (probe v4, evidence-grade clean, AUC 0.9361,
zero regressions, early-stop applied). Run cards:
`e1-billing-v2-sonnet-context-probe-v2-seed-a-20260611.md`,
`e1-billing-v2-qwen37max-context-probe-v4-seed-a-20260611-001.md`. This design operates
under the same precommitted gates doc (`e1-first-evidence-task-design-gates-v0.md`: 5–10
files, 12–18 checkpoints, partial seed, hidden reference, naive-agent proof) and keeps the
billing domain, public API shape, and OpenSpec profile. It is a new task
(`tasks/e1-billing-v3/`), a new compatibility boundary, never pooled with any billing-v2
run.

## Evidence basis: what the v2/v4 probes established

1. **Late-introduced hardness cannot regress.** The empirically hardest invariant,
   I-REPLAY (deterministic replay hash), was introduced at CP17 over 16 checkpoints of
   accumulated state. Both frontier models failed all 8–9 hash checks from introduction —
   never-pass failures that drag AUC on the ceiling side but are structurally incapable of
   producing a pass→fail regression. The same holds for Qwen's CP16 I-IMMUT and CP09
   three-line I-ALLOC never-passes. Hardness placed late converts to AUC noise, not
   regression surface.
2. **Optional traps get dodged.** The v2 friction rows (CP07 discount over prorated lines,
   CP15 v1 byte-stability) created the *opportunity* to break frozen behavior, but the
   change requests never *forced* a rewrite of the file carrying it. Frontier models
   re-read the workspace snapshot and preserved code they were not required to touch. The
   naive-agent proof (≥2 scripted regressions) verifies the oracle can see regressions; it
   says nothing about whether a frontier model is ever pushed onto the regression surface.
3. **Cumulative scoring rewards late repair.** Qwen declared several checkpoints done in
   one turn and repaired the failures inside later checkpoints' budgets (CP05 dipped to
   76.7%, recovered to 100% by CP06 end). Checkpoint-end measurement is sealed and stays;
   the design lesson is that drift pressure must target behavior the model is *not*
   re-deriving every checkpoint — frozen quirks verified only by memory — rather than
   behavior the next checkpoint's spec restates.
4. **Verification scarcity binds.** Four checkpoints exhausted the 6-execution
   verification budget on the *new* feature, leaving previously-frozen surfaces verified
   only from memory. This is the honest mechanical opening for executable feedback to
   matter, and the design should make late checkpoints verification-hungry by content
   (numeric edge cases), never by ambiguity.

## Regression theory (predeclared)

Difficulty must come from drift pressure, never ambiguity. Four mechanisms, each tied to
the evidence above:

- **M1 — Seeded fragile spine.** `replayStateHash` (canonical state serialization + hash)
  is implemented *in the CP01–CP04 seed* and specified from CP01 with worked examples.
  Every state-extending checkpoint must extend the canonical field registry exactly as its
  change request specifies. The spine therefore passes from CP01 by construction and is
  threatened by nearly every later checkpoint: forgetting or misordering a registry entry
  during a whole-file rewrite breaks all prior hash checks — a true on-graph regression.
  This converts the empirically hardest invariant from never-pass (v2 placement) into
  easy-to-break (v3 placement). A hash is also the cleanest honest causal surface:
  trivially machine-checkable, near-impossible to verify by eyeball — exactly the
  asymmetry the feedback arm is hypothesized to exploit.
- **M2 — Forced structural rewrites of frozen-behavior files.** At least four late
  checkpoints ship change requests whose new behavior *requires restructuring a file that
  owns byte-frozen behavior* (CP13 audit query API → `audit.ts` under frozen I-SEQ +
  I-REPLAY; CP15 serializer registry → `serializers.ts` under frozen I-V1BYTES; CP17
  allocation generalization → `money.ts` under frozen I-ROUND/I-ALLOC/I-TOTALS; CP18
  idempotency generalization → `billing.ts`/`refunds.ts` under frozen I-REFCAP). Under
  4000-token turns and one-file-per-turn output discipline, the model must re-emit each
  frozen file in full while honoring constraints stated checkpoints earlier.
- **M3 — Plausible-improvement adjacency.** The frozen quirks survive from v2 (omits-zero
  v1 serialization, recompute `-rN` suffix, downgrade-never-prorates, percent-before-fixed
  stacking) and late change requests perform legitimate work *adjacent* to them, inviting
  "cleanup" of load-bearing oddities. Business-natural: every real billing codebase has
  these.
- **M4 — MODIFY-heavy spec deltas (secondary).** At least five CP10+ change requests are
  OpenSpec MODIFIED-requirement deltas over multi-scenario requirements, making the
  archive MODIFIED-replace surface live (scenario survival ledger stays a secondary
  descriptive metric, never the gate).

**Placement rule (binding):** any invariant judged frontier-hard to *achieve* must be
introduced by CP05 at the latest — or seeded — when state is small; checkpoints after
CP05 may only *perturb* it. Late checkpoints introduce pressure, not novel hardness.

## Profile

`e1-openspec-workflow-v0` (sealed 1.0.0) over base constants
`e1-frontier-sealed-constants-v1.0.json`, unchanged: both arms in the same OpenSpec
workspace, designer-authored change requests CP05+, harness archive at checkpoint end
identical in both arms, executable feedback the only causal variable. Primary metric:
sealed hidden-oracle `checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1`.

## Module layout (10 files, each <450 LOC and ≤2400 estimated tokens — v2 gate 6 carries over)

Carried from billing-v2's v2 split, which held under the output budget:
`src/domain/money.ts`, `src/domain/subscription.ts`, `src/domain/invoice.ts`,
`src/domain/proration.ts`, `src/domain/coupons.ts`, `src/domain/refunds.ts`,
`src/domain/dunning.ts`, `src/api/serializers.ts`, `src/events/audit.ts`, `src/billing.ts`
(facade). New v3 responsibility: the canonical state registry and `replayStateHash` live
in `src/events/audit.ts` (with the audit log), exposed through the facade. The seed README
keeps the v3 output-discipline section (one file per turn) verbatim.

## Public API contract (identical in both arms, visible from CP01)

As billing-v2 (`applyEvent`, `evaluate`, views, serializers, `auditLog`), with one change:
`replayStateHash(events): string` exists, is documented, and is seeded **from CP01**, not
introduced at CP17. `evaluate` remains the single oracle entry point with the same query
kinds including `replay_hash`.

## Canonical state registry and hash (fairness specification)

To keep M1 drift-only (zero ambiguity):

- The hash is FNV-1a 32-bit (lowercase hex) over a canonical serialization: aggregates in
  id order, fields per aggregate in the order listed in a **canonical field registry**
  documented in the seed README and maintained as code in `audit.ts`; omit-empty rules
  stated explicitly; integers serialized bare.
- The seed implements registry + hash correctly for all CP01–CP04 state.
- Every CP05+ change request that extends state includes (i) the exact registry additions
  (field names, aggregate, position) and (ii) a worked example: a short event list and its
  expected hash. Both arms see identical text. The feedback arm can execute the example;
  the context arm must maintain it by hand.
- Hidden hash cases per checkpoint re-run cumulatively, so a registry slip at CP-k flips
  prior checkpoints' hash checks from pass to fail (on-graph regression attributable to
  CP-k).

## Cross-cutting invariants (cumulative from introduction)

| ID | Invariant | Introduced |
| --- | --- | --- |
| I-SEQ | audit sequence numbers gap-free, monotonic per aggregate | CP01 (seed) |
| I-REPLAY | replay hash matches canonical registry serialization | CP01 (seed) |
| I-ROUND | line amounts rounded half-even at line level | CP02 (seed) |
| I-TOTALS | invoice total equals sum of rounded lines | CP02 (seed) |
| I-IDEM | duplicate event ids are no-ops | CP03 (seed), generalized CP18 |
| I-V1BYTES | v1 serialization byte-stable | CP04 (seed) |
| I-ALLOC | largest-remainder allocation over affected lines (≥3-line case from intro) | CP07 |
| I-STACK | percent coupon before fixed; caps respected | CP08 |
| I-REFCAP | refunds never exceed net captured per invoice | CP10 |
| I-STATE | lifecycle transitions only along the documented machine | CP01 (seed), extended CP12 |
| I-ENTITLE | entitlement derives from state + grace policy | CP12 |
| I-IMMUT | finalized invoices immutable; recompute creates `-rN` docs | CP16 |

The Qwen never-passes inform two placements: the three-line I-ALLOC case moves into CP07's
introduction (with a worked example) instead of appearing first at CP09; I-IMMUT keeps its
CP16 slot but gains a fully worked recompute example, and is perturbed afterward (CP17,
CP18) so an achieved pass is later threatened.

## Checkpoints CP01–CP18 with private interaction graph

"Perturbs" is the on-graph drift set for probe classification. Seed implements CP01–CP04
including the hash spine.

| CP | New behavior | Files touched | Perturbs (on-graph) |
| --- | --- | --- | --- |
| 01 | (seed) subscription creation + audit + canonical registry + `replayStateHash` | subscription, audit, billing | — |
| 02 | (seed) invoice generation | invoice, money | — |
| 03 | (seed) idempotent payment capture | billing, subscription | — |
| 04 | (seed) v1 invoice serialization | serializers | — |
| 05 | mid-period upgrade proration | proration, invoice, money | CP02 I-TOTALS/I-ROUND, CP04 I-V1BYTES, CP01 I-REPLAY (registry: scheduled change, proration lines) |
| 06 | downgrade at period end (never prorates) | subscription | CP01 I-STATE/I-SEQ/I-REPLAY, CP05 |
| 07 | percent coupon with duration; I-ALLOC incl. three-line remainder | coupons, invoice, money | CP02 I-TOTALS, CP05 prorated discounts, CP01 I-REPLAY |
| 08 | fixed coupon stacking (I-STACK) | coupons | CP07 I-ALLOC/order, CP02 I-TOTALS, CP01 I-REPLAY |
| 09 | plan change while coupon active | proration, coupons | CP05+CP07 jointly, CP01 I-REPLAY |
| 10 | partial refunds (I-REFCAP) | refunds, billing | CP03 captures, CP01 I-SEQ/I-REPLAY |
| 11 | discount allocation on refunded prorated lines | refunds, coupons, money | CP07 I-ALLOC, CP10 I-REFCAP, CP05, CP01 I-REPLAY |
| 12 | dunning on payment failure + entitlement gating (I-STATE ext., I-ENTITLE) | dunning, subscription, billing | CP01 I-STATE, CP03, CP06 (scheduled downgrade while past_due), CP01 I-REPLAY |
| 13 | **audit query API (pagination + type filters) — forces `audit.ts` restructure** | audit, billing | CP01 I-SEQ + I-REPLAY frozen across ALL features, CP10/CP12 event records |
| 14 | cancellation during dunning | dunning, subscription | CP06 (cancel vs scheduled change), CP12, CP01 I-REPLAY |
| 15 | **v2 serializer via serializer-registry restructure of `serializers.ts`** | serializers | CP04 I-V1BYTES, CP05/07/10 line serialization |
| 16 | finalized-invoice immutability; recompute `-rN` (I-IMMUT) | invoice, billing | CP02/05/07/11 recompute paths, CP01 I-REPLAY (recompute docs in state) |
| 17 | **weighted allocation generalization — forces `money.ts` restructure** | money | CP02 I-ROUND/I-TOTALS, CP07/CP11 I-ALLOC, CP05 amounts, CP01 I-REPLAY (line amounts in state) |
| 18 | generalized duplicate-event idempotency (MODIFIES CP03 requirement) | billing, refunds, dunning | CP03 generalized, CP10 I-REFCAP accounting, CP12 failure counts, CP16 I-IMMUT (duplicate recompute), CP01 I-REPLAY |

I-REPLAY perturbation count: 13 of CP05–CP18 (all except CP15). Forced frozen-file
rewrites: CP13, CP15, CP17, CP18 (plus CP16 rewrites `invoice.ts` under frozen I-TOTALS).
MODIFIED-requirement deltas: CP12, CP14, CP15, CP16, CP18.

## Friction registry (sealed before build; every row needs spec text + assertions + mutation coverage)

| # | Friction | Visible acknowledgment | Covering assertions | Mutation proof |
| --- | --- | --- | --- | --- |
| 1 | v1 serializer legacy field order + omits-zero must never change | README + CP04 spec | CP04/CP15 byte-equality cases | v1 field reorder caught |
| 2 | `money.allocate` largest-remainder is the only sanctioned split; per-line rounding drifts | CP07 spec worked example (3-line, 1-cent remainder) | CP07/CP11/CP17 adversarial-remainder cases | per-line-rounding mutation caught |
| 3 | deprecated `applyEvents` wrapper must keep working | README line | hidden `evaluate` cases + one visible wrapper scenario | wrapper removal caught |
| 4 | canonical field registry order is append-only per change-request instructions; hash breaks on deviation | README + every state-extending CP's registry delta + worked hash | cumulative `replay_hash` cases at every checkpoint | registry reorder and omitted-field mutations caught |
| 5 | audit storage may be restructured (CP13) but `auditLog` output and sequence numbering are byte-frozen | CP13 change request states the freeze explicitly | cumulative I-SEQ + audit-log cases | seq renumbering mutation caught |

No other intentional friction. Difficulty must come from cumulative cross-file
interaction, never ambiguity.

## Oracle strategy

Unchanged from billing-v2: `module-call-json-v1` cases all calling `evaluate(events,
query)`; generated from the sealed reference by a parameterized generator; ≥30% held-out
per checkpoint; entailment audit (every visible runnable assertion maps to visible spec
text or worked examples). New: every checkpoint CP01–CP18 carries cumulative `replay_hash`
cases (visible worked example + held-out variants).

## Acceptance gates before seal (strengthened from the gates doc)

1. **Package validity**: load/validate, fresh-mount parity incl. OpenSpec scenario parity,
   all 18 checkpoints; gate 6 token ceiling (≤2400 est. tokens per source file) holds.
2. **Reference proof**: scripted reference agent scores 100% cumulative hidden oracle at
   every checkpoint, zero regressions.
3. **Naive-agent discrimination proof (strengthened)**: a plausible-but-careless scripted
   fixture produces **≥4 true cross-checkpoint regressions across ≥3 distinct frozen
   files**, exact regression set asserted in tests. Planned: (a) CP07 discount ignoring
   prorated lines → CP05 I-TOTALS; (b) CP13 audit restructure renumbering sequences →
   CP01 I-SEQ + I-REPLAY; (c) CP15 v1 serializer "modernized" → CP04 I-V1BYTES; (d) CP17
   per-line proportional rounding → CP07/CP11 I-ALLOC; (e) CP18 dedup reset → CP10
   I-REFCAP.
4. **Forced-touch audit (new)**: a committed table proving each of CP13/CP15/CP16/CP17/
   CP18 cannot satisfy its own visible cases without rewriting the named frozen-invariant
   file (e.g., the new behavior's entry points live in that file in the seed layout).
5. **Spine-threat audit (new)**: ≥10 of CP05–CP18 are on-graph I-REPLAY perturbations
   with registry deltas + worked hashes in their change requests (per the table: 13).
6. **Frozen-baseline check**: workspace correct through CP(k−1) fails CP(k)'s new checks
   and passes all old checks, for every k.
7. **Mutation suite**: 3–5 seeded plausible regressions per phase, catch rate ≥90%,
   including registry-slip and seq-renumber mutations (friction rows 4–5).
8. **Cost projection**: from measured v4 run shape (88 turns, $3.28 at Qwen/DashScope
   prices), 18 checkpoints × 2 arms × seeds within the operator ceiling including the
   worst-case Stage B reserve.
9. **Predeclared frontier-probe interpretation**: gate passes only if mean context
   regression-free AUC ≤ 0.92 AND ≥2 on-graph regressions per run AND failures are drift,
   not structural (stall flags, `output_truncated_turn_rate` ≤ 0.10, no 3+ consecutive
   length terminations, real multi-file edits). Ceiling and structural outcomes as in the
   v4 plan. **Third-ceiling closure rule (new): if this task also ceilings under a clean
   frontier probe, the billing domain closes for frontier discrimination claims, and the
   result is published as boundary evidence ("frontier models maintained regression-free
   performance under N cumulative cross-file checkpoints with forced rewrites") — not
   retried with a fourth billing variant.**

## Build order

1. Reference implementation deltas from billing-v2: seeded hash spine (registry +
   `replayStateHash` in `audit.ts` from CP01), CP07 three-line I-ALLOC at introduction,
   CP12 merge (dunning + entitlement), CP13 audit query API, CP17 weighted allocation,
   CP18 idempotency generalization; stage snapshots for frozen baselines.
2. Oracle case generator + cases (visible-entailed + held-out, cumulative `replay_hash`
   at every checkpoint).
3. Visible specs + OpenSpec template state (seed spec-of-record CP01–CP04; change
   requests CP05–CP18 with registry deltas, worked hashes, and MODIFIED-requirement
   deltas per the table).
4. Scripted reference + naive fixtures; gates 1–8 as tests.
5. Seal: task version `e1-billing-v3-v1`, commitments doc with hashes, then separate
   operator authorizations for any provider run (difficulty probe first, under its own
   sealed plan).
