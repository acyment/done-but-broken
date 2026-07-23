I'll conduct a thorough Product/Business review of this pre-registration plan. Let me work through this systematically.

---

## A. VERDICT

**Fix first** — The plan's claim architecture is structurally sound and the scaffolding is impressive, but several framing hazards and audience-value gaps remain unaddressed that would expose the program to hostile misreading on LinkedIn; these are fixable without reopening settled design choices.

---

## B. FINDINGS (ranked by importance)

### 1. §1.4 / §6.2 — The "auto-scope" mechanism is a trap dressed as rigor
**Issue:** The uncovered-slice rule (§6.2.1b) auto-scopes the claim to "keeps its literal promises on the checked surface" if uncovered events are directionally adverse or empty. This sounds like scientific humility but creates a **nothingburger generator**: the treatment could show a 20pp improvement on covered checks, the uncovered slice could be empty (common at small N), and the claim collapses to a tautology about the visible suite — which we already knew it would pass, because the visible suite is the treatment's own feedback loop.

**Why it matters:** A skeptical CTO reads "the tool keeps its literal promises on the checked surface" and thinks: *you spent $X to prove that a test suite passes its own tests*. The auto-scope language must **pre-empt this reading explicitly** — state that this scoped claim is only interesting if the covered fraction is materially below 1.0 and the effect size is large. As written, the rule lets a weak result hide behind procedural language.

**Required change:** Add a pre-registered **scope-worthiness threshold**: the auto-scoped claim is only publishable as a positive result if (a) covered fraction < 0.90 AND (b) the covered-slice effect is ≥ 20pp. Otherwise, the result is reported as "inconclusive — feedback loop too dominant" and routed to the null-framing publication path. Do not let the auto-scope become a face-saving escape hatch.

### 2. §1.2 / §1.4 — The primary question overpromises on "reduce" before knowing the base rate
**Issue:** The primary question asks whether executable scenarios "reduce accumulated-surface regression events" — but the §9 exposure precondition and §11.4 ceiling branch reveal the design only works if control regressions are *common but not universal*. If p̂_C ≥ 0.75, the binary primary dies and we switch to event counts. The question's wording ("reduce") assumes a binary-incidence world; the ceiling branch admits that world may not exist.

**Why it matters:** The claim template (§1.4) adapts ("did/did not reduce"), but the *research question* in §1.2 does not. A hostile reader quotes §1.2 against the eventual Wilcoxon analysis: *"You said 'reduce' — that's incidence language, but you analyzed counts. Which is it?"*

**Required change:** Rewrite §1.2 to name both possible primaries explicitly: "does supplying executable acceptance scenarios (a) reduce the incidence of, or (b) reduce the count of, accumulated-surface regression events..." with the parenthetical "(primary form determined by freeze-of-N, §11.4)." The question must not pre-commit to a metric that may be inoperative.

### 3. §4 / §1.4 — The TDAD caveat is buried; the "matched ritual" comparator is invisible to the audience
**Issue:** The plan correctly notes (§4) that the control arm's prose-review ritual may sit *below* an ambient baseline where agents simply code without any spec review at all. The claim template names the "matched review ritual" comparator, but this is **linguistic defense, not audience education**. On LinkedIn, the headline will be stripped of comparator nuance by resharing.

**Why it matters:** The strongest honest headline this plan can produce is: *"Under a matched review ritual, executable feedback cut regressions X% vs identical prose"* — but the practical question for a CTO is whether adding executable feedback to their *existing* workflow (which may not include prose review rituals) helps. The plan never quantifies the ritual's own effect (the C1-vs-C-final curve is required but not given a claim role).

**Required change:** In §1.4, add a **practical translation paragraph** that must appear in any public write-up: "This result compares executable feedback to an identical prose-review ritual, not to 'no ritual.' The C-attempt-1 vs C-final curve (§4) estimates the ritual's own effect; readers should not assume the executable benefit transfers to workflows without structured review." Make this mandatory boilerplate, not optional context.

