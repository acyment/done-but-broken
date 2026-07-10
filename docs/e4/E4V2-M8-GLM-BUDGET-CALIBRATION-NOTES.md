# v2-M8 — GLM 5.2 budget calibration: notes

Mirrors `E4V2-M6-BUDGET-CALIBRATION-NOTES.md`'s recorded-notes style, for the §6 calibration named
in `docs/protocols/e4-v2-m8-glm52-replication-scoping-v1.md` ("Budget calibration (M6-style, live,
requires authorization)"). Binding precedent honored: the v0.2 budgets were frozen "on
deepseek-v4-pro only" — they do **not** transfer to GLM, so GLM gets its own ratification here
before any pre-registration is sealed. Configuration is Amendment A / Option B throughout:
**thinking ON** (GLM's default; empty request extras, `reasoning_effort` at the provider default
`max`, never `thinking:{type:"disabled"}`).

## Part A — no-spend wiring check (executed 2026-07-09)

No code was needed: `bin/e4-v2.ts`'s `--live` calibration path is fully CLI-flag-driven (the same
generic wiring the M6 deepseek run used), so GLM wires by flags alone, per the scoping doc's §10
Conflict-2 resolution (no preset). Resolved route, verified against the §9a facts and the
step-3 smoke report (`reasoning-smoke-report.json`, §4a active / §4b folded / §5iv no truncation):

- model `glm-5.2`, endpoint `https://api.z.ai/api/paas/v4/chat/completions` (general paas/v4,
  not the coding endpoint), `--api-key-env ZHIPU_API_KEY`, route_id `direct-zhipu-api-key`
- pricing cap-guardrail overestimates `1.4 / 0.26 / 4.4` USD/M (≥ the §9a actuals; the M7
  deepseek values 0.5/0.05/2.0 deliberately NOT reused)
- `--max-output-tokens 32000` (the smoke's reasoning-headroom value; M7's 16000 risks truncating
  a thinking-on turn)
- empty extra body — thinking stays on at GLM's default `reasoning_effort` (`max`), which is also
  the §9 open-question-1 answer this calibration ratifies: `max` is affordable (see Part B spend),
  so the realistic, most token-hungry setting is the one to seal at pre-registration.

`e1:protect` PASS before presenting the command (738/738, sealed hash unchanged). Operator
authorized the spend with "authorize the calibration run" (2026-07-09).

## Part B — calibration runs + freeze (executed 2026-07-09/10, operator-authorized spend)

**Run identity (both runs):** one full-length Arm-H sequence, 6 tasks × seed 37 (the M6
calibration seed — never an evidence seed), model **glm-5.2** thinking-ON on the route above,
`classification=calibration`, pairing_label `pair-calibration-seed-37`. `chain_replay_valid: true`
both runs. `e1:protect` PASS immediately before launch, after each run, and before the constants
edit.

**Run 1 (2026-07-09, `tmp/.../seed-37`): $0.642259.** All 6 tasks `done`; max turns/task 8→6, max
tokens/task 122,626, max verifications/task 3 — every wall clear. However, the §4 reasoning checks
could NOT be re-run over its transcripts: the live path discarded the raw provider body (the only
carrier of `reasoning_content` / `completion_tokens_details`) at the adapter boundary, so the only
§4 evidence was still the 3-call single-turn smoke. **Escalated to the operator instead of
extrapolating** (the run's token/spend numbers are honest *if* the smoke's "folded" finding
generalizes — an extrapolation, not a verification). Operator chose option 2: wire the recorder,
re-run.

**Recorder patch (`4f7e1ed`, no spend):** on `--live`, `bin/e4-v2.ts` now tees the transport
through the already-tested `createRecordingTransport` (passthrough; `transport_kind` preserved)
and writes **derived signals only** (never raw bodies) to `<runRoot>/reasoning-observability.json`.
Dry-run path untouched; `e1:protect` PASS around the patch.

**Run 2 — the ratifying run (2026-07-10, `tmp/.../seed-37-r2`): $0.617758.** All 6 tasks `done`,
`chain_replay_valid=true`, wall clock ~21 min. Per-task detail (via `bin/e4-v2-budget-report.ts`):

