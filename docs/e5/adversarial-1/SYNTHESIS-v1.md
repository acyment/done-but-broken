# Adversarial-1 synthesis v1 — regression-accumulation continuation design

Synthesized 2026-07-23 in the main loop, falsification-framed (contestable readings scored
for the critics). Inputs: the seven sequential-mode panel files in this directory (raw
archive frozen pre-synthesis at `4d1ec9e`; provenance in `INGEST-NOTES-v1.md`), the design
under attack (`docs/e5/E5-REGRESSION-ACCUMULATION-CONTINUATION-DESIGN-v1.md` incl. §6a/6b),
the verified literature (`docs/e5/deepresearch-breakage-scaling-20260722/VERIFICATION-AND-SYNTHESIS-v1.md`,
L2 numbers only), and the binding constraints (CLAUDE.md/AGENTS.md: OpenSpec = shared
environment only under `e1-openspec-workflow-v0`; no spend; no overclaiming). Zero spend;
no runs; no prereg freeze here. This document informs the Stage-1 prereg draft (separate,
operator-authorized step); it rewrites no committed record.

**Citation hygiene result:** no panelist introduced a NEW external citation, so no web
verification was needed. Two panel factual claims are flagged against our own verified
record in §2 (one refuted, one downgraded to must-verify-in-repo).

**Bottom line:** the panel unanimously validates the substrate and staging (all 7 blind
Part A designs independently chose forking SlopCodeBench) and unanimously breaks two load-
bearing pieces of the Part-B plan as written: (1) the hidden referee contains the suite the
treatment arm optimizes against, and (2) the ported gate bundles feedback with an extra
attempt and oracle-guided selection. Both are fixable with deltas the panel largely agrees
on, listed in §6. As written, the design loses hostile comments H1 and H2 outright; with
the deltas it answers them.

---

## 1. Part A convergence scoring (all 7 files are sequential-mode)

Caveat first: sequential-mode blindness is imperfect (a pasted prompt can be read ahead),
and Part A came after a context section that already named SlopCodeBench, OpenSpec, and the
gate literature — so convergence on *those named artifacts* is weak evidence; convergence on
*unprompted structural choices* (matched retry, referee separation, allow-self-verification)
is the informative signal.

