import { describe, expect, test } from "bun:test";
import { renderSpecPacket } from "../src/renderer";
import { createSampleTask } from "./support/sample-task";

describe("spec packet rendering", () => {
  test("both arms receive identical visible semantic spec text", () => {
    const task = createSampleTask();

    const contextPacket = renderSpecPacket({
      task,
      condition_id: "context_only_spec",
      checkpoint_id: "I02"
    });
    const feedbackPacket = renderSpecPacket({
      task,
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I02"
    });

    expect(contextPacket.visible_spec_text).toBe(feedbackPacket.visible_spec_text);
    expect(contextPacket.visible_spec_text).toContain("SPEC-001");
    expect(contextPacket.visible_spec_text).toContain("SPEC-002");
  });

  test("only feedback_capable_spec receives runnable feedback instructions and assets", () => {
    const task = createSampleTask();

    const contextPacket = renderSpecPacket({
      task,
      condition_id: "context_only_spec",
      checkpoint_id: "I02"
    });
    const feedbackPacket = renderSpecPacket({
      task,
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I02"
    });

    expect(contextPacket.feedback_command).toBeUndefined();
    expect(contextPacket.executable_feedback_paths).toEqual([]);
    expect(contextPacket.feedback_assets).toEqual([]);
    expect(contextPacket.prompt_text).not.toContain("bun run spec");
    expect(contextPacket.prompt_text).not.toContain("spec/cart-total-visible.spec.ts");

    expect(feedbackPacket.feedback_command).toBe("bun run spec");
    expect(feedbackPacket.executable_feedback_paths).toEqual([
      "spec/cart-total-visible.spec.ts",
      "spec/discount-total.spec.ts"
    ]);
    expect(feedbackPacket.feedback_assets).toHaveLength(2);
    expect(feedbackPacket.prompt_text).toContain("bun run spec");
    expect(feedbackPacket.prompt_text).toContain("spec/cart-total-visible.spec.ts");
  });

  test("feedback checks accumulate across checkpoints", () => {
    const task = createSampleTask();

    const i01Packet = renderSpecPacket({
      task,
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I01"
    });
    const i02Packet = renderSpecPacket({
      task,
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I02"
    });

    expect(i01Packet.executable_feedback_paths).toEqual(["spec/cart-total-visible.spec.ts"]);
    expect(i02Packet.executable_feedback_paths).toEqual([
      "spec/cart-total-visible.spec.ts",
      "spec/discount-total.spec.ts"
    ]);
  });

  test("feedback binding checkpoints can delay an asset without changing visible spec text", () => {
    const task = createSampleTask();
    task.canonical_spec.records[0].feedback_binding = {
      asset_id: "cart-total-visible-check",
      checkpoint_id: "I02"
    };

    const contextI01Packet = renderSpecPacket({
      task,
      condition_id: "context_only_spec",
      checkpoint_id: "I01"
    });
    const feedbackI01Packet = renderSpecPacket({
      task,
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I01"
    });
    const feedbackI02Packet = renderSpecPacket({
      task,
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I02"
    });

    expect(contextI01Packet.visible_spec_text).toBe(feedbackI01Packet.visible_spec_text);
    expect(feedbackI01Packet.feedback_command).toBeUndefined();
    expect(feedbackI01Packet.executable_feedback_paths).toEqual([]);
    expect(feedbackI02Packet.executable_feedback_paths).toEqual([
      "spec/cart-total-visible.spec.ts",
      "spec/discount-total.spec.ts"
    ]);
  });

  test("hidden oracle references are isolated from agent-visible packets", () => {
    const task = createSampleTask();

    const packet = renderSpecPacket({
      task,
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I02"
    });

    expect(packet.visible_spec_text).not.toContain("hidden/oracles");
    expect(packet.visible_spec_text).not.toContain("private.test.ts");
    expect(packet.prompt_text).not.toContain(task.hidden_oracle_path);
    expect(packet.prompt_text).not.toContain("hidden/oracles");
  });
});
