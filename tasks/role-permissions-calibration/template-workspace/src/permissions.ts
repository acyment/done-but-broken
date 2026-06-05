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
  if (input.action === "edit" && input.user.id === input.project.ownerId) {
    return true;
  }

  return false;
}
