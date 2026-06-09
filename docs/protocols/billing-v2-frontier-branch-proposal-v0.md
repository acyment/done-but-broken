# billing-v2-frontier-branch-proposal-v0

Status: draft proposal only. No task package is implemented by this document. No provider run is authorized by this document.

## Purpose

The current experiment phase supports a bounded cheap/weak-model viability claim: executable BDD-style feedback helped `mistralai/mistral-small-2603` on the content-controlled pricing task, while frontier-grade models ceilinged the tested well-specified single-file tasks.

This proposal defines the next research branch only if the project needs a frontier-model claim. The branch changes the difficulty axis from "more single-file rules" to "multi-file existing-codebase drift with scattered invariants."

The target claim, if the branch succeeds, would be:

> On a long-horizon multi-file task with scattered invariants, provided executable BDD-style specs reduced regression drift for a frontier model versus self-directed verification, under a sealed task/model/budget boundary.

That claim is not supported by the current evidence and must not be made without new clean causal pilots.

## Domain Decision

Recommended domain: multi-file subscription/billing platform v2.

Reasons:

- It preserves continuity with the existing pricing/billing narrative.
- It is deterministic and mechanically checkable.
- It naturally couples domain logic, API serialization, persistence, audit events, money arithmetic, and compatibility behavior.
- It avoids common ambiguity traps from RBAC and calendar semantics.
- It avoids nondeterminism from scheduler/concurrency domains.

The task should not be another single-file rules kata. Pricing and payroll showed that frontier models are very strong at well-specified self-contained logic. Adding more precise rules mostly adds more of what they already handle.

## Hypothesis

The intended failure mode is non-local regression under accumulating invariants:

- checkpoint `k` introduces a legitimate behavior change;
- that change perturbs an invariant introduced at checkpoint `j < k`;
- the regression appears in a different file or layer;
- the context-only frontier model can implement individual rules, but does not reliably preserve the full cumulative surface without provided executable BDD feedback.

The task is only valid for a frontier claim if failures are drift, not ambiguity, missing interface information, structural breakage, or isolated inability.

## Proposed Codebase Shape

Target reference size: about 25-35 files and 5,000-8,000 LOC.

Suggested modules:

- `domain/subscription`
- `domain/invoice`
- `domain/proration`
- `domain/coupons`
- `domain/refunds`
- `domain/dunning`
- `api/serializers_v1`
- `api/serializers_v2`
- `api/routes`
- `persistence/repo`
- `persistence/migrations`
- `events/audit`
- fixtures and test helpers

The template workspace should look like a real small codebase, not a blank kata. The model should need to navigate and modify existing modules while preserving compatibility behavior.

Realistic friction is allowed, but contradictions and artificial traps are not. Acceptable friction includes legacy helpers that must keep working, mild naming inconsistency between modules, and one v1 compatibility path that cannot be deleted. The task design must record a friction budget before implementation so reviewers can verify that difficulty comes from realistic codebase maintenance, not hidden ambiguity.

## Checkpoint Sketch

Twenty-four checkpoints are sealed up front. CP01-CP18 form the primary probe. CP19-CP24 are a sealed escalation package activated only if the first difficulty probe ceilings.

| Phase | Checkpoints | Scope |
| --- | --- | --- |
| A: Foundations | CP01-CP04 | subscription creation, audit sequence numbers, invoice generation, line-level half-even rounding, totals invariant, idempotent payment capture, v1 API serialization stability |
| B: Mid-cycle pressure | CP05-CP09 | upgrade proration, downgrade-at-period-end, percent coupon duration, fixed coupon stacking, plan change while coupon active |
| C: Money-out and failure paths | CP10-CP14 | partial refunds, discount allocation on refunded prorated lines, dunning state, entitlement gating during `past_due`, cancellation during dunning |
| D: Compatibility and recomputation | CP15-CP18 | v2 serializer with v1 byte stability, historical backfill under rounding-policy flag, finalized-invoice immutability, audit replay determinism, duplicate-webhook idempotency |
| E: Sealed escalation | CP19-CP24 | multi-currency rounding, tax-jurisdiction recomputation, audit-log compaction, replay after compaction, migration backfill idempotency, cross-version export stability |

