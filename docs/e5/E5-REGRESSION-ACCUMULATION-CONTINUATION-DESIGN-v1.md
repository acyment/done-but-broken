# Continuation design v1 — frontier Gherkin/OpenSpec extension of arXiv:2607.01855

Drafted 2026-07-23 (zero spend: web reads only). Parent paper read in full via targeted
fetches; all facts below verified against the paper's HTML unless marked otherwise.
Goal frame (operator, 2026-07-23): LinkedIn-credible evidence positioning a future
agent-native BDD tool — NOT a journal paper. Prior art is ammunition, not a novelty threat.

## 1. The parent paper (verified summary)

"Regression Accumulation in Multi-Turn LLM Programming Conversations", arXiv:2607.01855
(posted 2026-07-02; Massey Univ. / Alibaba Research / Hangzhou Normal / Otago).

- **Protocol:** 542 Python function-level seed tasks (HumanEval+ 164, MBPP+ 378), each
  extended into an **8-turn requirement-evolution chain** using **fixed prompt templates**
  in fixed order: T2 error-handling, T3 input generalization, T4 caching, T5 functional
  extension, T6 interface restructuring, T7 non-functional augmentation, T8 algorithm
  optimization. Only benchmark-derived fields vary; no LLM-invented turns.
- **Measurement:** RPR_t = fraction of the task's **original benchmark tests** passing at
  turn t (T6–8: invocation sites deterministically rewritten). 6 models × 542 × 8 = 26,016
  turn instances, temperature 0, 15 s test timeout.
- **Headline:** 40–73% of tasks lose previously-correct behavior over the conversation
  (DeepSeek-V3 ~40% / final RPR 75.8%; GPT-4o ~47% / 72.4%; Llama-3.1-8B 73% / 31.6%).
  Losses concentrate at **T2/T3** (over-guarding: new validation rejects previously-valid
  inputs = 28.6% of annotated failures; Cross-Turn Conflict overall = 55.7%).
- **Mitigations:** S1 "Snowball Recap" (deterministic prose restatement of all prior
  requirements each turn) vs S2 "Verification Gate" (run regression tests after each turn;
  trigger on RPR drop vs previous turn when a last-passing version exists; rollback prompt
  with failure count + last-passing code + current requirement; **exactly one retry**, kept
  only if ≥ as many tests pass). S2 dominates: DeepSeek-V3 final RPR 75.8→87.9%,
  tasks-with-regression 43.2→12.5%; S1 alone +~4pp; **S1+S2 underperforms S2 alone**.
  Verbatim: "online behavioral verification and rollback, rather than prompt restatement
  alone, is the main driver of mitigation."
- **Limitations (their own):** function-level Python only; fixed turn ordering; "effect
  sizes may not directly transfer to other languages, repository-scale maintenance, or
  human-in-the-loop settings"; sub-frontier roster.
- **Artifacts:** two anonymous.4open.science links (templates + full results). Both return
  **403 to automated fetch** (2026-07-23); operator browser check pending; fallback =
  reconstruct templates from the published type sequence (loses exact-template
  comparability, keeps protocol comparability).

### Two verified facts that define our opening

1. **Their promise surface never grows.** The gate and RPR only ever run the ORIGINAL
   suite; turns 2–8 add prose-only requirements with no executable form. Nobody in this
   protocol verifies the accumulated requirements — so the paper measures preservation of
   turn-1 behavior, not fidelity to the growing spec. Our continuation makes every turn's
   requirement land as executable scenarios: the verified surface grows with the spec,
   which is (a) how SDD actually works and (b) the unmeasured density axis both
   deep-research reports agreed on.
2. **S1-vs-S2 is our contrast in miniature, already published.** Prose restatement of the
   spec (≈ prose specs) gave +4pp; executable verification gave +12pp and a 3.5× drop in
   regression-affected tasks; combining them was no better than the gate alone. This is
   the toy-scale version of "prose specs vs executable specs" — citable as independent
   validation of the tool thesis, and corroborated by TDAD's finding that TDD-flavored
   prose without execution made regressions WORSE.

## 2. Continuation claim (what our result would add)

At **frontier tier**, in a **realistic spec-driven workflow** (OpenSpec workspace, Gherkin
scenario blocks, agentic harness), with the **executable surface growing each turn**:
does executable acceptance verification still cause the regression/drift reduction the
parent paper measured at toy scale — and at what accumulated-promise count does frontier
breakage appear at all?

