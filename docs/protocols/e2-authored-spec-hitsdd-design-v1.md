# E2 Authored-Spec Study — HIT-SDD vs Plain SDD (Design v1)

Status: **DESIGN DRAFT — not authorized, not run, not sealed.** No provider/Docker run fires from this
document. It defines a **brand-new experiment** with its own compatibility boundary ("E2 / authored-
spec / HIT-SDD v1"), **never pooled** with the completed executable-feedback pilots (DeepSeek n=9, Qwen
n=9/n=13), the budget-sensitivity draft, Protocol v2 (nav-parity), or E1 — because the **acceptance
contract is different** (an *authored* spec, not the repo's pre-existing tests). Sealing (hash +
operator authorization + spend cap + sealed commitments) is a separate step, after this design is
reviewed and the offline spec-authoring + leak-guard pilot passes.

Date: 2026-06-29. Program: E2 (`e2-brownfield-acceptance-ablation-design-v1.md`).

> **Read with:** `e2-authored-spec-hitsdd-design-v1-addendum-a-hardening-v1.md` — pre-seal hardening
> (scenario-granularity convention, predeclared null-interpretation rule, minimum-n floor,
> non-participant spec-author, joint-gate-survival pilot output). This base design's decisions stand;
> the addendum layers sealable commitments on top before the offline pilot.

## Rationale

Spec-Driven Development (SDD) has gained sudden traction as a way to steer AI coding agents: give the
agent a spec up front, and it produces better code. The current SDD practice stops at prose — the spec
lives in the prompt as natural language, and the agent is trusted to self-verify against it.

HIT-SDD (Harnessed Iterative Spec-Driven Development) is a lightweight critique and extension: the same
spec, but made **executable** in the agent loop. The agent doesn't just read the spec — it runs it each
turn and gets pass/fail per scenario. The thesis is that this harness catches "done but broken" that
prose alone does not, because agents confidently declare completion against a spec they cannot execute.

This experiment tests exactly that contrast: plain SDD (spec as prose) vs HIT-SDD (spec as executable
feedback). It is part of a broader initiative to test whether structured technical practices, when
scaffolded by automation, improve agent coding outcomes — the harness is the product.

**Why Gherkin.** We use the Gherkin scenario format (WHEN/THEN) for specs because a mature, off-the-shelf
runner (`pytest-bdd`) **executes** the scenarios directly: each scenario binds to a step definition and
runs as an ordinary pytest item, so the harness reuses the existing `run_tests` plumbing rather than a
custom spec language or runner. Off-the-shelf tooling handles *execution*; the per-repo **step
definitions that bind each scenario to the repo's public surface are the authoring labor** (§"Spec
authoring"). Gherkin is a format choice, not a methodological commitment to any named practice; the word
"BDD" does not appear in agent-facing materials or experimental conditions.

**What the experiment does not test.** The experiment does not test whether authoring a spec helps
(both arms receive one), nor does it test agent-authored specs (specs are experimenter-authored to
control for spec quality). It isolates one thing: given a fixed, well-formed acceptance spec, does
making it executable in the loop improve outcomes over reading it as prose?

## What this is, in one line

**The previous experiment, with exactly one thing swapped: the acceptance contract.** Everything that
made the prior result trustworthy — same OpenHands scaffold, same task substrate, same self-
verification-gap metric, same two-arm structure, same budget rule — is held fixed. The only change is
*what the agent is asked to satisfy and (for treatment) run*: an **authored spec** instead of the
repo's pre-existing hidden tests.

| | Previous experiment (done) | This experiment (new) |
| --- | --- | --- |
| Acceptance contract | repo's pre-existing hidden tests | **an authored acceptance spec** |
| Control | no spec, cannot run anything | **reads the authored spec as prose**, cannot run it |
| Treatment | + `run_tests` (runs the hidden tests) | **+ `run_spec`** (runs the authored spec) |
| Scoring oracle | the hidden tests, run experimenter-side | **the authored spec, run experimenter-side** |
| Measured | self-verification gap, resolve | self-verification gap, resolve (same) |

## Why this is the right next experiment

