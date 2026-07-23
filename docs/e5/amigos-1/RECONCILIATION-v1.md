# Amigos-1 reconciliation v1 — E5 Stage-1 prereg v2 → v3

Reconciliation session 2026-07-23, zero model spend. Inputs: the seven raw outputs at
archive commit `dc22172` (see `INGEST-NOTES-v1.md`), the v2 draft, the prompts kit, the
re-attack record, the fork verdict, AGENTS.md/CLAUDE.md. Method per
`docs/methodology/THREE-AMIGOS-DESIGN-REVIEW-v1.md`: findings deduplicated across
reviewers into ledger entries, convergent entries adjudicated first, every factual
premise existence-checked before it can support an ACCEPT, every insisted requirement
folded or declined on record, no verdict averaging.

Reviewer shorthand: **K** = Kimi 2.6 (Product), **S** = ChatGPT Sol 5.6 (Product),
**Q** = Qwen 3.8 (Dev), **G** = GLM 5.2 (Dev), **D** = DeepSeek 4 Pro (QA),
**F** = Fable 5 max (QA, same-family caveat), **M** = Gemini 3.1 Pro (QA).
Convergence class: **XR** = across-role, **WR** = within-role, **solo**.
Score: **ACCEPT** (changes v3) / **PARTIAL** (mitigated or recorded as accepted risk) /
**REJECT** (evidence or reasoning cited).

---

## 1. Existence-check results (premises reviewers relied on)

| Premise | Source | Verified? | Evidence |
|---|---|---|---|
| Hidden tests bind internal Python APIs | M (F2, [VERIFY]) | **Mostly false** | Local corpus clone (earlier commit `4d38d300`, structurally same test style as the pin; fork verdict item 7 corroborates "CLI tools, Python entrypoints"): 58/196 test files drive the program via `subprocess`/`pty` against the declared entrypoint (e.g. `pwd_manager/tests/conftest.py` resolves entrypoint argv and spawns it); only 6 import agent modules directly. The dominant referee interface is black-box CLI. Guardrail still adopted (A56) because step definitions are ours to author and the 6 import-style files need a QC flag. |
| Timeout leaves zero budget for the revise turn | M (F1, [VERIFY]) | **False as a necessity** | Budgets are per-CLI-invocation (upstream `step_limit`/`timeout` per agent run); the revise turn is a separate invocation. The draft's real defect is that it never *says* so — independently found by Q#2/#11. Fixed by specification (A18), not by making timeouts terminal. |
| `_setup_for_checkpoint` is a real injection point | Q ([VERIFY] 2) | **True** | Fork verdict item 5: `runner.py:645-662`, called per checkpoint before the agent session. |
| Upstream snapshots are full workspace copies (fresh-process revise turn feasible) | Q ([VERIFY] 5) | **True** | Fork verdict item 3: snapshot extracted to `<cp>/snapshot/`, MD5-checksummed tars + unified diffs; `session.finish_checkpoint` callable repeatedly. |
| Archive step rewrites accumulated scenario text in the workspace (both arms) | Q#5, G#8, D#7, M#10, F F6 | **True** | Recorded MODIFIED-replace behavior of the pinned `openspec` archive step (program record: archive replaces whole requirement blocks); the draft itself names the hazard (r19) but leaves the consequence undefined — the finding stands. |
| `pass_policy: any-case` forwards broken workspaces | Q#7 | **True** | Fork verdict ★4/item 1: `runner.py:689-716`; workspace persists across checkpoints untouched (item 6). |
| Corpus commit 2026-05-16; claude-fable-5 real, cutoff Jan 2026 | G ([VERIFY] 1) | **True** | Fork verdict header (scb-problems pin `ef6a9dd1`, last commit 2026-05-16); model + cutoff are current facts. r16 dating argument stands. |
| Ceiling-trigger arithmetic: P(fire·true 0.60) ≈ 0.32, P(miss·true 0.85) ≈ 0.11 | F (F5, [VERIFY]) | **True** | Recomputed exact binomial (n=8, ≥6): 0.315 and 0.105. |
| R2a chain-key table (≈0.45 pass at true 0.30) | (draft, leaned on by F F13) | **True** | Recomputed: P(≥3·8, 0.3) = 0.448. |
| Flaky golden test is an `interactive_session`-fixture test | D ([VERIFY] 2) | **True** | Fork verdict §4 (pwd_manager `test_edit_name_then_delete_secret`). |
| Claude Max rate-limit structure, sustained-scripted limits | Q ([VERIFY] 1/4), G#10 | **Unverifiable here** | Operational unknown, consistent with fork verdict item 11 ("seat-limit throttling … remains an operational unknown to shake down"). Treated as risk, not fact; feeds A26/A35. |
| Provider can change behavior under a pinned model ID | F (F20, [VERIFY]) | **Accepted assumption** | Not checkable from the repo; historically plausible; cost of the mitigation (spot-check) is near zero. |