Cross-cutting invariants should be cumulative from introduction:

- invoice totals equal the sum of rounded lines;
- audit sequence numbers are gap-free and monotonic per aggregate;
- finalized invoices are immutable;
- refunds never exceed net captured amount;
- v1 serialization remains byte-stable for old records;
- event-log replay reproduces the current state hash.

A private interaction graph should be sealed with the task. It should state which prior commitments each checkpoint can plausibly perturb. This graph is used to distinguish on-graph drift from suspicious structural failures.

Escalation rule:

> If the Stage 1 ceiling criterion fires on CP01-CP18, activate the already-sealed CP19-CP24 extension and rerun the difficulty probe once on CP01-CP24. No second escalation exists. If the extended probe also ceilings, terminate this branch with a boundary claim.

## Spec And Oracle Strategy

Use three artifact layers.

### 1. Visible semantic spec, both arms

Both `context_only_spec` and `feedback_capable_spec` receive byte-identical visible spec content:

- per-checkpoint Gherkin-style scenarios;
- shared public API signatures;
- minimal orientation README;
- worked numeric examples;
- compatibility examples;
- all event names, fields, and serializer fields used by runnable assets or hidden oracle.

Prompt delivery is incremental:

- each checkpoint prompt injects only that checkpoint's new Gherkin and worked examples;
- prior spec files persist in `/specs` and remain discoverable in the workspace;
- prior commitments are not restated every turn as a cumulative checklist;
- invariants are stated once when introduced, and preserving them is the task.

The orientation README should be short, roughly 30 lines: package layout, entry points, money representation, and how to run ordinary project checks. It must be identical across arms. Interface parity is between arms, not a requirement to make every relevant file obvious in the prompt.

With the current style of turn-based harness, the workspace snapshot is still available to the model through rendered context. The intended pressure is attentional and cumulative-interaction pressure, not a claim that files are unretrievable.

### 2. Runnable BDD assets, feedback arm only

Only `feedback_capable_spec` receives provided executable assets and the provided spec command.

Every runnable assertion must be entailed by the visible spec. No extra interface knowledge, extra values, or hidden acceptance criteria may appear only in step definitions.

Add an entailment audit gate before any provider run:

- each step-definition assertion maps to visible spec text or a visible worked example;
- any non-entailed assertion makes the task version dirty;
- fixing it requires a new task version or pre-run correction before the boundary is sealed.

### 3. Hidden oracle, neither arm

The hidden oracle should contain:

- all visible runnable assertions;
- at least 30 percent held-out assertions using different values or property checks entailed by the visible spec.

Replayability uses commit-then-reveal:

- before probes, publish SHA-256 commitments for the oracle tarball, repo snapshot, spec set, sealed CP19-CP24 extension, harness version, and protocol document;
- during runs, keep the hidden oracle private and execute it against captured workspace snapshots;
- at publication, release the oracle, harness, transcripts, untruncated execution logs, per-checkpoint code snapshots, and seed list;
- once released, that oracle version is burned for future fresh runs.

Visible-to-hidden generalization gap is predeclared:

- for each checkpoint snapshot, `V_k` is assertion-weighted pass rate over visible-entailed assertions;
- `H_k` is assertion-weighted pass rate over held-out assertions;
- run gap is the checkpoint-weighted mean of `V_k - H_k`;
- condition gap is mean run gap per model and arm;
- differential gap is `feedback_capable_spec` condition gap minus `context_only_spec` condition gap.

Flags:

- differential gap greater than `0.10` requires an overfitting section in the writeup;
- feedback-arm condition gap greater than `0.15` requires the same;
- both flags require a sensitivity analysis recomputing the primary endpoint on held-out assertions only;
- if held-out-only recomputation loses sign consistency, downgrade the claim one rung.

