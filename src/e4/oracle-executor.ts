// The single E4 acceptance executor (ADR-006; IMPLEMENTATION-PLAN.md M3): one HTTP engine behind
// the hidden oracle, the Arm-H gate red/green checks, and Arm-H acceptance feedback. Determinism is
// engineered in (Gate-0 injection 4): fresh server per run, harness-allocated port passed via one
// env var, fixed-order sequential requests, canonicalized-JSON comparison, sealed timeouts, and a
// full request/response transcript retained for replay. Timing is never asserted and never appears
// in verdicts or transcripts; ports never appear in comparison payloads.
//
// [R1-B1] [R2: R2-5] Executor-classification boundary (closed infra enumeration, agent-caused
// default): `executor_error` is returned ONLY for {workspace-process spawn failure before agent
// code runs, harness port-allocation/bind failure (incl. EADDRINUSE on the harness-allocated
// port), executor internal crash, OS-level transport fault surfacing as an executor-side crash}.
// Every other readiness failure — compile errors, corrupted workspace files, infinite startup
// loops presenting as readiness timeouts — is returned as `readiness_failed` with
// classification "agent_workspace": the caller scores it as a task failure (cumulative_pass = 0),
// the sequence continues, and it stays in agent-behavior accounting. Defaulting ambiguity toward
// executor_error is deliberately rejected (R2-BACKLOG "Adjudicated out"): it would let an agent's
// own infinite loop present as infrastructure and escape the taxes and the floor rule.
import type { E4HttpTest } from "./substrate/testgen";

export const E4_EXECUTOR_ENTRYPOINT = "server.ts";
export const E4_PORT_ENV_VAR = "E4_PORT";

// Values are sealed in e4-sealed-constants v0.3 (`executor` block); tests may pass smaller
// timeouts, real runs must load the sealed values.
export type E4ExecutorConfig = {
  readiness_timeout_ms: number;
  request_timeout_ms: number;
  readiness_poll_interval_ms: number;
};

// Test-only fault injection (the [R2: R2-5] named classification fixtures need deterministic ways
// to hit the infra branches). Never set outside tests.
export type E4ExecutorTestHooks = {
  allocate_port?: () => number; // throw ⇒ harness port-allocation failure (infra)
  bun_binary?: string; // point at a missing binary ⇒ spawn failure before agent code (infra)
  after_ready?: () => void; // throw ⇒ executor internal crash (infra)
};

export type E4ExecutorVerdict = {
  test_id: string;
  passed: boolean;
  failures: string[]; // fixed-vocabulary strings only — byte-stable across runs (ADR-006)
};

export type E4ExecutorRequestArtifact = {
  test_id: string;
  request: {
    method: string;
    path: string; // workspace-relative request path only — never host or port (ADR-006)
    headers: Record<string, string>;
    body_sent: string | null;
  };
  response: {
    status: number;
    headers_selected: Record<string, string | null>; // only headers the test definition names
    body_raw: string;
    body_canonical: string | null; // canonicalized JSON form, null when the body is not JSON
  } | null;
  outcome: "response" | "request_timeout" | "server_unavailable";
};

export type E4ExecutorCompleted = {
  kind: "completed";
  verdicts: E4ExecutorVerdict[];
  pass_count: number;
  total: number;
  transcript: E4ExecutorRequestArtifact[];
  server_stdout: string;
  server_stderr: string;
};

export type E4ExecutorReadinessFailed = {
  kind: "readiness_failed";
  classification: "agent_workspace"; // [R2: R2-5] the only classification this shape carries
  reason: string;
  server_stdout: string;
  server_stderr: string;
};

export type E4ExecutorError = {
  kind: "executor_error";
  classification_rationale: string; // required, post-hoc auditable (manifest pin)
};

export type E4ExecutorResult = E4ExecutorCompleted | E4ExecutorReadinessFailed | E4ExecutorError;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortJsonValue((value as Record<string, unknown>)[key])])
    );
  }

  return value;
}

// ADR-006 comparison basis: key-order-insensitive, whitespace-normalized (JSON.stringify of a
// recursively key-sorted value has exactly one byte form).
export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function allocateFreePort(): number {
  const probe = Bun.serve({ port: 0, fetch: () => new Response("") });
  const port = probe.port;
  probe.stop(true);

  if (typeof port !== "number" || port <= 0) {
    throw new Error("port-0 bind returned no usable port");
  }

  return port;
}

async function drainStream(stream: ReadableStream<Uint8Array> | number | undefined): Promise<string> {
  if (!stream || typeof stream === "number") {
    return "";
  }

  return await new Response(stream).text();
}

type E4SpawnedServer = ReturnType<typeof Bun.spawn>;

