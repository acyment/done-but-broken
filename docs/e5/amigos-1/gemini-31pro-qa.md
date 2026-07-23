**A. VERDICT**
**Fix first.** The plan contains critical mechanical contradictions in its timeout handling, massive API-leakage vulnerabilities in the step definitions, and a syntax-error penalty that will manufacture a saturated null result by conflating typos with logical regressions.

**B. FINDINGS**

1. **§4 (Gate/revise protocol) / §12.4 — The Timeout Impossibility (Structural)**
* **Attack:** The plan states that if Attempt 1 times out, the snapshot is taken and the "matched revise turn still runs."
* **Failure Scenario:** A timeout means the budget (time or tokens) is exhausted. If the agent hits the 7200s Codex timeout in Attempt 1, it physically cannot execute Attempt 2. If the harness grants "bonus" time/tokens for the revise turn after a timeout, it breaks the budget ceiling. If it doesn't, the revise turn crashes instantly in both arms, but T is penalized more because it couldn't even run its guaranteed test suite.
* **Fix:** Explicitly define the timeout state as terminal. If Attempt 1 times out, the chain ends, the snapshot is final, and the revise turn is skipped for that checkpoint.


2. **§2.3 / §3.3 — The API Signature Leak (Win Framing)**
* **Attack:** T gets frozen literal step definitions. C gets prose. Hidden tests require specific API signatures to pass.
* **Failure Scenario:** Prose says "Create a user." C guesses `app.create_user("Alice")`. T's step definition contains `app.add_user(name="Alice")` to bind the Gherkin to the code. T now has the exact method signature required by the hidden referee. C fails the hidden test; T passes. The experiment measured "giving the agent the answer key," not "executable feedback."
* **Fix:** Step definitions must only interact with the agent's CLI/entrypoint, NEVER internal functions/classes. If internal APIs are bound, they must be explicitly provided to C in a reference doc.


3. **§5 — The Syntax-Error Null Manufacturer (Null Framing)**
* **Attack:** "Agent-caused... all active previously-passed checks count as failed."
* **Failure Scenario:** Agent T makes a brilliant logical fix but forgets a single colon, causing a syntax error in Attempt 2. The code fails to run. Suddenly, a chain with 20 active checks logs 20 simultaneous "regression events." Code crashing is conflated with logical regression accumulation, flooding the data with noise and washing out the actual behavioral effect.
* **Fix:** Split "Chain Broken" from "Behavioral Regression" at the event level, not just as a sensitivity analysis. If a checkpoint doesn't compile, it should not trigger the binary §6.1 primary for *behavioral* regression; it must be tracked as a distinct failure mode.


4. **§3.3 — The Solo-Operator Firewall Theater (Cheating / Win Framing)**
* **Attack:** The authoring firewall relies on separating tasks by "session."
* **Failure Scenario:** As a "solo-operator research program," the operator reads the hidden tests in Session 3 (QC). The operator then discovers a bug in their OpenSpec harness or needs to tweak a scenario for a new chain. The operator cannot memory-wipe their brain. They subconsciously write the new scenario prose to perfectly align with the hidden tests they already read.
* **Fix:** Acknowledge this as an accepted, unmitigable risk of solo operation in §16, rather than pretending time-separated sessions solve human memory contamination.


5. **§6.2 — The N=1 Uncovered Slice Loophole (Win Framing)**
* **Attack:** Criterion 1b allows the unscoped causal claim to survive if the uncovered slice has "≥ 1 uncovered event observed across arms" and is directionally beneficial.
* **Failure Scenario:** Over 33 chains, there are 500 hidden check evaluations. Exactly *one* uncovered check fails in C and passes in T. Because 1 is ≥ 1, the script rubber-stamps the Level-4 causal claim that "feedback reduces regressions globally." Validating a generalization on N=1 is statistically absurd.
* **Fix:** Increase the floor. The unscoped claim requires a minimum number of events in the uncovered slice (e.g., ≥ 10 event-opportunities) to rule out noise, otherwise it auto-scopes.


6. **§5 — Supersession Metadata Gaming (Cheating)**
* **Attack:** `retired_at` lifecycle metadata is "authored during the corpus QC pass."
* **Failure Scenario:** The operator runs the pilot, sees T failing a test, and rationalizes "Well, the agent actually superseded that feature in checkpoint 4, it's not a regression." The operator retroactively tags it `retired_at: 4`. The regression vanishes.
* **Fix:** Lifecycle metadata (`active_from`, `retired_at`) MUST be frozen via hash *before* any both-arms pilot or main run data is generated, with zero post-hoc modifications allowed.


