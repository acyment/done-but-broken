// v3-M1 census (E4V3-PRODUCT-LOOP-PROPOSAL.md §5): the spec↔code reconciliation checker is
// anchored in-sync at T0 (gold code surface + gold template scenarios → zero findings) and flags
// each targeted failure shape when a fixture introduces it: lost route coverage (M7 arm-0
// archive-rot analog), stale scenario routes, unbacked rules, unbacked rejection claims,
// unexercised/unknown fields, and the two entity-level floors.
import { describe, expect, test } from "bun:test";

import { buildBaselineIr, type E4SchemaIR } from "../src/e4/substrate/ir";
import type { E4SurfaceDump } from "../src/e4/meter/types";
import { deriveEntityCapability } from "../src/e4/v2/gold-spec";
import type { E4V2Scenario } from "../src/e4/v2/scenario";
import { reconcileE4SpecAndCode, type E4V3ReconcileCheck } from "../src/e4/v3/reconcile";

function dumpFromIr(ir: E4SchemaIR): E4SurfaceDump {
  return {
    routes: ir.endpoints.map((endpoint) => ({
      method: endpoint.method,
      path: endpoint.path,
      entity: endpoint.entity,
      kind: endpoint.kind
    })),
    entities: ir.entities.map((entity) => ({
      name: entity.name,
      fields: entity.fields.map((field) => ({
        name: field.name,
        type: field.type,
        ref_entity: field.ref_entity ?? null,
        required: field.required
      }))
    })),
    validation_rules: ir.validation_rules.map((rule) => ({
      entity: rule.entity,
      field: rule.field,
      kind: rule.kind,
      detail: rule.detail
    }))
  };
}

function t0Scenarios(ir: E4SchemaIR): E4V2Scenario[] {
  return ir.entities.flatMap((entity) =>
    deriveEntityCapability(ir, entity).requirements.flatMap((requirement) => requirement.scenarios)
  );
}

function checksIn(findings: Array<{ check: E4V3ReconcileCheck }>): Set<E4V3ReconcileCheck> {
  return new Set(findings.map((finding) => finding.check));
}

const ir = buildBaselineIr();

describe("v3-M1: T0 in-sync anchor", () => {
  test("gold surface + gold template scenarios reconcile with zero findings", () => {
    const baseline = ir;
    const report = reconcileE4SpecAndCode({ dump: dumpFromIr(baseline), scenarios: t0Scenarios(baseline) });

    expect(report.findings).toEqual([]);
    expect(report.ok).toBe(true);
  });

  test("report is deterministic", () => {
    const baseline = ir;
    const first = reconcileE4SpecAndCode({ dump: dumpFromIr(baseline), scenarios: t0Scenarios(baseline) });
    const second = reconcileE4SpecAndCode({ dump: dumpFromIr(baseline), scenarios: t0Scenarios(baseline) });

    expect(second).toEqual(first);
  });
});

