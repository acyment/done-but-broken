# Executable Acceptance Feedback Reduces False-Confidence Shipping in a Frontier Coding Agent at Brownfield Scale

**A single-model controlled ablation (candidate result)**

*Working draft v1 — 2026-06-17. Preliminary, single-model evidence; explicitly a candidate result, not a validated general claim (see §6).*

---

## Abstract

Agentic coding tools frequently declare a task *done* while the change does not actually satisfy the acceptance criteria — they ship broken work with confidence. We ask whether giving a frontier coding agent the ability to **execute** a hidden acceptance test suite (without revealing expected values) reduces this failure, at realistic brownfield scale. We run a controlled, two-arm ablation on real post-training-cutoff GitHub issues (SWE-bench Live), holding the task, repository, agent scaffold, and compute budget fixed and manipulating a single variable: whether the agent can run the acceptance oracle. Our primary outcome is the **self-verification gap** — the agent declares done while the hidden oracle would fail. On n = 9 contamination-screened, flake-certified tasks with DeepSeek V4 Pro (10 runs/arm/task), executable feedback reduces the self-verification gap from **79% to 13%** and roughly **doubles the resolve rate (19% → 38%)**; 8 of 9 tasks show a statistically significant benefit (one-sided permutation test; family-wise null probability ≈ 3.4×10⁻¹⁰). The effect follows a difficulty gradient — redundant on tractable tasks, generative on solvable ones, and diagnostic (preventing false-confidence) on tasks beyond the model's reach. We report this as a **candidate** result: it is single-model, and contrasts *acceptance-execution vs. no-execution* (not vs. agent-written tests). We pre-register a replication on a second, independent-lineage model before any general claim.

## 1. Introduction

Coding agents built on frontier LLMs increasingly operate over large existing codebases. A recurring, costly failure mode is **false-confidence shipping**: the agent edits source, declares the task complete, and stops — while the acceptance tests still fail. For teams, this is worse than an obvious failure: a confidently-wrong patch can be merged.

A natural intervention is to wire an **executable definition of done** into the agent loop — let the agent run the acceptance criteria and iterate. This is the operational form of behaviour-driven / specification-driven development: acceptance criteria not as documentation, but as something the agent executes. The open question is whether this *causally* helps a frontier model, or whether such models already self-verify well enough that execution is redundant.

This paper isolates that question with a controlled ablation in which the *only* manipulated variable is the agent's ability to execute the acceptance oracle.

## 2. Method

### 2.1 Substrate and task selection
Tasks are real GitHub issues from **SWE-bench Live**, filtered to be **post-training-cutoff** (created after 2026-04-30 for the model used), **regression-risk** (≥2 non-test files changed; ≥1 fail-to-pass test), and **certification-feasible** (moderate suite size, 100–1500 pass-to-pass tests), ≤2 per repository for diversity. Each instance ships a Docker image with the repository at its base commit.

### 2.2 Contamination screening (GATE B)
Because popular repositories are heavily represented in training data, we screen each task for memorization with a **verbatim code-continuation probe**: the model is given the exact prefix of a changed source region and asked to continue it; high n-gram overlap with the held-out suffix indicates recall rather than reasoning. A positive control (continuing the *Zen of Python*) scored 1.00, confirming the probe detects verbatim recall; the screened tasks scored ≈0, indicating no verbatim memorization. (Issue-only file-path identification is reported as a secondary, reasoning-confounded signal only.)

### 2.3 Determinism (GATE A)
The oracle must be trustworthy. Each task's gold-patched suite is run **60×** in the sanitized container; tasks are admitted only if patch-induced flakiness is bounded (≤5% upper bound), with flaky tests quarantined. This certifies the oracle is deterministic for each admitted task.

### 2.4 Arms (the single manipulated variable)
Both arms use an identical **OpenHands** agent on a *sanitized* checkout (future git history stripped; network disabled at run time; dependencies pre-baked so suites run offline), with the same model, prompt, and per-run iteration budget.

- **Control:** a host-safe file editor only — the agent can read and edit, but cannot execute anything.
- **Treatment:** the same, **plus a `run_tests` tool** that executes the hidden acceptance subset in a fresh sanitized container and returns per-check pass/fail — **no expected values are revealed.**

The only difference between arms is the ability to execute the acceptance oracle.

### 2.5 Primary outcome: the self-verification gap
For each run we record the agent's final patch and whether it **declared done** (it called the framework's `finish` action). We then score the patch against the hidden oracle (fail-to-pass + pass-to-pass tests; flaky and deterministically-fail-under-gold tests excluded). The **self-verification gap** is the event:

> *declared done* **AND** *the oracle would fail* — i.e., the agent shipped something it believed correct that the oracle catches.

Unit of analysis: the task-run. Secondary outcome: **resolve rate** (all fail-to-pass tests pass). Tertiary (logged): pass-to-pass regressions.

### 2.6 Model and design
Model: **DeepSeek V4 Pro** (a reasoning model), via a direct provider API. **N = 10 runs per arm per task.** Analysis: a one-sided **permutation test** per task on (control gap-rate − treatment gap-rate), combined across tasks with a family-wise binomial error budget; a task is a "hit" if it is significant (p < 0.05) and clears a minimum-clinically-important difference (MCID) of 0.20 absolute. By a pre-registered **asymmetric single-model rule**, a positive result is "candidate-frontier-positive"; a single-model null would be inconclusive.

## 3. Results

On **n = 9** tasks (10 runs/arm/task; one errored rollout excluded):

