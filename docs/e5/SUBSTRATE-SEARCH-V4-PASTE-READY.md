# Substrate search v4 — paste-ready scout prompt (DRAFT, not yet sent)

**Status:** draft for operator review. Zero model spend: operator-driven chat sessions.
**Roster:** exactly two deep-research-capable sessions remain (qwen, claude) — ChatGPT quota
exhausted. Both must have live web browsing (verify with a probe question — e.g. "fetch the
title of pandas PR #66250" — before pasting). These are the last cheap search shots; that is
why v4 exists instead of reusing v3.

**What changed since v3** (derived from `E5-EPISODE-DESIGN-NOTE-v1.md`, decisions D1–D5):
1. **Dependency chains are out.** v3 still described "changes each building on the last" and
   demanded per-edge dependency mechanisms. The target is now a **cluster of independent
   changes** — same subsystem, same window, shared code — like a real backlog.
2. **New required attribute: the establishing item** — an earlier change in the window under
   which the trap-threatened behavior would naturally have been specified.
3. **New required attribute: forced touch** — the trap task cannot be completed without
   editing the code carrying the earlier behavior.
4. **New ranking attribute: practice naturalness** — surfaces where Gherkin/acceptance-style
   testing is idiomatic (HTTP APIs, CLIs, services) now score a premium; internal library APIs
   a penalty.
5. Fossil-certified silence stays the centerpiece, unchanged from v3.

**If a scout's v3 run is already complete:** do not discard it — its fossils transfer; re-read
its nominations against the new attributes instead of re-running. v4 is for sessions not yet
spent.

---

## The prompt (paste between the lines, verbatim)

```
You are helping select the software substrate for a small, practitioner-facing experiment on AI
coding agents. This is the third round of this search. Each previous round changed the target
after verification; I will tell you exactly where it landed so you aim at today's target, not
an earlier one.

THE EXPERIMENT. An AI coding agent works through a short series of INDEPENDENT work items on
one codebase — think of a real team's backlog: each item makes sense on its own, none waits
for another, but they all land in the same subsystem and period, touching shared code. Two
conditions, identical except for one thing: in one, acceptance scenarios for established
behavior are executable and the agent can run them; in the other, the same scenarios exist
only as readable text. Both conditions keep a shell and the project's ordinary test suite. We
measure whether the agent silently damages previously-established behavior and declares work
done while hidden checks fail.

WHAT PREVIOUS ROUNDS ESTABLISHED (do not re-litigate; build on it):
  - Chains of formally interdependent changes are (a) rare in the wild, (b) an anti-pattern
    good teams slice away, and (c) unnecessary for the experiment. Do NOT hunt dependency
    edges. Hunt CLUSTERS of independent changes sharing code.
  - Loud failures (crashes, import errors, failing tests) are useless: both conditions catch
    them. Only SILENT wrongness discriminates: code that compiles, passes the ordinary suite,
    and gives wrong observable answers.
  - Silent wrongness leaves a fossil record: merged PRs fixing regressions that SHIPPED — the
    shipping proves no test caught it, and the culprit being identified proves the tempting
    path is real (a professional took it). One verified specimen sets the bar: a pandas
    compatibility patch (PR #64478) silenced a crash by introducing four months of silently
    wrong DataFrame.idxmax answers, fixed in PR #66250 whose body names the culprit.
  - Agents do not wander into code they aren't required to touch. A trap only fires if the
    task FORCES editing the code that carries the earlier behavior.

YOUR TARGET: a cluster, in one repository, satisfying ALL of:

  1. THE TRAP ITEM. A real, post-January-2026 change (or a task reconstructable from one)
     whose tempting implementation is silently wrong — certified by a shipped-regression
     fossil (culprit PR + fixing PR, both linked) or, second-best, by review/issue discussion
     of user-discovered breakage. State the FORCED-TOUCH property explicitly: why can this
     task not be completed without editing the code the earlier behavior lives in?
  2. THE ESTABLISHING ITEM. An earlier change in the same window and subsystem under which
     the threatened behavior would naturally have been specified — the feature or API whose
     acceptance scenarios, written at the time, would cover what the trap later breaks. Name
     it and say what its scenarios would assert. Without this, the trap is uncatchable by an
     accumulated suite and the candidate fails.
  3. FILLER ITEMS. 2–4 more independent changes, same subsystem and window, to make a
     realistic work sequence. They need links but not deep analysis.
  4. PRACTICE-NATURAL SURFACE. The behaviors must be expressible as intent-level acceptance
     scenarios of the kind actually written in industry — Given/When/Then over an HTTP API, a
     CLI, a service boundary, or a user-meaningful library operation. Rank candidates on
     surfaces where such testing is idiomatic (web services, CLIs, APIs with docs-level
     contracts) ABOVE internal library plumbing, even at some cost in trap quality. State
     plainly how natural the practice is for this surface — "nobody writes acceptance
     scenarios for this" is a disqualifying answer, and pretending otherwise wastes my
     verification time.
  5. THE USUAL FLOOR: exact repo and PR/commit links for every item (a candidate without
     links is not a candidate); post-January-2026 strongly preferred, memorization risk
     stated otherwise; local reproducible build; a story credible to engineering leaders;
     history clean enough to reconstruct each item's before/after state.

HARD EXCLUSIONS (unchanged): curated benchmark datasets rearranging history; synthetic,
simulated, or "projected" sequences — if you cannot browse the real repository, say so and
stop; silence claims supported only by prose; external services that cannot run locally.

VERIFICATION PREVIEW — nominate accordingly. Each trap will be locally verified (state
reconstruction, semantic knockout, loudness recorded per failure; the pandas specimen above
went through exactly this). Each establishing item will be checked for whether intent-level
scenarios written for it plausibly cover the trap's blast radius. Tell me, per candidate,
which of these two checks you are least confident it survives, and why.

CONSTRAINTS: one person; a low-tens-of-dollars model budget; Docker available; agentic
tooling already built; no deadline.

Please deliver:

1. CRITIQUE FIRST (two paragraphs, before anything else). Each previous round's criteria had
   a hole a scout caught — round one selected for loud edges; round two under-weighted
   whether anyone would actually have scenario coverage where the trap hits. What is THIS
   round's hole? Attend especially to the establishing-item requirement: what could make it
   systematically unsatisfiable or systematically gameable?

2. NOMINATIONS. Two to four clusters, each with: trap item (fossil links, silence evidence,
   forced-touch statement), establishing item (link, what its scenarios would assert), filler
   items (links), surface naturalness statement, and your least-confident check per candidate.

3. SCORECARD, 0–5 each: trap certification strength (fossil > discussion > inference);
   establishing-item plausibility; practice naturalness of the surface; independence realism
   (does the cluster read like a backlog, not a curriculum); contamination safety;
   reproducibility and solo-operator cost.

4. SEARCH STRATEGY. Exact queries that worked, dead ends, and the vein you did not exhaust —
   I will continue by hand. GitHub search qualifiers especially.

5. SUPPLY, RETARGETED. The scarce joint property is now trap + establishing item + natural
   surface IN ONE WINDOW. From what your search actually returned (honest denominators only —
   cite your own search log; no invented rates): how common is the full conjunction, where
   does it concentrate, and is the supply rich enough for a two-substrate study (one service-
   shaped, one library-shaped)?

6. WALK-AWAY. A substrate class you would refuse even if it scored well; and if the full
   conjunction cannot be found at this budget, say so plainly and name the strongest
   nearby target that exists.

Cite primary sources; separate verified from inferred; a well-supported "the conjunction is
rare" is worth more than a shaky slate. Do not flatter the premise.
```

---

**Not in the prompt, on purpose:** program codenames; remaining budget; the pandas cluster's
candidate establishing item (the EA-reductions API change) and the FastAPI standing — if a
scout independently converges on either, that is signal; naming them would make it echo.

**Operator-side notes:** (1) The mechanical fossil hunt can be extended for free under v4
criteria — service/CLI-shaped repos, fossil + establishing-item pairs — on request. (2) If
qwen's v3 deep-research run already completed, keep it; read its fossils against v4's
attributes rather than spending the session again.
