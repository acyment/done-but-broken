A. VERDICT line  
**fix first** — the plan contains serious remaining threats to internal validity (undetected hidden-test errors outside shakedown, uncorrected time-budget asymmetry, drift-consequence ambiguity) that can be neutralized with pre‑registered additions and clarifications before freeze.

B. FINDINGS (ranked by severity)

1. **§10.1/§3.3 R6 – Hidden-test calibration errors undetected in confirmatory**  
   *Attack:* The binding‑vs‑referee agreement check (≥0.90) runs only on the 4 shakedown chains. A hidden check that is incorrectly constructed (passes golden but wrongly fails a correct agent implementation) may only surface in confirmatory chains. If it causes false regression events, the agreement rate in shakedown could still remain ≥0.90, and the error goes undetected, biasing the primary.  
   *Failure scenario:* A held‑out probe or upstream test in a confirmatory chain fails on a valid agent output that satisfies the visible scenario, but the shakedown chains lacked that exact behavior. The primary regression count is inflated or nulls are manufactured, yet no calibration failure is triggered.  
   *Change:* **Pre‑register a post‑hoc descriptive agreement analysis on all confirmatory chain‑checkpoint snapshots** (both arms, all attempts) using the same covered‑check mapping, to be reported alongside results with a commitment that systematic disagreement will be narrated as a validity limitation. This does not replace the primary but prevents an undetected silent failure.

2. **§2.4/§4 – Time‑budget asymmetry unaddressed**  
   *Attack:* Arm T’s agent may spend substantial token/time budget on invoking the on‑demand runner (executing the suite, parsing results) that is not available for implementation. C’s agent has the same total budget but no compulsory execution cost. This creates an asymmetry where T is mechanically constrained by the treatment itself, potentially reducing implementation quality and inflating regression events regardless of the feedback’s value.  
   *Failure scenario:* Under tight per‑checkpoint step limits (claude_code `step_limit: 100`), T exhausts steps running the suite and cannot finish the feature; C finishes and passes hidden checks. T then accumulates chain‑break penalties or higher regression counts purely from time starvation, manufacturing a null result.  
   *Change:* **Pre‑register** (a) the proportion of per‑checkpoint budget consumed by visible‑suite execution in T, computed from trajectories; (b) a sensitivity analysis that excludes checkpoint‑pairs where T’s suite‑execution cost exceeded X% of the budget (threshold set at freeze). The claim‑relevant weaker‑reading rule already applies to sensitivities, so this would bound the starvation threat.

3. **§3.2 R1 – Coverage map misclassification can escape audit**  
   *Attack:* The mechanical pass + 10% audit can miss hidden checks that are labelled “covered” but test behavior not asserted by any visible scenario. If such a check fails in T, it counts in the full hidden surface and may still allow a primary win (if net effect is favourable). The auto‑scoping rule only triggers on the uncovered slice, so the claim can be made without the “literal promises” caveat while falsely attributing the reduction to executable acceptance.  
   *Failure scenario:* A mis‑mapped check passes C‑final but fails T‑final. Covered Δ is still favourable overall; primary p < 0.05; uncovered slice direction is beneficial (or empty). The unscoped Level‑4 claim is published, but the treatment did not actually protect that specific behaviour because the visible scenario never covered it.  
   *Change:* **Freeze a rule** that if any single covered hidden check disagrees with its mapped visible scenario across > 1 chain in the confirmatory data, the claim automatically scopes to “the tool keeps its literal promises on the checked surface” regardless of other criteria. This creates a hard backstop without needing a new agreement threshold.

