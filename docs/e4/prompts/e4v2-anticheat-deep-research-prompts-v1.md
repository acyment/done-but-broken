# E4 v2 — deep-research prompts: preventing cheating in agent-authored executable scenarios (v1)

**Purpose.** Before any implementation of the OpenSpec-with-executable-scenarios design
(`docs/e4/E4V2-OPENSPEC-EXECUTABLE-SCENARIOS-PROPOSAL.md`), fan these prompts out across several
strong models (operator-run, estate multi-review practice). Goal: a converged catalog of ways an
AI agent can *pass its own executable spec while being wrong*, plus the best-practice defenses,
before we freeze the scenario grammar and gate mechanics. Each prompt is self-contained.

**Shared context block (paste at the top of every prompt):**

> I am designing a benchmark where an AI coding agent works on a small generated HTTP API
> (TypeScript). The agent maintains a spec in OpenSpec format whose `#### Scenario:` blocks are
> Gherkin-style (WHEN/THEN/AND bullets). In the treatment condition, the harness EXECUTES the
> agent's own scenarios as the acceptance gate: scenarios must fail before the implementation
> ("red") and pass for the task to be accepted ("green"). Constraints: (1) the agent writes ONLY
> scenario text — all step implementations come from a fixed, harness-owned step library (HTTP
> request steps, status/body assertions), so a step cannot literally "return true"; (2) a hidden,
> harness-generated ground-truth test suite also runs after every task (the agent never sees it);
> (3) a separate meter measures whether the agent's spec covers the true API surface; (4) the
> scenario grammar is a sealed, constrained subset we control. The known failure mode we designed
> against is vacuous step code; I want the failure modes that REMAIN.

---

## Prompt 1 — adversarial red team (attack catalog)

[shared context block]

Act as a red team whose only goal is to make the agent pass the gate while shipping wrong,
incomplete, or degenerate implementations. Enumerate every attack you can construct **at the
scenario-authoring level**, given that step code is harness-owned. For each: a concrete example
scenario (in WHEN/THEN form), why it passes the gate, what damage it hides, whether the hidden
ground-truth suite or a surface-coverage meter would catch it, and what residual detection gap
remains. Include at minimum your analysis of: assertion-free or status-only scenarios;
scenarios that restate current behavior instead of requested behavior (tautology); overfitting
scenarios to known seed/fixture data; writing scenarios that are already green before
implementing (gaming the red check); minimal-coverage strategies; exploiting ambiguity in step
phrasing; and any attack on the red→green sequencing itself. Rank the surviving attacks by
(severity × likelihood a competent model finds them unprompted). Do not stop at ten if more
exist.

## Prompt 2 — BDD industry practice (what human teams learned)

[shared context block]

Survey what the BDD/Cucumber/SpecFlow practitioner community has learned about **low-quality but
passing Gherkin** in human teams: vacuous scenarios, incidental details, imperative scripts,
assertion-free Then-steps, scenario rot, "the build is green but the spec lies." Which
anti-patterns have names and documented prevalence? Which mechanical defenses exist and work:
Gherkin linters, semantic step checkers, dry-run/pending-step enforcement, scenario review
checklists, living-documentation freshness checks? For each defense, state whether it transfers
to a machine author under our constraints, and what it would miss. Cite sources (books, talks,
tooling docs, postmortems).

## Prompt 3 — testing research (scoring a test suite without trusting it)

[shared context block]

From software-testing research: what are the strongest known techniques for judging the
*strength* of a test suite when you cannot trust its author? Cover mutation testing (and
practical mutation operators for a small HTTP CRUD service), fault-injection/adversarial
implementations (deliberately wrong programs that a good suite must reject), coverage adequacy
criteria and their known failure as proxies, property-based and metamorphic testing as
supplements to example-based scenarios, and assertion-quality metrics. For each: cost,
determinism/reproducibility properties (we require byte-reproducible verdicts), and how it could
run automatically inside a benchmark harness as a "scenario-strength" score for agent-authored
Gherkin. Recommend a minimal composable set for our case and say explicitly what it still
cannot catch.

## Prompt 4 — AI evaluation & reward hacking (models gaming self-written checks)

[shared context block]

Survey what is known about AI agents gaming self-authored or self-verified success criteria:
specification gaming / reward hacking taxonomies, documented cases of models writing weak tests
for their own code, benchmark-design defenses (hidden holdout suites, differential testing,
test augmentation à la EvalPlus, honeypot tasks, adversarial evaluation), and any published
work specifically on LLM-authored acceptance tests or executable specifications. Distinguish
deliberate-looking gaming from laziness/miscalibration — do defenses differ? Given our design
(hidden ground-truth suite + coverage meter + sealed step library), which published defenses are
we missing, and which of our defenses does the literature suggest are weaker than they look?

## Prompt 5 — design review of our specific defenses (steelman then break)

[shared context block]

Our current defense stack: (a) harness-owned step library (no agent step code); (b) sealed
constrained scenario grammar; (c) red-before/green-after sequencing with refusal of premature
"done"; (d) hidden ground-truth suite scoring true correctness after every task; (e) a coverage
meter comparing the agent's spec against the true API surface; (f) full recorded replay of every
run. First steelman this stack: for each layer, the strongest argument it suffices. Then break
it: the most economical combined strategy an agent could use to look spec-driven while being
wrong, the smallest design change that closes each break, and any layer you would REMOVE as
security theater. Finally: is there a principled argument that agent-authored step
implementations (with sandboxing and review) would be MORE cheat-resistant than a sealed
library, as some argue realism demands? Conclude with a ranked shortlist of design changes worth
their cost.

---

**Handling results (estate practice):** collect the outputs, adjudicate convergent findings into
a verified backlog (accept/reject each with reasons, as in `docs/e4/R2-BACKLOG.md`), and only
then freeze the scenario grammar and gate mechanics in the v2 design. Rejected claims get
recorded too, so they are not re-litigated later.
