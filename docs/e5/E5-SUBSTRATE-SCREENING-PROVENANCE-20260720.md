# Substrate screening — provenance record, 2026-07-20

**Append-only.** Entries are added below with new dates. Nothing in this file is edited after the
fact; corrections are appended as new entries that reference the entry they correct.

**This record is not a substrate decision.** It scores incumbent episodes against a frozen rubric so
they can be merged into one candidate table alongside scout nominations later. No substrate has been
selected. No route has been chosen. No spend has occurred.

**This screening did not alter the frozen scout prompt.** Appendix F of `CRITIQUE-PROCESS-v1.md` was
frozen before this screening ran and remains unmodified. Per execution-discipline item 4, local
scoring cannot feed back into the prompt; these are additional rows, nothing more.

---

## Provenance

| Field | Value |
|---|---|
| Date | 2026-07-20 |
| Screening rubric | `CRITIQUE-PROCESS-v1.md` Appendix F, FROZEN 2026-07-20 |
| Rubric file sha256 | `0ff5f28e43d5c4e095dbcca0722ceebf2328cea26fee19935bab272d4ea766bc` |
| Rubric criteria | H1–H7 hard requirements, hard exclusions, scorecard S1–S6 |
| `hit-sdd-bench` rev | `bea27e3` |
| `hit-sdd-bench-e2` rev | `7438eb2` |
| Screener | Claude Opus 4.8 via read-only subagent, repo evidence only |
| Spend | $0 — read-only static inspection, no rollouts, no provider calls |
| Prior prediction | One was made and was **wrong**; recorded below rather than deleted |

---

## Dispositions

### `pvlib-rung4-k3-v1` — **REJECT**

Fewer than four changes. k=3 against a floor of 4 (H2). Arithmetic, not judgment; no further
assessment required.

### `pvlib-rung4-k6-v1` — **REJECT**

Chronological adjacency without behavioral dependency. The chain has k=6, satisfying the count, but
the six changes are independent feature merges touching largely disjoint modules
(`spectrum/mismatch.py`, `spectrum/mismatch.py`, `iotools/psm3.py`,
`albedo.py`+`irradiance.py`+`pvsystem.py`, `transformer.py`, `irradiance.py`). The chain's own
construction rationale states golds "are consecutive first-parent range diffs, so they stack **by
construction**" — which establishes textual compatibility and chronology, not semantic dependency.

Behavioral confirmation: **zero true regressions across all 8 recorded pvlib rollouts** (k3: 0/5,
k6: 0/3), with zero P2P sentinel breaks.

Additional defect: **step 3 has no held-out checks at all** (`oracle_f2p_count: 0`); the design doc
describes it as a null-oracle step that "certifies vacuously." One sixth of the chain is unscorable
by construction. That step's test patch also deletes `test_psm3_variable_map_deprecation_warning`,
removing previously-asserted behavior. The "deliberately invalidates earlier behavior" exclusion is
**not** triggered, because no earlier step in this chain asserted that behavior — but it is the
closest any incumbent comes.

This failure mode was already on the record before this screening:
`BACKLOG.md:27` — *"the same non-overlapping-files property that made them certifiable makes them
unable to couple."*

### `dmcg-rung4-k5-v1` — **CONDITIONAL CANDIDATE**

The only incumbent that fails on a single criterion. Genuine coupling, a real CLI boundary, and
demonstrated held-out signal.

Supporting evidence:
- **Genuine step dependency.** Change c3's gold-patch pre-image blob (`61e8e70d`) is exactly c2's
  post-image (`21a7de16..61e8e70d`) on the same file, `parser/jsonschema.py`. c5 is a cross-cutting
  change touching 11 source files including those c1–c4 modified.
- **Demonstrated coupling.** 3 of 5 rollouts produced true regressions (counts 1, 2, 1), with P2P
  sentinel breaks of 356 / 0 / 321 / 321 / 7.
