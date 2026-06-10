# e1-frontier-consolidated-protocol-v0

Status: draft consolidation protocol. No provider run is authorized by this document. Billing v2 design remains blocked until `e1-harness-calibration-step0-v0` passes.

Canonical machine-readable constants: `docs/protocols/e1-frontier-sealed-constants-v0.2.json` (`version=0.3.2`).

The JSON file is the constants appendix future L1/L2 runtime code must load and record by hash. This markdown file is the human-readable companion. Do not duplicate constants into implementation code without reading the JSON boundary.

## Purpose

This document consolidates the frontier-model branch decisions into one auditable protocol boundary. It exists because the branch now depends on many small constants: parser grammar, no-op semantics, token ledger rules, protected-path integrity, diff scope, lockfile policy, and Step 0 gates.

The research question is:

> On a long-horizon multi-file task with scattered invariants, does provided executable BDD-style feedback reduce regression drift for a frontier model versus self-directed verification, under a turn-based, full-file-replacement editing protocol with budgeted verification executions?

The current evidence does not answer that question. Current evidence supports only the bounded cheap/weak-model viability story from the pricing task family.

## Estimand

The active conditions remain exactly:

- `context_only_spec`
- `feedback_capable_spec`

Both arms receive semantically equivalent visible spec content and the same generic self-verification channel. Only `feedback_capable_spec` receives maintained executable BDD assets and the provided `bun run spec` command. The treatment is maintained executable feedback under the same turn, verification, and token budget.

The context arm may write and run its own probes in `scratch/`. That is not contamination; it is the control practice the experiment measures.

## Harness Layers

L0 exists today:

- replacement parsing/application;
- command validation and execution;
- output truncation/hashing;
- protected-path hashing;
- verification-budget counters.

L1 parser/shakedown, the no-provider local turn adapter shell, no-provider conversation/checkpoint runner, no-provider multi-checkpoint/arm shakedown runner, and dev-grade no-provider task/oracle package runner exist; live provider conversation assembly is still missing:

- parse model output into protocol blocks;
- strip one outer markdown fence layer before parsing;
- classify verification commands against the sealed grammar;
- feed parsed replacements and verification requests into L0 mechanics;
- consume verification slots;
- emit next-turn harness notices and verification-output injections;
- debit model-output and injected-output tokens with provider usage primary and estimator shadow support;
- assemble fresh per-checkpoint no-provider conversations;
- run scripted-agent checkpoint loops with bundle emission and replay checks;
- run paired no-provider multi-checkpoint/arm shakedowns with checkpoint continuation rules;
- seed workspaces from separate task packages and score turn snapshots against separate hidden oracle packages in dev-grade no-provider runs;
- assemble live provider turns with cached-prefix accounting;
- call providers with bounded transport retries and `provider_error` termination semantics.

Full evidence-generating L2 is still missing:

- emit publication-grade replayable artifact bundles;
- integrate live providers.

CartCalc cannot be considered Step 0 complete until live provider conversation assembly exists and one orchestrator command runs the full calibration bundle. The current CartCalc runner is dev-grade no-provider shakedown only.

## Conversation Thread Scope

E1 uses a fresh provider conversation per checkpoint. The checkpoint-start message carries the current repo snapshot, README/instructions, the checkpoint-specific visible spec, and the condition-specific verification affordances. The model's only memory of earlier checkpoints is the workspace itself: code, protected specs, and its own persisted `scratch/` files.

One continuous provider thread across checkpoints is rejected for this protocol version because it changes both the maintenance-pressure phenomenon and the cost model. Within a checkpoint, later turns append the model's prior output plus harness notices and verification output.

The assembled checkpoint-start prompts for both arms are part of the parity surface. The only allowed differences are sealed in `arm_difference_allowlist`: the context-only self-verification line, the feedback-capable provided-feedback command lines, and feedback asset path lines. The context arm must not mention `bun run spec` or provided executable feedback.

## Checkpoint Continuation

Checkpoint termination does not automatically end the run. `done`, `agent_stalled`, and `budget_exhausted` snapshot the workspace as-is and continue into the next checkpoint from that same workspace. For non-done terminations, the checkpoint's new assertions score as failed. `invalid_integrity` terminates the entire run because protected-path drift invalidates the evidence channel. `provider_error` also terminates the run, but for the opposite reason: transport failure is not agent behavior, is excluded from analysis, and may only be rerun under a fresh run identity.

## Package And Oracle Boundary

Task packages and oracle packages are separate artifacts with separate hashes. The task package is mounted into arm workspaces and may contain visible specs plus feedback assets for `feedback_capable_spec`. The oracle package is loaded only by the external scorer and is never copied into an agent workspace.

Oracle scoring runs on every turn snapshot. The primary endpoint is computed over checkpoint-end snapshots; all-turn snapshots remain available for regression birth/recovery analysis.

The sealed E1 AUC formula is `checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1`: for each checkpoint-end snapshot `k`, compute the fraction of cumulative hidden assertions introduced at any checkpoint `j <= k` that pass, then mean those pass rates equally over checkpoints.

Every task and oracle package declares a fixed `virtual_now`. Reachable `Date.now`, `new Date()`, and `performance.now` references in package-controlled files are package-validation failures.

Bundles are self-labeled. A bundle emitted from `draft-pre-seal` constants or without a protocol-document hash is `dev`; evidence-grade emission requires sealed constants and a recorded protocol-document hash. Run identity includes the task package hash, oracle package hash, constants version, prompt-template hash, model, and seed.

For E1, seed is a pairing label unless the provider explicitly exposes and honors an RNG seed. The label binds the task package, oracle package, constants version, prompt-template hash, checkpoint sequence, and budgets. Paired analysis pairs on that label. Replay reproduces the consequences of recorded turns exactly; it does not claim to reproduce provider sampling for APIs without seed support.

