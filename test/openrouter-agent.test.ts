import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_OPENROUTER_MODEL,
  createOpenRouterAgent
} from "../src/openrouter-agent";
import type { AgentRunInput } from "../src/runner";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("OpenRouter agent adapter", () => {
  test("calls OpenRouter chat completions and applies returned workspace files", async () => {
    const workspace = await mkWorkspace();
    const requests: Array<{ url: string; init: RequestInit; body: any }> = [];
    const agent = createOpenRouterAgent({
      apiKey: "sk-or-test",
      fetch: async (url, init) => {
        const body = JSON.parse(String(init.body));
        requests.push({ url, init, body });

        return jsonResponse({
          id: "chatcmpl-test",
          model: body.model,
          choices: [
            {
              message: {
                role: "assistant",
                content: fencedJson({
                  status: "ok",
                  notes: "implemented renderCart",
                  files: [
                    {
                      path: "src/cart.ts",
                      content: "export function renderCart() { return 'Total: 10'; }\n"
                    }
                  ],
                  transcript: [
                    {
                      event: "model_note",
                      detail: "changed cart renderer"
                    }
                  ]
                })
              }
            }
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 20,
            total_tokens: 120
          }
        });
      }
    });

    const result = await agent.run(agentInput(workspace));

    expect(result.status).toBe("ok");
    expect(result.adapter_id).toBe(`openrouter:${DEFAULT_OPENROUTER_MODEL}`);
    expect(result.notes).toBe("implemented renderCart");
    expect(result.transcript).toContainEqual({
      event: "openrouter_response",
      detail: "model=deepseek/deepseek-v4-flash total_tokens=120"
    });
    expect(await readFile(join(workspace, "src", "cart.ts"), "utf8")).toBe(
      "export function renderCart() { return 'Total: 10'; }\n"
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect((requests[0].init.headers as Record<string, string>).Authorization).toBe("Bearer sk-or-test");
    expect(requests[0].body.model).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(requests[0].body.stream).toBe(false);
    expect(requests[0].body.max_tokens).toBe(16_000);
    expect(requests[0].body.max_completion_tokens).toBeUndefined();
    expect(requests[0].body.messages[1].content).toContain("Checkpoint: I01");
    expect(requests[0].body.messages[1].content).toContain("file: src/cart.ts");
  });

  test("accepts OpenRouter text-part message content arrays", async () => {
    const workspace = await mkWorkspace();
    const agent = createOpenRouterAgent({
      apiKey: "sk-or-test",
      fetch: async () =>
        jsonResponse({
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
                          path: "src/cart.ts",
                          content: "export function renderCart() { return 'Total: 10'; }\n"
                        }
                      ]
                    })
                  }
                ]
              }
            }
          ]
        })
    });

    const result = await agent.run(agentInput(workspace));

    expect(result.status).toBe("ok");
    expect(await readFile(join(workspace, "src", "cart.ts"), "utf8")).toBe(
      "export function renderCart() { return 'Total: 10'; }\n"
    );
  });

  test("rejects returned file paths that escape the workspace", async () => {
    const workspace = await mkWorkspace();
    const agent = createOpenRouterAgent({
      apiKey: "sk-or-test",
      fetch: async () =>
        jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: "ok",
                  files: [
                    {
                      path: "../outside.txt",
                      content: "escaped\n"
                    }
                  ]
                })
              }
            }
          ]
        })
    });

    const result = await agent.run(agentInput(workspace));

    expect(result.status).toBe("failed");
    expect(result.notes).toContain("must stay inside the workspace");
    expect(await pathExists(join(workspace, "..", "outside.txt"))).toBe(false);
  });

  test("rejects writes to executable feedback assets before touching the workspace", async () => {
    const workspace = await mkWorkspace();
    await mkdir(join(workspace, "spec"), { recursive: true });
    await writeFile(join(workspace, "spec", "cart-total-visible.spec.ts"), "original spec\n");
    const agent = createOpenRouterAgent({
      apiKey: "sk-or-test",
      fetch: async () =>
        jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: "ok",
                  files: [
                    {
                      path: "spec/cart-total-visible.spec.ts",
                      content: "tampered spec\n"
                    },
                    {
                      path: "src/cart.ts",
                      content: "export function renderCart() { return 'changed'; }\n"
                    }
                  ]
                })
              }
            }
          ]
        })
    });

    const input = agentInput(workspace);
    input.packet.executable_feedback_paths = ["spec/cart-total-visible.spec.ts"];
    const result = await agent.run(input);

    expect(result.status).toBe("failed");
    expect(result.notes).toContain("read-only feedback asset");
    expect(await readFile(join(workspace, "spec", "cart-total-visible.spec.ts"), "utf8")).toBe("original spec\n");
    expect(await readFile(join(workspace, "src", "cart.ts"), "utf8")).toBe(
      "export function renderCart() { return ''; }\n"
    );
  });

  test("tells the model executable feedback assets are read-only", async () => {
    const workspace = await mkWorkspace();
    const requests: Array<{ body: any }> = [];
    const agent = createOpenRouterAgent({
      apiKey: "sk-or-test",
      fetch: async (_url, init) => {
        requests.push({ body: JSON.parse(String(init.body)) });

        return jsonResponse({
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
        });
      }
    });
    const input = agentInput(workspace);
    input.packet.executable_feedback_paths = ["spec/cart-total-visible.spec.ts"];

    await agent.run(input);

    expect(requests[0].body.messages[0].content).toContain("Do not edit executable feedback assets");
    expect(requests[0].body.messages[1].content).toContain("Read-only executable feedback assets");
    expect(requests[0].body.messages[1].content).toContain("spec/cart-total-visible.spec.ts");
  });

  test("records OpenRouter API failures as failed agent results", async () => {
    const workspace = await mkWorkspace();
    const agent = createOpenRouterAgent({
      apiKey: "sk-or-test",
      fetch: async () => new Response("rate limit", { status: 429, statusText: "Too Many Requests" })
    });

    const result = await agent.run(agentInput(workspace));

    expect(result.status).toBe("failed");
    expect(result.adapter_id).toBe(`openrouter:${DEFAULT_OPENROUTER_MODEL}`);
    expect(result.notes).toContain("OpenRouter request failed: 429 Too Many Requests");
    expect(result.validity_flags).toEqual(["provider_quota_or_rate_limit"]);
    expect(result.validity_details?.[0]).toMatchObject({
      flag: "provider_quota_or_rate_limit",
      scope: "checkpoint",
      condition_id: "context_only_spec",
      checkpoint_id: "I01",
      provider: "openrouter",
      retryable: true
    });
    expect(result.transcript).toContainEqual({
      event: "openrouter_error",
      detail: "OpenRouter request failed: 429 Too Many Requests: rate limit"
    });
  });
});

function agentInput(workspace_path: string): AgentRunInput {
  return {
    condition_id: "context_only_spec",
    checkpoint_id: "I01",
    workspace_path,
    artifact_dir: join(workspace_path, "..", "artifacts"),
    packet: {
      condition_id: "context_only_spec",
      task_id: "sample-cart",
      checkpoint_id: "I01",
      visible_spec_text: "Cart totals must include item prices.\n",
      prompt_text: "Task: sample-cart\nCheckpoint: I01\nCart totals must include item prices.\n",
      executable_feedback_paths: [],
      feedback_assets: [],
      public_api_contract: "export function renderCart(): string"
    }
  };
}

async function mkWorkspace() {
  const root = join(tmpdir(), `hit-sdd-bench-openrouter-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  const workspace = join(root, "workspace");

  await mkdir(join(workspace, "src"), { recursive: true });
  await writeFile(join(workspace, "src", "cart.ts"), "export function renderCart() { return ''; }\n");
  await writeFile(join(workspace, "README.md"), "# Sample cart\n");

  return workspace;
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
}

function fencedJson(value: unknown): string {
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

async function pathExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}
