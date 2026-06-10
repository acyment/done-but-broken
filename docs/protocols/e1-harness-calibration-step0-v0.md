# e1-harness-calibration-step0-v0

Status: draft calibration protocol. Local E1 L0 mechanics, L1 parser shakedown, no-provider L1 turn consumption, a no-provider scripted checkpoint runner, a no-provider multi-checkpoint/arm shakedown runner, and a dev-grade no-provider CartCalc task/oracle package runner are implemented; the live provider conversation adapter, evidence-grade L2 run orchestrator, and provider calibration are not implemented. No provider run is authorized by this document.

## Purpose

Before building Billing v2, validate the E1 turn mechanics on a tiny task. The purpose is to test the harness format, logging, command channel, and cost model, not to generate scientific evidence about executable specs.

This is Step 0 for any frontier-model branch using `e1-self-directed-verification-turn-based-v0`.

## Layered Harness Scope

Step 0 is not complete until all three layers exist:

- L0 mechanics library: patch application, command validation, protected-path integrity, verification execution, output truncation/hashing, and local counters.
- L1 agent loop adapter: parse model output blocks, consume local turns through L0, assemble checkpoint conversations, inject harness notices and verification output, debit the token ledger, classify provider failures separately from agent behavior, and call providers. Parser/shakedown, local turn consumption, no-provider conversation assembly, and provider-error runtime semantics exist; live provider conversation assembly remains missing.
- L2 run orchestrator: seed workspaces, configure arms, advance checkpoints, persist scratch, snapshot each turn, classify terminations, and emit the artifact bundle. A dev-grade no-provider task/oracle package runner exists for scripted agents with hidden-oracle scoring on every turn snapshot; live-provider orchestration and publication-grade artifact emission remain missing.

The L0/L1/L2 implementation must cover:

- turn loop: full-file replacement block, verification request, done declaration;
- fixed block precedence: replacements, then at most one verification request, then optional done;
- no-op-turn handling: zero valid blocks consumes a turn, injects `no valid blocks parsed`, and three consecutive no-ops terminate `agent_stalled`;
- checkpoint continuation: `agent_stalled` and `budget_exhausted` snapshot the workspace as-is and continue into the next checkpoint; `invalid_integrity` and `provider_error` terminate the entire run;
- harness-enforced read-only `specs/` for both arms;
- harness-enforced read-only `specs/steps/` for `feedback_capable_spec`;
- read-only harness config: `package.json`, `bunfig.toml`, and `tsconfig.json`/Bun lockfiles if present;
- checkpoint-start hashes and turn-end verification for every protected path, terminating `invalid_integrity` on mismatch;
- writable `scratch/` with cross-checkpoint persistence;
- argv-templated command whitelist enforcement, never shell execution;
- relative POSIX path allowlist `^[A-Za-z0-9._-][A-Za-z0-9._/-]*$`, ASCII only, no leading `/`, no leading `-`, no `..` segment before realpath containment;
- 60s verification timeouts;
- deterministic head+tail truncation;
- budget counters for turns, verification executions, model output tokens, injected verification-output tokens, and cached-prefix cost as a separate statistic;
- bounded provider retries logged as provider-attempt metadata, with exhausted retries classified as `provider_error` and excluded from analysis;
- explicit live-mode and spend-cap gating, with cap breaches classified as `spend_cap_reached` before any transport call;
- fail-closed redaction for provider exchange recordings and emitted bundles;
- deterministic model-facing replacement confirmations;
- audit-only unified diffs between pre/post snapshots;
- per-turn logging: command, exit code, wall time, full-output hash, shown output, workspace snapshot, and hidden-oracle score.
- assembled-conversation parity: both arms' checkpoint-start prompts are diffed, and only the sealed arm-difference allowlist is permitted.

Every item above can contaminate future runs if it silently malfunctions. None requires Billing v2 to exist.

## Calibration Task: CartCalc

`CartCalc` is deliberately trivial.

- one small TypeScript module: `src/cartcalc.ts`;
- 3 checkpoints:
  - 1: line and cart subtotals;
  - 2: basis-point discount with flooring;
  - 3: discount cap rule that perturbs checkpoint 2 behavior;
