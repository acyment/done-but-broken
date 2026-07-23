<!-- PROVENANCE (added at ingest 2026-07-23; body below is verbatim operator paste)
  model-label: qwen-38-max-preview (operator-supplied filename label; version string as the operator saved it)
  mode: sequential (Part A answered, then Part B attack, one fresh chat)
  received: 2026-07-23 (file mtime)
  prompt: docs/e5/E5-DESIGN-DECISION-PANEL-PROMPT-v1.md (pasted verbatim between markers)
  status: lead with zero inherited credibility -- factual/citation claims must be re-verified before reliance
-->

## Part A — Strongest feasible controlled experiment

### 1. Causal question and estimand

**Question:**  
When a frontier coding agent evolves a working repository through multiple requirement-evolution steps, does providing the same acceptance scenarios as **executable, runnable checks** reduce silent breakage of previously working behavior compared with providing those scenarios only as **human-readable Given/When/Then text**?

**Target estimand:**  
The average causal effect of being given executable acceptance scenarios on the probability that a milestone transition introduces a hidden regression in previously passing, still-valid acceptance behavior.

**Primary claim we will allow ourselves to make, if supported:**  
In this frozen task suite, with these agent CLIs and versions, executable acceptance scenarios reduced hidden regression relative to text-only scenarios.

**Claims we will not make:**  
That this proves all AI agents, all production workflows, all specification formats, or all testing regimes behave this way. The public output will explicitly bound the claim to the experimental substrate.

---

## 2. Substrate and task structure

### 2.1 Harness

Fork and adapt the open-source MIT SlopCodeBench-style harness because it already provides:

- Dockerized isolated execution.
- Agent adapters for Claude Code and Codex CLI.
- Repository-level evolving checkpoints.
- A natural place to insert a hidden grading referee.

We add:

- An OpenSpec workflow layer.
- A read-only executable acceptance runner for the treatment arm.
- A separate hidden referee for grading.
- Immutable scenario metadata and tamper logs.
- Deterministic fixtures, frozen dependencies, disabled network, fixed clocks/seeds where possible.

All infrastructure, prompts, scenario texts, check hashes, randomization code, and analysis scripts are frozen and publicly committed before any main-run execution.

---

### 2.2 Repositories and evolution chains

Use **24 repository evolution chains**.

Each chain is:

- A small-to-medium real or realistic repository: CLI tool, HTTP API, small web app, or data-processing service.
- In a known-working baseline state `M0`.
- Covered by an initial OpenSpec specification with Given/When/Then acceptance scenarios.
- Evolved through **6 agent-implemented milestones**: `M1` through `M6`.

So each run has:

- `M0`: provided working baseline, not implemented by the agent.
- `M1`: agent implements first change delta.
- `M2`: agent implements second change delta on top of its own `M1` code.
- ...
- `M6`: agent implements sixth change delta on top of its own `M5` code.

This gives **6 milestone transitions**:

```text
M0 -> M1
M1 -> M2
M2 -> M3
M3 -> M4
M4 -> M5
M5 -> M6
```

The agent always continues from its previous commit, not from a golden solution. That is essential for the “continuous evolution” realism shown in SWE-Milestone and SlopCodeBench.

---

### 2.3 OpenSpec workflow

Both arms use the identical OpenSpec structure:

```text
openspec/
  specs/
    current.md
  changes/
    001-add-feature.md
    002-modify-behavior.md
    ...
```

Each change delta contains:

- A prose description of the change.
- New or modified acceptance scenarios in Given/When/Then form.
- Explicit scenario lifecycle metadata:
  - `adds`
  - `modifies`
  - `removes`
  - `retires`

Example scenario block:

```gherkin
Scenario: S-014-02
  Given a user has an expired session token
  When the user requests /profile
  Then the API responds with 401
  And the response body contains "session_expired"
```

The agent may read all current and prior OpenSpec documents in both arms.

The agent may not modify:

- `openspec/specs/*`
- `openspec/changes/*`
- acceptance scenario metadata
- exposed acceptance checks
- hidden referee material

Modification attempts are logged and treated as protocol violations.

---

### 2.4 Removal of non-spec automated verification

To isolate the treatment, the base repositories are stripped of pre-existing automated test suites for the target behaviors.

Both arms may still:

- Build the project.
- Run the app.
- Use lint/typecheck if already part of the repo.
- Inspect logs.
- Use normal shell tools.
- Write temporary scratch scripts.

But there are no pre-existing unit/integration tests covering the acceptance surface unless explicitly provided by the treatment arm.

This is an internal-validity choice. It makes the contrast clean: the only provided verification oracle is the executable acceptance scenario suite in the treatment arm.

We will explicitly label this as a “clean acceptance surface” experiment and discuss generalization to brownfield repos with existing tests as future work.

---

## 3. The two groups

There are exactly two arms.

### Arm A — Executable Acceptance Scenarios, EAS

The agent receives:

- The same OpenSpec markdown scenarios.
- A read-only executable acceptance runner.
- A command such as:

```bash
openspec verify --all
openspec verify --scenario S-014-02
```

The runner executes the acceptance scenarios against the current implementation and returns pass/fail output.

Example:

```text
$ openspec verify --all

PASS S-012-01
PASS S-013-01
FAIL S-014-02
  Expected: 401 with body containing "session_expired"
  Observed: 200 with profile payload

37 scenarios run
36 passed
1 failed
```

The agent can run this:

- At any time.
- On current scenarios.
- On all still-valid prior scenarios.
- Before declaring a milestone complete.

When the agent calls `openspec submit`, the harness automatically runs the exposed acceptance suite and returns the result. If failures exist, the agent may continue fixing until the milestone timebox expires, or explicitly submit with `--acknowledge-failures`, which is logged.

The exposed checks are **not** the hidden grading referee. They are a parallel, agent-visible implementation of the same scenarios.

---

### Arm B — Text-Only Acceptance Scenarios, TAS

The agent receives:

- The identical OpenSpec markdown scenarios.
- The identical change deltas.
- The identical repository.
- The identical tools, timebox, and permissions.
- No executable acceptance runner.

The agent can run:

```bash
openspec list
openspec show S-014-02
```

But:

```bash
openspec verify --all
```

returns:

```text
Acceptance runner not available in this workspace.
Acceptance scenarios are documented as Given/When/Then text in openspec/.
```

The agent may manually run the application and may write scratch scripts, but it is not provided with a scenario-to-check executor.

---

### 3.1 Exactly what differs

Everything is identical except the presence of the executable acceptance runner and its pass/fail feedback.

| Component | EAS | TAS |
|---|---:|---:|
| OpenSpec markdown scenarios | Yes | Yes |
| Given/When/Then format | Yes | Yes |
| Change deltas | Yes | Yes |
| Prior specs visible | Yes | Yes |
| Repository | Same | Same |
| Agent CLI | Same | Same |
| Model snapshot | Same | Same |
| Timebox | Same | Same |
| Tool permissions | Same | Same |
| Can run app | Yes | Yes |
| Can write scratch scripts | Yes | Yes |
| Provided executable acceptance checks | Yes | No |
| Pass/fail feedback from provided scenarios | Yes | No |
| Hidden grading referee | Never visible | Never visible |

That is the entire treatment contrast.

---

## 4. What the agent sees at each step

### 4.1 Common milestone prompt

At the start of each milestone `M_t`, both arms see:

```text
You are evolving this repository.

Milestone M_t is described in:
  openspec/changes/00t-*.md

The current specification is in:
  openspec/specs/current.md

Implement the requested change.

Behavior not explicitly changed by this milestone must continue to satisfy
the existing acceptance scenarios.

Do not modify openspec/ files.
Do not modify acceptance metadata.
Commit your changes when finished.
```

---

### 4.2 EAS-only addition

EAS agents additionally see:

```text
Executable acceptance scenarios are available.

Run:
  openspec verify --all
  openspec verify --scenario <id>

These checks are read-only and reflect the acceptance scenarios.
Use them to verify both new behavior and previously working behavior.
```

---

### 4.3 TAS-only addition

TAS agents additionally see:

```text
Acceptance scenarios are documented as Given/When/Then text in openspec/.

There is no automated acceptance runner in this workspace.
Use the written scenarios to guide implementation.
```