Claim-safe public phrasing (per the framing standard): "executable acceptance feedback"
as the causal variable; BDD/Gherkin as the interpretation and tooling layer; OpenSpec only
ever as the shared workflow environment (profile `e1-openspec-workflow-v0`) — never a
condition, never a spec-format comparison between arms.

## 3. Stage 1 design (the faithful continuation)

### Environment (identical in both arms — the profile requirement)

- One OpenSpec workspace per chain. Each turn's requirement enters as an OpenSpec change
  whose delta spec carries **pre-authored Gherkin scenario block(s)** for that turn
  (frozen before any run; authored from the turn templates, same text in both arms).
  Harness-run archive step identical in both arms.
- Function-level Python substrate as in the parent (seed task + accumulating module).
- Agentic harness (Claude-Code-style loop with file tools), NOT bare chat completion —
  decision recorded: we trade exact-setting comparability for the setting our claim is
  about; metric-level comparability is retained. (Operator may overrule to chat-style.)

### Arms (executability the only delta)

- **Arm C (prose scenarios):** scenarios visible in the workspace spec as text; nothing
  executes; no verification output of any kind reaches the agent.
- **Arm T (executable scenarios):** identical workspace, plus after each turn the FULL
  accumulated scenario suite (turns 1..t) executes via harness-provided step definitions;
  on failure the agent gets the parent paper's gate shape: failure count + failing
  scenario names + last-passing code available, **one retry**, keep-better rule. Gate
  policy generalizes S2 from "original tests" to "all accumulated scenarios."

- Step definitions are harness-side, frozen, and never visible to either arm's agent
  beyond the scenario text itself (no implementation hints leak into Arm T).

### Hidden grader (both arms, invisible, harness-side)

After every turn in BOTH arms: (i) the original benchmark suite (comparability with the
parent's RPR), (ii) the full accumulated scenario suite (the SDD surface — the density
axis), (iii) archived workspace state (spec-drift events in the OpenSpec spec itself —
the E4 archive-rewrite surface rides along for free).

### Metrics

- Primary (comparable): final-turn RPR; % of chains losing previously-correct behavior.
- Novel: scenario-surface violation curve vs accumulated-promise count (turn number ≈
  promise count in this protocol — recorded as a deliberate conflation, de-confounded
  only in Stage 2); count of silent violations in Arm C that Arm T's gate caught.
- Guard metric: turn-level task success (did the new requirement get implemented at all)
  so the gate isn't just blocking progress.

### The frontier-null risk and the pilot gate (the P1.1/probe lesson, kept)

Frontier models may simply not break at 8 toy promises — the parent's best sub-frontier
model already sat at "only" 40% affected chains, and our probe series shows frontier
absorbing yesterday's failure modes. Therefore Stage 1 starts with a **control-only pilot
rung**: ~10–15 chains, Arm C only, fable-tier, measuring baseline breakage on both graded
surfaces. Pre-declared decision rule (to be frozen in the prereg): if control breakage at
8 turns is below a floor that makes the A/B informative at affordable N, DO NOT run the
A/B at this scale — escalate (longer chains 12–16 turns; richer seed tasks; or jump to
Stage 2 repo-level) and re-pilot. This keeps us from buying a null the literature already
predicts frontier competence might produce at toy scale.

### Roster and cost posture

Bulk on claude-family (subscription; replicates free). GPT-side slice via codex within
whatever run count the operator authorizes (quota, not free). Sample size for the A/B:
anchored on the parent's effect sizes (order-of tens of chains per arm if frontier
baseline breakage lands near sub-frontier levels; pilot decides). Every run rung —
including the pilot — needs explicit operator authorization; nothing in this note
authorizes spend.

## 4. Stage 2 sketch (the tool-shaped flagship — design deferred)

Same contrast on a repository-scale substrate over milestone-style sequences
(SWE-Milestone-informed; possibly the gitea stack as environment, with NO planted trap —
accumulation replaces the trap). Scenario surface = several dozen Gherkin promises over
real behaviors; sequence = realistic change requests. Deferred until Stage-1 pilot data
exists; this is where the density axis gets de-confounded from turn count and where the
LinkedIn flagship material comes from.

## 5. Open items before a prereg can be frozen

1. Operator browser-check of the two anonymous artifact links (template reuse vs
   reconstruction).