No reviewer finding was rejected *solely* for an unverifiable premise unless the finding
depended on it (only M F1's specific fix did).

---

## 2. Findings ledger

Entries ranked convergent-first within each block. "§" = v2 section the entry lands on.

### Claim language and product value

- **A1 — Auto-scoped claim is a face-saving escape hatch / tautology wording.**
  Sources: K#1 (+IR-1), S#5, S#10. XR with the floor entry A46 (F F4, M#5). §1.4/§6.2.
  **ACCEPT.** v3: (a) the fallback wording "the tool keeps its literal promises on the
  checked surface" is replaced by S#10's formulation ("the supplied executable-feedback
  workflow reduced later failures of behaviors directly represented in its acceptance
  suite"); "the tool" is banned from causal conclusions; (b) K IR-1's scope-worthiness
  rule: an auto-scoped result may be presented as a positive finding only if the covered
  fraction < 0.90 AND the covered-slice effect ≥ 20 pp — otherwise it routes to the
  inconclusive/qualified publication path.
- **A2 — Bare "did not reduce" is indefensible at this power; §1.2 pre-commits to a
  metric that may be inoperative.** Sources: S#1 (+insisted 1), K#2. WR (Product). §1.4/§1.2.
  **ACCEPT.** v3: three pre-registered outcome classes (detected benefit / informative
  null whose CI excludes the minimum worthwhile effect / inconclusive), "did not detect"
  language for class 3; §1.2 names both primary forms with the freeze-of-N pointer.
- **A3 — The treatment is a bundle; decomposition labels are causal overreach.**
  Sources: S#2 (+insisted 2), S#4, F F17. XR. §1.1–1.4/§4/§13.2.
  **ACCEPT.** v3: canonical causal label ("the supplied executable acceptance-feedback
  workflow: maintained suite + on-demand runner + guaranteed completion-time run +
  result-bearing revise turn"); component-attribution prohibited; curve labels renamed
  descriptive (attempt-1 arm contrast / final post-revise arm contrast / post-hoc
  keep-best counterfactual); F F17's two wording pre-commits adopted (attempt-1-dominant
  gap ⇒ headline shifts to "supplied executable acceptance checks"; ritual-harm flag if
  C-final < C-attempt-1, symmetric note if it helped).
- **A4 — "Frontier tier" claims model-class generality; abort branches pre-marketed as
  findings.** Sources: S#3, S#9. WR (Product). §1.2/§10.3/§11.3.
  **ACCEPT.** v3: claims name the actual model + CLI config; max generalization "across
  the two tested agents"; abort-branch publications renamed narrowly (insufficient
  regression exposure / high observed self-verification activity / feedback channel not
  sufficiently actionable — all "under this profile").
- **A5 — Minimum worthwhile effect absent.** Source: S#6 (+insisted 3). Solo (Product).
  §6/§11/§14. **ACCEPT.** v3: MWE is a new named operator input (§14 input 10,
  recommended default 15 pp chain-level incidence), set independently of the power
  calculation, gating "worthwhile/product-validation" language only (not the scientific
  claim).
- **A6 — "Per dollar" headline is misleading under subscription funding.** Source: S#7.
  Solo (Product). §6.3. **ACCEPT.** v3: overhead vector (wall-clock, tokens/usage units,
  steps, runner executions, metered spend where real) replaces per-dollar as the
  headline cost row; value language requires the measured overhead attached.
