# gunicorn smuggling-gate fossil — local verification results v1

Verification of the v4 mechanical pass's lead cluster (`MECHANICAL-PASS-v1.md` §1): the
keepalive-smuggling gate introduced dead by #3614 (`e90b1c2`, 2026-05-03 18:12) and fixed by
#3618 (`0a736ea`, 2026-05-03 19:15). Executed 2026-07-21 by Claude Code, operator-authorized.
Zero model spend — git + pytest. Env: shallow clone (since 2026-03-15), Python 3.13, editable
install. Both trap commits in-window (strict-recency PASS). Fix test artifact preserved at
`verification-raw-gunicorn-smuggling-test.py`.

The fix touches one source file (`gunicorn/asgi/protocol.py`, one hunk) plus its new test.
States constructed by reverting that hunk; the reverted file is **byte-identical to the shipped
pre-fix state** (`git diff 0a736ea~1` empty), so NO-OP = the genuine shipped-broken gate.

## Trap verified — the silence is real and exact

The gate is meant to refuse HTTP keepalive when a request's body was not fully framed (a
request-smuggling defense). The culprit: a `finally` block cleared `self._body_receiver = None`
*before* the connection loop read it to run the gate — so the gate always saw `None` and let
keepalive proceed. A dead security control: nothing errors, nothing fails, the server behaves
normally.

| State | Smuggling e2e test | Ordinary suite (1824 tests) | Behavior on the attack |
|---|---|---|---|
| **NO-OP** (shipped culprit) | FAIL | **all pass** (1 flaky unrelated, see below) | smuggled 2nd request **served** — two `HTTP/1.1 200`, no error |
| **FULL** (fix) | PASS | all pass | smuggled request refused, transport closed |

The NO-OP assertion failure is exact and behavioral: `response.count(b"HTTP/1.1 ") == 2` (both
the legitimate response and the smuggled `/smuggled` request answered) where FULL yields `1` +
closed transport. **Loudness: SILENT** — verified by running the entire non-smuggling suite at
NO-OP: 1824 passed, the sole failure being `test_asgi_worker.py::test_http_request_response`,
which is a **flaky real-socket happy-path GET** (confirmed: 1 fail / 4 pass in 5 runs *at FULL*,
a `free_port` asyncio race, unrelated to the gate). Nothing in the ordinary suite detects the
dead gate. This is a textbook silent trap on a canonical practice-natural surface (raw HTTP,
request smuggling).

## Establishing-item check — gunicorn FAILS it (the important finding)

Per design-note D3, the detector that catches the trap must guard behavior **established before
the trap task** and must not be the trap task's own test. Checked the mechanical pass's proposed
establishing items — the RFC-codification test PRs (#3596/#3599/#3602 etc., "codify rejection of
… RFC 9112 …"). **They do not cover the trap's blast radius — they are the wrong layer:**

- The RFC-codify fixtures live at the **synchronous HTTP parser** layer
  (`tests/requests/{valid,invalid}/rfc91xx_*.py`) and assert that malformed *bytes* are rejected
  (`InvalidHeader`, etc.). They test parser validity.
- The dead gate lives at the **`ASGIProtocol` keepalive** layer. The smuggling attack uses
  *individually well-formed* bytes (a valid request whose body is deliberately short); it passes
  the parser cleanly and is caught only by the keepalive gate.

So a suite of RFC-parser scenarios — the natural "established behavior" a team would have written
first — is **blind at exactly the level the trap breaks**. This is the precise D3/《conceptual
coverage》failure the design note flagged: "scenarios true at the level written, blind at the level
broken."

Worse for the episode framing: the smuggling-refusal behavior was **introduced dead** by #3614
and fixed by #3618 — it never worked in between. There is no "established, working, long-standing
behavior" that the culprit later broke; the only test that exercises the gate is the fix's own.
That is the self-contained regression-pair case D3 explicitly excludes (the control arm, with a
shell, hand-runs the one relevant check and the effect vanishes).

## Verdict

- **As a silent trap: verified, excellent, strict-recency-clean, canonical surface.** Keep it in
  the trap library.
- **As a full-conjunction episode candidate: FAILS the establishing-item requirement.** No
  in-window behavior established *before* the trap covers the gate; the codify PRs are the wrong
  layer; the gate was born broken. Gunicorn is a *regression pair*, not a *trap-plus-establishing-
  item cluster*.
- **Contrast with pandas (still the lead):** pandas' trap breaks `DataFrame.idxmax` correctness —
  a **long-standing, genuinely-working, well-covered** behavior whose establishing item is
  idxmax's own ancient contract (with the in-window EA-reductions API #63512, 2026-06-16, touching
  `masked.py`, as additional same-window scaffolding). The threatened behavior worked for years,
  which is exactly what gunicorn lacks. pandas satisfies D3; gunicorn does not.

## Consequences

1. **The "first complete conjunction" claim from the mechanical pass is retracted on inspection.**
   The mechanical pass could see the trap and the RFC-codify PRs in one window and inferred an
   establishing item; local layer-analysis shows the coverage doesn't connect. This is the
   mechanical/local division of labor working as designed — cheap search proposes, local
   verification disposes.
2. **The establishing-item check has teeth and must run on every candidate**, not just the trap
   verification. It just eliminated the top mechanical candidate on a coverage-layer mismatch that
   no amount of link-checking would have caught.
3. **Standings:** pandas remains the lead and the only substrate with a verified trap AND a
   satisfied establishing item. Gunicorn drops to "verified silent trap, no establishing item" —
   still useful as one arm of a trap library or as a single-trap probe, not as a full episode.
   The service-shaped slot in the two-substrate plan is now **open again** — the mechanical pass's
   other service candidates (pip resume cluster, borg ENOSPC) move up, but both are latent-fossil
   (back-burner) shapes pending the recency ruling, so the clean service-shaped conjunction is
   currently **unfilled**. Worth telling the two scout sessions that a strict-recency,
   establishing-item-satisfying *service/CLI* cluster is the specific open need.

Next (zero spend): re-screen pip/borg for whether a strict-recency establishing item exists
(pip's resume feature and borg's error contract both predate the window — establishing item is
fine per A1, but the *trap culprit* is pre-window, which is the back-burner issue); and carry the
"service-shaped conjunction still open" note into the scout brief.
