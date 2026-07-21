# Substrate search v2 — paste-ready scout prompt (DRAFT, not yet sent)

**Status:** draft for operator review. Zero model spend: runs operator-driven in chat UIs
(same trio as Step 1 — Qwen, Claude, ChatGPT — three fresh sessions, no repo access,
paste the prompt below verbatim). No API calls, no runs, no publishing.

**Relation to the v1 search (CRITIQUE-PROCESS-v1.md, Appendix F Pass 1):** v1 deliberately
withheld our selection criteria to buy an independent derivation of them. That purchase is made;
the lesson it bought is recorded. v2 deliberately trades that blindness for aim: we now share
what failed and why, because the expensive discovery of the SWE-Milestone container check
(SWE-MILESTONE-VERIFICATION-RESULTS-v1.md) is that **declared dependency cannot be trusted and
must be verified mechanically** — and the verification protocol is now frozen, debugged, and
cheap to rerun. The scout's job is no longer to define quality; it is to find candidates likely
to survive a verification we will run ourselves.

**What changed from v1, in one list (each traces to a container-check finding):**

1. Dependency must be *demonstrable*, not *declared* — nominations name the symbol or behavior
   that breaks, per edge. (Finding: "Strong 0.90" labels were mostly co-location.)
2. Curated benchmark datasets that rearrange real history into an artificial order are now a hard
   exclusion. (Finding: calendar-time test drift was the majority of wall-clock cost; the
   curriculum order contradicted the order the tests were written against.)
3. Dataset-supplied dependency labels and confidence scores are leads at best, never evidence.
   (Finding: highest-confidence edge tested not-dependent; scores uninformative.)
4. The change range must be linear history — no merge commits inside it — or the subtract-one-change
   check is structurally impossible. (Finding: 4 of 8 edges untestable for exactly this reason.)
5. At least one held-out test must exercise the claimed dependency mechanism specifically.
   (Finding: the flagship edge's only graded test checked an unrelated deprecation — a blind spot,
   not a refutation.)
6. New positive shapes to hunt: staged deprecation cycles, stacked/serial PR chains,
   API-introduced-then-used pairs, multi-step migrations. (Finding: the one edge that verified
   CONFIRMED was a signature change breaking downstream callers — that is the template.)
7. An explicit supply question: if densely dependent public-surface chains are rare in real repos,
   say so. (Program-wide prior: three independent measurements now point that way.)

**After the scouts:** merge nominations → Pass 2 critics (unchanged from Appendix F) → Pass 3
local mechanical checks, now run under the frozen verification spec *plus its recorded
corrections* (check for merge commits before choosing the replay method; use a merge-preserving
rebase where needed; per-test timeout guard; expect environment-patch cost and budget wall-clock
for it). Any surviving candidate still lands behind the admission gate and the budget wall —
passing this search authorizes nothing.

---

## The prompt (paste between the lines, verbatim)

