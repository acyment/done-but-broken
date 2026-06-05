import { expect, test } from "bun:test";
import { canAccessProject } from "../src/permissions";

test("suspended users are denied edit even when they own the project", () => {
  const user = { id: "owner-a", orgId: "org-a", suspended: true, roles: [] };
  const project = { id: "project-a", orgId: "org-a", ownerId: "owner-a" };

  expect(canAccessProject({ user, project, action: "edit" })).toBe(false);
});

test("suspended users are denied read even when they are viewers", () => {
  const user = {
    id: "viewer-a",
    orgId: "org-a",
    suspended: true,
    roles: [{ role: "viewer", orgId: "org-a" }]
  };
  const project = { id: "project-a", orgId: "org-a", ownerId: "owner-a" };

  expect(canAccessProject({ user, project, action: "read" })).toBe(false);
});
