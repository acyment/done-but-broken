import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentAdapter } from "./runner";

export type FakeAgentMode = "normal" | "context-i03-item-name-drift";

export function createFakeAgent(input: { mode?: FakeAgentMode } = {}): AgentAdapter {
  const mode = input.mode ?? "normal";

  return {
    async run(input) {
      const statePath = join(input.workspace_path, "agent-state.txt");
      const previousState = await readOptionalText(statePath);
      const sawPrevious = previousState.trim().length > 0;
      const feedbackCommand = input.packet.feedback_command ?? "none";

      await appendFile(
        statePath,
        [
          `${input.checkpoint_id} ${input.condition_id}`,
          `saw_previous=${sawPrevious}`,
          `feedback_command=${feedbackCommand}`
        ].join(" ") + "\n"
      );
      await writeFile(join(input.workspace_path, "last-prompt.txt"), input.packet.prompt_text);

      if (sawPrevious) {
        await writeFile(join(input.workspace_path, "saw-previous-checkpoint.txt"), previousState);
      }

      if (input.packet.feedback_command) {
        await writeFile(
          join(input.workspace_path, "feedback-simulated.txt"),
          [input.packet.feedback_command, ...input.packet.executable_feedback_paths].join("\n") + "\n"
        );
      }

      if (
        mode === "context-i03-item-name-drift" &&
        input.condition_id === "context_only_spec" &&
        input.checkpoint_id === "I03"
      ) {
        await writeFile(
          join(input.workspace_path, "src", "cart.ts"),
          "export function renderCart() { return `Total: 10; Discounts: sale`; }\n"
        );
      }

      return {
        status: "ok",
        adapter_id: "fake-agent",
        notes: `fake agent processed ${input.checkpoint_id}`,
        transcript: [
          {
            event: "read_prompt",
            detail: input.packet.condition_id
          },
          {
            event: "write_workspace",
            detail: "agent-state.txt"
          },
          {
            event: "mode",
            detail: mode
          }
        ]
      };
    }
  };
}

async function readOptionalText(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "";
    }

    throw error;
  }
}
