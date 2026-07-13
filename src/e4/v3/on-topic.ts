// E5 P0-V item 5 (proposal §2): off-topic close as a SCORING category. The v3-M7 forensics
// verified the referee could not see a silently swapped task (a done-close whose change
// addresses a stalled predecessor's leftover, or nothing at all, instead of the current
// request) — the composition sin then reads as an ordinary truthful/false close. This module is
// measurement-side only: it classifies a done-close as on- or off-topic against the task's
// ground-truth delta; nothing here gates, refuses, or feeds back to the agent (the live
// on-topic GATE was withdrawn from P0 and re-typed as product lever P1.6).
//
// Classification rule (deterministic, conservative toward ON-topic — the category exists to
// catch flagrant swaps, and a false off-topic accusation would poison the readout worse than a
// missed one): a done-close is off_topic when NEITHER the accepted change's delta-spec files
// NOR any code file the agent wrote during the task mentions ANY subject string of the task's
// delta. proposal.md / tasks.md narration is deliberately excluded — mentioning the task in
// prose while changing something else is exactly the failure mode being scored. Tasks with an
// empty delta (behavior-preserving maintenance) have no subjects to match and are
// not_applicable.
import type { E4TaskDelta } from "./task-delta";
import { pluralizeEntityName } from "../substrate/v2/pluralize";

export const E4_V3_ON_TOPIC_ID = "e4-on-topic-close-v1";

export type E4V3OnTopicClassification = "on_topic" | "off_topic" | "not_applicable";

export type E4V3OnTopicReport = {
  on_topic_id: typeof E4_V3_ON_TOPIC_ID;
  classification: E4V3OnTopicClassification;
  matched_subjects: string[];
  subject_count: number;
};

// Distinctive value literals of a convention statement: the quoted JSON key names it pins
// (e.g. "code"/"message" vs "type"/"detail" for the sealed error-envelope statements). An
// on-topic convention change writes at least one of the NEW statement's keys somewhere.
function conventionSubjectLiterals(statement: string): string[] {
  return [...statement.matchAll(/"([A-Za-z_][A-Za-z0-9_]*)"/g)].map((match) => `"${match[1]}"`);
}

// Subject strings a change addressing this delta would plausibly contain, derived from the
// delta alone (pure; arm-neutral). Entity names contribute both the name and the collection
// path segment (old and new forms for renames) so either spec paths or code routes match.
export function buildE4OnTopicSubjects(delta: E4TaskDelta): string[] {
  const subjects = new Set<string>();
  const addEntityForms = (name: string) => {
    subjects.add(name);
    subjects.add(pluralizeEntityName(name));
  };

  for (const entity of [...delta.added_entities, ...delta.removed_entities]) {
    addEntityForms(entity.name);
  }

  for (const rename of delta.renamed_entities) {
    addEntityForms(rename.old_name);
    addEntityForms(rename.new_name);
  }

  for (const { field } of [...delta.added_fields, ...delta.removed_fields]) {
    subjects.add(field.name);
  }

  for (const rename of delta.renamed_fields) {
    subjects.add(rename.old_name);
    subjects.add(rename.new_name);
  }

  for (const retype of delta.retyped_fields) {
    subjects.add(retype.field_name);
  }

  for (const endpoint of [...delta.added_endpoints, ...delta.removed_endpoints]) {
    subjects.add(endpoint.path);
    addEntityForms(endpoint.entity);
  }

  for (const change of delta.changed_endpoints) {
    subjects.add(change.old.path);
    subjects.add(change.new.path);

    if (change.old.method !== change.new.method) {
      subjects.add(change.new.method);
    }
  }

  for (const rule of [...delta.added_rules, ...delta.removed_rules]) {
    subjects.add(rule.field);
  }

  for (const convention of delta.changed_conventions) {
    for (const literal of conventionSubjectLiterals(convention.new_statement)) {
      subjects.add(literal);
    }
  }

  return [...subjects].toSorted();
}

export function classifyE4TaskCloseTopic(input: {
  delta_is_empty: boolean;
  subjects: string[];
  // Delta-spec file contents of the ACCEPTED change (openspec/changes/<name>/specs/** only —
  // never proposal.md/tasks.md) captured at close, before the archive step moves them.
  change_spec_contents: string[];
  // Full contents of every non-openspec file the agent wrote during the task.
  code_write_contents: string[];
}): E4V3OnTopicReport {
  if (input.delta_is_empty || input.subjects.length === 0) {
    return {
      on_topic_id: E4_V3_ON_TOPIC_ID,
      classification: "not_applicable",
      matched_subjects: [],
      subject_count: input.subjects.length
    };
  }

  const haystacks = [...input.change_spec_contents, ...input.code_write_contents].map((content) =>
    content.toLowerCase()
  );
  const matched = input.subjects.filter((subject) => {
    const needle = subject.toLowerCase();
    return haystacks.some((haystack) => haystack.includes(needle));
  });

  return {
    on_topic_id: E4_V3_ON_TOPIC_ID,
    classification: matched.length > 0 ? "on_topic" : "off_topic",
    matched_subjects: matched,
    subject_count: input.subjects.length
  };
}
