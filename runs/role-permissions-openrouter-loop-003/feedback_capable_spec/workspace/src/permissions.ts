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
      if (deny.userId !== user.id) continue;
      if (deny.action !== action) continue;
      const matchesProject = !deny.projectId || deny.projectId === project.id;
      const matchesOrg = !deny.orgId || deny.orgId === project.orgId;
      if (matchesProject && matchesOrg) return false;
    }
  }

  // 4. Valid temporary project grants may allow the requested action.
  if (policy?.temporaryGrants) {
    const now = policy.now ? new Date(policy.now).getTime() : Date.now();
    for (const grant of policy.temporaryGrants) {
      if (grant.userId !== user.id) continue;
      if (grant.projectId !== project.id) continue;
      if (grant.action !== action) continue;
      const expires = new Date(grant.expiresAt).getTime();
      if (expires > now) return true;
    }
  }

  // 5. Same-org owners and admins may edit.
  // 6. Same-org owners, admins, and viewers may read.
  if (user.id === project.ownerId) return true;

  const roles = user.roles || [];

  const isAdmin = roles.some(r => {
    if (r.role !== "admin") return false;
    if (r.orgId && r.orgId !== project.orgId) return false;
    if (r.projectId && r.projectId !== project.id) return false;
    return true;
  });

  const isViewer = roles.some(r => {
    if (r.role !== "viewer") return false;
    if (r.orgId && r.orgId !== project.orgId) return false;
    if (r.projectId && r.projectId !== project.id) return false;
    return true;
  });

  if (action === "edit") {
    return isAdmin;
  } else if (action === "read") {
    return isAdmin || isViewer;
  }

  // 7. Otherwise access is denied.
  return false;
}
