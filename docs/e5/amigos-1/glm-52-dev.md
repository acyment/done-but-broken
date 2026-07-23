# Development Review: Three-Amigos Pre-Registration v2

## A. VERDICT

**Fix first.** The plan's validity-critical architecture is sound, but several load-bearing mechanisms — the scenario-to-feature-file extraction, the feedback formatter, the lifecycle-metadata authoring protocol, and freeze-of-N as an executable procedure — are underspecified to the point where a competent builder must make silent design decisions that could change the result in either direction; and the authoring pipeline, which is the dominant workload at N=33, is absent from the engineering build plan and likely does not close for one operator.

---

## B. FINDINGS

### 1. §2.3 / §3.3 — Mirrored feature-file extraction and step-definition authoring are unspecified to the point of being the experiment's load-bearing unknown

The plan states feature files are "deterministically extracted from the shared spec text" and step definitions are "frozen literal translations of the scenario prose, line-audited against it." But the text does not say: Is there a parser that converts the Gherkin blocks embedded in the OpenSpec delta spec into `.feature` files? Are step definitions hand-authored per scenario, or generated from a template? What constitutes a "literal translation" of a scenario clause into executable code — who decides the assertion strictness? The line-audit is named but not protocolized (checklist? rubric? eyeballing?).

**Wrong-build failure mode:** A builder produces step definitions that are too loose (matching any output containing expected keywords), making the visible suite trivially passing — the treatment arm gets a rubber-stamp gate, and the positive effect vanishes. Or too strict (exact-string matching where the spec intended semantic equivalence), making the suite unfairly hard — the treatment arm is penalized, producing a null. Either way the result is real but tests something different from what the pre-registration promises. This is the single point where a build guess changes the experiment's construct.

**Concrete change required:** Add a §2.3 sub-section specifying: (a) the extraction script that produces `.feature` files from the frozen Gherkin blocks (or state that feature files are hand-authored and hash-checked against the blocks); (b) the step-definition authoring protocol — for each scenario clause, what behavior the step asserts, what matching strategy is used (exact, regex, semantic), and what the expected-vs-actual boundary is; (c) the line-audit as a recorded side-by-side with a per-step checklist, not a global eyeball. Freeze the step-definition authoring guide as an artifact.

---

### 2. §4 / §2.3 — The revise-turn feedback formatter is unspecified and is part of the claim

Arm T's revise-turn feedback is "scenario ID + pass/fail + a minimal expected-vs-actual diff at the assertion boundary — no stack traces, no step-definition internals (F9 leak list)." The plan freezes this as the feedback content spec (R13: "a null is scoped under this feedback content spec"). But the text does not say: What runner output format is parsed to produce this? Is there a custom output formatter in the test runner, or does the builder parse raw pytest/behave stdout? What is "the assertion boundary" in a Gherkin step definition — the `assert` statement? The step function? The scenario? What is "minimal" — a character limit? A field list?

**Wrong-build failure mode (positive):** A builder includes too much information (full assertion expression, variable values), effectively giving arm T a stack trace in disguise — the positive result is inflated by a richer feedback channel than the one the claim describes, and the claim is overclaimed. **Wrong-build failure mode (null):** A builder includes too little (just "FAIL" with no diff), making the feedback unactionable — the null is real but scoped under a different (thinner) feedback spec than the one the plan promises, and the R13 scoping language doesn't match what actually ran. The rung-2 feedback-localization check (§10.1, R13) would catch the latter, but only if the formatter is already built by rung 2 — and the formatter's spec is what's missing.

**Concrete change required:** Specify the exact feedback schema as a JSON structure or template (fields, types, max lengths), name the runner output format it is parsed from, and freeze the parsing script. State whether the runner's native output includes anything beyond the schema that could leak (and how it's stripped).

---

### 3. §5 — Lifecycle metadata authoring is a manual judgment call with no operational protocol

