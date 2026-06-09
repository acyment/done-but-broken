import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_MODEL_LOOP_POLICY,
  createModelLoopAgent,
  createOpenAiCompatibleFeedbackLoopAgent,
  createOpenRouterFeedbackLoopAgent,
  type FeedbackCommandRunner,
  type ModelLoopCall
} from "../src/model-loop-agent";
import { verifyRunArtifacts } from "../src/provenance";
import { runPilot, type AgentRunInput } from "../src/runner";
import { loadTaskPackage } from "../src/task-package";

const repoRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/test$/, "");
const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("model loop agent", () => {
  test("runs visible feedback for feedback_capable_spec but not context_only_spec", async () => {
    const workspace = await setupWorkspace();
    const feedbackCalls: string[] = [];
    const agent = createModelLoopAgent({
      model: modelReturningNoWrites(),
      feedbackRunner: runnerRecording(feedbackCalls)
    });

    const feedbackResult = await agent.run(agentInput({
      workspace_path: workspace,
      condition_id: "feedback_capable_spec",
      feedback_command: "bun run spec",
      executable_feedback_paths: ["spec/visible.spec.ts"]
    }));
    const contextResult = await agent.run(agentInput({
      workspace_path: workspace,
      condition_id: "context_only_spec"
    }));

    expect(feedbackCalls).toEqual(["bun run spec", "bun run spec"]);
    expect(feedbackResult.feedback_available).toBe(true);
    expect(feedbackResult.feedback_runs).toBe(2);
    expect(contextResult.feedback_available).toBe(false);
    expect(contextResult.feedback_runs).toBe(0);
  });

  test("respects max model turns and max feedback runs", async () => {
    const workspace = await setupWorkspace();
    const calls: ModelLoopCall[] = [];
    const feedbackCalls: string[] = [];
    const agent = createModelLoopAgent({
      max_model_turns: 2,
      max_feedback_runs: 1,
      model: async (call) => {
        calls.push(call);
        return { status: "ok", files: [] };
      },
      feedbackRunner: runnerRecording(feedbackCalls)
    });

    const result = await agent.run(agentInput({
      workspace_path: workspace,
      condition_id: "feedback_capable_spec",
      feedback_command: "bun run spec",
      executable_feedback_paths: ["spec/visible.spec.ts"]
    }));

    expect(calls).toHaveLength(2);
    expect(feedbackCalls).toHaveLength(1);
    expect(result.max_model_turns).toBe(2);
    expect(result.max_feedback_runs).toBe(1);
    expect(result.model_turns).toBe(2);
    expect(result.feedback_runs).toBe(1);
  });

  test("context-only self-review prompt contains visible spec text but no feedback output", async () => {
    const workspace = await setupWorkspace();
    const calls: ModelLoopCall[] = [];
    const agent = createModelLoopAgent({
      model: async (call) => {
        calls.push(call);
        return { status: "ok", files: [] };
      },
      feedbackRunner: async () => ({
        command: "bun run spec",
        exit_code: 1,
        stdout: "VISIBLE FEEDBACK FAILURE",
        stderr: "",
        summary: "VISIBLE FEEDBACK FAILURE"
      })
    });

    const result = await agent.run(agentInput({
      workspace_path: workspace,
      condition_id: "context_only_spec"
    }));

    expect(result.model_turns).toBe(DEFAULT_MODEL_LOOP_POLICY.max_model_turns);
    expect(result.max_model_turns).toBe(DEFAULT_MODEL_LOOP_POLICY.max_model_turns);
    expect(result.max_feedback_runs).toBe(DEFAULT_MODEL_LOOP_POLICY.max_feedback_runs);
    expect(result.feedback_available).toBe(false);
    expect(result.feedback_runs).toBe(0);
    expect(result.feedback_command).toBeUndefined();
    expect(result.feedback_summaries).toEqual([]);
    expect(calls[1].feedback_available).toBe(false);
    expect(calls[1].feedback_summaries).toEqual([]);
    expect(calls[1].prompt).toContain("Visible semantic spec");
    expect(calls[1].prompt).toContain("OWNER CAN EDIT");
    expect(calls[1].prompt).toContain("Self-review against the visible semantic spec only");
    expect(calls[1].prompt).not.toContain("VISIBLE FEEDBACK FAILURE");
    expect(calls[1].prompt).not.toContain("Feedback result");
  });

  test("feedback summaries exclude hidden oracle paths and private oracle details", async () => {
    const workspace = await setupWorkspace();
    const calls: ModelLoopCall[] = [];
    const agent = createModelLoopAgent({
      model: async (call) => {
        calls.push(call);
        return { status: "ok", files: [] };
      },
      feedbackRunner: async () => ({
        command: "bun run spec",
        exit_code: 1,
        stdout: [
          "visible owner check failed",
          `${workspace}/src/subject.ts: visible assertion location`,
          "/tmp/run/hidden-oracle/private.ts",
          "/private/oracle.ts: private assertion location",
          "role-permissions-calibration:I06:explicit-deny-overrides",
          "PRIVATE_ORACLE_DETAIL"
        ].join("\n"),
        stderr: "Error: visible assertion"
      })
    });

    const result = await agent.run(agentInput({
      workspace_path: workspace,
      condition_id: "feedback_capable_spec",
      feedback_command: "bun run spec",
      executable_feedback_paths: ["spec/visible.spec.ts"]
    }));

    expect(result.feedback_summaries).toHaveLength(2);
    expect(result.feedback_summaries[0]).toContain("visible owner check failed");
    expect(result.feedback_summaries[0]).toContain("<workspace>/src/subject.ts: visible assertion location");
    expect(result.feedback_summaries[0]).not.toContain("hidden-oracle");
    expect(result.feedback_summaries[0]).not.toContain("private assertion location");
    expect(result.feedback_summaries[0]).not.toContain("PRIVATE_ORACLE_DETAIL");
    expect(calls[1].prompt).toContain("Feedback result 1");
    expect(calls[1].prompt).not.toContain("hidden-oracle");
    expect(calls[1].prompt).not.toContain("PRIVATE_ORACLE_DETAIL");
  });

  test("rejects feedback asset writes before touching any workspace file", async () => {
    const workspace = await setupWorkspace();
    const agent = createModelLoopAgent({
      model: async () => ({
        status: "ok",
        files: [
          { path: "spec/visible.spec.ts", content: "tampered\n" },
          { path: "src/subject.ts", content: "changed\n" }
        ]
      }),
      feedbackRunner: runnerRecording([])
    });

    const result = await agent.run(agentInput({
      workspace_path: workspace,
      condition_id: "feedback_capable_spec",
      feedback_command: "bun run spec",
      executable_feedback_paths: ["spec/visible.spec.ts"]
    }));

    expect(result.status).toBe("failed");
    expect(result.feedback_assets_modified).toBe(true);
    expect(result.notes).toContain("read-only feedback asset");
    expect(await readFile(join(workspace, "spec", "visible.spec.ts"), "utf8")).toBe("visible feedback\n");
    expect(await readFile(join(workspace, "src", "subject.ts"), "utf8")).toBe("initial\n");
  });

  test("loop-generated run records provenance and still verifies", async () => {
    const root = await mkTempRoot();
    const task = await loadTaskPackage(join(repoRoot, "tasks", "sample-cart"));
    const agent = createModelLoopAgent({
      model: modelReturningNoWrites(),
      feedbackRunner: async () => ({
        command: "bun run spec",
        exit_code: 0,
        stdout: "pass\n",
        stderr: ""
      })
    });
    const result = await runPilot({
      task,
      run_id: "loop-provenance",
      runs_root: join(root, "runs"),
      agent,
      hidden_oracle: {
        async run(input) {
          return {
            status: "ok",
            checks: [
              {
                check_id: `${input.checkpoint_id}-visible-check`,
                commitment_id: "cart-total-visible",
                passed: true
              }
            ]
          };
        }
      }
    });
    const feedbackAgentResult = JSON.parse(
      await readFile(
        join(
          root,
          "runs",
          "loop-provenance",
          "feedback_capable_spec",
          "checkpoints",
          "I01",
          "agent-result.json"
        ),
        "utf8"
      )
    );

    expect(feedbackAgentResult.model_turns).toBe(DEFAULT_MODEL_LOOP_POLICY.max_model_turns);
    expect(feedbackAgentResult.feedback_runs).toBe(DEFAULT_MODEL_LOOP_POLICY.max_feedback_runs);
    expect(feedbackAgentResult.feedback_available).toBe(true);
    expect(feedbackAgentResult.feedback_command).toBe("bun run spec");
    expect(feedbackAgentResult.final_file_writes).toEqual([]);
    expect(feedbackAgentResult.feedback_assets_modified).toBe(false);
    expect(await verifyRunArtifacts(result.run_manifest_path)).toMatchObject({ ok: true });
  });

  test("OpenRouter loop factory uses chat completions without network in tests", async () => {
    const workspace = await setupWorkspace();
    const requests: Array<{ url: string; body: any }> = [];
    const agent = createOpenRouterFeedbackLoopAgent({
      apiKey: "sk-or-test",
      max_model_turns: 2,
      max_feedback_runs: 1,
      fetch: async (url, init) => {
        const body = JSON.parse(init.body);
        requests.push({ url, body });

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    status: "ok",
                    files: []
                  })
                }
              }
            ]
          }),
          { status: 200 }
        );
      }
    });

    const openRouterResult = await agent.run(agentInput({
      workspace_path: workspace,
      condition_id: "context_only_spec"
    }));

    expect(openRouterResult.adapter_id).toBe("openrouter-loop:deepseek/deepseek-v4-flash");
    expect(requests).toHaveLength(2);
    expect(requests[0].url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(requests[0].body.messages[1].content).toContain("Visible semantic spec");
    expect(requests[1].body.messages[1].content).toContain("Self-review against the visible semantic spec only");
  });

  test("OpenRouter loop accepts text-part message content arrays", async () => {
    const workspace = await setupWorkspace();
    const agent = createOpenRouterFeedbackLoopAgent({
      apiKey: "sk-or-test",
      max_model_turns: 1,
      fetch: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({
                        status: "ok",
                        files: [
                          {
                            path: "src/subject.ts",
                            content: "changed through text part\n"
                          }
                        ]
                      })
                    }
                  ]
                }
              }
            ]
          }),
          { status: 200 }
        )
    });

    const result = await agent.run(agentInput({
      workspace_path: workspace,
      condition_id: "context_only_spec"
    }));

    expect(result.status).toBe("ok");
    expect(await readFile(join(workspace, "src", "subject.ts"), "utf8")).toBe("changed through text part\n");
  });

  test("OpenRouter loop can request strict JSON schema structured outputs", async () => {
    const workspace = await setupWorkspace();
    const requests: Array<{ body: any }> = [];
    const agent = createOpenRouterFeedbackLoopAgent({
      apiKey: "sk-or-test",
      max_model_turns: 1,
      responseFormat: "json_schema",
      requireParameters: true,
      fetch: async (_url, init) => {
        requests.push({ body: JSON.parse(String(init.body)) });

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    status: "ok",
                    notes: "schema output",
                    files: [],
                    transcript: []
                  })
                }
              }
            ]
          }),
          { status: 200 }
        );
      }
    });

    const result = await agent.run(agentInput({
      workspace_path: workspace,
      condition_id: "context_only_spec"
    }));

    expect(result.status).toBe("ok");
    expect(requests[0].body.max_tokens).toBe(16_000);
    expect(requests[0].body.max_completion_tokens).toBeUndefined();
    expect(requests[0].body.provider).toEqual({ require_parameters: true });
    expect(requests[0].body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        name: "model_loop_response",
        strict: true,
        schema: {
          type: "object",
          required: ["status", "notes", "files", "transcript"],
          additionalProperties: false
        }
      }
    });
    expect(requests[0].body.response_format.json_schema.schema.properties.files.items).toMatchObject({
      type: "object",
      required: ["path", "content"],
      additionalProperties: false
    });
  });

  test("OpenAI-compatible loop supports LiteLLM-style chat completions without OpenRouter routing params", async () => {
    const workspace = await setupWorkspace();
    const requests: Array<{ url: string; headers: Record<string, string>; body: any }> = [];
    const agent = createOpenAiCompatibleFeedbackLoopAgent({
      provider: "litellm",
      apiKey: "sk-litellm-test",
      model: "anthropic/claude-sonnet-4.6",
      endpoint: "http://localhost:4000/v1/chat/completions",
      max_model_turns: 1,
      responseFormat: "json_schema",
      fetch: async (url, init) => {
        requests.push({
          url,
          headers: init.headers,
          body: JSON.parse(String(init.body))
        });

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    status: "ok",
                    notes: "schema output",
                    files: [],
                    transcript: []
                  })
                }
              }
            ]
          }),
          { status: 200 }
        );
      }
    });

    const result = await agent.run(agentInput({
      workspace_path: workspace,
      condition_id: "context_only_spec"
    }));

    expect(result.status).toBe("ok");
    expect(result.adapter_id).toBe("openai-compatible-loop:litellm:anthropic/claude-sonnet-4.6");
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("http://localhost:4000/v1/chat/completions");
    expect(requests[0].headers.Authorization).toBe("Bearer sk-litellm-test");
    expect(requests[0].body.model).toBe("anthropic/claude-sonnet-4.6");
    expect(requests[0].body.max_tokens).toBe(16_000);
    expect(requests[0].body.provider).toBeUndefined();
    expect(requests[0].body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        name: "model_loop_response",
        strict: true
      }
    });
  });

  test("OpenAI-compatible loop records provider-specific failure details", async () => {
    const workspace = await setupWorkspace();
    const agent = createOpenAiCompatibleFeedbackLoopAgent({
      provider: "deepseek",
      apiKey: "sk-deepseek-test",
      model: "deepseek-v4-pro",
      endpoint: "https://api.deepseek.com/chat/completions",
      requestTimeoutMs: 1,
      fetch: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
    });

    const result = await agent.run(agentInput({
      workspace_path: workspace,
      condition_id: "context_only_spec"
    }));

    expect(result.status).toBe("failed");
    expect(result.validity_flags).toEqual(["provider_timeout"]);
    expect(result.validity_details?.[0]).toMatchObject({
      flag: "provider_timeout",
      scope: "checkpoint",
      condition_id: "context_only_spec",
      checkpoint_id: "I01",
      provider: "deepseek",
      provider_failure_phase: "pre_model_action_timeout",
      workspace_carried_forward_due_to_provider_failure: true
    });
  });

  test("OpenRouter loop retries malformed JSON once and records recovered provider validity", async () => {
    const workspace = await setupWorkspace();
    let callCount = 0;
    const agent = createOpenRouterFeedbackLoopAgent({
      apiKey: "sk-or-test",
      max_model_turns: 1,
      maxProviderRetries: 1,
      fetch: async () => {
        callCount += 1;

        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: '{"status":"ok","files":[{"path":"src/subject.ts","content":"unterminated'
                  }
                }
              ]
            }),
            { status: 200 }
          );
        }

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    status: "ok",
                    files: [
                      {
                        path: "src/subject.ts",
                        content: "recovered retry write\n"
                      }
                    ],
                    transcript: []
                  })
                }
              }
            ]
          }),
          { status: 200 }
        );
      }
    });

    const result = await agent.run(agentInput({
      workspace_path: workspace,
      condition_id: "context_only_spec"
    }));

    expect(callCount).toBe(2);
    expect(result.status).toBe("ok");
    expect(await readFile(join(workspace, "src", "subject.ts"), "utf8")).toBe("recovered retry write\n");
    expect(result.validity_flags).toEqual(["provider_malformed_response"]);
    expect(result.workspace_carried_forward_due_to_provider_failure).toBeUndefined();
    expect(result.validity_details?.[0]).toMatchObject({
      flag: "provider_malformed_response",
      scope: "checkpoint",
      condition_id: "context_only_spec",
      checkpoint_id: "I01",
      provider: "openrouter",
      retryable: true,
      model_turn_number: 1,
      feedback_had_run: false,
      model_response_received: true,
      code_changed: false,
      workspace_carried_forward_due_to_provider_failure: false,
      retry_count: 1
    });
    expect(result.validity_details?.[0].provider_failure_phase).toBeUndefined();
  });

  test("OpenRouter loop records retry-recovered timeout details", async () => {
    const workspace = await setupWorkspace();
    let callCount = 0;
    const agent = createOpenRouterFeedbackLoopAgent({
      apiKey: "sk-or-test",
      requestTimeoutMs: 1,
      max_model_turns: 1,
      maxProviderRetries: 1,
      fetch: async (_url, init) => {
        callCount += 1;

        if (callCount === 1) {
          return new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
          });
        }

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    status: "ok",
                    files: [],
                    transcript: []
                  })
                }
              }
            ]
          }),
          { status: 200 }
        );
      }
    });

    const result = await agent.run(agentInput({
      workspace_path: workspace,
      condition_id: "context_only_spec"
    }));

    expect(callCount).toBe(2);
    expect(result.status).toBe("ok");
    expect(result.validity_flags).toEqual(["provider_timeout"]);
    expect(result.validity_details?.[0]).toMatchObject({
      flag: "provider_timeout",
      retryable: true,
      provider_failure_phase: "retry_recovered_timeout",
      model_turn_number: 1,
      feedback_had_run: false,
      model_response_received: false,
      code_changed: false,
      workspace_carried_forward_due_to_provider_failure: false,
      retry_count: 1
    });
  });

  test("OpenRouter loop records provider timeout validity details", async () => {
    const workspace = await setupWorkspace();
    const agent = createOpenRouterFeedbackLoopAgent({
      apiKey: "sk-or-test",
      requestTimeoutMs: 1,
      fetch: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
    });

    const result = await agent.run(agentInput({
      workspace_path: workspace,
      condition_id: "context_only_spec"
    }));

    expect(result.status).toBe("failed");
    expect(result.validity_flags).toEqual(["provider_timeout"]);
    expect(result.validity_details?.[0]).toMatchObject({
      flag: "provider_timeout",
      scope: "checkpoint",
      condition_id: "context_only_spec",
      checkpoint_id: "I01",
      provider: "openrouter",
      retryable: true,
      provider_failure_phase: "pre_model_action_timeout",
      model_turn_number: 1,
      feedback_had_run: false,
      model_response_received: false,
      code_changed: false,
      workspace_carried_forward_due_to_provider_failure: true,
      retry_count: 0
    });
  });

  test("OpenRouter loop records malformed JSON without a timeout phase", async () => {
    const workspace = await setupWorkspace();
    const agent = createOpenRouterFeedbackLoopAgent({
      apiKey: "sk-or-test",
      max_model_turns: 1,
      fetch: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: '{"status":"ok","files":[{"path":"src/subject.ts","content":"unterminated'
                }
              }
            ]
          }),
          { status: 200 }
        )
    });

    const result = await agent.run(agentInput({
      workspace_path: workspace,
      condition_id: "context_only_spec"
    }));

    expect(result.status).toBe("failed");
    expect(result.validity_flags).toEqual(["provider_malformed_response"]);
    expect(result.validity_details?.[0]).toMatchObject({
      flag: "provider_malformed_response",
      model_response_received: true,
      workspace_carried_forward_due_to_provider_failure: true
    });
    expect(result.validity_details?.[0].provider_failure_phase).toBeUndefined();
  });

  test("OpenRouter loop classifies repair-turn timeouts after feedback ran", async () => {
    const workspace = await setupWorkspace();
    let callCount = 0;
    const agent = createOpenRouterFeedbackLoopAgent({
      apiKey: "sk-or-test",
      requestTimeoutMs: 1,
      max_model_turns: 2,
      max_feedback_runs: 1,
      fetch: async (_url, init) => {
        callCount += 1;

        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      status: "ok",
                      files: [
                        {
                          path: "src/subject.ts",
                          content: "turn one change\n"
                        }
                      ]
                    })
                  }
                }
              ]
            }),
            { status: 200 }
          );
        }

        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        });
      }
    });

    const result = await agent.run(agentInput({
      workspace_path: workspace,
      condition_id: "feedback_capable_spec",
      feedback_command: "bun run spec",
      executable_feedback_paths: ["spec/visible.spec.ts"]
    }));

    expect(result.status).toBe("failed");
    expect(result.feedback_runs).toBe(1);
    expect(result.final_file_writes).toEqual(["src/subject.ts"]);
    expect(result.validity_details?.[0]).toMatchObject({
      flag: "provider_timeout",
      provider_failure_phase: "repair_turn_timeout",
      model_turn_number: 2,
      feedback_had_run: true,
      model_response_received: false,
      code_changed: true,
      workspace_carried_forward_due_to_provider_failure: false
    });
  });

  test("runner lifts agent provider validity details into run manifests", async () => {
    const root = await mkTempRoot();
    const task = await loadTaskPackage(join(repoRoot, "tasks", "sample-cart"));
    const agent = createOpenRouterFeedbackLoopAgent({
      apiKey: "sk-or-test",
      requestTimeoutMs: 1,
      fetch: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
    });
    const result = await runPilot({
      task,
      run_id: "loop-timeout-validity",
      runs_root: join(root, "runs"),
      agent,
      run_classification: "diagnostic_invalid",
      budget: {
        max_model_turns: 2,
        max_feedback_runs: 1
      },
      model_provider: {
        provider: "openrouter",
        model: "deepseek/deepseek-v4-flash",
        adapter_id: "openrouter-loop"
      }
    });
    const manifest = JSON.parse(await readFile(result.run_manifest_path, "utf8"));

    expect(manifest.validity_flags).toEqual(["provider_timeout"]);
    expect(manifest.validity_details.length).toBeGreaterThan(0);
    expect(manifest.validity_details[0]).toMatchObject({
      flag: "provider_timeout",
      scope: "checkpoint",
      provider: "openrouter",
      provider_failure_phase: "pre_model_action_timeout",
      workspace_carried_forward_due_to_provider_failure: true
    });
    expect(manifest.clean_primary_evidence_eligible).toBe(false);
  });
});

