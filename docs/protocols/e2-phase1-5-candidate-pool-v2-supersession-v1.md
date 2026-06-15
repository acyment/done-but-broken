# E2 Candidate Pool v2 — supersession of v1 for GATE feasibility

Date: 2026-06-15. Records the re-selection of the E2 Phase-1.5 candidate pool. **Pool v1
(`e2-phase1-5-candidate-pool-v1.json`, 40 instances) is superseded** as the pre-gate input by
**pool v2 (`e2-phase1-5-candidate-pool-v2.json`, 37 instances)**. This is a new sealed artifact under
the commit-then-reveal discipline; it does not alter the Phase-1.5 *analysis* plan
(`e2-phase1-5-plan-v1.md`), only the task-source pool the gates run on.

## Why v1 is superseded

GATE-A feasibility (`e2-phase1-5-gate-a-feasibility-20260614-002`) showed pool v1 yields only ~6
cert-feasible tasks — far below the n≈20–40 the powered read needs. **Root cause:** v1 was selected
*sorted hardest-first* (by `non_test_files` & `P2P` descending) to maximize regression surface, which
is **anti-correlated with N=60 flake-cert feasibility** — its tasks are dominated by huge suites
(matplotlib 8 k, mdanalysis 20 k, pyomo 8 k …) that cannot be certified at N≥60. The contamination
screen (Addendum A) and the harness are unaffected and carry forward.

## Pool v2 selection (sealed)

| Field | Value |
| --- | --- |
| Artifact | `docs/protocols/e2-phase1-5-candidate-pool-v2.json` |
| SHA-256 | `96be2835397a626f98dba85bc0090cf66ff2b51b915a4434d397ac43d5af698c` |
| Count | 37 (6 pre-validated from v1 + 31 new) |
| Criteria | post-cutoff (>2025-04-30) AND regression-risk (≥2 non-test files, F2P≥1) AND **cert-feasible suite (100 ≤ P2P ≤ 1500)**; ≤2 per repo (31 repos) |
| Exclusions | GATE-A-confirmed network/dirty repos (a2a, openai-agents, fastmcp, dspy, llama_deploy, pymodbus, SDV, meson, linkding, beets, PyBaMM); known-contaminated ids (MechanicalSoup-455, dag-factory-519) |

**Pre-validated (already GATE-A usable + GATE-B clean in Addendum A):** codecarbon-831,
drf-json-api-1283, datamodel-code-generator-2461, datamodel-code-generator-2408, twine-1249,
kombu-2300.

The 100 ≤ P2P ≤ 1500 band is the deliberate inversion of v1: a *moderate* regression surface large
enough to risk a real regression yet small enough for N=60 certification. Repo diversity (≤2/repo,
31 repos) and the exclusion of network-centric libraries target the two GATE-A failure modes observed
(install-time network, runtime-network test dirtiness).

## Gate plan on v2 (unchanged gates, new pool)

1. **GATE-A** smoke (offline + dependency-prebake) the 31 new tasks → feasible clean/near-clean set.
2. **GATE-B** contamination screen (validated continuation probe + Zen positive control) the feasible
   new tasks (the 6 pre-validated are already screened clean in Addendum A).
3. **Flake-certify** (N≥60) the GATE-A∩GATE-B survivors.
4. Seal the certified set as **Addendum B (final task list)**; then Phase-1.5.

No causal run fires before Addendum B + explicit operator authorization. Classification of the gate
runs remains `calibration`.
