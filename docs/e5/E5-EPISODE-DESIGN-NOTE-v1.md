# E5 episode design note v1 — independent items, certified traps, practice fidelity

Records the design decisions reached in operator↔Claude Code discussion, 2026-07-21 (sessions
following the SWE-Milestone FAIL, the v2/v3 substrate searches, and the FastAPI + pandas local
verifications). Each decision names what it replaced and why, with the evidence trail, so none
has to be re-derived. This note governs episode design and substrate admission until superseded
by a numbered v2.

## D1 — Independent items over dependency chains

**Decision.** An episode is a series of *independent* work items (INVEST-shaped: each
independently valuable and schedulable) on one shared codebase — same subsystem, same time
window, overlapping code. Formal interdependence (item B requires item A) is **not** required
and is mildly suspect when present: well-run backlogs engineer it away, so chains model an
anti-pattern and invite the "slice your stories properly" dismissal.

**What it replaced.** The 4–8 "each building on the last" chain requirement (v2/v3 search
prompts; the SWE-Milestone screen), which four independent measurements found near-nonexistent
in the wild (E1 base rates, E3 stacking null, the container check, the v2 search).

**Recovered rationale that survives.** The chain requirement was originally the engineered
answer to a measured zero: sequential shared-workspace runs produced ~3% imperfect checkpoints
and zero true regressions ([[path-survival-discrimination-power]]), with the recorded diagnoses
"orthogonal event branches do NOT regress" ([[harder-task-design-pattern]]) and "frontier
models preserve code they aren't required to touch" ([[late-hardness-cannot-regress]]). Those
diagnoses stand. Independence alone is therefore NOT sufficient — D2 and D3 carry the load the
chain used to carry.

## D2 — The certified trap (base-rate requirement)

**Decision.** At least one item in the episode must be a task where:
- the task **forces** contact with code carrying earlier-established behavior (not optional
  proximity — the task cannot be completed without editing that code); and
- the tempting solution is **silently wrong**: compiles, runs, passes the native test suite,
  produces wrong observable behavior at the public surface; and
