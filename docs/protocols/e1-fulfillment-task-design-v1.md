# e1-fulfillment Task Design v1 (frozen design boundary)

Date: 2026-06-12. **Status: reviewed and frozen 2026-06-12** after a design review
pass against `docs/protocols/e1-first-evidence-task-design-gates-v0.md` (review
amendments: OpenSpec canonicalizable-prose authoring constraint added; predeclared
frontier-probe interpretation rule added; M5 no-ambiguity defense strengthened to
state registry authority in the seed spec-of-record). This document is the design
boundary for the build: the build may concretize business content within it but may
not change mechanisms, the checkpoint graph's correction structure, the partition
ledger rules, or the gates; any such change requires a v2 of this document before
sealing. **No commitments document exists yet; no run may reference this document
until `e1-fulfillment-v1-commitments-v1.md` is sealed.**

This is a **new task family**, not a revision of `e1-dispatch-v1`. The dispatch
domain remains open and valid for Qwen-tier evidence; its sealed Stage 1 plan permits
an `e1-dispatch-v2` only after domain close (three ceiling seeds — DeepSeek V4 Pro
has one of three). e1-fulfillment is a separate, non-pooled compatibility boundary
targeting the frontier-hardness question.

## Evidence base (what this design is allowed to assume)

1. `e1-dispatch-v1` Qwen 3.7 Max: Stage 1 context AUC 0.7284; Stage 2 paired feedback
   delta +0.1464 mean. The scattered-propagation mechanism works at this tier.
2. `e1-dispatch-deepseek-v4-pro-context-stage1-seed-a-20260612-001` (calibration):
   context AUC 0.9768 at 8.0 mean turns/checkpoint. High natural turn-investment
   rediscovers the 4 scattered sites without feedback. The 8 never-passes sit exactly
   at the 3 `budget_exhausted` checkpoints (CP07/09/11): the failure mode at this
   tier is **budget exhaustion under a wide scattered surface**, not discovery
   inability per se.
3. `e1-dispatch-mini` (Qwen 3.7 Max): context 0.4403 vs feedback 0.8800 on identical
   visible content — executability, not example text, is the active affordance.
4. Research synthesis `docs/research/executable-feedback-frontier-hardness-synthesis-v1.md`:
   the frontier ceiling is a redundancy effect (feedback utilization rises with
   capability); the levers that reopen the failure mode are repo-inferable scope,
   more independent obligations, sequential poisoning, and brute-force-insufficient
   turn economy. The content-asymmetric "decoy" lever is rejected (parity); its
   temporal form (poison chains) is adopted.
5. Billing-v3 lesson (late hardness cannot regress): all hard invariant chains must
   be live early — nothing hard introduced after mid-task; late difficulty must be
   regression/poison surface, not never-pass noise.

**Core diagnosis designed against.** DeepSeek V4 Pro defeated v1 because (a) the
per-site visible worked examples enumerate the full surface, so undirected 8-turn
investment rediscovers it, and (b) flat 4-site dispersion leaves ~7 slack turns for
blind iteration. The successor keeps strict content parity (no enumeration hiding)
and instead pushes the *minimum directed write cost* at hard corrections close
enough to the 12-turn budget that undirected discovery does not fit while directed
execution does, and adds cross-checkpoint poison so under-scoped fixes that look
locally complete in both arms fail later-introduced cases.

## Task identity

- Task id `e1-fulfillment`, version `e1-fulfillment-v1`. Domain: multi-channel
  fulfillment hub — order lifecycle, per-channel partner/ops export, partner import,
  operations digest, threshold alerts, append-only audit journal. Disjoint from the
  dispatch and billing domains.
- Protocol: E1 under `e1-openspec-workflow-v0` over sealed base constants v1.0,
  unchanged budgets (12 turns/checkpoint, 6 verification slots, 4000 output
  tokens/turn). Entry point `evaluate(events, query)` in `src/fulfillment.ts`,
  `module-call-json-v1` oracle. `virtual_now` fixed; fully deterministic.
- 12 checkpoints; ~170–190 oracle cases (hard cap 190), ≥40% held out, every
  checkpoint ≥4 held-out cases, ≥1 held-out case per demanded site (multi-order
  corpora may count toward several sites via the site map).
