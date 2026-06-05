import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize } from "node:path";
import { assertConditionId, type ConditionId } from "./conditions";
import {
  activeSpecRecords,
  feedbackAssetsThroughCheckpoint,
  type CheckpointId,
  type FeedbackAsset,
  type SpecRecord,
  type TaskDefinition
} from "./task-model";

const FEEDBACK_COMMAND = "bun run spec";

export type RenderSpecPacketInput = {
  task: TaskDefinition;
  condition_id: ConditionId;
  checkpoint_id: CheckpointId;
};

export type RenderedSpecPacket = {
  condition_id: ConditionId;
  task_id: string;
  checkpoint_id: CheckpointId;
  visible_spec_text: string;
  prompt_text: string;
  executable_feedback_paths: string[];
  feedback_assets: FeedbackAsset[];
  feedback_command?: string;
  public_api_contract?: string;
};

export function renderSpecPacket(input: RenderSpecPacketInput): RenderedSpecPacket {
  const condition_id = assertConditionId(input.condition_id);
  const visible_spec_text = renderVisibleSemanticSpec(input.task, input.checkpoint_id);
  const feedback_assets =
    condition_id === "feedback_capable_spec"
      ? feedbackAssetsThroughCheckpoint(input.task, input.checkpoint_id)
      : [];
  const executable_feedback_paths = feedback_assets.map((asset) => asset.relative_path);
  const feedback_command =
    condition_id === "feedback_capable_spec" && feedback_assets.length > 0
      ? FEEDBACK_COMMAND
      : undefined;

  return {
    condition_id,
    task_id: input.task.task_id,
    checkpoint_id: input.checkpoint_id,
    visible_spec_text,
    prompt_text: renderPromptText({
      task: input.task,
      condition_id,
      checkpoint_id: input.checkpoint_id,
      visible_spec_text,
      executable_feedback_paths,
      feedback_command
    }),
    executable_feedback_paths,
    feedback_assets,
    feedback_command,
    public_api_contract: input.task.public_api_contract
  };
}

export async function writeFeedbackAssets(input: {
  workspace_path: string;
  packet: RenderedSpecPacket;
}): Promise<string[]> {
  if (input.packet.condition_id !== "feedback_capable_spec") {
    return [];
  }

  const writtenPaths: string[] = [];

  for (const asset of input.packet.feedback_assets) {
    const destination = workspaceDestination(input.workspace_path, asset.relative_path);

    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, asset.content);
    writtenPaths.push(asset.relative_path);
  }

  return writtenPaths;
}

function renderVisibleSemanticSpec(task: TaskDefinition, checkpoint_id: CheckpointId): string {
  const records = activeSpecRecords(task, checkpoint_id);
  const lines = [
    `# Semantic spec for ${task.task_id} at ${checkpoint_id}`,
    "",
    ...records.flatMap(renderSpecRecord)
  ];

  return lines.join("\n").trimEnd() + "\n";
}

function renderSpecRecord(record: SpecRecord): string[] {
  const lines = [
    `## ${record.spec_id}: ${record.title}`,
    `Commitment: ${record.commitment_id}`,
    `Intent: ${record.intent}`
  ];

  if (record.given) {
    lines.push(`Given: ${record.given}`);
  }

  if (record.when) {
    lines.push(`When: ${record.when}`);
  }

  if (record.then) {
    lines.push(`Then: ${record.then}`);
  }

  if (record.scenario?.length) {
    lines.push("Scenario:");
    lines.push(...record.scenario.map((line) => `- ${line}`));
  }

  lines.push("");

  return lines;
}

function renderPromptText(input: {
  task: TaskDefinition;
  condition_id: ConditionId;
  checkpoint_id: CheckpointId;
  visible_spec_text: string;
  executable_feedback_paths: string[];
  feedback_command?: string;
}): string {
  const lines = [
    `Task: ${input.task.task_id}`,
    `Checkpoint: ${input.checkpoint_id}`,
    `Condition: ${input.condition_id}`,
    ""
  ];

  if (input.task.public_api_contract) {
    lines.push("Public API contract:");
    lines.push(input.task.public_api_contract);
    lines.push("");
  }

  lines.push(input.visible_spec_text.trimEnd());
  lines.push("");

  if (input.feedback_command) {
    lines.push("Executable feedback:");
    lines.push(`Command: ${input.feedback_command}`);
    lines.push("Assets:");
    lines.push(...input.executable_feedback_paths.map((path) => `- ${path}`));
  } else {
    lines.push("Use the semantic spec as durable context. No executable feedback assets are provided.");
  }

  return lines.join("\n").trimEnd() + "\n";
}

function workspaceDestination(workspace_path: string, relative_path: string): string {
  const normalized = normalize(relative_path);

  if (isAbsolute(normalized) || normalized.startsWith("..")) {
    throw new Error(`Feedback asset path must stay inside the workspace: ${relative_path}`);
  }

  return join(workspace_path, normalized);
}
