import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONDITION_IDS } from "../src/conditions";
import { renderSpecPacket } from "../src/renderer";
import { createRolePermissionsOracle } from "../src/role-permissions-oracle";
import { runPilot } from "../src/runner";
import { loadTaskPackage } from "../src/task-package";
import { createFakeAgent } from "./support/fake-agent";

const repoRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/test$/, "");
const taskPath = join(repoRoot, "tasks", "role-permissions-calibration");
const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("role-permissions-calibration task", () => {
  test("loads with seven checkpoints and exactly the two pilot conditions", async () => {
    const task = await loadTaskPackage(taskPath);

    expect(task.task_id).toBe("role-permissions-calibration");
    expect(task.checkpoints).toEqual(["I01", "I02", "I03", "I04", "I05", "I06", "I07"]);
    expect(CONDITION_IDS).toEqual(["context_only_spec", "feedback_capable_spec"]);
    expect(task.public_api_contract).toContain("canAccessProject");
  });

  test("renders equal visible spec text while gating feedback assets to feedback_capable_spec", async () => {
    const task = await loadTaskPackage(taskPath);

    for (const checkpoint_id of task.checkpoints) {
      const contextPacket = renderSpecPacket({
        task,
        condition_id: "context_only_spec",
        checkpoint_id
      });
      const feedbackPacket = renderSpecPacket({
        task,
        condition_id: "feedback_capable_spec",
        checkpoint_id
      });

      expect(contextPacket.visible_spec_text).toBe(feedbackPacket.visible_spec_text);
      expect(contextPacket.feedback_command).toBeUndefined();
      expect(contextPacket.executable_feedback_paths).toEqual([]);
      expect(contextPacket.feedback_assets).toEqual([]);
      expect(feedbackPacket.feedback_command).toBe("bun run spec");
      expect(feedbackPacket.executable_feedback_paths.length).toBeGreaterThan(0);
      expect(feedbackPacket.feedback_assets.length).toBe(feedbackPacket.executable_feedback_paths.length);
    }
  });

  test("I07 renders equal visible spec text while preserving feedback gating", async () => {
    const task = await loadTaskPackage(taskPath);
    const contextPacket = renderSpecPacket({
      task,
      condition_id: "context_only_spec",
      checkpoint_id: "I07"
    });
    const feedbackPacket = renderSpecPacket({
      task,
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I07"
    });

    expect(contextPacket.visible_spec_text).toBe(feedbackPacket.visible_spec_text);
    expect(contextPacket.visible_spec_text).toContain("Temporary project grants");
    expect(contextPacket.feedback_command).toBeUndefined();
    expect(contextPacket.executable_feedback_paths).toEqual([]);
    expect(contextPacket.feedback_assets).toEqual([]);
    expect(feedbackPacket.feedback_command).toBe("bun run spec");
    expect(feedbackPacket.executable_feedback_paths).toContain("spec/temporary-project-grants.spec.ts");
  });

  test("feedback checks accumulate representative prior behavior across checkpoints", async () => {
    const task = await loadTaskPackage(taskPath);
    const i03Packet = renderSpecPacket({
      task,
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I03"
    });
    const i04Packet = renderSpecPacket({
      task,
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I04"
    });
    const i06Packet = renderSpecPacket({
      task,
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I06"
    });
    const i07Packet = renderSpecPacket({
      task,
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I07"
    });

    expect(i04Packet.executable_feedback_paths).toEqual([
      "spec/owner-edit.spec.ts",
      "spec/org-admin-edit.spec.ts",
      "spec/viewer-read-only.spec.ts",
      "spec/suspended-blocked.spec.ts"
    ]);
    expect(i06Packet.executable_feedback_paths).toEqual([
      "spec/owner-edit.spec.ts",
      "spec/org-admin-edit.spec.ts",
      "spec/viewer-read-only.spec.ts",
      "spec/suspended-blocked.spec.ts",
      "spec/explicit-deny.spec.ts",
      "spec/cross-org-forbidden.spec.ts"
    ]);
    expect(i07Packet.executable_feedback_paths).toEqual([
      "spec/owner-edit.spec.ts",
      "spec/org-admin-edit.spec.ts",
      "spec/viewer-read-only.spec.ts",
      "spec/suspended-blocked.spec.ts",
      "spec/explicit-deny.spec.ts",
      "spec/cross-org-forbidden.spec.ts",
      "spec/temporary-project-grants.spec.ts"
    ]);

    expect(i03Packet.executable_feedback_paths).toContain("spec/viewer-read-only.spec.ts");
    expect(i04Packet.feedback_assets.map((asset) => asset.content).join("\n")).toContain("owner can edit");
    expect(i04Packet.feedback_assets.map((asset) => asset.content).join("\n")).toContain("admin can edit");
    expect(i04Packet.feedback_assets.map((asset) => asset.content).join("\n")).toContain("viewer can read");
    expect(i04Packet.feedback_assets.map((asset) => asset.content).join("\n")).toContain("suspended users are denied");
    expect(i06Packet.feedback_assets.map((asset) => asset.content).join("\n")).toContain("explicit deny overrides");
    expect(i06Packet.feedback_assets.map((asset) => asset.content).join("\n")).toContain("cross-org access is denied");
    expect(i07Packet.feedback_assets.map((asset) => asset.content).join("\n")).toContain("valid temporary read grant allows read");
    expect(i07Packet.feedback_assets.map((asset) => asset.content).join("\n")).toContain("expired temporary grant denies access");
    expect(i07Packet.feedback_assets.map((asset) => asset.content).join("\n")).toContain("explicit deny overrides a valid temporary grant");
  });

  test("viewer feedback includes project-scoped viewer read behavior from I03 onward", async () => {
    const task = await loadTaskPackage(taskPath);

    for (const checkpoint_id of ["I03", "I04", "I05", "I06"]) {
      const packet = renderSpecPacket({
        task,
        condition_id: "feedback_capable_spec",
        checkpoint_id
      });
      const viewerAsset = packet.feedback_assets.find(
        (asset) => asset.relative_path === "spec/viewer-read-only.spec.ts"
      );

      expect(viewerAsset?.content).toContain("project viewer can read a matching project");
      expect(viewerAsset?.content).toContain("projectId: \"project-a\"");
      expect(viewerAsset?.content).toContain("action: \"read\"");
      expect(viewerAsset?.content).toContain("toBe(true)");
    }
  });

  test("keeps hidden oracle paths out of rendered packets and candidate workspaces", async () => {
    const root = await mkTempRoot();
    const task = await loadTaskPackage(taskPath);
    const contextPacket = renderSpecPacket({
      task,
      condition_id: "context_only_spec",
      checkpoint_id: "I07"
    });
    const feedbackPacket = renderSpecPacket({
      task,
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I07"
    });

    expect(contextPacket.prompt_text).not.toContain("hidden-oracle");
    expect(feedbackPacket.prompt_text).not.toContain("hidden-oracle");
    expect(contextPacket.visible_spec_text).not.toContain("hidden-oracle");
    expect(feedbackPacket.visible_spec_text).not.toContain("hidden-oracle");

    const result = await runPilot({
      task,
      run_id: "role-permissions-isolation",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      hidden_oracle: createRolePermissionsOracle()
    });

    for (const conditionId of CONDITION_IDS) {
      const workspacePath = result.condition_results[conditionId].workspace_path;

      expect(await pathExists(join(workspacePath, "hidden-oracle"))).toBe(false);
      expect(await pathExists(join(workspacePath, "oracle-cases.ts"))).toBe(false);
    }
  });

  test("runs through all seven checkpoints with carry-forward fake-agent state", async () => {
    const root = await mkTempRoot();
    const task = await loadTaskPackage(taskPath);
    const result = await runPilot({
      task,
      run_id: "role-permissions-fake-carry-forward",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      hidden_oracle: createRolePermissionsOracle()
    });

    for (const conditionId of CONDITION_IDS) {
      const condition = result.condition_results[conditionId];
      const state = await readFile(join(condition.workspace_path, "agent-state.txt"), "utf8");
      const previousBeforeFinalCheckpoint = await readFile(
        join(condition.workspace_path, "saw-previous-checkpoint.txt"),
        "utf8"
      );

      expect(condition.checkpoints.map((checkpoint) => checkpoint.checkpoint_id)).toEqual([
        "I01",
        "I02",
        "I03",
        "I04",
        "I05",
        "I06",
        "I07"
      ]);
      expect(state).toContain(`I02 ${conditionId} saw_previous=true`);
      expect(state).toContain(`I07 ${conditionId} saw_previous=true`);
      expect(previousBeforeFinalCheckpoint).toContain(`I06 ${conditionId}`);
      expect(previousBeforeFinalCheckpoint).not.toContain(`I07 ${conditionId}`);
    }
  });
});

