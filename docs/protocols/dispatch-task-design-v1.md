# e1-dispatch Task Design v1 (precommitted design boundary)

Date: 2026-06-12. Successor to the billing domain (closed 2026-06-11 under the
third-ceiling rule) and the sealed-build counterpart of the validated `e1-dispatch-mini`
mechanism probe. This document is the design boundary for the build: the build may
concretize business content within it but may not change mechanisms, the checkpoint
graph's correction structure, the partition ledger rules, or the gates. Any such change
requires a v2 of this document before the build is sealed.

## Evidence base (what this design is allowed to assume)

1. `e1-dispatch-mini` context arm (Qwen 3.7 Max, calibration, 2026-06-12): AUC 0.4403,
   24/49 cases never passed — all of them at the two scattered sites the agent never
   opened (`parse-order.ts`, `digest.ts`). Same model/harness/profile scored 0.9628 on
   billing-v3. Scattering + Contextual specs + no fragility warnings is the
   discriminator.
2. `e1-dispatch-mini` feedback arm (same day): AUC 0.8800, 49/49 final, zero
   never-passed. Turn records: every checkpoint with `bun run spec` runs touched all
   four scattered files and ended 1.00; both checkpoints without verification repeated
   the context arm's one-file-and-done behavior. Executability — not the worked
   examples' text, which both arms had — is the active affordance.
3. Mini produced **zero pass→fail flips** in both arms: untouched files cannot be
   botched, and the context agent barely touched files (7 turns / 6 checkpoints). A
   flip-type regression signal requires *rewrite pressure* — files the agent does touch
   must carry tangled earlier-pinned behavior, and must need touching repeatedly.
4. External priors (research synthesis, 2026-06-12): correction-type rounds carry ~4.7x
   the regression rate of extension rounds, with regression peaking immediately after
   the first corrections that interact with the agent's own implementations
   (EvoCode-Bench); scattering metrics predict defects up to R²≈0.93 (Eaddy);
   encode/decode pair contracts break one-sidedly in real agent patches (ICSE 2026);
   Contextual-level prompts (behavior named, files not) are the discriminating
   operating point.

## Task identity

- Task id `e1-dispatch`, version `e1-dispatch-v1`. Domain: order dispatch — lifecycle,
  partner export/import, operations digest. Disjoint from the closed billing domain.
- Protocol: E1 under `e1-openspec-workflow-v0` over sealed base constants v1.0,
  unchanged budgets (12 turns/checkpoint, 6 verification slots, 4000 output
  tokens/turn). Entry point `evaluate(events, query)` in `src/dispatch.ts`,
  `module-call-json-v1` oracle. `virtual_now` fixed; fully deterministic.
- 12 checkpoints. Mini's six (notes, digest revenue, returns, partial shipments,
  partial returns, cancel-after-shipment) plus six more continuing the same mechanism;
  ~140–170 oracle cases, ≥40% held out, every checkpoint ≥4 held-out cases.

## Mechanisms (M1–M4)

**M1 — Seeded scattered derivation (validated by mini, carried unchanged).** The seed
ships the effective-status logic in four knowledge sites: canonical (`src/orders.ts`),
inline copy in the exporter (`src/api/render-order.ts`), inline copy in the digest
(`src/notify/digest.ts`), and the status vocabulary list in the importer
(`src/api/parse-order.ts`). The duplication is seeded, never mentioned in README or
specs, and never consolidated by the reference. Every status-affecting checkpoint
requires propagation to all four sites; hidden cases cover each site each checkpoint.

**M2 — Contextual-level specs (validated by mini, carried unchanged).** Change requests
and visible specs name behavior ("everywhere a status is shown"), never files, never
sync obligations, never fragility warnings. Seeded disciplines (export field order +
omit-empty/false; digest lifecycle order + omit-empty; import vocabulary validation;
round-trip preservation) are stated once as behavioral requirements in the seed
spec-of-record and README data rules, in billing-README register but without any
"frozen/never/forever" vocabulary. Both arms see byte-identical text; the only arm
difference is the allowlisted runnable-case mount.

**M3 — Rewrite pressure (new; the flip-type channel mini lacked).** Three forcing
functions make files with earlier-pinned behavior get rewritten repeatedly:

- *Tangle growth in the canonical file.* Each extension adds event handling and status
  branches to `orders.ts` so its pinned surface (branch precedence: cancelled >
  payment > returned > shipped tiers; event validation; idempotent line updates)
  accumulates. By mid-task, every correction rewrite of `orders.ts` re-emits
  substantial earlier behavior from the model's reconstruction.
