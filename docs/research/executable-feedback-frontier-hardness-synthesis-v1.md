# Executable Feedback at the Frontier Tier: Research Synthesis v1

Date: 2026-06-12. Synthesis of three operator-commissioned deep-research reports
(received 2026-06-12) on why high-investment frontier models ceiling on scattered-
propagation tasks and what task properties reopen the failure mode. This document is
**reference material and predeclaration only** — it is not a protocol profile, not a
design boundary, and authorizes no runs. The design boundary that consumes it is
`docs/protocols/e1-fulfillment-task-design-v1.md`.

## Motivating result

`e1-dispatch-deepseek-v4-pro-context-stage1-seed-a-20260612-001` (calibration):
DeepSeek V4 Pro context arm scored AUC 0.9768 on `e1-dispatch-v1` with a mean of 8.0
turns/checkpoint — 2.5–3× Qwen 3.7 Max's natural investment. Brute-force turn
investment rediscovered the 4 scattered sites without feedback. Its 8 never-passes
clustered exactly at its 3 `budget_exhausted` checkpoints (CP07/09/11). Qwen 3.7 Max
on the same task: context AUC 0.7284, Stage 2 paired feedback delta +0.1464 mean.

## The ceiling/redundancy mechanism (literature-confirmed)

The run card's interpretation — the feedback effect is model-dependent and becomes
redundant as natural turn-investment rises — matches the strongest 2026 literature:

- **Feedback *utilization* rises with capability.** "How Many Tries Does It Take?"
  (arXiv 2604.10508, Apr 2026): across seven models, the only model where self-repair
  lost to resampling was the weakest (Llama 3.1 8B); repair-success rate on failed
  problems rises with capability; high-baseline models show small absolute gains from
  ceiling effects. Caveats: greedy decoding, n=164/257, no significance tests.
- **Oracle vs self-generated test feedback are different regimes.** IBM/ETH (arXiv
  2602.06098, Feb 2026): oracle-test feedback lifts all tiers; self-test feedback is
  gated by test-writing ability ("irreducible regret" up to 30.67% on BigCodeBench).
  Our per-case feedback is oracle-regime, so the frontier null is a *redundancy*
  effect, not signal absence.
- **Procedural TDD is not the active ingredient.** TDAD (arXiv 2603.17973, Mar 2026,
  Qwen3-Coder-30B tier): impact-aware "which tests are at risk" context cut test-level
  regressions 70% and raised resolution 24%→32%, while TDD *prompting alone* increased
  regressions (6.08%→9.94%). Mid-tier evidence; mechanistic, not a frontier estimate.

Framing rule adopted from the reports: "weaker models benefit more" is a hypothesis
the literature partially contradicts, not an assumption. State frontier results as
ceiling/redundancy effects: the strong model generates the repair signal internally;
the question is at what complexity that internal signal stops sufficing.

## Design levers (each sourced; adopted/rejected status for e1-fulfillment-v1)

