# e1-self-directed-verification-turn-based-v0

Status: draft protocol profile. Step 0 local L0 mechanics, L1 parser shakedown, no-provider L1 turn consumption, a scripted no-provider checkpoint runner, a no-provider multi-checkpoint/arm shakedown runner, and a dev-grade no-provider task/oracle package runner are implemented; the live provider conversation adapter and evidence-grade L2 run orchestrator are not implemented. No provider run is authorized by this document.

## Purpose

This profile defines the recommended control policy for any future frontier-model branch. It replaces the vague phrase "normal tool access" with an exact turn-based verification channel.

The treatment under this profile is:

> provided executable BDD specs on top of the same bounded self-directed verification channel available to both arms.

This is the industry-relevant question. A production frontier coding agent can usually run some checks. The experiment should therefore ask whether maintained executable BDD assets still help when the context arm can write and run its own probes under the same budget.

## Layer Decomposition

"E1 harness" means three layers. L0 exists today, the L1 block parser exists, and no-provider L1/L2 shakedown support exists; live provider conversation integration and evidence-grade L2 orchestration do not.

- L0 mechanics library: full-file replacement parsing/application, command validation, protected-path checks, verification execution, truncation, hashes, and counters.
- L1 agent loop adapter: parses model output into protocol blocks, assembles model turns, maintains the provider conversation/cached prefix, injects verification output, debits the token ledger, separates provider failures from agent behavior, and talks to providers. Parser, local turn consumption, no-provider checkpoint conversation assembly, and provider-error runtime semantics are implemented in `src/e1-l1-parser.ts`, `src/e1-turn-adapter.ts`, `src/e1-no-provider-runner.ts`, and `src/e1-provider-runtime.ts`; live provider conversation assembly is still missing.
- L2 run orchestrator: seeds workspaces, configures arms, advances checkpoints, records budget ledgers, snapshots workspaces, emits artifact bundles, and assigns run/checkpoint classifications. A dev-grade no-provider task/oracle package runner exists for scripted shakedown, including hidden-oracle scoring on every turn snapshot; live-provider orchestration and publication-grade L2 remain missing.

CartCalc calibration and any Billing v2 run require live provider conversation integration plus evidence-grade L2. L0 mechanics plus the no-provider runner are not an evidence-generating harness.

## Conversation Scope

Each checkpoint starts a fresh provider conversation. The checkpoint-start message carries the current repo snapshot, shared instructions, the checkpoint-specific visible spec, and condition-specific verification affordances. Prior checkpoint state reaches the model only through the workspace: application code, protected specs, and persisted `scratch/` files.

Within a checkpoint, later turns append the model's earlier output plus harness notices and verification output. One continuous provider thread across checkpoints is rejected for this protocol version because it changes the cost model and weakens the intended workspace-maintenance pressure.

The checkpoint-start conversation is part of the parity surface. The harness diffs assembled prompts for `context_only_spec` and `feedback_capable_spec` and permits only the sealed allowlist: the context-only self-verification line, the feedback-capable provided-feedback lines, and feedback asset path lines. The context arm prompt must not mention `bun run spec` or provided executable feedback.

## Turn Structure

Each checkpoint allows up to `12` model turns.

On each turn the model output is scanned in fixed precedence order:

1. full-file replacement sections;
2. at most one verification request;
3. one optional done declaration.

The harness applies full-file replacements atomically, then executes at most one verification request. Verification output is injected verbatim at the start of the next model turn. The checkpoint ends when the model declares done, the turn budget is exhausted, the sealed token budget is exhausted, three consecutive no-op turns occur, protected-path integrity fails, or provider retries are exhausted.

After `done`, `agent_stalled`, or `budget_exhausted`, the next checkpoint starts from the current workspace as-is. For non-done terminations, the checkpoint's new assertions score as failed. `invalid_integrity` terminates the entire run. `provider_error` also terminates the run, but is transport failure rather than agent behavior; it is excluded from analysis and rerun only under a fresh run identity. `spend_cap_reached` terminates before transport invocation when the explicit spend cap would be exceeded; it is an operator-budget stop and is also excluded from analysis.

