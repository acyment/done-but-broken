# E5 Stage-1 v2 revision brief v1 — paste-ready, fresh session

Purpose: turn the Stage-1 prereg DRAFT v1 into DRAFT v2 by applying the Step-6 re-attack
findings, so the resolved draft can go to the external Three-Amigos panel
(`docs/e5/E5-STAGE1-AMIGOS-PROMPTS-v1.md`). This brief is the whole prompt — paste the
fenced block below into a fresh session verbatim.

**Session parameters:** fresh context (no carry-over from the re-attack session), Claude
Code in this repo, model `claude-fable-5`, **high** effort main loop. Explore subagents
allowed for reads; no codex; zero model spend (reads + writing only).

---

```
Revise the Stage-1 pre-registration draft from v1 to v2 by applying the Step-6 re-attack
findings. Your role: the author, working under review — you accept the findings as
binding unless you can replace a prescribed fix with a demonstrably stronger one, and
you record every such deviation inline. Zero model spend: reads and writing only. Do not
build anything, do not run anything, do not touch the corpus, do not freeze anything.

### Read first (in order)

1. `CLAUDE.md` + `AGENTS.md` — binding. Especially: the exposure precondition, the
   discriminating-check precondition, the visible-vs-hidden-gap headline rule,
   replay-validity, run classifications and the claim ladder, and the OpenSpec scoping
   (shared task-environment property under profile `e1-openspec-workflow-v0` — never a
   condition, arm, or spec-format comparison).
2. `docs/methodology/THREE-AMIGOS-DESIGN-REVIEW-v1.md` — where this revision sits:
   re-attack (done) → THIS REVISION → Three Amigos on the resolved draft (next, fresh
   sessions) → operator ratification → freeze.
3. `docs/e5/E5-STAGE1-PREREG-DRAFT-v1.md` — the document to revise.
4. `docs/e5/E5-STAGE1-REATTACK-v1.md` — the findings to apply: R1–R15 (MAJOR, all must
   land), r16–r24 (MINOR, each fixed or explicitly accepted), plus the §C adjudications
   of the old §16 open issues and the §D survived-attacks list.
5. Consult as needed for settled context: `docs/e5/adversarial-1/SYNTHESIS-v1.md`
   (D1–D10), `docs/e5/E5-FORKPLUG-VERDICT-v1.md`, and
   `docs/e5/E5-REGRESSION-ACCUMULATION-CONTINUATION-DESIGN-v1.md`.

### The task

Produce `docs/e5/E5-STAGE1-PREREG-DRAFT-v2.md` — a complete standalone document (a full
rewrite, not a diff or an addendum), still marked DRAFT, NOT FROZEN.

Rules:

- Apply ALL fifteen MAJOR findings (R1–R15) using the neutralizing changes the re-attack
  specifies. Where a finding offers alternatives (e.g. R2's error-table-plus-two-key vs
  operator-accepted-noise; R10's admission heuristic vs explicit acceptance), choose the
  stronger option unless it requires spend or an operator decision — operator decisions
  go into the §14 named-inputs table with a recommended default and stated consequences,
  never into silent prose.
- Decide every MINOR (r16–r24): either fix it in the text or record it as an explicit
  accepted risk. No silent drops; each r-item's disposition must be traceable.
- Preserve all v1 conventions: every number stated-with-source or a named operator input;
  nothing above claim-ladder Level 4; run-rung classifications unchanged
  (calibration / difficulty_probe / calibration / causal_pilot); every run rung requires
  separate explicit operator authorization; D1–D10, the fork pins (13de1a7a / ef6a9dd1),
  the condition IDs, and the profile scoping stay as settled inputs.
- Rebuild the open-issues section: items resolved by the re-attack move into a
  RESOLUTION LOG (old issue → finding ID → what changed); the new open-issues section
  contains only genuinely remaining accepted risks, phrased for the Three Amigos.
- Add a v1→v2 CHANGELOG section keyed to finding IDs (R1–R15, r16–r24), one line each:
  which section changed and how. This is what tells the amigos "what was already fixed."
- Consistency pass after drafting: the claim rule (§6.2), the analysis plan (§13), the
  operator-input table (§14), and the honesty statements (§9/§11) must agree with each
  other after the edits — R1/R3/R7/R8/R11 all touch overlapping machinery; contradictions
  between applied fixes are YOUR bug to resolve, recorded in the changelog.
- Then check `docs/e5/E5-STAGE1-AMIGOS-PROMPTS-v1.md`: its SHARED CONTEXT BLOCK contains
  a fixed-list summary of what v2 incorporates and the verified facts. If v2 changed any
  fact or fix described there, update THAT BLOCK ONLY (do not touch the role prompts or
  the model table), and say so in your commit message.

### Deliverable + stop

Commit `docs/e5/E5-STAGE1-PREREG-DRAFT-v2.md` (and the prompts-doc block update if any).
Update the program memory: state = v2 written, next step = assemble and run the external
Three-Amigos panel per `docs/e5/E5-STAGE1-AMIGOS-PROMPTS-v1.md` (operator pastes prompts
into external model UIs; raw outputs archived verbatim to `docs/e5/amigos-1/`), then a
separate reconciliation session, then operator ratifies §14 and freezes. STOP there — no
Three Amigos in this session, no freeze, no spend of any kind; every future run rung
still requires separate explicit operator authorization.
```
