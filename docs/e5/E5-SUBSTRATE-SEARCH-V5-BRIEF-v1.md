# E5 substrate search v5 — brief v1 (option 2: refill the primary slot under the admission rule)

Date: 2026-07-22. Written immediately after the Batch A kill
(`harness/immich-pilot/proof/BATCH-A-FINDING-v1.md`), while the kill reasons are fresh. This
brief governs the next substrate search session(s). It supersedes Batches B–D of
`E5-IMMICH-REANCHOR-BACKLOG-v1.md` (moot) and operationalizes "option 2" from
`GATE-7-2-FINDING-v1.md`. The episode design note (`E5-EPISODE-DESIGN-NOTE-v1.md`, D1–D7)
remains governing; this brief only adds the search procedure and the hardened admission
pipeline. **Zero external spend throughout: local compute, git, docker, GitHub reads.
External deep research only as operator-run lead generation (see §5). No model experiments,
no runs, no prereg freeze without fresh operator authorization.**

## 1. The vacancy

The **primary (service-shaped) slot is open**. Immich #28810 is dead (two independent kills;
Batch A memo). Standing per D7: pandas #64478→#66250 remains **corroborating evidence only**
(library surface, demoted from episode substrate); the primary must be a surface where
executable acceptance scenarios are idiomatic — an **HTTP service or a CLI**. The CLI vein
(pip/borg-style) was recency-back-burnered, not rejected; this search may reopen it.

## 2. Target profile (all properties required for admission)

1. **Natural surface (D7):** HTTP API or CLI; black-box observable by a user; Gherkin over it
   reads as normal practice, not costume.
2. **Certified trap (D2):** a shipped-regression fossil — a real maintainer took the tempting
   path; the native suite stayed green; the wrongness shipped **silently** (no crash, no
   error); a real user discovered and reported it; a later merged fix documents it, ideally
   adding a regression test. Post-cutoff for the in-experiment model tier.
3. **Forced touch (D2):** the trap task cannot be completed without editing the code carrying
   the established behavior (shared helper / single pipeline).
4. **Establishing item that PINS THE PRECONDITION (D3 + refinement):** a scenario a team
   plausibly wrote *before* the trap task that pins the exact edge condition the trap needs —
   not merely covers the feature happy-path. The precondition must be a **black-box
   environment condition** (D3-refinement-2), never a white-box internal convention.
5. **Exposure precondition statable pre-spend (AGENTS.md, 2026-07-21):** the event the
   treatment acts on, its base rate with source, and an abort floor must be writable into a
   prereg. A candidate whose trap cannot plausibly be entered by an agent is inadmissible
   regardless of fossil quality.

## 3. Admission pipeline — ordered kill filters, cheapest first

Run every candidate through these **in order**; stop at first kill; record one line per kill
in the search comparison doc. Each filter carries the precedent that created it. The framing
is falsification: the screener's job is to find the reason the candidate is OUT.

- **F0 — Existence check.** Every load-bearing repo/issue/PR/commit resolved against GitHub
  the same day. *Precedent: qwen's DoltLite fabrication (v2 and v4 — real repo names, invented
  specifics). Non-negotiable for externally sourced leads.*
- **F1 — Layer check.** The fix must land in the server/CLI code that renders the target
  surface — not a web/mobile client, not a test, not docs. *Precedent: gunicorn (RFC-parser
  tests at the wrong layer); Immich #28705/#27487 (day-earlier symptom, fixed in the web
  client).*
- **F2 — Behavioral-delta check.** Read the fix diff and state, in writing, the exact
  behavioral change and which observable field(s) it reaches. A rename, refactor, or
  type-annotation change is NOT a fix. *Precedent: Batch A kill 1 — e94e22f's datetime path
  was a rename; its only behavioral delta never touched the claimed surface.*
- **F3 — Operand/type check.** Verify the live runtime path actually produces the sensitive
  value the mechanism needs: column/wire types, driver parse behavior, input construction.
  The fix's own regression test input is NOT evidence — check what the *endpoint* produces.
  *Precedent: §7.2 (test used local-midnight Date; live path produces UTC-midnight); Batch A
  kill 2 (mechanism physics real, sensitive type absent from the schema).*
- **F4 — Precondition-pinning screen.** Would a plausible pre-trap acceptance suite pin the
  trap's precondition? If the precondition is an edge nobody scenario-tests, the establishing
  item is a decoy and the candidate fails D3. *Precedent: TimescaleDB int2/composite/cross-type
  edge.*
- **F5 — Live end-to-end repro at the pinned commit (THE admission rule).** Build the minimal
  stack; at the fix's parent commit, through the real public surface (HTTP/CLI, no
  pure-function shortcuts): (i) reproduce the user-meaningful wrong value under the
  precondition; (ii) show correct behavior with the fix applied (or fixed-state helper);
  (iii) show the native suite green on the buggy code (the decoy property); (iv) archive raw
  outputs. *Precedent: §7.2 existing because IMMICH-VERIFICATION treated a full-stack repro as
  a "recommended sanity check" instead of an admission requirement.*

F0–F4 are static (reading code, diffs, schemas, issues) — minutes to an hour each. F5 is a
build session — spend it on at most the **top 2** survivors. Everything downstream of
admission (memorization probe, blind-author probe, Three Amigos, Step-6 re-attack, prereg v3)
is design-phase machinery, **not** part of this search, and starts only after operator sees
the search's exit memo.

## 4. Bug-class guidance — widen beyond timezone/date

The TZ/date-serialization class has a now-demonstrated structural problem: the same
environment-pinning that makes CI blind (desired) tends to make runtime types neutralize the
bug (fatal) — two Immich rounds died on variants of this. Do not over-weight the class.
Admissible silent-wrongness classes with the same suite-blind + precondition-gated shape:

- locale/encoding-dependent parsing or formatting (non-C locale, non-UTF-8 input);
- unit or precision conversion at a boundary (rounding, float formatting, int truncation);
- off-by-one / boundary conditions at API pagination, range filters, date-range endpoints;
- config-dependent behavior (a non-default flag silently changes results);
- ordering/stability assumptions surfaced only for specific data shapes;
- cache/staleness bugs where a stale value is served as fresh.

The class matters less than the profile: **silent, user-observable, precondition-gated,
native-suite-blind, fossil-certified.** Timezone bugs are still admissible if they clear F1–F3.

## 5. Harvest phase

**Order of work — cheapest leads first:**
1. **Unmined reserve veins from v4** (already partially screened): Apache Solr faceting /
   query-param regressions (SOLR-17649, SOLR-17221) as service-shaped leads; TimescaleDB
   v2.27.2 grouped-aggregation correctness bug (library-shaped; only useful as trap-library
   entry unless it clears F4).
2. **Reopen the CLI back-burner** (pip/borg-style candidates; recency was the objection —
   re-check dates against the current cutoff).
3. **Fresh GitHub harvest**: issue/PR searches over service-shaped repos (self-hosted web
   apps, API servers, CLIs with real user bases) for post-cutoff merged fixes closing
   user-reported silent-wrongness issues. Useful shapes: `type:issue closed "wrong value"`,
   "returns incorrect", "off by one", "one day earlier/later", "silently", combined with
   repo/language filters; then walk issue → closing PR → fix diff.
4. **External deep research (operator-run, subscription, zero marginal cost):** breadth tool
   only. Standing rule from v2/v4: **leads, not verified** — every deep-research nomination
   enters the pipeline at F0 with zero inherited credibility, and fabrication-on-real-repo-names
   is the expected failure mode. Suggested prompt skeleton:

   > Find merged bug-fix PRs (merged after <cutoff date>) in server-side or CLI open-source
   > projects with real user bases, where: a user-filed issue reports the software silently
   > returning a WRONG VALUE at its public surface (HTTP response or CLI output) — no crash,
   > no error; the bug only manifests under a specific environment/configuration/data
   > precondition; the project's own test suite did not catch it; the fix changes server/CLI
   > code (not a web client) and ideally adds a regression test. For each: repo, issue #,
   > PR #, fix commit SHA, the precondition, the observable wrong value, and direct links.
   > Exclude: crashes, error-message bugs, client-side fixes, performance issues, security
   > advisories. Report only candidates whose links you have verified resolve.

## 6. Ruled-out ledger (never re-litigate without new evidence)

| Candidate | Status | Reason (one line) |
|---|---|---|
| Immich #28810 / `e94e22f` | **DEAD** | §7.2: birthDate surface zero exposure; Batch A: fix is a rename on all timestamp surfaces, all columns timestamptz, byte-identical across server TZs |
| Immich #28705 / #27487 leads | DEAD as episode | Fixed in the web client (PRs #29019/#29128) — wrong layer (F1) |
| gunicorn #3614→#3618 | DEAD as episode | Establishing item at wrong layer; retained as trap-library entry |
| TimescaleDB #9579→#9581 | PARKED | Fossil-grade trap; fails strengthened D3 absent new evidence (nobody pins the int2/composite/cross-type edge) |
| qwen DoltLite JSON-loss | DEAD (fabricated) | Trap does not exist in the real v0.11.x releases; repo itself not blacklisted |
| pandas #64478→#66250 | Not a primary | D7: corroborating evidence only; library surface |
| FastAPI chain | Complementary only | Knockout-certified-only trap; weaker than fossil bar |
| ChainSWE | REJECTED | Substrate screen (critique-process Step 1) |
| SWE-Milestone / scikit-learn | Out of scope here | Belongs to the Route-2 chains program, not this search |

## 7. Session mechanics (recommendations, operator adjustable)

- **Fresh session** for the search, against this brief — do not carry Immich context.
- **Seats:** harvest may fan out to subagents/cheap models (breadth work, F0 links checked in
  the main loop); **F1–F4 verdicts stay in the main loop at frontier tier, high effort** —
  every dead candidate to date was admitted by a strong model reading optimistically, so the
  screener prompt is falsification-framed (§3).
- **Timebox / stop conditions:** one session for harvest + F0–F4 over ≥10 candidates; at most
  2 candidates into F5 builds (a session each). If zero candidates survive F0–F4, STOP and
  write a class-exhaustion memo with the kill table — that is a valid result and an operator
  decision point (widen classes further, accept a weaker bar knowingly, or reconsider the
  program's substrate strategy). Do not lower a filter mid-search.
- **Evidence layout:** `docs/protocols/e5-substrate-search-v5-<date>/` mirroring v4
  (per-candidate verification docs, raw scripts/outputs, a merged COMPARISON doc with the kill
  table and standings).
- **Exit gate:** a comparison doc + at most 2 F5-verified candidates with archived repro
  evidence. Operator go required before any design-phase machinery (prereg v3, Three Amigos,
  probes) starts on a survivor.

## 8. What survives for the winner (no rebuild needed)

From the Immich effort, pattern-reusable regardless of substrate: the dev-watch stack shape
(pinned toolchain, pinned deps digests, frozen server-process clock, staleness-proof health
gate, template-DB reset, `run-acceptance` exit-code contract, hidden grader with counter-check
phases), the audit-stack for glue (D5), the §7.3 suite-audit procedure, and the <60 s loop
budget as the latency bar. The concrete implementations under `harness/immich-pilot/` are
Immich-specific but the scripts document the required properties.
