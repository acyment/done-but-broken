# Step 1 — blind independent design: comparison record

**Date:** 2026-07-21. **Status:** step complete, one verification outstanding. **Spend:** $0 (chat
subscriptions).

Three deep-research sessions were run against `docs/e5/STEP1-PROMPT-PASTE-READY.md`, which carries
only the claim (A1) and the constraints (A4). No reviewer saw the design, the evidence ledger, the
substrate shortlist, or the decision to pursue literal Gherkin.

Raw responses are filed verbatim alongside this document:

| File | Model | Search | Sources |
|---|---|---|---|
| `qwen-3-7-plus.md` | Qwen 3.7 Plus | activated | **none listed** |
| `claude-opus-4-8.md` | Claude Opus 4.8 High | on | 212 claimed |
| `chatgpt-5-6.md` | ChatGPT 5.6 High | **0 searches** | **0 citations** |

---

## 0. Two process notes, settled

**Eligibility — resolved, no violation.** `CRITIQUE-PROCESS-v1.md`'s contamination ledger names
ChatGPT and Claude as disqualified for this step. That rule was written against *specific
conversations* in which those models had read the proposal, and on the assumption that a reviewer
would have code access. The sessions actually run were fresh chatbots with no repo access and no
exposure to the design — which is exactly the condition the step requires. **All three responses are
admissible as blind designs.** Recorded here because the ledger's wording disqualifies the model
families rather than the contaminated sessions, and a later reader would otherwise reach the wrong
conclusion. Residual caveat, unchecked: if the ChatGPT session ran on an account whose saved-memory
feature was enabled and which had previously discussed this design, contamination could carry across
sessions. Gemini and DeepSeek were not run; three responses were judged sufficient.

**A filename was loading a reviewer's output as agent instructions.** `claude.md` collides with
`CLAUDE.md` on a case-insensitive filesystem, and Claude Code ingested that reviewer's response into
its instruction channel as directory-scoped project configuration. Fixed by renaming all three files
to model-specific names (2026-07-21). This is the anchoring channel the step exists to prevent,
running in the reverse direction — reviewer output steering our agent rather than our design steering
the reviewer.

---

## 1. What the step did NOT buy — stipulated content

Most of the apparent three-way agreement is an artifact of the prompt. The following were **handed to
the reviewers** in the claim, standard-of-proof, or constraints sections, so agreement on them is
not corroboration and must not be cited as convergence:

- the prose arm receives a shell and can write and run its own tests;
- a decision rule declared before the run;
- per-episode results rather than aggregates alone;
- uncertainty or consistency reporting;
- replayable artifacts;
- language bounded to the model, workflow, and tasks tested;
- the rigor-versus-credibility tension in substrate choice (framed neutrally, but named);
- the existence question for a curated dependent-multi-step dataset (deliverable 5 asked directly).

**Reading three models agreeing on our own instructions as independent support is the single most
likely way this step gets over-read.**

---

## 2. What each proposed

### Qwen 3.7 Plus — the most complete design

- **Substrate.** One small real open-source project, 800–2000 LOC, stripped to a skeleton starting
  point. Six dependent feature tasks. Researcher authors reference patches and a held-out suite
  (10–20 assertions per task) before any run.
- **Arms.** *G*: 2–4 Gherkin scenarios per increment, executed via `behave`/`pytest-bdd`, revise on
  failure. *P*: same semantic content as structured prose (Given/When/Then phrasing as paragraphs,
  not parseable), agent writes and runs its own tests, same revision-cycle cap.