The previous experiment proved *executing the acceptance contract ≫ not executing it* — but the
contract was a set of **pre-existing** tests, never an **authored** spec. The practice the program is
named for is specifically about authoring an acceptance spec up front and harnessing it into the loop.
No run has tested that yet. This experiment does, by changing only the contract, so the new result is
directly comparable in *shape* to the old one while standing as its own bounded study.

It also keeps the program's discipline intact: the **causal variable stays executability** of the
contract (control reads the spec, treatment runs it). Spec format (OpenSpec / Gherkin) is **identical
across arms** and is not a variable — this is not a spec-format comparison (AGENTS.md / CLAUDE.md).

## Primary question & hypotheses

**Q:** Holding the authored spec, task, repo, scaffold, and budget fixed, does **executing** the
authored spec each loop (HIT-SDD) reduce the self-verification gap — declaring done while the spec
fails — relative to **reading** the same spec (plain SDD)?

- **H_harness (primary, predeclared):** gap(plain-SDD) − gap(HIT-SDD) > 0 (MCID ≥ 0.20), family-wise
  across tasks. Harnessing the authored spec catches done-but-broken that reading it does not. This is
  the literal "HIT-SDD beats plain SDD" claim.
- **H0:** executing the authored spec adds nothing over reading it — a capable agent self-verifies
  against good prose well enough.

