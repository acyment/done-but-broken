import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { HiddenOracleAdapter, HiddenOracleRunInput, HiddenOracleRunResult } from "./runner";
import type { OracleCheckResult } from "./result-schema";

const execFileAsync = promisify(execFile);
const ORACLE_OUTPUT_PREFIX = "__PAYROLL_NET_PAY_ORACLE_OUTPUT__";
const ORACLE_CASES_FILE = "oracle-cases.json";
const DEFAULT_MONEY_TOLERANCE = 0.005;

type OracleCase = {
  case_id: string;
  commitment_id: string;
  events: unknown[];
  assertions: unknown[];
};

type OracleCasesFile = {
  money_tolerance?: number;
  commitments_by_checkpoint: Record<string, string[]>;
  cases: OracleCase[];
};

type CaseEvaluation = OracleCase & {
  actual: boolean;
  failures: string[];
  error?: string;
};

export function createPayrollNetPayOracle(
  checkIdTaskId = "payroll-net-pay-lifecycle"
): HiddenOracleAdapter {
  return {
    async run(input) {
      return evaluatePayrollNetPayWorkspace(input, checkIdTaskId);
    }
  };
}

export async function evaluatePayrollNetPayWorkspace(
  input: HiddenOracleRunInput,
  checkIdTaskId = "payroll-net-pay-lifecycle"
): Promise<HiddenOracleRunResult> {
  let casesFile: OracleCasesFile;

  try {
    casesFile = await loadOracleCases(input.hidden_oracle_path);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    return {
      status: "failed",
      checks: [
        {
          check_id: `${checkIdTaskId}:${input.checkpoint_id}:oracle-cases`,
          commitment_id: "oracle-cases",
          passed: false,
          details: `Could not load sealed oracle cases: ${detail}`
        }
      ]
    };
  }

  const moneyTolerance = casesFile.money_tolerance ?? DEFAULT_MONEY_TOLERANCE;
  const activeList = casesFile.commitments_by_checkpoint[input.checkpoint_id] ?? [];
  const active = new Set(activeList);
  const caseEvaluations = await evaluateCases(
    input.workspace_path,
    casesFile.cases.filter((testCase) => active.has(testCase.commitment_id)),
    moneyTolerance
  );
  const checks = activeList.map((commitment_id) =>
    evaluateCommitment(checkIdTaskId, input.checkpoint_id, commitment_id, caseEvaluations)
  );
  const passed = checks.length > 0 && checks.every((check) => check.passed);

  return {
    status: passed ? "ok" : "failed",
    checks
  };
}

async function loadOracleCases(hiddenOraclePath: string): Promise<OracleCasesFile> {
  const raw = await readFile(join(hiddenOraclePath, ORACLE_CASES_FILE), "utf8");
  const parsed = JSON.parse(raw) as OracleCasesFile;

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.cases) || !parsed.commitments_by_checkpoint) {
    throw new Error("oracle-cases.json is missing cases or commitments_by_checkpoint.");
  }

  return parsed;
}

function evaluateCommitment(
  check_id_task_id: string,
  checkpoint_id: string,
  commitment_id: string,
  caseEvaluations: CaseEvaluation[]
): OracleCheckResult {
  const cases = caseEvaluations.filter((testCase) => testCase.commitment_id === commitment_id);
  const failingCases = cases.filter((testCase) => !testCase.actual || testCase.error);
  const passed = cases.length > 0 && failingCases.length === 0;

  return {
    check_id: `${check_id_task_id}:${checkpoint_id}:${commitment_id}`,
    commitment_id,
    passed,
    details: passed
      ? `${cases.length} hidden ${commitment_id} case(s) passed.`
      : `Failed hidden case(s): ${failingCases.map((testCase) => testCase.case_id).join(", ")}`
  };
}

