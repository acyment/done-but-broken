// v3-M2 census (E4V3-PRODUCT-LOOP-PROPOSAL.md §5): the agent-side boundary-mutation harness is
// calibrated at T0 — the gold workspace + the gold template scenarios kill ALL six sealed
// mutants (the kill-1.0 analog the sealed threshold will sit below at the constants freeze) —
// while a deliberately weak, baseline-green suite (status-only assertions, no round-trips, no
// rejections, no list checks) survives most mutants. Scenarios that fail on the real server
// earn no kill credit.
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildBaselineIr } from "../src/e4/substrate/ir";
import { buildE4V2WorkspaceFiles } from "../src/e4/v2/workspace";
import { deriveEntityCapability } from "../src/e4/v2/gold-spec";
import type { E4V2Scenario } from "../src/e4/v2/scenario";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants } from "../src/e4/v2/constants";
import {
  E4_V3_MUTANT_IDS,
  runE4AgentMutationAnalysis,
  type E4V3MutationReport
} from "../src/e4/v3/mutation";

const repoRoot = join(import.meta.dir, "..");
const { constants } = await loadE4V2Constants(join(repoRoot, E4_V2_CONSTANTS_PATH));
const ir = buildBaselineIr();

function writeT0Workspace(): string {
  const dir = mkdtempSync(join(repoRoot, "tmp", "e4-v3-m2-"));

  for (const [relPath, content] of Object.entries(buildE4V2WorkspaceFiles(ir))) {
    const target = join(dir, relPath);

    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, content);
  }

  return dir;
}

function t0Scenarios(): E4V2Scenario[] {
  return ir.entities.flatMap((entity) =>
    deriveEntityCapability(ir, entity).requirements.flatMap((requirement) => requirement.scenarios)
  );
}

function byId(report: E4V3MutationReport): Map<string, string> {
  return new Map(report.mutants.map((mutant) => [mutant.mutant_id, mutant.status]));
}

describe("v3-M2 census: boundary-mutation harness", () => {
  test(
    "T0 gold code + gold template scenarios kill all six mutants",
    async () => {
      const workspaceDir = writeT0Workspace();
      const scratchRoot = mkdtempSync(join(repoRoot, "tmp", "e4-v3-m2-scratch-"));
      const report = await runE4AgentMutationAnalysis({
        workspaceDir,
        scenarios: t0Scenarios(),
        config: constants.executor,
        scratchRoot,
        concurrency: 6
      });

      expect(report.baseline_failed_titles).toEqual([]);
      expect(report.baseline_non_completed_titles).toEqual([]);
      expect(report.mutants.map((mutant) => mutant.mutant_id)).toEqual([...E4_V3_MUTANT_IDS]);

      for (const mutant of report.mutants) {
        expect(`${mutant.mutant_id}:${mutant.status}`).toBe(`${mutant.mutant_id}:killed`);
      }

      expect(report.kill_score).toBe(1);
    },
    120000
  );

  test(
    "a weak, baseline-green suite survives most mutants; real-server-failing scenarios earn no credit",
    async () => {
      const workspaceDir = writeT0Workspace();
      const scratchRoot = mkdtempSync(join(repoRoot, "tmp", "e4-v3-m2-weak-"));
      const entity = ir.entities[0];
      const createEndpoint = ir.endpoints.find(
        (endpoint) => endpoint.entity === entity.name && endpoint.kind === "create"
      )!;
      const body: Record<string, unknown> = {};

      for (const field of entity.fields) {
        body[field.name] =
          field.type === "int" || field.type === "decimal"
            ? 1
            : field.type === "bool"
              ? true
              : field.type === "date"
                ? "2026-01-01"
                : `${entity.name.toLowerCase()}-weak-9`;
      }

      const weakSuite: E4V2Scenario[] = [
        {
          title: `Creating a ${entity.name} succeeds`,
          steps: [
            {
              kind: "request_body",
              method: "POST",
              path: createEndpoint.path,
              body_json: JSON.stringify(body)
            },
            { kind: "assert_status", status: 201 }
          ]
        },
        {
          // fails on the real server (asserts a wrong status) — must be excluded from kill credit
          title: `Creating a ${entity.name} teleports`,
          steps: [
            {
              kind: "request_body",
              method: "POST",
              path: createEndpoint.path,
              body_json: JSON.stringify({ ...body, id: `${entity.name.toLowerCase()}-weak-10` })
            },
            { kind: "assert_status", status: 418 }
          ]
        }
      ];

      const report = await runE4AgentMutationAnalysis({
        workspaceDir,
        scenarios: weakSuite,
        config: constants.executor,
        scratchRoot,
        concurrency: 6
      });

      expect(report.baseline_failed_titles).toEqual([`Creating a ${entity.name} teleports`]);
      const statuses = byId(report);

      // the one status assertion catches the 201->200 swap; everything else survives
      expect(statuses.get("status-swap")).toBe("killed");
      expect(statuses.get("field-leak")).toBe("survived");
      expect(statuses.get("empty-list")).toBe("survived");
      expect(statuses.get("strip-filter")).toBe("survived");
      expect(statuses.get("swallow-write")).toBe("survived");
      expect(statuses.get("accept-invalid")).toBe("survived");
      expect(report.kill_score).toBeLessThanOrEqual(2 / 6);
    },
    120000
  );
});
