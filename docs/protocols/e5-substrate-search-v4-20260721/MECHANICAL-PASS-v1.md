# Substrate search v4 — mechanical fossil-hunt pass (v1)

Run by Claude Code 2026-07-21 with operator authorization, extending the v3 mechanical pass
under the v4 criteria (`docs/e5/SUBSTRATE-SEARCH-V4-PASTE-READY.md`, derived from
`E5-EPISODE-DESIGN-NOTE-v1.md`). Zero model spend — `gh search` / `gh pr view` only.

**v4 target:** the full conjunction — trap (post-2026 culprit+fix, silent, forced-touch) +
establishing item + filler items, all in one window, on a **practice-natural surface** (CLI,
HTTP server/client, service). The v3 pass found silent traps; this pass hunts *clusters* on
*natural surfaces*.

## Method

```
gh search prs --merged --repo <R> "regression" --created ">2026-01-01"   # 12 repos
gh search prs --merged --repo <R> "silently"   --created ">2026-01-01"   #  9 repos
  R ∈ {yt-dlp, pip, poetry, httpie, ansible, celery, uvicorn*, gunicorn, starlette*,
       click, aiohttp, streamlink, pytest, borg, pre-commit}   (*search API rejected)
+ gh pr view drill-downs on 10 candidates
```

## Ranked clusters

### 1. gunicorn HTTP-framing hardening campaign (May 2026) — best v4-conjunction fit found

- **Trap:** #3614 "address six WSGI/ASGI parser and protocol findings" (merged 2026-05-03
  18:12) introduced a keepalive smuggling gate that **never worked**: it read
  `self._body_receiver` after a `finally` block had already cleared it, so the gate always saw
  `None` and let keepalive proceed whether or not the body finished framing. Fixed ~1h later
  by #3618 (2026-05-03 19:15), which also adds the end-to-end test (pipelined partial-body
  POST + smuggled GET → second request must not be served). **Silence class: dead guard** — a
  security control that silently does nothing; nothing crashes, nothing fails, the server
  behaves normally. Culprit and fix both in-window. Forced touch: the gate lives in the shared
  connection-loop/framing path every item in the campaign edits.
- **Establishing items, and they are remarkable:** #3596 "codify rejection of
  relative-reference request-target (RFC 9112 §3.2)", #3599 "chunked size/extension edge
  cases (§7.1)", #3602 "Content-Length list form (§6.3)" — *test-codification PRs that turn
  RFC clauses into executable checks*. This is the real-world analogue of scenario authoring,
  performed by the project itself, in-window. The RFC is the spec; acceptance scenarios write
  themselves at intent level.
- **Fillers:** #3616 (drop body framing on HEAD/204/304 even when framework set it), #3619
  (parametrize smuggling regression across parsers).
- **Surface:** HTTP server wire behavior — request smuggling is the canonical *silent-by-
  nature* failure (two parsers disagreeing, no errors anywhere) and Given/When/Then over raw
  HTTP exchanges is idiomatic acceptance-testing territory.
