# Substrate search v4 — merged comparison (v1)

Merges the two deep-research scout sessions (`claude-fable-5.md`, `qwen-37-max.md`) plus the
mechanical pass (`MECHANICAL-PASS-v1.md`) and the two local verifications
(`PANDAS-VERIFICATION-RESULTS-v1.md`, `GUNICORN-VERIFICATION-RESULTS-v1.md`) against the v4
prompt and clarifications. Written by Claude Code 2026-07-21. Every load-bearing repo/PR/issue
existence-checked against GitHub the same day.

## 1. Scout status and existence-check verdict

| Scout | Nominations | Existence check | Verdict |
|---|---|---|---|
| claude-fable-5 | Immich (service), TimescaleDB (library) | **All load-bearing claims confirmed** — Immich #28810 (timonrieger, 2026-06-03, closes #28091), #28091 (toreador34, TZ=Europe/Istanbul, exactly as described), TimescaleDB #9579 (akuzm, 2026-04-13), #9581 ("Use crosstype compatible hash for int2 bloom filter", 2026-05-04) | **Both admissible to local verification.** Honest report: separates verified from inferred, flags its own weakest checks |
| qwen-37-max | DoltLite (primary), Stripe/FastAPI/pandas (dismissed) | **Trap FABRICATED.** doltlite exists but its releases are v0.11.x with **no** "silent data loss for large JSON values" entry; qwen cited it to `dolthub/dolt/releases` (wrong repo) and invented version "v3.7.0-beta.5". Fillers cited to unrelated changelogs (macOS sandbox-exec, cockpit-tools OAuth); evidence cited to Instagram/LinkedIn/YouTube | **REJECTED** — same real-repo-name + fabricated-specifics pattern as its v2 round |

**Repeat of the v2 finding, now a reliable prior:** claude-family scout delivers verifiable
work; qwen fabricates plausibly on real repo names and must be link-checked line by line. The
existence-check pass is non-negotiable and paid for itself again.

## 2. The one real signal from the rejected report

Qwen disqualified our verified pandas lead and dismissed FastAPI on **surface-naturalness**
grounds: `DataFrame.idxmax` is an internal library operation teams don't write Given/When/Then
for. Overstated (it calls this disqualifying), but the underlying concern is real and
independently echoed by claude's critique and our own logged naturalness penalty on pandas. Kept
as a genuine consideration, not as grounds for rejection — see §4.

## 3. claude's critique — a real strengthening of the design note (D3)

claude's critique identifies a two-sided flaw in the establishing-item requirement that our own
gunicorn verification had just demonstrated independently:

- **Gameable:** almost any behavior can be retrofitted a plausible-sounding Given/When/Then after
  the fact ("surely someone tested that birth dates read back correctly").
- **Unsatisfiable:** silent-wrongness fossils live in a *narrow edge configuration* (a non-UTC
  server; an int2 column under a composite bloom filter queried with a cross-type literal), and
  real acceptance suites are written against the happy path and default config.
- **The tell that separates real from retrofitted:** does the establishing scenario **pin the
  precondition** the trap needs, or merely "cover the feature"? A happy-path scenario in the
  default configuration is a decoy — the accumulated suite never fires.

This is exactly the gunicorn failure in general form: the RFC-parser tests covered the feature
(request validity) but did not pin the precondition (a well-formed-but-unframed body at the
keepalive layer), so they were blind where the trap broke. **Adopt as a D3 refinement** (recorded
below): the establishing item must plausibly pin the trap's precondition, not merely exercise the
feature; candidates are scored on the stronger bar.

claude also names the tension this creates with practice-naturalness: the more service-shaped and
intent-level the surface, the *coarser* the scenario, and the more likely a narrow edge slips
through. Naturalness (criterion 4) and precondition-pinning (strengthened D3) pull against each
other — a real design constraint, not a scoring artifact.

## 4. Merged standings by surface slot

The two-substrate plan (one service-shaped, one library-shaped) now has a real contest in each
slot. gunicorn's failure (`GUNICORN-VERIFICATION-RESULTS-v1.md`) reopened the service slot; this
round fills it.

### Service-shaped slot