## Editing And Parser Policy

The editing protocol is full-file replacement only. Unified diffs are never accepted as a model-facing edit format.

A turn is parsed in fixed precedence:

1. replacement blocks;
2. at most one verification request;
3. optional done declaration.

Zero valid blocks is a no-op turn. It consumes a turn and injects exactly `no valid blocks parsed` into the next turn. Three consecutive no-op turns terminate the checkpoint as `agent_stalled`. Stalls are excluded from drift analysis but count as failure for that checkpoint's new assertions.

Stall/no-op rates are public evidence, not cleanup. If arm stall rates differ by more than 2x and the higher arm exceeds 5 percent of checkpoints, attach a protocol-usability caveat to that model row. If the feedback arm stalls more, inspect transcripts for verification-output parser confusion before interpreting model ability.

## Verification Channel

Both arms may request:

- `bun test scratch/<test-file>.ts`
- `bun scratch/<script>.ts`

Only `feedback_capable_spec` may request:

- `bun run spec`
- `bun run spec -- --cp=<checkpoint>`

Commands are parsed into argv templates, never shells. Non-whitelisted commands return a deterministic refusal and consume a verification slot.

Model-supplied paths are workspace-relative POSIX paths only. The grammar is sealed in the constants JSON. Paths are resolved against the workspace root, then realpath-checked for containment in resolved `scratch/`.

## Integrity And Audit

Protected paths are hashed at checkpoint start and verified after every mutation path:

- replacement application;
- verification execution.

Any mismatch is `invalid_integrity`, not evidence. Chmod read-only protection is defense in depth; the claim-bearing guarantee is the mutation-path-agnostic hash check.

Replacement output has two separate channels:

- model-facing: deterministic confirmation lines only;
- audit-facing: canonical unified diffs derived from snapshots.

Diff scope, exclusions, sort order, line-ending policy, and binary policy are sealed in the constants JSON. Snapshots are the ground truth; diffs are derived audit views.

## Provider Runtime

Transport-level failures are separate from model behavior. API errors, timeouts, rate limits, malformed provider responses, and network errors are retried with the sealed policy: 3 attempts and deterministic backoff slots of 250ms, 1000ms, and 4000ms. Retry attempts cost no model turns and no tokens; they are logged as provider-attempt metadata. Exhausted retries classify the run as `provider_error`, exclude it from analysis, and require a fresh run identity for any rerun.

Sampling defaults are sealed per provider profile before a live call: temperature `0.2`, top_p `1`, max output tokens per turn `4000`, plus the exact model id, route, timeout, retry policy, cache-breakpoint policy, and seed-support status. If a later model requires different parameters, that is a new non-pooled provider profile boundary.

Cache breakpoints are sealed at the system/template boundary and the checkpoint-start repo injection. Provider-reported cache-read tokens are recorded in `cached_prefix_tokens`, not in fresh debited tokens. Missing provider cache fields are recorded as absent rather than inferred.

## Token Ledger

Provider-reported usage is the ledger of record when present. The sealed local estimator is `js-tiktoken-o200k_base-v1` (`js-tiktoken@1.0.21`, `o200k_base`). It runs in shadow mode every turn and is recorded next to provider usage. It is the fallback only when provider usage is absent.

Verification-output truncation happens before output is shown to the model, so provider-reported usage is too late for that boundary. Truncation is therefore computed with the sealed estimator, deterministically and identically for all providers: first 2500 estimated tokens plus last 1500 estimated tokens, with an explicit marker. If token slicing would decode to a replacement character at the visible boundary, the slice trims inward deterministically until the shown head/tail is clean.

Sustained provider-vs-estimator drift greater than 15 percent over a checkpoint flags the run for review. Budgets are provider-tokenizer-denominated, so cross-provider absolute token budgets are not interpreted directly. The clean comparison is arm-vs-arm within a model.

Cached repo-prefix cost is recorded as a cost statistic and compatibility field. It is not debited from the checkpoint token budget.

## Step 0 Sequence

The required sequence is:

1. expanded L0 battery;
2. L1 build;
3. L1 shakedown with scripted fake agents;
4. L2 build;
5. CartCalc cheap-model runs;
6. CartCalc frontier context run;
7. cost projection;
8. trim window;
9. Billing v2 seal.

L1 shakedown must include pure prose, malformed delimiters, fenced valid blocks, wrong-precedence blocks, and chatty outputs with buried valid blocks. Parser behavior must match the sealed grammar exactly. Then one cheap real model measures live no-op rate. If no-op rate exceeds 10 percent, prompt-template iteration is allowed before the Step 0 seal and frozen after it.

Step 0 also requires 10 consecutive green full-suite runs on both macOS local and Ubuntu 24 with the same pinned Bun version. Harness tests must not depend on real-clock sleeps.

## Billing V2 Gate

Do not build Billing v2 until Step 0 passes. The first Billing v2 artifact after the gate opens should be the sealed Billing v2 protocol document and task interaction graph, not task code.

Billing v2 remains a proposed multi-file subscription/billing platform task. It must be deterministic, content-controlled, and drift-focused. It must not rely on ambiguity, missing interfaces, or structural breakage to defeat frontier models.

## Claim Ladder

A successful clean causal pilot may support only a bounded Level 4 claim:

> In a sealed two-arm pilot under this task/model/budget/protocol boundary, executable BDD-style feedback improved or did not improve regression-free success.

This branch is not allowed to claim general effectiveness without multiple compatible clean pilots across tasks/models. Null results, stalls, invalid runs, and ceilings remain part of the public record.
