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

function hasRole(user: User, project: Project, action: Action): boolean {
  if (!user.roles) return false;
  for (const assignment of user.roles) {
    // Role must match the action: admin for both, viewer only for read.
    const roleMatches =
      (action === "edit" && assignment.role === "admin") ||
      (action === "read" && (assignment.role === "admin" || assignment.role === "viewer"));
    if (!roleMatches) continue;

    // Scope: if orgId specified, must match user's orgId; if projectId specified, must match project's id.
    const orgMatch = assignment.orgId === undefined || assignment.orgId === user.orgId;
    const projectMatch = assignment.projectId === undefined || assignment.projectId === project.id;
    if (orgMatch && projectMatch) return true;
  }
  return false;
}

export function canAccessProject(input: {
  user: User;
  project: Project;
  action: Action;
  policy?: Policy;
}): boolean {
  const { user, project, action, policy } = input;

  // 1. Suspended users are denied.
  if (user.suspended) return false;

  // 2. Cross-org access is denied by default.
  if (user.orgId !== project.orgId) return false;

  // 3. Matching explicit deny rules are denied.
  if (policy?.denies) {
    for (const deny of policy.denies) {
      if (
        deny.userId === user.id &&
        deny.action === action &&
        (deny.projectId === undefined || deny.projectId === project.id) &&
        (deny.orgId === undefined || deny.orgId === user.orgId)
      ) {
        return false;
      }
    }
  }

  // 4. Valid temporary project grants may allow the requested action.
  if (policy?.temporaryGrants && policy.now) {
    const now = new Date(policy.now).getTime();
    for (const grant of policy.temporaryGrants) {
      if (
        grant.userId === user.id &&
        grant.projectId === project.id &&
        grant.action === action &&
        new Date(grant.expiresAt).getTime() > now
      ) {
        return true;
      }
    }
  }

  // 5. Same-org owners and admins may edit.
  if (action === "edit") {
    if (user.id === project.ownerId) return true;
    if (hasRole(user, project, "edit")) return true;
    return false;
  }

  // 6. Same-org owners, admins, and viewers may read.
  if (action === "read") {
    if (user.id === project.ownerId) return true;
    if (hasRole(user, project, "read")) return true;
    return false;
  }

  // 7. Otherwise access is denied.
  return false;
}
