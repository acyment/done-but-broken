# Substrate search v3 — paste-ready scout prompt (DRAFT, not yet sent)

**Status:** draft for operator review. Zero model spend: operator-driven chat sessions.
**Roster requirement (lesson from v2):** only scouts with **live web browsing** — claude.ai with
web search enabled, ChatGPT with browsing. glm's sessions are excluded (no web access; both v2
rounds failed for that reason alone). Verify browsing works before pasting.

**Why a v3 exists — the v2 prompt aimed at the wrong target.** v2 required edges where
"removing the earlier change should break the later change's tests with an attributable error."
The FastAPI local verification (`docs/protocols/e5-substrate-search-v2-20260721/
FASTAPI-VERIFICATION-RESULTS-v1.md`) proved that requirement selects **non-discriminating**
edges: an attributable break (import error, traceback, failing test) is caught by both arms of
the experiment through ordinary test runs, so it cannot show what *executing* a spec adds over
*reading* it. The discriminating edges are **silent**: degrade the earlier change and the later
change's code still imports, the suite stays green — especially the later change's own tests —
while observable public-surface behavior is wrong. v3 retargets the search on silent edges, and
adds the one search signature silent edges uniquely have: **shipped-regression fossils**
("Fix regression introduced by #X" PRs), where the silence is *certified* by the fact that no
test caught it and a human had to.

**Everything else from v2 carries forward** (real repos at real commits only; per-edge named
mechanisms; linear history; public boundary; recency; hard exclusions) — restated inline below
so the prompt stays self-contained.

**After the scouts:** merge → existence-check every claim (v2 showed one scout fabricating two
of three nominations) → local verification with the upgraded method (subtract-one-change *plus
semantic knockout*, loudness recorded per edge).

---

## The prompt (paste between the lines, verbatim)

