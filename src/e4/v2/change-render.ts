// §5.5 pair-derivation → OpenSpec change delta files (E4V2 design §5.5; consumed by the v2-M3
// gate tests and the v2-M5 diligent fake agent). Given ⟨post-op IR, pre-task spec-of-record⟩,
// renders the change directory the DILIGENT workflow would write: per-capability delta specs
// with ADDED / MODIFIED / REMOVED requirement blocks (MODIFIED replaces wholesale — every kept
// scenario is restated), plus minimal proposal.md/tasks.md in the shape the pinned CLI's
// validate/archive accept. Capability retirement renders as REMOVED (every prior requirement)
// + ADDED (the §5.5 tombstone) — the pinned CLI refuses to rebuild a spec to zero requirements,
// so the tombstone keeps every retirement archivable.
import type { E4SchemaIR } from "../substrate/ir";
import type { E4SeedFixtureV2 } from "../substrate/v2/fixture";
import { deriveChangeDelta, type E4V2SpecCapability, type E4V2SpecOfRecord, type E4V2SpecRequirement } from "./gold-spec";
import { canonicalScenarioBody, scenarioBulletLines } from "./scenario";

function renderRequirementBlock(requirement: E4V2SpecRequirement): string[] {
  const lines = [`### Requirement: ${requirement.title}`, requirement.shall];

  for (const scenario of requirement.scenarios) {
    lines.push("", `#### Scenario: ${scenario.title}`, ...scenarioBulletLines(scenario));
  }

  return lines;
}

function requirementFingerprint(requirement: E4V2SpecRequirement): string {
  return JSON.stringify({
    shall: requirement.shall,
    scenarios: requirement.scenarios.map((scenario) => [scenario.title, canonicalScenarioBody(scenario)])
  });
}

function renderCapabilityDelta(prior: E4V2SpecCapability | undefined, post: E4V2SpecCapability): string | null {
  const priorRequirements = new Map((prior?.requirements ?? []).map((requirement) => [requirement.title, requirement]));
  const postTitles = new Set(post.requirements.map((requirement) => requirement.title));

  const added = post.requirements.filter((requirement) => !priorRequirements.has(requirement.title));
  const modified = post.requirements.filter((requirement) => {
    const previous = priorRequirements.get(requirement.title);
    return previous !== undefined && requirementFingerprint(previous) !== requirementFingerprint(requirement);
  });
  const removed = [...priorRequirements.values()].filter((requirement) => !postTitles.has(requirement.title));

  if (added.length === 0 && modified.length === 0 && removed.length === 0) {
    return null;
  }

  const lines: string[] = [];

  if (added.length > 0) {
    lines.push("## ADDED Requirements");
    for (const requirement of added) {
      lines.push("", ...renderRequirementBlock(requirement));
    }
  }

  if (modified.length > 0) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("## MODIFIED Requirements");
    for (const requirement of modified) {
      lines.push("", ...renderRequirementBlock(requirement));
    }
  }

  if (removed.length > 0) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("## REMOVED Requirements");
    for (const requirement of removed) {
      lines.push("", `### Requirement: ${requirement.title}`, "**Reason**: Retired by this change.");
    }
  }

  lines.push("");
  return lines.join("\n");
}

export type E4V2RenderedChange = {
  change_name: string;
  files: Record<string, string>; // workspace-relative paths under openspec/changes/<name>/
  novel_scenario_titles: string[];
  removed_scenario_titles: string[];
};

// Renders the full change directory for one task. `changeName` must be a CLI-safe slug.
export function renderE4V2ChangeFiles(input: {
  changeName: string;
  postIr: E4SchemaIR;
  priorSpec: E4V2SpecOfRecord;
  seedFixture?: E4SeedFixtureV2; // §5.7: the carried fixture the template derivation binds to
  requestText: string; // the task's NL request, quoted in proposal.md's Why section
}): E4V2RenderedChange {
  const delta = deriveChangeDelta(input.postIr, input.priorSpec, input.seedFixture);
  const priorByName = new Map(input.priorSpec.capabilities.map((capability) => [capability.name, capability]));
  const files: Record<string, string> = {};
  const root = `openspec/changes/${input.changeName}`;

  for (const capability of delta.spec.capabilities) {
    const rendered = renderCapabilityDelta(priorByName.get(capability.name), capability);

    if (rendered !== null) {
      files[`${root}/specs/${capability.name}/spec.md`] = rendered;
    }
  }

  files[`${root}/proposal.md`] = [
    "## Why",
    `The requested change: ${input.requestText}`,
    "",
    "## What Changes",
    "- Update the affected capability specifications to describe the requested behavior.",
    ""
  ].join("\n");
  files[`${root}/tasks.md`] = ["## 1. Implementation", "- [x] 1.1 Update the implementation to match the spec delta.", ""].join("\n");

  return {
    change_name: input.changeName,
    files,
    novel_scenario_titles: delta.novel.map((ref) => ref.scenario.title),
    removed_scenario_titles: delta.removed.map((ref) => ref.scenario.title)
  };
}