## Control Execution Policy

Use `e1-self-directed-verification-turn-based-v0`.

Treatment:

> provided executable BDD specs on top of the same bounded self-directed verification channel available to both arms.

This is an additive design:

- both arms can write and run model-authored tests or probe scripts through the same structured verification channel;
- only `feedback_capable_spec` receives provided BDD assets, provided step definitions, and the provided `make spec` command;
- `make spec` consumes the same verification-execution quota as self-authored tests;
- verification output tokens count against the arm's sealed budget.

The rejected alternative is E0, where the context arm cannot execute anything. E0 is easier to implement with the current harness, but too weak for a frontier-model claim because it handicaps a production-grade coding agent control.

Current harness note: the existing model loop does not yet implement E1. A credible frontier branch therefore requires a test-first harness extension before task pilots.

## Required Fairness Gates

Before any frontier provider run:

- Content parity: byte-diff both arms' visible prompt/workspace modulo runnable assets and explicit treatment-only instructions.
- Interface parity: identical public API signatures, minimal orientation README, fixtures, event names, and serialized field names.
- Worked-example parity: every runnable example value appears in the context arm's visible spec.
- Entailment parity: every provided BDD assertion is entailed by visible spec text.
- Feedback gating: only `feedback_capable_spec` receives provided executable BDD assets, step definitions, asset paths, and provided spec command.
- E1 self-verification parity: both arms have the same generic command/self-verification budget.
- Budget seal: max model turns, verification-execution limits, token caps, output caps, timeout, provider profile, and run classification are sealed.
- Read-only spec integrity: patch attempts against `/specs` and `/specs/steps` are rejected and logged.
- Scratch isolation: `/scratch` persists and is captured, but is excluded from the hidden oracle import path.
- Result schema: hidden-oracle scores are the only claim-bearing scores; visible-suite pass rates are descriptive.

## Local Discrimination Gates

The task package is not provider-ready until these pass locally:

1. Reference pass: reference implementation passes 100 percent of the cumulative hidden oracle at every checkpoint.
2. Frozen-baseline check: a workspace correct through `CP(k-1)` fails `CP(k)` new checks and preserves all old checks.
3. Mutation suite: 3-5 plausible seeded regressions per phase are caught by the hidden oracle, with a target catch rate of at least 90 percent.
4. Prompt/render parity: both arms receive identical visible spec content, public API contract, worked examples, and minimal orientation README.
5. Feedback gating: context arm receives no provided BDD assets, command, or asset paths.
6. Entailment audit: provided BDD assets contain no hidden-only assertion content.
7. E1 harness profile tests: verification whitelist, output truncation, full-output hashing, `/scratch` persistence, read-only spec rejection, and budget accounting match `e1-self-directed-verification-turn-based-v0`.

## Isolated Competence Check

Do not skip this gate.

A frontier-model branch can only claim long-horizon drift if the model can solve the individual checkpoint requirements in isolation.

Definition for checkpoint `k`:

- input workspace is the reference implementation snapshot at `CP(k-1)`;
- prompt includes checkpoint `k` visible spec and worked examples;
- the model receives the context-arm E1 channel with identical budgets;
- success means the resulting snapshot passes the full cumulative hidden oracle at `k`.

Gate:

- run two seeds per checkpoint;
- run only after the task, oracle, specs, and mutation suite are frozen;
- never feed isolated-competence results back into task design;
- record results as a diagnostic table per model.

Checkpoints that fail isolated competence are flagged `capability_limited` for that model. In-sequence failures at flagged checkpoints are excluded from drift counts and from the primary endpoint numerator on both arms symmetrically.

This check is provider-consuming and must be separately authorized before execution. It is diagnostic, not causal evidence.

## Draft Run Matrix

Stage 0: no-provider build and validation.

