# Experiment-artifact preservation convention (v1)

Date: 2026-06-23. How E2 (and future) run artifacts are preserved so that every SHA-256 cited in a
paper / run-card / commitments doc is **verifiable**, without bloating the code repos. Two tiers:

## Tier 1 — Distilled summary (committed; the evidence)

A small, machine-readable `*.summary.json` is committed next to each run-card in
`hit-sdd-bench/docs/run-cards/`. It carries the actual claim-backing data — per-task and pooled
control/treatment self-verification-gap & resolve rates, the family-wise verdict(s), the run's
`model_route`, and the **SHA-256 of the full artifact** — in a few KB that diff cleanly across runs.

Generate with the harness tool (stdlib-only):

```sh
cd ~/dev/hit-sdd-bench-e2
python examples/emit_run_summary.py <artifact>.json \
  -o ~/dev/hit-sdd-bench/docs/run-cards/<run-id>.summary.json
```

Committed so far: `e2-phase1-5-causal-pilot-deepseek-v4-pro.summary.json`,
`e2-phase1-5-causal-pilot-qwen3.7-max-20260623.summary.json`.

## Tier 2 — Full raw artifact (preserved out-of-tree; the audit trail)

The full run JSONs (records, per-test outcomes, patches once persisted) are **large and gitignored**
(`e2-phase1-*.json`) — they must NOT go into the code repos' main history (permanent bloat). They are
preserved **immutably and retrievably**, referenced by SHA-256, via a release asset:

```sh
# requires a git remote + a tag; gated by the project's pre-public status (see below)
gh release create <tag> --notes "E2 artifacts <tag>" --draft   # once per release
gh release upload <tag> e2-phase1-5-causal-pilot-qwen3.7-max.json \
                        e2-qwen3.7-max-contam-screen-n13-20260620-001.json
# verify: shasum -a 256 <file> must equal the SHA cited in the run-card / summary / paper
```

A DOI'd archive (e.g. Zenodo) is added at publication for citeable permanence.

## Current state & prerequisite (honest)

- **Tier 1 is live** (summaries committed).
- **Interim Tier-2-in-tree:** because no remote/release target exists yet, the specific raw artifacts
  **cited by SHA in sealed docs** (the qwen GATE-B contamination screen + the Codex/Claude gap probes)
  are committed **directly into `hit-sdd-bench-e2`** so the cited hashes resolve. This is a pragmatic
  exception to "raw outputs out of tree"; migrate them to release assets and drop them from the tree
  once a remote is stood up. Uncited/superseded run-outputs stay untracked.
- **Tier 2 is not yet executable: neither repo has a git remote.** Until the repos are pushed to a
  remote, the full artifacts (and the repos themselves) live only on the operator's machine, so the
  cited SHAs currently resolve only to **local** files. Standing up a remote is **gated by the
  project's pre-public posture** ("not ready for public validation claims") — start with a **private**
  remote for durability; make artifacts public only at release. This is an operator decision.
- Verification today: `shasum -a 256 <local artifact>` matches the `artifact_sha256` in the summary /
  the SHA in the run-card / paper.

## Rule of thumb

Commit the **distilled evidence** (small, diffable); preserve the **raw artifact** out-of-tree
(immutable, SHA-addressed). Never commit large raw run outputs into main history; never let a cited
SHA dangle without a retrievable copy once a remote exists.
