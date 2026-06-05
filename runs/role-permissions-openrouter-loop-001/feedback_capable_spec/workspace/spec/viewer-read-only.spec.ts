import { expect, test } from "bun:test";
import { canAccessProject } from "../src/permissions";

test("viewer can read a same-org project", () => {
  const user = {
    id: "viewer-a",
    orgId: "org-a",
    roles: [{ role: "viewer", orgId: "org-a" }]
  };
  const project = { id: "project-a", orgId: "org-a", ownerId: "owner-a" };

  expect(canAccessProject({ user, project, action: "read" })).toBe(true);
});

test("viewer cannot edit a same-org project", () => {
  const user = {
    id: "viewer-a",
    orgId: "org-a",
    roles: [{ role: "viewer", orgId: "org-a" }]
  };
  const project = { id: "project-a", orgId: "org-a", ownerId: "owner-a" };

  expect(canAccessProject({ user, project, action: "edit" })).toBe(false);
});
