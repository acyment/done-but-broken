import { describe, expect, test } from "bun:test";
import {
  E1_TOKEN_ESTIMATOR_ID,
  E1_TOKENIZER_ENCODING,
  countE1Tokens,
  decodeE1Tokens,
  encodeE1Tokens,
  truncateE1OutputByTokens
} from "../src/e1-token-estimator";

describe("E1 sealed token estimator", () => {
  test("uses one deterministic o200k_base tokenizer for all E1 truncation boundaries", () => {
    const tokens = encodeE1Tokens("hello world");

    expect(E1_TOKENIZER_ENCODING).toBe("o200k_base");
    expect(E1_TOKEN_ESTIMATOR_ID).toBe("js-tiktoken-o200k_base-v1");
    expect(tokens.length).toBeGreaterThan(0);
    expect(decodeE1Tokens(tokens)).toBe("hello world");
    expect(countE1Tokens("hello world")).toBe(tokens.length);
  });

  test("truncates by token counts, not character counts", () => {
    const text = Array.from({ length: 40 }, (_, index) => `line-${index}`).join("\n");
    const tokens = encodeE1Tokens(text);
    const truncated = truncateE1OutputByTokens({
      text,
      limit: 20,
      head: 7,
      tail: 5
    });

    expect(truncated.truncated).toBe(true);
    expect(truncated.full_output_tokens).toBe(tokens.length);
    expect(truncated.omitted_tokens).toBe(tokens.length - 12);
    expect(truncated.shown).toContain("[... truncated ");
    expect(truncated.shown).toContain("tokens using js-tiktoken-o200k_base-v1");
    expect(truncated.shown.startsWith(decodeE1Tokens(tokens.slice(0, 7)))).toBe(true);
    expect(truncated.shown.endsWith(decodeE1Tokens(tokens.slice(-5)))).toBe(true);
    expect(truncated.full_output_hash).toHaveLength(64);
  });
});