Unified diffs are not supported as a model-facing format. A replacement block contains one or more `<<<FILE path>>>` ... `<<<END>>>` sections. Rejections are deterministic: malformed delimiters, invalid paths, or attempts to write read-only paths. Rejection is logged and consumes the replacement opportunity for that turn.

Replacement side effects have two separate outputs:

- model-facing confirmation only: one deterministic line per applied file, for example `applied: src/discounts.ts (87 -> 94 lines)`;
- audit artifact: a harness-computed unified diff between pre/post snapshots, stored in the artifact bundle and never shown to the model.

If a turn contains zero valid protocol blocks, it is a no-op turn. It consumes one model turn. The next model turn begins with exactly one harness notice line: `no valid blocks parsed`. Three consecutive no-op turns terminate the checkpoint as `agent_stalled`, distinct from `budget_exhausted`. `agent_stalled` is excluded from drift analysis and counted as failure for the checkpoint's new assertions.

Stall/no-op reporting is mandatory in the evidence package. Report a per-(model x arm) table. If arm stall rates differ by more than 2x and the higher arm exceeds 5 percent of checkpoints, attach a protocol-usability caveat to that model row. If the feedback arm stalls more, review transcripts for verification-output injection confusing the next-turn parser before interpreting the result as model ability.

## Verification Command Whitelist

Allowed command patterns are sealed per task language. For this repo's default JavaScript/TypeScript task shape:

| Command pattern | `context_only_spec` | `feedback_capable_spec` |
| --- | --- | --- |
| `bun test scratch/<test-file>.ts` | allowed | allowed |
| `bun scratch/<script>.ts` | allowed | allowed |
| `bun run spec` or `bun run spec -- --cp=<checkpoint>` | not available | allowed |

If a future task deliberately introduces Python, use `uv`-owned equivalents only:

| Command pattern | `context_only_spec` | `feedback_capable_spec` |
| --- | --- | --- |
| `uv run pytest scratch/` | allowed | allowed |
| `uv run python scratch/<script>.py` | allowed | allowed |

Rules:

- no network;
- no package installation;
- no arbitrary shell;
- commands are parsed into fixed argv templates, never passed through a shell;
- one verification request per turn;
- execution timeout `60s`;
- non-whitelisted commands return a refusal string and still consume the verification slot.
- path parameters are resolved with realpath and must be contained inside resolved `scratch/`;
- path parameters must use `.ts` or `.test.ts`;
- path tokens use the sealed relative POSIX allowlist `^[A-Za-z0-9._-][A-Za-z0-9._/-]*$`, ASCII only, no leading `/`, no leading `-`, no `..` segment before resolution;
- shell metacharacters, globs, `~`, URL encoding, Unicode homoglyphs, control characters, environment-variable syntax, flags, and whitespace inside path tokens are rejected by the allowlist;
- Windows path separators are out of scope; `\` is invalid input, not a separator;
- Bun commands run with no auto-install behavior and a clean environment.

`spec` is a `package.json` script owned by the harness. It exists only for `feedback_capable_spec`.

## Workspace Rules

`scratch/`:

- writable by both arms;
- intended for model-authored tests and probes;
- persists across turns and checkpoints;
- captured in code snapshots for auditability;
- excluded from the hidden oracle import path.

`specs/`:

- harness-enforced read-only for both arms;
- contains visible Gherkin/spec content.

`specs/steps/`:

- harness-enforced read-only for `feedback_capable_spec`;
- contains provided step definitions and runner assets.

Application code:

- writable in both arms.

Harness config:

- `package.json` and `bunfig.toml` are read-only;
- `tsconfig.json`, `bun.lock`, and `bun.lockb` are read-only if present.

Replacement attempts against read-only paths are rejected and logged. This prevents spec vandalism, feedback-suite tampering, `spec` script retargeting, and import-alias retargeting.

Read-only enforcement is defend-and-verify, not a mount claim. At checkpoint start, L2 records hashes for every protected file under `specs/` plus `package.json`, `bunfig.toml`, `tsconfig.json`, `bun.lock`, and `bun.lockb` when present. L1/L2 re-verifies those hashes after replacement application and after every verification execution. Any mismatch terminates the run as `invalid_integrity`; the current snapshot is archived but the run is not evidence. The sandbox process should chmod protected paths read-only as defense in depth, but the claim-bearing guarantee is the post-mutation hash check.

Environment boundary:

- sandbox setup uses `bun install --frozen-lockfile` whenever a Bun lockfile exists;
- runtime verification commands use `--no-install`;
- Bun version and lockfile hash are compatibility fields;
- the repo now has its first runtime dependency, `js-tiktoken`, so `bun.lock` is required;
- from the first commit where `package.json` declares any runtime or dev dependency, missing or stale `bun.lock` is an invalid environment boundary and the orchestrator refuses to start a run.

## Package, Oracle, And Scoring Boundary

Task packages and oracle packages are separate artifacts with separate hashes. The task package is mounted into arm workspaces. The oracle package is never mounted and is used only by the external scorer.

Oracle scoring runs against every turn snapshot. The primary endpoint uses checkpoint-end snapshots; all-turn scoring is retained for recovery-latency and drift analysis.

The sealed AUC formula is `checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1`: mean, over checkpoints, of the cumulative hidden assertion pass rate at each checkpoint-end snapshot.

Task and oracle packages must declare the same fixed `virtual_now`. Reachable real-clock APIs in package-controlled files are rejected during package loading.

Bundle grade is explicit: `dev` for draft constants or missing protocol-document hash; `evidence` only when constants are sealed and the protocol-document hash is recorded. Run identity includes the prompt-template hash so shared prompt drift between calibration and later runs is an explicit compatibility change.

Seed is a pairing label unless the provider exposes an actual RNG seed. The label binds task package, oracle package, constants version, prompt-template hash, checkpoint sequence, and budgets. Paired analysis pairs on that label. Replay reproduces recorded turn consequences exactly; it does not claim to regenerate provider samples for APIs without seed support.

## Budgets

All constants are part of the compatibility boundary and must be sealed before evidence-generating runs:

- max model turns per checkpoint: `12`;
- max verification executions per checkpoint: `6`;
- verification timeout: `60s`;
- output shown to model per execution: `4000` tokens;
- truncation rule: first `2500` `js-tiktoken` `o200k_base` tokens plus last `1500` tokens, with an explicit truncation marker;
- verification output tokens count against the per-checkpoint token budget.

The `6` verification executions are shared across command types. For the feedback arm, `bun run spec` consumes the same quota as self-authored tests or probes. The feedback arm is not compensated with extra executions.

The per-checkpoint token ledger debits model output tokens plus injected verification-output tokens. Provider-reported usage is the ledger of record whenever the API returns it. The sealed local estimator is `js-tiktoken-o200k_base-v1` (`js-tiktoken@1.0.21`, `o200k_base`). It is the operational tokenizer for verification-output truncation because truncation happens before provider usage can be known, and it also runs in shadow mode on every turn. It is the fallback only when provider usage is missing. Sustained provider-vs-estimator drift greater than 15 percent across a checkpoint flags the run for review. Cached repo prefix cost is recorded separately as a cost statistic and compatibility field; it is not debited from the checkpoint budget. Cache breakpoints are sealed at the system/template boundary and checkpoint-start repo injection, with provider cache-read tokens recorded in `cached_prefix_tokens`, not inferred. Token budgets are provider-tokenizer-denominated and are compared arm-vs-arm within a model, not as absolute cross-provider budgets. If token exhaustion occurs mid-checkpoint, the checkpoint terminates cleanly as `budget_exhausted`, snapshots the current workspace, and the hidden oracle scores that snapshot as-is.

Transport-level API errors, timeouts, rate limits, malformed provider responses, and network errors use the sealed retry policy: 3 attempts with 250ms, 1000ms, and 4000ms backoff slots. Retries cost no model turns and no tokens but are logged in provider-attempt metadata. Exhausted retries terminate the run as `provider_error`.

Live provider calls require `live_mode=true` and a positive per-invocation spend cap in the provider profile. The client checks the cap before invoking transport; a projected cap breach terminates as `spend_cap_reached` with zero model turns and zero provider calls.

The provider client is transport-injectable. Canned transports are used to prove retry, usage-ledger, recording, redaction, and termination behavior before authorization. Live smoke exchanges are intended to become redacted request/response fixtures with raw request/response hashes.

## Shared Verification Scaffolding

Both arms receive identical harness-mechanics documentation in the shared README:

- the `@app/*` import alias;
- where shared fixtures live;
- exact invocation strings for allowed self-authored tests and probes;
- the fact that `scratch/` persists across checkpoints.

Both arms also start with a trivial passing example at `scratch/example.test.ts` that imports one app module through `@app/*`. This file is harness scaffolding, not task-specific feedback. Step 0 calibration must prove it runs green in a fresh sandbox in both arms.

## Feedback Semantics

Execution output consists of:

- command string;
- exit code;
- capped stdout;
- capped stderr.

The harness injects this output verbatim into the next turn. It adds no interpretation, summarization, hints, triage, or file suggestions.

Stack traces and runner output that reveal file structure are declared part of the treatment. They are not sanitized away.

## Logging And Audit

For every verification request, artifacts record:

- turn index;
- command string;
- exit code;
- wall time;
- hash of the full untruncated output;
- truncated output shown to the model.

For every provider call, artifacts record provider-attempt metadata when retries occur or fail. Exhausted provider retries produce a `provider_error` record with no model turn consumed.

For every provider exchange recording, artifacts store only redacted request and response bodies plus raw hashes. Bundle emission fails closed if any configured secret value appears in serialized artifacts.

The full untruncated output must be archived with the publication bundle. A reviewer should be able to reconstruct the exact information channel for each arm.

Model-authored files in `scratch/` are snapshotted per turn like application code.

For every applied replacement, artifacts record the model-facing confirmation lines and the audit-only unified diff. The diff is never injected into the model conversation.

The audit diff is computed over a sealed inclusion manifest: `src/`, `scratch/`, and `specs/`. `specs/` should normally produce an empty diff and exists in scope only so integrity violations are visible. Excluded paths include `node_modules/`, `.git/`, harness logs, coverage output, Bun cache, and generated run artifacts. Paths are sorted lexicographically by bytes; line-ending normalization is off; file mode changes are recorded; binary files are represented as hash pairs rather than textual hunks. Snapshot files are the ground truth; diffs are derived audit views.

## Claim Meaning

A positive result under this profile means:

> Given identical visible specs, identical budgets, and an identical ability to write and run their own tests, providing maintained executable BDD assets reduced regression drift under a turn-based, full-file-replacement editing protocol with budgeted verification executions.

The isolated mechanism is the cost of self-authoring and self-maintaining verification under budget. The context arm can reproduce the feedback arm's checks in principle, but it must spend turns, executions, and tokens to do so. The full-file replacement constraint is symmetric across arms, but external validity to IDE-grade partial-edit tools, interactive shells, or string-replace editing is out of scope unless a later protocol version adds those capabilities.

## Harness Gap

The current provider model loop does not yet implement this profile end-to-end. Step 0 L0 mechanics exist in `src/e1-harness.ts`, the constants-driven L1 block parser exists in `src/e1-l1-parser.ts`, local turn consumption exists in `src/e1-turn-adapter.ts`, scripted no-provider checkpoint loops exist in `src/e1-no-provider-runner.ts`, and dev-grade no-provider task/oracle package execution exists in `src/e1-package-runner.ts`, but the live provider loop still only runs the provided feedback command for `feedback_capable_spec`; it does not yet support symmetric model-requested verification commands for both arms.

Before any E1 evidence-generating run, add test-first harness support for:

- structured verification request parsing;
- no-op-turn and `agent_stalled` semantics;
- command whitelist enforcement;
- `scratch/` persistence and capture;
- protected-path hash verification and `invalid_integrity` classification;
- capped output injection on the next turn;
- full-output hashing;
- budget accounting for model turns, verification executions, model output tokens, injected verification-output tokens, and cached-prefix cost;
- provider-error retry logging and `provider_error` run termination;
- live-mode/spend-cap gating and `spend_cap_reached` termination before transport invocation;
- fail-closed redaction checks for provider exchange fixtures and emitted bundles;
- audit-only replacement diffs and model-facing confirmation lines;
- compatibility-profile recording for all constants above.
