import { expect, test } from "bun:test";
import { canAccessProject } from "../src/permissions";

test("explicit deny overrides owner edit permission", () => {
  const user = { id: "owner-a", orgId: "org-a", roles: [] };
  const project = { id: "project-a", orgId: "org-a", ownerId: "owner-a" };
  const policy = {
    denies: [{ userId: "owner-a", action: "edit", projectId: "project-a" }]
  };

  expect(canAccessProject({ user, project, action: "edit", policy })).toBe(false);
});

test("explicit deny overrides viewer read permission", () => {
  const user = {
    id: "viewer-a",
    orgId: "org-a",
    roles: [{ role: "viewer", orgId: "org-a" }]
  };
  const project = { id: "project-a", orgId: "org-a", ownerId: "owner-a" };
  const policy = {
    denies: [{ userId: "viewer-a", action: "read", orgId: "org-a" }]
  };

  expect(canAccessProject({ user, project, action: "read", policy })).toBe(false);
});
