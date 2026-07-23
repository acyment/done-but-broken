<!-- PROVENANCE (added at ingest 2026-07-23; body below is verbatim operator paste)
  model-label: chatgpt-sol56-high (operator-supplied filename label; version string as the operator saved it)
  mode: sequential (Part A answered, then Part B attack, one fresh chat)
  received: 2026-07-23 (file mtime)
  prompt: docs/e5/E5-DESIGN-DECISION-PANEL-PROMPT-v1.md (pasted verbatim between markers)
  status: lead with zero inherited credibility -- factual/citation claims must be re-verified before reliance
-->

## Part A — Experimental design

### Core design

Run a **randomized, paired, longitudinal benchmark with a hidden referee**.

Each experimental unit is one agent evolving one real repository through a six-change sequence. Every sequence is run twice under otherwise identical conditions:

* **Readable-only control:** Given/When/Then scenarios are normative prose in OpenSpec.
* **Executable treatment:** the identical scenarios are also connected to an opaque executable runner whose failures are returned to the agent.

The agent may write and run its own tests in either condition. The treatment therefore tests whether **official executable acceptance feedback adds value beyond a competent spec-driven workflow**, not whether testing beats deliberately avoiding tests.

---

## 1. Substrate and task structure

### Harness

Fork the SlopCodeBench infrastructure for:

* Docker isolation
* persistent workspaces across milestones
* native Claude Code and Codex CLI adapters
* logging, timeouts, and artifact capture

Do not use its generated-code task corpus as the sole substrate. A hostile reviewer could reasonably argue that extending agent-generated code is not representative of maintaining an existing product.

### Repositories

Use approximately **ten real, modest-sized open-source repositories**, with two independent evolution chains per repository.

Selection criteria:

* roughly 5,000–50,000 lines of maintained application code
* deterministic local build and test process
* no paid or unreliable external services
* completion possible within a bounded agent session
* observable product behavior through a stable public boundary
* primarily CLI or JSON-over-HTTP interfaces; browser workflows only where they can be made deterministic
* at least two or three implementation components behind the public surface, so changes are not trivial single-function exercises

Use several languages, but not so many that language becomes the benchmark: for example, Python, TypeScript, and Go.

The base repositories may be public, but the experimental change sequences, scenario definitions, and hidden graders should remain unpublished until the protocol is complete.

### Evolution chains

Create **20 chains of six sequential changes**.

Each change should:

* represent a plausible product requirement, not an internal refactor
* add or amend two to four Given/When/Then scenarios
* be observable through the repository’s public CLI or HTTP boundary
* require interaction with functionality introduced or modified earlier in the chain
* remain small enough that both agents normally have a reasonable chance of completing it

Avoid six orthogonal features. The experiment needs natural regression pressure: later changes should revisit shared parsing, validation, persistence, configuration, routing, or output behavior.

Include some genuine requirement evolution. For example, a later change may intentionally replace an earlier rule. The OpenSpec delta must explicitly mark the earlier scenario as amended or retired. An intentionally superseded expectation is never scored as a regression.

### Qualification before freezing

Before preregistration:

1. A human reference implementation must complete every chain.
2. All cumulative scenario checks must pass after each reference milestone.
3. A second reviewer must verify that the tests assert public behavior rather than implementation details.
4. Each change should be piloted only for solvability and infrastructure stability, not selected according to whether executability appears to help.
5. After qualification, freeze repositories, changes, scenarios, graders, prompts, tool versions, exclusion rules, and analysis code.

No task may be removed because its experimental result looks inconvenient.

### Session structure

Use a **fresh agent session for every change**, while preserving the repository containing the agent’s previous work.

This is preferable to retaining an ever-growing chat:

* OpenSpec and the repository become the persistent project memory.
* Context-window differences between Claude Code and Codex matter less.
* Every milestone starts from reproducible visible state.
* It resembles work resumed in a new coding session or by another agent invocation.

---

## 2. The two experimental groups

### Everything held constant

For a matched control-treatment pair, the agent receives exactly the same:

* starting repository state
* accumulated implementation from previous milestones in that condition
* OpenSpec specification tree
* previous accepted change deltas
* current change delta
* Given/When/Then scenario text and identifiers
* agent instructions
* model and CLI configuration
* shell, file, and repository access
* existing developer test suite
* permission to inspect, create, modify, and execute tests
* initial work budget
* final review budget
* network policy and container resources

The agents are not told that they are participating in “control” or “treatment.”

### Control: readable scenarios

The OpenSpec scenarios are normative documentation.

The ordinary OpenSpec command may validate structure, references, and syntax, but there is **no official behavioral scenario executor**. The agent is free to translate the scenarios into its own tests, inspect existing tests, or verify behavior manually.

When the agent first declares completion, it receives a standardized final-review instruction:

> Re-read all cumulative OpenSpec scenarios, inspect the implementation, run any tests you consider appropriate, and repair any remaining problems. No machine-evaluated acceptance results are available.

It then gets one bounded final review phase.

### Treatment: executable scenarios

The repository contains the identical OpenSpec files. In addition, the environment exposes an official command such as:

```text
openspec verify --acceptance
```

The implementation of this runner is outside the writable repository. The agent cannot inspect or alter its test code.

The runner:

* executes every currently active acceptance scenario
* uses only the public product boundary
* reports scenario identifiers already visible in OpenSpec
* returns pass/fail and a minimal public-boundary assertion difference
* reveals no test source, stack traces, hidden edge cases, or implementation hints

The agent may invoke it whenever it chooses.

When the agent first declares completion, the harness automatically runs the cumulative acceptance suite. The agent then receives the results and the same bounded final review phase as the control.

Even when all scenarios pass, it receives a final-review turn, so the mere presence of an additional interaction is not unique to failing treatment runs.

### Why the forced gate matters

If execution is merely available, the experiment partly measures whether the agent notices and chooses to use the tool. That is interesting, but it is not the cleanest test of whether executable feedback prevents regressions.

The primary intervention should therefore be:

> Executable scenarios are available during development and are guaranteed to run and push back once before final acceptance.

Tool-use behavior—whether agents run them proactively—should be captured as a secondary mechanism measure.

---

## 3. What the hidden referee measures

After every milestone, run an external grader in a clean environment. It must be cryptographically or operationally isolated from the agent’s workspace.