"Authored during the corpus QC pass by auditing each chain's specs for genuine supersessions." Every check carries `active_from`, `retired_at`, `modified_by` — and a check incorrectly marked `retired_at < k` never counts as a regression at checkpoint k, while one incorrectly left active creates false regressions. With ~178 checkpoints × multiple checks each, even a 5% misclassification rate could flip a chain's binary regression indicator. The text does not say what counts as a "genuine supersession": if checkpoint 3 says "output should be JSON" and checkpoint 1 said "output should be plain text," is checkpoint 1's behavior retired at checkpoint 3? What if checkpoint 3 says "add JSON support" without deprecating plain text? The plan says "intended supersessions never count as regressions" (§5) — but the determination of "intended" is left to the author's judgment with no rubric.

**Wrong-build failure mode (null):** A builder over-classifies supersessions (marking checks retired whenever the spec mentions the same feature), suppressing real regressions — the null is an artifact of aggressive retirement. **Wrong-build failure mode (positive):** A builder under-classifies, counting intended spec changes as regressions in both arms — but if treatment's visible suite catches the intended change and revises it back, treatment looks better by a bug in the metadata.

**Concrete change required:** Add a per-check lifecycle decision protocol: a supersession is recorded only when (a) the checkpoint spec explicitly deprecates prior behavior (text match for "replace"/"instead of"/"no longer"), or (b) the golden solution for checkpoint k produces output that contradicts the golden solution for checkpoint j on the same input. Require a recorded rationale per retirement/modification, published in the freeze manifest. Add a TDD test: for each retired check, assert it fails on golden-k (confirming the behavior actually changed).

---

### 4. §15 — The authoring pipeline is absent from the engineering build plan and is the schedule's critical path

The build plan (§15) lists 9 engineering items, all harness mechanics. The actual content authoring — scenario blocks, step definitions, held-out probes, lifecycle metadata, coverage map, and golden solutions for 10 authored chains — is the dominant workload and appears nowhere as a scoped, estimated workstream. At N=33 with mean 5.4 checkpoints, that's ~178 checkpoints requiring authoring. The firewall (§3.3) mandates 3 separate sessions per chain (scenario/step-def, coverage map, QC screens), which is a session-management overhead, not just a content-creation cost. For the 10 authored chains, each needs a complete spec + golden solution + hidden tests + scenarios + step definitions + probes + lifecycle metadata — essentially building 10 CLI applications end-to-end.

**Wrong-build failure mode:** The operator runs out of time, cuts corners on step-definition quality or probe authoring, and the experiment runs with a degraded treatment arm or a thinned hidden surface — silently, because no quality gate catches "step definitions are shallow" or "probes don't assert interesting behavior."

**Concrete change required:** Add an authoring plan section with: (a) per-checkpoint time estimate for scenario + step-def + probe + lifecycle authoring (my estimate: 30–60 min/checkpoint with AI assistance, so ~90–180 hours for 178 checkpoints); (b) per-authored-chain estimate including golden solution (my estimate: 4–8 hours/chain, so ~40–80 hours for 10 chains); (c) a quality gate per checkpoint (step definitions must fail on B(n) and pass on golden-n — reusing the §8 discriminating-check screen); (d) a go/no-go on N=33 vs N=23 (no authoring) based on whether the authoring estimate fits the operator's calendar.

---

### 5. §11.4 — Freeze-of-N is a multi-branch human procedure with no mechanical guard

Freeze-of-N "executes exactly these pre-stated rules — nothing else may change" — but it's described as a procedure, not a script. It has 4 branches (replace p_C, ceiling branch at p̂_C ≥ 0.75, mechanization rule with N_max and m̂ ≥ 0.5 dead-end, codex cost estimate presentation). A human executing this could inadvertently change something outside the allowed set (e.g., adjust the arm-parity allowlist "while we're at it"), and nothing catches it.

**Wrong-build failure mode (either direction):** Freeze-of-N silently changes a frozen parameter (prompt template, step definition, coverage-map threshold), and the confirmatory runs under a different configuration than the one sealed. The drift is invisible because the freeze manifest is updated as part of the procedure.

**Concrete change required:** Implement freeze-of-N as an executable script that takes rung-1 outputs and the pre-freeze manifest, and produces a post-freeze manifest. Add a TDD test: `diff(pre_freeze_manifest, post_freeze_manifest)` must contain only the allowed fields (N, primary-in-force flag, codex auth mode/cap, p_C replacement). Any other change fails the script. The script itself is frozen at the same commit as the pre-registration.

