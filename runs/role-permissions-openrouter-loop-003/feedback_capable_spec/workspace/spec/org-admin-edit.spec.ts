import { expect, test } from "bun:test";
import { canAccessProject } from "../src/permissions";

test("admin can edit same-org projects", () => {
  const user = {
    id: "admin-a",
    orgId: "org-a",
    roles: [{ role: "admin", orgId: "org-a" }]
  };
  const project = { id: "project-a", orgId: "org-a", ownerId: "owner-a" };

  expect(canAccessProject({ user, project, action: "edit" })).toBe(true);
});

test("owner can still edit after admin support is added", () => {
  const user = { id: "owner-a", orgId: "org-a", roles: [] };
  const project = { id: "project-a", orgId: "org-a", ownerId: "owner-a" };

  expect(canAccessProject({ user, project, action: "edit" })).toBe(true);
});
