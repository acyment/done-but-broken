// Hermetic per-scenario executor (E4V2 design §5.2 step 3, A4). Each scenario runs against a
// FRESH workspace server process; scenarios execute in document order (isolation, not
// randomization, removes order-dependence — R7). Reuses the v1 executor's canonicalized-JSON
// comparison and its timeout/classification discipline; the spawn differs in one deliberate way:
// the server binds port 0 and the executor reads the actual port off the server's stdout line,
// so concurrent scenario processes can never collide on a pre-allocated port.
//
// [R1-B1]/[R2: R2-5] classification carries over: a server that fails to become ready is
// `readiness_failed`/agent_workspace (scored red by callers, sequence continues); executor_error
// is reserved for the closed infra enumeration (spawn failure before agent code, executor
// internal crash).
import { canonicalizeJson, type E4ExecutorConfig } from "../oracle-executor";
import { isRequestClassStep, renderStepText, type E4V2Scenario, type E4V2Step } from "./scenario";

export const E4_V2_EXECUTOR_ENTRYPOINT = "server.ts";
const PORT_LINE_PATTERN = /listening on port (\d+)/;

export type E4V2StepOutcome = {
  text: string;
  executed: boolean;
  ok: boolean;
  failure: string | null;
  response_status: number | null; // the current response's status when this step ran (requests: the response they produced)
};

export type E4V2ScenarioFailureMode = "assertion" | "route_absent" | null;

export type E4V2ScenarioVerdict =
  | {
      kind: "completed";
      title: string;
      passed: boolean;
      failures: string[]; // fixed-vocabulary strings, byte-stable across runs
      failure_mode: E4V2ScenarioFailureMode;
      steps: E4V2StepOutcome[];
    }
  | { kind: "readiness_failed"; title: string; classification: "agent_workspace"; reason: string; server_stderr: string }
  | { kind: "executor_error"; title: string; classification_rationale: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type SpawnedServer = {
  proc: ReturnType<typeof Bun.spawn>;
  baseUrl: string;
};

async function readPortFromStdout(
  proc: ReturnType<typeof Bun.spawn>,
  timeoutMs: number
): Promise<{ port: number } | { failed: string }> {
  const stdout = proc.stdout;

  if (!stdout || typeof stdout === "number") {
    return { failed: "server stdout is not a readable stream" };
  }

  const reader = stdout.getReader();
  const decoder = new TextDecoder();
  const deadline = Date.now() + timeoutMs;
  let buffer = "";

  try {
    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      const chunk = await Promise.race([
        reader.read(),
        Bun.sleep(remaining).then(() => "timeout" as const)
      ]);

      if (chunk === "timeout") {
        break;
      }

      if (chunk.done) {
        return { failed: `server process exited (code ${proc.exitCode ?? `signal ${proc.signalCode}`}) before becoming ready` };
      }

      buffer += decoder.decode(chunk.value, { stream: true });
      const match = buffer.match(PORT_LINE_PATTERN);

      if (match) {
        return { port: Number(match[1]) };
      }
    }

    return { failed: `server not ready within ${timeoutMs}ms (readiness timeout)` };
  } finally {
    reader.releaseLock();
  }
}

async function spawnScenarioServer(
  workspaceDir: string,
  config: E4ExecutorConfig
): Promise<SpawnedServer | { readiness_failure: string; server_stderr: string } | { spawn_failure: string }> {
  let proc: ReturnType<typeof Bun.spawn>;

  try {
    proc = Bun.spawn(["bun", E4_V2_EXECUTOR_ENTRYPOINT], {
      cwd: workspaceDir,
      env: { ...process.env, E4_PORT: "0" },
      stdout: "pipe",
      stderr: "pipe"
    });
  } catch (error) {
    return { spawn_failure: `workspace process spawn failure before agent code ran: ${errorMessage(error)}` };
  }

  const outcome = await readPortFromStdout(proc, config.readiness_timeout_ms);

  if ("failed" in outcome) {
    proc.kill();
    await proc.exited;
    const stderr = proc.stderr && typeof proc.stderr !== "number" ? await new Response(proc.stderr).text() : "";
    return { readiness_failure: outcome.failed, server_stderr: stderr };
  }

  return { proc, baseUrl: `http://127.0.0.1:${outcome.port}` };
}

