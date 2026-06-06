import { execFile } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { HiddenOracleAdapter, HiddenOracleRunInput, HiddenOracleRunResult } from "./runner";
import type { OracleCheckResult } from "./result-schema";

const execFileAsync = promisify(execFile);
const ORACLE_OUTPUT_PREFIX = "__SAMPLE_CART_ORACLE_OUTPUT__";

const COMMITMENTS_BY_CHECKPOINT = {
  I01: ["cart-total-visible"],
  I02: ["cart-total-visible", "discount-does-not-hide-total"],
  I03: ["cart-total-visible", "discount-does-not-hide-total", "item-names-remain-visible"]
} as const;

type SampleCartCheckpoint = keyof typeof COMMITMENTS_BY_CHECKPOINT;

export function createSampleCartOracle(): HiddenOracleAdapter {
  return {
    async run(input) {
      return evaluateSampleCartWorkspace(input);
    }
  };
}

export async function evaluateSampleCartWorkspace(
  input: HiddenOracleRunInput
): Promise<HiddenOracleRunResult> {
  const renderedCart = await renderSampleCart(input.workspace_path);
  const commitments = activeCommitments(input.checkpoint_id);
  const checks = commitments.map((commitment_id) =>
    evaluateCommitment(input.checkpoint_id, commitment_id, renderedCart)
  );

  return {
    status: checks.every((check) => check.passed) ? "ok" : "failed",
    checks
  };
}

function activeCommitments(checkpoint_id: string): readonly string[] {
  return COMMITMENTS_BY_CHECKPOINT[checkpoint_id as SampleCartCheckpoint] ?? [];
}

function evaluateCommitment(
  checkpoint_id: string,
  commitment_id: string,
  renderedCart: string
): OracleCheckResult {
  if (commitment_id === "cart-total-visible") {
    const passed = /\bTotal\b/.test(renderedCart);

    return {
      check_id: `sample-cart:${checkpoint_id}:cart-total-visible`,
      commitment_id,
      passed,
      details: passed
        ? "src/cart.ts renders a Total label."
        : "Expected src/cart.ts to render a Total label."
    };
  }

  if (commitment_id === "discount-does-not-hide-total") {
    const passed = /\bTotal\b/.test(renderedCart) && /\bDiscounts\b/.test(renderedCart);

    return {
      check_id: `sample-cart:${checkpoint_id}:discount-does-not-hide-total`,
      commitment_id,
      passed,
      details: passed
        ? "src/cart.ts renders both Total and Discounts labels."
        : "Expected src/cart.ts to render both Total and Discounts labels."
    };
  }

  if (commitment_id === "item-names-remain-visible") {
    const passed =
      /\bTotal\b/.test(renderedCart) &&
      /\bDiscounts\b/.test(renderedCart) &&
      /\bAlpha\b/.test(renderedCart) &&
      /\bBeta\b/.test(renderedCart);

    return {
      check_id: `sample-cart:${checkpoint_id}:item-names-remain-visible`,
      commitment_id,
      passed,
      details: passed
        ? "src/cart.ts renders item names alongside Total and Discounts labels."
        : "Expected src/cart.ts to render item names alongside Total and Discounts labels."
    };
  }

  throw new Error(`Unknown sample-cart commitment: ${commitment_id}`);
}

async function renderSampleCart(workspacePath: string): Promise<string> {
  try {
    const cartUrl = pathToFileURL(join(workspacePath, "src", "cart.ts")).href;
    const script = [
      `const cartModule = await import(${JSON.stringify(cartUrl)});`,
      "const renderCart = cartModule.renderCart;",
      "let output = '';",
      "if (typeof renderCart === 'function') {",
      "  output = await renderCart([{ name: 'Alpha', price: 4 }, { name: 'Beta', price: 6 }], [{ label: 'sale' }]);",
      "}",
      `console.log(${JSON.stringify(ORACLE_OUTPUT_PREFIX)} + JSON.stringify(String(output ?? '')));`
    ].join("\n");
    const { stdout } = await execFileAsync(process.execPath, ["--eval", script], {
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });
    const outputLine = stdout
      .trimEnd()
      .split("\n")
      .findLast((line) => line.startsWith(ORACLE_OUTPUT_PREFIX));

    return outputLine ? JSON.parse(outputLine.slice(ORACLE_OUTPUT_PREFIX.length)) : "";
  } catch {
    return "";
  }
}
