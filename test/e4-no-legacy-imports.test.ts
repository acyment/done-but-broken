// Gate-0 Q4 + Gate-1 change 3 (docs/e4/GATE-0-DECISIONS.md, GATE-1-DECISIONS.md): enforced check
// that no E4 module imports the legacy runPilot/OpenRouter stack NOR the E1-orchestrator/
// closed-world modules E4 must build its own equivalents of. Scope and forbidden set per
// docs/e4/adr/ADR-007-e1-e4-coexistence.md.
// The scanner is unit-tested against synthetic sources so the check can never pass vacuously.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const selfPath = resolve(import.meta.path);

const LEGACY_STACK = [
  "src/runner.ts",
  "src/openrouter-agent.ts",
  "src/model-loop-agent.ts",
  "src/fake-agent.ts",
  "src/task-package.ts",
  "src/provenance.ts",
  "src/index.ts",
  "bin/run-fake-pilot.ts",
  "bin/inspect-run.ts"
];

const E1_CLOSED_WORLD = [
  "src/e1-package-runner.ts",
  "src/e1-no-provider-runner.ts",
  "src/e1-turn-adapter.ts",
  "src/e1-l1-constants.ts",
  "src/conditions.ts",
  "src/result-schema.ts"
];

const FORBIDDEN_ENTRY_POINTS = [...LEGACY_STACK, ...E1_CLOSED_WORLD].map((path) =>
  join(repoRoot, path)
);

type Violation = { file: string; specifier: string; resolved: string };

function extractImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /(?:import|export)\s[^"'`;]*?from\s*["']([^"']+)["']/g,
    /import\s*["']([^"']+)["']/g,
    /(?:require|import)\(\s*["']([^"']+)["']\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }

  return specifiers;
}

function resolveRelativeSpecifier(fromFile: string, specifier: string): string[] {
  if (!specifier.startsWith(".")) {
    return [];
  }

  const base = resolve(dirname(fromFile), specifier);

  return [base, `${base}.ts`, `${base}.js`, join(base, "index.ts")];
}

function findViolations(filePath: string, source: string): Violation[] {
  const violations: Violation[] = [];

  for (const specifier of extractImportSpecifiers(source)) {
    for (const resolved of resolveRelativeSpecifier(filePath, specifier)) {
      if (FORBIDDEN_ENTRY_POINTS.includes(resolved)) {
        violations.push({ file: filePath, specifier, resolved });
      }
    }
  }

  return violations;
}

function collectE4ModuleFiles(): string[] {
  const files: string[] = [];
  const e4SourceRoot = join(repoRoot, "src", "e4");

  if (existsSync(e4SourceRoot)) {
    for (const entry of readdirSync(e4SourceRoot, { recursive: true }) as string[]) {
      const full = join(e4SourceRoot, entry);

      if (full.endsWith(".ts") && statSync(full).isFile()) {
        files.push(full);
      }
    }
  }

  for (const dir of ["bin", "test"]) {
    for (const entry of readdirSync(join(repoRoot, dir))) {
      const full = join(repoRoot, dir, entry);

      if (entry.startsWith("e4") && entry.endsWith(".ts") && statSync(full).isFile() && full !== selfPath) {
        files.push(full);
      }
    }
  }

  return files;
}

describe("E4 legacy-import lint (Gate-0 Q4 + Gate-1 change 3)", () => {
  test("scanner detects a forbidden legacy import in synthetic E4 source", () => {
    const syntheticFile = join(repoRoot, "src", "e4", "synthetic-example.ts");
    const violations = findViolations(
      syntheticFile,
      [
        'import { runPilot } from "../runner";',
        'export { OpenRouterAgent } from "../openrouter-agent";',
        'const loop = await import("../model-loop-agent");',
        'import "../index";'
      ].join("\n")
    );

    expect(violations.map((violation) => violation.specifier).toSorted()).toEqual([
      "../index",
      "../model-loop-agent",
      "../openrouter-agent",
      "../runner"
    ]);
  });

  test("scanner detects a forbidden E1-orchestrator/closed-world import", () => {
    const syntheticFile = join(repoRoot, "src", "e4", "synthetic-example.ts");
    const violations = findViolations(
      syntheticFile,
      [
        'import { runE1TaskPackageProvider } from "../e1-package-runner";',
        'import { E1TurnAdapter } from "../e1-turn-adapter";',
        'import { validateE1Constants } from "../e1-l1-constants";',
        'import type { ConditionId } from "../conditions";',
        'import { validateResult } from "../result-schema";',
        'import { runE1NoProviderCheckpoint } from "../e1-no-provider-runner";'
      ].join("\n")
    );

    expect(violations.map((violation) => violation.specifier).toSorted()).toEqual([
      "../conditions",
      "../e1-l1-constants",
      "../e1-no-provider-runner",
      "../e1-package-runner",
      "../e1-turn-adapter",
      "../result-schema"
    ]);
  });

  test("scanner accepts allowlisted library imports", () => {
    const syntheticFile = join(repoRoot, "src", "e4", "synthetic-example.ts");
    const violations = findViolations(
      syntheticFile,
      [
        'import { applyReplacements } from "../e1-harness";',
        'import { parseE1Turn } from "../e1-l1-parser";',
        'import { hashDirectory } from "../snapshot";',
        'import { readFile } from "node:fs/promises";'
      ].join("\n")
    );

    expect(violations).toEqual([]);
  });

  test("no E4 module imports a legacy-stack entry point", () => {
    const violations = collectE4ModuleFiles().flatMap((file) =>
      findViolations(file, readFileSync(file, "utf8"))
    );

    expect(violations).toEqual([]);
  });
});
