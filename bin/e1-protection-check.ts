// E1-protection triad (Gate-0 Q2, docs/e4/GATE-0-DECISIONS.md): the per-milestone check that the
// E4 program must run after every milestone. Three legs, fail-fast, single command:
//   1. sealed-constants file hash unchanged (the seal document itself, beyond value-pinning tests)
//   2. full `bun test` green (379/379 baseline or approved successor)
//   3. one canned-transport `e1` smoke run into gitignored tmp/ (protects the end-to-end CLI path
//      that value-pinning doesn't: entry, wiring, imports), keeping runs/ clean of throwaway runs.
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const constantsPath = join(repoRoot, "docs", "protocols", "e1-frontier-sealed-constants-v1.0.json");
const SEALED_CONSTANTS_SHA256 = "c10aa82db5a6a5b31291334812b8a3effa2ef160a56dd37a9f6f53302c7ceae4";
const smokeRunsRoot = join(repoRoot, "tmp", "e1-protection-smoke");
const smokeRunId = "e1-protection-smoke";

try {
  await checkConstantsHash();
  // Clean before the test leg: a prior smoke run leaves workspace *.spec.ts files under tmp/ that
  // `bun test` would otherwise pick up, polluting the approved test-count baseline.
  await rm(smokeRunsRoot, { recursive: true, force: true });
  await runFullTestSuite();
  await runCannedSmoke();
  console.log("e1:protect PASS — sealed-constants hash, full test suite, canned e1 smoke all green");
} catch (error) {
  console.error(`e1:protect FAIL — ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

async function checkConstantsHash(): Promise<void> {
  const bytes = await Bun.file(constantsPath).arrayBuffer();
  const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

  if (digest !== SEALED_CONSTANTS_SHA256) {
    throw new Error(
      `sealed constants file changed: expected sha256 ${SEALED_CONSTANTS_SHA256}, got ${digest} (${constantsPath})`
    );
  }

  console.log("e1:protect [1/3] sealed-constants hash unchanged");
}

async function runFullTestSuite(): Promise<void> {
  const proc = Bun.spawn(["bun", "test", "--path-ignore-patterns=runs/**", "--path-ignore-patterns=tmp/**"], {
    cwd: repoRoot,
    stdout: "inherit",
    stderr: "inherit"
  });

  if ((await proc.exited) !== 0) {
    throw new Error("`bun test` is not green");
  }

  console.log("e1:protect [2/3] full test suite green");
}

async function runCannedSmoke(): Promise<void> {
  await rm(smokeRunsRoot, { recursive: true, force: true });

  const proc = Bun.spawn(
    [
      "bun",
      "run",
      join(repoRoot, "bin", "e1.ts"),
      "--task=cartcalc",
      "--arm=both",
      "--transport=canned",
      "--cap=1",
      `--runs-root=${smokeRunsRoot}`,
      `--run-id=${smokeRunId}`
    ],
    { cwd: repoRoot, stdout: "pipe", stderr: "pipe" }
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ]);

  if (exitCode !== 0) {
    throw new Error(`canned e1 smoke run exited ${exitCode}\n${stdout}${stderr}`);
  }

  if (!stdout.includes("invalid_run=false")) {
    throw new Error(`canned e1 smoke run did not report invalid_run=false\n${stdout}`);
  }

  const bundlePath = join(smokeRunsRoot, smokeRunId, "e1-task-package-provider-bundle.json");

  if (!(await Bun.file(bundlePath).exists())) {
    throw new Error(`canned e1 smoke run emitted no bundle at ${bundlePath}`);
  }

  console.log(`e1:protect [3/3] canned e1 smoke green (bundle at ${bundlePath})`);
}
