# Step-6 re-attack brief v1 — Stage-1 prereg draft (paste-ready, fresh session)

Operator instructions (not part of the paste): run in a FRESH session (the draft author's
session is disqualified — fresh-eyes rule, `docs/methodology/THREE-AMIGOS-DESIGN-REVIEW-v1.md`).
Suggested params: Fable, high effort, read-only subagents fine, no codex (save quota for
the Three Amigos step, where model diversity matters).

## Paste below this line

Run the Step-6 re-attack on the Stage-1 pre-registration draft. Your role: a single
hostile skeptic. You did not write this draft — attack it as if your reputation depended
on finding what its author missed. Zero model spend: reads and writing only. Do not
build anything, do not run anything, do not touch the corpus, do not revise the draft.

### Read first (in order)

1. `CLAUDE.md` + `AGENTS.md` — binding. Pay attention to: the exposure precondition,
   the discriminating-check precondition, the visible-vs-hidden-gap headline rule,
   replay-validity, run classifications and the claim ladder, and the OpenSpec scoping
   (shared task-environment property under profile `e1-openspec-workflow-v0` — never a
   condition, arm, or spec-format comparison).
2. `docs/methodology/THREE-AMIGOS-DESIGN-REVIEW-v1.md` — the definition of this gate:
   attack the PROJECTED RESULT in both the win and null framings; a design that cannot
   survive both framings is wrong.
3. `docs/e5/E5-STAGE1-PREREG-DRAFT-v1.md` — the document under attack.
4. Consult as needed for settled context: `docs/e5/adversarial-1/SYNTHESIS-v1.md`
   (deltas D1–D10), `docs/e5/E5-FORKPLUG-VERDICT-v1.md` (fork decision, determinism
   probe, ToS posture), `docs/e5/E5-REGRESSION-ACCUMULATION-CONTINUATION-DESIGN-v1.md`
   (design + verified parent-paper facts).

### The task

Imagine the study ran exactly as drafted. Attack both projected outcomes:

- **Win framing.** The Level-4 claim is published: "in a sealed two-arm pilot,
  executable acceptance feedback reduced accumulated-surface regressions under this
  task/model/budget." Destroy it: information leaks, confounds, selection effects,
  grader contamination, tautologies, experimenter degrees of freedom, arm asymmetries
  the parity machinery misses, wording overreach, anything a hostile commenter or a
  careful methodologist would land. Check the §6.2 claim rule for gameability.
- **Null framing.** Δ ≈ 0 is published. Show every way the draft's own machinery could
  have MANUFACTURED that null (event starvation despite the floor, dilution,
  underpowering by construction, flake noise, ceiling effects, feedback content too
  minimized to act on) — and judge whether the draft's honesty machinery (§9 floor and
  abort, §11 MDE statement and mechanization stop rule, the null-framing language)
  actually covers each path or just gestures at it.
- **The recorded open issues.** §16 lists five known tensions. For each: is the
  proposed containment a real fix or a fig leaf? Then hunt for issues §16 MISSED.

Rules:

- D1–D10 (including the operator-decided D10), the fork decision, and the run-ladder
  vocabulary are settled inputs. Attack how the draft COMPOSES and implements them —
  and flag any genuine contradiction among them — but do not re-litigate the decisions
  themselves.
- Every finding must name the draft section it lands on and state the change (or the
  explicit acceptance-of-risk) that would neutralize it.
- Rank each finding: FATAL (the freeze must not happen without a fix), MAJOR (fix
  before freeze), MINOR (record and move on).
- Findings only — do not edit the draft in this session.

### Deliverable

`docs/e5/E5-STAGE1-REATTACK-v1.md`: findings ranked most-severe first, each with the
section attacked, the attack itself, severity, and the neutralizing change. Include an
explicit verdict line: whether the draft may proceed to revision + Three Amigos, or
contains a FATAL flaw requiring redesign first. Commit the document; update the program
memory (state + next step = revise draft to v2, then Three Amigos in fresh sessions);
STOP there — no revision and no Three Amigos in this session, and every future run rung
still requires separate explicit operator authorization.
