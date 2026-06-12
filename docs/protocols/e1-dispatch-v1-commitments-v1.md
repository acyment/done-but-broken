# e1-dispatch-v1 Pre-Run Commitments v1

Date: 2026-06-12. Pre-run commitments document for the `e1-dispatch-v1` task
under the E1 frontier path. Sealed before any probe run is authorized.

## Sealed artifact hashes

All hashes are SHA-256. A run is valid only if each artifact at run time matches
its hash here. Any mismatch makes the run `invalid_run=true`.

### Task and oracle packages

| Artifact | SHA-256 |
|---|---|
| `tasks/e1-dispatch/task-package/task.json` | `3abe5999fe01818bfab930bf73701937208c7c51ad9801c0626d3a67a3c5151d` |
| `tasks/e1-dispatch/oracle-package/oracle.json` | `b8581bbb1e643efaa4e8938748e89f9472f68f74c748bec1e2b53a6c0795486e` |
| `tasks/e1-dispatch/oracle-package/cases.json` | `047dfbfbff97c7dc560588c56035165c9611846e424f10f4b5662139532aec43` |
| `tasks/e1-dispatch/oracle-package/scenarios.ts` | `136ffd816ee97f391b97a850471d235d2ee4b92585d37ebcdd18902f73d19427` |
| `tasks/e1-dispatch/oracle-package/generate-cases.ts` | `2aa3ebeee5bdba7b79f6a89bd14a8c5fb4666435846de8911a6be226659be602` |

### Reference implementation

| Artifact | SHA-256 |
|---|---|
| `reference/src/dispatch.ts` | `e93f8031bfa9f0b024b97f194fccd8cf63ef85c531398ec15a8db8600582ed64` |
| `reference/src/orders.ts` | `042212fe31979f0837daaa8e949eedb6c4441e0d614fd4061170704d84f10da9` |
| `reference/src/dispatch-types.ts` | `06f55554d81e97bd8881ad1aa58f038c66d2a078886aaac79729fa6357e658d9` |
| `reference/src/api/render-order.ts` | `70bfc2be1838403a0ec90308ad378f5399ae94bcd3c0c63e2122d1557be870cb` |
| `reference/src/api/parse-order.ts` | `ae154db576053be23abad6038972424ef0a718799bb18e53e736ce72fa02d446` |
| `reference/src/notify/digest.ts` | `d9380bc8b7513d692efb7fc0eca5ac01c4efe45de549c7f076f51eddc317c8ec` |

### Build artifacts and gates

| Artifact | SHA-256 |
|---|---|
| `tasks/e1-dispatch/DESIGN-NOTES.md` | `b4729a0aba80ea98b94a8fab3cb3446861e9b2f872535878886e6620c9fc2d89` |
| `test/e1-dispatch.test.ts` | `0ee1f87b945baaa7d320dd4c6b2e62f1743d2197663ec6219f5e039870920a34` |
| `tasks/e1-dispatch/generate-visible-specs.ts` | `7f627031528184284152e6f2b308b5300ed8bb93bd6bf13c7e385c23ce3b15bd` |

### Protocol documents (pinned at run time)

| Artifact | SHA-256 |
|---|---|
| `docs/protocols/dispatch-task-design-v1.md` | `e756f88ed813e2af369f8a4e4ea15d0a7e8cf36ba1dc862b464884793d3b3830` |
| `AGENTS.md` (scientific discipline) | `e8e0e25f9bc9a6ea1504fc16a52e21c86e9c9c6d2d66e0c51b3d39ec5192a1c9` |

## Task summary

- **Task id / version**: `e1-dispatch` / `e1-dispatch-v1`
- **Protocol**: E1 under `e1-openspec-workflow-v0`, sealed base constants v1.0
- **Checkpoints**: 12 (extensions at CP1–3, CP5, CP7, CP9, CP11; corrections at CP4, CP6, CP8, CP10, CP12)
- **Oracle cases**: 141 total; 98 held out (70%); 43 visible
- **Status tokens**: 11 (`awaiting_payment`, `partially_paid`, `processing`, `partially_shipped`, `shipped`, `partially_returned`, `returned`, `closed`, `cancelled`, `cancelled_partial`, `cancelled_owing`)
- **Mechanisms**: M1 seeded scattered derivation (4 sites), M2 Contextual-level specs, M3 rewrite pressure (`orders.ts` ≈2,249 estimated tokens), M4 correction cadence
- **Acceptance gates passed**: 9/9 (commit `67086e3`)

## Predeclared primary metric

`checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1` (regression-free AUC).
This metric is primary for all runs under this task that declare protocol profile
`path-survival-primary-v1` or a sealed E1 profile. Difficulty probe runs are
`calibration` class; the primary metric is reported descriptively only.

## Predeclared secondary descriptives

Computed from `per_turn` case-level data at each checkpoint end:
- (a) pass→fail flip count — regressions
- (b) never-pass count at scattered sites — propagation failures
- (c) files-touched-per-checkpoint profile (effort signal)

Measurement honesty: flips are regressions; never-passes are propagation failures.
"Drift" may cover the union but may not be called regressions.

## Dispatch domain certification

The dispatch domain is the designated successor to the billing domain (closed
2026-06-11 under the third-ceiling rule). The dispatch domain is open for frontier
discrimination claims subject to the Stage 1 gate criteria declared in the Stage 1
probe plan. A `cancelled_owing` precedence rule is stated and sealed here:
`cancelled_owing` takes priority over `cancelled_partial` when both conditions hold;
this precedence decision is irrevocable for this task version.

## Commitments document hash

The SHA-256 of this committed file is the value to pass as `--protocol-document-hash`
at run time. Because this file cannot hash itself without a self-reference paradox, the
hash is recorded in the Stage 1 probe plan (`e1-dispatch-v1-stage1-plan-v1.md`) after
this file is committed. Compute with:

```
shasum -a 256 docs/protocols/e1-dispatch-v1-commitments-v1.md
```
