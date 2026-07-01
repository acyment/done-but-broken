# E2 Authored-Spec — Offline-Pilot Sealed Commitments (v1)

Status: **SEALED — operator-authorized.** This pre-registers the authoring inputs and procedure for the
authored-spec **offline pilot** BEFORE any spec is authored, so pilot results cannot be cherry-picked.
Classification of the run it authorizes: **`calibration`** (feasibility + gate validation) — not causal
evidence, no public claim, **zero agent-under-test rollouts** (the spec runs against the gold + no-op
patches only).

Date sealed: 2026-07-01. Boundary: `E2 / authored-spec / HIT-SDD v1`. Read with the offline-pilot protocol
(`e2-authored-spec-offline-pilot-protocol-v1.md`), the base design, Addendum A, and Addendum B
(detection-only reframe — which governs where they conflict).

## Master seal (immutable, covers all code + inputs)
The whole deterministic pipeline — author prompts, JIT converter, gates, routes, compiler, driver, and the
filled SURFACES — is content-addressed by these git commits. Any change requires a new sealed-commitments
version.

| Repo | Remote | Sealed commit |
| --- | --- | --- |
| Harness (code + driver + SURFACES) | `acyment/done-but-broken-harness` | `31e6450b03f6965b92c98d28f8008f131086bf15` |
| Record (this doc + design/protocol) | `acyment/done-but-broken` | this commit |

## Pinned author inputs (SHA-256, first 16 hex — human-readable cross-check of the above)
| Artifact | Hash |
| --- | --- |
| `BUSINESS_PROMPT_V3` | `df6ffafc401d9337` |
| `QA_PROMPT_V3` | `4807853d261dc3f8` |
| `DEV_PROMPT_V3` | `901d1d5389256ba1` |
| author prompts combined | `0e2ec8155ab45318` |
| A1 scenario-granularity convention doc | `d84c33b9663715e3` |
| OpenSpec→Gherkin converter version | `openspec-gherkin-v1` |
| GLM route (config) | `601ef86213968ec8` |
| SURFACES (both tasks, blind) | `751fc7f22b4fb3aa` |

## Pinned decisions
- **Pilot task pair:** `mlco2__codecarbon-831` (bug) + `celery__kombu-2300` (mixed/enhancement) — the two
  hardest-to-observe, one of each kind.
- **Spec author (A4, non-participant):** `glm-5.2` via the `glm` route (litellm `openai/glm-5.2`,
  `api_key_env=ZHIPU_API_KEY`), thinking DISABLED. Effective endpoint `https://api.z.ai/api/paas/v4` via
  `E2_GLM_BASE_URL` in the record-repo `.env` (the route's committed default is the CN endpoint; the
  `.env` override is the sealed effective value).
- **SURFACES:** derived from each repo's read-only public API at base_commit + the GitHub issue text ONLY,
  blind to the gold patch and gold tests (sealed in the harness commit above).
- **Claim policy (Addendum B §B1):** positive-only / detection scope. This pilot is `calibration`; it
  produces no causal claim regardless of outcome.
- **Per-task eligibility gates (offline-pilot §6):** black-box observability, gold-passes-spec,
  non-triviality, tautology (static + dynamic), flake-cert. `run_spec` leak-tightness is a harness-wide
  precondition. A task is eligible iff all per-task gates pass.
- **Flake-cert:** N = 60 on the authored checks (Clopper-Pearson, ≤5% @ 95%).
- **A3 minimum-n floor (Addendum B §B9, amended):** applies to the full n=9 pass downstream, not this
  2-task pilot; the pilot's §9 extrapolation rule governs (both eligible → author all n=9; both fail →
  revisit selection; split → proceed watching A3).
- **Blindness:** the author receives only the issue text + SURFACES; never the gold patch, test files, or
  `FAIL_TO_PASS`/`PASS_TO_PASS`. Attested per task from the authoring transcript.

## Authorization & spend
- **Operator authorization:** granted 2026-07-01 (operator instruction "seal, then run"). Operator =
  Alan Cyment.
- **Spend:** dominated by local Docker compute (no $). Model spend is the GLM-5.2 author only — a handful
  of calls across 2 tasks (cents). Cap: negligible; no paid agent-under-test rollouts occur.

## What this seal does NOT do
- Does **not** authorize the main study (the DeepSeek/Qwen agent-under-test runs). Those require the full
  n=9 authoring pass + a separate seal (offline-pilot §11).
- Does **not** seal the resulting specs for a rollout — the pilot only checks them against gold/no-op.
- Any change to a pinned input creates a **new** version of this doc (a new commit → a new master seal).