### Primary grading surface

The primary referee suite implements the **exact behavior described by the visible OpenSpec scenarios**, but the implementation remains hidden in both conditions.

This is important. The primary claim concerns preservation of specified behavior, so grading should not depend mainly on secret expectations that the treatment never had an opportunity to execute.

### Secondary transfer surface

Add a separate hidden robustness suite containing:

* equivalent inputs expressed differently
* boundary values
* alternate ordering
* state-transition combinations
* semantically equivalent CLI or HTTP interactions

These results assess whether the agent overfit to the official examples. They should be secondary, not silently folded into the primary endpoint.

### Eligible prior behavior

A scenario becomes eligible for regression scoring only when:

1. it passed the hidden referee at the end of the milestone where it became normative; and
2. it remains active under the current OpenSpec specification.

This prevents an agent from being charged with “regressing” behavior it never successfully implemented.

### Regression event

A regression occurs when an eligible prior scenario that passed earlier fails after a later change.

Measure it immediately after every milestone, not merely at the end of the chain. Otherwise a behavior that breaks at step three and is accidentally restored at step six disappears from the evidence.

### Primary endpoint

Use one simple chain-level primary endpoint:

> **Any prior-behavior regression:** whether a chain experiences at least one failure of a previously passing, still-required acceptance scenario during later milestones.

This corresponds closely to the 40–73% chain-level failure finding in the supplied literature and avoids treating hundreds of correlated test assertions as independent samples.

### Silent-breakage endpoint

Require both agents to end each milestone with a small structured declaration:

```text
STATUS: COMPLETE | BLOCKED
KNOWN_FAILURES: none | scenario identifiers
```

Then define:

> **False completion:** the agent reports `COMPLETE` while the hidden referee finds at least one eligible prior behavior failing.

This is the most direct operationalization of silent breakage. It should be a confirmatory secondary endpoint because it depends partly on how agents phrase or classify their own completion.

### Other prespecified outcomes

Report:

* number of regression episodes per chain
* duration of each regression before restoration
* final cumulative scenario pass rate
* new-requirement pass rate at the milestone where each scenario is introduced
* robustness-suite results
* `BLOCKED` rate
* proactive official-runner usage
* agent-authored test count and execution
* tool calls, wall-clock time, and available token or usage measures
* failures remaining after the initial implementation but repaired by the final review phase

New-requirement success is a required guardrail. A workflow that “prevents regressions” by causing agents to stop implementing new behavior is not an improvement.

---

## 4. Randomization and execution

For each:

```text
chain × agent × replicate
```

create one matched pair consisting of a control episode and a treatment episode.

The two episodes start independently from the same frozen base commit. They never share generated code.

Randomize:

* which condition runs first
* repository order
* agent order
* replicate order

Run matched conditions close together in time and interleave vendors throughout the experiment. Subscription-hosted models can change without a clean snapshot identifier, so running all controls first and all treatments later would be unacceptable.

Record:

* reported model identifier
* agent CLI version
* system and harness versions
* timestamp
* subscription tier
* context and reasoning settings
* any observed vendor-side model migration

Infrastructure failures should follow frozen rules. For example, a container crash before the agent meaningfully acts may be rerun; an agent-induced build failure or timeout remains an experimental outcome.

---

## 5. Sample size and power

### Preferred design

Use:

* **20 six-change chains**
* **2 agents**
* **2 independent repetitions**
* **2 conditions**

That produces:

* 80 matched control-treatment pairs
* 160 complete evolution episodes
* 960 agent milestone sessions

The matched pair, not the individual scenario or milestone, is the unit for the primary analysis.

### Power argument

The strongest supplied verification result is approximately a **30.7-percentage-point absolute reduction** in regression-affected chains, from 43.2% to 12.5%.

It would be unwise to power a frontier, repository-scale experiment only for that very large effect. A more conservative target is an approximately **20-point absolute reduction** in the chain-level regression rate.

Under a two-sided McNemar comparison at α = 0.05, 80 matched pairs provide roughly 80% or somewhat better power for a 20-point difference when around one-third of pairs are discordant. They provide very high power for an effect near 30 points.

They are not adequately powered for a TDAD-sized four-point absolute effect. That limitation should be stated before the runs: a narrow confidence interval around zero would be informative, but an imprecise null would not establish equivalence.

A lower-budget design of 16 chains would produce 64 matched pairs and would primarily detect effects around 22 points or larger. I would prefer reducing repetitions only after exhausting ways to retain both agents and broad chain coverage.

### Statistical analysis

For the primary endpoint:

* report the paired absolute risk difference
* provide a 95% confidence interval
* use an exact McNemar or paired randomization test
* show every chain’s paired result

Also report estimates separately for Claude Code and Codex CLI. A pooled result that is driven entirely by one agent should not support an unqualified claim about coding agents generally.

A defensible preregistered claim rule would require:

1. the pooled treatment effect to reduce regression;
2. the 95% interval to exclude no improvement;
3. the point estimate to be beneficial for both agents;
4. no material loss in new-requirement success.

Turn-level mixed-effects models may be useful secondary analyses, with condition, agent, and milestone as fixed effects and repository or chain as grouping factors. They should not replace the simpler paired primary analysis or manufacture power through pseudo-replication.

---

## 6. Biggest validity threat

The largest internal-validity threat is **information and interaction leakage**:

> The executable group might succeed not because scenarios are executable, but because test code, detailed diagnostics, or an extra repair opportunity gives it additional semantic information.

Neutralize this aggressively:

* identical visible scenario text in both conditions
* no treatment test source in the repository
* opaque runner outside the writable workspace
* feedback limited to visible scenario ID, pass/fail, and public observed-versus-expected behavior
* no hidden robustness-test feedback
* identical initial and final-review budgets
* a final-review interaction in both conditions
* both groups permitted to create and execute their own tests
* actual test-writing behavior logged rather than prohibited

Under this design, the remaining causal difference is narrow and honest:

> One condition receives authoritative machine feedback about whether the visible acceptance examples currently hold; the other must reason from or independently operationalize the same examples.

That is the intervention practitioners care about.

### Other serious threats

**Model drift:** mitigate through interleaved adjacent matched runs and version recording.

**Benchmark contamination:** use new unpublished change sequences and hidden graders.

