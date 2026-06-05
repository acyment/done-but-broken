import type { TaskDefinition } from "../../src/task-model";

export function createSampleTask(templateWorkspace = "/tmp/template-workspace"): TaskDefinition {
  return {
    task_id: "sample-long-horizon-task",
    checkpoints: ["I01", "I02"],
    template_workspace: templateWorkspace,
    canonical_spec: {
      records: [
        {
          spec_id: "SPEC-001",
          checkpoint_introduced: "I01",
          commitment_id: "cart-total-visible",
          title: "Cart total remains visible",
          intent: "Users can always see the current cart total after adding an item.",
          given: "a cart with one existing item",
          when: "the user adds another item",
          then: "the displayed cart total reflects both items",
          active_checkpoints: ["I01", "I02"],
          feedback_binding: {
            asset_id: "cart-total-visible-check"
          },
          hidden_oracle_refs: ["hidden/oracles/cart-total-private.test.ts"]
        },
        {
          spec_id: "SPEC-002",
          checkpoint_introduced: "I02",
          commitment_id: "discount-does-not-hide-total",
          title: "Discounts do not hide totals",
          intent: "A discount message must not replace the cart total.",
          given: "a cart with an active discount",
          when: "the cart is rendered",
          then: "the discount and cart total are both visible",
          active_checkpoints: ["I02"],
          feedback_binding: {
            asset_id: "discount-total-check"
          },
          hidden_oracle_refs: ["hidden/oracles/discount-private.test.ts"]
        }
      ]
    },
    executable_feedback_assets: [
      {
        asset_id: "cart-total-visible-check",
        checkpoint_introduced: "I01",
        relative_path: "spec/cart-total-visible.spec.ts",
        content: "test('cart total remains visible', () => {});\n"
      },
      {
        asset_id: "discount-total-check",
        checkpoint_introduced: "I02",
        relative_path: "spec/discount-total.spec.ts",
        content: "test('discount does not hide total', () => {});\n"
      }
    ],
    hidden_oracle_path: "/private/oracles/sample-long-horizon-task",
    public_api_contract: "export function renderCart(items, discounts): string"
  };
}
