# Breakage-vs-scale deep research — main-loop verification + synthesis v1

Verified 2026-07-22 in the main loop (falsification-framed) against the two operator-run
reports archived in this directory. Method: every arXiv ID batch-resolved via the arXiv API
(existence + title, "L1"); the most load-bearing quantitative claims checked against the
live abstract or page ("L2"); numbers that live only in paper bodies/figures are marked
UNVERIFIED and must not be quoted as established. Zero spend (web reads only).

## 1. Verification results

### Report 1 ("claude") — 17/17 citations exist; most headline numbers verify

| Source | Exists | Load-bearing numbers | Verdict |
|---|---|---|---|
| TDAD, arXiv:2603.17973 | YES | 6.08%→1.82% (−70%) regression w/ test-context feedback; naive TDD prompting WORSENS to 9.94% — **verbatim in abstract** | **VERIFIED (L2)**; the 562/155 failure counts + 30.2% instance rate are body-level, unverified |
| SWE-Milestone, arXiv:2603.13428 | YES | ">80% on isolated tasks to 38.03% in continuous settings", 12 frontier models × 4 frameworks — **verbatim** | **VERIFIED (L2)**; "~13% of milestones" not in abstract |
| PatchDiff, arXiv:2503.15223 | YES | 29.6% behavioral divergence, 28.6% certainly-incorrect, +6.2pp inflation, 7.8% pass-while-failing-dev-suite — **all verbatim** | **VERIFIED (L2)** |
| METR note (metr.org, 2026-03-10) | YES | 296 PRs, 4 maintainers, 3 repos, ~24pp gap, ~50% adjusted vs 68% golden baseline — **all confirmed on page** | **VERIFIED (L2)** |
| SlopCodeBench, arXiv:2603.24755 | YES | Live abstract says **36 problems / 196 checkpoints / best agent 14.8% / erosion 77% / verbosity 75.5% / 2.3×** — report said 20/93/17.2%/80%/89.8%/2.2× | **EXISTS; report's numbers WRONG** (older version or confabulation). Direction + "quality guidance does not affect degradation rates" confirmed. Use abstract numbers only |
| SWE-CI, arXiv:2603.03823 | YES | 100 tasks / avg 233 days / 71 commits — **verbatim**; zero-regression <0.25 and 12/20 iteration correlation are figure-level | PARTIAL (L2 setup; regression decimals UNVERIFIED — report itself flagged this) |
| TensorBench, arXiv:2606.05570 | YES | Per-model regression %s (16.1–36.7) **not in abstract** | L1 only; regression figures UNVERIFIED |
| FeatBench, arXiv:2509.22237 | YES | "aggressive implementation … 'scope creep' and widespread regressions where agents break existing features by diverging from the user's explicit intent" — **verbatim**; highest resolved 29.94% | **VERIFIED (L2)** for the failure-mode claim; the 60–70%→10–30% size gradient is body-level, UNVERIFIED |
| AgentLens 2605.12925, SWE-EVO 2512.18470, EvoCode-Bench 2605.24110, SWE-INTERACT 2606.30573, MobileDev-Bench 2603.24946, SWE-IF 2510.07315, SEQUOR 2605.06353, METR horizon 2503.14499, Lost-in-the-Middle 2307.03172, Eval-SW-Agents 2410.12468 | ALL YES | specific figures not individually checked | L1 (existence + on-topic titles) |
| GitClear / Devin vendor reports | not re-checked | — | Non-load-bearing; already vendor-flagged in the report |

### Report 2 ("qwen") — one real gem; sweeping negative conclusion is FALSE

- Its single quantitative citation **is real and neither report 1 nor our prior-art file had
  it**: **"Regression Accumulation in Multi-Turn LLM Programming Conversations",
  arXiv:2607.01855 (posted 2026-07-02)**. Verified against the abstract: 542 tasks
  (HumanEval+/MBPP+) × 8-turn requirement-evolution chains × 6 models = 26,016 turn
  instances; **"40% to 73% of tasks lose previously correct behavior over the full
  conversation"**; main failure class = Cross-Turn Conflict; and a **"Verification Gate"
  (check new code against prior tests + rollback/retry) is "the only strategy that
  consistently improves all models"** (final-turn quality 75.8%→87.9% DeepSeek-V3,
  31.6%→47.3% Llama-3.1-8B). **VERIFIED (L2).**
