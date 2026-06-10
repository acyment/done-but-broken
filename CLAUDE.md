# Claude Code Operating Notes

`AGENTS.md` is the source of truth for repo-wide scientific, protocol, and evidence discipline. Follow it first.

Claude Code must not run provider/model experiments, call OpenRouter, or create new runs unless explicitly asked.

The project is not ready for public validation claims that executable feedback wins for frontier models. Future evidence-generating runs must declare a reviewed protocol profile (`path-survival-primary-v1` or a sealed E1 profile) and be explicitly authorized; `regression_free_auc` is primary only for runs that declare a profile naming it. Older final-pass-primary runs must remain historical observations, with AUC described only as retrospective secondary context.

The active program is the E1 frontier path. The OpenSpec workflow is permitted only as a shared task-environment property under protocol profile `e1-openspec-workflow-v0` (both arms in the same OpenSpec workspace, harness-run archive step identical in both arms, executable feedback as the only causal variable) — never as a condition ID, arm, or spec-format comparison between arms. The Stage 1 subscription/inventory validation matrix is superseded before execution; do not execute it (`docs/protocols/path-survival-primary-v1-validation-matrix-supersession-v1.md`).

Preserve run classifications and validity language in all docs and summaries. Do not rewrite docs to overclaim causal evidence, and do not describe `calibration`, `difficulty_probe`, or `diagnostic_invalid` runs as causal evidence.

Treat `subscription-entitlements-difficulty-probe-20260605-003` as structurally valid and replay-valid, with both arms passing 9/9, but provider-timeout flagged and therefore not clean primary evidence.

For now, prioritize doc clarity, public run cards, task cards, evidence-status summaries, and credibility artifacts only as backlog/docs tasks unless explicitly asked to implement them.