- **Caveats:** (a) the culprit→fix gap is ~1 hour, so "shipped and nobody noticed" is weak —
  attractiveness is certified (a real maintainer wrote the dead gate) but suite-blindness had
  only an hour to prove itself; mitigated by #3614 itself being a *fix of six older latent
  parser findings*, i.e. more fossils inside the same cluster, unexamined. (b) gunicorn is
  team-maintained infrastructure — episode framing ("your team hardens its HTTP server
  against smuggling") is credible.

### 2. pip download-resume cluster (Jun–Jul 2026) — cleanest establishing-item story

- **Traps (two, both certified silent):** #14131 (2026-07-03) — resumed downloads wrote the
  206 body at the current file position without checking the server's `Content-Range`, so a
  server answering from a different offset **silently corrupts the downloaded file**; #14084
  (2026-06-20) — a mid-stream `ProtocolError` bypassed the resume logic entirely, so the
  resume feature **silently never ran** on the failure class it was built for (dead-path
  class).
- **Establishing item:** the incremental-download/resume feature itself (pre-2026 —
  admissible per clarifications A1; its intent-level scenarios — "an interrupted download,
  when resumed, yields byte-identical artifacts" / "a resume that cannot be verified restarts
  from scratch" — are exactly what would catch both traps).
- **Fillers:** #14115 (diagnostic connection errors), #14182 (redirect-URL credentials on
  401), #14170/#14172 (test-only).
- **Surface:** `pip` CLI — the most widely recognized tool in the audience's world; scenarios
  at pure intent level; observable via exit codes, file hashes, a mock index server.
- **Caveat:** the culprit for both traps is effectively the resume feature's original
  implementation (pre-2026). Fixes and issues are post-cutoff. See "A1 tension" below.

### 3. borgbackup ENOSPC silent data loss (Jul 2026) — highest-stakes single trap

- **Trap:** #9853 (2026-07-03) — `borg create` on a repository that runs out of space
  **silently commits a corrupt, unrestorable archive and exits 0** with a normal success
  summary ("Error files: 0"); only a later `borg check` reveals missing chunks. Cause:
  repository *writes* wrapped in `backup_io("read")`, so ENOSPC was treated as a per-file
  read hiccup. A backup tool reporting success for an unrestorable backup is the maximal-
  stakes instance of the silent class.
- **Cluster coherence:** the same window is dense with repository-layer work — #9846 (repack
  chunks index), #9892 (compact reclaim gate), #9838 (writethrough cache for packs/) — filler
  items in the same subsystem exist; establishing item = the repository error-handling
  contract (predates window; scenario: "when the backend cannot store data, create must fail
  loudly"). Needs the establishing-item check.
- **Surface:** CLI, intent-level scenarios trivial, and the audience story ("your backups
  said OK and were empty") is the strongest of any candidate.
- **Caveat:** culprit (the mis-wrapping) date unverified — likely pre-2026; same A1 tension.

### 4. aiohttp specimens (individually gold, weaker cluster coherence)

- #13180 (2026-07-20): cross-origin redirect strips credential headers with `.pop()`, which
  removes only the **first** entry — a request carrying duplicate `Authorization` headers
  **silently leaks the surviving credential to the redirect target**. Textbook scenario:
  "credentials must never follow a cross-origin redirect."
- #12674 (2026-05-31): `ZLibDecompressor` ignored `unused_data`, so every gzip member after
  the first was **silently dropped** — truncated response bodies, no error (nginx produces
  multi-member gzip under real configs).
- #12332: "Silent Exception Swallowing in Server Request Handler Factory" — title says it.
- These are three different subsystems (client redirects, decompression, C parser) — traps
  without a shared-window cluster; hold as spares or single-trap episodes.

### Demoted, recorded to show the screen works

- **celery #10242**: the fix for a connection-recovery issue caused a graceful-shutdown
  regression — but the body states it was caught by a *smoke test failing across all Python
  versions*. Suite-caught ⇒ loud ⇒ fails the silence bar. The screen's discrimination is
  doing its job; not every "regression" fossil is a silent one.

## A1 tension surfaced by this pass (operator decision needed)

The clarifications (A1) require culprit AND fix post-January-2026, aimed at regression-pair
fossils. This pass's best traps split into two shapes: **regression pairs** (gunicorn: both
in-window ✓) and **latent-bug fossils** (pip, borg, aiohttp: the fix and its issue are
post-cutoff, but the culprit code is older). For latent fossils the memorization-critical
artifact is the *fix/issue* (the document that reveals the mistake) — the culprit being in
training data means the model has seen the buggy code, not that it knows it is buggy.
Proposed refinement, NOT yet adopted: for latent-bug fossils, require fix+issue post-cutoff,
allow older culprits, and add a memorization probe on the fix. Strict A1 as written would
exclude clusters 2–4. Flagged, not decided.

## Supply verdict under v4

The full v4 conjunction is **findable but not abundant**: one afternoon produced one complete
in-window conjunction (gunicorn), one near-complete with a pre-window establishing item
(pip), one high-stakes trap with plausible cluster (borg), and three loose gold traps
(aiohttp). Concentration: exactly where D5 predicted — HTTP servers/clients (wire framing,
redirects, decompression: silent-by-nature) and CLIs whose contract is "exit code + artifact
integrity" (pip, borg). The practice-naturalness premium costs little: the natural-surface
repos turned out to be *richer* in silent fossils than the library sweep, because wire
protocols and file formats fail silently by construction.

## Recommended next steps (zero model spend, each needs operator go)

1. Local verification of the gunicorn trap (state reconstruction + knockout of the gate fix;
   loudness record) — the one complete conjunction.
2. Establishing-item checks: gunicorn RFC-codification PRs (do their tests' assertions cover
   the smuggling gate's blast radius?); pip resume feature (date, scope, scenario sketch).
3. Operator ruling on the A1 latent-fossil refinement.
4. Feed all four clusters to the two remaining scout sessions as *unnamed* territory — the
   prompt already withholds our candidates; if a scout independently surfaces gunicorn or
   pip, that is convergence worth recording.