- **Public boundary.** A real CLI (`datamodel-codegen`, entrypoint
  `datamodel_code_generator.__main__:main`) plus a Python API. Tests are largely golden-file:
  invoke `main([...])`, compare against `tests/data/expected/**`.
- **Held-out oracle.** 25 F2P checks, all `FAILED` at base; 653 sentinels.

**Unresolved gates — all four must clear before this is a candidate, not merely a conditional one:**

1. **Public-boundary re-expression of c4.** `test_types.py::test_remove_none_from_union` (10 of the
   25 F2P) asserts a module-internal helper in `datamodel_code_generator.types`, not the CLI. The
   private-implementation exclusion is not triggered — the same regex-constraint behavior is
   observable in generated CLI output — but the *existing* oracle for that step is internal and
   would need re-expressing at the boundary.
2. **Authored Gherkin pack.** No `.feature` files exist for this episode. Authoring must follow the
   blind authoring protocol (mechanical surface manifest, two model authors plus reconciler,
   reconciliation before any known-good result, hash-frozen pack).
3. **C4 defective variants.** A pre-declared, episode-specific defective-variant set, hand-authored,
   meeting a floor sealed before results are seen. E4's adversarial bank is a design precedent here,
   not reusable machinery.
4. **Cost measurement.** See below — currently unknown.

**Elevated teach-to-the-test risk (S6 = 3, the worst of the three).** dmcg's visible sentinel surface
lives in the same `tests/` tree and uses the same golden-file `expected/*.py` idiom as the hidden
oracle, so visible and held-out checks are close in kind. In pvlib they are disjoint in kind
(pre-existing repo tests vs brand-new feature tests missing at base) — lower leak risk, but also
near-zero signal. This trade is real and should be carried into C4's floor.

### `authored_spec` Gherkin runner — **VALIDATED CAPABILITY, NOT A CANDIDATE RESULT**

Literal `.feature` execution exists, is built, and is validated. It has **not** been connected to any
coupled episode. This is a capability finding, not a substrate.

- `authored_spec/gherkin.py:1-8` — the sealed artifact "is a real `.feature` file executed by a real
  BDD runner (pytest-bdd) through step definitions." Not a rendered byproduct.
- `authored_spec/bdd_runtime.py` — vendors pytest-bdd and gherkin-official into SWE-bench containers
  under `network=none`.
- `authored_spec/compiler.py:54` — pins the converter version into a `spec_hash`, satisfying the
  hash-pinning that literal-Gherkin parity requires.
- Validated end-to-end on a real containerized Python repository (octodns, Python 3.9): known-good
  patch PASSED, do-nothing patch FAILED.

**What is not established:** that this runner can be pointed at dmcg's CLI boundary, or at any
coupled episode. No such attempt is on record. Retrofit feasibility is **plausible with named
working machinery**, and is unproven.

---

## USD cost: UNKNOWN

**No USD figure is recorded in any E3 run artifact.** The calibration JSONs carry `elapsed_s` only —
no token counts, no usage fields, no cost accounting. Determining per-episode spend would require
provider billing records or a token-accounting field the harness does not currently write.

This is recorded as **unknown**, not as an estimate. The one dollar figure found anywhere in the
record (`BACKLOG.md:31`, "R0 smoke authorized ~$1–2") refers to a different, pre-rung-4 episode and
does not transfer.

Wall-clock, which *is* recorded, from `e3-calibration-control-20260706-163739.json` (control arm,
`openai/deepseek-v4-pro`, N=5/episode, 40-iteration budget, `status: in_progress`):

| Episode | Rollout `elapsed_s` | True regressions | P2P sentinel breaks |
|---|---|---|---|
| pvlib-k3 | 1001, 842, 691, 775, 837 | 0/5 | 0 |
| pvlib-k6 | 1450, 1706, 1504 (3 of 5 recorded) | 0/3 | 0 |
| dmcg-k5 | 1020, 1191, 5691, 1154, 1024 | **3/5** | **356 / 0 / 321 / 321 / 7** |