---

### 4.4 Milestone completion

#### EAS

When the agent runs:

```bash
openspec submit
```

the harness runs the exposed acceptance suite and returns:

```text
Submission check:
  36/37 exposed acceptance scenarios passed.
  1 failed: S-014-02

You may continue fixing before the timebox expires,
or submit with --acknowledge-failures.
```

If the agent acknowledges failures or the timebox expires, the final commit is frozen and graded later by the hidden referee.

#### TAS

When the agent runs:

```bash
openspec submit
```

the harness returns:

```text
Submission recorded.
No automated acceptance results are available in this workspace.
```

The final commit is frozen and graded later by the hidden referee.

---

## 5. Hidden grading and breakage measurement

### 5.1 Separate hidden referee

Agents never see the referee.

For every acceptance scenario, we author two executable implementations:

1. **Exposed check A**  
   Visible only in EAS.  
   Used for agent feedback.

2. **Hidden referee R**  
   Never visible to either arm.  
   Used for grading.

A and R implement the same Given/When/Then scenario, but with:

- Different fixtures.
- Different random seeds.
- Different valid input variants.
- Separate oracle code where practical.
- Different timing/order perturbations where safe.

This prevents the treatment from merely overfitting to the exact visible checks.

---

### 5.2 Validation of scenario checks

Before main runs, every scenario check is validated:

- A and R pass on a golden implementation of the intended milestone.
- A and R fail on seeded regressions that violate the scenario.
- A and R agree on scenario outcome on a pilot set of agent commits at a high threshold, e.g. >95% agreement.
- Scenarios with unstable or ambiguous checks are fixed or excluded before freeze.
- Checks must be black-box: they may observe public behavior only, not implementation internals.

The frozen scenario suite, check hashes, and validation report are published.

---

### 5.3 Regression surface

For each milestone transition `M_{t-1} -> M_t`, define:

- `Active(t)`: scenarios active under the specification at milestone `t`.
- `ValidPrior(t)`: scenarios that:
  - were active and passing at `M_{t-1}` under hidden referee R,
  - are still active at `M_t`,
  - were not explicitly retired or modified by the milestone’s change delta.

A scenario is “previously working” if it passed under R at `M_{t-1}`.

A **new hidden regression** occurs when:

```text
scenario S ∈ ValidPrior(t)
S passed at M_{t-1}
S fails at M_t
```

If `M_t` produces a non-runnable artifact, all still-valid prior scenarios are counted as failures for that transition.

---

### 5.4 Primary outcome

**Primary outcome:** transition-level hidden regression indicator.

For run `i`, milestone transition `t`:

```text
Y_it = 1 if at least one new hidden regression occurs
Y_it = 0 otherwise
```

This is analyzed with a mixed-effects logistic model:

```text
Y_it ~ arm + milestone + (1 | task) + (1 | model) + (1 | run)
```

with cluster-robust standard errors at the run level.

The primary reported quantity is the marginal risk difference:

```text
P(hidden regression | EAS) - P(hidden regression | TAS)
```

plus 95% confidence interval.

---

### 5.5 Key secondary outcomes

1. **Chain-level regression-affected run**

   A run chain is regression-affected if any transition `M0->M1` through `M5->M6` has at least one new hidden regression.

   This matches the toy-scale chain-level outcome from the literature.

2. **Scenario-level regression rate**

   Fraction of valid prior scenario instances that newly fail.

3. **Current-milestone correctness**

   Fraction of newly added or modified scenarios that pass under hidden referee R.

   This prevents interpreting regression reduction as “agent preserves old behavior but fails to implement new behavior.”

4. **Composite successful evolution**

   A transition is successful if:

   - no new hidden regression, and
   - all new/modified current-milestone scenarios pass.

5. **Silent regression in EAS**

   Fraction of hidden regressions in EAS where the exposed checks passed but the hidden referee failed.

   This measures residual silent breakage despite executable scenarios.

6. **Exposed-hidden agreement**

   How often exposed check A and hidden referee R agree.

7. **Self-authored verification in TAS**

   Number and type of scratch tests or manual checks created by TAS agents.

8. **Completion, runtime, tool calls, and cost proxies**

   To detect whether arms differ in effort or survival.

---

## 6. Randomization, blinding, and discipline

### 6.1 Randomization

Randomize at the run-chain level.

For each task and agent:

- Use permuted blocks.
- Balance EAS/TAS assignment.
- Use a fixed public random seed committed before runs.

Planned main-run scale:

- 24 tasks.
- Claude Code: 6 runs per task, balanced 3 EAS / 3 TAS.
- Codex CLI: 2 runs per task, balanced 1 EAS / 1 TAS.

Total:

```text
Claude: 24 * 6 = 144 runs
Codex:  24 * 2 =  48 runs
Total:         192 runs
```

Arm totals:

```text
EAS: 24 * 3 + 24 * 1 = 96 runs
TAS: 24 * 3 + 24 * 1 = 96 runs
```

Each run has up to 6 milestone transitions:

```text
192 * 6 = 1152 transition observations
96 * 6 = 576 transition observations per arm
```

---

### 6.2 Agent and model freezing

Before main runs:

- Freeze Claude Code CLI version.
- Freeze Codex CLI version.
- Freeze model snapshot IDs.
- Freeze Docker images.
- Freeze dependency lockfiles.
- Freeze scenario texts and check hashes.
- Freeze prompts and timeboxes.

If a vendor changes a default model during the run window, the experiment pauses and the change is handled according to the pre-registered protocol.

---

### 6.3 Blinding

Agents necessarily know whether they have `openspec verify`.

But:

- The hidden referee is never visible.
- The grading code is not mounted in the agent sandbox.
- The exposed checks are not the grading referee.
- The primary analysis script is frozen before outcome extraction.
- Outcome data are locked before unblinding arm labels in the final report.

---

## 7. Sample size and power argument

The experiment is powered primarily at the **milestone-transition level**, with chain-level regression as a key secondary.

### 7.1 Anchors from verified literature

Relevant effect sizes:

1. **Toy verification gate:**  
   Regression-affected chains fell from 43.2% to 12.5%.  
   Absolute reduction: 30.7 points.

2. **TDAD executable test context:**  
   Regressions fell from 6.08% to 1.82%.  
   Absolute reduction: 4.26 points.  
   Relative reduction: about 70%.

3. **Frontier damage evidence:**  
   SWE-Milestone, SlopCodeBench, and TensorBench show substantial breakage under continuous evolution, but no verification-style cure tested.

We therefore power for a large but not implausible relative reduction, not for a tiny effect.

---

### 7.2 Primary transition-level power

Assume a conservative control transition regression rate of:

```text
P(regression | TAS) = 12% to 15%
```

and a treatment rate of:

```text
P(regression | EAS) = 4% to 5%
```

This is roughly in the same relative-effect range as TDAD and the verification-gate result.

For a reduction from 12% to 4%, an unclustered two-proportion test at alpha = 0.05 and 80% power needs roughly 180 transition observations per arm.

With 6 transitions per run, that is about 30 runs per arm before accounting for clustering.

Accounting for within-run and within-task correlation:

- If ICC ≈ 0.10, design effect for 6 transitions is about 1.5.
- Required runs per arm becomes roughly 45.
- If ICC ≈ 0.20, required runs per arm becomes roughly 60.

Planned sample:

```text
96 runs per arm
576 planned transitions per arm
```

This gives robust power for transition-level absolute reductions of about 8–10 points from a 12–15% baseline, and excellent power for larger effects.

If the true effect is closer to a 3–4 point absolute reduction, the experiment may be underpowered. We will say so plainly and publish confidence intervals.

---

### 7.3 Chain-level secondary power

For the chain-level outcome, with 96 chains per arm:

If control chain regression is 45% and treatment is 20%, the unclustered required sample is about 54 chains per arm.

With task-level clustering and about 4 chains per task per arm, an ICC of 0.10 gives a design effect of about 1.3, requiring roughly 70 chains per arm.

The planned 96 chains per arm is adequate for a literature-sized absolute reduction of 20–30 points.

