// v2-M1 acceptance (E4V2 design §5.5 workspace shape + verification split "v2-M1 structural" +
// §4 reuse decisions): the OpenSpec workspace generator over the v2 substrate, the pinned-CLI
// (1.4.1) structural validation of the emitted tree, the re-authored README, the v2 provider,
// and the ADR-007 allowlist-extension wrapper.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { buildBaselineIr } from "../src/e4/substrate/ir";
import { e4ProceduralRestV2Provider, type E4SubstrateConfig } from "../src/e4/substrate/v2/provider";
import { drawE4V2TaskSequence } from "../src/e4/substrate/v2/draw";
import { createE4Prng } from "../src/e4/substrate/prng";
import { deriveSpecOfRecord } from "../src/e4/v2/gold-spec";
import {
  assertE4V2SpecSelfChecks,
  buildE4V2WorkspaceFiles,
  renderCapabilitySpecMarkdown,
  renderE4V2Readme
} from "../src/e4/v2/workspace";
import {
  E4_OPENSPEC_PROFILE_ID,
  OPENSPEC_PINNED_VERSION,
  runE4OpenSpecValidateSpecs
} from "../src/e4/v2/openspec";
import { parseOpenSpecScenarios, readOpenSpecSpecOfRecord } from "../src/e1-openspec-harness";
import {
  E4_V2_ASSERTION_STEP_PATTERNS,
  E4_V2_FLOORS_TEXT,
  E4_V2_REQUEST_STEP_PATTERNS
} from "../src/e4/v2/step-vocabulary";

const REPO_ROOT = resolve(import.meta.dir, "..");

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

function config(overrides: Partial<E4SubstrateConfig> = {}): E4SubstrateConfig {
  return {
    substrate_config_id: "default",
    substrate_seed: 42,
    task_count: 8,
    op_mix: { weights: { drift_opportunity: 0.5, additive: 0.4, behavior_preserving: 0.1 } },
    ...overrides
  };
}

async function writeWorkspaceToDisk(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "e4-v2-workspace-"));
  tempRoots.push(dir);

  for (const [path, contents] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), contents);
  }

  return dir;
}

