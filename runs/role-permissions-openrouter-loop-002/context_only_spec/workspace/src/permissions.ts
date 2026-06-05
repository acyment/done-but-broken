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
  // 1. Suspended users are denied.
  if (input.user.suspended) {
    return false;
  }

  // 2. Cross-org access is denied by default.
  if (input.user.orgId !== input.project.orgId) {
    return false;
  }

  // 3. Matching explicit deny rules are denied.
  if (input.policy?.denies) {
    for (const rule of input.policy.denies) {
      if (rule.userId === input.user.id && rule.action === input.action) {
        // Apply if scoping matches or rule is unscoped
        if (!rule.projectId && !rule.orgId) {
          return false;
        }
        if (rule.projectId && rule.projectId === input.project.id) {
          return false;
        }
        if (rule.orgId && rule.orgId === input.project.orgId) {
          return false;
        }
      }
    }
  }

  // 4. Same-org owners and admins may edit.
  if (input.action === "edit") {
    if (input.user.id === input.project.ownerId) {
      return true;
    }
    // Only org-level admin roles grant edit
    if (
      input.user.roles?.some(
        (r) =>
          r.role === "admin" &&
          r.orgId === input.project.orgId &&
          !r.projectId
      )
    ) {
      return true;
    }
    return false;
  }

  // 5. Same-org owners, admins, and viewers may read.
  if (input.action === "read") {
    if (input.user.id === input.project.ownerId) {
      return true;
    }
    if (
      input.user.roles?.some((r) => {
        // Org-level admin (already covers read)
        if (
          r.role === "admin" &&
          r.orgId === input.project.orgId &&
          !r.projectId
        ) {
          return true;
        }
        // Org-level viewer
        if (
          r.role === "viewer" &&
          r.orgId === input.project.orgId &&
          !r.projectId
        ) {
          return true;
        }
        // Project-level viewer
        if (
          r.role === "viewer" &&
          r.projectId === input.project.id &&
          !r.orgId
        ) {
          return true;
        }
        return false;
      })
    ) {
      return true;
    }
    return false;
  }

  // 6. Otherwise access is denied.
  return false;
}
