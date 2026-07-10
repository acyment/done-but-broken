# E4 v2-M8 — second-model pilot (GLM 5.2) — scoping (v1)

**Status: SCOPING ONLY. This document authorizes nothing.** No live calls, no spend, no
pre-registration is sealed by this doc. Every live step below (wiring smoke, budget calibration,
evidence run) requires separate explicit operator authorization. Milestone label `v2-M8` is
provisional pending operator confirmation.

## 0. Amendment A — Option B: realistic thinking-ON configuration (2026-07-09)

The original scoping (v1, below as amended) planned GLM with extended thinking **disabled**, to
mirror the M7 deepseek run exactly. Operator decision 2026-07-09 (**"b"**): run GLM in its
**realistic configuration — thinking ON** — because a CTO audience's first objection to a
thinking-off result is "you crippled the model." This amendment folds that decision through the
whole doc. What it changes, and why (motivating findings recorded in §9a/§10 from the M8 step-1
research + code trace):

- **M8 is deliberately NOT a strict replication of M7.** M7 = the austere/controlled lens
  (thinking off, conservative measurement); M8 = the realistic lens (thinking on, how a frontier
  coding agent is actually run). Two Level-4 pilots, side by side, never pooled (§1, §7).
- **Thinking stays ON** (GLM's default). The §2 "disable it" premise is retired; the residual
  hazard is now purely *measurement* — are the reasoning tokens honestly counted? (§2, §5).
- **The per-turn reasoning tripwire (old §4) is removed.** It could not crash loudly where it was
  specified — two retry ladders would catch, retry (~9 extra live calls), and reclassify it as a
  `provider_error` task outcome (§10, Conflict 3). Option B dissolves the need: with thinking
  intended ON there is nothing to trip on. It is replaced by **setup-time validity checks** at
  smoke and calibration (new §4), which sidestep the retry ladders entirely — no runner surgery.
- **The §3.1 preset is dropped** (§10, Conflict 2): the E4 v2 live path is CLI-flag-driven; the
  preset registry has no consumer on it. GLM wires via flags exactly as M6/M7 deepseek did.
- **The calibration runs thinking-ON with budget/`max_tokens` headroom** — reasoning burns tokens
  and GLM output is $4.40/M, so the M7 budget (490k tokens / 16k max_tokens) likely needs to grow;
  the calibration decides and freezes GLM's own budgets (§6).

## 1. Purpose

Run **GLM 5.2** (z.ai) as a **second, realistic-configuration** frontier pilot alongside the M7
deepseek result (`docs/protocols/e4-v2-m7-pilot-run-report-v1.md`, verdict `go`, commit
`de9a679`). Primary candidate GLM 5.2, chosen by the operator 2026-07-09 for audience recognition;
pre-decided fallback **Qwen 3.7 Max** (§8 — decided *now*, before any wiring, so a later switch is
not model-shopping).

Claim consequence (binding): a clean go here is a **second, separate Level-4 single-model pilot
claim** under its own task/model/budget. Metrics are never pooled across models (separate
compatibility boundaries). The two runs form **two complementary lenses**, not one replication:

- If both show the same pattern (prose drifts faster; executed gate fresher but still able to be
  dishonest), that is a **stronger** statement than a single-config replication — the effect holds
  in both the austere and the realistic setting.
- If they **diverge** — e.g. thinking-on GLM catches its own drift, or its executed gate is
  honest — that divergence is itself a clean, publishable Level-4 finding that answers the
  "you crippled it" critique head-on. Reported at face value either way.

"Two frontier models, same pattern" is publishable only as two Level-4 claims stated side by side
(each labeled with its configuration: M7 thinking-off / M8 thinking-on), or as an
explicitly-preliminary general statement per AGENTS.md. Level 5 remains disallowed.

## 2. Thinking is ON — the one thing that must be measured

GLM 5.2 is a reasoning model; extended thinking is its default and the realistic way to run it, so
**we run it on.** The residual hazard is not that thinking is on — it is whether the provider's
reported token usage **honestly includes the reasoning tokens**, because those tokens are billed
and count against the sealed per-task budget even though the reasoning text is not part of the
agent-visible transcript.

Two facts from the code trace (M8 step-1):

1. `extractOpenAICompatibleUsage` (`src/e1-live-provider.ts`) reads `usage.prompt_tokens`,
   `usage.completion_tokens`, and `usage.prompt_tokens_details.cached_tokens` — and **nothing in
   the codebase reads a separate reasoning-token field** (no `completion_tokens_details`
   handling anywhere).
2. The full raw response body — reasoning included — is already preserved in the provider
   **exchange artifact** (`provider_exchange.redacted_response.body`), so audit/replay integrity is
   fine regardless; the open question is purely the *budget count*.

Therefore the accounting is honest **iff** GLM folds reasoning tokens into `usage.completion_tokens`
(the standard OpenAI-compatible behavior, and what the original §2 assumed). The **smoke measures
which** (§5). If reasoning is reported *separately* (e.g. `completion_tokens_details.reasoning_tokens`)
and *excluded* from `completion_tokens`, the budget ledger and the derived cost would **undercount**
— fixed by a small **E4-side adjustment** (read the side count from the response body E4 already
receives, add it to output tokens and to the derived cost) before calibration. No shared/sealed code
is touched; the seal pins only the constants *file*, and this lives in `src/e4/live-provider.ts`.

## 3. Endpoint wiring plan (code, no spend)

1. **No preset.** (§10, Conflict 2.) The E4 v2 live path is CLI-flag-driven; `MODEL_LOOP_PRESETS`
   has no consumer on it. Wire GLM exactly as M6/M7 deepseek was wired — through `bin/e4-v2.ts`
   flags, with the §9a values:
   `--model glm-5.2`
   `--endpoint https://api.z.ai/api/paas/v4/chat/completions` (general paas/v4, **not** the coding
   endpoint) · `--api-key-env ZHIPU_API_KEY` (E2 precedent)
   `--pricing-in 1.4 --pricing-cached 0.26 --pricing-out 4.4` (cap-guardrail overestimates; must be
   ≥ the §9a actuals — the M7 values 0.5/0.05/2.0 must **not** be reused).
   The run stamps the label `preset: "direct-openai-compatible"` (unchanged hard-coded value) and
   `route_id: "direct-zhipu-api-key"` (derived from the key env).
2. **Thinking-ON request extras** go through the existing `--extra-body` channel (`bin/e4-v2.ts` →
   `E4LiveProviderConfig.extra_body` → `withExtraBody` transport wrapper). GLM's default is thinking
   on (`reasoning_effort` default `max`), so the minimal extras are **empty** — critically, do
   **NOT** pass `thinking:{type:"disabled"}`. Optionally set `reasoning_effort` explicitly (`max` =
   z.ai-recommended for coding, most realistic, most token-hungry; `high` = cheaper, still on). The
   effort level and the final extras JSON are **sealed at pre-registration**, chosen by the §6
   calibration on the cost/realism tradeoff.
3. **`max_tokens` with reasoning headroom.** GLM (a reasoning model) rejected `max_tokens < 64` in
   the E2 harness. More important under thinking-on: `max_tokens` must be large enough to hold the
   reasoning **plus** the answer — the M7 parity value 16000 may truncate a reasoning turn. The §6
   calibration sets the value with headroom; the wiring test only asserts the configured value
   survives into the request body.

## 4. Reasoning-on validity checks (setup-time, not per-turn)

Replaces the old per-turn tripwire, which could not crash loudly inside the retry ladders (§10,
Conflict 3). Two checks, run at **smoke** and confirmed at **calibration**, over recorded
artifacts — never as a per-turn transport crash, so the retry ladders and the runner's
`provider_error` classification are never in the path:

- **(a) Reasoning is actually active.** At least one smoke/calibration response must carry
  non-empty `choices[0].message.reasoning_content` (or `reasoning_tokens > 0`). If reasoning is
  absent, the "realistic thinking-on" label is false and the run is invalid **for its stated
  configuration** — halt, do not proceed to evidence, trigger the §8 fallback review.
- **(b) Reasoning tokens are honestly counted.** The smoke determines whether
  `usage.completion_tokens` already includes the reasoning tokens (compare it against any
  `completion_tokens_details.reasoning_tokens` the body carries). If they are excluded, the §2
  E4-side adjustment is applied and re-verified **before** calibration, so the frozen budget
  numbers are honest.

Both checks are analysis over the manifest / smoke record (the reasoning body is in the exchange
artifact), classified `calibration`-grade at most, never evidence, never a task outcome.

## 5. Wiring smoke (live, requires authorization, ~cents)

A few single-turn calls through the flag-wired GLM route (§3), asserting: (i) endpoint reachable,
`usage` fields parse, text extraction works; (ii) **§4(a)** reasoning is active
(`reasoning_content` present); (iii) **§4(b)** the reasoning-token accounting — capture both
`completion_tokens` and any `completion_tokens_details.reasoning_tokens`, decide whether the former
includes the latter, and (if not) confirm the §2 E4-side adjustment before moving on; (iv)
`max_tokens` headroom is sufficient (no response truncated mid-reasoning). Any recorded artifact is
`calibration`-grade at most, never evidence. If §4(a) fails or the accounting cannot be made honest,
the §8 fallback triggers — do not iterate on undocumented parameters past this point.

## 6. Budget calibration (M6-style, live, requires authorization)

Binding precedent: v0 frozen budgets "transfer to v2-M7 only on deepseek-v4-pro" (commit `ffa29a7`)
— they do **not** transfer to GLM, and thinking-on changes the token economics further. GLM gets
its own calibration before any pre-registration is sealed:

- One full-length Arm-H sequence, 6 tasks, **seed 37** (the M6 calibration seed — never an evidence
  seed), `classification=calibration`, `e1:protect` PASS before and after, procedure per
  `docs/e4/E4V2-M6-BUDGET-CALIBRATION-NOTES.md` — but **run thinking-ON**, with §4(b) already
  settled so the token counts are honest.
- Expect materially higher token and dollar burn than the M7 thinking-off calibration (~$0.13):
  reasoning inflates output tokens and GLM output is $4.40/M. The M7 budget (27 turns / 12
  verifications / **490k tokens** / $5, `max_tokens` 16000) likely needs **headroom** — a larger
  token budget and/or larger `max_tokens`. Follow the M6 wall-hit → adjust-once → re-freeze
  procedure; verify per-task cost stays within the $5 cap (4× backstop $20) and **raise the cap
  headroom explicitly if a realistic thinking-on task cannot fit** (record the decision in the
  freeze commit, not a silent change).
- Freeze GLM's own budgets (its own constants-version bump / freeze event, recorded in the commit
  message like the deepseek pin). The M8 calibration is non-evidence, single-arm, single-seed,
  structurally excluded by the verdict tool — cited as calibration context only, never pooled.

