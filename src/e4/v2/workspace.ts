// v2 OpenSpec workspace generator (E4V2 design §5.5 workspace shape; v2-M1). Emits the T0
// agent-visible workspace: the runnable app files (scaffold v2), the OpenSpec spec-of-record
// rendered from the `e4-t0-gold-spec-v1` model, and the re-authored README. NO specs/openapi.json
// and NO specs/CONVENTIONS.md — the OpenSpec tree IS the agent-facing spec in v2 (§3 "replaced",
// operationalized; the §7.5 code-side meter channel reads the registry/schema dump, unaffected).
import type { E4SchemaIR } from "../substrate/ir";
import { buildE4V2AppFiles } from "../substrate/v2/scaffold";
import { generateSeedFixtureV2 } from "../substrate/v2/testgen";
import {
  allScenarioRefs,
  deriveSpecOfRecord,
  specFixtureId,
  specMissingId,
  type E4V2SpecCapability,
  type E4V2SpecOfRecord
} from "./gold-spec";
import { isRequestClassStep, isValueBindingAssertion, scenarioBulletLines } from "./scenario";
import { openSpecToFeature } from "./converter";
import { E4_V2_ASSERTION_STEP_PATTERNS, E4_V2_FLOORS_TEXT, E4_V2_REQUEST_STEP_PATTERNS } from "./step-vocabulary";

// Renders one capability's spec.md in the exact shape the pinned CLI validates and the archive
// rebuilds (same block layout as the openspec-archive characterization fixture).
export function renderCapabilitySpecMarkdown(capability: E4V2SpecCapability): string {
  const lines: string[] = [`# ${capability.name} Specification`, "", "## Purpose", capability.purpose, "", "## Requirements"];

  for (const requirement of capability.requirements) {
    lines.push("", `### Requirement: ${requirement.title}`, requirement.shall);

    for (const scenario of requirement.scenarios) {
      lines.push("", `#### Scenario: ${scenario.title}`, ...scenarioBulletLines(scenario));
    }
  }

  lines.push("");
  return lines.join("\n");
}

// The v2 README (§5.5): documents the OpenSpec layout and the per-task propose→implement→archive
// workflow, and carries the §5.3 step-pattern vocabulary plus the A8 floors VERBATIM (the v1
// Gate-1 "README carries the grammar verbatim" pin, transferred). Arm-neutral by design — it is
// identical in both arms (shared task environment); whether scenarios EXECUTE is the arms' only
// difference and is communicated through the arm policy channel, never here. Seals under
// protocol_text at the v2-M5 freeze.
export function renderE4V2Readme(): string {
  return [
    "# Workspace guide",
    "",
    "This service's observable behavior is specified in the OpenSpec tree, which you own and",
    "must keep truthful:",
    "",
    "- `openspec/specs/<capability>/spec.md` — the spec of record, one capability per resource.",
    "- `openspec/changes/<change-name>/` — your proposed change for the current task.",
    "",
    "Each task follows the same workflow:",
    "",
    "1. **Propose**: create a change under `openspec/changes/<change-name>/` containing",
    "   `proposal.md`, `tasks.md`, and delta specs under `specs/<capability>/spec.md` using",
    "   `## ADDED Requirements` / `## MODIFIED Requirements` / `## REMOVED Requirements` blocks.",
    "   A MODIFIED block replaces the whole requirement, so restate every scenario you keep.",
    "2. **Implement**: make the code match the spec.",
    "3. At task close the harness archives the change (`openspec archive`), rebuilding the spec",
    "   of record from your deltas.",
    "",
    "## Renaming or retiring a capability",
    "",
    "When a resource is renamed or removed, its old capability folder must be retired — never",
    "rewrite the old capability's scenarios in place to point at the new paths. The archive",
    "refuses to rebuild any capability to zero requirements (it aborts with \"Spec must have at",
    "least one requirement\" and changes nothing), so a retirement delta under the OLD capability",
    "needs BOTH blocks:",
    "",
    "- `## REMOVED Requirements` naming every existing requirement of the old capability, and",
    "- `## ADDED Requirements` with a single tombstone requirement (e.g. `### Requirement:",
    "  Retired <capability> endpoints` — the service SHALL NOT serve the retired paths) whose",
    "  scenario asserts the old collection path now returns status 404.",
    "",
    "For a rename, additionally create a delta spec under the NEW capability folder with",
    "`## ADDED Requirements` carrying the full requirement set at the new paths.",
    "",
    "## Scenario grammar",
    "",
    "Every `#### Scenario:` block consists of bolded keyword bullets — `- **WHEN** <step>`,",
    "`- **THEN** <step>`, `- **AND** <step>` (AND continues the preceding WHEN or THEN). Each",
    "step must match exactly one of the patterns below; no other step text is legal.",
    "",
    "Request steps (WHEN, or AND after a WHEN):",
    "",
    ...E4_V2_REQUEST_STEP_PATTERNS.map((pattern) => `- ${pattern}`),
    "",
    "Assertion steps (THEN, or AND after a THEN):",
    "",
    ...E4_V2_ASSERTION_STEP_PATTERNS.map((pattern) => `- ${pattern}`),
    "",
    "Rules:",
    "",
    ...E4_V2_FLOORS_TEXT.map((floor) => `- ${floor}`),
    ""
  ].join("\n");
}

