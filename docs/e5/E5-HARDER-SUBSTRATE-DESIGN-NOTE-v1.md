# E5 harder-substrate design sketch (v1, 2026-07-14 — docs only, no build)

**Status: DESIGN NOTE for gate review (zero-spend runway item 3). Nothing here is built or
authorized.** Motivation: seed 220 showed the failure-at-close rate is a coin flip per
sequence, so probe sensitivity depends on luck (`E5-P11-READOUT-seed220-v1.md`). The
interaction-dense seed rule (runway item 2) is the free lever; this note is the next lever
if that under-delivers.

## Constraint carried from the E1 arc (binding)

Difficulty must come from SCALE and INTERACTION, never from tricks: four clean frontier
ceilings established that small, fully-specified, self-contained tasks are self-verifiable
— a strong model shows no feedback benefit on them regardless of apparent difficulty. A
harder substrate that stays fair must make correctness depend on state the agent did not
just write and cannot cheaply re-derive.

## Levers, cheapest first

1. **Longer sequences (no substrate change).** 12 tasks instead of 6 doubles cross-task
   interaction opportunities and doubles cost per run (~$4/arm at seed-220 rates). The
   drift meter, budgets, and draw machinery already support it. Cheapest real hardness.
2. **Interaction-forcing op weights (config only).** The op mix already contains the
   interacting ops (rename/retype/relationship on EXISTING surface); a probe-declared
   weight shift toward them raises collision rates without new code. Compatibility: op-mix
   values live in the substrate config each manifest records, so a probe may declare its
   own mix without touching sealed constants — same boundary discipline as task_count.
3. **New interaction ops (substrate v3/v4 — real build, ~2-3 sessions).** Candidates, each
   with an observable HTTP consequence per the §5.6 invariant:
   - `move_field` — a field migrates from entity A to entity B (both pre-existing);
     correct work touches A's validation, B's shape, and every scenario that exercised
     the field on A. Breaks agents that only look at the named entity.
   - `merge_entities` — B's records become A's with a discriminator field; B's paths
     retire (tombstone machinery exists), A's suite grows. Forces reconciling two
     histories written by earlier tasks.
   - `cascade_rule` — a validation rule on A.field whose check reads a referenced B
     record's field (cross-entity validation). The first op whose CORRECT implementation
     must call across entities at request time.
   Each is a sealed-surface change: substrate version bump, census extension (every op
   kind red-able pre-implementation and green post — the v2-M0 discipline), gold-spec
   templates, meter classification review, PM-brief lines + determinacy rows for any new
   underdetermined fact.
4. **NOT recommended:** hidden tricks, adversarial phrasing, or requirements that gold
   itself does not enforce — the E4 arc spent four boundaries removing exactly those.

## Recommendation

Run the during-work probe (P1.2w) on levers 1+2 first — both are config-level and
zero-build. Build lever 3 only if a probe under levers 1+2 still yields clean-closing
treatment arms; at that point the build is justified by data, not anticipation.

## Acceptance criteria for any build (pre-committed)

Census green per op; gold passes its own suite at every checkpoint; disclosure inventory
extended for every new underdetermined fact (the P0-V standard: ambiguity is material,
falsity is a defect); one dry-run sequence with the fake diligent agent showing ≥1
red-pre/green-post scenario per new op kind; boundary bump with twin re-pins.
