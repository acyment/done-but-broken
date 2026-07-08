# ADR-005 — Snapshot/resume strategy for sequential state (brief §13 Q5)

**Status:** Proposed (Phase-1 gate). **Binding input:** Gate-0 injection 3 — replay-validity is a
**chain property**, defined at chain level in the manifest schema.

## Context

E4 runs 6–10 tasks sequentially per arm; a crash mid-sequence must not cost the whole run (R5: at
pilot scale a lost sequence is unaffordable). No resume machinery exists in the repo (DISCOVERY
transfer map: **build**). The `-e2` repo's `e3/` persistent-workspace pattern was consulted
read-only as the brief permits; its most relevant lesson is negative: the E3 **gold-leak** incident
(git history inside the agent-visible workspace leaked future ground truth) demonstrates that a VCS
object database in the workspace is both hidden state and a leak surface.

## Options

- **A. Git-based snapshots in the workspace.** Cheap deltas, familiar tooling — but puts a `.git`
  object DB inside the agent-visible tree: agent-inspectable history (leak surface, the E3 lesson),
  agent-mutable state (a `git reset` by the agent corrupts the record), and reflog/gc
  nondeterminism in hashes.
- **B. Harness-side directory copies + content-hash manifests (chosen).** Copy the arm workspace at
  every task boundary to a harness-owned location outside the mount; hash with the existing
  machinery.
- **C. Overlay/CoW filesystems.** Platform-dependent (darwin/linux divergence), operationally
  clever, forensically opaque. Rejected for a record-keeping instrument.

## Decision

**Directory-copy snapshots, harness-side, content-hash-anchored (B).**

- **When:** at sequence start (T0, post-mount) and after every accepted task close (post-oracle,
  post-meter, post-noticing-probe), per arm.
- **Where:** `runRoot/snapshots/<arm>/task-<k>/` — outside every agent-readable mount, same
  isolation discipline as the hidden oracle (`assertHiddenOracleOutsideAgentReadableWorkspace`
  precedent).
- **Integrity:** each snapshot gets a content-hash manifest via the existing `snapshot.ts` /
  `e1-workspace-snapshot` machinery (transfer map: as-is). The snapshot hash is recorded in the
  task's manifest record — these are the replay anchors.
- **Resume:** on restart with `--resume <runId>`, the runner reads the manifest, finds the last task
  record with `status: complete` per arm, verifies the snapshot hash, restores it into a fresh
  workspace, and continues at task k+1. A mid-task crash discards the partial task: task k restarts
  from snapshot k−1 with a **fresh conversation** (the estate's fresh-conversation-per-checkpoint
  layout makes this well-defined — no mid-conversation state to reconstruct). Partial-task turn
  records are moved to `runRoot/aborted/`, retained for forensics, excluded from analysis.
- **Recording:** every resume event is a manifest entry (`resume_events[]`: wall-clock gap, task
  index, snapshot hash verified). Sizes are trivial (generated app = tens of KB), so copies beat
  cleverness.

## Replay-validity as a chain property (injection 3, normative)

An E4 sequence is **replay-valid** iff:

1. the substrate regenerates byte-identically from `substrate_seed` + substrate config (generator
   determinism), AND
2. every task's turn records replay end-to-end over the snapshot chain: applying task k's recorded
   turns to snapshot k−1 reproduces snapshot k's content hashes, **across resume seams** — a resume
   is valid only if the restored snapshot hash matched the recorded one.

The manifest schema carries this at chain level:
`replay_validity: { substrate_regeneration_ok, per_task_replay_ok[], chain_replay_valid }` —
`chain_replay_valid` is the conjunction, and headline claims may rest only on sequences where it is
true (brief §9). The E4 inspector (Phase 3) recomputes it the way `inspectE1Bundle` replays E1
bundles.

## Consequences

- No VCS in the workspace: nothing for the agent to read or corrupt; the E3 leak class is
  structurally absent.
- Disk cost linear in tasks × arms × seeds — negligible at v1 sizes; revisit only if v2 real-repo
  substrates (multi-MB trees) arrive.
- Crash-resume never manufactures evidence: a resumed sequence is still one sequence, one identity;
  anything unreplayable flips `chain_replay_valid` to false rather than being patched over.
- **Pinned for the Phase-2 analysis (Gate-1):** aborted partial-task usage is
  infrastructure-classified and excluded from freshness-tax and drift-tax computations.
