# E4 v2 build arc — second clean stop at the start of v2-M1

**Status: RESOLVED 2026-07-09 (same day) by design Amendment 2** — see the amendment header of
`E4V2-OPENSPEC-EXECUTABLE-SCENARIOS-PROPOSAL.md`. Resolution shape: **§5.6
`procedural-rest-v2`** (substrate observability revision: full server-side request validation,
paths follow entity renames, full-CRUD `add_entity`, `delete_field` restricted to required
fields, `modify_convention` restricted to `error_format`, heterogeneous seed refs, GT negative
tests, and an executable per-op census guard at the new milestone **v2-M0**); a **PATCH step
form** in §5.3; **type/rule rejection templates with sealed violating-value literals** and a
**retirement tombstone** rule in §5.5 (a probe during resolution showed the pinned CLI aborts
any archive that would rebuild a spec to zero requirements, so remove-all changes are
mechanically un-archivable — retirement must be a valid non-empty spec, and the tombstone is
itself a novel red scenario); and **change-level red** replacing scenario-level all-red in
§6.2.i (all-green refusal kept; `green_novel` recorded; no zero-novel custody shape) — A2 of
the anti-cheat adjudication is superseded in part, recorded there. Each of the six degrees of
freedom below is pinned by one of these. Two bonus defects found during resolution: the §7
wrong-filter bank variant was unkillable at T0 under v1's uniform seed refs (fixed by
§5.6.6), and the empty-rebuild archive abort above. The build arc is unblocked as v2-M0…M5.
This note stays as the record of the stop.

---

Original note (historical):

**Status: STOPPED before any code. No commits made. A Fable (judgment) session is needed.**
Written 2026-07-09 by the build session asked to run v2-M1…M5 as one continuous arc (restarted
after the first stop was resolved by the §5.5 amendment, commit `5e331fd`). Per the arc's stop
rules, this is a clean stop, not a failure. This gap is **disjoint from the first escalation**:
§5.5 pinned how the T0 gold spec-of-record is generated; this stop is about what the same sealed
surfaces do **after T0** — it became visible only by tracing the sealed templates and the §6 red
rule against the carried-over v1 op space (`src/e4/substrate/ops.ts`) and the generated server's
actual enforcement surface (`src/e4/substrate/scaffold.ts`).

## Which stop rules fired

- **Rule 1** — the design is silent on the template function's behavior over reachable post-op
  IRs (PATCH endpoints, read-less entities, ops the templates cannot see).
- **Rule 2** — implementing v2-M5's diligent agent as literally specified (apply §5.5 templates
  to the post-op IR, diff against the pre-task spec-of-record) produces changes the §6 gate
  *must refuse* on most reachable task types; no implementation can satisfy both sealed rules.
- **Rule 3** — resolving any of this requires adding to sealed surfaces: the §5.3 step table,
  the §5.5 template table, or the §6 novelty/red rules.

## The unresolved thing (one systemic interaction)

Four sealed pieces jointly deadlock on most of the task distribution:

1. **§6 rule (i) / A2 (strict discriminating red):** on every non-behavior-preserving task the
   change must contain ≥1 novel scenario AND every novel scenario must FAIL pre-implementation;
   any already-green novel scenario → custody refusal.
2. **§5.5 diligent derivation:** the M5 diligent agent's change delta is pinned to "apply the
   templates to the post-op IR, diff against the pre-task spec-of-record".
3. **§5.3 vocabulary:** no PATCH request form; no negative-space/seed-row/validation forms in
   the template table.
4. **The carried-over substrate:** most v1 drift/additive ops are **behaviorally invisible at
   the HTTP surface** — the generated server enforces only required-fields (never types, never
   range/enum/format rules, never unknown-field strictness; entity renames don't move paths;
   `create` stores and echoes any body). So for those ops *no expressible scenario can be red
   pre-implementation and green post-implementation*: the behavior does not change.

## Verified per-op census (against ops.ts, scaffold.ts server semantics, testgen.ts)

"template-dead" = the sealed §5.5 derivation yields an empty or already-green delta → §6(i)
custody refusal, though a clever agent could comply some other way; "dead for any agent" = no
vocabulary-expressible red-pre/green-post scenario exists at all.

