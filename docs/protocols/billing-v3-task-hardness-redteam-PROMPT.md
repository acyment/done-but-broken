# Red-Team Prompt: Will This Task Actually Defeat Two Frontier Coding Models?

*Paste everything below the line into another AI assistant (or hand to a human reviewer). It is
self-contained — no codebase access needed. Its single job is to predict whether our "harder"
task will genuinely trouble two specific strong models, or whether they will ace it anyway.*

---

You are an **adversarial task-design reviewer**. We have built a programming task specifically
engineered to defeat two strong coding models. We believe it is hard for them. **Your job is to
prove us wrong** — to predict the concrete ways each model will sail through it without trouble,
and to rate how likely that is. Do not be encouraging. Assume we are fooling ourselves and find
the holes. If you think the task *will* trouble them, say exactly which mechanism does the work
and why it can't be dodged.

## The setup

A coding agent works through **18 sequential checkpoints**. Each checkpoint adds a new
requirement to a **shared, accumulating multi-file TypeScript codebase** (a billing system: ~10
files — subscriptions, invoices, proration, coupons, refunds, dunning, serializers, an audit
log, a money/allocation module, and a facade). The codebase **carries forward**: checkpoint N
edits the state left by checkpoint N−1. The agent gets up to **12 turns per checkpoint** and can
emit at most **~4,000 tokens of code per turn**. A hidden test oracle (197 cumulative cases)
scores the whole workspace at each checkpoint's end. Score = mean cumulative pass rate across
checkpoints. A "regression" = a case that passed at one checkpoint's end and **fails at a later
checkpoint's end**.

We run this in two modes (only the first is relevant to you here):
- **Control:** the agent sees the spec text and may write/run its **own** scratch tests, but
  cannot run the hidden oracle.
- (Treatment, later: the agent can run the hidden oracle each turn.)

The experiment only works if the **control** mode genuinely struggles — specifically, if a
strong model **silently breaks earlier checkpoints' guarantees** while satisfying new
requirements, and cannot tell it has done so.

## The two models — and what they have already done to our easier tasks

These are not weak models. On prior tasks:

- **DeepSeek V4 Pro** (very strong; ~80% SWE-Bench Verified). On a task whose difficulty was
  "propagate a change to ~4 scattered code sites," it scored **0.93–0.98 (near-perfect) with no
  feedback, across 3 seeds**, by **brute-force searching**: it spent ~8 turns per checkpoint
  exhaustively hunting until it had updated every site. It is patient, thorough, and re-reads
  the whole workspace.
- **Qwen 3.7 Max** (strong). On an earlier version of *this* billing task it scored **0.94 with
  zero regressions**. In a partial run of the current task it maintained the hardest invariant
  **perfectly through 6 checkpoints** — right up until the point where the task tries to force
  the issue. Notably, in our prior observations these models **re-read the workspace and
  carefully preserve code they are not explicitly required to touch.**

Every previous attempt to make a task hard for these models has failed: they ceiling it. We
need to know if this one is different *before* we spend money running it.

## What we changed to (we hope) defeat them — the core mechanism

Two ideas, because "find the scattered sites" is brute-forceable and these models brute-force:

**(1) A seeded deterministic state-hash "spine."** From checkpoint 1, the codebase contains a
function `replayStateHash(events)` that serializes the *entire accumulated domain state* in a
**canonical field order** and hashes it with FNV-1a (32-bit). Hidden cases re-check this hash
**cumulatively at every checkpoint**. There is a documented "canonical field registry" (an
ordered list of which fields of which aggregates get serialized, in which order). **13 of the 18
checkpoints extend the state**, and each one's spec **explicitly tells the agent** the exact
registry addition (field name, owning aggregate, position) **and gives a worked example** (a
sample event list → its expected hash). The claim: if the agent ever adds a field in the wrong
position, omits one, or reorders, **the hash changes and every prior checkpoint's hash case
silently flips to failing** — and you cannot detect this by *reading* code, only by *executing*
the hash.

**(2) Forced whole-file rewrites of frozen-behavior files.** Five late checkpoints ship
requirements that (we claim) cannot be satisfied without **restructuring a file that owns
byte-frozen behavior from earlier checkpoints**:

| CP | New requirement | Frozen file it forces a rewrite of | Earlier guarantees at risk |
| --- | --- | --- | --- |
| 13 | audit query API (pagination + type filters) | `audit.ts` | gap-free monotonic sequence numbers + the replay hash, frozen across all prior features |
| 15 | v2 serializer via a serializer-registry restructure | `serializers.ts` | v1 output must stay **byte-identical** |
| 16 | finalized-invoice immutability; recompute creates `-rN` docs | `invoice.ts` | invoice totals = sum of rounded lines |
| 17 | weighted allocation generalization | `money.ts` | half-even line rounding; largest-remainder split; the replay hash |
| 18 | generalized duplicate-event idempotency (modifies CP03's rule) | facade/refunds/dunning | refund caps, failure counts, immutability, the replay hash |

The bet: forced to re-emit a frozen file in full under a 4,000-token/turn limit, while honoring
constraints stated up to a dozen checkpoints earlier, a model will **slip at least once** — and
in control mode won't know.

## What we have already proven mechanically (no model involved)

- The reference solution scores **100% at every checkpoint** (the task is solvable and the
  oracle is clean).
- A deliberately careless scripted "naive agent" produces **≥4 real cross-checkpoint regressions
  across ≥3 files**, which the oracle catches (the regression surface exists and is detectable).
- Every file fits the token budget (largest ≈1,734 tokens < 4,000) — so a forced rewrite is
  *physically possible* in one turn (an earlier task version failed here: a file grew too big to
  re-emit, which we wrongly read as "difficulty"; that is fixed).
- "Frozen baseline" checks confirm: a workspace correct through checkpoint k−1 passes all old
  cases and fails only checkpoint k's new cases.

## The bet, stated plainly

> Even a careful, patient frontier model, when *forced* to rewrite frozen files across 5 late
> checkpoints while maintaining an append-only hash registry it cannot eyeball-verify, will
> introduce ≥2 silent regressions it cannot detect without executing the hidden oracle — and
> mere extra turns won't save it, because the failure is invisible to inspection.

## Your task — attack this, hard

For **each** model (DeepSeek V4 Pro and Qwen 3.7 Max separately, since they behave differently),
answer:

1. **The killer escape hatch.** The control agent can **write and run its own scratch tests**,
   and it is *handed a worked example* `(events → expected hash)` for every registry change. What
   stops it from writing one tiny self-test — `assert replayStateHash(example) === "abc123"` —
   running it after every rewrite, and catching its own slip immediately? If that works, the two
   modes collapse and the whole experiment is dead. How likely is each model to do this
   spontaneously? How would you make the task robust to it *without* becoming unfair (we may not
   hide information from the control arm that the treatment arm gets — both see identical text)?

2. **Dodging the forced rewrite.** We *assert* CP13/15/16/17/18 "cannot be satisfied without
   restructuring the frozen file." Is that actually true, or can a strong model satisfy the new
   requirement with a **minimal localized add** (a new function, an adapter, a parallel module)
   that never touches the frozen code — and thus never risks the regression? Where is each model
   most likely to find such a shim?

3. **Will they even slip?** Each registry change is *explicitly specified with a worked
   example*. Given these models re-read the whole workspace and carefully preserve untouched
   code, is "they'll slip on an explicitly-specified append-only list" a realistic prediction or
   wishful thinking? What's your honest probability that DeepSeek (8-turns-of-brute-force,
   re-reads everything) introduces ≥2 such regressions across 18 checkpoints in control mode?
   Same for Qwen.

4. **Brute-force counter-tactics.** DeepSeek defeats difficulty by spending turns. With 12
   turns/checkpoint, what does "spend more turns" let it do here that neutralizes the hash spine?
   (e.g., re-derive the full registry from scratch each time, recompute hashes by hand, diff
   against a remembered prior state.) Is 12 turns enough for it to brute-force *this*?

5. **Is the difficulty fair or a gotcha?** Is "match a hash you can't compute in your head" a
   legitimate stand-in for real engineering value (byte-stable serialization, deterministic
   replay — things humans also can't eyeball-verify), or is it an artificial trap that proves
   nothing about whether executable feedback helps real work?

6. **If you were us, what would you change** to maximize the chance this task genuinely troubles
   *both* models in control mode, while staying fair (no information asymmetry between modes, no
   ambiguity, the oracle stays clean)?

## Output format

For each numbered item: a 1–2 sentence verdict, then the reasoning. End with:
- **DeepSeek V4 Pro: P(task troubles it in control mode) = __%**, one-line justification.
- **Qwen 3.7 Max: P(task troubles it in control mode) = __%**, one-line justification.
- **The single most likely reason this experiment produces a boring null** (the model aces it),
  and the single highest-leverage fix.
