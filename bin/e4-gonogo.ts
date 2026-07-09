// Go/no-go CLI (IMPLEMENTATION-PLAN.md §5, [R2: R2-7] three-valued): evaluates the emitted
// manifests under <runRoot> (multi-seed layout: <runRoot>/seed-*/manifests/*.json; a single-seed
// root with manifests/ directly also works) against the sealed constants. Exit 0 = go, 1 = no-go
// (prints which predicate failed), 2 = inconclusive_uninterpretable (prints which trigger fired);
// 3 = operational error (bad input, boundary mismatch).
//
//   bun run bin/e4-gonogo.ts <runRoot> [--constants <path>]
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadE4Constants } from "../src/e4/constants";
import { computeE4GoNoGo } from "../src/e4/gonogo";
import { validateE4RunManifest, type E4RunManifest } from "../src/e4/manifest";

const repoRoot = resolve(import.meta.dir, "..");

async function collectManifests(runRoot: string): Promise<E4RunManifest[]> {
  const manifestDirs: string[] = [];

  try {
    for (const entry of await readdir(runRoot)) {
      if (entry.startsWith("seed-")) {
        manifestDirs.push(join(runRoot, entry, "manifests"));
      }
    }
  } catch {
    throw new Error(`cannot read run root: ${runRoot}`);
  }

  if (manifestDirs.length === 0) {
    manifestDirs.push(join(runRoot, "manifests"));
  }

  const manifests: E4RunManifest[] = [];

  for (const dir of manifestDirs) {
    let files: string[];

    try {
      files = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
    } catch {
      continue;
    }

    for (const file of files) {
      manifests.push(validateE4RunManifest(JSON.parse(await readFile(join(dir, file), "utf8"))));
    }
  }

  if (manifests.length === 0) {
    throw new Error(`no manifests found under ${runRoot}`);
  }

  return manifests;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const runRoot = args.find((arg) => !arg.startsWith("--"));
  const constantsFlagIndex = args.indexOf("--constants");
  const constantsPath =
    constantsFlagIndex >= 0 ? args[constantsFlagIndex + 1] : join(repoRoot, "docs", "protocols", "e4-sealed-constants-v0.json");

  if (!runRoot) {
    console.error("usage: bun run bin/e4-gonogo.ts <runRoot> [--constants <path>]");
    return 3;
  }

  const { constants, hash } = await loadE4Constants(constantsPath);
  const manifests = await collectManifests(runRoot);
  const report = computeE4GoNoGo({ manifests, constants, constantsHash: hash });

  for (const group of report.groups) {
    console.log(
      `pairing ${group.pairing_label} (seed ${group.substrate_seed}): ${group.surviving ? "surviving" : `EXCLUDED — ${group.exclusion_reasons.join("; ")}`}`
    );
  }

  for (const trigger of report.triggers) {
    console.log(`trigger ${trigger.id}: ${trigger.fired ? "FIRED" : "clear"} — ${trigger.detail}`);
  }

  const { a_arm0_drifts, b_meter_stamp, c_separation } = report.predicates;

  console.log(
    `(a) arm-0 drifts: ${a_arm0_drifts.holds} [${a_arm0_drifts.per_seed_velocity
      .map((entry) => `seed ${entry.seed}: ${entry.velocity ?? "null"}`)
      .join(", ")}]`
  );
  console.log(`(b) meter stamp: ${b_meter_stamp.holds} — ${b_meter_stamp.detail}`);
  console.log(
    `(c) separation: ${c_separation.holds} [c1 ${c_separation.c1_velocity.holds} (0: ${c_separation.c1_velocity.arm0_mean ?? "null"} vs H: ${c_separation.c1_velocity.arm_h_mean ?? "null"}); ` +
      `c2 ${c_separation.c2_propensity.holds} (0/M: ${c_separation.c2_propensity.arm0m_rate ?? "null"} vs H: ${c_separation.c2_propensity.arm_h_rate ?? "null"}); ` +
      `c3 ${c_separation.c3_spec_freshness.holds} (M spec: ${c_separation.c3_spec_freshness.arm_m_spec_velocity ?? "null"} vs 0 spec: ${c_separation.c3_spec_freshness.arm0_spec_velocity ?? "null"})]`
  );

  // [R1-S8] / [R2: R2-10] the class-composition diagnostic is mandatory in the report, never a gate.
  for (const [arm, totals] of Object.entries(report.diagnostics.class_composition_by_arm)) {
    const nonZero = Object.entries(totals)
      .flatMap(([kind, classes]) =>
        Object.entries(classes)
          .filter(([, count]) => count > 0)
          .map(([cls, count]) => `${kind}/${cls}=${count}`)
      )
      .join(" ");
    console.log(`diagnostic ${arm} drift composition: ${nonZero || "(none)"}`);
  }

  for (const flag of report.diagnostics.advisory_flags) {
    console.log(`advisory ${flag}`);
  }

  if (report.verdict === "inconclusive_uninterpretable") {
    console.log(`verdict: inconclusive_uninterpretable (${report.triggers.filter((t) => t.fired).map((t) => t.id).join(", ")})`);
  } else if (report.verdict === "no_go") {
    console.log(`verdict: no-go (failed: ${report.failed_predicates.join("; ")})`);
  } else {
    console.log("verdict: go");
  }

  return report.exit_code;
}

try {
  process.exit(await main());
} catch (error) {
  console.error(String(error));
  process.exit(3);
}
