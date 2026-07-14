// E5 P0-V item 5 (proposal §2), rebuilt at P0-V.1 [P0V.1: V1], subject-derivation fixed at v0.8
// [V08: 1b]: off-topic close as a SCORING category. The v3-M7 forensics verified the referee
// could not see a silently swapped task (a
// done-close whose change addresses a stalled predecessor's leftover, or nothing at all, instead
// of the current request) — the composition sin then reads as an ordinary truthful/false close.
// This module is measurement-side only: it classifies a done-close as on- or off-topic against
// the task's ground-truth delta; nothing here gates, refuses, or feeds back to the agent (the
// live on-topic GATE was withdrawn from P0 and re-typed as product lever P1.6).
//
// The P0-V external panel refuted classifier v1 in substance (6/7 reviews; backlog item V1):
// any-single case-insensitive SUBSTRING match over whole-file writes gave detection power ≈ 0
// on most op kinds — OLD entity names pervade existing code on renames, the new method verb
// matches any server file, convention envelope keys match all error-handling code, and one
// subject mention in an agent-authored delta-spec heading sufficed. Classifier v2 rules:
//   1. WORD-BOUNDED matching (an occurrence counts only when not embedded in a larger
//      identifier), still case-insensitive.
//   2. NOVEL-OCCURRENCE rule for code writes: a subject counts only where a written file
//      contains MORE bounded occurrences than that file held at task start — pre-existing
//      occurrences rewritten by a whole-file FILE write no longer count as addressing the task.
//   3. Delta-spec channel scored by PREDOMINANCE over scenario blocks (the behavioral payload),
//      not by a single mention anywhere: the channel votes on-topic only when a strict majority
//      of the change's scenario blocks mention a subject. A heading-only mention no longer
//      classifies the close on-topic.
//   4. Empty-delta (maintenance) tasks remain not_applicable for the topic classification (no
//      subjects exist), but authored non-marker work is now flagged as unexpected_change_work
//      and diagnostically scored against the PRIOR tasks' subjects (the possible leftovers) —
//      the highest-risk absorption scenario is no longer invisible by construction.
//
// Classification stays deterministic and conservative toward ON-topic (the category exists to
// catch flagrant swaps, and a false off-topic accusation would poison the readout worse than a
// missed one): a done-close is off_topic only when NEITHER channel produces a match under the
// rules above. proposal.md / tasks.md narration is deliberately excluded — mentioning the task
// in prose while changing something else is exactly the failure mode being scored.
//
// [V08: 1b] classifier v3 — the seed-220 forensic fix (docs/e5/E5-ZERO-SPEND-RUNWAY-v1.md
// Findings log 1a/1b). All four seed-220 modify_convention closes misfired off_topic despite
// real accepted work: the convention subject literals were QUOTED JSON keys (`"type"`,
// `"detail"`), but the work's real footprints were UNQUOTED object keys in code
// (`{ error: { type: kind, detail: msg } }`) and DOTTED json-paths in scenario assertions
// (`error.type`) — neither channel's needle was a substring of either real shape. Fix: for each
// DISTINCTIVE key of the convention's NEW statement (every quoted key except the `error`
// wrapper, which appears in virtually every rejection scenario/error-handling file and would
// over-match if given the same treatment), emit three subject forms instead of one — the quoted
// JSON-body literal, the dotted scenario-assertion path, and the unquoted object-literal key.
import type { E4TaskDelta } from "./task-delta";
import { pluralizeEntityName } from "../substrate/v2/pluralize";

export const E4_V3_ON_TOPIC_ID = "e4-on-topic-close-v3";

export type E4V3OnTopicClassification = "on_topic" | "off_topic" | "not_applicable";

export type E4V3OnTopicReport = {
  on_topic_id: typeof E4_V3_ON_TOPIC_ID;
  classification: E4V3OnTopicClassification;
  matched_subjects: string[]; // union of both channels' matches under the v2 rules
  subject_count: number;
  spec_channel: { scenario_blocks: number; matched_blocks: number; predominant: boolean };
  code_channel: { novel_matched_subjects: string[] };
  // [P0V.1: V1] maintenance-task instrumentation: true when an empty-delta task's close carries
  // authored spec or code work beyond byte-identical rewrites (PARKED.md markers never reach
  // this classifier — they live under openspec/ and are not delta-spec files).
  unexpected_change_work: boolean;
  // Which prior-task subjects the unexpected work touches (diagnostic; the possible leftovers).
  prior_task_subject_matches: string[];
};

// [V08: 1b] Subject FORMS of a convention statement's distinctive keys (every quoted JSON key
// except the outer `error` wrapper, which every rejection scenario/error-handling file already
// contains and would over-match). Three forms per key cover the three real shapes a change
// addressing the statement can take: the quoted JSON-body literal (`"type"`), the dotted
// scenario-assertion path (`error.type`), and the unquoted code object-literal key (`type:`).
function conventionSubjectForms(statement: string): string[] {
  const keys = [...statement.matchAll(/"([A-Za-z_][A-Za-z0-9_]*)"/g)].map((match) => match[1]);
  const distinctive = keys.filter((key) => key !== "error");
  const forms = new Set<string>();

  for (const key of distinctive) {
    forms.add(`"${key}"`);
    forms.add(`error.${key}`);
    forms.add(`${key}:`);
  }

  return [...forms];
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
    for (const form of conventionSubjectForms(convention.new_statement)) {
      subjects.add(form);
    }
  }

  return [...subjects].toSorted();
}

// One code write with the file's content at task start (null = the file did not exist). The
// runner records the FIRST write to each path against the pre-write bytes, so later rewrites of
// the same file keep comparing against the true task-start state.
export type E4V3OnTopicCodeWrite = { path: string; content: string; task_start_content: string | null };

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z0-9_]/.test(char);
}