describe("v3-M1: targeted failure shapes", () => {
  test("dropping an entity's update/delete scenarios flags route_without_scenario (archive-rot analog)", () => {
    const baseline = ir;
    const scenarios = t0Scenarios(baseline).filter(
      (scenario) => !/updat|delet/i.test(scenario.title)
    );
    const report = reconcileE4SpecAndCode({ dump: dumpFromIr(baseline), scenarios });
    const routeFindings = report.findings.filter((finding) => finding.check === "route_without_scenario");

    expect(routeFindings.length).toBeGreaterThan(0);
    expect(routeFindings.some((finding) => /PUT|DELETE/.test(finding.subject))).toBe(true);
  });

  test("a scenario aimed at a route the code no longer has flags scenario_route_absent (stale spec)", () => {
    const baseline = ir;
    const scenarios: E4V2Scenario[] = [
      ...t0Scenarios(baseline),
      {
        title: "Reading a Promotion works",
        steps: [
          { kind: "request", method: "GET", path: "/promotions/promotion-spec-1" },
          { kind: "assert_status", status: 200 },
          { kind: "assert_field_equals", json_path: "id", literal_json: '"promotion-spec-1"' }
        ]
      }
    ];
    const report = reconcileE4SpecAndCode({ dump: dumpFromIr(baseline), scenarios });

    expect(checksIn(report.findings).has("scenario_route_absent")).toBe(true);
  });

  test("a code rule with no rejection scenario flags rule_without_rejection_scenario", () => {
    const baseline = ir;
    const dump = dumpFromIr(baseline);
    const entity = dump.entities[0].name;
    const field = dump.entities[0].fields.find((candidate) => candidate.name !== "id")!.name;

    dump.validation_rules.push({
      entity,
      field: `${field}_shadow`,
      kind: "format",
      detail: { pattern: "^x$" }
    });
    dump.entities[0].fields.push({ name: `${field}_shadow`, type: "string", ref_entity: null, required: false });

    const report = reconcileE4SpecAndCode({ dump, scenarios: t0Scenarios(baseline) });
    const ruleFindings = report.findings.filter((finding) => finding.check === "rule_without_rejection_scenario");

    expect(ruleFindings.some((finding) => finding.subject.includes(`${field}_shadow`))).toBe(true);
  });

  test("a rejection claim nothing in code backs flags rejection_scenario_without_rule", () => {
    const baseline = ir;
    const dump = dumpFromIr(baseline);
    // give the first entity an optional, unruled field, then claim its rejection
    const entity = dump.entities[0];

    entity.fields.push({ name: "nickname", type: "string", ref_entity: null, required: false });
    const createRoute = dump.routes.find((route) => route.entity === entity.name && route.kind === "create")!;
    const body: Record<string, unknown> = {};

    for (const field of entity.fields) {
      body[field.name] =
        field.type === "int" || field.type === "decimal"
          ? 1
          : field.type === "bool"
            ? true
            : field.type === "date"
              ? "2026-01-01"
              : `${entity.name.toLowerCase()}-spec-9`;
    }
    body.nickname = "!"; // type-valid, unruled — the claimed rejection has no backing

    const scenarios: E4V2Scenario[] = [
      ...t0Scenarios(baseline),
      {
        title: `Creating a ${entity.name} with a silly nickname is rejected`,
        steps: [
          { kind: "request_body", method: "POST", path: createRoute.path, body_json: JSON.stringify(body) },
          { kind: "assert_status", status: 400 },
          { kind: "assert_field_equals", json_path: "error.code", literal_json: '"validation_error"' }
        ]
      }
    ];
    const report = reconcileE4SpecAndCode({ dump, scenarios });

    expect(checksIn(report.findings).has("rejection_scenario_without_rule")).toBe(true);
  });

  test("a code field no scenario mentions flags field_never_exercised", () => {
    const baseline = ir;
    const dump = dumpFromIr(baseline);

    dump.entities[0].fields.push({ name: "internal_notes", type: "string", ref_entity: null, required: false });
    const report = reconcileE4SpecAndCode({ dump, scenarios: t0Scenarios(baseline) });
    const fieldFindings = report.findings.filter((finding) => finding.check === "field_never_exercised");

    expect(fieldFindings.some((finding) => finding.subject.endsWith(".internal_notes"))).toBe(true);
  });

  test("a non-rejection scenario sending an unknown field flags scenario_field_unknown (embellishment made visible)", () => {
    const baseline = ir;
    const dump = dumpFromIr(baseline);
    const entity = dump.entities[0];
    const createRoute = dump.routes.find((route) => route.entity === entity.name && route.kind === "create")!;
    const body: Record<string, unknown> = { discount_percent: 10 };

    for (const field of entity.fields) {
      body[field.name] = `${entity.name.toLowerCase()}-spec-9`;
    }

    const scenarios: E4V2Scenario[] = [
      ...t0Scenarios(baseline),
      {
        title: `Creating a ${entity.name} stores the discount`,
        steps: [
          { kind: "request_body", method: "POST", path: createRoute.path, body_json: JSON.stringify(body) },
          { kind: "assert_status", status: 201 },
          { kind: "assert_field_equals", json_path: "discount_percent", literal_json: "10" }
        ]
      }
    ];
    const report = reconcileE4SpecAndCode({ dump, scenarios });
    const unknownFindings = report.findings.filter((finding) => finding.check === "scenario_field_unknown");

    expect(unknownFindings.some((finding) => finding.subject.includes("discount_percent"))).toBe(true);
  });

  test("losing the create round-trip or all rejection cases trips the entity-level floors", () => {
    const baseline = ir;
    const dump = dumpFromIr(baseline);
    const noCreates = t0Scenarios(baseline).filter(
      (scenario) => !scenario.steps.some((step) => step.kind === "request_body" && step.method === "POST")
    );
    const report = reconcileE4SpecAndCode({ dump, scenarios: noCreates });
    const checks = checksIn(report.findings);

    expect(checks.has("create_round_trip_missing")).toBe(true);
    expect(checks.has("rejection_case_missing")).toBe(true);
  });

  test("a scenario without value-binding assertions is surfaced as a scenario_floor finding", () => {
    const baseline = ir;
    const dump = dumpFromIr(baseline);
    const listRoute = dump.routes.find((route) => route.kind === "list")!;
    const scenarios: E4V2Scenario[] = [
      ...t0Scenarios(baseline),
      {
        title: "Listing works",
        steps: [
          { kind: "request", method: "GET", path: listRoute.path },
          { kind: "assert_status", status: 200 }
        ]
      }
    ];
    const report = reconcileE4SpecAndCode({ dump, scenarios });
    const floorFindings = report.findings.filter((finding) => finding.check === "scenario_floor");

    expect(floorFindings.some((finding) => finding.subject === "Listing works")).toBe(true);
  });
});
