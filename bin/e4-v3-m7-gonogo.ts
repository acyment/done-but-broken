// v3-M7 evidence verdict CLI (pre-registration §2/§9; the M6 CLI bin/e4-v3-gonogo.ts is left
// untouched as that boundary's instrument). Two-arm, composition-proof form. Exit 0 = go,
// 1 = no-go (prints which predicate failed), 2 = inconclusive_uninterpretable (prints which
// trigger fired), 3 = operational error. The printed report is the ONLY claim source.
//
//   bun run bin/e4-v3-m7-gonogo.ts <runRoot...> [--v2-constants <path>] [--v3-constants <path>]
//                                  [--v1-constants <path>]
//
// Each <runRoot> may contain manifest-*.json directly or immediate subdirectories that do.
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadE4Constants } from "../src/e4/constants";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants } from "../src/e4/v2/constants";
import { E4_V3_CONSTANTS_PATH, loadE4V3Constants } from "../src/e4/v3/constants";
import { computeE4V3M7GoNoGo, E4_V3_M7_ARMS } from "../src/e4/v3/evidence-gonogo";
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

function fmt(value: number | null, digits = 4): string {
  return value === null ? "null" : Number(value.toFixed(digits)).toString();
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
      "usage: bun run bin/e4-v3-m7-gonogo.ts <runRoot...> [--v2-constants <path>] [--v3-constants <path>] [--v1-constants <path>]"
    );
    return 3;
  }

  const v2ConstantsPath = flagValue(args, "--v2-constants") ?? join(repoRoot, E4_V2_CONSTANTS_PATH);
  const v3ConstantsPath = flagValue(args, "--v3-constants") ?? join(repoRoot, E4_V3_CONSTANTS_PATH);
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
  const report = computeE4V3M7GoNoGo({
    manifests,
    constants,
    constantsHash: hash,
    v3Constants,
    v3ConstantsHash: v3Hash,
    conventionAggregationMinItems: v1Constants.meter_rules.convention_aggregation_min_items
  });

  for (const group of report.groups) {
    console.log(
      `pairing ${group.pairing_label} (seed ${group.substrate_seed}): ${
        group.surviving ? "surviving" : `EXCLUDED — ${group.exclusion_reasons.join("; ")}`
      }`
    );
  }

  for (const trigger of report.triggers) {
    console.log(`trigger ${trigger.id}: ${trigger.fired ? "FIRED" : "clear"} — ${trigger.detail}`);
  }

  const { a_arm0_drifts: a, b_boundary_stamp: b, c_primary_burden: c } = report.predicates;
  console.log(
    `(a) arm-0 drifts on every surviving seed: ${a.holds} [${a.per_seed_velocity
      .map((entry) => `seed ${entry.seed}: ${fmt(entry.velocity, 2)}`)
      .join(", ")}]`
  );
  console.log(`(b) boundary stamp (v2 + v3 + harness commit): ${b.holds} — ${b.detail}`);
  console.log(
    `(c) PRIMARY composition-proof freshness arm0 vs armP: ${c.holds} [c1 burden AUC ${fmt(c.c1_auc.left_mean, 3)} vs ${fmt(
      c.c1_auc.right_mean,
      3
    )}, direction ${c.c1_auc.direction_holds}; guard ${c.guard.holds} (done rates ${fmt(c.guard.arm0_done_rate, 3)} vs ${fmt(
      c.guard.armp_done_rate,
      3
    )}, sealed max gap ${c.guard.sealed_max_gap})]`
  );

  for (const entry of c.per_sequence_burden) {
    console.log(`burden seed ${entry.seed} ${entry.arm}: [${entry.burden_by_checkpoint.join(", ")}] AUC ${fmt(entry.auc, 3)}`);
  }

  const s = report.secondaries;
  for (const arm of E4_V3_M7_ARMS) {
    const fc = s.fc_given_done[arm];
    const d = s.disposition[arm];
    console.log(
      `secondary fc|done ${arm}: ${fmt(fc.rate, 3)} [${fc.events}/${fc.done}] | disposition {truthful_close ${d.truthful_close}, false_close ${d.false_close}, nonclose ${d.nonclose} (${Object.entries(
        d.nonclose_by_termination
      )
        .map(([key, count]) => `${key}: ${count}`)
        .join(", ") || "none"})} of ${d.scheduled} scheduled`
    );
  }
  console.log(
    `secondary matched pairs (both closed): ${s.matched_pairs.pairs} — concordant honest ${s.matched_pairs.concordant_honest}, concordant false ${s.matched_pairs.concordant_false}, discordant arm0-lied ${s.matched_pairs.discordant_arm0_lied}, discordant armP-lied ${s.matched_pairs.discordant_armp_lied}`
  );

  const diag = report.diagnostics;
  for (const arm of E4_V3_M7_ARMS) {
    const fc = diag.fc_over_attempted_NEVER_HONESTY_AT_CLOSE[arm];
    console.log(
      `diagnostic fc-over-attempted (NEVER honesty-at-close) ${arm}: ${fmt(fc.rate, 3)} [${fc.events}/${fc.attempted}]`
    );
  }
  console.log(
    `diagnostic refused_done_over_red: ${Object.entries(diag.refused_done_over_red_by_arm)
      .map(([arm, count]) => `${arm} ${count}`)
      .join(", ")}`
  );
  console.log(
    `diagnostic ASK_PM usage: ${Object.entries(diag.ask_pm_by_arm)
      .map(([arm, usage]) => `${arm} ${usage.requested}/${usage.complete}`)
      .join(", ")}`
  );
  const gate = diag.product_gate_arm_p;
  console.log(
    `diagnostic product gate (arm p): pm_review_refusals=${gate.pm_review_refusals} reconcile_refusals=${gate.reconcile_refusals} mutation_refusals=${gate.mutation_refusals} pm_review_flags=${gate.pm_review_flags_total} reconcile_unavailable=${gate.reconcile_unavailable_count}`
  );

  for (const entry of diag.floor) {
    console.log(
      `floor ${entry.arm} seed ${entry.substrate_seed}: ${entry.floor_collapsed ? `COLLAPSED — ${entry.detail}` : "clear"}`
    );
  }

  for (const arm of Object.keys(diag.class_composition_by_arm)) {
    const totals = diag.class_composition_by_arm[arm];
    const parts = Object.entries(totals).flatMap(([kind, classes]) =>
      Object.entries(classes)
        .filter(([, count]) => count > 0)
        .map(([cls, count]) => `${kind}/${cls}=${count}`)
    );
    console.log(`diagnostic ${arm} drift composition: ${parts.join(" ") || "(none)"}`);
  }

  for (const flag of diag.advisory_flags) {
    console.log(`advisory: ${flag}`);
  }

  if (report.failed_predicates.length > 0) {
    console.log(`failed predicates: ${report.failed_predicates.join(" | ")}`);
  }

  console.log(`verdict: ${report.verdict === "inconclusive_uninterpretable" ? "inconclusive (uninterpretable)" : report.verdict}`);
  return report.exit_code;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(String(error?.message ?? error));
    process.exit(3);
  });