Direction expected (recorded so we don't reinterpret): the diagnostic effect should reproduce — agents
confidently declare done against a spec they cannot run, and stop doing so when they can — because the
mechanism (false confidence under no executable check) is the same one the previous experiment isolated;
the contract being authored rather than pre-existing should not change *that*.

## The acceptance oracle = the authored spec (single oracle, exactly mirroring the previous design)

There is **one** acceptance oracle: the authored spec, compiled to runnable checks. It plays the same
role the hidden tests played before:

- **Treatment** can run it in-container each loop (`run_spec`) — never seeing expected values.
- **Control** cannot run it; it only has the spec as prose in the prompt.
- **We** run it experimenter-side on each arm's final patch to score resolve and the gap.

This is **not circular** for the same reason the previous experiment was not: the finding is not
"treatment passes a check it can run," it is "**without** an executable contract, agents declare done
while failing it; **with** one, they don't." Treatment's gap is not trivially zero (the prior treatment
gaps were 13% / 0%, not by construction). The contract being authored doesn't change this logic.

**Experimenter degrees of freedom — the honest risk and its control.** Because *we* author the oracle
here (vs the previous experiment's independent merged-PR tests), a skeptic can worry we wrote an easy
or arm-favoring spec. Controls: (1) authored **blind to the solution** (below); (2) a fixed authoring
protocol + human audit, sealed by hash before any rollout; (3) the **SWE-bench gold cross-check**
(below) as independent external validity. The spec is identical for both arms, so it cannot favor one
arm by construction — only its *runnability* differs, which is the treatment.

## SWE-bench gold as an external-validity cross-check (secondary, not the scorer)

We reuse SWE-bench Live tasks, so each task also has its **real merged-PR tests (gold)**. These are
**not** the scoring oracle here — they are a **secondary external-validity probe**: for each final
patch, does passing the authored spec also pass the gold tests? This yields **spec fidelity** (authored-
spec verdict vs gold verdict agreement) and surfaces the practice's real limit — *HIT-SDD is only as
good as the authored spec*: a patch can satisfy a weak spec yet fail the real-world contract. Reported
as a labeled secondary, never pooled into the primary gap.

**Read fidelity carefully under black-box.** Where our **black-box** authored spec disagrees with a
**white-box** gold test, classify the divergence: a **real miss** (the behavior genuinely isn't
captured) vs a **granularity/level mismatch** (the gold asserts on internals our public-surface spec
cannot and need not see). Only real misses count against spec fidelity.

## Spec authoring — the new artifact (decided)

**Format: OpenSpec.** Specs are authored as **OpenSpec change proposals** — the industry-standard
SDD format — not homegrown criteria. Each requirement carries mandatory Gherkin-style WHEN/THEN
scenarios; each scenario compiles to one named acceptance check. **Execution path (single source of
truth):** the OpenSpec proposal is the canonical, sealed artifact; a deterministic generator emits a
`.feature` file from it (a hashed build product, never hand-maintained, so the two cannot drift), and
`pytest-bdd` runs each scenario as a pytest item. Using a recognized methodology is the
study's main credibility lever (it is what licenses the eventual "spec-driven" claim) and it constrains
experimenter degrees of freedom in how specs are shaped. OpenSpec format is **identical across both
arms** — it is the shared artifact, never a between-arms variable (CLAUDE.md). The OpenSpec *CLI /
propose→archive workflow* is **not** an arm-asymmetric tool: only the spec *text* reaches both prompts,
and `run_spec` is the sole between-arms delta.

**Bindings: black-box only (decided).** Each scenario binds to an executable check that drives the repo
**only through its public surface** (public API, HTTP, CLI) — never internal/private functions.
Rationale: (1) acceptance specs assert *observable behavior*, not internal state; (2) it collapses leak
risk to near-zero, because black-box steps are derived from behavior described in the issue and need no
sight of the gold patch's internals; (3) black-box step definitions are reusable across tasks. Gherkin
gives the *skeleton* for free (one scenario → one `pytest-bdd` step-bound test); the **step-definition
binding to each repo's public surface is the authoring labor** — `@given/@when/@then` steps that drive
the public API/HTTP/CLI and assert — and it is subject to the same blindness as the prose. Because the
step decorators must match the scenario's WHEN/THEN text, scenario↔assertion alignment is structurally
enforced (this is what the tautology audit checks).

**Mandatory blindness:** author the OpenSpec proposal **and** its black-box step definitions from the
**issue text + read-only repo public surface only** — **blind to the gold patch and to the gold tests.**

**Validation before sealing (gates, none shown to the agent):**
- **Black-box-observability gate (NEW — task eligibility):** the task's acceptance criterion must be
  expressible at the public boundary. Tasks whose only verifiable criterion is internal (and whose gold
  test is itself white-box) are **ineligible** — drop them or flag them, and record how many of the n=9
  survive. (Most n=9 are library/CLI tasks with clean public surfaces, but each is checked.)
- **Gold-passes-spec:** the gold patch must pass the authored spec; if not, the spec is wrong → revise
  under the same blindness (seeing only pass/fail, never the gold patch text) or drop the task.
- **Non-triviality:** a no-op patch must **fail** the authored spec (it discriminates).
- **Tautology audit (NEW — structural check of step definitions, pre-seal).** The risk is not that
  the spec prose is too easy (non-triviality catches that), but that a step-definition implementation
  is *tautological* — it claims to check the behavior described in its scenario but actually checks
  nothing, checks something unrelated, or asserts on a constant. Models do this constantly even when
  following a skill. The audit, run against the **gold patch**, validates each step definition
  structurally:
  1. **Assertion presence:** every step that describes an observable outcome must contain at least one
     assertion on the return value or state change produced by the public-surface call it makes.
  2. **Scenario-to-assertion alignment:** the assertion expression must reference the specific value
     or condition described in the scenario's THEN clause — not an unrelated field, not `response is not
     None`, not a hard-coded constant that happens to pass.
  3. **Coverage of the gold path:** running the step definition against the gold patch must actually
     reach and evaluate the assertion (the code path not skipped).
  This replaces a more elaborate adversarial-hardening approach (mutation testing against synthetic
  patches) with a simpler, auditable structural check. A step that passes non-triviality but fails the
  tautology audit is rewritten under the same blindness constraints. The audit script and its per-step
  verdicts are sealed as part of the provenance artifact.
- **Flake-certify the authored checks** (N=60 on the gold patch, quarantine flaky checks) — black-box
  checks (server stand-up / CLI subprocess) are more flake-prone than unit calls, so this gate earns
  its keep.
- **Seal** every spec + its compiled checks (post-audit) by hash before any rollout.

**Author driver (decided): structured two-role review pipeline.** Specs are authored by an LLM pipeline
with two blind review subagents, followed by a mandatory human audit:

- **Requirements role** — owns the requirement + its *why* (OpenSpec requirement text); drafts the
  initial Gherkin-style scenarios. Keeps scenarios outcome-focused, in the domain's language, and scoped
  to behavior the **issue actually states**. Stays blind to the gold patch and gold tests.
- **QA role** — owns scenario completeness, with an **explicitly adversarial mandate** to surface
  missing, edge, and negative cases (the scenarios that catch done-but-broken). The sharper this role,
  the more discriminating the oracle. Stays blind to the gold patch and gold tests.
- **Observability check** (automated, run per scenario): verifies each scenario can be bound to a
  black-box step definition at the repo's public surface. Scenarios that cannot be expressed at the
  public boundary are flagged for the human audit. This is the guard against white-box drift.

Pipeline: requirements drafts → QA challenges/adds → observability check → reconcile → `openspec
validate` → **human audit** (confirm observable requirements, nothing about implementation). Run as a
logged, ordered pipeline, **not** a free-form debate.

This is **experimenter-side oracle construction, sealed before the run** — not a condition, arm, or
anything the agent-under-test sees (both arms receive only the final spec text). It therefore **cannot
confound** the HIT-SDD-vs-plain-SDD contrast; it only affects shared spec *quality*, which makes plain
SDD a *fairer* baseline (control reads the better spec too). The added experimenter degrees of freedom
are bounded three ways: (1) all authoring roles stay **blind** to gold patch + gold tests; (2) the
objective gates above are the backstop — however authored, the spec must pass them; (3) the authoring
prompts, the **Gherkin authoring skill** (declarative, one-behavior-per-scenario, no implementation
detail — applied identically across tasks), and the **full per-task authoring transcript** are
versioned, hashed, and sealed as first-class artifacts. Caveat: QA over-reach generates scenarios the
reference fix fails; pruning them to pass *gold-passes-spec* leaks one pass/fail bit per prune, so QA
stays scoped to issue-stated behavior to keep pruning minimal.

## Arms, scope, models, sizing

- **Control (plain SDD):** `file_editor` + authored spec as prose.
- **Treatment (HIT-SDD):** `file_editor` + authored spec as prose + `run_spec`.
- **Tasks:** the **confound-free n=9** certified, contamination-screened small/medium repos from the
  previous experiment (navigation not a confound; gold + flake infra already in place). Large repos are
  out of scope (they belong to Protocol v2).
- **Models:** `deepseek-v4-pro` first. Replicate on `qwen3.7-max` only if the DeepSeek result is
  directionally positive under the predeclared primary metric. This mirrors the prior experiment's
  sequencing (DeepSeek pilot → Qwen replication) and avoids doubling cost before the design is
  validated with one lineage.
- **N = 10 runs/arm/task** → 9 × 2 × 10 = **180 rollouts** (DeepSeek). Qwen replication adds another
  180 under the same sealed commitments if gated in.
- **Budget rule (unchanged):** equal max model-turn budget both arms; `run_spec`'s turn cost is part of
  the treatment, not subsidised.

## Metrics (predeclared)

- **Primary — self-verification gap vs the authored spec:** rate of runs declaring done while the spec
  (run experimenter-side) fails. Contrast gap(control) − gap(treatment), per task, family-wise
  permutation test, MCID ≥ 0.20 — identical machinery to the previous experiment.
- **Secondary — resolve rate vs the authored spec** (all spec checks pass).
- **External validity — spec fidelity:** authored-spec verdict vs SWE-bench-gold verdict agreement per
  task; and the **"passed the spec, failed the gold"** rate (the weak-spec limit).
- **Logged:** turns-to-finish, budget-ceiling rate, usage/cost per rollout.

## Validity, compatibility, classification

- **New boundary.** Plain-SDD control here ≠ any prior control (it now holds the authored spec). Tag
  every record `oracle_source=authored_spec`, `design=authored-spec-v1`, spec hash. **Do not pool**
  absolute rates or the within-design contrast with any prior E2/E1 run.
- **Valid quantity:** the within-design contrast gap(control) − gap(treatment).
- Post-cutoff + GATE-B clean for both models (carried); authored-spec checks separately flake-certified;
  `declared_done` from FINISHED; final patch text persisted → replay-valid.
- **Classification: `causal_pilot`.** A both-lineage positive is a bounded replicated finding for the
  authored-spec contrast — not a general HIT-SDD law. **Report nulls.**
- **Leak/canary audit:** `run_spec` returns only check names + pass/fail (no expected values, no gold,
  no gold-test text); control transcripts canary-scanned for execution/diagnostic artifacts; audited
  diff confirms authored checks are **not** a verbatim copy of the gold tests (high overlap is itself a
  leak to investigate, and is reported as a fidelity property).

## Trace-complete artifact bundle (required — carries the 2026-06-24 reporting audit)

Exact prompt artifacts (template, per-run rendered prompt **including the authored spec text**, scaffold
version, model route/config); tool catalog by arm (`file_editor`, `run_spec` schema, spec-compile
manifest); ordered runtime trace (messages, tool calls/args/results, `run_spec` calls, termination);
replay artifacts (final patch **text** + hash, snapshot/image IDs, scored outcomes, authored-spec
verdicts, gold cross-check, usage/cost, analysis record). The **sealed authored specs + compiled checks
+ fidelity report** are first-class artifacts of this study.

## Harness changes required

- **Spec-authoring harness (new):** blind authoring pipeline (requirements role + QA review role +
  observability check + Gherkin authoring skill; pinned prompts, all blind to gold) → `openspec
  validate` → human audit; **black-box** scenario→step compiler — a deterministic OpenSpec→`.feature`
  generator plus `pytest-bdd` step definitions that drive public API/HTTP/CLI only —
  black-box-observability eligibility check, gold-passes-spec + non-triviality gates,
  **tautology audit** (structural check that each step definition genuinely exercises the behavior
  described in its scenario, run against the gold patch), N=60 flake cert for authored checks; hash +
  seal the spec, the OpenSpec→`.feature` generator, the authoring prompts, the Gherkin authoring skill,
  the tautology audit script and verdicts, and the full authoring transcript.
- **`run_spec` tool (treatment only):** runs the compiled black-box authored checks (`pytest-bdd`
  scenarios collected as pytest items) in-container, returns named-check pass/fail only; built outside
  the container, mounted read-only; schema cannot leak expected values / gold / gold tests. (Mirrors the
  existing `run_tests` plumbing — pytest-bdd runs under pytest — with the authored checks as target.)
- **Scoring:** run the authored spec experimenter-side on each final patch (primary); run gold
  experimenter-side too for the fidelity cross-check (secondary).
- **Per-record tagging** so this never pools with prior runs.
- **Protocol tests:** spec-blindness audit, leak/canary absence in control, `run_spec` cannot return
  expected values, authored-checks ≠ verbatim gold tests, **black-box discipline (no internal/private
  imports in any step definition)**, **tautology audit provenance (audit script + verdicts sealed
  pre-run; no step was modified against any rollout output)**, tool symmetry except `run_spec`,
  equal-budget parity, trace/prompt/spec-artifact completeness.

## Sequencing / gating

> **Offline pilot procedure:** `e2-authored-spec-offline-pilot-protocol-v1.md` specifies step 1's
> offline pilot in executable detail (task pair, minimum harness slice, per-gate acceptance criteria,
> joint gate-survival template, A2 threshold-setting, exit verdict).

1. This design reviewed; build + pin the spec-authoring pipeline (requirements + QA review roles +
   observability check + Gherkin authoring skill); offline pilot on 1–2 tasks (prove blindness,
   black-box observability + gold-passes/non-triviality gates, tautology audit, `run_spec`
   leak-tightness, authored-check flake cert, **and how many of the n=9 survive the observability
   gate**).
2. Build the spec-authoring harness + `run_spec` + scoring + protocol tests.
3. Seal authored specs (hash) + sealed commitments + operator authorization + spend cap.
4. Run **DeepSeek V4 Pro** on the n=9; report as a bounded `causal_pilot` testing H_harness.
5. **Gate:** if the DeepSeek result is directionally positive (primary gap delta meets the predeclared
   threshold), replicate on **Qwen 3.7 Max** under the same sealed commitments. Report both lineages
   together as a two-lineage finding. If DeepSeek is null, report the null and do not replicate.

## Cost (honest)

180 rollouts on the n=9 (DeepSeek) **plus** the genuinely new cost: up-front spec authoring + audit +
validation (the binding human/operator labor) and the `run_spec` + dual-scoring engineering. Qwen
replication adds another 180 rollouts if gated in. Rollout volume is ordinary; the novelty cost is the
authored artifact, not compute. Spend cap fixed at authorization.

## Status

**DESIGN DRAFT, decisions recorded.** Does not authorize or affect any run. The headline it targets is
the program's literal thesis: *with the acceptance contract authored as a spec, does harnessing
(executing) it each loop beat merely reading it?*
