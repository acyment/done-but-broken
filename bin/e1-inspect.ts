import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadE1Constants } from "../src/e1-l1-constants";
import { inspectE1Bundle, renderE1InspectionLines } from "../src/e1-inspect";

const repoRoot = resolve(import.meta.dir, "..");
const constantsPath = join(repoRoot, "docs", "protocols", "e1-frontier-sealed-constants-v0.2.json");

function printHelp(): void {
  console.log(
    [
      "Usage: bun run e1:inspect -- --bundle <path> [--task cartcalc | --task-package <path> --oracle-package <path>]",
      "",
      "Replays an E1 bundle's recorded turns onto fresh template mounts, byte-compares",
      "per-turn and final workspace hashes, recomputes oracle scoring, metrics, and the",
      "content-hash manifest, and exits non-zero on any mismatch."
    ].join("\n")
  );
}

const args = Bun.argv.slice(2).filter((arg) => arg !== "--");

if (args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
}

const flags = new Map<string, string>();

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];

  if (!arg.startsWith("--")) {
    console.error(`Unexpected positional argument: ${arg}`);
    process.exit(1);
  }

  const equals = arg.indexOf("=");

  if (equals !== -1) {
    flags.set(arg.slice(2, equals), arg.slice(equals + 1));
    continue;
  }

  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    console.error(`Missing value for ${arg}`);
    process.exit(1);
  }

  flags.set(arg.slice(2), value);
  index += 1;
}

const bundlePath = flags.get("bundle");

if (!bundlePath) {
  printHelp();
  process.exit(1);
}

let taskPackagePath = flags.get("task-package");
let oraclePackagePath = flags.get("oracle-package");
const task = flags.get("task");

if (task === "cartcalc") {
  taskPackagePath = join(repoRoot, "tasks", "e1-cartcalc", "task-package");
  oraclePackagePath = join(repoRoot, "tasks", "e1-cartcalc", "oracle-package");
}

if (!taskPackagePath || !oraclePackagePath) {
  console.error("Provide --task cartcalc or both --task-package and --oracle-package");
  process.exit(1);
}

const tmpRoot = await mkdtemp(join(tmpdir(), "e1-inspect-"));

try {
  const report = await inspectE1Bundle({
    constants: await loadE1Constants(constantsPath),
    bundlePath,
    taskPackagePath,
    oraclePackagePath,
    tmpRoot
  });

  for (const line of renderE1InspectionLines(report)) {
    console.log(line);
  }

  process.exit(report.valid ? 0 : 1);
} finally {
  await rm(tmpRoot, { recursive: true, force: true });
}