| Task | Control gap | Treatment gap | Effect | Permutation p |
|---|---:|---:|---:|---:|
| twine-1249 | 1.00 | 0.00 | **+1.00** | <0.0001 |
| django-guardian-899 | 1.00 | 0.10 | **+0.90** | <0.0001 |
| datamodel-code-generator-2408 | 0.90 | 0.00 | **+0.90** | 0.0001 |
| datamodel-code-generator-2461 | 1.00 | 0.10 | **+0.90** | 0.0002 |
| drf-json-api-1283 | 0.70 | 0.00 | **+0.70** | 0.0021 |
| codecarbon-831 | 1.00 | 0.50 | **+0.50** | 0.0144 |
| kombu-2300 | 1.00 | 0.50 | **+0.50** | 0.0180 |
| pycasbin-392 | 0.50 | 0.00 | **+0.50** | 0.0168 |
| freezegun-582 | 0.00 | 0.00 | +0.00 | 1.000 |

**8 of 9 tasks are significant hits; family-wise null probability ≈ 3.36×10⁻¹⁰.** The single null is the most tractable task.

**Aggregate (across all runs):**

| Outcome | Control | Treatment |
|---|---:|---:|
| Self-verification gap | **79%** (70/89) | **13%** (12/90) |
| Resolve rate | **19%** (17/89) | **38%** (34/90) |

Executable feedback both **near-eliminates false-confidence shipping** and **roughly doubles the solve rate.**

## 4. Discussion: a difficulty gradient, not a switch

The per-task pattern indicates that executable feedback's value *scales with task difficulty*:

1. **Tractable tasks** (e.g. freezegun): the model reconstructs the acceptance behaviour from the source/spec and solves blind — feedback is **redundant** (gap 0 in both arms).
2. **Solvable-with-iteration tasks** (e.g. pycasbin, drf-json-api): feedback drives an *iterate-until-pass* loop, so treatment **resolves more** (e.g. drf-json-api resolve 2/10 → 10/10).
3. **Beyond-capability tasks** (e.g. twine, kombu — neither arm fully resolves): feedback cannot manufacture a fix, but it **prevents the agent from declaring done while broken** (control gap 1.00 → treatment ≤0.50).

The mechanism is not "the model became smarter." It is that the agent gained a way to **check itself against an executable definition of done** — the operational case for executable acceptance criteria (BDD/spec-driven) wired into the agent loop as something the agent *runs*, not as prose.

## 5. Related context (brief)

This complements benchmark leaderboards (which report end success) by isolating a *causal* lever and a *mechanistic* outcome (false confidence) rather than a single saturated score. It is consistent with prior observations that frontier models collapse at multi-file/brownfield scale and that self-generated tests are largely observational; here the manipulated signal is an external, executable acceptance oracle.

## 6. Limitations (these bound the claim)

- **Single model ⇒ candidate, not validated.** This is one frontier model. We do not claim generality across models; a second independent-lineage replication is required (and pre-registered) before a "frontier coding agents" claim.
- **Contrast is acceptance-execution vs. no-execution** — *not* vs. the agent writing and running its own tests. The control cannot execute anything, which is a deliberately clean but conservative baseline; it does not establish superiority over self-testing.
- **n = 9 of 13 certified tasks.** Four large/complex repositories were deferred: the no-shell control thrashes them to the iteration cap, introducing a *navigation* confound (its disadvantage there is partly "cannot navigate the repo," not only "cannot run tests"). The reported 9 are the small/medium repositories where the control navigates fairly via the file editor — i.e., the navigation-confound-free subset. (An eval-tier infrastructure deadlock under x86 container emulation was diagnosed and fixed during the study; it did not affect the recorded outcomes.)
- **Scope:** single-language (Python) brownfield repositories, one agent scaffold (OpenHands), one run budget. The self-verification gap is a black-box proxy (declared-done ∧ oracle-fail); the contamination probe is an n-gram continuation proxy, not perplexity/membership-inference.

## 7. Conclusion and next steps

For DeepSeek V4 Pro at brownfield scale, **executable acceptance feedback reduces false-confidence shipping from 79% to 13% and roughly doubles the resolve rate (19% → 38%)**, with the benefit scaling from redundant (easy) to generative (medium) to diagnostic (hard). We report this as a **candidate** result. Planned next steps: (i) a directional measurement of the self-verification gap on the coding agents practitioners actually use (Codex, Claude Code) as-is; (ii) a controlled replication on a second, independent-lineage model to move from candidate to validated. We will report those outcomes including null results.

**Practical implication.** For teams building or adopting agentic coding tools, the cheapest reliability upgrade may not be a larger model — it may be giving the agent an *executable* definition of done and requiring it to run it before declaring success.

## Appendix A — Reproducibility & provenance

- Harness: `hit-sdd-bench-e2` @ commit `f9fc5fa` (Python/Docker; OpenHands agent; SWE-bench Live substrate). Scientific record: `hit-sdd-bench`.
- Pre-registration: `e2-phase1-pilot-commitments-v1.md` + Addendum B (the sealed 13-task certified list); analysis plan `e2-phase1-5-plan-v1.md`. Classification: `causal_pilot`.
- Result artifact: `e2-phase1-5-causal-pilot-deepseek-v4-pro.json`, SHA-256 `009b00e8c5b92b7a2f91d0a16d33847de13a1e6560daea8b24b1d6ceb6e61632`.
- Gates: contamination screen (run card `e2-phase1-5-gateb-poolv2-new-...`), feasibility (`e2-phase1-5-gate-a-poolv2-...`), N=60 flake certification (`e2-phase1-5-flake-certify-poolv2-...`).
- Sanitization: git history stripped to base commit; `--network none` at run time; dependencies pre-baked at image-build time so suites run offline.

*This is a working draft for discussion, not a peer-reviewed publication. Numbers are from a single-model causal pilot and are explicitly preliminary.*