| Dimension | Our design | Panel Part A choices (quoted gist) | Score |
|---|---|---|---|
| Substrate/harness | Fork SlopCodeBench | 7/7 fork SlopCodeBench. GLM: "fork the open-source MIT-licensed SlopCodeBench harness". fable: "rather than the paper-1 harness or bespoke repos". chatgpt forks the *infrastructure* but swaps the corpus for ~10 real repos; qwen for "real or realistic" repos | CONVERGENT (corpus choice partially divergent: 2/7 want realer repos than the SlopCodeBench corpus) |
| Task scale | Tens of chains/arm, pilot decides; parent-style chain length | GLM 100 seq × 10 turns; deepseek 80 tasks × 4–8; kim26 50 × 5; Minimax 60/cell × 6; fable 36 chains × 8–12 × 2 reps; chatgpt 20 chains × 6 × 2 reps; qwen 24 chains × 6, 96 runs/arm | CONVERGENT in range (≈20–100 chains, 5–12 checkpoints); NOVEL: several plans assume a larger corpus than the verified 36 problems — see §2 flag |
| Group definitions | C text-only; T executable accumulated suite | 7/7 identical Gherkin text, executability the only delta | CONVERGENT |
| What-agent-sees | Post-checkpoint gate output (T only) | chatgpt+qwen give T an **on-demand runner during work** plus a guaranteed submit-time run; fable/others post-hoc. chatgpt: post-hoc-only = "a verification-gate experiment, not broadly an executable-specification workflow experiment". fable+chatgpt: fresh session per checkpoint, repo carries state; minimal feedback content (scenario ID + pass/fail + minimal diff, no traces) | DIVERGENT on runner availability (design decision, §5 D10); NOVEL: fresh-session-per-checkpoint, minimal-feedback spec |
| Gate policy (retry/rollback/keep-best) | Ported keep-if-≥-as-many rule | 5/7 drop or demote keep-best from the primary (fable "no rollback in either arm"; deepseek "keep the retry's output unconditionally"; chatgpt "always grade the final revision"; qwen "no harness-side keep-best rule"; kim26 keeps it in merged; Minimax keeps it but demands re-specified semantics) | DIVERGENT FROM US, convergent among panel: majority kill keep-best as primary |
| Retry parity for C | None (as written) | 5/7 matched review/revise turn for C (GLM, kim26, fable, chatgpt, qwen); deepseek keeps asymmetry but adds an n=10 blank-retry ablation arm; Minimax alone says don't match — claim the bundle | CONVERGENT against our as-written choice |
| Self-verification policy | Undecided (disclosed doubt) | 6/7 allow in both arms + instrument + ITT primary (kim26's Part A forbade, its Part B softened to "instrumented permission") | CONVERGENT: allow-and-log |
| Hidden-referee surface | Accumulated scenario suite + harness checkpoint tests, both arms | 6/7 build a grading surface distinct from what T executes (GLM separate referee suite; Minimax canonical-vs-binding separation; fable held-out probes + coverage map; chatgpt V/H1/H2 split; qwen parallel A/R with different fixtures; deepseek's Part A reused the suite but its Part B demands the split). kim26 resolves the same asymmetry the **opposite** way (make referee identical to visible) | CONVERGENT on the problem, divergent on mechanism; our as-written referee satisfies nobody |
| Metrics | Final RPR-analog; % chains regressed; violation curves; guard metric | 7/7 chain-level regression-affected primary or transition-level indicator; convergent extras: regression-eligible-only-after-first-pass risk sets (chatgpt, fable, qwen), false-completion / silent-breakage endpoint (fable, chatgpt), composite success = new-passes AND no-regression (qwen) | CONVERGENT + NOVEL risk-set and false-completion machinery |
| Power math | Deferred to prereg | Everyone computed one; spread: ~30–165 per arm depending on assumed effect (15–35pp). Minimax self-corrected its own Part A (60/cell only powers ≥25pp). Consensus: affordable N powers only ≥15–25pp effects; small TDAD-sized effects out of reach | CONVERGENT: prereg must carry explicit N + MDE honesty |
| Pilot/escalation | Control-only pilot, escalate rather than buy a null | 7/7 endorse a pilot; 5/7 attack the *adaptive* escalation (§3 F6); fable: pilot must exercise BOTH arms' machinery (the gate plumbing is the novel code) | CONVERGENT on pilot, convergent against our escalation wording |
| Scheduling/drift/stats | Not in the note | NOVEL, multiply independent: interleaved randomized arm scheduling + pinned CLI/model builds (fable, chatgpt, Minimax); mixed-effects clustering, chain random effects (kim26, Minimax, qwen, chatgpt); flake policy 3× referee runs (fable, qwen) | NOVEL — adopt into prereg |

Convergence headline: the design's *skeleton* (substrate, staging, byte-identical scenario
text, guard metric, pilot instinct, curves) is independently reproduced by every panelist.
The two places every panel diverged from us — referee overlap and gate bundling — are
exactly where Part B attacks landed, which is the blind-first structure working as intended.

---

## 2. Part B findings ledger (deduplicated, ranked by severity)

Verdicts: ACCEPT = changes the design; PARTIAL = mitigate/record; REJECT = with evidence.

### F1 — Referee contamination: the hidden referee contains the suite T optimizes against
**Raised by 7/7** (fable #1 "the killer", chatgpt #1 "critical", kim26 1.1 "critical",
Minimax 1b, qwen T2 "fatal for positive interpretation", deepseek T3, GLM T5). The plan's
referee = accumulated scenario suite + harness checkpoint tests; T watches the scenario
suite go red/green every checkpoint. "The group that saw the grader did better on the
grader" (chatgpt). **VERDICT: ACCEPT.**
**Delta (D1):** primary endpoint on a treatment-hidden surface only — the harness's own
checkpoint tests plus deliberately authored held-out probes per checkpoint; pre-registered
scenario→referee coverage map; covered/uncovered results reported separately (this also
satisfies the AGENTS.md visible-vs-hidden-gap headline rule); the visible scenario suite's
pass rate demoted to manipulation check. kim26's dissent (make referee byte-identical to
visible instead) resolves the same asymmetry in the opposite direction; we adopt the
majority resolution but keep kim26's point alive by *also* reporting the covered surface
with fable's flip-side framing: a win there is "the tool keeps its literal promises,"
scoped to the checked surface. Minimax's rider adopted: binding and referee share no code,
sealed by hash, author/time separation, post-hoc no-shared-imports audit.