2. Chat-style vs agentic harness — recorded recommendation: agentic; operator call.
3. Scenario authoring pass for the 8 turn types (frozen text per turn type; per-task
   field filling deterministic, mirroring the parent's template discipline).
4. Step-definition harness for function-level Gherkin (small pytest-bdd-style runner).
5. Pilot decision rule numbers (breakage floor, N, escalation ladder) — in the prereg,
   not here.
6. Codex run-count authorization for the GPT slice.

## 6a. Addendum 2026-07-23 — verified frontier rosters and the gap map

Verified from the papers' own HTML (not the deep-research reports):

- **SWE-Milestone/EvoClaw:** Claude Sonnet/Opus 4.5 & 4.6, GPT-5.2/5.2-Codex/5.3-Codex,
  Gemini 3/3.1 Pro, MiniMax M2.5, Kimi K2.5 — run through **Claude Code, Codex CLI, Gemini
  CLI, OpenHands**. Measures the >80%→38.03% collapse; **tests no mitigation** (observes
  post-hoc that "moderate, disciplined verification" correlates with better outcomes).
- **TensorBench:** Claude Opus 4.7 & 4.6, GPT-5.5/5.4/5.3-Codex (xhigh), Gemini 3.1 Pro,
  Qwen3-Coder-480B. **Opus 4.7 breaks pre-existing tests in 16% of patches** (27% for
  4.6). No mitigation tested.
- **SlopCodeBench (v2):** 15 agents incl. Opus 4.5–4.7, Sonnet 4.6, GPT-5.2–5.5, Composer 2,
  GLM 5.1, Kimi K2.5/2.6, MiniMax M2.7. Best (GPT-5.5) = 14.8% strict checkpoints. Tested
  **prompting-only** mitigations (anti-slop, plan-first): improve initial quality, **"do
  not slow the degradation."**
- **SWE-EVO:** 2025-era roster (GPT-5-08-07 etc.) — less relevant.

**Gap map:** toy tasks × weak models has both breakage measurement AND the executable-gate
cure (parent paper); frontier agents × realistic work has breakage measured three ways and
**no verification-style mitigation ever tested**. The empty cell is our experiment. The
frontier-null risk is therefore scale-dependent: real at function-level toys, effectively
foreclosed at repo/checkpoint scale by published data.

## 6b. Addendum 2026-07-23 — fork-target ranking (best codebase to build our two-arm OpenSpec probe on)

Criteria: license; harness maturity; native fit for accumulating-spec chains with per-turn
regression grading; agent pluggability (our roster = Claude Code + Codex CLI); ease of
inserting the OpenSpec workspace layer identically in both arms; published frontier
breakage at that scale (kills the null risk); run cost.

1. **SlopCodeBench — `SprocketLab/slop-code-bench` (MIT, 91★, active; problems in
   `gabeorlanski/scb-problems`, Apache-2.0).** The standout. Purpose-built for *iterative
   specification refinement*; **strict scoring already re-runs all earlier checkpoints'
   tests at every checkpoint** — our accumulated-surface hidden grader, pre-built;
   Docker-isolated environments; **native agent configs for `claude_code` and `codex`**
   (plus gemini/openhands/cursor/kimi); Jinja prompt templates → clean insertion point for
   the OpenSpec workspace + per-checkpoint Gherkin scenario blocks, byte-identical across
   arms; frontier breakage at this scale is published (best agent 14.8% strict). To
   verify before prereg: whether checkpoint test results are visible to the agent by
   default (arm-C requires hiding them; arm-T requires gating on them — likely a
   prompt/environment config, confirm in `docs/evaluation/`); whether the Claude Code CLI
   inside their Docker can ride subscription auth (cost lever).
2. **SWE-Milestone — `DeepCommit-ai/SWE-Milestone` (MIT, 62★, active).** Already screened
   by us 2026-07-21: mature harness, **native hidden-oracle test-masking**, QUALIFIED-GO
   with recorded caveats (model-authored dependency DAG not per-edge verified; only 3/7
   repos with stable public surface; ships an SRS). Repo-level realism, real agent CLIs,
   frontier collapse published. Heavier per-run cost and a bigger Gherkin-authoring lift →
   **Stage-2 flagship fork**, not the first build.
3. **Parent 2607.01855.** Fork for *protocol and comparability numbers*, not
   infrastructure: chat-completion scripts on function-level tasks; artifacts anonymized
   and 403 to automation (operator browser check pending). Remains the source for the
   optional cheapest dry run and for metric alignment.
4. **EvoCode-Bench (2605.24110):** no public artifact found; GitHub's `EvoCodeBench` hits
   are a **different 2024 benchmark with a colliding name** — flagged, do not confuse.
5. **SWE-CI / TensorBench / FeatBench / TDAD:** no public harness found by search (SWE-CI
   data figure-locked; TensorBench's substrate is a bespoke compiler repo — heavy,
   single-domain; TDAD is a method paper). `SWE-EVO/SWE-EVO` (MIT, empty description)
   exists but is low-signal — check only if needed.

**Staging consequence:** Stage 1 re-anchors on a SlopCodeBench fork (checkpoint scale —
frontier breakage guaranteed, harness ready) with the OpenSpec+Gherkin layer added
identically in both arms and the parent's gate policy ported as arm-T; the parent-protocol
toy dry run becomes optional. Stage 2 remains the SWE-Milestone-style repo-level flagship.

**Prior-knowledge correction (operator-prompted, 2026-07-23):** SlopCodeBench, EvoClaw
(SWE-Milestone's v1 name), and TDAD were already catalogued in this repo during the E4
design phase — `E4-DESIGN-BRIEF.md` §12/§15 deferred "real-repo substrates (EvoClaw,
rallly, SlopCodeBench)" to v2 behind an `E4SubstrateProvider` interface (never executed;
no prior runs, so no contamination/precedent concerns), and
`docs/research/executable-feedback-frontier-hardness-synthesis-v1.md` used their numbers
(with the CORRECT SlopCodeBench v2 figures, corroborating our verification) to justify E4
levers, calling SlopCodeBench the "closest published cousin; differentiate in docs". Two
consequences: (1) the deep-research round partially re-found what the E4 literature pass
already knew — future searches should grep `docs/research/` first; (2) a real design fork
exists for Stage 1: fork *their* harness (agents+Docker+accumulated grading ready) vs plug
SlopCodeBench problems into *our* E4 harness via the already-designed substrate-provider
interface (our two-arm/OpenSpec/custody machinery native). To be decided in the
pre-prereg verification pass after reading both codebases; the ranking above concerns
their harness's forkability and stands either way.

