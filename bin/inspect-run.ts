#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { buildEvidenceStatusSummary } from "../src/evidence-status";
import {
  loadReplayPlan,
  validateReplayPlan,
  validateRunManifest,
  verifyRunArtifacts
} from "../src/provenance";
import type { RunArtifactVerification, SchemaValidation } from "../src/provenance";

type InspectOptions = {
  help?: false;
  run_manifest: string;
} | {
  help: true;
};

async function main() {
  const options = parseArgs(Bun.argv.slice(2));

  if (options.help) {
    console.log(usage());
    return;
  }

  const manifest = JSON.parse(await readFile(options.run_manifest, "utf8"));
  const evidenceStatus = await buildEvidenceStatusSummary(manifest);
  const manifestValidation = validateRunManifest(manifest);
  let replayValidation: SchemaValidation = { ok: false, errors: [] };
  let artifactVerification: RunArtifactVerification = { ok: false, mismatches: [] };
  let replaySteps = 0;

  if (manifestValidation.ok) {
    replayValidation = await validateReplayPlan(options.run_manifest);
    artifactVerification = await verifyRunArtifacts(options.run_manifest);
    replaySteps = (await loadReplayPlan(options.run_manifest)).steps.length;
  }

  const valid = manifestValidation.ok && replayValidation.ok && artifactVerification.ok;

  console.log(`run_id=${manifest.run_id ?? "unknown"}`);
  console.log(`valid=${valid}`);
  console.log(`manifest=${options.run_manifest}`);
  console.log(`result=${manifest.result_record_path ?? "none"}`);
  console.log(`summary=${manifest.result_summary_path ?? "none"}`);
  console.log(`replay_steps=${replaySteps}`);
  console.log(`mismatches=${artifactVerification.mismatches.length}`);
  console.log(`run_classification=${evidenceStatus.run_classification}`);
  console.log(`clean_primary_evidence_eligible=${evidenceStatus.clean_primary_evidence_eligible}`);
  console.log(`validity_flags=${formatList(evidenceStatus.validity_flags)}`);
  console.log(`provider_profile_id=${evidenceStatus.provider_profile_id ?? "unknown"}`);
  console.log(`provider_timeout_phases=${formatList(evidenceStatus.provider_timeout_phases)}`);
  console.log(`provider_timeout_detail_count=${evidenceStatus.provider_timeout_detail_count}`);
  console.log(
    `workspace_carried_forward_due_to_provider_failure_checkpoints=${evidenceStatus.workspace_carried_forward_due_to_provider_failure_checkpoints}`
  );
  console.log(
    `feedback_opportunity_integrity=${evidenceStatus.feedback_opportunity_integrity.status} (${evidenceStatus.feedback_opportunity_integrity.complete_checkpoints}/${evidenceStatus.feedback_opportunity_integrity.required_checkpoints})`
  );

  for (const error of [...manifestValidation.errors, ...replayValidation.errors]) {
    console.log(`error=${error}`);
  }

  for (const mismatch of artifactVerification.mismatches) {
    console.log(`mismatch=${mismatch.path}:${mismatch.reason}`);
  }

  process.exit(valid ? 0 : 1);
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(",") : "none";
}

function parseArgs(args: string[]): InspectOptions {
  if (args.includes("--help") || args.includes("-h")) {
    return { help: true };
  }

  const options: Partial<InspectOptions> = {};

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];

    if (!value) {
      throw new Error(`Missing value for ${flag}`);
    }

    if (flag === "--run-manifest") {
      options.run_manifest = value;
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }

  if (!options.run_manifest) {
    throw new Error(usage());
  }

  return {
    run_manifest: options.run_manifest,
    help: false
  };
}

function usage(): string {
  return [
    "Usage: bun run inspect:run --run-manifest <path>",
    "",
    "Options:",
    "  --run-manifest <path>   Path to runs/<run_id>/run.json.",
    "  --help                  Print this help text."
  ].join("\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
