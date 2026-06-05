import { expect, test } from "bun:test";
import { canAccessProject } from "../src/permissions";

test("owner can edit their own same-org project", () => {
  const user = { id: "owner-a", orgId: "org-a", roles: [] };
  const project = { id: "project-a", orgId: "org-a", ownerId: "owner-a" };

  expect(canAccessProject({ user, project, action: "edit" })).toBe(true);
});

test("non-owner cannot edit by default", () => {
  const user = { id: "member-a", orgId: "org-a", roles: [] };
  const project = { id: "project-a", orgId: "org-a", ownerId: "owner-a" };

  expect(canAccessProject({ user, project, action: "edit" })).toBe(false);
});