- both properties are **certified, not assumed** — the gold standard is a shipped-regression
  fossil: a real maintainer took the tempting path, the suite stayed green, the wrongness
  shipped, and a later fix documents it. The fossil simultaneously proves attractiveness
  (a professional fell in), native-suite blindness (nothing caught it), and supplies the
  held-out oracle (the eventual fix's tests) for free.

**Evidence.** pandas #64478→#66250, locally verified 2026-07-21
(`docs/protocols/e5-substrate-search-v3-20260721/PANDAS-VERIFICATION-RESULTS-v1.md`): the
pre-culprit code crashed loudly; the culprit silenced the crash into four months of silently
wrong `DataFrame.idxmax` answers; only a behavioral check at the public surface discriminates.
The old naive-agent discrimination proof requirement is satisfied by something stronger: a
real-agent proof from history.

## D3 — The detector lives in the accumulated suite

**Decision.** The scenario that catches the trap must guard behavior **established before the
trap task** and must NOT appear in the trap task's own acceptance criteria. Consequence for
substrate admission: the episode window must contain (or the baseline corpus must supply) an
**establishing item** under which the threatened behavior would naturally have been specified.

**Why.** The structural-ceiling record ([[frontier-feedback-structural-ceiling]]): a fair small
task whose own spec names the danger is self-verifiable — the control arm has a shell and
hand-checks the one named thing, and the effect vanishes. The treatment's advantage, if it
exists, is the accumulated out-of-mind suite re-asserting what nobody is thinking about.

**D3-refinement (added 2026-07-21, v4 comparison + gunicorn verification) — the establishing
scenario must PIN THE PRECONDITION, not merely cover the feature.** The requirement as first
written ("an establishing item under which the behavior would naturally have been specified") is
two-sided-flawed: *gameable*, because almost any behavior can be retrofitted a plausible
Given/When/Then after the fact; and *systematically unsatisfiable*, because silent-wrongness
fossils live in a narrow edge configuration (a non-UTC server; an int2 column under a composite
bloom filter queried with a cross-type literal) while real acceptance suites are written against
the happy path and the default config. The tell that separates a real establishing item from a
retrofitted decoy: does the scenario a team plausibly wrote **pin the exact precondition the trap
needs to fire**, or only exercise the feature in its default configuration? A happy-path scenario
in the default config is a decoy — the accumulated suite never fires, and the candidate fails
silently in exactly the way the experiment is trying to detect in the agent. **Admission now
scores establishing items on this stronger bar.** Two independent demonstrations: gunicorn's
RFC-parser tests covered request *validity* but did not pin the keepalive-layer unframed-body
precondition (wrong layer, blind where the trap broke); TimescaleDB's query-correctness contract
exists but nobody scenario-tests the int2/composite/cross-type edge. **Tension to hold, not
resolve:** this pulls against D5's practice-naturalness premium — the more service-shaped and
intent-level the surface, the coarser the scenario, and the more likely a narrow edge slips
through. A candidate must clear both, and the two are in genuine opposition.

## D4 — Arm workspaces: realism over artifact symmetry

**Decision.**
- Both arms receive identical *requirements and scenario text* (all semantic content —
  values, tolerances, intent — lives there).
- Both arms keep a shell and the project's **native test suite** — a real SDD team has tests;
  removing them builds a strawman and reduces the study to "tests beat no tests." The fossil
  certifies the native suite is blind to the trap in both arms, so keeping it costs no signal.
- The control workspace contains **no execution artifacts** for the scenario layer — no runner,
  no glue, not even as text. A real SDD workspace has none.
- The treatment workspace holds the same scenario text plus runner and glue.
- The measurement harness re-runs the full accumulated suite plus held-out checks at every
  step **in both arms**, invisibly — the instrument is symmetric even though the intervention
  is not. (Preserves the [[hit-sdd-regression-measurement-gaps]] lesson: non-cumulative
  scoring cannot see regressions at all.)

## D5 — Practice fidelity governs the treatment; the audit stack makes it safe

**Decision.** The treatment arm is BDD **as its community defines done-well**, per a citable
style standard — declarative intent-level scenarios; thin step definitions; binding decisions
(which entry point concretizes "the highest reading") live in the glue, where the practice
puts them. The experiment adapts to the practice, never the reverse. Consequence accepted
knowingly: information parity between arms holds at the scenario-text level only; the glue
embodies concretization decisions control's world doesn't contain. That is not a confound —
concretization-through-automation is a benefit BDD itself advertises — but it coarsens the
claim from "execution alone helps" to "the practiced discipline catches what prose SDD
misses." The pure-execution question was already answered once at small scale
([[dispatch-mini-mechanism-probe-result]]).

**The audit stack** (each layer simultaneously BDD fidelity review and experimental gate,
all previously built in this program):
1. green-at-base prune / tautology gate — every check must fail on known-broken code
   (`docs/protocols/e2-fallback-claims-regression-and-tautology-v1.md`; the culprit state is a
   free broken variant);
2. per-check no-op discrimination — every check fails on the empty patch (admission gate
   step 5, CRITIQUE-PROCESS-v1);
3. `self_tests_green_but_spec_red` event counting during runs — detects checks drifting from
   spec meaning;
4. all glue authored blind (authors never see trap or fix), frozen and hash-pinned pre-run.

**The one non-auditable degree of freedom**, named rather than dissolved: consistent-but-
selective binding (frame path vs series path both satisfy the intent text). Logged during
authoring, reported per episode when load-bearing. Whether competent blind binding reaches the
trap is an *outcome* the blind-authoring probe measures, not a property we may construct.

## D6 — Measurement preconditions (unchanged, re-affirmed)

Cumulative scoring in both arms (D4); one pre-named primary metric — the false-done rate
(declaring complete while held-out checks fail), chosen for base-rate reasons in the Phase-1
critique record; per-episode reporting; prereg + Step-6 re-attack + fresh authorization before
any spend (standing discipline).

## D7 — Substrate-surface naturalness governs primary selection (added 2026-07-21)

**Decision.** The primary substrate must be one where executable acceptance scenarios are
*idiomatic* — an HTTP API, CLI, or service boundary — because the treatment IS executable
acceptance testing and running it on a surface where the practice looks artificial forfeits the
program's CTO-credibility standard. **Library-internal APIs (pandas) are demoted from co-equal
"library arm" to corroborating real-world evidence**, not episode substrates: Given/When/Then over
`DataFrame.idxmax` reads as a unit test in BDD costume, which a skeptic dismisses. The clean
generalization pairing is therefore two *natural* surfaces (e.g. an HTTP service + a CLI), not
library + service.

**Consequence for standings (supersedes the D-ledger note below):** **Immich (HTTP service) is the
primary substrate** — verified silent trap (`IMMICH-VERIFICATION-RESULTS-v1.md`), live and
memorization-safe (`IMMICH-MEMORIZATION-PROBE-RESULTS-v1.md`: 4/4 agents default to the buggy UTC
path), canonical acceptance-testing surface. **pandas is corroborating evidence** (the same silent
class in a heavily-tested library, hand-verified). A second natural surface (a CLI — pip/borg-style
candidates exist but are recency-back-burnered) is a follow-up, not a blocker.

## D3-refinement-2 — Correctness defined by observable behavior, not internal convention (added 2026-07-21)

**Decision.** Where the "bug" depends on an internal convention the agent cannot see (Immich: is
the stored `Date` local-midnight or UTC-midnight?), the acceptance scenario must fix correctness by
*observable black-box behavior*, never by the convention. The memorization probe made this concrete
and necessary: 3 of 4 agents assumed UTC-midnight storage, and one explicitly defended UTC while
flagging "it depends how the DB stores it." A convention-dependent oracle would score a defensible
choice as a false regression (the structural-ceiling domain-ambiguity failure,
[[frontier-feedback-structural-ceiling]]). The pinned Immich scenario is therefore:

> A person recorded as born on 15 January 2000 must be returned by the API as `"2000-01-15"`,
> regardless of the server's timezone.

This one criterion (a) pins the precondition (only bites under a non-UTC-ahead server — the suite
must run under such a `TZ`), (b) makes every UTC-based serialization unambiguously wrong, and
(c) converts the storage-convention question into an implementation detail the agent must get right
to satisfy a black-box scenario — which is exactly what executable-vs-readable measures. General
rule: **the pinned scenario asserts what a user observes, and the precondition it pins is a
black-box environment condition, never a white-box internal assumption.**

## Consequences for substrate attributes (delta ledger)

Easier: chain requirement dropped (the scarcest property); certified-trap requirement is
mechanically searchable (fossil hunt) and self-oracling. New: establishing item in-window (D3);
forced-touch statement per trap (D2); **practice-naturalness** — surfaces where Gherkin-style
acceptance testing is idiomatic (HTTP APIs, CLIs, services) now carry a premium; library-
internal APIs a penalty (D5). Riskier: trap coverage by the blind-authored suite is an outcome,
not a guarantee — the blind-authoring probe is the gate.

Standings under the new attributes: **pandas cluster** still leads (best certified trap ever
verified; establishing-item candidate in-window: the EA-reductions API introduction — idxmax
is a reduction; weakness: BDD over a dataframe library is non-canonical). **FastAPI chain**
promoted to complementary candidate (canonical BDD surface; weaker, knockout-certified-only
trap). A two-substrate result (one library, one service) would answer the single-codebase
attack better than either alone.
