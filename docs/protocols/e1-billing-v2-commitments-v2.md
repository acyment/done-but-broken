# e1-billing-v2 Pre-Run Commitments (v2)

Date: 2026-06-11. Commit-then-reveal commitments for the `e1-billing-v2-v2` boundary,
published before any provider run on this task version. Supersedes
`e1-billing-v2-commitments-v1.md` (v1 burned after the structural probe verdict; no
evidence package was ever published against v1, so the oracle content remains private and
carries over). The oracle package stays private until evidence publication; it executes
only against captured workspace snapshots. Once an evidence package is published against
these commitments, this oracle version is burned for fresh runs.

| Artifact | Commitment (SHA-256) |
| --- | --- |
| Task package (`tasks/e1-billing-v2/task-package`, loader directory hash) | `aaadfe202d182e4520786febb6267fb998dbc4faeb1043b5de8af5a758684410` |
| Oracle package (`tasks/e1-billing-v2/oracle-package`, loader directory hash) | `c871bb810695a8c002f6d4b711200bb521dc9a93cafe4934dafaf888602129b7` |
| Design boundary v1 (`docs/protocols/billing-v2-task-design-v1.md`) | `5db61561dde688dbc1cb9b396345e931ab1cf615c621b6d965a726f0d09d8a5c` |
| Design amendment v2 (`docs/protocols/billing-v2-task-design-v2.md`) | `9596433d72af46704794330820e438995ebaaaf9cb4b47f9ba7841806aa812c0` |
| Stage 1 probe plan v2 (`docs/protocols/e1-billing-v2-stage1-plan-v2.md`) | `d5a53de8d418a7c3563bf4f1b95acf25738c58b9dffa9a9da41bd3c4968c1c85` |
| Base constants (`docs/protocols/e1-frontier-sealed-constants-v1.0.json`, sealed 1.0.0) | `c10aa82db5a6a5b31291334812b8a3effa2ef160a56dd37a9f6f53302c7ceae4` |
| OpenSpec profile (`docs/protocols/e1-openspec-workflow-constants-v0.json`, sealed 1.0.0) | `f557b2775d6cad47f14be01ac5092a3184b31462323ca20f46ca5e092b9da7df` |
| Dependency lockfile (`bun.lock`) | `dbee6b73b82ab77976d27099ced2ded0d611b94c3cc01947db923570344211dc` |

Rules:

- Any change to a committed artifact after this date creates a new task/plan version and a
  new commitments document; runs must not mix versions.
- Evidence-grade bundles pass this document's own SHA-256 as `--protocol-document-hash` at
  invocation. Compute it at run time with
  `shasum -a 256 docs/protocols/e1-billing-v2-commitments-v2.md` (a document cannot
  contain its own hash).
- The interaction graph used to classify on-graph drift is the one inside the committed v1
  design boundary; the v2 amendment changes module layout and gates only, never the graph,
  invariants, or checkpoint semantics.
- Local gate evidence at seal time: `test/e1-billing-v2.test.ts` green under the v2 layout
  — reference 100% everywhere with byte-identical regenerated cases (behavioral
  invariance of the split); naive agent reproduces the precommitted CP07→CP05 and
  CP15→CP04 cross-file regressions; frozen baselines at k=5/10/15 in the split layout;
  12/12 mutation catch; isolated-competence support replay-valid; new gate 6 (every
  reference and seed source file ≤ 2400 estimated tokens; largest is
  `billing-handlers.ts` at 1,372).
