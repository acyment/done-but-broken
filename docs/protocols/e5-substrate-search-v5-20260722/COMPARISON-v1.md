# Substrate search v5 — merged comparison (v1)

Run 2026-07-22 by Claude Code under `docs/e5/E5-SUBSTRATE-SEARCH-V5-BRIEF-v1.md` (option 2:
refill the primary slot under the hardened admission pipeline). Zero external spend: `gh`
reads, one blocked curl to Apache JIRA (recorded), local git only. No model experiments, no
runs. Harvest breadth was fanned out to three claude-family subagents (raw reports:
`HARVEST-SERVICES-RAW.md`, `HARVEST-CLI-RAW.md`, `HARVEST-CROSS-RAW.md`); **every
load-bearing repo/issue/PR/commit fact used in a verdict below was re-resolved against
GitHub in the main loop the same day (F0)**, and all F1–F4 verdicts were made in the main
loop, falsification-framed, per brief §7.

## 1. Pre-declared fallback trigger: FIRED (recorded, not a filter change)

v4 CLARIFICATIONS Exchange 2 (2026-07-21) pre-declared: after both scout sessions and one
further mechanical sweep, if the strict-passing pool holds fewer than two verified
conjunctions per surface shape, the latent-bug shape (culprit pre-2026, fix+issue
post-2026) becomes admissible, **each candidate then requiring a memorization probe before
any use**. Pool state at this search's start: service-shaped strict verified conjunctions =
**0** (Immich dead — `GATE-7-2-FINDING-v1.md` + `BATCH-A-FINDING-v1.md`; gunicorn dead as
episode — v4). The trigger condition holds; latent fossils are screened below under that
pre-declared rule. Strict A1 remains the bar for "strict pair" labeling.

## 2. Scout reliability (this round)

Three subagent harvesters (same-session, claude-family), all output link-checked in the
main loop. No fabrication found. Real imprecision found and corrected by main-loop F0:
ripgrep's "fix" commit was actually the test commit (real fix = `43e2f08ede`, 2026-06-04);
restic issue #5767 carries an unexplained number/date anomaly (created 2026-03-28 while the
repo sequence is at ~21977 — artifacts resolve and cross-link, anomaly recorded on the
reserve entry); curl fixes land as direct commits, not merged PRs (F0 notes, not defects).
The v2/v4 lesson (existence-check non-negotiable) paid for itself again at lower severity.

## 3. Kill table (ordered filters, cheapest first; one line per disposition)

Filters per brief §3. "D2-cert" = certified-trap property failure (§2.2, typically
user-discovery); "D2-silence" = wrongness not silent; "D3-shape" = original defect whose
establishing item could only be the trap task's own criteria (structural-ceiling shape);
"D7-cap" = library surface, not primary-eligible.

