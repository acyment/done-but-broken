import type { ConditionId } from "./conditions";
import {
  E1VerificationBudget,
  applyFullFileReplacementEntries,
  runVerificationRequest,
  verifyProtectedPathHashes,
  type ApplyReplacementResult,
  type ProtectedPathHashes,
  type ProtectedPathHashMismatch,
  type VerificationRunResult
} from "./e1-harness";
import type { E1SealedConstants } from "./e1-l1-constants";
import { E1TurnParser, type E1ParsedTurn } from "./e1-l1-parser";

export type E1Termination =
  | { classification: "done"; reason: string }
  | { classification: "agent_stalled"; reason: string }
  | { classification: "budget_exhausted"; reason: string }
  | { classification: "invalid_integrity"; reason: string }
  | { classification: "provider_error"; reason: string };

export type E1TokenUsageSide = {
  output_tokens?: number;
  injected_verification_output_tokens?: number;
  cached_input_tokens?: number;
};

export type E1TokenUsage = {
  provider?: E1TokenUsageSide;
  estimator?: E1TokenUsageSide;
};

export type E1TokenLedgerSnapshot = {
  debited_tokens: number;
  max_checkpoint_tokens?: number;
  exhausted: boolean;
  ledger_source: "provider" | "estimator" | "none";
  cached_prefix_tokens: number;
  estimator_shadow_tokens?: E1TokenUsageSide;
};

export class E1TokenLedger {
  readonly maxCheckpointTokens?: number;
  debitedTokens = 0;
  cachedPrefixTokens = 0;
  estimatorShadowTokens?: E1TokenUsageSide;
  ledgerSource: "provider" | "estimator" | "none" = "none";

  constructor(input: { maxCheckpointTokens?: number } = {}) {
    if (
      input.maxCheckpointTokens !== undefined &&
      (!Number.isInteger(input.maxCheckpointTokens) || input.maxCheckpointTokens < 0)
    ) {
      throw new Error("maxCheckpointTokens must be a non-negative integer when provided.");
    }

    this.maxCheckpointTokens = input.maxCheckpointTokens;
  }

  debit(usage?: E1TokenUsage): E1TokenLedgerSnapshot {
    const source = usage?.provider ? "provider" : usage?.estimator ? "estimator" : "none";
    const primary = usage?.provider ?? usage?.estimator;
    const debited =
      (primary?.output_tokens ?? 0) + (primary?.injected_verification_output_tokens ?? 0);

    this.debitedTokens += debited;
    this.cachedPrefixTokens += primary?.cached_input_tokens ?? 0;
    this.ledgerSource = source;

    if (usage?.estimator) {
      this.estimatorShadowTokens = usage.estimator;
    }

    return this.snapshot();
  }

  snapshot(): E1TokenLedgerSnapshot {
    return {
      debited_tokens: this.debitedTokens,
      ...(this.maxCheckpointTokens !== undefined
        ? { max_checkpoint_tokens: this.maxCheckpointTokens }
        : {}),
      exhausted:
        this.maxCheckpointTokens !== undefined && this.debitedTokens > this.maxCheckpointTokens,
      ledger_source: this.ledgerSource,
      cached_prefix_tokens: this.cachedPrefixTokens,
      ...(this.estimatorShadowTokens
        ? { estimator_shadow_tokens: this.estimatorShadowTokens }
        : {})
    };
  }
}

export class E1CheckpointTurnState {
  readonly maxModelTurns: number;
  readonly verificationBudget: E1VerificationBudget;
  readonly tokenLedger: E1TokenLedger;
  turnsUsed = 0;
  consecutiveNoOpTurns = 0;