- visible semantic spec text;
- runnable steps for `feedback_capable_spec`;
- 10-assertion hidden mini-oracle;
- one scripted checkpoint 2 regression/recovery fixture that fails the hidden discount assertions on the first turn and fixes them on the second turn.

The task should be easy for both arms. A difficult CartCalc result means the harness or prompt format is defective.

## Calibration Run Matrix

Minimum calibration matrix:

- cheap model, for example Haiku or Mistral-small: 2 arms x 2 seeds = 4 runs;
- one frontier context-arm run for realistic turn, token, and replacement-format measurement.

Total: 5 runs x 3 checkpoints.

These are calibration runs only. They are not causal evidence.

## Required Measurements

Record:

- malformed-replacement rate;
- block-grammar no-op rate;
- `agent_stalled` rate per model and arm;
- `provider_error` count and attempt traces;
- `spend_cap_reached` count and spend snapshot;
- turns used per checkpoint;
- verification calls used per checkpoint;
- fresh input tokens per turn;
- cached input tokens per turn, if provider reports them;
- output tokens per turn;
- truncation hit rate;
- whether the head+tail split preserves useful failure summaries;
- scratch persistence across checkpoints;
- read-only spec rejection and log entry behavior;
- wall time per turn including sandbox execution.

Patch format decision:

- full-file replacement is the only supported format;
- unified diffs are never implemented;
- calibration measures replacement-format token cost rather than adjudicating a conditional format decision.

Billing v2 design constraint flowing from this decision:

- no Billing v2 source file should exceed about 450 LOC.

## Scripted Acceptance Battery

Layer 1 is a no-model automated harness battery. It must pass before model-in-loop CartCalc calibration.

Required coverage:

- Patching: well-formed replacement applied atomically; malformed delimiter rejected with turn semantics intact; replacement targeting `specs/`, `specs/steps/`, `package.json`, `bunfig.toml`, `tsconfig.json`, `bun.lock`, or `bun.lockb` rejected and logged; multi-file replacement in one turn; empty-content edge case; deterministic confirmation lines.
- Command gating: these commands are rejected and consume a verification slot: `scratch/../src/x.ts`, absolute path outside scratch, symlink inside scratch pointing to `src/`, `scratch/*.ts`, `scratch/a.ts; rm -rf /`, backticks, `&&`, `$(...)`, `FOO=1 bun ...`, flag smuggling such as `--eval`, `bun run spec` from the context arm, `bun test src/`, bare `bun test`, and non-integer `--cp` value.
- Allowlist confirmations: absolute paths both inside and outside `scratch/`, `scratch%2F..%2Fsrc`, `scrаtch/a.ts` with Cyrillic `а`, `scratch/a.ts\nrm`, `scratch\..\src\x.ts`, and embedded `\x00` are rejected by the sealed relative POSIX path grammar before resolution.
- Mounts and persistence: scratch file written at CP1 is readable at CP3; read-only enforcement survives checkpoint transitions; example test is green in fresh sandboxes in both arms.
- Integrity: protected-path hashes cover `specs/`, `specs/steps/`, `package.json`, `bunfig.toml`, `tsconfig.json`, and Bun lockfiles when present; replacement-time or verification-time drift terminates `invalid_integrity`.
- Parser and termination semantics: zero valid blocks consume turns, inject the one-line harness notice, and three consecutive no-op turns terminate `agent_stalled`.
- Accounting and logging: verification counter refuses at exactly 6; refusals consume slots; token-budget exhaustion mid-checkpoint terminates `budget_exhausted`; provider retry exhaustion terminates `provider_error` without consuming a model turn or token budget; spend-cap breach terminates `spend_cap_reached` before transport invocation; full-output hash matches independently recomputed hash; truncation marker is present and head/tail split is correct on the noisy fixture, including multi-byte content that would otherwise decode to replacement characters; per-turn snapshots replay to bit-identical workspace state.
- Provider client seam: live transport requires `live_mode=true`; canned transport proves retry/malformed-response handling; provider exchange records are redacted and include raw hashes; bundle emission fails if a configured secret appears in serialized artifacts.
- Snapshot replay: after a full CartCalc run, replay artifact snapshots onto a fresh workspace and byte-compare final state.

