import { execFile } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { HiddenOracleAdapter, HiddenOracleRunInput, HiddenOracleRunResult } from "./runner";
import type { OracleCheckResult } from "./result-schema";

const execFileAsync = promisify(execFile);
const ORACLE_OUTPUT_PREFIX = "__ROLE_PERMISSIONS_ORACLE_OUTPUT__";

const COMMITMENTS_BY_CHECKPOINT = {
  I01: ["owner-edit"],
  I02: ["owner-edit", "org-admin-edit"],
  I03: ["owner-edit", "org-admin-edit", "viewer-read-only"],
  I04: ["owner-edit", "org-admin-edit", "viewer-read-only", "suspended-users-blocked"],
  I05: [
    "owner-edit",
    "org-admin-edit",
    "viewer-read-only",
    "suspended-users-blocked",
    "explicit-deny-overrides"
  ],
  I06: [
    "owner-edit",
    "org-admin-edit",
    "viewer-read-only",
    "suspended-users-blocked",
    "explicit-deny-overrides",
    "cross-org-access-forbidden"
  ],
  I07: [
    "owner-edit",
    "org-admin-edit",
    "viewer-read-only",
    "suspended-users-blocked",
    "explicit-deny-overrides",
    "cross-org-access-forbidden",
    "temporary-project-grants"
  ]
} as const;

type RolePermissionsCheckpoint = keyof typeof COMMITMENTS_BY_CHECKPOINT;

type OracleCase = {
  case_id: string;
  commitment_id: string;
  expected: boolean;
  input: {
    user: unknown;
    project: unknown;
    action: "read" | "edit";
    policy?: unknown;
  };
};

type CaseEvaluation = OracleCase & {
  actual: boolean;
  error?: string;
};

