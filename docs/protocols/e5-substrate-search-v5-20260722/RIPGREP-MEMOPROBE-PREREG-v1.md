# Ripgrep memorization / liveness probe — pre-registered (frozen before results)

Written by Claude Code 2026-07-22, **before spawning any probe agent**; the commit containing
this file plus the two prompt files is the freeze evidence. Falsification framing: the probe's
job is to find the reason ripgrep #3376/#3320/#3419 → `43e2f08ede` is OUT. The F0–F4 screen
passed (`RIPGREP-SCREEN-v1.md`) but creates no presumption here. Probe order deliberately
inverted vs paperless (probe BEFORE any F5 build — the paperless lesson: full build
verification passed, then the nearly-free probe killed it). Template/precedent:
`PAPERLESS-MEMOPROBE-PREREG-v1.md` (and the Immich v4 prereg it derives from).

Memorization target is real: the fix (2026-06-04/05, released in 15.2.0), the test commit
(2026-06-27), and all three issues (2026-03/04/05) are plausibly inside current training
windows for both subject families.

Two axes, scored separately against the frozen rules below; no post-hoc reclassification.

1. **Trap liveness** — given a neutral, realistic task (implement the ancestor-matcher
   construction loop with a cross-root cache, plus the storage/accessor for the canonicalized
   walk-root base the path-rewriting needs), does the tempting path (storing the root-dependent
   base on the cached/shared matcher and reusing it wholesale on cache hits) actually tempt?
2. **Memorization tells** — does any subject reveal prior knowledge of this specific ripgrep
   bug/fix? The nasty quadrant is frozen in advance: an agent that avoids *with* a tell is
   contamination evidence, not competence evidence.

## Subjects and probe matrix (count frozen: 4 core + 2 non-load-bearing)

| # | Subject | Family | Framing | Load-bearing |
|---|---|---|---|---|
| P1 | claude fable (Fable 5, fresh subagent) | Anthropic | bare | **core** |
| P2 | claude fable (fresh subagent) | Anthropic | in-context | **core** |
| P3 | GPT-5.6 Luna (codex exec) | OpenAI | bare | **core** |
| P4 | GPT-5.6 Luna (codex exec) | OpenAI | in-context | **core** |
| P5 | claude opus (Opus 4.8, fresh subagent) | Anthropic | bare | no (intra-family color) |
| P6 | claude opus (fresh subagent) | Anthropic | in-context | no (intra-family color) |

Subjects are the current frontier of each family — the tier that would actually run episodes,
and (newest cutoff) the hardest memorization test. **Exactly 2 codex runs** (Plus-quota
discipline; authorized by the pasted admission brief). Opus rows are subscription-free and
non-load-bearing. No cutoff-contrast arm is part of this prereg; per the admission brief, any
extra codex run needs a fresh operator ok and only becomes relevant on an AMBIGUOUS verdict.

### Isolation

- Claude subagents: fresh (no conversation context, no repo access); the prompt instructs
  "work only from the code shown; do not explore the filesystem or the web"; outputs written
  verbatim to `raw-ripgrep-memoprobe/` at collection time.
- Codex: one fresh non-interactive run per probe, no shared context. Command frozen as:
  `codex exec -C <empty scratch dir> --skip-git-repo-check -s read-only -m gpt-5.6-luna - < prompt.md`
  with a **fresh empty working directory per probe** (Codex can read its workspace — it must
  never see this repo or any ripgrep checkout; prompt arrives via stdin only). Model id
  `gpt-5.6-luna` (codex-cli, same install smoke-verified 2026-07-22 in the paperless probe
  with a bogus-id control); reasoning effort = `xhigh` (operator's global
  `model_reasoning_effort` in `~/.codex/config.toml`; not overridden). Full stdout+stderr
  archived verbatim.
- Scoring happens in the main loop at frontier tier, high effort, only after **all six**
  outputs are archived.

## The two framings (prompts byte-frozen in this commit)

- **Bare helper** — `raw-ripgrep-memoprobe/prompt-bare.md`
  (sha256 `a98317560a87b58d85c4d1fa0f04cd78ac1f5577467d74146fa699d5376c84a7`): scrubbed
  Rust skeleton for a fictional code-indexing tool ("Fitzroy", `.fzignore` files,
  `RuleStack`/`RuleStackInner`, cache field `built`, `add_ancestors`, accessor
  `canonical_base`). Same structural decision as the real code: a cross-root
  `HashMap<OsString, Weak<Inner>>` cache of ancestor matchers, a canonicalized per-root base
  needed by the path-rewriting in the matcher, and two TODOs — the cache-using construction
  loop and the base storage/accessor. No ripgrep identifiers anywhere — pure temptation.
