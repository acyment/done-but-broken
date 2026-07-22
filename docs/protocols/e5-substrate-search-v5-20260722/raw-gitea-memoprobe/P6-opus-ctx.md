# P6 — claude opus, in-context framing (verbatim final message) — NON-LOAD-BEARING ROW

Collected 2026-07-22 from a fresh opus subagent (no repo access, no conversation context).
Prompt = `prompt-ctx.md` (sha256 `6c79a3db7a37827bd0d3ccd3733d4fe8d998abe2ab760fcc667cb788775c08cf`),
passed verbatim as the agent's task message. Single shot, no retry. HTML entity escaping
(`&lt;` etc.) from the harness transport has been decoded; text otherwise untouched.

---

Here's my implementation of the TODO:

```go
	// Populate the commit list shown in the compare and pull-request views.
	// When only file information is requested, skip the (potentially expensive)
	// log walk and leave an empty, non-nil slice.
	if fileOnly {
		compareInfo.Commits = []*git.Commit{}
	} else {
		compareInfo.Commits, err = headGitRepo.ShowPrettyFormatLogToList(ctx,
			compareInfo.BaseCommitID+compareInfo.CompareSeparator+compareInfo.HeadCommitID)
		if err != nil {
			return nil, err
		}
	}
```

Design notes:

- **Revision range.** `ShowPrettyFormatLogToList` runs `git log` over a revision range, so I construct the range as `<base><sep><head>`. I reuse the already-computed `compareInfo.BaseCommitID` / `compareInfo.HeadCommitID` (full SHAs) rather than the raw refs — they're resolved once at the top and the base commit has been fetched into `headGitRepo` when the repos differ, which is exactly the repo this call runs against.

- **Separator comes from `CompareSeparator`, not the `directComparison` bool.** The struct already holds `".."` vs `"..."` (set via `util.Iif` at construction). Using it directly gives the correct git semantics for free: `base..head` (commits reachable from head but not base) for a direct comparison, and `base...head` (symmetric-difference range from the merge base) for the default three-dot compare. It also aligns with the `DirectComparison` FIXME, which explicitly advises consuming `CompareSeparator` directly instead of re-deriving from a boolean.

- **`fileOnly` short-circuit.** When set, the caller only wants `NumFiles`, so I skip the log walk entirely and assign an explicit empty slice. I assign `[]*git.Commit{}` (non-nil) to honor the "empty list" wording and to keep templates/JSON that range over `Commits` safe, rather than leaving it `nil`.

- **Placement.** It sits before the `GetDiffNumChangedFiles` count so the existing error-return flow is preserved, and it uses the shared named `err` return consistent with the rest of the function.

result: Implemented the `compareInfo.Commits` TODO in `services/git/compare.go` — calls `ShowPrettyFormatLogToList` over `BaseCommitID + CompareSeparator + HeadCommitID`, short-circuiting to an empty non-nil slice when `fileOnly` is set.