- *Vocabulary cadence.* Every correction adds a status token, so the importer's
  vocabulary list and both inline derivations need touching at every correction —
  in the feedback arm this is forced by red cases; in the context arm, omission feeds
  the never-pass channel instead. Both channels depress the same primary metric.
- *Emission-budget approach.* The reference's `orders.ts` grows to ≈2,100–2,300
  estimated tokens by CP12 (cap 2,400). An agent tracking the reference's shape must
  either re-emit an ever-larger file each touch or restructure it — both flip-rich
  operations. The reference itself stays single-file (no split), so restructuring is
  the agent's own choice, never demanded.

**M4 — Correction cadence on the monotone oracle.** Corrections (status semantics
changes on input partitions unseen by earlier corpora) at CP4, CP6, CP8, CP10, CP12 —
starting early per the EvoCode round-2 regression peak and the
late-hardness-cannot-regress lesson. Extensions at CP1–3, CP5, CP7, CP9, CP11 build
pinned surface between corrections.

## Checkpoint graph (build concretizes wording, not structure)

| CP | Type | Content (binding) | Sites demanded |
| --- | --- | --- | --- |
| seed | — | mini's CP00: lifecycle, export/import, count digest | all four seeded |
| 1 | ext | order notes through the round-trip | orders, render, parse |
| 2 | ext | digest revenue (`total_cents` per bucket) | digest |
| 3 | ext | line returns; full-return status | all four |
| 4 | **corr** | partial shipments → `partially_shipped` | all four |
| 5 | ext | shipment metadata (carrier, tracking) through export/import | orders, render, parse |
| 6 | **corr** | partial returns → `partially_returned` | all four |
| 7 | ext | partial payments: `partial_payment_received`, status `partially_paid` for orders paid above zero but below total | all four |
| 8 | **corr** | cancel-after-shipment → `cancelled_partial` + `requires_refund` export flag | all four |
| 9 | ext | refunds: `refund_issued` against returned lines; refunded marks through export/import; digest refund totals | all four |
| 10 | **corr** | fully returned **and** fully refunded → `closed` (returned-without-full-refund stays `returned`) | all four |
| 11 | ext | receivables digest: a **new** query reporting per-bucket `outstanding_cents` (total minus payments minus refunds), omitting settled buckets — a new query rather than an extension of `status_digest`, because outstanding is nonzero for most pre-CP11 corpora and adding the key to the existing digest would retire earlier pins | digest, orders |
| 12 | **corr** | unpaid orders cancelled after a partial payment → `cancelled_owing` + export flag (plain cancellation of never-paid orders unchanged) | all four |

Interaction-graph rule: every correction CP-k perturbs every earlier checkpoint that
pinned cases at any of the four sites; the build's committed graph lists these edges
explicitly, and on-graph classification for drift uses that graph.

## Partition ledger (era-stability law; the build's most safety-critical artifact)

The cumulative oracle never retires cases, so every corpus must be **era-stable**: the
final reference must give it the same answer the era-correct semantics give. Binding
rules:

1. A partition whose semantics CP-k corrects may not appear in any corpus of any case
   introduced before CP-k. Concretely: mixed shipments before CP4; partial returns
   before CP6; partial payments before CP7 (and `paid` corpora always pay in full);
   shipped-then-cancelled before CP8; refunds before CP9; full-refund-on-fully-returned
   before CP10; partial-payment-then-cancel before CP12 — all forbidden.
2. The ledger applies per order per corpus, including every order inside multi-order
   digest corpora.
