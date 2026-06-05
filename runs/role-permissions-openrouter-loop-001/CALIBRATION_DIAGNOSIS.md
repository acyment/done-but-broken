# Calibration Diagnosis: role-permissions-openrouter-loop-001

## Summary

The run is valid and replay-clean, but the feedback-capable arm had transient hidden failures at `I03` and `I04` before recovering at `I05`. The anomaly is best explained as weak visible feedback coverage for `viewer-read-only`, not as hidden-oracle strictness or misleading feedback summaries.

Both failures were the same hidden case:

| Checkpoint | Failed hidden check | Commitment | Classification |
| --- | --- | --- | --- |
| `I03` | `role-permissions-calibration:I03:viewer-read-only` | `viewer-read-only` | Current-checkpoint target failure |
| `I04` | `role-permissions-calibration:I04:viewer-read-only` | `viewer-read-only` | Carried-forward unresolved target failure, not a regression from prior success |

Hidden details named the failing case as `viewer-read-only:hidden-project-viewer-can-read`.

## Visible Feedback Status

Visible feedback passed at both anomalous checkpoints:

| Checkpoint | Feedback exit code | Visible feedback result |
| --- | ---: | --- |
| `I03` | `0` | `6 pass / 0 fail` |
| `I04` | `0` | `8 pass / 0 fail` |

The visible `viewer-read-only` feedback pack tested:

- org-scoped viewer can read
- org-scoped viewer cannot edit

The hidden failure tested:

- project-scoped viewer can read, using a role with `projectId` and no `orgId`

The visible semantic spec did mention "project or organization" viewer roles, but the executable feedback pack did not include a project-scoped viewer read case. Therefore the feedback-capable arm received passing executable feedback while still missing hidden target behavior.

## Code Behavior

Historical full file contents are not stored per checkpoint, so this diagnosis uses workspace hashes, agent transcripts, final code, and oracle results.

`feedback_capable_spec` `src/permissions.ts` hashes:

| Checkpoint | Hash |
| --- | --- |
| `I01` | `218ac3143d0f92a7641a502687236f5c7f78085b3872f5d3c04b833bdfa6da84` |
| `I02` | `bac7cb39fc51190894712f57eeb26c8dd522ec0edebac64e10760e8e3b980ded` |
| `I03` | `bac7cb39fc51190894712f57eeb26c8dd522ec0edebac64e10760e8e3b980ded` |
| `I04` | `bac7cb39fc51190894712f57eeb26c8dd522ec0edebac64e10760e8e3b980ded` |
| `I05` | `9cafd522ba540e6bdcdf346f43cde4681e752695d479c5c5a7a23f69af49d079` |
| `I06` | `9cafd522ba540e6bdcdf346f43cde4681e752695d479c5c5a7a23f69af49d079` |

The `I03` and `I04` implementation was identical to `I02` by hash. It passed visible feedback but did not satisfy project-scoped viewer read. This looks less like a destructive regression and more like underimplementation of the newly active viewer behavior. At `I04`, the same hidden failure persisted while the new suspension hidden cases passed.

At `I05`, the source hash changed and the model transcript said it "added project-level role support." Hidden `viewer-read-only` then passed at `I05` and `I06`. The final code allows admin/viewer roles when either `r.orgId === project.orgId` or `r.projectId === project.id`, which covers the hidden project-viewer case.

## Issue Classification

Primary classification: feedback assets too weak.

Why:

- Hidden failure was target behavior from the visible spec, not unrelated drift.
- Visible feedback passed at `I03` and `I04`.
- The missing case was a project-scoped viewer read case absent from the executable feedback pack.
- Hidden oracle was not stricter than the visible semantic spec; it exercised the "project or organization" clause.
- Feedback summaries were not misleading; they accurately reported all visible feedback passing.
- The turn budget was generous enough for recovery by `I05`, but it did not cause the anomaly.
- The task may still be easy at final checkpoint, but this specific anomaly points to feedback coverage.

## Recommendation

Improve feedback assets.

The next calibration action should be to add a visible executable feedback case for project-scoped viewer read behavior, then rerun calibration later. Do not change the hidden oracle for this anomaly.

## Follow-up Applied

The visible `viewer-read-only` feedback asset now includes a project-scoped viewer read case. This was added because the previous real run showed visible feedback passing while the hidden oracle failed `viewer-read-only:hidden-project-viewer-can-read`, proving feedback coverage was incomplete for behavior already present in the semantic spec.
