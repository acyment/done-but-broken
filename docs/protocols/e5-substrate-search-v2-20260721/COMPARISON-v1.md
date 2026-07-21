# Substrate search v2 — merged comparison (v1)

Merges the three scout sessions (`claude-fable-5.md`, `qwen-37-max.md`, `glm-52.md`) against the
prompt (`docs/e5/SUBSTRATE-SEARCH-V2-PASTE-READY.md`) and clarifications (`CLARIFICATIONS-v1.md`).
Written by Claude Code on 2026-07-21. Every nominated repo/PR was existence-checked against
GitHub/web the same day (method noted per row); **existence-checked ≠ mechanism-verified** — the
subtract-one-change work remains Pass 3, locally.

**Provenance caveat:** the merger (Claude Code) runs on the same model family as one scout
(claude-fable-5). Blind-spot correlation between that report and this merge is possible; the
existence checks below were done against primary sources precisely to keep the merge from taking
that scout's claims on trust.

---

## 1. Scout status

| Scout | Delivered | Notes |
|---|---|---|
| claude-fable-5 | Full report | 1 fully-specified candidate + 2 leads; separates verified from inferred; all its factual claims that were spot-checked held up |
| qwen-37-max | Full report (deep-research style) | All 3 nominations fail the prompt's candidate definition; 2 of 3 contain fabricated specifics (see §3); strategy/supply sections still useful |
| glm-52 | **No report** | Output is an acknowledgment of the clarifications ending in a question ("Would you like me to begin searching…?"). The scout never ran. Free to fix: reply "proceed" in that session and paste the result as a new file |

## 2. Existence checks run for this merge (2026-07-21, zero model spend)