function modelReturningNoWrites() {
  return async () => ({
    status: "ok" as const,
    files: []
  });
}

function runnerRecording(calls: string[]): FeedbackCommandRunner {
  return async (input) => {
    calls.push(input.command);

    return {
      command: input.command,
      exit_code: 1,
      stdout: "visible owner check failed\n",
      stderr: "Assertion failed\n"
    };
  };
}

function agentInput(input: {
  workspace_path: string;
  condition_id: "context_only_spec" | "feedback_capable_spec";
  feedback_command?: string;
  executable_feedback_paths?: string[];
}): AgentRunInput {
  return {
    condition_id: input.condition_id,
    checkpoint_id: "I01",
    workspace_path: input.workspace_path,
    artifact_dir: join(input.workspace_path, "..", "artifacts", input.condition_id),
    packet: {
      condition_id: input.condition_id,
      task_id: "loop-test",
      checkpoint_id: "I01",
      visible_spec_text: "OWNER CAN EDIT\n",
      prompt_text: "Task: loop-test\nCheckpoint: I01\nOWNER CAN EDIT\n",
      executable_feedback_paths: input.executable_feedback_paths ?? [],
      feedback_assets: [],
      feedback_command: input.feedback_command,
      public_api_contract: "export function subject(): string"
    }
  };
}

async function setupWorkspace() {
  const root = await mkTempRoot();
  const workspace = join(root, "workspace");

  await mkdir(join(workspace, "src"), { recursive: true });
  await mkdir(join(workspace, "spec"), { recursive: true });
  await mkdir(join(root, "artifacts"), { recursive: true });
  await writeFile(join(workspace, "src", "subject.ts"), "initial\n");
  await writeFile(join(workspace, "spec", "visible.spec.ts"), "visible feedback\n");

  return workspace;
}

async function mkTempRoot() {
  const root = join(tmpdir(), `hit-sdd-bench-loop-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  tempRoots.push(root);
  await mkdir(root, { recursive: true });

  return root;
}