**Task-author bias:** require independent public-boundary review and prohibit exclusions after condition results exist.

**Flaky grading:** eliminate network dependencies, run deterministic seeds, and repeatedly validate the frozen referee before launch.

**Agent-generated tests narrowing the contrast:** do not suppress this. It is part of a realistic control workflow and makes a positive treatment result stronger.

**Deliberately regression-heavy chains:** publish the complete construction rubric and all chains. Report absolute rates rather than implying that the benchmark represents the natural frequency of all software work.

---

## 7. Expected cost profile

The preferred design contains 960 milestone sessions. Model expenditure should largely remain subscription-covered, but the limited vendor’s quota will probably be the pacing constraint.

The major costs are elsewhere:

* authoring and independently reviewing 120 realistic change deltas
* building hidden public-boundary graders
* producing and validating reference implementations
* running and auditing hundreds of isolated containers
* inspecting infrastructure failures
* publishing complete replay artifacts

Human benchmark construction is likely to dominate model cost.

Do not force identical actual token or wall-clock consumption between conditions. Repair effort is an outcome of the workflow. Instead:

* give both conditions identical maximum budgets;
* report actual usage and completion time;
* present regression reduction alongside the incremental verification cost.

The most useful practitioner result is not merely “treatment passed more.” It is something like:

> Executable acceptance feedback reduced chains with regressions from X% to Y%, cost a median Z% more agent time, and did—or did not—affect implementation of new requirements.

That supports a tooling decision rather than only an academic effect claim.

===== PART B ===== 

## Bottom line

Your Stage-1 plan can produce a credible **mechanism result**, but the current version does not isolate “executable specifications” cleanly enough.

The largest problem is not toy-task realism. It is that Group T currently receives a bundle of advantages:

1. direct feedback from the evaluated suite;
2. extra inference;
3. targeted repair;
4. oracle-based selection between two patches.

A positive result would establish that this **verification-gate package** works. It would not establish which component worked, nor that executability rather than extra compute or best-of-two selection caused the improvement.

The strongest revision is:

> Let both groups test freely and receive an equal review turn. Give only Group T authoritative acceptance results. Always grade the final revision; do not use oracle-guided rollback in the primary comparison. Preserve both snapshots so the published-gate policy can be analyzed separately.

Also, split the evaluation into the exact runnable acceptance surface and an independently implemented hidden surface. Without that split, the most damaging summary is: “The group that saw the grader did better on the grader.”

---

# 1. VALIDITY AUDIT

## Ranked threats

### 1. The treatment suite is also part of the referee

**Severity: critical.**

In Group T, the accumulated scenario suite runs, failures are reported, and the agent repairs against it. Your hidden referee then runs that same suite again.

That portion of the referee is not hidden from Group T in any meaningful causal sense. The source may be hidden, but its judgments have already been disclosed.

This does not make the result meaningless. Running normative checks and repairing failures is exactly what executable specifications are supposed to enable. But it sharply constrains the claim:

* A win on those checks shows improved compliance with the checks that ran.
* It does not by itself show reduced breakage on behavior not directly exercised by those checks.
* Calling the repeated suite a “hidden referee” invites an avoidable attack.

### Fix

Divide the grading surfaces explicitly:

| Surface                              | Group C sees results? | Group T sees results? | Purpose                                                   |
| ------------------------------------ | --------------------: | --------------------: | --------------------------------------------------------- |
| **V: official acceptance suite**     |                    No |                   Yes | Direct effect on executable promises                      |
| **H1: independent semantic referee** |                    No |                    No | Independent implementation of the same normative behavior |
| **H2: robustness/checkpoint tests**  |                    No |                    No | Transfer beyond the exact executable examples             |

For H1, independently implement the scenario semantics rather than invoking the exact same test functions. Change fixtures, names, invocation ordering, temporary paths, and equivalent representations while staying within the visible requirement.

For H2, preserve SlopCodeBench’s own checkpoint tests and clearly label them as hidden robustness coverage—not “accumulated promises” unless their requirements really appear in OpenSpec.

A strong positive result would be:

* a large improvement on V;
* a meaningful improvement on H1;
* no degradation, or an improvement, on H2.

If the effect appears only on V, the honest conclusion is:

> Executable feedback improved compliance with the scenarios it directly checked, but we did not find evidence of broader transfer.

That is still publishable, but narrower.

---

### 2. Feedback, extra compute, and oracle selection are confounded

**Severity: critical.**

The current intervention contains at least four components:

1. the suite executes;
2. the agent receives failure information;
3. the agent receives another inference opportunity;
4. the harness chooses between attempts using acceptance results.

The fourth component is especially important. “Keep the retry only if it passes at least as many checks” is not merely rollback. It is **oracle-guided model selection**. Group T gets the better of two candidates according to the outcome surface; Group C supplies one candidate.

A large effect could arise even if the feedback is useless, provided two attempts have imperfectly correlated failures and the selector reliably retains the better one.

### Should Group C get a matched retry?

**Yes, for the primary causal comparison.**

Both groups should receive:

* the same initial implementation budget;
* one additional bounded review turn;
* the same opportunity to edit or make no changes.

The messages should differ only in acceptance information:

**Control review**

> Review the cumulative OpenSpec scenarios and the current implementation. Run any checks you consider appropriate and correct any remaining problems. No authoritative acceptance results are available.

**Treatment review**

> Review the cumulative OpenSpec scenarios and the current implementation. The authoritative acceptance run produced the following results: …

Both final revisions are graded. Do not conditionally revert either group in the primary analysis.

Store the pre-review and post-review commits. This gives you:

* first-attempt comparison;
* repair-phase comparison;
* final-state comparison;
* exact measurement of what the feedback changed.

### Does the compute confound survive matched retries?

The generic “more model calls” confound largely disappears. The remaining difference is that Group T’s second attempt is informed while Group C’s is not. That is not a residual confound; it is the treatment mechanism.

However, the confound **does survive** if:

* T receives a retry only after a failure, while C does not receive an equivalent turn;
* T gets more wall-clock time, tool calls, or context;
* only T receives oracle-guided rollback;
* T can submit multiple alternatives and the gate selects among them.

### Preserve continuity with the published gate

You can retain the ported gate policy as a secondary analysis without making it the primary design.