## 7. What this buys the public narrative

The post sequence becomes: (1) "the research is in" (verified literature, incl. the
parent's own prose-vs-executable result); (2) "we ran the frontier version in a real
spec-driven workflow — here's the curve" (Stage 1); (3) "here's it working on a real
system" (Stage 2, the tool's proof-of-concept). Each post stands on frozen, replayable,
honestly-reported runs — the credibility asset that survives hostile comments.

## 8. Addendum 2026-07-23 — adversarial-1 panel verdicts (design deltas accepted)

The seven-model adversarial panel (`docs/e5/adversarial-1/`, synthesis
`docs/e5/adversarial-1/SYNTHESIS-v1.md`) unanimously reproduced this design's skeleton in
blind Part A (7/7 fork SlopCodeBench) and unanimously broke two pieces of §3 as written:
the hidden grader must NOT include the accumulated scenario suite arm T optimizes against
(primary moves to a treatment-hidden surface: harness checkpoint tests + authored held-out
probes, with a pre-registered coverage map and covered/uncovered split), and the ported
keep-if-≥-as-many gate bundles feedback with selection (primary becomes C-final vs T-final
with a matched revise turn in arm C and no harness keep-best; all attempts snapshotted and
referee-graded for a deterrence/feedback/selection decomposition; the parent's gate policy
survives only as a secondary continuity analysis). Also accepted: self-verification allowed
in both arms and instrumented (ITT primary; pilot measures arm-C mechanization rate, which
conditions N); arm C structurally contains no execution infrastructure; the §3 pilot
escalation becomes a finite numeric control-conditioned ladder with separate pools and a
new prereg per escalation ("rather than buy a null" retired); precise regression risk-set /
lifecycle / flake / tamper / clustering / scheduling machinery goes into the prereg; the
"faithful continuation" framing of §3's title weakens to "conceptual extension with adopted
design elements" (the accumulated-surface gate is a stronger treatment than the parent's
original-tests-only gate — no cross-paper effect-size claims). **D10 DECIDED (operator,
2026-07-23): on-demand runner in arm T** — the executable checks are runnable by the agent
at any time while working (BDD-like inner loop), plus the guaranteed run at
completion-declaration; proactive usage is logged as a mechanism measure. Post-hoc-gate-only
is rejected. Deltas D1–D10 in the synthesis are the input to the Stage-1 prereg
draft, which remains a separate, operator-authorized step.