- Its headline conclusion ("axes b and c essentially unmeasured; the field has yet to
  produce controlled experiments") is **contradicted by the verified papers above**
  (SWE-Milestone, SlopCodeBench, SWE-CI, TDAD all measure exactly that). The report
  searched a much narrower pool. Its axis-(a) vacuum conclusion, however, **agrees with
  report 1 and survives verification**.

## 2. Synthesis (what is now established, at the level we verified it)

1. **AI agents breaking previously-working behavior is a real, measured, large phenomenon**
   — not a conjecture from complaints. Verified anchors: ~30% of "solved" benchmark patches
   behaviorally diverge from intent (PatchDiff); 40–73% of multi-turn toy tasks lose
   previously-correct behavior over 8 turns (2607.01855); frontier-model scores collapse
   >80%→38.03% from isolated to continuous settings (SWE-Milestone, 12 frontier models);
   quality erosion in ~77% of long-horizon trajectories with prompting unable to change the
   degradation *rate* (SlopCodeBench abstract).
2. **Our old ~3% base rate was a scale artifact.** The operator's conjecture stands: the
   literature's regimes (bigger behavior surfaces, longer sequences, repo-level scope)
   produce breakage rates one order of magnitude higher than our tiny-surface, short-horizon
   setups. The complaints and our null were both right — in different regimes.
3. **The sequence axis (b) is well-trodden; do not position novelty there.** Use it instead
   to justify design choices (horizon length, expected effect sizes).
4. **The promise-density axis (a) is the confirmed open gap** — both reports independently,
   and nothing in verification contradicts it: no study measures breakage as a function of
   the *number of established behaviors that must stay true*. That is the ladder's novel
   axis.
5. **The causal claim has direct prior art at toy scale — this changes our novelty
   positioning.** 2607.01855's Verification Gate IS executable-check feedback with
   rollback, shown to be the only consistently effective mitigation — but on function-level
   toy chains with sub-frontier models. TDAD shows test-context feedback cutting regressions
   70% — and, crucially, **procedural TDD instructions without executable context made
   things WORSE** (9.94% vs 6.08%), which independently corroborates our own earlier
   mechanism finding that *executability*, not test-flavored prose, is the active
   ingredient. Our experiment would therefore NOT be first to show "executable checks
   reduce multi-turn breakage" in general. The defensible novel claims are the
   conjunction: **frontier-tier agents + realistic spec-driven workflow (accumulating
   prose specs vs executable acceptance checks) + repo-level working system + the
   promise-density axis + spec-divergence (built-different-from-spec) counted as breakage**
   — FeatBench certifies that failure mode exists ("diverging from the user's explicit
   intent") but nobody causally tests feedback against it.
6. **Frontier tier does not escape the phenomenon** (SWE-Milestone's 12 frontier models,
   2026) — consistent with our pivot from single planted traps (absorbed within a
   generation) to accumulation-based designs (still live at frontier).

## 3. Consequences for the ladder design

- The ladder's question narrows from "does breakage happen at scale at all?" (literature:
  yes, on the sequence axis, incl. frontier tier) to **"at what promise-density does it
  appear in a realistic SDD workflow at frontier tier, and does executable acceptance
  feedback change it?"** Fewer rungs needed; vary promise count at a fixed
  literature-justified horizon (~8–15 tasks), rather than sweeping both axes blind.
- Power planning gets literature anchors: toy-scale feedback effects were 12–16pp of
  final-turn quality (2607.01855); TDAD's 70% regression cut. If our effect is in that
  family, small-N arms may suffice — to be computed in the design note, not assumed.
- Publication posture: position as (i) first measurement of the density axis, (ii) first
  frontier-tier causal test of executable acceptance feedback in a spec-driven workflow,
  (iii) replication-at-scale of the Verification-Gate effect. Cite 2607.01855, TDAD,
  SWE-Milestone, PatchDiff, FeatBench, METR as the frame.
- Standing citation hygiene: quote ONLY the L2-verified numbers above; SlopCodeBench
  numbers from the live abstract only; body-level figures (TensorBench per-model rates,
  SWE-CI decimals, FeatBench size gradient) require reading the papers before use.

## 4. Follow-ups (zero-spend, not yet done)

- Read 2607.01855 in full (methods; exactly how the Verification Gate differs from our
  treatment arm; whether density varies at all across their chains).
- Read SWE-Milestone results section for stage-over-stage regression detail (we hold the
  repo screen already; the paper's data may partially anchor rung placement).
- Pull SWE-CI figure decimals and TensorBench per-model regression rates if/when those
  numbers become load-bearing.
