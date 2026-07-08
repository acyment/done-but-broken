# E4 Design Brief — HIT-SDD Bench "Drift Velocity"

**Program slug: E4. Public name: "HIT-SDD Bench — Drift Velocity". Never "E2"** — inside this estate, E2 names an already-published experiment (see §1).

**Audience:** the agent executing `E4-REDESIGN-PROMPT.md`. This brief encodes the experiment's intent and decisions. Companion document: `BASE-DECISION.md` (the Phase −1 audit that selected this repo as base — read it; it contains the estate map, the port/discard lists, and the guardrail context). Where this brief conflicts with repo reality, **the repo wins on facts, the brief wins on intent** — flag every conflict, don't silently resolve. (v1 of this brief was corrected against the Phase −1 audit; residual errors may remain.)

---

## 1. The estate (corrected per Phase −1 audit)

This project spans **two deliberately separate repositories**:

- **`hit-sdd-bench`** (GitHub `acyment/done-but-broken`) — **this repo, the chosen base.** TypeScript/bun. The scientific-record + E1-harness repo: the sealed E1 experiment (CartCalc/billing/dispatch sealed tasks), the **L0/L1 turn protocol** — L1 is a strict block-grammar parser whose completion claim is a structured `done_literal` token, not natural-language claim extraction — **sealed constants v1.0.0** (`docs/protocols/e1-frontier-sealed-constants-v1.0.json`), provenance/replay/tamper-detection test coverage (baseline: 379/379 tests green), protocol docs, run cards, proto-paper, OpenSpec workflow integration, and AGENTS.md experimental-discipline guardrails. L2 is a defined protocol layer with only dev-grade orchestration implemented; `e1-harness.ts` is the L0 mechanics library, and the two orchestrators (`e1-package-runner.ts`, `runner.ts`) run different task formats *(corrected at Gate 0 per DISCOVERY C1)*.
- **`hit-sdd-bench-e2`** (GitHub `acyment/done-but-broken-harness`) — Python/uv/Docker execution harness. Home of the **published brownfield acceptance-feedback ablation ("E2" in this estate's numbering)**: pooled control gap_rate 0.7865 → treatment 0.1333 (the "79%→13%" headline), plus a Qwen 50%→0% replication, on SWE-bench Live with a Docker oracle. Also home of the **live E3 regression program** (sequential runner, partly uncommitted at audit time). **E4 never modifies this repo and introduces no dependencies on it** (§10).

**Replay-validity caveat (why §9 exists in its current form):** the two headline runs are recorded as non-replay-valid — patch text and full traces were not retained. The headline is part of the record but cannot be re-executed from either repo. E4 must never repeat this.

**Numbering:** E1 = sealed one-shot experiment (this repo). E2 = published brownfield ablation. E3 = live regression program. **E4 = this program, drift velocity.**

## 2. What E4 is

E4 is a **longitudinal** experiment: an agent executes a **sequence of 6–10 tasks on one evolving codebase** (one fork per experimental arm; task k+1 starts from the arm's state after task k). The question: **how fast do spec and code stop agreeing when nothing forces them to stay in sync ("drift velocity"), and does forcing it hold them together at a cost worth paying.**

Drift has two directions, and the HIT-SDD workflow has two components that map onto them — this decomposition is a core design commitment (it defends against the "your method is 'keep the spec enforced,' your finding is 'the spec stayed enforced'" tautology objection):

- **Code drifts from spec** (conformance failures) → addressed by the **oracle** (acceptance tests must pass).
- **Spec drifts from code** (stale claims, coverage gaps as code legitimately evolves) → NOT addressed by the oracle; addressed by the **gate** (spec/scenarios for the task must exist and fail red before implementation may begin — acceptance-level red/green).

## 3. Arms (paired: identical task sequence and seeds across arms)

- **Arm 0 — control.** Spec artifacts present and verified in sync at T0. Agent receives task descriptions. Nothing instructs or requires maintaining the spec. (Models how most teams run CLAUDE.md today.)
- **Arm M — prompt-only discipline.** Identical to Arm 0 plus an explicit standing instruction to keep spec artifacts current. No gate, no oracle. (Tests whether machinery is needed or a sentence in the prompt suffices.)
- **Arm H — HIT-SDD.** Gate + oracle, mechanically enforced by the harness (enforcement mechanics = ADR, see §13).

Manipulation check: log **spec-touch rate** per arm (did the agent edit spec files at all). If Arm 0 agents spontaneously maintain the spec, that's a finding, not a bug.

**Governance note:** the current AGENTS.md freezes E1/E2's two-condition vocabulary and bans additional arms. E4's three arms require the recorded guardrail amendment described in §10 before any Phase-3 code lands.

## 4. Pre-registered hypotheses (design every metric so each H yields one reportable number)

- **H1:** Arm 0 drift velocity is substantially > 0 — agents convert drift opportunities into drift at a high rate.
- **H2:** Arm H drift ≈ 0 in both directions.
- **H3:** Arm M lands between, with a specific leak signature: decent spec-side freshness, worse code-side conformance than H (no oracle → false-confidence completions slip through, consistent with the E2 ablation).
- **H4:** Arm 0 task success declines with sequence position while H stays flat, and the decline is mediated by the estate's established mechanism: stale spec → wasted turns → budget exhaustion → interrupted agent → regression.
- **H5:** Arm H's maintenance overhead (**freshness tax**, tokens/turns) < Arm 0's compounding cost (**drift tax**).
- **Noticing probe (cheap, always on):** after each task, one extra prompt: "was anything in the provided spec/context files inaccurate?" Log the answer; never feed it back into the run.

## 5. Substrate v1 — procedural evolution generator (clean-room)

v1 substrate is a **procedurally generated REST-service evolution**, reimplementing the *pattern* published in StaminaBench (arXiv 2606.19613) — NOT its code.

**HARD LICENSE CONSTRAINT:** StaminaBench's repo (github.com/amazon-science/StaminaBench) is **CC BY-NC 4.0, explicitly covering its code, generated scenarios, and documentation**. This project has commercial purposes. Therefore: never copy, vendor, or derive from that repo's code, data, or docs. The paper's *ideas* (procedural typed-schema evolution, structured change-op action space, programmatic black-box test generation, per-turn ground truth) are fair game. Document provenance in an ADR: "clean-room reimplementation from the published paper."

Pattern components to build:
- **Typed schema IR**: entities, typed fields, relationships, endpoints (CRUD + simple analytics/workflow ops). Deterministic, seedable.
- **Change-op action space**: add/rename/delete entity; add/rename/delete/retype field; add/modify endpoint; add relationship; add validation rule. Each op mutates the IR deterministically. The task sequence is a seeded draw over this space, with a controlled mix of **drift opportunities** (ops that modify or rename already-specified behavior) vs additive ops vs at least one behavior-preserving step — opportunity labels are recorded per task (drift velocity is measured per opportunity, not just per task).
- **NL renderer**: IR delta → natural-language change request (the task text the agent sees).
- **Programmatic black-box test generation** (no LLM): per-turn HTTP-level acceptance tests derived from the ground-truth IR. Hidden from the agent.
- **Per-turn ground truth**: the IR after each op is the harness's private ground truth.
- **The conventions layer (our differentiator — StaminaBench lacks this):** alongside the API schema, generate a normative conventions file (AGENTS.md-style: naming conventions, error-format rules, commands to run, structural rules) whose ground truth is also IR-tracked and also mutated by some change ops. Pure API-schema drift is the least novel channel; normative-content drift is where the interesting findings live.

**The inversion (key design decision):** in StaminaBench the harness owns the spec and refreshes it every turn. In E4, the **on-disk spec artifacts (OpenAPI file + conventions file) are the agent's responsibility** in all arms. Change requests arrive as NL. The harness's private ground-truth IR then makes the drift meter nearly free: diff(agent-maintained spec, ground-truth IR) + diff(code's observable surface, ground-truth IR). Zero human labeling.

## 6. Drift meter v1

- **Layer 1 (v1, per-task cadence): deterministic inventory diff.** Extract inventories (endpoints, entities, fields, commands, config keys, stated conventions) from (a) agent-maintained spec files, (b) the code's observable surface, and compare both against ground-truth IR. Classify each discrepancy: **contradiction** (same item, different value), **coverage gap** (in code/ground-truth, absent from spec), **stale claim** (in spec, absent from code/ground-truth).
- Meter code is **versioned and frozen per experiment run**; agents never see meter output; the oracle's acceptance tests are never the meter; the meter covers the whole surface, not only task-touched items.
- **Layer 2 (v2, do not build, do not preclude):** bidirectional fidelity-style probes (cf. arXiv 2605.17246) at T0/midpoint/T_N.
- Optional v1.5: run DOCER-style stale-reference checks if trivially integrable; otherwise defer.

## 7. Telemetry per task per arm

Hidden-test pass rate; **false-confidence events** — built on the estate's completion-claim mechanism, the L1 `done_literal` protocol (extend the block grammar if E4 needs richer claims; note the historical 79→13 gap metric was computed by the Python harness, not this parser); budget-exhaustion flag; tokens, turns, wall-clock, cost; spec-touch rate; drift-meter output (counts by classification, per artifact); noticing-probe answer; snapshot reference.

## 8. Feedback policy (floor-effect mitigation — this is load-bearing)

StaminaBench found all tested models fail within 5–6 sequential turns without feedback, and that feeding test failures back with retries improves passed-turn count by up to 12×. Implication for E4: a feedback-less control arm likely collapses from ordinary task failure before drift accumulates — a floor effect masquerading as H4. Policy: **all arms receive basic smoke feedback** (server starts, endpoints respond — "does it run"); **only Arm H receives acceptance-oracle feedback**. Retry policy configurable and identical across arms except for the oracle channel. Record enough to distinguish "failed task" from "drifted spec" in analysis.

## 9. Experimental discipline (carried over from the estate — keep it, plus one addition)

Within-task pairing across arms; seeded determinism end-to-end (substrate generation, task order, agent sampling where controllable) — `substrate_seed` (RNG) and `pairing_label` (identity) are separate fields in all E4 schemas *(Gate 0 per DISCOVERY C3)*; two model lineages supported by config; constants versioning per this repo's sealed-constants convention (new E4 lineage, never touching the E1 v1.0.0 seal); every run emits a **machine-readable manifest** (constants version, meter version, substrate seed, opportunity labels, arm, model, budget) sufficient to reproduce it — the public pre-registration gist will be generated from these manifests.

**Replay-validity requirement (new, motivated by §1's caveat):** every run retains patch text, full traces, and all artifacts needed to replay it. A run whose numbers cannot be replayed is classified non-replay-valid and excluded from headline claims. No E4 headline may ever rest on a non-replay-valid run.

## 10. Governance and estate rules

- **AGENTS.md amendment:** Phase 0 produces a *proposed* amendment (diff + rationale) establishing a new experiment boundary for E4 with its own condition vocabulary (arms 0/M/H permitted within E4 only), leaving E1/E2 freezes verbatim-intact. It is applied as its own commit, with rationale in the message, only upon human approval at the Phase-0 gate. The amendment commit is part of E4's provenance record.
- **`hit-sdd-bench-e2` is frozen for E4 purposes:** it stays at its recorded SHAs as the archive of the published E2 ablation and the home of live E3. It may be *read* as reference material (e.g., the `e3/` snapshot/resume pattern, the Claim-B/B1 enforcement finding); it is never modified, and E4 introduces no runtime or path dependencies on it.
- **E3 relationship:** E3 continues; the pause/parallel/replace decision is explicitly deferred to the Phase-2 gate, when E4's implementation footprint is known. Nothing in Phases 0–2 may constrain that decision.
- **Naming:** program slug E4 everywhere (paths `docs/e4/`, condition IDs, manifests, constants lineage). Public-facing name "HIT-SDD Bench — Drift Velocity". The string "E2" is never used for this program.

## 11. Scale targets (design for these, don't hardcode)

Pilot: 1 substrate config × 6 tasks × 3 arms × 2 seeds = 36 sequential runs on a Devstral-class model (order: a weekend, tens of dollars). Pilot go/no-go: (a) Arm 0 measurably drifts (H1 signal exists), (b) meter scores cleanly with zero false negatives on a known-drift fixture, (c) anything separates the arms. Full: ~2 substrate configs × 8 tasks × 3 arms × 3 seeds × 2 lineages ≈ 300 runs.

## 12. Non-goals for v1

Real-repo substrates (EvoClaw arXiv 2603.13428, rallly, SlopCodeBench arXiv 2603.24755) — v2; expose a **substrate provider interface** so they plug in later, nothing more. Fidelity probes — v2. The SWE-bench Live / Docker-oracle / contamination-and-flake machinery in `hit-sdd-bench-e2` — stays there (serves E3), not carried into E4 v1. Leaderboard / standing service — explicitly out. UI — out. Multi-agent — out.

## 13. Open design questions — each requires an ADR with a recommendation

1. **Generated-app stack.** Harness language is settled by the base choice: TypeScript/bun. The *generated target app's* stack remains open — recommend Python (simplest meter extractors) but decide with evidence; the black-box HTTP boundary makes the agent-side language theoretically free. If provider-routing patterns are needed, replicate `-e2`'s freeze-the-route idea inside this repo's preset system rather than porting Python code.
2. **Persistence of generated apps** (in-memory vs sqlite) — affects test determinism and task richness.
3. **Gate enforcement mechanics for Arm H**: how the harness verifies "scenarios exist and fail red" before accepting implementation. **Required input evidence:** the estate's Claim-B/B1 finding (frontier failure mode is done-claims over red/absent self-evidence; enforcement framing matters) and this repo's existing OpenSpec workflow integration as the custody/pinned-CLI pattern — not a candidate gate executor; the red/green gate is new machinery *(Gate 0 per DISCOVERY C4)*.
4. **Spec artifact formats on disk**: OpenAPI YAML + Markdown conventions file recommended; confirm extractability.
5. **Snapshot/resume strategy** for sequential state (git-based? directory copies?) including crash-resume mid-sequence. The `e3/` persistent-workspace pattern in `-e2` may be consulted as a design reference (read-only).
6. **Test transport**: HTTP against a running server (StaminaBench pattern) vs process-level CLI — recommend HTTP.
7. **How E1 and E4 coexist in this repo**: shared core vs E4 wrapper; module boundaries; how the E1 seal stays untouched.

## 14. Vocabulary (use consistently in code, docs, output)

"HIT-SDD Bench — Drift Velocity" / slug "E4"; "drift velocity"; "drift opportunity"; "freshness tax" / "drift tax"; "false-confidence event"; "self-verification gap"; arms "0 / M / H"; discrepancy classes "contradiction / coverage gap / stale claim".

## 15. References

`BASE-DECISION.md` (Phase −1 audit — estate map, port/discard lists, guardrail context). StaminaBench arXiv 2606.19613 (pattern source; CC BY-NC 4.0 — clean-room only). EvoClaw arXiv 2603.13428 (v2 real-repo substrate; MIT per secondary report — verify before use). SlopCodeBench arXiv 2603.24755 (measures "structural erosion / verbosity drift" — closest published cousin; differentiate in docs). Fidelity Probes arXiv 2605.17246 (Layer-2 meter design, v2). Context Rot / DOCER arXiv 2606.09090 (stale-reference checking, optional). All arXiv items are 2026 preprints — treat their numbers as unreplicated.