If the true chain-level reduction is only 10–15 points, the study is not powered to rule it out. We will not overinterpret such a null.

---

### 7.4 Why Claude is primary and Codex is included

Because one vendor is effectively unmetered and the other is limited:

- Claude Code provides the main powered sample.
- Codex CLI provides a pre-registered generalization sample.

The primary analysis is pooled with agent effects modeled, but we will report agent-specific estimates and interaction checks.

If the treatment effect differs sharply by agent, we will not average over that disagreement silently. We will present it as the main finding: the effect may be agent-dependent.

---

## 8. Biggest validity threat and neutralization

### Biggest threat: Goodharting / oracle leakage

The most dangerous objection is:

> “The treatment did not preserve behavior better. It merely optimized against visible tests. You measured test-passing, not real behavior preservation.”

This would be fatal if the exposed checks were also the grading oracle, or if they leaked implementation details beyond the written scenarios.

### Neutralization

The design attacks this threat directly.

#### 8.1 Hidden parallel referee

The agent-visible checks are not the grading checks.

For each scenario:

- Exposed check A is visible to EAS.
- Hidden referee R is never visible.
- A and R use different fixtures/seeds/variants.
- R grades both arms.

Therefore, EAS must generalize from the executable scenario surface, not merely memorize the exact visible assertions.

If EAS reduces hidden-referee regressions, the effect is not reducible to “it saw the grader.”

---

#### 8.2 Black-box scenario checks

Exposed checks are restricted to public behavior:

- CLI output.
- HTTP responses.
- File outputs.
- Database state observable through the app’s normal interface.
- UI state where applicable.

They may not:

- Inspect private functions.
- Require specific variable names.
- Require specific internal control flow.
- Reveal implementation hints beyond the scenario text.

Each check is reviewed to ensure it encodes only the Given/When/Then scenario.

---

#### 8.3 Immutable checks

Exposed checks are mounted read-only.

File hashes are recorded.

If an agent modifies, deletes, replaces, or intercepts the exposed checks:

- The run is flagged.
- The run is excluded from the primary per-protocol analysis.
- The event is reported transparently.

---

#### 8.4 Holdout behavioral probes

For a subset of milestones, we author additional hidden behavioral probes that are:

- Implied by the specification.
- Not listed as explicit acceptance scenarios.
- Never exposed to either arm.
- Graded only by R.

These are exploratory/secondary, but they test whether executable scenarios promote broader behavior preservation rather than narrow scenario passing.

---

#### 8.5 Control self-authored tests

A secondary threat is:

> “TAS agents may write their own tests from the prose, contaminating the control condition.”

We handle this by making the contrast pragmatic:

- TAS agents are not provided executable acceptance scenarios.
- They may use normal development behavior, including scratch scripts.
- We log test-like file creation and commands.
- We report how often TAS agents spontaneously create verification.
- We pre-specify a sensitivity analysis excluding TAS runs that create substantial persistent acceptance-like checks.

If many TAS agents spontaneously generate equivalent verification, the honest conclusion is not “executable scenarios do not matter,” but rather “pre-authored executable scenarios may be less necessary for agents capable of reliably self-generating equivalent verification.” That is still a useful practitioner result.

---

## 9. Expected cost profile

### 9.1 Engineering labor

Estimated effort:

| Work | Estimate |
|---|---:|
| Fork/adapt harness, Dockerization, agent adapters | 2–3 engineer-weeks |
| OpenSpec integration and immutable runner | 1–2 engineer-weeks |
| Hidden referee infrastructure | 1–2 engineer-weeks |
| Task selection and scenario authoring | 3–5 engineer-weeks |
| Scenario validation and pilot runs | 1–2 engineer-weeks |
| Analysis pipeline and pre-registration | 1 engineer-week |
| Run execution and monitoring | 1–2 engineer-weeks |
| Analysis and writeup | 1–2 engineer-weeks |

Total: roughly 10–18 engineer-weeks, depending on how much existing SlopCodeBench material can be reused.

---

### 9.2 Scenario authoring burden

Target:

- 24 tasks.
- 6 milestones each.
- Average 3–5 active scenarios introduced or modified per milestone.
- Roughly 350–550 total scenario instances across the suite.

Each scenario needs:

- Given/When/Then text.
- Exposed check A.
- Hidden referee R.
- Golden-pass validation.
- Mutation/failure validation.

This is the main human cost. It is higher than writing ordinary tests, but it is the price of a defensible hidden-referee design.

---

### 9.3 Model/API cost

Because the experiment uses subscription-covered agent CLIs:

- Claude Code: covered by subscription, effectively unmetered within rate limits.
- Codex CLI: limited subscription/API budget.

Planned Codex sample:

```text
24 tasks * 2 runs = 48 Codex chains
48 * 6 milestones = 288 Codex milestone sessions
```

This is deliberately modest.

If Codex quota becomes a hard constraint, the pre-registered fallback is to keep Codex as a directional generalization sample and make the primary powered inference on Claude, while clearly labeling the limitation.

---

### 9.4 Compute cost

Approximate main-run volume:

```text
192 chains
* 6 milestones
= 1152 agent milestone sessions
```

If average milestone wall time is 15–30 minutes:

```text
288–576 agent-hours of wall time
```

With parallel containers, this is manageable on one or two beefy machines over several days.

Hidden grading volume:

- 1152 commits.
- Cumulative active scenarios per commit.
- Multiple repeats for flake control.

Rough estimate:

```text
20,000–60,000 scenario executions
```

If each scenario execution takes 2–15 seconds, that is roughly:

```text
15–250 core-hours
```

depending on app startup cost.

Cloud compute, if used, likely falls in the low hundreds of dollars. Local hardware reduces cash cost.

---

### 9.5 Total cash cost

Excluding labor:

| Item | Estimated cash cost |
|---|---:|
| Claude subscription | $100–$300 |
| Codex subscription/API allowance | $100–$500 |
| Cloud compute, if used | $200–$800 |
| Storage/logging | <$100 |

Total cash cost: roughly **$400–$1,700**, depending on local compute availability and Codex usage.

The dominant cost is human scenario engineering and validation, not model spend.

---

## 10. Pre-registration and honest-null policy

Before any main run:

1. Freeze task list.
2. Freeze scenario texts.
3. Freeze exposed and hidden check code hashes.
4. Freeze randomization.
5. Freeze prompts.
6. Freeze model/CLI versions.
7. Freeze primary outcome definition.
8. Freeze analysis script.
9. Publish protocol.

After runs:

- Report primary effect with confidence interval.
- Report null results if the interval includes no meaningful effect.
- Report protocol violations, exclusions, flaky scenarios, and completion differences.
- Report agent-specific results.
- Report if TAS agents self-generated verification.
- Avoid any claim beyond the frozen substrate.

The public post should be able to say, at most:

> In this pre-registered experiment with frontier coding agents evolving repositories through six requirement changes, executable acceptance scenarios reduced hidden regression relative to identical text-only scenarios. The effect was measured by an independent hidden referee, not by the checks the agent could see.

If the result is null, the public post should say:

> We did not detect a meaningful reduction in hidden regression under these conditions. The confidence intervals leave room for both a substantial benefit and no benefit. Here are the data, protocol, and diagnostics.

That is the standard required to survive hostile practitioner scrutiny.

===== PART B ===== 

## Assumptions I am using in this attack

I assume the following about your Stage 1, because otherwise the plan is underspecified:

1. **Group T’s visible post-checkpoint suite is the same scenario suite that the hidden referee later grades**, plus possibly the harness’s own checkpoint tests.
2. **“Kept only if it passes at least as many checks” means the harness may discard T’s retry and keep the earlier T commit**, based on T-visible check counts.
3. **Group C receives no matched post-submission retry window**, no pass/fail signal, and no placebo verification feedback.
4. **The agent can continue from its own previous checkpoint commit**, not from a golden reset.
5. **The pilot escalation rule may change chain length or task selection before the main A/B**, based on control-only breakage rates.
6. **SlopCodeBench’s existing grading machinery is useful but not yet separated into agent-visible feedback vs hidden referee.**

With those assumptions, the current Stage 1 plan is publishable, but it is not yet strong enough to support the headline causal claim:

> “Executable acceptance scenarios prevent silent breakage relative to text-only scenarios.”

It currently estimates something closer to:

> “A verification gate plus failure feedback plus one retry plus visible-check-based commit selection improves accumulated checkpoint outcomes relative to no gate.”

That is still interesting, but it is not the same claim.

---

# 1. VALIDITY AUDIT

## Ranked threats to the Stage-1 causal claim

| Rank | Threat | Severity | Why it matters |
|---:|---|---|---|
| 1 | Treatment confound: gate + retry + rollback + keep-best | Fatal for the stated claim | T does not merely receive executable scenarios. T receives failure information, an extra attempt, and a harness-enforced safety rule. C receives none of these. |
| 2 | Hidden referee is not independent from T-visible checks | Fatal for positive interpretation | If T can see the same scenarios that later grade it, a positive result may be test-targeting, not behavior preservation. |
| 3 | Survivorship / selection / denominator bias | High | The gate changes which commits survive, which checkpoints are reached, and which curves are conditional on success. |
| 4 | Self-verification policy ambiguity | High | If C may write tests, contrast dilutes. If C may not, realism suffers. The chosen policy changes the estimand. |
| 5 | Artificial visibility manipulation | Medium-high | Hiding execution from C is the intervention, but if C is also stripped of normal verification routes, a hostile reader can call it a straw man. |
| 6 | Pilot escalation / task shopping | Medium-high | If chain length or task set changes after observing control breakage, the main A/B can inherit selection bias. |
| 7 | Scenario lifecycle ambiguity | Medium | If modified or retired requirements are counted as regressions, breakage is overestimated. |
| 8 | Existing repo/harness test leakage | Medium | If C can run pre-existing tests, the text-only contrast is contaminated. If T can see harness tests, the hidden referee is compromised. |
| 9 | Flaky or nondeterministic checks | Medium | Strict accumulated grading will false-positive regressions if scenario checks are not deterministic. |
| 10 | Multiple curve endpoints / clustering | Medium | Breakage-vs-promise curves invite cherry-picking unless a primary scalar summary is pre-registered. |

---

## Threat 1: Retry asymmetry and the gate package

This is the biggest problem.

Your Group T receives:

```text
submit checkpoint
→ run accumulated executable suite
→ show pass/fail and failing scenario names
→ allow exactly one retry
→ keep retry only if visible check count is at least as good
```

Group C receives:

```text
submit checkpoint
→ no feedback
→ no retry
→ final commit graded later
```

That is not a clean contrast between executable scenarios and text scenarios. It is a contrast between:

```text
executable scenarios
+ failure feedback
+ extra retry
+ visible-check-based rollback
+ harness-enforced monotonic visible improvement
```

versus:

```text
text scenarios
+ no feedback
+ no retry
+ no rollback assistance
```

A hostile reader will not miss this.

### Quantitative reason this matters

Suppose the true effect of executable feedback alone is zero.

Suppose also that one extra retry, even blind, recovers 15% of failing checkpoints simply because the agent gets another attempt. Suppose visible-check-based keep-best adds another 10 points of apparent improvement by selecting the better of two attempts.

Then T can look 25 points better than C without executable scenarios having any causal effect beyond granting extra compute and selection.

The 2607.01855 gate result is relevant here: their gate included verification, failure display, retry, and rollback. Their conclusion was that verification, not restatement, was the active ingredient. But their design does not separate:

```text
verification feedback
```

from:

```text
extra retry + rollback policy
```

If you port the gate exactly, you port the confound too.

### Should Group C get a matched retry budget?

Yes, if your claim is about **executable scenario feedback**.

If Group C does not get a matched retry budget, the “feedback vs extra compute” confound remains decisive.

If Group C gets a matched retry budget without verification information, the extra-compute confound is mostly removed. The remaining difference is:

```text
T receives targeted pass/fail information.
C receives only an additional blind revision opportunity.
```

That is much closer to the intended causal contrast.

### Recommended fix

Replace the current gate with one of two pre-registered estimands.

#### Option A: Clean “executable feedback” estimand

Use this if the claim is:

> Executable acceptance scenarios reduce breakage relative to text-only scenarios.

Protocol:

```text
Both groups:
- same checkpoint wall-clock budget
- same maximum number of submission attempts
- same ability to revise before final submission
- final commit chosen by the agent, not by the harness

Group T:
- can run accumulated executable scenarios before and after submission
- sees pass/fail and failing scenario names

Group C:
- cannot run provided executable scenarios
- receives a matched revision window
- receives a placebo prompt such as:
  “Review the accumulated Given/When/Then scenarios and revise if needed.”
- receives no pass/fail information
```

No automatic “keep retry only if it passes at least as many checks.”

The agent may use git rollback in both groups. T can choose rollback based on visible results. C can choose rollback based on its own judgment. That is fair: the information is the treatment.

#### Option B: Honest “verification gate package” estimand

Use this if you want to preserve the 2607.01855 gate exactly.

Then the claim should be:

> A verification gate with retry and visible-check-based rollback improves accumulated checkpoint outcomes relative to no gate.

That is a legitimate claim, but it is not the same as isolating executability.

If you choose Option B, you should still add a yoked-retry control if you want to say anything about feedback specifically.

### Does the confound survive either choice?

| Design choice | Extra-compute confound | Feedback contrast |
|---|---|---|
| C gets no retry | Severe | Weak |
| C gets fixed blind retry | Much smaller | Clean enough |
| C gets yoked retry at same time as T | Smallest | Best, operationally harder |
| T retry is failure-triggered, C retry is mandatory | Some asymmetry remains | Still far better than no C retry |
| Harness keeps T’s best visible-check commit but not C’s | Selection confound remains | Not clean |

The most defensible minimal fix is:

```text
Fixed matched revision window for both groups.
Final commit chosen by the agent.
No harness-side keep-best rule.
```

---

## Threat 2: Hidden referee is not independent

You say:

> Hidden referee in BOTH groups, invisible, after every checkpoint: the accumulated scenario suite plus the harness’s own checkpoint tests.

If the hidden referee includes the same accumulated scenario suite that Group T can execute, then the “hidden” referee is not hidden for T.

T can optimize directly against the graded surface.

That produces a serious Goodhart threat.

### Why this matters

A positive result could mean:

```text
T made the visible acceptance checks pass.
```

Not:

```text
T preserved the intended behavior more reliably.
```

Those are not identical.

Executable acceptance scenarios are useful partly because they make intended behavior concrete. But if the grading oracle is identical to the visible oracle, you cannot distinguish:

1. genuine behavior preservation;
2. narrow test satisfaction;
3. brittle implementation tuned to the exact scenario fixtures.

### Recommended fix

Separate the visible and hidden oracles.

For each scenario, create two executable implementations:

```text
A: agent-visible exposed check
R: hidden referee check
```

A and R should implement the same Given/When/Then requirement but differ in:

- input fixtures;
- random seeds;
- valid boundary cases;
- ordering/timing perturbations where safe;
- oracle code where practical.

A is visible only to T.

R is invisible to both groups and used for grading.

If full parallel authoring is too expensive, use a stratified subset:

- 100% of scenarios have hidden grading.
- At least 30–40% have independently authored hidden variants.
- Add blind holdout probes for previously specified behavior not explicitly listed as scenarios.

But the full parallel-referee design is much stronger.

### Minimum acceptable compromise

If you cannot author parallel R for every scenario, then at minimum:

1. Hide the harness’s own checkpoint tests from both groups.
2. Add a holdout subset of scenarios that T cannot execute.
3. Pre-register that the primary outcome is hidden regression on the holdout/independent subset.
4. Report visible-suite regression as a secondary, explicitly labeled as susceptible to teaching-to-the-test.

Without this, a positive Stage-1 result will be vulnerable to the comment:

> “You graded the treatment on the same tests it could see.”

---

## Threat 3: Survivorship, selection, and denominator bias

Your gate changes which commits survive.

The rule:

> kept only if it passes at least as many checks

means T’s visible accumulated score is mechanically protected from worsening.

C has no such protection.

This creates several problems.

### Problem 3.1: Conditional curves

