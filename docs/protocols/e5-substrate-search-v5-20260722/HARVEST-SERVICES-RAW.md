# Harvest raw report — self-hosted services scout (subagent, 2026-07-22)

Provenance: claude-family subagent spawned by the main loop for breadth only; instructed to
report only facts observed in `gh` output. **Zero inherited credibility** — every fact used
in a verdict was re-resolved in the main loop (see `COMPARISON-v1.md` §2). Verbatim output
below.

---

## CANDIDATES (all facts observed in gh output this session)

**C1. navidrome/navidrome — issue #5158**
- Issue: #5158 "[Bug]: startScan response returns incorrect scanType when fullScan=true" | author Yamb-io | created 2026-03-09
- Symptom quote: "Call GET /rest/startScan?fullScan=true ... Observe the scanStatus.scanType field ... Expected: scanType: 'full' Actual: scanType: 'quick'"
- Closing PR: #5159 "fix(server): return correct scanType in startScan response" | merged 2026-03-09 | files: server/subsonic/library_scanning.go, server/subsonic/library_scanning_test.go, tests/mock_scanner.go
- Precondition: fullScan=true query param on the Subsonic startScan endpoint
- Silence: response body shows `"status": "ok"` with the wrong field (quoted JSON in issue); "Only the scanType field in the API response is incorrect"
- Server-side because: fix files under server/subsonic/; regression test added
- Least confident: whether a request parameter (vs config/env) satisfies the "precondition" bar

**C2. jellyfin/jellyfin — issue #16454**
- Issue: #16454 "`/Items` endpoint with collection as `parentId` & `includeItemType=BoxSet` returns incorrect data" | author damontecres | created 2026-03-23
- Symptom quote: "returns library `CollectionFolder`s instead of `BoxSet`s" (200 response, wrong list)
- Closing PR: #16490 "Fix BoxSet parentId being ignored in item queries" | merged 2026-04-05 | files: Jellyfin.Api/Controllers/ItemsController.cs
- Precondition: parentId = a collection AND includeItemTypes=BoxSet together; works fine without includeItemType or with other types
- Silence: no error mentioned anywhere; endpoint returns a plausible-looking wrong list
- Server-side because: sole file is an API controller in the server repo
- Least confident: no regression test in the fix (single file); I did not read PR body to confirm intent beyond title

**C3. jellyfin/jellyfin — issue #16248**
- Issue: #16248 "Bitrate is incorrectly reported to frontend for video files." | author Renari | created 2026-02-17
- Symptom quote: "this reports the overall bitrate, not the video bitrate ... the video bitrate shown is actually the overall bitrate in mediainfo"
- Closing PR: #17170 "Rework bitrate reporting" | merged 2026-06-29 | files: MediaBrowser.MediaEncoding/Probing/ProbeResultNormalizer.cs + ProbeResultNormalizerTests.cs + 3 test-data JSON fixtures
- Precondition: data shape — video stream lacks per-stream bitrate in ffprobe output so format-level bitrate is substituted (issue quotes the guilty code block)
- Silence: "The frontend shows a misleading video bitrate" — no error, just wrong number
- Server-side because: fix is in server media-probing normalizer + server test project; regression tests with fixtures added
- Least confident: that the wrong number crosses the public HTTP surface (I inferred MediaStreams in API responses come from ProbeResultNormalizer; not directly verified)

