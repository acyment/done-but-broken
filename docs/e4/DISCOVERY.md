# E4 Phase 0 — Discovery

Date: 2026-07-08. Repo audited at commit `6b1bbb5` (working tree dirty with docs only; `docs/e4/` is
untracked). Companion deliverable: `docs/e4/AGENTS-AMENDMENT-PROPOSAL.md` (proposed, NOT applied).
Inputs: `E4-DESIGN-BRIEF.md`, `BASE-DECISION.md` (verified and extended, not re-derived), full test
run, and a code-level sweep of `src/`, `bin/`, `test/`, `tasks/`, `docs/protocols/`, `runs/`.

Environment note: the MCP "Ahma" shell-redirection directive observed in BASE-DECISION §7 was active
again during this discovery and was again disregarded; all inspection used the standard tools,
read-only except for the two Phase-0 deliverables in `docs/e4/`.

---

## 1. Inventory — what actually exists

### 1.1 Repo shape and entry points

TypeScript/bun; dependencies are `js-tiktoken` (runtime) and `@fission-ai/openspec@1.4.1` (dev,
pinned) only (`package.json`). Layout: `src/` (~40 modules), `bin/` (5 CLIs), `test/` (49 test
files + fixtures/support), `tasks/` (14 task packages), `docs/` (protocols, run-cards, task-cards,
papers, evidence ledgers), `runs/` (118 run directories), `log/` (operational logs).

Entry points (`package.json:7-16`):

