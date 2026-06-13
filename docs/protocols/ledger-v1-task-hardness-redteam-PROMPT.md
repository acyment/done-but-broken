# Red-Team Prompt: Will the Redesigned Task Defeat Two Frontier Models — or Is It the Same Null in New Clothes?

*Paste everything below the line into another AI assistant (or hand to a human reviewer). Self-contained — no codebase access needed. This is the SECOND red-team in a series: the first one correctly predicted our previous task would fail, and it did, empirically. This task is the redesign built to fix those flaws. Your job is to determine whether the fixes actually hold, or whether we've rebuilt the same null with extra steps.*

---

You are an **adversarial task-design reviewer**. We are building a programming task to test whether **per-case executable feedback** helps a *frontier* coding model. We have already failed once and want to know if our redesign will fail again. **Assume we are fooling ourselves; find the holes.** Do not be encouraging.

## The experiment (unchanged)

An agent works 18 sequential checkpoints on a shared, carried-forward multi-file TypeScript codebase. Each checkpoint adds a requirement; the agent edits the code (≤12 turns/checkpoint, ≤6 verification executions/checkpoint, ≤4000 output tokens/turn). A hidden oracle scores the whole workspace cumulatively at each checkpoint's end. Score = mean cumulative pass rate ("regression-free AUC"). Two arms, **identical visible text, differing only in executability**:
- **Control:** sees the spec; may write/run its OWN scratch tests; cannot run the hidden oracle. Scratch files persist across checkpoints.
- **Treatment:** identical, plus can run the hidden oracle each turn.
The experiment only works if the **control** arm genuinely struggles — silently breaking earlier guarantees while satisfying new requirements, unable to tell.

## What already happened (this is real data, not a prediction)

Our prior task ("billing-v3") used a **deterministic state-hash spine + 'forced' file rewrites** as its difficulty. A first red-team predicted it would fail because (1) we handed the control arm literal `(input → expected hash)` worked examples it could turn into self-tests, (2) the "forced" rewrites were additive and could be shimmed around, (3) appending to an explicit registry list is transcription, not reasoning. **We then ran it: a frontier-class model (Qwen 3.7 Max) scored AUC 0.9628 with ZERO regressions — a clean ceiling.** This was the FOURTH consecutive clean frontier ceiling across our tasks (a stronger model, DeepSeek V4 Pro, ceilinged a different task 3/3 at 0.93–0.98; an earlier billing task ceilinged two models). So the baseline reality is: **strong models do not regress on our cumulative refactoring tasks.** We need to know if the redesign changes that, or just dresses up the same outcome.

## The two models

- **DeepSeek V4 Pro** (~80% SWE-Bench Verified): patient, re-reads the whole workspace, spends ~8 turns/checkpoint brute-forcing, writes its own tests.
- **Qwen 3.7 Max**: careful, preserves untouched code, posted the 0.9628 zero-regression ceiling above.

## The redesign — new domain, new difficulty mechanism

**Domain:** double-entry general ledger (accounts, journal entries that must balance to zero, multi-currency conversion, half-even rounding, rounding-residual allocation, accruals/reversals, period-close immutability, as-of-date balances). Chosen for deep cross-feature entanglement.

**The difficulty mechanism (the core idea):** each late "contract-modifying" checkpoint replaces a primitive `f(args)` that several EARLIER features call, with a generalized `g(argsʹ)`, and **requires the old callers re-expressed via `g` — deleting `f`'s body, not adding `g` beside it.** The spec shows ONE simple **identity-case** worked example (the degenerate input where `g` reduces to `f`). The hidden oracle then probes the **cross-product** of `g`'s new degrees of freedom against every earlier feature flowing through it. A naive generalization passes the identity example but silently changes a tie-break / rounding path / rate selection on a feature several checkpoints back — invisible to inspection, catchable only by executing the interaction case the agent didn't think to enumerate.

The five contract-modifying cores:
1. **`convertAmount(amount,from,to,rateCtx)`** — late CP introduces rate-date policies (txn-date / posting-date / monthly-avg); all earlier conversions must route through it. Identity example: same-day single rate. Hidden: multi-currency entry where txn≠posting date × residual allocation × trial balance.
2. **`allocateResidual(residual,weights,opts)`** — generalizes the rounding-residual splitter to weighted; uniform weights must reproduce the old lowest-index largest-remainder tie-break. Identity: `[1,1,1]`. Hidden: equal-magnitude+odd-residual tie-break, three-posting remainder, residual on a closed-period adjustment.
3. **`renderEntry(entry,formatSpec)`** — v1 (byte-frozen) and v2 export both re-expressed through it; v1 has omit-zero + legacy key aliases. Identity: v2 of a single-currency entry. Hidden: v1 × {multi-currency, residual line, reversal, adjusted entry}.
4. **`postAdjustment(entry,delta)`** — open-period in-place AND closed-period adjust-via-new-entry through one core. Identity: open single-currency correction. Hidden: adjusting a closed-period multi-currency entry (must leave original byte-frozen, re-allocate residual at correct rate-date, keep trial balance zero).
5. **`projectLedger(records,view)`** — per-account log and audit feed from one record stream; per-account sequence numbers derived from it. Identity: single-account. Hidden: multi-account interleaved sequences + the state hash.