Layer 1 must be green on two clean environments before Billing v2 design starts: macOS local and an Ubuntu 24 container, with the same pinned Bun version.

Lockfile/environment requirement:

- if a Bun lockfile exists, sandbox setup runs `bun install --frozen-lockfile`;
- runtime uses `--no-install`;
- environment boundary records Bun version plus lockfile hash;
- the repo now has its first runtime dependency, `js-tiktoken`, so `bun.lock` is required and part of the environment boundary;
- from the first commit with any runtime or dev dependency in `package.json`, missing or stale `bun.lock` is an invalid environment boundary and the orchestrator refuses to start a run.

Full-suite stability is a gate, not a footnote. Harness tests must not depend on real-clock sleeps; use fake timers or injected clocks for timeout behavior. Step 0 requires 10 consecutive green full-suite runs on both environments, with zero quarantined tests or a published exclusion list.

## L1 Shakedown

Insert a no-provider L1-shakedown phase after the L1 adapter exists and before L2/CartCalc calibration.

Scripted fake agents must cover:

- pure prose with no protocol blocks;
- malformed delimiters: unclosed, nested, duplicated, and interleaved with code fences;
- valid blocks wrapped in a single outer markdown fence;
- valid blocks in wrong precedence order;
- chatty output with valid blocks buried in explanations.

The sealed parser policy is to strip one outer markdown fence layer, then parse. This avoids manufacturing stalls from common model formatting habits. Parser behavior on every scripted agent must match the sealed grammar exactly before provider spend.

After scripted shakedown, run one cheap real model calibration to measure live no-op rate. If no-op rate exceeds 10 percent, prompt-template iteration is allowed before the Step 0 seal and frozen after it.

## Cost Model

Step 0 fills in these measured variables:

- `t`: mean turns used per checkpoint;
- `v`: mean verification calls per checkpoint;
- `f`: fresh input tokens per turn;
- `o`: output tokens per turn.

Planning episode counts:

| Stage | Runs | Checkpoint episodes |
| --- | ---: | ---: |
| Probe: 3 context + 1 feedback | 4 | 72-96 |
| Stage A: 2 models x 2 arms x 5 seeds | 20 | 360 |
| Stage B extension, worst case both models | +20 | +360 |
| Isolated competence, scoped | n/a | about 20-30 short episodes |

Worst case is roughly 800 checkpoint episodes and 5,000-8,000 model turns if `t` lands near 7-8.

## Context Strategy

The checkpoint thread-scope strategy is sealed in `docs/protocols/e1-frontier-sealed-constants-v0.2.json`:

- a fresh conversation starts for every checkpoint;
- prior checkpoint memory is workspace-only: code, protected specs, and persisted `scratch/`;
- full repo context is injected once at checkpoint start;
- later turns stay in that checkpoint's provider conversation where possible;
- later turns receive harness-computed replacement summaries, optional harness-computed diffs, and verification output, not a full repo reinjection;
- provider caching behavior and reported cached/fresh token split are recorded when available.

Without caching, a frontier E1 matrix is likely operationally infeasible.

## Cost Trim Order

If Step 0 projects cost above the operator's budget ceiling, trim in this order before sealing Billing v2:

1. reduce max turns from `12` to `10`;
2. reduce the primary probe from 18 checkpoints to 15 by dropping the lowest-interaction-degree checkpoints from the sealed interaction graph;
3. keep Stage A at 5 clean pairs;
4. cap Stage B at 8 clean pairs.

Trims are permitted exactly once: after CartCalc, before the Billing v2 seal. After the seal, the matrix is immutable.

Do not trim calibration's frontier context-arm run. Replacement rate and turn usage are model-dependent, and those numbers drive the seal.

Precondition for launching Stage A:

- the operator has budget reserve for worst-case Stage B for both models.

If worst-case Stage B cannot be funded, do not start Stage A.

## Go Gate For Billing v2

Do not build Billing v2 until:

- L1 and L2 are implemented and a CartCalc run executes end-to-end from one orchestrator command, emitting the full artifact bundle; the current dev-grade no-provider package/oracle runner is a partial prerequisite, not the provider-ready gate;
- L1-shakedown passes scripted fake agents and one cheap real model no-op-rate check;
- the Layer 1 battery is green on macOS local and Ubuntu 24 with the same pinned Bun version;
- the stability gate records 10 consecutive green full-suite runs on both environments;
- CartCalc model-in-loop calibration completes a second consecutive defect-free pass;
- `scratch/example.test.ts` runs green in a fresh sandbox in both arms;
- read-only spec rejection is observed and logged;
- measured `t`, `v`, `o`, no-op rate, truncation behavior, and wall-time profile are recorded;
- projected full-matrix cost is within the operator's budget ceiling.

Only after this gate opens should Billing v2 design start. The first Billing v2 artifact should be a consolidated protocol document carrying the full E1 decisions and compatibility boundary, with its hash used as the task-branch commitment anchor.

## Step 0 Closure Record (2026-06-10, post-snapshot-fix boundary)

The pre-snapshot-fix calibration bundles (2026-06-10, prompt-template hash `e562f073…`) are a dead compatibility boundary: the workspace-snapshot stub fix and the three-message cache-breakpoint layout changed the prompt-template hash to `1327a200…`. The gate was re-run and closed under the new boundary.

Operator-authorized calibration runs (model `deepseek-v4-flash`, route `deepseek-direct-chat-completions`, classification `calibration`, all replay-valid under `bun run e1:inspect` with 0 mismatches):

- `e1-cartcalc-deepseek-flash-direct-both-all-seed-a-20260610-003` — both arms, 3 checkpoints, oracle 1.0/1.0, $0.003221.
- `e1-cartcalc-deepseek-flash-direct-both-all-seed-b-20260610-003` — both arms, 3 checkpoints, oracle 1.0/1.0, $0.002993.
- `e1-cartcalc-deepseek-pro-direct-context-all-20260610-003` — frontier context arm, 3 checkpoints, oracle 1.0, $0.007864.

Measured constants (via `bun run e1:stats`):

| Variable | Cheap (flash, 2 seeds, both arms) | Frontier context (pro) |
| --- | ---: | ---: |
| `t` turns/checkpoint | 1.83 | 1.67 |
| `v` verification requests/checkpoint | 1.25 | 0.67 |
| `f` fresh input tokens/turn | 939 | 1344 |
| cached input tokens/turn | 1711 | 717 |
| `o` output tokens/turn | 522 | 1133 |
| no-op turn rate | 0 (gate: <10%) | 0 |
| stall rate | 0 | 0 |
| truncation hit rate | 0 | 0 |
| wall time/turn (provider + harness) | ~5.7s | ~12.0s |

Live observations closing the remaining behavioral items: self-authored scratch tests ran green in fresh sandboxes (`bun test scratch/test.ts`, `bun scratch/test-cp2.ts`, exit 0); the feedback arm exercised the real loop (`bun run spec` exit 1 → code fix → exit 0 within one checkpoint); command gating refused out-of-grammar attempts live (`bun test specs/run-spec.ts --cp=1`, `bun run scratch/…`) with the model recovering on the next request. FILE-write rejection of protected spec paths is exercised by the scripted batteries on every suite run.

Cost model with measured constants (cost per checkpoint episode = `t` × per-turn token cost):

| Lane | $/checkpoint episode | Probe (72–96 ep.) | Stage A (360 ep.) | Worst case (800 ep.) |
| --- | ---: | ---: | ---: | ---: |
| flash | ~$0.00052 | ~$0.05 | ~$0.19 | ~$0.41 |
| pro | ~$0.0026 | ~$0.25 | ~$0.94 | ~$2.10 |

Caveats: CartCalc is trivial — the Billing v2 task will have multi-file snapshots (larger `f`) and harder checkpoints (larger `t`, toward the 7–8 planning bound). At `t=8` and 5× fresh-input size, worst case stays under ~$10 (flash) / ~$45 (pro); a Sonnet-class frontier lane at ~10–40× pro token prices is the budget driver and must be projected at evidence-matrix seal time.

**Go gate: all items pass.** Constants sealed as `docs/protocols/e1-frontier-sealed-constants-v1.0.json` (`version=1.0.0`, `status=sealed`); the v0.2 file remains as the frozen draft history. Future evidence-grade bundles require this sealed constants file plus a protocol-document hash at invocation.
