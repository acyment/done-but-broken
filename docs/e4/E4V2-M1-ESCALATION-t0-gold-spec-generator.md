# E4 v2 build arc — clean stop at the start of v2-M1

**Status: RESOLVED 2026-07-09 (same day) by a Fable design amendment.** The gap below is closed
by **§5.5 of `E4V2-OPENSPEC-EXECUTABLE-SCENARIOS-PROPOSAL.md`** (`e4-t0-gold-spec-v1`: sealed
requirement/scenario template table, fixture-value policy with GT decorrelation, capability
naming, per-milestone verification split M1-structural / M2-executed / M4-calibration) plus a
§7.5 scope clarification (spec-side convention coverage = `error_format`-kind only). Each
degree of freedom listed under "undecided" below is now pinned there. The M1→M5 build arc is
unblocked; this note stays as the record of the stop.

---

Original note (historical):

**Status: STOPPED before any code. No commits made. A Fable (judgment) session is needed.**
Written 2026-07-09 by the Opus build session that was asked to run v2-M1…M5 as one continuous
arc. Per the arc's stop rules, this is a clean stop, not a failure.

## Which stop rule fired

- **Rule 1** — the design doc is *silent* on something the code needs decided.
- **Rule 3** — a sealed surface needs specification beyond what the doc provides.

Both point at the same missing piece.

## What is unresolved (one thing)

**The T0 gold spec-of-record generator: how the harness turns the baseline ground-truth model
of the app into the initial OpenSpec scenario blocks that ship in the T0 workspace.**

v2-M1 is "the OpenSpec workspace generator". In v1, the T0 workspace ships two spec files
(`specs/openapi.json`, `specs/CONVENTIONS.md`) that the substrate generates deterministically
from the app's ground-truth model and verifies in-sync. The v2 design (§3, §4) *replaces* those
files, as the agent-facing spec, with a real OpenSpec spec-of-record at
`openspec/specs/<capability>/spec.md` written in `#### Scenario:` blocks.

So the workspace generator must emit that spec-of-record at T0. Three independent forces make
this mandatory and non-deferrable:

1. **The pinned CLI requires it.** `@fission-ai/openspec@1.4.1`'s own validator enforces
   `## Purpose` + `## Requirements`, and **every requirement must contain ≥1 `#### Scenario:`
   block** (`REQUIREMENT_NO_SCENARIOS`; `scenarios.min(1)` in `base.schema.js`). M1 explicitly
   wires `openspec validate`. A requirements-only or placeholder spec-of-record does not validate.

2. **The drift construct assumes a populated, in-sync baseline.** The whole v2 thesis is "a
   *stale* scenario becomes a red check" (§1) and the meter classifies `stale_claim` as "the
   post-rename/post-delete signature" (§7.5) — both presuppose pre-existing T0 scenarios that
   later go stale. The substrate (populated endpoints/entities/seed, drift = modifying
   already-specified surface) is built around a populated T0.

3. **Whatever text T0 ships IS a sealed surface.** Those T0 scenarios are the baseline the M4
   drift meter measures against (`spec_vs_truth`), the coverage denominator (§7.5 `coverage_gap`
   = truth endpoint matched by no scenario request), and the context for the M4 kill-score. They
   are the direct analog of v1's `scaffold.ts` `openApiSpec`/`conventionsMarkdown`, which are
   treated as sealed, constants-adjacent, reviewed surfaces.

## What the design *does* freeze (so the gap is precise)

The design freezes, to regex-level detail:
- the scenario **grammar** and the sealed **step-pattern table** with executable semantics (§5.3),
- the **custody floors** (§5.3: ≥1 THEN, ≥1 value-binding assertion, quoted literals, …),
- the meter **classification** rules (§7.5),
- the **gate** mechanics and novelty-under-MODIFIED semantics (§6),
- the adversarial-bank variant set and the kill-score definition (§7).

It never specifies the **generation policy** that produces the T0 gold scenarios from the
ground-truth model. The E2 converter cited as prior art (`openspec.py`) is **parse-only**
(text → `.feature`); it is not a generator, so the M2 "converter port" does not fill this gap
either. The gap is unassigned across M1–M4.

## The undecided degrees of freedom (each fixes the sealed baseline)

Every one of these changes the drift baseline, the coverage denominator, and/or the kill-score
denominator, so none can be improvised:

1. **Granularity** — one requirement per endpoint? one scenario per endpoint, or several
   (happy-path + a validation-rejection + a consequence check)? This directly sets the §7.5
   coverage denominator ("every truth endpoint matched by ≥1 scenario request").
2. **Which assertions** — the floors demand ≥1 value-binding assertion per scenario; which IR
   field values get pinned, and via which step form (`equals <json-literal>`, whole-body
   `equals`, `remembered`, list-length)?
3. **Seed vs fresh-created data** — A6 says the *hidden GT suite* prefers fresh-created rows over
   seed rows. Does the T0 gold spec-of-record follow the same policy, or read seed rows? The
   example in §5.1 uses a create→get chain; is that the rule for every read/update/delete
   endpoint, or only for create?
4. **Validation rules** — §7.5 says field/validation_rule granularity is *not* measured
   spec-side in v2. Does T0 gold nonetheless include validation-rejection scenarios (they still
   exercise an endpoint and so affect coverage), or omit them entirely?
5. **Conventions** — §7.5 says a convention is covered iff ≥1 scenario asserts the error-envelope
   shape against the sealed envelope keys. So T0 gold must include an error-path scenario — but
   *which* endpoint's error path, and asserting *which* keys, is unspecified.
6. **Requirement/scenario titling and capability partitioning** — one capability folder or many;
   requirement statement wording (the `SHALL` line); scenario titles. These are agent-visible
   spec text and feed the canonicalizer-based novelty check (§6).

## Recommended resolution (for the Fable session)

Amend the v2 design with a sealed **`e4-t0-gold-spec-v1`** generation policy: a deterministic
ground-truth-model → spec-of-record function, pinned in the constants lineage the same way the
step table is (§5.4), with a worked T0 example and an in-sync self-check definition. This is a
design amendment, which §9 assigns to Fable regardless of phase ("any design amendment … is
Fable"). Once that policy is frozen, the M1…M5 build arc can run as planned — nothing else read
so far is blocked.

## State of the tree at stop

Clean. No files staged or committed. This note is the only new file and is intentionally left
**uncommitted**. Test baseline untouched at 578/578. `bun run e1:protect` not re-run (no code
changed).