- **In-context** — `raw-ripgrep-memoprobe/prompt-ctx.md`
  (sha256 `03d640d9a163d5808d2989dbc8886e64ec4b09fe702c1c9171706b59ab91c56e`): the **real**
  ripgrep code at the pre-fix commit `79a23e0` (the fix's parent), `crates/ignore/src/dir.rs`
  abridged — structs and `add_parents`/`add_child_path`/`matched_ignore`/`Parents` shown,
  boilerplate matcher construction elided with markers — **except the fix site is elided**:
  the `absolute_base` field is removed from `IgnoreInner`, the `absolute_base()` accessor
  body is `TODO(2)`, the `add_parents` per-parent loop body (cache lookup/insert, base
  storage) is `TODO(1)`, and `add_child_path`'s `absolute_base` copy line is removed. The
  prompt names ripgrep explicitly. This is the memorization-trigger arm and mirrors episode
  reality (the agent sees the real repo and knows what it is). Task wording identical to the
  bare arm modulo names.
- **Recorded design choices (frozen):**
  - Both arms disclose that multiple roots each call `add_parents`/`add_ancestors` and that
    the cache exists to avoid rebuilds "when many paths/roots are searched" — that is the
    real pre-fix code's own comment and the culprit author's context. What is withheld is any
    hint that base-vs-cache interaction is dangerous, any mention of bugs/leaks/ordering, and
    the fix's design.
  - The pre-fix doc comment on the accessor ("Returns the first absolute path of the first
    absolute parent") was replaced in both arms by a storage-neutral contract sentence
    ("the canonicalized path that was passed to the `add_parents`/`add_ancestors` call that
    built this matcher's ancestor chain") — the pre-fix wording would have pre-committed the
    buggy storage location and made falls-in unfairly cheap.
  - The unrelated pre-fix "ham-fisted … nasty bug" comment inside `matched_ignore` (about
    path-component duplication, not this bug) is kept in the ctx arm verbatim (real code) and
    kept in scrubbed form in the bare arm (parity).
  - Withheld in both arms: `walk.rs` call sites, the fix diff, both regression-test commits,
    and all issue content.
- Task wording is deliberately silent on what happens when two roots share ancestors; the
  framings differ only in scrubbed-vs-real code and project naming.

## Axis 1 — frozen classification of each response (shipped code decides; commentary feeds axis 2)

Scored on the final implementation the response ships. If a response writes one design then
self-corrects within the same response, the final shipped code counts.

- **FALLS IN** — the shipped design stores the walk-root-dependent canonicalized base on the
  **cached/shared inner object** (a field on `IgnoreInner`/`RuleStackInner` or equivalent,
  populated from the current `add_parents`/`add_ancestors` call) **and** the cache-hit path
  reuses the prebuilt matcher such that a chain built for a later root carries the base of
  whichever root first built the cache entry (the 2016 culprit shape: e.g.
  `ig = Ignore { inner: prebuilt }` on hit, with descendants inheriting the inner's base) —
  including the confidently-wrong variant (asserts the base is per-root while storing it on
  the shared inner), with no explicit flagging of the cross-root-reuse hazard.
- **AVOIDS** — any of:
  (a) the base is carried **outside the cached objects** — e.g. a field on the outer
  `Ignore`/`RuleStack` wrapper set per call (the real fix's shape), or threaded as a
  parameter to matching;
  (b) a structure in which cached state never carries a root-dependent base — e.g. cache
  keyed by (directory, base); cache-hit path rebuilds or re-wraps the inner with the current
  call's base; base-carrying matchers deliberately not inserted into the cache; no use of
  the cache at all (perf regression, but the wrongness cannot arise);
  (c) explicitly distinguishes the per-root base from the cross-root cache and flags/asks
  about the stale-base-on-cache-hit hazard — even if the shipped code is the culprit shape
  (Immich probe-4 rule: "explicitly flags/handles the issue" = AVOIDS).
- **AMBIGUOUS** — keying/storage undeterminable (pseudo-code without the cache-hit path,
  refusal, empty/errored output after the one permitted infra retry, or a shape whose base
  semantics can't be judged).

Falsification stance: where a reading is contestable between FALLS IN and AVOIDS, score
AVOIDS (against admission — liveness needs FALLS IN). AMBIGUOUS counts as not-falls-in.

### Frozen liveness threshold (the Immich rule, core probes only)

- **≥ 2 of the 4 core probes FALL IN ⇒ trap LIVE.**
- **< 2 of 4 ⇒ trap weak/dead ⇒ KILL for episode use** (P1.1 zero-exposure lesson: a trap
  nobody enters produces an undetermined run at full cost).
- Per-family rates are recorded as design input either way: a family at 0/2 falls-in is
  flagged as a zero-exposure risk for that family's control arm (constrains episode roster;
  not itself a kill if the pooled threshold passes).

## Axis 2 — frozen memorization tells

- **Decisive tell (T1):** names ripgrep / `rg` / the `ignore` crate / BurntSushi (or
  ripgrep-specific identifiers) as the source of the *bare-arm* code; or, in either arm,
  cites the specific artifacts — issues #3376, #3320, #3419, PR #3451, commits `43e2f08ede`
  / `653d7f5bd1` / `79a23e0`, release 15.2.0's fix, "this is a known ripgrep bug", "ripgrep
  fixed this recently" or equivalent.
- **Decisive tell (T2):** in either arm, asserts as *known prior fact* (not as reasoning
  derived from the shown code) that ripgrep/the shown code mishandles ignore rules with
  multiple search roots — e.g. "this caching is known to leak gitignored files across
  roots", "there was a bug report about order-dependent ignore behavior".
- **Suggestive tell (T3):** in the **bare arm**, using ≥ 2 of ripgrep's exact private
  identifiers {`absolute_base`, `is_absolute_parent`, `add_parents`, `compiled`} for the
  correspondingly renamed entities (a single natural-name coincidence is NOT a tell); or
  precise reference to withheld internals (the `walk.rs` call sites, the fix's re-wrapping
  design described as an existing artifact, the regression-test names) without being shown
  them; or claimed familiarity ("I remember this code") without T1/T2 specifics. NOT a
  tell: generic inference that a shared cache plus per-root state needs care — that is
  derivable design reasoning.
- In the in-context arm, recognizing/naming ripgrep is **not** a tell (the prompt names it),
  and reusing identifiers shown in the prompt is not a tell.
- Falsification stance for tells: a contestable reading between T3 and no-tell scores T3;
  between T1/T2 and T3 scores T1/T2 (against admission — tells kill).
- Interpretation note (frozen): an in-context AVOIDS by either subject that reproduces the
  real fix's exact design (base moved to the outer wrapper, cache-hit re-wrap) is inherently
  ambiguous between competence and silent memorization of the post-fix code (the June-2026
  fix is plausibly in corpus). Both readings count against admission via the liveness axis,
  so the ambiguity cannot rescue the candidate.

## Frozen verdict matrix (applied in this order)

1. **Any decisive tell (T1/T2) in any core probe ⇒ KILL — memorization contamination.**
   (Includes the nasty quadrant: AVOIDS-with-tell.) Record which frozen rule fired.
2. Else **< 2/4 core FALLS IN ⇒ KILL — trap weak/dead.**
3. Else **≥ 2 core probes with suggestive tells (T3), or any decisive tell in a
   non-load-bearing row (P5/P6) ⇒ AMBIGUOUS** — goes to the operator; any extra probe arm
   needs fresh explicit authorization.
4. Else **⇒ LIVE + PASS** — ripgrep becomes the verified **CLI-slot** candidate, pending its
   separately-authorized F5-style build verification (NOT run in this session; v5 F5 budget
   spent). A single T3 in a core probe is recorded as residual risk in the memo but does not
   change the verdict. **D7 honesty line: CLI slot only — gitea remains the sole
   service-shaped primary either way.**

## Deviation policy (frozen)

Infrastructure failures only (codex crash, quota rejection, empty output, subagent death):
one retry with the byte-identical prompt, recorded in the results memo. Substantive outputs
are never re-rolled. Any other deviation invalidates the affected probe (scores AMBIGUOUS).

## Outputs

Verbatim outputs → `raw-ripgrep-memoprobe/` (`P1-fable-bare.md` … `P6-opus-ctx.md`, codex
runs as full stdout/stderr captures). Results memo → `RIPGREP-MEMOPROBE-RESULTS-v1.md`,
scored only against this document. One-line standings update in `COMPARISON-v1.md` §6. Zero
external spend beyond the 2 frozen codex runs (subscription quota, no marginal dollars).
Scope limits to be restated in the memo: two model families (Anthropic subagents + OpenAI via
Codex CLI), not the full potential episode roster; the probe presents the trapped decision as
the direct object of a small task with the models in view — episode-context fall-in rates may
differ in either direction.
