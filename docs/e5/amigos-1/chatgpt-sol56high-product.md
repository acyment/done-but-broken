Here is the Product/Business review.

## A. VERDICT

**Fix first** — the study can produce a worthwhile, narrowly causal positive result, but its current null language, treatment naming, and product-value rules still permit conclusions materially stronger than the evidence.

## B. FINDINGS

### 1. §1.4, §6.2, §11.2, §13.1 — The null claim is presently indefensible

**Issue:** The frozen template says executable feedback “did/did not reduce” regressions. With power only for roughly 30–40 percentage-point effects, failure to reject does not establish “did not reduce.” A moderate and commercially worthwhile benefit could remain compatible with the data.

**Why it matters:** This is the most likely hostile rebuttal to a null publication: “You ran an underpowered study and converted absence of evidence into evidence of absence.” Publishing with equal visibility does not cure incorrect wording.

**Required change:** Pre-register three outcome classes:

1. **Detected benefit:** a treatment-favoring effect meeting the claim rule.
2. **Informative null:** the confidence interval excludes a pre-declared minimum worthwhile benefit.
3. **Inconclusive:** no detected benefit, but worthwhile benefits remain compatible with the interval.

Use “did not detect a reduction” for class 3. Permit “did not produce a worthwhile reduction” only for class 2. Remove bare “did not reduce” from all templates.

---

### 2. §1.1–§1.4, §2.3, §4 — The one thing not to overclaim is that this proves executable specifications, Gherkin, or BDD

**Issue:** The treatment is a bundle: maintained executable scenarios, an on-demand runner, a guaranteed completion-time execution, result-bearing feedback, and a revise turn. Several passages nevertheless shorten the intervention to “supplying executable acceptance scenarios.”

**Why it matters:** A positive result will otherwise become “BDD is proven” or “making Gherkin executable causes better code.” A null will become “executable specifications do not help.” Neither follows because the components are not separately identified.

**Required change:** Define one canonical causal label and use it in every claim-bearing section:

> “The supplied executable acceptance-feedback workflow: maintained suite, on-demand runner, guaranteed completion-time execution, and result-bearing revise turn.”

“Executable acceptance feedback” may be the short form. Explicitly prohibit causal attribution to Gherkin syntax, BDD, runner availability, feedback timing, or any single component. The present §1.4 language helps, but §1.1, §1.2 and §4 still reopen the overclaim.

---

### 3. §1.2, §6.1, §6.2, §10.3, §11.3 — “Frontier tier” claims model-class generality the study does not have

**Issue:** The primary is one bulk model. The Codex slice is small, directional and potentially “not evaluable.” Yet the question says “at frontier tier,” and abort branches are described as findings about “frontier competence” or “frontier-agent self-verification initiative.”

**Why it matters:** Readers will naturally interpret “frontier agents” as a class-level claim. “Under this model” in the final clause will not fully neutralize a broader noun phrase in the headline.

**Required change:** In all claim-bearing language, name the actual model and CLI configuration. If the Codex criterion is evaluable and agrees, the maximum generalization is “across the two tested agents,” not “at frontier tier.” Replace “frontier competence finding” with “a feasibility result for this agent, benchmark profile and difficulty range.”

---

### 4. §4, §13.2 — The mechanism decomposition is incorrectly named and contradicts the on-demand runner

**Issue:** C1 versus T1 is labeled “deterrence,” but T can execute the runner during attempt 1 and receive actionable feedback. It therefore includes any effect of voluntarily using the runner, not merely knowing executable checks exist. Similarly, the final contrast cannot be cleanly labeled “+feedback,” because feedback may already have occurred before the guaranteed run.

**Why it matters:** These labels invite unsupported mechanism claims and provide a hostile reader an obvious internal contradiction.

**Required change:** Rename the curves descriptively:

* “Attempt-1 arm contrast”
* “Final post-revise arm contrast”
* “Post-hoc keep-best counterfactual”

Mechanism interpretations may be discussed as hypotheses, conditional on runner-usage telemetry, but not placed in figure labels or presented as identified effects.

---

### 5. §3.2, §6.2 — The uncovered-slice rule is too permissive for an unscoped claim

**Issue:** An uncovered estimate of zero harm with only one uncovered event permits the unscoped Level-4 claim. That is absence of contradiction, not affirmative evidence that the effect transfers beyond behaviors represented in the supplied scenarios.

**Why it matters:** A positive result could be driven almost entirely by checks mirroring the visible suite while being marketed as general regression prevention. Skeptical CTOs will reasonably ask whether the system merely rehearsed its test.

**Required change:** Do not let “Δ_uncovered ≤ 0 with at least one event” authorize broader interpretation. Either establish a meaningful minimum uncovered evidence rule, or automatically phrase weak-uncovered-evidence results as:

> “Reduced hidden-referee regressions, with the evidence concentrated in behaviors directly represented by the supplied acceptance suite.”

The uncovered slice may prevent an overclaim; it should not manufacture permission for one.

---

### 6. §6, §11 — The plan has a minimum detectable effect, but no minimum worthwhile effect

**Issue:** Statistical detectability is treated as the principal threshold. The plan never defines how much reduction would make this workflow worth adopting, considering its additional ceremony and execution cost.

**Why it matters:** A statistically significant result is not automatically useful. Conversely, an undetected 15–20 percentage-point reduction might be valuable even though the study cannot establish it. Without a business threshold, both positive and null stories can be dressed up after the result.