- **A7 — New-pass guard (10 pp absolute) unanchored and gameable.**
  Sources: K#4, S#8, D#16, F F14. **XR — all three roles.** §6.2 criterion 3.
  **ACCEPT.** v3 merged rule: guard margin = min(10 pp absolute, 15% relative to the
  pilot-measured control new-pass rate), anchored at freeze-of-N (control-conditioned,
  §13.5(a)-legal, declared now); low-base-rate backstop (if C's confirmatory new-pass
  rate < 10%, additionally require T/C ≥ 0.5 per D#16); "without material loss" wording
  reserved for evidence supporting the margin (S#8), else the exact tradeoff is
  published; P(both) reported alongside any "better work" language.
- **A8 — Authored chains (30%) can carry the claim; provenance must gate it.**
  Sources: K#6 (+IR-2), D#11. XR. §6.2/§13.3.
  **ACCEPT (folded with A45).** v3: unscoped positive claim requires the native-only
  slice to be directionally treatment-favoring with point estimate ≥ half the full-sample
  effect (stability form per A45, replacing K's p < 0.20 which would re-import the
  subset-power trap); otherwise auto-scope to the combined sample with the native result
  reported first. Provenance split promoted to headline secondary (D#11).
- **A9 — Parent-paper anchoring.** Sources: S#11 ACCEPT; K#5 REJECT. Same object,
  opposite fixes — adjudicated: K#5 wants the power-at-parent-effect sentence deleted,
  but that sentence is the re-attack R3's *required* honesty disclosure; deleting it
  would un-fix an applied MAJOR. S#11's presentation prohibition (no shared axis/column/
  comparative sentence; every public mention states non-comparability) neutralizes the
  anchor without hiding the power fact. v3 adopts S#11; K#5 declined with this reasoning.
- **A10 — L2-escalation claim scoping.** Source: K#9. Solo. §10.3. **ACCEPT.** v3: an
  L2-exercised confirmatory claim is scoped to "on extended-format chains under this
  profile", never to the native corpus or SlopCodeBench generically (carried into the
  Stage-1b prereg requirement).
- **A11 — Mechanization rate m̂ is claim-relevant, not just planning.** Source: K#8.
  Solo. §6.3/§11.3. **ACCEPT.** v3: m̂ is a headline figure; at m̂ > 0.3 the write-up
  must state the estimand shift ("maintained suite vs agent-initiated ad-hoc
  verification, not vs none").
- **A12 — Practical-translation boilerplate.** Sources: K#3 (+IR-3), S#2 overlap. WR.
  §1.4. **ACCEPT.** v3: mandatory public-write-up paragraph (matched-ritual comparator,
  C1-vs-C-final as the ritual's own estimate, no transfer assumption to ritual-free
  workflows).
- **A14 — Codex attrition (quota exhaustion) can bias criterion 2.** Source: K#10.
  Solo. §6.2/§14-4. **ACCEPT (simplified).** v3: criterion 2 additionally "not
  evaluable" if < 6 of 8 codex chains complete replay-valid in both arms; kimi's
  6–7-pair stricter-Δ variant folded into that single rule (the discordance requirement
  already binds).
- **A16 — Cross-model legibility probe (rewrite 2 chains' prose with a non-Claude
  model).** Source: K#12. Solo, self-flagged speculative ([VERIFY] ×2). §16 O1.
  **REJECT (declined on record).** Reasons: corpus is the scarce resource and the probe
  burns admitted chains; a semantic-preserving rewrite is itself an unvalidated
  instrument (K's own [VERIFY] concedes this) and introduces a second uncontrolled
  content axis; direction of any legibility effect is unknown and symmetric across arms
  (both arms read the same prose — only step definitions differ, and those are code).
  O1 disclosure + the codex slice (different reader family) remain the containment.

### Build specification (Dev block)

- **A17 — Feedback content format is a phrase, not a spec.** Sources: Q#1, G#2
  (+insisted G-3/Q-1). **WR (Dev), both reviewers' top-two.** §2.3/§4.
  **ACCEPT.** v3: frozen feedback schema (fields `{scenario_id, step_index, step_text,
  expected_literal, actual_literal}`, one block per failing scenario, stated caps) +
  worked examples (single-assertion fail, fail-at-step-k, all-pass) as a normative
  appendix; formatter code hashed into the freeze; rung-2 validates against the frozen
  template; leak direction (too-verbose = covert stack trace) named as what the
  parity/leak list checks.
- **A18 — Revise-turn session mechanics, budget, and timeout/kill semantics
  unspecified.** Sources: Q#2, Q#11, G#12, M#1. **XR (Dev+QA).** §4/§12.4.
  **ACCEPT.** v3: revise turn = fresh CLI invocation on the attempt-1 workspace (files
  only, no conversation history), fresh identical budget, exact invocation recorded;
  kill = SIGTERM + ≥30 s grace then SIGKILL; timeout-killed snapshots get a parse/
  consistency check (syntax-broken ⇒ recorded annotation, D#10 sub-decomposition).
  M#1's fix (timeout terminal, skip revise) **rejected as-stated**: it rests on the
  shared-budget premise (existence-checked false as a necessity, §1) and would delete
  the r21 timeout-parity rule; the specification fix resolves the actual impossibility.
- **A19 — Runner interface/discovery + T-delta allowlist never enumerated.**
  Sources: Q#3, G#7. WR (Dev). §2.3/§2.4. **ACCEPT.** v3: exact runner command,
  workspace location, byte-frozen discovery instruction in T's prompt; normative
  T-delta allowlist enumerated (feature files, step-def files, runner script + docs
  block, completion-time output injection); everything else byte-identical.
- **A20 — Coverage-map algorithm is an invented-by-builder artifact with claim power.**
  Sources: Q#4, G#6, D#3, F F3 (+G2). **XR, 4 reviewers.** §3.2/§6.2.
  **ACCEPT.** v3: frozen matching script with stated algorithm; ambiguity defaults to
  *uncovered* (conservative against the unscoped claim); audit budget concentrated
  where the decision lives — 100% human audit of upstream checks labeled *uncovered*
  (F F3; the r22 uniform sample stays for covered labels); per-check labels published;
  confirmatory backstop (D#3): any covered check disagreeing with its mapped scenario
  across > 1 confirmatory chain is treated as mislabeled ⇒ recomputed split published,
  claim takes the weaker reading.
- **A21 — Archive-step drift: consequence undefined; frozen reference must be
  accumulated-active.** Sources: Q#5, G#8, D#7, M#10, F F6. **XR, 5 reviewers — the
  panel's widest convergence.** §2.2/§2.3/§5.
  **ACCEPT.** v3: (a) frozen catalog holds per-checkpoint **accumulated-active**
  scenario sets (F F6), so genuine supersessions are not "drift"; (b) post-archive
  workspace scenario text is hashed **in both arms** at every transition against the
  accumulated-active reference (G#8); (c) any divergence ⇒ checkpoint flagged
  `spec_integrity`; if the divergence touches scenario semantics the chain is excluded
  from the primary with counts published (D#7's clean break), and drift that breaks
  Gherkin parsing is an infrastructure failure, never a behavioral event (M#10);
  (d) rung 2 must demonstrate zero drift on its 4 chains or the wrapper is fixed before
  rung 3; (e) rung-2 three-way assert: runner's executed set == frozen accumulated-active
  set == lifecycle metadata's active set (F F6).
- **A22 — Chain-broken (syntax/import) events conflated with behavioral regressions.**
  Sources: M#3 (+guardrail 2), D#4, K#11, D#10. **XR, 3 roles.**  §5/§6.1.
  **PARTIAL.** Kept: chain-broken snapshots continue to fail all active checks in the
  ITT primary — a shipped non-running program does break every promise it made; the
  rule is symmetric across arms and is the construct under test. Folded: the event-type
  decomposition (chain-broken vs behavioral) becomes a **required headline co-report**
  with every claim (win or null); the behavioral-only ★ sensitivity stays claim-relevant
  under the weaker-reading rule; per-arm chain-broken rates + eligible-check exposure
  published (D#4); if the arms' chain-broken rates differ by > 5 pp, claim language must
  present the behavioral-only estimate co-equally with the primary (K#11's "preferred
  estimate", weakened to co-equal because pre-committing to prefer a sensitivity over
  the frozen primary would be its own degree of freedom); timeout-induced breakage
  separately decomposed (D#10). M's event-level exclusion **declined**: it would change
  the estimand from promise-keeping to logic-preservation-conditional-on-runnability,
  and asymmetrically forgive whichever arm ships broken code more often. This is an
  explicit strong-justification rejection of one across-role variant, with the
  convergent core (don't let the conflation hide) fully folded.
- **A23 — Broken-state carry-forward semantics.** Source: Q#7. Solo. §5.
  **ACCEPT.** v3: agent at k receives the workspace as left by k−1; `chain_broken`
  annotates the breaking checkpoint and all subsequent ones; the ★ sensitivity excludes
  events at-and-after the break.
- **A24 — Interactive-class membership is judgment with no criterion.**
  Sources: Q#8, G#9, D#5. **XR (Dev+QA).** §7. **ACCEPT.** v3 mechanical rule: class =
  (a) `interactive_session` fixture, OR (b) test body/imported helpers use
  `time.sleep`/`select`/`poll`/`asyncio.sleep`/subprocess-with-timeout/pty/socket
  timing primitives, OR (c) any status change in QC screening (automatic inclusion);
  criteria published, not just the list; authored/L2 tests classified by the same rule;
  post-run retro flake inventory (every check that ever flipped across any snapshot's
  re-evaluations) published (D#5) and flip-count fed to the GLMM as diagnostic (D#12 =
  A41).
- **A25 — Lifecycle/supersession metadata: no rubric, no freeze timing, gameable.**
  Sources: G#3, D#13, M#6 (+guardrail 3). **XR (Dev+QA).** §5.
  **ACCEPT.** v3: operational rubric (supersession only if (a) the spec explicitly
  deprecates prior behavior, or (b) golden-k contradicts golden-j on the same input);
  per-decision recorded rationale; a QC test that every retired check indeed fails on
  golden-k (G#3); lifecycle metadata hashed and frozen **before any both-arms run**
  with zero post-hoc reclassification (M#6); audited sample with published disagreement
  rate and a conservative-lifecycle sensitivity if > 10% questionable (D#13).
- **A26 — Authoring pipeline + schedule absent; likely doesn't close for one
  operator.** Sources: Q#9 (+insisted 3), G#4, G#14 (+insisted 1). **WR (Dev), both
  reviewers' insisted list.** §15/§14.
  **ACCEPT.** v3: §15 item 10 "Authoring pipeline" — per-checkpoint and per-authored-
  chain estimates (reviewers' 30–60 min/checkpoint and 4–8 h/chain figures carried as
  planning estimates to be validated on 2–3 checkpoints before committing to N = 33),
  session-management protocol, per-checkpoint quality gate (step defs fail on B(n),
  pass on golden-n — reusing the §8 screen), and a pre-declared re-scope trigger
  (authoring/QC not done by the operator-set calendar date ⇒ N drops to 23 native-only,
  MDE ≈ 40 pp) as a new §14 input.
- **A27 — Manifest schema + mechanical completeness check.** Source: Q#10 (+insisted 2).
  Solo (Dev). §12.5/§15. **ACCEPT.** v3: frozen manifest schema; completeness-check
  script runs at end of every run, result recorded in the manifest, script hash in the
  freeze.
- **A28 — Step-definition authoring protocol + line-audit procedure.**
  Sources: Q#12, G#1 (G's top finding). WR (Dev). §3.3.
  **ACCEPT.** v3: authoring guide frozen as an artifact (one step ⇒ one step-def
  function; assertion implements the clause's literal semantic content, no extra
  normalization/tolerance; matching strategy stated per clause class); line-audit as a
  per-step recorded checklist in the freeze manifest.
- **A29 — Tamper default consequence.** Source: Q#13. Solo. §12.6. **ACCEPT.** v3:
  tampered checkpoints stay in the ITT primary; mechanism measures computed on the
  non-tampered subset with subset size reported; the ★ sensitivity excludes them.
- **A30 — Authored-chain firewall is weaker (no pre-existing hidden tests) and
  authoring order must be pinned.** Sources: Q#14, M#4 overlap. XR. §3.3/§8.
  **ACCEPT.** v3: authored-chain order protocol (prose spec first+frozen → scenarios
  session → hidden-test session → probe session), with the honest statement that for
  authored chains the firewall is weaker than for native chains; limitation attached to
  the provenance sensitivity.
- **A31 — R13 localization check is theater as specified.** Sources: F F9, D#20, K#7.
  **XR, 3 roles.** §10.1. **ACCEPT.** v3: seeded mutants on golden solutions across ≥ 3
  archetypes (wrong value / missing behavior / cross-scenario interaction), ≥ 5 induced
  failures (or all if fewer), selection rule frozen before rung 2, numeric bar ≥ 4/5
  localized with a stated rubric; any archetype at 0 binds the §1.4 null scoping;
  failure consequence pre-stated (K#7): feedback content is NOT enriched post-hoc — the
  null-scoping strengthens and the rung-2 result publishes as a mechanism finding.
- **A32 — Freeze-of-N needs a mechanical guard; analysis code needs to be in the
  seal.** Sources: G#5 (+insisted 2), F F12 (+G1c). WR-ish (Dev+QA, same object).
  §11.4/§13.5/§12.5. **ACCEPT.** v3: freeze-of-N implemented as an executable script
  (rung-1 outputs + pre-freeze manifest → post-freeze manifest) with a diff-guard test
  restricting changes to the allowed fields; analysis-implementation hash enters the
  freeze manifest; any post-outcome change to it ⇒ logged changelist + dual reporting
  under the weaker-reading rule.
- **A33 — Mechanization-extraction patterns unspecified.** Source: G#13. Solo. §6.3.
  **ACCEPT.** v3: extraction script built against real rung-1 trajectories and frozen
  at freeze-of-N (control-conditioned), patterns published in the manifest.
- **A34 — GLMM under-specified.** Source: G#15. Solo. §13.1. **ACCEPT.** v3: software +
  formula (`event ~ arm + checkpoint_index + (1|chain)`) + convergence diagnostics
  named; synthetic-recovery validation test; non-convergence reported, never silently
  dropped.
- **A35 — Pair gap / rate-limit asymmetry: logged with no rule.**
  Sources: G#10, Q#15, F F18. **XR (Dev+QA).** §12.1/§12.7.
  **ACCEPT.** v3: max intra-pair gap stated (flag > 2 h; > 24 h ⇒ pair excluded per the
  pair-symmetric rule A42); order×arm correlation check at the validity review (Q#15);
  pre-stated asymmetric-backoff threshold routing the pair into a ★ sensitivity
  (F F18); rung-2 asserts whether backoff consumes step budget.

### QA / statistics block

- **A36 — Binding-vs-referee agreement is only ever measured on shakedown chains.**
  Source: D#1 (+guardrail 1). Solo (QA) but D's top finding. §3.3/§10.1.
  **ACCEPT.** v3: descriptive agreement recomputed on ALL confirmatory graded snapshots
  (covered checks), reported with results; confirmatory agreement < 0.85 ⇒ claim
  downgraded to qualified; feeds the A20 mislabel backstop.
- **A37 — T's runner overhead can starve implementation and manufacture a null.**
  Source: D#2 (+guardrail 2). Solo (QA). §2.4/§4. **ACCEPT.** v3: suite-execution
  budget share measured from trajectories; ★ sensitivity excluding checkpoint-pairs
  where T's execution overhead exceeded a threshold set at freeze-of-N from shakedown
  telemetry; weaker-reading rule binds.
- **A38 — Pilot n=8 anchors freeze-of-N with large sampling error.** Source: D#6.
  Solo (QA). §11.4. **ACCEPT.** v3: freeze-of-N recomputes power at the lower 80%
  confidence bound of the pilot rate; bound < 0.25 ⇒ "low-signal regime" declared and
  the claim scoped "under the observed base-rate estimate" with the bound published.
- **A39 — Uncovered-slice rule satisfiable by NOT implementing uncovered features.**
  Source: D#8 (+guardrail 3). Solo (QA). §6.2. **ACCEPT.** v3: criterion 1b additionally
  requires T's pass rate on uncovered new-requirement checks at their own checkpoint to
  be within 10 pp of C's (mirroring the guard); otherwise auto-scope.
- **A40 — Codex account-auth undermines replay claims.** Source: D#9. Solo (QA).
  §12.3/§12.5. **ACCEPT.** v3: codex account-auth runs classified
  `replayable_with_operator_attestation`, never full replay-valid; primary claim never
  depends on their replayability (they were already outside the primary per R8).
- **A42 — No pair-symmetric exclusion discipline; artifact-size failures can bias.**
  Sources: F F7 (+G1b), D#14. WR (QA). §5/§12.5. **ACCEPT.** v3: any unit excluded for
  infra/replay reasons in either arm is excluded from the paired primary in both arms;
  per-arm exclusion counts published; > 10% of pairs affected ⇒ integrity flag on the
  whole result; artifact-size bound stated and storage failures treated as
  infrastructure events pair-symmetrically.
- **A43 — Memoprobe "or explicitly justify" escape.** Source: D#15. Solo (QA). §8.
  **ACCEPT.** v3: escape removed — any roster model with cutoff post-dating the corpus
  ⇒ full-corpus probe mandatory; if not run, that model's claims auto-scope to
  "under models with training cutoff before the corpus date".
- **A44 — Event multiplicity undefined for the event-count primary.** Source: F F1
  (+G1a). Solo (QA, novel — full weight; no draft echo). §5/§11.4. **ACCEPT.** v3:
  adjacent-transition convention (event at k iff passed on the final graded snapshot at
  k−1 and fails at k; re-arm only after re-passing); chain-broken checkpoints contribute
  at most one composite event per check; pinned before freeze.
- **A45 — Weaker-reading "p crosses α" contradicts the stated MDE on strict subsets.**
  Source: F F2. Solo (QA, novel arithmetic — full weight). §6.2/§13.3/§11.2.
  **ACCEPT.** v3: for strict-subset sensitivities, material disagreement = sign flip or
  point estimate shrinking below half the full-sample effect; α-crossing reserved for
  same-N sensitivities; §11.2 amended to state the unqualified-claim MDE honestly.
- **A46 — Uncovered-slice ≥1-event floor is the vacuity R11 was written to kill.**
  Sources: F F4 (+G2b), M#5, with K#1/S#5 pressing the same hole from Product.
  **XR, 4 reviewers; F+M = full-weight non-Anthropic-inclusive QA convergence.** §6.2.
  **ACCEPT.** v3 floor: ≥ 3 uncovered events across arms contributed by ≥ 2 distinct
  chains, else auto-scope. M's ≥ 10-event-opportunities variant declined in favor of
  3/2: the uncovered slice is small by construction and a 10-event floor would make the
  unscoped claim unreachable at N = 33 — which would be a silent redefinition of the
  study's best case rather than a floor; counts are published either way and A1's
  scope-worthiness rule bounds the covered-only fallback.
- **A47 — Ceiling branch has no operating characteristics; binary hostile to long
  chains near the threshold.** Sources: F F5, M#9. **WR (QA), Fable+Gemini —
  full-weight non-Anthropic-inclusive convergence.** §11.4/§6.1.
  **ACCEPT/PARTIAL.** v3: ceiling error table published (fire ≈ 0.32 at true 0.60;
  miss ≈ 0.11 at true 0.85 — verified arithmetic) with the ~1/3 figure accepted on
  record; PLUS a pre-declared saturation-fragility election: if at freeze-of-N the
  recomputed power of the binary primary at N_max under the measured p̂_C (and its A38
  lower bound) is < 0.5 for the design MDE, the event-count primary may be elected —
  control-conditioned, declared now, §13.5(a)-legal. M's "lower threshold to 0.50 /
  make event-count the global primary" declined as-stated: it would replace the twice-
  reviewed primary rather than amend a rule, and the election mechanism reaches the
  same protection without discarding the binary where it is well-behaved.
- **A48 — Parity validator is pre-flight; the risks are mid-run.** Source: F F8 (+G3a).
  Solo (QA). §2.4/§15-6. **ACCEPT.** v3: validator dry-renders ALL checkpoints
  pre-flight; runtime per-checkpoint cross-arm scenario-text hash assert (modulo
  T-delta); divergence = validity flag on the pair. (Merges with A21's both-arms
  post-archive hash.)
- **A49 — Scenario-ization choice and probe proximity are unfrozen experimenter
  choices.** Source: F F10. Solo (QA). §3.1/§3.3. **ACCEPT (partial).** v3:
  pre-registered scenario-selection rule (every top-level acceptance criterion of each
  checkpoint spec is scenario-ized; exclusions listed with reasons); per-probe
  nearest-scenario note published; residual proximity risk recorded in the accepted-risk
  register with direction unassessed.
- **A50 — Referee invisibility asserted, never tested.** Source: F F11 (+G3b).
  Solo (QA). §10.1. **ACCEPT.** v3: rung-2 in-container scan (referee markers, golden
  content, frozen catalog path) from inside each arm's running container; must be
  empty; result in the manifest.
- **A51 — Transition key + joint gate have no operating characteristics.**
  Source: F F13. Solo (QA). §9. **PARTIAL.** v3: stated honestly that the joint gate's
  characteristics depend on unmodeled chain–transition correlation; the operator
  ratifies the transition key as unquantified (R2c-style, on record) or drops to
  chain-key-only with the R2a table as ratified noise. Full modeling declined: no
  defensible correlation prior exists pre-pilot, and inventing one would be
  pseudo-precision; the gate is conservative in the direction of aborting.
- **A52 — Exposure-normalized hazard conditions on post-treatment variable;
  "separates" overclaims.** Source: F F15. Solo (QA). §6.3/§11.2. **ACCEPT.** v3:
  reworded as descriptive; both estimators' biases named (binary conservative against
  T; hazard post-treatment-conditioned, direction unknown); interpretation
  triangulates, neither adjudicates.
- **A53 — Codex-slice draw undefined.** Source: F F16. Solo (QA). §14-3. **ACCEPT.**
  v3: seeded random draw, stratified by chain length, seed derived from the freeze
  commit.
- **A54 — Visible completion-time run has no repetition policy; agent-code flakiness
  unscreened.** Source: F F19. Solo (QA). §7/§4. **ACCEPT.** v3: visible completion-
  time run is single-execution by declared policy (disclosed noise) EXCEPT the
  enumerated interactive class, which is majority-vote 2/3 visibly too; visible-vs-
  referee verdict flips on covered checks logged in-run as a live extension of the R6
  statistic.
- **A55 — Floor-gate validity decays across composition and calendar time.**
  Source: F F20. Solo (QA). §9/§11.4. **ACCEPT.** v3: gate language scoped to native
  chains explicitly; freshness rule — if rung 3 starts > 4 weeks after rung 1, a
  2-chain subscription-only control spot-check precedes treatment spend.
- **A56 — Step definitions must not leak API structure beyond the public surface.**
  Source: M#2 (+guardrail 1). Solo (QA). §2.3/§3.3. **ACCEPT (premise corrected).**
  Existence check (§1): the corpus's dominant referee interface is already black-box
  CLI (58/196 subprocess-driven files vs 6 import-style). v3: step definitions bind
  ONLY the public CLI/entrypoint surface stated in the spec; QC flags any hidden check
  that asserts import-level internals and verifies the required surface is spec-stated,
  else the check is excluded as non-public (counts published).
- **A57 — Solo-operator firewall is theater against human memory.** Source: M#4.
  Solo (QA). §3.3/§16-O1. **PARTIAL.** The draft already states the firewall "contains
  the channel, it does not create author independence" — M's demand is largely met; v3
  strengthens O1 to name human-memory carryover explicitly as unmitigable in a
  one-operator program. No mechanism change (none exists to adopt).
- **A58 — "Structural absence" must not mean a nerfed environment for C.** Source: M#7.
  Solo (QA). §2.3. **ACCEPT (clarification).** v3: identical agent container image in
  both arms, including any pre-installed tooling; structural absence = no supplied
  test artifacts/runner/instruction, never removed dependencies; C may install or
  author anything it chooses (ITT).
- **A59 — C's forced revise turn may harm control (sycophantic self-revision).**
  Source: M#8. Solo (QA). §4/§16-O6. **PARTIAL.** Already the TDAD caveat + O6 + the
  A3/F17 ritual-harm flag; v3 adds one sentence to §4 naming the estimand as "informed
  vs blind instructed revision" in the mechanism discussion. M's own text concedes
  accepted-risk status.
- **A60 — DeepSeek self-answered probes (#17 C self-tooling, #18 gate conservatism,
  #19 deleted-code collection).** Source: D. **NOTED — no change**; recorded as
  clarity evidence (the plan's stated machinery answered the attacks in the reviewer's
  own reading).
- **A41 — Residual-flake diagnostics.** Source: D#12 (merged into A24's retro
  inventory + GLMM flip-count covariate). **ACCEPT** (folded).
- **A13/A15 — subsumed** into A31 and A22 respectively (kept as cross-references).

---

## 3. Insisted-requirements table (fold or decline — no silent drops)

| Reviewer | Insisted requirement | Disposition |
|---|---|---|
| K IR-1 | Scope-worthiness threshold for auto-scoped claims (covered fraction < 0.90 AND covered effect ≥ 20 pp) | **Folded** (A1; v3 §6.2) |
| K IR-2 | Provenance-gated claim rule (native-only same-sign, p < 0.20) | **Folded, modified** (A8): same-sign + ≥ half-magnitude stability form replaces p < 0.20, which would re-import the subset-power trap A45 fixes; reason on record |
| K IR-3 | Mandatory practical-translation boilerplate | **Folded** (A12; v3 §1.4) |
| S 1 | Three-way result/claim tree; bare "did not reduce" removed | **Folded** (A2; v3 §1.2/§1.4) |
| S 2 | Bundled-treatment naming; component-attribution prohibited; descriptive decomposition labels | **Folded** (A3; v3 §1/§4/§13.2) |
| S 3 | Minimum worthwhile effect + tradeoff/overhead disclosure in headline evidence | **Folded** (A5/A6/A7; v3 §6.2/§6.3/§14-10) |
| Q 1 | Freeze feedback template + revise-turn mechanics + T-delta tree as normative appendices | **Folded** (A17/A18/A19; v3 §4a appendix) |
| Q 2 | Manifest schema + mechanical completeness check | **Folded** (A27; v3 §12.5) |
| Q 3 | Operator-week estimate + authoring re-scope trigger | **Folded** (A26; v3 §15-10/§14-11) |
| G 1 | Authoring pipeline as scoped workstream with estimates, session protocol, quality gates; N=23 fallback stated | **Folded** (A26; N=23 stated as the pre-declared re-scope target — kept as fallback rather than default, reason: the §14 default remains an operator decision and the MDE consequence is stated either way) |
| G 2 | Freeze-of-N as executable script with diff-guard | **Folded** (A32; v3 §11.4) |
| G 3 | Feedback schema + step-def authoring protocol frozen as artifacts | **Folded** (A17/A28; v3 §2.3/§3.3) |
| D G1 | Confirmatory-wide agreement analysis with < 0.85 downgrade | **Folded** (A36; v3 §3.3/§13.2) |
| D G2 | T runner-overhead accounting + starvation sensitivity | **Folded** (A37; v3 §6.3/§13.3) |
| D G3 | Uncovered-slice avoidance guard | **Folded** (A39; v3 §6.2) |
| F G1 | Metric-integrity seal (event multiplicity; pair-symmetric exclusions; analysis-code hash) | **Folded** (A44/A42/A32; v3 §5/§12.5/§13.5) |
| F G2 | Uncovered-slice integrity package (100% uncovered audit; ≥3-events/≥2-chains floor) | **Folded** (A20/A46; v3 §3.2/§6.2) |
| F G3 | Tested-not-asserted isolation/parity (dry-render + runtime cross-arm hash; in-container invisibility probe) | **Folded** (A48/A50; v3 §10.1 rung-2 list) |
| M 1 | API firewall: step defs bind public CLI surface only | **Folded** (A56; v3 §3.3) |
| M 2 | Syntax-error exclusion from behavioral regression count | **Partially folded** (A22): split tracked and co-reported at headline level, behavioral-only ★ sensitivity claim-relevant; full event-level exclusion **declined** — it changes the promise-keeping estimand and forgives shipped-broken code asymmetrically; reasons on record |
| M 3 | Lifecycle metadata hash-frozen before any both-arms run, zero post-hoc reclassification | **Folded** (A25; v3 §5) |

## 4. Verdict tally and structural-branch determination

Kimi: fix first · Sol: fix first · Qwen: fix first · GLM: fix first · DeepSeek: fix
first · Fable: fix first · Gemini: fix first. **Zero "structural concern" verdicts.**

Structural-branch test (methodology §, reconciliation brief): fires only if ≥ 2
reviewers — or any two from different roles — raise the same concern that *invalidates
the estimand, referee architecture, or staging* rather than amending a rule. The widest
convergences (A21 archive drift — 5 reviewers; A20 coverage map — 4; A46 uncovered
floor — 4; A7 guard — 4) are all rule/specification amendments the reviewers themselves
frame as fix-before-freeze. Gemini's single "(Structural)" label sat on a finding whose
premise failed verification and whose repair is a specification sentence (A18). **The
structural branch does not fire; v3 is authored as the freeze candidate.**

## 5. Reviewer-vs-reviewer adjudications (genuine disagreements)

1. **K#5 vs S#11 vs re-attack R3 (parent-effect power sentence).** K wants it deleted
   (anchoring); R3 required it (honesty). Ruling: honesty requirement wins; S#11's
   presentation prohibition neutralizes the anchoring channel. K#5 declined.
2. **M#1 vs r21 (timeout ⇒ terminal vs timeout-parity revise turn).** M's fix
   contradicts the draft's timeout-parity rule and rests on a falsified premise.
   Ruling: specify the budget model (fresh per-attempt budget) — the "impossibility"
   dissolves; r21 stands. (A18)
3. **M#3/M-G2 vs the promise-keeping construct (chain-broken exclusion).** Ruling: the
   construct keeps chain-broken events in the primary; the interpretive risk is handled
   by mandatory decomposition co-reporting + the ★ sensitivity + the > 5 pp co-equal
   rule. Declining part of an across-role convergence is recorded with this
   justification. (A22)
4. **M#9 (event-count as global primary / ceiling 0.50) vs F F5 (error table +
   corroboration).** Ruling: F's transparency fix plus a pre-declared control-
   conditioned saturation election reaches M's protection without replacing the
   twice-reviewed primary. (A47)
5. **M#5 (≥ 10 uncovered event-opportunities) vs F F4 (≥ 3 events / ≥ 2 chains).**
   Ruling: 3/2 adopted — the tighter floor would make the unscoped claim structurally
   unreachable at this N, silently redefining the study's best case. (A46)
6. **K IR-2 (native p < 0.20) vs F F2 (subset α-crossing is a power trap).** Ruling:
   stability-form gate (same sign, ≥ half magnitude) satisfies both intents. (A8/A45)

## 6. Honest-scope note

External reviewers had no code or repo access; every factual premise their findings
relied on was existence-checked here before adoption (§1), and two premises were
corrected. Convergence — within-role, across-role, and across model families — is the
load-bearing signal, per the methodology; the deepest convergences (archive-step drift
consequence, coverage-map construction, the uncovered-slice floor, the new-pass guard)
drove the largest v3 changes. Fable-5 findings were weight-checked under the
same-family caveat: its highest-impact entries either introduced novel verified
arithmetic (F1/F2/F5) or converged with DeepSeek/Gemini (F3/F4/F6/F18), restoring full
weight under the stated rule. This reconciliation changes no run classification, makes
no claim, authorizes no spend; v3 remains a DRAFT freeze candidate until the operator
ratifies §14 and seals it.