// Case-insensitive bounded-occurrence count: an occurrence is counted only when the characters
// immediately outside the match are not identifier characters, so "Item" never matches inside
// "ItemizedReport" (the plural form is its own subject when relevant). Plain scanning — no
// regex construction from subject strings (paths, quoted literals, and braces stay literal).
function countBoundedOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) {
    return 0;
  }

  const lowerHaystack = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let count = 0;
  let from = 0;

  while (true) {
    const at = lowerHaystack.indexOf(lowerNeedle, from);

    if (at === -1) {
      return count;
    }

    const beforeOk = !isWordChar(lowerNeedle[0]) || !isWordChar(lowerHaystack[at - 1]);
    const afterOk = !isWordChar(lowerNeedle[lowerNeedle.length - 1]) || !isWordChar(lowerHaystack[at + lowerNeedle.length]);

    if (beforeOk && afterOk) {
      count += 1;
    }

    from = at + 1;
  }
}

// Scenario blocks of a delta-spec file: each "#### Scenario:" heading plus its body up to the
// next markdown heading. Scenarios are the change's behavioral payload — custody requires every
// accepted change to carry executable scenarios, so a change with zero blocks contributes an
// abstaining spec channel, never an on-topic vote.
function extractScenarioBlocks(specContent: string): string[] {
  const lines = specContent.split(/\r\n|\r|\n/);
  const blocks: string[] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    if (/^####\s+Scenario:/i.test(line)) {
      if (current !== null) {
        blocks.push(current.join("\n"));
      }
      current = [line];
      continue;
    }

    if (/^#{2,4}\s/.test(line)) {
      if (current !== null) {
        blocks.push(current.join("\n"));
        current = null;
      }
      continue;
    }

    current?.push(line);
  }

  if (current !== null) {
    blocks.push(current.join("\n"));
  }

  return blocks;
}

function subjectsNovelInCodeWrites(subjects: string[], codeWrites: E4V3OnTopicCodeWrite[]): string[] {
  return subjects.filter((subject) =>
    codeWrites.some(
      (write) => countBoundedOccurrences(write.content, subject) > countBoundedOccurrences(write.task_start_content ?? "", subject)
    )
  );
}

export function classifyE4TaskCloseTopic(input: {
  delta_is_empty: boolean;
  subjects: string[];
  // Delta-spec file contents of the ACCEPTED change (openspec/changes/<name>/specs/** only —
  // never proposal.md/tasks.md) captured at close, before the archive step moves them.
  change_spec_contents: string[];
  // Every non-openspec file the agent wrote during the task, with task-start content.
  code_writes: E4V3OnTopicCodeWrite[];
  // Subjects of every PRIOR task in the sequence (the possible leftovers); consulted only for
  // the maintenance-task unexpected_change_work diagnostic.
  prior_task_subjects?: string[];
}): E4V3OnTopicReport {
  const priorSubjects = input.prior_task_subjects ?? [];

  if (input.delta_is_empty || input.subjects.length === 0) {
    // [P0V.1: V1] the maintenance hole: classification stays not_applicable (there is no topic
    // to match), but authored work no longer passes unseen.
    const authoredSpecWork = input.change_spec_contents.some((content) => content.trim().length > 0);
    const authoredCodeWork = input.code_writes.some((write) => write.content !== (write.task_start_content ?? ""));
    const unexpectedChangeWork = authoredSpecWork || authoredCodeWork;
    const priorMatches = !unexpectedChangeWork
      ? []
      : [
          ...new Set([
            ...priorSubjects.filter((subject) =>
              input.change_spec_contents.some((content) => countBoundedOccurrences(content, subject) > 0)
            ),
            ...subjectsNovelInCodeWrites(priorSubjects, input.code_writes)
          ])
        ].toSorted();

    return {
      on_topic_id: E4_V3_ON_TOPIC_ID,
      classification: "not_applicable",
      matched_subjects: [],
      subject_count: input.subjects.length,
      spec_channel: { scenario_blocks: 0, matched_blocks: 0, predominant: false },
      code_channel: { novel_matched_subjects: [] },
      unexpected_change_work: unexpectedChangeWork,
      prior_task_subject_matches: priorMatches
    };
  }

  const scenarioBlocks = input.change_spec_contents.flatMap(extractScenarioBlocks);
  const matchedBlockSubjects = new Set<string>();
  let matchedBlocks = 0;

  for (const block of scenarioBlocks) {
    const blockSubjects = input.subjects.filter((subject) => countBoundedOccurrences(block, subject) > 0);

    if (blockSubjects.length > 0) {
      matchedBlocks += 1;
      for (const subject of blockSubjects) {
        matchedBlockSubjects.add(subject);
      }
    }
  }

  const predominant = scenarioBlocks.length > 0 && matchedBlocks * 2 > scenarioBlocks.length;
  const novelCodeSubjects = subjectsNovelInCodeWrites(input.subjects, input.code_writes);
  const matched = [...new Set([...(predominant ? [...matchedBlockSubjects] : []), ...novelCodeSubjects])].toSorted();

  return {
    on_topic_id: E4_V3_ON_TOPIC_ID,
    classification: predominant || novelCodeSubjects.length > 0 ? "on_topic" : "off_topic",
    matched_subjects: matched,
    subject_count: input.subjects.length,
    spec_channel: { scenario_blocks: scenarioBlocks.length, matched_blocks: matchedBlocks, predominant },
    code_channel: { novel_matched_subjects: novelCodeSubjects },
    unexpected_change_work: false,
    prior_task_subject_matches: []
  };
}