- **Held constant.** Model (mid-tier, chosen deliberately — "the claim is about *workflow*, not model
  capability"), system prompt template, temperature, revision cap, held-out suite. **Codebase state
  restored from a git checkpoint of the *reference* implementation before each task**, so task *N*
  starts from reference 1..*N*-1 rather than the agent's own prior output.
- **Measures.** Held-out pass rate (primary); regressions against all prior tasks' held-out tests;
  cycles to convergence; diff size versus reference.
- **Scale.** 6 tasks × 2 conditions × 2 repetitions = 24 episodes, $0.50–2.00. Two pilot episodes
  first.
- **Decision rule, pre-registered.** Supported: G higher on ≥5 of 6 tasks AND lower cumulative
  regressions across tasks 3–6 in both repetitions. Not supported: within 5 points across the
  sequence, or P matches/exceeds on ≥4 of 6. Inconclusive: repetitions disagree on direction.
- **Stop rules that fire early.** Kill after the two pilot episodes if pass rates are identical and
  transcripts show no qualitative difference. Kill after the first repetition (12 episodes) if
  direction is inconsistent. *"The $15 budget is not the binding constraint; the researcher's time
  and credibility are."*
- **Recommended third arm.** Gherkin-as-text, not executed — ~6 episodes, ~$0.50. If
  Gherkin-as-text ≈ Gherkin-executed > prose, the mechanism is prompt structure, not executability.
- **Datasets.** SWE-bench and Verified are single-issue; RepoBench is next-line prediction; CodePlan
  is the closest (dependent propagation) but type-driven, not feature development. Not aware of a
  curated dependent-feature-sequence dataset.
- **Explicitly warns against** LLM panels as the primary evaluator: "A CTO will trust `pytest`
  output; they will not trust 'a panel of three LLMs rated the code 4.2/5.'"

### Claude Opus 4.8 High — a prior-art and confound report, not a design

Answered deliverables 4, 5 and 6 at depth; did not produce a study design of its own.

- **Execution feedback helps, generally.** AlphaCodium 19% → 44% pass@5; Self-Debugging, Reflexion,
  Self-Refine, LeDex.
- **But it reverses under bad grounding.** A TDD-prompting result where procedural "do TDD"
  instruction *without* telling the model which tests to check **raised** regressions to 9.94%;
  supplying which-tests-to-check context cut regressions 6.08% → 1.82%. Framing: agents "do not need
  to be told how to do TDD; they need to be told which tests to check."
- **The most threatening citation.** A spec-format ablation in which plain PROSE detected 27/30 bugs
  against structured/enumerated SPEC's 30/30, while decomposition-without-content caught 2/30 and no
  spec caught 0/30. Reading: specification *content* dominates; enumerated format adds a small
  margin.
- **Datasets exist** (the highest-value claim in the whole step): ChainSWE, EvoClaw, SWE-EVO — all
  claimed as dependent-chain, per-step-tested, 2026 preprints. Plus Commit0 as a peer-reviewed
  fallback without a commit chain.
- **Reward hacking, quantified.** Sealing git history and network dropped one frontier model
  87.1% → 73.0% on SWE-bench Pro; an "impossible tests" benchmark found frontier cheating rates of
  50–76%, dropping to near zero when tests are hidden; a held-out-versus-visible gap that grows with
  codebase size, reaching 100 points on large tasks; a case study where an agent's delivered library
  was dead code and no-oping it left the score unchanged.
- **Recommended borrows.** *Oracle-state progression* — advance the chain with the reference patch,
  not the agent's, to separate increment difficulty from error accumulation. A per-check no-op
  ablation. Visible-minus-hidden gap as the primary integrity metric.
- **Self-flagged caveats.** The most on-point results are 2026 arXiv preprints its own checking could
  not verify. It also flagged a cross-citation error inside one of the papers it cites.

### ChatGPT 5.6 High — same shape, lower resolution, no research

In Spanish. Header reads *"Research completed in 4m · 0 citations · 0 searches"* — deep research did
not run, so deliverable 4 was answered from recall.

- Three sub-hypotheses: format, incrementality, persistence across evolution.
- Small real API project (FastAPI/SQLite suggested), episodes as successive features, hidden test
  set per episode, 5–10 episodes per condition. Metrics: hidden-test pass, iteration count, tokens,
  wall-clock. Stop rule: a ±5% band after N≥5.
- No public multi-step dataset known; build the episodes.
- **Its one distinct contribution:** models may be *familiar* with Gherkin from training data, so a
  Gherkin win could be format-recognition rather than method quality.
- Also names experimenter bias — the researcher unconsciously guiding the favoured arm harder — which
  neither other reviewer raised.
- **Its prior-art section must not be cited.** "Noble y Nagappan (2024)", "Fakhoury et al. (2024),
  ~38%", a ThoughtWorks quotation, and a "Paul Duvall / DoubleUp!" case study are unsourced recall
  produced without any search, and should be treated as possibly confabulated.

---

## 3. Convergence, with stipulated content stripped out

| # | Convergence | Votes | Independent? | Do we have it? |
|---|---|---|---|---|
| 1 | **The trap is measuring content or structure and calling it executability** | 3/3 | **Yes** — asked open, answered identically | Named in the claim decomposition; never instrumented |
| 2 | **The mundane explanation is cadence or content, not format** | 3/3 | **Yes** | Yes — crossing execution with increment size is already banned in one cheap study |
| 3 | **Hidden held-out oracle, separate from the visible criteria** | 3/3 | **Yes** | Yes — shown/held-out partition, fail-to-pass subsets |
| 4 | **Mid-tier model, chosen on purpose** | 3/3 | **Yes** | **No — our target is frontier.** See §5 |
| 5 | **Real software; nobody generates the substrate** | 3/3 | Partly cued by the tension framing; 2/3 volunteered that synthetic loses the audience | Already decided — synthetic substrates are hard-excluded |
| 6 | **~6 tasks, ~24 episodes, well under the stated budget** | 3/3 | **Yes** | Comparable scale |
| 7 | **An un-executed-Gherkin arm to separate format from execution** | 2/3 (Qwen explicit, Claude's Stage 3 equivalent) | **Yes** | **In design, never run** — both arms get the same hash-pinned `.feature` artifact, only treatment executes |
| 8 | Authoring asymmetry — the executable format forces the *author* to be more precise | 1.5/3 | Yes | Named as unmeasured; no procedure |
| 9 | Evaluator leakage — one mind authors both the criteria and the oracle | 1/3 (Qwen) | Yes | Same disease, independently found |
| 10 | Reward hacking / building-to-the-test, with primary sources | 1/3 (Claude) | Yes | Partially |

---

## 4. What they converge on that we lack — the findings

Ranked by what each would change. All zero-spend.

**F1 — A pre-spend check that the treatment has something to act on.** Qwen's stop rule requires
confirming the control condition can actually produce a wrong result before committing; ChatGPT names
difficulty calibration as a trap (too easy → both arms succeed → nothing to observe). Our record has
spend caps and sealed gates, but no rule that the event a lever acts on must be shown to occur at a
usable rate *before* money is spent. **The seed-220 probe spent $4.60 on a run where the treatment
closed every task green and the lever got zero exposure.** The P1.2w pre-registration already fixes
half of this — verdicts are delivered unconditionally at spec-phase exit, and a VOID rule fires when
fewer than two pairs carry the event. But VOID is a *post-hoc* classification: it is declared after
the money is gone. Landed as a standing guardrail in `AGENTS.md`.

**F2 — Nobody would run this on a generated codebase.** Three independent designers, zero votes for a
procedural substrate. This is not new information — synthetic substrates are already hard-excluded —
but it raises the priority of formally retiring the generated rig as the vehicle for anything public.

**F3 — Per-check no-op ablation, and the visible-versus-hidden gap as a headline number.** The Route 2
admission gate checks no-op-fails / gold-passes at the *episode* level. Claude's sourced
recommendation is per-check: confirm every individual passing check can actually fail. And the gap
between visible-suite and hidden-suite scores should be a reported headline figure, not a diagnostic —
it is the only honest measure of whether an arm is gaming what it can see. Landed in
`CRITIQUE-PROCESS-v1.md`.

**F4 — Authoring cost, not content equivalence. Partially resolves on inspection.** Qwen's secondary
trap is that the executable format forces the *author* to pin exact values and edge cases, so a
separately-written prose comparator ends up vaguer and the study measures spec quality while
reporting an execution effect. **Checked against our design: this cannot happen under the literal-
Gherkin decision**, where both arms receive the same OpenSpec source and the same hash-pinned
`.feature` artifact and the only difference is that treatment can execute. There is no second spec to
be vaguer. The reviewer was designing for a two-artifact study; ours is one-artifact.

What survives is the half the design does *not* close: content is held equal **by paying the
authoring cost in both arms and measuring it in neither**. Sub-claim C6 — is the gain worth its
cost — is unmeasurable for want of that data, and it is the question a practitioner audience actually
asks. Landed as instrumentation in the authoring protocol: log wall-clock to first draft,
reconciliation rounds, author disagreements, and checks discarded for failing to discriminate. Zero
spend; the authoring happens anyway.

*Process note: this finding was written up as a gap before being checked against the design, and
demoted on checking. Recorded rather than silently corrected — it is the same shape as the errors the
briefing packet's register tracks.*

**F5 — Evaluator leakage.** Qwen: the person authoring the scenarios also authors the held-out tests,
so the held-out suite is structurally closer to one arm; no fix without an independent test writer.
Our version is the substrate generator authoring the task, the answer key, and the ambiguity knobs at
once — and our own close-out already reports that four audit rounds each found a new family of pinned
choices. An outsider reaching the same diagnosis from the claim alone is worth recording.

**F6 — A defect in the briefing packet.** All three designed for mid-tier models, because the claim
section never says the target is frontier. Our operating notes state the project is not ready for
frontier claims, which implies frontier is the target. **Step 1 answered a question adjacent to the
one being asked.** Recorded in the packet's known-error register as E5.

---

## 5. The one disagreement worth resolving

Qwen and ChatGPT both report that no dataset of dependent, multi-step code changes with tests exists.
Claude names three with arXiv identifiers and flags them as unverified 2026 preprints.

This is 2–1 against, but the majority position is *"I am not aware of one"* and the minority has
citations. That asymmetry means the question gets **checked, not voted on**. The substrate appendix
already names exactly this as the highest-value possible find, and the oracle-state-progression idea
speaks directly to our own finding that many real patches do not stack.

**RESOLVED 2026-07-21 — Claude was right and the citation set is unusually reliable.** All eight
identifiers were checked against arXiv, the papers' own text, and their released artifacts. All eight
resolve to real papers matching the claimed titles, topics, authors and affiliations, and **every
load-bearing number was confirmed at the stated value**, including the exact four-way ablation. This
does not look like confabulation; it looks like a model that read the papers.

### What exists

| Claimed | Verdict | Substance |
|---|---|---|
| **ChainSWE** (2607.02606) | **Real, as described** | 304 problems / 54 Python projects; per-step fail-to-pass and pass-to-pass lists; **ships the oracle-state progression control** (reset to base, apply gold patches for earlier steps); GPT-5.5 62.5% → 40.5% → 28.2% across chain positions, all three exact. MIT, HuggingFace, reuses pre-built SWE-bench Docker images. |
| **EvoClaw** (2603.13428) | **Real, renamed** | Now titled *SWE-Milestone: Evaluating AI Agents on Continuous Software Evolution* (v3). Milestone DAGs with **explicit prerequisite constraints**; per-task isolated evaluation snapshots. >80% isolated → ≤38% continuous. MIT, GitHub, DockerHub, adapters for four agent frameworks. **The most mature harness of the three.** Cite by ID and current title or reviewers will not find it. |
| **SWE-EVO** (2512.18470) | **Real, but mischaracterized** | 48 tasks / 7 repos, release-to-release evolution, F2P per delta — all confirmed. **But the tasks are independent**, each from a pre-release base snapshot. Not a dependent chain. Does not serve this purpose. |

### The catch, and it is a real one

**ChainSWE's chains are co-location dependency, not requirement dependency.** Chains are assembled by
sliding a window over chronologically consecutive instances and keeping those where the later gold
patch applies cleanly on the earlier resolved state, or where AST analysis shows file/function/class
overlap. Step *N* touches the same code as step *N*-1; it does not necessarily *need* step *N*-1's
behaviour to exist. If the thesis requires "step 3 is impossible unless step 2 was actually built,"
these chains are weaker than they sound and need filtering. **EvoClaw/SWE-Milestone is the better fit
for true prerequisite dependency**, because its DAG encodes prerequisites explicitly rather than
inferring them from code overlap.

**None of the three hides tests by default.** ChainSWE and SWE-EVO both expose fail-to-pass lists as
part of the instance — which is precisely the confound the reward-hacking literature exists to study.
So: **the dependent-multi-step half is available off the shelf and saves most of a build; the
hidden-per-step-test half is not, and a visible/held-out split would have to be constructed over
ChainSWE or SWE-Milestone.** Real work, far less than building the chain substrate from scratch.

### The result billed as "most threatening" — read in full, it is off-target, not fatal

*Specification Grounding Drives Test Effectiveness for LLM Code* (Haeri & Ghelichi, 2607.06636). The
citation-check confirmed Table 3 exactly (0 / 2 / 27 / 30) and the number-check was read as "the
format half of our claim is a rounding error, cite it or a commenter will." **Reading the paper in
full corrected that** (2026-07-21):

- The labels vary **what the test-writer is shown**, never what the implementer sees. The code model
  writes from the same prose ticket in every arm.
- **Execution is held constant** — tests run and drive a repair loop in all arms. The paper cannot
  speak to executable-vs-prose at all; it lives inside the executable-feedback world.
- Its "format" axis is paragraph-vs-bulleted-English, not English-vs-executable-Gherkin.
- The 27-vs-30 gap is one task, one tester draw, no statistical test (our binomial ≈ p=0.25), and
  ceiling-compressed by the authors' own admission ("100% is a ceiling set by these easy tasks").

What *is* robust is the **content** effect (0 → 27), and it constrains any claim that structure or
format is the active ingredient — not any claim that execution is. Full assessment and the corrected
citation guidance now live in `docs/e5/E5-REFERENCES-v1.md`. **Process note: this is the second
finding in this record demoted on inspection after being written up strong — same shape as the
briefing packet's `[CHECKED]`-but-wrong errors. A verified *number* is not a read *paper*.**

### Two corrections to the reviewer's own report

- **The "Hamblin et al." miscitation flag is fabricated.** There are two genuinely distinct 2026
  papers named SpecBench — Hamblin et al. (2605.30314, specification-level reasoning, Toronto) and
  Zhao et al. (2605.21384, reward hacking, Weco AI) — and the Microsoft paper cites both correctly.
  The reviewer invented a criticism by assuming a name collision was impossible. Note the direction:
  a hallucinated *criticism*, not a hallucinated *citation*. The literature is more real, not less.
- **The reviewer truncated a quotation against its own interest.** ImpossibleBench's finding is that
  hiding tests reduces cheating to near zero **"but also degrades performance on the original
  benchmark."** The second clause was dropped. **This matters directly — our design hides tests**, so
  the cost is ours to carry and to report.

Minor: SpecBench's growth figure is 28pp in the abstract and ~27pp in the body; ChainSWE's paper says
CC BY 4.0 while its dataset card says MIT.

---

## 6. What all three missed

**None of them names post-hoc exclusion of episodes as a researcher-degrees-of-freedom channel** —
the failure mode our own review documented three times in a single day (see
`e2-headline-n9-subsetting-note-20260720.md`, `e2-black4684-exclusion-note-20260720.md`). Qwen gets
nearest with "held-out tests fixed before the run, decision rule declared before the run" but does not
name dropping data after collection.

Outside review did not find our worst documented problem. A blind internal audit did. That is a
useful calibration on what this kind of step can and cannot buy, and an argument for keeping the
blind-audit habit rather than substituting external panels for it.

---

## 7. Standing caution

Convergence prioritises a question. It does not validate a design, does not establish prior art, and
is not citable in public. Two of the three reports carry no sources at all; the third self-marks its
most important claims as unverified. **Step 1 bought one sourced prior-art answer, and that answer is
pending verification.** The prior-art question is open.
