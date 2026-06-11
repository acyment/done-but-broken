# e1-billing-v3 Pre-Run Commitments (v1)

Date: 2026-06-11. Commit-then-reveal commitments for the `e1-billing-v3` task under the
v1 Stage 1 probe plan (Qwen 3.7 Max direct to the operator's DashScope-compatible
endpoint). The task was built against `billing-v3-task-design-v1.md` as the successor to
billing-v2 after its double frontier ceiling (Sonnet 4.6 AUC 0.9929, Qwen 3.7 Max AUC
0.9361). The oracle package stays private until evidence publication; it executes only
against captured workspace snapshots. Once an evidence package is published against these
commitments, this oracle version is burned for fresh runs.

| Artifact | Commitment (SHA-256) |
| --- | --- |
| Task package (`tasks/e1-billing-v3/task-package`, loader directory hash) | `b807fec5554b8f66f8435a73baa3dc1fa9828969ddb9af99beef958de62c7e07` |
| Oracle package (`tasks/e1-billing-v3/oracle-package`, loader directory hash) | `d4f4a6e6275ffb8db73bf6a252abcf1b3fbe4d6f4e6e1e040e8eab509d1c7865` |
| Design boundary v1 (`docs/protocols/billing-v3-task-design-v1.md`) | `55c995d473d1803baa7d5d7c589510e52b17d782577e191b9833af9b0f05aee5` |
| Stage 1 probe plan v1 (`docs/protocols/e1-billing-v3-stage1-plan-v1.md`) | `d036b85634a40b5f8581e890c18e51b822ce6b6834d6f68217b9f4ca036ced1e` |
| Base constants (`docs/protocols/e1-frontier-sealed-constants-v1.0.json`, sealed 1.0.0) | `c10aa82db5a6a5b31291334812b8a3effa2ef160a56dd37a9f6f53302c7ceae4` |
| OpenSpec profile (`docs/protocols/e1-openspec-workflow-constants-v0.json`, sealed 1.0.0) | `f557b2775d6cad47f14be01ac5092a3184b31462323ca20f46ca5e092b9da7df` |
| Dependency lockfile (`bun.lock`) | `dbee6b73b82ab77976d27099ced2ded0d611b94c3cc01947db923570344211dc` |

Probe gate evidence at seal time:

- `test/e1-billing-v3.test.ts`: 9 tests pass, full suite 367/367 green.
- Test file SHA-256: `3f6a708c98508ab9200d50a00448ce1c2f33f3a527223e11f65b9c1cd1aa9ccf`
- Gates 1–8 all green (see `tasks/e1-billing-v3/DESIGN-NOTES.md`).
- 17/17 mutations caught, 197 oracle cases (82 held-out, 41.6%).

Rules:

- Any change to a committed artifact after this date creates a new task/plan version and a
  new commitments document; runs must not mix versions.
- Evidence-grade bundles pass this document's own SHA-256 as `--protocol-document-hash` at
  invocation. Compute at run time with
  `shasum -a 256 docs/protocols/e1-billing-v3-commitments-v1.md` (a document cannot
  contain its own hash).
- The plan-row hash above is the SHA-256 of `e1-billing-v3-stage1-plan-v1.md` as written
  alongside this file on 2026-06-11. Verify with
  `shasum -a 256 docs/protocols/e1-billing-v3-stage1-plan-v1.md`.
- Route provenance: runs under this document call the operator's DashScope-compatible
  endpoint directly (`dashscope-compatible-chat-completions`, key env
  `DASHSCOPE_API_KEY`; the workspace-scoped URL stays in the gitignored `.env`). The
  runner refuses `openrouter.ai` endpoints (retired 2026-06-11). Cost-of-record is the
  derived spend from configured prices; the operator records the Alibaba console totals
  alongside the run as a cross-check.
- No pooling across task versions, models, or routes. Billing-v3 runs are never pooled
  with billing-v2 runs (any seed, any model) or with any other task domain.
- Third-ceiling closure rule (billing domain): if billing-v3 returns a clean
  (criterion-3-passing) ceiling result (AUC > 0.92 with zero on-graph regressions), the
  billing domain closes for frontier discrimination claims. No further billing task version
  may be proposed without a domain-change justification reviewed at the AGENTS.md level.
