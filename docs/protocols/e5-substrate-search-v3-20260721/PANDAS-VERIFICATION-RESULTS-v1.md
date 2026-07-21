# pandas fossil pair — local verification results v1

Verification of the mechanical pass's lead specimen (`MECHANICAL-PASS-v1.md` §1): culprit
pandas #64478 (`5273c347`, merged 2026-03-09) → fix #66250 (`8de38cfc`, merged 2026-07-15).
Executed 2026-07-21 by Claude Code with operator authorization. Zero model spend — git + pytest.
Environment: shallow clone (since 2026-02-20), Python 3.12.11, editable meson build, NumPy
**2.5.1** (matters: the mechanism is NumPy-promotion-dependent). Black-box scenario preserved at
`verification-raw-pandas-blackbox.py`.

Both commits touch only `pandas/core/nanops.py` (+ tests), so one compiled build served all
states; states were constructed by swapping that file (culprit's 7-line hunk reverts cleanly
with `git apply -R`). The fix's test file (11 targeted tests) was held constant across states.

## The three worlds — the headline result

| State | Construction | Black-box scenario (public `DataFrame.idxmax`) | Fix's 11 targeted tests | Loudness |
|---|---|---|---|---|
| **MINUS-CULPRIT** (pre-#64478 code, NumPy 2.5) | revert culprit hunk at fix-parent | **CRASH**: `OverflowError: Python integer -9223372036854775808 out of bounds for uint64` | 9 fail (uint64 family: OverflowError; tie family: AssertionError) | **LOUD** |
| **NO-OP** (culprit in, fix absent — the shipped state, Mar 9 → Jul 15) | fix-parent verbatim | **WRONG ROW, silently**: `idxmax` → first row instead of max row; no exception, no warning | 7 fail, **all pure AssertionError** (wrong values) | **SILENT** |
| **FULL** (fix applied) | fix commit | correct | 11/11 pass | — |

**This pair is the program's thesis in miniature, verified end to end:** under new NumPy the old
code failed *loudly*; the culprit PR — titled "Fix OverflowError…" — made the loud failure go
away by introducing a *silently wrong answer* on the same inputs; the suite went green; the
wrong answers shipped for four months until a human noticed. Between "crash fixed properly" and
"crash converted into silent corruption," the only discriminator that existed was a behavioral
check at the public surface — which is precisely the artifact the treatment arm of the study
can execute and the control arm cannot. The loudness inversion (MINUS-CULPRIT crashes on the
very inputs NO-OP silently gets wrong) also makes culprit attribution airtight without any
bisect: the failure *mode* flips exactly at the culprit boundary.

## Per-test attribution (what the culprit caused vs surfaced)

- **uint64 family** (`test_nanargminmax_uint64_with_mask`, `test_idxminmax_uint64_with_na`,
  `test_nanargminmax_uint64_na_tie[max]`): OverflowError without the culprit, silent wrong
  values with it, pass with the fix → **caused by #64478**, attribution confirmed.
- **tie family** (`test_nanargminmax_int64_na_tie`, `test_nanargminmax_float_inf_tie`,
  `test_idxminmax_float_inf_tie`): fail as AssertionError in **both** MINUS-CULPRIT and NO-OP →
  **pre-existing latent silent bugs**, which the fix's own body describes as "the family of
  argmin/argmax sentinel-tie bugs it surfaced." The fossil pair is honest about this and so
  must any episode built on it: the fix bundles caused-regression repair with latent-bug repair.

## The narrowness finding (new, and important for authoring)

The silent defect lives on **one public entry point but not its sibling**: on identical data,
`DataFrame.idxmax()` returns the wrong row while `Series.idxmax()` returns the correct one
(verified directly at NO-OP: `df.idxmax()` → `[0]`, `df["a"].idxmax()` → `2` — different code
paths through the block manager vs the masked array). Two consequences:

1. It took **three iterations** of the black-box scenario to trigger the bug at all — first the
   value pair survived float rounding (2^53-adjacent values were still distinguishable), then
   the Series path dodged the broken code entirely; only `DataFrame.idxmax` on values above
   2^63 reproduces. A *code-aware* author needed three tries; a blind scenario author working
   from a manifest has no map of which entry point is broken. **Silent surfaces are not just
   rare — they are narrow**, and scenario coverage of "the same" behavior through different
   entry points is not redundancy, it is the whole game. This belongs in the authoring
   protocol's instrumentation (which entry points did authors choose, and why).
2. For episode design, the narrowness is a feature: visible scenarios can legitimately exercise
   the Series path (green either way) while a held-out check exercises the DataFrame path —
   a natural, non-contrived visible/held-out split with real divergence.

## Sequence material (commit-window screen, `5273c347..8de38cfc`, same subsystem)

The masked-reductions/nanops subsystem in exactly this window is a cluster, not an isolated
pair — including **three more fixes with "silently" in the title**:

- `a7bea45c` (2026-07-14) "masked array setitem **silently** wraps out-of-bounds…"
- `263e401f` (2026-07-11) "DataFrame.sum on overflowing timedelta64 **silently** sa…"
- `dc008e6c` (2026-03-24) "Index.insert **silently** casts bool to numeric for mask…"
- plus loud-fossil relatives (`18068988` Series.sum OutOfBounds…, `b9a5a831` any/all raising,
  `9270bfce` min/max NaT), and **introduce nodes**: `ca317114` "API: Add reduction methods to
  pandas EAs (#63512)" and `a5161841`/`cea64256` (axis support in masked reductions) — the
  introduce-then-use shape with the introductions inside the window.

A 4–6 change episode assembled from this cluster (EA-reduction API intro → axis support →
the idxmax/idxmin repair → one of the silent setitem/sum fixes) is the strongest sequence
candidate the program has: one subsystem, one time window, multiple certified-silent behaviors,
pure public surfaces, all post-Jan-2026.

## Verdict

- **Pair VERIFIED, silent classification CONFIRMED** — predicted "fully silent" was right for
  the shipped state, and the MINUS-CULPRIT loudness inversion was an unpredicted bonus that
  makes the causal story complete.
- This is now the **strongest verified candidate in the program** — ahead of FastAPI's edge on
  every axis: silence certified by four months of shipped history (vs constructed by knockout),
  wrong-result class (vs absent-validation class), maximal repo credibility, both ends
  post-cutoff, and surrounding sequence material already identified.
- Method note for the spec lineage: total wall-clock ≈ 40 minutes plus one ~10-minute compile —
  the FastAPI-debugged method (swap-single-file states + loudness column + black-box scenario)
  transferred without modification.

Next steps in order (all zero model spend, each needs operator go): screen the four sequence-
material commits above the same way (are the "silently" fixes real fossils with culprits?);
then episode assembly + the blind-authoring probe on this substrate; any paid run stays gated
on fresh authorization + prereg + re-attack, per standing discipline.
