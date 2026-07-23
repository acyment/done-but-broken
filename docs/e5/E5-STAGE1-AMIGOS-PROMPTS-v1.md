# E5 Stage-1 Three-Amigos external panel — self-contained prompts v1

Six external thinking models review the RESOLVED Stage-1 prereg draft (v2), three roles ×
two models per role, per `docs/methodology/THREE-AMIGOS-DESIGN-REVIEW-v1.md`. The
reviewers have NO repo access — every prompt is self-contained once assembled. Two models
share each role so convergence-within-role and convergence-across-role are both readable
at reconciliation (convergent findings rank highest).

**Do not run this panel until `docs/e5/E5-STAGE1-PREREG-DRAFT-v2.md` exists** (revision
brief: `docs/e5/E5-STAGE1-V2-REVISION-BRIEF-v1.md`). The amigos review the resolved
design, not v1.

---

## 1. Model → role table

| Model | Role | Session setup |
|---|---|---|
| Kimi 2.6 Instant | Product/Business | Fresh chat; highest reasoning setting the tier offers; no web search |
| ChatGPT Sol 5.6 | Product/Business | Fresh chat; thinking model; memory/custom instructions OFF; no web search |
| Qwen 3.8 | Development | Fresh chat; thinking mode ON; no web search |
| GLM 5.2 | Development | Fresh chat; deep-thinking mode ON; no web search |
| DeepSeek 4 Pro | Testing/QA | Fresh chat; DeepThink ON; no web search |
| Claude Fable 5 | Testing/QA | claude.ai fresh chat; extended thinking, **max** effort; NO project/repo context, memory OFF |

Pairing rationale: each role has two model families (Product: Moonshot + OpenAI; Dev:
Alibaba + Zhipu; QA: DeepSeek + Anthropic) so no role depends on one family's blind
spots. Recorded caveat for reconciliation: the draft was authored with Claude assistance,
so Fable-5 findings that merely agree with the main loop carry less independent weight
than DeepSeek's; Fable is paired with DeepSeek in QA for exactly that reason.

## 2. Assembly instructions (operator)

Each prompt = three parts concatenated, in this order:

1. The ROLE PROMPT for that model's role (§4, §5, or §6 below) — identical for both
   models sharing the role.
2. The SHARED CONTEXT BLOCK (§3) — identical for all six, pasted where marked.
3. The full text of `docs/e5/E5-STAGE1-PREREG-DRAFT-v2.md`, pasted where marked.

Protocol (binding, per the methodology doc):

- One fresh conversation per model; never mention other reviewers or their outputs; never
  paste one reviewer's output into another's chat.
- Capture each raw output VERBATIM to `docs/e5/amigos-1/<model-slug>-<role>.md` (evidence
  discipline); commit the raw archive BEFORE any synthesis, then reconcile in a separate
  main-loop session (reconciliation is not part of this doc).
- Existence-check any factual claim a reviewer introduces before relying on it; reviewers
  are instructed to flag their own new claims with [VERIFY].

---

## 3. SHARED CONTEXT BLOCK (identical for all six; paste where the role prompt says)

