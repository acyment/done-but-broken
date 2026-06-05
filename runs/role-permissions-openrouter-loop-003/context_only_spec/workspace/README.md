# Role Permissions Calibration Workspace

Implement `canAccessProject` in `src/permissions.ts`.

Precedence for the completed task:

1. Suspended users are denied.
2. Cross-org access is denied by default.
3. Matching explicit deny rules are denied.
4. Valid temporary project grants may allow the requested action.
5. Same-org owners and admins may edit.
6. Same-org owners, admins, and viewers may read.
7. Otherwise access is denied.

Temporary grant times use ISO timestamp strings. A grant is valid only when
`grant.expiresAt` is after `policy.now`. Grants are action-specific: an edit
grant does not imply read unless a separate grant or another allow rule applies.

This calibration task uses the safer rule that ownership does not bypass the cross-org boundary.
