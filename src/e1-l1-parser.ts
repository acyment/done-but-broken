import { classifyE1Command, type E1ClassifiedCommand } from "./e1-l1-command";
import type { E1SealedConstants } from "./e1-l1-constants";

export type E1ViolationCode =
  | "unclosed_file_block"
  | "unclosed_verify_block"
  | "orphan_end"
  | "file_open_invalid_path"
  | "multiple_verify_blocks"
  | "duplicate_file_path"
  | "verify_block_empty"
  | "verify_block_multiline"
  | "unrecognized_protocol_line";

export type E1ParseViolation = {
  code: E1ViolationCode;
  line: number;
  detail: string;
};

export type E1ParsedReplacement = {
  path: string;
  content: string;
};

export type E1ParsedTurn = {
  replacements: E1ParsedReplacement[];
  verification: E1ClassifiedCommand | null;
  done: boolean;
  no_op: boolean;
  violations: E1ParseViolation[];
  info: string[];
};

type OpenBlock = {
  type: "file" | "verify";
  path?: string;
  pathValid?: boolean;
  pathError?: string;
  openLine: number;
  content: string[];
};

export class E1TurnParser {
  private readonly fileOpenRe: RegExp;
  private readonly fenceOpenRe: RegExp;

  constructor(private readonly constants: E1SealedConstants) {
    this.fileOpenRe = new RegExp(constants.block_grammar.file_open_regex);
    this.fenceOpenRe = new RegExp(constants.fence_stripping.opener_regex);
  }

