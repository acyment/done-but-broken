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

## 6. What this buys the public narrative

The post sequence becomes: (1) "the research is in" (verified literature, incl. the
parent's own prose-vs-executable result); (2) "we ran the frontier version in a real
spec-driven workflow — here's the curve" (Stage 1); (3) "here's it working on a real
system" (Stage 2, the tool's proof-of-concept). Each post stands on frozen, replayable,
honestly-reported runs — the credibility asset that survives hostile comments.
