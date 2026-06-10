import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadE1Constants, providerSealBlockers, validateE1Constants } from "../src/e1-l1-constants";

const CONSTANTS_PATH = join(
  import.meta.dir,
  "..",
  "docs",
  "protocols",
  "e1-frontier-sealed-constants-v1.0.json"
);

describe("E1 frontier sealed constants", () => {
  test("loads through the strict runtime validator and matches active condition IDs", async () => {
    const constants = await loadE1Constants(CONSTANTS_PATH);

    expect(constants.schema).toBe("e1-sealed-constants");
    expect(constants.version).toBe("1.0.0");
    expect(constants.status).toBe("sealed");
    expect(constants.workspace_snapshot.renderer_id).toBe("e1-workspace-snapshot-v1");
    expect(constants.workspace_snapshot.included_roots).toEqual(["scratch/", "specs/", "src/"]);
    expect(constants.conversation.message_structure.messages).toEqual([
      "system_template",
      "checkpoint_start_repo_injection",
      "checkpoint_variant_content"
    ]);
    expect(constants.condition_ids).toEqual(["context_only_spec", "feedback_capable_spec"]);
    expect(constants.deferred_before_provider_seal).toEqual([]);
    expect(constants.provider_runtime.failure_policy).toMatchObject({
      retryable_failure_kinds: [
        "api_error",
        "timeout",
        "rate_limit",
        "malformed_response",
        "network_error"
      ],
      max_attempts: 3,
      backoff_ms: [250, 1000, 4000],
      retries_cost_turns: false,
      retries_cost_tokens: false,
      exhausted_classification: "provider_error",
      exhausted_run_policy: "terminate_and_rerun_fresh_identity"
    });
    expect(constants.provider_runtime.sampling_defaults).toMatchObject({
      temperature: 0.2,
      top_p: 1,
      max_output_tokens_per_turn: 4000
    });
    expect(constants.provider_runtime.seed_semantics.meaning).toBe("pairing_label_not_sampling_seed");
    expect(constants.provider_runtime.cache_breakpoints).toMatchObject({
      breakpoints: ["system_template_boundary", "checkpoint_start_repo_injection"],
      cached_usage_ledger_field: "cached_prefix_tokens",
      debit_policy: "record_not_debit"
    });
    expect(constants.provider_runtime.live_mode_gate).toMatchObject({
      explicit_flag_required: true,
      spend_cap_required: true,
      spend_cap_classification: "spend_cap_reached",
      spend_cap_policy: "terminate_and_exclude_from_analysis"
    });
    expect(constants.provider_runtime.redaction).toMatchObject({
      fail_closed_bundle_check: true,
      secret_value_policy: "never_record_raw"
    });
    expect(constants.token_estimator.status).toBe("sealed");
    expect(constants.token_estimator.estimator_id).toBe("js-tiktoken-o200k_base-v1");
    expect(constants.token_estimator.package).toBe("js-tiktoken");
    expect(constants.token_estimator.package_version).toBe("1.0.21");
    expect(constants.token_estimator.encoding).toBe("o200k_base");
    expect(constants.token_estimator.operational_uses).toEqual([
      "verification_output_truncation",
      "shadow_token_ledger"
    ]);
    expect(constants.path_grammar.regex).toBe("^[A-Za-z0-9._-][A-Za-z0-9._/-]*$");
    expect(constants.path_grammar.relative_only).toBe(true);
    expect(constants.path_grammar.no_trailing_slash).toBe(true);
    expect(constants.path_grammar.no_double_slash).toBe(true);
    expect(new RegExp(constants.path_grammar.regex).test("scratch/probe.ts")).toBe(true);
    expect(new RegExp(constants.path_grammar.regex).test("/tmp/workspace/scratch/probe.ts")).toBe(false);
    expect(new RegExp(constants.path_grammar.regex).test("scratch\\probe.ts")).toBe(false);
    expect(constants.turn_protocol.consecutive_noop_stall_threshold).toBe(3);
    expect(constants.turn_protocol.stall_classification).toBe("agent_stalled");
    expect(constants.conversation.thread_scope).toBe("fresh_per_checkpoint");
    expect(constants.conversation.prior_checkpoint_memory).toBe("workspace_only");
    expect(constants.arm_difference_allowlist.assembled_conversation_scope).toBe("checkpoint_start");
    expect(constants.arm_difference_allowlist.context_only_forbidden_substrings).toContain("bun run spec");
    expect(constants.checkpoint_continuation.agent_stalled).toBe("continue_from_workspace_as_is");
    expect(constants.checkpoint_continuation.budget_exhausted).toBe("continue_from_workspace_as_is");
    expect(constants.checkpoint_continuation.invalid_integrity).toBe("terminate_run");
    expect(constants.checkpoint_continuation.provider_error).toBe("terminate_run");
    expect(constants.checkpoint_continuation.spend_cap_reached).toBe("terminate_run");
    expect(constants.oracle_scoring.cadence).toBe("every_turn_snapshot");
    expect(constants.metrics.regression_free_auc.formula_id).toBe(
      "checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1"
    );
    expect(constants.package_separation.task_package_visibility).toBe("mounted_into_agent_workspaces");
    expect(constants.package_separation.oracle_package_visibility).toBe("external_never_mounted");
    expect(constants.virtual_clock.required).toBe(true);
    expect(constants.bundle_grading.dev_when_constants_status).toBe("draft-pre-seal");
    expect(constants.audit.integrity_rule).toContain("replacement application");
    expect(constants.audit.integrity_rule).toContain("verification execution");
    expect(providerSealBlockers(constants)).toEqual([]);
  });

  test("rejects missing and unknown top-level fields so docs and runtime cannot drift", async () => {
    const raw = JSON.parse(await readFile(CONSTANTS_PATH, "utf8"));
    delete raw.block_grammar;
    expect(() => validateE1Constants(raw)).toThrow("missing required key: block_grammar");

    const withUnknown = JSON.parse(await readFile(CONSTANTS_PATH, "utf8"));
    withUnknown.experimental_extra = true;
    expect(() => validateE1Constants(withUnknown)).toThrow("unknown top-level key");
  });

  test("rejects malformed regexes and sealed policy flips", async () => {
    const badRegex = JSON.parse(await readFile(CONSTANTS_PATH, "utf8"));
    badRegex.path_grammar.regex = "([unclosed";
    expect(() => validateE1Constants(badRegex)).toThrow("does not compile");

    const flipped = JSON.parse(await readFile(CONSTANTS_PATH, "utf8"));
    flipped.block_grammar.multiple_verify_policy = "last_wins";
    expect(() => validateE1Constants(flipped)).toThrow("multiple_verify_policy must be first_wins");
  });

  test("rejects command templates that use condition aliases", async () => {
    const raw = JSON.parse(await readFile(CONSTANTS_PATH, "utf8"));
    raw.command_grammar.templates[0].conditions = ["context", "feedback"];
    expect(() => validateE1Constants(raw)).toThrow("non-protocol condition id");
  });

  test("rejects token-estimator seal drift", async () => {
    const raw = JSON.parse(await readFile(CONSTANTS_PATH, "utf8"));
    raw.token_estimator.status = "TBD";
    expect(() => validateE1Constants(raw)).toThrow("token_estimator.status must be sealed");

    const wrongEncoding = JSON.parse(await readFile(CONSTANTS_PATH, "utf8"));
    wrongEncoding.token_estimator.encoding = "cl100k_base";
    expect(() => validateE1Constants(wrongEncoding)).toThrow("js-tiktoken o200k_base");
  });

  test("rejects provider runtime seal drift", async () => {
    const wrongRetry = JSON.parse(await readFile(CONSTANTS_PATH, "utf8"));
    wrongRetry.provider_runtime.failure_policy.max_attempts = 2;
    expect(() => validateE1Constants(wrongRetry)).toThrow("provider failure policy is not sealed");

    const wrongSeed = JSON.parse(await readFile(CONSTANTS_PATH, "utf8"));
    wrongSeed.provider_runtime.seed_semantics.meaning = "provider_rng_seed";
    expect(() => validateE1Constants(wrongSeed)).toThrow("pairing_label_not_sampling_seed");

    const wrongCache = JSON.parse(await readFile(CONSTANTS_PATH, "utf8"));
    wrongCache.provider_runtime.cache_breakpoints.breakpoints = ["system_template_boundary"];
    expect(() => validateE1Constants(wrongCache)).toThrow("cache breakpoint policy is not sealed");

    const wrongLiveGate = JSON.parse(await readFile(CONSTANTS_PATH, "utf8"));
    wrongLiveGate.provider_runtime.live_mode_gate.explicit_flag_required = false;
    expect(() => validateE1Constants(wrongLiveGate)).toThrow("live mode gate policy is not sealed");

    const wrongRedaction = JSON.parse(await readFile(CONSTANTS_PATH, "utf8"));
    wrongRedaction.provider_runtime.redaction.fail_closed_bundle_check = false;
    expect(() => validateE1Constants(wrongRedaction)).toThrow("redaction policy is not sealed");
  });
});