- **Strict content parity (binding):** visible worked examples and feedback runnable
  cases are content-identical per checkpoint, as in v1. The only arm difference is
  the allowlisted runnable-case mount and the `bun run spec` command. Treatment =
  executability alone.
- **OpenSpec authoring constraint (design-gates checklist item 6):** all scenario
  authoring in the spec-of-record and change requests is restricted to
  canonicalizable Given/When/Then prose — no tables or docstrings without a clean
  prose equivalent — so canonical scenario parity holds under
  `e1-openspec-workflow-v0`.

## Mechanisms (M1–M7)

**M1 — Seeded scattered derivation, widened to 9 obligation classes (v1 M1
extended).** The seed ships status/lifecycle knowledge in five derivation copies —
canonical (`src/orders.ts`), partner exporter (`src/api/render-partner.ts`), ops
exporter (`src/api/render-ops.ts`), digest (`src/notify/digest.ts`), alerts
(`src/notify/alerts.ts`) — plus three structural sites: importer vocabulary
(`src/api/parse-partner.ts`), journal field registry (`src/audit/journal.ts`), and
channel registry capability flags (`src/api/channel-registry.ts`). Obligation
classes (distinct justifications): O1 canonical derivation, O2/O3 per-channel render
disciplines (deliberately non-uniform field order/omit rules), O4 import vocabulary +
round-trip, O5 digest bucket order/omit, O6 alert thresholds over digest buckets, O7
journal serialization, O8 registry capability quantification, O9 journal replay
queries. Duplication is seeded, never mentioned in checkpoint specs, never
consolidated by the reference.

**M2 — Contextual-level specs (v1 M2 carried unchanged, grep gate verbatim).**
Change requests and visible specs name behavior ("everywhere a status is shown",
"every export channel", "the journal records every order state change"), never
files, never sync obligations, never fragility warnings. Both arms see byte-identical
text.

**M3 — Rewrite pressure (v1 M3 carried).** `orders.ts` grows toward the 2,400-token
emission cap (≥2,000 by CP12); the journal field registry grows at every
state-extending checkpoint; vocabulary cadence at every correction. One-file-per-turn
output discipline stays in the README.

**M4 — Correction cadence with early hard invariants (v1 M4 + billing-v3 lesson).**
Corrections at CP4, CP6, CP8, CP10, CP12. All hard invariant chains (journal spine,
alerts–digest consistency, registry quantification, import vocabulary) are live by
CP5; nothing structurally new after CP7. Every correction from CP4 onward perturbs
pre-existing pinned surface.

