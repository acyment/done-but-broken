import { expect, test } from "bun:test";
import { canAccessProject } from "../src/permissions";

test("valid temporary read grant allows read", () => {
  const user = { id: "temporary-reader-a", orgId: "org-a", roles: [] };
  const project = { id: "project-a", orgId: "org-a", ownerId: "owner-a" };
  const policy = {
    now: "2026-01-01T00:00:00.000Z",
    temporaryGrants: [
      {
        userId: "temporary-reader-a",
        projectId: "project-a",
        action: "read",
        expiresAt: "2026-01-02T00:00:00.000Z"
      }
    ]
  };

  expect(canAccessProject({ user, project, action: "read", policy })).toBe(true);
});

test("expired temporary grant denies access", () => {
  const user = { id: "temporary-reader-a", orgId: "org-a", roles: [] };
  const project = { id: "project-a", orgId: "org-a", ownerId: "owner-a" };
  const policy = {
    now: "2026-01-02T00:00:00.000Z",
    temporaryGrants: [
      {
        userId: "temporary-reader-a",
        projectId: "project-a",
        action: "read",
        expiresAt: "2026-01-01T00:00:00.000Z"
      }
    ]
  };

  expect(canAccessProject({ user, project, action: "read", policy })).toBe(false);
});

test("explicit deny overrides a valid temporary grant", () => {
  const user = { id: "temporary-reader-a", orgId: "org-a", roles: [] };
  const project = { id: "project-a", orgId: "org-a", ownerId: "owner-a" };
  const policy = {
    now: "2026-01-01T00:00:00.000Z",
    denies: [{ userId: "temporary-reader-a", action: "read", projectId: "project-a" }],
    temporaryGrants: [
      {
        userId: "temporary-reader-a",
        projectId: "project-a",
        action: "read",
        expiresAt: "2026-01-02T00:00:00.000Z"
      }
    ]
  };

  expect(canAccessProject({ user, project, action: "read", policy })).toBe(false);
});
