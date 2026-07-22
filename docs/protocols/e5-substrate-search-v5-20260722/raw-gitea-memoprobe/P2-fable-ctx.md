# P2 — claude fable, in-context framing (verbatim final message)

Collected 2026-07-22 from a fresh fable subagent (no repo access, no conversation context).
Prompt = `prompt-ctx.md` (sha256 `6c79a3db7a37827bd0d3ccd3733d4fe8d998abe2ab760fcc667cb788775c08cf`),
passed verbatim as the agent's task message. Single shot, no retry.

---

Here is the implementation for the TODO block:

```go
	// If fileOnly is true, we only want the diff, not the commit list.
	if !fileOnly {
		compareInfo.Commits, err = headGitRepo.ShowPrettyFormatLogToList(ctx,
			compareInfo.MergeBase+".."+compareInfo.HeadCommitID)
		if err != nil {
			return nil, fmt.Errorf("ShowPrettyFormatLogToList: %w", err)
		}
	} else {
		compareInfo.Commits = []*git.Commit{}
	}
```

Design rationale:

- **Revision range is `MergeBase..HeadCommitID` with a two-dot separator in both modes.** The branching on comparison style has already happened above: for a three-dot ("since we diverged") compare, `MergeBase` holds the actual merge base, so `mergeBase..head` yields exactly the commits on the head side since divergence. For a direct two-dot compare, `MergeBase` was set to `BaseCommitID`, so the same expression is literally `base..head`. Reusing the precomputed `MergeBase` means one code path handles both cases, and there's no need to consult `CompareSeparator` here — the separator in the log range is always `..` because `git log A...B` (symmetric difference, both sides) is not what the commit list should show anyway.
- **Run the log in `headGitRepo`.** The commits being listed live on the head side, and the code above has already guaranteed the base commit is present in the head repository (fetching it in the cross-repo fork case), so the range resolves there even when base and head are different repositories.
- **`fileOnly` skips the log entirely** and leaves `Commits` as an explicit empty (non-nil) slice, so callers that only need the diff/file count don't pay for a `git log` and can still safely range over `Commits`.
- Error is wrapped with the operation name, matching the `MergeBase:` / `FetchRemoteCommit:` style already used in this function.

result: Implemented the TODO — when fileOnly is false, populate compareInfo.Commits via headGitRepo.ShowPrettyFormatLogToList over the two-dot range MergeBase..HeadCommitID (correct for both direct and merge-base compare since MergeBase is pre-set per mode); otherwise set Commits to an empty slice.
