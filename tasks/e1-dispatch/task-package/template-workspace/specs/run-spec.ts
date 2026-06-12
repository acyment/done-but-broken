// Runnable visible spec for the dispatch engine. Executes the visible spec cases for the
// requested checkpoint cumulatively (all checkpoints up to and including --cp=<k>).
// Case files live at specs/cases/cp<NN>.json; each case calls evaluate(events, query)
// from src/dispatch.ts and deep-compares the JSON result.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

type SpecCase = {
  check_id: string;
  args: [unknown[], unknown];
  expected: unknown;
};

const CHECKPOINTS = Array.from({ length: 6 }, (_, index) => String(index + 1));
const requested = process.argv.find((arg) => arg.startsWith("--cp="))?.slice("--cp=".length) ?? "6";

if (!CHECKPOINTS.includes(requested)) {
  throw new Error(`Unknown checkpoint: ${requested}`);
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => deepEqual(item, right[index]));
  }

  if (
    typeof left === "object" &&
    typeof right === "object" &&
    left !== null &&
    right !== null &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();

    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key, index) =>
          key === rightKeys[index] &&
          deepEqual((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key])
      )
    );
  }

  return false;
}

const casesDir = join(import.meta.dir, "cases");
let fileNames: string[] = [];

try {
  fileNames = (await readdir(casesDir)).filter((name) => /^cp\d{2}\.json$/.test(name)).sort();
} catch {
  throw new Error("No visible spec case files found under specs/cases/");
}

const limit = Number(requested);
const dispatch = await import(join(import.meta.dir, "..", "src", "dispatch.ts"));
let passed = 0;
let failed = 0;

for (const fileName of fileNames) {
  const checkpoint = Number(fileName.slice(2, 4));

  if (!Number.isInteger(checkpoint) || checkpoint > limit) {
    continue;
  }

  const cases = JSON.parse(await readFile(join(casesDir, fileName), "utf8")) as SpecCase[];

  for (const specCase of cases) {
    let outcome = "";

    try {
      const actual = dispatch.evaluate(...(JSON.parse(JSON.stringify(specCase.args)) as [unknown[], unknown]));

      if (deepEqual(actual, specCase.expected)) {
        passed += 1;
        continue;
      }

      outcome = `expected ${JSON.stringify(specCase.expected)}, got ${JSON.stringify(actual)}`;
    } catch (error) {
      outcome = String(error);
    }

    failed += 1;
    console.log(`FAIL ${specCase.check_id}: ${outcome}`);
  }
}

console.log(`spec cases through cp${requested}: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
