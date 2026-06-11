# e1-billing-v2 build notes

Built 2026-06-10 against `docs/protocols/billing-v2-task-design-v1.md` (the precommitted design boundary). Layout: `reference/` (full reference implementation + stage snapshots + naive patches, never mounted), `oracle-package/` (sealed scenario definitions + generator + generated cases), `task-package/` (mounted task: CP01–CP04 seed, OpenSpec template state, generated visible specs, feedback assets).

## Generation pipeline (regenerate in this order)

1. `bun tasks/e1-billing-v2/oracle-package/generate-cases.ts` — computes every expected value from the reference implementation (never hand-written) and writes `oracle-package/cases.json` plus the per-checkpoint visible-case feedback assets.
2. `bun tasks/e1-billing-v2/generate-visible-specs.ts` — writes `task-package/visible-specs/CPnn.md` from hand-written GWT preambles + auto-extracted event/query field docs (from ALL cases, so hidden cases never use undocumented fields) + the visible cases quoted verbatim as worked examples. Entailment holds by construction.

## Interpretation decisions

- Usage amounts: `unit_price_cents × quantity_milli / 1000`, rounded half-even at line level.
- Proration: whole-day remainders on a fixed-length period carried by the events; credit (negative line) for unused old-plan days, charge (positive) for remaining new-plan days; downgrades never prorate.
- Discount base: sum of positive lines (plan, usage, proration_charge); credits receive no discount allocation.
- Views/v1 serialization use the legacy omits-zero style (zero-valued optional money fields and false flags are omitted entirely).
- Recomputing a finalized invoice writes a new document with id suffix `-r1`, `-r2`, …
- Entitlement: full (trialing/active), grace (past_due, attempts ≤ 2), none (attempts ≥ 3 or canceled).
- `replay_hash`: deterministic content hash of the folded state (no clocks, no randomness).

## Friction registry mapping (design doc rows → witnesses)

| Row | Spec acknowledgment | Assertions | Mutation witness |
| --- | --- | --- | --- |
| 1: v1 legacy field order, omits-zero, no new fields ever | CP04 + CP15 visible specs, README | `cp04-*`/`cp15-*` I-V1BYTES byte-equality cases | `A-v1-field-reorder`, `D-v1-gains-fields` — both caught |
| 2: largest-remainder allocation only | CP07 spec one-cent-remainder scenario + worked example | `cp07-alloc-remainder`, `cp07-alloc-equal-tie` (two equal lines, odd discount — the case per-line rounding cannot fake) | `B-per-line-discount-rounding` — caught after `cp07-alloc-equal-tie` was added (the original 152 cases missed it; recorded honestly here) |
| 3: deprecated `applyEvents` wrapper must keep working | README | hidden cases exercise `evaluate` (the fold); wrapper exported by the facade | wrapper covered structurally; removal breaks facade imports in spec runner |

## Gate results (test/e1-billing-v2.test.ts, all green)

1. Load + parity + full OpenSpec run: completed, 28/28 archives ok, fresh-mount parity ok.
2. Reference: 100% cumulative hidden oracle at every checkpoint, both arms, AUC 1.0.
3. Naive agent: exactly the two precommitted cross-checkpoint, cross-file regressions — CP05 I-TOTALS cases (prorated invoices) regress from CP07 (careless invoice subtotal rewrite in a coupons-era change), CP04 I-V1BYTES cases regress from CP15 (v1 "modernized" during the v2 serializer change). Naive AUC < 1.
4. Frozen baselines (k=5,10,15 from stage snapshots): pass everything ≤ k−1, fail ≥1 new case at k.
5. Mutation suite: 12 seeded mutations (3 per phase), 12/12 caught.

## Case inventory

153 oracle cases, 61 held-out (39.9%); 8–11 per checkpoint, ≥3 held-out each. All cases call `evaluate(events, query)` on `src/billing.ts`.

## Not done yet (before any provider run)

- Seal: freeze the package version + hashes, publish pre-run commitments.
- Operator authorization: isolated-competence diagnostics, then the Stage 1 frontier difficulty probe (gate: context AUC ≤ 0.92, ≥2 on-graph drift regressions), per the design doc.
