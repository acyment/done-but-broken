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

Target reference size: about 18 files and 2,500-3,500 LOC.

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

## Checkpoint Sketch

Eighteen checkpoints, four phases:

| Phase | Checkpoints | Scope |
| --- | --- | --- |
| A: Foundations | CP01-CP04 | subscription creation, audit sequence numbers, invoice generation, line-level half-even rounding, totals invariant, idempotent payment capture, v1 API serialization stability |
| B: Mid-cycle pressure | CP05-CP09 | upgrade proration, downgrade-at-period-end, percent coupon duration, fixed coupon stacking, plan change while coupon active |
| C: Money-out and failure paths | CP10-CP14 | partial refunds, discount allocation on refunded prorated lines, dunning state, entitlement gating during `past_due`, cancellation during dunning |
| D: Compatibility and recomputation | CP15-CP18 | v2 serializer with v1 byte stability, historical backfill under rounding-policy flag, finalized-invoice immutability, audit replay determinism, duplicate-webhook idempotency |

Cross-cutting invariants should be cumulative from introduction:

- invoice totals equal the sum of rounded lines;
- audit sequence numbers are gap-free and monotonic per aggregate;
- finalized invoices are immutable;
- refunds never exceed net captured amount;
- v1 serialization remains byte-stable for old records;
- event-log replay reproduces the current state hash.

A private interaction graph should be sealed with the task. It should state which prior commitments each checkpoint can plausibly perturb. This graph is used to distinguish on-graph drift from suspicious structural failures.

## Spec And Oracle Strategy

Use three artifact layers.

### 1. Visible semantic spec, both arms

Both `context_only_spec` and `feedback_capable_spec` receive byte-identical visible spec content:

- per-checkpoint Gherkin-style scenarios;
- shared public API signatures;
- file/module map;
- worked numeric examples;
- compatibility examples;
- all event names, fields, and serializer fields used by runnable assets or hidden oracle.

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

Report visible-suite versus hidden-oracle generalization gap. Predeclare that a large gap, for example greater than `0.15`, is an overfitting flag in the writeup.

## Control Execution Fork

This is the most important design choice and must be sealed before implementation.

### E0: context arm cannot execute anything

Treatment: executable BDD feedback versus reading.

This is easier to implement with the current harness, but it is weak for a frontier-model claim. A critic can reasonably say production frontier coding agents normally have a shell or test runner.

E0 is not recommended for the frontier branch.

### E1: context arm has self-directed verification

Treatment: provided executable BDD specs versus self-directed verification from the same visible spec.

Recommended for the frontier branch.

Under E1:

- both arms can request bounded generic command execution or self-verification runs;
- both arms can write ad-hoc tests or scripts;
- only `feedback_capable_spec` receives provided BDD assets, provided step definitions, and the provided spec command;
- generic command output is recorded as self-verification output, not as provided spec feedback;
- output caps, command caps, and model turns are sealed and equal where applicable;
- provided BDD feedback invocations and output are part of the treatment and should count against the feedback arm's budget.

Current harness note: the existing model loop does not yet implement E1. Today, `context_only_spec` receives no executable feedback assets and the loop only runs the provided feedback command for `feedback_capable_spec`. A credible E1 frontier branch therefore requires a harness extension before task pilots.

## Required Fairness Gates

Before any frontier provider run:

- Content parity: byte-diff both arms' visible prompt/workspace modulo runnable assets and explicit treatment-only instructions.
- Interface parity: identical public API signatures, file map, fixtures, event names, and serialized field names.
- Worked-example parity: every runnable example value appears in the context arm's visible spec.
- Entailment parity: every provided BDD assertion is entailed by visible spec text.
- Feedback gating: only `feedback_capable_spec` receives provided executable BDD assets, step definitions, asset paths, and provided spec command.
- E1 self-verification parity, if used: both arms have the same generic command/self-verification budget.
- Budget seal: max model turns, command/self-verification limits, feedback limits, token caps, output caps, timeout, provider profile, and run classification are sealed.
- Result schema: hidden-oracle scores are the only claim-bearing scores; visible-suite pass rates are descriptive.

## Local Discrimination Gates

