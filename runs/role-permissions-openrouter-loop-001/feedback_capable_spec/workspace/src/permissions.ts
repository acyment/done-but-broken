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
  if (user.suspended) return false;

  // 2. Cross-org access is denied by default.
  if (user.orgId !== project.orgId) return false;

  // 3. Matching explicit deny rules are denied.
  if (policy && policy.denies) {
    for (const rule of policy.denies) {
      if (rule.userId === user.id && rule.action === action) {
        if (rule.projectId && rule.projectId === project.id) return false;
        if (rule.orgId && rule.orgId === project.orgId) return false;
      }
    }
  }

  // 4. Same-org owners and admins may edit.
  if (action === 'edit') {
    if (user.id === project.ownerId) return true;
    if (user.roles && user.roles.some(r => r.role === 'admin' && (r.orgId === project.orgId || r.projectId === project.id))) return true;
    return false;
  }

  // 5. Same-org owners, admins, and viewers may read.
  if (action === 'read') {
    if (user.id === project.ownerId) return true;
    if (user.roles && user.roles.some(r => (r.role === 'admin' || r.role === 'viewer') && (r.orgId === project.orgId || r.projectId === project.id))) return true;
    return false;
  }

  // 6. Otherwise denied.
  return false;
}
