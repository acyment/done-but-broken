import { expect, test } from "bun:test";
import { canAccessProject } from "../src/permissions";

test("cross-org access is denied for admins", () => {
  const user = {
    id: "admin-a",
    orgId: "org-a",
    roles: [{ role: "admin", orgId: "org-b" }]
  };
  const project = { id: "project-b", orgId: "org-b", ownerId: "owner-b" };

  expect(canAccessProject({ user, project, action: "edit" })).toBe(false);
});

test("same-org access still works after cross-org restriction", () => {
  const owner = { id: "owner-a", orgId: "org-a", roles: [] };
  const admin = {
    id: "admin-a",
    orgId: "org-a",
    roles: [{ role: "admin", orgId: "org-a" }]
  };
  const project = { id: "project-a", orgId: "org-a", ownerId: "owner-a" };

  expect(canAccessProject({ user: owner, project, action: "edit" })).toBe(true);
  expect(canAccessProject({ user: admin, project, action: "edit" })).toBe(true);
});
