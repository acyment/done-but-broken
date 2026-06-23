# HIT-SDD Bench

### Do AI coding agents ship broken code while saying *"done"* — and does making them run the spec fix it?

Welcome 👋 This repo is the **scientific record** for a small, carefully-run line of experiments on
agentic coding. If you're a curious visitor, you're in the right place — start with the short version
below, then follow the links.

**HIT-SDD = Harnessed Iterative Spec-Driven Development**: the idea that an agent should run an
*executable* definition of "done" (its acceptance spec) **on every iteration of its own loop**, as its
stopping condition — not just read a spec as prose. This repo asks whether that measurably helps.

---

## The short version

- **The problem.** Coding agents routinely declare a task *done* while the change still fails its
  acceptance tests — they ship broken work *confidently*. On real codebases that's the reliability
  problem teams actually hit: a loud failure gets caught, a confident one gets reviewed and merged.
- **The experiment.** We change exactly **one** thing about an otherwise-identical frontier coding
  agent: whether it can **run the hidden acceptance tests** (without seeing the expected answers)
  before declaring done. Same agent, same task, same repo, same budget — only that one tool differs.
- **The result, now on two independent models.** Letting the agent run the spec **near-eliminates
  confidently-wrong shipping** on real, post-cutoff brownfield bugs (SWE-bench Live):

  | Model (independent lineages) | "done but actually broken" | also fixes more? | significance |
  | --- | --- | --- | --- |
  | **DeepSeek V4 Pro** | **79% → 13%** | yes — fix rate ~doubled (19% → 38%) | 8/9 tasks, family-wise *p* ≈ 3×10⁻¹⁰ |
  | **Qwen 3.7 Max** (replication) | **50% → 0%** | flat (37% → 36%) — purely *diagnostic* here | 5/9 tasks, family-wise *p* ≈ 3×10⁻⁵ |

- **It's not one model's quirk.** The production tools developers use today — **OpenAI Codex
  (GPT-5.5)** and **Anthropic Claude Code (Opus 4.8)** — show the *same* confident-but-broken shipping
  on the hard tasks (~67–73%), **even though they already run their own tests.** Running *your own*
  tests isn't the same as running the *acceptance contract*.
- **The honest caveat (please read §"How honest is this").** This is **preliminary, bounded**
  evidence — two models, one task family, one scaffold. It is a strong reason to *pilot* an
  execution-gated agent loop and measure your own "done-but-broken" rate — **not** a settled benchmark.

## 📄 Start here

- **The proto-paper (read this first):**
  [`docs/papers/e2-executable-feedback-protopaper-v1.md`](docs/papers/e2-executable-feedback-protopaper-v1.md)
  — the full method, results, and limitations, written for both researchers and engineering leaders.
- **The evidence, replayable:**
  - Qwen run-card → [`docs/run-cards/e2-phase1-5-causal-pilot-qwen3.7-max-20260623.md`](docs/run-cards/e2-phase1-5-causal-pilot-qwen3.7-max-20260623.md)
  - DeepSeek run-card → [`docs/run-cards/e2-phase1-5-causal-pilot-deepseek-v4-pro-20260617-001.md`](docs/run-cards/e2-phase1-5-causal-pilot-deepseek-v4-pro-20260617-001.md)
  - Machine-readable summaries (per-task rates + verdict + artifact SHA) live next to each run-card as `*.summary.json`.
- **The honest ledger:** [`docs/public-evidence-status.md`](docs/public-evidence-status.md) and
  [`docs/public-evidence-matrix.md`](docs/public-evidence-matrix.md) — every run with its
  classification and validity flags.

## What "HIT-SDD" means here

The thing we're testing is **executable acceptance feedback wired into the agent's loop**: the agent
runs the hidden acceptance subset, sees pass/fail per check (never the expected values), and keeps
going until it's satisfied. That's the operational core of behaviour-/spec-driven development — the
spec as the agent's *stopping condition*, executed, not documentation it reads.

> Note on naming: "HIT-SDD" / BDD / OpenSpec are **narrative framing**, never an experimental
> condition or arm. In every run the manipulated variable is simply *"can the agent execute the
> acceptance oracle."*

## How the work is structured

This is a two-repo project:

- **`hit-sdd-bench` (this repo) — the scientific record.** Design docs, pre-registered commitments,
  run-cards, evidence ledgers, the proto-paper, and the older E1 framework skeleton. It is the source
  of truth for *what every run means*.
- **`hit-sdd-bench-e2` (companion repo) — the harness.** The Python/Docker harness that actually runs
  the E2 experiment (SWE-bench Live substrate, OpenHands agent, the toggleable `run_tests` tool, the
  flake-certification + contamination screens, the scorer, the permutation analysis).

Helpful map of this repo:

```
docs/
  papers/        ← the proto-paper
  protocols/     ← program design, pre-registered commitments, analysis plans, future-study designs
  run-cards/     ← one replayable card per run (+ machine-readable summaries)
  public-evidence-*.md   ← the honest ledger of every run + classification
AGENTS.md        ← the evidence-discipline rules we hold ourselves to
tasks/, src/, test/      ← the earlier E1 framework skeleton (see below)
```

## How honest is this? (the discipline)

We try hard not to overclaim. A few load-bearing rules (full version in
[`AGENTS.md`](AGENTS.md)):

- **Every run is classified** — `calibration`, `difficulty_probe`, `causal_pilot`, or
  `diagnostic_invalid` — and only clean `causal_pilot` runs back causal claims.
- **Pre-registration:** the analysis plan, primary metric, and task list are frozen *before* a causal
  run (see the commitments docs in `docs/protocols/`).
- **Replay-valid where possible:** results carry SHA-256 hashes; the cited artifacts are tracked so the
  hashes resolve. (Where we lean on the N=60 flake certification for determinism instead of patch
  re-scoring, we say so.)
- **Bounded language on purpose.** This result is a **candidate → replicated across two lineages**
  finding — *not* a general "frontier agents" law. We prefer "preliminary / bounded / under this
  model+budget" to "proved / solved / benchmark shows."

Where the claim is bounded today: single language (Python) brownfield repos, one agent scaffold, one
effort budget; the contrast is *execution vs. no-execution* (not vs. the agent writing its own tests);
n = 9 of 13 certified tasks (the four largest repos carry a navigation confound and are reported
separately). See the proto-paper §7.

## What's next (pre-registered, not yet run)

Three follow-up studies are designed and gated in `docs/protocols/`:

- **Budget sensitivity** — does the benefit shift from *diagnostic* to *generative* as the agent gets
  more iterations? ([`e2-budget-sensitivity-design-v1.md`](docs/protocols/e2-budget-sensitivity-design-v1.md))
- **Large-repo, navigation-equalized (Protocol v2)** — does the effect hold (or grow) on big
  codebases once both arms can navigate? ([`e2-protocol-v2-large-repo-navparity-design-v1.md`](docs/protocols/e2-protocol-v2-large-repo-navparity-design-v1.md))
- **A "confoundability" metric** — can we *predict, before any attempt,* where an agent will
  confidently ship broken code? ([`e2-confoundability-metric-design-v1.md`](docs/protocols/e2-confoundability-metric-design-v1.md))

If your team has wired (or wants to wire) an executable definition of "done" into an agent loop, the
proto-paper's closing section explains how to compare notes.

## Background: the E1 capability-gradient finding

Before the brownfield work, an earlier line (E1) found that on **small, fully-specified** refactoring
tasks, frontier models **self-verify well enough that executable feedback is redundant** — the benefit
concentrated at the mid-tier / un-self-verifiable end. That standalone result motivated the move to
brownfield scale. See [`docs/e1-capability-gradient-finding-v1.md`](docs/e1-capability-gradient-finding-v1.md).

---

## The E1 framework skeleton (code in this repo)

This repo also contains the original small two-arm framework (TypeScript/Bun) used for the E1 line: a
two-condition packet renderer, executable-feedback gating, a continuing-workspace runner with
provenance/replay hashing, `result-schema-v1` (final-pass rate, regression count, regression-free
AUC), task packages under `tasks/`, and a fake-agent + direct-provider adapters. It is a focused
skeleton, **not** a general benchmark platform.

Run the sample task end-to-end with the fake agent (no provider calls):

```sh
bun install
bun test
bun run pilot:fake --task tasks/sample-cart --runs-root runs --run-id sample-local
```

Inspect/validate a completed run (checks the replay plan, declared artifacts, and hashes):

```sh
bun run inspect:run --run-manifest runs/sample-local/run.json
```

Real single-shot / bounded feedback-loop adapters call a provider directly; see the commands and the
metric-interpretation notes in [`docs/`](docs/) and [`AGENTS.md`](AGENTS.md). Tooling: **Bun** for
JS/TS, **uv** for any Python. Real provider/model runs are operator-authorized only.

## License

© 2026 Alan Cyment. **Dual-licensed:**

- **Code** (the framework/harness) — **MIT** ([`LICENSE`](LICENSE)).
- **Docs, papers, run-cards, and evidence** (everything under `docs/`, plus this README's prose) —
  **CC BY 4.0** ([`LICENSE-docs`](LICENSE-docs)). Please **share, quote, and cite the findings and the
  proto-paper freely — just credit Alan Cyment.**

Third-party material — the SWE-bench Live substrate, the evaluation images and the open-source
repositories they contain, and run-artifacts that embed upstream code/model outputs — keeps its own
upstream license; see [`NOTICE`](NOTICE).

---

*Working drafts for discussion, not peer-reviewed. All results explicitly preliminary and bounded.*