// Exact substitution of scenario-local remembered variables: every occurrence of `{name}` for a
// BOUND name is replaced; unbound placeholders are left untouched (they are literal text).
function substituteRemembered(text: string, remembered: Map<string, unknown>): string {
  let result = text;

  for (const [name, value] of remembered) {
    const rendered = typeof value === "string" ? value : JSON.stringify(value);
    result = result.split(`{${name}}`).join(rendered);
  }

  return result;
}

// Dot-separated object path resolution (§5.3 <json.path>: object traversal only, no array
// indexing). A segment that hits a non-object or a missing key resolves to undefined.
export function resolveJsonPath(value: unknown, path: string): unknown {
  let current: unknown = value;

  for (const segment of path.split(".")) {
    if (typeof current !== "object" || current === null || Array.isArray(current) || !(segment in (current as Record<string, unknown>))) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

type CurrentResponse = {
  status: number;
  body_raw: string;
  parsed: unknown;
  body_is_json: boolean;
};

function assertionFailure(step: E4V2Step, response: CurrentResponse | null, remembered: Map<string, unknown>): string | null {
  if (response === null) {
    return "no response: a request step must precede this step";
  }

  switch (step.kind) {
    case "assert_status":
      return response.status === step.status ? null : `status: expected ${step.status}, got ${response.status}`;
    case "assert_field_equals_remembered": {
      if (!remembered.has(step.name)) {
        return `field "${step.json_path}": no remembered value named "${step.name}"`;
      }
      const actual = resolveJsonPath(response.body_is_json ? response.parsed : undefined, step.json_path);
      if (actual === undefined) {
        return `field "${step.json_path}": expected the remembered "${step.name}", but the field is not present`;
      }
      return canonicalizeJson(actual) === canonicalizeJson(remembered.get(step.name))
        ? null
        : `field "${step.json_path}": expected the remembered "${step.name}", got ${canonicalizeJson(actual)}`;
    }
    case "assert_field_equals": {
      const actual = resolveJsonPath(response.body_is_json ? response.parsed : undefined, step.json_path);
      if (actual === undefined) {
        return `field "${step.json_path}": expected ${step.literal_json}, but the field is not present`;
      }
      return canonicalizeJson(actual) === canonicalizeJson(JSON.parse(step.literal_json))
        ? null
        : `field "${step.json_path}": expected ${step.literal_json}, got ${canonicalizeJson(actual)}`;
    }
    case "assert_body_equals": {
      if (!response.body_is_json) {
        return "body: expected JSON, got a non-JSON body";
      }
      return canonicalizeJson(response.parsed) === canonicalizeJson(JSON.parse(step.literal_json))
        ? null
        : "body: canonical JSON mismatch";
    }
    case "assert_no_field": {
      const actual = resolveJsonPath(response.body_is_json ? response.parsed : undefined, step.json_path);
      return actual === undefined ? null : `field "${step.json_path}": expected absent, found present`;
    }
    case "assert_list_length": {
      if (!response.body_is_json || !Array.isArray(response.parsed)) {
        return "list: expected a JSON array body";
      }
      return response.parsed.length === step.length
        ? null
        : `list: expected length ${step.length}, got ${response.parsed.length}`;
    }
    case "assert_field_type": {
      const actual = resolveJsonPath(response.body_is_json ? response.parsed : undefined, step.json_path);
      if (actual === undefined) {
        return `field "${step.json_path}": expected a ${step.json_type}, but the field is not present`;
      }
      const matches =
        step.json_type === "array"
          ? Array.isArray(actual)
          : step.json_type === "object"
            ? typeof actual === "object" && actual !== null && !Array.isArray(actual)
            : typeof actual === step.json_type;
      return matches ? null : `field "${step.json_path}": expected a ${step.json_type}`;
    }
    default:
      return `internal: not an assertion step: ${step.kind}`;
  }
}

// A10 failure-mode signature: the red is classified "route_absent" when the response the failing
// step was judging is a 404 the step did not itself expect — the request surface is missing, as
// opposed to present-but-wrong behavior ("assertion").
function classifyFailureMode(step: E4V2Step, response: CurrentResponse | null): E4V2ScenarioFailureMode {
  if (response !== null && response.status === 404 && !(step.kind === "assert_status" && step.status === 404)) {
    return "route_absent";
  }

  return "assertion";
}

export async function runE4V2Scenario(input: {
  workspace_dir: string;
  scenario: E4V2Scenario;
  config: E4ExecutorConfig;
}): Promise<E4V2ScenarioVerdict> {
  const { workspace_dir, scenario, config } = input;
  const spawned = await spawnScenarioServer(workspace_dir, config);

  if ("spawn_failure" in spawned) {
    return { kind: "executor_error", title: scenario.title, classification_rationale: spawned.spawn_failure };
  }

  if ("readiness_failure" in spawned) {
    return {
      kind: "readiness_failed",
      title: scenario.title,
      classification: "agent_workspace",
      reason: spawned.readiness_failure,
      server_stderr: spawned.server_stderr
    };
  }

  const { proc, baseUrl } = spawned;
  const steps: E4V2StepOutcome[] = [];
  const remembered = new Map<string, unknown>();
  let current: CurrentResponse | null = null;
  let failure: string | null = null;
  let failureMode: E4V2ScenarioFailureMode = null;

  try {
    for (const step of scenario.steps) {
      const text = renderStepText(step);

      if (failure !== null) {
        steps.push({ text, executed: false, ok: false, failure: null, response_status: null });
        continue;
      }

      if (step.kind === "request" || step.kind === "request_body") {
        const path = substituteRemembered(step.path, remembered);
        const body = step.kind === "request_body" ? substituteRemembered(step.body_json, remembered) : null;

        try {
          const response = await fetch(`${baseUrl}${path}`, {
            method: step.method,
            headers: body !== null ? { "content-type": "application/json" } : {},
            ...(body !== null ? { body } : {}),
            signal: AbortSignal.timeout(config.request_timeout_ms)
          });
          const bodyRaw = await response.text();
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

          current = { status: response.status, body_raw: bodyRaw, parsed, body_is_json: bodyIsJson };
          steps.push({ text, executed: true, ok: true, failure: null, response_status: response.status });
        } catch (error) {
          const timedOut = error instanceof Error && error.name === "TimeoutError";
          failure = timedOut
            ? `no response: request timeout after ${config.request_timeout_ms}ms`
            : "no response: server unavailable";
          failureMode = "assertion";
          steps.push({ text, executed: true, ok: false, failure, response_status: null });
        }
        continue;
      }

      if (step.kind === "remember") {
        const value = resolveJsonPath(current?.body_is_json ? current.parsed : undefined, step.json_path);

        if (current === null || value === undefined) {
          failure = `remember "${step.name}": field "${step.json_path}" is not present in the current response`;
          failureMode = classifyFailureMode(step, current);
          steps.push({ text, executed: true, ok: false, failure, response_status: current?.status ?? null });
        } else {
          remembered.set(step.name, value);
          steps.push({ text, executed: true, ok: true, failure: null, response_status: current.status });
        }
        continue;
      }

      const stepFailure = assertionFailure(step, current, remembered);

      if (stepFailure !== null) {
        failure = stepFailure;
        failureMode = classifyFailureMode(step, current);
      }

      steps.push({ text, executed: true, ok: stepFailure === null, failure: stepFailure, response_status: current?.status ?? null });
    }
  } catch (error) {
    proc.kill();
    await proc.exited.catch(() => {});
    return { kind: "executor_error", title: scenario.title, classification_rationale: `executor internal crash: ${errorMessage(error)}` };
  }

  proc.kill();
  await proc.exited;

  return {
    kind: "completed",
    title: scenario.title,
    passed: failure === null,
    failures: failure === null ? [] : [failure],
    failure_mode: failure === null ? null : failureMode,
    steps
  };
}

// Runs a scenario SET, each scenario against its own fresh server process, preserving document
// order in the returned verdicts. `concurrency` bounds simultaneous server processes; results
// are order-stable regardless of completion order (port collisions are designed out by the
// port-0 + stdout-port handshake).
export async function runE4V2ScenarioSet(input: {
  workspace_dir: string;
  scenarios: E4V2Scenario[];
  config: E4ExecutorConfig;
  concurrency?: number;
}): Promise<E4V2ScenarioVerdict[]> {
  const concurrency = Math.max(1, input.concurrency ?? 4);
  const verdicts: E4V2ScenarioVerdict[] = new Array(input.scenarios.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < input.scenarios.length) {
      const index = nextIndex;
      nextIndex += 1;
      verdicts[index] = await runE4V2Scenario({
        workspace_dir: input.workspace_dir,
        scenario: input.scenarios[index],
        config: input.config
      });
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, input.scenarios.length) }, () => worker()));

  return verdicts;
}
