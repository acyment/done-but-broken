# E2 Phase-1 / Phase-1.5 Pre-Run Commitments (v1)

Date: 2026-06-14. Commit-then-reveal commitments for the E2 brownfield acceptance-feedback ablation
(Phase 1 feasibility+contamination gate, and the powered Phase-1.5 effect read). Sealed **before**
any Phase-1/1.5 run. No provider run under these commitments fires without explicit operator
authorization and a spend cap.

## Sealed artifacts (SHA-256)

| Artifact | SHA-256 |
| --- | --- |
| Program boundary (`docs/protocols/e2-brownfield-acceptance-ablation-design-v1.md`) | `a6049b137648e39716d009dded69790971b19fd0c2d52f02efd8eb26bcf9e469` |
| Phase-1 pilot spec (`docs/protocols/e2-phase1-pilot-spec-v1.md`) | `6cf5944dd6ff1e6eb177b929fd64738092ca3a0186ad1a70de60e90b3f203076` |
| Phase-1.5 sealed plan (`docs/protocols/e2-phase1-5-plan-v1.md`) | `307445e91a4d240b14fb6974c7a49ea5b940f22e859d39148e6a133399198dd5` |
| Provenance contract (`docs/protocols/e2-provenance-schema-v1.json`) | `a606c968505ff80e1b7c8c62358d337cf68d595c4d24ad78a99f7a57697075d7` |
| Frozen candidate pool (`docs/protocols/e2-phase1-5-candidate-pool-v1.json`) | `706626ddaeec18821c45b0700860b44fe868f0eeebe392efe4bceff931dfd973` |
| Addendum A — GATE-B contamination screen (`docs/protocols/e2-phase1-pilot-commitments-v1-addendum-a.md`) | `b2c2a627d92812159257cdfc74f7e1c3a539f0ef3f676460db90a21dccacfac1` |

## Harness

| Field | Value |
| --- | --- |
| Repo | `hit-sdd-bench-e2` (separate Python/Docker harness) |
| Commit | `4c578a4ce6d0ba12d4c9fa3ac5c123f917d08f62` |
| Validation at seal | 26 unit tests green; full E2 loop validated end-to-end with real DeepSeek V4 Pro on both arms (run cards `e2-phase1-shakedown-...-001`, `e2-phase1-subpilot-...-001`); provenance hashing byte-identical to E1 (golden-tested) |

## Sealed parameters

- **Substrate:** SWE-bench Live; candidate pool = the 40 frozen instances above (post-2025-04-30,
  regression-risk ≥2 non-test files & P2P>0, ≤3/repo, sorted by (non_test_files, P2P) desc).
- **Model / route:** `deepseek-v4-pro`, litellm openai-compatible, `https://api.deepseek.com/v1`,
  key env `DEEPSEEK_API_KEY` (the operator's; route id recorded, key never published).
- **Arms:** `control` = OpenHands + file_editor; `treatment` = + container-backed `run_tests`
  (the hidden acceptance subset run in a fresh sanitized container); `retrieved` context.
- **Primary metric:** self-verification gap rate (declared-done AND oracle-would-fail), unit
  task-run. Secondary: resolve-rate delta. Tertiary: P2P regression count (logged).
- **Phase 1 gates:** GATE A flake (≥60 patch-induced runs/task, upper-bound ≤5%, flaky quarantined);
  GATE B contamination (memorization probe < 95th-pct of a post-cutoff negative control). No NO-GO
  from absent regressions.
- **Phase 1.5:** n≈20–40 (post-gate), N=10 runs/arm/task; one-sided permutation test per task,
  family-wise correction, error budget P(k|null)≤0.05, MCID ≥0.20 absolute gap-rate reduction;
  asymmetric single-model rule (positive = candidate frontier-positive; single-model null =
  inconclusive).
- **Classification:** Phase 1 `calibration`/`difficulty_probe`; Phase 1.5 `causal_pilot`.

## Rules

- Any change to a committed artifact after this date creates a **new version** (new commitments doc);
  runs must not mix versions.
- Evidence-grade Phase-1.5 runs pass this document's own SHA-256 as `--protocol-document-hash` at
  invocation; compute with `shasum -a 256 docs/protocols/e2-phase1-pilot-commitments-v1.md` (a
  document cannot contain its own hash).
- The candidate pool is the **pre-gate input**. Before the Phase-1.5 run, the final flake-certified +
  contamination-screened task list (and any subsample) is sealed as a **commitments addendum** hashed
  here, with the actual instance IDs and their GATE A/B results.
- No pooling across model / substrate / profile / classification; never pooled with E1.
- All runs operator-authorized with a spend cap; provider-flagged/invalid runs recorded, excluded,
  replaceable once.

## Status

Pre-registered and sealed. The harness is built and validated end-to-end (both arms, real DeepSeek
V4 Pro). **GATE-B contamination screen complete and sealed (Addendum A, 2026-06-14):** 39 of 40 pool
tasks pass; zero verbatim memorization (positive control 1.0, pool ≤0.229); one precautionary
exclusion. What remains is execution under authorization: GATE-A flake-certify the screened set →
seal Addendum B (final task list) → Phase 1.5 (the powered read).
