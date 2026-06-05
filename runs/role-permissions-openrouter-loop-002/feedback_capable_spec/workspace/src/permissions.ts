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
    for (const deny of policy.denies) {
      if (
        deny.userId === user.id &&
        deny.action === action &&
        (deny.projectId === undefined || deny.projectId === project.id) &&
        (deny.orgId === undefined || deny.orgId === project.orgId)
      ) {
        return false;
      }
    }
  }

  // 4. Same-org owners and admins may edit.
  if (action === "edit") {
    if (user.id === project.ownerId) {
      return true;
    }
    // Admin must be org-level only.
    const isAdmin = user.roles?.some(
      (role) =>
        role.role === "admin" &&
        role.orgId === project.orgId &&
        role.projectId === undefined
    );
    if (isAdmin) {
      return true;
    }
    return false;
  }

  // 5. Same-org owners, admins, and viewers may read.
  if (action === "read") {
    if (user.id === project.ownerId) {
      return true;
    }
    const hasRole = user.roles?.some(
      (role) =>
        (role.role === "admin" &&
          role.orgId === project.orgId &&
          role.projectId === undefined) ||
        (role.role === "viewer" &&
          ((role.orgId !== undefined && role.orgId === project.orgId) ||
            (role.projectId !== undefined && role.projectId === project.id)))
    );
    if (hasRole) {
      return true;
    }
    return false;
  }

  // 6. Otherwise access is denied.
  return false;
}
