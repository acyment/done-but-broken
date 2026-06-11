# e1-billing-v3 build notes

Built 2026-06-11 against `docs/protocols/billing-v3-task-design-v1.md` (the precommitted
design boundary), as the successor to billing-v2 after its double frontier context
ceiling. Layout mirrors billing-v2: `reference/` (full reference + stage snapshots, never
mounted), `oracle-package/` (sealed scenarios + generator + generated cases),
`task-package/` (mounted task: CP01–CP04 seed including the hash spine, OpenSpec template
state, generated visible specs, feedback assets).

## Generation pipeline (regenerate in this order)

1. `bun tasks/e1-billing-v3/oracle-package/generate-cases.ts`
2. `bun tasks/e1-billing-v3/generate-visible-specs.ts`

## The seeded fragile spine (mechanism M1)

`replayStateHash` = FNV-1a 32-bit over a **canonical registry rendering** maintained in
`src/events/audit.ts`: sections in registry order, aggregate ids sorted bytewise, fields
in registry order (deliberately NOT alphabetical and NOT the TS type order), and empty
values (null, false, 0, "", [], {}) omitted — the same omits-empty discipline as the v1
serializer. The registry is append-only; every state-extending change request names its
exact additions. Era stability is by construction: the renderer emits only registered
fields (agent bookkeeping invisible) and omit-empty hides later-registered defaults, so
the final reference, the seed, and every stage snapshot produce identical hashes for
earlier checkpoints' event lists (verified by gate 2 reference 100% and gate 6 frozen
baselines). Replay-hash cases are introduced at **every** checkpoint (36 total, visible
worked example + held-out at each), so a registry slip at CP-k flips earlier passes into
on-graph regressions.

Derived state excluded from the rendering: `applied_event_ids` (seeded rule) and the CP13
feed (stated in the CP13 change request).

## Concretizations vs the sealed design doc (recorded honestly)

- **CP13 "audit query API (pagination + type filters)"** is concretized as a global
  chronological audit feed (`audit_feed` query: `after_feed_seq`, `event_types` filter
  before `limit`, global gap-free `feed_seq`) maintained in `audit.ts` alongside the
  per-aggregate log. The feed is derived presentation state and is excluded from the
  canonical registry, so CP13 ships **no registry delta** — its I-REPLAY perturbation
  pressure comes from rewriting the file that owns the registry/renderer, and its I-SEQ
  trap is the renumbering of per-aggregate seq from the global counter.
- **CP17 "weighted allocation generalization"** is concretized as the trace-returning
  weighted allocator (`allocateLargestRemainderTrace` in `money.ts`; frozen shares-only
  `allocateLargestRemainder` delegates to it) plus the `allocation_trace` query
  (per-line weight, floor, raw remainder, extra cents, share; empty parts when
  undiscounted; explicit fields, not a legacy view).
- **Gate 5 phrasing**: the design doc's "≥10 of CP05–CP18 are on-graph I-REPLAY
  perturbations with registry deltas + worked hashes" is implemented as three separate
  assertions: (i) the committed graph lists ≥10 I-REPLAY-perturbing checkpoints (13: all
  of CP05–CP18 except CP15); (ii) every checkpoint CP01–CP18 carries ≥1 visible and ≥1
  held-out replay-hash case; (iii) all 7 state-extending checkpoints (CP05/06/07/10/12/
  14/16) name their registry delta in the change request. Worked hash examples live in
  the visible specs (the visible replay cases are auto-quoted verbatim); registry deltas
  appear in both the proposals and the visible-spec preambles. Both arms see identical
  text in all cases.
- **CP18 forced-touch honesty**: duplicate-event handling is global in the seed
  (`applied_event_ids` check in `applyEvent`), so CP18's pressure is the MODIFY-heavy
  spec delta and the naive refactor trap (refund-cap off-by-one), not a forced file
  touch. The forced-touch gate (gate 4) covers CP13→`audit.ts`, CP15→`serializers.ts`,
  CP16→`invoice.ts`, CP17→`money.ts`.
- **CP12 merge**: dunning entry/recovery and entitlement gating land together (v2's
  CP12+CP13), freeing the CP13 slot for the feed.
- **CP07** introduces the three-positive-line allocation case at the invariant's
  introduction (it first appeared at CP09 in billing-v2 and was never passed by Qwen).

## Gate results (test/e1-billing-v3.test.ts, all green; full suite 367/367)

1. Load + parity + full OpenSpec run: 28/28 archives ok, fresh-mount parity ok.
2. Reference: 100% cumulative hidden oracle at every checkpoint, both arms, AUC 1.0 —
   including all 36 replay-hash cases across registry eras.
3. Naive proof (strengthened): **5 mechanisms across 5 files**, all asserted:
   (a) CP07 invoice.ts subtotal forgets proration lines → CP05 I-TOTALS;
   (b) CP13 audit.ts renumbers per-aggregate seq from the feed counter → pre-CP13 I-SEQ
   **and** I-REPLAY (hashes render seq);
   (c) CP15 serializers.ts v1 "modernized" with new fields → CP04+ I-V1BYTES;
   (d) CP17 money.ts proportional rounding replaces largest-remainder → CP07/CP11
   I-ALLOC;
   (e) CP18 refunds.ts exact-cap off-by-one → CP10/CP11 I-REFCAP.
   ≥4 regressed checks across ≥3 mechanisms asserted; reference shows none.
4. Forced-touch audit: reference has / seed lacks the marker entry points for
   CP13/15/16/17, each with visible demand.
5. Spine-threat audit: 13 I-REPLAY perturbing checkpoints; visible + held-out replay
   cases at every checkpoint; registry deltas named in all 7 state-extending proposals.
6. Frozen baselines (k=5,10,15 from stage snapshots, including era-correct registry
   variants `audit.cp04/cp09/cp14`): pass everything ≤ k−1 (hash cases included), fail
   ≥1 new case at k.
7. Mutation suite: **17 mutations, 17/17 caught**, ≥3 per phase, including the new
   registry-reorder, registry-drops-field, feed-seq-renumber, feed-starts-at-zero, and
   trace-tie-break witnesses.
8. Emission budget: every reference and seed file ≤ 2400 estimated tokens (largest:
   reference `invoice.ts` at 1,734; the spine file `audit.ts` at 1,442).

## Case inventory

197 oracle cases, 82 held-out (41.6%); every checkpoint ≥4 held-out. 36 I-REPLAY cases
(one visible + one held-out minimum per checkpoint). Entry point unchanged:
`evaluate(events, query)` on `src/billing.ts`, with new query kinds `audit_feed` and
`allocation_trace`.

## Not done yet (before any provider run)

- Commitments document (`e1-billing-v3-commitments-v1.md`) sealing package/design hashes.
- Sealed Stage 1 probe plan (model, route, budgets, gate, early-stop) + operator
  authorization. The billing-v2 third-ceiling closure rule applies: if this task also
  ceilings under a clean frontier probe, the billing domain closes for frontier
  discrimination claims.