---

### 6. §3.2 — Coverage map matching method is underspecified and has an operational role in the claim rule

"A mechanical first-pass (name/behavior matching of check assertions to scenario clauses)" — is this grep? Regex? Embedding similarity? LLM classification? The coverage map determines the covered/uncovered split, and §6.2 criterion 1b makes the uncovered-slice point estimate a condition for the unscoped claim. Different matching methods produce different maps, changing whether the auto-scope fires. The ≥10% audit sample (r22) is a check on the map's quality, but the map itself is built by an unspecified method.

**Wrong-build failure mode (positive):** A loose matching method (e.g., keyword overlap) over-classifies checks as covered, shrinking the uncovered slice — the uncovered-slice rule is vacuously satisfied (fewer events to be adverse), and an unscoped positive claim is available when it shouldn't be. **Wrong-build failure mode (null):** A strict method under-classifies, inflating the uncovered slice — a real treatment effect on the covered surface is auto-scoped to "literal promises" because the uncovered slice (dominated by probes the treatment was never meant to help with) is directionally adverse.

**Concrete change required:** Specify the matching method as a frozen script: e.g., "for each hidden check, extract its assertion statements; for each visible scenario, extract its Given/When/Then clauses; a check is covered if a scenario clause asserts the same public behavior on the same input/output, determined by exact assertion-string matching after normalization; unmatched checks are uncovered." Freeze the script and publish its output in the freeze manifest.

---

### 7. §2.3 / §15 item 2 — The on-demand runner's invocation interface is unspecified

"A documented on-demand runner invocable by the agent at any time while working (D10)." Is it a shell script in the workspace root? A `make` target? A Python entrypoint? How does the agent discover it — is there a prompt instruction ("run `./check-specs` to verify your work")? The arm-parity validator (§2.4) must know what's in the T-delta allowlist, and the runner + its prompt instruction are part of that allowlist. If the builder guesses wrong about the interface, the treatment effect is attenuated (runner too hard to invoke) or inflated (prompt instruction too pushy, effectively nagging the agent to verify).

**Wrong-build failure mode (null):** The runner is a script with an obscure name and no prompt instruction — the agent never discovers it, invocation rate is ~0, and the null is "treatment supplied but never used." The ITT framing saves the estimand, but the mechanism measure (runner-usage rate, §6.3) reveals the problem post-hoc, and the null is scoped under a feedback channel that was technically present but operationally absent.

**Concrete change required:** Specify: (a) the runner's invocation command and workspace location; (b) the exact prompt instruction in arm T that describes the runner (this is part of the T-delta allowlist and must be byte-frozen); (c) the runner's exit behavior (exit code mapping, output format) so the agent can interpret results.

---

### 8. §2.2 — Archive step's effect on the control arm workspace is unaddressed

The plan names archive-step hazards for arm T (MODIFIED-replace rewriting, mirrored-file interaction) and says the T-suite hash check is "defined against the frozen catalog text, never against post-archive workspace state — workspace drift from the archive step is detected and logged." But the archive step runs "identically in both arms at every checkpoint transition." In arm C, there are no mirrored feature files — but does the archive step's MODIFIED-replace behavior rewrite the accumulated scenario *prose* in C's workspace? If so, C's agent might see different accumulated scenario text than what was frozen, and the arm-parity guarantee ("byte-identical scenario text") is silently broken at the workspace level even if the frozen catalog is intact.

**Wrong-build failure mode (either direction):** The archive step rewrites scenario text in C's workspace (e.g., consolidating, reordering, or reformatting it), making it easier or harder for C's agent to review against — the control arm is testing a different spec-presentation than the one frozen, and the comparator in the claim template ("identical prose scenarios") is false.

**Concrete change required:** State explicitly what the archive step does to the workspace in each arm (I cannot verify this from the plan text — it depends on the fork's `openspec` archive behavior, which I cannot see). Add a hash check on the post-archive workspace scenario text for *both* arms (not just T's suite), and log any drift. If the archive step rewrites prose, the arm-parity validator must diff the post-archive workspace state across arms modulo the declared T-delta.

---

### 9. §7 — Interactive-class enumeration criteria are subjective and affect the flake policy per test