Because you store both treatment snapshots, compute:

* **T-latest:** always use the post-feedback revision;
* **T-gate:** use the published pass-count rollback rule;
* **T-first:** use the original declaration.

The difference between T-latest and T-gate estimates the mechanical contribution of rollback within the treatment runs, without buying more model calls.

Do not describe the main comparison as executable-specification feedback if the primary reported treatment remains “feedback plus extra attempt plus oracle retention.”

---

### 3. You are testing a post-hoc gate, not necessarily executable specifications

**Severity: high.**

Your wording says the full suite runs “after each checkpoint.” If the agent cannot invoke the scenario suite during implementation, the intervention is:

> A forced post-completion verification gate with one repair opportunity.

That is close to arXiv:2607.01855, but it is not the full practitioner proposition:

> The agent is given executable acceptance scenarios that it can use incrementally while working.

Those are related but different treatments.

### Fix

Choose and preregister the estimand.

For the product-relevant version, Group T should have:

* a documented official command available during the checkpoint;
* freedom to invoke it as often as the fixed budget allows;
* a guaranteed automatic accumulated run after the first completion declaration.

Log:

* whether it ran the suite proactively;
* when it first ran it;
* how many times it ran;
* whether regressions were discovered before or only at the forced gate.

Group C receives the same ordinary OpenSpec structural commands and ordinary developer testing capabilities, but no maintained authoritative acceptance runner.

The resulting claim is:

> Supplying an authoritative executable acceptance suite, with a guaranteed final gate, improved outcomes relative to the same scenarios supplied as normative prose.

If you keep execution unavailable until completion, call the experiment a **verification-gate experiment**, not broadly an executable-specification workflow experiment.

---

### 4. The control-only escalation rule can become outcome-driven benchmark selection

**Severity: high, especially rhetorically.**

A control-only pilot is much cleaner than looking at A/B effects and modifying the benchmark. It does not automatically invalidate later randomization.

But this sentence is dangerous:

> “Rather than buy a null, lengthen chains or move to Stage 2.”

A hostile reader can paraphrase that as:

> You increased difficulty until the control failed often enough for your treatment to look useful.

Even without treatment outcomes, selecting a benchmark for a high control failure rate changes the target population. The later causal contrast may remain valid **on the selected benchmark**, but:

* the control prevalence is deliberately enriched;
* treatment effectiveness may interact with difficulty;
* natural-world regression prevalence cannot be inferred;
* a floor result at the initial scale has been relegated to “pilot” status.

### Fix

Use a finite, preregistered escalation ladder based on feasibility—not on finding a positive treatment effect.

For example:

1. Pilot 16 control-only chains of eight checkpoints.
2. If the estimated any-regression rate is below 15%, move the confirmatory benchmark to twelve checkpoints.
3. If it remains below 15%, do not keep tuning. Either:

   * proceed to Stage 2; or
   * publish that Stage 1 did not produce enough regression events for an informative treatment test.

Additional protections:

* Pilot chains cannot appear in the confirmatory sample.
* No individual chain is retained or removed based on whether it regressed.
* Only global properties such as chain length may change.
* All possible branches of the escalation rule are declared beforehand.
* The pilot result and the selected branch are published.
* The confirmatory claim explicitly targets the selected difficulty level.

A useful feasibility window would be approximately **15–70% control chains with a regression**. Below that, power collapses. Above it, the benchmark may have a severe ceiling or pathological task construction.

The phrase “rather than buy a null” should disappear from the protocol. A low-regression result is evidence about frontier agents at that scale, even when it prevents the planned A/B.

---

### 5. Restricting self-verification would create a strawman control

**Severity: high.**

The more defensible policy is:

> Allow both groups to inspect existing tests, write tests, run tests, use shell tools, and verify behavior however they choose.

Do not prohibit Group C from translating Gherkin scenarios into tests. If it does that successfully, it has partly recreated the treatment. That is not experimental contamination in the ordinary sense. It is a meaningful result:

> The marginal value of a supplied authoritative executable suite was small because the agent reliably constructed its own.

Your practitioner comparator is not “prose plus no testing.” It is:

> A competent spec-driven workflow where the agent receives structured scenarios and can create its own verification.

Forbidding self-authored tests would answer a less useful question and expose you to the charge that you disabled normal agent behavior to help the treatment.

### What the claim becomes

With self-testing allowed, the experiment estimates the **intention-to-treat effect of provision**:

> What happens when executable acceptance infrastructure is provided, compared with leaving operationalization to the agent?

That is probably the product question you actually care about.

It does not estimate:

> Executable checks versus no executable checks whatsoever.

That latter contrast is cleaner but substantially less realistic.

### Instrument the dilution

Record, by group and checkpoint:

* tests created or modified;
* test commands run;
* whether tests correspond to current or prior scenario IDs;
* whether cumulative rather than current-only tests were run;
* whether a control-authored test would detect the observed regression;
* time spent on test construction and execution.

A blinded post-run reviewer could classify control behavior into:

1. no scenario operationalization;
2. partial operationalization;
3. near-complete operationalization.

If treatment effects are concentrated where controls fail to operationalize the scenarios, that is useful mechanism evidence. Keep it secondary because the classification is post-treatment.

---

### 6. “Hidden from Group C” is defensible only if the executable artifact genuinely does not exist there

**Severity: medium to high.**

There are two very different designs:

**Artificial suppression**

* The executable suite exists in both environments.
* The harness secretly refuses to show its results to Group C.

**Provision contrast**

* Group C has Markdown scenarios but no maintained acceptance runner.
* Group T has those same scenarios plus an authoritative runner.
* Both may use ordinary tests and write new tests.

The first sounds manipulated. The second corresponds to a real organizational decision: whether to invest in executable acceptance infrastructure.

Do not say that execution is “hidden” from the control. Say:

> No first-party executable acceptance artifact is supplied in the prose-only condition.

The external referee remains hidden from both, as every benchmark grader should.

---

### 7. Your regression curves risk mixing acquisition failure with regression

**Severity: high for analysis correctness.**

A full accumulated pass-count curve does not by itself distinguish:

* a requirement never successfully implemented;
* a previously passing requirement that later broke;
* an intentionally superseded requirement;
* a hidden harness expectation never represented in OpenSpec.