**Required change:** Pre-register a **minimum worthwhile effect** independently of the power calculation. It should state the smallest improvement in regression incidence or normalized hazard that would justify further product investment at specified overhead.

The smallest result worth a strong practitioner headline is therefore not merely `p < 0.05`; it is an effect at or above that threshold, without a meaningful delivery penalty, and not dependent on a claim-relevant adverse sensitivity. Anything smaller may be a credible scientific observation but not a product-validation headline.

---

### 7. §6.3, §12, §14 — “Per dollar” is a misleading headline metric in this funding model

**Issue:** The headline table proposes regression events per dollar while most bulk execution uses a subscription described as having zero marginal API spend. This can produce meaningless, undefined or marketing-friendly comparisons while concealing wall-clock time, quota consumption and opportunity cost.

**Why it matters:** Engineering leaders do not experience subscription-bound agent execution as free. A workflow that reduces regressions while doubling runtime or exhausting quota may still be unattractive.

**Required change:** Remove “per dollar” as a universal headline metric. Report:

* additional wall-clock time,
* tokens or usage units,
* agent steps,
* runner executions,
* actual metered spend where one exists.

Permit a product-value statement only with the measured overhead attached. A regression-effect claim may still stand without an overhead gate, but “better,” “more efficient,” “worth it” and equivalent language must require a pre-declared acceptable overhead band.

---

### 8. §1.2, §6.2 — The new-feature guard does not justify “without material loss”

**Issue:** Treatment may pass the positive rule while its point estimate for new-requirement progress is as much as 10 percentage points worse. The rule does not, as written, establish that a material loss has been excluded.

**Why it matters:** A CTO may rationally prefer more regressions if the alternative substantially slows feature completion. A result that trades nine percentage points of new-feature progress for fewer regressions is a tradeoff result, not an unqualified improvement.

**Required change:** Reserve “without material loss” for evidence supporting the declared margin, not merely a point estimate inside it. Otherwise publish the exact tradeoff:

> “Regression incidence fell by X; observed new-requirement progress was Y percentage points lower/higher.”

Any broader claim that the workflow produces “better agent work” should additionally require the joint-success measure, P(both), to support that reading.

---

### 9. §10.3, §11.3 — The abort branches are being pre-marketed as substantive findings

**Issue:** A below-floor result on eight control chains is called a “frontier-competence finding.” A high mechanization estimate is called a finding about “frontier-agent self-verification initiative.”

**Why it matters:** These are feasibility and exposure results, not strong evidence of competence, effective self-verification, or treatment equivalence. High observed test activity does not establish that agent-authored verification covers the relevant promises or explains a future null.

**Required change:** Classify these publications narrowly:

* **Insufficient regression exposure under this profile**
* **High observed self-verification activity under this profile**
* **Feedback channel not sufficiently actionable under this content specification**

Ban “competence finding,” “agents already verify themselves,” and similar causal or evaluative paraphrases.

---

### 10. §1.4, §6.2 — “The tool keeps its literal promises” is both a product overclaim and a tautology

**Issue:** The fallback wording attributes the result to “the tool,” although no finished product is the randomized treatment. “Literal promises” also elevates selected scenario assertions into the complete meaning of the specification.

**Why it matters:** This is exactly the sentence a hostile commenter could quote to argue that the study was designed as product marketing. It also implies stronger semantic completeness than the checked surface provides.

**Required change:** Replace it with:

> “The supplied executable-feedback workflow reduced later failures of behaviors directly represented in its acceptance suite.”

Do not use “the tool” in causal conclusions. Product positioning belongs in a separately labeled implications section: “This result supports/does not yet support continuing investment in a tool based on this workflow.”

---

### 11. §1.3, §4, §13.2 — Parent-paper continuity remains visually hazardous

**Issue:** The prose rejects direct comparison, but the plan retains parent effect sizes, a ported gate counterfactual and lineage labels that make side-by-side comparison tempting.

**Why it matters:** A public chart or post can accidentally imply “we reproduced or improved the 43.2%→12.5% result” even when the methods and outcomes differ materially.

**Required change:** Pre-register a public-presentation prohibition: parent and current effect sizes may not share an axis, table column labelled “improvement,” or comparative sentence. The parent may establish motivation and design lineage only. Every public mention of its numbers must say they are not directly comparable to this study’s outcome.

## C. INSISTED REQUIREMENTS

1. **A three-way result and claim tree must enter the preregistration:** detected benefit, informative null that excludes a pre-declared minimum worthwhile effect, and inconclusive result. Bare “did not reduce” must be removed.

2. **The tested treatment must be named consistently as a bundled executable acceptance-feedback workflow.** The preregistration must prohibit claims that BDD, Gherkin, executable specifications generally, or any individual treatment component was proven effective or ineffective. The §4 decomposition labels must become descriptive rather than causal.

3. **A practitioner-value rule must be added:** define the minimum worthwhile effect and require every positive publication to disclose the new-feature tradeoff and operational overhead in the headline evidence. Statistical significance alone must not be presented as product validation.

## D. TOP 3 RISKS

1. **An underpowered non-significant result is published as “executable feedback does not work,” when the data only failed to detect a large effect.**

2. **A bundled workflow result is converted into a claim that BDD/Gherkin or the future tool itself has been proven.**

3. **A statistically positive regression result is marketed as better engineering performance despite being covered-surface-dominated, slower, or worse on new-feature delivery.**

## E. NEW FACTUAL CLAIMS

None. This review introduces no external factual claims requiring verification.