async function evaluateCases(
  workspacePath: string,
  cases: OracleCase[],
  moneyTolerance: number
): Promise<CaseEvaluation[]> {
  if (cases.length === 0) {
    return [];
  }

  try {
    const payrollUrl = pathToFileURL(join(workspacePath, "src", "payroll.ts")).href;
    const script = [
      `const payrollModule = await import(${JSON.stringify(payrollUrl)});`,
      "const { applyEvent, getPaycheck, getYearToDate } = payrollModule;",
      `const MONEY_TOL = ${moneyTolerance};`,
      `const cases = ${JSON.stringify(cases)};`,
      "const results = [];",
      "for (const testCase of cases) {",
      "  const failures = [];",
      "  let state = {};",
      "  let error;",
      "  try {",
      "    if (typeof applyEvent !== 'function' || typeof getPaycheck !== 'function' || typeof getYearToDate !== 'function') {",
      "      throw new Error('payroll API export is missing');",
      "    }",
      "    for (const event of testCase.events) {",
      "      state = await applyEvent(state, event);",
      "    }",
      "    for (const assertion of testCase.assertions) {",
      "      const failure = evaluateAssertion(assertion, state);",
      "      if (failure) failures.push(failure);",
      "    }",
      "  } catch (caught) {",
      "    error = caught instanceof Error ? caught.message : String(caught);",
      "  }",
      "  results.push({ ...testCase, actual: failures.length === 0 && !error, failures, error });",
      "}",
      "function near(actual, expected, tolerance) { return typeof actual === 'number' && Math.abs(actual - expected) <= tolerance; }",
      "function getPath(value, keyPath) { return keyPath.split('.').reduce((current, key) => current?.[key], value); }",
      "function evaluateAssertion(assertion, state) {",
      "  const tol = typeof assertion.tolerance === 'number' ? assertion.tolerance : MONEY_TOL;",
      "  const paycheck = getPaycheck(state);",
      "  const ytd = getYearToDate(state);",
      "  if (assertion.kind === 'paycheck_number') {",
      "    const actual = getPath(paycheck, assertion.path);",
      "    return near(actual, assertion.expected, tol) ? undefined : `paycheck.${assertion.path}: expected ${assertion.expected} (tol ${tol}), got ${actual}`;",
      "  }",
      "  if (assertion.kind === 'ytd_number') {",
      "    const actual = getPath(ytd, assertion.path);",
      "    return near(actual, assertion.expected, tol) ? undefined : `ytd.${assertion.path}: expected ${assertion.expected} (tol ${tol}), got ${actual}`;",
      "  }",
      "  if (assertion.kind === 'line_item') {",
      "    const actual = paycheck?.lineItems?.find((item) => item.code === assertion.code)?.amount;",
      "    return near(actual, assertion.expected, tol) ? undefined : `lineItems.${assertion.code}: expected ${assertion.expected} (tol ${tol}), got ${actual}`;",
      "  }",
      "  if (assertion.kind === 'is_rounded') {",
      "    const source = assertion.source === 'ytd' ? ytd : paycheck;",
      "    const actual = getPath(source, assertion.path);",
      "    if (typeof actual !== 'number') return `is_rounded ${assertion.path}: expected a number, got ${actual}`;",
      "    const scale = Math.pow(10, assertion.decimals ?? 2);",
      "    const scaled = actual * scale;",
      "    return Math.abs(scaled - Math.round(scaled)) < 1e-6 ? undefined : `is_rounded ${assertion.path}: ${actual} is not rounded to ${assertion.decimals ?? 2} decimals`;",
      "  }",
      "  return `unknown assertion kind ${assertion.kind}`;",
      "}",
      `console.log(${JSON.stringify(ORACLE_OUTPUT_PREFIX)} + JSON.stringify(results));`
    ].join("\n");
    const { stdout } = await execFileAsync(process.execPath, ["--eval", script], {
      timeout: 10000,
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
      failures: [],
      error: detail
    }));
  }
}

function failedImportCases(cases: OracleCase[]): CaseEvaluation[] {
  return cases.map((testCase) => ({
    ...testCase,
    actual: false,
    failures: [],
    error: "No oracle output was produced."
  }));
}