You need separate risk sets.

For scenario (s), introduced at checkpoint (i):

* **Acquisition:** did (s) pass at checkpoint (i)?
* **Retention:** after it first passed, did it remain passing at subsequent checkpoints while still normative?
* **Regression:** a transition from pass to fail after acquisition.
* **Recovery:** a later transition back to pass.
* **Never implemented:** never passed after introduction.

A scenario should count as regression-eligible only after it has passed at least once.

Otherwise Group T can be penalized paradoxically for implementing more behavior early and therefore exposing more promises to future regression.

### Recommended outcomes

**Primary chain-level outcome**

> Did any previously passing, still-active H1 behavior regress during the chain?

**Secondary**

* number of regression episodes;
* scenario-retention hazard;
* checkpoints spent broken;
* final cumulative compliance;
* acquisition rate;
* first-declaration false-completion rate;
* post-review false-completion rate.

Plot at least two separate curves:

1. cumulative active-requirement pass rate;
2. survival of acquired requirements.

Do not call SlopCodeBench’s extra hidden tests “promises” unless their corresponding requirement is visible in the OpenSpec files.

---

### 8. The one-retry rule may preserve old behavior by sacrificing the new checkpoint

**Severity: medium.**

Your guard metric is necessary but should be stronger than a descriptive side metric.

Suppose the retry improves accumulated pass count from 18/20 to 19/20 by restoring an old behavior but loses the only new checkpoint behavior. The rollback rule keeps it because total checks improved.

That is not necessarily the desired product decision.

Predeclare a lexicographic or multidimensional retention rule if rollback remains:

1. do not reduce current-checkpoint success;
2. then maximize retained prior behavior;
3. then use total checks as a tie-breaker.

Better still, remove automatic retention from the primary comparison and grade both snapshots.

For the final treatment claim, define a new-requirement guardrail such as:

> The treatment must not reduce current-checkpoint task success by more than 10 percentage points.

With modest samples, do not pretend you have powered a strict noninferiority test unless you actually do. Report the paired difference and interval, and condition strong claims on there being no material negative signal.

---

### 9. Byte-identical scenario text does not guarantee equal semantic information

**Severity: medium.**

Group T can learn details from:

* assertion diffs;
* fixture values;
* scenario execution ordering;
* test granularity;
* stack traces;
* temporary filenames;
* exact parsing and normalization behavior;
* step-definition source;
* test side effects left in the workspace.

Keep feedback minimal:

* scenario ID already present in OpenSpec;
* pass/fail;
* public input and public observed-versus-expected result only where the expected result is already stated;
* no source paths, stack traces, internal function names, hidden fixture values, or assertion implementation.

Run the suite in a disposable copy or reset all test state. Otherwise Group T can inspect files, databases, caches, or logs created by the grader.

The executable bindings should be outside the writable repository. If Group T can inspect hand-written step definitions and Group C cannot, those definitions become an additional specification channel.

---

### 10. Checkpoints and tests are not independent samples

**Severity: medium statistically, high if mishandled publicly.**

Do not report hundreds of checkpoint assertions as though they were hundreds of independent observations.

The independent content unit is the chain. The randomized paired unit is approximately:

```text
chain × agent × run
```

But repeated agents on the same chain are still clustered by chain.

Use:

* paired chain-level risk differences;
* exact paired or randomization tests;
* cluster bootstrap by source chain;
* model-specific estimates;
* full per-chain plots.

Milestone and scenario-level mixed models are useful secondary analyses, not a substitute for independent chains.

Spend marginal budget on **more distinct chains before more repetitions of the same chain**.

---

### 11. Model drift and run ordering can imitate a treatment effect

**Severity: medium.**

Subscription-served models may change without a stable model hash. Run all controls first and treatments later, and a vendor update can become the treatment effect.

For each chain-agent pair:

* randomize condition order;
* run the pair close together;
* interleave agents and repositories;
* record timestamps, reported model IDs, CLI versions, reasoning settings, and subscription tier;
* freeze the CLI and harness versions;
* prevent caches or generated artifacts from crossing conditions.

Where feasible, alternate:

```text
C, T, T, C
```

rather than running long homogeneous blocks.

---

## Direct answers to your three disclosed issues

### Retry asymmetry

Group C should receive an equal review budget. Otherwise the primary result is about a gate package, not executable feedback.

A matched retry removes the generic extra-compute explanation. Oracle-guided retention remains a separate confound and should be removed from the primary comparison.

### Self-verification

Allow it in both groups. This produces the more credible real-world contrast:

> supplied authoritative executable scenarios versus agent initiative using the same prose scenarios.

A diluted or null effect under that comparator is more informative than a positive result against an artificially testing-disabled control.

### Visibility manipulation

It is dismissible when an existing official suite is merely concealed from Group C.

It is defensible when the control genuinely represents a workflow in which no maintained executable acceptance artifact has been supplied, while all normal testing capabilities remain available.

---

# 2. COMPARABILITY VS REALISM

## The continuation framing is useful, but “replication” would be misleading

Your design preserves meaningful lineage from arXiv:2607.01855:

* sequential requirement evolution;
* accumulated behavior at risk;
* a forced verification gate;
* pass/fail feedback;
* one repair phase;
* rollback logic;
* regression-affected chain metrics.

That makes the earlier study a legitimate motivation and design ancestor.

But you are changing at least four treatment-relevant dimensions:

| Dimension          | Earlier study            | Your Stage 1                   |
| ------------------ | ------------------------ | ------------------------------ |
| Models             | sub-frontier             | current frontier               |
| Interaction        | bounded task completion  | full agent CLI                 |
| Verified surface   | original-turn tests only | growing scenario suite         |
| Agent capabilities | comparatively restricted | files, shell, tests, iteration |
| Specification role | later prose requirements | cumulative OpenSpec scenarios  |
| Outcome exposure   | fixed original surface   | expanding normative surface    |

The most important change is the growing verified surface. The earlier result asks approximately:

> Does repeatedly checking original behavior prevent original-behavior regression?

Your design asks:

> Does converting every accumulated requirement into an executable contract improve preservation of the growing specification?

That is closer to your thesis, but it is not the same estimand.

## Recommended framing

Use:

> A mechanism-motivated extension of the verification-gate result to frontier coding agents, agentic CLIs, and a growing executable specification.

