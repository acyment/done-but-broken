# Role Permissions Calibration Workspace

Implement `canAccessProject` in `src/permissions.ts`.

Precedence for the completed task:

1. Suspended users are denied.
2. Cross-org access is denied by default.
3. Matching explicit deny rules are denied.
4. Same-org owners and admins may edit.
5. Same-org owners, admins, and viewers may read.
6. Otherwise access is denied.

This calibration task uses the safer rule that ownership does not bypass the cross-org boundary.