| Candidate | Trap | Establishing item | Naturalness | Status |
|---|---|---|---|---|
| **Immich #28810** | Verified-real, post-Jan-2026, WITH added regression test; user-discovered (TZ=Europe/Istanbul); forced-touch via shared `asDateString` helper | birthDate/People feature; scenario pins precondition **only if test server TZ is set ahead of UTC** — the checkable risk | **High** (HTTP API + OpenAPI, user-meaningful dates) | **LEAD for the slot — local verification next** |
| gunicorn #3614→#3618 | Verified silent, canonical surface | **FAILS** — RFC-parser tests wrong layer; born-dead | High | Trap-only; not an episode |

### Library-shaped slot

| Candidate | Trap | Establishing item | Naturalness | Status |
|---|---|---|---|---|
| **pandas #64478→#66250** | **Locally verified** loud→silent→correct; 4 months shipped | **Satisfied** — idxmax correctness long-standing + in-window EA-reductions API #63512 | Medium (idxmax is user-meaningful but not classic web-BDD; logged penalty) | **LEAD — only fully-verified candidate with a satisfied establishing item** |
| TimescaleDB #9579→#9581 | Fossil-grade (maintainer-authored repro, shipped v2.26→fixed v2.27, 7 weeks) | **Weak** — nobody scenario-tests int2+composite+cross-type edge (the precondition-pinning problem in its sharpest form) | Medium (SQL result-set contract idiomatic for a DB, reads as internals) | **Strong second; establishing-item risk is exactly the strengthened D3 bar** |

## 5. Net position

- **Library slot: pandas holds**, as the only candidate verified end-to-end AND satisfying the
  (now stronger) establishing-item bar. TimescaleDB is a fossil-grade-trap alternative whose
  establishing item is its weakest point — verifying it means checking whether a plausible
  bloom-feature acceptance suite would ever have pinned the int2/composite/cross-type edge
  (claude's own least-confident check; likely no).
- **Service slot: Immich is the new lead**, replacing the failed gunicorn. Its single checkable
  risk is the strengthened-D3 question in concrete form: does the birthDate establishing scenario
  pin a non-UTC server timezone? claude's recommended probe answers it directly (stand up Immich
  with TZ=Australia/Sydney, PATCH birthDate 2000-01-15, GET, expect 2000-01-14 pre-fix).
- **A verified two-substrate pairing is now within reach for the first time:** pandas (library,
  verified) + Immich (service, pending one local check). Both post-cutoff on the trap; genuinely
  different shapes.
- **Reserve veins (claude, unmined):** Apache Solr faceting/query-param regressions (SOLR-17649,
  SOLR-17221) as a backup service arm; TimescaleDB v2.27.2 grouped-aggregation correctness bug as
  a second library fossil.

## 6. Recommended next actions (zero model spend; each needs operator go)

1. **Immich local verification** — the reopened service slot's lead. Docker up with non-UTC TZ;
   reproduce birthDate 2000-01-15 → 2000-01-14 at the pre-#28810 build; run the ordinary suite to
   confirm silence; **critically, test whether the trap fires under UTC** — if it only fires under
   non-UTC TZ, the establishing scenario must pin TZ, and that becomes an explicit episode
   precondition (the strengthened-D3 check made concrete).
2. **TimescaleDB establishing-item screen** (cheaper, decides the library slot's #2): does any
   plausible bloom-feature acceptance scenario pin the int2/composite/cross-type edge? If not
   (expected), TimescaleDB is a trap-library entry, not an episode — same status as gunicorn.
3. **Adopt the D3 refinement** into the episode design note (precondition-pinning; §3 above).
4. **qwen v4 rejected** — do not spend effort reconstructing DoltLite; the trap does not exist as
   described. doltlite the repo is not blacklisted, but any future nomination must derive the
   fossil from its real v0.11.x releases.

## 7. Retirement notes (never re-litigate without new evidence)

- qwen's DoltLite JSON-data-loss trap: retired as fabricated (releases are v0.11.x, no such
  entry; cited to the wrong repo).
- gunicorn as an *episode*: retired (establishing-item layer mismatch); retained as a trap-library
  entry.
- pandas naturalness concern: logged (penalty), not disqualifying — idxmax is a user-meaningful
  operation; does not meet qwen's "nobody would write this" bar.