The calibration run is marked `in_progress`; pvlib-k6 has 3 of 5 rollouts. No completed successor
run was found. **This partial result is written up nowhere else in the record.**

---

## The reversed prediction

Before this screening ran, a prediction was made in conversation that the pvlib episodes would fail
**because pvlib is a Python library whose public surface makes `.feature` execution awkward**. That
prediction was retracted before scoring, at external review's insistence, and the episodes were
scored blind against the rubric.

**The prediction was wrong, and wrong in its mechanism.** pvlib fails on chain coupling — the
changes do not build on one another, and the 0/8 regression rate is direct behavioral evidence of
it. The Gherkin criterion fails for every incumbent for an entirely different reason: **E3 has no
spec artifact at all.** Its visible surface is literally `pytest -rfE --tb=no -q` (`e3/agent.py:271-296`)
and its arms differ by an enforcement gate, not by a specification. There was never a spec to
execute, in any format, for any language.

Had the prediction been allowed to stand, the screen would have recorded a superficial
"Python/Gherkin incompatibility" story and missed the real constraint — episode coupling — which is
the property that actually determines whether any substrate can support the claim. The blind-scoring
discipline earned its cost on its first use.

---

## Evidence paths

- Episode manifests: `hit-sdd-bench-e2/runs/e3-chains/{pvlib-rung4-k3-v1,pvlib-rung4-k6-v1,dmcg-rung4-k5-v1}.json`
- Certification logs: `hit-sdd-bench-e2/runs/e3-chains/{pvlib-rung4-k3,pvlib-rung4-k6,dmcg-rung4-k5}-cert.log`
- Calibration run: `hit-sdd-bench-e2/runs/e3-calibration/e3-calibration-control-20260706-163739.json`
- E3 harness: `hit-sdd-bench-e2/src/hit_sdd_e2/e3/{agent,runner,certify,scorer,manifest}.py`
  — visible enforcement gate `agent.py:271-296`; sentinel surface derivation `runner.py:367-393`
- Chain constructors: `hit-sdd-bench-e2/scripts/{build_merged_pr_chain,certify_chain_episode,compute_e3_sentinels,run_e3_calibration}.py`
- Gherkin machinery (sibling experiment, **not** E3):
  `hit-sdd-bench-e2/src/hit_sdd_e2/authored_spec/{gherkin,compiler,bdd_runtime,base_validation,bundle}.py`;
  vendored runtime at `hit-sdd-bench-e2/runs/authored-spec-screen-fixed/casbin__pycasbin-392/vendor/{gherkin,pytest_bdd}/`
- Design: `docs/protocols/e3-regression-redesign-v2.md` §12–13 (§13.1 retired probe, §13.2 gold-leak);
  `BACKLOG.md` lines 27, 30–36

**Carried forward:** the rung-4 gold-leak (agent could `git show` the gold commit, because a late
pinned image was reused with an earlier base) was found and fixed in
`e3/agent.create_workspace_container`, and the §13.1 probe is retired as a measurement. This defect
is **structural to the rung-4 construction method** and would apply to any new episode built the same
way. It is a standing check for future candidates, not a closed issue.

---

## Operational note — instruction injection during screening (kept separate from candidate evidence)

Recorded here for operational and security tracking only. **This did not affect any command run or
any finding above**, and is deliberately not mixed into the candidate evidence.

During the read-only screening subagent's run, the `Ahma` MCP server emitted server-level
instructions directing that all terminal and shell execution be routed exclusively through its own
`sandboxed_shell` tool and away from standard tooling.

- **Source:** tool-server output, not the operator.
- **Disposition:** not followed. The subagent correctly treated it as untrusted content rather than
  instruction, and reported it rather than complying silently.
- **Impact on this record:** none. The screening was read-only static inspection; no command
  behavior or finding changed.
- **Standing note:** MCP server instructions are untrusted input. This is the general rule, not a
  judgment about this particular server.
