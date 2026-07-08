# E4 Architecture — HIT-SDD Bench "Drift Velocity"

**Phase 1 deliverable** (per `E4-REDESIGN-PROMPT.md`), 2026-07-08. Inputs: `E4-DESIGN-BRIEF.md`,
`BASE-DECISION.md`, `DISCOVERY.md` (Phase 0), `GATE-0-DECISIONS.md` — whose injections 1–5 are
binding on this document and its ADRs. Status: **proposed, awaiting Phase-1 gate review.** No E4
runtime code exists yet; the only code shipped with this phase is the two Gate-0-mandated checks
(§3.3, §3.4).

ADRs (in `docs/e4/adr/`, one per brief §13 question):

| ADR | Question | Decision (one line) |
| --- | --- | --- |
| ADR-001 | Generated-app stack | TypeScript/bun app with a route-registry scaffold contract (argues against the brief's Python lean, with evidence) |
| ADR-002 | Persistence | In-memory store + seeded fixture; process = unit of state; sqlite deferred behind a storage-module boundary |
| ADR-003 | Arm-H gate | Acceptance-oracle executor inverted in time (red pre-impl, green on done) + custody checks; new machinery = sequencing state machine only |
| ADR-004 | Spec artifact formats | `specs/openapi.json` (OpenAPI 3.1, JSON not YAML — flagged) + `specs/CONVENTIONS.md` with constrained normative grammar |
| ADR-005 | Snapshot/resume | Harness-side directory copies + content-hash anchors; replay-validity defined as a chain property |
| ADR-006 | Test transport | HTTP, single executor for oracle/gate/feedback, determinism engineered (port-0, fixed order, sealed timeouts), full request/response artifacts retained |
| ADR-007 | E1/E4 coexistence | E4 = wrapper over a read-only import allowlist; layered constants lineage; legacy stack forbidden by an enforced lint test |

Deviations from the brief, flagged per ground rule 1/6: generated-app language (ADR-001), OpenAPI
JSON vs YAML (ADR-004). Both are argued with repo evidence and reversible at this gate.

---

## 1. Module boundaries and dependency diagram

E4 is a **wrapper program** (ADR-007): all new code under `src/e4/`, `bin/e4.ts`, `test/e4-*`,
importing existing modules only from a declared allowlist, editing none of them.

```
                                  bin/e4.ts (CLI)
                                       │
                            src/e4/run-orchestrator.ts
                        (sequence-per-arm, pairing, manifest)
                     ┌────────────┬────┴───────┬─────────────────┐
                     ▼            ▼            ▼                 ▼
             src/e4/runner.ts  src/e4/arm-policy.ts  src/e4/substrate/*  src/e4/manifest.ts
          (per-task state machine) (0/M/H policy)   (SubstrateProvider)  (schema+validation)
              │        │  │                              │
              │        │  └──────────────┐               │ (generated tests, GT IR)
              ▼        ▼                 ▼               ▼
      src/e4/gate.ts  src/e4/turns.ts  src/e4/oracle-executor.ts   src/e4/meter/*
      (ADR-003 seq.)  (E4 turn adapter) (HTTP, ADR-006)            (DriftMeter, frozen)
              └────────┴───────┬────────┘                              │
                               ▼                                       ▼
        ┌───────────── read-only allowlist (existing, never edited) ──────────────┐
        │ e1-harness.ts (L0)   e1-l1-parser.ts (grammar, data-driven)             │
        │ e1-live-provider.ts  e1-provider-runtime.ts  model-provider-presets.ts  │
        │ e1-redaction.ts      snapshot.ts             e1-workspace-snapshot.ts   │
        └─────────────────────────────────────────────────────────────────────────┘

        FORBIDDEN (full set enforced by test/e4-no-legacy-imports.test.ts, Gate-1 change 3):
        legacy stack — runner.ts, openrouter-agent.ts, model-loop-agent.ts, fake-agent.ts,
          task-package.ts, provenance.ts, index.ts, bin/run-fake-pilot.ts, bin/inspect-run.ts
        E1 orchestrators/closed-world — e1-package-runner.ts, e1-no-provider-runner.ts,
          e1-turn-adapter.ts, e1-l1-constants.ts, conditions.ts, result-schema.ts
          (E4 builds its own equivalents, per ADR-007)
```

Dependency direction is one-way: `e4 → allowlist`. Nothing under `src/` outside `src/e4/` ever
imports from `src/e4/`. The E4 constants lineage (`docs/protocols/e4-sealed-constants-*.json`,
schema `"e4-sealed-constants"`, own validator in `src/e4/constants.ts`) follows the OpenSpec
layered-profile precedent; the E1 v1.0.0 seal file and `validateE1Constants` are never touched.

## 2. Interfaces (signatures, not implementations)

Types below are normative for Phase 2/3; field names are final unless the gate says otherwise.
Two fields implement Gate-0 wording change 1 and DISCOVERY C3 everywhere they appear:
**`substrate_seed`** (RNG replicate within a compatibility boundary) and **`pairing_label`**
(identity binding across arms) are always separate.

### 2.1 SubstrateProvider

```ts
export type E4SubstrateConfig = {
  substrate_config_id: string;        // part of the compatibility boundary
  substrate_seed: number;             // RNG seed; replicate within the boundary
  task_count: number;                 // 6–10
  op_mix: E4OpMixPolicy;              // controlled mix incl. >=1 behavior-preserving step
};

export type E4OpportunityLabel =
  | "drift_opportunity"               // modifies/renames already-specified behavior
  | "additive"
  | "behavior_preserving";

export type E4GeneratedTask = {
  task_index: number;                 // 1-based position in the sequence
  nl_request: string;                 // the ONLY task text any agent sees; identical across arms
  opportunity_labels: E4OpportunityLabel[];
  ground_truth_ir: E4SchemaIR;        // post-op IR — harness-private, never mounted
  acceptance_tests: {                 // generated, harness-private (ADR-006 format)
    delta: E4HttpTest[];              // tests for behavior this op introduces/changes
    cumulative: E4HttpTest[];         // full surface incl. all prior tasks (no-regression encoding)
  };
};

export interface E4SubstrateProvider {
  readonly substrate_kind: string;    // "procedural-rest-v1"
  readonly substrate_version: string; // stamped into the manifest
  generate(config: E4SubstrateConfig): Promise<{
    initial_workspace: Record<string, string>;  // T0 app + in-sync spec artifacts + workspace docs
    initial_ir: E4SchemaIR;
    tasks: E4GeneratedTask[];
  }>;                                 // MUST be byte-deterministic in (config)
}
```

`generate` determinism is what makes replay-validity clause 1 (ADR-005) checkable. v2 real-repo
substrates implement the same interface; nothing in the runner knows about procedural generation.

### 2.2 Sequential Runner state machine

One sequence = one arm × one generated task list on one evolving workspace. States per task:

```
 task_start
   ├─(arm H)→ spec_phase → gate_red_check ─┐        (ADR-003; custody + inverted oracle run)
   └─(arms 0/M)──────────────────────────→ implementation_phase
                                              │  turn loop: e4 turn adapter over L0/L1 primitives
                                              │  (fresh conversation per task; smoke feedback all arms;
                                              │   acceptance feedback H only — §4)
                     ┌────────────────────────┤
                     ▼                        ▼
              done_literal claimed      budget_exhausted
                     │                        │
   (arm H) gate_green_check                   │
        green ─┘ │ red→ refused_done_over_red │
                 │      (feedback, loop)      │
                     ▼                        ▼
                task_close: hidden_oracle_run (all arms) → meter_run → noticing_probe
                           → snapshot (ADR-005) → manifest task record → next task
```

```ts
export type E4TaskTermination =
  | "done" | "agent_stalled" | "budget_exhausted"        // agent-behavior classes (E1 taxonomy kept)
  | "invalid_integrity" | "provider_error"
  | "spend_cap_reached" | "executor_error";              // infrastructure classes

export type E4TaskPhase = "spec" | "implementation";     // recorded on every termination/event

export interface E4SequenceRunner {
  run(input: {
    constants: E4SealedConstants;
    substrate: E4SubstrateProvider;  config: E4SubstrateConfig;
    arm: E4ArmPolicy;                pairing_label: string;
    provider: E4AgentProviderFactory; budgets: E4Budgets;
    resume?: { runId: string };      // ADR-005: restore last complete snapshot, continue at k+1
  }): Promise<E4SequenceResult>;
}
```

Sequencing rules carried from the estate: `done` and `budget_exhausted` both continue to task k+1
from the workspace as-is; only integrity/provider/spend classes abort a sequence. The **noticing
probe** (brief §4) is a one-prompt fresh conversation after task close; the answer is recorded and
never fed back.

### 2.3 ArmPolicy

Arms are policy objects, not branches (brief requirement). Everything an arm changes is declared
here and nowhere else — which is what makes the parity validator's allowlist meaningful.

```ts
export type E4ArmId = "e4_arm_0" | "e4_arm_m" | "e4_arm_h";

export interface E4ArmPolicy {
  readonly arm: E4ArmId;
  readonly standing_instruction: string | null; // arm M: the spec-maintenance sentence; 0/H: null
  readonly gate_enabled: boolean;               // arm H only (ADR-003 state machine active)
  readonly feedback: {
    smoke: true;                                // all arms, always (brief §8 — load-bearing)
    acceptance_oracle: boolean;                 // arm H only
  };
  phaseGuards(phase: E4TaskPhase): E4WorkflowGuards;  // H: spec-only vs code-only writability;
                                                      // 0/M: uniform guards, both phases identical
}

export function validateE4RuntimeArmParity(runtime: E4ArmRuntime[]): void;
// Allowlist parity per amended AGENTS.md (Gate-0 wording change 2): identical task text, budgets,
// retry policy; arms differ ONLY through {standing_instruction (M), gate+oracle channel (H)}.
// Follows the validateE1RuntimeArmParity precedent; any other delta throws.
```

Manipulation check (brief §3): `spec_touch` is derived per task by classifying every FILE-replacement
path in the turn records against spec-artifact paths — recorded for all arms; Arm 0 spontaneously
maintaining the spec is a finding, not an error.

### 2.4 DriftMeter

```ts
export interface E4DriftMeter {
  readonly meter_version: string;     // frozen per run; part of the compatibility boundary
  extract(input: {
    spec_artifacts: { openapi_json: string; conventions_md: string };  // agent-maintained (ADR-004)
    surface_dump: E4SurfaceDump | { extraction_failed: true; reason: string }; // ADR-001 registry dump
    ground_truth_ir: E4SchemaIR;
  }): E4InventoryTriple;              // spec-side, code-side, ground-truth inventories
  classify(
    triple: E4InventoryTriple,
    executor_evidence: E4ExecutorEvidence   // per-endpoint pass/fail from the task's hidden-oracle
  ): E4DriftReport;                         // run — used ONLY for the reconciliation rule below
}

export type E4DriftItemKind =
  | "endpoint" | "entity" | "field" | "validation_rule"   // API channel
  | "convention";                                          // conventions channel (the differentiator)

export type E4Discrepancy = {
  kind: E4DriftItemKind;
  class: "contradiction" | "coverage_gap" | "stale_claim";
  direction: "spec_vs_truth" | "code_vs_truth";
  item_id: string;                     // stable id (path+method / entity.field / convention-id)
  detail: { expected?: string; found?: string };
};

export type E4DriftReport = {
  meter_version: string;
  discrepancies: E4Discrepancy[];
  spec_unparseable: boolean;           // recorded, never a crash (ADR-004)
  extraction_failed: boolean;          // recorded fail-closed (ADR-001)
  registry_bypass: { item_id: string }[];  // Gate-1 change 1 — see reconciliation rule below
  counts: Record<E4DriftItemKind, Record<"contradiction"|"coverage_gap"|"stale_claim", number>>;
};
```

**Reconciliation rule (Gate-1 change 1):** the surface dump enumerates the route registry, so its
code-side inventory is registry-*declared* inventory. When `executor_evidence` shows a ground-truth
endpoint passing while the surface dump lacks it, the meter records a `registry_bypass` event and
attributes the discrepancy to the **conventions channel** as a structural-convention violation —
never as an API-channel gap (the behavior exists; the structural convention drifted). Evidence
flows one way, executor → meter, for this rule only; the acceptance tests still are not the meter.

Meter discipline (brief §6, all mechanically enforced): versioned and frozen per run (version in
every manifest); agents never see meter output (meter runs harness-side post-task, artifacts stored
outside agent-readable mounts — hidden-oracle isolation precedent); the acceptance tests are never
the meter; the meter covers the whole surface each task, not only task-touched items. **Drift
velocity** is reported per *drift opportunity* (denominator = tasks labeled `drift_opportunity`),
not per task.

### 2.5 Telemetry and manifest schema

```ts
export type E4RunManifest = {
  schema: "e4-run-manifest"; schema_version: string;
  run_id: string; run_classification: E4RunClassification;   // calibration | pilot | ...; E1 discipline kept
  compatibility_boundary: {                                   // Gate-0 wording change 1 — pooling unit
    constants_version: string; constants_hash: string;
    meter_version: string;
    substrate_config_id: string; substrate_kind: string; substrate_version: string;
  };
  substrate_seed: number;              // replicate WITHIN the boundary (never a pooling key)
  pairing_label: string;               // identity binding the three arms of one paired draw
  arm: E4ArmId;
  model: { preset: string; model_id: string; route_id: string };
  budgets: E4Budgets;                  // turns/verifications per task, token budget, spend cap
  tasks: E4TaskRecord[];               // one per task — see below
  resume_events: E4ResumeEvent[];      // ADR-005
  replay_validity: {                   // Gate-0 injection 3 — CHAIN property
    substrate_regeneration_ok: boolean;
    per_task_replay_ok: boolean[];
    chain_replay_valid: boolean;       // conjunction; headline claims require true
  };
  usage_totals: E4UsageTotals;         // tokens, spend, wall-clock (E1 ledger discipline)
};

export type E4TaskRecord = {
  task_index: number;
  opportunity_labels: E4OpportunityLabel[];
  termination: E4TaskTermination; phase_at_termination: E4TaskPhase;
  gate_events: {                       // arm H; empty for 0/M
    custody_failures: number;
    red_check: "red" | "green_anomaly" | "skipped_behavior_preserving";
    refused_done_over_red: number;     // Claim-B/B1 counter
  } | null;
  oracle: { delta_pass: number; delta_total: number;
            cumulative_pass: number; cumulative_total: number };
  false_confidence: {                  // injection 2: done_literal ∧ hidden-oracle-fail, no richer grammar
    event: boolean; enforcement_outcome: "accepted" | "refused" | null };
  smoke_feedback_runs: number;
  drift: E4DriftReport;                // full meter output (also the per-task drift time series)
  noticing_probe_answer: string;       // recorded verbatim, never fed back
  spec_touch: { touched: boolean; paths: string[] };
  usage: {                             // Gate-1 change 4: headline tax numbers are manifest reads
    turns: number; tokens: E4TokenUsage; wall_clock_ms: number; spend_usd: number;
    by_phase: Record<E4TaskPhase, {    // arm H: spec vs implementation; arms 0/M: all implementation
      turns: number; tokens: E4TokenUsage; wall_clock_ms: number }>;
    gate_executor: {                   // arm H gate-check overhead; null for arms 0/M
      red_runs: number; green_runs: number; wall_clock_ms: number } | null;
  };
  snapshot: { hash: string; path: string };
  executor_artifacts: string[];        // request/response transcript refs (injection 4)
  status: "complete" | "aborted";      // aborted = crash mid-task, superseded by resume (ADR-005)
};
```

Every hypothesis maps to manifest fields: H1/H2 from `drift` over `opportunity_labels`; H3 from
drift (spec-side) × oracle (code-side) per arm; H4 from `oracle.cumulative_*` and termination class
against `task_index`; H5 directly from `usage.by_phase.spec` + `usage.gate_executor` (freshness
tax, a first-class manifest read — Gate-1 change 4) vs Arm 0's added turns/tokens + failure slope
(drift tax) — never turn-record archaeology. The E4 result schema (Phase 2) recomputes each H's number
from task records, following the `result-schema-v1` self-checking pattern.

**Never pooled** with E1/E2/E3 or across meter/constants versions: the compatibility boundary is in
every manifest; `e4_arm_*` IDs are unjoinable with E1/E2 condition vocabularies by construction
(amended AGENTS.md).

## 3. E1 seal protection (structural + executable)

1. **Structural** (ADR-007): one-way dependency, no edits to allowlisted modules, forbidden legacy
   set, separate constants lineage/validators, separate conditions modules.
2. **Test-pinned seal** (DISCOVERY C5): `e1-protocol-constants.test.ts` + replay/tamper fixtures
   make any seal drift a `bun test` failure.
3. **Per-milestone triad — shipped this phase** (Gate-0 Q2): `bun run e1:protect`
   (`bin/e1-protection-check.ts`) = (a) sealed-constants file SHA-256 equals the pinned value,
   (b) full `bun test` green, (c) canned-transport `e1` smoke run (cartcalc, both arms) into
   gitignored `tmp/e1-protection-smoke/` — asserting exit 0, `invalid_run=false`, and bundle
   emission. Phase 3 runs this after every milestone.
4. **Legacy-import lint — shipped this phase** (Gate-0 Q4 + Gate-1 change 3):
   `test/e4-no-legacy-imports.test.ts`, self-tested against synthetic violations, scanning all E4
   modules against the **entire normative forbidden set** — legacy stack and E1-orchestrator/
   closed-world list (vacuously green until Phase 3 lands code, but wired and un-skippable from
   day one).

## 4. Substrate v1 design (clean-room; brief §5)

**Provenance:** clean-room reimplementation of the *pattern* published in StaminaBench
(arXiv 2606.19613). Its repo (CC BY-NC 4.0) was not fetched, read, or consulted; no code, data, or
docs derive from it. This section is the provenance record required by the brief.

- **Typed schema IR** (`src/e4/substrate/ir.ts`): entities (name, typed fields —
  `string|int|decimal|bool|date|ref`), relationships (`ref` fields), endpoints (CRUD + list/filter +
  one simple analytics op per entity family + optional workflow op), validation rules
  (required/range/enum/format), **and the conventions ground truth**: items with stable IDs and
  kinds `naming | error_format | command | structural` (ADR-004 grammar). The IR after each op is
  the harness's private per-turn ground truth.
- **Deterministic RNG:** a small pure PRNG (e.g. splitmix/mulberry-class) seeded by
  `substrate_seed`; no `Math.random` anywhere in the generator; byte-determinism is tested
  (§6, Feature 1).
- **Change-op action space** (`src/e4/substrate/ops.ts`): add/rename/delete entity;
  add/rename/retype/delete field; add/modify endpoint; add relationship; add validation rule;
  **modify convention** (e.g., error-envelope shape change — the normative-drift channel). Each op
  is a pure IR→IR function. Excluded in v1 per ADR-002: durability/migration ops.
- **Sequence drawing:** a seeded draw over the op space under `op_mix` constraints — a controlled
  mix of drift opportunities vs additive ops, ≥1 behavior-preserving step; **opportunity labels are
  computed from the op's relationship to already-specified surface** and recorded per task.
- **NL renderer** (`src/e4/substrate/render.ts`): deterministic templates from IR deltas to
  business-natural change requests. The rendered text never names spec files or testing practice
  (arms differ only via policy channel); phrasing pools are seed-drawn for variety but fixed given
  the seed.
- **Programmatic black-box test generation** (`src/e4/substrate/testgen.ts`, no LLM): from the
  post-op IR, generate `E4HttpTest`s — happy-path CRUD round-trips, list/filter assertions,
  validation-rule negative cases, error-format assertions derived from the conventions IR. Emitted
  as delta + cumulative sets per task (the cumulative set is the no-regression encoding, mirroring
  the estate's cumulative-commitments pattern).
- **T0 workspace:** generated app (ADR-001 scaffold: route registry + server entry + storage module
  + seed fixture), `specs/openapi.json` + `specs/CONVENTIONS.md` **verified in-sync** (meter at T0
  must report zero discrepancies — generator self-check and test), and a short workspace README
  (identical across arms) describing the artifact conventions.

## 5. Feedback policy implementation (brief §8 — load-bearing)

- **Smoke feedback, all arms:** an agent-invokable command (E4 sealed command set) that starts the
  server and hits a fixed readiness probe — "does it run", nothing about behavior. Executed via the
  L0 verification channel, output injected next turn (existing mechanics). Same command, same
  budget cost, in every arm.
- **Acceptance feedback, Arm H only:** gate red/green results (per-test pass/fail with test names
  and canonicalized diffs — the E2-ablation-grade feedback content), injected on gate checks and on
  refused dones (ADR-003).
- **Retry policy:** provider retries per the sealed E1-style failure policy, identical across arms
  (already arm-independent by design); retries cost neither turns nor tokens.
- **"Failed task" vs "drifted spec" stay distinguishable** (R6): they live in different manifest
  fields with different provenance — task failure = `termination` + `oracle.*` (executor evidence);
  drift = `drift.*` (meter evidence, whole-surface, meter-versioned). Floor-effect check at pilot
  go/no-go: if Arm 0's smoke-level completion collapses early (StaminaBench's 5–6-turn collapse),
  H4 analysis is blocked as floor-confounded rather than reported as drift — this rule enters the
  Phase-2 pre-registered analysis, and the collapse threshold that triggers the block gets a
  **pinned numeric definition** there (Gate-1).

## 6. Test strategy for the E4 harness itself

TDD per the prompt; acceptance criteria below are the Phase-3 contract (Gherkin, executable as bun
tests over fixtures — no live providers, no spend).

### Feature 1 — Substrate determinism and labeling

```gherkin
Scenario: Same seed, same substrate, byte-identical
  Given substrate config C with substrate_seed 42
  When generate(C) runs twice in separate processes
  Then both runs emit byte-identical workspaces, IRs, task texts, and test sets

Scenario: Different seeds differ within the same boundary
  Given configs identical except substrate_seed 42 vs 43
  When both generate
  Then task sequences differ AND both manifests record the same compatibility boundary

Scenario: Opportunity labels are recorded and constrained
  When generate(C) runs with the v1 op-mix policy
  Then every task carries >=1 opportunity label
  And at least one task is labeled behavior_preserving
  And every op that modifies or renames already-specified surface is labeled drift_opportunity

Scenario: T0 is in-sync
  When the drift meter scores the freshly generated T0 workspace against the initial IR
  Then it reports zero discrepancies
```

### Feature 2 — Drift meter classification (the known-drift fixture)

The **known-drift fixture** (`test/fixtures/e4/known-drift/`) is a hand-built workspace + ground
truth with **planted discrepancies covering every (kind × class × direction) cell the meter
claims to detect**, minimally: an endpoint contradiction (method mismatch), a field contradiction
(type mismatch), a convention contradiction (error-format value mismatch); coverage gaps (endpoint
in code absent from spec; convention in truth absent from spec); stale claims (spec endpoint absent
from code; spec field absent from truth); and a **registry-bypass cell** (Gate-1 change 1): a
ground-truth route served by directly-wired code, absent from the registry, shipped with recorded
executor evidence showing it passing. It ships with an expectations file
(`expected-discrepancies.json`) and a clean in-sync **twin fixture**. This fixture is also the
pilot go/no-go instrument (brief §11(b)).

```gherkin
Scenario: Zero false negatives on the known-drift fixture   # pilot go/no-go (b)
  When the meter scores the known-drift fixture
  Then every discrepancy in expected-discrepancies.json is reported
  With matching kind, class, direction, and item_id

Scenario: Zero false positives on the in-sync twin
  When the meter scores the twin fixture
  Then it reports zero discrepancies

Scenario: Registry bypass is reconciled, not missed        # Gate-1 change 1
  Given the fixture serves a ground-truth endpoint wired directly, bypassing the registry
  And recorded executor evidence shows that endpoint passing
  When the meter runs
  Then a registry_bypass event is recorded for that endpoint's item_id
  And the discrepancy is attributed to the conventions channel as a structural-convention violation
  And no API-channel discrepancy is reported for that endpoint

Scenario: Broken surface dump fails closed
  Given a workspace whose route registry export is removed
  When the meter runs
  Then the report records extraction_failed=true and no code-side inventory
  And the run does not crash and the manifest records the condition

Scenario: Meter version is stamped and frozen
  When any sequence runs
  Then every task record's drift report carries the meter_version
  And it equals the manifest's compatibility_boundary.meter_version
```

### Feature 3 — Gate enforcement (Arm H)

```gherkin
Scenario: Implementation is blocked until custody passes
  Given an arm-H task in spec phase
  When the agent submits a FILE replacement targeting app code
  Then the replacement is rejected by phase guards and recorded, and the task stays in spec phase

Scenario: Red check must be red
  Given spec custody has passed for a drift_opportunity task
  When the delta test set runs pre-implementation
  Then at least one delta test fails and the cumulative prior set passes
  And a green delta set is recorded as gate_anomaly_green_red_check

Scenario: Done over red is refused                       # Claim-B/B1
  Given the agent emits done_literal in implementation phase
  And the delta or cumulative set has failures
  Then the done-claim is refused, refused_done_over_red increments,
       failing results are injected as feedback, and the turn loop continues

Scenario: Done over green is accepted
  Given the agent emits done_literal and delta+cumulative sets pass
  Then the task closes with termination=done and enforcement_outcome=accepted

Scenario: Behavior-preserving tasks skip the red check
  Given a task labeled behavior_preserving
  Then the red check is skipped and recorded as skipped_behavior_preserving
  And the custody check still runs

Scenario: Arms 0 and M never gate
  Given the same sequence under e4_arm_0 or e4_arm_m
  Then no gate state is entered, done_literal is always accepted,
  And false_confidence.event = done ∧ hidden-oracle-fail is derived post-hoc
```

### Feature 4 — Runner sequencing, parity, resume

```gherkin
Scenario: State carries forward
  When task k ends in done or budget_exhausted
  Then task k+1 starts from the workspace as-is with a fresh conversation

Scenario: Arm parity is allowlist-enforced
  Given three arm runtimes for one pairing_label
  When validateE4RuntimeArmParity runs
  Then identical task text, budgets, and retry policy are required
  And any delta outside {standing_instruction, gate+oracle channel} throws

Scenario: Crash-resume restores the chain
  Given a sequence crashed during task 4
  When the runner resumes from the manifest
  Then snapshot 3's hash is verified before restore, task 4 restarts fresh,
       the partial task-4 records live under aborted/, and a resume_event is recorded

Scenario: Smoke feedback is arm-uniform
  When any arm invokes the smoke command
  Then the command, its budget cost, and its output channel are identical across arms
```

### Feature 5 — Manifest completeness and replay-validity

```gherkin
Scenario: Manifest is sufficient to reproduce
  When any sequence completes
  Then the manifest validates against the e4-run-manifest schema
  And records the compatibility boundary, substrate_seed, pairing_label, arm,
      model/route, budgets, and one task record per task with all §2.5 fields

Scenario: Replay-validity is a chain property
  When the E4 inspector replays a completed sequence
  Then substrate regeneration is byte-verified from substrate_seed
  And each task's turns replayed over snapshot k-1 reproduce snapshot k's hashes
  And chain_replay_valid is the conjunction, false on any mismatch or unverified resume seam

Scenario: Executor artifacts are retained
  Then every oracle/gate/smoke run's request+response transcript is in the bundle
  And oracle verdicts are recomputable from retained artifacts alone

Scenario: Secrets never land in artifacts
  When a manifest or transcript is emitted
  Then emission fails closed if any redaction secret would be recorded   # e1-redaction reuse
```

## 7. What Phase 2 owes

Milestone plan sized in agent-sessions with per-milestone triad checks; the E4 result schema +
pre-registered analysis (incl. the floor-effect blocking rule, §5); the constants draft
(`e4-sealed-constants` v0); pilot definition (1 config × 6 tasks × 3 arms × 2 seeds) with go/no-go
as executable checks; E3-footprint information for the operator's pause/parallel decision; the
"not in v1" list mirroring brief §12.
