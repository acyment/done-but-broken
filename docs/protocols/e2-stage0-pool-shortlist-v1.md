# Stage-0 pool shortlist v1 (screened + hand-reviewed)

**Status**: selection record, 2026-07-03. Pipeline: mechanical screen over SWE-bench-Live
(1000 → 86 qualified; `pool_screen.py`, signals from
`e2-frontier-gap-task-selection-synthesis-v1.md`) → top-20 hand review by 3 parallel reviewers
(issue text + gold patch + test patch, shared rubric: authorability / offline black-box
observability / mechanism fit / hazards). Verdicts: 11 KEEP, 4 MAYBE, 5 DROP.

**Classification discipline**: selection only; no runs, no causal claims. Mechanism labels are
priors from the synthesis doc. Admission remains the authoring gates (incl. k-diverse +
spec-lawyer) at screen/seal time.

## Shortlist (6 tasks, diversity-capped at 2 per repo)

| # | Task | Fix shape | Mechanism (prior) | Key trap |
|---|---|---|---|---|
| 1 | `conan-io__conan-15573` — `graph build-order --reduce` | 58 ln / 2 files | wiring-rewiring + preservation + cross-invocation file state | pruning must RECONNECT transitive depends edges (filter-only leaves dangling refs while looking pruned); default output byte-identical without `--reduce`; reduced file serialized with `"reduced": true` and `build-order-merge` must REFUSE it — needs a file round-trip the agent won't do |
| 2 | `pydata__xarray-9765` — CF `grid_mapping` parsing | 53 ln | wide input classes + preservation stated in the issue | three grid_mapping formats each with MVCE; the issue itself warns the naive fix ("add to CF_RELATED_DATA_NEEDS_PARSING") breaks the working case; shared parsing path also serves `cell_measures`/`formula_terms` (fix one, break the other) |
| 3 | `conan-io__conan-16415` — fail BUT still emit graph output | 96 ln / 6 files | convention-contradiction + wiring | "commands should generate same graph output but they should fail": exit≠0 AND full JSON/text/HTML output — against the raise-early convention; must hold across `graph info` AND `build-order` AND `build-order-merge`, all formats; gold removed the raise from formatters and routes through shared `_dispatch_errors` |
| 4 | `pydata__xarray-8946` — `where()` dtype preservation (numpy 2) | ~140 ln | input-class matrix + preservation | uint16+int scalar must stay uint16, but the full promotion matrix (int8, str, bytes, None, bool → object) plus preserved rules (float32+NaN stays float32) reaches fillna/concatenate paths beyond the MCVE; hazard: container must have numpy>=2 (verify at screen) |
| 5 | `pylint-dev__pylint-9654` — contextmanager-generator warning scope | ~20 logic ln | preservation of true positives (over-suppression trap) | "if there's nothing to clean up: the warning should not be generated" — but four existing true-positive cases must STILL warn; the tempting broad suppression silences them; gold's condition is narrow (yield-is-last-statement) |
| 6 | `fonttools__fonttools-3520` — duplicate lookup reference dedupe | 88 ln | order-preservation / convention | dedupe the duplicated lookup WITHOUT dropping the distinct second lookup and WITHOUT reordering (gold: order-preserving dict.fromkeys; a set()-based fix breaks lookup order); observable via feaLib compile + GSUB structure inspection |

## Alternates (in order)

- `conan-io__conan-17514` — config clean/reinit; storage-path preservation + in-process reinit
  state. Demoted only for the borderline-white-box reinit criterion (must be expressed via the
  public custom-command mechanism) and the 2-per-repo cap.
- `conan-io__conan-15504` — export-pkg → `conan list --graph` pipeline; the false-green path is
  precisely "never runs the downstream consumer". Tiny (2-line) gold fix keeps it as alternate.
- `wireservice__csvkit-1281` — `-C` ignores unknown columns incl. out-of-range indices/ranges,
  `-c` behavior preserved. Clean but 1-line fix = moderate trap density.
- `beetbox__beets-5561` — `database_change` fired exactly once; excellent authorability, likely
  too easy (issue links a reproducing test).

## Dropped with cause (selection hygiene)

- `instructlab__instructlab-2247` (CI grab-bag; GPU/network; 787 ln), `instructlab__instructlab-2004`
  (unobservable offline; gold contradicts the issue's requested default), `yt-dlp__yt-dlp-11425`
  (criterion not derivable from issue — needs Chromium-internals knowledge; white-box tests),
  `yt-dlp__yt-dlp-12714` (merged behavior not derivable from issue; fragile file:// harness),
  `apify__crawlee-python-1172` (internal refactor, 759 ln, white-box criteria),
  `kozea__weasyprint-2231` (461-ln flex rewrite; screenshot criteria; white-box box-tree asserts),
  `pydata__xarray-10066` (issue contains the exact repro+assert — self-verifiable; calibration
  filler at best), `conan-io__conan-16552` (blind spec would assert a prefix value that the gold
  patch changes to absolute — spec-vs-gold trap on the author's side).

## Integrity finding (worth recording independently)

`IBM__mcp-context-forge-562`: the **gold patch is defective** — `update_url_protocol(request)`
expects a `Request` but both call sites pass a string (AttributeError on any real SSE request);
the F2P test masks this by monkeypatching the function to identity. Any fair black-box spec would
fail the gold patch. Dropped, and a caution for anyone using SWE-bench-Live gold as ground truth:
this is exactly the "flawed oracle" class the OpenAI SWE-bench audit documented.

## Retrodiction note

The screener scored all four ORIGINAL Stage-0 candidates unqualified (freezegun-582:
rank 609/1000, score 1), consistent with the observed frontier saturation (6/6, gap 0.0). The
sealed freezegun-582 bundle remains valid as a mid-tier task.

## Next steps (each separately authorized)

1. Authoring screen (`--mode screen`) over the 6 shortlisted tasks — GLM + Docker spend; fills
   surfaces automatically; V5 prompts; deterministic gates + green-at-base pruning.
2. Seal survivors (`--mode seal`): flake N=60 + k-diverse + spec-lawyer.
3. Two-model control-only calibration over the sealed pool (frontier + mid-tier), then the MCID
   decision per the synthesis doc §6.