4. **§5 – Non‑runnable‑artifact rule asymmetry penalises T more heavily**  
   *Attack:* When an agent snapshot fails collection/import/entrypoint, all previously‑passed hidden checks are counted as failed. T, under the design’s own hypothesis, implements more features earlier and therefore accumulates more regression‑eligible checks. A single breakage (e.g. syntax error introduced while responding to feedback) therefore creates a larger regression event spike in T than C, even if C’s breakage would be equally severe per promise.  
   *Failure scenario:* T breaks at checkpoint k; C does not. T has 8 eligible checks, C has 3. T’s event count jumps by 8, C’s by 0. The binary primary records a T regression event; the exposure‑normalized secondary partially mitigates, but the primary is binary. This can turn a true treatment benefit into a null or even a reversal.  
   *Change:* This is partly covered by the chain‑broken‑only exclusion sensitivity + weaker‑reading rule. **Additionally pre‑commit** to publishing the per‑arm count of chain‑broken events and the associated eligible‑check exposure, and note that if the sensitivity excluding chain‑broken‑only events flips the sign, the weaker reading will already scope the claim accordingly.

5. **§7 R4 – Interactive‑class enumeration relies on judgment; missed flaky tests under fail‑any**  
   *Attack:* The class enumeration requires identifying “any test judged similarly timing‑sensitive”. A missed flaky test that remains under the general fail‑any rule can produce false regression events, especially because the 3× screen may not catch low‑frequency flakiness.  
   *Failure scenario:* An unflagged test with f=0.05 fires a false failure in T but not C (unlucky asymmetry), creating a spurious discordant pair. Over many pairs, this inflates noise. The global 2/3 majority‑vote sensitivity will mitigate, but the primary could still be degraded.  
   *Change:* **Pre‑register** that after all runs, every check that ever changed status across the three re‑evaluations of any snapshot (in either arm) will be retro‑classified as “possibly flaky” and reported in a supplementary flake‑inventory table. Not a rule change, but an accountability mechanism.

6. **§11.4/§9 – Pilot sample (8 chains) too small to anchor freeze‑of‑N for confirmatory containing authored chains**  
   *Attack:* The freeze‑of‑N uses the pilot’s measured control regression rate to set N and possibly trigger the ceiling branch. The pilot is native chains only; confirmatory includes up to 10 authored chains whose regression behaviour is unmeasured (O3). The pilot estimate has large sampling error (binomial CI on 8 chains). Using it to decide N risks an underpowered confirmatory or a premature ceiling‑branch switch that reduces sensitivity.  
   *Failure scenario:* Pilot rate = 0.5 (4/8), freeze‑of‑N sets N=33; true confirmatory rate (including authored) is 0.35, making the design far underpowered. The resulting null is then a measurement artefact.  
   *Change:* This is an accepted risk (O3), but **insist on a pre‑registered freeze‑of‑N sensitivity rule**: recompute power under the lower 80% confidence bound of the pilot rate, and if that bound falls below 0.25, the confirmatory is declared a “low‑signal regime” and the primary claim is explicitly scoped with “under the observed base‑rate estimate” and the confidence bound published. This does not block the run but narrows the claim.

7. **§2.2/§2.3 (r19) – Archive‑step drift consequence undefined**  
   *Attack:* The archive step may rewrite workspace scenario files (MODIFIED‑replace). The plan states hash checking against frozen catalog text will detect drift, but what happens when drift is detected? If the run is silently logged and continues, the treatment’s visible suite may diverge from the intended spec, breaking the arm‑parity guarantee.  
   *Failure scenario:* Workspace drift alters a scenario in T mid‑chain; the hash check logs it, but the run continues with a modified suite. T’s visible‑suite pass rate no longer reflects the frozen spec, and arm parity is broken. Any subsequent hidden‑referee result is contaminated because T worked with a different specification.  
   *Change:* **Pre‑register a hard rule:** any drift detected by the visible‑suite hash check (reference = frozen catalog text) immediately marks the *entire chain* as `spec_integrity_failed`. The chain is excluded from the primary analysis, and the number of excluded chains is reported. This is a clean symmetry‑preserving break.

