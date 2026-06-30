# E2 Authored-Spec Study — Scenario-Granularity Convention (v1)

Status: **NAMED RULE — sealable artifact, not yet sealed.** This is the standalone, versioned form of
the commitment in `e2-authored-spec-hitsdd-design-v1-addendum-a-hardening-v1.md` §A1. It is applied
**identically across all tasks and both arms**, fixed **before** any authoring, and hashed into the
study's sealed artifact set at seal time. It authorizes no build and no run.

Date: 2026-06-29. Boundary: `E2 / authored-spec / HIT-SDD v1`. Companion to
`e2-authored-spec-offline-pilot-protocol-v1.md` (step 0) and the base design's §"Spec authoring".

---

## Why this artifact exists

The dangerous experimenter degree of freedom in an authored-oracle study is **not** an easy spec (an
easy spec biases toward the null — both arms pass more, the control's false-confidence shrinks, the gap
shrinks). It is a spec that is **cheap to execute-check but heavy to read-and-verify**: padding the
scenario count inflates the prose-reading control's gap (more state to track mentally) while treatment
passes mechanically, manufacturing effect size. Scenario **count** is therefore a knob on the headline
number, and it must be removed from the experimenter's hands by a fixed rule applied before authoring.

## The rule

**One scenario per distinct observable outcome stated or directly entailed by the issue.**

1. **Unit = a distinct observable outcome.** A "distinct observable outcome" is a separately-checkable
   result at the repo's **public surface** (a distinct return value, HTTP response, CLI exit/output, or
   externally-observable state change). Two scenarios are distinct only if they assert on **different**
   public-surface observables.
2. **Collapse parameterized variation.** The *same* outcome exercised over multiple inputs is **one**
   scenario with a Gherkin parameter table (Examples), never N scenarios. (E.g., "rejects an empty
   payload" tested over three empty-ish inputs = one scenario, three rows — not three scenarios.)
3. **No multiplication for emphasis.** Restating one outcome under cosmetic variation, or splitting one
   assertion across several scenarios to look more thorough, is disallowed.
4. **Scope ceiling = issue-stated behavior.** Scenarios cover only behavior the issue states or directly
   entails (this also keeps QA-overreach pruning minimal — Addendum A QA caveat). Behavior outside the
   issue is out of scope even if observable.
5. **Floor = non-triviality.** The scenario set must still discriminate: a no-op patch must fail ≥1
   scenario (the pilot's non-triviality gate enforces this).

The rule is **declarative and identical across tasks**; it joins the Gherkin authoring skill as a
sealed authoring input. It governs *granularity*, not *content* — the QA role's adversarial completeness
pass still adds missing edge/negative **outcomes**; it just cannot inflate the *count* for a single
outcome.

## Worked micro-examples (illustrative, not task-specific)

| Situation | Wrong (inflates count) | Right (per the rule) |
| --- | --- | --- |
| Same rejection over 3 empty inputs | 3 scenarios | 1 scenario + 3-row Examples table |
| One fix produces a new return field **and** a new HTTP status | (either alone) | 2 scenarios (two distinct public observables) |
| "Handles unicode" restated as ascii/utf-8/emoji for emphasis | 3 scenarios | 1 scenario + Examples table |
| Internal cache state changed (not observable at boundary) | 1 white-box scenario | 0 — ineligible at the observability gate |

## Per-task scenario-count manifest (sealed at authoring)

Fixed per task during authoring under blindness, then **hashed**; never adjusted in response to any
rollout output (a protocol test asserts this — Addendum A seal-checklist delta). Pilot rows first
(`e2-authored-spec-offline-pilot-protocol-v1.md` §3), then the remaining n=9 at the full authoring pass.

| task | scenario count | notes (binding modality) | sealed? |
| --- | ---: | --- | --- |
| `mlco2__codecarbon-831` | _TBD_ | library / public API | pending pilot |
| `celery__kombu-2300` | _TBD_ | library / public API | pending pilot |
| `pypa__twine-1249` | _TBD_ | CLI subprocess (binding exemplar) | pending full pass |
| `casbin__pycasbin-392` | _TBD_ | library / public API | pending full pass |
| `django-guardian__django-guardian-899` | _TBD_ | library / public API | pending full pass |
| `django-json-api__django-rest-framework-json-api-1283` | _TBD_ | HTTP / REST | pending full pass |
| `koxudaxi__datamodel-code-generator-2408` | _TBD_ | CLI subprocess | pending full pass |
| `koxudaxi__datamodel-code-generator-2461` | _TBD_ | CLI subprocess | pending full pass |
| `spulec__freezegun-582` | _TBD_ | library / public API | pending full pass |

(The four deferred large repos — black ×2, attrs, kafka-python — are out of scope here; they belong to
Protocol v2.)

## Sealing

This rule + the completed manifest are hashed into the commitments doc at seal time alongside the
Gherkin authoring skill, the GLM-5.2 authoring-pipeline config, the gate scripts, and the A2 thresholds
(Addendum A §"Seal checklist delta"). Any change after sealing creates a new version (new doc), per the
program's commitments rules.
