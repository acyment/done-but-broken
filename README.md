# Done but Broken

### When AI coding agents say *"done"* but ship broken code — and what measurably fixes it

Welcome 👋 This repo is the **scientific record** for a small, carefully-run line of experiments on
agentic coding. If you're a curious visitor, start with the short version below, then follow the links.

The thing we actually measure here is **executable acceptance feedback**: giving a coding agent the
ability to **run the hidden acceptance tests** (the acceptance contract) — without seeing the expected
answers — *before* it declares a task done, and seeing whether that reduces confidently-wrong shipping.

> **Where this is heading (not yet tested).** The north star is **HIT-SDD — Harnessed Iterative
> Spec-Driven Development**: agents driving work from an *authored* executable spec (e.g.
> OpenSpec/Gherkin scenarios) run on every loop as the definition of done. What's below is early
> evidence for the *executable-feedback mechanism* HIT-SDD relies on — **not** the full practice. The
> authored-spec / OpenSpec-Gherkin study is the pre-registered next step (see "What's next").

---

## The short version

- **The problem.** Coding agents routinely declare a task *done* while the change still fails its
  acceptance tests — they ship broken work *confidently*. On real codebases that's the reliability
  problem teams actually hit: a loud failure gets caught, a confident one gets reviewed and merged.
- **The experiment.** We change exactly **one** thing about an otherwise-identical frontier coding
  agent: whether it can **run the hidden acceptance tests** before declaring done. Same agent, same
  task, same repo, same budget — only that one tool differs.
- **The result, now on two independent models.** Letting the agent run the acceptance contract
  **sharply reduces confidently-wrong shipping** on real, post-cutoff brownfield bugs (SWE-bench Live):

  | Model (independent lineages) | "done but actually broken" | also fixes more? | significance |
  | --- | --- | --- | --- |
  | **DeepSeek V4 Pro** | **79% → 13%** | yes — fix rate ~doubled (19% → 38%) | 8/9 tasks, family-wise *p* ≈ 3×10⁻¹⁰ |
  | **Qwen 3.7 Max** (replication) | **50% → 0%** | flat (37% → 36%) — purely *diagnostic* here | 5/9 tasks, family-wise *p* ≈ 3×10⁻⁵ |

- **It's not one model's quirk.** The production tools developers use today — **OpenAI Codex
  (GPT-5.5)** and **Anthropic Claude Code (Opus 4.8)** — show the *same* confident-but-broken shipping
  on the hard tasks (~67–73%), **even though they already run their own tests.** Running *your own*
  tests isn't the same as running the *acceptance contract*.
- **The honest caveat (please read §"How honest is this").** This is **preliminary, bounded**
  evidence — two models, one task family, one scaffold. Two bounds to hold up front: the control arm
  **cannot run anything at all**, so this is *acceptance-execution vs. no-execution* — **not** vs. an
  agent running its own tests (a fairer, harder baseline we have not yet run); and the two headline
  runs are **not patch-replay-valid** (patch text + full traces weren't retained — a harness gap since
  fixed). A strong reason to *pilot* an execution-gated agent loop and measure your own
  "done-but-broken" rate — **not** a settled benchmark.

## 📄 Start here

- **The proto-paper (read this first):**
  [`docs/papers/e2-executable-feedback-protopaper-v1.md`](docs/papers/e2-executable-feedback-protopaper-v1.md)
  — full method, results, and limitations, for both researchers and engineering leaders.
- **The evidence** (run-cards + machine-readable summaries are committed *here*; the full raw run
  artifacts live in the companion `done-but-broken-harness` repo, referenced by SHA):
  - Qwen run-card → [`docs/run-cards/e2-phase1-5-causal-pilot-qwen3.7-max-20260623.md`](docs/run-cards/e2-phase1-5-causal-pilot-qwen3.7-max-20260623.md)
  - DeepSeek run-card → [`docs/run-cards/e2-phase1-5-causal-pilot-deepseek-v4-pro-20260617-001.md`](docs/run-cards/e2-phase1-5-causal-pilot-deepseek-v4-pro-20260617-001.md)
  - Machine-readable summaries (per-task rates + verdict + artifact SHA) sit next to each run-card as `*.summary.json`.
- **The honest ledger:** [`docs/public-evidence-status.md`](docs/public-evidence-status.md) and
  [`docs/public-evidence-matrix.md`](docs/public-evidence-matrix.md) — every run with its
  classification and validity flags.

## What we measured — and what we haven't (yet)

**Measured:** *executable acceptance feedback.* Both arms are the same OpenHands agent on a sanitized
copy of a real repo; the treatment arm additionally gets a `run_tests` tool that executes the hidden
acceptance subset and returns pass/fail per check (never the expected values). The one manipulated
variable is *"can the agent execute the acceptance contract."* The agent runs **pre-existing** tests —
it does not author a spec.

**Not yet:** *HIT-SDD proper.* The full practice — an agent developing against an **authored**
executable spec (OpenSpec/Gherkin scenarios as the definition of done) — is **not** what these runs
tested. It's the pre-registered future direction. Treat "HIT-SDD" throughout as the **vision/narrative
frame**, never an experimental condition.

## How the work is structured

Two repos:

