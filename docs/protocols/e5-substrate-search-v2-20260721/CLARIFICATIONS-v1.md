# Substrate search v2 — scout clarifications

Prompt: `docs/e5/SUBSTRATE-SEARCH-V2-PASTE-READY.md`. All scouts get identical answers; if a
later scout asks a question already answered here, paste the recorded answer verbatim. Append
new exchanges as they happen, with the date and which scout asked.

---

## Exchange 1 — 2026-07-21 (asking scout: _operator to record model + version_)

**Q1.** Must the "public API, CLI, or HTTP boundary" be *explicitly documented* as such (official
docs or SDKs), or does an *implicitly stable interface* (a widely used but undocumented CLI flag
or JSON-over-HTTP endpoint) suffice for scenario execution?

**A1.** Documentation is evidence, not the requirement. The boundary must satisfy three things:
an off-the-shelf scenario runner can invoke it; it stays stable across the 4–8 change window (so
scenarios only churn when behavior genuinely changes); and a skeptical engineering leader would
accept scenarios against it as testing the product's behavior rather than its internals. A
widely used but undocumented CLI flag or JSON-over-HTTP endpoint passes that test; a private
function or internal module does not, however stable. If you nominate an implicitly stable
interface, state the evidence of de-facto stability (external users, examples in the wild,
compatibility guarantees honored in practice) — that claim gets verified along with everything
else. One addition: the boundary must be invocable at the point in the sequence where each
change's scenarios need it. A surface introduced mid-chain is fine (introduce-then-use is a
shape I asked for); a surface that only exists after the final change is not.

**Q2.** For contamination risk: prioritize repositories where the change sequences are *internal
refactoring or infrastructure work* (less likely to be memorized) over *user-facing features
covered in blogs or release notes*, even if the latter have clearer dependency mechanisms?

**A2.** Do not invert the priorities, for two reasons. First, purely internal refactoring and
infrastructure chains usually fail the public-boundary requirement: if the work never manifests
at the public boundary, there is nothing for acceptance scenarios or held-out tests to observe,
and the candidate dies regardless of how clean its dependencies are. Second, be precise about
what memorization actually costs: both experimental conditions use the same model, so a
memorized fix does not bias one arm against the other — it collapses the task's difficulty, both
arms saturate, and the experiment measures nothing. The failure mode is a wasted run, not a
false result. So: recency is the primary defense (post-January-2026 merges), the proposed
memorization check is the second, and "internal vs user-facing" is at most a tiebreaker between
otherwise-equal candidates. A user-facing sequence with named dependency mechanisms beats an
internal one with vaguer mechanisms even if it shipped with a blog post.

**Q3.** For the scorecard's "risk that passing visible scenarios merely teaches to the test":
is the evaluation whether the *held-out tests* are structurally distinct from visible ones
(different code paths, edge cases), or whether the *public surface itself* is rich enough that
mimicking it without real understanding is unlikely?

**A3.** Primarily the first, with the second as a contributing cause. What is being scored is
whether the visible scenarios underdetermine the requirement: could an implementation satisfy
every visible scenario while still being wrong in ways the held-out tests would catch? If
visible and held-out checks are near-duplicates of each other, passing one trivially entails
passing the other, transfer is perfect by construction, and the measurement is meaningless. The
held-out tests should probe the same requirement through different routes — different code
paths, edge cases, interactions with earlier changes in the sequence — so that shortcut
implementations are detectable. Surface richness matters as an input to that: a thin surface
(one flag, one output format) means a single visible scenario pins nearly all observable
behavior and leaves the held-out set no room to disagree. Score the structural gap between
visible and held-out as the dimension itself, and treat a rich public surface as what makes such
a gap possible.

---

## Folder conventions (from the Step 1 precedent)

- One file per scout, named by exact model version (e.g. `chatgpt-5-6.md`), raw output pasted
  verbatim and untrimmed — hedging and refusals included.
- Merged shortlist goes in `COMPARISON-v1.md`, written only after all three raw files are in,
  linking back to the prompt doc and this file.
- Program-note: the P1.1 connection behind A2's "wasted run, not false result" framing — both
  arms saturating so the lever has nothing to act on is exactly the zero-lever-exposure failure
  the paused probe hit — is recorded here so the writeup keeps the framing consistent. It was
  not shared with the scouts.
