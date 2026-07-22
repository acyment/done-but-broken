# Harvest raw report — cross-GitHub sweep scout (subagent, 2026-07-22)

Provenance: claude-family subagent spawned by the main loop for breadth only. **Zero
inherited credibility** — load-bearing facts re-resolved in the main loop before any
verdict (see `COMPARISON-v1.md` §2). Verbatim output below.

---

# CANDIDATES (9, all different projects)

**1. ollama/ollama** (176,630 stars — local LLM server) — config-dependent constraint silently dropped
- Issue #15260 "`think=false` breaks `format` (structured output) for `gemma4` — format constraint silently ignored", author AIVTDevPKevin, created 2026-04-03
- Symptom quote: "setting `think=false` causes the `format` constraint to be **completely ignored**. The model outputs plain text instead of the requested JSON structure."
- Closing PR #15678 "server: apply format when think=false with thinking-capable parser", MERGED 2026-04-21, files: `server/routes.go`, `server/routes_generate_test.go`
- Precondition: gemma4-class model (thinking-capable parser) + `format` JSON schema + explicit `think=false`. Omitting `think` works.
- Wrong value: HTTP API returns plain-text completion instead of schema-conforming JSON; HTTP 200, no error.
- Least-confident: whether the project's suite "missed" it vs. the feature interaction being newly introduced (regression test was added in the fix PR).

**2. microsoft/garnet** (11,904 stars — Redis-compatible cache-store server) — precision/encoding
- Issue #1625 "GEOHASH returns incorrect last character due to missing 52-bit truncation handling", author sspeaks, created 2026-03-12
- Symptom quote: Redis returns `sqc8b49rny0`, Garnet returns `sqc8b49rnys` — "The first 10 characters match, but the 11th diverges."
- Closing PR #1635 "Fix GEOHASH last character to always output '0' (52-bit precision)", MERGED 2026-07-21, files: `libs/server/Objects/SortedSetGeo/GeoHash.cs` + 2 test files (PR authored by copilot-swe-agent)
- Precondition: GEOADD then GEOHASH on coordinates whose bits 53-55 are nonzero (52-bit double significand vs 55-bit geohash).
- Wrong value at RESP protocol surface; normal reply, no error.
- Least-confident: sspeaks may be Microsoft-affiliated rather than an outside user.

**3. semaphoreui/semaphore** (13,900 stars — UI/API for Ansible/Terraform) — data-precondition string truncation
- Issue #3715 "Repository branches API returns incorrect values for branches with /", author TheEdda, created 2026-03-23
- Symptom quote: "I have a branch named `env/test` ... the endpoint seems to parse this branch name as just `test`."
- Closing PR #3717 "Fix branch names with slashes truncated in GetRemoteBranches", MERGED 2026-03-24, files: `db_lib/CmdGitClient.go`, `db_lib/CmdGitClient_test.go`
- Precondition: repo branch names containing `/`. Wrong value: branches API returns truncated names (picking the wrong one then fails downstream, but the API response itself is silently wrong).
- Least-confident: whether the suite "should" have caught it — a test file exists next to the fixed code, and the fix added a test.

**4. duckdb/duckdb** (39,613 stars — analytical SQL DB with real CLI) — timezone-dependent formatting
- Issue #23500 "Wrong timezone for JSON cast", author thomas-0816, created 2026-06-28. Repro in the issue is via the `duckdb` CLI: `set timezone = 'Europe/Berlin'; select TIMESTAMPTZ '...'` — varchar cast shows `+02`, JSON cast differs.
- Closing PR #23513 "Issue #23500: JSON TIMESTAMP_TZ Formatting", MERGED 2026-07-01, files: `extension/json/json_functions/json_create.cpp`, `test/sql/json/scalar/test_json_icu.test`
- Precondition: non-UTC `SET timezone` (ICU) + casting TIMESTAMPTZ into JSON.
- Silence: query succeeds, wrong timestamp string in JSON output.
- Least-confident: exact shape of the wrong value (issue body was truncated in my output before the JSON-cast result line).
- Caveat for screener: DuckDB is "in-process DB" by description, but the bug is user-visible via the shipped CLI.

