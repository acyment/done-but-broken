# E5 adversarial-panel synthesis brief v1 — paste-ready for a fresh session

Written 2026-07-23. Run AFTER the operator has placed all panel result files in
`docs/e5/adversarial-1/`. Operator authorization to run this brief = pasting it.

---

Synthesize the adversarial design-review panel for the **regression-accumulation
continuation design** (Stage 1 on a SlopCodeBench fork, two groups in one OpenSpec
workspace, executability the only delta). **Falsification framing: your job is to find the
reasons our design is WRONG — score contestable readings in favor of the critics, not the
design.** Zero external spend: local reads, git, at most web fetches to verify any NEW
citations the panel introduces. No runs, no probes, no prereg freeze in this session.

## Read first

1. `docs/e5/E5-DESIGN-DECISION-PANEL-PROMPT-v1.md` — the panel prompt (Parts A/B, the three
   disclosed doubts, the six attack sections). NOTE: a Part A answer is currently stashed at
   the head of this file, above the doc header — it is a panel RESULT, not part of the
   prompt. Relocate it into `adversarial-1/` as its own file during ingestion; ask the
   operator which model produced it if unlabeled (do not guess provenance).
2. `docs/e5/adversarial-1/` — the panel results (one file per model; Part A then Part B;
   operator-labeled model/version and sequential vs B-only mode).
3. `docs/e5/E5-REGRESSION-ACCUMULATION-CONTINUATION-DESIGN-v1.md` — the design under attack
   (incl. addenda §6a/6b and the prior-knowledge correction).
4. `docs/e5/deepresearch-breakage-scaling-20260722/VERIFICATION-AND-SYNTHESIS-v1.md` — the
   verified literature (only L2-verified numbers are quotable).
5. Constraints that bind any design change: CLAUDE.md + AGENTS.md (OpenSpec = shared
   environment only, profile `e1-openspec-workflow-v0`; no spend without authorization;
   no overclaiming; preserve classifications).

## Hard rules

- Panel outputs are **leads with zero inherited credibility**: any factual/citation claim a
  panelist introduces that we'd rely on must be re-verified (the qwen/claude deep-research
  precedent: one report's sweeping conclusion was false while its single citation was gold).
- Main-loop verdicts at frontier tier, high effort. Subagents only for mechanical breadth.
- The synthesis informs the NEXT artifact (the Stage-1 prereg draft); it never rewrites
  committed records or re-litigates closed verdicts.
- Mixed panel modes: weight Part A convergence only from sequential-mode runs (a B-only run
  has no clean Part A); B-only runs contribute attack-only signal.

## Tasks (in order)

1. **Ingest + archive.** Move/copy every result verbatim into
   `docs/e5/adversarial-1/` final form with a provenance header per file (model, version,
   date, sequential vs B-only, operator-supplied). Include the relocated stash from the
   prompt file head. Commit the raw archive BEFORE reading critically (freeze the inputs).
2. **Part A convergence scoring** (sequential runs only). Dimension-by-dimension table vs
   our design: substrate/harness choice; task scale; group definitions; what-agent-sees;
   gate policy (retry/rollback); retry parity for the control group; self-verification
   policy; hidden-referee surface; metrics; power math; pilot/escalation. Convergent /
   divergent / novel per cell, with the panelist's actual choice quoted.
3. **Part B findings ledger.** Every distinct critique across all files, deduplicated,
   ranked by severity; for each: my verdict (ACCEPT — changes the design; PARTIAL —
   mitigate/record; REJECT — with the specific evidence, not vibes) and, where accepted,
   the concrete design/prereg delta. The three disclosed doubts get explicit resolution:
   retry asymmetry, self-verification policy, visibility realism.
4. **Hostile-commenter triage.** Union of all proposed hostile comments; for each: can the
   current design answer it (cite how), or what change would make it answerable, or is it
   unanswerable-and-must-be-scoped-honestly.
5. **Fork-vs-plug checklist merge.** One ranked checklist for the codebase-reading pass
   (union of panel checklists + our two standing questions: agent test-result visibility
   config; Claude Code subscription auth inside their Docker).
6. **Deliverables:** `docs/e5/adversarial-1/SYNTHESIS-v1.md` (sections mirroring tasks 2–5
   + a final "what changes in the design" list), a one-paragraph update appended to the
   design note recording accepted deltas, commit(s), memory update. **Stop there** — the
   prereg draft itself is a separate, operator-authorized step.

## Honest-scope reminders for the synthesis memo

Panel models could not read either codebase (fork-vs-plug input = checklist only); panel
prompt disclosed three doubts (their echoes of those are confirmation, not discovery);
sequential-mode Part A answers may be imperfectly blind (models read ahead); the panel
evaluates the design, not the world — a unanimous panel can still be wrong, which is what
the pilot rung exists to catch.
