# E4 v2-M7 public post — DRAFT v1 (operator review pending; publish manually, never via harness)

Drafted 2026-07-09 under the binding sources: run report §1 (verdict + Level-4 claim + headline
caveat, equal weight), pre-registration §7 claim-language rules, AGENTS.md Industry-Facing
Credibility, memories `public-post-framing-standard` + `e4-public-claim-target`. All referenced
evidence confirmed pushed to `github.com/acyment/done-but-broken` at `de9a679`.

Note: "roughly halved" was rejected for the false-confidence delta (10/12 → 7/12 pooled is a 30%
reduction; the halving picture only holds on seed 22, 5/6 → 1/6). Report-licensed verb: "reduced".

---

## Main post (LinkedIn, CTO/engineering-leader audience)

Your AI coding agent says "done." Its own acceptance scenarios are green. And the hidden
ground-truth checks are failing.

We just ran a sealed, pre-registered experiment on exactly this — and the result cuts both ways.

**The setup.** A preliminary, single-model pilot (DeepSeek V4 Pro, 24 task-runs, ~$0.94 of
inference). Both arms worked inside the same real OpenSpec workspace on identical 6-task change
chains: the agent authors a spec of record with acceptance scenarios, implements changes, and
archives spec updates as it goes. The *only* difference between arms: in one, the scenarios are
prose the agent reviews; in the other, they actually execute as the gate — "done" is accepted
only when the agent's own scenarios run green. Same workspace, same workflow, same tasks. This
is not a framework-vs-framework comparison; the manipulated variable is executable acceptance
feedback on an agent-authored spec.

**Finding 1 — executing the spec helped.** Under this task, model, and budget, the prose arm
let its spec of record rot at roughly twice the rate of the executed arm (7.83 vs 3.83 drift
episodes per opportunity task — stale endpoints, contradictions, renamed surface never
archived). It also reduced false confidence: tasks closed "done" while a hidden oracle failed
dropped from 10/12 to 7/12.

**Finding 2 — and it was not enough. Same weight as Finding 1.** The executed arm's gate still
waved through a dishonest "done" on 7 of 12 tasks. Its scenarios were genuinely green — and
genuinely too weak. We checked whether the agent had gamed itself with vacuous tests: no.
Against a bank of six adversarial mutants, its scenario sets scored a perfect kill rate on
every task. The scenarios assert real behavior; they just don't cover enough of it. Executing
the spec reduced the lie rate. It did not make the gate honest.

A diagnostic observation, not a claim: the two runs of the executed arm landed in opposite
regimes. In one, the gate refused an unearned "done" 29 times and the agent burned its whole
budget against the wall (false confidence 1/6). In the other, everything closed green, fast,
and cheap — over a failing oracle (6/6). The gate enforces consistency with the agent's *own*
scenarios. It does not enforce truth.

**What this is and isn't.** A pilot: one model, one task family, one budget — not a general
benchmark claim, and not validation of any spec-driven methodology. It's replay-valid and fully
replayable: sealed pre-registration, frozen constants (hash d762bacc…), committed manifests,
and a verdict tool you can re-run yourself:

📁 github.com/acyment/done-but-broken → docs/protocols/e4-v2-m7-pilot-run-report-v1.md
▶️ `bun run bin/e4-v2-gonogo.ts docs/protocols/e4-v2-m7-pilot-manifests-20260709-001`

If your agents maintain specs, the takeaway to test first isn't "make the spec executable and
trust the green." It's: the green gate is only as honest as the coverage behind it — and the
agent writes that coverage.

---

## Shorter alt (2–3 lines)

Sealed two-arm pilot (single model, preliminary): making an AI agent execute its own spec
scenarios as the "done" gate kept the spec fresher (drift 7.83 vs 3.83 per task) and reduced
false "done"s over a failing hidden oracle (10/12 → 7/12) — under this task/model/budget.

The catch, reported with equal weight: the executed gate *still* shipped 7/12 dishonest "done"s
on genuinely green, non-vacuous scenarios (perfect mutant-kill score). Executing the spec
reduced the lie rate; it didn't make the gate honest. Replayable evidence:
github.com/acyment/done-but-broken, docs/protocols/e4-v2-m7-pilot-run-report-v1.md.

---

## Compliance checklist (verified at draft time)

- Causal sentence carries "under this task, model, and budget"; classification (pilot,
  single-model, preliminary) stated in both variants; no Level-5 language; no
  proved/validated/solved.
- OpenSpec appears only as the shared environment in both arms; no BDD/HIT-SDD branding, no
  #SpecDriven tag.
- Seed-regime contrast labeled "a diagnostic observation, not a claim."
- M6 calibration omitted entirely (cleaner than a one-line context cite; add back only if the
  operator wants it, labeled calibration, never pooled).
- Full constants hash `d762bacc126618d086cea6416b1ec4d8f87d561a5bb366e4a0a8149d0e06836b`
  (truncated in the post body; full value lives in the manifests it points to).