| # | Lever | Source evidence | Status |
| --- | --- | --- | --- |
| 1 | Scope inferable from the repo, not the spec — spec quantifies universally; obligations live in callers/siblings/registries readable in code | Failure taxonomies: "ignoring explicit/semantic dependencies", issue/stack-trace anchoring (Empirical Study on Failures in Automated Issue Solving, 2025); RefactorBench (~44% of failures never edited required files) | **Adopted** (M5 registry-scoped obligations), bounded by the no-ambiguity gate |
| 2 | Raise independent obligations with distinct justifications (6–12), not raw file count | RefactorBench (2–31 files, mean 4.3); NoCode-bench multi-file collapse (24.59%→5.66% single→multi); SWE-Bench-Verified hard slice 55.56% multi-file vs 3.09% easy | **Adopted** (M1 widened to 9 obligation classes) |
| 3 | Sequential poisoning: under-scoped fix at CPk passes CPk-local signals, breaks cases introduced at CPk+n | EvoClaw (frontier >80% isolated → ≤38% continuous milestones); SlopCodeBench (best strict solve 14.8%, GPT-5.5); SWE-Chain (resolving 44.8% / precision 65.4% mean across nine frontier configs) | **Adopted** (M6 invariant chains; the parity-clean *temporal* decoy) |
| 4 | Make brute-force turn-investment insufficient within the fixed budget; feedback's value = redirecting investment | TDAD (impact-aware context > procedure); our own data (DeepSeek never-passes ≡ budget_exhausted CPs) | **Adopted** (M7 turn-economy binding; 12-turn budget unchanged) |
| 5 | Metrics beyond AUC: dispersion covariate, scope/site recall, pass-to-pass precision | RepoExec Dependency Invocation Rate; "Understanding Code Agent Behaviour" superset-of-files localization criterion; hunk-divergence pass/fail separation (Behavioral Dynamics of Agentic Multi-Hunk Repair, 2025) | **Adopted** (secondary descriptives only; primary stays `regression_free_auc`) |
| 6 | Keep the oracle clean — harder must not mean noisier | OpenAI Frontier Evals audit (Feb 2026): 59.4% of 138 o3-unsolved SWE-Bench-Verified tasks had material test/spec defects; UTBoost; PatchDiff | **Adopted** (reference-100% and gate suite carried from v1) |
| 7 | Decoy local fix via content asymmetry: visible examples cover 1–2 surfaces, runnable feedback cases cover all sites | Report 3 ("Test Passed" as terminal signal); SWT-Bench precision-doubling via tests | **Rejected** (operator decision 2026-06-12): violates same-visible-content parity (AGENTS.md), reintroducing the confound the pricing v0 → content-controlled sequence existed to remove. Replaced by lever 3's temporal form, which is parity-clean: CPk-local signals are genuinely green in both arms. |
| 8 | Implicit coupling via non-code-like files (registry/config modules not imported by the edited file) | Agentless finding that agents assume "code" = source files; report 3 | **Adopted in code-native form** (M5: a declarative TS registry dispatched via the facade, never imported by the spec-salient files) |

Rejected as reference benchmarks: CrossCodeEval / RepoBench numbers — validated on
now-weak models (GPT-3.5, StarCoder, Codestral-22B), likely saturated at the frontier;
mid-tier-diagnostic only. Useful pointer retained: SWE-smith as a parameterized task
generator if a future family needs controlled dispersion.

## Report-quality caveats

- Report 3 (of 3) is the weakest: 2024-era model tiers (GPT-4o, Claude 3 Opus,
  DeepSeek Coder V2), no source links, several plausible-but-unverifiable specifics.
  Its numbers are directional only; its design levers converge with the two stronger
  reports.
- TDAD and "How Many Tries" are small-n with no significance testing — mechanistic
  evidence, not effect-size estimates for frontier 2026 models.
- Leaderboard figures (e.g., DeepSeek-V4-Pro 80.6% SWE-Bench Verified) are
  community-tracked and move monthly; verify against primary sources before citing in
  public artifacts.

## Predeclared future option: three-condition mechanism decomposition (LOCKED)

Recorded 2026-06-12, **before any e1-fulfillment run exists**, so that if it is ever
exercised the design predates the results it would explain. It is NOT part of the
evidence path. The standing guardrail ("do not add new arms") remains in force.

**Design sketch.** Three conditions on a sealed task, pairwise-compared, never pooled
with two-arm runs:

1. `feedback_capable_spec` — per-case executable oracle feedback (current treatment).
2. A self-generated-tests condition — the agent may author and run its own tests; no
   oracle cases mounted. Tests signal-utilization (gated by test-writing ability per
   IBM/ETH).
3. A static-hint condition — the agent receives the current red-case *list* as text
   (TDAD-style "which cases are failing"), with no execution capability. Tests whether
   scope-direction information alone suffices without executability.

Condition 3 hands feedback *output* to a non-executing arm, which AGENTS.md forbids
for `context_only_spec`; it therefore requires a **new condition ID**, its own
isolation rules, and its own protocol profile — it is not a tweak to either existing
arm.

**Unlock condition (all required, in order):**
1. The e1-fulfillment two-arm result is in and shows a frontier null or near-null
   delta (mechanism decomposition becomes necessary for the credibility narrative).
2. A documented revision of the "do not add new arms" guardrail in `BACKLOG.md` and
   `AGENTS.md`, made at a dated boundary.
3. A separate sealed protocol profile and commitments doc for the three-condition
   design, authored before any such run.
4. Explicit operator authorization for the runs.

Until all four hold, this section is documentation, and the Do-Not-Do-Next entry in
`BACKLOG.md` applies.
