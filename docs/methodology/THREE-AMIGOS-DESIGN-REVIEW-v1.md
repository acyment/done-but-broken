# Three Amigos design review — reusable methodology v1

A standing practice for this program, first used 2026-07-21 on the Immich pilot design (caught the
outcome-event ambiguity and produced pre-registration v2). Codified here so it is applied to every
substantial design/pre-registration/build decision from now on. Part of the program's
adversarial-verification family alongside the **blind-author probe** and the **Step-6 re-attack**
(see "Sibling practices" below).

## What it is

The BDD "Three Amigos" practice, adapted: before a design is frozen, three *independent*
perspectives stress-test it — **Product/Business** (why/what — is this worth doing, what must it
not overclaim), **Development** (how — is it buildable at our scale, what's underspecified),
**Testing/QA** (what breaks — how does each arm cheat, what confounds/edge-cases invalidate it).
The goal is to surface flaws *before* spend or build, when they are free to fix.

## When to run it (trigger)

Run a Three Amigos review before:
- freezing any experiment pre-registration;
- committing to a substantial harness/build;
- any decision that would be expensive to reverse after spend.

Not needed for reversible, cheap, or purely mechanical steps.

## How we run it (the mechanics that make it work)

1. **Resolve the design first.** Amigos review a *specific* proposed design, not a blank page.
   If a prior adversarial pass (re-attack) already fixed a fatal flaw, give them the resolved
   version and tell them what was already fixed — their job is what *remains*.
2. **Three fresh, independent agents**, one per role, **different models** where possible
   (blind-spot diversity — same-family agents share blind spots). Fresh context = genuine
   independence; they never see each other's output.
3. **Identical shared context block** (the design + verified facts) + a **role-specific mandate**
   asking for: that perspective's must-have requirements, its top risks, and 2–3 requirements it
   *insists* enter the pre-registration. Instruct them to be unsparing, not to rubber-stamp.
4. **The main loop reconciles** (does not author blind — it holds the ground truth). Reconciliation
   rules:
   - **Convergent findings rank highest.** When ≥2 amigos independently raise the same issue, it
     is almost certainly real and load-bearing (Immich: Dev + QA both found the outcome-event
     ambiguity → resolved by design).
   - Fold every amigo's "insisted requirements" into the artifact, or record why not.
   - Adjudicate genuine disagreements explicitly.
5. **Record raw outputs verbatim** (per the program's evidence discipline) and **existence-check
   any factual claims** an amigo makes before relying on them.

## Role mandates (reusable prompt skeletons)

- **Product/Business:** Is the claim worth making to the target audience? What is the smallest
  credible result vs a nothingburger? What will the audience wrongly infer that we must pre-empt?
  The single thing we must NOT overclaim? 2–3 credibility requirements for the prereg.
- **Development:** What is genuinely hard vs easy at our scale? What is underspecified such that a
  builder would guess (and might build wrong)? Cheapest faithful build + false economies to avoid?
  2–3 build requirements for the prereg.
- **Testing/QA:** How could each arm cheat / the measurement be confounded / edge cases invalidate?
  Given any already-fixed flaw, what *remains*? 2–3 QA guardrails for the prereg.

## Why fresh independent agents (not one reviewer wearing three hats)

Independence is the point: a single reviewer rationalizes one coherent view and misses the
cross-perspective tension (Product wants shareable, Dev wants buildable, QA wants unbreakable —
these genuinely conflict, and the conflict is where the design improves). Separate contexts prevent
anchoring; different models prevent shared blind spots.

## Sibling practices (same family; compose freely)

- **Blind-author probe** — measure whether competent authors, given only a feature contract,
  naturally produce the artifact the design assumes (e.g. a precondition-pinned scenario). Frozen
  scoring rule *before* reading output. Answers "does this arise in the wild?"
- **Step-6 re-attack** — a single skeptic attacks the *projected result* in both the win and null
  framings before spend; a design that can't survive both framings is wrong. Catches
  tautology/leak/confound classes.
- **Memorization / discrimination probe** — check the substrate isn't neutered (model already
  avoids or already knows the trap) before building on it.

Typical order for a new study: substrate verification → memorization probe → blind-author probe →
draft design → **re-attack** (fix fatal flaws) → **Three Amigos** (harden the resolved design) →
pre-register → build → authorize → run. Each step is zero-external-spend and gates the next.