### 4. §6.2 — The guard metric's "10 pp below" is asymmetrically weak
**Issue:** The new-requirement guard allows T to lose up to 10 percentage points of new-feature progress vs C. In a small-N paired design, 10pp is a large tolerance — it could absorb a genuine capability regression in the treatment arm (e.g., the agent overfits to passing visible tests and misses edge cases in new features).

**Why it matters:** The guard is supposed to prevent "the treatment wins on regressions by breaking fewer promises because it makes fewer promises." But 10pp is loose enough that T could make materially fewer promises and still pass. The asymmetry — regressions are binary (any = bad), new features are proportional (10pp slack) — biases the composite toward treatment-favoring outcomes.

**Required change:** Tighten the guard to **5pp** OR add a **secondary guard**: no chain where T's new-feature pass rate is > 15pp below C's (preventing catastrophic per-chain drops that the mean smooths over). The 10pp figure appears arbitrary; justify it or tighten it.

### 5. §1.3 / §11.2 — The parent paper is framed as "directional prior only" but its effect sizes haunt the power table
**Issue:** §1.3 correctly retires parent effect sizes as comparison targets, but §11.2's honesty statement says power at the "parent-sized effect" is only 0.65–0.70 — which **keeps the parent's effect size alive as the implicit benchmark for what constitutes a meaningful result**. The MDE table (§11.1) starts at 25pp, well below the parent's ~31pp gate effect.

**Why it matters:** Readers will infer: "They powered for 30–40pp because that's what they expect; the parent did 31pp; this is a conceptual extension." The framing creates an expectation anchor even while disclaiming it.

**Required change:** In §11.2, **remove the "parent-sized effect" power sentence entirely**. Replace with: "No prior effect size is assumed. The MDE is set by corpus scarcity and budget, not by expectation. A 30–40pp effect is the minimum detectable; smaller effects are genuinely undetectable and will be reported as null." Starve the expectation anchor.

### 6. §8 / §11.2 — The authored-chain fraction (10/33 ≈ 30%) is large enough to threaten external validity
**Issue:** Nearly a third of the confirmatory sample may be authored chains with zero measured base-rate evidence. The R10 admission heuristic is a difficulty proxy, not a validation. The §11.2 honesty statement discloses this, but the claim rule (§6.2) does not require the provenance sensitivity to **bind** — it only says a null driven by authored chains is reported as such.

**Why it matters:** If the effect is driven by native chains but authored chains are null, the "weaker reading" rule reports both — but the headline still says "reduced regressions" without stratification. A hostile commenter asks: *"Did it work on the real benchmark or only on your authored additions?"*

**Required change:** Add a **provenance-gated claim rule**: a positive unscoped claim requires the native-only sensitivity to also show treatment-favoring direction (not necessarily significant, but same sign and p < 0.20). If native chains are null or adverse, the claim auto-scopes to "on authored and native chains combined" with the native result reported prominently. Do not let authored chains carry a weak native result.

### 7. §2.3 / §10.1 — The "minimized feedback" choice has a null-scoping consequence (R13) that is underdeveloped
**Issue:** The treatment gets minimal feedback (scenario ID + pass/fail + minimal diff). The rung-2 feedback-localization check verifies this is actionable, but if it is *not* actionable, the null scopes to "under this feedback content spec." This is correct but incomplete — it doesn't say what "not actionable" means operationally.

**Why it matters:** If the agent cannot localize failures from minimized feedback, the treatment is effectively a pass/fail signal without diagnostic value. The plan should pre-commit to what happens if the localization check fails: does the feedback get enriched (violating the prereg), or does the design accept a throttled-null result?

**Required change:** In §10.1, state the **localization-failure rule**: if ≥ 2 of 4 shakedown chains show "could not localize" for induced failures, the feedback content is frozen as-is (no enrichment — that would break the prereg), but the null-scoping language is strengthened to "under minimally actionable feedback" and the rung-2 result is published as a mechanism finding. Do not leave the contingency ambiguous.

### 8. §6.3 — The mechanization rate m̂ conditions power but not the claim
**Issue:** If m̂ ≥ 0.5, the design is declared dead (§11.3) — but if m̂ = 0.4, N inflates and may exceed N_max. The mechanization rate is treated as a power/planning variable, not as a claim-relevant result. But m̂ itself is interesting: it measures how often frontier agents self-verify when not given tests.