```
You are helping select the software substrate for a small, practitioner-facing experiment on AI
coding agents. I want your independent judgment, and I will tell you up front what already
failed, because the failure is the most useful thing I own.

THE EXPERIMENT. An AI coding agent works through a sequence of related changes to an existing
codebase — four to eight changes, each building on the last, carried forward in one workspace.
Two conditions, identical in every other respect: in one, the agent can execute a written
acceptance specification for each change as it works; in the other, it can read the same
specification but cannot run it. Both retain normal shell and public-test access. We measure,
against tests the agent never sees, whether it introduces regressions and whether it declares
work finished while those hidden tests fail.

THE AUDIENCE. Results go to a LinkedIn post read by CTOs and staff engineers, not to a journal.
It must survive public attack. A reader who thinks "that benchmark looks nothing like my
codebase" has already dismissed it.

WHAT ALREADY FAILED, AND WHY IT CHANGES YOUR JOB. We previously screened the published
benchmark datasets that claim to offer exactly this — sequences of dependent changes with tests.
The most promising one, tested at the container level with a subtract-one-change method (remove
change A from the history, run change B's tests), fell apart in four specific ways:

  1. Its "strong dependency" labels were mostly co-location: changes that landed near each other
     in time, where B's tests pass fine without A. The dataset's own confidence scores did not
     predict which edges were real. One high-confidence edge WAS partially real — a function
     signature change that breaks downstream callers with a clean traceback — and that is the
     shape of genuine dependency we are looking for.
  2. It had rearranged real repository history into an artificial curriculum order, so test
     files constantly referenced code that "hadn't been written yet" in the artificial order.
     Enormous verification cost, all artifact.
  3. Its git history contained merge commits inside the ranges we needed to replay, making the
     subtract-one-change check structurally impossible for exactly the busiest, most
     dependency-rich nodes.
  4. Its graded tests often did not exercise the claimed dependency at all — the flagship
     edge's only surviving test checked an unrelated deprecation warning.

Therefore: I will trust NO dependency claim — yours, a dataset's, or a paper's — that is not
accompanied by a named mechanism. Every candidate you nominate will be locally verified by me
with the subtract-one-change method before it is accepted. Nominate accordingly.

A CANDIDATE IS NOT A REPOSITORY NAME. To count, a candidate must identify all of:
  - an exact open-source repository;
  - a specific base commit, plus 4–8 chronological changes (merged PRs or commits) that build on
    one another, each identified by link;
  - PER CONSECUTIVE PAIR OF CHANGES, the dependency mechanism: the specific function, class,
    parameter, endpoint, schema, or behavior introduced by the earlier change that the later
    change calls, extends, or requires — such that removing the earlier change should break the
    later change's tests with an attributable error. "They touch the same subsystem" or "B came
    after A" does not count;
  - a statement about history shape: whether the span from first to last change is linear
    (no merge commits inside the range) in the repository's main-branch history, and how you
    checked or why you could not;
  - tests that exercise those mechanisms specifically — ideally arriving with the later change —
    separable into a visible set and a held-out set;
  - a public API, CLI, or HTTP boundary that acceptance scenarios can execute against, in a
    language with a mature Cucumber-style scenario runner (Python strongly preferred; JS/TS,
    Java, Go, Ruby acceptable);
  - a containerized or otherwise reproducible local build-and-test path;
  - a credible story for engineering leaders.

SHAPES WORTH HUNTING — patterns where real dependency is structural, not incidental:
  - staged deprecation cycles: introduce a warning → enforce → remove. Each step cannot land
    without the previous one, and repos run these constantly;
  - stacked or serial PR chains: "part 1/3, part 2/3", tracking issues with ordered task lists,
    feature branches merged in sequence;
  - introduce-then-use: a public API, config option, or parameter added in one change and
    consumed by later changes (our one verified-real edge had exactly this shape);
  - multi-step migrations: schema versions, storage format changes, protocol upgrades, where
    step N reads what step N-1 wrote.
Do not limit yourself to these; they are examples of the property, not the property.

HARD EXCLUSIONS: curated benchmark datasets that rearrange or re-order real history (real
repositories at real commits only); dependency claims supported only by dataset metadata or
paper prose; synthetic or generated projects as the main substrate; change sequences that
deliberately invalidate earlier behavior; anything requiring external services that cannot run
locally; repositories where scenarios could only assert private implementation details; any
suggestion without exact repository and commit/PR links.

CONTAMINATION. Prefer change sequences merged after January 2026. For anything older, state the
risk that current frontier models have memorized the fix, and propose how to check rather than
assume.

CONSTRAINTS: one person; a low-tens-of-dollars model budget; Docker available; agentic tooling
already built; no deadline.

Please deliver:

1. CRITIQUE OF THE CRITERIA. You have my criteria this time. What am I still screening for
   wrongly? What failure mode do the four lessons above NOT protect against? Two paragraphs,
   before anything else.

2. NOMINATIONS. Three to five candidates meeting the full definition, favoring variety of shape
   (a deprecation cycle and a stacked-PR chain teach me more than two of either). For each:
   the per-edge dependency mechanisms; and the single most likely way it fails MY verification —
   not a generic risk, the specific edge you are least sure of and what the subtract-one-change
   check would show if you are wrong.

3. SCORECARD. Score each candidate 0–5 on: real-world credibility; verifiability of dependency
   (how likely every consecutive edge survives subtract-one-change); mechanism coverage by tests;
   executability of scenarios against the public surface; contamination risk (5 = safest);
   reproducibility and expected solo-operator cost; and risk that passing visible scenarios
   merely teaches to the test.

4. SEARCH STRATEGY. How did you actually search — queries, sources, dead ends? What promising
   vein did you NOT have time to exhaust? (I may continue digging by hand; leave me the map.)

5. THE SUPPLY QUESTION. Independent measurements in this program keep suggesting that densely
   dependent, public-surface change chains are RARE in mature real repositories — most
   consecutive changes are independent. If your search supports that, say so plainly, tell me
   where such chains DO concentrate (project types, sizes, lifecycle stages, subsystems), and
   name the strongest narrower claim a realistic candidate could still support. If your search
   contradicts it, show the counterexamples.

6. WHAT WOULD MAKE YOU WALK AWAY. Is there a class of substrate you would refuse to run this
   on even if it scored well? And if no candidate can support the claim at this budget, say so
   plainly.

Cite primary sources — repository, commits, PRs, CI configuration, release notes, official
docs. Separate what you verified from what you are inferring. Do not flatter the premise: a
well-supported "the thing you want barely exists" is worth more to me than five shaky
nominations.
```

---

**Not in the prompt, on purpose:** the repo name, program codenames, prior run results beyond
the four failure lessons (scouts need the lessons, not the history); the admission-gate details
(Pass 2/3 material); budget remaining (the "low tens of dollars" constraint suffices and the
true stop-loss figure would anchor them).
