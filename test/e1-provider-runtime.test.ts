import { describe, expect, test } from "bun:test";
import {
  E1ProviderFailureError,
  E1ProviderExhaustedError,
  callE1ProviderWithRetries
} from "../src/e1-provider-runtime";

describe("E1 provider runtime", () => {
  test("retry failures are logged and do not fabricate model turns", async () => {
    const slept: number[] = [];
    let calls = 0;

    const result = await callE1ProviderWithRetries({
      maxAttempts: 3,
      backoffMs: [250, 1000, 4000],
      sleep: async (ms) => {
        slept.push(ms);
      },
      operation: async () => {
        calls += 1;

        if (calls < 3) {
          throw new E1ProviderFailureError({
            failureKind: calls === 1 ? "rate_limit" : "timeout",
            message: `transient ${calls}`,
            providerStatus: calls === 1 ? 429 : undefined
          });
        }

        return { text: "<<<DONE>>>" };
      }
    });

    expect(result.value).toEqual({ text: "<<<DONE>>>" });
    expect(slept).toEqual([250, 1000]);
    expect(result.attempts).toEqual([
      {
        attempt: 1,
        outcome: "retryable_failure",
        failure_kind: "rate_limit",
        message: "transient 1",
        provider_status: 429,
        backoff_ms: 250
      },
      {
        attempt: 2,
        outcome: "retryable_failure",
        failure_kind: "timeout",
        message: "transient 2",
        backoff_ms: 1000
      },
      { attempt: 3, outcome: "success" }
    ]);
  });

  test("exhausted retries throw provider_error-ready attempt metadata", async () => {
    let calls = 0;

    await expect(
      callE1ProviderWithRetries({
        maxAttempts: 3,
        backoffMs: [250, 1000, 4000],
        sleep: async () => {},
        operation: async () => {
          calls += 1;
          throw new E1ProviderFailureError({
            failureKind: "api_error",
            message: `gateway ${calls}`,
            providerStatus: 503
          });
        }
      })
    ).rejects.toThrow(E1ProviderExhaustedError);

    expect(calls).toBe(3);
  });
});
