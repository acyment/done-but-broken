# E2 headline artifact inventory (2026-07-20)

**Status note added 2026-07-20.** This document was not written contemporaneously with the runs it
describes. It exists to make a gap visible, not to close it: as of this date, the raw JSON artifacts
backing the E2 program's published headline results are **untracked in git** and exist only as local
files on the operator's machine. This note does not change that fact; it records it, lists exactly
what is at risk, and gives every file a verifiable checksum so the evidence stays recoverable even
while untracked.

## Why they are untracked (investigated, not assumed)

`hit-sdd-bench-e2/.gitignore:16-17` (added in commit `1f968de`, 2026-06-14) reads:

```
# run outputs (authoritative record is in hit-sdd-bench/docs/run-cards)
e2-phase1-*.json
e2-phase1-*.run-card.md
```

This is a **deliberate, documented** exclusion, not an oversight or a size-driven default. The design
is spelled out in `docs/artifact-preservation-convention-v1.md` (2026-06-23), which defines a
two-tier scheme:

- **Tier 1 (committed):** a small `*.summary.json` per run, checked into
  `hit-sdd-bench/docs/run-cards/`, carrying the claim-backing numbers and the **SHA-256 of the full
  raw artifact**. This tier is live — the DeepSeek and qwen pilot summaries are committed and tracked
  (`docs/run-cards/e2-phase1-5-causal-pilot-deepseek-v4-pro-20260617-001.summary.json`,
  `docs/run-cards/e2-phase1-5-causal-pilot-qwen3.7-max-20260623.summary.json`).
- **Tier 2 (out-of-tree, SHA-addressed):** the full raw run JSON is meant to be preserved
  **immutably outside the code repo** — via a GitHub release asset (`gh release upload`), verified
  against the SHA cited in the Tier-1 summary — specifically so it does not bloat the repos'
  permanent history.

