# E4 M7 pilot — pre-registration (v1)

**Status: SEALED before launch.** Committed before any pilot data exists; nothing below changes
after launch. Deviations, if any, are recorded in the run report as deviations — never edited in
here.

**Authorization record.** Operator directive "Tackle m7" (2026-07-08, this session), issued
immediately after the M6.5 completion report that restated the M7 gate requirements (explicit
spend authorization, pre-registered analysis committed first, pilot-guard removal, model-id
decision). Recorded as the M7 spend authorization. The `bin/e4.ts` pilot-classification guard is
removed in the same commit as this document — that removal is the gate action, and this document
is its record.

## 1. Run identity

| Field | Value |
| --- | --- |
| Design | 1 substrate config × 3 arms × 2 seeds × 6 tasks = **36 task-runs** ([R2: R2-9d]) |
| `run_classification` | `pilot` |
| Substrate | `procedural-rest-v1-default` / `procedural-rest-v1.1` |
| Constants | **v0.6, FULLY FROZEN**, sha256 `a0e51236d66de818ad1e3bf8eff9a055df9a8025127f363f950ad92632c3b0ee` — every manifest must stamp this hash |
| Meter | `e4-drift-meter-v1` (frozen; stamped in every manifest) |
| Budgets (frozen at M6.5) | 18 turns / 8 verifications / 310,000 tokens per task; $5 spend cap per sequence |
| Model | `deepseek-v4-flash`, direct endpoint `https://api.deepseek.com/chat/completions`, thinking disabled, `max_tokens` 16000, temperature 0.2 (provider default) — **identical parameters to the M6.5 calibration** |
| Seeds | **46 and 49** (declared here, before launch) |
| Pairing labels | `pair-pilot-seed-46`, `pair-pilot-seed-49` |
| Arms | `e4_arm_0`, `e4_arm_m`, `e4_arm_h` — one shared budget set, arm deltas only through the declared policy channels (validated at launch by `validateE4RuntimeArmParity`) |

**Model-id decision.** The M6.5-frozen budgets were ratified from `deepseek-v4-flash`'s observed
appetite and transfer only to the same model id (plan §2 M6.5 note 2). The pilot therefore runs
`deepseek-v4-flash`. It is the operator's designated cheap-tier model (decision 2026-06-12)
standing in for the brief's "Devstral-class (mid/cheap tier)"; no Mistral key exists in the
estate.

**Seed decision.** The calibration seed (45) is deliberately **not** reused: the budget walls
were observed — and the ratified values tuned — on seed 45's exact task draw, so evaluating on it
would flavor the pilot with budget overfitting. Seeds 46 and 49 were selected before launch by
composition probe (both 6-task draws contain ≥1 `behavior_preserving` task, exercising the live
affirmation path, and ≥4 non-BP tasks including drift opportunities):

- seed 46: drift_opportunity | additive | drift_opportunity | drift_opportunity | drift_opportunity | behavior_preserving
- seed 49: drift_opportunity | drift_opportunity | drift_opportunity | drift_opportunity | additive | behavior_preserving

## 2. Pre-registered analysis and decision rule

The analysis is the one already committed and executable — nothing new is introduced for this run:

- **Per-hypothesis numbers:** `src/e4/result-schema.ts` exactly as committed (H1/H2 episode-flow
  velocity on `semantic_item_uid`; H3 ordered signature pair; H4 series + slope, subject to the
  §3.2 per-arm floor rule at its pinned numbers; H5 attempted-task taxes in tokens with the
  [R2: R2-8] protocol-overhead sensitivity line; false-confidence propensity per [R2: R2-6]).
  Plan §3.1–§3.3 are the normative text.
- **Decision rule:** the exit code of `bun run bin/e4-gonogo.ts <runRoot>` against the frozen
  constants file. §5.1 interpretability triggers run first; exit 0 = go, 1 = no-go, 2 =
  `inconclusive_uninterpretable`. **No claim beyond the printed report is made from this pilot.**
- **Mandatory diagnostics in the report:** class-composition and op-type attribution
  ([R1-S8]/[R2: R2-10]), advisory flags (v)/(vi), and the M6.5 substrate observation
  (`red_check: green_anomaly` on rename-class ops — delta sets that pass pre-implementation) —
  the pilot report must state its observed rate.

## 3. Validity gates

- Headline-eligible sequences require `chain_replay_valid: true` (recomputed at sequence close;
  re-verifiable via `bin/e4-inspect.ts`).
- `bun run e1:protect` (full triad) green **before and after** the run.
- The M6.5 calibration run is non-evidence and is excluded from the go/no-go structurally (by
  classification); it shares no seed with this pilot.
- Aborted (infrastructure-classified) records stay excluded per the ADR-005 pin; a crashed
  sequence resumes via `--resume` (ADR-005), and resume seams must verify for the chain to count.

## 4. Estate discipline

Classification language: this is a **pilot** of a single cheap-tier model on a procedural
substrate. Whatever the verdict, it is not public validation of any framework claim; wording in
any external artifact follows the estate's claim-safe framing standards.