Breakage-vs-accumulated-promise-count curves are only meaningful if the denominator is handled consistently.

If T drops bad retries and C does not get retries, then T’s later checkpoints are conditioned on having survived the gate. C’s later checkpoints may include chains that would have been blocked or repaired under T.

That can bias the curves in either direction.

### Problem 3.2: Progress suppression

The gate may make T conservative. T may spend its retry budget fixing old scenarios and fail to implement new checkpoint requirements.

Your guard metric, per-checkpoint task success, is necessary but not sufficient.

You need a composite outcome:

```text
checkpoint success =
  new/modified scenarios pass under hidden referee
  AND
  no new hidden regression on still-valid prior scenarios
```

Report separately:

```text
P(new scenarios pass)
P(no regression)
P(new scenarios pass AND no regression)
```

Otherwise T can look good on regression while failing to make progress.

### Problem 3.3: Non-completion and missing checkpoints

If a chain cannot produce a runnable artifact at checkpoint `k`, how is that counted?

Pre-register an intention-to-treat rule.

Recommended rule:

```text
If checkpoint k is non-runnable and checkpoint k-1 was runnable,
count all still-valid prior scenarios as newly failed.
```

Also report:

- completion rate by group;
- runnable-build rate by group;
- average retry usage;
- average wall-clock/tool-call consumption.

If T completes fewer checkpoints because the gate consumes budget, that is a real cost and must be visible.

---

## Threat 4: Self-verification policy

You identified this correctly.

There are three possible policies.

### Policy 1: Forbid C from writing or running its own tests

This gives the cleanest mechanistic contrast:

```text
T has provided executable scenarios.
C has only text.
```

But it is unrealistic. Frontier coding agents naturally write scratch tests, curl commands, scripts, and assertions.

A hostile practitioner will say:

> “You nerfed the control agent.”

This policy is defensible only if the claim is narrow:

> Under a restricted agent policy where only the provided acceptance suite may verify behavior, executable scenarios reduce breakage.

That is less useful for CTO-level readers.

### Policy 2: Allow C to self-verify freely

This is more realistic.

C may:

- write scratch tests;
- run the app;
- create temporary assertions;
- use normal debugging scripts.

But C is not provided with the executable acceptance runner.

This makes the contrast:

```text
provided executable acceptance scenarios
vs
text scenarios plus agent initiative
```

That is a pragmatic, practitioner-relevant contrast.

The cost: the effect estimate is biased toward zero. If C agents reliably self-generate equivalent verification, the treatment effect may disappear even though executable scenarios are theoretically useful.

But that would be an honest and valuable null:

> Frontier agents can partially substitute for provided executable scenarios by writing their own checks.

### Policy 3: Allow self-verification but constrain persistence

This is the best compromise.

Allow C to create temporary scripts, but prohibit:

- modifying OpenSpec files;
- creating files in a protected `acceptance/` directory;
- registering new harness-visible acceptance checks;
- altering the provided scenario metadata.

Log:

- number of test-like files created;
- number of test-like commands run;
- whether files persist across checkpoints;
- whether the agent appears to have implemented scenario-specific assertions.

Then pre-specify:

1. **Primary analysis:** pragmatic intent-to-treat with self-verification allowed.
2. **Sensitivity analysis:** exclude or down-weight C runs that create substantial persistent acceptance-like test suites.
3. **Mediator analysis:** regress treatment effect on self-verification intensity.

### Which policy yields the more defensible claim?

For a public practitioner audience, **Policy 3 is the most defensible**.

It preserves realism while making the provided-treatment contrast explicit.

If you forbid self-verification, the result may be dismissed as artificial.

If you allow self-verification and still find a large effect, the result is stronger in a practical sense: the provided executable scenarios helped beyond what agents spontaneously did.

If you allow self-verification and find no effect, the honest interpretation is:

> Provided executable scenarios did not materially outperform agent-initiated verification in this setting.

That is publishable and useful.

---

## Threat 5: Visibility manipulation as artificial setting

You asked whether hiding execution from Group C creates an artificial setting.

Yes, partially.

But hiding execution is also the manipulation.

The issue is not that C lacks the provided runner. The issue is whether C lacks all reasonable verification routes.

### When the design is defensible

The visibility manipulation is defensible if:

- C can run the application;
- C can write scratch scripts;
- C can read all scenario text;
- C can use normal tools;
- C is not stripped of ordinary developer capabilities;
- the only missing thing is the provided executable acceptance runner.

### When the design is not defensible

It becomes artificial if:

- existing repo tests are removed and C cannot write replacements;
- C is forbidden from running ad hoc checks;
- C receives no matched revision opportunity;
- C is graded by hidden executable checks while being denied all executable feedback.

That starts to look like:

```text
T has a CI gate.
C is blindfolded.
```

### Recommended mitigation

Add an attention placebo for C.

At the same point where T receives visible check results, C receives:

```text
You have reached the checkpoint review stage.
Please re-read the accumulated Given/When/Then scenarios.
You may revise your implementation before final submission.
No automated acceptance results are available.
```

This does not give C feedback, but it equalizes the prompt to review accumulated scenarios.

It helps answer the objection:

> “T improved because it was reminded to think about old scenarios, not because scenarios were executable.”

That may still be part of the mechanism, but the placebo makes the contrast cleaner.

---

## Threat 6: Pilot escalation and task shopping

Your pilot rule:

> if frontier agents don’t break anything at this scale, lengthen chains or move to Stage 2 rather than buy a null

is dangerous if applied adaptively.

### The problem

If you run control-only pilots, observe low breakage, then lengthen chains until breakage appears, and then run the A/B on the lengthened chains, you have selected tasks where damage is observable.

That is not automatically invalid, but it creates a researcher-degrees-of-freedom problem.

A hostile reader can say:

> “You searched for a setting where your problem exists, then tested the cure in that selected setting.”

### Recommended rule

Pre-register one of the following.

#### Conservative rule

Use the pilot only for:

- flake detection;
- infrastructure validation;
- timebox calibration;
- go/no-go decision.

If control breakage is too low, publish:

> “At this task scale, we did not observe enough breakage to test the mitigation.”

Then design Stage 2 separately.

Do not lengthen Stage 1 chains post hoc and call it the same Stage 1.

#### Adaptive-but-honest rule

Pre-register an escalation ladder:

```text
Stage 1a: original chain length.
If control breakage < X%, Stage 1a is reported as underpowered/null.
Stage 1b: longer chains, new pre-registration, new power analysis, independent tasks if possible.
```

The key is that the A/B result used for the main claim must come from a frozen design, not from a chain length chosen after seeing control outcomes.

### Quantitative go/no-go threshold

Assume the main design needs a control transition regression rate of at least 8–12% to be informative.

Pre-register:

```text
If control-only pilot shows < 5% transition regression
and < 20% chain-level regression,
do not proceed to the main A/B at that scale.
```

Otherwise you risk spending model budget on a near-null damage process.

---

## Threat 7: Scenario lifecycle ambiguity

Accumulated scenario suites are tricky because requirements change.

If checkpoint 4 intentionally modifies behavior from checkpoint 2, the old scenario should not count as a regression when it fails.

You need explicit lifecycle metadata.

For each scenario ID:

```text
active_from_checkpoint
retired_at_checkpoint
modified_by_scenario_id
replaced_by_scenario_id
```

For each checkpoint transition:

```text
ValidPrior(t) =
  scenarios active at t-1
  AND passing at t-1
  AND still active at t
  AND not replaced/retired by checkpoint t
```

Only failures in `ValidPrior(t)` count as regressions.

Otherwise your breakage curve will conflate:

```text
silent breakage
```

with:

```text
intended behavior change
```

That will inflate breakage and make the cure look better if T is better at noticing modified requirements.

---

## Threat 8: Existing repo and harness test leakage

If the repositories already contain tests, C can run them.

If the harness’s own checkpoint tests are visible anywhere in the sandbox, T or C may discover them.

You need a clear policy.

Recommended:

```text
Main Stage-1 surface:
- remove or disable pre-existing automated tests for target behavior
- hide all hidden-referee material from both groups
- mount T-visible exposed checks read-only
- log attempts to access hidden paths
```

Then disclose this as a clean acceptance surface.