describe("role-permissions hidden oracle", () => {
  test("passes a correct reference candidate at every checkpoint", async () => {
    const root = await setupWorkspace(correctPermissionsSource());
    const oracle = createRolePermissionsOracle();

    for (const checkpoint_id of ["I01", "I02", "I03", "I04", "I05", "I06", "I07"]) {
      const result = await oracle.run({
        condition_id: "feedback_capable_spec",
        checkpoint_id,
        workspace_path: join(root, "workspace"),
        artifact_dir: join(root, "artifacts", checkpoint_id),
        hidden_oracle_path: join(root, "hidden-oracle")
      });

      expect(result.status).toBe("ok");
      expect(result.checks.length).toBeGreaterThanOrEqual(1);
      expect(result.checks.every((check) => check.passed)).toBe(true);
    }
  });

  test("fails an incomplete owner-only candidate on later hidden checks", async () => {
    const root = await setupWorkspace(ownerOnlyPermissionsSource());
    const oracle = createRolePermissionsOracle();
    const result = await oracle.run({
      condition_id: "context_only_spec",
      checkpoint_id: "I06",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I06"),
      hidden_oracle_path: join(root, "hidden-oracle")
    });

    expect(result.status).toBe("failed");
    expect(failedCommitments(result.checks)).toContain("org-admin-edit");
    expect(failedCommitments(result.checks)).toContain("viewer-read-only");
    expect(failedCommitments(result.checks)).toContain("explicit-deny-overrides");
  });

  test("catches candidates that forget suspension and explicit-deny precedence", async () => {
    const root = await setupWorkspace(wrongPrecedencePermissionsSource());
    const oracle = createRolePermissionsOracle();
    const result = await oracle.run({
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I06",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I06"),
      hidden_oracle_path: join(root, "hidden-oracle")
    });

    expect(result.status).toBe("failed");
    expect(failedCommitments(result.checks)).toContain("suspended-users-blocked");
    expect(failedCommitments(result.checks)).toContain("explicit-deny-overrides");
  });

  test("fails a candidate that ignores temporary grant expiration", async () => {
    const root = await setupWorkspace(ignoresTemporaryGrantExpirationSource());
    const oracle = createRolePermissionsOracle();
    const result = await oracle.run({
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I07",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I07"),
      hidden_oracle_path: join(root, "hidden-oracle")
    });

    expect(result.status).toBe("failed");
    expect(failedCommitments(result.checks)).toContain("temporary-project-grants");
  });

  test("fails a candidate that lets temporary grants override explicit deny", async () => {
    const root = await setupWorkspace(grantOverridesExplicitDenySource());
    const oracle = createRolePermissionsOracle();
    const result = await oracle.run({
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I07",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I07"),
      hidden_oracle_path: join(root, "hidden-oracle")
    });

    expect(result.status).toBe("failed");
    expect(failedCommitments(result.checks)).toContain("temporary-project-grants");
  });

  test("fails a candidate that allows cross-org temporary grants", async () => {
    const root = await setupWorkspace(crossOrgTemporaryGrantSource());
    const oracle = createRolePermissionsOracle();
    const result = await oracle.run({
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I07",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I07"),
      hidden_oracle_path: join(root, "hidden-oracle")
    });

    expect(result.status).toBe("failed");
    expect(failedCommitments(result.checks)).toContain("temporary-project-grants");
  });
});