```
=== SHARED CONTEXT (verified facts; treat as given) ===

You have no access to the repository, the codebase, or the underlying benchmark — do not
attempt to verify these facts, and clearly mark any NEW factual claim you introduce with
[VERIFY] so we can check it. Section numbers (§) refer to the plan document included at
the end of this prompt.

THE PROGRAM. A solo-operator research program (one person plus AI assistants) building
industry-facing evidence — the audience is skeptical CTOs and engineering leaders on
LinkedIn, not journal reviewers — about spec-driven agentic coding. The question: when a
frontier coding agent builds an application through a multi-step sequence of feature
specs, with each step's work layered on its own previous code, does SUPPLYING executable
acceptance scenarios (runnable Gherkin-style checks with a runner) reduce regression
accumulation — previously-working, previously-promised behavior silently breaking at
later steps — compared to supplying the identical scenario content as prose only? The
long-term goal is positioning a future agent-native BDD-style tool; the near-term
deliverable is one honest, sealed, replayable two-arm pilot.

DESIGN SKELETON (settled by prior review rounds — do not re-open these choices, but DO
flag genuine contradictions among them or between them and the plan text):
- Substrate: a fork of SlopCodeBench, an open-source benchmark of 3–8-checkpoint
  CLI-application building chains (verified corpus: 36 chains / 196 checkpoints; each
  checkpoint = a prose spec + hidden tests + a known-good "golden" solution). Agents:
  Claude Code (bulk) and Codex CLI (small slice), pinned versions, Docker-isolated.
- Arms: the control arm gets each checkpoint's scenario text as prose only, with NO test
  infrastructure of any kind in its workspace (structural absence — "no executable
  acceptance artifact was supplied"). The treatment arm gets the identical text PLUS an
  executable suite (frozen step definitions), an on-demand runner it may invoke at any
  time while working, and one guaranteed run at completion whose results feed a revise
  turn. Both arms get one structurally identical revise turn per checkpoint. Both arms
  may self-verify however they choose (allowed and instrumented, never forbidden); the
  primary analysis is intention-to-treat: arms compared as assigned.
- Grading: a hidden referee both arms never see — the benchmark's own per-checkpoint
  test suites (which always re-run all earlier checkpoints' tests) plus authored held-out
  probes. Primary outcome: paired chain-level difference in "had at least one regression
  event" (a hidden check that passed at an earlier checkpoint failing at a later one),
  control vs treatment. A guard metric requires treatment not to lose material
  new-feature progress. The gap between what an arm passes on the visible surface vs the
  hidden surface is itself a reported headline figure.
- Staging, each stage separately operator-authorized: memorization/contamination probe →
  control-only base-rate pilot (8 chains) with a pre-spend abort floor → 4-chain
  both-arms machinery shakedown → confirmatory A/B (default 33 chains, paired).

VERIFIED FACTS YOU MAY RELY ON:
- Corpus: 36 chains / 196 checkpoints total; 5 chains have known-defective golden
  solutions (excluded unless repaired); ~31 usable native chains; lengths 3–8, mean 5.4.
  The corpus is the scarce resource: the design is honestly powered only for LARGE
  effects (~30–40 percentage points at chain level).
- Determinism: a 9-evaluation probe of the grader on known-good solutions found exactly
  one flaky test (an interactive-session fixture test) — the flake policy is a
  demonstrated need, not hygiene.
- Parent inspiration (arXiv:2607.01855; sub-frontier chat models on 8-turn toy tasks):
  an execution-gate mitigation cut regression-affected tasks 43.2%→12.5%; prose
  restatement alone gave ≈ +4pp. Used as a directional prior only; the plan is a
  "conceptual extension", never a replication, and parent effect sizes are never
  comparison targets.
- Published SlopCodeBench results: the best frontier agent passes only 14.8% of
  checkpoints under strict scoring (which re-runs all earlier tests) — substantial
  breakage at this scale, but that figure conflates new-feature failure with regression,
  which is why the control-only pilot measures the true base rate before real spend.
- Budget reality: bulk runs ride a consumer Claude subscription ($0 marginal); metered
  spend is capped at tens of dollars; one operator, no team.

REVIEW HISTORY ALREADY APPLIED (your job is what REMAINS). The plan you are reading is
v2. It has already survived three review rounds whose fixes are baked in: (1) a
seven-model adversarial panel — its accepted changes include: the graded surface is
hidden from the treatment arm with a pre-registered coverage map and a covered/uncovered
split; no best-of-two selection anywhere in the primary; a matched revise turn in both
arms; self-verification allowed and instrumented with an intention-to-treat primary;
structural absence (not disabled infrastructure) in control; a finite, pre-registered,
control-conditioned escalation ladder; frozen sample size with an explicit
minimum-detectable-effect honesty statement; flake/tamper/scheduling machinery; the
"conceptual extension" framing; a composite guard metric with a pre-declared claim rule;
an on-demand runner in treatment (operator-decided). (2) A codebase-reading pass that
verified the fork mechanics (test results hidden from agents by default; per-checkpoint
snapshots; pinned CLI versions; subscription auth path). (3) A hostile re-attack whose
15 must-fix findings are incorporated in v2, including: an operationalized rule scoping
the claim when only the covered (mirrored) part of the hidden surface improves;
authoring firewalls (scenario authors never open hidden test files; the coverage map is
built in a separate session); stated error rates plus a decision rule for the pilot
floor gate; a pre-declared switch to an event-count primary if the pilot base rate
saturates the yes/no outcome; class-level screening for the flaky interactive-fixture
test class; a "claim takes the weaker reading" rule across all claim-relevant
sensitivity analyses; the primary defined as Claude-agent pairs only (Codex slice never
pooled); a minimum-evidence rule so the Codex criterion can't pass vacuously;
an exposure-normalized secondary for the risk-set asymmetry (treatment keeps more
promises, so it has more promises that can break); handling for author-written extra
chains diluting the sample; a scoped immutability/shakedown-fix policy; a check that
minimized feedback output is actually actionable; claim wording that names the
matched-ritual comparator; and sourced budget numbers.

BINDING HONESTY RULES (constraints on the claim — not up for debate, but police the plan
against them): maximum claim is "in a sealed two-arm pilot, executable acceptance
feedback did/did not reduce accumulated-surface regressions under this task/model/
budget" — one-pilot causal language, never generalized. Run classifications are always
named; provider-flagged or non-replayable runs are never clean evidence; a null result
is published with the same visibility as a win; underclaiming is preferred to
overclaiming; the spec-workflow tooling (OpenSpec) is a shared environment property in
both arms, never a compared condition.
```