describe("v2-M1 — T0 workspace shape (§5.5)", () => {
  test("the workspace carries the OpenSpec tree as THE spec: one capability per entity, no specs/openapi.json, no specs/CONVENTIONS.md", () => {
    const files = buildE4V2WorkspaceFiles(buildBaselineIr());
    const paths = Object.keys(files).toSorted();

    expect(paths).toEqual([
      "README.md",
      "openspec/specs/categories/spec.md",
      "openspec/specs/widgets/spec.md",
      "registry.ts",
      "schema.ts",
      "seed.ts",
      "server.ts",
      "storage.ts"
    ]);
    expect(paths).not.toContain("specs/openapi.json");
    expect(paths).not.toContain("specs/CONVENTIONS.md");
  });

  test("rendered spec.md round-trips through the estate scenario parser with the full scenario census", async () => {
    const files = buildE4V2WorkspaceFiles(buildBaselineIr());
    const dir = await writeWorkspaceToDisk(files);
    const specs = await readOpenSpecSpecOfRecord(dir);
    const scenarios = parseOpenSpecScenarios(specs);

    // 17 T0 scenarios: Category 6 (create happy/required-reject, read-missing, update, delete,
    // list count) + Widget 11 (those plus 2 type rejections, 1 rule rejection, filtered list,
    // analytics count).
    expect(scenarios).toHaveLength(17);
    expect(scenarios.filter((scenario) => scenario.spec === "widgets")).toHaveLength(11);
    expect(scenarios.every((scenario) => scenario.canonical_body.length > 0)).toBe(true);
  });

  test("spec.md carries Purpose/Requirements/Scenario blocks in the characterization-pinned shape", () => {
    const spec = deriveSpecOfRecord(buildBaselineIr(), null);
    const widgets = spec.capabilities.find((capability) => capability.name === "widgets")!;
    const markdown = renderCapabilitySpecMarkdown(widgets);

    expect(markdown).toStartWith("# widgets Specification\n\n## Purpose\n");
    expect(markdown).toContain("\n## Requirements\n");
    expect(markdown).toContain("\n### Requirement: Creating a Widget\nThe service SHALL create a Widget from a valid POST body and reject invalid create requests.\n");
    expect(markdown).toContain("\n#### Scenario: Creating a Widget returns the stored entity\n- **WHEN** I send a POST request");
  });

  test("the README documents the layout/workflow and carries the §5.3 vocabulary (incl. PATCH) plus the A8 floors verbatim", () => {
    const readme = renderE4V2Readme();

    expect(readme).toContain("openspec/specs/<capability>/spec.md");
    expect(readme).toContain("openspec/changes/<change-name>/");
    expect(readme).toContain("## ADDED Requirements");
    expect(readme).toContain("openspec archive");

    for (const pattern of [...E4_V2_REQUEST_STEP_PATTERNS, ...E4_V2_ASSERTION_STEP_PATTERNS]) {
      expect(readme).toContain(`- ${pattern}`);
    }
    expect(readme).toContain('I send a PATCH request to "<path>" with body <json>');

    for (const floor of E4_V2_FLOORS_TEXT) {
      expect(readme).toContain(`- ${floor}`);
    }

    // Arm-neutral: whether scenarios execute is the arms' only difference and never appears here.
    expect(readme.toLowerCase()).not.toContain("gate");
    expect(readme.toLowerCase()).not.toContain("executed");
  });

  test("the structural self-check is not vacuous: it fails on floors, totality, purpose, and id-collision violations", () => {
    const ir = buildBaselineIr();
    const spec = deriveSpecOfRecord(ir, null);

    expect(() => assertE4V2SpecSelfChecks(ir, spec)).not.toThrow();

    const missingRequirement = structuredClone(spec);
    missingRequirement.capabilities[0].requirements.pop();
    expect(() => assertE4V2SpecSelfChecks(ir, missingRequirement)).toThrow(/template totality/);

    const shortPurpose = structuredClone(spec);
    shortPurpose.capabilities[0].purpose = "Too short.";
    expect(() => assertE4V2SpecSelfChecks(ir, shortPurpose)).toThrow(/50-char floor/);

    const noScenarios = structuredClone(spec);
    noScenarios.capabilities[0].requirements[0].scenarios = [];
    expect(() => assertE4V2SpecSelfChecks(ir, noScenarios)).toThrow(/REQUIREMENT_NO_SCENARIOS/);

    const noShall = structuredClone(spec);
    noShall.capabilities[0].requirements[0].shall = "The service creates things.";
    expect(() => assertE4V2SpecSelfChecks(ir, noShall)).toThrow(/SHALL/);

    const weakScenario = structuredClone(spec);
    weakScenario.capabilities[0].requirements[0].scenarios[0].steps = [
      { kind: "request", method: "GET", path: "/categories" },
      { kind: "assert_status", status: 200 }
    ];
    expect(() => assertE4V2SpecSelfChecks(ir, weakScenario)).toThrow(/A8 floors/);
  });
});

describe("v2-M1 — pinned CLI structural validation (openspec validate --specs --strict --no-interactive)", () => {
  test("the emitted T0 tree validates strict-clean under the pinned 1.4.1 CLI", async () => {
    const files = buildE4V2WorkspaceFiles(buildBaselineIr());
    const dir = await writeWorkspaceToDisk(files);
    const result = await runE4OpenSpecValidateSpecs({ repoRoot: REPO_ROOT, workspacePath: dir });

    expect(result.openspec_version).toBe(OPENSPEC_PINNED_VERSION);
    expect(result.exit_code).toBe(0);
    expect(result.normalized_stdout).toContain("✓ spec/categories");
    expect(result.normalized_stdout).toContain("✓ spec/widgets");
    expect(result.normalized_stdout).toContain("0 failed");
  }, 60_000);

  test("the validation is not vacuous: a requirement stripped of scenarios fails strict validation", async () => {
    const files = buildE4V2WorkspaceFiles(buildBaselineIr());
    const broken = { ...files };
    // Remove every scenario block under the first Widget requirement (REQUIREMENT_NO_SCENARIOS).
    broken["openspec/specs/widgets/spec.md"] = broken["openspec/specs/widgets/spec.md"].replace(
      /#### Scenario: Creating a Widget returns the stored entity[\s\S]*?(?=\n### Requirement: Fetching a Widget)/,
      ""
    );

    const dir = await writeWorkspaceToDisk(broken);
    const result = await runE4OpenSpecValidateSpecs({ repoRoot: REPO_ROOT, workspacePath: dir });

    expect(result.exit_code).not.toBe(0);
  }, 60_000);
});

