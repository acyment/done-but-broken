import { describe, expect, test } from "bun:test";
import { canAccessProject, User, Project } from "../src/permissions";

describe("SPEC-001: Project owners can edit same-org projects", () => {
  test("owner is allowed edit access", () => {
    const user: User = { id: "u1", orgId: "org1" };
    const project: Project = { id: "p1", orgId: "org1", ownerId: "u1" };
    expect(canAccessProject({ user, project, action: "edit" })).toBe(true);
  });

  test("non-owner without role is denied edit access", () => {
    const user: User = { id: "u2", orgId: "org1" };
    const project: Project = { id: "p1", orgId: "org1", ownerId: "u1" };
    expect(canAccessProject({ user, project, action: "edit" })).toBe(false);
  });
});

describe("SPEC-002: Organization admins can edit same-org projects", () => {
  test("admin with org-level role is allowed edit access", () => {
    const user: User = { id: "u3", orgId: "org1", roles: [{ role: "admin", orgId: "org1" }] };
    const project: Project = { id: "p2", orgId: "org1", ownerId: "u1" };
    expect(canAccessProject({ user, project, action: "edit" })).toBe(true);
  });

  test("owner edit from previous checkpoint remains allowed", () => {
    const user: User = { id: "u1", orgId: "org1" };
    const project: Project = { id: "p1", orgId: "org1", ownerId: "u1" };
    expect(canAccessProject({ user, project, action: "edit" })).toBe(true);
  });
});

describe("SPEC-003: Viewers can read but cannot edit", () => {
  test("org-level viewer can read", () => {
    const user: User = { id: "u4", orgId: "org1", roles: [{ role: "viewer", orgId: "org1" }] };
    const project: Project = { id: "p3", orgId: "org1", ownerId: "u1" };
    expect(canAccessProject({ user, project, action: "read" })).toBe(true);
  });

  test("org-level viewer cannot edit", () => {
    const user: User = { id: "u4", orgId: "org1", roles: [{ role: "viewer", orgId: "org1" }] };
    const project: Project = { id: "p3", orgId: "org1", ownerId: "u1" };
    expect(canAccessProject({ user, project, action: "edit" })).toBe(false);
  });

  test("project-level viewer can read", () => {
    const user: User = { id: "u5", orgId: "org1", roles: [{ role: "viewer", projectId: "p4" }] };
    const project: Project = { id: "p4", orgId: "org1", ownerId: "u1" };
    expect(canAccessProject({ user, project, action: "read" })).toBe(true);
  });

  test("project-level viewer cannot edit", () => {
    const user: User = { id: "u5", orgId: "org1", roles: [{ role: "viewer", projectId: "p4" }] };
    const project: Project = { id: "p4", orgId: "org1", ownerId: "u1" };
    expect(canAccessProject({ user, project, action: "edit" })).toBe(false);
  });

  test("owner edit still allowed when viewer role exists", () => {
    const user: User = { id: "u1", orgId: "org1", roles: [{ role: "viewer", orgId: "org1" }] };
    const project: Project = { id: "p1", orgId: "org1", ownerId: "u1" };
    expect(canAccessProject({ user, project, action: "edit" })).toBe(true);
  });

  test("admin edit still allowed when viewer role exists", () => {
    const user: User = { id: "u3", orgId: "org1", roles: [{ role: "admin", orgId: "org1" }, { role: "viewer", orgId: "org1" }] };
    const project: Project = { id: "p2", orgId: "org1", ownerId: "u1" };
    expect(canAccessProject({ user, project, action: "edit" })).toBe(true);
  });
});

describe("SPEC-004: Suspended users are denied all access", () => {
  test("suspended owner is denied edit", () => {
    const user: User = { id: "u1", orgId: "org1", suspended: true };
    const project: Project = { id: "p1", orgId: "org1", ownerId: "u1" };
    expect(canAccessProject({ user, project, action: "edit" })).toBe(false);
  });

  test("suspended owner is denied read", () => {
    const user: User = { id: "u1", orgId: "org1", suspended: true };
    const project: Project = { id: "p1", orgId: "org1", ownerId: "u1" };
    expect(canAccessProject({ user, project, action: "read" })).toBe(false);
  });

  test("suspended admin is denied edit", () => {
    const user: User = { id: "u3", orgId: "org1", suspended: true, roles: [{ role: "admin", orgId: "org1" }] };
    const project: Project = { id: "p2", orgId: "org1", ownerId: "u1" };
    expect(canAccessProject({ user, project, action: "edit" })).toBe(false);
  });

  test("suspended viewer is denied read", () => {
    const user: User = { id: "u4", orgId: "org1", suspended: true, roles: [{ role: "viewer", orgId: "org1" }] };
    const project: Project = { id: "p3", orgId: "org1", ownerId: "u1" };
    expect(canAccessProject({ user, project, action: "read" })).toBe(false);
  });

  test("non-suspended user retains access", () => {
    const user: User = { id: "u1", orgId: "org1" };
    const project: Project = { id: "p1", orgId: "org1", ownerId: "u1" };
    expect(canAccessProject({ user, project, action: "edit" })).toBe(true);
  });
});

describe("SPEC-005: Explicit deny overrides role permissions", () => {
  test("project-level deny overrides owner edit", () => {
    const user: User = { id: "u1", orgId: "org1" };
    const project: Project = { id: "p1", orgId: "org1", ownerId: "u1" };
    const policy = { denies: [{ userId: "u1", action: "edit", projectId: "p1" }] };
    expect(canAccessProject({ user, project, action: "edit", policy })).toBe(false);
  });

  test("org-level deny overrides admin edit", () => {
    const user: User = { id: "u3", orgId: "org1", roles: [{ role: "admin", orgId: "org1" }] };
    const project: Project = { id: "p2", orgId: "org1", ownerId: "u1" };
    const policy = { denies: [{ userId: "u3", action: "edit", orgId: "org1" }] };
    expect(canAccessProject({ user, project, action: "edit", policy })).toBe(false);
  });

  test("non-matching deny does not affect owner edit", () => {
    const user: User = { id: "u1", orgId: "org1" };
    const project: Project = { id: "p1", orgId: "org1", ownerId: "u1" };
    const policy = { denies: [{ userId: "u2", action: "edit", projectId: "p1" }] };
    expect(canAccessProject({ user, project, action: "edit", policy })).toBe(true);
  });

  test("project-level deny overrides viewer read", () => {
    const user: User = { id: "u4", orgId: "org1", roles: [{ role: "viewer", orgId: "org1" }] };
    const project: Project = { id: "p3", orgId: "org1", ownerId: "u1" };
    const policy = { denies: [{ userId: "u4", action: "read", projectId: "p3" }] };
    expect(canAccessProject({ user, project, action: "read", policy })).toBe(false);
  });

  test("org-level deny overrides viewer read", () => {
    const user: User = { id: "u4", orgId: "org1", roles: [{ role: "viewer", orgId: "org1" }] };
    const project: Project = { id: "p3", orgId: "org1", ownerId: "u1" };
    const policy = { denies: [{ userId: "u4", action: "read", orgId: "org1" }] };
    expect(canAccessProject({ user, project, action: "read", policy })).toBe(false);
  });
});