## 7. Pre-registration skeleton (sealed only after §5–§6 succeed)

Mirror `e4-v2-m7-pilot-preregistration-v1.md` section-for-section; deltas only:

1. **Run identity:** model `glm-5.2` (z.ai direct paas/v4, §3), **thinking ON** with the sealed
   `reasoning_effort` and the §4 setup-time validity checks named as validity instruments,
   `max_tokens` and budgets per the §6 GLM calibration, temperature parity with M7,
   `run_classification: pilot`, claim ceiling Level 4, **configuration label: realistic /
   thinking-on** (M7's is austere / thinking-off).
2. **Seeds:** reuse **22 and 60** (recommended — task-chain generation is model- and
   thinking-independent, so reuse gives chain-identical tasks across the two lenses; gate review may
   overrule for independence; decide before sealing, record the reason either way).
3. **Analysis, decision rule, predicates (a)/(b)/(c), triggers, floor rules:** carried verbatim from
   M7 §2 against the constants hash current after §6.
4. **Metrics and the false-confidence reporting commitment (M7 §3–§4):** carried verbatim, including
   the vacuous-spec signature ordering and the commitment to report the go together with the
   headline caveat if the same branch obtains.
5. **Program discipline:** no model-shopping, no seed-shopping — once sealed, GLM 5.2 thinking-on on
   the sealed seeds is the run; the §8 fallback is dead from the moment of sealing; a no-go, an
   uninterpretable verdict, **or a divergence from M7** is reported at face value.
6. **Claim language:** M7 §7 carried verbatim (classification everywhere, preferred/avoided wording,
   replayable-evidence pointers, shared-environment framing), **plus** the two-lens framing (§1):
   the two pilots are stated as separate Level-4 claims, each tagged with its configuration, never
   pooled.

## 8. Fallback clause (pre-decided 2026-07-09, before any wiring)

Fall back to **Qwen 3.7 Max** (existing `alibaba-qwen` preset, model-id override; same §5→§6→§7
path) if, **before pre-registration sealing**, any of:

- the §5 smoke shows reasoning cannot be confirmed active (§4a fails), **or** the reasoning-token
  accounting cannot be made honest (§4b unresolved), or
- the §6 calibration cannot complete structurally (persistent malformed responses, provider
  instability at the M7-flagging threshold, or no budget/`max_tokens` fits a realistic task within
  a defensible cap), or
- z.ai publishes no usable OpenAI-compatible route for the model.

The fallback is a *substitution at the candidate stage*, recorded in this doc's changelog when
exercised. After a pre-registration is sealed on either model, no substitution exists.

## 9. Open questions for gate review (resolve before sealing)

1. `reasoning_effort` level — `max` (realistic, z.ai-recommended for coding, most token-hungry) vs
   `high` (cheaper, still on). Decided by the §6 calibration on the cost/realism tradeoff; sealed
   as-is.
2. `max_tokens` headroom value under thinking-on (§3.3) — set by calibration.
3. Reasoning-token accounting outcome (§4b) — folded into `completion_tokens` (no change) vs
   separate (E4-side adjustment). Decided empirically at the §5 smoke.
4. Seed reuse (§7.2) — recommendation: reuse 22/60.
5. *(Retired under Amendment A.)* The thinking-**disable** question is moot — GLM runs thinking-on.
   The z.ai-documented disable switch is recorded in §9a as context only; it is not used.

## 9a. Answers from z.ai public docs (M8 step-1 research, 2026-07-09 — web only, nothing live)

Resolutions to the endpoint/model/pricing questions, read directly off z.ai's developer docs.
Recorded facts, not authorizations.

1. **Endpoint.** z.ai's general OpenAI-compatible chat-completions endpoint is
   `https://api.z.ai/api/paas/v4/chat/completions` (base `https://api.z.ai/api/paas/v4/`; an
   `.../api/openai/v1` alias also exists). The **coding** endpoint is a separate base
   (`https://api.z.ai/api/coding/paas/v4`). **Wire the general `paas/v4` endpoint.**
   Source: docs.z.ai/guides/overview/quick-start.
2. **Model id.** `glm-5.2` (lowercase in the request `model` field; docs display "GLM-5.2").
   Source: docs.z.ai/guides/overview/quick-start.
3. **Pricing** (docs.z.ai/guides/overview/pricing) — USD per **million** tokens: input **$1.40**,
   cached input **$0.26**, output **$4.40**. (GLM-5.1 identical; GLM-5 is 1.0/0.2/3.2.) The E4
   `--pricing-*` flags are cap-guardrail overestimates and must be **≥** these.
   Source: docs.z.ai/guides/overview/pricing.
4. **Thinking control (context only — not used under Option B).** z.ai's capabilities doc documents
   `"thinking": {"type": "enabled"|"disabled"}` (top-level) as the hosted-API switch, and confirms
   the response carries **`reasoning_content`** when thinking is on (streaming:
   `delta.reasoning_content`) — the field §4(a) keys on. `reasoning_effort` is documented with
   values **`high`/`max`** (default `max`); there is **no `"none"`**. Top-level `enable_thinking` is
   a Qwen/vLLM (`chat_template_kwargs`) convention, not a hosted z.ai param. (This retires the
   original §2 "disable it via enable_thinking/reasoning_effort:none" plan — moot now that we run
   thinking-on.) Sources: docs.z.ai/guides/capabilities/thinking-mode,
   recipes.vllm.ai/zai-org/GLM-5.2, docs.z.ai/guides/overview/quick-start.

## 10. Wiring-time findings and their resolution (M8 step-1, 2026-07-09)

Three conflicts surfaced while tracing the original §2–§4 against the live code. Resolution under
Amendment A:

- **Conflict 1 — thinking-disable premise (§2) contradicted by z.ai docs.** The documented hosted
  switch *is* `thinking:{type:"disabled"}` and the alternatives the original plan picked
  (`enable_thinking:false`, `reasoning_effort:"none"`) are unsupported by the hosted API (§9a.4).
  **Resolved: MOOT** — Option B runs thinking-on; no disable switch is used.

- **Conflict 2 — §3.1 preset has no consumer on the E4 path.** `MODEL_LOOP_PRESETS`
  (`src/model-provider-presets.ts`) is imported **only** by the forbidden-legacy
  `bin/run-fake-pilot.ts`; the E4 v2 live path (`bin/e4-v2.ts --live`) reads
  `--model/--endpoint/--api-key-env/--extra-body` directly, exactly as M6/M7 deepseek ran (no
  preset was ever added). **Resolved: DROP the preset** (§3.1) — wire by flags.

- **Conflict 3 — the per-turn reasoning tripwire could not crash loudly.** A transport-wrapper
  throw is caught by **two** retry ladders (the E1 provider's internal `callE1ProviderWithRetries`
  in `e1-live-provider.ts` `nextTurn`, and the E4 v2 runner's outer one at `src/e4/v2/runner.ts:240`);
  `normalizeE1ProviderFailure` maps any thrown `Error` to `network_error`, which is **retried** (up
  to ~9 extra live calls, burning the very budget it protects), then surfaced as
  `E1ProviderExhaustedError`, which the runner records as a **`provider_error` task outcome**
  (`runner.ts:248`) — i.e. exactly "retried" and "narrated away," the two things the old §4 forbade.
  **Resolved: DISSOLVED by Option B** — with thinking intended on there is nothing to trip on; the
  old §4 is replaced by the setup-time validity checks (new §4), which run over recorded artifacts
  at smoke/calibration and never enter the retry-ladder path. No runner surgery.