describe("v2-M1 — procedural-rest-v2 provider", () => {
  test("same seed, same substrate: two generate() calls are byte-identical; the boundary is v2", async () => {
    const a = await e4ProceduralRestV2Provider.generate(config());
    const b = await e4ProceduralRestV2Provider.generate(config());

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(e4ProceduralRestV2Provider.substrate_kind).toBe("procedural-rest-v2");
    expect(e4ProceduralRestV2Provider.substrate_version).toBe("procedural-rest-v2");
  });

  test("different seeds differ; every task carries labels; ≥1 behavior_preserving task guaranteed across seeds", async () => {
    const a = await e4ProceduralRestV2Provider.generate(config({ substrate_seed: 42 }));
    const b = await e4ProceduralRestV2Provider.generate(config({ substrate_seed: 43 }));

    expect(JSON.stringify(a.tasks)).not.toBe(JSON.stringify(b.tasks));

    for (let seed = 0; seed < 20; seed += 1) {
      const result = await e4ProceduralRestV2Provider.generate(config({ substrate_seed: seed, task_count: 6 }));
      expect(result.tasks.every((task) => task.opportunity_labels.length >= 1)).toBe(true);
      expect(result.tasks.some((task) => task.opportunity_labels.includes("behavior_preserving"))).toBe(true);
    }
  });

  test("v2 draws produce v2 op semantics: a rename_entity task moves endpoint paths and carries endpoint-level lineage", () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const drawn = drawE4V2TaskSequence({
        baselineIr: buildBaselineIr(),
        taskCount: 6,
        opMix: config().op_mix,
        prng: createE4Prng(seed)
      });
      const rename = drawn.find((task) => task.op_kind === "rename_entity");

      if (!rename) {
        continue;
      }

      expect(rename.rename_lineage.length).toBeGreaterThan(1); // entity entry + per-endpoint entries
      const entityEntry = rename.rename_lineage[0];
      const newName = entityEntry.new_item_id.replace("entity:", "");
      const renamedEndpoints = rename.ground_truth_ir.endpoints.filter((endpoint) => endpoint.entity === newName);
      expect(renamedEndpoints.every((endpoint) => endpoint.path.startsWith(`/${newName.toLowerCase()}s`))).toBe(true);
      return;
    }

    throw new Error("no seed in 0..39 drew a rename_entity task — widen the sweep");
  });

  test("generated tasks carry v2 acceptance tests (mirror negative tests present in cumulative sets)", async () => {
    const result = await e4ProceduralRestV2Provider.generate(config({ task_count: 4 }));
    const ids = result.tasks[0].acceptance_tests.cumulative.map((candidate) => candidate.test_id);

    expect(ids.some((id) => id.endsWith("-unknown-field"))).toBe(true);
    expect(ids.some((id) => id.endsWith("-type"))).toBe(true);
  });
});

describe("v2-M1 — ADR-007 allowlist extension wrapper", () => {
  test("the E4 wrapper pins the v2 profile id and re-exports the pinned CLI version", () => {
    expect(E4_OPENSPEC_PROFILE_ID).toBe("e4-openspec-workflow-v1");
    expect(OPENSPEC_PINNED_VERSION).toBe("1.4.1");
  });

  test("no E4 module imports the E1-bound OpenSpec profile module (wrap, don't import — enforced by the extended lint)", async () => {
    const glob = new Bun.Glob("src/e4/**/*.ts");

    for await (const file of glob.scan(REPO_ROOT)) {
      const source = await Bun.file(join(REPO_ROOT, file)).text();
      // Import-shaped occurrences only — the wrapper module documents the rule in comments.
      expect(source).not.toMatch(/from\s+["'][^"']*e1-openspec-constants["']/);
    }
  });
});
