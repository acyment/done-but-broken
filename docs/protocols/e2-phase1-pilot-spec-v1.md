# E2 Phase-1 Pilot Spec (v1) — Brownfield Acceptance-Feedback Ablation, thin go/no-go slice

Date: 2026-06-13. **Status: precommitted pilot spec, before any harness build or run.** Phase 1 of the
E2 program (`docs/protocols/e2-brownfield-acceptance-ablation-design-v1.md`). Docs-only; this document
authorizes no build and no runs. The pilot itself requires a separate sealed commitments doc
(`e2-phase1-pilot-commitments-v1.md`) and explicit operator authorization.

## Why a pilot before the program

The E2 design questions are settled by research; the remaining unknowns are empirical and only a build
answers them. Rather than commit to the full ~1,800-run program, this pilot is a ~10-task thin slice
that is the program's **first go/no-go gate**. It answers three questions cheaply:
1. Can we build and run the two-arm Docker harness reproducibly on real SWE-bench Live instances?
2. Can we measure and control contamination (the single most likely study-killer)?
3. Early read on **H0**: at multi-file scale, does the `control` arm actually introduce regressions the
   `treatment` arm avoids/catches — or do frontier agents self-verify their way to parity anyway?

If H0 holds even here, we reconsider the whole program before spending. If `control` is clearly worse,
we proceed to the full design with confidence.

## Scope (deliberately minimal — what this pilot is and is NOT)

| In scope | Deferred to later phase |
| --- | --- |
| Factor F only: `control` (no oracle exec) vs `treatment` (can exec hidden acceptance oracle) | Factor C (context provision) 2×2 — full causal pilot |
| `retrieved` context only | `curated-full` context cell |
| ~10 tasks | Full 50–80 regression-risk-filtered set |
| 1 frontier model — **DeepSeek V4 Pro** (endpoint in `.env`) | Multi-model (Claude-class, GPT-5-class) |
| N=5 runs/arm/task (~100 runs) | Full power run |
| Primary signal: **P2P regression count (pass→fail)** | PatchDiff/UTBoost differential testing |