function failedCommitments(checks: Array<{ commitment_id: string; passed: boolean }>) {
  return checks.filter((check) => !check.passed).map((check) => check.commitment_id);
}

async function setupWorkspace(permissionsSource: string) {
  const root = await mkTempRoot();

  await mkdir(join(root, "workspace", "src"), { recursive: true });
  await mkdir(join(root, "hidden-oracle"), { recursive: true });
  await mkdir(join(root, "artifacts"), { recursive: true });
  await writeFile(join(root, "workspace", "src", "permissions.ts"), permissionsSource);
  await writeFile(join(root, "hidden-oracle", "oracle-cases.txt"), "private hidden cases\n");

  return root;
}

async function mkTempRoot() {
  const root = join(
    tmpdir(),
    `hit-sdd-bench-role-permissions-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  tempRoots.push(root);
  await mkdir(root, { recursive: true });

  return root;
}

async function pathExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function ownerOnlyPermissionsSource(): string {
  return [
    "export function canAccessProject({ user, project, action }) {",
    "  return action === 'edit' && user.id === project.ownerId;",
    "}",
    ""
  ].join("\n");
}

function wrongPrecedencePermissionsSource(): string {
  return [
    "export function canAccessProject({ user, project, action, policy = {} }) {",
    "  const roles = user.roles ?? [];",
    "  const sameOrg = user.orgId === project.orgId;",
    "  const allowed =",
    "    (sameOrg && user.id === project.ownerId) ||",
    "    (sameOrg && roles.some((role) => role.role === 'admin' && role.orgId === project.orgId)) ||",
    "    (action === 'read' && sameOrg && roles.some((role) => role.role === 'viewer' && (role.orgId === project.orgId || role.projectId === project.id)));",
    "  if (allowed) return true;",
    "  if (user.suspended) return false;",
    "  if ((policy.denies ?? []).some((deny) => deny.userId === user.id && deny.action === action && (deny.projectId === project.id || deny.orgId === project.orgId))) return false;",
    "  return false;",
    "}",
    ""
  ].join("\n");
}

function correctPermissionsSource(): string {
  return [
    "export function canAccessProject({ user, project, action, policy = {} }) {",
    "  const roles = user.roles ?? [];",
    "  if (user.suspended === true) return false;",
    "  if (user.orgId !== project.orgId) return false;",
    "  if ((policy.denies ?? []).some((deny) => deny.userId === user.id && deny.action === action && (deny.projectId === project.id || deny.orgId === project.orgId))) return false;",
    "  if ((policy.temporaryGrants ?? []).some((grant) => grant.userId === user.id && grant.projectId === project.id && grant.action === action && grant.expiresAt > policy.now)) return true;",
    "  const isOwner = user.id === project.ownerId;",
    "  const isAdmin = roles.some((role) => role.role === 'admin' && role.orgId === project.orgId);",
    "  const isViewer = roles.some((role) => role.role === 'viewer' && (role.orgId === project.orgId || role.projectId === project.id));",
    "  if (action === 'edit') return isOwner || isAdmin;",
    "  if (action === 'read') return isOwner || isAdmin || isViewer;",
    "  return false;",
    "}",
    ""
  ].join("\n");
}

function ignoresTemporaryGrantExpirationSource(): string {
  return [
    "export function canAccessProject({ user, project, action, policy = {} }) {",
    "  const roles = user.roles ?? [];",
    "  if (user.suspended === true) return false;",
    "  if (user.orgId !== project.orgId) return false;",
    "  if ((policy.denies ?? []).some((deny) => deny.userId === user.id && deny.action === action && (deny.projectId === project.id || deny.orgId === project.orgId))) return false;",
    "  if ((policy.temporaryGrants ?? []).some((grant) => grant.userId === user.id && grant.projectId === project.id && grant.action === action)) return true;",
    "  const isOwner = user.id === project.ownerId;",
    "  const isAdmin = roles.some((role) => role.role === 'admin' && role.orgId === project.orgId);",
    "  const isViewer = roles.some((role) => role.role === 'viewer' && (role.orgId === project.orgId || role.projectId === project.id));",
    "  if (action === 'edit') return isOwner || isAdmin;",
    "  if (action === 'read') return isOwner || isAdmin || isViewer;",
    "  return false;",
    "}",
    ""
  ].join("\n");
}

function grantOverridesExplicitDenySource(): string {
  return [
    "export function canAccessProject({ user, project, action, policy = {} }) {",
    "  const roles = user.roles ?? [];",
    "  if (user.suspended === true) return false;",
    "  if (user.orgId !== project.orgId) return false;",
    "  if ((policy.temporaryGrants ?? []).some((grant) => grant.userId === user.id && grant.projectId === project.id && grant.action === action && grant.expiresAt > policy.now)) return true;",
    "  if ((policy.denies ?? []).some((deny) => deny.userId === user.id && deny.action === action && (deny.projectId === project.id || deny.orgId === project.orgId))) return false;",
    "  const isOwner = user.id === project.ownerId;",
    "  const isAdmin = roles.some((role) => role.role === 'admin' && role.orgId === project.orgId);",
    "  const isViewer = roles.some((role) => role.role === 'viewer' && (role.orgId === project.orgId || role.projectId === project.id));",
    "  if (action === 'edit') return isOwner || isAdmin;",
    "  if (action === 'read') return isOwner || isAdmin || isViewer;",
    "  return false;",
    "}",
    ""
  ].join("\n");
}

function crossOrgTemporaryGrantSource(): string {
  return [
    "export function canAccessProject({ user, project, action, policy = {} }) {",
    "  const roles = user.roles ?? [];",
    "  if (user.suspended === true) return false;",
    "  if ((policy.denies ?? []).some((deny) => deny.userId === user.id && deny.action === action && (deny.projectId === project.id || deny.orgId === project.orgId))) return false;",
    "  if ((policy.temporaryGrants ?? []).some((grant) => grant.userId === user.id && grant.projectId === project.id && grant.action === action && grant.expiresAt > policy.now)) return true;",
    "  if (user.orgId !== project.orgId) return false;",
    "  const isOwner = user.id === project.ownerId;",
    "  const isAdmin = roles.some((role) => role.role === 'admin' && role.orgId === project.orgId);",
    "  const isViewer = roles.some((role) => role.role === 'viewer' && (role.orgId === project.orgId || role.projectId === project.id));",
    "  if (action === 'edit') return isOwner || isAdmin;",
    "  if (action === 'read') return isOwner || isAdmin || isViewer;",
    "  return false;",
    "}",
    ""
  ].join("\n");
}