async function waitForReadiness(
  proc: E4SpawnedServer,
  baseUrl: string,
  config: E4ExecutorConfig
): Promise<{ ready: true } | { ready: false; reason: string }> {
  const deadline = Date.now() + config.readiness_timeout_ms;

  while (Date.now() < deadline) {
    if (proc.exitCode !== null || proc.signalCode !== null) {
      return {
        ready: false,
        reason: `server process exited (code ${proc.exitCode ?? `signal ${proc.signalCode}`}) before becoming ready`
      };
    }

    try {
      // Any HTTP response at all means the server is up — the scaffold dispatcher answers 404 on
      // unknown routes, and readiness asserts liveness, never behavior.
      await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(config.request_timeout_ms) });
      return { ready: true };
    } catch {
      await Bun.sleep(config.readiness_poll_interval_ms);
    }
  }

  return {
    ready: false,
    reason: `server not ready within ${config.readiness_timeout_ms}ms (readiness timeout)`
  };
}

function requestHeaders(test: E4HttpTest): Record<string, string> {
  return {
    ...(test.request.body !== undefined ? { "content-type": "application/json" } : {}),
    ...(test.request.headers ?? {})
  };
}

function evaluateExpectations(
  test: E4HttpTest,
  status: number,
  bodyRaw: string
): { failures: string[]; bodyCanonical: string | null } {
  const failures: string[] = [];
  const expected = test.expected;

  let parsed: unknown;
  let bodyIsJson = false;

  if (bodyRaw.length > 0) {
    try {
      parsed = JSON.parse(bodyRaw);
      bodyIsJson = true;
    } catch {
      bodyIsJson = false;
    }
  }

  if (status !== expected.status) {
    failures.push(`status: expected ${expected.status}, got ${status}`);
  }

  if (expected.body !== undefined) {
    if (!bodyIsJson) {
      failures.push("body: expected JSON, got a non-JSON body");
    } else if (canonicalizeJson(parsed) !== canonicalizeJson(expected.body)) {
      failures.push("body: canonical JSON mismatch");
    }
  }

  if (expected.array_min_length !== undefined) {
    if (!bodyIsJson || !Array.isArray(parsed)) {
      failures.push("body: expected a JSON array");
    } else if (parsed.length < expected.array_min_length) {
      failures.push(`body: expected array length >= ${expected.array_min_length}, got ${parsed.length}`);
    }
  }

  if (expected.error_envelope_keys !== undefined) {
    // Shape assertion only (testgen: the convention statement pins exactly
    // { "error": { <k1>: string, <k2>: string } }, never message wording).
    const [keyA, keyB] = expected.error_envelope_keys;
    const envelope =
      bodyIsJson && typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    const inner =
      envelope !== null &&
      Object.keys(envelope).length === 1 &&
      typeof envelope.error === "object" &&
      envelope.error !== null &&
      !Array.isArray(envelope.error)
        ? (envelope.error as Record<string, unknown>)
        : null;
    const shapeOk =
      inner !== null &&
      Object.keys(inner).sort().join(",") === [keyA, keyB].sort().join(",") &&
      typeof inner[keyA] === "string" &&
      typeof inner[keyB] === "string";

    if (!shapeOk) {
      failures.push(`body: expected error envelope of shape { "error": { "${keyA}": string, "${keyB}": string } }`);
    }
  }

  // Selected-header expectations are evaluated by the caller, which records headers_selected in
  // the transcript alongside the comparison (ADR-006: only headers named by the test definition).
  return { failures, bodyCanonical: bodyIsJson ? canonicalizeJson(parsed) : null };
}

