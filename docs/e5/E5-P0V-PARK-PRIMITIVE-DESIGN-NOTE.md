# E5 P0-V item 4 — lawful park/abandon primitive for change directories (design note)

**Status: APPROVED by the operator 2026-07-13 (recommended PARKED.md-marker design ratified
via in-session review; the `<<<PARK>>>` token alternative rejected).**

## The verified trap being repaired

`E4-ARC-CLOSEOUT-v1.md` §5.3, verified against `src/e4/v2/gate.ts`:

- Custody at spec exit requires the changed-since-task-start openspec paths to span
  **exactly one** `openspec/changes/<name>/` directory (`gate.ts:269-274`).
- The turn protocol has **no deletion primitive** (FILE is full-file write only).

Consequence: when a stalled predecessor leaves a half-built change directory, the next
task's agent has three lawful moves — ignore the leftover entirely, complete/absorb the
leftover **as** its own task change (the silently-swapped task), or stall. Any attempt to
tidy the leftover *and* open a clean change touches two directories and is refused. The
proposal keeps the leftover mess as realistic product stress (auto-quarantine was
withdrawn) but requires a lawful way to set a leftover aside.

## Recommended design: PARKED marker file (no turn-protocol change)

**Affordance.** Writing a file named `PARKED.md` at the top level of a change directory
(`openspec/changes/<name>/PARKED.md`) parks that change. This is an ordinary spec-phase
FILE write — the spec-phase guard already allows writes inside any change directory. The
marker's content is free text (suggested: one line on why it was parked).

**Custody rule change (`gate.ts`, both arms — shared workflow, identical text).** At spec
exit, changed directories are partitioned into *parked* (directory contains `PARKED.md` in
the current tree) and *active*:

1. Marker writes into a parked directory are lawful and do not make it active.
2. The exactly-one rule applies to the **active** set only (rule otherwise unchanged).
3. Zero active changed dirs + a non-behavior-preserving task → custody failure whose
   feedback names the parked dirs ("all changed directories are parked; open a change for
   the current task").
4. Behavior-preserving affirmation (§3.3) is amended: a diff consisting **only of PARKED.md
   markers added to pre-existing change directories** still qualifies for the byte-unchanged
   affirmation path (parse + ≥1 smoke conditions unchanged). Without this carve-out a
   leftover plus a maintenance task re-creates the trap.
5. Parked directories are never bound, never merged, never archived — they stay in the tree
   as-is (the realistic mess persists, now labeled).
6. A `change_parked` gate event is recorded per newly parked directory; the gate summary
   gains an additive `parks` count (manifest additive field, null/0 for historical records).

**Unparking.** Deliberately one-way per directory (no delete primitive exists to remove the
marker). To resume parked work the agent copies content into a fresh change directory —
everything stays readable. Recovery from parking your own active change by mistake is the
same copy-forward. Recorded as a known limitation.

**Documentation (agent-facing, both arms).** One short paragraph in the workspace README
and one bullet in the sealed workflow protocol text: leftover change directories from
earlier tasks may be parked by writing `PARKED.md` into them; parked changes are ignored by
the workflow. Both texts are already being re-sealed at this boundary (P0-V items 1–2), so
this rides the same constants version bump.

**Interplay with item 5 (off-topic scoring).** Parking makes leftover handling lawful and
*visible*; absorbing a leftover as one's task change remains possible and now lands in the
off-topic close category instead of masquerading as a truthful close.

## Alternative considered: `<<<PARK change-name>>>` turn token

An ASK_PM-style pre-pass token (the e4-turn-protocol-v2 precedent). Rejected as the
recommendation because it touches the sealed turn grammar (protocol id bump, first
argument-carrying pre-pass token, parser-adjacent test surface) to express something the
FILE primitive already expresses, and the marker file leaves a more inspectable trace in
the workspace itself. The token variant remains available if the operator prefers the
explicit-agency signal.

## Blast radius (recommended design)

- `src/e4/v2/gate.ts` (custody partition + affirmation carve-out + event) — twin re-pin.
- `src/e4/v2/workspace.ts` README paragraph — twin re-pin; v2 constants
  `protocol_text.workspace_readme` + `workflow_protocol` re-sealed (version bump already
  scheduled at this boundary).
- Runner/manifest: additive `parks` field pass-through.
- New census tests: park-then-clean-change custody pass; two-active refusal unchanged;
  marker-only BP affirmation; parked dir never archived; off-topic interplay fixture.
- Turn protocol, parser, step grammar, meter, oracle: untouched.