**C4. paperless-ngx/paperless-ngx — issue #11868**
- Issue: #11868 "[BUG] Custom fields intermittently lost in merge/split/edit operations" | author juls | created 2026-01-23
- Symptom quote: "I'd expect the new document to have a custom field with the value 'INV-002', but actually, the custom field is missing." Root cause quoted in issue: uses `CustomFieldInstance.id` instead of `CustomField.id`
- Closing PR: #11869 "Fix: use correct field id for overrides" | merged 2026-01-23 | files: src/documents/data_models.py
- Precondition: data shape — instance IDs diverged from field IDs ("On a new database, both IDs start at 1 and increment together, so they coincidentally match")
- Silence: "No errors logged - the bug silently fails to copy fields" (verbatim from issue's webserver-logs section)
- Server-side because: fix in src/documents/ Django backend; issue labeled bug+backend
- Least confident: PR file list shows no test file — regression test likely absent

**C5. paperless-ngx/paperless-ngx — issue #11881**
- Issue: #11881 "[BUG] Discrepancy between 'Current year' and 'Current month'" | author jscholtysik | created 2026-01-25
- Symptom quote: "The document appears in the overview under 'Current month' (January 1, 2026 - now), but not under 'Current year'" (badge counts differ for a doc dated one day in the future)
- Closing PR: #11884 "Fixhancement: change date calculation for 'this year' to include future documents" | merged 2026-01-26 | files: src/documents/index.py
- Precondition: document issue date set in the future relative to today
- Silence: "No webserver log" (issue logs section); views just show inconsistent counts
- Server-side because: fix in src/documents/index.py (backend search index); issue labeled bug+backend
- Least confident: "Fixhancement" title suggests maintainers saw it partly as a spec choice, not purely a wrong value; no test in PR file list

**C6. FreshRSS/FreshRSS — issue #8531**
- Issue: #8531 "[Bug] User Queries in 'mark as read' filters incorrectly split on spaces" | author mtalexan | created 2026-02-25
- Symptom quote: "turning it into: `\"Visit'\" search:\"Meet\"` ... I'm seeing the filtering get applied based on this improperly split User Query pattern as well, so this isn't just visual."
- Closing PR: #8543 "Fix user query parsing" | merged 2026-03-01 | files: app/Models/BooleanSearch.php, app/Models/Search.php, tests/app/Models/SearchTest.php
- Precondition: user query name containing spaces used inside a quoted `search:'...'` term in per-feed mark-as-read filters
- Silence: save succeeds, filter round-trips mangled and is silently applied wrong; no error reported
- Server-side because: fix entirely in app/Models PHP server code; regression test added
- Least confident: whether the wrong value is best characterized as public-HTTP-surface output (settings page + filter effects) vs internal config parsing

**C7. go-gitea/gitea — issue #36483**
- Issue: #36483 "Regression: PR commits list includes unrelated commits after fafd1db1" | author tyroneyeh | created 2026-01-29
- Symptom quote: "The PR branch history itself is correct ... but the Gitea UI incorrectly shows extra commits in Pull request → Commits"
- Closing PR: #36485 "Fix bug when list pull request commits" | merged 2026-01-30 | files: services/git/compare.go
- Precondition: another independent PR merged into the target branch after the PR branch was created (repro steps 1-4 in issue)
- Silence: page renders normally with extra commits; git log clean — no error anywhere
- Server-side because: sole fix file is services/git/compare.go (server git service layer)
- Least confident: precondition is a regression window on main (first bad commit fafd1db1), not a stable-release config flag; no test in the PR file list

**C8. go-gitea/gitea — issue #36474**
- Issue: #36474 "Incorrect branch reference name in the mirror repository activity log" | author imkuang | created 2026-01-28
- Symptom quote: "The branch should correspond to `refs/heads/test` rather than `refs/tags/test`" (deleted-branch event logged as a tag)
- Closing PR: #36504 "Fix mirror sync parser and fix mirror messages" | merged 2026-02-11 | files: cmd/admin.go, modules/repository/branch.go, modules/repository/repo.go, routers/web/feed/convert.go, services/migrations/gitea_uploader.go, services/mirror/mirror_pull.go, services/mirror/mirror_pull_test.go, services/repository/{adopt,fork,migrate}.go, templates/user/dashboard/feeds.tmpl
- Precondition: repo is a pull-mirror AND a branch was deleted on the remote before sync
- Silence: sync succeeds; activity feed just displays the wrong ref type ("the name clearly contains an error"), reproducible on demo.gitea.com
- Server-side because: core fix in services/mirror/mirror_pull.go with mirror_pull_test.go regression test; one template touched but the parser fix is server code
- Least confident: fix PR is broad ("fix mirror sync parser and fix mirror messages") — screener should confirm which hunk maps to this issue

**C9. immich-app/immich — issue #28091**
- Issue: #28091 "Birth dates keep being changed to one day earlier" | author toreador34 | created 2026-04-26 | platform checkbox: Server (Web/Mobile unchecked)
- Symptom quote: "I keep seeing that the date I entered keeps changing to one day earlier. I correct it, and the same thing happens again."
- Closing PR: #28810 "fix(server): respect timezone in iso date string encoding" | merged 2026-06-03 | files: server/src/dtos/{album,asset-response,exif,person,tag,user}.dto.ts, server/src/services/album.service.ts, server/src/utils/date.ts, server/src/utils/date.spec.ts, server/src/validation.ts
- Precondition: server timezone-dependent date-to-ISO-string encoding (per PR title); fires on round-tripping a date-only field
- Silence: save succeeds each time; value silently shifts by one day
- Server-side because: every fix file is under server/src/; date.spec.ts regression test included
- Least confident: exact precondition (server TZ west of UTC) inferred from PR title, not from reading the diff. Note: operator memory says Immich timestamp surfaces were killed as a substrate for a different reason — screener may want to weigh that.

**C10 (flagged, maintainer-filed). go-gitea/gitea — issue #36905**
- Issue: #36905 "Incorrect commit count in timeline after force-push" | author silverwind (Gitea maintainer — fails "user-filed" strictly) | created 2026-03-15
- Symptom quote: "UI should show the 2 commits that exist on the branch but only shows 1"
- Closing PR: #36914 "Fix the wrong push commits in the pull request when force push" | merged 2026-04-04 | files: models/issues/comment.go, modules/git/object_id_test.go, modules/git/repo_commit.go, modules/gitrepo/compare.go, modules/gitrepo/compare_test.go, services/agit/agit.go, services/pull/comment.go, services/pull/comment_test.go, services/pull/pull.go
- Precondition: amend + force-push after a prior push on a PR branch
- Silence: timeline renders with wrong commit list, header count already correct
- Server-side: all fix files server-side, 3 test files added/updated
- Least confident: author is a maintainer, so "user-filed" criterion fails; include only if screener relaxes that

## SWEPT, NOTHING REPORTABLE
- grafana/grafana: "returns wrong" 0 hits; "incorrect value" 1 hit (frontend/UX alerting) — nothing server-side qualifying
- prometheus/prometheus: #18087 (native-histogram wrong results) promising but no closing-PR reference observable; only pre-2026 refactor PRs found for the function — dropped
- miniflux/v2: #4044 (reverse-proxy client IP always localhost) fits symptom but has no closing-PR reference; other hits are feed/docs noise — dropped
- mealie-recipes/mealie: hits are crashes, 405s, docs, UI — nothing qualifying
- wallabag/wallabag: all "Wrong display" issues are Site Config (extraction rules), not server code fixes — nothing
- photoprism/photoprism: hits are CLI crash, upgrades, infra — nothing qualifying
- home-assistant/core: all hits are third-party device/integration state issues, many stale-closed — nothing clean
- forgejo/forgejo: not swept (hosted on Codeberg, out of gh reach per instructions)
- Dropped for no closing-PR reference: navidrome #4907, #5293, #5371; jellyfin #16521
- Dropped for merge date before cutoff: freshrss #8452 (closing PR #8357 merged 2025-12-27)
- Dropped as not clearly public-surface: freshrss #8643 (lastSeen observed in DB, fix PR #8646 merged 2026-04-02)
