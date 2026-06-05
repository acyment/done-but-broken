export type Action = "read" | "edit";

export type RoleAssignment = {
  role: "admin" | "viewer";
  orgId?: string;
  projectId?: string;
};

export type User = {
  id: string;
  orgId: string;
  suspended?: boolean;
  roles?: RoleAssignment[];
};

export type Project = {
  id: string;
  orgId: string;
  ownerId: string;
};

export type DenyRule = {
  userId: string;
  action: Action;
  projectId?: string;
  orgId?: string;
};

export type TemporaryProjectGrant = {
  userId: string;
  projectId: string;
  action: Action;
  expiresAt: string;
};

export type Policy = {
  denies?: DenyRule[];
  temporaryGrants?: TemporaryProjectGrant[];
  now?: string;
};

export function canAccessProject(input: {
  user: User;
  project: Project;
  action: Action;
  policy?: Policy;
}): boolean {
  const { user, project, action, policy } = input;

  // 1. Suspended users are denied.
  if (user.suspended) {
    return false;
  }

  // 2. Cross-org access is denied by default.
  if (user.orgId !== project.orgId) {
    return false;
  }

  // 3. Matching explicit deny rules are denied.
  if (policy?.denies) {
    for (const deny of policy.denies) {
      if (deny.userId !== user.id) continue;
      if (deny.action !== action) continue;
      if (deny.projectId && deny.projectId !== project.id) continue;
      if (deny.orgId && deny.orgId !== project.orgId) continue;
      return false;
    }
  }

  // 4. Valid temporary project grants may allow the requested action.
  if (policy?.temporaryGrants && policy.now) {
    for (const grant of policy.temporaryGrants) {
      if (grant.userId !== user.id) continue;
      if (grant.projectId !== project.id) continue;
      if (grant.action !== action) continue;
      if (grant.expiresAt > policy.now) {
        return true;
      }
    }
  }

  // 5. Same-org owners and org-level admins may edit.
  if (action === "edit") {
    if (user.id === project.ownerId) {
      return true;
    }
    // Admin role must be at org level (orgId set, no projectId)
    if (
      user.roles?.some(
        (r) =>
          r.role === "admin" &&
          r.orgId === project.orgId &&
          !r.projectId
      )
    ) {
      return true;
    }
    return false;
  }

  // 6. Same-org owners, org-level admins, and viewers (org or project level) may read.
  if (action === "read") {
    if (user.id === project.ownerId) {
      return true;
    }
    // Admin role at org level
    if (
      user.roles?.some(
        (r) =>
          r.role === "admin" &&
          r.orgId === project.orgId &&
          !r.projectId
      )
    ) {
      return true;
    }
    // Viewer role at org level (orgId set, no projectId) or project level (projectId set, no orgId)
    if (
      user.roles?.some(
        (r) =>
          r.role === "viewer" &&
          ((r.orgId === project.orgId && !r.projectId) ||
            (r.projectId === project.id && !r.orgId))
      )
    ) {
      return true;
    }
    return false;
  }

  // 7. Otherwise access is denied.
  return false;
}