  constructor(input: {
    maxModelTurns: number;
    maxVerificationExecutions: number;
    tokenLedger?: E1TokenLedger;
  }) {
    if (!Number.isInteger(input.maxModelTurns) || input.maxModelTurns < 1) {
      throw new Error("maxModelTurns must be a positive integer.");
    }

    this.maxModelTurns = input.maxModelTurns;
    this.verificationBudget = new E1VerificationBudget(input.maxVerificationExecutions);
    this.tokenLedger = input.tokenLedger ?? new E1TokenLedger();
  }
}

export type E1TurnL0Result = {
  replacement_result: ApplyReplacementResult | null;
  post_replacement_integrity?: { ok: true } | { ok: false; mismatches: ProtectedPathHashMismatch[] };
  verification_result: VerificationRunResult | null;
};

export type E1TurnAdapterResult = {
  turn_index: number;
  condition_id: ConditionId;
  checkpoint_id: string;
  parsed: E1ParsedTurn;
  l0: E1TurnL0Result;
  next_turn_injections: string[];
  termination: E1Termination | null;
  verification_budget: { used: number; max: number; remaining: number };
  token_ledger: E1TokenLedgerSnapshot;
};

export class E1TurnAdapter {
  private readonly parser: E1TurnParser;

  constructor(
    private readonly input: {
      constants: E1SealedConstants;
      workspacePath: string;
      protectedPathBaseline?: ProtectedPathHashes;
      timeoutMs?: number;
      outputLimit?: number;
    }
  ) {
    this.parser = new E1TurnParser(input.constants);
  }

  async runTurn(input: {
    conditionId: ConditionId;
    checkpointId: string;
    checkpoints: string[];
    rawModelOutput: string;
    state: E1CheckpointTurnState;
    tokenUsage?: E1TokenUsage;
  }): Promise<E1TurnAdapterResult> {
    input.state.turnsUsed += 1;
    const turnIndex = input.state.turnsUsed;
    const parsed = this.parser.parse(input.rawModelOutput);
    const tokenLedger = input.state.tokenLedger.debit(input.tokenUsage);
    const emptyL0: E1TurnL0Result = {
      replacement_result: null,
      verification_result: null
    };

    if (tokenLedger.exhausted) {
      return this.buildResult({
        input,
        turnIndex,
        parsed,
        l0: emptyL0,
        nextTurnInjections: [],
        termination: { classification: "budget_exhausted", reason: "token budget exhausted" }
      });
    }

    if (turnIndex > input.state.maxModelTurns) {
      return this.buildResult({
        input,
        turnIndex,
        parsed,
        l0: emptyL0,
        nextTurnInjections: [],
        termination: { classification: "budget_exhausted", reason: "model turn budget exhausted" }
      });
    }

    if (parsed.no_op) {
      input.state.consecutiveNoOpTurns += 1;
      const threshold = this.input.constants.turn_protocol.consecutive_noop_stall_threshold;
      const termination =
        input.state.consecutiveNoOpTurns >= threshold
          ? {
              classification: "agent_stalled" as const,
              reason: `${threshold} consecutive no-op turns`
            }
          : null;

      return this.buildResult({
        input,
        turnIndex,
        parsed,
        l0: emptyL0,
        nextTurnInjections: ["no valid blocks parsed"],
        termination
      });
    }

    input.state.consecutiveNoOpTurns = 0;

    const replacementResult = parsed.replacements.length
      ? await applyFullFileReplacementEntries({
          workspacePath: this.input.workspacePath,
          replacements: parsed.replacements
        })
      : null;
    const postReplacementIntegrity = this.input.protectedPathBaseline
      ? await verifyProtectedPathHashes({
          workspacePath: this.input.workspacePath,
          baseline: this.input.protectedPathBaseline
        })
      : undefined;
    const replacementInjections = replacementResult ? summarizeReplacementResult(replacementResult) : [];

    if (postReplacementIntegrity && !postReplacementIntegrity.ok) {
      return this.buildResult({
        input,
        turnIndex,
        parsed,
        l0: {
          replacement_result: replacementResult,
          post_replacement_integrity: postReplacementIntegrity,
          verification_result: null
        },
        nextTurnInjections: replacementInjections,
        termination: {
          classification: "invalid_integrity",
          reason: "protected path integrity mismatch after replacement"
        }
      });
    }

    if (!parsed.verification) {
      return this.buildResult({
        input,
        turnIndex,
        parsed,
        l0: {
          replacement_result: replacementResult,
          ...(postReplacementIntegrity ? { post_replacement_integrity: postReplacementIntegrity } : {}),
          verification_result: null
        },
        nextTurnInjections: replacementInjections,
        termination: parsed.done ? { classification: "done", reason: "model declared done" } : null
      });
    }

    const verificationBudget = input.state.verificationBudget.consume();

    if (!verificationBudget.allowed) {
      return this.buildResult({
        input,
        turnIndex,
        parsed,
        l0: {
          replacement_result: replacementResult,
          ...(postReplacementIntegrity ? { post_replacement_integrity: postReplacementIntegrity } : {}),
          verification_result: null
        },
        nextTurnInjections: [...replacementInjections, "verification budget exhausted"],
        termination: { classification: "budget_exhausted", reason: "verification budget exhausted" }
      });
    }

    const verificationResult = await runVerificationRequest({
      workspacePath: this.input.workspacePath,
      conditionId: input.conditionId,
      command: parsed.verification.raw,
      checkpoints: input.checkpoints,
      timeoutMs: this.input.timeoutMs,
      outputLimit: this.input.outputLimit,
      protectedPathBaseline: this.input.protectedPathBaseline
    });
    const verificationInjection = summarizeVerificationResult(verificationResult);
    const postVerificationIntegrity = verificationResult.protected_path_integrity;
    const integrityTermination =
      postVerificationIntegrity && !postVerificationIntegrity.ok
        ? {
            classification: "invalid_integrity" as const,
            reason: "protected path integrity mismatch after verification"
          }
        : null;

    return this.buildResult({
      input,
      turnIndex,
      parsed,
      l0: {
        replacement_result: replacementResult,
        ...(postReplacementIntegrity ? { post_replacement_integrity: postReplacementIntegrity } : {}),
        verification_result: verificationResult
      },
      nextTurnInjections: [...replacementInjections, verificationInjection],
      termination:
        integrityTermination ??
        (parsed.done ? { classification: "done", reason: "model declared done" } : null)
    });
  }

