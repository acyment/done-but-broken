# Substrate search v4 — scout clarifications

Prompt: `docs/e5/SUBSTRATE-SEARCH-V4-PASTE-READY.md`. Same convention as v2/v3: identical
answers to all scouts; reuse verbatim on repeats; append new exchanges with date and scout.

---

## Exchange 1 — 2026-07-21 (asking scout: operator to record model + version)

**Q1.** How strictly does "post-January-2026" apply to the establishing item — must it also be
post-January-2026, or can it predate the window if the trap and filler items fall within it
and the subsystem remains coherent?

**A1.** The bar applies with full strictness to exactly one thing, and it is not the
establishing item: the TRAP — both the culprit change AND the fixing PR — must be
post-January-2026. The fix is the load-bearing half: it is the document that reveals the trap,
so a fix inside training data means the model may simply know the mistake, and the trap
evaporates. The establishing item may predate the window, provided the subsystem is coherent
(the behavior it established is still the behavior the trap threatens) and it can be presented
as an early item in the sequence or as inherited baseline. Memorization of the establishing
item is close to harmless — its role is to be where scenarios covering the threatened behavior
naturally attach, not to discriminate between conditions. State its date; pre-window is a
note, not a defect. Pre-window trap or fix is a defect.

**Q2.** Should candidates be disqualified if acceptance scenarios could be written at intent
level but aren't idiomatic in that project's culture (e.g., a well-documented library API with
no Gherkin-style specs), or only if the surface inherently resists such specification?

**A2.** Judge the SURFACE CLASS, not the project's culture. Almost no open-source library uses
Gherkin internally; requiring in-repo evidence would empty the pool and tell us nothing. The
question: would a competent industry team plausibly specify this surface with intent-level
acceptance scenarios — is it what the practice is recognizably FOR (HTTP endpoint, CLI
invocation, user-meaningful operation with a documented contract)? A well-documented library
API with no Gherkin culture is admissible with a naturalness penalty — scored down, not
disqualified. Disqualify only surfaces that inherently resist intent-level specification:
internal utilities, private helpers, behavior not phrasable in user-recognizable terms.
Operational test: a skeptical engineering leader reads the scenario — "a team could plausibly
work this way here" admits; "nobody would ever write this" disqualifies.

**Q3.** For the least-confident check per candidate: prioritize uncertainty about factual
linkage (does the fixing PR truly address the trap) or conceptual plausibility (would
establishing-item scenarios realistically cover the regression)?

**A3.** Report both, but they do different jobs; if only one, flag the conceptual. Factual
linkage gets verified locally for every nomination regardless of stated confidence — cheap,
mechanical, non-negotiable after a previous scout fabricated citations; stating factual doubts
mainly orders that queue. Conceptual plausibility is the judgment that cannot be cheaply
replicated by reading links, and it is the risk that survives verification and is carried to
the next gate. Spend the reasoning there, including the specific way coverage could miss —
wrong entry point, wrong granularity, behavior specified more abstractly than the regression
manifests. That last shape (scenarios true at the level written, blind at the level broken) is
where scout judgment is most needed.

---

## Exchange 2 — 2026-07-21 (operator ruling on the A1 latent-fossil tension)

**Context:** the v4 mechanical pass (`MECHANICAL-PASS-v1.md`) surfaced two fossil shapes:
regression pairs (culprit and fix both post-Jan-2026 — gunicorn) and latent-bug fossils
(post-cutoff fix and issue, older culprit code — pip, borg, aiohttp). Strict A1 as answered
in Exchange 1 excludes the latter.

**Ruling: strict A1 stands, with a pre-declared fallback (back-burner, not a relaxation).**

1. The admission bar remains: culprit AND fix post-January-2026.
2. **Pre-declared trigger, recorded before we know whether it fires:** after both remaining
   scout sessions and one further mechanical sweep, if the strict-passing pool holds fewer
   than two verified conjunctions per surface shape (library-shaped, service-shaped), the
   latent-bug shape becomes admissible — each candidate then requires a memorization probe
   (show the model the culprit-era code without context; if it flags the bug, the candidate
   is burned) before any use.
3. Note recorded with the ruling: the strict pool already contains two complete conjunctions
   covering both shapes — pandas #64478→#66250 (library) and gunicorn #3614→#3618 (service) —
   so the fallback may never trigger.

**Amendment to send scouts (append to any active v4 session):**

> Amendment to the recency answer: the strict bar (culprit AND fix post-January-2026) stands
> for nominations. However, do NOT discard latent-bug fossils — a post-January-2026 fix
> whose culprit code is older. Report them in a clearly separated secondary list, same
> evidence requirements, labeled "latent (back-burner)". They are being collected against a
> pre-declared fallback, not admitted.