| # | Candidate (fix anchor) | Verdict | Filter | One-line reason |
|---|---|---|---|---|
| 1 | Solr SOLR-17649 (`f66aa9ed07`) | KILL | F0-recency | Fix merged 2025-02-12 — pre-window |
| 2 | Solr SOLR-17221 (`82083ea13a`) | KILL | F0-recency +F1 | Fix 2025-01-16 pre-window; lands in SolrJ *client* (wrong layer on top) |
| 3 | Solr #4279 / SOLR-18194 | KILL | D2-cert | Self-discovered by fix author, no user issue; wrongness = visible refusal of an admin op, not silent wrong data |
| 4 | TimescaleDB `217fe4c159` (issue #9902) | KILL as primary | D7-cap | Maintainer-discovered (akuzm); GROUP-BY-not-in-SELECT + columnstore edge is F4-weak; SQL/library surface — trap-library entry only |
| 5 | pip #14084 (issue #14079) | KILL | D2-silence | Issue titled "crashes pip instantly" — loud traceback, not silent wrongness |
| 6 | pip #14131 | KILL | D2-cert | No user-filed issue exists (searches empty); contributor defensive hardening, not a discovered fossil |
| 7 | borg #9853 | KILL | D2-cert | Maintainer-authored fix from his own ramdisk repro; no user report found (ENOSPC/missing-chunk searches) — trap-library entry |
| 8 | **gitea #36483 → #36485** (culprit `fafd1db1`) | **SURVIVOR #1** | — | Strict in-window regression pair on a natural HTTP service; see `GITEA-SCREEN-v1.md` |
| 9 | **paperless #11868 → #11869** | **SURVIVOR #2** | — | Latent (fallback-admissible) silent data loss with structural fresh-fixture blindness; see `PAPERLESS-SCREEN-v1.md` |
| 10 | jellyfin #16454 → #16490 | RESERVE | — | Silent wrong list, user-filed, server controller fix; open: regression-vs-original undetermined; no regression test in fix |
| 11 | jellyfin #16248 → #17170 | KILL | episode-shape | Longstanding design flaw "reworked" (enhancement-shaped); no established-behavior break |
| 12 | paperless #11881 → #11884 | KILL | D2-cert | Maintainers treated it as a spec choice ("Fixhancement") — wrongness not certified |
| 13 | FreshRSS #8531 → #8543 | KILL | D3-shape | Original parser defect; settings/filter-parsing surface, naturalness penalty |
| 14 | gitea #36474 → #36504 | KILL | profile §2.2 | Activity-feed ref-type label — not user-meaningful data; broad multi-concern fix |
| 15 | gitea #36905 → #36914 | KILL | D2-cert | Filed by maintainer (silverwind) — fails user-discovery |
| 16 | navidrome #5158 → #5159 | KILL | profile §2.2 | Wrong value is a scanType status label (operational metadata), not user-meaningful data |
| 17 | ollama #15260 → #15678 | PARKED | F5-feasibility | Profile-strong (user-filed, silent, in-window fix+test, HTTP surface) but grader loop would require live LLM inference — violates the <60 s deterministic loop bar; culprit undated |
| 18 | garnet #1625 → #1635 | KILL | D3-shape | GEOHASH born wrong (original defect) — establishing item would be the trap task's own criteria; reporter-affiliation caveat |
| 19 | semaphore #3715 → #3717 | KILL | D3-shape | Original branch-name parsing defect; niche endpoint |
| 20 | duckdb #23500 → #23513 | RESERVE | F4-risk | F0–F3 strong (live CLI transcript in the issue); but TZ contract was established on the varchar path while JSON was born UTC-fixed — wrong-layer establishing item (gunicorn shape) |
| 21 | StarRocks #69598/#71680 → #71789 | KILL | F0-integrity | Fix completeness in doubt (#76601 later fixed a further over-count in the same feature); F5 infeasible (Iceberg cluster) |
| 22 | blocky #1969 → #2017 | KILL | D3-shape | Original defect inside the DNSSEC feature (module born 2025-11-07, pre-window) |
| 23 | spicedb #2999 → #3016 | KILL | D2-silence/shape | "feat: add missing impls" — absent feature, and infinite-duplicate stream is loud |
| 24 | wazuh #37181 → #37412 | KILL | F0-integrity | Sibling fix PR #37190 still open — fossil not settled |
| 25 | Lychee #4319 → #4328 | RESERVE (weak) | — | Clean shape (user-filed, silent duplicates, endpoint regression test) but smallest project (4.2k stars); culprit undated |
| 26 | curl #22038 → `e0c6f4d4d6` | RESERVE | D3-shape risk | `%time{}` born 2025-07-31 and born-broken (`%s` via strftime on UTC tm) — latent AND original-defect shape; F5 trivial; user-filed, concrete 28800 s wrongness |
| 27 | curl #20715 → `e5087ac9fc` | KILL | observability | Wrong 303 method visible only via server-side effect, not at curl's own surface |
| 28 | rclone #9507 → `c6cdb89935` | RESERVE | — | Silent NFKC password corruption, user-filed with real harm; culprit undatable cheaply; fix is a direct commit (no PR) |
| 29 | restic #5767 → #21797 | RESERVE | — | Silently empty snapshot with success output (borg-class stakes), user-filed in-window; latent culprit; **number/date anomaly recorded — re-verify before any promotion** |
| 30 | ripgrep #3376/#3320 → `43e2f08ede` | RESERVE (top CLI reserve) | — | Ignored files silently included with multiple roots — core-contract pin, user-filed twice, fix+tests in-window; culprit (parent-matcher caching) undated, likely pre-window |
| 31 | restic #21820 → #21828 | KILL | F4 | Split-index-entries precondition is deep internal state nobody scenario-pins; overall check partially loud |

Screened substantively: 24 candidates beyond the ≥10 bar (plus 7 marginal leads dropped
inside the harvest reports with reasons).

## 4. Standings

### Primary (service-shaped) slot

| Rank | Candidate | Recency | Discovery | F5 cost | Status |
|---|---|---|---|---|---|
| **1** | **gitea #36483 → #36485** | **Strict pair** (culprit 2026-01-17, fix 2026-01-30, issue 2026-01-29) | User-filed (CONTRIBUTOR assoc.) | Low (single Go binary, API-driven repro, loop ≪60 s) | **F5 PASS 2026-07-22** — all legs + pre-culprit; `GITEA-F5-RESULTS-v1.md` |
| **2** | **paperless #11868 → #11869** | Latent (fix+issue 2026-01-23; culprit 2023–24 era) — fallback-admissible, **memorization probe mandatory** (prior report #10256, 2025-06-24, is in training data) | User-filed (NONE assoc.) ×2, first dismissed "not a bug" | Medium as expected (compose build; measured loop: cold 34.5 s, warm 1.7 s, celery wait 1.3 s) | **F5 PASS 2026-07-22** — all legs; `PAPERLESS-F5-RESULTS-v1.md` |
| 3 | jellyfin #16454 | Fix in-window; culprit undetermined | User-filed | Medium | Reserve |
| 4 | Lychee #4319 | Fix in-window; culprit undated | User-filed | Medium | Reserve (weak) |
| — | ollama #15678 | In-window | User-filed | **Prohibitive** (LLM in loop) | Parked |

### CLI slot (secondary; not this search's vacancy but D7's eventual pairing)

| Rank | Candidate | Recency | Note |
|---|---|---|---|
| 1 | ripgrep `43e2f08ede` | Latent (likely) | Core-contract pin ("ignored files never appear"); culprit dating = first F5-prep task |
| 2 | restic #5767 → #21797 | Latent | Highest stakes (empty backup, success output); F0 anomaly to clear first |
| 3 | duckdb #23513 | Latent | F4 wrong-layer risk |
| 4 | rclone `c6cdb89935` | Latent | Culprit undatable cheaply |
| 5 | curl `e0c6f4d4d6` | Latent + born-broken | D3-shape concern |

### Trap-library entries (mechanism certified, not episodes)

borg #9853 (ENOSPC silent-success; maintainer-verified repro matrix), TimescaleDB
`217fe4c159` (GROUP BY aliasing → merged groups), joining gunicorn #3614→#3618 and pandas
#64478→#66250 from prior rounds.

## 5. Bug-class coverage (brief §4 check)

The two nominees are **not** timezone/date bugs: gitea = revision-range semantics
(ordering/data-shape class), paperless = identifier-mapping data loss (wrong-key class with
aged-data precondition). The TZ class appears only in reserves (duckdb, curl) and both
carry recorded structural concerns. The class-diversification instruction is satisfied.

## 6. Exit gate (per brief §7)

This session completes harvest + F0–F4. **No F5 build was run.** Nominees for the (at most
two) F5 build sessions, in order: **gitea**, then **paperless**. Both screen docs carry the
§2.5 exposure-precondition sketch and an F5 plan with the Batch-A corollaries baked in
(behavioral delta must reach the surface; live path must produce the sensitive value).
Operator go is required before any F5 build session, and design-phase machinery
(memorization probe, blind-author probe, Three Amigos, prereg v3) stays parked until after
the operator reads this comparison.

**Update 2026-07-22 (later session, operator-authorized F5 build): gitea F5 RUN — PASS on
all four legs plus the optional pre-culprit leg; no kill found. First F5-verified
primary-slot candidate.** Evidence: `GITEA-F5-RESULTS-v1.md` + `raw-gitea-f5/`. Kill-table
delta: none (the falsification pass attributed every native-suite failure on the buggy
build to environment via a fixed-tree controlled comparison; the commit-list-pinning
integration tests pass on the buggy build — the decoy property holds). Paperless F5 and
all design-phase machinery remain operator decisions.

**Update 2026-07-22 (paperless F5 build session, operator-authorized): paperless F5 RUN —
PASS on all four legs; no kill found. Second F5-verified primary-slot candidate (latent
class).** Evidence: `PAPERLESS-F5-RESULTS-v1.md` + `raw-paperless-f5/`. Kill-table delta:
none. Both wrongness forms reproduced through the public REST surface on the buggy build
(collision: field-A's value onto field-D; divergence: field-B's value silently gone; merge
reports OK, logs silent); fixed build correct under the identical recipe; full native
suite failure set byte-identical across the one-token delta (18F/1404P on both trees —
all environmental by controlled comparison), with all 215 bulk-edit/consumer/custom-field
tests green on BUGGY; loop cold 34.5 s / warm 1.7 s, celery wait 1.3 s. The at-most-two F5
budget (brief §7) is now spent: both nominees verified. Standing reminder: the paperless
candidate's memorization probe is MANDATORY before any design-phase use (#10256 is
in-window). Design-phase machinery remains an operator decision.

