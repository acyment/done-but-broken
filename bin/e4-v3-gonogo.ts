// v3 go/no-go CLI — the v3-M6 verdict tool's executable face (pre-registration §2; the v2 CLI
// bin/e4-v2-gonogo.ts is left untouched as the M7/M8 instrument). Evaluates emitted v3 manifests
// against BOTH sealed constants files (the frozen v2 base + the v3 extension that pins it). Exit
// 0 = go, 1 = no-go (prints which predicate failed), 2 = inconclusive_uninterpretable (prints
// which trigger fired; predicates still printed for diagnosis but carrying no claim); 3 =
// operational error (bad input).
//
//   bun run bin/e4-v3-gonogo.ts <runRoot...> [--v2-constants <path>] [--v3-constants <path>]
//                               [--v1-constants <path>]
//
// Each <runRoot> may contain manifest-*.json directly (the bin/e4-v3.ts per-seed layout) or
// immediate subdirectories that do (a committed docs/protocols provenance folder with one
// subdirectory per seed).
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadE4Constants } from "../src/e4/constants";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants } from "../src/e4/v2/constants";
import { E4_V3_CONSTANTS_PATH, loadE4V3Constants } from "../src/e4/v3/constants";
import { computeE4V3GoNoGo } from "../src/e4/v3/gonogo";
import { validateE4V2Manifest, type E4V2RunManifest } from "../src/e4/v2/manifest";

const repoRoot = resolve(import.meta.dir, "..");
const FLAGS = ["--v2-constants", "--v3-constants", "--v1-constants"];

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

function fmtVelocity(contrast: { holds: boolean; left_mean: number | null; right_mean: number | null }): string {
  return `${contrast.holds} (${contrast.left_mean ?? "null"} vs ${contrast.right_mean ?? "null"})`;
}

function fmtFc(contrast: {
  holds: boolean;
  left_rate: number | null;
  right_rate: number | null;
  left_events: number;
  right_events: number;
  attempted: { left: number; right: number };
}): string {
  return (
    `${contrast.holds} (${contrast.left_rate ?? "null"} [${contrast.left_events}/${contrast.attempted.left}] vs ` +
    `${contrast.right_rate ?? "null"} [${contrast.right_events}/${contrast.attempted.right}])`
  );
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const positional: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    if (FLAGS.includes(args[i])) {
      i += 1;
      continue;
    }
    positional.push(args[i]);
  }

  if (positional.length === 0) {
    console.error(
      "usage: bun run bin/e4-v3-gonogo.ts <runRoot...> [--v2-constants <path>] [--v3-constants <path>] [--v1-constants <path>]"
    );
    return 3;
  }

  const v2ConstantsPath = flagValue(args, "--v2-constants") ?? join(repoRoot, E4_V2_CONSTANTS_PATH);
  const v3ConstantsPath = flagValue(args, "--v3-constants") ?? join(repoRoot, E4_V3_CONSTANTS_PATH);
  // The convention-aggregation constant comes from the FROZEN v1 file (meter_rules, v0.7): the
  // v1 episode semantics apply unchanged through v2 and v3 (§7.5 pin).
  const v1ConstantsPath =
    flagValue(args, "--v1-constants") ?? join(repoRoot, "docs", "protocols", "e4-sealed-constants-v0.json");

  const { constants, hash } = await loadE4V2Constants(v2ConstantsPath);
  const { constants: v3Constants, hash: v3Hash } = await loadE4V3Constants({
    v3Path: v3ConstantsPath,
    v2Path: v2ConstantsPath
  });
  const { constants: v1Constants } = await loadE4Constants(v1ConstantsPath);

  if (v1Constants.meter_rules.convention_aggregation_min_items === null) {
    throw new Error("v1 sealed constants are pre-M2: convention_aggregation_min_items missing");
  }

  const manifests = await collectManifests(positional);
  const report = computeE4V3GoNoGo({
    manifests,
    constants,
    constantsHash: hash,
    v3Constants,
    v3ConstantsHash: v3Hash,
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

  const { a_arm0_drifts, b_boundary_stamp, c_primary_separation } = report.predicates;

  console.log(
    `(a) arm-0 drifts on every surviving seed: ${a_arm0_drifts.holds} [${a_arm0_drifts.per_seed_velocity
      .map((entry) => `seed ${entry.seed}: ${entry.velocity ?? "null"}`)
      .join(", ")}]`
  );
  console.log(`(b) boundary stamp (v2 + v3): ${b_boundary_stamp.holds} — ${b_boundary_stamp.detail}`);
  console.log(
    `(c) PRIMARY separation arm0 vs armP: ${c_primary_separation.holds} [c1 velocity ${fmtVelocity(c_primary_separation.c1_velocity)}; ` +
      `c2 false-confidence ${fmtFc(c_primary_separation.c2_false_confidence)}]`
  );

  const { d_secondary_armh_vs_armp, e_replication_arm0_vs_armh } = report.reported_contrasts;

  console.log(
    `(d) SECONDARY armH vs armP (reported, no verdict weight): [d1 velocity ${fmtVelocity(d_secondary_armh_vs_armp.d1_velocity)}; ` +
      `d2 false-confidence ${fmtFc(d_secondary_armh_vs_armp.d2_false_confidence)}]`
  );
  console.log(
    `(e) REPLICATION arm0 vs armH (reported, no verdict weight): [e1 velocity ${fmtVelocity(e_replication_arm0_vs_armh.e1_velocity)}; ` +
      `e2 false-confidence ${fmtFc(e_replication_arm0_vs_armh.e2_false_confidence)}]`
  );

  console.log(
    `diagnostic refused_done_over_red (never the predicate): ${Object.entries(report.diagnostics.refused_done_over_red_by_arm)
      .map(([arm, count]) => `${arm} ${count}`)
      .join(", ")}`
  );
  console.log(
    `diagnostic ASK_PM usage: ${Object.entries(report.diagnostics.ask_pm_by_arm)
      .map(([arm, usage]) => `${arm} ${usage.requested}/${usage.complete}`)
      .join(", ")}`
  );

  const productGate = report.diagnostics.product_gate_arm_p;

  console.log(
    `diagnostic product gate (arm p): pm_review_refusals=${productGate.pm_review_refusals} reconcile_refusals=${productGate.reconcile_refusals} ` +
      `mutation_refusals=${productGate.mutation_refusals} pm_review_flags=${productGate.pm_review_flags_total} reconcile_unavailable=${productGate.reconcile_unavailable_count}`
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
