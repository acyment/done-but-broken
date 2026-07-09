// v2 go/no-go CLI — the v2-M7 verdict tool's executable face (pre-registration §2: "exit
// semantics carry over unchanged"). Evaluates emitted v2 manifests against the sealed v2
// constants. Exit 0 = go, 1 = no-go (prints which predicate failed), 2 =
// inconclusive_uninterpretable (prints which trigger fired; predicates still printed for
// diagnosis but carrying no claim); 3 = operational error (bad input).
//
//   bun run bin/e4-v2-gonogo.ts <runRoot...> [--constants <path>] [--v1-constants <path>]
//
// Each <runRoot> may contain manifest-*.json directly (the bin/e4-v2.ts per-seed layout) or
// immediate subdirectories that do (a committed docs/protocols provenance folder with one
// subdirectory per seed).
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadE4Constants } from "../src/e4/constants";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants } from "../src/e4/v2/constants";
import { computeE4V2GoNoGo } from "../src/e4/v2/gonogo";
import { validateE4V2Manifest, type E4V2RunManifest } from "../src/e4/v2/manifest";

const repoRoot = resolve(import.meta.dir, "..");

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

async function collectManifests(runRoots: string[]): Promise<E4V2RunManifest[]> {
  const files: string[] = [];

  for (const root of runRoots) {
    files.push(...(await manifestFilesIn(root)));

    let entries: string[];

    try {
      entries = (await readdir(root)).sort();
    } catch {
      throw new Error(`cannot read run root: ${root}`);
    }

    for (const entry of entries) {
      const child = join(root, entry);

      if ((await stat(child)).isDirectory()) {
        files.push(...(await manifestFilesIn(child)));
      }
    }
  }

  if (files.length === 0) {
    throw new Error(`no manifest-*.json found under: ${runRoots.join(", ")}`);
  }

  const manifests: E4V2RunManifest[] = [];

  for (const file of files) {
    manifests.push(validateE4V2Manifest(JSON.parse(await readFile(file, "utf8"))));
  }

  return manifests;
}

function flagValue(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : null;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const positional: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--constants" || args[i] === "--v1-constants") {
      i += 1;
      continue;
    }
    positional.push(args[i]);
  }

  if (positional.length === 0) {
    console.error("usage: bun run bin/e4-v2-gonogo.ts <runRoot...> [--constants <path>] [--v1-constants <path>]");
    return 3;
  }

  const constantsPath = flagValue(args, "--constants") ?? join(repoRoot, E4_V2_CONSTANTS_PATH);
  // The convention-aggregation constant comes from the FROZEN v1 file (meter_rules, v0.7): the
  // v2 constants carry no meter_rules block because the v1 episode semantics apply unchanged.
  const v1ConstantsPath =
    flagValue(args, "--v1-constants") ?? join(repoRoot, "docs", "protocols", "e4-sealed-constants-v0.json");

  const { constants, hash } = await loadE4V2Constants(constantsPath);
  const { constants: v1Constants } = await loadE4Constants(v1ConstantsPath);

  if (v1Constants.meter_rules.convention_aggregation_min_items === null) {
    throw new Error("v1 sealed constants are pre-M2: convention_aggregation_min_items missing");
  }

  const manifests = await collectManifests(positional);
  const report = computeE4V2GoNoGo({
    manifests,
    constants,
    constantsHash: hash,
    conventionAggregationMinItems: v1Constants.meter_rules.convention_aggregation_min_items
  });

  for (const group of report.groups) {
    console.log(
      `pairing ${group.pairing_label} (seed ${group.substrate_seed}): ${group.surviving ? "surviving" : `EXCLUDED — ${group.exclusion_reasons.join("; ")}`}`
    );
  }

  for (const trigger of report.triggers) {
    console.log(`trigger ${trigger.id}: ${trigger.fired ? "FIRED" : "clear"} — ${trigger.detail}`);
  }

  const { a_arm0_drifts, b_boundary_stamp, c_separation } = report.predicates;

  console.log(
    `(a) arm-0 drifts on every surviving seed: ${a_arm0_drifts.holds} [${a_arm0_drifts.per_seed_velocity
      .map((entry) => `seed ${entry.seed}: ${entry.velocity ?? "null"}`)
      .join(", ")}]`
  );
  console.log(`(b) boundary stamp: ${b_boundary_stamp.holds} — ${b_boundary_stamp.detail}`);
  console.log(
    `(c) separation: ${c_separation.holds} [c1 ${c_separation.c1_velocity.holds} (0: ${c_separation.c1_velocity.arm0_mean ?? "null"} vs H: ${c_separation.c1_velocity.arm_h_mean ?? "null"}); ` +
      `c2 ${c_separation.c2_false_confidence.holds} (0: ${c_separation.c2_false_confidence.arm0_rate ?? "null"} [${c_separation.c2_false_confidence.arm0_events}/${c_separation.c2_false_confidence.attempted.arm0}] vs H: ${c_separation.c2_false_confidence.arm_h_rate ?? "null"} [${c_separation.c2_false_confidence.arm_h_events}/${c_separation.c2_false_confidence.attempted.arm_h}])]`
  );
  console.log(
    `diagnostic refused_done_over_red (never the predicate): arm0 ${c_separation.c2_false_confidence.refused_done_over_red_diagnostic.arm0}, arm_h ${c_separation.c2_false_confidence.refused_done_over_red_diagnostic.arm_h}`
  );

  for (const entry of report.diagnostics.floor) {
    console.log(
      `floor ${entry.arm} seed ${entry.substrate_seed}: ${entry.floor_collapsed ? `COLLAPSED at task ${entry.trigger_task_index}` : "clear"}`
    );
  }

  if (report.diagnostics.h4_analog_blocked_floor_confounded) {
    console.log(
      "floor rule: H4-analog slope blocked as floor-confounded; (c) evaluated on the remaining comparisons (c1/c2 do not read it)"
    );
  }

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
    console.log(
      `verdict: inconclusive_uninterpretable (${report.triggers.filter((t) => t.fired).map((t) => t.id).join(", ")})`
    );
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