**M5 — Registry-scoped obligations (new; synthesis levers 1 and 8).**
`src/api/channel-registry.ts` is the authoritative enumeration of export channels
with per-channel capability flags (which channels carry refund-class flags, which
field sets each renders). The facade dispatches `export_channel` queries through the
registry; the registry is never imported by the spec-salient files the agent is
naturally drawn to edit (`orders.ts`, the renderers). Spec sentences quantify over it
("every export channel"; "channels whose registry entry carries the refund
capability"). No-ambiguity defense (three layers): (1) the **seed spec-of-record
states the registry's authority as a behavioral requirement** — "the set of export
channels and their capabilities is defined by the channel registry" — so every
registry-scoped hidden case tests behavior implied by the visible semantic spec,
not by repo archaeology; (2) the seed README names the registry as the
authoritative channel list (seed documentation, in the established README register —
not per-checkpoint hinting), and the registry is ~40 lines of declarative TS; (3)
DESIGN-NOTES must record a written derivation chain (spec sentence → spec-of-record
authority clause → registry entry → renderer code path) for every registry-scoped
obligation.

**M6 — Invariant chains / temporal poison (new; synthesis lever 3 — the
parity-clean decoy).** Two chains, both live before CP3:

- *Journal spine.* `journal.ts` holds a canonical field-serialization registry
  exercised from CP1. Each state-extending checkpoint must extend it. An under-scoped
  fix at CPk (canonical status updated, journal not) passes **all** CPk-local cases —
  visible and hidden, both arms — and fails cases introduced at CPk+n whose corpora
  are computed from journal replay (CP11's receivables/aging query replays mixed
  histories). Era-stable by construction: poison payoffs are new cases at CPk+n,
  never retroactive edits to earlier cases.
- *Alerts–digest consistency.* `alerts.ts` thresholds are defined over the same
  lifecycle buckets as `digest.ts`. A bucket added in the digest without the alert
  surface fails alert cases the first time that bucket crosses a threshold partition,
  at the same or a later checkpoint.

Committed interaction graph must list the poison edges explicitly: CP7→CP11,
CP9→CP10/CP11, CP4/CP6→CP7 (plus the v1-style correction-perturbs-earlier-pins
edges).

**M7 — Turn-economy binding (new; synthesis lever 4).** Hard corrections (CP6, CP8,
CP10, CP12) demand 7–8 files. Under the one-file-per-turn output discipline plus the
OpenSpec delta-authoring turn, a *directed* agent needs 8–9 write turns — fitting the
12-turn budget with 3–4 turns of read/verify slack — while an *undirected* agent must
additionally spend discovery turns on which of 10 files carry obligations, which
DeepSeek V4 Pro's observed v1 behavior (7–12 turns at 4-site checkpoints) indicates
exceeds 12. Feedback's causal value becomes redirection: one `bun run spec`
execution returns the red-case list (cases name behaviors/queries/channels, never
files), collapsing discovery cost. Corrections are token-swap-heavy per-file edits,
not structural rewrites, so the directed path stays within budget (gated below in
both directions).

## Workspace shape (10 files; at the 5–10 design-gate limit)

| File | Role | Obligation class |
| --- | --- | --- |
| `src/fulfillment.ts` | facade; dispatches `export_channel` via the registry | — |
| `src/fulfillment-types.ts` | event/query types, guards | — |
| `src/orders.ts` | canonical lifecycle + status derivation (grows to ≈2,200 tokens) | O1 |
| `src/api/channel-registry.ts` | authoritative channel list + capability flags + per-channel field sets | O8 |
| `src/api/render-partner.ts` | partner exporter; inline status copy; fixed field order/omit | O2 |
| `src/api/render-ops.ts` | ops exporter; inline copy; *different* field discipline; seeded registered-but-inactive, activated CP5 | O3 |
| `src/api/parse-partner.ts` | importer; vocabulary list; round-trip preservation | O4 |
| `src/notify/digest.ts` | bucket digest; lifecycle order + omit-empty; inline copy | O5 |
| `src/notify/alerts.ts` | threshold alerts over digest buckets; inline copy | O6 |
| `src/audit/journal.ts` | append-only journal; canonical field registry; replay queries | O7, O9 |

Per-channel disciplines are deliberately non-uniform (different field orders,
different registry flags) so a consolidating refactor cannot serve all sites without
per-site adapters — limiting (without forbidding) the consolidation escape.

## Checkpoint graph (build concretizes wording, not structure)

Sites abbreviated: O=orders, RP/RO=render-partner/ops, PP=parse-partner,
CR=channel-registry, D=digest, A=alerts, J=journal, F=fulfillment facade.

| CP | Type | Content (binding) | Files demanded | Dispersion |
| --- | --- | --- | --- | --- |
| seed | — | lifecycle, partner export/import, count digest, journal spine, alert skeleton, registry (ops channel inactive) | all seeded | — |
| 1 | ext | order notes through round-trip, journaled | O, RP, PP, J | 4 |
| 2 | ext | digest revenue + overdue-payment alerts | D, A, O | 3 |
| 3 | ext | line returns → `returned` | O, RP, PP, D, A, J | 6 |
| 4 | **corr** | partial shipments → `partially_shipped` | O, RP, PP, D, A, J | 6 |
| 5 | ext | activate ops channel (registry flag + renderer live) | CR, RO | 2 |
| 6 | **corr** | partial returns → `partially_returned` | O, RP, RO, PP, D, A, J | 7 |
| 7 | ext | partial payments → `partially_paid`; owing alerts; journaled amounts | O, PP, D, A, J, RP | 6 |
| 8 | **corr** | cancel-after-shipment → `cancelled_partial` + registry-gated `requires_refund` per channel | O, RP, RO, PP, CR, D, A, J | 8 |
| 9 | ext | refunds; refund marks across channels; digest refund totals | O, RP, RO, PP, D, A, J | 7 |
| 10 | **corr** | fully returned **and** fully refunded → `closed` | O, RP, RO, PP, D, A, J | 7 |
| 11 | ext | receivables/aging query computed from **journal replay** (poison payoff) | J, F | 2 |
| 12 | **corr** | cancelled-after-partial-payment → `cancelled_owing` + registry-gated flag | O, RP, RO, PP, CR, D, A, J | 8 |

Mean dispersion ≈ 5.5 (v1 ≈ 3.7). CP5 and CP11 are low-file-count breathers; CP11 is
the poison collector — reasoning-heavy, where v1's budget killer lived, now made
diagnostic of earlier under-scoping rather than of raw budget.

## Partition ledger (era-stability law; carried from v1 structurally)

The cumulative oracle never retires cases; every corpus must be era-stable. The v1
binding rules carry over (forbidden partitions before their introduction checkpoint;
per-order-per-corpus application including multi-order digest/journal corpora;
new fields/keys omitted-when-empty so pre-CP-k corpora render identically; nonzero-
for-old-corpora values ship as new queries; precedence overlaps between corrections
decided at build time and forbidden in corpora before the later correction). Era
boundaries k = 4, 8, 12; ledger lint script and stage snapshots required; a ledger
violation found after sealing voids the task version. The journal spine adds one
rule: journal-replay queries (CP11+) may only consume corpora whose every event type
was journal-registered at that corpus's era — checked by the lint.

## Predicted failure channels

Never-pass (propagation): untouched importer vocabulary; untouched digest/alert
buckets; registry-scoped obligations missed at the ops channel (O3/O8); one-sided
in-file updates.

Temporal poison (the new channel): journal registry not extended at CP7/CP9 →
CP10/CP11-introduced cases red; digest bucket without alert surface → owing-alert
cases red at CP7.

Flips (M3-armed, mutation-witnessed): digest bucket-discipline slip; vocabulary
regeneration dropping a token; per-channel field-order/omit slip (now two channels
with different disciplines); canonical branch-precedence botch during correction
rewrites; journal field-registry misorder breaking replay of earlier pins;
registry-flag botch flipping earlier per-channel export pins; agent-initiated
restructure under budget pressure.

## Acceptance gates (all must pass before any commitments doc)

1. Package loads; fresh-mount parity; full OpenSpec archive pass in both arms.
2. Reference scores 100% on every case at every checkpoint, both arms (AUC 1.0).
3. **Omission proof**: a scripted fixture updating only `orders.ts` +
   `render-partner.ts` per checkpoint leaves ≥20 hidden cumulative cases red across
   ≥4 sites by CP12 while passing the canonical-site cases.
4. **Full-scope proof**: scripted per-checkpoint reference replay passes everything.
5. **Botch proof**: a scripted fixture touching all demanded sites but applying ≥2
   flip channels produces ≥4 pass→fail flips across ≥2 files, including one
   journal-field-registry misorder witness and one registry-capability-flag witness.
6. **Turn-cost proof (new, both bounds)**: from the reference's per-checkpoint
   diffs, CP8/CP12 touch ≥8 files, CP6/CP10 ≥7, mean ≥5 across all checkpoints; AND
   no checkpoint's directed minimum (touched files + 1 OpenSpec delta turn) exceeds
   11 turns. Lower bound = brute force breaks; upper bound = a directed agent fits.
7. **Sequential-poisoning proof (new)**: a scripted fixture implementing CP7 fully
   except journal propagation passes 100% of CP7-introduced cases (visible and
   hidden) and leaves ≥3 CP11-introduced cases red; the analogous CP9→CP10/CP11 edge
   is witnessed the same way.
8. **Contextual-spec audit + parity/per-site coverage audit (extended)**: the v1
   grep gate verbatim (no file naming, no sync demands, no frozen vocabulary in
   specs/change requests); plus a mechanical audit over `cases.json`, the visible-spec
   generator output, and the site map asserting (a) visible worked examples and
   feedback runnable cases are content-identical per checkpoint, (b) every demanded
   site has ≥1 case at every correction, (c) every site has ≥1 held-out case, and
   (d) case ids name behaviors/queries/channels, never files.
9. Partition-ledger lint green (including the journal-replay rule); stage snapshots
   (k = 4, 8, 12) pass ≤k−1 / fail ≥1 at k.
10. Mutation suite ≥18 mutations, 100% caught, one witness per flip channel.
11. Emission budget: every reference and seed file ≤2,400 estimated tokens;
    reference `orders.ts` ≥2,000 by CP12.
12. **Site-map integrity (new)**: `oracle-package/site-map.json` exists; every case
    maps to ≥1 site; per-checkpoint demanded-files sets match the committed
    interaction graph; the site map is hashed in the commitments doc.

## Measurement and claim honesty (predeclared)

- Primary metric: sealed `checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1`
  (regression-free AUC), as in all E1 runs.
- Predeclared secondary descriptives (diagnostic only, never promoted to primary),
  computed from `per_turn` case-level data, the site map, and per-turn workspace
  snapshots — implemented in `src/result-summary.ts` and a new `src/site-metrics.ts`;
  the sealed `result-schema-v1` (`src/result-schema.ts`) is not modified:
  - (a) pass→fail flip count at checkpoint end; (b) never-pass count by site;
    (c) files-touched-per-checkpoint profile (all carried from v1);
  - (d) static dispersion covariate per checkpoint (demanded-files count, from the
    site map);
  - (e) site recall per checkpoint: |files touched ∩ demanded| / |demanded|;
  - (f) pass-to-pass precision: of cases passing at CP k−1, the fraction still
    passing at CP k;
  - (g) redirected-investment ratio: turns editing demanded files / total edit turns.
- Claim language: flips are regressions; never-passes are propagation failures;
  poison-edge failures are scoped-fix failures attributed via the interaction graph;
  "drift" may name only the union. Never call never-passes regressions.
- Predeclared analysis intent: if a feedback delta appears, report whether it
  concentrates on high-dispersion checkpoints (d vs per-checkpoint delta) — the
  synthesis's strongest predicted signature. This is descriptive, not a gate.
- Predeclared risk: consolidation escape — a strong agent may refactor the five
  derivation copies into one helper early, deflating later dispersion. A successful
  consolidation is a legitimate pass path; it is reported honestly via site recall
  and the files-touched profile, never penalized post hoc.

## Frontier-probe interpretation rule (predeclared; design-gates acceptance gate 5)

Written before any probe, fixing what counts as what:

- **Ceiling-defeat** (the designed outcome): early invariants preserved (CP1–CP5
  cumulative pass ≥ 0.90 at their introduction), with failures concentrated in
  cross-file propagation (never-passes at non-canonical sites), poison-edge cases,
  or budget exhaustion at high-dispersion corrections. This validates the mechanism
  and the Stage 1 gates decide progression.
- **Structural failure** (not difficulty evidence): early invariants broken at
  introduction, protocol non-compliance (malformed turns, refusal to use the
  workflow), stalls (repeated no-op turns), or provider validity flags. A structural
  failure triggers task revision under a new version, never reinterpretation of the
  run as difficulty evidence.

## Run ladder after the build (each rung separately operator-authorized)

1. **Stage 1 difficulty probe** (sealed commitments doc + Stage 1 plan first):
   context arm, **DeepSeek V4 Pro via the direct route as the primary Stage 1
   model** — the model this task must discriminate — with Qwen 3.7 Max as comparison
   context. Gates mirror dispatch: G1 AUC ≤ 0.92; G2 ≥1 correction checkpoint < 0.75;
   G3 never-pass or flip count > 0. Third-ceiling closure rule in force.
2. **Stage 2 paired causal pilots**: ≥3 seed pairs, context vs feedback, identical
   boundary; MCID +0.05 paired AUC delta; two-look group-sequential rule as in the
   pricing protocol.
3. Cost projection from dispatch-v1 measured shapes scaled for dispersion (more
   files read/written per checkpoint): to be computed via `e1:stats` before the
   Stage 1 plan is sealed; caps at 3× projection.

## Build order (for the executing model; each step a separate increment)

1. Reference `src/` final state, then seed as the CP00 reduction (ops channel
   registered-but-inactive in the seed).
2. `scenarios.ts` + partition-ledger lint (incl. journal-replay rule) + case
   generator + `site-map.json`.
3. Stage snapshots (k = 4, 8, 12) by reduction from the reference.
4. Visible-spec generator + OpenSpec template state (spec.md, 12 change requests).
5. Gates 1–12 as `test/e1-fulfillment.test.ts`; omission, botch, turn-cost, and
   poisoning fixtures as code.
6. Secondary descriptives (d)–(g) in `src/result-summary.ts` / `src/site-metrics.ts`.
7. DESIGN-NOTES recording every concretization against this boundary, including the
   per-obligation derivation chains required by M5.
8. Stop before any commitments doc or run plan: those are sealed separately.
