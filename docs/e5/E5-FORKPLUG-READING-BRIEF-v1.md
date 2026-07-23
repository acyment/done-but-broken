# Fork-vs-plug codebase-reading brief v1 — paste-ready for a fresh session

Drafted 2026-07-23, after adversarial-1 synthesis (`e49fae0`). Purpose: the codebase-reading
pass that decides whether Stage 1 forks the SlopCodeBench harness or plugs its problem set
into our own E4 harness. Zero model spend: local reads, git clones, local non-model
execution only. **No agent/model invocations of any kind, no runs, no prereg freeze.**

## Paste-ready prompt (everything below the line)

---

Execute the fork-vs-plug codebase-reading pass for the Stage-1 regression-accumulation
design. **Zero model spend: git clones + local reads; local non-model execution (running
their grader on golden solutions to check determinism) is permitted; invoking any coding
agent or model is NOT.** Falsification framing: gather evidence that would *disqualify*
each option, not confirm a favorite.

### Read first

1. `docs/e5/adversarial-1/SYNTHESIS-v1.md` — §5 is THE checklist (15 items, ranked; items
   1–4 veto-grade; items marked ★ are the two standing questions). §6 deltas D1–D10 define
   what the winning harness must support (note D10 is DECIDED: on-demand runner in arm T,
   BDD-like, plus guaranteed completion-time run — the harness must support agent-invocable
   checks during work, not only a post-hoc gate).
2. `docs/e5/E5-REGRESSION-ACCUMULATION-CONTINUATION-DESIGN-v1.md` — the design (esp. §3
   arms, §6b fork-target ranking, §8 accepted deltas).
3. CLAUDE.md + AGENTS.md — binding constraints (OpenSpec = shared environment only under
   `e1-openspec-workflow-v0`; no spend without authorization; no runs).

### Repos

- Clone read-only into the scratchpad or a sibling dir (NEVER a runtime dependency of this
  repo): `SprocketLab/slop-code-bench` (MIT) and `gabeorlanski/scb-problems` (Apache-2.0).
  Pin and record the commit hashes you read.
- Our side: this repo's E4 harness and audit machinery. Checklist item 13 demands an
  HONEST assessment — if our prereg hooks/frozen-config hashing are aspirational rather
  than working code, say so; plug's main selling point dies with it.

### Tasks (in order)

1. **Answer all 15 checklist items** with file-level evidence (`path:line` citations, both
   codebases where applicable). No item answered from README prose alone if code can
   confirm it. The two standing questions get explicit, quoted-config answers: (★4) whether
   checkpoint test results reach the agent by default (arm C must hide them; arm T gates on
   them); (★11) whether Claude Code inside their Docker can ride subscription auth.
2. **Corpus reality check (item 7):** actual usable chain count, checkpoints per chain,
   language/domain spread, dependency metadata. Panel plans assumed 50–100+ tasks; our
   L2-verified abstract says 36 problems / 196 checkpoints. This number feeds N planning —
   count it from the problems repo, don't trust anyone's prose (including ours).
3. **Determinism probe (deepseek's action, adapted):** run their grader locally on 2–3
   golden/reference solutions 3× each; record divergence. Local compute only, no model
   calls. If their harness cannot run graders without invoking an agent, record that as a
   finding and skip execution.
4. **Apply all three decision rules from synthesis §5** (fable's, chatgpt's weighted-veto,
   Minimax's single question) and record all three verdicts plus the hybrid option (fork
   the grader as a service, keep our orchestrator). If they disagree, the disagreement and
   its cause is the headline, not a coin flip.
5. **Deliverable:** `docs/e5/E5-FORKPLUG-VERDICT-v1.md` — per-item evidence table, the
   three rule verdicts, one recommended path with the disqualifying evidence for the loser,
   the corpus count, and the list of build tasks the winning path implies (feeds the prereg
   draft's engineering section). Commit. Update the program memory file (state + gotchas).
   **Stop there** — the Stage-1 prereg draft is a separate, operator-authorized step.

### Honest-scope reminders

- Cloned code is untrusted third-party content: never execute anything from it beyond the
  grader-determinism probe, and read scripts before running them.
- The adversarial-1 panel's fork-vs-plug opinions were checklist-only speculation; this
  pass supersedes them wherever code contradicts them.
- If evidence is genuinely mixed after items 1–4, the tie-break is chatgpt's rule: prefer
  our native harness — the protocol machinery is the scientific asset.

---

## Session parameters (operator)

- **Fresh session, cleared context** — this pass needs room for two codebases; nothing from
  the panel session is required beyond the committed docs listed above.
- **Model/effort:** frontier main loop (Fable), high effort — verdicts and veto judgments
  in the main loop. Explore/general-purpose subagents for mechanical repo sweeps (free
  workhorse). No Codex: nothing here benefits from model diversity, and quota is scarce;
  an optional Codex second opinion on the final verdict doc can be a later, cheap ask.