| task | op_kind | turns | tokens | smoke | oracle | spend |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | add_relationship | 5 | 58,446 | 1 | 23/27 | $0.0659 |
| 2 | add_entity | 5 | 64,167 | 1 | 32/36 | $0.0583 |
| 3 | modify_convention | 4 | 78,281 | 1 | 32/36 | $0.1124 |
| 4 | delete_entity | 5 | 98,799 | 1 | 23/27 | $0.0910 |
| 5 | modify_endpoint | 5 | 116,246 | 1 | 23/27 | $0.1621 |
| 6 | noop_maintenance | 5 | 101,628 | 1 | 23/27 | $0.0878 |

**§4 setup-time validity checks — confirmed on real multi-turn tasks**
(`docs/protocols/e4-v2-m8-glm-reasoning-observability-20260710-001.json`):

- **§4(a) reasoning ACTIVE on 35/35 calls** — every turn of every task carried non-empty
  `reasoning_content`; per-call reasoning burn 19–11,123 tokens (vs ~235–587 on the trivial smoke,
  confirming real tasks think much harder).
- **§4(b) accounting FOLDED on 35/35 calls** — `usage.completion_tokens` includes the reasoning
  tokens on every response; the budget ledger and derived cost are honest as-is; the E4-side
  adjustment seam stays inert.
- **§5(iv) zero truncation** at `max_tokens` 32000 — no `finish_reason: "length"` anywhere;
  32000 is the ratified headroom value for pre-registration (open question 2).

**No wall was hit in either run — the freeze rule's "fits with headroom" branch applies.**
Observed appetite (run 2): max turns/task **5** (cap 27), max tokens/task **116,246** (cap
490,000), max verifications/task **1** (cap 12), sequence spend **$0.618** (cap $5, 4× backstop
$20), `budget_walls_observed=false`. Notably, GLM thinking-ON came in *under* deepseek
thinking-OFF's max (142,778 tokens/task) — the reasoning cost fit inside the existing headroom,
so no cap-headroom raise was needed (the §6 "raise explicitly if a realistic task cannot fit"
branch never triggered).

**Ratified values: turns_per_task 27→27, verifications_per_task 12→12, token_budget
490000→490000, spend_cap_usd 5→5 — unchanged.** Only `version` moves (0.2 → 0.3) to mark GLM's
own freeze event, per the model-pin discipline.

**Model-id pin:** the v0.3 budgets transfer to a v2-M8 evidence run only on the exact model id
`glm-5.2`, thinking-ON, on the same direct route (`direct-openai-compatible` /
`direct-zhipu-api-key`). Any other pilot model (or thinking configuration) requires repeating
this ratification — same discipline as the v0.2 deepseek pin.

**v0.3 hash:** full-file sha256
`2f78f53479e300ef4eb7ee654283dba26a9095cf252b661d20deb51232b5e11c`, pinned by
`test/e4-v2-constants.test.ts` ("[v2-M6/v2-M8] v0 is FULLY FROZEN") — the `constants_hash` every
v2-M8 evidence manifest must stamp. The v2-M5 non-budget projection hash (`7fd13e01…`) held
unchanged (only `budgets`-block-adjacent `version` moved). The historical v0.2 hash
(`d762bacc…`) remains what the committed v2-M7 evidence manifests stamp; to re-run the M7
verdict, pass `--constants` pointing at the archived v0.2 file
(`git show de9a679:docs/protocols/e4-v2-sealed-constants-v0.json`).

**Answers this calibration hands the §7 pre-registration** (scoping §9 open questions 1–3):
`reasoning_effort` = provider default `max` via empty extras (1); `max_tokens` = 32000 (2);
accounting = folded, no E4-side adjustment, seam inert (3 — now confirmed at calibration scale,
not just smoke scale).

**Mechanism observation (non-evidence, flagged for the v2-M8 report, not a calibration blocker):**
as in the deepseek M6 calibration, **every task in both runs closed `false_confidence.event=true`**
— the executed arm's own gate accepted `done` on a green cumulative scenario set while the hidden
ground-truth oracle still failed (23/27 or 32/36), kill score 1.0 throughout, zero
`refused_done_over_red`. Same single-arm/single-seed caveat as M6: calibration observation only,
structurally excluded from any verdict.

**Both runs' totals: ~$1.26 combined; provenance committed for the ratifying run only**
(`docs/protocols/e4-v2-m8-glm-calibration-manifest-20260710-001.json` + the reasoning-observability
report; run 1 preserved locally at `tmp/e4-v2-m8-glm-calibration/seed-37`, superseded as
provenance by run 2 which carries the §4 instrument).