Or:

> A conceptual replication and boundary extension—not a direct replication.

Avoid:

* “We replicated the result at frontier scale.”
* “We continued the same experiment with stronger agents.”
* direct effect-size comparisons without strong caveats.

You may use the approximately 31-point earlier reduction to inform an optimistic power scenario. Discount it substantially for planning because:

* frontier controls may self-verify;
* agentic tools may reduce baseline regressions;
* repository state and longer contexts can change failure modes;
* the growing suite changes both detection and repair difficulty.

A reasonable planning range is:

* optimistic effect: 25–30 percentage points;
* decision-relevant effect: 15–20 points;
* small effect: under 10 points.

Stage 1 can test 15–20-point effects with enough chains. It will not credibly rule out small benefits without a much larger sample.

---

# 3. THE HOSTILE COMMENTER

## Comment 1

> “You gave the treatment group the grader, another model attempt, and an automatic best-of-two rollback. Of course it scored better. That isn’t evidence for executable specifications; it’s evidence that showing an agent its test failures and selecting the better of two submissions beats grading a single blind submission.”

### Can the current design answer it?

No. The current design can answer only:

> The bundled verification-gate policy outperformed prose-only single-attempt work.

That is useful, but materially narrower than your stated causal attribution.

### Required change

* equal review turns for both groups;
* no oracle retention in the primary comparison;
* independent hidden H1/H2 grading;
* first and final snapshots reported separately.

Retain the published rollback policy as a secondary package analysis.

---

## Comment 2

> “You tuned the benchmark until the controls broke. Calling the early runs a pilot doesn’t fix that—you explicitly say you’ll lengthen the chains rather than accept a null. Your result applies to a difficulty level selected for failure, not to normal coding work.”

### Can the current design answer it?

Only partially. Control-only adaptation avoids direct selection on the treatment effect, but it still enriches the final task population for regressions.

### Required change

* finite global escalation ladder;
* separate pilot and confirmatory task pools;
* no per-task inclusion based on observed failure;
* publish the pilot;
* stop after the final declared escalation;
* explicitly target the chosen difficulty rather than implying natural prevalence.

Also publish the result at the original scale, even when it is only a feasibility estimate.

---

## Comment 3

> “This is still SlopCodeBench with OpenSpec Markdown wrapped around it. Either you stopped the control agents from writing tests, in which case the control is a strawman, or you let them write tests, in which case you haven’t shown that executable specs matter rather than ordinary agent testing. Nothing here establishes what happens in a real repository.”

### Can the current design answer it?

Not fully.

It can answer the test-policy portion if both groups are free to self-test and you frame the estimand as the marginal value of supplied executable acceptance infrastructure.

It cannot answer the repository-scale portion. Stage 2 is necessary.

### Required change

* allow self-authored testing in both groups;
* instrument it;
* describe Stage 1 as a synthetic mechanism test;
* do not publish a general real-repository claim from Stage 1;
* preregister or at least freeze Stage 2 before making the broader tooling claim.

The wrapping is useful for workflow parity, but it does not make SlopCodeBench repository-realistic.

---

# 4. FORK VS PLUG

## Weighted decision checklist

Score each option from 0–5 on each item. Multiply by the weight. Treat the first four as veto criteria: an option that fails one should not be chosen regardless of total score.

| Rank | Decision fact                                       | Weight |
| ---: | --------------------------------------------------- | -----: |
|    1 | Grading semantics and visible/hidden separation     |     22 |
|    2 | Intervention and retry insertion points             |     18 |
|    3 | Agent-adapter fidelity and parity                   |     15 |
|    4 | Reproducibility and complete audit artifacts        |     13 |
|    5 | Checkpoint state isolation and snapshot fidelity    |     10 |
|    6 | Porting surface, coupling, and automated tests      |      8 |
|    7 | OpenSpec integration quality                        |      5 |
|    8 | Failure recovery, quotas, and scheduling            |      4 |
|    9 | Licensing, provenance, and upstream maintainability |      3 |
|   10 | Cost and usage observability                        |      2 |

### 1. Grading semantics and visible/hidden separation — 22%

Extract:

* Where are checkpoint expectations represented?
* Can accumulated tests be partitioned into V, H1, and H2?
* Are test IDs stable and mappable to OpenSpec scenario IDs?
* Can the same snapshot be graded independently by multiple suites?
* Does grading mutate the workspace?
* Is the grader genuinely outside agent visibility?
* Are current-checkpoint and prior-checkpoint failures distinguishable?
* Can pass→fail transitions be reconstructed?
* Can superseded requirements be removed from the active risk set?
* Are results deterministic under repeated execution?
* Can independently authored referee tests be added without changing agent plumbing?

**Fork advantage:** SlopCodeBench already has correct accumulated grading tightly coupled to its task format, and extracting it would risk silent semantic changes.

**Plug advantage:** Your harness already cleanly separates treatment feedback from hidden grading and stores scenario-level transitions.

### 2. Intervention and retry insertion points — 18%

Extract:

* Can you snapshot immediately before completion declaration?
* Can you intercept the first declaration reliably?
* Can both groups receive exactly one equal review turn?
* Can feedback text be condition-specific while every other prompt remains identical?
* Can treatment execution be made available during work?
* Can a forced final run occur independently of voluntary runs?
* Can both first and revised commits be retained?
* Is rollback currently entangled with test execution?
* Can the primary design disable rollback without rewriting core control flow?
* Can tool-call, wall-clock, and context budgets be equalized?

Choose the architecture where these operations are explicit protocol concepts, not patches around an assumed single-attempt lifecycle.

### 3. Agent-adapter fidelity and parity — 15%

Extract for Claude Code and Codex CLI:

* exact invocation command;
* model and reasoning configuration;
* session persistence across checkpoints;
* environment variables and authentication;
* shell and file permissions;
* timeout behavior;
* context compaction behavior;
* output parsing;
* completion detection;
* handling of tool approval prompts;
* handling of agent crashes;
* transcript completeness;
* whether one adapter has capabilities the other lacks;
* whether retries resume the same session or start a new one.

A native adapter is valuable only if it preserves natural agentic behavior. “Supports Claude Code” may mean little if it wraps the CLI in brittle completion parsing or suppresses interactive tool behavior.