8. **§6.2 – Uncovered‑slice rule can be satisfied by T avoiding uncovered features**  
   *Attack:* T could pass the uncovered‑slice directionality requirement (Δ_uncovered ≤ 0, ≥1 uncovered event across arms) not by preventing regressions but by never implementing the uncovered required behaviour, so it never becomes regression‑eligible. The guard metric (P(new passes)) checks for material new‑feature loss, but if the uncovered checks are a small fraction of all new checks, the 10 pp drop may not fire.  
   *Failure scenario:* C implements uncovered feature and later breaks it → uncovered regression event. T never passes the uncovered check (fails as new‑requirement) → no uncovered regression event in T. Δ_uncovered = −1 (beneficial). Guard passes (new‑pass drop <10 pp). Claim published as “executable acceptance reduced regressions,” but the uncovered improvement is due to omission, not protection.  
   *Change:* **Pre‑register that the uncovered‑slice rule additionally requires that T’s pass rate on uncovered new‑requirement checks at their own checkpoint is not more than X pp below C’s** (suggestion: 10 pp, mirroring the guard). This closes the avoidance loophole.

9. **§12.3/§14 (r24) – Codex auth‑mode could introduce non‑replayability**  
   *Attack:* Account‑auth `auth.json` for Codex is serialized to a single worker and handled as a secret. If the operator later wants to publicly release trajectories, the auth token cannot be included, potentially making replay impossible without third‑party trust. The write‑up will state the mode, but the replay‑validity claim (“retain full manifest…”) may be undermined for the Codex slice if the exact runtime environment isn’t re‑creatable.  
   *Failure scenario:* A skeptic claims that the Codex runs are not independently replayable because the auth token is missing, and thus the directional check cannot be verified. The plan’s replay‑validity classification could be challenged.  
   *Change:* **Explicitly declare** that Codex runs under account‑auth are classified as `replayable_with_operator_attestation` (not full replay‑valid) and that the primary claim does not depend on their full replayability. This is a scoping clarification, not a redesign.

10. **§4 – Revise turn after timeout may be insufficient**  
    *Attack:* If attempt‑1 times out (e.g. Codex 7200 s), the snapshot is taken as‑is and the revise turn runs. The agent may have produced no working code; the revise turn prompt (“review your diff…”) may be ineffective because there is nothing to review. This creates a dead‑state that persists into the final snapshot, causing a chain‑broken event.  
    *Failure scenario:* T times out after running the suite, producing a partial implementation; the revise turn cannot repair. C might not time out. T gets a chain‑broken penalty that C avoids, manufacturing a regression event for T.  
    *Change:* **Add a pre‑registered rule** that timed‑out attempt‑1 snapshots that are also non‑runnable (fail collection/import) are excluded from the primary with a sensitivity that includes them, and the event‑type decomposition will separately report regression events arising from timeout‑induced breakage. This keeps the ITT primary intact while allowing a transparent decomposition.

11. **§8 – Authored‑chain admission heuristic (dependency density) may not capture regression proneness**  
    *Attack:* The heuristic ensures cross‑checkpoint dependency density ≥ native median, but regression proneness could also depend on spec ambiguity, complexity, or novelty. Authored chains might systematically have higher/lower regression rates independent of dependency, and the pilot does not measure them.  
    *Failure scenario:* Authored chains are event‑dead (few regressions) despite high dependency density; they dominate the sample and drag the overall Δ toward null.  
    *Change:* The provenance sensitivity + weaker‑reading rule already cover this. **Insist that the provenance‑split result is reported as a headline secondary** (not buried in an appendix) with explicit labelling if the authored subset shows a materially different effect.

12. **§7 – Flake screen 3× agreement for general class does not rule out intermittent failures at lower frequency**  
    *Attack:* As the plan’s arithmetic shows, a test with f=0.05 can pass a 3× screen with 0.95³ ≈ 0.857 probability. In a pool of hundreds of checks, several such tests may survive. They can then fire false failures in‑run.  
    *Failure scenario:* A general‑class test with f=0.03 fails on one of the three evaluation runs in T at checkpoint k, creating a regression event. The pattern is asymmetric noise that adds variance, diluting the treatment effect.  
    *Change:* **Pre‑register the per‑chain count of checks that ever changed status across any snapshot’s 3 runs, and include it as a covariate in the GLMM companion estimate.** This does not alter the primary but provides a diagnostic for residual instability.

