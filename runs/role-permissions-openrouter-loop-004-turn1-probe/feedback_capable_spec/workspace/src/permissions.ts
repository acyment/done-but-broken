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
  if (user.suspended) return false;

  // 2. Cross-org access is denied by default.
  if (user.orgId !== project.orgId) return false;

  // 3. Matching explicit deny rules are denied.
  if (policy?.denies) {
    for (const deny of policy.denies) {
      const userMatch = deny.userId === user.id;
      const actionMatch = deny.action === action;
      const projectMatch = !deny.projectId || deny.projectId === project.id;
      const orgMatch = !deny.orgId || deny.orgId === project.orgId;
      if (userMatch && actionMatch && projectMatch && orgMatch) {
        return false;
      }
    }
  }

  // 4. Valid temporary project grants may allow the requested action.
  if (policy?.temporaryGrants && policy?.now) {
    for (const grant of policy.temporaryGrants) {
      if (
        grant.userId === user.id &&
        grant.projectId === project.id &&
        grant.action === action &&
        grant.expiresAt > policy.now
      ) {
        return true;
      }
    }
  }

  // 5. Same-org owners and org-level admins may edit.
  if (action === 'edit') {
    if (user.id === project.ownerId) return true;
    if (user.roles?.some(role => 
      role.role === 'admin' && role.orgId === project.orgId
    )) return true;
  }

  // 6. Same-org owners, admins (any level), and viewers (any level) may read.
  if (action === 'read') {
    if (user.id === project.ownerId) return true;
    if (user.roles?.some(role => 
      (role.role === 'admin' || role.role === 'viewer') &&
      (role.orgId === project.orgId || role.projectId === project.id)
    )) return true;
  }

  // 7. Otherwise denied.
  return false;
}
