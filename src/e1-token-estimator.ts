import { getEncoding } from "js-tiktoken";
import { hashText } from "./snapshot";

export const E1_TOKEN_ESTIMATOR_ID = "js-tiktoken-o200k_base-v1";
export const E1_TOKENIZER_PACKAGE = "js-tiktoken";
export const E1_TOKENIZER_PACKAGE_VERSION = "1.0.21";
export const E1_TOKENIZER_ENCODING = "o200k_base";

const encoder = getEncoding(E1_TOKENIZER_ENCODING);

export type E1TokenTruncationResult = {
  shown: string;
  truncated: boolean;
  full_output_hash: string;
  full_output_tokens: number;
  shown_output_tokens: number;
  omitted_tokens: number;
  tokenizer: {
    estimator_id: typeof E1_TOKEN_ESTIMATOR_ID;
    package: typeof E1_TOKENIZER_PACKAGE;
    package_version: typeof E1_TOKENIZER_PACKAGE_VERSION;
    encoding: typeof E1_TOKENIZER_ENCODING;
  };
};

export function encodeE1Tokens(text: string): number[] {
  return encoder.encode(text);
}

export function decodeE1Tokens(tokens: number[]): string {
  return encoder.decode(tokens);
}

export function countE1Tokens(text: string): number {
  return encodeE1Tokens(text).length;
}

export function truncateE1OutputByTokens(input: {
  text: string;
  limit: number;
  head: number;
  tail: number;
}): E1TokenTruncationResult {
  const tokens = encodeE1Tokens(input.text);
  const fullOutputHash = hashText(input.text);

  if (tokens.length <= input.limit) {
    return buildResult({
      shown: input.text,
      truncated: false,
      fullOutputHash,
      fullOutputTokens: tokens.length,
      omittedTokens: 0
    });
  }

  const shownHead = decodeBoundarySafeTokenSlice(tokens.slice(0, input.head), "head");
  const shownTail = decodeBoundarySafeTokenSlice(tokens.slice(-input.tail), "tail");
  const omittedTokens = Math.max(0, tokens.length - shownHead.token_count - shownTail.token_count);
  const shown = `${shownHead.text}\n[... truncated ${omittedTokens} tokens using ${E1_TOKEN_ESTIMATOR_ID} ...]\n${shownTail.text}`;

  return buildResult({
    shown,
    truncated: true,
    fullOutputHash,
    fullOutputTokens: tokens.length,
    omittedTokens
  });
}

function buildResult(input: {
  shown: string;
  truncated: boolean;
  fullOutputHash: string;
  fullOutputTokens: number;
  omittedTokens: number;
}): E1TokenTruncationResult {
  return {
    shown: input.shown,
    truncated: input.truncated,
    full_output_hash: input.fullOutputHash,
    full_output_tokens: input.fullOutputTokens,
    shown_output_tokens: countE1Tokens(input.shown),
    omitted_tokens: input.omittedTokens,
    tokenizer: {
      estimator_id: E1_TOKEN_ESTIMATOR_ID,
      package: E1_TOKENIZER_PACKAGE,
      package_version: E1_TOKENIZER_PACKAGE_VERSION,
      encoding: E1_TOKENIZER_ENCODING
    }
  };
}

function decodeBoundarySafeTokenSlice(tokens: number[], side: "head" | "tail"): {
  text: string;
  token_count: number;
} {
  let candidate = tokens.slice();

  while (candidate.length > 0) {
    const text = decodeE1Tokens(candidate);
    const hasSplitCharacter =
      side === "head" ? text.endsWith("\uFFFD") : text.startsWith("\uFFFD");

    if (!hasSplitCharacter) {
      return { text, token_count: candidate.length };
    }

    candidate = side === "head" ? candidate.slice(0, -1) : candidate.slice(1);
  }

  return { text: "", token_count: 0 };
}