async function runTestSequence(
  proc: E4SpawnedServer,
  baseUrl: string,
  tests: E4HttpTest[],
  config: E4ExecutorConfig
): Promise<{ verdicts: E4ExecutorVerdict[]; transcript: E4ExecutorRequestArtifact[] }> {
  const verdicts: E4ExecutorVerdict[] = [];
  const transcript: E4ExecutorRequestArtifact[] = [];

  // Fixed order, exactly one in-flight request (ADR-006): the tests array order is part of the
  // generated test definition and therefore seeded and replayable.
  for (const test of tests) {
    const headers = requestHeaders(test);
    const bodySent = test.request.body !== undefined ? JSON.stringify(test.request.body) : null;
    const requestArtifact: E4ExecutorRequestArtifact["request"] = {
      method: test.request.method,
      path: test.request.path,
      headers,
      body_sent: bodySent
    };

    if (proc.exitCode !== null || proc.signalCode !== null) {
      verdicts.push({ test_id: test.test_id, passed: false, failures: ["no response: server unavailable"] });
      transcript.push({ test_id: test.test_id, request: requestArtifact, response: null, outcome: "server_unavailable" });
      continue;
    }

    let response: Response;
    let bodyRaw: string;

    try {
      response = await fetch(`${baseUrl}${test.request.path}`, {
        method: test.request.method,
        headers,
        ...(bodySent !== null ? { body: bodySent } : {}),
        signal: AbortSignal.timeout(config.request_timeout_ms)
      });
      bodyRaw = await response.text();
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      const outcome = timedOut ? "request_timeout" : "server_unavailable";
      verdicts.push({
        test_id: test.test_id,
        passed: false,
        failures: [timedOut ? `no response: request timeout after ${config.request_timeout_ms}ms` : "no response: server unavailable"]
      });
      transcript.push({ test_id: test.test_id, request: requestArtifact, response: null, outcome });
      continue;
    }

    const { failures, bodyCanonical } = evaluateExpectations(test, response.status, bodyRaw);

    const headersSelected: Record<string, string | null> = {};

    for (const [name, value] of Object.entries(test.expected.headers ?? {})) {
      const actual = response.headers.get(name);
      headersSelected[name.toLowerCase()] = actual;

      if (actual !== value) {
        failures.push(`header ${name.toLowerCase()}: expected ${JSON.stringify(value)}, got ${JSON.stringify(actual)}`);
      }
    }

    verdicts.push({ test_id: test.test_id, passed: failures.length === 0, failures });
    transcript.push({
      test_id: test.test_id,
      request: requestArtifact,
      response: { status: response.status, headers_selected: headersSelected, body_raw: bodyRaw, body_canonical: bodyCanonical },
      outcome: "response"
    });
  }

  return { verdicts, transcript };
}

// The one executor, four call sites (hidden oracle, gate red, gate green, Arm-H feedback — ADR-006
// consequence: what the gate enforces and what the oracle scores can never diverge).
export async function runE4OracleExecutor(input: {
  workspace_dir: string;
  tests: E4HttpTest[];
  config: E4ExecutorConfig;
  hooks?: E4ExecutorTestHooks;
}): Promise<E4ExecutorResult> {
  const { workspace_dir, tests, config, hooks } = input;

  let port: number;

  try {
    port = hooks?.allocate_port ? hooks.allocate_port() : allocateFreePort();
  } catch (error) {
    return {
      kind: "executor_error",
      classification_rationale: `harness port-allocation/bind failure: ${errorMessage(error)}`
    };
  }

  let proc: E4SpawnedServer;

  try {
    proc = Bun.spawn([hooks?.bun_binary ?? "bun", E4_EXECUTOR_ENTRYPOINT], {
      cwd: workspace_dir,
      env: { ...process.env, [E4_PORT_ENV_VAR]: String(port) },
      stdout: "pipe",
      stderr: "pipe"
    });
  } catch (error) {
    return {
      kind: "executor_error",
      classification_rationale: `workspace process spawn failure before agent code ran: ${errorMessage(error)}`
    };
  }

  const baseUrl = `http://127.0.0.1:${port}`;
  const readiness = await waitForReadiness(proc, baseUrl, config);

  if (!readiness.ready) {
    proc.kill();
    await proc.exited;
    const [stdout, stderr] = await Promise.all([drainStream(proc.stdout), drainStream(proc.stderr)]);

    // The one readiness failure inside the closed infra enumeration: the app could not bind the
    // port the HARNESS allocated. That is a harness port-allocation fault (a collision in the
    // allocate-then-spawn window), not agent behavior.
    if (/EADDRINUSE|address already in use/i.test(stderr)) {
      return {
        kind: "executor_error",
        classification_rationale:
          "harness port-allocation/bind failure: the harness-allocated port was already in use at server start (EADDRINUSE)"
      };
    }

    return {
      kind: "readiness_failed",
      classification: "agent_workspace",
      reason: readiness.reason,
      server_stdout: stdout,
      server_stderr: stderr
    };
  }

  try {
    hooks?.after_ready?.();

    const { verdicts, transcript } = await runTestSequence(proc, baseUrl, tests, config);

    proc.kill();
    await proc.exited;
    const [stdout, stderr] = await Promise.all([drainStream(proc.stdout), drainStream(proc.stderr)]);

    return {
      kind: "completed",
      verdicts,
      pass_count: verdicts.filter((verdict) => verdict.passed).length,
      total: verdicts.length,
      transcript,
      server_stdout: stdout,
      server_stderr: stderr
    };
  } catch (error) {
    proc.kill();
    await proc.exited.catch(() => {});
    return {
      kind: "executor_error",
      classification_rationale: `executor internal crash: ${errorMessage(error)}`
    };
  }
}
