# E5 Immich re-anchor backlog v1 — option 1 rebuild, batched by model tier

Date: 2026-07-22. Follows `harness/immich-pilot/proof/GATE-7-2-FINDING-v1.md` (§7.2 FAILED:
the person-birthDate trap has zero end-to-end exposure at pinned commit `4a8c3b6`). This
backlog plans the re-anchor onto the photo-timestamp surface (`asset.localDateTime` /
EXIF / album date ranges — the columns whose driver parse really does produce local-time
Dates). **Prereg v2 §3 is invalid; nothing below is authorized to spend. Batches A–C are
zero external spend. Batch D requires fresh operator authorization naming a ratified
prereg v3.**

Ordering is strict A → B → C → D. Each batch ends in a written exit gate; each has kill
conditions that hand control back to the operator rather than absorbing a redesign.

---

## Batch A — mechanism verification (model: **Fable 5**; zero spend; ~1 session)

The judgment-heavy batch. Its whole purpose is to apply the new admission rule — **a live
end-to-end repro at the pinned commit, or the substrate is out** — before anything is built.
The premise of option 1 is UNVERIFIED: the fix commit's behavioral delta was the date-only
encoder, and it is not yet established that any *timestamp* surface at the pinned commit is
(a) observably wrong to a user, (b) certified by a shipped fossil, and (c) forced-touch.

- A1. Timestamp-surface archaeology: enumerate the candidate observable fields at `4a8c3b6`
  (GET /assets/:id `localDateTime` + `exifInfo.dateTimeOriginal`/`modifyDate`, album
  `startDate`/`endDate`, timeline buckets). For each: what the API contract *means* (wall-clock
  vs instant), what the pre-fix helper emits under a non-UTC server, and whether upstream has a
  real user-reported fossil for it (issue/PR search — #28810 may not certify this surface).
- A2. Minimal ingestion spike on the existing stack: microservices worker ON (photos only, ML
  still off), one fixture photo with exiftool-stamped EXIF, verify metadata extraction runs
  bare-metal. Known risks to clear here, not in Batch C: the worker's bootstrap imports the
  core-plugin wasm folder and geodata files — determine graceful-absence vs build/fetch
  requirement; measure job latency against the <60 s loop budget.
- A3. **End-to-end repro admission test** (the §7.2 lesson, applied first): at the pinned
  commit, same API call under UTC-server vs Sydney-server must show a user-meaningful wrong
  value traceable to the shared helper; a plausible naive rewrite must be observably wrong
  while correct code is observably right — all through the real HTTP surface, no pure-function
  shortcuts. Archive raw outputs.
- A4. Episode sketch (not a prereg): establishing scenario with no timezone language that pins
  the precondition via environment; forced-touch trap task; grader = different instance +
  counter-check, per the standing grader≠lever rule.

**Exit gate:** a go/kill memo with archived repro evidence.
**Kill conditions:** no surface passes A3, or ingestion cannot meet the loop budget, or the
only wrongness is representational (same instant, different string) rather than user-observable
→ STOP, present option 2 (new substrate search with the admission rule baked in).

---

## Batch B — design ratification (models: **mixed by design**; zero spend; ~1–2 sessions)

The house discipline requires different models here on purpose; this batch is cheap-model
tolerant *except* the drafting/reconciling seat.

- B1. Prereg v3 draft — **Fable 5** (drafting seat; encodes exposure precondition with base-rate
  source, discriminating-check rule, visible-vs-hidden gap reporting).
- B2. Step-6 re-attack — skeptic agent on a **different strong model (Opus)**, both win and
  null framings, per `docs/methodology/THREE-AMIGOS-DESIGN-REVIEW-v1.md`.
- B3. Three Amigos review — Product / Development / Testing on **three different models
  (Opus / Sonnet / one non-Anthropic)**, reconciled by the main loop.
- B4. Blind-author + memorization probes for the NEW surface — **cheap/different models**,
  authors never see trap or fix; their glue is the candidate treatment glue (D5: the build
  batch must NOT author scenario steps, it only wires runners).
- B5. Reconcile and freeze prereg v3 — **Fable 5**. Hash-pin the blind-authored glue.

**Exit gate:** prereg v3 committed with its §7-equivalent gate list.
**Kill conditions:** re-attack or amigos find a structural flaw with no verified resolution.

---

## Batch C — mechanical build (model: **Opus or Sonnet**; zero spend; ~2–4 sessions)

Everything here is executing a written spec against existing scaffolding; wrong turns are
cheap and visible. Carries over unchanged: dep stack, pinned toolchain, clock pin,
staleness-proof health gate, DB template reset, bootstrap, grader harness pattern,
`run-acceptance` exit-code contract.

- C1. Stack extension per prereg v3: microservices worker profile (+ whatever A2 found it
  needs), fixture photo corpus with stamped EXIF, upload/ingestion bootstrap, asset-ready
  polling, DB baseline snapshot including ingested assets.
- C2. Wire the hash-pinned blind-authored glue (from B4) into the runner; no semantic edits —
  discrepancies go back to Batch B, not fixed inline.
- C3. Hidden graders for the new surface (harness-only; graders may know the trap).
- C4. Re-run every pre-spend gate and archive: trap-fires legs (buggy/green/naive/hack states),
  green-baseline suite audit + quarantine list, loop-latency re-benchmark with worker on,
  contamination checkout + network policy statement, arm-parity byte-diff manifest.

**Exit gate:** all gates green, archived under `harness/immich-pilot/proof/`.
**Kill conditions:** any gate fails → escalate to operator (if the failure is design-level,
back to Batch B on Fable 5; if mechanical, iterate here).

---

## Batch D — feasibility pilot run (in-experiment model: **cheapest adequate tier**, recorded
in prereg v3; ~$25 cap; **blocked on fresh operator authorization naming prereg v3**)

Cheaper is *better* here: the measured event is the control arm falling into the trap and
declaring done, and a weaker agent raises trap-entry without changing what is measured. Same
model both arms, one tier, no mixing; paired seeds, turn/wall limits, and hedged-done
adjudication frozen in prereg v3. Claude Code's own session model is irrelevant to this batch —
the harness drives the run.

---

## Standing constraints (apply to every batch)

Zero-spend batches stay zero-spend (local compute, git, docker, GitHub reads only). No pooling
with prior runs; new compatibility boundary. Honest classification preserved. The §7.2 FAIL
record and this backlog's kill conditions are not to be softened retroactively. Operator sees
the exit memo of each batch before the next one starts.