  parse(rawOutput: string): E1ParsedTurn {
    const grammar = this.constants.block_grammar;
    const lines = rawOutput.split("\n");
    const violations: E1ParseViolation[] = [];
    const info: string[] = [];
    const fileBlocks: Array<E1ParsedReplacement & { line: number }> = [];
    let verification: E1ClassifiedCommand | null = null;
    let verifySeen = false;
    let done = false;
    let doneSeen = false;
    let block: OpenBlock | null = null;
    let fenceDepth = 0;
    let fenceOpenerLength = 0;

    for (let index = 0; index < lines.length; index += 1) {
      const rawLine = lines[index];
      const line = index + 1;
      const delimiter = rawLine.replace(/[ \t\r]+$/, "");

      if (block) {
        if (delimiter === grammar.end_literal) {
          this.closeBlock(block, fileBlocks, violations, (classified) => {
            if (!classified) {
              return;
            }

            if (verifySeen) {
              violations.push({
                code: "multiple_verify_blocks",
                line: block?.openLine ?? line,
                detail: "first_wins policy: subsequent VERIFY block ignored"
              });
              return;
            }

            verification = classified;
            verifySeen = true;
          });
          block = null;
        } else {
          block.content.push(rawLine);
        }
        continue;
      }

      if (fenceDepth === 1) {
        const closerMatch = /^(`{3,})$/.exec(delimiter);

        if (closerMatch && closerMatch[1].length >= fenceOpenerLength) {
          fenceDepth = 0;
          continue;
        }
      } else {
        const openerMatch = this.fenceOpenRe.exec(delimiter);

        if (openerMatch) {
          fenceDepth = 1;
          fenceOpenerLength = openerMatch[1].length;
          continue;
        }
      }

      const fileMatch = this.fileOpenRe.exec(delimiter);

      if (fileMatch) {
        const path = fileMatch[1];
        const pathError = this.validateReplacementPath(path);
        block = {
          type: "file",
          path,
          pathValid: !pathError,
          pathError: pathError ?? undefined,
          openLine: line,
          content: []
        };
        continue;
      }

      if (delimiter === grammar.verify_open_literal) {
        block = { type: "verify", openLine: line, content: [] };
        continue;
      }

      if (delimiter === grammar.done_literal) {
        if (doneSeen) {
          info.push(`duplicate DONE at line ${line} (idempotent)`);
        }

        done = true;
        doneSeen = true;
        continue;
      }

      if (delimiter === grammar.end_literal) {
        violations.push({ code: "orphan_end", line, detail: "END with no open block" });
        continue;
      }

      if (delimiter.startsWith("<<<")) {
        violations.push({
          code: "unrecognized_protocol_line",
          line,
          detail: `looks like a protocol delimiter but matches no sealed token: ${truncateForLog(
            delimiter
          )}`
        });
      }
    }

    if (block) {
      violations.push({
        code: block.type === "file" ? "unclosed_file_block" : "unclosed_verify_block",
        line: block.openLine,
        detail: "opener with no matching END; block consumed remaining output and was discarded"
      });
    }

    if (fenceDepth === 1) {
      info.push("unclosed markdown fence: stripped at opener, implicitly closed at EOF");
    }

    const replacements = resolveDuplicateReplacements(fileBlocks, violations);
    const no_op = replacements.length === 0 && verification === null && !done;

    return { replacements, verification, done, no_op, violations, info };
  }

  private validateReplacementPath(path: string): string | null {
    const grammar = this.constants.path_grammar;

    if (path.length === 0) {
      return "empty path";
    }

    if (path.length > grammar.max_length) {
      return `exceeds max length ${grammar.max_length}`;
    }

    for (const character of path) {
      const codePoint = character.codePointAt(0) ?? 0;

      if (codePoint > 0x7e || codePoint < 0x21) {
        return "non-printable ASCII or whitespace character";
      }
    }

    if (!new RegExp(grammar.regex).test(path)) {
      return "fails sealed alphabet/shape regex";
    }

    if (path.startsWith("/")) {
      return "absolute paths not permitted";
    }

    if (path.startsWith("-")) {
      return "leading dash not permitted";
    }

    if (path.endsWith("/")) {
      return "trailing slash not permitted";
    }

    if (path.includes("//")) {
      return "double slash not permitted";
    }

    for (const segment of path.split("/")) {
      if (this.constants.path_grammar.forbidden_segments.includes(segment)) {
        return `forbidden segment: ${segment}`;
      }
    }

    return null;
  }

  private closeBlock(
    block: OpenBlock,
    fileBlocks: Array<E1ParsedReplacement & { line: number }>,
    violations: E1ParseViolation[],
    emitVerify: (verification: E1ClassifiedCommand | null) => void
  ): void {
    if (block.type === "file") {
      if (!block.pathValid) {
        violations.push({
          code: "file_open_invalid_path",
          line: block.openLine,
          detail: `path rejected: ${block.pathError}`
        });
        return;
      }

      fileBlocks.push({
        path: block.path ?? "",
        content: block.content.join("\n"),
        line: block.openLine
      });
      return;
    }

    const nonBlankLines = block.content.filter((line) => line.trim() !== "");

    if (nonBlankLines.length === 0) {
      violations.push({
        code: "verify_block_empty",
        line: block.openLine,
        detail: "VERIFY block must contain exactly one non-empty command line"
      });
      emitVerify(null);
      return;
    }

    if (nonBlankLines.length > 1) {
      violations.push({
        code: "verify_block_multiline",
        line: block.openLine,
        detail: "VERIFY block must contain exactly one non-empty command line"
      });
      emitVerify(null);
      return;
    }

    emitVerify(classifyE1Command(nonBlankLines[0], this.constants));
  }
}

function resolveDuplicateReplacements(
  fileBlocks: Array<E1ParsedReplacement & { line: number }>,
  violations: E1ParseViolation[]
): E1ParsedReplacement[] {
  const lastIndexByPath = new Map<string, number>();

  fileBlocks.forEach((block, index) => {
    if (lastIndexByPath.has(block.path)) {
      violations.push({
        code: "duplicate_file_path",
        line: block.line,
        detail: `last_wins policy: earlier block for ${block.path} superseded`
      });
    }

    lastIndexByPath.set(block.path, index);
  });

  return [...lastIndexByPath.values()]
    .sort((left, right) => left - right)
    .map((index) => ({
      path: fileBlocks[index].path,
      content: fileBlocks[index].content
    }));
}

function truncateForLog(value: string): string {
  return value.length <= 80 ? value : `${value.slice(0, 77)}...`;
}