// §5.5 structural self-checks (the v2 analog of v1-M1's generator in-sync self-check): floors by
// construction, requirement-per-endpoint totality, purpose floor, fixture-id disjointness. The
// CLI validate pass is asserted by test (it spawns the pinned binary); these checks run inside
// generate() on every draw.
export function assertE4V2SpecSelfChecks(ir: E4SchemaIR, spec: E4V2SpecOfRecord): void {
  const liveCapabilities = spec.capabilities.filter((capability) => !capability.retired);

  if (liveCapabilities.length !== ir.entities.length) {
    throw new Error("v2 spec self-check failed: live capability count does not match the entity count");
  }

  for (const entity of ir.entities) {
    const endpointCount = ir.endpoints.filter((endpoint) => endpoint.entity === entity.name).length;
    const capability = liveCapabilities.find((candidate) =>
      ir.endpoints.some((endpoint) => endpoint.entity === entity.name && endpoint.path.toLowerCase().startsWith(`/${candidate.name}`))
    );

    if (!capability) {
      throw new Error(`v2 spec self-check failed: no capability found for entity ${entity.name}`);
    }

    if (capability.requirements.length !== endpointCount) {
      throw new Error(
        `v2 spec self-check failed: capability ${capability.name} has ${capability.requirements.length} requirements for ${endpointCount} endpoints (template totality)`
      );
    }
  }

  for (const capability of spec.capabilities) {
    if (capability.purpose.length < 50) {
      throw new Error(`v2 spec self-check failed: capability ${capability.name} purpose is under the strict-mode 50-char floor`);
    }

    if (capability.requirements.length === 0) {
      throw new Error(`v2 spec self-check failed: capability ${capability.name} has zero requirements (un-archivable)`);
    }

    for (const requirement of capability.requirements) {
      if (!/SHALL|MUST/.test(requirement.shall)) {
        throw new Error(`v2 spec self-check failed: requirement "${requirement.title}" carries no SHALL/MUST keyword`);
      }

      if (requirement.scenarios.length === 0) {
        throw new Error(`v2 spec self-check failed: requirement "${requirement.title}" has zero scenarios (REQUIREMENT_NO_SCENARIOS)`);
      }
    }
  }

  // A8 floors by construction on every scenario (≥1 assertion step, ≥1 value-binding assertion,
  // a request step present so the THEN judges something).
  for (const ref of allScenarioRefs(spec)) {
    const hasRequest = ref.scenario.steps.some(isRequestClassStep);
    const assertionCount = ref.scenario.steps.filter((step) => !isRequestClassStep(step)).length;
    const hasValueBinding = ref.scenario.steps.some(isValueBindingAssertion);

    if (!hasRequest || assertionCount === 0 || !hasValueBinding) {
      throw new Error(`v2 spec self-check failed: scenario "${ref.scenario.title}" violates the A8 floors`);
    }
  }

  // Fixture-id disjointness (§5.5): spec-reserved ids never collide with seed rows or the GT
  // generator's reserved fixtures.
  const seedIds = new Set(
    Object.values(generateSeedFixtureV2(ir)).flatMap((rows) => rows.map((row) => String(row.id)))
  );

  for (const entity of ir.entities) {
    const gtReserved = [
      `${entity.name.toLowerCase()}-new-1`,
      `${entity.name.toLowerCase()}-invalid-1`,
      `${entity.name.toLowerCase()}-does-not-exist`
    ];

    for (const specId of [specFixtureId(entity.name), specMissingId(entity.name)]) {
      if (seedIds.has(specId) || gtReserved.includes(specId)) {
        throw new Error(`v2 spec self-check failed: spec fixture id ${specId} collides with a reserved seed/GT id`);
      }
    }
  }
}

// The T0 workspace: app files + OpenSpec tree + README. The OpenSpec tree is derived from the
// fixed T0 baseline (prior = null); after T0 the spec-of-record evolves ONLY through the
// harness-run archive step, never by regeneration.
export function buildE4V2WorkspaceFiles(ir: E4SchemaIR): Record<string, string> {
  const spec = deriveSpecOfRecord(ir, null);

  assertE4V2SpecSelfChecks(ir, spec);

  const files: Record<string, string> = { ...buildE4V2AppFiles(ir) };

  for (const capability of spec.capabilities) {
    const markdown = renderCapabilitySpecMarkdown(capability);
    files[`openspec/specs/${capability.name}/spec.md`] = markdown;
    // §5.2 step 1: the .feature rendering is a derived byproduct of the spec markdown via the
    // e4-openspec-gherkin-v1 converter — never hand-maintained, never parsed back.
    files[`openspec/specs/${capability.name}/spec.feature`] = openSpecToFeature(markdown, capability.name);
  }

  files["README.md"] = renderE4V2Readme();

  return files;
}
