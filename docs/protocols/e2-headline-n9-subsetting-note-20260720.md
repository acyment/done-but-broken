# The published headline's n=9: prospective for one model, post-hoc for the other

**Date:** 2026-07-20. **Status:** finding, recorded. Not a correction to any result — no number
changes. It concerns how the published task count was arrived at, and what the record does and does
not say about it.

**How this was found.** A blind audit of an external-reviewer briefing packet, checking that
packet's claims against the artifacts. The audit was looking for something else.

---

## The finding

The published executable-feedback result reports **9 tasks** from a sealed list of 13, with four
large repositories excluded for a navigation confound: without a shell the control cannot explore
them, so its disadvantage there is partly "cannot navigate" rather than "cannot execute." That
rationale is sound and is documented.

For the **second model's replication**, the exclusion was not prospective. The artifact
`e2-phase1-5-causal-pilot-qwen3.7-max.json` contains **260 records covering all 13 tasks**, and
carries **two completed analyses side by side**:

| Analysis key | Tasks | Hits | Family-wise *p* |
|---|---|---|---|
| `analysis_all_valid` | 12 | 6 | 1.110778964404297e-05 |
| `analysis_n9` | 9 | 5 | 3.322220703125e-05 |

The three repositories that the packet described as having "zero records anywhere" in fact have
**complete, valid 10-control / 10-treatment sets**:

| Task | Control | Treatment | Result |
|---|---|---|---|
| `python-attrs__attrs-1448` | 10 | 10 | **effect 0.6, *p* = 0.0052 — a significant hit** |
| `dpkp__kafka-python-2608` | 10 | 10 | effect 0.0 |
| `psf__black-4670` | 10 | 10 | effect 0.1 |

So: the data was collected, the wider analysis was computed, and the narrower one was published.

## What this is not

**It is not power-maximising selection.** Including the excluded tasks makes the result *stronger* —
one more hit and a family-wise *p* roughly 3× smaller. **The published figure is the weaker of the
two the program computed on itself.** Whatever drove the choice, it was not a search for a better
number.

**It is not a numerical error.** Both analyses are correct as computed. Nothing published is wrong.

## What it is

**Post-hoc subsetting presented as prospective design.** A reader of the run card sees "9 of 13,
four excluded for a navigation confound" and reasonably infers the exclusion was decided before
data collection. For this model it was applied after full collection, with the wider analysis
retained in the same file and not reported.

The record does not say who decided, when, or on what basis the `analysis_n9` view was selected for
publication over `analysis_all_valid`. This note does not resolve that; it records that the
question is open.

## The pattern this belongs to

This is the **third** exclusion found in one day's review where the program dropped data in a way
that **weakened its own result**, with no recorded rationale:

1. **`psf__black-4684`** — a valid, contamination-screened, flake-certified task that was a hit
   (effect 0.9, *p* = 0.0001) dropped from the published pilot. The 10-task version reporting 9 hits
   at *p* ≈ 1.9×10⁻¹¹ survives as a file whose name says "contaminated" though the recorded cause is
   an infrastructure failure in the *other* model's run.
   See `e2-black4684-exclusion-note-20260720.md`.
2. **The 10-task versus 9-task artifact pair** — same run id, written two minutes apart, stronger
   version set aside.
3. **This: 12-task versus 9-task analyses** — both computed, weaker published.

**On motive this is exculpating** — a program p-hacking its way to a result does not repeatedly
choose the smaller number. **On method it is a documentation failure**, and a compounding one: three
undocumented exclusions in the evidence chain behind a single public claim. A hostile reviewer who
finds any one of them without the others will reasonably assume the worst, and the record gives them
no way to check.

## What would close this

- A statement of who selected `analysis_n9` for publication and on what basis, or an explicit note
  that the basis was not recorded at the time.
- Either publishing both analyses, or a written rationale for preferring the narrower one that a
  reader can evaluate.
- A single index of every task-level exclusion across the program, with the reason for each — the
  three above are currently discoverable only by reading artifacts.

## Corrections this note makes to earlier documents

- `E5-BRIEFING-PACKET-v1.md` and `-v2.md` state that the four excluded repositories have "zero
  records anywhere." **False**, and it was marked as code-verified in v2. Three of them have complete
  valid data. Recorded in v2's known-error register as E2.
- `e2-black4684-exclusion-note-20260720.md:126-129` contains the same error and should be read
  alongside this note.

## Verification

```
analysis_all_valid -> n_tasks: 12  n_hits: 6  family_wise_null_p: 1.110778964404297e-05
analysis_n9        -> n_tasks:  9  n_hits: 5  family_wise_null_p: 3.322220703125e-05
python-attrs__attrs-1448   {'control': 10, 'treatment': 10}
dpkp__kafka-python-2608    {'control': 10, 'treatment': 10}
psf__black-4670            {'control': 10, 'treatment': 10}
```

Source: `hit-sdd-bench-e2/e2-phase1-5-causal-pilot-qwen3.7-max.json`, tracked as of commit `16bb517`
(2026-07-20). Independently reproducible from the committed artifact.