---

## 4. ROLE PROMPT — Product/Business (Kimi 2.6 Instant; ChatGPT Sol 5.6)

```
You are the Product/Business reviewer in a Three-Amigos-style design review of an
experiment pre-registration. You did not write this plan. Your mandate is the WHY and
the WHAT: is the projected result worth having, and what must it not overclaim. Two
other perspectives (engineering feasibility, adversarial QA) are reviewed separately —
do not cover their ground except where it collides with yours. Be unsparing; do not
rubber-stamp; a review that finds nothing is a failed review. Do not summarize the plan
back to me.

Evaluate, in both projected outcomes (a positive result AND a null result):
1. AUDIENCE VALUE. For skeptical CTOs/engineering leaders: is the strongest honest
   headline this plan can produce worth its cost and complexity? What is the smallest
   result that is still credible and useful, versus a nothingburger dressed as rigor?
2. WRONG INFERENCES. What will readers wrongly conclude from each outcome (e.g. "BDD is
   proven", "this transfers to my 200k-line codebase", "prose specs are useless") — and
   which of those must be pre-empted IN THE PLAN's claim language, not just in the
   eventual post?
3. THE ONE THING NOT TO OVERCLAIM. Name it, and check whether the plan's claim rule and
   wording actually prevent it.
4. NULL VALUE. If the result is "no difference", does the plan as written let that be
   published as something genuinely informative, or does it read as a failed bet?
5. FRAMING HAZARDS. Anything in the plan's language (naming, comparisons to the parent
   paper, tool positioning) that a hostile commenter could quote against us.

Settled decisions you must not re-open (flag only genuine contradictions): the choice of
benchmark fork; the two-arm structure and intention-to-treat estimand; the on-demand
runner; the staging ladder and its vocabulary.

Output format, in order:
A. VERDICT line: from your role's view — "ready for freeze", "fix first", or
   "structural concern" — one sentence of justification.
B. FINDINGS, ranked by importance, max ~12. Each: the plan section (§), the issue, why
   it matters to the audience/claim, and the concrete change you require.
C. Your 2–3 INSISTED REQUIREMENTS: things that must enter the pre-registration for you
   to sign off (or be explicitly declined with reasons on record).
D. TOP 3 RISKS from your perspective, one line each.
E. Any new factual claims you introduced, each marked [VERIFY].

=== SHARED CONTEXT === 
<<< PASTE THE SHARED CONTEXT BLOCK HERE >>>

=== THE PLAN UNDER REVIEW (complete text of E5-STAGE1-PREREG-DRAFT-v2.md) ===
<<< PASTE THE FULL v2 DOCUMENT HERE >>>
```

---

## 5. ROLE PROMPT — Development (Qwen 3.8; GLM 5.2)

```
You are the Development reviewer in a Three-Amigos-style design review of an experiment
pre-registration. You did not write this plan. Your mandate is the HOW: is this
buildable, at this scale, by this team (one operator plus AI assistants, forking an
existing open-source benchmark harness), without the build silently diverging from what
the pre-registration promises. Two other perspectives (product value, adversarial QA)
are reviewed separately — do not cover their ground except where it collides with
yours. You cannot see the code; judge buildability from the plan text alone, and say so
when a concern depends on code you can't see. Be unsparing; do not rubber-stamp; do not
summarize the plan back to me.

Evaluate, in both projected outcomes (a positive result AND a null result):
1. UNDERSPECIFICATION. Where would a competent builder have to GUESS — and could guess
   wrong in a way that changes the result? (Prompt/workspace mechanics, the injection of
   scenario files, the revise-turn plumbing, snapshot/grading boundaries, the flake
   screen, the authoring pipeline for scenarios/step definitions/probes.)
2. HARD VS EASY. Which parts are genuinely hard at this scale and which look hard but
   are cheap? Is effort allocated to the validity-critical parts?
3. CHEAPEST FAITHFUL BUILD. Where could the plan be simplified with zero validity loss —
   and which tempting simplifications are FALSE economies that would quietly break a
   stated guarantee (arm parity, referee isolation, replayability, frozen assets)?
4. SILENT-DIVERGENCE POINTS. Name the places where what actually runs could drift from
   what the document froze, and what mechanical check (test, hash, assertion, manifest
   field) would catch each one.
5. OPERATIONAL REALISM. Wall-clock, evaluation compute (3× referee runs on every graded
   snapshot), subscription rate limits, the authoring workload (scenarios + step
   definitions + held-out probes for every admitted checkpoint) — does the schedule
   implied by the plan actually close for one operator?

Settled decisions you must not re-open (flag only genuine contradictions): the choice of
benchmark fork; the two-arm structure and intention-to-treat estimand; the on-demand
runner; the staging ladder and its vocabulary.

Output format, in order:
A. VERDICT line: from your role's view — "ready for freeze", "fix first", or
   "structural concern" — one sentence of justification.
B. FINDINGS, ranked by importance, max ~15. Each: the plan section (§), the issue, the
   wrong-build failure mode it enables, and the concrete change you require.
C. Your 2–3 INSISTED REQUIREMENTS: build requirements that must enter the
   pre-registration (or be explicitly declined with reasons on record).
D. TOP 3 RISKS from your perspective, one line each.
E. Any new factual claims you introduced, each marked [VERIFY].

=== SHARED CONTEXT ===
<<< PASTE THE SHARED CONTEXT BLOCK HERE >>>

=== THE PLAN UNDER REVIEW (complete text of E5-STAGE1-PREREG-DRAFT-v2.md) ===
<<< PASTE THE FULL v2 DOCUMENT HERE >>>
```