The convention doc itself states the prerequisite has never been met: **"Tier 2 is not yet
executable: neither repo has a git remote."** A small number of SHA-cited files (the qwen GATE-B
contamination screen, the Codex/Claude gap probes) were committed directly into the tree as a
documented interim exception (commit `862e0e2`, "note interim in-tree preservation of SHA-cited
evidence"). The three headline pilot artifacts and the black-4684 file were **not** included in that
exception and remain outside git entirely.

**Net effect, stated plainly:** the intended preservation mechanism (Tier 2 release assets) has never
run, because there is no remote. So today these files have **zero version-control durability** —
not even a local commit — despite backing the program's published claims. This is a real gap even
though the exclusion rule itself was a deliberate design choice, not negligence.

**Confirms `.gitignore` targets a specific filename pattern, not "large JSON in general":** the e2
repo already tracks other large JSON files that do not match the pattern — e.g. `uv.lock` (1.3 MB),
`stage0-cal-e2-flash-screen.json` (148 KB), `stage0-cal-e2-phase1-5-causal-pilot-deepseek-v4-pro.json`
(92 KB). Size alone does not explain the `e2-phase1-*` exclusion; the filename pattern does.

## Total size of the affected files

**15 files, 1,588,921 bytes (≈ 1.52 MiB) total** — well under the ~25 MB threshold this task used as
a decision boundary.

## Recommendation (operator decision — `.gitignore` was not changed)

Given (a) the total size is small (~1.5 MB, not the multi-hundred-MB range the Tier-2 policy was
written to avoid), and (b) the documented Tier-2 mechanism cannot run today (no remote exists) and has
no committed timeline, the artifacts backing the two published headline claims currently have **no
durable copy anywhere but this machine**. Two options, either of which requires an operator decision
(this note does not act on either):

1. **Track the three headline-relevant files directly in git now** (deepseek pilot, qwen pilot,
   the black-4684 file — see below) as an interim durability measure, overriding the `.gitignore`
   pattern for these specific paths, until a remote + release-asset flow exists. This is a narrow,
   reversible exception, not a reversal of the Tier-2 design.
2. **Stand up a remote (private, per the project's pre-public posture) and execute the documented
   Tier-2 flow** (`gh release upload`) now, which was always the intended mechanism.

Either closes the gap; doing neither leaves the published headline without any recoverable backing
beyond this inventory's SHA-256 list and the operator's local disk.

## The inventory

All paths are absolute, on the operator's machine, in the `hit-sdd-bench-e2` repo working tree.
SHA-256 computed 2026-07-20 via `shasum -a 256`. Each SHA was cross-checked against the
`artifact_sha256` field recorded in the corresponding committed `docs/run-cards/*.summary.json` where
one exists — both matched exactly (see notes below the table).

| # | File | Size (bytes) | SHA-256 | What it contains |
|---|---|---:|---|---|
| 1 | `/Users/acyment/dev/hit-sdd-bench-e2/e2-phase1-5-causal-pilot-deepseek-v4-pro.json` | 305,864 | `009b00e8c5b92b7a2f91d0a16d33847de13a1e6560daea8b24b1d6ceb6e61632` | **Published headline artifact.** Raw records (180) + analysis backing the sealed DeepSeek V4 Pro causal pilot run-card: 9 tasks, 8/9 hits, family-wise p≈3.36×10⁻¹⁰. |
| 2 | `/Users/acyment/dev/hit-sdd-bench-e2/e2-phase1-5-causal-pilot-qwen3.7-max.json` | 389,903 | `6484243829a5ee36f07dc44c7529807ced312a0f2a39b746fd804fafa4e2ce62` | **Published headline artifact.** Raw records (260) + analysis backing the sealed qwen 3.7 Max second-lineage replication run-card: 13 tasks (black-4684 excluded/errored), n=9 primary 5/9 hits p≈3.3×10⁻⁵, all-valid 6/12 p≈1.1×10⁻⁵. |
| 3 | `/Users/acyment/dev/hit-sdd-bench-e2/e2-phase1-5-PLUS-black4684-CONTAMINATED-do-not-cite.json` | 319,537 | `9dc7e3a0bcdf2b142209b0f835e7f2a6ea17a4af59e7cf6b091847e297488212` | Same `run_id` as file #1 (DeepSeek), but a 10-task superset that includes complete, clean `psf__black-4684` data: 9/10 hits, p≈1.865×10⁻¹¹ (stronger than the published version). Subject of the companion note `e2-black4684-exclusion-note-20260720.md`. |
| 4 | `/Users/acyment/dev/hit-sdd-bench-e2/e2-phase1-5-flake-certify-poolv2-20260615-001.json` | 514,496 | `813c49448678461098bedfc6a527e0b550fad90af613b1ee813d29a3da6d2ba6` | N=60 flake-certification raw output for all 13 candidate-pool-v2 tasks; backs Addendum B's certified task table (SHA cited there matches). |
| 5 | `/Users/acyment/dev/hit-sdd-bench-e2/e2-phase1-5-flake-smoke-20260614-001.json` | 4,368 | `2a73f77c6c40c6a9d430b9756393db72a6991110b9cff5ae411e730a75fa5c63` | Pre-certification flake smoke test, 13 tasks, `classification: calibration`. Scaffolding, not evidence. |
| 6 | `/Users/acyment/dev/hit-sdd-bench-e2/e2-phase1-5-flake-smoke-prebaked-20260614-001.json` | 1,861 | `275a1ccf6753648df10775fb84676cec17acb5eaaab647349021d81d1d815607` | Flake smoke, prebaked-image variant, 9 tasks, `classification: calibration`. |
| 7 | `/Users/acyment/dev/hit-sdd-bench-e2/e2-phase1-5-flake-smoke-prebaked-lightest-20260614-001.json` | 1,861 | `275a1ccf6753648df10775fb84676cec17acb5eaaab647349021d81d1d815607` | Byte-identical to #6 (same SHA-256) despite the different filename — a "lightest" variant run that produced the same output. |
| 8 | `/Users/acyment/dev/hit-sdd-bench-e2/e2-phase1-5-flake-smoke-prebaked-midband-20260614-001.json` | 1,455 | `73c5d62677fef44ddb8e00ad996db741542cf515f8b395397380d8e0b8c64884` | Flake smoke, "midband" variant, 6 tasks, `classification: calibration`. |
| 9 | `/Users/acyment/dev/hit-sdd-bench-e2/e2-phase1-5-flake-smoke-prebaked-v2-20260615-002.json` | 5,357 | `2af03ff8d4148849802aa5abf0fc71383ac85292d2bd71a69006da173127f56a` | Flake smoke v2, prebaked, 28 tasks, `classification: calibration`. |
| 10 | `/Users/acyment/dev/hit-sdd-bench-e2/e2-phase1-5-gateb-poolv2-new-deepseek-v4-pro-20260615-001.json` | 5,590 | `d59de9bd34b0901712c3b807b068e1e36c30a44d3dbf5d98dd9c0600167b8215` | GATE-B contamination screen raw output for the 10 new pool-v2 candidate tasks; contains the row confirming `psf__black-4684` screened clean (`excluded: false`). |
| 11 | `/Users/acyment/dev/hit-sdd-bench-e2/e2-phase1-5-pool-screen-deepseek-v4-pro-20260614-001.json` | 30,615 | `46f80d1dc586a52988499e1587599cf06dd730323aed050a3f883dbd7bca356b` | Memorization/contamination screen for **candidate pool v1** (40 tasks; superseded before the causal pilot ran — does not include black-4684, freezegun, casbin, django-guardian, etc.). |
| 12 | `/Users/acyment/dev/hit-sdd-bench-e2/e2-phase1-5-qwen3.7-max-SMOKE-20260620-001.json` | 2,778 | `c89339821032bcc76661070eccf62dfccbc2e0827510aca14126ea79172240f1` | Small smoke/dry-run (2 records) of the qwen route before the full replication run. |
| 13 | `/Users/acyment/dev/hit-sdd-bench-e2/e2-phase1-gate-deepseek-v4-pro-20260614-001.json` | 538 | `23b046e5263cc52ccaf01948ff501936a30e0b3bda3b22ab1d2587cb5e007367` | Tiny gate-check record (memorization hit rates + flake dict) from the earliest phase-1 dry-run. |
| 14 | `/Users/acyment/dev/hit-sdd-bench-e2/e2-phase1-subpilot-deepseek-v4-pro-20260614-001.json` | 3,686 | `6ea4c67b06bdaabfe45ea34884ac327b63beab8f4df21bc18bd50c616fd3bb15` | First real two-arm sub-pilot (freezegun-582 + MechanicalSoup-455, N=1/arm) — a calibration precursor, per commit `1f968de`. |
| 15 | `/Users/acyment/dev/hit-sdd-bench-e2/e2-phase1-subpilot-deepseek-v4-pro-20260614-001.run-card.md` | 1,012 | `aa6b423a20256a6ecfa503563ca40f0037c6a97e53b6f27ca2d66c5bc5ce708f` | Run-card for #14. |

**Total: 1,588,921 bytes (≈1.52 MiB).**

### Integrity cross-checks performed

- File #1's SHA-256 matches `artifact_sha256` in the tracked
  `docs/run-cards/e2-phase1-5-causal-pilot-deepseek-v4-pro-20260617-001.summary.json` exactly.
- File #2's SHA-256 matches `artifact_sha256` in the tracked
  `docs/run-cards/e2-phase1-5-causal-pilot-qwen3.7-max-20260623.summary.json` exactly.
- File #4's SHA-256 matches the SHA cited in
  `docs/protocols/e2-phase1-pilot-commitments-v1-addendum-b.md`.

These three matches are a meaningful (if partial) integrity check: the local files on disk today are
byte-identical to what was hashed and cited at the time the corresponding run-cards were sealed. They
do **not** prove the files were never altered between sealing and today — git history is exactly the
guarantee that is missing — only that they match the one external record of what they should be.

## What this note does and does not establish

- It establishes that these files are untracked as of 2026-07-20, gives each a verifiable checksum,
  and records the (real, documented) reason they were excluded from `.gitignore`.
- It does **not** track them in git — `.gitignore` was not modified. Whether to track the headline
  three, stand up a remote, or do both is an operator decision (see Recommendation above).
- It does not certify these files are unmodified since the runs completed — only that they match the
  three external SHA citations checked above.