- **`done-but-broken` (this repo) — the scientific record.** Design docs, pre-registered commitments,
  run-cards, evidence ledgers, the proto-paper, and an older framework skeleton (E1). The source of
  truth for *what every run means*.
- **`done-but-broken-harness` (companion repo) — the harness.** The Python/Docker harness that runs the
  experiment (SWE-bench Live substrate, OpenHands agent, the toggleable `run_tests` tool,
  flake-certification + contamination screens, the scorer, the permutation analysis). *(Its Python
  package is `hit_sdd_e2`, and sealed run-cards record the harness under its historical name — those
  are provenance, left as-is.)*

Map of this repo:

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

We try hard not to overclaim — including about the name (we measured *executable acceptance feedback*,
not HIT-SDD). A few load-bearing rules (full version in [`AGENTS.md`](AGENTS.md)):

- **Every run is classified** — `calibration`, `difficulty_probe`, `causal_pilot`, or
  `diagnostic_invalid` — and only clean `causal_pilot` runs back causal claims.
- **Pre-registration:** the analysis plan, primary metric, and task list are frozen *before* a causal
  run (see the commitments docs in `docs/protocols/`).
- **Replay-valid where possible:** results carry SHA-256 hashes; summaries are committed here and the
  SHA-cited raw artifacts are tracked in the companion harness repo, so the hashes resolve once both
  repos are public. (Where determinism rests on the N=60 flake certification rather than patch
  re-scoring, we say so — patch *text* wasn't retained for the pilots.)
- **Bounded language on purpose.** This is a **candidate → replicated across two lineages** finding,
  *not* a general "frontier agents" law. We prefer "preliminary / bounded / under this model+budget"
  to "proved / solved / benchmark shows."

Bounds today: single language (Python) brownfield repos, one agent scaffold, one effort budget; the
contrast is *execution vs. no-execution* (not vs. the agent writing its own tests); n = 9 of 13
certified tasks (the four largest repos carry a navigation confound, reported separately). See the
proto-paper §7.

## What's next (pre-registered, not yet run)

Designed and gated in `docs/protocols/`:

- **Full HIT-SDD (authored specs, OpenSpec/Gherkin)** — the actual spec-driven study this work is
  early evidence for: does an agent driving development from an *authored* executable spec ship less
  broken code? (the next-program direction)
- **Budget sensitivity** — does the benefit shift from *diagnostic* to *generative* with more
  iterations? ([`e2-budget-sensitivity-design-v1.md`](docs/protocols/e2-budget-sensitivity-design-v1.md))
- **Large-repo, navigation-equalized (Protocol v2)** — does the effect hold/grow on big codebases once
  both arms can navigate? ([`e2-protocol-v2-large-repo-navparity-design-v1.md`](docs/protocols/e2-protocol-v2-large-repo-navparity-design-v1.md))
- **A "confoundability" metric** — can we *predict, before any attempt,* where an agent will
  confidently ship broken code? ([`e2-confoundability-metric-design-v1.md`](docs/protocols/e2-confoundability-metric-design-v1.md))

If your team has wired (or wants to wire) an executable definition of "done" into an agent loop, the
proto-paper's closing section explains how to compare notes.

## Background: the E1 capability-gradient finding

An earlier line (E1) found that on **small, fully-specified** refactoring tasks, frontier models
**self-verify well enough that executable feedback is redundant** — the benefit concentrated at the
mid-tier / un-self-verifiable end. That motivated the move to brownfield scale. See
[`docs/e1-capability-gradient-finding-v1.md`](docs/e1-capability-gradient-finding-v1.md).

---

## The E1 framework skeleton (code in this repo)

This repo also contains the original small two-arm framework (TypeScript/Bun) used for the E1 line: a
two-condition packet renderer, executable-feedback gating, a continuing-workspace runner with
provenance/replay hashing, `result-schema-v1` (final-pass rate, regression count, regression-free
AUC), task packages under `tasks/`, and a fake-agent + direct-provider adapters. A focused skeleton,
**not** a general benchmark platform.

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

The older bounded feedback-loop adapter is **calibration-only**: it gates writes to feedback-asset
paths but does not harden the workspace against tampering (e.g. `package.json`/config) the way the
E1 L0 harness does — don't treat it as a sandboxed eval runner. Real single-shot / bounded
feedback-loop adapters call a provider directly; see the commands and
metric-interpretation notes in [`docs/`](docs/) and [`AGENTS.md`](AGENTS.md). Tooling: **Bun** for
JS/TS, **uv** for any Python. Real provider/model runs are operator-authorized only.

## License

© 2026 Alan Cyment. **Dual-licensed:** code (the framework/harness) under **MIT**
([`LICENSE`](LICENSE)); docs, papers, run-cards, and evidence (everything under `docs/`, plus this
README's prose) under **CC BY 4.0** ([`LICENSE-docs`](LICENSE-docs)) — please **share, quote, and cite
the findings and the proto-paper freely, just credit Alan Cyment.** Third-party material (the
SWE-bench Live substrate, the evaluation images and repos they contain, and run-artifacts embedding
upstream code/model outputs) keeps its own upstream license; see [`NOTICE`](NOTICE).

---

*Working drafts for discussion, not peer-reviewed. All results explicitly preliminary and bounded.*
