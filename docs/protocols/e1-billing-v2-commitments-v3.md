# e1-billing-v2 Pre-Run Commitments (v3)

Date: 2026-06-11. Commit-then-reveal commitments for the `e1-billing-v2-v3` boundary,
published before any provider run on this task version. Supersedes
`e1-billing-v2-commitments-v2.md` (v2 burned after its structural probe verdict; no
evidence package was ever published against v2, so the oracle content remains private and
carries over). The oracle package stays private until evidence publication; it executes
only against captured workspace snapshots. Once an evidence package is published against
these commitments, this oracle version is burned for fresh runs.

| Artifact | Commitment (SHA-256) |
| --- | --- |
| Task package (`tasks/e1-billing-v2/task-package`, loader directory hash) | `3224580b682a65dd41a937b1540f13b5fedf61641d9da2babc7b5c7d789b55ce` |
| Oracle package (`tasks/e1-billing-v2/oracle-package`, loader directory hash) | `c07ae530bed29a6267c83deb9000e453eb215a80b5bebb99cbf41386e8caae3d` |
| Design boundary v1 (`docs/protocols/billing-v2-task-design-v1.md`) | `5db61561dde688dbc1cb9b396345e931ab1cf615c621b6d965a726f0d09d8a5c` |
| Design amendment v2 (`docs/protocols/billing-v2-task-design-v2.md`) | `9596433d72af46704794330820e438995ebaaaf9cb4b47f9ba7841806aa812c0` |
| Design amendment v3 (`docs/protocols/billing-v2-task-design-v3.md`) | `50b564157eb2312c02bd4c2dca494359b516dd9e6cd86ef5f186818caec6064e` |
| Stage 1 probe plan v3 (`docs/protocols/e1-billing-v2-stage1-plan-v3.md`) | `8d47b8ed11c9810fec54760f2477fb97af412d70e6b6f1d0ae67cfe2d8ac199c` |
| Base constants (`docs/protocols/e1-frontier-sealed-constants-v1.0.json`, sealed 1.0.0) | `c10aa82db5a6a5b31291334812b8a3effa2ef160a56dd37a9f6f53302c7ceae4` |
| OpenSpec profile (`docs/protocols/e1-openspec-workflow-constants-v0.json`, sealed 1.0.0) | `f557b2775d6cad47f14be01ac5092a3184b31462323ca20f46ca5e092b9da7df` |
| Dependency lockfile (`bun.lock`) | `dbee6b73b82ab77976d27099ced2ded0d611b94c3cc01947db923570344211dc` |

Rules:

- Any change to a committed artifact after this date creates a new task/plan version and a
  new commitments document; runs must not mix versions.
- Evidence-grade bundles pass this document's own SHA-256 as `--protocol-document-hash` at
  invocation. Compute it at run time with
  `shasum -a 256 docs/protocols/e1-billing-v2-commitments-v3.md` (a document cannot
  contain its own hash).
- The interaction graph used to classify on-graph drift is the one inside the committed v1
  design boundary; the v2 amendment changed module layout and gates only, and the v3
  amendment changes README output-discipline text and task-version fields only — never the
  graph, invariants, or checkpoint semantics.
- v3 task-content delta vs v2, in full: `template-workspace/README.md` gains the
  Amendment 5 output-discipline section (at most one source file per turn; truncated file
  blocks are discarded), and `task.json`/`oracle.json` `task_version` becomes
  `e1-billing-v2-v3`. All source files, visible specs, change requests, stage variants,
  and oracle cases are byte-identical to the v2 boundary.
- Local gate evidence at seal time: `test/e1-billing-v2.test.ts` green under the v3
  package (7 tests, including gate 6 emission budget; full suite 357 pass / 0 fail)
  — reference 100% everywhere, naive agent reproduces the precommitted CP07→CP05 and
  CP15→CP04 cross-file regressions, frozen baselines at k=5/10/15, 12/12 mutation catch,
  isolated-competence support replay-valid.