**Update 2026-07-22 (memorization probe, prereg frozen at `0ee4314`): paperless KILLED for
episode use — trap dead (0/4 core probes keyed by instance PK vs the frozen ≥2 bar; zero
memorization tells in either family, including the scrubbed bare arm — avoidance is
competence, not contamination). F5/F0–F4 records stand; mechanism goes to the trap library.
gitea #36483→#36485 is the sole F5-verified primary candidate; next vein = CLI reserves
(ripgrep first), operator decision.** Evidence: `PAPERLESS-MEMOPROBE-RESULTS-v1.md` +
`raw-paperless-memoprobe/`.

**Update 2026-07-22 (ripgrep admission session, prereg frozen at `3cf49ff`): ripgrep KILLED
for episode use at the probe — decisive bare-arm memorization tell (fable and opus both name
ripgrep's ignore crate through a full scrub; opus reproduces the withheld identifiers) AND
independently trap-weak (1/4 core falls-in vs the ≥2 bar; the one fall-in reproduces elided
pre-fix text verbatim). F0–F4 screen had PASSED (`RIPGREP-SCREEN-v1.md`, latent class,
culprit `d79add3` 2016-10-11); no F5 was run or needed — probe-before-build worked as
intended. Kill-table line 30 → KILL. CLI slot stays open (next: restic #5767, anomaly check
first, probe early); gitea remains the sole verified primary.** Evidence:
`RIPGREP-MEMOPROBE-RESULTS-v1.md` + `raw-ripgrep-memoprobe/`.

**Update 2026-07-22 (gitea memoprobe, operator-authorized, prereg frozen at `209e713`):
gitea KILLED for episode use at the frozen fable/Luna episode tier — trap dead at core
(0/4 falls-in vs the ≥2 bar; zero tells, the scrub held) while FULLY LIVE one tier down
(opus color rows 2/2 falls-in; the ctx row reproduces the culprit-era range line verbatim
with the exact git-diff-vs-git-log confusion the fix comment documents). F0–F4/F5 records
stand; mechanism → trap library with tier annotation. **The v5 pool now holds ZERO
candidates both F5-verified and probe-live at the frozen tier — the brief §7 exhaustion
branch: operator decision point (widen classes / screen restic probe-first / revisit
episode tier, named as post-hoc / reconsider fossil-trap strategy given the
tier-absorption pattern).** Evidence: `GITEA-MEMOPROBE-RESULTS-v1.md` +
`raw-gitea-memoprobe/`.
