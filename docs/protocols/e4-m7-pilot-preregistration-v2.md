# E4 M7 pilot — pre-registration v2 (qwen-plus rerun)

**Status: SEALED before launch.** Supersedes v1 only in run identity and the three additions
listed in §2; every other pin of `e4-m7-pilot-preregistration-v1.md` carries over verbatim.
Committed before any v2 pilot data exists.

**Authorization record.** Operator directive "Qwen-plus" (2026-07-08) selected the rerun model
and authorized this run's spend (gate record:
`docs/protocols/e4-qwen-plus-gate-decision-v1.md`). The v1 flash pilot's verdict
(`inconclusive_uninterpretable`, `instrument_degraded`) stands as recorded; this rerun does not
reopen it.

## 1. Run identity

| Field | Value |
| --- | --- |
| Design | 1 substrate config × 3 arms × 2 seeds × 6 tasks = 36 task-runs |
| `run_classification` | `pilot` |
| Constants | **v0.7**, sha256 `b4d2e9df5c0ae0952ccc5aedcd5655b04a0e3fccf96b7110d5989893ef3781a9` (budgets 27 / 12 / 490,000 / $5, ratified on this model) |
| Model | `qwen-plus`, estate EU MaaS compatible-mode endpoint, `enable_thinking: false`, `max_tokens` 16000, temperature 0.2 — identical parameters to the re-ratification calibration |
| Seeds | **50 and 52** (declared here; fresh — 45/46/49 are all data-touched). Compositions: seed 50 = additive, drift ×4, BP(6); seed 52 = drift, additive, drift, **BP(4)**, additive, drift — BP positions differ deliberately (end vs mid-chain affirmation) |
| Pairing labels | `pair-pilot-seed-50`, `pair-pilot-seed-52` |

## 2. Additions over v1 (all sealed now, before data)

1. **Trigger-2 interpretation split (`spec_touch`).** If the §5.1 `substrate_not_validated`
   trigger fires (all arms velocity 0), the report reads it through the manipulation check:
   universal zero **with Arm-0 `spec_touch` on ≥ half its complete tasks** = "mid-tier
   self-maintenance" — a real, claim-safe finding about the model class, not an instrument
   failure; universal zero **with low Arm-0 `spec_touch`** = the original reading (substrate maps
   too cleanly to spec edits; H1 untested).
2. **Workspace-breakage rate as a pre-registered secondary.** Arm-level fraction of complete
   tasks with `drift.extraction_failed == true` — directly observed, never censored, carried from
   the v1 pilot's arm-differential finding (flash: ungated 6 tasks, Arm H zero). Reported per arm
   alongside the primary numbers regardless of verdict.
3. **Program stop-loss (operator-agreed, this session).** This is the **last model iteration**:
   if this pilot also lands `inconclusive_uninterpretable` — any trigger — E4 halts for design
   reassessment at a gate rather than trying a third model. A **no-go** on H1 (qwen-plus keeps
   specs fresh / no drift signal) is taken at face value: no model-shopping for a drifting agent.

## 3. Decision rule (unchanged)

`bun run bin/e4-gonogo.ts <runRoot>` against constants v0.7: §5.1 triggers first; exit 0 = go /
1 = no-go / 2 = inconclusive. Chain replay validity required for headline eligibility;
`e1:protect` before and after; no claim beyond the printed report. Known diagnostics to carry:
`green_anomaly` rate (substrate delta-set sensitivity, observed on both models), and the
seed-45 task-property wall signature (two models, same near-miss checks) as context for any
budget-wall readings.