  private buildResult(input: {
    input: {
      conditionId: ConditionId;
      checkpointId: string;
      state: E1CheckpointTurnState;
    };
    turnIndex: number;
    parsed: E1ParsedTurn;
    l0: E1TurnL0Result;
    nextTurnInjections: string[];
    termination: E1Termination | null;
  }): E1TurnAdapterResult {
    return {
      turn_index: input.turnIndex,
      condition_id: input.input.conditionId,
      checkpoint_id: input.input.checkpointId,
      parsed: input.parsed,
      l0: input.l0,
      next_turn_injections: input.nextTurnInjections,
      termination: input.termination,
      verification_budget: {
        used: input.input.state.verificationBudget.used,
        max: input.input.state.verificationBudget.max,
        remaining: Math.max(0, input.input.state.verificationBudget.max - input.input.state.verificationBudget.used)
      },
      token_ledger: input.input.state.tokenLedger.snapshot()
    };
  }
}

function summarizeReplacementResult(result: ApplyReplacementResult): string[] {
  if (result.applied) {
    return result.confirmations;
  }

  if (!result.errors.length) {
    return [];
  }

  return [`replacement rejected: ${result.errors.join("; ")}`];
}

function summarizeVerificationResult(result: VerificationRunResult): string {
  if (!result.accepted) {
    return result.shown_output;
  }

  return [
    `verification: ${result.command}`,
    `exit_code: ${result.exit_code}`,
    result.shown_output
  ]
    .filter((part) => part.length > 0)
    .join("\n");
}