**5. StarRocks/starrocks** (11,921 stars — analytical query engine/server) — distributed execution duplicates
- Canonical issue #71680 "[Bug] Bucket-aware execution on Iceberg tables produces duplicate rows when GROUP BY includes bucket partition source column", author mixermt, created 2026-04-14; user-filed twin #69598 (author philclaridge, electricity-metering billing context, created 2026-02-27) was closed by maintainer stdpain as "dup with #71680".
- Closing PR #71789 "[BugFix] Fix stale scan ranges accumulation in incremental batch assignment", MERGED 2026-04-16, files: `fe/fe-core/src/main/java/com/starrocks/qe/CoordinatorPreprocessor.java`, test, `fe/checkstyle.xml`
- Precondition (from #69598 body): Iceberg external table with composite/bucket partitioning + GROUP BY on the bucket source column + bucket-aware execution. Wrong value: duplicate rows → inflated aggregates at the SQL surface; query succeeds.
- Least-confident: that #71789 fully explains #69598's GROUP BY symptom (a later PR #76601, merged 2026-07-21, fixed a further COUNT(DISTINCT) over-count in the same feature area).

**6. 0xERR0R/blocky** (6,802 stars — DNS proxy/ad-blocker server) — ordering-comparison bug in DNSSEC path
- Issue #1969 "Issues when looking up inexistent TLSA record with DNSSEC enabled", author ganto, created 2026-01-12
- Symptom quote: "mail submission failed because an expected TLSA record couldn't be resolved: ... Name service error for name=_25._tcp.mail... type=TLSA: Host not found"
- Closing PR #2017 "fix: use RFC 4034 canonical DNS name ordering for NSEC coverage check", MERGED 2026-03-17, files: `resolver/dnssec/nsec.go`, `resolver/dnssec/nsec_test.go`, `e2e/metrics_test.go`
- Precondition: DNSSEC validation enabled + querying a nonexistent record on a signed zone where non-canonical name ordering breaks the NSEC coverage check.
- Silence: blocky answers normally with a wrong negative DNS response — no crash.
- Least-confident: whether a wrong NXDOMAIN/negative rcode counts as "wrong value" for your screener or gets binned as an error-surface bug.

**7. authzed/spicedb** (6,880 stars — authorization database server) — pagination/cursor boundary
- Issue #2999 "FDW: LookupResources returns infinite/duplicate results when subject has ≥100 permissions", author kfir-novella, created 2026-03-28
- Symptom quote: "if a subject has 100 or more matching resources, the query returns an infinite stream of duplicate results instead of the correct finite set. Up to 99 results → works correctly"
- Closing PR #3016 "feat: Add missing impls of cursoring for Lookup calls in FDW", MERGED 2026-04-17, files: `internal/fdw/tables/permissions.go`, `internal/fdw/pgserver_e2e_test.go`, CHANGELOG
- Precondition: SpiceDB FDW (postgres_fdw proxy) + subject with ≥100 matching resources (page-size boundary).
- Wrong value: duplicate/unbounded SQL result rows; no error raised.
- Least-confident: whether "infinite stream" disqualifies it as too-loud (query may hang rather than return quietly).

**8. wazuh/wazuh** (16,252 stars — security platform server) — config serialization garbage at API
- Issue #37181 "Syscheck API returning wrong values", author MarcelKemp, created 2026-06-25
- Symptom quote: "`GET /agents/{id}/config/syscheck/syscheck` endpoint returns unreadable/incorrect values for the `scan_day` and `scan_time` fields ... serializes those internal values directly to JSON — without converting them back"
- Merged fix PR #37412 "Preserve original scan_day/scan_time strings in syscheck config", MERGED 2026-07-06, files: `src/config/syscheck-config.c`, `src/config/syscheck-config.h`, `src/syscheckd/src/config.c`. (A second linked PR #37190 is still OPEN.)
- Precondition: `scan_day`/`scan_time` set in agent's ossec.conf.
- Wrong value at HTTP API, 200 response, no error.
- Least-confident: whether #37412 alone fully resolves the issue given the still-open sibling PR #37190.

**9. LycheeOrg/Lychee** (4,234 stars — self-hosted photo-management server) — join-multiplicity duplicates
- Issue #4319 "Tag album photo listing returns duplicate entries for the same photo", author dafal, created 2026-04-25
- Symptom quote: "Some tag albums return duplicate rows for the same photo ID ... the number of repeats appears to correlate with how many other albums the photo belongs to"
- Closing PR #4328 "fix: deduplicate photos in tag album listings", MERGED 2026-04-30, files: `app/Relations/HasManyPhotosByTag.php`, `tests/Feature_v2/Album/AlbumPhotosEndpointTest.php`
- Precondition: tagged photos that also belong to multiple regular albums (one row per joined membership).
- Wrong value: API/UI listing shows the same photo N times; no error.
- Least-confident: user base size relative to your bar — stars qualify (4.2k) but it's the smallest project here.

# REJECTED after verification (auditable)
- qdrant #9523 (pagination duplicates): closed as duplicate of #3260 — inherent HNSW approximation, no fix PR.
- better-auth #7312 (wrong role at /list-users): closed, no linked/finable fix PR.
- PrestaShop #41613 (Countries count always 1): closed; PR search for the issue number returned only an unrelated functional-test PR.
- Umbraco-CMS #23230 (Children() wrong order): closed, no linked fix PR surfaced.
- kyverno #15353, drizzle-orm #5316: closed without fix PRs.
- openrouteservice #2282 (wrong matrix distance with avoid_features): good bug shape but 1,932 stars — below the 2k bar — and no linked PR.
- immich #28091 (birth dates one day earlier): excluded — substrate already used/killed in this program.

# Queries that yielded nothing usable
"wrong rounding" (all noise/tiny repos); "off by one" (no qualifying server hits); "wrong locale" (nothing >2k stars); "stale cache wrong" (nothing); "one day earlier" (only tiny/synthetic repos + excluded immich); "silently returns" (mostly claude-code/agent-tooling noise); repo-scoped PR search "69598" in StarRocks (empty — found fix via keyword search instead); repo-scoped PR searches "7312" in better-auth and "23500"-style lookups worked only for duckdb.