"Every `interactive_session`-fixture test — and any test judged similarly timing-sensitive." The first half is mechanical (fixture type — assuming I can identify it from the test code, which I cannot see). The second half is a judgment call with no stated criteria. The class membership determines whether a test is graded under fail-any (general class, 3/3 pass required) or majority-vote 2/3 (interactive class) — a test in the wrong class has a different false-event probability by an order of magnitude (§7: ~27% vs ~2.8% at f=0.10).

**Wrong-build failure mode (null):** A genuinely flaky test is misclassified as general class, fires a false regression event under fail-any, and converts a discordant pair to concordant — diluting a real treatment effect toward the null. The weaker-reading sensitivity (global majority-vote 2/3) would catch this, but only if the analysis is run.

**Concrete change required:** State concrete criteria for "similarly timing-sensitive" (e.g., "tests using `subprocess.Popen`, `time.sleep`, `socket`, `select`, or `asyncio` with timeouts") or restrict the class to the `interactive_session` fixture type only and disclose the residual risk that non-fixture timing-sensitive tests remain in the general population. The class list is published at freeze — add a statement that the criteria (not just the list) are published.

---

### 10. §12.1 — "Back-to-back" paired runs under subscription auth may not be achievable and the plan has no gap policy

"Within each chain, C and T run back-to-back in per-chain randomized order (interleaving kills provider-drift aliasing)." Under Claude Max subscription auth (the stated default), rate limits (5-hour usage windows, daily caps) may force a gap between C and T. If C runs at the end of a window and T at the start of the next, provider-side changes (silent model updates, rate-limit resets) could alias with arm order. The plan logs rate-limit events (r23) but does not state a maximum acceptable gap or a handling rule.

**Wrong-build failure mode (either direction):** A provider-side silent model update lands between C and T runs of the same chain. T benefits from a better model, producing a false positive. Or T is penalized by a rate-limit degradation, producing a false negative. The rate-limit log shows the gap but nothing prevents the pair from being counted as clean evidence.

**Concrete change required:** State the maximum acceptable wall-clock gap between paired C and T runs (e.g., 2 hours), and the handling if exceeded (flag as validity annotation; if > 24 hours, exclude the pair). Add a check: the run manifest records the timestamp of each arm's start, and the gap is a reported validity field.

---

### 11. §3.3 — Binding-vs-referee agreement check cross-system comparison logic is ambiguous

"Visible-suite verdicts and hidden-referee verdicts are compared on covered checks only (uncovered checks are disagreements by design)." The visible suite is Gherkin + step definitions; the hidden referee is pytest. The coverage map links scenarios to checks. But: can one check map to multiple scenarios? Can one scenario cover multiple checks? If so, what's the agreement logic — a check agrees if ALL its mapped scenarios pass iff the check passes? Or ANY? The ≥0.90 threshold (R6) is calibrated against a specific comparison logic; a different logic produces a different agreement rate.

**Wrong-build failure mode:** A builder uses "ANY" (a check agrees if any mapped scenario passes iff the check passes), inflating agreement above 0.90 and passing a calibration check that should have failed — step definitions with a calibration bug are admitted, and the visible suite's verdicts are unreliable for the rung-2 shakedown. The consequence (new task version, re-run) is triggered correctly only if the comparison logic matches the plan's intent.

**Concrete change required:** Specify the verdict-comparison logic: e.g., "a covered check agrees if (all scenarios mapped to it pass AND the check passes) OR (at least one mapped scenario fails AND the check fails)." Freeze the comparison script. Add a TDD test case with a multi-scenario check.

---

### 12. §4 — Snapshot consistency after timeout kill is unaddressed

The timeout parity rule (r21) says a timed-out attempt 1 receives the revise turn identically in both arms. But if the agent is killed mid-file-write (SIGKILL after timeout), the workspace may have partial files, missing imports, or half-written code. The snapshot captures this inconsistent state, and the revise turn starts from it. This is different from a voluntary exit where the agent left the workspace consistent. The plan does not say whether the kill is SIGTERM (grace period) or SIGKILL (immediate), or whether the snapshot mechanism ensures filesystem consistency.