If you want brownfield realism, Stage 2 should include existing tests. Do not quietly rely on Stage 1 for brownfield claims.

---

## Threat 9: Flaky checks

Strict accumulated grading is unforgiving.

If a scenario check fails once due to timing, port allocation, filesystem order, or nondeterminism, it can look like a regression.

Recommended:

- run each hidden scenario 3 times;
- use fixed seeds, fixed clocks, isolated ports, deterministic fixtures;
- validate on golden implementations;
- exclude or flag scenarios with >0% disagreement on golden runs;
- pre-register failure rule.

A conservative rule:

```text
For regression counting:
  scenario fails if it fails on any of 3 repeats.

For previous-pass baseline:
  scenario must pass on all 3 repeats.
```

Report a sensitivity analysis using majority-vote failure.

---

## Threat 10: Multiple curves and clustering

Breakage-vs-accumulated-promise-count curves are useful, but they are not a primary outcome unless you pre-specify the summary.

Otherwise a reader can pick the checkpoint where the groups look most different.

Pre-register one primary scalar.

Recommended primary:

```text
Transition-level hidden regression indicator:
Y_it = 1 if run i introduces at least one new hidden regression at checkpoint transition t.
```

Analyze with mixed-effects logistic regression:

```text
Y_it ~ arm + checkpoint + (1 | task) + (1 | agent) + (1 | run)
```

Report marginal risk difference with cluster-robust SEs.

Secondary:

- chain-level any regression;
- area under the breakage curve;
- final-checkpoint regression prevalence;
- composite checkpoint success;
- time to first regression.

If you report curves, also report the pre-specified scalar summary.

---

# 2. COMPARABILITY VS REALISM

Your framing is:

> We are continuing 2607.01855 by porting its gate policy to frontier agents and a growing scenario surface.

That framing is useful, but it is currently too strong.

## What is genuinely continuous

You are preserving:

1. A checkpoint-chain evolution structure.
2. Accumulated requirements.
3. A verification gate after each checkpoint.
4. One retry.
5. A regression-focused outcome.
6. The intuition that execution beats restatement.

That is enough to call Stage 1 a **conceptual extension** of 2607.01855.

## What is materially different

But you are changing:

1. Models: sub-frontier toy-task models → frontier agents.
2. Execution mode: likely simpler generation loop → Claude Code / Codex CLI agentic mode.
3. Task scale: toy Python tasks → SlopCodeBench checkpoint chains.
4. Specification format: prose/restated requirements → OpenSpec Gherkin blocks.
5. Scenario surface: original tests only → accumulated scenario suite.
6. Workflow: no OpenSpec → OpenSpec workspace.
7. Grading: original tests executed → hidden accumulated scenario suite plus harness tests.
8. Treatment: verification gate on original tests → executable accumulated scenarios with OpenSpec wrapping.

Those are not minor.

## Honest framing

Use this framing:

> 2607.01855 showed that verification, not restatement, reduced regression in toy chains. We test whether a related executable-acceptance intervention reduces hidden regression when frontier coding agents evolve checkpoint chains in an agentic workflow.

Do not say:

> We replicate 2607.01855 at frontier scale.

It is not a replication.

Do not say:

> This proves the same active ingredient operates.

Your current design does not isolate the active ingredient cleanly.

## Should the link be loosened or dropped?

Do not drop it. It is the best motivating evidence.

But loosen it in three ways:

1. Call it a **conceptual extension**, not a replication.
2. Use 2607.01855 for **power and hypothesis**, not for direct quantitative comparison.
3. If you keep the exact gate, call the intervention a **verification gate package**, not merely executable scenarios.

The most honest sentence for a public post would be:

> Inspired by the verification-gate result in 2607.01855, we tested whether giving frontier coding agents executable accumulated acceptance scenarios reduces hidden regression in SlopCodeBench-style checkpoint chains.

If the design keeps the retry/keep-best gate without a matched C retry, add:

> The intervention includes a verification gate and retry policy, so the result should be interpreted as the effect of the gate package, not executability alone.

---

# 3. THE HOSTILE COMMENTER

Below are the three most damaging comments a skeptical senior practitioner could leave under a public post reporting a positive Stage-1 result.

---

## Hostile comment 1: retry/compute confound

> “This isn’t a test of executable specs. Your treatment group got pass/fail feedback, an extra retry, and a rollback rule that kept the better attempt. The control group got one blind shot. Of course T did better. You measured ‘CI gate plus extra compute,’ not ‘executable scenarios.’ Run the control again with the same retry budget and no feedback, then talk.”

### Can the current design answer it?

No.

Under the current plan, this comment is correct.

The treatment arm receives more than executability. It receives:

- failure information;
- an extra attempt;
- visible-check-based selection;
- mechanical protection against visible score regressions.

The control arm receives none of those.

### What change would answer it?

Add a matched blind revision window for C.

Minimal credible fix:

```text
Both groups get the same checkpoint budget.
Both groups get one post-submission revision window.
T sees pass/fail.
C sees a placebo review prompt.
Final commit is chosen by the agent.
No harness-side keep-best rule.
```

Better fix:

```text
Yoked design:
C receives the same amount of post-submission time that T receives.
```

If you do not make this change, change the claim to:

> The verification gate package improved outcomes.

Do not claim executability alone.

---

## Hostile comment 2: teaching to the visible tests

> “Your ‘hidden’ referee is the same accumulated scenario suite the treatment group could run. That’s not hidden. You graded T on the tests it could see. All you proved is that agents are good at making visible Gherkin checks pass. Show me an independent referee with different fixtures or holdout scenarios, otherwise this is just Goodharting with extra steps.”

### Can the current design answer it?

No, not if the hidden referee reuses the same scenario executions that T can see.

If T can run the accumulated suite and the hidden referee later runs the same suite, the referee is hidden in name only.

### What change would answer it?

Create an independent hidden referee.

Strong version:

```text
For every scenario:
- exposed check A visible to T
- hidden referee R invisible to both
- A and R implement the same Given/When/Then behavior
- A and R use different fixtures/seeds/variants
```

Medium version:

```text
- Full hidden grading for all scenarios.
- Independent hidden variants for a stratified 30–40% subset.
- Blind holdout probes for implied prior behavior.
- Primary outcome on independent/holdout subset.
```

Minimum version:

```text
- Do not let T see the exact checks used for grading.
- Use different input data for hidden grading.
- Validate that visible and hidden checks are highly correlated but not identical.
```

Without this, any positive result is vulnerable to the test-targeting objection.

---

## Hostile comment 3: pilot task shopping

> “You ran a control-only pilot, saw that frontier agents didn’t break much, then lengthened the chains until they did. That’s task shopping. You selected a setting where damage appears, then tested your cure there. If the chain length was chosen after seeing control breakage, the positive result is selection bias with a Dockerfile.”

### Can the current design answer it?

Only partially.

A pre-declared escalation rule helps, but not if it allows the main A/B to be run on a post hoc selected chain length.

If the rule is:

```text
If breakage is low, lengthen chains and then run the main A/B
```

without a new pre-registration and new power analysis, the answer is weak.

### What change would answer it?

Pre-register a hard separation.

Option 1:

```text
Pilot is only for go/no-go.
If breakage is too low, Stage 1 is reported as underpowered/null.
Stage 2 is designed separately.
```

Option 2:

```text
Pilot can trigger Stage 1b, but Stage 1b has:
- its own frozen chain length;
- its own task list;
- its own power analysis;
- its own randomization;
- no further adaptive changes after A/B starts.
```

The public post should then say:

> Stage 1a showed insufficient breakage. Stage 1b was pre-registered before running the A/B.

That preserves credibility.

---

# 4. FORK VS PLUG

You have two implementation strategies:

1. **Fork SlopCodeBench** and add OpenSpec, group assignment, exposed checks, hidden referee, and audit layers.
2. **Import SlopCodeBench problem set** into your own two-group experiment harness and port the grading.

I cannot read either codebase, so the decision should be made by extracting the following facts. They are ranked by decision-weight.

---

## Ranked decision checklist

