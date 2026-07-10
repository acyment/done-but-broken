# VOID RUN — NON-EVIDENCE

Partial manifests of the **voided** v2-M8 seed-22 evidence attempt (launched 2026-07-10 under
the spent seal `f1894f9`, killed mid-chain by infrastructure ~11:17). Committed as spend/audit
provenance only, per `docs/protocols/e4-v2-m8-pilot-void-run-record-v1.md`.

- `seed-22/manifest-e4_arm_0.json` — complete, replay-valid ($0.8557). **Not evidence.**
- `seed-22/manifest-e4_arm_h.json` — `in_progress`, killed inside task 4, 3/6 task records,
  not replay-valid ($0.2807). **Not evidence.**

**Never point the verdict tool (`bin/e4-v2-gonogo.ts`) at this folder. Never pool, analyze, or
cite these manifests as findings.** The sealed consequence (seed 22 excluded → interpretability
trigger 1 → M8 pilot as sealed = `inconclusive_uninterpretable`) is recorded in the void-run
record; the per-sequence `reasoning-observability.json` was never written, so the thinking-on
configuration gate is additionally unevaluable for the Arm-H sequence.
