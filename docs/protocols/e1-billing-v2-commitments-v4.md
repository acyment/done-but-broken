# e1-billing-v2 Pre-Run Commitments (v4)

Date: 2026-06-11. Commit-then-reveal commitments for the `e1-billing-v2-v3` task boundary
under the v4 Stage 1 plan (Qwen 3.7 Max direct to the operator's DashScope-compatible
endpoint). Same-day pre-execution revision: the plan initially routed through a local
LiteLLM proxy; before any run it was simplified to the runner's own transport calling the
endpoint directly (no intermediary process), and the plan-row hash below reflects the
revised document. Supersedes `e1-billing-v2-commitments-v3.md` **before execution**: no
run was ever fired under the v3 plan, so the task package, oracle package, and design
boundary carry over byte-identical; only the plan row changes (model/route move,
OpenRouter retired). The oracle
package stays private until evidence publication; it executes only against captured
workspace snapshots. Once an evidence package is published against these commitments,
this oracle version is burned for fresh runs.

| Artifact | Commitment (SHA-256) |
| --- | --- |
| Task package (`tasks/e1-billing-v2/task-package`, loader directory hash) | `3224580b682a65dd41a937b1540f13b5fedf61641d9da2babc7b5c7d789b55ce` |
| Oracle package (`tasks/e1-billing-v2/oracle-package`, loader directory hash) | `c07ae530bed29a6267c83deb9000e453eb215a80b5bebb99cbf41386e8caae3d` |
| Design boundary v1 (`docs/protocols/billing-v2-task-design-v1.md`) | `5db61561dde688dbc1cb9b396345e931ab1cf615c621b6d965a726f0d09d8a5c` |
| Design amendment v2 (`docs/protocols/billing-v2-task-design-v2.md`) | `9596433d72af46704794330820e438995ebaaaf9cb4b47f9ba7841806aa812c0` |
| Design amendment v3 (`docs/protocols/billing-v2-task-design-v3.md`) | `50b564157eb2312c02bd4c2dca494359b516dd9e6cd86ef5f186818caec6064e` |
| Stage 1 probe plan v4 (`docs/protocols/e1-billing-v2-stage1-plan-v4.md`) | `8c4ed1d6859a231238647425eb8420d2e145e149d576462e94b54e1c9fe94524` |
| Base constants (`docs/protocols/e1-frontier-sealed-constants-v1.0.json`, sealed 1.0.0) | `c10aa82db5a6a5b31291334812b8a3effa2ef160a56dd37a9f6f53302c7ceae4` |
| OpenSpec profile (`docs/protocols/e1-openspec-workflow-constants-v0.json`, sealed 1.0.0) | `f557b2775d6cad47f14be01ac5092a3184b31462323ca20f46ca5e092b9da7df` |
| Dependency lockfile (`bun.lock`) | `dbee6b73b82ab77976d27099ced2ded0d611b94c3cc01947db923570344211dc` |

Rules:

- Any change to a committed artifact after this date creates a new task/plan version and a
  new commitments document; runs must not mix versions.
- Evidence-grade bundles pass this document's own SHA-256 as `--protocol-document-hash` at
  invocation. Compute it at run time with
  `shasum -a 256 docs/protocols/e1-billing-v2-commitments-v4.md` (a document cannot
  contain its own hash).
- The interaction graph used to classify on-graph drift is the one inside the committed v1
  design boundary; amendments v2/v3 never touched the graph, invariants, or checkpoint
  semantics, and the v4 plan touches only model/route/pricing identity.
- Route provenance: runs under this document call the operator's DashScope-compatible
  endpoint directly (`dashscope-compatible-chat-completions`, key env
  `DASHSCOPE_API_KEY`; the workspace-scoped URL stays in the gitignored `.env`). The
  runner refuses `openrouter.ai` endpoints (retired 2026-06-11). Cost-of-record is the
  derived spend from configured prices; the operator records the Alibaba console totals
  alongside the run as a cross-check.
- Local gate evidence at seal time: unchanged from v3 commitments (the task package is
  byte-identical): `test/e1-billing-v2.test.ts` green (7 tests including gate 6), full
  suite green including the OpenRouter-refusal CLI test.
