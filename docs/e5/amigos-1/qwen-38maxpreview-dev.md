# Development Reviewer — Three-Amigos Design Review

## A. VERDICT

**Fix first.** The plan is architecturally sound and its statistical/claim machinery is unusually rigorous, but the actual treatment-channel implementation—the feedback content format, the revise-turn session plumbing, the on-demand runner interface, and the coverage-map construction algorithm—is specified at the level of *intent* rather than *interface*, and a competent builder would have to invent those interfaces in ways that could silently alter the estimand or break replayability.

---

## B. FINDINGS (ranked by importance)

### 1. §2.3 / §4 — Feedback content format is a phrase, not a spec

**Issue.** The entire treatment effect flows through "scenario ID + pass/fail + a minimal expected-vs-actual diff at the assertion boundary — no stack traces, no step-definition internals." This is the *only* information the treatment arm receives that the control arm does not. Yet there is no output template, no example, no schema, no byte-level definition. What does "minimal expected-vs-actual diff at the assertion boundary" look like for a multi-assertion scenario? For a scenario with 12 steps where step 7 fails? Is it one line per failing assertion or one line per failing scenario? Is the "expected" value the Gherkin text or the step-definition's internal expectation?

**Wrong-build failure mode.** A builder implements a reasonable format. It turns out to be too terse (agent can't localize the failure → null by construction, uninterpretable) or too verbose (leaks implementation structure → treatment effect is "better error messages" not "executable acceptance"). The rung-2 actionability check (R13) catches the *too-terse* case but only on 4 chains; it cannot catch the *too-verbose* case, and it fires *after* the format is built, creating a rework loop that the schedule doesn't budget for.

**Required change.** Freeze a concrete output template (with 2–3 worked examples covering: single-assertion fail, multi-step fail-at-step-k, and all-pass) as a normative appendix. Specify: one block per failing scenario, fields = `{scenario_id, step_index, step_text, expected_literal, actual_literal}`, maximum N lines per scenario. Hash the formatter code into the freeze manifest. The rung-2 check then validates against the frozen template, not against a builder's interpretation.

---

### 2. §4 / §15 item 3 — Revise-turn session mechanics are unspecified

**Issue.** The plan states "exactly one revise turn, both arms" and gives the prompt text, but never specifies the *session mechanics*: Is the revise turn a fresh CLI invocation (new process, same workspace)? A continuation message in the same session? Does it receive the full conversation history or only the workspace state? The §1.3 table says "fresh session per checkpoint over repo-carried state," but the revise turn is *within* a checkpoint. The upstream harness has a per-checkpoint loop; the revise turn is a net-new insertion into that loop (§15 item 3). A builder must decide: does the agent see its own attempt-1 trajectory in the revise turn, or only the workspace files?

**Wrong-build failure mode.** If the revise turn includes attempt-1 conversation history, the agent has context about what it tried; if it doesn't, it's essentially a fresh agent looking at existing code. These produce different revision behaviors. The plan's decomposition (§4: "C1 vs T1 = deterrence, C-final vs T-final = +feedback") assumes the revise turn is a *comparable* intervention across arms, but if the session mechanics differ from what the plan implicitly assumes, the decomposition is contaminated.

**Required change.** State explicitly: "The revise turn is a fresh CLI invocation with the attempt-1 workspace state (files only, no conversation history), receiving the revise prompt as its initial instruction." Or state the alternative. Either way, it must be in the pre-registration text, not left to the builder. Record the exact CLI invocation command in the manifest.

---

### 3. §2.3 / §15 item 2 — On-demand runner interface is undesigned

**Issue.** Arm T has "a documented on-demand runner invocable by the agent at any time while working." But: What is the invocation command? (`pytest features/`? `./run_scenarios.sh`? A Makefile target?) Where in the workspace is it documented? (A README? A comment in the feature file? The system prompt?) Does the agent discover it or is it told? The plan says the runner is part of the "declared T-delta" but never specifies the *discovery mechanism*. The arm-parity validator (§2.4) byte-diffs "modulo the declared T-delta allowlist"—but the allowlist is never enumerated.

**Wrong-build failure mode.** The builder puts a `run_tests.sh` in the workspace root with no documentation. The agent never discovers it. Runner-usage rate (§6.3) is ~0%. The treatment reduces to "having .feature files in the workspace" (a file-presence effect, not a feedback effect). The ITT analysis is valid but the *mechanism interpretation* is wrong, and the null (if it occurs) is uninterpretable: was it the feedback that failed, or the discovery?

**Required change.** Specify the runner interface: exact command, location in workspace, and the instruction text that tells the agent it exists (this instruction is part of the T-delta and must be in the parity allowlist). Enumerate the T-delta allowlist as a normative list: `{feature files, step-definition files, runner script, runner-documentation block in the checkpoint prompt, completion-time output injection}`. Everything else must be byte-identical.

---

### 4. §3.2 — Coverage-map "mechanical first-pass" is an algorithm the builder must invent

**Issue.** "A mechanical first-pass (name/behavior matching of check assertions to scenario clauses)" is the entire specification of how ~200+ hidden-referee checks get mapped to visible scenarios. What matching? String similarity on test names vs. Gherkin step text? AST-level assertion extraction compared to scenario clauses? Embedding similarity? This is a validity-critical artifact: the covered/uncovered split governs the claim rule (§6.2 criterion 1b). A builder who implements a loose matcher over-labels as "covered" (inflating the covered fraction, potentially triggering the >2/3 pre-commitment language); a strict matcher under-labels (deflating it).

**Wrong-build failure mode.** The mechanical pass produces a mapping that the 10% human audit catches at >10% disagreement, forcing a full re-label of multiple chains. Or worse: the audit catches <10% disagreement (because the sample is small) but the systematic bias direction is consistent, and the covered fraction lands at 64% vs. 69%—changing whether the >2/3 pre-commitment language fires.

**Required change.** Specify the matching algorithm concretely (e.g., "extract the assertion target and expected behavior from each pytest assertion via AST parsing; match to Gherkin steps by exact clause-substring containment after lowercasing and stopword removal; unmatched checks default to 'uncovered'"). State the default direction for ambiguous cases (uncovered—conservative for the claim). Freeze the matching script's hash.

---

### 5. §2.2 / r19 — Archive-step workspace drift: "detected and logged" has no stated consequence

**Issue.** The plan acknowledges that the OpenSpec archive step's MODIFIED-replace behavior can rewrite accumulated scenario text in the workspace, and that arm T's mirrored feature files interact with this. The resolution: "workspace drift from the archive step is detected and logged, not silently re-hashed." But: if drift IS detected, what happens to the run? Is it a validity flag? Does the run continue? Is the checkpoint excluded? The plan says the T-suite hash check is "against the frozen catalog text, never against post-archive workspace state"—so the hash check passes even if the workspace has drifted. The agent is then working from drifted text while the hash says everything is fine.

**Wrong-build failure mode.** The archive step rewrites a scenario clause at checkpoint 4. The agent in arm T sees the rewritten text; the agent in arm C sees the same rewritten text (the archive step runs identically in both arms). The hash check passes (it references the frozen catalog). But the *actual task* the agent is solving has silently changed from what was frozen. Neither arm is solving the pre-registered task. This is a silent-divergence that the stated checks do not catch.

**Required change.** Specify: (a) the archive step's output is hashed and compared to the frozen catalog text at every checkpoint transition; (b) if divergence exceeds a stated threshold (e.g., any byte difference in scenario blocks), the checkpoint is flagged `archive_drift` and the run continues but is excluded from the primary unless a sensitivity including it agrees (under the R7 weaker-reading rule); (c) the rung-2 shakedown must verify zero drift on its 4 chains, or the archive wrapper is fixed before rung 3.

---

### 6. §15 item 1 / §2.3 — File layout and injection mechanics for the T-delta are unspecified

**Issue.** Where in the workspace do the .feature files live? What directory? What naming convention? Where are step definitions? Is there a `conftest.py`? A `pytest.ini`? A `requirements.txt` for the test dependencies? The plan says "per-checkpoint injection hook (`_setup_for_checkpoint`)" but doesn't specify what files are injected, in what structure, or how the runner discovers them. The control arm must have *none* of this—structural absence. But "structural absence" of what exact file tree?

**Wrong-build failure mode.** The builder creates a reasonable structure. It turns out the agent's file-exploration behavior is sensitive to directory naming (e.g., `tests/` vs `features/` vs `acceptance/`). The control arm's structural absence is correct, but the treatment arm's file layout inadvertently cues the agent toward a particular implementation strategy (e.g., a `conftest.py` that imports the application module, revealing the expected import path). This is a confound in the T-delta that the parity validator won't catch because it's *within* the allowlisted files.

**Required change.** Freeze the exact file tree for the T-delta as a normative appendix (directory names, file names, file contents modulo the scenario text). State that no file in the T-delta may import, reference, or reveal the application's module structure beyond what the scenario prose already states. The parity validator's allowlist references this frozen tree.

---

### 7. §5 / §15 item 3 — "pass_policy: any-case" + broken code + next checkpoint: agent starting state unspecified

**Issue.** The plan states chains run all checkpoints regardless of intermediate failures. If checkpoint 3's agent leaves the codebase in a non-importable state, checkpoint 4's agent starts from that broken state. The plan handles *grading* (all active checks fail → regression events) but doesn't specify the *agent's experience*: does checkpoint 4's agent get the broken code as its workspace? Does it get an error message? Does the OpenSpec workspace show the previous checkpoint's spec as "done"? This affects whether the agent can recover, which affects whether later-checkpoint regression events are "real" regressions or artifacts of an unrecoverable break.

**Wrong-build failure mode.** The builder passes the broken workspace forward silently. The agent at checkpoint 4 spends its entire budget trying to fix the import error, never implements the new feature, and all previously-passing checks still fail. This generates regression events that are mechanically real but substantively different from "implemented the new feature and broke an old one." The event-type decomposition (chain-broken vs behavioral, R7) partially addresses this, but the plan doesn't specify whether the `chain_broken` annotation applies to *all subsequent checkpoints* or only the one where the break occurred.

**Required change.** State: (a) the agent at checkpoint k receives the workspace as left by checkpoint k−1, whatever its state; (b) `chain_broken` annotates the checkpoint where the break occurred AND all subsequent checkpoints in that chain (the chain is broken from that point); (c) the chain-broken sensitivity (§13.3) excludes events at and after the break point. This is probably what the builder would do, but it must be stated.

---

### 8. §7 — Interactive-class enumeration criterion is a judgment call with no operational definition

**Issue.** "Every `interactive_session`-fixture test—and any test judged similarly timing-sensitive." The first half is mechanical (grep for the fixture name). The second half—"judged similarly timing-sensitive"—is a human judgment with no stated criterion. Who judges? When? What evidence triggers inclusion? The class list is frozen at QC, but the *rule for membership* is vague. A builder (or the operator doing QC) must decide whether a test that uses `time.sleep(0.1)` is "similarly timing-sensitive."

**Wrong-build failure mode.** The operator, under time pressure, includes only the mechanically-identifiable `interactive_session` tests and skips the judgment calls. A timing-sensitive test outside the class fires a false regression under fail-any. At N=33, one asymmetric false event can flip a discordant pair to concordant, diluting the effect. The plan's own arithmetic (§7) shows this is a ~27% per-snapshot false-event probability at f=0.10.

**Required change.** Operationalize the judgment: "A test is in the interactive class iff it (a) uses the `interactive_session` fixture, OR (b) contains `time.sleep`, `select`, `poll`, `asyncio.sleep`, or subprocess-with-timeout calls in its body or in any helper it imports, OR (c) failed the 3× general screen at QC (automatic inclusion). The enumerated list is frozen; any test added later (authored chains) is classified by the same rule before admission."

---

### 9. §12 / §14 — Wall-clock schedule is unstated and likely does not close for one operator

**Issue.** The plan never states a timeline. Let me estimate: Authoring 10 chains (~54 checkpoints: scenarios + step definitions + probes + lifecycle metadata) + coverage map for 41 chains (~221 checkpoints × multiple checks) + QC screens (flake 3×/10×, discriminating-check, agreement check) + Rung 0 (3 chains) + Rung 1 (8 chains, ~43 checkpoint-runs) + Rung 2 (4 chains × 2 arms, ~43 runs) + Rung 3 (33 chains × 2 arms × 2 attempts = ~713 agent sessions, each 5–30 min) + Codex slice (8 chains × 2 arms × 2 attempts = ~173 serial sessions, up to 2h each) + 3× referee grading on every snapshot (~2,100+ evaluations). Even with AI assistance for authoring, the authoring + QC alone is 4–8 weeks of focused work. The runs add 3–6 weeks (rate-limited). The codex slice alone, serialized, is ~2 weeks of wall-clock.

**Wrong-build failure mode.** Not a wrong build per se, but the plan's silence on schedule means the operator cannot assess feasibility at ratification. If the authoring takes 3× longer than expected (step definitions are finicky Python that must actually run), the project stalls mid-QC with sunk cost and no published result.

**Required change.** Add a §12.8 or §14 row: "Estimated operator-weeks by phase: authoring+QC: X; Rungs 0–2: Y; Rung 3 + codex: Z; analysis: W. Total: T weeks at sustained full-time-equivalent effort. Abort/re-scope trigger: if authoring+QC exceeds [date], the authored-chain count drops from 10 to [N'] with corresponding MDE adjustment."

---

### 10. §15 item 5 — Freeze manifest contents are listed but not schema-specified

**Issue.** The manifest must contain: all pins, hashes, session-separation records, rendered prompts, trajectories, snapshots, referee JSONs, usage telemetry, QC records. But there's no schema. What format? (JSON? YAML? A directory tree?) What's the hash algorithm? (SHA-256?) What's the directory structure? How is the manifest itself hashed and where is that hash recorded? The plan says "a run missing any of these is non-replay-valid" but doesn't specify how completeness is checked mechanically.

**Wrong-build failure mode.** The builder implements a reasonable manifest. Six months later, during analysis or external review, a field is missing or a hash doesn't match because the manifest schema was ambiguous. The run is declared non-replay-valid and excluded. At N=33, losing 2–3 chains to manifest incompleteness materially affects power.

**Required change.** Freeze a manifest schema (JSON Schema or equivalent) as a normative appendix. Include a `manifest_completeness_check` script that runs at the end of each run and asserts all required fields are present and all hashes verify. The script's hash is itself in the freeze.

---

### 11. §4 / §12.4 — Revise-turn budget is unspecified

**Issue.** "Identical step/timeout budgets per arm" is stated for the main attempt. But the revise turn—is it a fresh budget (another 100 steps / 7200s) or a continuation of the exhausted budget? If the agent used 95 of 100 steps in attempt 1, does the revise turn get 5 steps or 100? The plan says "one revise turn both arms, identical structure" but doesn't state the budget allocation.

**Wrong-build failure mode.** The builder gives the revise turn a fresh budget. This is probably correct, but if the plan intended a shared budget, the treatment arm (which may have spent steps running the on-demand runner) enters the revise turn with fewer steps than control. Or vice versa: if the budget is shared and the treatment arm spent 20 steps on runner invocations, its revise turn is shorter. Either way, the asymmetry is a parity violation that the arm-parity validator should catch—but only if the validator knows the intended rule.

**Required change.** State: "The revise turn receives a fresh budget identical to attempt 1 (step_limit: 100 / timeout: 7200s), independent of attempt-1 consumption." Or state the alternative. Record the actual budget consumed per attempt in the manifest.

---

### 12. §3.3 — "Line-audited against it" for step definitions has no procedure

**Issue.** Step definitions are "frozen literal translations of the scenario prose, line-audited against it." What does "line-audited" mean mechanically? Does every Gherkin step have exactly one step-definition function? Must the step-definition's assertion match the scenario's expected outcome verbatim? Who does the audit? Is it recorded per-step or per-scenario? This is the binding that determines what the visible suite actually tests—and therefore what the coverage map says is "covered."

**Wrong-build failure mode.** The builder writes step definitions that are *functionally* correct but not *literally* translations (e.g., the scenario says "the output file contains exactly 3 lines" and the step definition asserts `len(lines) == 3` but also strips trailing whitespace, which the scenario text doesn't mention). The coverage map says this check is "covered" by the scenario, but the step definition tests something slightly different. The binding-vs-referee agreement check (§3.3, ≥0.90) catches gross mismatches but not subtle strictness differences.

**Required change.** Specify: "Each Gherkin step maps to exactly one step-definition function. The step-definition's assertion must implement the scenario clause's literal semantic content with no additional normalization, filtering, or tolerance not stated in the scenario text. The audit is recorded as a per-scenario checklist (scenario_id, step_index, step_text, step_def_function, assertion_code, auditor_initials, date) in the freeze manifest."

---

### 13. §12.6 — Tamper detection: "detected by diff and logged" has no stated run-level consequence

**Issue.** If the agent modifies workspace copies of scenario/step files, this is "detected by diff and logged as a tamper metric." But: does the run continue? Is the checkpoint excluded from the primary? Is it a validity flag? The plan says "per-protocol sensitivity may exclude tampered checkpoints" but the *default* (ITT) includes them. If the agent modifies the step definitions to make them pass, the visible-suite run is meaningless, but the hidden referee still grades correctly. The ITT analysis is valid, but the *mechanism interpretation* (runner-usage rate, feedback actionability) is contaminated.

**Wrong-build failure mode.** Not a wrong build, but the plan should state the default consequence explicitly so the builder doesn't have to decide. If the builder silently excludes tampered checkpoints from the runner-usage metric, the mechanism measure is biased.

**Required change.** State: "Tampered checkpoints remain in the ITT primary. Tamper events are logged per-checkpoint. The runner-usage rate and feedback-actionability metrics are computed on the subset of non-tampered checkpoints, with the subset size reported. The per-protocol sensitivity (§13.3) excludes tampered checkpoints entirely."

---

### 14. §8 / §15 item 9 — Authored-chain authoring has no template or workflow specification

**Issue.** The plan specifies *admission criteria* for authored chains (length strata, dependency density ≥ native median) but not the *authoring procedure*. How does the operator create a new chain "in-format"? What's the template? Must the prose spec be written first, then scenarios derived? Or scenarios first? The firewall (§3.3) says scenario authors can't open hidden test files—but for *authored* chains, there ARE no upstream hidden test files. The operator writes everything. The firewall's session-separation still applies (probes in a separate session from scenarios), but the plan doesn't specify how the operator creates the "hidden referee" for an authored chain. Is it the upstream-format pytest suite? Who writes it?

**Wrong-build failure mode.** The operator writes the hidden tests and the visible scenarios in the same mental session (even if different computer sessions), because they're both being created from scratch. The firewall's session-separation is mechanically satisfied but substantively empty—the "hidden" tests are written by someone who knows exactly what the visible scenarios test. The covered fraction for authored chains is artificially high. The provenance sensitivity (§13.3) catches this at the analysis level, but the *design* doesn't prevent it.

**Required change.** For authored chains, specify: (a) the prose spec is written first and frozen; (b) visible scenarios are derived from the prose spec in a session that has not seen the test code; (c) hidden tests (referee) are written in a separate session from the prose spec, asserting behaviors implied by the spec but not enumerated in the visible scenarios; (d) held-out probes are written in a third session. Acknowledge that for authored chains, the firewall is weaker than for native chains (where the hidden tests pre-exist), and state this as a limitation in the provenance sensitivity.

---

### 15. §12.7 / §12.1 — Rate-limit asymmetry within a pair: logged but not gated

**Issue.** "Paired back-to-back runs share subscription state, and asymmetric backoff within a pair must be visible, not assumed away by order randomization." Good. But: what if arm C's run hits a rate limit and backs off for 10 minutes, while arm T's run (running second) gets full throughput? The agent in C loses 10 minutes of its step budget to waiting. The plan logs this but doesn't state whether it's a validity flag, a covariate, or ignored. At the subscription tier, rate limits can be severe (hours of cooldown).

**Wrong-build failure mode.** A systematic asymmetry (e.g., the first run in a pair always gets better throughput because the second run hits the cooldown) aliases with arm assignment if the within-pair order randomization is unbalanced by chance. At N=33, a 60/40 split in order is plausible. The plan randomizes order, but doesn't state a check for order-arm correlation in the validity review.

**Required change.** State: "At the validity-flag review, the correlation between within-pair run order and arm assignment is checked; if |r| > 0.2 or a Fisher exact test on order×arm gives p < 0.1, the affected pairs are flagged and a sensitivity excluding them is run under the R7 weaker-reading rule. Rate-limit backoff duration is recorded per run and reported in the cost table."

---

## C. INSISTED REQUIREMENTS

**1. Freeze the feedback output template and the revise-turn session mechanics as normative appendices before seal.**

The treatment channel (feedback format) and the matched-ritual comparator (revise-turn mechanics) are the two interfaces that *define the estimand* at the implementation level. Without a byte-level spec of both, the pre-registration promises an estimand that the build can silently alter. These must be frozen artifacts with hashes in the manifest, not builder decisions. Specifically: (a) a worked-example output template for the runner feedback, hashed; (b) an explicit statement of whether the revise turn is a fresh session or continuation, with the exact CLI invocation; (c) the T-delta file-tree enumeration. If the operator declines to freeze these at pre-registration, the reason must be on record and the rung-2 shakedown must validate them before any rung-3 spend, with a stated rework budget.

**2. Add a manifest schema and a mechanical completeness-check script to the freeze.**

The replayability guarantee (§12.5) is only as strong as the schema that defines "complete." Without a frozen schema and an automated check, "non-replay-valid" is a judgment call made months after the run, under analysis pressure. The completeness check must run at the end of every run (not at analysis time) and its pass/fail must be in the manifest. This is cheap to build and prevents the worst silent-divergence: a run that *looks* complete but is missing a hash, a snapshot, or a session-separation record.

**3. State the operator-week estimate and a re-scope trigger for the authoring phase.**

The plan's feasibility hinges on the authoring workload (10 chains + coverage map for 41 chains + QC screens). This is the longest pole and the least parallelizable. The pre-registration must state the estimated weeks and a pre-declared re-scope trigger (e.g., "if authoring+QC is not complete by [date], N drops to 23 native-only with MDE ≈ 40pp"). Without this, the operator faces a sunk-cost trap mid-build with no pre-authorized exit.

---

## D. TOP 3 RISKS

1. **Feedback-content drift.** The minimized feedback format is the entire treatment channel; it is specified at the level of a sentence, not a schema, and the formatter code is not hashed—any bug-fix or "improvement" to the formatter between rung 2 and rung 3 silently changes the treatment without triggering a compatibility boundary.

2. **Authoring-phase stall.** The authoring + QC workload (10 authored chains, 41-chain coverage map, per-checkpoint probes, step-definition coding, flake screens) is the binding constraint on the schedule, is the least automatable, and has no pre-declared re-scope trigger—risking a half-built project with no publishable output.

3. **Archive-step workspace drift silently altering the frozen task.** The OpenSpec archive step's MODIFIED-replace behavior can rewrite scenario text in the workspace at every checkpoint transition; the plan's hash check references the frozen catalog (so it passes), but the agent works from the drifted text—creating a silent divergence between the pre-registered task and the actual task that no stated check catches at the run level.

---

## E. NEW FACTUAL CLAIMS

- The Claude Max subscription tier imposes per-hour or per-day usage caps that could stretch 713 agent sessions (rung 3, both arms, both attempts) over 2–4 weeks of wall-clock even at 15 min/session average. **[VERIFY]** — the plan does not state the specific rate limits of the subscription tier in use.

- The upstream SlopCodeBench harness's `_setup_for_checkpoint` hook is the correct insertion point for per-checkpoint file injection and is called before the agent session starts. **[VERIFY]** — the plan references this function name (§15 item 1) but I cannot confirm its exact call signature or whether it supports arbitrary file injection without code modification.

- The `openspec` CLI archive step's MODIFIED-replace behavior rewrites the *entire* accumulated scenario file, not just the delta, at each checkpoint transition. **[VERIFY]** — the plan asserts this hazard (§2.2, r19) but the exact rewrite semantics determine whether the drift risk is per-checkpoint or per-word.

- At the Claude Max subscription tier, the `claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN` path supports sustained scripted usage (700+ sessions over weeks) without triggering account-level rate limiting distinct from per-session limits. **[VERIFY]** — the plan states this is "the documented path for scripts/CI" but sustained multi-week scripted use may hit different limits than CI bursts.

- The upstream harness's per-checkpoint snapshot mechanism captures the full workspace filesystem state (not just a git diff), enabling the revise turn to start from the exact attempt-1 state. **[VERIFY]** — the plan lists "per-checkpoint snapshots + diffs" as upstream-native but doesn't confirm whether the snapshot is a full filesystem copy or a git commit, which affects whether the revise turn can be a fresh process.