7. **§2.3 — Structural Absence of Tooling for C (Null Framing)**
* **Attack:** C is allowed to self-verify (§1.1).
* **Failure Scenario:** C decides to write a test script. However, because C has "no test infrastructure of any kind," the Docker image explicitly uninstalls `pytest` for C, but keeps it for T. C's script crashes with `ModuleNotFoundError`, burning its context window and failing the checkpoint.
* **Fix:** The underlying Docker image (e.g., Python + standard libs + pytest) must be identical. "Structural absence" must mean "we didn't supply the tests or the runner script," NOT "we nerfed your execution environment's dependencies."


8. **§4 — The Hallucination Engine in C's Revise Turn (Null Framing)**
* **Attack:** C is prompted to "review your diff against every accumulated scenario."
* **Failure Scenario:** In checkpoint 6, the agent has 15 scenarios. It is forced to stare at perfectly good code and "review" it. Because LLMs are sycophantic, C assumes there must be a bug (otherwise why was it asked to revise?), hallucinates an issue, and breaks its own working code. T doesn't do this because it gets a definitive "Tests Passed" message.
* **Fix/Accepted Risk:** This is the TDAD trap, already acknowledged. But the mitigation is weak. Accept the risk explicitly that C's baseline might be *worse* than a zero-revision agent, and state that the primary contrast measures the difference between "informed revision" and "blind forced revision", not "feedback vs baseline."


9. **§6.1 — The 74% Ceiling Trap (Null Framing)**
* **Attack:** The primary switches to event-count only if the pilot base rate is ≥ 0.75.
* **Failure Scenario:** The pilot base rate of chains with ≥ 1 regression is 0.73. The ceiling branch does *not* trigger. The main experiment runs. Because chains are long (mean 5.4), almost every chain eventually has at least one minor regression. Both arms score ~90% on the binary metric. The experiment is hopelessly underpowered to detect a difference, manufacturing a null.
* **Fix:** Lower the ceiling branch threshold to 0.50, or default to the paired regression-event count as the primary metric globally. Binary "at least one" is mathematically hostile to long chains.


10. **§2.2 — Archive Step Regex Drift (Edge Case)**
* **Attack:** The OpenSpec archive step modifies workspace text.
* **Failure Scenario:** In T, the agent writes code that accidentally matches a regex in the OpenSpec archive script. The script mangles the Gherkin feature file. The T-suite hash check flags a divergence and logs it, but the T-agent is now running against broken, syntax-invalid Gherkin. T fails artifactually.
* **Fix:** If workspace drift is detected that breaks Gherkin parsing, the checkpoint must be flagged as an infrastructure failure, not scored as a behavioral failure for T.



**C. INSISTED GUARDRAILS**

1. **API Firewall:** Step definitions must interact with the application *only* via the public CLI entrypoints or HTTP boundaries, never via internal Python function calls, to prevent leaking expected structural signatures to T that C does not possess.
2. **Syntax-Error Isolation:** A checkpoint that fails with an interpreter/syntax/import error (exit code 1 on compilation) must be excluded from the behavioral regression count. It is a distinct failure mode ("chain broken"), not a mass regression event.
3. **Pre-Frozen Supersessions:** All `retired_at` and `active_from` lifecycle metadata must be hashed and frozen prior to the first both-arms run. No post-hoc reclassification of failing tests as "intended supersessions."

**D. TOP 3 RISKS**

1. Step definitions leaking internal API constraints to T, rendering the comparison fundamentally asymmetrical.
2. The binary primary metric saturating because "at least one error in 5-8 steps" is highly probable for current LLMs, destroying statistical power.
3. Attempt 1 timeouts causing impossible runtime states for the matched revise turn, leading to unequal data loss between arms.

**E. NEW FACTUAL CLAIMS**

* [VERIFY] That Claude Code and Codex CLI consume overarching budget/time constraints such that a timeout at Attempt 1 leaves literally zero budget to execute Attempt 2.
* [VERIFY] That SlopCodeBench hidden referee tests interact with internal Python functions/classes rather than purely testing through a black-box CLI interface.
* [VERIFY] That `pytest` or other standard testing utilities are present in the shared `docker-python3.12-uv.yaml` environment for both arms, rather than being actively stripped out of C's environment.