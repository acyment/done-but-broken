# Backlog

## Project Direction

- Goal: credible, reproducible, hard-to-fake engineering evidence for industry-facing writing, demos, and run artifacts.
- This is not peer-reviewed-publication-first. Keep the evidence hygiene; change the presentation and backlog priorities.
- Continue the explicit two-arm protocol with exactly `context_only_spec` and `feedback_capable_spec`.
- Keep the causal variable narrow: same visible semantic spec content with executable feedback off versus the same visible semantic spec content with executable feedback on.
- Keep the bounded loop budget at 2/1 for causal feedback-use runs unless a later analysis plan precommits a different equal-turn budget.
- Treat one-turn runs as difficulty probes only unless feedback can actually influence a later model turn.
- Avoid adding arms, legacy condition IDs, ordinary-test comparisons, spec-format comparisons between arms, permission-checkpoint extensions, formal statistical replication, many-model matrices, or a general benchmark platform.
- The shared-environment OpenSpec workflow under protocol profile `e1-openspec-workflow-v0` is in scope: both arms work inside the same OpenSpec-initialized workspace and the harness runs the pinned `openspec` archive step identically in both arms; the causal variable remains executable-feedback availability. It is its own non-pooled compatibility boundary. (Guardrail revision 2026-06-10, made before any OpenSpec-profile run existed.)
- Historical pre-2026-07-04 direction: the active program was the E1 frontier path. The current immediate direction is superseded by the dated update below.
- `path-survival-primary-v1` remains the metric profile rule: path survival / `regression_free_auc` is primary only for runs that explicitly declare that protocol profile. Existing clean pilots remain historical final-pass-primary evidence with retrospective AUC observations. The Stage 1 subscription/inventory validation matrix is superseded before execution (see `docs/protocols/path-survival-primary-v1-validation-matrix-supersession-v1.md`).

## Direction Update - 2026-07-04

- The immediate next research move is the **E3 sequential brownfield regression** program, not another single-issue acceptance-gap read and not the authored-spec causal arm.
- Design draft: `docs/protocols/e3-brownfield-regression-after-several-changes-design-v1.md` (DESIGN DRAFT, not authorized, not run, not sealed).
- Rationale: E2 already produced a bounded two-lineage positive on single-task false-confidence reduction, while the authored-spec calibration exposed oracle-authoring fidelity as the blocker before a causal run. The sharper operational question is now whether agents break previously accepted behavior after several changes in the same real repo.
- Primary object: a carried-forward repo episode with 4-8 ordered real changes and cumulative hidden acceptance bundles. Measure true pass-to-fail regressions separately from unresolved carryforward.
- First gate: offline episode/scorer validation plus control-only calibration. Do not launch treatment rollouts until true regressions appear at a predeclared minimum rate.
- This is a new compatibility boundary. Do not pool it with E1, E2, authored-spec Stage 0, pricing, subscription, or inventory results.

## Direction Update - 2026-07-05

