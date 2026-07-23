# Adversarial-1 ingest notes v1 (2026-07-23)

Archive of the continuation-design adversarial panel results (prompt:
`docs/e5/E5-DESIGN-DECISION-PANEL-PROMPT-v1.md`, operator-run, one fresh chat per model,
pasted verbatim). Seven files, all **sequential mode** (Part A design answered before the
Part B attack; every file contains both parts). Provenance headers were prepended at
ingest; bodies are untouched operator pastes. Model labels are the operator's filenames —
version strings were not otherwise supplied.

| file | operator label | mode |
|---|---|---|
| `GLM52.md` | GLM52 | sequential |
| `Minimax3.md` | Minimax3 | sequential |
| `chatgpt-sol56-high.md` | chatgpt-sol56-high | sequential |
| `claude-fable-max.md` | claude-fable-max | sequential |
| `deepseek.md` | deepseek | sequential |
| `kim26.md` | kim26 | sequential |
| `qwen-38-max-preview.md` | qwen-38-max-preview | sequential |

## Duplicate-paste incidents resolved at ingest (no content lost)

1. **Prompt-file head stash.** An unlabeled Part A answer (5,897 bytes) sat above the doc
   header of `E5-DESIGN-DECISION-PANEL-PROMPT-v1.md`. Byte-comparison shows it is an exact
   prefix of `GLM52.md` (no divergence within its full length) — i.e., a duplicate paste of
   GLM52's Part A, not a distinct eighth result. Provenance therefore resolved by content
   match, not guessed. The stash was removed from the prompt file; the canonical copy lives
   in `GLM52.md`. No separate relocated file was created because it would be a byte-identical
   duplicate of an already-archived result.
2. **Synthesis-brief head paste.** The working copy of
   `E5-ADVERSARIAL-1-SYNTHESIS-BRIEF-v1.md` had 25,038 bytes pasted above its title;
   byte-comparison shows it is an exact prefix of `qwen-38-max-preview.md` (which is the
   fuller, complete document). The brief was restored to its committed state via git; the
   canonical copy lives in `qwen-38-max-preview.md`.

## Standing caveats (bind the synthesis)

- Panel outputs are leads with **zero inherited credibility**; any factual or citation
  claim we would rely on must be independently re-verified.
- Sequential-mode Part A answers may be imperfectly blind (models can read ahead in a
  pasted prompt); convergence is weighted accordingly.
- Panel models could not read either codebase; fork-vs-plug input is checklist-only.
- The three disclosed doubts (retry asymmetry, self-verification policy, visibility
  realism) were given to the panel — echoes of them are confirmation, not discovery.
