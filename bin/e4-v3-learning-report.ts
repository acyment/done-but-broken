// [Phase-0 learning boundary] Learning-run readout CLI — the ladder's decision instrument.
// Deliberately separate from the hash-pinned verdict tool (bin/e4-v3-gonogo.ts stays the M6
// evidence instrument, byte-untouched).
//
//   bun run bin/e4-v3-learning-report.ts <runRoot...> [--json <outPath>]
//
// Each <runRoot> may contain manifest-*.json directly or immediate subdirectories that do
// (same collection shape as the verdict CLI).
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { validateE4V2Manifest, type E4V2RunManifest } from "../src/e4/v2/manifest";
import { computeE4V3LearningReport, renderE4V3LearningReport } from "../src/e4/v3/learning-report";

async function manifestFilesIn(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir))
      .filter((name) => name.startsWith("manifest-") && name.endsWith(".json"))
      .sort()
      .map((name) => join(dir, name));
  } catch {
    return [];
  }
}

const args = process.argv.slice(2);
const jsonFlagIndex = args.indexOf("--json");
const jsonOut = jsonFlagIndex >= 0 ? args[jsonFlagIndex + 1] : null;
const runRoots = args.filter(
  (arg, index) => !arg.startsWith("--") && (jsonFlagIndex < 0 || index !== jsonFlagIndex + 1)
);

if (runRoots.length === 0) {
  console.error("usage: bun run bin/e4-v3-learning-report.ts <runRoot...> [--json <outPath>]");
  process.exit(3);
}

const files: string[] = [];

for (const root of runRoots) {
  files.push(...(await manifestFilesIn(root)));

  for (const entry of (await readdir(root)).sort()) {
    const child = join(root, entry);

    if ((await stat(child)).isDirectory()) {
      files.push(...(await manifestFilesIn(child)));
    }
  }
}

if (files.length === 0) {
  console.error(`no manifest-*.json found under: ${runRoots.join(", ")}`);
  process.exit(3);
}

const manifests: E4V2RunManifest[] = [];

for (const file of files) {
  manifests.push(validateE4V2Manifest(JSON.parse(await readFile(file, "utf8"))));
}

const report = computeE4V3LearningReport(manifests);

console.log(renderE4V3LearningReport(report));

if (jsonOut) {
  await writeFile(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nreport JSON → ${jsonOut}`);
}
