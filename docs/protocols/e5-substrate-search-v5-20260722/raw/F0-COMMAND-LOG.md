# Main-loop F0/F1–F4 verification log (2026-07-22)

Decisive command outputs, condensed verbatim. All via `gh` (curl to Apache JIRA is blocked
in this environment; Solr resolved via the apache/solr GitHub mirror instead).

## Solr reserve veins

```
gh search commits "SOLR-17649" --repo apache/solr
→ {"date":"2025-02-12T23:09:28+01:00","msg":"SOLR-17649: Fix JSON faceting on multiValued number types (#3158)","sha":"f66aa9ed07"}
gh search commits "SOLR-17221" --repo apache/solr
→ {"date":"2025-01-16T00:55:21-06:00","msg":"SOLR-17221: Fix Http2SolrClient merging case sensitive solr params (#3028)","sha":"82083ea13a"}
```
Both pre-window; 17221 additionally lands in the SolrJ client (F1). Bounded post-2026
"regression" PR sweep over apache/solr returned NPEs/perf/deps + #4279 (SOLR-18194,
nested-docs detection false positive) — PR body: "I actually ran into such a scenario
devising my own version of this check" → self-discovered, admin-endpoint refusal, killed.

## TimescaleDB reserve vein

```
Release 2.27.2 (2026-06-02) changelog → "#9902 Fix wrong results and crashes when grouping
by columns that are not in the SELECT list with vectorized aggregation or columnar index scan"
gh api pulls/9902 → 404 (release-note PR link does not resolve publicly)
gh search commits "9902" → 217fe4c159 2026-05-31 "Fix wrong grouping in VectorAgg and
ColumnarIndexScan" ... "GROUP BY a, b became GROUP BY b, b ... Fixes #9902"
gh api issues/9902 → PUBLIC issue, author akuzm (maintainer), created 2026-05-26, with repro
```

## pip back-burner

```
gh pr view 14131: "Verify content-range offset before resuming download", merged 2026-07-03,
  body describes silent corruption; closingIssuesReferences: [] — no user issue; searches
  ("resume corrupt", "content-range", "resume" >2026-01-01) return nothing relevant.
gh pr view 14084: merged 2026-06-20, "Fixes #14079".
gh issue view 14079 (2026-06-18, HNIdesu): "IncompleteRead exception crashes pip instantly"
  → loud crash, fails D2 silence.
```

## borg back-burner

```
gh pr view 9853: "create: do not wrap repository writes in backup_io(\"read\") (silent data
  loss on ENOSPC)", merged 2026-07-03, author ThomasWaldmann (lead maintainer);
  closingIssuesReferences: []; body: "Reproduced on a space-limited macOS ramdisk".
Issue searches (ENOSPC, "missing chunk" >2026-01-01): #9849 (maintainer's own, same day),
  #9825 (user dd'd over own device — unrelated self-inflicted corruption), #9281 (other).
→ No user-discovery fossil. Fix diff read: drops the outer backup_io("read") wrapper around
  process_file_chunks (mechanism confirmed; trap-library entry).
```

## gitea survivor

```
gh api commits/fafd1db1 → 2026-01-17 "Some refactors about GetMergeBase (#36186)"
Culprit hunk (services/git/compare.go): removes
      compareInfo.BaseCommitID = compareInfo.MergeBase
  while re-emitting
      Commits = ShowPrettyFormatLogToList(ctx, BaseCommitID+CompareSeparator+HeadCommitID)
  → range silently becomes basetip...head (symmetric difference).
gh pr diff 36485 (merged 2026-01-30, single file +5/−1):
  -  ... BaseCommitID+CompareSeparator+HeadCommitID)
  +  ... MergeBase+".."+HeadCommitID)   // with comment explaining "..." vs ".." semantics
gh api issues/36483 author_association → CONTRIBUTOR (outside community; filed 2026-01-29)
```

## paperless survivor

```
gh issue view 11868 (2026-01-23, juls, author_association NONE): root cause quoted —
  from_document() keys overrides by CustomFieldInstance.id; consumer filters
  CustomField.objects.filter(id__in=keys); "No errors logged - the bug silently fails to
  copy fields"; affects merge/split/edit_pdf/remove_password; fresh DBs coincide.
gh pr diff 11869 (merged 2026-01-23): one line, custom_field.id → custom_field.field.id
gh api commits?path=src/documents/data_models.py → substantive history 2023-01→2023-12
  (+ the 2026 fix) → culprit pre-window (latent shape).
gh api issues/10256 → "[BUG] Merge does not copy over custom fields", created 2025-06-24,
  closed — the earlier dismissed report; PRE-cutoff → memorization-probe target.
```

## CLI reserves — dating

```
curl: commits touching src/tool_writeout.c → "writeout: add %time{}" 2025-07-31 (culprit,
  pre-window); fix e0c6f4d4d6 2026-06-16 "tool_writeout: fix %time{} output for %s".
ripgrep: crates/ignore/src/dir.rs history → behavioral fix 43e2f08ede 2026-06-04 "ignore:
  fix parent gitignore matching across multiple roots"; 653d7f5bd1 2026-06-27 adds the
  regression tests and closes #3320/#3376. Culprit (parent-matcher caching) undated.
rclone: only commit mentioning NFKC is the fix c6cdb89935 (2026-06-15) — culprit intro not
  cheaply datable.
blocky: resolver/dnssec module has 14 commits, first 2025-11-07 "feat: add DNSSEC
  validation (#1914)" → original defect inside a pre-window feature.
restic: issue 5767 resolves (html_url .../issues/5767, created_at 2026-03-28) while the
  repo's newest issue number is 21977 — anomaly recorded, unexplained; closing PR 21797
  "backup: prevent exclude of backup targets" verified real and merged 2026-05-31.
paperless #10256: created 2025-06-24, closed (see above).
```