### 4. Reproducibility and audit artifacts — 13%

Extract:

* immutable run manifest;
* exact base and checkpoint commits;
* prompt and OpenSpec hashes;
* Docker image digest;
* CLI versions;
* model identifiers and timestamps;
* full stdout/stderr and tool transcript;
* filesystem diff per checkpoint;
* pre-review and post-review commits;
* visible-suite output;
* hidden-suite output;
* exclusion and rerun reason;
* crash classification;
* randomization record;
* condition-order record;
* secret-redaction process.

Prefer the system that can produce a self-contained evidence bundle without manual reconstruction.

### 5. Checkpoint state isolation and snapshot fidelity — 10%

Extract:

* How is state carried between checkpoints?
* Can C and T begin from identical base commits and then diverge independently?
* Can grader-created files leak back?
* Are containers recreated or reused?
* Are language caches shared?
* Can caches differ systematically after treatment runs?
* Are databases, environment variables, clocks, and random seeds reset?
* Can a failed retry corrupt the retained snapshot?
* Is the exact submitted filesystem reconstructable?

### 6. Porting surface, coupling, and automated tests — 8%

Measure rather than estimate casually:

* modules touched to add a second condition;
* modules touched to separate visible and hidden grading;
* modules touched to change retry policy;
* number and quality of harness self-tests;
* schema stability;
* undocumented global state;
* implicit assumptions about one agent, one suite, or one attempt;
* amount of SlopCode-specific logic embedded in generic orchestration;
* amount of experiment-specific logic embedded in your current harness.

Estimate the smallest vertical prototype in each direction:

* one task;
* one checkpoint;
* one agent;
* both conditions;
* first/revised snapshots;
* V/H grading.

The prototype that preserves semantics with fewer invasive changes is more informative than raw lines of code.

### 7. OpenSpec integration quality — 5%

Extract:

* Are the OpenSpec files the canonical requirement source or generated decoration?
* Can scenario IDs remain stable across deltas?
* Can modified and retired scenarios be represented?
* Does both-group structural validation run identically?
* Can V be generated or bound from the same scenario artifact?
* Are treatment-only bindings visible to the agent?
* Is any information duplicated manually between OpenSpec and tests?
* Can divergence between scenario text and executable behavior be detected?

A thin “copy the prompt into an OpenSpec folder” layer gives workflow-brand parity but weakens the tooling thesis.

### 8. Failure recovery, quotas, and scheduling — 4%

Extract:

* resume behavior after vendor or network failure;
* maximum safe parallelism;
* subscription rate-limit handling;
* whether retries can accidentally become extra experimental attempts;
* queue fairness between conditions;
* condition interleaving support;
* cancellation and timeout semantics;
* infrastructure-failure versus agent-failure classification.

### 9. Licensing and maintenance — 3%

Extract:

* license compatibility;
* required attribution;
* ability to publish modifications;
* upstream activity;
* likelihood of useful upstream changes;
* dependency pinning;
* security implications of executing agent-written code.

### 10. Usage observability — 2%

Extract:

* token data, where available;
* wall-clock time;
* agent turns;
* shell/tool calls;
* verification invocations;
* container CPU and memory;
* retry-phase usage;
* whether subscription CLIs conceal enough usage that cross-agent cost comparisons would be misleading.

## Decision rule

My default would be:

> **Plug the SlopCodeBench problem set and grader into your existing harness unless the grader is so tightly coupled to its orchestration that porting it threatens semantic fidelity.**

Why: your experiment’s biggest risks are condition parity, retry accounting, auditability, and frozen protocol enforcement. You say those are native in your harness. Those are more central to causal credibility than reusing an execution loop.

Choose the fork only if code inspection shows all three:

1. accumulated grading cannot be extracted cleanly;
2. its agent adapters are materially more faithful than yours;
3. adding matched review turns and V/H separation requires local extensions rather than architectural surgery.

Use a weighted score, but require at least **4/5 on each veto item**. If totals differ by fewer than roughly ten weighted points, prefer your native experiment harness because the protocol is the scientific asset.

---

# 5. BETTER ALTERNATIVES

## Where Part A was stronger

The earlier design was materially stronger in four respects:

1. independent hidden grading rather than reusing the visible treatment suite;
2. equal final-review opportunity;
3. unrestricted agent self-testing;
4. real repositories and public product boundaries.

Your plan is stronger in other respects:

1. much cheaper mechanism test;
2. existing evolving-spec benchmark;
3. immediate continuity with accumulated-regression literature;
4. realistic agent CLI adapters already available;
5. a sensible staged strategy rather than attempting repository-scale work first.

The best design combines them rather than replacing Stage 1 with an expensive repository study.

---

## Recommended merged design

### Stage 0: feasibility pilot

Use 12–16 **control-only, nonconfirmatory** chains.

Predeclare:

* default chain length;
* one longer-chain fallback;
* acceptable control regression window;
* stop rule.

Do not examine treatment outcomes. Do not reuse pilot chains. Publish the pilot result and selected branch.

---

### Stage 1: controlled mechanism experiment

#### Corpus and sample

Minimum:

* 40 distinct chains;
* 2 agents;
* 2 conditions;
* 8–12 checkpoints according to the frozen pilot rule.

This gives **80 paired chain-agent episodes**.

Preferred:

* 60 distinct chains;
* 2 agents;
* 2 conditions.

This gives **120 paired episodes**.

More distinct chains are preferable to running two stochastic repetitions of 30 chains.

#### Power interpretation

The supplied toy-study effect is about 31 percentage points. Do not design only for that.

Approximate paired-design requirements depend on discordant-pair frequency:

* an effect around 30 points may need only about 25–35 pairs;
* an effect around 20 points generally needs about 65–90 pairs;
* an effect around 15 points may need roughly 85–155 pairs.

Therefore:

* 80 pairs is reasonable for a decision-relevant effect near 20 points;
* 120 pairs is a better target if 15 points would matter;
* neither design rules out small effects near 5 points.

Because the same chains are used across two agents, chain clustering makes naive pair-count power somewhat optimistic. Report cluster-robust uncertainty and do not claim strong model-specific evidence from a pooled-only effect.

#### Groups

**C — supplied prose scenarios**

