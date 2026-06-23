# Run Card: e2-phase1-5-causal-pilot-deepseek-v4-pro-20260617-001

> **Update (2026-06-23):** the "single model → CANDIDATE, second model pending" framing below has been
> **satisfied** — the pre-registered second-lineage replication ran on **Qwen 3.7 Max** (n=9: gap
> 50%→0%, 5/9 significant, family-wise *p*≈3×10⁻⁵), so the effect is now **candidate → replicated
> across two independent lineages** (still bounded). See
> `e2-phase1-5-causal-pilot-qwen3.7-max-20260623.md` and Addendum C. This card is preserved as the
> original DeepSeek record.

| Field | Value |
| --- | --- |
| Run ID | `e2-phase1-5-causal-pilot-deepseek-v4-pro` |
| Date | 2026-06-17 |
| Program | E2 brownfield acceptance-feedback ablation — Phase-1.5 powered causal read |
| Classification | **`causal_pilot`** — the actual causal evidence (single model → CANDIDATE, not validated) |
| Model / route | `deepseek-v4-pro` (litellm openai-compatible, `api.deepseek.com`) |
| Harness | `hit-sdd-bench-e2` @ `f9fc5fa` |
| Commitments | `e2-phase1-pilot-commitments-v1.md` + Addendum B (flake-certified task list) |
| Result JSON SHA-256 | `009b00e8c5b92b7a2f91d0a16d33847de13a1e6560daea8b24b1d6ceb6e61632` |

## Design (sealed)
Two arms, identical task + repo, on contamination-screened, flake-certified post-cutoff SWE-bench-Live
brownfield tasks. **control** = OpenHands + file editor (cannot execute); **treatment** = + a
`run_tests` tool executing the HIDDEN acceptance oracle (binary pass/fail, no expected values). The
only manipulated variable is the ability to execute the acceptance oracle. **Primary metric:**
self-verification gap (agent declared done AND oracle would fail = false-confidence shipping), unit =
task-run. **Secondary:** resolve rate. N=10 runs/arm/task; one-sided permutation test per task +
family-wise error budget (MCID ≥0.20).

## Result — `candidate_frontier_positive`

**8 of 9 tasks are significant hits (p<0.05 AND effect ≥0.20); family-wise null p = 3.36×10⁻¹⁰.**

| task | control gap | treatment gap | effect | permutation p |
| --- | ---: | ---: | ---: | ---: |
| pypa__twine-1249 | 1.00 | 0.00 | +1.00 | <0.0001 |
| django-guardian-899 | 1.00 | 0.10 | +0.90 | <0.0001 |
| datamodel-code-generator-2408 | 0.90 | 0.00 | +0.90 | 0.0001 |
| datamodel-code-generator-2461 | 1.00 | 0.10 | +0.90 | 0.0002 |
| drf-json-api-1283 | 0.70 | 0.00 | +0.70 | 0.0021 |
| codecarbon-831 | 1.00 | 0.50 | +0.50 | 0.0144 |
| celery__kombu-2300 | 1.00 | 0.50 | +0.50 | 0.0180 |
| casbin__pycasbin-392 | 0.50 | 0.00 | +0.50 | 0.0168 |
| spulec__freezegun-582 | 0.00 | 0.00 | +0.00 | 1.000 (tractable null) |

**Aggregate:** self-verification gap **79% (control) → 13% (treatment)**; resolve rate **19% → 38%**
(treatment ~doubles solves). 1 errored rollout excluded.

## Interpretation (the self-verification gradient)
- **Tractable tasks (freezegun):** the model self-verifies without execution → feedback redundant (null).
- **Solvable-with-iteration (most tasks):** executable feedback drives an iterate-until-pass loop →
  treatment both **resolves more** and **stops false-confidence shipping**.
- **Beyond capability (e.g. twine, kombu — neither arm fully resolves):** feedback can't manufacture a
  fix but **prevents the agent declaring done while broken** (control gaps 1.00, treatment ≤0.50).

## Scope & caveats (honest)
- **Single model → `candidate`, not `validated`.** Per the pre-registered asymmetric rule, a second
  independent-lineage model is required before any public "frontier coding agents" claim.
- **Contrast is acceptance-execution vs NO-execution** — not vs the agent writing its own tests.
- **n = 9 of the 13 certified tasks.** The 4 large/complex repos (black ×2, attrs, kafka-python) were
  **deferred** — they thrash the file-editor-only control to the iteration cap (a *navigation*
  confound: control's disadvantage there is partly "no shell to navigate," not only "no test
  feedback"). The reported 9 are the small/medium repos where the control arm navigates fairly via the
  file editor → **navigation-confound-free**. Deferring them makes the result *cleaner*, not weaker.
- **Infra note:** the eval tier hit an intermittent scoring deadlock — `subprocess` can't time-out a
  `docker run` whose container leaves an orphaned process holding the stdout pipe (OrbStack + x86
  emulation). Fixed by redirecting container output to files (`f9fc5fa`); validated. It was never an
  OpenHands/concurrency issue. Not pooled with E1 or any other run.

## Status
Sealed `causal_pilot` result: **single-model candidate-frontier-positive** that executable acceptance
feedback reduces false-confidence shipping (79%→13%) and roughly doubles solve rate (19%→38%) for
DeepSeek V4 Pro at brownfield scale. Next: directional probes (Codex/Claude Code) + an independent
second model (Devstral/Gemini) to move candidate → validated.