const ORACLE_CASES: OracleCase[] = [
  {
    case_id: "owner-edit:hidden-owner-can-edit",
    commitment_id: "owner-edit",
    expected: true,
    input: {
      user: { id: "u-owner-hidden", orgId: "org-hidden-a", roles: [] },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "edit"
    }
  },
  {
    case_id: "owner-edit:hidden-non-owner-default-deny",
    commitment_id: "owner-edit",
    expected: false,
    input: {
      user: { id: "u-member-hidden", orgId: "org-hidden-a", roles: [] },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "edit"
    }
  },
  {
    case_id: "org-admin-edit:hidden-admin-can-edit-peer-project",
    commitment_id: "org-admin-edit",
    expected: true,
    input: {
      user: {
        id: "u-admin-hidden",
        orgId: "org-hidden-a",
        roles: [{ role: "admin", orgId: "org-hidden-a" }]
      },
      project: { id: "project-hidden-peer", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "edit"
    }
  },
  {
    case_id: "org-admin-edit:hidden-owner-regression-check",
    commitment_id: "org-admin-edit",
    expected: true,
    input: {
      user: { id: "u-owner-hidden", orgId: "org-hidden-a", roles: [] },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "edit"
    }
  },
  {
    case_id: "viewer-read-only:hidden-project-viewer-can-read",
    commitment_id: "viewer-read-only",
    expected: true,
    input: {
      user: {
        id: "u-project-viewer-hidden",
        orgId: "org-hidden-a",
        roles: [{ role: "viewer", projectId: "project-hidden-a" }]
      },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "read"
    }
  },
  {
    case_id: "viewer-read-only:hidden-org-viewer-cannot-edit",
    commitment_id: "viewer-read-only",
    expected: false,
    input: {
      user: {
        id: "u-org-viewer-hidden",
        orgId: "org-hidden-a",
        roles: [{ role: "viewer", orgId: "org-hidden-a" }]
      },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "edit"
    }
  },
  {
    case_id: "suspended-users-blocked:hidden-suspended-admin-read-denied",
    commitment_id: "suspended-users-blocked",
    expected: false,
    input: {
      user: {
        id: "u-admin-hidden",
        orgId: "org-hidden-a",
        suspended: true,
        roles: [{ role: "admin", orgId: "org-hidden-a" }]
      },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "read"
    }
  },
  {
    case_id: "suspended-users-blocked:hidden-suspended-owner-edit-denied",
    commitment_id: "suspended-users-blocked",
    expected: false,
    input: {
      user: { id: "u-owner-hidden", orgId: "org-hidden-a", suspended: true, roles: [] },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "edit"
    }
  },
  {
    case_id: "explicit-deny-overrides:hidden-org-deny-blocks-admin-edit",
    commitment_id: "explicit-deny-overrides",
    expected: false,
    input: {
      user: {
        id: "u-admin-hidden",
        orgId: "org-hidden-a",
        roles: [{ role: "admin", orgId: "org-hidden-a" }]
      },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "edit",
      policy: {
        denies: [{ userId: "u-admin-hidden", action: "edit", orgId: "org-hidden-a" }]
      }
    }
  },
  {
    case_id: "explicit-deny-overrides:hidden-project-deny-blocks-owner-edit",
    commitment_id: "explicit-deny-overrides",
    expected: false,
    input: {
      user: { id: "u-owner-hidden", orgId: "org-hidden-a", roles: [] },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "edit",
      policy: {
        denies: [{ userId: "u-owner-hidden", action: "edit", projectId: "project-hidden-a" }]
      }
    }
  },
  {
    case_id: "explicit-deny-overrides:hidden-nonmatching-deny-preserves-owner-edit",
    commitment_id: "explicit-deny-overrides",
    expected: true,
    input: {
      user: { id: "u-owner-hidden", orgId: "org-hidden-a", roles: [] },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "edit",
      policy: {
        denies: [{ userId: "somebody-else", action: "edit", projectId: "project-hidden-a" }]
      }
    }
  },
  {
    case_id: "cross-org-access-forbidden:hidden-cross-org-admin-edit-denied",
    commitment_id: "cross-org-access-forbidden",
    expected: false,
    input: {
      user: {
        id: "u-admin-hidden",
        orgId: "org-hidden-a",
        roles: [{ role: "admin", orgId: "org-hidden-b" }]
      },
      project: { id: "project-hidden-b", orgId: "org-hidden-b", ownerId: "u-owner-b" },
      action: "edit"
    }
  },
  {
    case_id: "cross-org-access-forbidden:hidden-cross-org-owner-read-denied",
    commitment_id: "cross-org-access-forbidden",
    expected: false,
    input: {
      user: { id: "u-owner-b", orgId: "org-hidden-a", roles: [] },
      project: { id: "project-hidden-b", orgId: "org-hidden-b", ownerId: "u-owner-b" },
      action: "read"
    }
  },
  {
    case_id: "cross-org-access-forbidden:hidden-same-org-viewer-still-reads",
    commitment_id: "cross-org-access-forbidden",
    expected: true,
    input: {
      user: {
        id: "u-org-viewer-hidden",
        orgId: "org-hidden-a",
        roles: [{ role: "viewer", orgId: "org-hidden-a" }]
      },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "read"
    }
  },
  {
    case_id: "temporary-project-grants:hidden-valid-read-grant-allows-read",
    commitment_id: "temporary-project-grants",
    expected: true,
    input: {
      user: { id: "u-temporary-reader-hidden", orgId: "org-hidden-a", roles: [] },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "read",
      policy: {
        now: "2026-01-01T00:00:00.000Z",
        temporaryGrants: [
          {
            userId: "u-temporary-reader-hidden",
            projectId: "project-hidden-a",
            action: "read",
            expiresAt: "2026-01-02T00:00:00.000Z"
          }
        ]
      }
    }
  },
  {
    case_id: "temporary-project-grants:hidden-expired-grant-denies",
    commitment_id: "temporary-project-grants",
    expected: false,
    input: {
      user: { id: "u-temporary-reader-hidden", orgId: "org-hidden-a", roles: [] },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "read",
      policy: {
        now: "2026-01-02T00:00:00.000Z",
        temporaryGrants: [
          {
            userId: "u-temporary-reader-hidden",
            projectId: "project-hidden-a",
            action: "read",
            expiresAt: "2026-01-01T00:00:00.000Z"
          }
        ]
      }
    }
  },
  {
    case_id: "temporary-project-grants:hidden-edit-grant-allows-edit",
    commitment_id: "temporary-project-grants",
    expected: true,
    input: {
      user: { id: "u-temporary-editor-hidden", orgId: "org-hidden-a", roles: [] },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "edit",
      policy: {
        now: "2026-01-01T00:00:00.000Z",
        temporaryGrants: [
          {
            userId: "u-temporary-editor-hidden",
            projectId: "project-hidden-a",
            action: "edit",
            expiresAt: "2026-01-02T00:00:00.000Z"
          }
        ]
      }
    }
  },
  {
    case_id: "temporary-project-grants:hidden-read-grant-does-not-allow-edit",
    commitment_id: "temporary-project-grants",
    expected: false,
    input: {
      user: { id: "u-temporary-reader-hidden", orgId: "org-hidden-a", roles: [] },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "edit",
      policy: {
        now: "2026-01-01T00:00:00.000Z",
        temporaryGrants: [
          {
            userId: "u-temporary-reader-hidden",
            projectId: "project-hidden-a",
            action: "read",
            expiresAt: "2026-01-02T00:00:00.000Z"
          }
        ]
      }
    }
  },
  {
    case_id: "temporary-project-grants:hidden-explicit-deny-overrides-valid-grant",
    commitment_id: "temporary-project-grants",
    expected: false,
    input: {
      user: { id: "u-temporary-reader-hidden", orgId: "org-hidden-a", roles: [] },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "read",
      policy: {
        now: "2026-01-01T00:00:00.000Z",
        denies: [{ userId: "u-temporary-reader-hidden", action: "read", projectId: "project-hidden-a" }],
        temporaryGrants: [
          {
            userId: "u-temporary-reader-hidden",
            projectId: "project-hidden-a",
            action: "read",
            expiresAt: "2026-01-02T00:00:00.000Z"
          }
        ]
      }
    }
  },
  {
    case_id: "temporary-project-grants:hidden-suspended-user-with-valid-grant-denied",
    commitment_id: "temporary-project-grants",
    expected: false,
    input: {
      user: { id: "u-temporary-reader-hidden", orgId: "org-hidden-a", suspended: true, roles: [] },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "read",
      policy: {
        now: "2026-01-01T00:00:00.000Z",
        temporaryGrants: [
          {
            userId: "u-temporary-reader-hidden",
            projectId: "project-hidden-a",
            action: "read",
            expiresAt: "2026-01-02T00:00:00.000Z"
          }
        ]
      }
    }
  },
  {
    case_id: "temporary-project-grants:hidden-cross-org-user-with-valid-grant-denied",
    commitment_id: "temporary-project-grants",
    expected: false,
    input: {
      user: { id: "u-temporary-reader-hidden", orgId: "org-hidden-b", roles: [] },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "read",
      policy: {
        now: "2026-01-01T00:00:00.000Z",
        temporaryGrants: [
          {
            userId: "u-temporary-reader-hidden",
            projectId: "project-hidden-a",
            action: "read",
            expiresAt: "2026-01-02T00:00:00.000Z"
          }
        ]
      }
    }
  },
  {
    case_id: "temporary-project-grants:hidden-same-org-admin-still-edits-after-grants",
    commitment_id: "temporary-project-grants",
    expected: true,
    input: {
      user: {
        id: "u-admin-hidden",
        orgId: "org-hidden-a",
        roles: [{ role: "admin", orgId: "org-hidden-a" }]
      },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "edit",
      policy: {
        now: "2026-01-01T00:00:00.000Z",
        temporaryGrants: [
          {
            userId: "somebody-else",
            projectId: "project-hidden-a",
            action: "edit",
            expiresAt: "2026-01-02T00:00:00.000Z"
          }
        ]
      }
    }
  },
  {
    case_id: "temporary-project-grants:hidden-project-viewer-still-reads-after-grants",
    commitment_id: "temporary-project-grants",
    expected: true,
    input: {
      user: {
        id: "u-project-viewer-hidden",
        orgId: "org-hidden-a",
        roles: [{ role: "viewer", projectId: "project-hidden-a" }]
      },
      project: { id: "project-hidden-a", orgId: "org-hidden-a", ownerId: "u-owner-hidden" },
      action: "read",
      policy: {
        now: "2026-01-01T00:00:00.000Z",
        temporaryGrants: [
          {
            userId: "somebody-else",
            projectId: "project-hidden-a",
            action: "read",
            expiresAt: "2026-01-02T00:00:00.000Z"
          }
        ]
      }
    }
  }
];

export function createRolePermissionsOracle(): HiddenOracleAdapter {
  return {
    async run(input) {
      return evaluateRolePermissionsWorkspace(input);
    }
  };
}

export async function evaluateRolePermissionsWorkspace(
  input: HiddenOracleRunInput
): Promise<HiddenOracleRunResult> {
  const active = new Set(activeCommitments(input.checkpoint_id));
  const caseEvaluations = await evaluateCases(input.workspace_path, ORACLE_CASES.filter((testCase) =>
    active.has(testCase.commitment_id)
  ));
  const checks = [...active].map((commitment_id) =>
    evaluateCommitment(input.checkpoint_id, commitment_id, caseEvaluations)
  );
  const passed = checks.every((check) => check.passed);

  return {
    status: passed ? "ok" : "failed",
    checks
  };
}

function activeCommitments(checkpoint_id: string): readonly string[] {
  return COMMITMENTS_BY_CHECKPOINT[checkpoint_id as RolePermissionsCheckpoint] ?? [];
}

function evaluateCommitment(
  checkpoint_id: string,
  commitment_id: string,
  caseEvaluations: CaseEvaluation[]
): OracleCheckResult {
  const cases = caseEvaluations.filter((testCase) => testCase.commitment_id === commitment_id);
  const failingCases = cases.filter((testCase) => testCase.actual !== testCase.expected || testCase.error);
  const passed = cases.length > 0 && failingCases.length === 0;

  return {
    check_id: `role-permissions-calibration:${checkpoint_id}:${commitment_id}`,
    commitment_id,
    passed,
    details: passed
      ? `${cases.length} hidden ${commitment_id} case(s) passed.`
      : `Failed hidden case(s): ${failingCases.map((testCase) => testCase.case_id).join(", ")}`
  };
}

async function evaluateCases(workspacePath: string, cases: OracleCase[]): Promise<CaseEvaluation[]> {
  if (cases.length === 0) {
    return [];
  }

  try {
    const permissionsUrl = pathToFileURL(join(workspacePath, "src", "permissions.ts")).href;
    const script = [
      `const permissionsModule = await import(${JSON.stringify(permissionsUrl)});`,
      "const canAccessProject = permissionsModule.canAccessProject;",
      `const cases = ${JSON.stringify(cases)};`,
      "const results = [];",
      "for (const testCase of cases) {",
      "  let actual = false;",
      "  let error;",
      "  try {",
      "    if (typeof canAccessProject !== 'function') {",
      "      throw new Error('canAccessProject export is missing');",
      "    }",
      "    actual = Boolean(await canAccessProject(testCase.input));",
      "  } catch (caught) {",
      "    error = caught instanceof Error ? caught.message : String(caught);",
      "  }",
      "  results.push({ ...testCase, actual, error });",
      "}",
      `console.log(${JSON.stringify(ORACLE_OUTPUT_PREFIX)} + JSON.stringify(results));`
    ].join("\n");
    const { stdout } = await execFileAsync(process.execPath, ["--eval", script], {
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });
    const outputLine = stdout
      .trimEnd()
      .split("\n")
      .findLast((line) => line.startsWith(ORACLE_OUTPUT_PREFIX));

    return outputLine ? JSON.parse(outputLine.slice(ORACLE_OUTPUT_PREFIX.length)) : failedImportCases(cases);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    return cases.map((testCase) => ({
      ...testCase,
      actual: false,
      error: detail
    }));
  }
}

function failedImportCases(cases: OracleCase[]): CaseEvaluation[] {
  return cases.map((testCase) => ({
    ...testCase,
    actual: false,
    error: "No oracle output was produced."
  }));
}