```
You are helping select the software substrate for a small, practitioner-facing experiment on AI
coding agents. This is the second round of this search; I will tell you what the first round
found, because it changed the target.

THE EXPERIMENT. An AI coding agent works through a sequence of related changes to an existing
codebase — several changes, each building on the last, carried forward in one workspace. Two
conditions, identical in every other respect: in one, the agent can execute a written
acceptance specification for each change as it works; in the other, it can read the same
specification but cannot run it. Both retain normal shell and public-test access. We measure,
against tests the agent never sees, whether it introduces regressions and whether it declares
work finished while those hidden tests fail.

WHAT THE FIRST ROUND TAUGHT US — READ THIS CAREFULLY, IT INVERTS THE USUAL INSTINCT. The first
round asked for dependency edges that, when the earlier change is removed, break the later
change's tests with an attributable error. We found and fully verified one such chain (FastAPI's
streaming→SSE line, Feb–Mar 2026). Verification showed our requirement was aimed at the wrong
target:

  - A dependency that breaks LOUDLY (import error, traceback, failing test) is useless for this
    experiment: an agent in EITHER condition sees it by running the ordinary test suite. Loud
    edges cannot distinguish an agent that executes its spec from one that merely reads it.
  - The valuable edges are SILENT: degrade or half-implement the earlier change, and the later
    change still imports, compiles, and passes its own tests — while behavior observable at the
    public surface is wrong. In our verified example: with the streaming PR's validation
    semantics disabled, all 33 of the SSE feature's own tests still passed, and the app happily
    streamed garbage instead of raising an error. Only 2 tests in the entire suite — belonging
    to the EARLIER change — could tell the difference.
  - Silent edges leave a unique, searchable fossil record: pull requests titled or described as
    "fix regression introduced by #X" (or equivalent), where the regression SHIPPED in a
    release. Every such PR is a certified silent edge: the breakage was real, it manifested for
    users, and no test caught it at the time — a human had to. Our verified chain contains one:
    FastAPI silently emitted corrupt Server-Sent-Event frames for months (newlines in event/id
    fields), fixed only when a maintainer noticed — no test had ever covered it.

YOUR TARGET, PRECISELY. Nominate change sequences in real repositories containing edges with
the silent signature. For each nominated edge (a pair of related changes A then B, or a change A
and the later fix that reveals A's silent breakage):

  - THE MECHANISM: what A contributes that B consumes or depends on — named function, parameter,
    validation rule, serialization behavior, config semantic, wire format.
  - THE SILENCE EVIDENCE, the most important field: why do you believe a broken or missing A
    leaves the suite green while the public surface misbehaves? Acceptable evidence, strongest
    first: (a) a shipped-regression fossil — a later PR/issue explicitly fixing silent breakage
    that A's subsystem caused, with links; (b) explicit statements in review/issue discussion
    that breakage was discovered in production/by users, not by tests; (c) your own reading that
    B's tests cover the surface's SHAPE (status codes, schema, happy path) but not A's SEMANTICS
    (validation, ordering, precision, encoding, limits) — flag this class as inference, we
    verify it locally by disabling A's semantics and running B's tests.
  - HOW IT MANIFESTS at a public API, CLI, or HTTP boundary an off-the-shelf scenario runner can
    drive (Python strongly preferred; JS/TS, Java, Go, Ruby acceptable): what would a black-box
    scenario observe that the test suite does not?

SHAPES WORTH HUNTING, in order of expected yield:
  - Regression-fix pairs: search issues/PRs for "regression introduced", "regressed in",
    "silently", "broken since", "no test covered", scoped to merges after January 2026, in
    libraries with real public surfaces. The PAIR (culprit change, fix change) plus the
    surrounding feature work often forms exactly the sequence we need.
  - Semantics-vs-surface splits: subsystems where tests assert shape but not meaning —
    validation layers, serialization/encoding, precision/rounding, ordering guarantees,
    pagination, cache-correctness, timezone/locale handling, limits and quotas.
  - Introduce-then-use pairs where the USE has its own tests but those tests never exercise the
    introduced machinery's failure modes (our FastAPI case exactly; assume this is common —
    verified in two independent substrates so far).

SEQUENCE REQUIREMENT, RELAXED FROM ROUND ONE. The ideal is still 3–6 related changes in one
subsystem and time window that can be worked as a sequence, containing at least one silent
edge. But a strong isolated PAIR (A plus the change that proves A's silence) is worth
nominating on its own — say plainly it is a pair, and name what other changes in that subsystem
and window could pad the sequence.

STILL REQUIRED, PER NOMINATION (unchanged from round one): exact repository; exact merged
PRs/commits with links; a statement on whether the span's main-branch history is linear (no
merge commits inside the range) and how you checked; a containerized or reproducible local
build-and-test path; a credible story for engineering leaders. A CANDIDATE WITHOUT EXACT LINKS
IS NOT A CANDIDATE.

HARD EXCLUSIONS (unchanged): curated benchmark datasets that rearrange real history; synthetic,
simulated, or "projected" sequences — if you cannot browse the real repository, say so and
stop; dependency or silence claims supported only by dataset metadata or paper prose; change
sequences that deliberately invalidate earlier behavior; external services that cannot run
locally; private-implementation-only assertions.

CONTAMINATION: prefer sequences merged after January 2026; for older ones, state the
memorization risk and how to check it. Note the failure mode is a wasted run (both conditions
saturate), not a biased result.

VERIFICATION PREVIEW — nominate accordingly. Every edge you nominate will be verified locally:
subtract-one-change where history permits, and a SEMANTIC KNOCKOUT (disable A's claimed
semantics in place, rerun B's tests) where it does not. We record, per edge, whether the
failure is loud or silent. A nominated "silent" edge that turns out loud is a miss; tell us in
advance which of your edges you are least sure stays silent, and why.

CONSTRAINTS: one person; a low-tens-of-dollars model budget; Docker available; agentic tooling
already built; no deadline.

Please deliver:

1. CRITIQUE FIRST. Round one's criteria had a hole (loud-edge selection) that a scout, not the
   operator, caught. What is the equivalent hole in THIS round's criteria? Two paragraphs,
   before anything else.

2. NOMINATIONS. Two to four candidates (sequences or pairs), each with per-edge mechanism,
   silence evidence with links, public-surface manifestation, history-shape statement, and the
   edge you are least sure stays silent under our knockout.

3. SCORECARD. Score each 0–5 on: real-world credibility; strength of silence evidence
   (fossil > discussion > inference); breadth of the silent layer (how many distinct behaviors,
   not just one); executability of scenarios against the public surface; contamination risk
   (5 = safest); reproducibility and solo-operator cost.

4. SEARCH STRATEGY. Queries, sources, dead ends, and the vein you did not have time to exhaust.
   If GitHub search qualifiers worked for the regression-fossil hunt, give the exact queries so
   the operator can continue by hand.

5. THE SUPPLY QUESTION, RETARGETED. Round one concluded that densely dependent, loud-edge
   chains are rare. Silent edges should be MORE common (every shipped regression is one), but
   usable ones need a public surface and a runnable local build. From what your search actually
   returned: how common are usable silent edges, where do they concentrate, and is the supply
   rich enough for a study or only for a pilot?

6. WHAT WOULD MAKE YOU WALK AWAY, unchanged: a substrate class you would refuse even if it
   scored well; and if nothing supports the claim at this budget, say so plainly.

Cite primary sources and separate verified from inferred. A well-supported "the silent-edge
supply is also thin" is worth more than shaky nominations. Do not flatter the premise.
```

---

**Not in the prompt, on purpose:** repo name and program codenames; the remaining budget figure;
the admission-gate and authoring-protocol internals; the fact that a FastAPI pilot is already on
the table (scouts should not steer toward or away from it — if the fossil hunt independently
re-surfaces FastAPI, that is signal, not redundancy).

**Operator-side note:** the regression-fossil hunt is also mechanically runnable without scouts
(GitHub search over post-2026 merged PRs for "regression introduced" and variants, filtered to
Python repos with public surfaces). Claude Code can run that query pass for free on request;
scouts and the mechanical pass complement rather than replace each other.