| Claim | Check | Result |
|---|---|---|
| FastAPI PR #14987 "Add support for Starlette 1.0.0+", merged 2026-02-24, squash, `c73bc94` | GitHub PR page | **Confirmed**, all details match |
| FastAPI PR #15022 "streaming JSON Lines and binary data with `yield`", 2026-02-27, `749cefd`, Starlette floor 0.40→0.46, ships 0.134.0 | GitHub PR page | **Confirmed**, all details match |
| FastAPI PR #15030 "Add support for Server Sent Events", 2026-03-01, ships 0.135.0, tests added | GitHub PR page | **Confirmed** (page partially rendered; title/date/author/tests confirmed) |
| FastAPI PR #15038 TaskGroup/async-exit-stack fix, 2026-03-01 | GitHub PR page | **Confirmed**; page itself doesn't mention SSE — the scout's claim that it patches the SSE path is *inferred*, verify locally |
| FastAPI PR #15588 "Validate Server Sent Event fields…", merged 2026-05-23 | GitHub PR page | **Confirmed** |
| Django PR #17554 fetch modes (adamchainz) | GitHub PR page | **Confirmed** — but merged **2025-10-16**, i.e. pre-Jan-2026 (contamination caveat stands) |
| Django PR #19925 DB-level on_delete (felixxm) | GitHub PR page | **Confirmed** — merged **2025-10-18**, same caveat |
| qwen: `tphakala/birda` stacked-PR chain (PRs #1–#4, `detect_sparrow.py`, Python) | GitHub repo page | **Repo exists but the content is fabricated**: birda is a **Rust** (97.6%) audio-ML CLI with 529 commits; the described Python files and 4-PR sparrow/finch sequence do not match the project at all. Rust also isn't in the prompt's accepted-runner list |
| qwen: packer PR #1645 = HCP-deprecation doc update (2023) | GitHub PR page | **Fabricated citation**: #1645 is a **2014 QEMU checksum PR**, unrelated. The claimed sequence also predates the recency bar by 3 years |
| qwen: `openshift/origin` `oc manage-cluster` chain | Web search, Red Hat docs | **No evidence the subcommand exists**; nomination has no PR numbers, commits, or dates; its citations point at unrelated repos (reflex, nodejs) |

## 3. Merged candidate table

| # | Candidate | Source scout | Admissibility verdict |
|---|---|---|---|
| 1 | **FastAPI streaming chain** #14987→#15022→#15030→#15038→#15588 | claude-fable-5 | **ADMITTED TO PASS 3** — the only nomination meeting the full candidate definition. Existence fully confirmed. Linear (squash-merge, single-parent). Key open items for local verification: (a) the load-bearing mechanism claim that SSE (#15030) consumes #15022's `get_stream_item_type`/`stream_item_field` machinery — inferred from docs/DeepWiki, not read at call-site level; (b) whether the #15022→#15030 edge fails **silently** (see §5 — this decides if the candidate supports a two-arm study or only chain scaffolding); (c) the scout itself predicts #14987→#15022 is co-location — plan to drop that edge and start at #15022 |
| 2 | Django fetch modes (#17554 + no-arg `select_related()` deprecation) | claude-fable-5 | **LEAD, PARKED** — real, introduce-then-deprecate shape is attractive, but merged Oct 2025 (pre-recency-bar) and the scout flags the discriminating oracle as query-count-based (`assertNumQueries`), which needs a decision on whether that counts as behavior. Revisit only if FastAPI falls |
| 3 | Django DB-level on_delete (#19925) | claude-fable-5 | **LEAD, WEAK** — real but requires Postgres/MySQL for the discriminating behavior (SQLite unsupported), tripping the infra/cost concern; scout itself rates it most likely to collapse into co-location. Effectively rejected unless the pool empties |
| 4 | `tphakala/birda` stacked PRs | qwen-37-max | **REJECTED — fabricated sequence** on a real repo name (see §2). Do not re-litigate; any future birda nomination must re-derive everything from the actual Rust repo |
| 5 | hashicorp/packer HCP deprecation | qwen-37-max | **REJECTED — fabricated citation + fails recency** (2023) + scout's own analysis concedes the doc-edge is informational, not structural |
| 6 | openshift/origin `oc manage-cluster` | qwen-37-max | **REJECTED — no evidence the feature exists**; fails the candidate definition (no commits/PRs/dates); supporting details (Nix CI) uncorroborated |

**Net result: one admissible candidate.** That is itself a data point for §4.

## 4. Convergent findings (both delivered reports, independently)

1. **The rarity thesis is confirmed from both directions.** claude-fable-5 shows every benchmark
   program claiming dependency chains had to define dependency down to co-location or filter hard
   (ChainSWE overlap-joins; SWE-Bench-CL's own limitations section; EvoClaw's admitted selection
   bias). qwen-37-max reaches the same conclusion from repo-level search. This now makes **four**
   independent measurements pointing the same way (with the container check and the E3 base-rate
   observations). The supply finding is publishable material in its own right, and both scouts
   independently recommend exactly that as the fallback post.
2. **Where chains concentrate** (merged): fast-moving libraries in a capability-adding phase
   (FastAPI streaming, pydantic v2.x, polars) rather than mature stable cores; subsystems where a
   typed/structured surface is introduced then consumed (serialization, routing, query
   compilation, format migrations); repos with contract-testing cultures (oasdiff-style CI);
   CLIs with stable documented surfaces. Release-spanning deprecation cycles are real dependencies
   but **unreplayable inside one 4–8-change workspace** — both the claude scout (explicit walk-away
   class) and qwen's packer post-mortem land here, killing one of the prompt's four suggested
   shapes.
3. **Stacked-PR chains are tooling-rich but artifact-poor**: both scouts found the 2026 tooling
   ecosystem but no concrete public test-bearing chain meeting the definition (qwen's attempt to
   produce one is the fabricated birda entry; claude reports the vein as a dead end).

## 5. New design-level findings to carry into Step 5 / any prereg

These are claude-fable-5's contributions; nothing in the other sessions contradicts them.

1. **Silent vs loud edges — the most important single point in the round.** All four container-check
   lessons screen for whether a dependency is *real and attributable*; none screens for whether it
   *discriminates between the arms*. A loud failure (import error, clean traceback — exactly the
   container check's verified-CONFIRMED template) is caught by **both** arms via ordinary shell and
   public tests, so it cannot separate spec-runner from spec-reader. The discriminating edges are
   the silent ones: remove the earlier change and the later change still imports, compiles, and
   passes its public tests, while a behavior only the acceptance scenario exercises has changed.
   This is the same lesson as the paused probe's zero-lever-exposure failure wearing a new coat:
   the scarce resource is failures only the treatment can detect. **Concrete procedure change:
   Pass 3 verification must record a loudness classification per edge (loud / silent / mixed), not
   just fail/pass.** The FastAPI go/no-go pivots on it: if reverting #15022 breaks #15030's typed-SSE
   tests *without* a loud import error, there is one genuinely discriminating edge and a narrow
   two-arm study is live; if it breaks loudly, the candidate is scaffolding and the supply finding
   becomes the post.
2. **State-accumulation confound.** Carrying one workspace across dependent changes means an early
   agent mistake poisons later tasks (ChainSWE measured up to 70% success decay at depth and
   isolated the cause with a per-bug oracle baseline). A two-arm gap could be workspace corruption,
   not spec execution. Mitigation to pre-register: log workspace diffs per step and/or run a
   reset-each-step oracle arm.
3. **Contamination beyond the diff.** Post-Jan-2026 merge dates do not neutralize memorized *API
   shape* (SWE-Bench Illusion: 76% buggy-file identification from issue text alone, collapsing to
   53% off-benchmark). The FastAPI chain is recent but FastAPI-the-library is heavily documented;
   the memorization check must probe surface-shape knowledge, not just fix reproduction.
4. **Representativeness trade-off to decide *before* publishing, not after:** the
   public-boundary + scenario-runner requirements bias toward web frameworks; a FastAPI result
   invites "that's not my codebase." Decide the narrative scope now. The scout's proposed scoped
   claim is the honest shape: *"when a later change consumes a public API surface an earlier change
   introduced, an executable acceptance spec (vs the same spec readable-only) reduces false 'done'
   declarations against held-out behavior."*

## 6. Disagreements and non-overlap

- **Zero candidate overlap** between the two delivered reports — with a supply this thin, two
  independent searches finding disjoint sets (one of them largely fabricated) says the discovery
  process is noise-dominated. A third opinion (the unrun glm session) is free and worth collecting,
  but expectations should be low.
- qwen recommends its openshift candidate as "principal substrate"; that recommendation does not
  survive the existence check and is rejected wholesale.
- qwen proposes relaxing chain length to 2–3 commits if supply demands it; claude implicitly
  accepts shorter chains by proposing to drop the #14987 edge (leaving a 4-node chain). No
  conflict in practice; the prompt's 4–8 stays, measured after edge-dropping.

## 7. Recommended next actions (in order; every step before the last is zero model spend)

1. **(Optional, free) Nudge the glm session** to actually run; paste output as
   `glm-52-run2.md`. Do not block on it.
2. **Pass 3 local verification of the FastAPI chain** — needs operator go for the container/git
   work (compute time, no model spend). Per the frozen-spec method plus its corrections, plus the
   new loudness column:
   a. Clone fastapi/fastapi; confirm single-parent history across `c73bc94..`#15588's commit;
   b. Read `fastapi/sse.py` / `fastapi/routing.py` / `fastapi/dependencies/utils.py` at the
      relevant commits to confirm SSE consumes #15022's typed-stream machinery (the one
      load-bearing inferred claim);
   c. Subtract-one-change per edge (revert the squashed commit; rerun the later PR's tests),
      recording verdict **and loudness**; start with #15022→#15030 — it alone decides
      go/no-go for a two-arm pilot;
   d. Classify the visible/held-out split candidates (tutorial tests vs `tests/test_sse.py`).
3. **Then Step 5 route decision proper**, with this comparison as input: if a silent
   discriminating edge exists → costed pilot proposal (fresh authorization; several × remaining
   stop-loss); if not → Route 3 publish, now carrying the supply finding from two searches, the
   container check, and the benchmark literature's own limitations sections.

## 8. Retirement notes (never re-litigate without new evidence)

- qwen's three v2 nominations are retired as specified in §3 rows 4–6 (fabrication documented in
  §2). The *repos* are not blacklisted; the *claimed sequences* are.
- packer-style release-spanning deprecation cycles are retired as a shape for single-workspace
  replay (both scouts, independent reasoning).

---

## Addendum (2026-07-21, after the FastAPI verification): glm second round

Recorded verbatim in `glm-52-run2.md`. **No admissible nomination — the glm leg of the search is
closed.** The scout states outright it cannot access post-January-2026 commits and instead
*invents* a simulated 4-step `uv publish` sequence on `astral-sh/uv`. Three grounds, none
requiring re-litigation:

1. **It is synthetic by its own declaration** — "modeling … on the projected development
   trajectory", "(Simulated post-Jan 2026 merges)" — which is the prompt's first hard exclusion.
   Unlike qwen's entries this is honest simulation, not fabrication presented as fact; it is
   rejected on the same rule either way.
2. **Its premise is false about the real repo**: `uv publish` has existed since 2024 (uv 0.4.x),
   so the real implementation is squarely inside training data — the exact contamination the
   recency bar exists to avoid.
3. **The session has no live web access**, which is the root cause of both rounds' failure to
   search. Lesson for any future scout roster: verify the model can actually browse before
   assigning it a search role. Do not ask this session to "proceed with prompt payloads" — that
   drifts into experiment design the process assigns elsewhere.

**What is worth salvaging** — the held-out-scenario sketch is good *design* material, independent
of substrate: visible scenarios covering only the happy path + one failure, held-out probes
hitting an untested flag, divergent 4xx/5xx semantics, and a negative-space probe (assert exactly
one request, i.e. the *absence* of retries). That negative-space probe pattern — asserting what
must NOT happen — is directly applicable to the FastAPI pilot's held-out design (e.g. "invalid
item must NOT be streamed") and is noted for the authoring protocol.

Final search-v2 tally stands: **one admitted candidate (FastAPI), verified 2026-07-21
(`FASTAPI-VERIFICATION-RESULTS-v1.md`) — supports at most a narrow pilot on the #15022→#15030
edge.** The search phase is closed; next decision is the operator's Step 5 call.