**Why it matters:** A high m̂ (e.g., 0.35) doesn't kill the design but reveals that agents are already approximating the treatment's behavior organically. This blurs the causal contrast — the treatment isn't "executable feedback vs none," it's "executable feedback vs agent-initiated approximation."

**Required change:** In §6.3, elevate m̂ to a **reported headline figure** with interpretation guidance: "m̂ > 0.3 ⇒ the control arm is not a 'no tests' condition but an 'agent-initiated tests' condition; the causal estimand shifts toward 'maintained suite vs ad-hoc suite.'" This must appear in any public write-up when m̂ > 0.3.

### 9. §10.3 — The L2 escalation ladder is a "fig leaf" risk
**Issue:** If rung 1 is below floor, L2 authors extension checkpoints and re-runs. The r17 fix requires these pass identical QC, but the **base rate on extended chains is not measured before the extension is authored** — the extension is designed to increase event density, which is the definition of tailoring the task to the effect.

**Why it matters:** L2 is defended as "not a fig leaf" (§16.A), but it is exactly that: if the native corpus doesn't produce enough regressions, we extend chains until it does. This is not fraud — it's declared — but it is **adaptive task design**, and the resulting claim must be scoped to "on extended-format chains" not "on SlopCodeBench."

**Required change:** In §10.3, add: "If L2 is exercised, the confirmatory claim is scoped to 'on L2-extended chains under the e1-openspec-workflow-v0 profile' — never to the native corpus or to SlopCodeBench generically." The Stage-1b pre-registration must carry this scope explicitly.

### 10. §14 / §12.3 — The codex auth-mode decision at freeze-of-N creates a timing hazard
**Issue:** The codex slice auth mode (account-auth vs API-key) is decided at freeze-of-N with the R15 estimate presented. But freeze-of-N happens after rung 1 (control-only), and the codex slice requires treatment-arm runs. If account-auth is chosen for $0 marginal cost, the codex runs are serialized and quota-bound — but the plan doesn't state what happens if quota is exhausted mid-confirmatory.

**Why it matters:** A quota exhaustion that asymmetrically censors codex treatment runs creates a selection bias in the directional check (§6.2 criterion 2). The "not evaluable" escape hatch is only for discordance, not for attrition.

**Required change:** In §14 input 4, add: "If account-auth quota exhaustion threatens incomplete codex pairs, the criterion 2 evaluability rule is supplemented: < 6 evaluable codex pairs ⇒ 'not evaluable' regardless of discordance; 6–7 pairs ⇒ evaluable only if all discordant pairs favor treatment (stricter Δ < 0 rule)." Pre-commit to attrition handling, not post-hoc judgment.

### 11. §5 / §6.1 — The "chain-broken" annotation has asymmetric claim consequences
**Issue:** Chain-broken events (agent code fails import/entrypoint) count all active checks as failed — a severe penalty. But the sensitivity excluding chain-broken-only events is claim-relevant under R7. This creates an asymmetry: chain-broken events can only hurt the treatment in the primary (they inflate regression counts), but excluding them is a "weaker reading" that may rescue a null.

**Why it matters:** The treatment arm, with its on-demand runner, may produce more runnable code (fewer chain-broken events) simply because the runner catches syntax/entrypoint errors early. If so, the primary is biased *toward* treatment by the chain-broken rule, and the sensitivity that excludes them is actually the fairer comparison.

**Required change:** In §5, add a **directional hypothesis for chain-broken events**: if T's chain-broken rate is materially lower than C's (pre-registered: > 5pp difference), the primary interpretation must acknowledge that the binary primary may be inflated by T's superior runnability, and the chain-broken-excluded sensitivity is reported as the **preferred estimate** for the behavioral-regression question. Do not let the sensitivity be relegated to "weaker reading" status when it may be the cleaner estimand.

### 12. §16 O1 — The author-model overlap disclosure is insufficiently protective
**Issue:** §16 O1 discloses that authoring is Claude-assisted and the subject agent is Claude-fable-5, creating potential differential legibility. The disclosure is honest but passive — it doesn't state what the program does to mitigate.

