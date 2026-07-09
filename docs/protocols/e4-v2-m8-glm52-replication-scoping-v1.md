# E4 v2-M8 — second-model replication (GLM 5.2) — scoping (v1)

**Status: SCOPING ONLY. This document authorizes nothing.** No live calls, no spend, no
pre-registration is sealed by this doc. Every live step below (wiring smoke, budget calibration,
evidence run) requires separate explicit operator authorization. Milestone label `v2-M8` is
provisional pending operator confirmation.

## 1. Purpose

Replicate the v2-M7 pilot (`docs/protocols/e4-v2-m7-pilot-run-report-v1.md`, verdict `go`,
commit `de9a679`) on a second frontier model. Primary candidate: **GLM 5.2** (z.ai), chosen by
the operator 2026-07-09 for audience recognition; pre-decided fallback: **Qwen 3.7 Max**
(§8 — the fallback trigger is decided *now*, before any wiring, so a later switch is not
model-shopping).

Claim consequence (binding): a clean go here is a **second, separate Level-4 single-model
pilot claim** under its own task/model/budget. Metrics are never pooled across models
(separate compatibility boundaries). "Two frontier models, same pattern" is publishable only
as two Level-4 claims stated side by side, or as an explicitly-preliminary general statement
per AGENTS.md ("Claims about general effectiveness require multiple compatible clean pilots or
must be explicitly labeled preliminary"). Level 5 remains disallowed.

## 2. Known provider trap (the reason this doc exists)

The v2-M7 arms ran with extended thinking disabled (`deepseek-v4-pro`, `thinking:
{type: "disabled"}`, `max_tokens` 16000). GLM 5.2 is a reasoning model whose thinking is ON by
default, and z.ai's API has a **documented-parameter-not-honored bug**: the documented
`thinking: {type: "disabled"}` is silently ignored on at least the coding endpoint
(GLM-4.7/GLM-5 confirmed, reported 2026-02-27,
github.com/earendil-works/pi/discussions/1676); the switch that reportedly works is
`enable_thinking: false` (Qwen/vLLM convention), and GLM 5.2 additionally supports
`reasoning_effort: "none"` per its OpenAI-compatible surface.

Why this matters here: `extractOpenAICompatibleText` (`src/e1-live-provider.ts`) reads only
`message.content` — any `reasoning_content` the provider emits is **silently dropped from the
transcript while its tokens still count in `usage.completion_tokens`**, i.e. it would burn the
sealed token budget (490k/task) and the spend ledger invisibly, breaking budget parity with the
M7 run and contaminating the taxes secondary. This failure mode must crash, not degrade.

## 3. Endpoint wiring plan (code, no spend)

1. **New preset** in `src/model-provider-presets.ts` (`MODEL_LOOP_PRESET_IDS` + entry), shape:
   `provider: "zai-glm"`, `model: "glm-5.2"` (exact id to be confirmed against z.ai docs at
   wiring time), `endpoint`: z.ai OpenAI-compatible chat-completions URL (general paas v4 vs
   coding endpoint — open question §9; E2 precedent used `api.z.ai` via `E2_GLM_BASE_URL`),
   `api_key_env: "ZHIPU_API_KEY"` (E2 precedent), `provider_route: "zai-glm-direct-chat-completions"`.
2. **Thinking-off request extras** go through the existing `--extra-body` channel
   (`bin/e4-v2.ts` → `E4LiveProviderConfig.extra_body` → `withExtraBody` transport wrapper in
   `src/e4/live-provider.ts`). Planned extras (final JSON sealed in the pre-registration):
   `{"enable_thinking": false, "reasoning_effort": "none"}` — belt and suspenders; the
   documented-but-ignored `thinking` object is NOT relied on. This is the exact pattern the
   `bin/e4.ts` comment already anticipates for DashScope.
3. **E2 quirk carried over:** GLM as a reasoning model rejected `max_tokens < 64` in the E2
   harness. M7 parity value is `max_tokens` 16000, so this cannot bite, but the wiring test
   asserts the configured value survives to the request body.

## 4. Reasoning tripwire (spec)

A second transport wrapper in `src/e4/live-provider.ts`, composed after `withExtraBody`,
precedent-identical style:

- `withReasoningTripwire(transport)`: inspect every response body; if
  `choices[0].message.reasoning_content` is present and non-empty (string or array), **throw
  `E4LiveProviderError`** naming the tripwire — the run crashes loudly. Never classified as a
  task outcome, never retried past the sealed retry ladder, never narrated away.
- Rationale recorded in-code: reasoning tokens are invisible in the transcript but billed and
  budget-counted (§2); a fired tripwire means thinking-disable is not actually in effect and
  the run is not budget-comparable to M7.
- Applied for every E4 v2 live run regardless of model (it is vacuous on providers that never
  emit `reasoning_content`).
- Tests (no spend, canned transport per the existing test seam): (a) response carrying
  `reasoning_content` → throws; (b) response without it → passes through unchanged; (c) extras
  from §3.2 present in outgoing request body.

## 5. Wiring smoke (live, requires authorization, ~cents)

Minimal live check before any calibration: a few single-turn calls through the new preset with
the §3.2 extras, asserting (i) tripwire does not fire, (ii) `usage` fields parse, (iii) text
extraction works. If the tripwire fires **with the working switch set**, the fallback clause
(§8) triggers immediately — do not iterate on undocumented parameters past this point.
Classification of any recorded artifact: `calibration`-grade at most; never evidence.

## 6. Budget calibration (M6-style, live, requires authorization)

Binding precedent: the v0 frozen budgets (27 turns / 12 verifications / 490k tokens / $5 per
task) "transfer to v2-M7 only on deepseek-v4-pro" (commit `ffa29a7`). GLM gets its own
calibration before any pre-registration is sealed:

- One full-length Arm-H sequence, 6 tasks, **seed 37** (the M6 calibration seed — never an
  evidence seed), `classification=calibration`, spend cap $5, `e1:protect` PASS before and
  after, procedure per `docs/e4/E4V2-M6-BUDGET-CALIBRATION-NOTES.md`.
- Freeze branch identical to M6 Part B: if no wall is hit, budgets transfer to GLM 5.2
  unchanged (recorded in the commit message, not a JSON field — same as the deepseek pin) and
  the constants version bump marks the event; if a wall is hit, adjust per the M6 notes and
  re-freeze **before** sealing the pre-registration.
- The M8 calibration is non-evidence, single-arm, single-seed, structurally excluded by the
  verdict tool — cited in any M8 report as calibration context only, never pooled (M7 §3.1
  precedent).

## 7. Pre-registration skeleton (sealed only after §5–§6 succeed)

Mirror `e4-v2-m7-pilot-preregistration-v1.md` section-for-section; deltas only:

1. **Run identity:** model `glm-5.2` (z.ai direct, route per §3), thinking disabled via the
   §3.2 extras **with the §4 tripwire named as a validity instrument**, `max_tokens` 16000,
   temperature parity with M7, `run_classification: pilot`, claim ceiling Level 4.
2. **Seeds:** reuse **22 and 60** (recommended — task-chain generation is model-independent,
   so reuse gives chain-identical cross-model comparison; gate review may overrule for
   independence; decide before sealing, record the reason either way).
3. **Analysis, decision rule, predicates (a)/(b)/(c), triggers, floor rules:** carried
   verbatim from M7 §2 against the constants hash current after §6.
4. **Metrics and the false-confidence reporting commitment (M7 §3–§4):** carried verbatim,
   including the vacuous-spec signature ordering and the commitment to report the go together
   with the headline caveat if the same branch obtains.
5. **Program discipline:** no model-shopping and no seed-shopping — once sealed, GLM 5.2 on
   the sealed seeds is the run; the §8 fallback is dead from the moment of sealing; a no-go or
   an uninterpretable verdict is reported at face value.
6. **Claim language:** M7 §7 carried verbatim (classification stated everywhere, preferred/
   avoided wording, replayable-evidence pointers, shared-environment framing).

## 8. Fallback clause (pre-decided 2026-07-09, before any wiring)

Fall back to **Qwen 3.7 Max** (existing `alibaba-qwen` preset, model-id override; same §5→§6→§7
path) if, **before pre-registration sealing**, any of:

- the §5 smoke shows thinking cannot be verifiably disabled (tripwire fires with the working
  switch set), or
- the §6 calibration cannot complete structurally (persistent malformed responses, provider
  instability at the M7-flagging threshold), or
- z.ai publishes no usable OpenAI-compatible route for the model.

The fallback is a *substitution at the candidate stage*, recorded in this doc's changelog when
exercised. After a pre-registration is sealed on either model, no substitution exists.

## 9. Open questions for gate review (resolve before wiring)

1. z.ai endpoint: general paas v4 vs coding endpoint (the not-honored bug report is against
   the coding endpoint; pick whichever honors `enable_thinking` — the §5 smoke decides
   empirically).
2. Exact public model id string for GLM 5.2 on the chosen endpoint.
3. Pricing (USD per million input/cached/output tokens) for the spend ledger and the 4×
   backstop.
4. Seed reuse (§7.2) — recommendation: reuse 22/60.
5. Whether `reasoning_effort: "none"` alone suffices (drop `enable_thinking` if the smoke
   proves it redundant) — final extras JSON is whatever the smoke verified, sealed as-is.

## 9a. Answers from z.ai public docs (M8 step 1 research, 2026-07-09 — web only, nothing live)

Resolutions to §9.1–§9.3 read directly off z.ai's developer docs. These are recorded facts, not
authorizations; the §5 smoke remains the empirical decider for anything about thinking-disable.

1. **Endpoint (Q1).** z.ai's general OpenAI-compatible chat-completions endpoint is
   `https://api.z.ai/api/paas/v4/chat/completions` (base `https://api.z.ai/api/paas/v4/`; an
   `.../api/openai/v1` alias also exists). The **coding** endpoint is a *separate* base
   (`https://api.z.ai/api/coding/paas/v4`) — and it is the coding endpoint that the §2 not-honored
   report targets. **Recommendation: wire the general `paas/v4` endpoint, not the coding one.**
   Source: docs.z.ai/guides/overview/quick-start.
2. **Model id (Q2).** `glm-5.2` (lowercase in the request `model` field; docs display "GLM-5.2").
   Source: docs.z.ai/guides/overview/quick-start.
3. **Pricing (Q3), official docs.z.ai/guides/overview/pricing** — USD per **million** tokens:
   input **$1.40**, cached input **$0.26**, output **$4.40**. (GLM-5.1 is priced identically;
   GLM-5 is 1.0/0.2/3.2.) The E4 `--pricing-*` flags are cap-guardrail **overestimates**, so the
   run must pass values **at or above** 1.40/0.26/4.40 (the M7 deepseek values 0.5/0.05/2.0 would
   under-estimate GLM and must not be reused). Source: docs.z.ai/guides/overview/pricing.
4. **Seed reuse (Q4).** Unchanged recommendation: reuse 22/60 (decided at seal per §7.2).
5. **Thinking-disable (Q5) — the research CONTRADICTS the §2 premise; flagged for gate review.**
   z.ai's own capabilities doc (docs.z.ai/guides/capabilities/thinking-mode) presents
   **`"thinking": {"type": "disabled"}`** (top-level) as *the* documented disable switch for the
   hosted GLM API, and confirms the response carries **`reasoning_content`** when thinking is on
   (streaming: `delta.reasoning_content`) — which is exactly the field the §4 tripwire keys on.
   Meanwhile: (a) **`reasoning_effort`** is documented only with values **`high`/`max`** (default
   `max`) — **no `"none"`**; (b) top-level **`enable_thinking`** is a **Qwen/vLLM** convention, and
   z.ai's own vLLM recipe nests it as **`chat_template_kwargs.enable_thinking: false`** for
   *self-hosted* serving, not as a top-level hosted-API param; (c) the "documented-but-ignored"
   claim in §2 traces to a single third-party report against the **coding** endpoint on
   **GLM-4.7/GLM-5**, not GLM-5.2 on `paas/v4`. **Consequence:** the §3.2 planned extras
   `{"enable_thinking": false, "reasoning_effort": "none"}` are **not supported by z.ai's
   hosted-API docs** as written. Recommended smoke order (§5, still separately authorized): try
   **`{"thinking": {"type": "disabled"}}`** on `paas/v4` FIRST, with the §4 tripwire as the
   validity gate; only if it leaks do the vLLM-style / effort alternatives come into play. §2/§3.2
   should be adjudicated before wiring. Sources: docs.z.ai/guides/capabilities/thinking-mode,
   recipes.vllm.ai/zai-org/GLM-5.2, docs.z.ai/guides/overview/quick-start.

## 10. Wiring-time findings that need adjudication before code (M8 step 1, 2026-07-09)

Two additional conflicts surfaced while tracing §3–§4 against the live code. Recorded here, not
resolved — both change what the wiring commit should do, so they go to the operator/gate first.

- **§3.1 preset location has no consumer on the E4 path.** `MODEL_LOOP_PRESETS`
  (`src/model-provider-presets.ts`) is imported **only** by `bin/run-fake-pilot.ts` — a
  **forbidden legacy-stack** module for E4. The E4 v2 live run path (`bin/e4-v2.ts --live`) does
  **not** read presets: it takes `--model` / `--endpoint` / `--api-key-env` / `--extra-body`
  directly and hard-codes the label `preset: "direct-openai-compatible"`. This is exactly how the
  M6/M7 deepseek runs were wired — **no preset entry was ever added**. So adding a `zai-glm` entry
  to `MODEL_LOOP_PRESETS` (i) wires nothing into the GLM run, (ii) perturbs the legacy CLI's
  selectable-preset set + its test, and (iii) leaves §5's "run **through** the new preset" with no
  consumption path. **Recommendation: drop §3.1; wire GLM exactly as deepseek was — CLI flags with
  the §9a values** (`--model glm-5.2 --endpoint https://api.z.ai/api/paas/v4/chat/completions
  --api-key-env ZHIPU_API_KEY --pricing-in 1.4 --pricing-cached 0.26 --pricing-out 4.4
  --extra-body '<smoke-verified JSON>'`), or, if a canonical preset record is wanted, decide
  whether `bin/e4-v2.ts` should learn to resolve it (scope beyond this session's §3).

- **§4 tripwire mechanism cannot deliver its own guarantee.** §4 specifies a **transport wrapper**
  in `src/e4/live-provider.ts` that throws `E4LiveProviderError` so the run "**crashes loudly …
  never retried … never classified as a task outcome**." But a transport-wrapper throw is caught
  by **two** retry ladders — the E1 provider's internal `callE1ProviderWithRetries`
  (`e1-live-provider.ts` `nextTurn`) **and** the E4 v2 runner's outer
  `callE1ProviderWithRetries` (`src/e4/v2/runner.ts:240`). Neither ladder has a non-retryable
  error class: `normalizeE1ProviderFailure` maps any thrown `Error` to `network_error`, which is
  **retried** (up to 3× each ladder → up to ~9 extra live calls, burning the budget the tripwire
  exists to protect), then surfaced as `E1ProviderExhaustedError`, which the runner catches and
  records as a **`provider_error` task outcome** (`runner.ts:248-250`) — i.e. exactly "retried"
  and "narrated away as a task outcome." **To deliver the §4 guarantee the check must fire
  post-ladder and propagate**, e.g. inspect the successful turn's `reasoning_content` in the runner
  right after `turnResult` is obtained (outside its try/catch, so the throw crashes the run), which
  needs (a) the reasoning-leak signal plumbed from the provider up through `E4ProviderTurnResult`
  and (b) an edit to `src/e4/v2/runner.ts`. Both **deviate from §4's "transport wrapper in
  live-provider.ts, no runner change" letter**, and the E1 retry ladder itself is E1-sealed
  (importable but not modifiable). This is a §4 mechanism amendment — operator/gate decision before
  any tripwire code lands.
