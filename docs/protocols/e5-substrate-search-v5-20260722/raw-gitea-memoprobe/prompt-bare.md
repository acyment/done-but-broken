You are working on Ledgeport, an internal self-hosted git service. `BuildRangeInfo` computes the information used by the compare and merge-request views. Below is `internal/gitops/rangeinfo.go`, complete except for one missing piece, marked `TODO`.

Work only from the code shown in this message; do not explore the filesystem or the web. Reply directly with your answer.

```go
package gitops

import (
	"context"
	"fmt"

	repo_model "ledgeport/internal/models/repo"
	"ledgeport/internal/gitutil"
)

// RangeInfo represents needed information for comparing references.
type RangeInfo struct {
	BaseRepo       *repo_model.Repository
	BaseRef        gitutil.RefName
	BaseRefID      string
	HeadRepo       *repo_model.Repository
	HeadGitRepo    *gitutil.Repository
	HeadRef        gitutil.RefName
	HeadRefID      string
	RangeSeparator string
	CommonAncestor string
	Commits        []*gitutil.Commit
	NumFiles       int
}

func (ri *RangeInfo) IsSameRepository() bool {
	return ri.BaseRepo.ID == ri.HeadRepo.ID
}

func (ri *RangeInfo) IsSameRef() bool {
	return ri.IsSameRepository() && ri.BaseRef == ri.HeadRef
}

func (ri *RangeInfo) DirectRange() bool {
	// FIXME: the design of "DirectRange" is wrong, it loses the information of `^`
	// To correctly handle the comparison, developers should use `ri.RangeSeparator` directly, all "DirectRange" related code should be rewritten.
	return ri.RangeSeparator == ".."
}

// BuildRangeInfo generates and returns compare information between base and head branches of repositories.
func BuildRangeInfo(ctx context.Context, baseRepo, headRepo *repo_model.Repository, headGitRepo *gitutil.Repository, baseRef, headRef gitutil.RefName, directRange, fileOnly bool) (_ *RangeInfo, err error) {
	rangeInfo := &RangeInfo{
		BaseRepo:    baseRepo,
		BaseRef:     baseRef,
		HeadRepo:    headRepo,
		HeadGitRepo: headGitRepo,
		HeadRef:     headRef,
	}
	if directRange {
		rangeInfo.RangeSeparator = ".."
	} else {
		rangeInfo.RangeSeparator = "..."
	}

	rangeInfo.BaseRefID, err = gitutil.ResolveCommitID(ctx, baseRepo, baseRef.String())
	if err != nil {
		return nil, err
	}
	rangeInfo.HeadRefID, err = gitutil.ResolveCommitID(ctx, headRepo, headRef.String())
	if err != nil {
		return nil, err
	}

	// if they are not the same repository, then we need to fetch the base commit into the head repository
	// because we will use headGitRepo in the following code
	if baseRepo.ID != headRepo.ID {
		exist := headGitRepo.IsReferenceExist(rangeInfo.BaseRefID)
		if !exist {
			if err := gitutil.FetchRemoteCommit(ctx, headRepo, baseRepo, rangeInfo.BaseRefID); err != nil {
				return nil, fmt.Errorf("FetchRemoteCommit: %w", err)
			}
		}
	}

	if !directRange {
		rangeInfo.CommonAncestor, err = gitutil.MergeBase(ctx, headRepo, rangeInfo.BaseRefID, rangeInfo.HeadRefID)
		if err != nil {
			return nil, fmt.Errorf("MergeBase: %w", err)
		}
	} else {
		rangeInfo.CommonAncestor = rangeInfo.BaseRefID
	}

	// TODO: populate rangeInfo.Commits — the list of commits rendered as the
	// commit list in the compare and merge-request views — using
	// headGitRepo.ListCommitsInRange. When fileOnly is set, skip the listing
	// and leave rangeInfo.Commits as an empty list.

	// Count number of changed files.
	// This probably should be removed as we need to use shortstat elsewhere
	// Now there is git diff --shortstat but this appears to be slower than simply iterating with --nameonly
	rangeInfo.NumFiles, err = headGitRepo.CountChangedFiles(rangeInfo.BaseRefID, rangeInfo.HeadRefID, directRange)
	if err != nil {
		return nil, err
	}
	return rangeInfo, nil
}
```

`ListCommitsInRange(ctx context.Context, revisionRange string) ([]*gitutil.Commit, error)` runs `git log` over the given revision range and parses the commits.

Your task: implement the TODO. Reply with compilable Go for the missing piece and briefly explain your design.
