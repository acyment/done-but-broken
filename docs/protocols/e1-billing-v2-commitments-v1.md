# e1-billing-v2 Pre-Run Commitments (v1)

Date: 2026-06-11. Commit-then-reveal commitments for the `e1-billing-v2-v1` boundary, published before any provider run on this task. The oracle package content stays private until evidence publication; it executes only against captured workspace snapshots. Once an evidence package is published against these commitments, this oracle version is burned for fresh runs.

| Artifact | Commitment (SHA-256) |
| --- | --- |
| Task package (`tasks/e1-billing-v2/task-package`, loader directory hash) | `a7956d549797a978c3cd43ba682c62ee45e7843aa515bef11d8b6a0b75ccdf45` |
| Oracle package (`tasks/e1-billing-v2/oracle-package`, loader directory hash) | `45b8424237f0f1cedb4c99ccba4ef5236f39eba5b440540a5a6671ec24d80c72` |
| Design boundary (`docs/protocols/billing-v2-task-design-v1.md`) | `5db61561dde688dbc1cb9b396345e931ab1cf615c621b6d965a726f0d09d8a5c` |
| Stage 1 probe plan (`docs/protocols/e1-billing-v2-stage1-plan-v1.md`) | `dd886060ae242055b22c91a8b817d42b3fe6333829c3a6e10364ae0f0ba86ff8` |
| Base constants (`docs/protocols/e1-frontier-sealed-constants-v1.0.json`, sealed 1.0.0) | `c10aa82db5a6a5b31291334812b8a3effa2ef160a56dd37a9f6f53302c7ceae4` |
| OpenSpec profile (`docs/protocols/e1-openspec-workflow-constants-v0.json`, sealed 1.0.0) | `f557b2775d6cad47f14be01ac5092a3184b31462323ca20f46ca5e092b9da7df` |
| Dependency lockfile (`bun.lock`) | `dbee6b73b82ab77976d27099ced2ded0d611b94c3cc01947db923570344211dc` |

Rules:

- Any change to a committed artifact after this date creates a new task/plan version and a new commitments document; runs must not mix versions.
- Evidence-grade bundles pass this document's own SHA-256 as `--protocol-document-hash` at invocation. Compute it at run time with `shasum -a 256 docs/protocols/e1-billing-v2-commitments-v1.md` (a document cannot contain its own hash).
- The interaction graph used to classify on-graph drift is the one inside the committed design boundary; it is frozen with that hash.
- Local gate evidence at seal time: `test/e1-billing-v2.test.ts` green (reference 100% everywhere; naive agent reproduces the precommitted CP07→CP05 and CP15→CP04 cross-file regressions; frozen baselines at k=5/10/15; 12/12 mutation catch; isolated-competence support replay-valid).