| Rank | Fact to extract | Why it matters | Decision rule |
|---:|---|---|---|
| 1 | Whether SlopCodeBench grading can be split into agent-visible checks vs hidden referee | This is the core validity requirement. If grading is monolithic and visible, the causal design is compromised. | If it cannot be cleanly separated, prefer your own harness or rewrite grading. |
| 2 | Whether SlopCodeBench supports custom submission/retry hooks | You need matched retry, placebo prompts, final-commit selection, and no accidental keep-best behavior. | If hooks are absent and hard to add, prefer your own harness. |
| 3 | Coupling between tasks and grading logic | If tasks are just data plus tests, importing is easy. If tasks are deeply entangled with harness internals, forking is safer. | High coupling → fork. Low coupling → plug. |
| 4 | Whether agent adapters for Claude Code and Codex CLI are production-quality | You need reliable agentic execution, logging, timeouts, and commit capture. | If Slop adapters are strong and yours are weak, fork. |
| 5 | Whether checkpoint continuity uses the agent’s previous commit | The experiment needs cumulative evolution, not golden resets. | If Slop resets to golden, you must modify it or use your own harness. |
| 6 | Filesystem permission model | T-visible checks must be read-only; hidden referee must be invisible; tampering must be preventable. | If Slop cannot enforce this, prefer your own harness or sandbox layer. |
| 7 | Determinism controls | Network, clocks, ports, seeds, fixtures, and retries must be controlled. | Weak determinism → high grading noise → invalid strict regression counts. |
| 8 | Ability to inject OpenSpec workspace without contaminating grading | OpenSpec must be identical across groups and not leak hidden material. | If injection is easy in Slop, fork gains value. If your harness already has workflow machinery, plug gains value. |
| 9 | Visibility of existing repo tests | You need to remove or lock non-spec tests for the clean surface. | If Slop tasks depend on existing tests, importing may require heavy rework. |
| 10 | Per-scenario and per-checkpoint metric extraction | You need transition-level regression, checkpoint success, and accumulated promise denominators. | If Slop already emits this, fork is attractive. |
| 11 | Audit logging for self-authored tests and tamper attempts | You need to measure C self-verification and detect check modification. | If your own harness has native audit machinery, plug is attractive. |
| 12 | License, dependencies, maintenance burden | MIT is fine; abandoned or fragile dependencies are not. | If Slop is fragile and your harness is stable, plug. |

---

## Practical decision rule

Use this threshold.

### Fork SlopCodeBench if all of the following are true

```text
1. Grading can be separated into visible and hidden layers.
2. Submission/retry hooks can be added without rewriting core grading.
3. Agent adapters are stronger than yours.
4. Checkpoint continuity already exists.
5. Per-checkpoint accumulated grading is already implemented.
```

This is the strongest case for forking: you get difficult grading and agent plumbing for free.

### Import the problem set into your own harness if any of the following are true

```text
1. Grading is monolithic and cannot be hidden.
2. Agent-visible and hidden checks cannot be separated.
3. Retry/gate workflow is hard-coded.
4. Your harness already has superior group assignment, audit, and workflow machinery.
5. Slop tasks can be exported as repos + tests + metadata without enormous effort.
```

The biggest mistake would be forking SlopCodeBench because grading is “already there,” then discovering that the grading surface cannot be made invisible or independent.

That would force you into the weakest design: visible tests as hidden referee.

---

# 5. BETTER ALTERNATIVES

Part A’s design and your Stage 1 overlap substantially, but they differ in important ways.

## Where your plan is stronger than Part A

Your plan has several strong elements.

### 1. Harness continuity

Forking SlopCodeBench is pragmatic. It gives you:

- Docker isolation;
- checkpoint chains;
- strict accumulated grading;
- Claude Code and Codex CLI adapters.

That reduces infrastructure risk.

### 2. Guard metric

Your per-checkpoint task success guard is important. It prevents the gate from being interpreted as purely conservative.

Part A also includes current-milestone correctness, but your guard metric is a clean practitioner-facing safeguard.

### 3. Breakage-vs-promise curves

This is a good visualization for a practitioner audience. It makes accumulated decay tangible.

### 4. Pilot escalation instinct

The instinct to avoid buying a null on tasks where frontier agents do not break anything is correct. Running an A/B when the damage process is absent wastes budget.

The problem is not the instinct. The problem is adaptive execution.

---

## Where Part A is stronger than your plan

### 1. Independent hidden referee

Part A explicitly separates:

```text
agent-visible exposed checks
```

from:

```text
hidden grading referee
```

Your current plan does not.

This is the single biggest improvement Part A offers.

### 2. Cleaner estimand

Part A tries to isolate executable acceptance scenarios, not a whole gate package.

Your plan currently estimates a gate package.

If the public claim is about executable scenarios, Part A’s cleaner contrast is stronger.

### 3. Matched compute logic

Part A anticipates the extra-compute objection by giving the control group comparable opportunity to revise.

Your current plan does not.

### 4. Transition-level primary outcome

Part A’s primary transition-level regression indicator uses more information than chain-level only and is easier to power.

Your curve approach is good, but needs a scalar primary.

### 5. Self-verification logging

Part A treats self-authored verification as a measured behavior and sensitivity axis, rather than leaving it ambiguous.

That is more defensible.

---

## Recommended merged design

Steal from both.

Use your harness strategy and SlopCodeBench continuity, but adopt Part A’s validity protections.

---

## Merged Stage-1 protocol

### Substrate

- Fork SlopCodeBench if the fork/plug checklist favors it.
- Wrap each chain in an OpenSpec workspace.
- Use byte-identical Given/When/Then scenario blocks across groups.
- Remove or lock non-spec automated tests for the main clean-surface experiment.
- Pin model snapshots, CLI versions, Docker images, and scenario hashes.

---

### Groups

#### Common to both groups

```text
- Same OpenSpec files.
- Same change deltas.
- Same checkpoint budget.
- Same revision-window budget.
- Same ability to run the app.
- Same ability to write scratch scripts.
- Same prohibition on modifying OpenSpec or acceptance metadata.
- Same hidden referee, invisible to both.
- Final commit chosen by the agent, not by the harness.
```

#### Group T: executable acceptance scenarios

```text
- Can run accumulated exposed scenarios:
    openspec verify --all
    openspec verify --scenario <id>
- Exposed checks are read-only.
- After submission, T sees pass/fail and failing scenario names.
- T may revise during a fixed post-submission window.
- T may use git rollback.
- T chooses final commit.
- No harness-side automatic keep-best rule.
```

#### Group C: text-only scenarios with matched revision window

```text
- Cannot run provided executable acceptance scenarios.
- Can read all scenario text.
- Can run app and scratch scripts.
- After submission, C receives placebo prompt:
    “Review the accumulated scenarios and revise if needed.”
- C receives no pass/fail information.
- C gets the same fixed post-submission revision window as T.
- C may use git rollback.
- C chooses final commit.
```

This preserves the treatment as:

```text
provided executable pass/fail feedback
```

not:

```text
extra retry + harness selection
```

---

### Hidden referee

For each scenario:

```text
Exposed check A:
- visible to T
- implements scenario with fixture set A

Hidden referee R:
- invisible to both
- implements same scenario with fixture set R
- different seeds/inputs/variants where possible
```

Validate:

```text
A and R pass on golden implementation.
A and R fail on seeded regressions.
A/R agreement on pilot agent commits is high, e.g. >90%.
```

If full parallel authoring is infeasible:

```text
- author independent R for a stratified subset;
- add blind holdout probes;
- make primary outcome hidden regression on independent/holdout surface;
- report full visible-suite outcome as secondary.
```

---

### Primary outcome

```text
Y_it = 1 if run i introduces at least one new hidden regression
       at checkpoint transition t.
```

Model:

```text
Y_it ~ arm + checkpoint + (1 | task) + (1 | agent) + (1 | run)
```

Report:

```text
P(hidden regression | T)
P(hidden regression | C)
risk difference
95% CI
```

---

### Guard metric

Pre-specify checkpoint success as:

```text
new/modified scenarios pass under hidden referee
```

Composite success:

```text
new scenarios pass
AND
no new hidden regression
```

Report both components separately.

This prevents the interpretation that T merely became conservative.

---

### Curves