**Operator-adjustable choices (recommended defaults):** model = DeepSeek V4 Pro (1); PatchDiff deferred;
agent scaffold = OpenHands (SWE-bench Live's reference; verify vs SWE-agent before building).

## Predeclared go/no-go gates (no reinterpretation after results)

- **GATE A — Feasibility.** The harness runs all 10 tasks end-to-end in Docker, reproducibly: per-task
  flaky rate (over N=10 baseline runs, §Determinism) ≤ **5%**, and every run produces replay-valid
  artifacts (hashes verify, no missing/schema-error artifacts). *Fail → fix infra before any scaling.*
- **GATE B — Contamination controllable.** Memorization probes (§Memorization) produce a usable
  per-task signal, and ≥ **8 of 10** tasks fall below the predeclared memorization-exclusion threshold
  while remaining post-cutoff. *Fail → substrate/filter rethink (the candidate substrate is biased
  toward a false null).*
- **GATE C — H0 early read.** Over the tasks passing A+B, compare per-arm regression behavior.
  - `treatment` shows **materially fewer** P2P regressions than `control` (predeclare: ≥1 task where
    `control` regresses an existing P2P test that `treatment` does not, replicated across ≥3 of 5 runs)
    ⇒ **GO**: the brownfield feedback effect is plausibly real → proceed to the full program.
  - `control ≈ treatment` (both ~zero regressions, or no replicated gap) ⇒ **early H0-holds signal**:
    frontier self-verification survives at this scale → reconsider the program / escalate task scale
    before spending.
  This pilot is directional, not powered for a significance claim; GATE C informs the GO decision, it
  does not constitute evidence.

## Task selection (reproducible, pre-registered)

Source: **SWE-bench Live** (post-2024, monthly-updated, Docker per instance).
1. **Post-cutoff filter:** keep only instances whose issue+PR postdate DeepSeek V4 Pro's training
   cutoff (use the latest available Live slice; record the cutoff date used).
2. **Regression-risk filter (all must hold):**
   - gold patch modifies **≥ 2 non-test source files**;
   - modified code paths are covered by **≥ 5 existing tests** (coverage analysis on the base image);
   - **non-trivial P2P** set (the instance carries existing pass-to-pass tests over the modified area);
   - high call-graph coupling (modified symbols called by ≥ 2 other modules) — heuristic, recorded.
3. **Repo scale:** prefer instances from repos ≥ 400 files (brownfield).
4. Rank survivors by regression-risk heuristics; take the top **10**. Freeze the exact 10 task IDs +
   the filter parameters in the commitments doc **before any run**.

## Harness shape (build-ready)

- **Base:** fork SWE-bench Live's evaluation harness (Docker image per instance, F2P+P2P runner,
  time-machine dependency pinning). Agent scaffold: **OpenHands** (Live's validated setup) — verify it
  exposes tool-config so the feedback channel can be toggled; fall back to SWE-agent if not.
- **Feedback channel = a toggleable tool.** `treatment` is given a `run_tests` tool that executes the
  **fast hidden subset** (tests covering the modified paths) and returns **per-scenario pass/fail**
  (acceptance/reproduction-flavored, no expected values, no full-suite dump). `control` does not have
  this tool — it may still write and run its OWN tests via the normal shell, but cannot invoke the
  hidden oracle. This is the only difference between arms.
- **Adversarial snapshot sanitization (mandatory):** before the agent sees the repo, strip future
  commits, remotes, branches, tags, and reflog; block network. Agents have provably exploited
  `git log --all` to read future/fix commits in both SWE-bench and Pro's OSS set — do not trust
  upstream images; sanitize and verify no `git show <fix>` path exists.
- **Compute-budget equalization:** equalize turn/token budget across arms (running the oracle consumes
  budget); record per-run budget for budget-normalized reporting.
- **Artifact capture (mirror the provenance discipline, not the code):** capture, per run, the
  sanitized repo snapshot hash, container image ID, the agent trajectory, the produced patch, the
  online-feedback calls (count + results), and the final full-suite + P2P results. Validate hashes on
  replay. Mirror the concepts in `src/provenance.ts` (`RunCompatibilityProfile`, `ReplayPlan`,
  `RUN_VALIDITY_FLAGS`); extend validity scopes/phases for container concerns (image-pull timeout,
  OOM). E2 builds this fresh — the current repo is entirely in-process (no Docker/subprocess-for-repo
  code to reuse).

## Memorization-probe procedure (contamination covariate)

Run per task (and per model), before/independent of the ablation:
- **Issue-only file-path identification:** give the model the issue text only (no repo); measure
  top-k accuracy at naming the gold-patch files. Predeclared flag: > **60%** ⇒ high memorization.
- **Function-body reproduction:** give a signature + its file; measure consecutive 5-gram overlap with
  the real body. Predeclared flag: > **25%** ⇒ high memorization.
Report the memorization rate per task as a covariate; exclude tasks exceeding both thresholds from
GATE C (they bias toward the null). Method anchors: *The SWE-Bench Illusion* (76% file-id from issue
alone on Verified vs ~53% novel).

## Oracle

- **Latent surface:** the project's full developer test suite (the real, strong regression oracle).
- **Online feedback (treatment only):** a **fast hidden subset** = tests covering the modified paths
  (identified by coverage analysis), to keep feedback latency manageable.
- **Primary pilot signal:** **P2P regression count** — existing tests passing at baseline that fail
  after the agent's patch. Also record F2P resolve rate and full-suite pass.
- **Deferred:** PatchDiff/UTBoost differential testing (the "passes the suite ≠ correct" hardening,
  ~30% of plausible patches still wrong) is a Phase-2 oracle upgrade; note as stretch, not required for
  the GATE C directional read.

## Determinism shakedown

Before any ablation run, execute each selected instance's suite **N=10 times** on the base commit;
mark tests with inconsistent results as flaky and exclude them from both the online subset and the P2P
oracle. Feeds GATE A's flaky-rate criterion.

## Metrics, classification, budget

- **Metrics:** feasibility (end-to-end success + flaky rate), contamination (memorization
  distribution), early-H0 (per-arm P2P regression count, and — from trajectories — whether `control`'s
  own self-tests would have caught the regression). All stratified by task.
- **Classification:** the feasibility/determinism portion is `calibration`; the H0 read is
  `difficulty_probe`. Neither is causal evidence (`causal_pilot` is the full program, later).
- **Pre-registration:** seal `e2-phase1-pilot-commitments-v1.md` (commit-then-reveal SHA-256 of: this
  spec, the frozen 10 task IDs + filter params, the memorization/flaky thresholds, the sanitized
  snapshot manifest, the harness commit) before running. Mirror the
  `docs/protocols/e1-billing-v2-commitments-v4.md` + `…-stage1-plan-v4.md` pattern.
- **Budget:** ~10 tasks × 2 arms × 5 runs = ~100 runs (1 model). DeepSeek V4 Pro is cheap
  (~$0.26/run-class on prior E1 work; brownfield trajectories are longer — budget a small per-run cap
  and an overall pilot cap in the commitments doc). All runs operator-authorized.

## Reuse vs build-new

- **Reuse (discipline, not code):** run-card layout (`docs/run-cards/`); classification + validity
  concepts (`src/provenance.ts`); commitments/sealed-plan pre-registration pattern
  (`docs/protocols/e1-billing-v2-commitments-v4.md`, `…-stage1-plan-v4.md`); evidence recording
  (`docs/public-evidence-status.md`, `docs/progress-log.md`).
- **Build new:** Docker runner + agent scaffold fork, the toggleable `run_tests` feedback tool, the
  snapshot-sanitization wrapper, the memorization probe, the flaky-detection loop, container-aware
  artifact capture/replay. None of this exists in-repo today.

## What this pilot explicitly does NOT establish

A `causal_pilot`-grade result, any public claim, the context (coverage-vs-reasoning) separation, the
PatchDiff-hardened correctness metric, or multi-model generality. Those are Phases 2–4 of the program
boundary. The pilot's only job is the A/B/C go/no-go.