| Op (label) | Under the sealed rules | Class |
| --- | --- | --- |
| `rename_entity` (drift) | Paths don't change (`ops.ts` rename cascades entity names, never `endpoint.path`); server echoes; all re-derived scenarios (new spec ids/titles) pass pre-implementation | **dead for any agent** |
| `retype_field` (drift) | Server never validates types; new fixture value (ordinal 5 in the new type) is accepted and echoed pre-implementation | **dead for any agent** |
| `add_field` (additive) | New optional field in the fresh body is echoed pre-implementation (no strictness) | dead for template derivation; real agent only via seed-row assertions outside the template table |
| `add_validation_rule` (additive) | Templates never read `validation_rules` → **empty delta** (zero novel scenarios); server never enforces range/enum/format, so no behavioral red exists without implementing enforcement the gold app lacks | **dead for any agent** (empty-delta refusal + invisible behavior) |
| `add_relationship` (additive) | Template filter scenario pins ref = seed parent 1, but every seed row also refs parent 1 → filter is non-discriminating → green pre-implementation | template-dead (real agent could filter by parent 2) |
| `modify_endpoint` (drift, PUT↔PATCH) | §5.3 has no PATCH form and the sealed update template hardcodes PUT → re-derived delta is byte-identical → empty delta; carried PUT scenario goes red at green time; update endpoint becomes permanently un-coverable | template-dead + **vocabulary gap** (real agent only via a negative PUT→404 scenario, leaving a permanent coverage gap) |
| `modify_convention` on `naming`/`command`/`structural` (drift) | Templates read only the error_format keys → empty delta; statement flips are behaviorally invisible | **dead for any agent** (3 of 4 convention targets) |
| `delete_entity` (drift) | Post-op templates emit nothing for the entity → delta is pure REMOVED blocks → zero novel scenarios → refusal | template-dead (real agent could write a collection-404 scenario) |
| `add_entity` (additive) | Custody passes (novel, red via absent routes), **but** the sealed create template's round-trip GET asserts a read route `add_entity` never mints (create+list only, `ops.ts:131-134`) → the derived scenario fails against the gold implementation forever → cumulative green (done) unreachable; the §7.5 meter would score this diligent spec as `contradiction` | **dead at the green phase**; also instrument-level false drift |
| `rename_field` / `delete_field` on a **required** field; `modify_convention` on `error_format`; `add_endpoint` (analytics) | Behavior visibly changes → red exists → workable | OK |
| `noop_maintenance` | v1 §3.3 affirmation path, unchanged | OK |

Net: of the 12 substantive op kinds, only ~4 cases are cleanly workable under the sealed rules.
The M5 dry run's diligent arm cannot function as specified on typical drawn sequences, and —
worse — in the live v2 evidence run a **real** frontier agent in the executed arm hits the same
refusals: on behavior-invisible tasks there is nothing it can legally write to exit the spec
phase, so it burns budget to exhaustion. The prose arm never executes scenarios and sails
through. That is a **structural arm-differential censoring channel** — the same validity-threat
class that made the flash pilot uninterpretable.

## Empirical antecedent (this was observable in v1 data)

v1's M6.5 calibration recorded `red_check: green_anomaly` on **4/6 tasks** ("several op classes
(notably field-level renames) produce delta sets that already pass on pre-implementation code",
IMPLEMENTATION-PLAN.md M6.5 note 6). v1's policy was record-and-proceed. A2 upgraded this to
strict refusal for agent-authored scenarios without reconciling against that observation; §6(i)
additionally requires ≥1 novel scenario, which makes even "change the spec prose, add no
scenario" illegal on those tasks.

## Why this cannot be improvised

Every escape edits a sealed surface: extending the vocabulary (PATCH, negative-space, seed-row
forms) re-opens §5.3/A3; making templates conditional (round-trip GET only when a read endpoint
exists; validation-rule scenarios) re-opens §5.5; scoping or softening the red/novelty rule
re-opens §6/A2; pruning or re-weighting the op space changes the substrate version and the
drift construct's task distribution. All are design amendments — §9 assigns those to Fable
regardless of phase. Building M1–M4 first was considered and rejected: M1 ships the template
table and M2 ships the step table as constants-adjacent code twins, i.e. the exact surfaces any
resolution amends — sealing then amending would be worse than stopping clean.

## The undecided degrees of freedom

1. **Red-rule scope** — does §6(i) strict red apply to behaviorally-invisible tasks? (The
   harness can compute visibility deterministically: run the post-op GT delta suite against the
   pre-op gold implementation.) If not strict, what replaces it — v1 record-and-proceed,
   an affirmation path, or task-class exemptions?
2. **Novelty floor on empty-template ops** — what must a change contain on `delete_entity`,
   `add_validation_rule`, and non-error-format `modify_convention` tasks, where the sealed
   derivation yields zero novel scenarios?
3. **PATCH** — is the update-method flip expressible (new §5.3 form), excluded (op pruned or
   re-specified), or intentionally un-coverable (accepted permanent coverage gap)?
4. **add_entity round-trip** — is the create template's consequence GET conditional on a read
   endpoint's existence, or does `add_entity` mint a read endpoint (substrate change)?
5. **M5 diligent-agent domain** — may the diligent agent emit non-template scenarios on op
   classes where the templates cannot both satisfy the gate and stay meter-clean vs gold?
6. **Meter interaction** — for tasks where the only gate-satisfying scenario a real agent can
   write contradicts the gold implementation (e.g. self-implemented validation enforcement),
   is that contradiction acceptable measurement or an instrument defect?

## What is NOT blocked

The §5.5 T0 generator itself (the first escalation's resolution) is fully specified and
buildable for the T0 baseline; `openspec validate --specs --strict --no-interactive` was probed
against the pinned CLI 1.4.1 and the planned workspace shape passes (and the validator's
strict-mode failure modes bite, including the ≥50-char Purpose floor). The allowlist extension,
converter port, hermetic executor, meter re-pointing, and adversarial bank are all
implementable as written — but each seals surfaces a resolution here may amend, so none was
started.

## State of the tree at stop

Clean. No files staged or committed; this note is the only new file and is intentionally left
**uncommitted** (matching the first escalation's precedent). Test baseline verified green at
**578/578** before the stop. `bun run e1:protect` not re-run (no code changed).
