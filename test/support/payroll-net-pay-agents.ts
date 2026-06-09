import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentAdapter } from "../../src/runner";

const repoRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/test\/support$/, "");
const referencePath = join(
  repoRoot,
  "tasks",
  "payroll-net-pay-lifecycle",
  "hidden-oracle",
  "reference",
  "payroll.ts"
);

const REFERENCE_PRE_TAX = "  const ordinaryPreTax = sumValues(state.preTaxDeductions);";
const NAIVE_PRE_TAX = "  const ordinaryPreTax = 0;";

const REFERENCE_SOCIALISH = "  return taxable * SOCIALISH_RATE;";
const NAIVE_SOCIALISH = "  return gross * SOCIALISH_RATE;";

async function loadReferenceSource(): Promise<string> {
  return readFile(referencePath, "utf8");
}

function applyNaivePreTaxRegression(source: string): string {
  if (!source.includes(REFERENCE_PRE_TAX)) {
    throw new Error("Reference pre-tax expression not found; payroll naive fixture is out of date.");
  }

  return source.replace(REFERENCE_PRE_TAX, NAIVE_PRE_TAX);
}

function applyNaiveSocialishRegression(source: string): string {
  if (!source.includes(REFERENCE_SOCIALISH)) {
    throw new Error("Reference socialish expression not found; payroll naive fixture is out of date.");
  }

  return source.replace(REFERENCE_SOCIALISH, NAIVE_SOCIALISH);
}

async function writePayroll(workspacePath: string, source: string): Promise<void> {
  await writeFile(join(workspacePath, "src", "payroll.ts"), source);
}

export function createPayrollReferenceAgent(): AgentAdapter {
  return {
    async run(input) {
      await writePayroll(input.workspace_path, await loadReferenceSource());

      return {
        status: "ok",
        adapter_id: "payroll-reference-agent",
        notes: `installed reference payroll for ${input.checkpoint_id}`,
        transcript: [{ event: "write_workspace", detail: "src/payroll.ts" }]
      };
    }
  };
}

export function createPayrollNaiveAgent(): AgentAdapter {
  return {
    async run(input) {
      const reference = await loadReferenceSource();
      let source = reference;
      let variant = "reference";

      if (input.checkpoint_id === "C07" || input.checkpoint_id === "C08") {
        source = applyNaivePreTaxRegression(reference);
        variant = "naive-pre-tax-regression";
      } else if (["C12", "C13", "C14", "C15", "C16", "C17", "C18"].includes(input.checkpoint_id)) {
        source = applyNaiveSocialishRegression(reference);
        variant = "naive-socialish-cap-regression";
      }

      await writePayroll(input.workspace_path, source);

      return {
        status: "ok",
        adapter_id: "payroll-naive-agent",
        notes: `installed ${variant} payroll for ${input.checkpoint_id}`,
        transcript: [{ event: "write_workspace", detail: `src/payroll.ts (${variant})` }]
      };
    }
  };
}