* complete OpenSpec workspace;
* identical cumulative Given/When/Then text;
* normal OpenSpec structural validation;
* ordinary repository tests;
* full permission to create and run tests;
* no authoritative executable acceptance runner.

**T — supplied executable scenarios**

Everything in C, plus:

* official accumulated acceptance command;
* command available during work;
* automatic run after first completion declaration;
* minimal scenario-level results.

#### Equal review phase

After first completion declaration:

* both groups get one review phase;
* same maximum wall-clock or tool budget;
* C gets cumulative-spec review instructions;
* T gets the same instructions plus authoritative results;
* either may make no changes.

A practical division would reserve approximately **20–25% of each checkpoint budget** for the review phase, but the exact limit should be piloted and frozen.

Always grade the final state. No oracle rollback in the primary analysis.

Preserve the first state.

#### Evaluation surfaces

**V: official runnable suite**

* visible only through results in T;
* direct compliance measure.

**H1: independent scenario referee**

* same normative requirements;
* separate implementation;
* equivalent black-box setup;
* hidden from both.

**H2: benchmark robustness suite**

* SlopCodeBench checkpoint tests not duplicated by V/H1;
* hidden from both;
* explicitly distinguished from visible promises.

#### Primary outcome

> Paired difference in the probability that a chain experiences at least one final-state regression of an acquired, still-active H1 behavior.

#### Confirmatory secondary outcomes

* first-declaration H1 regression;
* final false completion;
* V regression;
* H2 regression;
* cumulative active-requirement pass rate;
* current-checkpoint task success;
* duration of regressions.

#### Guardrail

Predeclare that the main positive claim requires no material loss in acquisition of the current checkpoint.

For example:

* pooled new-requirement success difference must not be worse than −10 percentage points; and
* neither agent may show a large adverse point estimate concealed by pooling.

This is a claim rule, not necessarily a fully powered noninferiority test.

#### Claim rule

A strong Stage-1 positive claim should require:

1. pooled H1 regression reduction with an interval excluding zero;
2. beneficial point estimate for both Claude Code and Codex CLI;
3. no material reduction in new-requirement success;
4. improvement on at least one genuinely hidden surface, not V alone;
5. complete per-chain publication.

If only V improves:

> Executable acceptance feedback improved direct scenario compliance, but the benefit did not transfer to the independent hidden referee.

If only one agent improves:

> The effect was agent-dependent.

If the interval is wide and crosses zero:

> The study was inconclusive at this sample size—not evidence of equivalence.

---

### Literature-gate analysis

Store enough information to reproduce the earlier gate package as a secondary result:

* first treatment snapshot;
* revised treatment snapshot;
* visible pass counts;
* rollback-selected snapshot.

Then report:

1. equal-budget feedback effect: C-final versus T-final;
2. rollback contribution: T-final versus T-gate-selected;
3. full package: C-first versus T-gate-selected.

Only comparison 1 supports the clean “feedback under matched compute” attribution. Comparison 3 gives continuity with the published mitigation.

---

### Stage 2: repository-scale boundary test

Stage 2 should use real repositories and cumulative changes observable through a stable CLI or HTTP boundary.

It need not be large. Approximately:

* 12–20 chains;
* six changes each;
* both agents;
* matched C/T runs;

could serve as a boundary-extension study if every chain and result is published.

Stage 2 is where you earn the broader practitioner statement:

> This was not confined to synthetic checkpoint tasks.

Until then, Stage 1 should be presented as a controlled mechanism benchmark.

---

## Cost profile

For 40 chains, two agents, two conditions, and eight checkpoints:

* 80 paired episodes;
* 1,280 condition-checkpoints before review;
* up to 1,280 matched review phases.

For 60 chains:

* 120 paired episodes;
* 1,920 condition-checkpoints;
* up to 1,920 review phases.

The review phase need not be a fresh agent process; it can be a bounded continuation. But it must be equally available in both conditions.

The largest costs will probably be:

* independently implementing H1;
* auditing scenario-to-test equivalence;
* maintaining deterministic containers;
* reviewing anomalous runs;
* quota pacing for the limited vendor.

That extra grading work is more valuable than adding many repetitions to a weakly separated visible/referee suite.

---

# 6. RED-TEAM YOURSELF

The most likely way my recommendations mislead you is that I am optimizing for **component-level causal attribution** more than for the causal effect of the product you may actually intend to build.

A real verification product might deliberately bundle:

* executable scenarios;
* automatic execution;
* failure feedback;
* a repair opportunity;
* safe rollback;
* selection of the better state.

If that bundle is the product, calling rollback or the extra repair turn a “confound” can become pedantic. The practically relevant question may be:

> Does installing this complete gate improve agent work?

For that question, your original T package is legitimate. The mistake would be attributing the whole package effect specifically to scenario executability.

Similarly, forcing both controls through a blind review turn may not represent normal prose-spec work. It produces cleaner attribution but could understate the advantage of a workflow that naturally knows when another attempt is needed.

## Evidence that would change my recommendation

I would favor your simpler bundled design if:

1. the intended product and public claim are explicitly about a **verification gate package**, not executable specifications as an isolated ingredient;
2. a small three-arm pilot shows that blind review produces virtually no improvement while feedback produces a large improvement;
3. rollback is a core deployed feature rather than an experimental convenience;
4. independent H1 results track V results closely, showing that exact-suite overfitting is not driving the effect;
5. Stage 2 confirms transfer to real repository behavior.

For example, suppose a pilot found:

* prose, one attempt: 45% regression-affected chains;
* prose, blind review: 43%;
* executable feedback, final revision: 22%;
* executable feedback plus rollback: 18%.

I would conclude that extra compute explains little, feedback explains most of the effect, and rollback contributes modestly. The full package could then reasonably be the headline, with the decomposition shown underneath.

Conversely, if results were:

* prose, one attempt: 45%;
* prose, blind review: 30%;
* executable feedback, final revision: 27%;
* executable feedback plus rollback: 15%;

then most of the apparent “executable specification” effect would actually be additional deliberation and oracle selection. Your current two-group design would materially misattribute the cause.

The decisive principle is:

> Test the bundle if the claim is about the bundle. Factor the intervention if the claim assigns causality to one component.

Your present stated thesis assigns causality to executability. That requires the cleaner matched-budget design.