13. **§5 – “Regression‑eligible” rule prevents T from being penalised for implementing earlier, but the definition of “active” and lifecycle metadata could misclassify supersessions**  
    *Attack:* Lifecycle metadata is authored during corpus QC by auditing specs for genuine supersessions. Ambiguous wording in specs could lead to a check being incorrectly marked as active when the new checkpoint spec implicitly replaces it, causing a valid change to be scored as a regression.  
    *Failure scenario:* A check is labelled active, but the agent correctly interprets the new spec as superseding the old behaviour. The hidden test fails, creating a false regression event for both arms, but T might have more such events because it more aggressively implements the new spec.  
    *Change:* **Freeze an audit of a random sample of lifecycle decisions (similar to the coverage‑map audit) and publish the disagreement rate.** If >10% of audited decisions are questionable, the primary is accompanied by a sensitivity using a conservative (retired‑at‑earlier) lifecycle rule.

14. **§12.5 – Replay‑validity rule may be violated by intermediate outputs that exceed storage/retention**  
    *Attack:* The plan requires full agent‑native trajectories, all attempt snapshots, 3× referee JSONs, usage telemetry, etc., for every run. A single large artifact (e.g., a massive log) or storage failure could make a run non‑replay‑valid, and the plan excludes it from headline claims. If failures correlate with arm (e.g., T’s suite runs produce larger logs), systematic exclusion bias could arise.  
    *Failure scenario:* T’s on‑demand runner produces large outputs that cause a run to exceed storage quotas; the run is dropped. C runs rarely hit this. The remaining sample is biased toward “easier” chains in T.  
    *Change:* **Pre‑register a maximum artifact size bound** and a plan for run exclusion due to storage failure to be treated as infrastructure‑caused events, with both arms excluded if either member of a pair fails. This preserves pairing.

15. **§8 – Memorization probe on 3 chains may be insufficient if model cutoff post‑dates corpus**  
    *Attack:* If the operator chooses a model whose training cutoff is after 2026‑05‑16, the probe must scale up to every admitted chain, but the plan says “or the 3‑chain sample must be explicitly justified as corpus‑level inference.” The justification could be weak, and full‑chain probing may be infeasible (cost).  
    *Failure scenario:* A model with late cutoff is used; probe on 3 chains is clean by chance, but contamination exists in other chains, biasing the null (both arms benefit equally). The pilot base rate would be artificially low, possibly aborting a real effect.  
    *Change:* **Remove the “or explicitly justify” escape** and make full‑corpus probing mandatory if any model’s cutoff post‑dates the corpus. State that if full probing is skipped, the claim is automatically scoped to “under models with training cutoff before corpus date” and the limitation is prominent.

16. **§6.2 – Claim rule criterion 3 (new‑pass guard) uses a 10 pp absolute drop, which may be insensitive when base rates are low**  
    *Attack:* If both arms have very low new‑pass rates (e.g., C=5%, T=2%), the 3 pp difference is ≤10 pp and the guard passes, yet T lost 60% relative progress. This could allow a win claim where T sacrificed substantial new‑feature completion for regression reduction.  
    *Failure scenario:* On a difficult chain set, C passes 2 new checks, T passes 1; guard passes. Primary regression advantage is found, but T essentially failed to implement a critical feature. The “P(both)” composite will reflect it, but the claim rule does not consider that composite.  
    *Change:* **Add a supplementary guard** that the ratio T‑new‑passes / C‑new‑passes ≥ 0.5 (or similar relative threshold) when C’s absolute rate is below 10%. This prevents a hollow win without over‑constraining small absolute differences.

