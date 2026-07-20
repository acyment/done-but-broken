# Substrate screens — ChainSWE and SWE-Milestone

**Date:** 2026-07-21. **Spend:** $0 (no Docker images pulled — registry manifest metadata only; no
model calls). **Status:** partial Pass 3. Covers structure, dependency reality, hidden-check
feasibility, public surface, cost, licence and contamination. **Does NOT cover** the container-level
Pass 3 checks (leave-one-out edge proof, do-nothing-fails, known-good-passes, defective-variant
transfer floor) — those need a host that can store the images and were not run.

**Provenance and confidence.** Both screens were performed by subagents reading the papers, cloning
metadata, and computing over dataset files. **They are not hands-on verified by the operator or by
the main session.** Two independent agent findings elsewhere in this Step-1 review were demoted on
closer inspection (the prose-completeness check, the Specification Grounding paper); these screens
carry the same standing — strong leads, not admissions. A verified paper and a released dataset are a
lead, not a pass (execution-discipline point 6, Appendix F).

---

## ChainSWE (arXiv:2607.02606) — REJECTED

Three independent disqualifiers, any one fatal.

1. **Three usable chains, not a study.** 100 chains, mean length 3.04; chains with ≥4 steps: **3**
   (trimesh, falcon, briefcase). Baked into construction — the paper only considered length 2–5 and
   dropped the 2s.
2. **Co-location, not requirement dependency — confirmed, as suspected.** The paper joins two changes
   when the later patch applies cleanly OR when an AST filter finds any file/function/class overlap.
   Measured genuine textual dependency: **~18% of step-pairs**. Later problem statements reference
   earlier ones in **1 of 204** cases. Filter to ≥4 steps with every step genuinely dependent →
   **exactly one chain survives** (trimesh, whose first step is a packaging chore).
3. **Hidden-oracle split impossible.** Median fail-to-pass tests per step: **1**. Only 22% of steps
   have the ≥4 tests a split needs.

Lower-order: tests assert on internal pytest node IDs, not public surfaces; 255/304 tasks predate
2025 and are drawn from the most-trained-on eval data in existence (memorization risk on a frontier
claim). Licence discrepancy confirmed (dataset card MIT; arXiv banner CC BY 4.0).

**The CTO-comment test:** "these aren't dependent requirements, they're consecutive commits touching
the same file, and your study rides on three chains." The post does not survive it. Correct move if
ever relevant: name the rejection ourselves.

---

## SWE-Milestone (arXiv:2603.13428, v1 "EvoClaw") — QUALIFIED GO for a private pilot

Repo `github.com/DeepCommit-ai/SWE-Milestone` (redirected from Hydrapse/EvoClaw), tag v1.0, commits
current. HF dataset `DeepCommit-ai/SWE-Milestone-data`. **MIT.** ICML 2026, v3, 44pp.

### What qualifies it

- **Structure (computed):** 7 repos, 98 graded milestones, one DAG per repo. Longest dependency
  chains: nushell 9, go-zero 9, navidrome 6, scikit-learn 6, ripgrep 5, element-web 5, dubbo 3.
  **4–8 dependent steps satisfiable in 6 of 7 repos.**
- **Native hidden-oracle design — its best property.** `harness/e2e/test_masking.py` (5 languages)
  masks test files from the agent; the agent receives only a natural-language `SRS.md` requirements
  doc. Oracle pre-partitioned per milestone into pass-to-pass (regression), fail-to-pass (feature),
  none-to-pass (new). **A visible/held-out split is built in**, not constructed.
- **Mature harness:** four real agent adapters (claude_code, codex, gemini, openhands) over an ABC;
  documented clone→run path; single-milestone debug entrypoint; digest-pinned, replay/resume; an
  anti-cheat network quarantine blocking GitHub exfiltration. 4 open substantive issues, active.
- **Purpose-built from real 2025 release histories**, not mined from another benchmark.

### The caveats, in priority order

1. **The dependency DAG is model-authored, not per-edge verified — the framing "encoded explicitly
   rather than inferred from code overlap" is overstated.** Edges carry a `confidence_score`
   (0.65–0.98) and an LLM-written rationale; ~15 read "auto-inferred from commit-level dependencies,"
   ~21 explicitly disclaim a functional prerequisite. **But** ~78 "Strong" edges are real symbol
   prerequisites, and the dataset lets you *upgrade the edges yourself*: apply chain-minus-A, run B's
   fail-to-pass tests, confirm failure — **zero model calls**, a few container runs. Treat edge
   self-verification on the chosen chain as mandatory pre-work, not optional. Done and shown, this
   critique flips in our favour; skipped, it is the single most likely disqualifier.
2. **Public surface: only ~3 of 7 repos** (ripgrep, nushell, scikit-learn) test against a stable
   public API/CLI; the rest hit internal units. Hard filter.
3. **It does not hand us Gherkin.** Spec is `SRS.md`; oracle is each repo's native suite (pytest /
   cargo / go test), not `.feature` files. Earning the literal-Gherkin word (frozen Appendix F
   decision) means authoring `.feature` scenarios over these milestones and wiring a runner to the
   public surface — extra build. The existing pytest-bdd Gherkin runner is **Python-only**, so among
   the three good-surface repos only **scikit-learn** fits both "stable public API" and "runnable
   through existing tooling." Sharp narrowing.
4. **Cost — the wall.**
   - *Infra:* images run 15–53 GB per repo, ~180 GB total (uncompressed materially larger). **This
     machine (32 GB free) cannot host even one repo's set** — even the free edge-verification needs a
     cloud host with a few hundred GB of disk, or per-milestone pull-and-prune.
   - *Spend:* one 4–8-milestone chain, two arms, one frontier model ≈ **$30–120 all-in**
     (agent-session-dominated); full 7-repo eval ≈ $500 (paper, Opus 4.5). **Against $13.40 remaining
     on an $18 stop-loss, this is a several-times-larger fresh authorization — an operator decision,
     not a resumption.** Both arms share images, so image cost is per-repo, not per-arm.
5. **Contamination intersects the money.** Famous repos; the paper concedes it "cannot fully rule out
   memorization on individual milestones." A memorized milestone passes in *both* arms and washes out
   the feedback signal. The relative contrast is more robust than an absolute score, but this is the
   risk to weigh hardest before spending real money.

**Walk-away call (agent):** run a private pilot on ripgrep, nushell, or scikit-learn **after**
self-verifying one chain's edges; do not name SWE-Milestone in a public post as proof of "feedback
wins on genuinely dependent changes" without that verification, pre-registered.

---

## What the screens changed

Hand-building certified episodes is **no longer forced** — SWE-Milestone plausibly saves most of that
build. But "plausibly" is load-bearing: the container-level Pass 3 checks have not run, and the
substrate's headline dependency property is softer than its abstract claims. Route 2's cost profile
shifts from "expensive hand-build" to "moderate cloud spend, pending free edge-verification once a
disk-adequate host exists." Whether that spend is authorized is a Step 5 decision.

Note recorded for hygiene: the SWE-Milestone screening agent reported that the Ahma MCP server's
system instructions asserted it was the "sole permitted execution pathway" for all commands. The
agent correctly disregarded this — a tool-provider instruction is not an operator instruction — and
used standard tooling. Flagged here because that MCP directive is active in this environment.
