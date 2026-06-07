import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentAdapter } from "../../src/runner";

const repoRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/test\/support$/, "");
const referencePath = join(
  repoRoot,
  "tasks",
  "pricing-discount-lifecycle",
  "hidden-oracle",
  "reference",
  "pricing.ts"
);

const REFERENCE_MAX_DISCOUNT =
  "  const maxDiscount =\n" +
  "    state.cap !== undefined ? preDiscountSubtotal * (state.cap.maxDiscountPercent / 100) : Number.POSITIVE_INFINITY;";
// Plausibly-naive cap: ignores the configured cap_set value and hardcodes a 50% "safety"
// cap that is not a no-op when the real discount is below it.
const NAIVE_MAX_DISCOUNT = "  const maxDiscount = preDiscountSubtotal * 0.5;";

const REFERENCE_LINE_TOTAL = "const lineTotal = netUnit * line.quantity;";
// Plausibly-naive rounding: rounds each line total per stage, which the I09 spec forbids.
const NAIVE_LINE_TOTAL = "const lineTotal = Math.round((netUnit * line.quantity + Number.EPSILON) * 100) / 100;";

async function loadReferenceSource(): Promise<string> {
  return readFile(referencePath, "utf8");
}

function applyNaiveCap(source: string): string {
  if (!source.includes(REFERENCE_MAX_DISCOUNT)) {
    throw new Error("Reference cap block not found; naive-agent fixture is out of date with the reference.");
  }

  return source.replace(REFERENCE_MAX_DISCOUNT, NAIVE_MAX_DISCOUNT);
}

function applyNaiveRounding(source: string): string {
  if (!source.includes(REFERENCE_LINE_TOTAL)) {
    throw new Error("Reference line-total expression not found; naive-agent fixture is out of date with the reference.");
  }

  return source.replace(REFERENCE_LINE_TOTAL, NAIVE_LINE_TOTAL);
}

async function writePricing(workspacePath: string, source: string): Promise<void> {
  await writeFile(join(workspacePath, "src", "pricing.ts"), source);
}

// A careful agent that always installs the full, correct reference implementation.
// It should pass every checkpoint with zero regressions.
export function createPricingReferenceAgent(): AgentAdapter {
  return {
    async run(input) {
      await writePricing(input.workspace_path, await loadReferenceSource());

      return {
        status: "ok",
        adapter_id: "pricing-reference-agent",
        notes: `installed reference pricing for ${input.checkpoint_id}`,
        transcript: [{ event: "write_workspace", detail: "src/pricing.ts" }]
      };
    }
  };
}

// A plausibly-naive agent that implements the first six checkpoints correctly, then
// introduces a hardcoded discount cap at I07 (which regresses the earlier fixed-coupon
// commitment) and per-stage line rounding at I09 (which regresses the earlier line-sale
// commitment). It demonstrates that this task can produce true cross-checkpoint
// regressions, unlike the existing tasks.
export function createPricingNaiveAgent(): AgentAdapter {
  return {
    async run(input) {
      const reference = await loadReferenceSource();
      let source = reference;
      let variant = "reference";

      if (input.checkpoint_id === "I07" || input.checkpoint_id === "I08") {
        source = applyNaiveCap(reference);
        variant = "naive-cap";
      } else if (input.checkpoint_id === "I09") {
        source = applyNaiveRounding(applyNaiveCap(reference));
        variant = "naive-cap-and-rounding";
      }

      await writePricing(input.workspace_path, source);

      return {
        status: "ok",
        adapter_id: "pricing-naive-agent",
        notes: `installed ${variant} pricing for ${input.checkpoint_id}`,
        transcript: [{ event: "write_workspace", detail: `src/pricing.ts (${variant})` }]
      };
    }
  };
}
