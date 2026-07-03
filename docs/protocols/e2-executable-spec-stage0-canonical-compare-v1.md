# E2 Stage-0 Canonical-A Comparison Protocol (v1)

**Status**: active — governs all Stage-0 authored-spec checks authored under DEV_PROMPT_V4.
**Supercedes**: none (new; the prior pilot used raw `assert == `, which the four-way deep-research
pass identified as the primary failure mode — representational mismatch).

---

## 1. Problem: raw `assert ==` conflates representation with behavior

Authored checks that write `assert context['v'] == (1, 2, 3)` fail when a correct implementation
returns `[1, 2, 3]` instead of `(1, 2, 3)`. The behavior is identical; the representation differs.
This is unfair: the control arm (plain SDD) can see the check and match the literal; the treatment
arm cannot. Any failure caused by representation noise confounds the causal measurement.

The naive fix — fuzzy/lenient comparison — has the opposite problem: it widens what counts as
correct beyond the scenario's stated contract, which can make failing implementations appear to pass.

---

## 2. Solution: canonicalize-then-compare-exactly ("canonical-A")

**Core invariant**: normalize both the actual and expected values into one canonical form, then
compare EXACTLY. This removes representation noise without widening what counts as correct.

### 2.1 Always-on canonicalization (non-loosening)

All of these transformations are applied to BOTH sides before comparison:

| Input form | Canonical form | Rationale |
| --- | --- | --- |
| `tuple` | `list` (recursively) | tuples and lists are semantically equivalent sequences |
| `str` | Unicode NFC, CRLF→LF | encoding normalization; OS line-ending noise |
| `dict` | keys and values canonicalized | key-order noise in serialized dicts |
| `set`/`frozenset` | `frozenset` | sets stay sets — converting to list would silently equate `{1,2}` with `[2,1]`, a loosening |
| numbers, bools, bytes, None | unchanged | pass through; bools are never relaxed |

**Key design decisions**:
- Sets stay frozensets. Converting `{1,2}` to `[1,2]` for comparison would make `{1,2} == [2,1]`
  pass. This module explicitly refuses that loosening — sets are compared as frozensets.
- A dict key collision after NFC normalization raises `AssertionError` clearly. This is a
  spec-authoring error (two keys that are identical under Unicode normalization).
- Tuples inside set elements stay as tuples (canonicalized elements) to preserve hashability.

### 2.2 Declared, sealed relaxations (explicit kwargs, default-deny)

Relaxations that affect what counts as correct must be explicitly declared in the step code
as kwargs and are therefore sealed with the spec via `bindings.json` → `spec_hash`. They are
never global and never tunable after rollouts start.

| Kwarg | Effect | When to use |
| --- | --- | --- |
| `unordered=True` | Multiset (bag) compare at top level only; duplicates still count; nested lists stay order-sensitive | ONLY when the readable spec explicitly states order does not matter |
| `float_tol=(rel, abs)` | `math.isclose` at numeric leaves; booleans excluded | ONLY when the readable spec declares a numeric tolerance |
| `normalize_ws=True` (text only) | Per-line strip + whitespace-run collapse | ONLY when whitespace-insensitive text is the stated contract |

**Default-deny**: without explicit kwargs, comparison is order-sensitive, exact-float, exact-keys.
The `unordered` relaxation is effectively unreachable in V1 because the BUSINESS/QA prompts do not
instruct the model to state order-independence in scenario text. This is deliberate and safe.

---

## 3. Implementation: `spec_compare.py`

Single file, stdlib-only (`unicodedata`, `math`, `json`), Python 3.8-compatible. Copied verbatim
into spec bundles and vendored into SWE-bench containers; must have zero `hit_sdd_e2` imports.

Public API:
```python
spec_assert_equal(actual, expected, unordered=False, float_tol=None)
spec_assert_json_equal(actual, expected, unordered=False, float_tol=None)
spec_assert_text_equal(actual, expected, normalize_ws=False)
```

All raise `AssertionError` showing both canonical forms (bounded repr).

### 3.1 Sealing mechanism

`spec_compare_version` is added to `bindings.json` (alongside `converter_version`) so comparison
semantics are covered by the existing `spec_hash` computation. Changing the comparison semantics
requires a new version string, which invalidates the sealed hash — preventing silent semantic drift
after sealing.

### 3.2 Import injection

At compile time, if any step code references `spec_assert_*` and no authored import mentions
`spec_compare`, the compiler prepends:
```python
from spec_compare import spec_assert_equal, spec_assert_json_equal, spec_assert_text_equal
```
This is a derived artifact pinned by `spec_compare_version`; authored bindings stay as authored.
The injection rule is deterministic and does not affect the sealed content of `bindings.json`.