**Wrong-build failure mode (either direction):** A timeout-killed snapshot in arm T has a half-written file; the revise turn starts from broken state; the guaranteed completion-time run fails on collection (all visible scenarios fail); the feedback is "everything broken" — which is either actionable (the agent fixes the syntax error) or overwhelming. In arm C, the same timeout produces the same broken state but no feedback. The asymmetry is real but is an artifact of the kill mechanism, not the treatment. If timeouts are more common in one arm (e.g., T spends more time because it runs the on-demand runner), this biases the result.

**Concrete change required:** State the kill mechanism (SIGTERM with grace period ≥ 30s, then SIGKILL), and add a consistency check on timeout-killed snapshots: verify that all Python files in the workspace parse without `SyntaxError` before grading. If a snapshot is inconsistent, flag it and state the handling (exclude from primary, report as event-type "infrastructure-caused" per §5).

---

### 13. §6.3 — Mechanization rate extraction depends on trajectory artifact format I cannot see

"Operationalized over the upstream trajectory artifacts; extraction script frozen with the analysis code." The builder needs to know: What do the trajectory artifacts look like (JSON logs? file diffs? command history?)? What file-path patterns identify a "test-bearing file" (`test_*.py`? `*_test.py`? `spec/`?)? What command patterns identify a "test command" (`pytest`? `python -m pytest`? `npm test`?)? The mechanization rate m̂ feeds the §11.3 mechanization rule (if m̂ ≥ 0.5, the powered design is dead) — getting m̂ wrong could kill the experiment or let it proceed when it shouldn't.

**Wrong-build failure mode (null):** The extraction script undercounts mechanization (misses `python -m pytest` because it only greps for `pytest`), m̂ is underestimated, the design proceeds when it should have been declared dead, and the null is an artifact of control-arm self-verification that the mechanization rule was supposed to catch.

**Concrete change required:** Specify the trajectory artifact format (or state that it is determined empirically from rung-1 trajectories and frozen at freeze-of-N, with the patterns stated in the freeze manifest). List the file-path patterns and command patterns. If the format is unknown at pre-registration time, state that the extraction script is built and frozen during rung 1, not after.

---

### 14. §8 — Authored-chain golden solution authoring is not scoped and may be the schedule's hidden killer

The plan allows 10 authored chains to reach N=33. Each authored chain needs a golden solution to pass the discriminating-check screen (§8: "pass on golden-n") and the flake screen (§7: "the final-checkpoint golden solution is referee-evaluated 3×"). Authoring a correct, complete golden solution for a 3–8 checkpoint CLI application is essentially building the application — this is not a documentation task, it's a development task. The plan does not estimate this.

**Wrong-build failure mode:** The operator runs out of time, produces golden solutions with bugs, the flake screen or discriminating-check screen fails, the chains are excluded, and N drops below 33 — or worse, buggy golden solutions pass the screens (because the screens are imperfect) and enter the confirmatory pool with incorrect regression baselines.

**Concrete change required:** Add a per-chain golden-solution authoring estimate (my estimate: 4–8 hours per chain with AI assistance for a 5-checkpoint CLI app, so ~40–80 hours for 10 chains). State whether this fits the operator's calendar. If not, reduce the authored fraction and accept the larger MDE (N=23, MDE ≈ 40pp), or de-scope to a pilot-only result.

---

### 15. §13.1 — GLMM companion estimate is non-trivial to implement correctly and is published alongside the claim

"A logistic GLMM at the checkpoint-transition level with chain random intercepts (cluster-robust SEs as check)." This is a mixed-effects model with specific requirements. For one operator with AI assistants, this is implementable but error-prone — convergence failures, singular fit warnings, incorrect random-effects specification. It's a companion estimate that never replaces the primary, but it's published alongside the claim and a skeptical CTO audience will read it.

**Wrong-build failure mode:** The GLMM fails to converge or produces a singular fit; the operator reports it without diagnostics; a reader notices and discounts the whole analysis. Or the GLMM is specified wrong (e.g., random slopes instead of intercepts) and produces a different direction than the primary, triggering the weaker-reading rule unnecessarily.

**Concrete change required:** Specify the software (e.g., `statsmodels.MixedLM` or R `lme4::glmer`), the exact formula (e.g., `pass ~ arm + checkpoint_index + (1|chain)`), and the convergence diagnostics to report. Add a verification step: run the GLMM on a synthetic dataset with a known effect and assert it recovers the effect within tolerance.