### F2 — Treatment bundling: feedback + extra attempt + oracle-guided selection
**Raised by 7/7.** The keep-if-≥-as-many rule is best-of-two selection on a surface
correlated with the outcome — selection alone improves referee results even if the agent
learns nothing (fable's three-way split: information / attempts / selection; chatgpt's
four-way; deepseek's reductio: "even a random-number-generator agent would show lower
breakage in Group T"). **VERDICT: ACCEPT.**
**Delta (D2):** matched revise turn in C (see F3); no harness-side keep-best in the primary
comparison — grade C-final vs T-final; snapshot every attempt and grade all of them on the
hidden referee, yielding the nearly-free decomposition (T-attempt-1 = deterrence, T-final =
+feedback, T-gate-selected = +selection) published as secondary curves; the ported gate
policy survives as a pre-registered secondary "gate package" continuity analysis, exactly
as chatgpt's literature-gate analysis specifies. Minimax's dissent (don't decompose — claim
the bundle) is recorded as the honest fallback framing if the decomposition proves
infeasible, but with snapshots it costs almost nothing, and our thesis names executable
feedback — not a gate product — as the causal variable.
**Embedded factual dispute:** deepseek asserts 2607.01855 "always kept the final commit,
regardless of whether it improved" and that our keep-best rule is therefore *not* theirs.
This is **REFUTED by our own full read** of the paper (design note §1, verified against the
paper's HTML: "exactly one retry, kept only if ≥ as many tests pass"). The selection-
confound critique stands on its own; deepseek's provenance claim about the parent does not.
Re-pin the exact sentence during the prereg pass for the record.

### F3 — Retry asymmetry (disclosed doubt i)
5/7 convergent echo + sharpenings. **VERDICT: ACCEPT — resolved by D2's matched revise
turn:** both arms get the identical check-then-one-revise structure; C's instruction is the
spec-review ritual ("review your diff against every accumulated scenario"), T's is the same
plus authoritative results. Note this matches the standing E1 guardrail ("the context-only
arm may receive a second self-review turn, but must not receive executable feedback
outputs") — the repo already committed to this shape. **Rider (fable's TDAD trap, PARTIAL):**
the instructed prose-review control may sit *below* an ambient-text baseline (TDAD: 9.94%
vs 6.08% — instructions without execution made regressions worse, L2-verified). Pre-register
the caveat: this contrast estimates executable-vs-prose *under identical ritual*, not vs
nothing. A ~12-chain no-scenario anchor arm is recorded as an optional exploratory add-on,
spend-gated, not required.

### F4 — Self-verification policy (disclosed doubt ii)
**7/7 converge: ALLOW in both arms.** A ban is unenforceable ("where's the line between
running the app and testing" — fable) and instantly dismissible (GLM, chatgpt, qwen,
Minimax); allowed behavior is *measured* contamination. **VERDICT: ACCEPT (D3):** allow and
log (test files authored, test commands run, whether they cover prior scenarios); ITT
primary — the estimand becomes "provided executable acceptance scenarios vs frontier-agent
initiative," which is the product question; per-protocol/sensitivity secondary. The pilot
must estimate the control mechanization rate *m*, and the pre-registered N formula
conditions on it (fable's dilution math: effect ≈ Δ·(1−0.7m); at m≥0.5 the powered design
dies — that outcome would itself be a publishable finding about agent initiative, per GLM's
and qwen's null-framing).

### F5 — Visibility realism (disclosed doubt iii)
Convergent resolution (fable #5, chatgpt #6, GLM T4): the defensible design is **structural
absence, not disabled infrastructure** — C's workspace contains only markdown; no step
definitions, no verify target, nothing to grep and find switched off. Framing: "no
maintained executable acceptance artifact was supplied," a real organizational decision,
never "execution was hidden." Minimax dissents (weakest doubt, defend as-is) — consistent
with adopting the fix, since structural absence makes the defense trivial. **VERDICT:
ACCEPT (D4).**

### F6 — Pilot escalation = outcome-conditioned difficulty selection
chatgpt #4, qwen T6/C3, deepseek T4, Minimax C2, kim26 partial: "rather than buy a null"
reads as "you tuned difficulty until controls broke." The panel is right about the
*wording* and the open-endedness; the pilot itself is mandated by the AGENTS.md exposure
precondition (pre-spend base-rate estimate with a floor and abort — the P1.1 seed-220
lesson), which the panel independently reinvented. **VERDICT: ACCEPT-PARTIAL (D5):** keep
the control-only base-rate rung; make the ladder finite, numeric, pre-registered, and
conditioned only on control outcomes (e.g. chatgpt's shape: <15% chain-regression at 8
checkpoints → one lengthening to 12–16; still below floor → stop, publish the floor result,
go to Stage 2); pilot chains excluded from the confirmatory pool; the pilot result and
selected branch published regardless; an escalated design is a NEW prereg (qwen's Stage-1b
rule); the confirmatory claim explicitly targets the selected difficulty, with no
natural-prevalence implication. The phrase "rather than buy a null" is retired from
protocol language. **Rider (fable #8, ACCEPT):** a small both-arms shakedown (~4 chains,
excluded from analysis) must precede the confirmatory run — the gate runner, snapshotting,
and step-def plumbing are the novel code and cannot be first exercised mid-confirmatory-run.
The base-rate *estimate* still comes from the control-only rung.

### F7 — Regression event definition, risk sets, lifecycle
chatgpt #7, fable #7, qwen T7, Minimax 1f: a scenario is regression-eligible only after it
has passed at least once in that run (you can't regress what never worked — otherwise T is
paradoxically penalized for implementing more early); lifecycle metadata
(active-from / retired-at / modified-by) so intended supersessions never count as
regressions; a pre-registered non-runnable-artifact rule; exact keep-best semantics if the
gate policy is analyzed at all. **VERDICT: ACCEPT (D6).**

### F8 — Missing prereg machinery: N/power, frozen analysis, scheduling, flakes
fable #7, Minimax 1c/5, chatgpt #10/#11, qwen T9/T10: absent a frozen N, "you peeked and
stopped when it looked good" is unanswerable; chains are clustered (mixed model, chain
random effects, cluster-robust SEs; curves need one pre-specified scalar primary);
interleaved randomized arm scheduling with pinned CLI/model builds (provider drift
otherwise aliases with condition); flake policy (referee 3× — pass-baseline requires 3/3,
regression requires fail-any, plus majority-vote sensitivity); token/wall-clock accounting
(feeds the per-dollar hostile answer). **VERDICT: ACCEPT (D7)** — all of it is prereg
content, none of it changes the causal skeleton.

### F9 — The binding/step-definition artifact is an experimenter-controlled knob
Minimax 1a/C3, kim26 §6-secondary, GLM T5: step definitions resolve Gherkin ambiguity and
their strictness sets the effect size. **VERDICT: PARTIAL.** Mitigations adopted: frozen
literal step definitions, line-audited against the prose and published; feedback minimized
(scenario ID + pass/fail + minimal public diff — chatgpt #9's leak list); an agreement
check (Minimax's κ) between visible checks and the hidden referee on shakedown chains as a
manipulation check. The full multi-strictness sensitivity design is **REJECTED for Stage 1**
— it roughly doubles chain count, and Minimax itself demoted it below the bundling fix in
its own red-team (6a).

### F10 — Tamper surface
fable #6, qwen 8.3: writable in-repo suites can be gamed; execute frozen external copies /
hash-verify; log divergence as a tamper metric. **VERDICT: ACCEPT (D7 rider)** — matches
the repo's standing tamper-detection TDD requirement.

### F11 — "Continuation/ported" framing overclaims
**7/7, unanimous.** The gate we run executes a *growing* accumulated surface (the parent's
only ever ran the frozen original suite), on frontier agents, in agentic mode — a
substantially stronger treatment; and (fable's irony) the one element ported verbatim for
fidelity, keep-best, is the element causing F2. Spread of prescriptions: drop the frame
entirely (GLM, kim26) ↔ keep loosened (deepseek "conceptual replication", qwen "conceptual
extension", Minimax "follow-up with adopted design elements" + its own red-team 6e warning
against over-rotating, chatgpt "mechanism-motivated extension"). **VERDICT: ACCEPT (D8):**
public and prereg language becomes "conceptual extension with adopted design elements";
explicit delta table (models, mode, task scale, verified surface, gate semantics); the
parent's 43.2→12.5 is a directional prior for power only, never a comparison target; no
cross-paper effect-size claims. Internal doc titles keep their names with a header note.

### F12 — Guard metric must be composite and load-bearing
qwen 3.2, chatgpt #8, deepseek T5: report P(new passes), P(no regression), and the
composite P(both) separately; pre-declare a claim rule (no material new-requirement loss,
e.g. −10pp bound; both agents' point estimates directionally beneficial; improvement on the
hidden surface, not only the visible one) so the guard can't become a post-hoc narrative
tool. **VERDICT: ACCEPT (D9).**

### F13 — Post-hoc-gate-only vs runner-available-during-work
chatgpt #3 (alone, but structurally sound): if T only ever sees results at the forced gate,
the experiment tests a verification gate, not the executable-specification workflow the
tool thesis describes. **VERDICT: PARTIAL → operator decision (D10).** Recommendation:
adopt chatgpt's shape — documented runner available on demand in T plus one guaranteed run
at completion-declaration, proactive-usage logged as a mechanism measure. It moves the
estimand closer to the product thesis at the cost of a wider delta from the parent's gate;
with F11 accepted, that comparability cost is already paid.

### F14 — Frontier-corpus mismatch risk (panel assumed a bigger pool than verified)
deepseek asserts "50+ evolving-specification Python tasks"; kim26 samples 50; GLM plans 100
sequences; Minimax assumes difficulty tiers. Our L2-verified abstract numbers: **36
problems / 196 checkpoints**. Panel corpus claims are unverified assertions; if the usable
pool is ≤36 chains, most panel N plans are infeasible without authoring new chains
(fable's provision: author additional chains in-format before freezing, tag provenance as a
covariate). **VERDICT: PARTIAL — verify corpus size/structure in the codebase-reading pass
(§4 item 7); carry fable's authoring provision into the prereg draft.**

### F15 — Refactoring-punished attack
GLM C3: C might "improve" architecture, breaking old tests for good reasons. **VERDICT:
PARTIAL:** task instructions state backward compatibility is required (that IS the promise-
keeping construct under test — not a bug); lifecycle metadata (F7) handles intended
supersession; held-out probes test intended behavior, not implementation details. Recorded
as a scoping sentence for the public post, not a design change.

---

## 3. Disclosed-doubts resolution (explicit)

- **Retry asymmetry** → RESOLVED: matched revise turn in C + no keep-best in primary +
  all-attempts grading decomposition (F2/F3, deltas D2). The confound does not survive this
  choice in its compute form; the remaining difference (informed vs uninformed second turn)
  *is* the treatment, per chatgpt's formulation.
- **Self-verification policy** → RESOLVED: allow in both arms, instrument, ITT primary,
  per-protocol secondary, pilot-measured mechanization rate conditioning N (F4, D3).
- **Visibility realism** → RESOLVED: structural absence of execution infrastructure in C +
  "not supplied" framing (F5, D4). One panelist (Minimax) held it was defensible as-is;
  the fix makes that defense free.

---

## 4. Hostile-commenter triage (union of all proposed comments)

| # | Comment (composite) | Sources | Status after deltas |
|---|---|---|---|
| H1 | "Best-of-two with an oracle beats one-shot — you measured retry budget + selection, not executability" | GLM, fable C1, deepseek C1, qwen C1, chatgpt C1 | **ANSWERABLE after D2**: matched revise turn; primary has no keep-best; decomposition curves published ("attempt 1 alone cut breakage X→Y; feedback added Z") |
| H2 | "Your 'hidden' referee is the worksheet you let the student self-grade" | fable C2, kim26 C2, qwen C2, chatgpt | **ANSWERABLE after D1**: hidden-only primary, held-out probes, covered/uncovered split; if T wins only on covered, claim scoped to "the tool keeps its promises" |
| H3 | "The control never runs anything / you forbade tests — strawman; or you allowed them and proved nothing beyond 'tests help'" | GLM C1/C2, fable C3, chatgpt C3, kim26 C1, deepseek C3 | **ANSWERABLE after D3/D4**: self-verification allowed and logged; ITT estimand = provided scenarios vs agent initiative; C's workspace structurally test-infrastructure-free, not nerfed |
| H4 | "You tuned difficulty until the controls broke" | chatgpt C2, qwen C3, Minimax C2, deepseek T4 | **ANSWERABLE after D5**: finite numeric ladder, control-conditioned only, separate pools, pilot published regardless, claim scoped to selected difficulty |
| H5 | "Toy checkpoint chains ≠ my 200k-line repo; Stage 2 is vaporware" | kim26 C3, deepseek C2, chatgpt C3 | **NOT ANSWERABLE IN STAGE 1 — scope honestly**: Stage 1 is a controlled mechanism study; no tooling recommendation until Stage 2; kim26's framing adopted (Stage 1 = the gate that decides whether Stage 2 is worth running) |
| H6 | "Twice the tokens, of course fewer bugs — per dollar it's a wash" | fable (near-miss 4th) | **ANSWERABLE after D7**: token/wall-clock accounting; report breakage per checkpoint and per dollar alongside the guard metric |
| H7 | "The binding's strictness is a knob you control" | Minimax C3 | **PARTIALLY ANSWERABLE after D1/F9**: published literal step defs + audit + κ manipulation check; residual scoped honestly ("this binding at this strictness") — full multi-strictness sweep rejected for Stage 1 |
| H8 | "Byte-identical text but different *effective* spec — the binding operationalizes T's Gherkin" | Minimax C1, GLM T5 | **PARTIALLY ANSWERABLE**: same mitigations as H7 + claim language names the operationalization ("provided executable scenarios," not "same information"); hidden-only primary limits the damage |
| H9 | "You punished C for superior refactoring" | GLM C3 | **ANSWERABLE after F7/F15**: compatibility is the explicit contract; supersessions never scored; probes assert public behavior |

---

## 5. Fork-vs-plug: merged reading checklist (ranked)

Union of seven panel checklists + our two standing questions (marked ★). Decision-weight
descending; items 1–4 are effectively veto-grade (chatgpt's rule: an option failing one is
out regardless of total score).

1. **Grader standalone-ness & separability.** Can strict accumulated scoring run as a
   self-contained artifact on frozen commits (repo snapshot + checkpoint index → verdicts,
   own container), outside orchestration, invisible to the agent — and can its surface be
   split visible/hidden? Porting an entangled grader is where silent bugs enter (fable #1,
   Minimax's single question: "can I extract `grade_chain()` and the adapter as callables?").
2. **Intervention/retry insertion points.** Intercept completion-declaration; run a check;
   feed condition-specific text; give BOTH arms one revise turn; retain both snapshots; is
   rollback entangled with test execution; can keep-best be disabled without surgery
   (chatgpt #2, kim26 #2, qwen #2).
3. **Per-checkpoint snapshotting.** Required for the D2 decomposition, tamper diffs, and
   the passed-at-j-fails-at-k event definition. If SlopCodeBench lacks it, forking loses
   most of its edge (fable #3 — and fable's own red-team flags this as the item that
   catches its "nearly free decomposition" claim).
4. **★ Agent test-result visibility default.** Whether checkpoint test results reach the
   agent by default (arm C requires hiding them; arm T requires gating on them) — likely a
   prompt/env config; confirm in their `docs/evaluation/` (our standing question #1;
   qwen #1's separability concern is the same fact from the validity side).
5. **State-injection & prompt parity.** Per-checkpoint fresh sessions over repo-carried
   state; arbitrary workspace files (OpenSpec dir, CLAUDE.md/AGENTS.md control) without
   patching adapters; byte-identical instruction control across arms (fable #2).
6. **Checkpoint continuity semantics.** Agent continues from ITS OWN prior commit, not a
   golden reset — a golden reset kills the accumulation design outright (qwen #5).
7. **Corpus reality check.** Actual usable chain count, checkpoint counts, difficulty
   structure, dependency metadata (which later features presuppose earlier ones — the
   regression denominator needs it). Panel assumed 50–100+ tasks; verified abstract says 36
   problems / 196 checkpoints (F14).
8. **Adapter fidelity & depth.** Thin wrapper vs deep hierarchy (Minimax's <5-files
   heuristic); transcript completeness, completion detection, crash handling, whether one
   adapter has capabilities the other lacks (chatgpt #3's fidelity list).
9. **Determinism/flake posture.** Pinned images, network isolation, seeds; empirically
   re-run one chain's grader 3× and record divergence before deciding anything (fable #4).
10. **Filesystem permission model.** Read-only exposed checks, referee invisibility
    (separate image/volume), tamper detection hooks (qwen #6).
11. **★ Subscription-mode orchestration.** Claude Code subscription auth inside their
    Docker (our standing question #2 — the cost lever); parallel containers under consumer
    seat limits, backoff/resume — "calendar time dies here, not in code" (fable #5).
12. **Telemetry.** Full transcripts, tool calls, token counts per step — required for the
    mechanization rate (D3), the tax metric, and H6 (fable #6, deepseek #2).
13. **Our own harness's audit machinery, honestly assessed.** If the E4-side prereg
    hooks/frozen-config hashing are aspirational rather than working, plug loses its main
    selling point (fable #9, kim26 #4).
14. **Task export cleanliness.** Declarative task schema vs harness-entangled — decides how
    cheap "plug" is (kim26 #3, Minimax #4).
15. **Upstream health, license, dependency hygiene** (all; MIT confirmed in §6b ranking;
    check transitive deps and open issues against the strict scorer — known grading bugs
    are disqualifying either way but change which path inherits them).

**Decision rules to apply after reading** (record all three verdicts): fable — grader
standalone AND upstream lacks snapshotting → plug; grader entangled OR snapshotting exists
→ fork; seriously price the hybrid (fork the grader as a service, keep our orchestrator).
chatgpt — default plug (the protocol machinery is the scientific asset) unless the grader
can't be extracted with semantic fidelity; require ≥4/5 on veto items; <~10 weighted points
apart → plug. deepseek's empirical actions: run 5 tasks and diff grading vs a manual
ground-truth; trace one task's adapter I/O verbatim; attempt the OpenSpec injection on one
task and count changed lines.

---

## 6. What changes in the design (accepted deltas → inputs to the Stage-1 prereg draft)

- **D1 (F1):** primary endpoint on a treatment-hidden referee surface (harness checkpoint
  tests + authored held-out probes); pre-registered coverage map; covered/uncovered split
  reported (the AGENTS.md visible-vs-hidden gap headline); visible suite = manipulation
  check; binding/referee code separation sealed by hash.
- **D2 (F2):** no harness keep-best in the primary; C-final vs T-final; all attempts
  snapshotted and referee-graded → deterrence/feedback/selection decomposition; ported gate
  policy = secondary continuity analysis only.
- **D3 (F4):** self-verification allowed both arms, instrumented; ITT primary,
  per-protocol sensitivity; pilot measures control mechanization rate m; N formula
  conditions on m.
- **D4 (F5):** C's workspace structurally contains no execution infrastructure; framing
  "no maintained executable acceptance artifact supplied."
- **D5 (F6):** finite numeric control-conditioned escalation ladder; separate pilot/
  confirmatory pools; pilot published regardless; escalation = new prereg (Stage 1b);
  claim scoped to selected difficulty; both-arms ~4-chain shakedown (excluded) before the
  confirmatory run; "rather than buy a null" retired from protocol language.
- **D6 (F7):** precise event definition (eligible only after first pass; passed-at-j-fails-
  at-k), scenario lifecycle metadata, non-runnable rule, exact gate semantics for the
  secondary analysis.
- **D7 (F8/F10):** frozen N + MDE honesty (powered for ≥15–25pp only), mixed-model
  clustering + one pre-specified scalar primary, interleaved scheduling + pinned builds,
  referee flake policy (3×), tamper telemetry on frozen external copies, token/wall-clock
  accounting.
- **D8 (F11):** framing = "conceptual extension with adopted design elements"; delta table;
  parent effect sizes as directional priors only.
- **D9 (F12):** composite guard metric + pre-declared claim rule (hidden-surface
  improvement required; both agents directionally beneficial; ≤10pp new-requirement loss).
- **D10 (F13, operator decision):** recommended — runner available on demand in T plus
  guaranteed completion-time run, proactive usage logged. Alternative (post-hoc gate only)
  must be labeled a verification-gate experiment.
- **Recorded, not adopted:** multi-strictness binding sweep (F9 — rejected for Stage 1);
  no-scenario anchor arm (F3 rider — optional, spend-gated); Minimax's bundle-claim framing
  (fallback if the decomposition proves infeasible in the harness).

## 7. Honest-scope notes on this synthesis

Panel models could not read either codebase — every fork-vs-plug input is checklist-only,
and corpus-size assertions were panel guesses (§2 F14). The three disclosed doubts were
given to the panel; their echoes are confirmation, not discovery — the genuinely
undisclosed discoveries were F1 (referee overlap), the selection component of F2, F6's
sharpening, F7, and F13. Sequential-mode Part A blindness is imperfect (models can read
ahead), so Part A convergence is weighted toward unprompted structural choices. A unanimous
panel can still be wrong — that is what the pilot rung exists to catch. Nothing here is
evidence about the world; it is design review. Per AGENTS.md, the Stage-1 prereg freeze
still requires the program's own gates (Step-6 re-attack + Three Amigos) on the *revised*
design, and every run rung — including the pilot — needs explicit operator authorization.