### 3.3 Container availability

`spec_compare.py` is available inside the SWE-bench container via two paths:
1. **Primary**: `PYTHONPATH=/authored_spec/vendor` — the vendor dir is built by `vendor_pytest_bdd`
   which now also copies `spec_compare.py` into the vendor.
2. **Fallback**: the `checks/` directory — copied at compile time; pytest's default prepend-import
   mode adds the test file's directory to `sys.path`.

---

## 4. Two-sided admission gates

Authored checks must pass BOTH sides of a validity test before sealing:

### 4.1 k-diverse gate (overspec guard)

Generate k independently-styled CORRECT implementations (not visible to the gate author):
1. Each must first pass the gold FAIL_TO_PASS test suite (correctness certificate).
2. Every certified-correct variant must then PASS all authored checks.
3. If any certified-correct variant FAILS a check → over-specification.

`passed` iff `n_certified >= 1` AND zero overspec failures.

Zero certified = not assessable (not a gate failure; logged as "cannot assess spec tightness").
The gold F2P suite provides the correctness certificate; this is standard SWE-bench practice.

### 4.2 Spec-lawyer gate (underspec guard)

Generate n perverse-but-legal implementations (see only the readable spec; NOT the issue text,
NOT the authored checks):
- Each exploits silences in the readable spec — legal per the spec's letter, wrong per its spirit.
- If any lawyer variant PASSES all authored checks → under-specification.

No correctness certificate: lawyers are legal-by-spec, not gold-correct.

### 4.3 Prior art and our synthesis

Two-sided oracle assessment (valid implementations must pass; invalid/perverse ones must fail) is
established practice:
- Jahangirova 2016: "An Empirical Evaluation of Mutation Testing for Improving the Test Quality
  of Safety-Critical Software"
- FRAGGEN 2023: adversarial fragment generation for oracle adequacy

**Our synthesis**: using two-sided oracle assessment specifically to admit and validate comparison
tolerance rules (the canonical-A relaxations) is not standard practice. We use the gates to confirm
that a declared relaxation (e.g. `unordered=True`) does not cause the spec to pass implementations
that should fail. This is novel and is documented as such; results from the admission gates should
not be presented as standard practice without this caveat.

---

## 5. Discipline for step-code authors (DEV_PROMPT_V4)

- Use `spec_assert_equal` for structured values (lists, tuples, dicts, nested structures).
- Use `spec_assert_text_equal` for plain text output.
- Use `spec_assert_json_equal` for JSON string output.
- Use plain `assert x == <literal>` for exact scalars (booleans, small ints, error types).
- Add `unordered=True` ONLY if the scenario text explicitly states order does not matter.
- Add `float_tol` ONLY if the readable spec declares a numeric tolerance.
- Do NOT add `from spec_compare import ...` to imports — it is auto-injected at compile time.
- `then_reference` rule unchanged: a concrete literal that appears verbatim in the Then code,
  inside the `spec_assert_*` call.

---

## 6. Failure-mode screen (before sealing)

The screen pass classifies gate failures by mode using `failure_modes.classify_check_failure`:

| Mode | Trigger | canonical-A fix? |
| --- | --- | --- |
| `crash_surface_fidelity` | ERROR outcome, or FAIL with TypeError/ImportError/AttributeError/NameError/SyntaxError/fixture error | No — wrong import or API call; fix the binding |
| `assertion_mismatch` | FAIL with AssertionError/assert/spec_compare mismatch in tail | Often yes — re-author with `spec_assert_*` and check |
| `unclassified` | FAIL with no recognized token | Investigate; may be container/timeout issue |

Task-level: `non_reproducible` = no-op patch passes (non-triviality gate correctly rejected it).

**Context note**: `base_validation._FIDELITY_TOKENS` excludes `AttributeError` because at author
time an AttributeError on a new method is healthy red-first behavior. At gold-screen time, an
AttributeError means the check misspelled the API — so `failure_modes.FIDELITY_TOKENS_GOLD_SCREEN`
adds `AttributeError` to the token set.

---

## 7. Versions and sealed history

| Version | File | Key change |
| --- | --- | --- |
| `spec-compare-v1` | `spec_compare.py` | Initial canonical-A implementation |
| `DEV_PROMPT_V4` | `authoring.py` | Added comparison-discipline block |
| `authored-spec-authoring-transcript-v4` | `authoring.py` | Transcript schema for V4 |
