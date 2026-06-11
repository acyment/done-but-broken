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

## v2 (2026-06-11): emission-budget split

The v1 Stage 1 probe returned the predeclared structural verdict (run card
`docs/run-cards/e1-billing-v2-sonnet-context-probe-seed-a-20260611.md`): the reference
`src/billing.ts` (~4,063 estimated tokens) exceeded the sealed 4000-output-token turn
budget, so under full-file replacement the canonical solution was inexpressible in one
turn and CP07–CP14 stalled on `finish_reason=length`. Per the precommitted amendment
(`docs/protocols/billing-v2-task-design-v2.md`), `billing.ts` split into four modules —
`billing-types.ts` (state/types/guards), `billing-invoice-handlers.ts`,
`billing-handlers.ts` (subscription/coupon handlers + dispatch), and the `billing.ts`
facade (fold + views + `evaluate`) — in the reference, the CP01–CP04 seed, and the
cp04/cp09/cp14 stage variants. Build correction recorded honestly: the first-drafted
three-way split left the combined handlers at 2,557 tokens, above the gate, so it split
once more along the subscription/invoice seam before commitments.

Behavioral invariance is proven by construction and generation: regenerated `cases.json`
is byte-identical (153 cases, 39.9% held-out) and the visible specs are unchanged. New
gate 6 enforces every reference and seed source file ≤ 2400 estimated tokens (largest:
reference `billing-handlers.ts` at 1,372). The seed README now documents the split layout
and instructs the agent to keep files within the one-turn rewrite budget. Task version:
`e1-billing-v2-v2` (task.json + oracle.json); the v1 oracle carries over because no
evidence package was published against the v1 commitments.

## v3 (2026-06-11): output-discipline instruction

The v2 Stage 1 probe returned the predeclared structural verdict again with a new
mechanism (run card
`docs/run-cards/e1-billing-v2-sonnet-context-probe-v2-seed-a-20260611.md`): the per-file
ceiling was fixed (gate 6 held), but the agent batched multiple modules into single
responses (~4,400+ tokens of code vs the 4000-token cap), losing 22/86 turns to
`finish_reason=length` (`output_truncated_turn_rate=0.2558`; CP07 opened with 4
consecutive truncated turns). Per the precommitted amendment
(`docs/protocols/billing-v2-task-design-v3.md`, Amendment 5), the seed README gains an
explicit output-discipline section: output is hard-capped, truncated file blocks are
discarded, rewrite at most one source file per turn. Source files, specs, change
requests, stage variants, and oracle cases are byte-identical to v2; only the README and
`task_version` fields changed. Task version: `e1-billing-v2-v3`. The oracle carries over
again (no evidence package was published against v2 commitments).

Notable v2-probe observations recorded in the run card: zero cross-checkpoint regressions
despite the truncation chaos (directional evidence the v3 probe may return a
context-ceiling boundary result), and the CP17 replay-hash checks failing from
introduction (prose-spec hardness, 0 truncations, verification budget exhausted). The v3
plan adds a predeclared early-stop rule for the ceiling case.

## Not done yet (before any provider run)

- Operator authorization for the v3 Stage 1 frontier difficulty probe
  (`docs/protocols/e1-billing-v2-stage1-plan-v3.md`, commitments
  `e1-billing-v2-commitments-v3.md`).
