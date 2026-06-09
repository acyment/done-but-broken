import type { ConditionId } from "./conditions";
import type { E1SealedConstants } from "./e1-l1-constants";

export type E1CommandKind =
  | "bun_test_scratch"
  | "bun_file_scratch"
  | "spec_runner"
  | "spec_runner_cp";

export type E1ClassifiedCommand = {
  raw: string;
  valid: boolean;
  kind?: E1CommandKind;
  argv?: string[];
  cp?: number;
  conditions?: ConditionId[];
  refusal_reason?: string;
};

export function validateE1ScratchPath(path: string, constants: E1SealedConstants): string | null {
  const pathGrammar = constants.path_grammar;
  const scratchRules = constants.command_grammar.scratch_path_rules;

  if (path.length === 0) {
    return "empty path";
  }

  if (path.length > pathGrammar.max_length) {
    return `path exceeds max length ${pathGrammar.max_length}`;
  }

  for (const character of path) {
    const codePoint = character.codePointAt(0) ?? 0;

    if (codePoint > 0x7e || codePoint < 0x21) {
      return "path contains non-printable ASCII or whitespace";
    }
  }

  if (!new RegExp(pathGrammar.regex).test(path)) {
    return "path fails sealed alphabet/shape regex";
  }

  if (path.startsWith("/")) {
    return "absolute paths are not permitted";
  }

  if (path.startsWith("-")) {
    return "leading dash is not permitted";
  }

  if (path.endsWith("/")) {
    return "trailing slash is not permitted";
  }

  if (path.includes("//")) {
    return "double slash is not permitted";
  }

  for (const segment of path.split("/")) {
    if (pathGrammar.forbidden_segments.includes(segment)) {
      return `forbidden path segment: ${segment}`;
    }
  }

  if (!path.startsWith(scratchRules.required_prefix)) {
    return `path must be under ${scratchRules.required_prefix}`;
  }

  if (!scratchRules.allowed_extensions.some((extension) => path.endsWith(extension))) {
    return `extension must be one of: ${scratchRules.allowed_extensions.join(", ")}`;
  }

  return null;
}

export function classifyE1Command(raw: string, constants: E1SealedConstants): E1ClassifiedCommand {
  const refuse = (reason: string): E1ClassifiedCommand => ({
    raw,
    valid: false,
    refusal_reason: reason
  });

  if (raw !== raw.trim()) {
    return refuse("leading or trailing whitespace is not permitted");
  }

  if (/[^\x21-\x7e ]/.test(raw)) {
    return refuse("command contains non-printable ASCII or non-space whitespace");
  }

  if (raw.includes("  ")) {
    return refuse("repeated spaces are not permitted");
  }

  if (raw.length === 0) {
    return refuse("empty command");
  }

  const tokens = raw.split(" ");
  const range = constants.command_grammar.checkpoint_range;

  if (tokens.length === 3 && tokens[0] === "bun" && tokens[1] === "run" && tokens[2] === "spec") {
    return {
      raw,
      valid: true,
      kind: "spec_runner",
      argv: ["bun", "run", "spec"],
      conditions: ["feedback_capable_spec"]
    };
  }

  if (
    tokens.length === 5 &&
    tokens[0] === "bun" &&
    tokens[1] === "run" &&
    tokens[2] === "spec" &&
    tokens[3] === "--"
  ) {
    const match = /^--cp=(\d+)$/.exec(tokens[4]);

    if (!match) {
      return refuse("malformed --cp parameter");
    }

    const checkpoint = match[1];

    if (checkpoint.length > 1 && checkpoint.startsWith("0")) {
      return refuse("leading zeros in checkpoint number are not permitted");
    }

    const checkpointNumber = Number(checkpoint);

    if (
      !Number.isInteger(checkpointNumber) ||
      checkpointNumber < range.min ||
      checkpointNumber > range.max
    ) {
      return refuse(`checkpoint number out of sealed range [${range.min}, ${range.max}]`);
    }

    return {
      raw,
      valid: true,
      kind: "spec_runner_cp",
      argv: ["bun", "run", "spec", "--", `--cp=${checkpointNumber}`],
      cp: checkpointNumber,
      conditions: ["feedback_capable_spec"]
    };
  }

  if (tokens.length === 3 && tokens[0] === "bun" && tokens[1] === "test") {
    const pathError = validateE1ScratchPath(tokens[2], constants);

    if (pathError) {
      return refuse(`bun test path rejected: ${pathError}`);
    }

    return {
      raw,
      valid: true,
      kind: "bun_test_scratch",
      argv: ["bun", "test", tokens[2]],
      conditions: ["context_only_spec", "feedback_capable_spec"]
    };
  }

  if (tokens.length === 2 && tokens[0] === "bun") {
    if (tokens[1] === "test" || tokens[1] === "run") {
      return refuse("missing argument");
    }

    const pathError = validateE1ScratchPath(tokens[1], constants);

    if (pathError) {
      return refuse(`bun script path rejected: ${pathError}`);
    }

    return {
      raw,
      valid: true,
      kind: "bun_file_scratch",
      argv: ["bun", tokens[1]],
      conditions: ["context_only_spec", "feedback_capable_spec"]
    };
  }

  return refuse("command does not match any sealed template");
}