17. **§2.3 – The “structural absence” of test infrastructure in C is enforced by pre‑flight byte‑diff of rendered workspaces. However, the agent could install testing tools during the run (e.g., `pip install pytest`) and create its own execution infrastructure.**  
    *Attack:* This is allowed per ITT. The mechanization rate m̂ will capture it, and it’s part of the design. Not a defect, but a potential source of asymmetric behaviour: if C self‑verifies heavily and T ignores the provided runner, the ITT contrast shrinks. That’s handled by intention‑to‑treat and mechanization conditioning. No additional fix needed.

18. **§9 – Transition key “≥4 regression‑bearing transitions” could be satisfied entirely by a single chain with many regressions, while chain key fails. The two keys are AND, so it’s still safe. However, if the pilot has many transitions but regressions are concentrated in ≤2 chains, the gate aborts even though the confirmatory might see wide spread. That’s the design’s deliberate conservatism, not a bug.**

19. **§5 – Non‑runnable‑artifact rule for agent‑caused failure: “all active previously‑passed checks count as failed.” This is defined, but the plan does not specify how to handle checks that passed and then the agent deletes the relevant code, making the check no longer collectible. That’s a legitimate breakage, counted correctly.**

20. **§10.1 – Feedback‑localization check in rung‑2: the plan says “for a sample of induced failures, verify from the trajectory that the agent could and did localize…” If the agent could not, it scopes a later null. This is good, but the sample size and selection are not pre‑specified, creating experimenter degrees of freedom.**  
    *Change:* **Pre‑specify: at least 5 induced failures across the 4 chains, or all if fewer, with the selection rule (e.g., earliest failing checkpoint per chain) frozen before rung 2.**

C. INSISTED GUARDRAILS (must enter the pre‑registration or be explicitly declined with reasons on record)

1. **Post‑hoc hidden‑test agreement analysis on all confirmatory chains:** A mechanistic re‑computation of visible‑vs‑hidden agreement on covered checks for every graded snapshot, with a pre‑stated commitment to downgrade the claim to “qualified” if the confirmatory agreement rate falls below 0.85 (or another threshold). Without this, the internal‑validity of the hidden referee outside shakedown is untested.

2. **Time‑budget accounting for T’s runner overhead:** A registered sensitivity that excludes checkpoint‑pairs where T spent > X% of the step budget on test‑execution (and thus could not spend it on implementation), with the weaker‑reading rule binding. This closes the starvation‑null loophole.

3. **Uncovered‑slice “avoidance” guard:** A symmetric new‑pass rate check for uncovered checks only, ensuring T did not simply decline to implement uncovered requirements to pass the uncovered‑slice rule. If declined, the plan must record the reason and accept the risk that the win could be an artefact of selective implementation.

D. TOP 3 RISKS (QA perspective)

1. Undetected hidden‑test errors in confirmatory chains (from incomplete calibration check) could produce a false win or mask a real effect; the shakedown‑only agreement check is insufficient.
2. The treatment arm’s compulsory execution cost creates a time‑budget penalty that could manufacture a null, and the plan has no mechanism to quantify or exclude it.
3. The uncovered‑slice rule can be satisfied by deliberate non‑implementation of uncovered features, eroding the claim’s meaning, and the global new‑pass guard may not catch it if uncovered fraction is small.

E. New factual claims introduced (marked [VERIFY])

- [VERIFY] The on‑demand runner in arm T can consume a non‑trivial fraction of the per‑checkpoint step budget (e.g., >20% of 100 steps) under typical usage patterns of claude‑code. (Used in finding 2; actual fraction must be measured in shakedown or pilot.)
- [VERIFY] The interactive‑session fixture test observed in the determinism probe (`pwd_manager checkpoint_2-Regression`) had an observed flake probability f ≈ 1/3, as stated in §7 of the plan; this number is used only for leakage arithmetic and is already in the plan, not new. No other new claims.