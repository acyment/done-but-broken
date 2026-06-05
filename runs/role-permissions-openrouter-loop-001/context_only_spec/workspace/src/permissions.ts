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

export type Policy = {
  denies?: DenyRule[];
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
    for (const rule of policy.denies) {
      if (rule.userId === user.id && rule.action === action) {
        // If rule specifies projectId, it must match; if not, rule applies to all projects in org.
        if (rule.projectId !== undefined && rule.projectId !== project.id) {
          continue;
        }
        // If rule specifies orgId, it must match; if not, rule applies to all orgs.
        if (rule.orgId !== undefined && rule.orgId !== project.orgId) {
          continue;
        }
        return false;
      }
    }
  }

  // Determine if user is owner
  const isOwner = user.id === project.ownerId;

  // Determine if user has a role assignment that applies to this project or org
  const hasAdminRole = user.roles?.some(
    (r) =>
      r.role === "admin" &&
      (r.projectId === project.id ||
        (r.orgId === project.orgId && !r.projectId))
  );
  const hasViewerRole = user.roles?.some(
    (r) =>
      r.role === "viewer" &&
      (r.projectId === project.id ||
        (r.orgId === project.orgId && !r.projectId))
  );

  // 4. Same-org owners and admins may edit (SPEC-001 & SPEC-002).
  if (action === "edit") {
    if (isOwner || hasAdminRole) {
      return true;
    }
    return false;
  }

  // 5. Same-org owners, admins, and viewers may read.
  if (action === "read") {
    if (isOwner || hasAdminRole || hasViewerRole) {
      return true;
    }
    return false;
  }

  // 6. Otherwise access is denied.
  return false;
}