Still produce breakage-vs-accumulated-promise-count curves.

But pre-specify scalar summaries:

1. transition-level regression rate;
2. final-checkpoint regression prevalence;
3. area under the breakage curve;
4. chain-level any regression.

The curve is for explanation. The scalar is for inference.

---

### Sample size

If feasible, target:

```text
24 task chains
Claude Code: 6 runs per task, 3 T / 3 C
Codex CLI: 2 runs per task, 1 T / 1 C
```

Totals:

```text
192 runs
96 T
96 C
```

With 6 checkpoints:

```text
1152 transition observations
576 per arm
```

Power intuition:

| Outcome assumption | Unclustered n per arm | With 6 transitions/run and ICC 0.1 | Interpretation |
|---|---:|---:|---|
| Chain regression 43.2% → 12.5% | 33 chains/arm | ~43 chains/arm with task clustering | 96/arm is strong |
| Chain regression 40% → 20% | 81 chains/arm | ~106 chains/arm with clustering | 96/arm is borderline but reasonable |
| Transition regression 12% → 4% | 179 transitions/arm | ~45 runs/arm with ICC 0.1 | 96/arm is strong |
| Transition regression 6.08% → 1.82% | 327 transitions/arm | ~82 runs/arm with ICC 0.1 | 96/arm is adequate if ICC is not high |

If SlopCodeBench has fewer than 24 usable chains, either:

- add tasks;
- increase runs per task;
- reduce the minimum detectable effect claim;
- explicitly label the study as pilot-scale.

A precise but biased estimate is worse than an underpowered honest one.

---

### Pilot rule

Use control-only pilot for:

- flaketime;
- timebox calibration;
- infrastructure validation;
- breakage presence check.

Pre-register:

```text
If control transition regression < 5%
or control chain regression < 20%,
do not run the main A/B at this scale.
Report the pilot as a null/underpowered result.
```

If you want longer chains:

```text
Create Stage 1b.
New pre-registration.
New power analysis.
Frozen chain length before A/B.
```

Do not adapt chain length after seeing control breakage and then report it as the original Stage 1.

---

## What claim the merged design supports

If positive, you can say:

> In SlopCodeBench-style checkpoint chains, giving frontier coding agents executable acceptance feedback reduced hidden regression relative to identical text-only scenarios with matched revision opportunity. The effect was measured by an independent hidden referee, not by the checks the agent could see.

If null, you can say:

> Provided executable acceptance scenarios did not detectably reduce hidden regression beyond agent-initiated verification and matched revision time. Here are the confidence intervals, self-verification rates, and diagnostics.

Both are credible.

---

# 6. RED-TEAM YOURSELF

My recommendations could mislead you in several ways.

---

## Risk 1: Over-purifying the intervention into irrelevance

My strongest recommendations are:

- independent hidden referee;
- matched blind retry for C;
- no harness keep-best;
- allow C self-verification;
- pre-register scalar outcomes;
- avoid adaptive chain length.

Together, these make the experiment more internally valid.

But they may also make it weaker in a practical sense.

### How this could mislead

The real-world value of executable acceptance scenarios may be precisely that they become the grading surface.

In practice, if the acceptance checks pass, many teams consider the behavior delivered. If T optimizes to visible acceptance checks, that may not be a bug. It may be the point.

By forcing an independent hidden referee, I may be testing a stricter question:

> Do executable acceptance scenarios generalize beyond their own fixtures?

That is scientifically cleaner, but practitioner relevance may be narrower.

A positive result on visible checks might still be useful:

> T made the acceptance suite pass more reliably.

If the acceptance suite is the contract, that matters.

### Evidence that would change my mind

I would soften the independent-referee requirement if:

```text
exposed-hidden agreement is very high, e.g. >95%;
holdout probes show the same treatment effect;
visible-check passing predicts hidden-referee passing almost perfectly;
scenario checks are behavior-level and not fixture-specific.
```

If visible and hidden outcomes move together tightly, the Goodhart objection becomes less damaging.

---

## Risk 2: The matched blind retry may create an artificial control

I recommend giving C a matched revision window with no feedback.

That equalizes compute, but it may be unnatural.

In real workflows, a text-only agent does not receive a mandatory “please re-read scenarios” prompt after submission.

### How this could mislead

The control arm may become:

```text
text scenarios + forced useless reflection
```

rather than:

```text
ordinary text-only workflow
```

If C wastes its retry window because it has no signal, T’s advantage may look larger than it would be in a natural setting where C would simply stop.

### Evidence that would change my mind

I would keep the matched retry if:

```text
C uses the revision window productively in pilot;
C self-verification during the window is nontrivial;
C outcomes improve modestly after the window;
the T-C gap remains after accounting for C revision behavior.
```

If C almost never changes anything during the blind window, then the matched retry is mostly a conservative equalizer, not a serious distortion.

---

## Risk 3: Allowing C self-verification may produce a false null

I recommend allowing C to write scratch tests because forbidding them invites realism objections.

But frontier agents may be good enough at self-testing that C partially recreates the treatment.

### How this could mislead

If C agents write decent scenario checks, the contrast becomes:

```text
provided executable scenarios
vs
agent-generated executable scenarios from text
```

The result may be null even though executable scenarios matter.

A hostile reader could say:

> Your control group already had executable scenarios; the agents just wrote them themselves.

### Evidence that would change my mind

I would be more comfortable if pilot data show:

```text
C self-authored tests are rare (<10% of checkpoints);
C tests are low quality;
C tests do not cover accumulated prior scenarios;
C self-verification does not predict hidden regression reduction.
```

If C self-verification is common and effective, the honest conclusion is not “executable scenarios do not matter.” It is:

> Provided executable scenarios may be less necessary for agents that reliably self-generate equivalent verification.

That is still valuable, but it changes the product thesis.

---

## Risk 4: Pushing for a large sample may delay or kill the experiment

I recommend a fairly large design, e.g. 96 runs per arm.

That is powered for meaningful effects and robust to clustering.

But subscription limits, rate limits, and scenario-authoring cost may make this impractical.

### How this could mislead

If you spend months building the perfect design, you may never publish. A smaller, imperfect Stage 1 might still provide useful signal.

### Evidence that would change my mind

I would accept a smaller design if:

```text
SlopCodeBench already has many high-quality checkpoint chains;
hidden referee can be generated cheaply;
pilot shows low flakiness;
Claude budget is effectively unmetered;
Codex can contribute at least 20–24 chains per arm;
the public post explicitly labels the study as exploratory.
```

A reasonable minimum for a credible large-effect Stage 1 is:

```text
60 chains per arm
```

This is enough for large chain-level effects, but not for small transition-level effects.

If you go below 60 per arm, do not claim strong causal evidence. Call it a pilot.

---

## Risk 5: My fork/plug checklist may overvalue hidden-referee separation

I ranked “ability to separate visible and hidden grading” as the top fork/plug factor.

That is defensible, but it may push you away from SlopCodeBench for the wrong reason.

### How this could mislead

If SlopCodeBench’s grading is monolithic but its tasks and adapters are excellent, you might still fork it and wrap the grading externally.

My checklist could make you abandon a good substrate because the first inspection makes grading look coupled.

### Evidence that would change my mind

I would favor forking SlopCodeBench if:

```text
grading can be run after-the-fact on frozen commits;
tests can be executed outside the agent sandbox;
task metadata can be exported;
agent adapters are stable;
adding an external hidden referee requires only a wrapper script.
```

If the hidden referee can be externalized without modifying Slop internals, fork remains attractive.

---

## Bottom line

Your Stage 1 plan is strong operationally but weak causally in its current form.

The three changes that matter most are:

1. **Remove or equalize the retry/gate asymmetry.**  
   Otherwise you are testing a gate package, not executable scenarios.

2. **Make the hidden referee independent from T-visible checks.**  
   Otherwise a positive result can be dismissed as teaching to the test.

3. **Freeze the pilot-to-main escalation path.**  
   Otherwise a positive result can be dismissed as task shopping.

If you make those changes, the merged design becomes credible enough to survive hostile practitioner scrutiny.

If you do not, a positive Stage-1 result will look impressive to friendly readers but will not survive the comments section.