- implement task package;
- implement `e1-self-directed-verification-turn-based-v0` harness support;
- pass local fairness and discrimination gates;
- freeze CP01-CP24, oracle, visible specs, runnable assets, E1 policy, provider profile, interaction graph, mutation suite, and interpretation rules;
- publish pre-run commitments for the sealed artifacts.

Stage 1: frontier difficulty probe, excluded from causal claims.

- model: Sonnet 4.6 or the currently selected frontier model;
- condition: start with `context_only_spec` only, 3 seeds on CP01-CP18;
- optional single `feedback_capable_spec` feasibility run if context does not ceiling;
- run classification: `difficulty_probe`;
- gate passes only if context does not ceiling and failures are on-graph drift, not structural breakage.

Suggested gate:

- mean context regression-free AUC <= `0.92`;
- mean at least 2 on-graph drift regressions per run;
- isolated competence check passed;
- source-code capture confirms real edits and preserved structure.

If context ceilings, activate already-sealed CP19-CP24 and rerun the difficulty probe once on CP01-CP24. If the extended probe also ceilings, stop and publish the boundary result rather than chasing the ceiling.

Stage 2: causal pilots, only if Stage 1 passes.

- models: per-model boundaries, for example Sonnet 4.6 and Qwen 3.7 Max;
- conditions: `context_only_spec`, `feedback_capable_spec`;
- run classification: `causal_pilot`;
- primary endpoint: paired hidden-oracle regression-free AUC delta;
- secondary endpoints: regression-event count, recovery rate, visible-to-hidden generalization gap.

Per model, use a two-look group-sequential rule over clean paired seeds:

- Stage A: 5 clean pairs. If 5/5 are positive and mean delta is at least the MCID, stop with a full bounded claim. If 2/5 or fewer are positive, stop and publish null/negative. Otherwise continue.
- Stage B: extend to 10 clean pairs total. Full bounded claim requires at least 9/10 positive, mean delta at least the MCID, and a 95 percent paired-bootstrap confidence interval excluding zero. An 8/10 positive result with mean delta at least the MCID is only directionally positive and underpowered. Anything weaker is null.

No third stage and no optional stopping outside these two looks.

Do not pool across models, task versions, control-execution policy, provider profiles, or prior pricing/payroll results.

## Predeclared Interpretation

Set the minimum claim-worthy effect before any run. Recommended:

- mean paired hidden-oracle AUC delta at least `+0.05`;
- no provider validity flags;
- complete opportunity for the treatment to affect a later model turn;
- no large visible-to-hidden overfitting gap.

The MCID defaults to `+0.05` unless changed before the seal. Hidden-oracle scores are the only claim-bearing scores; visible-suite pass rates are descriptive.

Allowed outcomes:

| Outcome | Interpretation |
| --- | --- |
| Context ceilings | Boundary result only: up to this complexity, frontier model had no measurable headroom; current value remains cheap/weak-model viability. |
| Gate passes and feedback delta meets threshold | Bounded frontier-model causal pilot claim for that task/model/E1 profile. |
| Gate passes but null or negative | Publish null: frontier self-directed verification was enough under this task/model/budget. |
| Structural failures or isolated competence failure | No claim; task invalid for frontier drift; redesign before more provider spend. |

## Next No-Provider Work

Recommended order:

1. Add test-first harness support for `e1-self-directed-verification-turn-based-v0`.
2. Design the billing v2 module layout, CP01-CP24 checkpoint list, minimal orientation README, public API contract, friction budget, and private interaction graph.
3. Write parity, feedback-gating, read-only spec, scratch-isolation, verification-budget, and entailment tests before writing the full task.
4. Build the reference implementation, visible specs, runnable BDD assets, hidden oracle, sealed extension, and mutation suite.
5. Run local mutation/discrimination checks and publish pre-run hash commitments.
6. Ask for explicit authorization for isolated competence diagnostics.
7. Only after those diagnostics, ask separately for explicit authorization for the Stage 1 frontier difficulty probe.