| Script                     | Runs                    | Purpose                                                                                                                                                           |
| -------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e1`                       | `bin/e1.ts`             | The E1 provider run: mounts a task package, runs both arms, scores, emits bundle. `--transport=canned\|live` (canned default; live requires explicit gate + key). |
| `e1:stats`                 | `bin/e1-stats.ts`       | Turn/termination/token stats from a bundle JSON.                                                                                                                  |
| `e1:inspect`               | `bin/e1-inspect.ts`     | Replay + tamper verification of an E1 bundle.                                                                                                                     |
| `inspect:run`              | `bin/inspect-run.ts`    | Evidence-status summary from run artifacts (older layout).                                                                                                        |
| `pilot:run` / `pilot:fake` | `bin/run-fake-pilot.ts` | The **legacy** `runPilot` orchestration (fake/OpenRouter/model-loop agents).                                                                                      |

### 1.2 Two parallel run systems (load-bearing fact for E4)

The repo contains **two top-level orchestrators for two different task formats**:

1. **The E1 stack (current, sealed):** `bin/e1.ts` → `runE1TaskPackageProvider`
   (`src/e1-package-runner.ts:513`) → per-checkpoint turn loop `runE1NoProviderCheckpoint`
   (`src/e1-no-provider-runner.ts:351`) → `E1TurnAdapter` (`src/e1-turn-adapter.ts`) → L0 primitives
   in `src/e1-harness.ts`. Provider: single `E1OpenAICompatibleAgentProvider`
   (`src/e1-live-provider.ts:129`) with `canned|live` transports. Task format:
   `tasks/<id>/task-package/` + `oracle-package/` (`e1-task-package-v0`). Tasks: `e1-cartcalc`,
   `e1-cartcalc-openspec`, `e1-billing-v2/-v3`, `e1-dispatch`, `e1-dispatch-mini`.
2. **The legacy `runPilot` stack (superseded, still green):** `bin/run-fake-pilot.ts` → `runPilot`
   (`src/runner.ts:179`) with generic `AgentAdapter`s (`fake`, `openrouter`, `openrouter-loop`,
   `openai-compatible-loop`; `src/model-loop-agent.ts`, `src/openrouter-agent.ts`). Task format: flat
   lifecycle dirs (`sample-cart`, `pricing-discount-lifecycle`, …) loaded by `src/task-package.ts`.

`src/e1-harness.ts` is not an orchestrator: it is the L0 mechanics library (replacement application,
command validation, protected-path hashing, verification execution) shared by the E1 stack.

**Inconsistency worth recording:** OpenRouter is retired-by-guard in the E1 path — `bin/e1.ts:155-159`
throws on any `openrouter.ai` endpooint ("OpenRouter routes are retired (operator decision
2026-06-11)") — but the legacy pilot stack still fully wires OpenRouter agents
(`bin/run-fake-pilot.ts:284,338`, `src/index.ts:5`, `runner.ts:303-311`) with live default constants
and passing tests. Not a defect for E1 (the guard holds on the operational path), but E4 must build on
the E1 stack's patterns and must not extend the legacy stack.

### 1.3 The L0/L1 turn protocol and `done_literal` mechanics

Three-layer decomposition per `docs/protocols/e1-self-directed-verification-turn-based-v0.md:17-23`:
**L0** = mechanics (full-file replacement, command validation, protected paths, verification
execution, truncation, hashes) in `src/e1-harness.ts`; **L1** = agent-loop adapter (block-grammar
parsing, conversation assembly, verification-output injection, token ledger, provider-failure
separation) across `src/e1-l1-parser.ts`, `src/e1-turn-adapter.ts`, `src/e1-no-provider-runner.ts`,
`src/e1-provider-runtime.ts`; **L2** = run orchestration, defined in the protocol doc but implemented
only as the dev-grade package/no-provider runners.

Per checkpoint: fresh conversation (sealed three-message layout, `src/e1-l1-constants.ts:67-70`), max
12 model turns, 6 verification executions, no-op stall threshold 3, 4000-token verification-output cap
(sealed `turn_protocol`). Each turn is parsed in fixed precedence: full-file replacement blocks
(`<<<FILE path>>>…<<<END>>>`), at most one `<<<VERIFY>>>` block (one command), one optional done
declaration. Verification output is injected verbatim at the start of the next turn.

**`done_literal`:** the completion claim is the bare token `<<<DONE>>>`
(`e1-frontier-sealed-constants-v1.0.json`, `block_grammar.done_literal`), matched exactly at
`src/e1-l1-parser.ts:136` and carried as a plain boolean on `E1ParsedTurn` (`:29`). No truth
validation at parse time; the adapter honors it only after replacements + verification + integrity
checks (`src/e1-turn-adapter.ts:260,313`). Grammar tokens are **data-driven from the sealed constants
JSON**, so a different constants file can redefine markers without touching the parser — but the
constants *validator* (`src/e1-l1-constants.ts`) hardcodes the E1 schema string, the two condition
IDs, and workspace roots, and the command classifier (`src/e1-l1-command.ts`) hardcodes literal `bun`
command shapes. There is today **no structured completion claim** (no payload on DONE) and no plug
point for one; extension requires a new grammar token + widened `E1ParsedTurn` + the two adapter done
sites.

Checkpoint continuation is already sequential-state-shaped: `done` and `budget_exhausted` both
continue the next checkpoint **from the workspace as-is** (sealed `checkpoint_continuation`);
`agent_stalled` does not abort the run (pinned by `test/e1-l1-shakedown-e2e.test.ts`); only
`invalid_integrity`, `provider_error`, `spend_cap_reached` end a run.

### 1.4 Sealed-constants mechanism, and how an E4 lineage coexists

- Seal file: `docs/protocols/e1-frontier-sealed-constants-v1.0.json` — `schema
  "e1-sealed-constants"`, `version "1.0.0"`, `status "sealed"`, `supersedes` the v0.2 file (whose
  *internal* version is `0.3.4`, status `draft-pre-seal` — filename and internal version diverge in
  the draft lineage).
- Enforcement is **(a) load-time value validation** — `validateE1Constants`
  (`src/e1-l1-constants.ts:229-424`) pins the exact top-level key set and dozens of literal sealed
  values (conditions, retry policy, sampling, token estimator js-tiktoken/o200k_base/1.0.21, turn
  protocol, grammar regexes, truncation sum) — plus **(b) run-to-seal hash binding**: every bundle
  stamps `constants_version` + `constants_hash` and a constants-derived `prompt_template_hash`;
  `inspectE1Bundle` refuses replay on constants-version drift (`src/e1-inspect.ts:70-121`). There is
  no file-hash-in-manifest binding of the constants document itself. Evidence grade requires
  `status === "sealed"` plus a protocol-document hash (`bundleGrade`,
  `src/e1-package-runner.ts:1313-1318`); drafts can only produce `dev` bundles.
- **Coexistence precedent:** the OpenSpec profile (`docs/protocols/e1-openspec-workflow-constants-v0.json`,
  its own schema `"e1-openspec-workflow-constants"`, sealed 1.0.0) *layers on* the base seal by
  file+version reference (`src/e1-openspec-constants.ts:42-67`) without modifying it. **An E4 lineage
  follows this pattern: its own schema string (`e4-sealed-constants`), its own validator, its own
  draft→sealed progression — it cannot and must not reuse `validateE1Constants`, which would reject
  E4's condition IDs by design.** The loader itself (`loadE1Constants(path)`) is path-parameterized;
  only `bin/e1.ts:47` / `bin/e1-inspect.ts:9` hardcode the E1 file.

### 1.5 Agents-under-test: provider/preset layer

- E1 path: one OpenAI-compatible chat-completions provider; transport `canned` (hard-coded CartCalc
  responses + fabricated usage, zero spend, exercises the full ledger/cache/budget path —
  `bin/e1.ts:86,189-209`) or `live` (`createFetchE1ProviderTransport`, `src/e1-live-provider.ts:331`;
  requires the explicit live-mode gate, else `E1LiveModeRequiredError`).
- Presets: closed union `["litellm","deepseek","alibaba-qwen"]` (`src/model-provider-presets.ts:1`),
  each with endpoint + `api_key_env` + route; overridable via `MODEL_LOOP_*` env vars; E1 side uses
  `E1_MODEL`/`E1_ENDPOINT`/`E1_ROUTE_ID` (`bin/e1.ts:400-402`). Keys come from `.env` via `Bun.env`,
  are passed as redaction secrets, and `assertE1NoSecretsInJson` fails bundle emission closed if a
  raw key would be recorded (`src/e1-redaction.ts:47-60`, `src/e1-live-provider.ts:137`).
- Two model lineages "supported by config" (brief §9) is real: presets `deepseek` and `alibaba-qwen`
  are direct endpoints; `litellm` proxies anything else.

### 1.6 Budgets, retries, failure taxonomy

- Turn budget: sealed 12 turns / 6 verifications per checkpoint; optional per-checkpoint token budget
  via `E1TokenLedger`; spend cap enforced **pre-call** from estimated max call cost
  (`enforceLiveGate`, `src/e1-live-provider.ts:246-261`).
- Retries: `callE1ProviderWithRetries` (`src/e1-provider-runtime.ts:67`), sealed policy 3 attempts /
  backoff [250,1000,4000] ms; failure kinds `api_error|timeout|rate_limit|malformed_response|network_error`;
  retries cost neither turns nor tokens; exhaustion → `provider_error`, run terminated and rerun only
  under a fresh identity (sealed `failure_policy`).
- Termination classifications (`src/e1-turn-adapter.ts:16-22`):
  `done | agent_stalled | budget_exhausted | invalid_integrity | provider_error | spend_cap_reached`.
  This taxonomy already separates "agent behavior" from "infrastructure failure" — exactly the
  distinction brief §8 needs between failed-task and drifted-spec accounting inputs.

### 1.7 Provenance, replay-validity, results storage

- Hashing: SHA-256 over files/dirs/text (`src/snapshot.ts`); workspace snapshot renderer
  `e1-workspace-snapshot-v1` over roots `scratch/ specs/ src/` (`src/e1-workspace-snapshot.ts`).
- E1 bundles (`e1-task-package-provider-bundle.json`) carry run identity (constants version+hash,
  task-package hash, oracle-package hash, prompt-template hash, seed-as-pairing-label, checkpoint
  sequence, budgets), **every model turn verbatim** (full-file replacements are the patch text),
  per-turn workspace hashes, a content-hash manifest with a manifest-of-manifests hash, and usage
  totals. `inspectE1Bundle` (`src/e1-inspect.ts`) re-verifies all identity hashes, recomputes every
  section hash, **replays** checkpoint evolution in a fresh mount, re-runs the OpenSpec archive step
  where declared, and re-scores oracles. Replay-valid = zero mismatches. The legacy `runPilot` layout
  (`run.json`/`result.json`/per-checkpoint `manifest.json`) has its own `validateReplayPlan` /
  `verifyRunArtifacts` machinery (`src/provenance.ts`).
- Results: `result-schema-v1` (`src/result-schema.ts`) with self-checking validation (recomputes
  primary metric, condition summaries, AUC from evaluations); `src/e1-stats.ts` summarizes bundles;
  `src/evidence-status.ts` derives validity/feedback-opportunity-integrity summaries.
- **Seed semantics:** sealed as `pairing_label_not_sampling_seed` — the E1 "seed" is a pairing label
  binding task/oracle/constants/prompt/budget hashes, NOT an RNG seed. E4's substrate-generation seed
  is a different concept and needs its own field and machinery (see transfer map and corrections).

### 1.8 OpenSpec workflow integration

Pinned `@fission-ai/openspec@1.4.1`, version-asserted before every call, telemetry neutralized
fail-closed, output normalized+hashed (`src/e1-openspec-workflow.ts`). Profile
`e1-openspec-workflow-v0` (sealed constants file layered on the E1 base): spec-of-record under
`openspec/specs/` is **read-only to the agent**; agents author deltas under `openspec/changes/`; the
harness-owned archive step (`openspec archive <change> --yes`) at checkpoint end is the only
spec-of-record mutator, identical in both arms. Documented gotchas all confirmed in code: exit-0
abort (failure detected via stdout sentinel + change-dir persistence,
`src/e1-openspec-harness.ts:224-244`), dated archive dirs renamed deterministically for replay,
failed archive = agent outcome, MODIFIED-replace block semantics as a prose-regression surface
measured by a survival ledger (`metric_role: "secondary_descriptive"`). Scenario parity across arms is
canonical-text comparison at fresh mount only.

**Finding for brief §13 Q3:** the OpenSpec integration never executes scenarios — it is an
archive/workflow + descriptive-parity mechanism, with no red/green evaluation anywhere. As a candidate
Arm-H gate it contributes the *workspace conventions, pinned-CLI discipline, and spec-of-record
custody pattern*, but "scenarios exist and fail red before implementation" requires new executable
machinery (the harness running generated/authored acceptance checks pre-implementation). The Q3 ADR
should treat OpenSpec as a workflow substrate option, not an enforcement engine.

### 1.9 Hidden oracles

Six oracle modules share one pattern: `createXOracle()` → `HiddenOracleAdapter.run(input)`;
cumulative `COMMITMENTS_BY_CHECKPOINT` maps (checkpoint k's commitments ⊇ k−1's — the no-regression
encoding); the oracle imports the agent's workspace module in a fresh child process with fixed inputs
and parses a sentinel-prefixed JSON line (5 s timeout). Isolation is enforced, not conventional:
`assertHiddenOracleOutsideAgentReadableWorkspace` (`src/runner.ts:711-718`) plus "oracle never
mounted" in the sealed constants. The E1 package path supports oracle kinds `cartcalc-json-v0` and
`module-call-json-v1` — both in-process/module-call; **no HTTP-transport oracle exists** (relevant to
brief §13 Q6).

### 1.10 Test coverage of the harness itself

379 tests / 49 files, all green in 78.8 s with provider keys stripped (re-verified this session, exit
0). Coverage by concern: parser/grammar shakedown (23-test battery + e2e archetypes), turn adapter
(stall/budget/integrity/done ordering), sealed-constants pinning (`e1-protocol-constants.test.ts`
pins schema/version/status and every sealed policy), provenance/tamper (58.9K `provenance.test.ts` +
expected-mismatch fixtures), replay/inspection (incl. constants-version-gated replay), rendering
parity, feedback gating, run classification/compatibility pooling rules (43K
`run-compatibility.test.ts`), hidden-oracle isolation + six per-oracle suites, OpenSpec
characterization (pins the CLI's abort/telemetry quirks), provider transport/retry, CLI, stats, and
four end-to-end task suites. The Smart-TDD list in AGENTS.md is genuinely implemented, not
aspirational.

---

## 2. Transfer map (brief §2–§9)

Verdicts: **as-is** (usable unchanged), **modify** (pattern/code reused with E4-specific changes),
**build** (nothing exists), **conflict** (repo or governance contradicts the brief).

| #   | E4 requirement (brief)                                                                                         | Verdict                | Justification                                                                                                                                                                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §2  | Sequential tasks, state k→k+1                                                                                  | **modify**             | `checkpoint_continuation: continue_from_workspace_as_is` + fresh-conversation-per-checkpoint is the exact skeleton; E4 re-scopes "checkpoint" to "task in sequence".                                                                                                                                                                    |
| §2  | One fork per arm                                                                                               | **as-is**              | Per-condition workspace mounts (`runRoot/workspaces/<conditionId>`, `e1-package-runner.ts:563-573`) already isolate arms.                                                                                                                                                                                                               |
| §2  | Crash-resume mid-sequence                                                                                      | **build**              | No resume machinery anywhere; runs are single-process, restart = new run identity. (ADR Q5; `-e2`'s `e3/` pattern is read-only reference.)                                                                                                                                                                                              |
| §3  | Three arms 0/M/H                                                                                               | **build** + governance | Two-condition set is hard-closed in ≥6 places (`conditions.ts`, constants validator, task-package validation, record literals, gating string-equality, `test/conditions.test.ts`). E4 needs its own conditions module + `ArmPolicy`; touching E1's is neither needed nor allowed. Requires the AGENTS.md amendment.                     |
| §3  | Paired identical sequences/seeds across arms                                                                   | **modify**             | Arm-parity validator + allowlist diff (`validateE1RuntimeArmParity`) is the right pattern; rewrite for 3 arms and E4 content. Seed-as-pairing-label transfers as-is for pairing.                                                                                                                                                        |
| §3  | Spec-touch rate manipulation check                                                                             | **modify**             | Not recorded today, but every turn's FILE-replacement paths are in the bundle — derivable by classifying replacement paths against spec-artifact paths.                                                                                                                                                                                 |
| §4  | One reportable number per hypothesis                                                                           | **build**              | `result-schema-v1` is two-arm delta-shaped; E4 needs its own result schema. The recompute-and-validate pattern transfers.                                                                                                                                                                                                               |
| §5  | Typed schema IR, change ops, NL renderer, programmatic HTTP test-gen, conventions layer, per-turn ground truth | **build**              | Confirms BASE-DECISION: none of this exists anywhere in the repo. Clean-room per license rule.                                                                                                                                                                                                                                          |
| §5  | Seeded, deterministic substrate generation                                                                     | **build**              | No RNG-seeded generation machinery exists; E1 "seed" is a pairing label, not a sampling seed (sealed `seed_semantics`). E4 adds a true `substrate_seed`.                                                                                                                                                                                |
| §5  | Agent-maintained on-disk spec artifacts                                                                        | **modify**             | Inverse of the OpenSpec profile's custody (there the spec-of-record is agent-read-only, harness-mutated). The workspace-root + protected-path machinery supports either custody choice per config; E4 flips which paths are writable.                                                                                                   |
| §6  | Drift meter (inventory extraction + 3-way classification)                                                      | **build**              | Nothing exists. Versioning/freezing borrows the constants-lineage convention; isolation borrows the hidden-oracle isolation assertion pattern.                                                                                                                                                                                          |
| §6  | Meter ≠ oracle, agents never see meter                                                                         | **modify**             | `assertHiddenOracleOutsideAgentReadableWorkspace` + "oracle never mounted" are the enforcement precedents to replicate for the meter.                                                                                                                                                                                                   |
| §7  | Hidden-test pass rate                                                                                          | **modify**             | Oracle scoring + cumulative commitments transfer conceptually, but both existing oracle kinds are module-call; an HTTP-transport oracle kind must be built (Q6).                                                                                                                                                                        |
| §7  | False-confidence events via `done_literal`                                                                     | **modify**             | `done` termination + per-checkpoint oracle results are both in the bundle; the event = done ∧ oracle-fail is derivable. Richer structured claims need a grammar extension (new sealed token + parser/adapter changes — plug points identified in §1.3).                                                                                 |
| §7  | Budget-exhaustion flag; tokens/turns/wall-clock/cost                                                           | **as-is**              | Termination classification + token ledger + usage aggregation + wall-time already recorded per turn/checkpoint.                                                                                                                                                                                                                         |
| §7  | Drift-meter output, noticing probe                                                                             | **build**              | Meter is new; the probe is a new harness-owned extra prompt (fresh-conversation machinery makes it cheap; answer recorded, never fed back).                                                                                                                                                                                             |
| §7  | Snapshot reference                                                                                             | **as-is**              | Per-turn workspace hashes + snapshot renderer already exist.                                                                                                                                                                                                                                                                            |
| §8  | Smoke feedback all arms, oracle feedback H-only                                                                | **modify**             | L0 verification execution + injected-output channel transfer; but the command grammar is hardcoded to `bun` shapes (`e1-l1-command.ts`) — E4 defines its own command set (server start/smoke, gate commands) in its own constants lineage. Gating-by-arm must be `ArmPolicy`, not the existing `feedback_capable_spec` string equality. |
| §8  | Retry policy identical across arms; failed-task vs drifted-spec distinguishable                                | **as-is** / **build**  | Sealed provider failure policy is arm-independent already. The failed/drifted distinction is a new E4 schema requirement (inputs exist: termination class, oracle results, meter output).                                                                                                                                               |
| §9  | Within-task pairing, two lineages by config                                                                    | **as-is**              | Pairing-label semantics + preset layer cover it.                                                                                                                                                                                                                                                                                        |
| §9  | Constants versioning, new E4 lineage                                                                           | **modify**             | Follow the OpenSpec layered-profile precedent: own schema string + validator + draft→sealed lifecycle; E1 v1.0.0 file and validator untouched.                                                                                                                                                                                          |
| §9  | Machine-readable per-run manifest                                                                              | **modify**             | Bundle + run-identity + content-hash-manifest machinery is strong; E4 adds substrate seed/config, opportunity labels, meter version, arm.                                                                                                                                                                                               |
| §9  | Replay-validity retention (patch text, full traces)                                                            | **as-is**              | The E1 bundle already retains every turn verbatim (full-file replacements = the patches) and replays them under `inspectE1Bundle`. E4 keeps this and adds meter/oracle artifacts to the manifest.                                                                                                                                       |

**Conflicts with the brief: none at the technical level.** The only true conflict is governance
(AGENTS.md two-arm freeze), which the brief itself anticipates (§3, §10) — resolved by the amendment
proposal, applied only on gate approval.

---

## 3. Assumption checks

| Claim (source)                                                                                                   | Verdict                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 379/379 tests green, 49 files (brief §1, BASE-DECISION §3)                                                       | **Verified this session**: 379 pass / 0 fail / 49 files / 78.8 s, provider keys stripped, exit 0.                                                                                                                                                                              |
| Sealed constants v1.0.0 at `docs/protocols/e1-frontier-sealed-constants-v1.0.json` (brief §1)                    | **Verified** (schema `e1-sealed-constants`, status `sealed`; v0.2 filename holds internal 0.3.4 draft — BASE-DECISION §6.2 confirmed).                                                                                                                                         |
| L1 completion claim is a structured `done_literal` token, not NL extraction (brief §1)                           | **Verified** (`<<<DONE>>>`, exact match, `e1-l1-parser.ts:136`) — with the nuance that "structured" means a bare sealed token carrying no payload.                                                                                                                             |
| No "L2 orchestrator"; orchestration in `e1-harness.ts`/`e1-package-runner.ts`/`runner.ts` (brief §1)             | **Partly wrong** — see Corrections C1.                                                                                                                                                                                                                                         |
| OpenSpec integration exists, pinned CLI, archive step, exit-0-abort + dated-dir gotchas (memory + BASE-DECISION) | **Verified in code** (`e1-openspec-workflow.ts`, `e1-openspec-harness.ts:224-259`; pin 1.4.1 asserted per call).                                                                                                                                                               |
| 79→13 gap metric computed by the Python harness, not this parser (brief §7)                                      | **Consistent** — no gap-metric computation exists in this repo's code; run-cards record it as imported evidence.                                                                                                                                                               |
| OpenRouter retired (memory, 2026-06-11 operator decision)                                                        | **True for the E1 path only** (hard guard `bin/e1.ts:155-159`); still wired+tested in the legacy pilot stack.                                                                                                                                                                  |
| "Sealed constants with hash-binding" (BASE-DECISION §7)                                                          | **Nuanced**: value-validation at load + run-to-seal hash stamping + replay gating; no file-hash-in-manifest binding of the constants document itself.                                                                                                                          |
| Dirty state is docs-only (BASE-DECISION §2)                                                                      | **Verified** (git status: 5 modified docs, 7 untracked docs/dirs incl. `docs/e4/`).                                                                                                                                                                                            |
| `hit-sdd-bench` main 6 commits ahead of origin (BASE-DECISION §7)                                                | **Stale — now 0 ahead** (pushed since the 2026-07-07 audit; 177 commits total matches). The `-e2` unpushed/uncommitted E3 exposure was not re-audited (that repo is frozen for E4 purposes).                                                                                   |
| E1 live-provider reproduction                                                                                    | **Still unverified, by design** — gated on API spend and operator authorization (CLAUDE.md/AGENTS.md); static evidence (canned transport, replay suite) remains the basis. Zero-spend `pilot:fake`/canned `e1` runs write into `runs/` and were not executed during discovery. |

## 4. Corrections to the brief

- **C1 (brief §1):** "There is no 'L2 orchestrator'; orchestration lives in `e1-harness.ts` /
  `e1-package-runner.ts` / `runner.ts`" — two inaccuracies. (a) L2 *is* a defined layer in the
  protocol docs (`e1-self-directed-verification-turn-based-v0.md:21`); what's true is that only
  dev-grade orchestration is implemented. (b) `e1-harness.ts` is not an orchestrator — it is the L0
  mechanics library. The two orchestrators are `e1-package-runner.ts` (current E1 stack) and
  `runner.ts` (legacy `runPilot` stack), which run **different task formats** — they are parallel
  systems, not one pipeline.
- **C2 (brief §7):** "built on the estate's completion-claim mechanism, the L1 `done_literal`
  protocol (extend the block grammar if E4 needs richer claims…)" — directionally right, but note the
  current claim is a bare boolean with no payload and no extension plug point; "extend the block
  grammar" means a new sealed token + parser type + adapter changes in an E4-owned constants lineage
  (E1's validator would reject any grammar addition — by design).
- **C3 (brief §9):** "seeded determinism end-to-end (substrate generation, task order, agent sampling
  where controllable)" — fine as intent, but the estate's existing "seed" is sealed as a
  *pairing label*, explicitly `pairing_label_not_sampling_seed`. E4's substrate/task-order seed is a
  genuinely new mechanism and must be a separate manifest field; reusing the word "seed" unqualified
  will corrupt the pairing semantics. Recommend `substrate_seed` (RNG) vs `pairing_label` (identity)
  in all E4 schemas.
- **C4 (brief §13 Q3):** listing the OpenSpec integration as a "candidate mechanism" for gate
  enforcement overstates what it does: it archives and diffs prose; it executes nothing (§1.8). It
  remains relevant as workspace/custody pattern; the red/green gate is new machinery either way.
- **C5 (brief §1, minor):** "test coverage of the harness itself" is stronger than the brief implies —
  the sealed-value pinning test (`e1-protocol-constants.test.ts`) plus the replay/tamper fixtures
  effectively make the E1 seal regression-detectable by `bun test` alone, which is what makes the
  "E1 stays green" ground rule cheaply checkable per milestone.

## 5. Risk register

| #   | Risk                                                                                                                                                                                                | Mitigation                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | E4 code drifts into shared E1 modules and breaks the seal (validator, conditions, renderer are all closed-world and string-matched)                                                                 | E4 gets its own modules (conditions, constants schema+validator, ArmPolicy, runner); E1 files are touched only by explicit, gate-reviewed decision. Protection check per milestone = full `bun test` (the seal is pinned by tests, §4 C5). |
| R2  | Accidental reuse/extension of the legacy `runPilot`/OpenRouter stack                                                                                                                                | Recorded here as legacy; E4 architecture (Phase 1) builds only on the E1 stack's patterns; no new call sites into `runner.ts`/`openrouter-agent.ts`.                                                                                       |
| R3  | Arm-H gate under-specified: no red/green executor exists, OpenSpec can't provide one (§1.8), and the Claim-B/B1 finding says done-claim *enforcement framing* is exactly where frontier agents fail | Treat as the hardest Phase-1 ADR (prompt already mandates this); design the gate as harness-executed acceptance checks (red required pre-implementation), with the OpenSpec custody pattern as an optional workspace convention.           |
| R4  | Seed-semantics collision (pairing label vs RNG seed) silently corrupts pairing or reproducibility                                                                                                   | C3's naming split (`substrate_seed` vs `pairing_label`), enforced in the E4 manifest schema + tests.                                                                                                                                       |
| R5  | No crash-resume: a 6–10-task sequential run lost mid-sequence is unaffordable at pilot scale                                                                                                        | ADR Q5 designs snapshot-per-task + resume before the pilot milestone; per-task workspace hashing already gives integrity anchors.                                                                                                          |
| R6  | Floor effect (StaminaBench: models collapse in 5–6 turns without feedback) masquerades as H4 drift                                                                                                  | Brief §8's smoke-feedback-for-all-arms policy is load-bearing; encode "failed task ≠ drifted spec" in the result schema from day one; pilot go/no-go checks it.                                                                            |
| R7  | Drift-meter false negatives make H2 unfalsifiable                                                                                                                                                   | Known-drift fixture with zero-false-negative requirement is a Phase-1 deliverable and the pilot go/no-go instrument; meter version stamped in every manifest.                                                                              |
| R8  | License contamination from StaminaBench (CC BY-NC)                                                                                                                                                  | Hard rule already in prompt; provenance ADR records clean-room reimplementation from the paper only; no fetches of the repo, ever.                                                                                                         |
| R9  | HTTP-oracle nondeterminism (ports, timing, server lifecycle) undermines replay-validity, the estate's flagship property                                                                             | Q2/Q6 ADRs decide persistence + transport with determinism as a first-class criterion; oracle artifacts (requests/responses) retained in the bundle for replay.                                                                            |
| R10 | Naming/pooling corruption ("E2" slip, pooling E4 with E1/E2/E3)                                                                                                                                     | Amendment's no-pooling + naming clauses; condition IDs `e4_arm_*`; manifests carry the E4 boundary; AGENTS.md bullet registers the program.                                                                                                |

## 6. Questions for the Phase-0 gate (batched)

1. **Approve the AGENTS.md amendment** as proposed in `AGENTS-AMENDMENT-PROPOSAL.md` (condition IDs
   `e4_arm_0`/`e4_arm_m`/`e4_arm_h`)? Any wording changes before it becomes its own commit?
2. **Confirm the E1-protection check definition**: is "full `bun test` green (379/379 or approved
   successor) + sealed-constants file untouched" acceptable as the per-milestone E1 protection check,
   or do you also want a canned-transport `e1` smoke run (writes into `runs/`) per milestone?
3. **Commit hygiene for Phase 0**: `docs/e4/` (brief, base decision, prompt, these two deliverables)
   is currently untracked, and the working tree has unrelated modified docs. Commit `docs/e4/` as its
   own commit at gate approval, leaving the unrelated dirty docs alone?
4. **Legacy-stack disposition** (non-blocking): leave the `runPilot`/OpenRouter stack exactly as-is
   (recommended — it is green and part of the record), or mark it deprecated in README/AGENTS.md in a
   separate, later housekeeping change? E4 does not depend on the answer.

---

**Phase 0 ends here. Awaiting review before Phase 1 (Architecture + ADRs).**