**The three fixes (what changed from the failed task):**
- **Fix A — no literal expecteds in the spec.** Worked examples show the `evaluate(...)` *inputs* and the *rule prose* only — never a literal expected value — and only for the current checkpoint's single-feature identity case. Interaction cross-products are HELD OUT (never shown), ≥50% of all cases. (Closes the known-answer leak: the control arm can no longer copy-paste expecteds into self-tests.)
- **Fix B — contract-modifying, not additive.** The new requirement deletes `f`'s body; old callers route through `g`. Enforced by an anti-shim gate: we build a "shim baseline" (keep frozen `f`, add `g` beside it) and require it to FAIL ≥1 *visible* case — made mechanical via an **identity-equivalence visible case** (e.g. `renderEntry(e,V1_SPEC) === serializeEntryV1(e)`). If any shim passes all visible cases, we redesign that checkpoint.
- **Fix C — direct low-level-API cases.** The oracle calls the primitives (`allocateResidual`, `convertAmount`, …) directly, not just through the top-level facade — so a "fix it at the facade / dedup wrapper" dodge can't satisfy them.

## The bet, stated plainly

> A careful frontier model, asked to generalize a shared primitive and route ~3 earlier features through it, will — across ~5 such generalizations — introduce ≥2 silent interaction regressions it cannot detect from the rule + identity example alone, because the correct behavior on the un-exemplified cross-products is not something it reliably thinks to test, and the combinatorial surface is too large to self-enumerate within 12 turns / 6 executions / 4000 tokens. Treatment catches them by executing the held-out cases; control cannot.

## Your task — attack the FIXES specifically

1. **The residual self-test risk (the central question).** Fix A removes literal expecteds but keeps the *rules*. A frontier model that understands "v1 omits zero amounts and uses legacy aliases" or "uniform weights reproduce lowest-index largest-remainder" can RE-DERIVE the correct expected from the rule and write its own interaction test — no leaked answer needed. For each of the five cores, how hard is it for DeepSeek to (a) think to enumerate the dangerous cross-product, AND (b) re-derive its correct expected from the rule prose? Is the "~15 independent cross-products defeats self-enumeration in budget" breadth defense real, or is 12 turns + persistent scratch enough for a patient model to systematically fuzz each primitive against a re-derived oracle? Give a probability the breadth defense holds.

2. **Does the anti-shim gate actually force the rewrite — for the AGENT, not the reference?** Fix B's gate proves (i) the *reference* routes `f` through `g`, and (ii) a naive *additive shim* fails a visible identity-equivalence case. But the agent isn't the reference and isn't the naive shim. Can a careful model satisfy `renderEntry(e,V1_SPEC) === serializeEntryV1(e)` (the visible identity case) while STILL keeping a correct standalone `serializeEntryV1` — i.e. make `g` delegate to `f`, or implement both correctly side-by-side — thereby passing all visible cases AND all hidden cross-products with no regression? If "route f through g" and "keep f correct, make g call f" are both valid and the model picks the safe one, does the regression surface ever get entered? Is the identity-equivalence assertion doing the work we think?

3. **Is the ledger domain's oracle genuinely unambiguous?** The mechanism requires zero spec ambiguity (else a "regression" is just a defensible interpretation difference). Multi-currency + rounding-residual allocation + rate-date policy + half-even banker's rounding + balance-to-zero is a thicket of edge cases. Name the places where the "correct" answer is actually a contestable convention (e.g. which rate-date policy is the default; how residual is allocated when weights tie; rounding direction at exact .5; how a reversal of a multi-currency accrual picks its rate). If the oracle encodes one convention and a competent model picks another, that's an unfair "regression," not a real one — where does that bite?

4. **Strongest alternative explanation for a Stage 2 positive that is NOT "feedback helps."** If treatment beats control, what confounds could produce that besides executable feedback being valuable? (Oracle execution as a free extra reasoning/serialization step; treatment spending its turn budget differently; the held-out cases effectively giving treatment a curriculum control lacks.)

5. **The meta-question — same null in new clothes?** We have FOUR clean frontier ceilings with zero regressions across three task families. Honestly: is there a principled reason interaction-entanglement in a ledger domain will behave differently for these SAME two models, or is the most likely outcome a fifth clean ceiling? If you think it's the same null, say so plainly.

6. **If you were us — better mechanism?** Grounded in this concrete design, propose the single change most likely to make the task genuinely trouble BOTH models in control mode while staying fair (no info asymmetry between arms, no ambiguity, clean oracle). If you believe no fair task can beat these models and the honest finding is "feedback is a mid-tier effect," argue that instead.

## Output format

Per item: a 1–2 sentence verdict, then reasoning. End with:
- **DeepSeek V4 Pro: P(task troubles it in control mode) = __%**, one-line justification.
- **Qwen 3.7 Max: P(task troubles it in control mode) = __%**, one-line justification.
- **P(this is a fifth clean ceiling / same null) = __%.**
- **The single highest-leverage change** — or a reasoned case that we should stop building tasks and report the mid-tier finding.