**Why it matters:** If Claude-authored phrasing is differentially legible to Claude agents, the treatment arm (which receives structured Gherkin that Claude may parse more reliably than prose) may have an artificial advantage unrelated to executability. This is a construct-validity threat, not just a limitation.

**Required change:** In §16 O1, add a **mitigation check**: the rung-2 shakedown includes a **legibility probe** — 2 chains where the scenario prose is rewritten by a different model (e.g., GPT-5.5 or human) while preserving semantic content; if the treatment effect is materially larger on Claude-authored chains, the claim scopes to "on Claude-authored spec content." This is cheap and directly addresses the threat.

---

## C. INSISTED REQUIREMENTS

**IR-1. Scope-worthiness threshold for auto-scoped claims (§6.2.1b):** Add the pre-registered rule that the auto-scoped "literal promises on the checked surface" claim is only publishable as positive if covered fraction < 0.90 AND covered-slice effect ≥ 20pp. Otherwise, the result routes to the null-framing path. I will not sign off on a plan where the auto-scope can launder a weak result into a face-saving headline.

**IR-2. Provenance-gated claim rule (§6.2 / §13.3):** A positive unscoped claim requires the native-only sensitivity to show treatment-favoring direction (same sign, p < 0.20). If native chains are null or adverse, the claim auto-scopes to the combined sample with native results reported prominently. I will not sign off on authored chains carrying a weak or null native result into a general claim.

**IR-3. Mandatory practical-translation boilerplate (§1.4):** Any public write-up must include the paragraph: "This result compares executable feedback to an identical prose-review ritual, not to 'no ritual.' The C-attempt-1 vs C-final curve estimates the ritual's own effect; readers should not assume the executable benefit transfers to workflows without structured review." This must be in the pre-registration as a binding output requirement, not just a framing note.

---

## D. TOP 3 RISKS

1. **The auto-scope mechanism (§6.2.1b) becomes the primary escape route:** If the uncovered slice is empty or adverse at N=33 (likely, given small samples), every positive result collapses to a tautology about the visible suite — the plan produces a rigorous proof of something trivial, and the LinkedIn audience smells the nothingburger.

2. **Authored chains (30% of sample) drive a positive result while native chains are null:** The R10 heuristic is unvalidated; a native-null + authored-positive result, reported under the weaker-reading rule, still yields a headline that overclaims to the benchmark corpus.

3. **High mechanization (m̂ ≈ 0.3–0.4) renders the causal contrast ambiguous:** The control arm is not "no tests" but "agent-initiated tests"; the treatment effect becomes "maintained suite vs ad-hoc suite" — a valid result, but not the one the audience thinks they're getting when they hear "executable acceptance scenarios."

---

## E. NEW FACTUAL CLAIMS (marked [VERIFY])

- [VERIFY] The TDAD finding that instructed prose verification without execution made regressions worse (9.94% vs 6.08%) is from an L2-verified source; I am relying on the plan's citation (§4) and have not independently verified the paper or the figures.

- [VERIFY] The claim that "Claude-authored phrasing may be differentially legible to Claude agents" (§16 O1) is a theoretical possibility I have introduced; I have no empirical evidence that this legibility differential exists or that it would favor structured Gherkin over prose.

- [VERIFY] My proposed "legibility probe" mitigation (Finding 12) assumes that alternative-model rewriting of scenario prose is feasible and would preserve semantic content sufficiently to serve as a valid probe; I have not verified that such rewriting can be done without introducing confounds.

- [VERIFY] The assertion that a 10pp guard tolerance is "large" for a small-N paired design (Finding 4) is a judgment call based on general statistical intuition, not a computed property of this specific design.

- [VERIFY] The mechanization-rate threshold of m̂ > 0.3 as a headline-figure trigger (Finding 8) is my own proposed threshold; the plan's §11.3 uses 0.5 as the "design dead" threshold, and I have not justified 0.3 beyond qualitative reasoning about when ad-hoc self-verification becomes a meaningful confound.