# Amigos-1 ingest notes v1 — E5 Stage-1 prereg draft v2 external panel

Reconciliation session 2026-07-23 (fresh main-loop session, zero model spend: reads +
writing only). Panel per `docs/e5/E5-STAGE1-AMIGOS-PROMPTS-v1.md` (7 models, 3 roles).

## Archive provenance

- **Pre-synthesis archive commit: `dc22172`** — all seven raw outputs committed verbatim,
  byte-untouched.
- **Protocol deviation (recorded):** the reconciliation brief's precondition was that the
  raw archive be committed *before* this session. The files were on disk but uncommitted
  when the session opened. Remedy applied: the archive commit was made as this session's
  FIRST action, before any raw output was read or any synthesis occurred, and no file
  content was modified. The evidentiary intent (raw outputs frozen before reconciliation
  can influence them) is preserved; the letter of the precondition was not.

## Per-reviewer ingest

| Model | Role | Raw file | Collected | Deviations / notes |
|---|---|---|---|---|
| Kimi 2.6 Instant | Product/Business | `kimi26-product.md` | 2026-07-23 (operator) | One preamble sentence before section A (harmless format drift). Otherwise format-compliant; 12 findings; 5 [VERIFY] claims, all self-flagged judgment calls. No settled-input re-litigation. |
| ChatGPT Sol 5.6 (high) | Product/Business | `chatgpt-sol56high-product.md` | 2026-07-23 (operator) | Fully compliant; 11 findings; section E states "no new factual claims" — verified true (all reasoning is internal to the plan text). No settled-input re-litigation. |
| Qwen 3.8 Max (preview) | Development | `qwen-38maxpreview-dev.md` | 2026-07-23 (operator) | Fully compliant; 15 findings (at cap); 5 [VERIFY] claims, all checked here (see reconciliation §4). No settled-input re-litigation. |
| GLM 5.2 | Development | `glm-52-dev.md` | 2026-07-23 (operator) | Fully compliant; 15 findings; 4 [VERIFY] claims incl. an honest "I cannot verify claude-fable-5 exists" — checked here. No settled-input re-litigation. |
| DeepSeek 4 Pro | Testing/QA | `deepseek-4pro-qa.md` | 2026-07-23 (operator) | Fully compliant; 20 findings (at cap), of which #17–#19 are self-answered non-findings (reviewer attacked, then conceded the plan's handling — recorded as evidence of the draft's clarity, not defects). 2 [VERIFY] claims. |
| Claude Fable 5 (max) | Testing/QA | `claude-fable5max-qa.md` | 2026-07-23 (operator) | Fully compliant; 20 findings; 2 [VERIFY] claims (binomial arithmetic — independently recomputed here, correct; provider-drift-under-pinned-ID — accepted as an external-world assumption). **Same-family caveat applies** (§1 of the prompts kit): weight assessed per finding; most Fable findings are novel technical attacks (F1/F2/F5) or converge with non-Anthropic reviewers (F3/F4/F6/F18), which restores full weight under the stated rule. |
| Gemini 3.1 Pro | Testing/QA | `gemini-31pro-qa.md` | 2026-07-23 (operator) | Format-compliant but the shortest output (10 findings). Two findings rest on premises the reviewer could not verify and flagged: the shared-budget timeout model (F1) and internal-API hidden tests (F2) — both existence-checked in the reconciliation (first false as a design necessity, second mostly false at corpus level: 58/196 test files drive the program via subprocess/pty CLI, 6 import agent modules). Ingested with premises corrected; the underlying guardrails survive on their merits. No settled-input re-litigation. |

## Misunderstanding evidence (draft-clarity signal)

- Gemini read the attempt budget as a shared per-checkpoint pool (making a post-timeout
  revise turn "impossible"). The draft never states the revise-turn budget — this is
  evidence the §4 mechanics are underspecified (independently found by Qwen #2/#11),
  not reviewer error alone. Resolved in v3 (ledger A18).
- No reviewer misread the estimand, the arm structure, the staging ladder, or the
  hidden-referee architecture. All seven worked inside the settled design.

## Verdict lines as stated (tally in RECONCILIATION-v1 §5)

All seven: **"fix first."** Zero "ready for freeze." Zero "structural concern."
(Gemini labeled one finding "(Structural)" inside a fix-first verdict; the finding's own
fix is a rule amendment and its premise was corrected on verification — it does not meet
the methodology's structural-branch definition. Adjudicated in RECONCILIATION-v1 §5.)
