# E4 v2-M8 pilot — void-run record (v1)

**Status: VOID RUN — NON-EVIDENCE.** This document records, at face value, the fate of the
evidence run launched under the sealed v2-M8 pre-registration
(`docs/protocols/e4-v2-m8-pilot-preregistration-v1.md`, sealed at `f1894f9`, 2026-07-10). **No
claim of any kind derives from this run** — not evidence, not calibration, not a diagnostic
input to any verdict, present or future. It exists so that authorized spend and a spent seal are
auditable rather than silently absent from the record.

## 1. What ran

Seed 22, both arms, one invocation, launched 2026-07-10 ~10:33 under the sealed v1
pre-registration with every sealed parameter honored (verified from the partial manifests:
classification `pilot`, constants v0.3 hash `2f78f534…`, `glm-5.2` on `direct-zhipu-api-key`,
`pair-pilot-seed-22`, profile `e4-openspec-workflow-v1`, boundary ids all correct):

- **Arm 0 (prose) — completed cleanly.** All 6 tasks `complete`, `chain_replay_valid: true`,
  31 turns, $0.8557, wall clock ~35 min. `false_confidence.event == true` on 6/6 tasks.
- **Arm H (executed) — killed mid-chain.** Tasks 1–3 `complete` ($0.2807, 15 turns,
  `false_confidence` 3/3), then the bun process (PID 29234) was killed externally ~11:17 while
  inside task 4. The manifest remains `status: in_progress` with 3 task records;
  `chain_replay_valid: false` (never finalized); the task-4 record directory holds only
  `turns.jsonl` and `initial-messages.json`. The per-sequence
  `reasoning-observability.json` was **never written** (the recorder emits at sequence close),
  so the §5 thinking-on configuration-validity gate is unevaluable for this sequence — a second,
  independent reason the sequence cannot count.
- **Seed 60 was never launched.** With seed 22 gone the verdict was already determined; no
  further spend was incurred.

Total spend of the void attempt: **≈ $1.14** (0.8557 + 0.2807), inside the authorized ~$1.5–4
envelope, now sunk.

## 2. What killed it

**Infrastructure, not model or provider.** The run was launched as a background task of a
Claude Code session; that session's context was later cleared, and the harness reaped the stale
session's background processes, killing the orphaned bun process mid-task. Both task
notifications arrived as "killed"; the launch log is 0 bytes (the process never reached its
final prints); there is no error trace, no provider anomaly, and no model misbehavior anywhere
in the partial records.

Operational lesson (binding on any future evidence launch, carried into the v2
pre-registration's launch procedure): an evidence sequence must never run as a session
background task — it must be launched fully detached (own process group, `nohup`, stdin from
`/dev/null`, PID file) and monitored by polling files, so that session lifecycle events cannot
touch it.

## 3. Sealed consequence, accepted at face value

The v1 seal pinned this exact case (§5: "a sequence that crashes mid-chain is not rerun or
patched — its paired seed is excluded, which at this scale fires interpretability trigger 1 and
the run lands `inconclusive_uninterpretable`. That outcome is accepted rather than engineered
around."). Applied as written:

- The v2 harness has no resume path ⇒ **seed 22 is excluded**.
- One excluded paired seed at n=2 ⇒ **interpretability trigger 1** fires.
- **The M8 pilot as sealed is `inconclusive_uninterpretable`**, and per §6 the program halts at
  this gate for design reassessment rather than rerunning under the same seal.
- **The v1 seal is spent.** Nothing was or will be rerun under it. Any re-attempt requires a
  new operator-sealed pre-registration (a fresh gate act). The cause being infrastructure means
  the experimental design itself needs no change — but the seal does not survive the launch.

The qwen-3.7-max fallback died at the v1 sealing and stays dead; a voided run does not revive
it.

## 4. Non-derivation rule (binding)

No number, observation, or impression from the void attempt may be cited as a finding, used as
causal evidence, pooled with any run, or allowed to influence any future analysis choice. That
includes the Arm-0 false-confidence 6/6, the Arm-H 3/3, drift figures computable from the
partial manifests, and spend/turn appetites. The partial manifests are preserved (below) for
audit of *what happened*, never for analysis of *what it means*. Any future pre-registration
that re-attempts M8 must carry its predicates and thresholds verbatim from the pre-void seals
and must record that the void observations exert no pull on its reporting.

## 5. Provenance decision: partial manifests committed alongside

**Decision: yes — committed**, at
`docs/protocols/e4-v2-m8-pilot-void-manifests-20260710-001/seed-22/` (the two manifest files
plus a README labeling them VOID / NON-EVIDENCE). Rationale: authorized spend on a launched
evidence run should never disappear from the record; the manifests are the audit spine (M6/M7
precedent commits manifests, not full record trees) and they document both the sealed-parameter
fidelity of the launch and the kill point. The folder is named `void-manifests` so it can never
be mistaken for an evidence manifest folder; the verdict tool is never pointed at it (and would
refuse it anyway — the Arm-H manifest is `in_progress` and not replay-valid). Redaction
verified: the only key-like string in either manifest is the route id `direct-zhipu-api-key`.
The full record trees (turns, gate scenarios, snapshots, workspaces) remain local-only under
`tmp/e4-v2-m8-pilot/seed-22/`, gitignored, preserved as long as the machine keeps them.

## 6. Where this leaves M8

E4 is halted at the §6 gate. The path forward, if the operator chooses to re-attempt, is a new
pre-registration (drafted separately as
`docs/protocols/e4-v2-m8-pilot-preregistration-v2.md`, operator review pending) that carries
the v1 design unchanged except for: an updated authorization record, a sealed account of this
void run, a re-made seed decision (seed 22 is now contaminated for this model — its Arm-0
outcome is fully known and its Arm-H outcome partially known), and a detached launch procedure.
Sealing that document and authorizing its run are separate operator acts; neither is implied by
this record.