---

## C. INSISTED REQUIREMENTS

### 1. The authoring pipeline must enter the pre-registration as a scoped workstream with per-checkpoint estimates, session protocol, and quality gates.

The engineering build plan (§15) covers harness mechanics but not content authoring, which is the dominant workload and the schedule's critical path. Without it, the schedule implied by the plan does not close for one operator at N=33, and the validity-critical quality of step definitions and probes has no gate. **Required:** a §15 item 10 ("Authoring pipeline") with: per-checkpoint time estimate, per-authored-chain estimate (including golden solution), the session-management protocol for the §3.3 firewall, and a quality gate (step definitions fail on B(n), pass on golden-n). If the estimate exceeds the operator's calendar, the plan must state the fallback (N=23, no authoring) as the default, not the stretch option.

### 2. Freeze-of-N must be an executable script with a mechanical diff-guard, not a human procedure.

The plan says "nothing else may change" (§11.4) but provides no mechanical enforcement. A human executing 4 branches with multiple sub-decisions can inadvertently change a frozen parameter. **Required:** freeze-of-N is implemented as a script that takes rung-1 outputs + pre-freeze manifest and produces a post-freeze manifest. A TDD test asserts `diff(pre, post)` contains only allowed fields. The script is frozen at the same commit as the pre-registration. This is the single adaptation point — it must be mechanically guarded.

### 3. The feedback content schema and the step-definition authoring protocol must be specified concretely and frozen as artifacts.

These are the two places where a builder's guess changes what the experiment tests. The feedback schema is part of the claim (R13 scoping); the step-definition strictness is the construct under test. **Required:** (a) a feedback schema specification (JSON fields, types, max lengths, parsing source) as a frozen artifact; (b) a step-definition authoring guide (per-clause assertion strategy, matching method, expected-vs-actual boundary) as a frozen artifact. Both are hash-checked at freeze and listed in the compatibility boundary (§13.4).

---

## D. TOP 3 RISKS

1. **The authoring workload (scenarios + step defs + probes + lifecycle + coverage map + 10 golden solutions) does not close for one operator at N=33, and corners are cut silently because no quality gate catches shallow step definitions or thin probes.**

2. **The step-definition strictness and feedback formatter are unspecified, so the builder's guess determines whether the treatment arm tests "executable acceptance feedback" or "rubber-stamp passing" or "unfairly strict matching" — and the result is real either way but answers a different question than the one frozen.**

3. **Lifecycle metadata errors (misclassified supersessions) silently change regression event detection in both directions, and with ~178 checkpoints and no operational protocol, a 5% error rate is plausible and sufficient to flip chain-level binary outcomes at N=33.**

---

## E. NEW FACTUAL CLAIMS

1. **[VERIFY]** The plan references `claude-fable-5` as the bulk agent with a stated training cutoff of January 2026, and a problems corpus commit dated 2026-05-16. I have not verified that `claude-fable-5` is a real model, that its cutoff is January 2026, or that the corpus commit date is 2026-05-16. If any of these are wrong, the §8 memorization dating argument collapses.

2. **[VERIFY]** The plan references upstream `runner.py:689-716` for the `pass_policy: any-case` behavior and "verdict item 2" for the completion-declaration insertion point. I cannot see the fork's code and am relying on the plan's characterization. If the upstream insertion point for completion-declaration is not a clean process-exit hook, the snapshot-after-exit mechanism (§4) may require more plumbing than the plan implies.

3. **[VERIFY]** My per-checkpoint authoring time estimate of 30–60 minutes with AI assistance is based on general experience with Gherkin scenario and step-definition authoring for CLI applications, not on this specific corpus. The actual time depends on checkpoint complexity, which I cannot assess from the plan text. The operator should validate this estimate against 2–3 checkpoints before committing to N=33.

4. **[VERIFY]** My per-authored-chain estimate of 4–8 hours for golden-solution authoring assumes a 3–8 checkpoint CLI application of moderate complexity. The actual time depends on the application domain and the operator's familiarity with the problem space, which I cannot assess from the plan text.