- **E3 calibration gate ran honestly to a null.** Control-only calibration on the 3 certified episodes (frontier route `openai/deepseek-v4-pro`, after fixing an earlier wrong-model run that used `deepseek-chat`): 0 true regressions in every rollout. A gold-prior-steps probe (gold step-1 patch applied, agent runs step 2) confirmed the scoring pipeline is correct — step-1 oracles stay green and label as `retained` — and that the certified episodes are structurally regression-resistant: the same non-overlapping-files property that made them certifiable makes them unable to couple. E3 treatment rollouts remain blocked by the predeclared gate; reselecting overlap-prone episodes is the only E3 path forward. Runs: `hit-sdd-bench-e2/runs/e3-calibration/` (incl. `e3-gold-probe-20260705-140802.json`).
- **Claim B pulled forward; zero-compute mining audited the existing data.** Verdict: the causal-pilot `self_verification_gap` fields measure *false confidence* (done-claim vs oracle; `self_verification_passed` is set equal to `declared_done` in every agent, and pilot controls had no shell) — they do NOT measure tautological self-tests. Genuine shell-capable specimens: 12 stage0-cal rollouts, 1 candidate event. Do not conflate the two in any doc or public statement.
- New design doc: `docs/protocols/e2-claim-b-tautology-control-calibration-design-v1.md` (DESIGN ONLY, not authorized). Staged: B0 retro-instrumentation of the 12 stored rollouts (free), B1 single-task calibration gate on freezegun-582, B2 pool expansion only if B1's gate fires. Requires the measured self-test-verdict instrumentation (I1) before any run; predictions must be committed before B1 launch.
- **E3 redesign v2 drafted (later on 2026-07-05, DESIGN ONLY — not authorized, not run, not sealed):** `docs/protocols/e3-regression-redesign-v2.md`. New compatibility boundary `e3-v2`. Episode source moves from same-base-commit stacking (pool exhausted at 2 pairs) to CHAINED consecutive merged changes (each gold applies to the prior state) with chained certification gates incl. an env-stable window check. Causal contrast redecided: the P2P suite is public, so the honest primary contrast is ENFORCEMENT (harness refuses unearned done-claims on the public cumulative surface), with hidden-F2P information contrast demoted to a secondary predeclared question; B1's red-backed done-claims are the direct frontier evidence the enforcement variable is live. k=4–8, bounded per-change budgets, ≤R refusals; blame attribution separates sequence-driven breakage from sloppy single changes. Staged R0 (smoke on 2 certified overlap episodes) → R1 (chain build, no spend) → R2 (re-armed control-only Gate 6, frontier only) → R3 (sealed enforcement pilot, only if Gate 6 fires); explicit kill condition if frontier chains still produce ~0 regressions. Prediction template must be filled before any run.
- **E3 v2 R0+R1-scout EXECUTED (2026-07-05, frontier V4 Pro; scan/wiring no-spend, R0 smoke authorized ~$1–2):** Full results in `docs/protocols/e3-regression-redesign-v2.md` §12–13. (1) **Chain scan = strong GO**: chaining opens the pool from 2 same-base pairs to **114 candidate chains (98 file-coupled)** across 143 repos (`scripts/find_chain_episodes.py`, `runs/e3-chains/chain-scan-v1.json`). (2) **R0 enforcement done-gate wired + tested** (`e3/agent.py` gate, `--arm treatment`; 14/14 e3 tests pass). (3) **R0 smoke** (certified pvlib episode, treatment, n=1, capped surface — non-evidence): pipeline works end-to-end; **first observed E3 true P2P regression** (agent broke 1 sentinel in test_clearsky.py); surfaced a gate/scorer parity caveat for the pilot (gate must run the FULL surface and evaluate sentinels identically to the scorer). (4) **Certifier F2P-robustness fix merged** (`e3/certify.py`: file-granularity + function-level id reconciliation — stale parametrized node-ids no longer abort/zero F2P). (5) **Chain-stacking finding**: pvlib k=4 chain certifies step 1 but step-2 gold conflicts; ancestry check confirms SWE-bench Live golds are authored against independent bases, so one-base stacking conflicts. **Design update**: rung-4 real merged-PR chains are REQUIRED (not optional); rungs 1–3 only yield the rare linear-base chains. Next R1 step recommended: build the rung-4 merged-PR chain constructor. STILL DESIGN/BUILD PHASE — no evidence claims; R2 calibration remains gated + unauthorized.
- **E3 v2 rung-4 constructor built + FIRST CHAINED EPISODE CERTIFIED (2026-07-06, Docker, no spend):** Followed through on the rung-4 recommendation. New scripts `build_merged_pr_chain.py` (extracts gold/test patches + computes F2P from real first-parent history in the pinned image; golds = consecutive range diffs ⇒ stack by construction) + `certify_chain_episode.py` (inline-patch episodes into the shared gate machine). **`pvlib-rung4-k3-v1` certifies all gates green** — 3 consecutive pvlib feature merges (#2053→#2048→#2088), every step patch+f2p+cumulative OK, 10 F2P total, zero gold conflicts/regressions. First certified chain with genuine sequential structure; proves rung-4 sound where SWE-bench independent-base stacking failed. Details in redesign-v2 §13. Remaining before R2 can run on rung-4 episodes (design/build, no spend): (i) `run_e3_calibration.py` must accept inline-patch episodes; (ii) compute P2P sentinel surface at base (no curated PASS_TO_PASS for rung-4); (iii) extend to k=4–8 (pvlib history has a long consecutive feature run). R2 calibration still gated + unauthorized.
- **E3 v2 R2 STAGING COMPLETE (2026-07-06, Docker + code, no spend):** All three open items closed. (i) Inline-episode support in `run_e3_calibration.py` (`_is_inline_episode`/`_inline_step_data`/`_dataset_step_data`) + explicit `image` threaded through `e3/runner.py` + `e3/agent.py` (`_episode_image`); backward-compatible, 14/14 e3 tests pass, inline loading validated no-spend. (ii) `scripts/compute_e3_sentinels.py` computes P2P surface at base (run suite, keep PASSED, exclude F2P, write `sentinel_p2p`). (iii) k=6 chain built + certified. **Two certified R2-ready rung-4 episodes**: `pvlib-rung4-k3-v1` (k3, 10 F2P, 1215 sentinels) and `pvlib-rung4-k6-v1` (k6, 25 F2P, 1193 sentinels; step 3 #2094 null-oracle, certifies vacuously). Details in redesign-v2 §13. **Everything for R2 control-only calibration is wired + tested; only the predeclared prediction commit (§8) + explicit spend authorization remain.** **Predictions COMMITTED 2026-07-06 (redesign-v2 §8.1, before any run):** control-only, V4 Pro, both certified rung-4 episodes, N=5/episode, 40-iter budget; predicted P(≥1 P2P regression) ≈ 0.40 (k3) / 0.60 (k6), burden median ~3 tests, prior-F2P-regression ≈ 0.05, success-stratum fraction ≈ 0.40; **predicts Gate 6 FIRES, kill condition NOT hit**; adopted Gate-6 threshold ≥1 regression in ≥30% of control episodes and R=2 for the later pilot. R2 run itself remains gated on explicit operator spend authorization.
- **E3 v2 R2 PIPELINE PROBE (2026-07-06, authorized cheap probe, control-only, NON-EVIDENCE):** V4 Pro, `pvlib-rung4-k3-v1` only, N=2, 40-iter budget — NOT the committed Gate-6 calibration (needs ≥2 episodes N≥5). **Pipeline validated end-to-end**: inline episode + explicit image + sentinels 1215/1215 live at base + cumulative scoring/regression state machine all clean. **First sequence-driven true regression on a real chain**: rollout 0 agent solved step 1 (#2053 transformer), stalled step 2, then step-3 (#2088 JRC) work BROKE step-1's transformer F2P (`true_regression` bundle1→step3) while falsely declaring done on step 3 (its own F2P all failed — B1 phenomenon). 1 true regression / 2 rollouts (stochastic). **Prediction §8.1 INVERTED (honest)**: predicted P2P fires (~0.40), F2P near-zero (~0.05); reality = P2P 0/1215 broke (broad suite robust, E1 prior holds), regression fired on the curated F2P oracle (frontier solved step 1 ⇒ its F2P became a live tripwire). Update: F2P bundles, not P2P, are the sensitive detector on these episodes; the committed N=5 calibration should report both separately, expect F2P to dominate. Artifacts: `runs/e3-calibration/e3-calibration-control-20260706-134545.json`.
- **E3 v2 POOL WIDENED to a second repo (2026-07-06, Docker, no spend):** On the "widen first" decision, built + certified a rung-4 chain from `koxudaxi/datamodel-code-generator` (`dmcg-rung4-k5-v1`, k=5, 25 F2P, 653 sentinels; steps 2+4 are regression-fix PRs). Certified all 5 steps FIRST TRY — rung-4 constructor generalizes beyond pvlib with no per-repo special-casing. **Calibration pool is now 2 repos / 3 certified R2-ready episodes**: `pvlib-rung4-k3-v1` (1215 sentinels), `pvlib-rung4-k6-v1` (1193), `dmcg-rung4-k5-v1` (653). A committed N=5 calibration on {pvlib, datamodel} is no longer single-repo. R2 calibration still gated on explicit spend authorization.
- **E3 v2 GOLD-LEAK found + fixed (2026-07-06, CRITICAL):** First full-calibration launch (authorized) was stopped after ~1 rollout; its log showed the agent running `git show 3f2daab` (the exact step-3 gold commit) and `git log --all`. Cause: rung-4 reuses a LATE pinned image (HEAD after all milestones) with an EARLIER base, so the future milestone commits (=gold implementations) sit in the workspace object DB; `git reset` to base doesn't remove them. **Fixed** in `e3/agent.create_workspace_container` (gold-leak guard: isolate workspace to base+ancestors — lone branch at base, delete all other refs/remotes/pseudo-refs, expire reflog, `git gc --prune=now`); verified in-image that `git show <milestone>` is pruned while base stays reachable (diff capture unaffected). Specific to rung-4 late-image construction; per-instance-image e1/e2 pilots unaffected. **Consequence: the §13.1 probe is RETIRED as a measurement** (agent had gold access; regression not honest) — pipeline-wiring validation still stands. Also added per-rollout checkpointing to `run_e3_calibration.py` (writes partial summary after each rollout; `status: in_progress|complete`) so an interruption never loses everything. Full N=5 calibration RE-LAUNCHED under the fix. Redesign-v2 §13.2. Hardening note for R2: scorer still runs F2P by node-id (safe for rung-4 exact-from-pytest ids); port certifier `_status_for` reconcile to `runner._score_in_docker` if a future episode hits MISSING F2P.
- **B0+B1 EXECUTED later on 2026-07-05** (operator-authorized; classification mechanism_probe; predictions committed pre-launch; results in the design doc). Gate B1 did NOT fire: **0 measured tautology events in 72 rollouts** (12 B0 retro + 60 B1 across flash/V4 Pro/qwen on freezegun-582). Inverse finding: agent self-tests were near-perfectly calibrated (no agent-written test ever wrongly passed failing code); the live failure mode is the done-claim policy — flash 0/10 done-claims correct with 5 made over a red self-test verdict; V4 Pro's 3 wrong done-claims all red-backed; qwen 10/10 correct and withheld done on 6/7 red verdicts. Claim B's tautology frame is closed-null on this task class; any follow-up must re-scope to done-claim calibration under a new predeclared design. Artifacts: `hit-sdd-bench-e2/runs/claim-b/`.

## Direction Update - 2026-07-08 (E4)

- **E4 Phase-2 plan (R1) external gate reviews adjudicated.** Five independent reviews of `docs/e4/IMPLEMENTATION-PLAN.md` R1 were evaluated against the plan text; verified findings were converted into a self-contained fix backlog: **`docs/e4/R2-BACKLOG.md`** (10 items — 4 blocking: drift-incidence onset/episode semantics, H5 attempted-task denominators, removal of the hidden-oracle affirmation condition (iii), M6.5 rescope to a full-length Arm-H calibration; plus should-fix and mechanical pins). Rejected review claims and the reasons are recorded in that file's "Adjudicated out" section — do not re-litigate them. All items are documentation-only edits pre-Phase-3; no code, no spend, no runs.
- **All ten R2-BACKLOG.md items applied; Phase-2 gate approved by the operator.** Phase 3 begins.
- **M0 shipped (Foundations: constants lineage, schema types, arm-policy skeleton, result-schema stub).** `src/e4/{types,constants,arm-policy,manifest,result-schema}.ts` under the E4 wrapper lineage (ADR-007) — imports nothing outside `src/e4/` and the allowlist; `test/e4-no-legacy-imports.test.ts` is now non-vacuous (real E4 modules exist) and green. Delivered: `e4-sealed-constants` v0 draft (`docs/protocols/e4-sealed-constants-v0.json`) + validator/hasher (draft-tolerant — sections owned by a later milestone are `null`; §3.2 floor-effect and §5.1/R2-7 interpretability values are pinned now, since both were ratified at this gate); `E4RunManifest`/`E4TaskRecord` types + validator (all architecture §2.5 fields, plus `[R2: R2-5]`'s `classification_rationale` required iff `termination === "executor_error"`); the three `E4ArmPolicy` objects + `validateE4RuntimeArmParity` (identical task text/budgets/retry policy required; a delta in standing_instruction (M) or gate+oracle channel (H) is the only allowed variance); a `result-schema.ts` stub implementing (not just typing) the `[R2: R2-1]` episode-onset drift-velocity algorithm — tested against all four identity-semantics fixture rows the real M2 known-drift fixture will carry (missed rename, delete-then-re-add, fix-then-regress, cross-cutting convention aggregation). New baseline: **442/442 tests, 54 files** (up from 383/50); `bun run e1:protect` triad green (hash/full-suite/canned-smoke). H2–H5 and the full multi-arm result-schema orchestration are deliberately not stubbed — their inputs (meter, oracle, usage) don't exist until M2/M3/M5.
- **M1 shipped (Substrate v1 generator).** `src/e4/substrate/{ir,prng,ops,draw,render,testgen,scaffold,provider}.ts`: a typed schema IR with stable `semantic_item_uid`s ([R2: R2-1]); a mulberry32 PRNG (no `Math.random`); a 13-op change-op action space (entity/field/endpoint/validation-rule/convention add-rename-retype-delete, plus `noop_maintenance`) with referential-integrity cascades (entity rename now correctly updates `state.addedEntityNames` — caught a real desync bug via a 200-seed sweep before landing); a seeded draw guaranteeing ≥1 behavior-preserving task; a business-natural NL renderer tagged per-variant for R2-10's NL-opacity proxy; programmatic (no-LLM) HTTP test generation with client-supplied create IDs so every test is a pure function of the IR (no response-capture/chaining); and T0 scaffold codegen — a genuinely runnable bun app (generic IR-independent server + Map-based in-memory store, driven by generated `registry.ts`/`schema.ts`/`seed.ts`) plus `specs/openapi.json` + `specs/CONVENTIONS.md` + README (Gate-1 grammar-verbatim pin). **Boot-tested for real** (not just unit-tested): generated the scaffold to disk, booted it with `bun run server.ts`, and hit it with live `curl` CRUD/list/filter/analytics/validation requests — caught and fixed a route-specificity bug (`GET /widgets/{id}` was shadowing `GET /widgets/stats`) that no unit test would have surfaced. Also caught and fixed a `list`/`filter` route-collision design flaw (two endpoints on the same method+path) before it ever reached the scaffold. Feature 1 acceptance (byte-identical same-seed incl. **separate OS processes**, different-seeds-differ, opportunity labels + ≥1 behavior_preserving over a 40-seed sweep, T0 self-check non-vacuous against tampering) plus rename-lineage-map determinism all green in `test/e4-substrate.test.ts`. Constants sealed at M1 → v0.1: `op_mix` (weights + the `min_behavior_preserving_tasks` structural guarantee), `phrasing_pools.pool_ids`, `compatibility_boundary.substrate_version`/`substrate_config_id` — with tests cross-checking the sealed JSON against the actual running code so they can't silently drift apart. New baseline: **466/466 tests, 55 files**; `bun run e1:protect` triad green throughout.
- **M2 shipped (Drift meter v1 + known-drift fixture — the pilot go/no-go instrument).** `src/e4/meter/{types,extract,classify,meter}.ts`: three-way inventory extraction (agent spec artifacts, ADR-001 registry dump via a fresh-temp-file dynamic import, harness-private ground truth), classified into contradiction/coverage_gap/stale_claim × spec_vs_truth/code_vs_truth × kind; `[R2: R2-1]` rename-lineage reconciliation gives a missed rename's stale-claim + coverage-gap pair one shared `semantic_item_uid` (a genuine delete gets a stable synthetic `spec-only:`/`code-only:` pseudo-uid instead, structurally distinct from any real minted uid); Gate-1 change 1's registry-bypass rule redirects an executor-passing, registry-absent endpoint to the conventions channel. **Found and fixed three real design bugs by actually running the meter against the M1 scaffold**, not just unit tests: (1) Bun's dynamic `import()` caches by file path and ignores query-string busting (unlike Node) — re-extracting the same workspace after an edit silently returned stale data; fixed by importing a fresh temp-file copy each time. (2) Endpoint identity was briefly path-only, which collapses GET/PUT/DELETE on the same path (`/categories/{id}`) into one inventory item; fixed to `(entity, kind)` identity with `{method, path}` as comparable detail — this is also what makes a method change (PUT→PATCH) a clean single contradiction rather than a fake rename, satisfying architecture's named "endpoint contradiction (method mismatch)" fixture cell. Required a matching OpenAPI vendor-extension (`x-e4-entity`/`x-e4-kind`) since operationId/tags aren't a safe machine-parse target. (3) A redundant `required`-kind validation_rule modeling (duplicating field-level `required`) was unrepresentable in OpenAPI without one copy silently drifting from the other — dropped in favor of field-level `required` as the single source of truth (`testgen.ts`'s negative-validation tests now key off field UIDs, not rule UIDs). Hand-built `test/fixtures/e4/known-drift/` (10 planted discrepancies covering every kind×class×direction cell, registry-bypass, missed-rename, delete-then-re-add) + its clean twin, with `expected-discrepancies.json` hand-derived independently of the meter's own output — the actual "zero false negatives/positives" test. All five Feature 2 Gherkin scenarios green, plus a full extract→classify→result-schema integration test proving fix-then-regress = 2 episodes end-to-end (not just at the M0 synthetic-fixture level). Constants sealed at M2 → v0.2: `compatibility_boundary.meter_version`, `meter_rules.convention_aggregation_min_items` (=3). New baseline: **478/478 tests, 56 files**; `bun run e1:protect` triad green throughout.

## Current Evidence State

- Core harness: condition rendering fairness, feedback gating, continuing workspaces, hidden oracle isolation, task package loading/validation, task sealing, run/checkpoint manifests, hashes, replay validation, artifact tamper detection, compatibility profiles, classification, causal max-turn enforcement, context-only feedback isolation, feedback-use evidence checks, provider/network validity flags, and `result-schema-v1`.
- Result metrics include final checkpoint pass-rate delta, regression counts, checkpoint-level `regression_free_success`, and `regression_free_auc`.
- Headline result (pricing, first credible positive evidence): on the `pricing-discount-lifecycle` family under Mistral-small, 2-turn/1-feedback, `path-survival-primary-v1`, 3 clean causal pilots per matrix, sealed before runs. `pricing-discount-demo-v1` (v0): executable, example-bearing specs beat prose-only specs — mean regression-free-AUC delta +0.4444 (3/3), final +0.5926 — but confounded because the prose arm was not shown the event API and stalled at the seed. `pricing-discount-content-controlled-demo-v1`: with the event API and worked examples equalized across both arms, the executable feedback loop still helped — mean AUC delta +0.1852 (3/3), final +0.2222, regression deltas (fb−ctx) 0/0/−1. Honest decomposition: the v0 gap was partly interface/example disclosure and partly the run-loop itself.
- Subscription and inventory remain calibration/difficulty context only: easier tasks, flat final-pass deltas (one positive retrospective secondary AUC under Mistral subscription). Not headline evidence; not pooled with pricing.
- Public evidence package committed: `docs/pricing-discount-public-narrative.md`, `docs/public-evidence-status.md`, `docs/public-evidence-matrix.md`, plus the two pricing run cards and the subscription/inventory run/task cards. Claims are bounded: single-model, single-task-family, small-n, not generalized, not pooled across boundaries.
- Strong-model content-controlled controls are sealed as separate non-pooled provider boundaries on the content-controlled task; initial A1 smokes have been operator-run. `anthropic/claude-sonnet-4.6` smoke is clean with both arms 9/9 (a possible ceiling hint, but only a `diagnostic_invalid` smoke, not causal evidence); `google/gemini-3.1-pro-preview` smoke is provider-flagged (`provider_malformed_response` + `provider_timeout`) and stopped at the clean-smoke gate — another cheaper-model structured-output reliability dead end. Difficulty probes and causal pilots for these controls are not yet run; further provider execution requires explicit authorization.
- Latest local suite: `bun test`, 193 tests, 0 failures.
- Local fake-pilot validation for `subscription-entitlements-lifecycle-v0` passes with replay, artifact verification, summaries, and hidden-oracle scoring.
- Provider probe `subscription-entitlements-difficulty-probe-20260605-003`: `difficulty_probe`, OpenRouter loop, `max_model_turns=2`, `max_feedback_runs=1`, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, both arms 9/9, delta 0, regression-free AUC delta 0.
- The provider probe had timeout flags on 10 checkpoints. It is structurally valid and replay-valid, but provider-flagged and not clean primary evidence.
- Provider probe `subscription-entitlements-difficulty-probe-20260605-004`: `difficulty_probe`, OpenRouter loop, profile `openrouter-loop-v1-timeout90000-output8000-temp0.2-retry0`, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, both arms 9/9, final delta 0, regression-free AUC delta 0.1111.
- The 004 provider probe had timeout flags on 6 checkpoints: `context_only_spec` I02/I07/I09 and `feedback_capable_spec` I06/I07/I08. It is structurally valid and replay-valid, but provider-flagged and not clean primary evidence.
- All 004 timeouts were `pre_model_action_timeout`, so no usable provider action occurred for those checkpoints and the workspace was carried forward due to provider failure. This contaminates difficulty interpretation and keeps provider reliability as the blocker.
- Provider smoke `provider-smoke-20260605-003`: `diagnostic_invalid`, OpenRouter loop, profile `openrouter-loop-v1-modeldeepseek-deepseek-v4-flash-routeopenrouter-chat-completions-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry0`, inspection `valid=true`, 6 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 3/3, final delta 0, regression-free AUC delta 0.
- This smoke is provider reliability evidence only. It is not primary evidence and says nothing causal.
- Provider probe `subscription-entitlements-difficulty-probe-20260605-005`: `difficulty_probe`, OpenRouter loop, same `120000`/`4000`/`64000`/`4000` profile as `provider-smoke-20260605-003`, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, both arms 9/9, final delta 0, regression-free AUC delta 0.
- The 005 provider probe had `provider_malformed_response` on 8 checkpoints and provider-failure carry-forward on 5 checkpoints. It is structurally valid and replay-valid, but provider-flagged and not clean primary evidence.
- Provider smoke `provider-smoke-20260605-004`: `diagnostic_invalid`, OpenRouter loop, parser-versioned profile `openrouter-loop-v1-modeldeepseek-deepseek-v4-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry0`, inspection `valid=true`, 6 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 3/3, final delta 0, regression-free AUC delta 0.
- Provider probe `subscription-entitlements-difficulty-probe-20260605-006`: `difficulty_probe`, OpenRouter loop, same parser-versioned profile as `provider-smoke-20260605-004`, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, both arms 9/9, final delta 0, regression-free AUC delta 0.
- The 006 provider probe had `provider_timeout` on 2 checkpoints, `provider_malformed_response` on 7 checkpoints, and provider-failure carry-forward on 9 checkpoints. It is structurally valid and replay-valid, but provider-flagged and not clean primary evidence.
- Provider smoke `provider-smoke-20260605-005`: `diagnostic_invalid`, first structured-output profile attempt, inspection `valid=true`, 6 replay steps, 0 artifact mismatches, but `provider_api_failure` on all 6 checkpoints because OpenRouter found no endpoint that could handle the requested parameters. This exposed an unversioned request-shape issue: the adapter was sending `max_completion_tokens`.
- Local mitigation after 005: OpenRouter requests now use `max_tokens`, and provider execution profiles version `request_parameter_version=openrouter-chat-request-max-tokens-v1`.
- Provider smoke `provider-smoke-20260605-007`: `diagnostic_invalid`, versioned structured-output profile `openrouter-loop-v1-modeldeepseek-deepseek-v4-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry0`, inspection `valid=true`, 6 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 3/3, final delta 0, regression-free AUC delta 0.
- Provider probe `subscription-entitlements-difficulty-probe-20260605-007`: `difficulty_probe`, same versioned structured-output profile as `provider-smoke-20260605-007`, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, both arms 9/9, final delta 0, regression-free AUC delta 0.
- The 007 provider probe had `provider_malformed_response` at `context_only_spec` I04 and `provider_timeout` at `context_only_spec` I08, with provider-failure carry-forward on 2 checkpoints. It is structurally valid and replay-valid, but provider-flagged and not clean primary evidence.
- Local mitigation after 007: OpenRouter loop now supports `--provider-max-retries`, records retry-recovered timeout/malformed failures as validity details on otherwise successful agent results, and versions `retry_policy_version=provider-retry-timeout-rate-malformed-v1` when retries are enabled.
- Provider smoke `provider-smoke-20260605-008`: `diagnostic_invalid`, retry-enabled structured-output profile `openrouter-loop-v1-modeldeepseek-deepseek-v4-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1`, inspection `valid=true`, 6 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 3/3, final delta 0, regression-free AUC delta 0.
- Provider probe `subscription-entitlements-difficulty-probe-20260605-008`: `difficulty_probe`, same retry-enabled profile as `provider-smoke-20260605-008`, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, both arms 9/9, final delta 0, regression-free AUC delta 0.
- The 008 provider probe had no timeouts and no provider-failure carry-forward, but it recorded retry-recovered `provider_malformed_response` details at `context_only_spec` I04, `context_only_spec` I09, and `feedback_capable_spec` I03. It is structurally valid and replay-valid, but provider-flagged and not clean primary evidence.
- Provider smoke `provider-smoke-20260605-009`: `diagnostic_invalid`, model-route changed to `anthropic/claude-sonnet-4.6` while keeping the structured-output retry profile shape, inspection `valid=true`, 6 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 3/3, final delta 0, regression-free AUC delta 0.
- Provider probe `subscription-entitlements-difficulty-probe-20260605-009`: `difficulty_probe`, same Sonnet structured-output retry profile as `provider-smoke-20260605-009`, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 9/9, final delta 0, regression-free AUC delta 0.
- The 009 probe is the first clean full provider difficulty probe in this sequence, but it is a difficulty probe only. It is not causal evidence, and the flat 9/9 result means that under this task/model/budget the task appears easy for both arms.
- The sealed analysis plan currently freezes `deepseek/deepseek-v4-flash`; the Sonnet run is a separate model/provider compatibility boundary and must not be pooled with the DeepSeek-profile runs or silently promoted into that sealed plan.
- Sonnet analysis-plan boundary added: `tasks/subscription-entitlements-lifecycle/analysis-plan.sonnet-causal-pilot-v0.json` freezes `anthropic/claude-sonnet-4.6` plus the exact structured-output retry provider profile for causal-pilot use.
- Causal pilot `subscription-entitlements-causal-pilot-20260605-001`: `causal_pilot`, same Sonnet profile, generated a summary but failed inspection because feedback opportunity integrity was incomplete and feedback-arm agent-result artifacts had schema/evidence mismatches. It is invalid and must remain diagnostic context only.
- Local mitigation after 001: model-loop runs no longer stop immediately after a passing feedback command; feedback-capable runs continue to the later model turn required for causal feedback-use evidence.
- Causal pilot `subscription-entitlements-causal-pilot-20260605-002`: `causal_pilot`, same sealed Sonnet profile, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, feedback opportunity integrity complete 9/9, both arms 9/9, final delta 0, regression-free AUC delta 0.
- The 002 causal pilot is clean primary evidence for a flat/null result under this sealed task/model/budget. It does not support a generalized feedback-effectiveness claim.
- P4 single-model expansion boundary added for `mistralai/mistral-small-2603` in `tasks/subscription-entitlements-lifecycle/analysis-plan.mistral-small-causal-pilot-v0.json`.
- Local evidence hygiene after adding the Mistral plan: provider execution profiles now include `model_loop_policy_version=model-loop-feedback-continues-after-feedback-v1` for OpenRouter loop runs, and profile IDs include a `looppolicy...` segment. This prevents pooling pre-fix loop artifacts with post-feedback-turn-preserving artifacts.
- Provider smoke `provider-smoke-20260605-010`: `diagnostic_invalid`, Mistral profile before loop-policy profile versioning, inspection clean. It is historical provider reliability context only and is superseded by `provider-smoke-20260605-011`.
- Provider smoke `provider-smoke-20260605-011`: `diagnostic_invalid`, loop-policy-versioned Mistral profile, inspection `valid=true`, 6 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 3/3, final delta 0.
- Provider probe `subscription-entitlements-difficulty-probe-20260605-010`: `difficulty_probe`, same loop-policy-versioned Mistral profile, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 9/9, final delta 0, regression-free AUC delta 0.
- Causal pilot `subscription-entitlements-causal-pilot-20260605-003`: `causal_pilot`, same sealed Mistral profile, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, feedback opportunity integrity complete 9/9, both arms 9/9, final delta 0, regression-free AUC delta 0.1111.
- The 003 Mistral causal pilot is clean primary evidence for a flat primary result and positive secondary regression-free AUC result under this sealed task/model/budget. It does not support a generalized feedback-effectiveness claim.
- P4 task-family expansion: `inventory-reservations-lifecycle-v0` exists as a sealed task package with nine checkpoints, runnable visible feedback assets, hidden-oracle coverage, local acceptance criteria, a sealed Mistral analysis plan, and one clean difficulty probe.
- Provider probe `inventory-reservations-difficulty-probe-20260605-001`: `difficulty_probe`, same loop-policy-versioned Mistral profile, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 9/9, final delta 0, regression-free AUC delta -0.2222.
- The inventory 001 probe is clean difficulty/provider evidence only. It is not causal evidence. The feedback-capable arm had temporary hidden cancellation-release misses at I05/I06 before recovering by I07.
- Causal pilot `inventory-reservations-causal-pilot-20260605-001`: `causal_pilot`, same sealed Mistral profile, inspection `valid=true`, 18 replay steps, 0 artifact mismatches, no validity flags, no timeout details, no provider carry-forward, feedback opportunity integrity complete 9/9, both arms 9/9, final delta 0, regression-free AUC delta 0.
- The inventory causal pilot is clean primary evidence for a flat/null result under this sealed task/model/budget. It does not support a generalized feedback-effectiveness claim.
- Timeout-flagged 9/9 provider probes are not evidence that the task is too easy.

## Guardrails

- Precommit task version, checkpoint list, visible specs, feedback assets, hidden oracle, budget, model/provider settings, provider execution profile, exclusion rules, and metrics before real evaluation.
- Precommit `protocol_profile_id` and metric definition before future real evaluation; do not change metrics after observing outcomes.
- Do not add checkpoints after observing arm-level outcomes unless creating a new task version and compatibility boundary.
- Do not change hidden oracle behavior or visible feedback assets after observing treatment outcomes and then pool old/new runs.
- Do not pool runs across task versions, checkpoint-list changes, feedback-asset patches, hidden-oracle patches, protocol changes, model/provider changes, provider execution profile changes, budget changes, or metric-definition changes.
- Both arms must receive the same maximum model-turn budget in causal runs.
- Feedback information, not extra turns, is the treatment.
- The context-only arm may receive self-review turns, but must not receive executable feedback output, feedback commands, or feedback asset paths.
- Hidden oracle checks must test behavior implied by the visible semantic spec.
- Visible feedback should be useful but not identical to the hidden oracle.
- Runs with provider, API, timeout, quota, or network failure must be validity-flagged.
- Provider-flagged runs are stress, diagnostic, or reliability evidence, not clean primary evidence.
- A run may be classified as causal feedback-use evidence only if feedback ran and had a possible path to influence a later model turn.
- One-turn runs where feedback cannot influence a later turn are difficulty calibration only.

## Current Priorities (2026-06-10; updated 2026-06-12)

- P0 — E1 to evidence grade: all local Step 0 items are DONE as of 2026-06-10 (real workspace-snapshot injection, sealed cache-breakpoint conversation layout, publication-grade `e1:inspect` replay/tamper/classification, wall-time capture + `e1:stats`, end-to-end scripted shakedown, 10×-green two-environment stability gate — see `docs/progress-log.md` and `docs/protocols/e1-step0-*-record-v0.md`). REMAINING, operator-authorized spend: re-run cheap-model no-op check + CartCalc calibration ×2 + one frontier context run under the new prompt-template hash (~$0.05–0.20), then cost projection via `e1:stats`, then seal base constants v1.0. Pre-snapshot-fix calibration bundles are a dead compatibility boundary for sealing purposes.
- P1 — OpenSpec workflow profile `e1-openspec-workflow-v0`: built and shakedown-passed 2026-06-10 (pinned CLI, telemetry neutralized, characterization tests, harness archive step, survival ledger, fresh-mount scenario parity, CartCalc-scale fixture proving the silent MODIFIED-replace scenario drop). REMAINING before seal: `e1:inspect` replay support for the archive step between checkpoints; then optional operator-authorized cheap-model calibration of the OpenSpec fixture.
- P2 — First E1 evidence task: design gates precommitted in `docs/protocols/e1-first-evidence-task-design-gates-v0.md`. Billing v2 was built, probed, and closed as a frontier context ceiling under two models (Sonnet 4.6 probe v2; Qwen 3.7 Max probe v4, evidence-grade, AUC 0.9361, zero regressions, early-stop — run cards in `docs/run-cards/`). Successor design boundary precommitted 2026-06-11: `docs/protocols/billing-v3-task-design-v1.md` (`e1-billing-v3` — seeded replay-hash spine from CP01, forced structural rewrites of frozen-invariant files, naive proof strengthened to ≥4 regressions across ≥3 frozen files, third-ceiling closure rule). Built 2026-06-11 (`tasks/e1-billing-v3/`, gates all green incl. the strengthened 5-mechanism naive proof, forced-touch and spine-threat audits; full suite 367/367). NEXT: seal `e1-billing-v3-commitments-v1.md` + a Stage 1 probe plan; frontier difficulty probe and evidence matrix remain operator-authorized gates, with the third-ceiling closure rule in force.
- P2 (continued, 2026-06-12) — Frontier-hardness successor: DeepSeek V4 Pro ceilinged the `e1-dispatch-v1` context arm (calibration, AUC 0.9768, mean 8.0 turns/checkpoint — run card `docs/run-cards/e1-dispatch-deepseek-v4-pro-context-stage1-seed-a-20260612-001.md`); brute-force turn investment rediscovers the 4 scattered sites without feedback, with never-passes clustered exactly at the budget_exhausted checkpoints. Seeds B (AUC 0.9824) and C (AUC 0.9310; run of record `-002` after an infrastructure-killed `-001` partial) completed 2026-06-12 under the sealed ladder: three consecutive ceiling seeds, so the dispatch domain is CLOSED for DeepSeek V4 Pro (run cards in `docs/run-cards/`). Dispatch-v1 stays open for Qwen-tier Stage 2 evidence (Qwen 3.7 Max context arm 0.7284, not ceilinged). Decision: design a new non-pooled task family `e1-fulfillment-v1` against the frontier tier — see the "Next Frontier Task Family" section below, the draft design boundary `docs/protocols/e1-fulfillment-task-design-v1.md`, and the research synthesis `docs/research/executable-feedback-frontier-hardness-synthesis-v1.md`.
- All provider runs remain operator-authorized only, with precommitted classification, profile, budget, and metrics.

## P0 - Freeze Path-Survival-Primary Protocol

- Status: protocol profile support added locally; operator approval is still required before evidence-generating provider runs.
- `matrix_freeze_commit=fe50a43de8162e1ccce21856b7119161290971c1` freezes the validation matrix only; it is not execution-ready by itself.
- Freeze Stage 1 execution state before provider runs: include protocol-profile runtime support, CLI profile selection, both Stage 1 task packages, and the matrix docs in a clean `stage1_execution_freeze_commit`.
- Protocol/profile ID: `path-survival-primary-v1`.
- Primary metric for future runs under this profile: `regression_free_auc` delta, feedback minus context.
- Secondary metrics: final checkpoint pass-rate delta, regression count delta, checkpoint-level `regression_free_success`, feedback opportunity integrity, provider validity, and clean-primary-evidence eligibility.
- Compatibility boundary includes `protocol_profile_id` and `metric_definition_hash`.
- Summaries and manifests identify the run's protocol profile and protocol primary metric.
- Existing final-pass-primary run interpretation remains unchanged; old AUC values are retrospective secondary observations only.
- Do not run providers while freezing protocol docs and manifests.

## Superseded (pre-execution): P1 - Predeclared Internal Validation Runs

Superseded 2026-06-10 before any Stage 1 run was executed; see `docs/protocols/path-survival-primary-v1-validation-matrix-supersession-v1.md`. Subscription and inventory cannot discriminate path survival (full-solution template seeds, ceiling behavior, 3/108 non-perfect arm-checkpoints and zero true regressions across the 6 clean runs). The historical content below is preserved verbatim as a frozen pre-registration.

Predeclared matrix: `docs/protocols/path-survival-primary-v1-validation-matrix.md`.

Only after `path-survival-primary-v1` and the validation matrix are reviewed and approved:

- Stage 1 primary internal validation uses `subscription-entitlements-lifecycle-v0` and `inventory-reservations-lifecycle-v0`.
- Stage 1 model/provider profile is `mistralai/mistral-small-2603`.
- Stage 1 requires 3 clean causal pilots per task, 6 clean causal pilots total.
- Stage 1 support requires feedback-capable AUC higher in at least 4 of 6 clean runs, mean AUC delta `>= +0.10`, no systematic final checkpoint pass-rate harm, and all included runs `clean_primary_evidence_eligible=true`.
- Stage 2 is optional after Stage 1 is completed and interpreted: same two tasks, `anthropic/claude-sonnet-4.6`, 1 or 2 clean causal pilots per task for ceiling/control comparison only.
- Replacement runs may only replace invalid or provider-flagged scheduled runs under the same compatibility settings; do not replace unfavorable clean runs.
- Provider-flagged and invalid runs must be recorded, excluded from clean primary evidence, and not silently deleted.
- Keep `max_model_turns=2` and `max_feedback_runs=1`; avoid task semantic changes, checkpoint additions, hidden-oracle patches, feedback-asset patches, or metric changes in response to outcomes.

## P2 - Public Narrative Decision

- Do not publish current flat/null results as validation.
- Do not run providers randomly until one positive result appears.
- Do not add task checkpoints reactively.
- Do not change primary metrics after seeing validation results.
- Do not pool protocol-v1 final-pass-primary evidence with `path-survival-primary-v1` evidence without an explicit compatibility decision.
- Publish only if future path-survival-primary results are materially stronger, clean, replayable, and replicated enough for the claim level.

## Frozen Calibration Artifact

`role-permissions-calibration-v0`

- Purpose: harness, provenance, feedback-loop, and difficulty calibration only.
- Status: frozen as calibration-only; not the primary task.
- Checkpoints: `I01` owner edit, `I02` org admin edit, `I03` viewer read-only, `I04` suspended users blocked, `I05` explicit deny overrides allow, `I06` cross-org access forbidden, `I07` temporary project grants.
- Do not add `I08+` unless creating a separately versioned generated or sealed task family.
- Existing runs remain calibration or diagnostic evidence only and must not be promoted to causal evidence.

## Active Task

`subscription-entitlements-lifecycle-v0`

- Status: full task package exists and loads.
- Implemented: visible specs, checkpoints `I01`-`I09`, runnable visible feedback assets, reference template workspace, executable hidden oracle, local acceptance criteria, and sealed analysis plan.
- Local validation: no-provider fake-pilot replay, provenance, compatibility validation, visible feedback execution, hidden-oracle reference checks, targeted hidden-oracle regression checks, summaries, and hidden-oracle scoring pass.
- Do not mutate the task in response to the timeout-flagged provider result.

Checkpoint sequence:

- `I01` trial starts and grants access until `trialEnd`.
- `I02` successful payment activates paid subscription and extends `currentPeriodEnd`.
- `I03` cancel-at-period-end preserves access until period end, then disables access.
- `I04` payment failure enters grace period; access survives during grace but ends after grace.
- `I05` retry success during grace restores active paid status without losing period history.
- `I06` duplicate event IDs are idempotent and must not double-charge or double-extend access.
- `I07` fraud suspension overrides trial, paid, grace, cancellation, grants, and downgrade.
- `I08` plan downgrade takes effect next period; old entitlements remain until period end.
- `I09` refund/chargeback creates restricted status and must not resurrect canceled access.

## Next Sealed Task Family

`inventory-reservations-lifecycle-v0`

- Status: local sealed task package exists and loads.
- Implemented: visible specs, checkpoints `I01`-`I09`, runnable visible feedback assets, reference template workspace, executable hidden oracle, local acceptance criteria, and sealed Mistral analysis plan.
- Local validation: targeted package tests, visible feedback execution, task sealing, hidden-oracle reference checks, targeted hidden-oracle regression checks, and no-provider fake-pilot replay/provenance/compatibility validation pass.
- Provider status: clean difficulty probe `inventory-reservations-difficulty-probe-20260605-001` and clean causal pilot `inventory-reservations-causal-pilot-20260605-001` have run under the sealed Mistral profile. Cite the causal pilot only as task/model/budget-specific evidence.

Checkpoint sequence:

- `I01` stock receipts increase on-hand and sellable inventory.
- `I02` reservations hold stock until expiration.
- `I03` order confirmation converts held reservations to committed stock.
- `I04` reservation expiration releases held stock back to sellable inventory.
- `I05` cancellation releases unshipped held, committed, or backordered allocations.
- `I06` duplicate event IDs are idempotent.
- `I07` shipment consumes committed stock and later cancellation does not restore it.
- `I08` restock fills backorders FIFO by full reservation.
- `I09` sellable returns restore inventory; damaged returns do not.

## Next Frontier Task Family (design phase, 2026-06-12): e1-fulfillment-v1

Goal: a sealed task where high-investment frontier models (DeepSeek V4 Pro tier) do
not ceiling in the context arm, by combining wider independent obligations (9
classes), registry-scoped quantification, cross-checkpoint poison chains, and
turn-economy pressure — under strict content parity (treatment stays executability
alone; the content-asymmetric "decoy" lever was rejected, see the research synthesis).
References: draft design boundary `docs/protocols/e1-fulfillment-task-design-v1.md`;
research synthesis `docs/research/executable-feedback-frontier-hardness-synthesis-v1.md`.

Incremental path (in order; each item a separate commit-sized increment):

1. DONE 2026-06-12 — research synthesis doc committed (`docs/research/executable-feedback-frontier-hardness-synthesis-v1.md`).
2. DONE 2026-06-12 — task design boundary committed (`docs/protocols/e1-fulfillment-task-design-v1.md`).
3. DONE 2026-06-12 — design review pass against `docs/protocols/e1-first-evidence-task-design-gates-v0.md`: three amendments (OpenSpec canonicalizable-prose constraint; predeclared frontier-probe interpretation rule, ceiling-defeat vs structural failure; M5 registry authority stated in the seed spec-of-record as a behavioral requirement). Design doc frozen; structural changes require a v2 before sealing.
4. Build reference `src/` final state + seed workspace (10 files, ops channel seeded inactive).
5. Build oracle package: `scenarios.ts`, partition-ledger lint (incl. the journal-replay rule), case generator, ~170–190 cases (hard cap 190), `site-map.json`.
6. Stage snapshots (k = 4, 8, 12) + `test/e1-fulfillment.test.ts` gates 1–12 (incl. the new turn-cost, sequential-poisoning, parity/per-site-coverage, and site-map-integrity gates) — all green locally.
7. Visible-spec generator + OpenSpec template state; parity audit green.
8. Secondary-metrics descriptives (dispersion covariate, site recall, pass-to-pass precision, redirected-investment ratio) in `src/result-summary.ts` + new `src/site-metrics.ts`; sealed `result-schema-v1` untouched.
9. Seal `e1-fulfillment-v1-commitments-v1.md` (hashes incl. `site-map.json`).
10. Author Stage 1 plan v1: DeepSeek V4 Pro (direct route) as the primary Stage 1 model, Qwen 3.7 Max as comparison context; gates G1 (AUC ≤ 0.92), G2 (≥1 correction CP < 0.75), G3 (never-pass or flip > 0); third-ceiling closure rule. All runs remain operator-authorized.

DONE 2026-06-12 (operator-authorized, `calibration`): `e1-dispatch-v1` DeepSeek V4
Pro Stage 1 seeds B/C executed ($0.265 + $0.257). All three seeds ceilinged (0.9768 /
0.9824 / 0.9310 > 0.92), formally closing the dispatch domain for DeepSeek V4 Pro
under the sealed three-seed rule. Seed C run of record is `-002`; the `-001` attempt
was killed at CP3 by an environment-level process-table exhaustion and is preserved
as an infrastructure-killed partial. Run cards in `docs/run-cards/`.

## P0 - Evidence Hygiene / Provider Validity

- Status: implemented/verified locally for manifest recording, generated summaries, inspection output, checkpoint carry-forward, checkpoint feedback opportunity integrity, and provider profile compatibility.
- Derived `clean_primary_evidence_eligible` appears in manifests, generated summaries, and `inspect-run` output.
- Timeout causality classification covers:
  - pre-model-action timeout
  - post-model-action timeout
  - feedback execution timeout
  - feedback summary timeout
  - repair-turn timeout
  - retry-recovered timeout
  - nonfatal provider warning
- Checkpoint-level carried-forward workspace due to provider failure is recorded and verified.
- Checkpoint-level feedback opportunity integrity for causal pilots is recorded and verified:
  - turn 1 completed
  - feedback ran
  - feedback summary delivered
  - turn 2 completed after feedback
- Manifest-level `clean_primary_evidence_eligible` now also requires complete feedback opportunity integrity when a causal pilot has feedback assets.
- Provider model, route, endpoint, response parser, request parameter shape, response format, provider parameter-routing requirement, timeout, retry, max-output, workspace context cap, feedback summary cap, temperature, and profile settings are versioned in provider profile metadata and compatibility hashes.
- Keep tests current for validity-flagged causal pilots being ineligible for clean primary evidence.
- Keep tests current for provider execution profile changes preventing pooling.

## P1 - Clean Execution Path

- Status: clean full provider difficulty probe achieved under the Sonnet model-route mitigation in `subscription-entitlements-difficulty-probe-20260605-009`. The previous DeepSeek retry-enabled structured-output profile remains provider-flagged and is not clean primary evidence.
- First timeout mitigation path tried: reduce output pressure to `8000`, use `90000ms` per-call timeout, keep retries at `0`, and version the profile as `openrouter-loop-v1-timeout90000-output8000-temp0.2-retry0`.
- Provider smoke-test plan added at `docs/provider-smoke-test-plan.md`.
- Previous provider smoke outcome under the first mitigation profile: `valid=true`, 6 replay steps, 0 mismatches, no validity flags, no timeout details, no provider carry-forward, and matching provider profile ID.
- Full difficulty-probe outcome under the same profile: `valid=true`, 18 replay steps, 0 mismatches, both arms 9/9, final delta 0, but `provider_timeout` on 6 checkpoints with 6 provider-failure carry-forwards.
- At that point, a clean difficulty probe had not been achieved. Do not advance to causal pilot from the 004 run.
- Local mitigation implemented before the next provider attempt: provider execution profiles now explicitly record model ID, route, endpoint, workspace context cap, and feedback summary cap; CLI exposes `--max-workspace-bytes` and `--max-feedback-output-bytes`.
- Intermediate provider smoke `provider-smoke-20260605-002` under the stronger profile had no provider flags, but inspection was `valid=false` because the sample-cart hidden oracle emitted `status: "ok"` with failed checks. That was a local smoke-oracle schema bug, not provider evidence.
- The sample-cart oracle status bug was fixed and covered by tests. Rerun `provider-smoke-20260605-003` was clean under the stronger profile.
- Full difficulty probe `subscription-entitlements-difficulty-probe-20260605-005` under that profile removed timeout flags, but exposed malformed provider/model responses. Do not advance to causal pilot from the 005 run.
- Local parser mitigation implemented after 005: OpenRouter loop accepts text-part message content arrays, malformed JSON details no longer receive timeout-phase labels, and provider execution profiles now include `response_parser_version`.
- Parser-versioned provider smoke `provider-smoke-20260605-004` was clean, but full difficulty probe `subscription-entitlements-difficulty-probe-20260605-006` still had provider timeouts and malformed responses.
- Structured-output provider smoke `provider-smoke-20260605-005` failed at provider routing because the request used `max_completion_tokens`; this is recorded as provider-flagged reliability evidence.
- Request-shape mitigation implemented after 005: use OpenRouter `max_tokens` and version `request_parameter_version=openrouter-chat-request-max-tokens-v1`.
- Structured-output provider smoke `provider-smoke-20260605-007` was clean under profile `openrouter-loop-v1-modeldeepseek-deepseek-v4-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry0`.
- Full difficulty probe `subscription-entitlements-difficulty-probe-20260605-007` under that profile was provider-flagged with one malformed response and one timeout in `context_only_spec`.
- Retry-policy mitigation implemented after 007: OpenRouter loop can retry timeout, quota/rate-limit, and malformed-response provider failures once; recovered failures remain validity-flagged with retry details and therefore do not count as clean primary evidence.
- Retry-enabled provider smoke `provider-smoke-20260605-008` was clean under profile `openrouter-loop-v1-modeldeepseek-deepseek-v4-flash-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1`.
- Full difficulty probe `subscription-entitlements-difficulty-probe-20260605-008` under that profile eliminated timeouts and provider carry-forward, but still recorded retry-recovered malformed responses.
- Do not rerun the same DeepSeek retry-enabled structured-output profile as a clean-evidence attempt.
- Model-route mitigation after 008: OpenRouter model metadata was inspected and `anthropic/claude-sonnet-4.6` was chosen because it supports the current required request parameters (`max_tokens`, `response_format`, `structured_outputs`, and `temperature`) without another request-shape change.
- Provider smoke `provider-smoke-20260605-009` was clean under profile `openrouter-loop-v1-modelanthropic-claude-sonnet-4.6-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1`.
- Full difficulty probe `subscription-entitlements-difficulty-probe-20260605-009` under that Sonnet profile was clean: `valid=true`, 18 replay steps, 0 mismatches, no validity flags, no timeout details, no provider carry-forward, both arms 9/9, final delta 0, regression-free AUC delta 0.
- This closes the clean execution bottleneck for the Sonnet provider profile only. It does not clean or pool prior DeepSeek provider-flagged probes.
- The current sealed analysis plan names `deepseek/deepseek-v4-flash`; any causal run under the Sonnet profile requires an explicit versioned analysis-plan/profile decision before execution.
- Treat provider-flagged probes as non-primary evidence.

## P2 - Public Credibility Artifacts

- Status: initial public credibility artifact set added for the clean Sonnet difficulty probe and clean Sonnet causal pilot.
- Public run card: `docs/run-cards/subscription-entitlements-difficulty-probe-20260605-009.md`.
- Causal pilot run card: `docs/run-cards/subscription-entitlements-causal-pilot-20260605-002.md`.
- Mistral causal pilot run card: `docs/run-cards/subscription-entitlements-causal-pilot-20260605-003.md`.
- Inventory causal pilot run card: `docs/run-cards/inventory-reservations-causal-pilot-20260605-001.md`.
- Public task card: `docs/task-cards/subscription-entitlements-lifecycle-v0.md`.
- Evidence-status dashboard: `docs/public-evidence-status.md`.
- Public evidence matrix: `docs/public-evidence-matrix.md`.
- Regression-free success plot: `docs/plots/regression-free-success-20260605-009.md`.
- Causal pilot regression-free success plot: `docs/plots/regression-free-success-causal-pilot-20260605-002.md`.
- Mistral causal pilot regression-free success plot: `docs/plots/regression-free-success-causal-pilot-20260605-003.md`.
- Inventory causal pilot regression-free success plot: `docs/plots/regression-free-success-inventory-causal-pilot-20260605-001.md`.
- Timeout-flagged 9/9 explainer: `docs/explainers/timeout-flagged-9-of-9-is-not-clean-evidence.md`.
- Frame these as public communication and credibility artifacts, not scientific proof.
- Every public result should state classification, validity flags, model/provider profile, task version, budget, replay/artifact status, and compatibility boundary.
- Do not average or pool clean causal pilots across task/model/profile boundaries unless a future analysis plan precommits that pooled estimate.

## P3 - Causal Pilot

- Status: complete for the first Sonnet sealed causal pilot, the Mistral subscription causal pilot, and the Mistral inventory causal pilot.
- The Sonnet analysis-plan boundary is sealed in `tasks/subscription-entitlements-lifecycle/analysis-plan.sonnet-causal-pilot-v0.json`.
- Clean causal pilot `subscription-entitlements-causal-pilot-20260605-002` is provider-valid, replay-valid, artifact-valid, and feedback-use-valid.
- Clean causal pilot `subscription-entitlements-causal-pilot-20260605-003` is provider-valid, replay-valid, artifact-valid, and feedback-use-valid under the Mistral subscription boundary.
- Clean causal pilot `inventory-reservations-causal-pilot-20260605-001` is provider-valid, replay-valid, artifact-valid, and feedback-use-valid under the Mistral inventory boundary.
- Feedback-capable checkpoints show complete `model_turn -> feedback_run -> model_turn` opportunity integrity on 9/9 checkpoints.
- Treatment interpretation: flat/null on the primary final-pass-rate metric across the clean causal pilots so far. Secondary AUC is flat for Sonnet subscription and Mistral inventory, and positive for Mistral subscription.
- Do not hide flat, null, invalid, or provider-flagged results if they are relevant to the project narrative.

## P4 - Expansion / Later

- More task families: initial expansion added with `inventory-reservations-lifecycle-v0`; clean difficulty probe and clean causal pilot completed. Do not add another task family without a precommitted reason and scope.
- More models: initial single-model expansion completed with the sealed Mistral Small profile. Do not turn this into a many-model matrix without a separate precommitted plan.
- Additional arms.
- Spec-format comparisons between arms (the shared-environment OpenSpec workflow under `e1-openspec-workflow-v0` is NOT this — it is in scope and tracked under Current Priorities P1).
- Formal statistical replication.
- Many-model matrices.
- General benchmark platform work.

These are later because the current bottleneck is bringing E1 to evidence grade plus public-legible evidence artifacts.

### E3 sequential brownfield regression (design drafted 2026-07-04, NOT authorized)

- Design: `docs/protocols/e3-brownfield-regression-after-several-changes-design-v1.md` (DESIGN DRAFT - no run, new compatibility boundary).
- Goal: measure true regressions after several carried-forward changes in the same brownfield repo, then test whether official executable feedback improves regression-free episode survival.
- Near-term build: episode manifest + cumulative scorer, injected two-change smoke, 2 repos x 4 real changes offline certification, then control-only calibration before any treatment spend.
- Status (2026-07-04): harness infrastructure BUILT and tested.
  - `src/hit_sdd_e2/e3/manifest.py`: `EpisodeManifest`, `EpisodeChange`, `OracleBundle` frozen dataclasses; sealed bundle_at() with bounds checking.
  - `src/hit_sdd_e2/e3/scorer.py`: `score_step()` pure function; `true_regression` / `unresolved_carryforward` / `retained` classification; 14 smoke tests all green.
  - `src/hit_sdd_e2/e3/certify.py`: `certify_episode()` Docker certification gate; marker-delimited stdout (no bind-mount); `git reset --hard` + `git clean -fd`; `git apply --check` guard for noop phase.
  - Two episode candidates certified offline (no model spend):
    - **pvlib-e3-episode-candidate-v1** (`runs/e3-episodes/pvlib-e3-episode-candidate-v1.json`): 2-step, pvlib-2048 + pvlib-2088 (both share base commit `1eecaa38e8cf07a0`), all_gates_ok=True, noop FAIL, gold PASS, no regressions, 8 F2P tests total.
    - **xarray-e3-episode-candidate-v1** (`runs/e3-episodes/xarray-e3-episode-candidate-v1.json`): 4-step designed, steps 1-2 pass gates (xarray-8946 Apr + xarray-9042 May), steps 3-4 fail patch-conflict gate (Sep/Nov 2024 patches don't apply to Apr 2024 base).
  - Key engineering lesson: SWE-bench patches require the same base commit to stack; instances separated by >6 weeks typically conflict.
- Next: find a second certified episode (extend pvlib or find cfn-lint/another dense cluster), then control-only calibration with predeclared minimum regression rate. Operator authorization required before model spend.

### E2 budget-sensitivity follow-up (design drafted 2026-06-21, NOT authorized)

- Design: `docs/protocols/e2-budget-sensitivity-design-v1.md` (DESIGN DRAFT — no run, new compatibility boundary).
- Motivation: qwen replication showed at budget=60 treatment eliminated the gap on `guardian-899` (2→0) but resolved fewer (8→4) — `run_tests` consumes turns, so budget moderates whether feedback is diagnostic (gap↓) or generative (resolve↑).
- Manipulates **budget × arm** (budget equal across arms at each level — inviolable); primary = resolve-delta trend across budget levels; secondary = gap stability. qwen 3.7 max; k≈4–6 solvable budget-binding tasks.
- Gated: do NOT run until the n=13 qwen replication completes + is reported, the task subset is sealed from its resolve/gap profile, and operator authorizes with a spend cap. Does not touch the running pilot (frozen at 60).

### E2 Protocol v2 — large-repo navigation-equalized (design drafted 2026-06-21, NOT authorized)

- Design: `docs/protocols/e2-protocol-v2-large-repo-navparity-design-v1.md` (DESIGN DRAFT — no run, new compatibility boundary).
- Goal: clean test of the hypothesis that executable feedback helps **most on large repos**. Give **both arms** a read-only `CodeBrowser` (ripgrep-style search + tree-sitter symbol index; NOT LSP, NOT python-ast; exclude test files; pristine frozen index) so control can navigate without execution → only difference stays `run_tests`.
- Scope: the 4 large repos (black-4684/4670, attrs-1448, kafka-2608), **both** DeepSeek and qwen, N=10 → 160 rollouts. Separate stratum; never pooled with v1; combine via mixed-effects design×treatment interaction.
- Records the two-directional-confound decision: named checks = primary construct, anonymized-checks variant = robustness secondary.
- Gated: after the qwen replication is reported; needs CodeBrowser build + leak-guard validation + sealed commitments + authorization + spend cap.

### E2 confoundability metric — predict where agents confidently fail (design drafted 2026-06-21, NOT authorized)

- Design: `docs/protocols/e2-confoundability-metric-design-v1.md` (DESIGN DRAFT — no run, new compatibility boundary).
- Goal: build + validate a static, answer-independent **confoundability score** `C(task)` predicting the self-verification-gap rate for a class of strong self-verifiers — fills a real literature gap (property→gap link is unmeasured). Subsumes task-enrichment (rank by predicted gap).
- Method: features (non-locality, edit-to-failure distance, weak-oracle/coverage, scale, spec-completeness) → label gap on a **screener ensemble held out from the model the score is applied to** (non-circular) → fit predictor → **prospective held-out-task calibration**. Uses the strengthened oracle (held-out P2P + reproduction + mutation) for truer labels.
- Cost: the expensive one (100–300 tasks × 2–3 screeners × N). **Feasibility-pilot-gated** (~30–40 tasks first; abort if no signal). A null is a valid, publishable result.

## Test-First Backlog

Write or update tests before implementing each validity-critical change:

- Both arms receive the same visible semantic spec text.
- Only `feedback_capable_spec` receives feedback assets, commands, and paths.
- Both arms receive equal maximum model turns.
- `context_only_spec` second turns receive no feedback summary.
- `feedback_capable_spec` second turns receive feedback summaries only if feedback was run.
- Checkpoint `I02` starts from the post-`I01` workspace for the same condition.
- Hidden oracle files are absent from the agent-readable workspace.
- Hidden oracle checks cannot be accessed by feedback assets.
- Hidden oracle outputs are recorded but not leaked into subsequent prompt packets.
- Result replay detects tampering in prompt packets, feedback assets, result files, summaries, snapshots, agent results, and hidden oracle outputs.
- Task-version mismatch prevents pooling.
- Patched feedback assets create a new compatibility boundary.
- One-turn/no-feedback runs cannot be classified as causal feedback-use runs.
- `regression_free_success` calculation is correct.
- `regression_free_auc` calculation is correct.
- Provider failure is validity-flagged.
- Provider execution profile changes prevent pooling.
- Validity-flagged causal pilots are not clean primary evidence eligible.
- Provider timeout details include failure phase, feedback availability, model-response receipt, code-change state, retry count, and workspace carry-forward.
- Feedback-capable causal pilots require a persisted feedback-opportunity transcript sequence.

## Do-Not-Do-Next

- Do not add more `role-permissions-calibration` checkpoints as the next move.
- Do not add new arms or aliases. In particular, do not add the three-condition mechanism-decomposition design (self-test arm / static which-cases-failing hint arm) documented in `docs/research/executable-feedback-frontier-hardness-synthesis-v1.md` unless its full unlock condition is met: a frontier null on the e1-fulfillment two-arm result, a documented revision of this guardrail at a dated boundary, a separate sealed protocol profile, and explicit operator authorization.
- Do not compare spec formats between arms. The shared-environment OpenSpec workflow under `e1-openspec-workflow-v0` (same scenario content both arms, executable feedback as the only causal variable) is in scope and is not a spec-format comparison.
- Do not tune hidden oracle or visible feedback after seeing arm-level outcomes.
- Do not pool pre-patch and post-patch runs.
- Do not count one-turn no-feedback runs as feedback-use evidence.
- Do not weaken `context_only_spec`.
- Do not weaken same-visible-spec parity.
- Do not make the subscription task hard through arbitrary hidden gotchas.
- Do not run provider experiments automatically.
- Do not run another difficulty probe as a repeated evidence attempt unless it answers a new predeclared model/provider profile question.
- Do not treat timeout-flagged provider runs as clean evidence.
- Do not import active runtime code from `../hit-sdd-bench.old`.
- Do not recreate the old benchmark framework.

## Tool Boundary

Bun owns runner scripts, TypeScript/JavaScript tests, and CLI scripts.

Python is not needed now. If it becomes necessary for analysis or optional evaluator utilities, `uv` must own Python dependencies and lockfiles, and the reason must be documented here before adding it.