3. New export/import fields and digest keys introduced at CP-k must be omitted-when-
   empty/false/zero so pre-CP-k corpora render identically before and after. Where a
   new value is nonzero for old corpora (CP11's outstanding amounts), it must ship as a
   **new query**, never as a key on an existing output.
4. Status-precedence overlaps between corrections (e.g., an order both shipped and
   partially paid, then cancelled: CP8's `cancelled_partial` vs CP12's
   `cancelled_owing`) are build-time precedence decisions; the combo partition is
   forbidden in all corpora before the later correction, and the chosen precedence is
   stated in that correction's change request.
5. The build maintains the ledger as a machine-checkable artifact (a corpus-linting
   script over `scenarios.ts`), and stage snapshots at the era boundaries (k = 4, 8,
   12) must score 100% on all cases introduced ≤ k−1 and fail ≥1 case at k. A ledger
   violation found after sealing voids the task version.

## Predicted failure channels (what the oracle must be able to attribute)

Never-pass (propagation) channels, validated live by mini: untouched importer
vocabulary → reimport cases red from introduction; untouched digest → digest cases red;
one-sided in-file updates (status token updated, flag omitted).

Flip channels, armed by M3 and witnessed by the mutation suite: digest
bucket-discipline slip (ordering/omit-empty) flips all earlier digest pins; vocabulary
regeneration dropping an old token flips earlier reimport pins; export field-order or
omit-discipline slip flips earlier export+reimport pins; canonical branch-precedence
botch during a correction rewrite flips earlier status pins; agent-initiated file
restructure under budget pressure can flip anything pinned in the touched files.

## Acceptance gates (all must pass before the commitments doc)

1. Package loads; fresh-mount parity; full OpenSpec archive pass in both arms.
2. Reference scores 100% on every case at every checkpoint, both arms (AUC 1.0).
3. **Omission proof** (replaces billing's naive proof, grounded in mini's observed
   behavior): a scripted fixture that updates only `orders.ts` + `render-order.ts` per
   checkpoint leaves ≥12 cases red across ≥2 scattered sites by CP12, while passing the
   canonical-site cases — propagation demand, not primary-logic difficulty.
4. **Botch proof** (the flip witness): a scripted fixture that touches all four sites
   but applies ≥2 of the flip channels (bucket reorder; vocabulary drop) produces ≥4
   pass→fail flips across ≥2 files at checkpoint-end scoring.
5. **Contextual-spec audit**: no visible spec, change request, or README sentence names
   a file for a correction, demands cross-file synchronization explicitly, or uses
   frozen/never vocabulary; mechanically checked (grep gate) plus human review.
6. Partition-ledger lint green; stage snapshots (k = 4, 8, 12) pass ≤k−1 / fail ≥1 at k.
7. Mutation suite ≥14 mutations, 100% caught, including one witness per flip channel.
8. Emission budget: every reference and seed file ≤2,400 estimated tokens; reference
   `orders.ts` ≥2,000 by CP12 (the pressure is part of the design, so its absence fails
   the gate).
9. Case budget: ≥140 cases, ≥40% held out, every checkpoint ≥1 visible and ≥1 held-out
   case per demanded site.

## Measurement and claim honesty (predeclared)

- Primary metric: sealed `checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1`
  (regression-free AUC), as in all E1 runs.
- Predeclared secondary descriptives, computed from `per_turn` case-level data: (a)
  pass→fail flip count at checkpoint end, (b) never-pass count at scattered sites, (c)
  files-touched-per-checkpoint profile. Claims must distinguish them: flips are
  regressions; never-passes are propagation failures; the public language may say
  "drift" only for the union, and may not call never-passes regressions.
- Known risk, predeclared: mini's context arm showed extreme under-effort (1.17
  turns/checkpoint, all early-done). If context-arm effort varies strongly across
  seeds, AUC variance rises; the paired design and ≥3 seed pairs are the mitigation,
  and effort profiles are reported alongside AUC.

## Run ladder after the build (each rung separately operator-authorized)

1. **Stage 1 difficulty probe** (sealed plan + commitments doc first): context arm,
   Qwen 3.7 Max via the DashScope-compatible route, up to 3 seeds with billing-v3's
   early-stop shape. Gate: AUC ≤ 0.92 and criterion-3 run shape. Mini's 0.44 predicts a
   pass with wide margin; if the sealed task nonetheless ceilings cleanly, one design
   revision (v2) is permitted before the dispatch domain closes for frontier claims.
2. **Stage 2 paired causal pilots**: ≥3 seed pairs, context vs feedback, identical
   boundary; MCID +0.05 paired AUC delta (mini's uncontrolled same-pair delta was
   +0.44); two-look group-sequential rule as in the pricing protocol; isolated
   competence runs precede Stage 2 as previously required.
3. Cost projection from mini's measured shape, scaled ×2.5 for 12 checkpoints and
   larger files: context ≈ $0.6, feedback ≈ $1.5 per run; full Stage 2 (3 pairs)
   ≈ $7–12. Caps set at 3× projection.

## Build order (for the executing model)

1. Reference `src/` final state, then seed as the CP00 reduction.
2. `scenarios.ts` + partition-ledger lint + case generator (expected values only from
   the reference).
3. Stage snapshots (k = 4, 8, 12) by reduction from the reference.
4. Visible-spec generator + OpenSpec template state (spec.md, 12 change requests).
5. Gates 1–9 as `test/e1-dispatch.test.ts`; omission and botch fixtures as code.
6. DESIGN-NOTES recording every concretization against this boundary.
7. Stop before any commitments doc or run plan: those are sealed separately.
