// Materializes an isolated-competence baseline directory: the reference src tree with the
// named stage's file variants applied (a workspace correctly implementing checkpoints up to
// that stage and nothing later). Output feeds `bun run e1 -- --baseline-dir <dir>`.
//
// Usage: bun tasks/e1-billing-v3/materialize-stage.ts <cp04|cp09|cp14> <output-dir>
//
// Available stages cover the frozen-baseline sample points (k=5, 10, 15). Isolated-competence
// diagnostics at every checkpoint (a Stage 2 entry gate) require the remaining per-checkpoint
// stage variants to be built and frozen first.

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";

const here = import.meta.dir;
const [stage, outDir] = process.argv.slice(2);

if (!stage || !outDir) {
  console.error("Usage: bun tasks/e1-billing-v3/materialize-stage.ts <cp04|cp09|cp14> <output-dir>");
  process.exit(1);
}

const STAGE_FILE_MAPPING: Record<string, string> = {
  money: "src/domain/money.ts",
  subscription: "src/domain/subscription.ts",
  invoice: "src/domain/invoice.ts",
  audit: "src/events/audit.ts",
  serializers: "src/api/serializers.ts",
  billingtypes: "src/billing-types.ts",
  billinghandlers: "src/billing-handlers.ts",
  billinginvoicehandlers: "src/billing-invoice-handlers.ts",
  billing: "src/billing.ts"
};

const files: Record<string, string> = {};
const referenceRoot = join(here, "reference", "src");

async function walk(dir: string): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      await walk(full);
    } else if (entry.isFile()) {
      files[`src/${relative(referenceRoot, full).split(sep).join("/")}`] = await readFile(full, "utf8");
    }
  }
}

await walk(referenceRoot);

const stagesDir = join(here, "reference", "stages");
let applied = 0;

for (const entry of await readdir(stagesDir)) {
  const match = entry.match(/^([a-z]+)\.(cp\d+)\.ts$/);

  if (match && match[2] === stage && STAGE_FILE_MAPPING[match[1]]) {
    files[STAGE_FILE_MAPPING[match[1]]] = await readFile(join(stagesDir, entry), "utf8");
    applied += 1;
  }
}

// Pre-v2 stages use the pre-v2 serializer variant.
if (stage === "cp09" || stage === "cp14") {
  files["src/api/serializers.ts"] = await readFile(join(stagesDir, "serializers.cp14.ts"), "utf8");
  applied += 1;
}

if (applied === 0) {
  console.error(`No stage variants found for ${stage}`);
  process.exit(1);
}

for (const [path, content] of Object.entries(files).sort()) {
  const target = join(outDir, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

console.log(`stage=${stage} files=${Object.keys(files).length} stage_variants_applied=${applied} out=${outDir}`);