---

## 6. ROLE PROMPT — Testing/QA (DeepSeek 4 Pro; Claude Fable 5 max)

```
You are the Testing/QA reviewer in a Three-Amigos-style design review of an experiment
pre-registration. You did not write this plan. Your mandate is WHAT BREAKS: how each arm
could cheat, how the measurement gets confounded, and which edge cases invalidate runs
or claims. This plan has already survived a hostile re-attack whose fixes are listed in
the shared context — your job is what REMAINS after those fixes, plus any way a listed
fix is itself incomplete or introduces a new hole. Two other perspectives (product
value, engineering feasibility) are reviewed separately — do not cover their ground
except where it collides with yours. Be unsparing; do not rubber-stamp; a review that
finds nothing is a failed review. Do not summarize the plan back to me.

Attack, in both projected outcomes:
1. WIN FRAMING. The positive claim is published. Find what a hostile methodologist
   lands: information leaks between the visible and hidden surfaces, selection effects,
   grader contamination, tautologies, experimenter degrees of freedom that survive the
   freeze, arm asymmetries the parity machinery misses, gameable spots in the claim
   rule, wording overreach.
2. NULL FRAMING. "No difference" is published. Find every way the plan's own machinery
   could have MANUFACTURED that null — event starvation the floor gate misses, dilution,
   noise channels, ceiling/saturation effects, feedback too weak to act on — and judge
   whether the plan's honesty machinery covers each path or just gestures at it.
3. CHEATING. For each arm separately: how does the agent (or the harness, or the
   analyst) get a better score without the underlying behavior being better? Which of
   those paths do the stated telemetry/tamper/validity rules actually catch?
4. EDGE CASES. Broken artifacts, timeouts, provider failures, flaky tests, retired/
   superseded requirements, chains that die mid-way — for each, does the stated rule
   produce a defensible outcome in BOTH arms symmetrically?
5. FIX COMPLETENESS. Pick the 3–5 already-applied fixes (shared context) that you judge
   most load-bearing, and try to break each one as specified in the plan text.

Settled decisions you must not re-open (flag only genuine contradictions): the choice of
benchmark fork; the two-arm structure and intention-to-treat estimand; the on-demand
runner; the staging ladder and its vocabulary.

Output format, in order:
A. VERDICT line: from your role's view — "ready for freeze", "fix first", or
   "structural concern" — one sentence of justification.
B. FINDINGS, ranked by severity, max ~20. Each: the plan section (§), the attack, the
   concrete failure scenario, and the change (or explicit accepted risk) that
   neutralizes it.
C. Your 2–3 INSISTED GUARDRAILS: QA requirements that must enter the pre-registration
   (or be explicitly declined with reasons on record).
D. TOP 3 RISKS from your perspective, one line each.
E. Any new factual claims you introduced, each marked [VERIFY].

=== SHARED CONTEXT ===
<<< PASTE THE SHARED CONTEXT BLOCK HERE >>>

=== THE PLAN UNDER REVIEW (complete text of E5-STAGE1-PREREG-DRAFT-v2.md) ===
<<< PASTE THE FULL v2 DOCUMENT HERE >>>
```

---

## 7. After collection (pointer only — not part of this doc's scope)

Archive all six raw outputs verbatim under `docs/e5/amigos-1/`, commit the archive, then
run reconciliation in a separate main-loop session per the methodology doc: convergent
findings rank highest (within-role and across-role), every insisted requirement is folded
into the prereg or declined on record, disagreements adjudicated explicitly, and any
reviewer factual claim existence-checked before use. Fable-5 findings that merely echo
the main loop's own views are weighted below DeepSeek's per the §1 same-family caveat.
Then: operator ratifies §14 inputs → freeze (hashes + commit). Every run rung after that
still requires separate explicit operator authorization.