The task package is not provider-ready until these pass locally:

1. Reference pass: reference implementation passes 100 percent of the cumulative hidden oracle at every checkpoint.
2. Frozen-baseline check: a workspace correct through `CP(k-1)` fails `CP(k)` new checks and preserves all old checks.
3. Mutation suite: 3-5 plausible seeded regressions per phase are caught by the hidden oracle, with a target catch rate of at least 90 percent.
4. Prompt/render parity: both arms receive identical visible spec content, public API contract, worked examples, and file map.
5. Feedback gating: context arm receives no provided BDD assets, command, or asset paths.
6. Entailment audit: provided BDD assets contain no hidden-only assertion content.

## Isolated Competence Check

Do not skip this gate.

A frontier-model branch can only claim long-horizon drift if the model can solve the individual checkpoint requirements in isolation. Before causal pilots, run an isolated competence check where the probe model gets each checkpoint alone with only relevant files.

Gate:

- the model solves at least 90 percent of isolated checkpoint tasks;
- failures in the sequence run can then be interpreted as cumulative drift pressure rather than raw inability.

This check is provider-consuming and must be separately authorized before execution.

## Draft Run Matrix

Stage 0: no-provider build and validation.

- implement task package;
- implement E1 harness support if selected;
- pass local fairness and discrimination gates;
- freeze task, oracle, visible specs, runnable assets, E1 policy, provider profile, and interpretation rules.

Stage 1: frontier difficulty probe, excluded from causal claims.

- model: Sonnet 4.6 or the currently selected frontier model;
- condition: start with `context_only_spec` only, 3 seeds;
- optional single `feedback_capable_spec` feasibility run if context does not ceiling;
- run classification: `difficulty_probe`;
- gate passes only if context does not ceiling and failures are on-graph drift, not structural breakage.

Suggested gate:

- mean context regression-free AUC <= `0.92`;
- mean at least 2 on-graph drift regressions per run;
- isolated competence check passed;
- source-code capture confirms real edits and preserved structure.

If context ceilings, extend the task once only with a predeclared Phase E, then rerun the difficulty probe once. If it ceilings again, stop and publish the boundary result rather than chasing the ceiling.

Stage 2: causal pilots, only if Stage 1 passes.

- models: per-model boundaries, for example Sonnet 4.6 and Qwen 3.7 Max;
- seeds: 5 paired clean seeds per model;
- conditions: `context_only_spec`, `feedback_capable_spec`;
- run classification: `causal_pilot`;
- primary endpoint: paired hidden-oracle regression-free AUC delta;
- secondary endpoints: regression-event count, recovery rate, visible-to-hidden generalization gap.

Do not pool across models, task versions, E0/E1 policy, provider profiles, or prior pricing/payroll results.

## Predeclared Interpretation

Set the minimum claim-worthy effect before any run. Recommended:

- all-positive paired direction across at least 5 clean pairs;
- mean paired hidden-oracle AUC delta at least `+0.05`;
- no provider validity flags;
- complete opportunity for the treatment to affect a later model turn;
- no large visible-to-hidden overfitting gap.

Allowed outcomes:

| Outcome | Interpretation |
| --- | --- |
| Context ceilings | Boundary result only: up to this complexity, frontier model had no measurable headroom; current value remains cheap/weak-model viability. |
| Gate passes and feedback delta meets threshold | Bounded frontier-model causal pilot claim for that task/model/E1 profile. |
| Gate passes but null or negative | Publish null: frontier self-directed verification was enough under this task/model/budget. |
| Structural failures or isolated competence failure | No claim; task invalid for frontier drift; redesign before more provider spend. |

## Next No-Provider Work

Recommended order:

1. Seal the E1 policy decision in a protocol profile draft.
2. Add test-first harness support for E1 self-directed verification, or explicitly reject E1 and accept the weaker E0 claim.
3. Design the billing v2 file map, checkpoint list, public API contract, and private interaction graph.
4. Write parity, feedback-gating, and entailment tests before writing the full task.
5. Build the reference implementation and hidden oracle.
6. Run local mutation/discrimination checks.
7. Only then ask for explicit authorization for the isolated competence check and frontier difficulty probe.

