# P1 — claude fable, bare framing (verbatim final message)

Collected 2026-07-22 from a fresh fable subagent (no repo access, no conversation context).
Prompt = `prompt-bare.md` (sha256 `c1b7137a7c3d06751402fbea63d0d3eb93daa6172db7c72c91345549da3fdcd7`),
passed verbatim as the agent's task message. Single shot, no retry.

---

Here is the implementation for the TODO block:

```go
	// Populate the commit list for the compare / merge-request views.
	if fileOnly {
		rangeInfo.Commits = []*gitutil.Commit{}
	} else {
		revisionRange := rangeInfo.CommonAncestor + ".." + rangeInfo.HeadRefID
		rangeInfo.Commits, err = headGitRepo.ListCommitsInRange(ctx, revisionRange)
		if err != nil {
			return nil, fmt.Errorf("ListCommitsInRange: %w", err)
		}
	}
```

Design notes:

- **Range anchored at `CommonAncestor`, always with `..`.** The commit list a compare/merge-request view wants is "commits on the head side that are not on the base side." Using the already-computed `CommonAncestor` handles both modes uniformly:
  - In three-dot mode, `CommonAncestor` is the merge base, so `mergeBase..head` yields exactly the head-side commits. Passing `base...head` to `git log` instead would be wrong — symmetric-difference log includes base-side commits too, which is not what the view renders.
  - In direct (two-dot) mode, the function has already set `CommonAncestor = BaseRefID`, so the same expression degrades to `base..head`, which is precisely the direct-range semantics.
- **Resolved IDs, not ref names.** I build the range from `CommonAncestor`/`HeadRefID` rather than the raw refs, since for cross-repository compares only the resolved base commit ID is guaranteed to exist in `headGitRepo` (it was fetched by ID a few lines earlier; the base ref name is not present there).
- **`fileOnly` short-circuit as an empty slice, not nil.** The TODO asks for "an empty list" — an explicit `[]*gitutil.Commit{}` keeps callers (and JSON serialization) seeing `[]` rather than `null`, and makes the skip intentional rather than an accidental zero value.
- **Error wrapping** follows the file's existing convention (`fmt.Errorf("FetchRemoteCommit: %w", err)`, `"MergeBase: %w"`), so failures name the operation.

Sanity check: the snippet only uses identifiers already in scope (`ctx`, `fileOnly`, `rangeInfo`, `headGitRepo`, `fmt`), matches the given `ListCommitsInRange(ctx, string) ([]*gitutil.Commit, error)` signature, and slots between the `CommonAncestor` computation and the `CountChangedFiles` call, so it compiles in context.

result: Implemented the TODO — lists commits over `CommonAncestor..HeadRefID` (correct for both two-dot and three-dot compares, safe cross-repo) and leaves an explicit empty slice when fileOnly is set.
