export const E1_PROVIDER_FAILURE_KINDS = [
  "api_error",
  "timeout",
  "rate_limit",
  "malformed_response",
  "network_error"
] as const;

export type E1ProviderFailureKind = (typeof E1_PROVIDER_FAILURE_KINDS)[number];

export type E1ProviderAttemptRecord = {
  attempt: number;
  outcome: "success" | "retryable_failure";
  failure_kind?: E1ProviderFailureKind;
  message?: string;
  provider_status?: number;
  backoff_ms?: number;
};

export type E1SpendCapSnapshot = {
  live_mode: boolean;
  spend_cap_usd: number;
  estimated_spend_usd: number;
  estimated_max_call_cost_usd: number;
  remaining_spend_usd: number;
};

export class E1ProviderFailureError extends Error {
  readonly failure_kind: E1ProviderFailureKind;
  readonly provider_status?: number;

  constructor(input: { failureKind: E1ProviderFailureKind; message: string; providerStatus?: number }) {
    super(input.message);
    this.name = "E1ProviderFailureError";
    this.failure_kind = input.failureKind;
    this.provider_status = input.providerStatus;
  }
}

export class E1LiveModeRequiredError extends Error {
  constructor(message = "live_mode must be explicitly enabled before live provider transport calls") {
    super(message);
    this.name = "E1LiveModeRequiredError";
  }
}

export class E1SpendCapReachedError extends Error {
  readonly spend: E1SpendCapSnapshot;

  constructor(input: { message: string; spend: E1SpendCapSnapshot }) {
    super(input.message);
    this.name = "E1SpendCapReachedError";
    this.spend = input.spend;
  }
}

export class E1ProviderExhaustedError extends Error {
  readonly attempts: E1ProviderAttemptRecord[];

  constructor(input: { message: string; attempts: E1ProviderAttemptRecord[] }) {
    super(input.message);
    this.name = "E1ProviderExhaustedError";
    this.attempts = input.attempts;
  }
}

export async function callE1ProviderWithRetries<T>(input: {
  maxAttempts: number;
  backoffMs: number[];
  operation: (attempt: number) => Promise<T>;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ value: T; attempts: E1ProviderAttemptRecord[] }> {
  if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1) {
    throw new Error("maxAttempts must be a positive integer.");
  }

  const sleep = input.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const attempts: E1ProviderAttemptRecord[] = [];

  for (let attempt = 1; attempt <= input.maxAttempts; attempt += 1) {
    try {
      const value = await input.operation(attempt);
      attempts.push({ attempt, outcome: "success" });

      return { value, attempts };
    } catch (error) {
      const failure = normalizeE1ProviderFailure(error);
      const retrying = attempt < input.maxAttempts;
      const backoffMs = retrying ? input.backoffMs[Math.min(attempt - 1, input.backoffMs.length - 1)] ?? 0 : undefined;

      attempts.push({
        attempt,
        outcome: "retryable_failure",
        failure_kind: failure.failureKind,
        message: failure.message,
        ...(failure.providerStatus !== undefined ? { provider_status: failure.providerStatus } : {}),
        ...(backoffMs !== undefined ? { backoff_ms: backoffMs } : {})
      });

      if (!retrying) {
        throw new E1ProviderExhaustedError({
          message: `provider retries exhausted after ${input.maxAttempts} attempts: ${failure.message}`,
          attempts
        });
      }

      await sleep(backoffMs);
    }
  }

  throw new Error("unreachable provider retry state");
}

export function isE1ProviderExhaustedError(error: unknown): error is E1ProviderExhaustedError {
  return error instanceof E1ProviderExhaustedError;
}

export function isE1SpendCapReachedError(error: unknown): error is E1SpendCapReachedError {
  return error instanceof E1SpendCapReachedError;
}

export function normalizeE1ProviderException(error: unknown): {
  reason: string;
  attempts: E1ProviderAttemptRecord[];
} {
  if (isE1ProviderExhaustedError(error)) {
    return { reason: error.message, attempts: error.attempts };
  }

  const failure = normalizeE1ProviderFailure(error);

  return {
    reason: failure.message,
    attempts: [
      {
        attempt: 1,
        outcome: "retryable_failure",
        failure_kind: failure.failureKind,
        message: failure.message,
        ...(failure.providerStatus !== undefined ? { provider_status: failure.providerStatus } : {})
      }
    ]
  };
}

function normalizeE1ProviderFailure(error: unknown): {
  failureKind: E1ProviderFailureKind;
  message: string;
  providerStatus?: number;
} {
  if (error instanceof E1ProviderFailureError) {
    return {
      failureKind: error.failure_kind,
      message: error.message,
      providerStatus: error.provider_status
    };
  }

  if (error instanceof Error) {
    return { failureKind: "network_error", message: error.message };
  }

  return { failureKind: "network_error", message: String(error) };
}
