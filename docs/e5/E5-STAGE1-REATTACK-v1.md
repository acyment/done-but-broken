# E5 Stage-1 re-attack v1 — Step-6 hostile pass on the prereg DRAFT

Executed 2026-07-23, fresh session, zero model spend (reads + writing only). Role: single
hostile skeptic per `docs/methodology/THREE-AMIGOS-DESIGN-REVIEW-v1.md` — attack the
PROJECTED RESULT of `docs/e5/E5-STAGE1-PREREG-DRAFT-v1.md` in both the win framing (the
Level-4 claim is published; destroy it) and the null framing (Δ ≈ 0 is published; show how
the draft's own machinery could have manufactured it). D1–D10, the fork decision, and the
run-ladder vocabulary are settled inputs — attacks below target how the draft COMPOSES
them, not the decisions themselves. No draft edits in this session.

**VERDICT (stated up front, restated at the end): NO FATAL FLAW. The draft may proceed to
revision (v2) and then Three Amigos. Fifteen MAJOR findings must be fixed in the revision
before freeze; none requires structural redesign — every neutralizing change is a claim-rule
amendment, a pre-declared branch, an authoring-hygiene rule, or a wording rule.**

Severity key: FATAL = freeze must not happen without a fix / redesign required. MAJOR = fix
in the v2 revision before freeze. MINOR = record and move on (accept-of-risk acceptable).

---

## A. MAJOR findings (ranked most severe first)

### R1 — The §6.2 claim rule is gameable: a covered-surface-only win publishes as a full hidden-surface claim
**Sections attacked:** §6.2 (claim rule criterion 1), §3.2. **Framing:** win.

Criterion 1 requires Δ < 0 with p < 0.05 "on the **hidden** surface (not only
covered/visible)". But the full hidden surface **includes** the covered checks. The visible
Gherkin scenarios and the upstream hidden pytest suites both derive from the same
checkpoint specs, so the covered fraction of the hidden surface may be large — plausibly
dominant. A treatment win driven 100% by covered checks (T iterating against its runner
until behaviors mirrored by hidden checks pass) satisfies criterion 1 *literally* while the
uncovered slice shows nothing. §3.2's scoping sentence ("If T improves only on the covered
surface, the claim scopes to 'the tool keeps its literal promises'") has **no operational
trigger**: no threshold, no test on the uncovered slice, no definition of "improves only".
The parenthetical in criterion 1 is aspiration, not a rule. A hostile commenter lands H2 in
its strongest surviving form: "the 'hidden' surface is mostly a mirror of the worksheet you
let the student self-grade, and your claim rule never checks the part that isn't."

**Neutralizing change:** operationalize the scoping decision in §6.2, frozen before any T
run. E.g.: report Δ_covered and Δ_uncovered separately (already implied by §3.2); the
unscoped Level-4 claim additionally requires the uncovered-slice point estimate to be
directionally beneficial (Δ_uncovered ≤ 0) with the covered/uncovered event counts
published; if the uncovered slice is directionally adverse or empty of events, the claim
auto-scopes to "keeps its literal promises on the checked surface" — as a rule, not a
narrative option. Also pre-commit the expected covered-fraction: if the frozen coverage map
shows > X% (name X) of hidden checks covered, say so in the claim language ("the hidden
surface substantially overlaps the promised surface — by construction of the construct").

### R2 — The §9 floor gate is a coin flip at its own floor; the transition-level "backstop" has no decision rule
**Sections attacked:** §9(c), §10.1/§10.3, §14 inputs 5–6. **Framing:** null (and wasted-spend).

The gate is pass-iff ≥ 3/8 pilot chains regression-affected. Binomial operating
characteristics, which the draft never states: at a true chain rate of exactly the 30%
nominal floor, P(pass) ≈ 0.45 — the gate is a coin flip at its own floor. At a true rate of
40% (healthy), P(abort) ≈ 0.31 — nearly one-in-three false aborts into the escalation
ladder. At a true rate of 20% (floor-failing), P(pass) ≈ 0.20 — one-in-five chance of
green-lighting a confirmatory run that is event-starved by the draft's own definition, which
is precisely the P1.1 seed-220 class of loss the exposure precondition exists to prevent,
now at rung-3 scale. The draft records the transition-level rate "as the precision backstop"
but attaches **no decision rule to it** — as written it is a fig leaf: a number that gets
recorded while the noisy chain-level count decides everything.

**Neutralizing change:** (a) state the gate's error table in §9 (it is three lines of
binomial arithmetic); (b) give the backstop a role — e.g. a pre-declared two-key rule:
proceed iff chain-level ≥ 3/8 **and** transition-level regression rate ≥ a stated floor
(~35–40 pilot transitions give it real precision), with the discordant case (one key passes)
pre-assigned to a named outcome (recommend: treat as below-floor → ladder); or (c) accept
the noise explicitly in §14 input 6 as an operator-ratified risk with the error table shown.
(a) is mandatory; (b) vs (c) is the operator's call at ratification.

### R3 — No ceiling branch: a high pilot base rate manufactures a null through the saturated chain-level binary
**Sections attacked:** §11.1/§11.2, §6.1, §9. **Framing:** null.

The exposure machinery is one-sided. §9 aborts when control events are too RARE. Nothing
handles the opposite tail: if the pilot measures p_C ≈ 0.9+ (plausible — the SlopCodeBench
strict prior is ≥ 85% strict-failure for the best agent), the chain-level binary saturates
in both arms: a chain with 5 regression events and a chain with 1 both score R = 1, so a
real and large reduction in event *counts* produces Δ_binary ≈ 0 and near-zero discordant
pairs. The power table stops at p_C = 0.70 and the freeze-of-N step ("the pilot's measured
rate replaces these") has no rule for what happens when the measured rate makes the binary
primary insensitive **by construction**. That is a manufactured null the draft's honesty
machinery does not currently cover. Relatedly, §11.2 understates one number a skeptic will
compute anyway: at the default N = 33, power for a parent-sized effect (30.7 pp) is roughly
0.65–0.70 — the default is underpowered for the single most likely effect size.

**Neutralizing change:** pre-declare the ceiling branch NOW, exercised at freeze-of-N
(post-rung-1, pre-any-T-run — still legitimately pre-treatment): if pilot p̂_C ≥ a stated
ceiling (recommend 0.75), the primary switches to a paired event-count contrast defined in
this document (e.g. paired Wilcoxon on per-chain regression-event counts on the full hidden
surface, same ITT/final-attempt grading), and the chain-binary demotes to secondary. Because
the switch is conditioned only on control data and declared before any treatment outcome
exists, it is clean. Also add the power-at-default-for-parent-sized-effect number to §11.2
explicitly.

### R4 — The 3× flake screen leaks by arithmetic, and the fail-any rule amplifies what leaks (adjudicates §16.5)
**Sections attacked:** §7, §16.5. **Framing:** null primarily; win secondarily.

The draft's own numbers, carried one step further than the draft carries them: a test with
per-execution flake probability f survives the 3× screen (all three runs agree) with
probability f³ + (1−f)³ — at f = 0.10 that is a **73% miss rate**; even at the observed
probe rate for the caught test (f ≈ 1/3), the screen misses ~33% of the time. A surviving
flaky test then fires a false failure under the in-run fail-any rule with probability
1−(1−f)³ ≈ 27% per graded snapshot (f = 0.10). Since eligibility only needs one 3/3-pass
checkpoint (0.73 at f = 0.10), a single surviving flaky test poisons the chain binary in
BOTH arms with high probability across a 5-checkpoint chain — symmetric noise that turns
discordant pairs into concordant (1,1) pairs, i.e. straight dilution toward the null; and
with 33–45 chains it can also fire asymmetrically by luck. The majority-vote sensitivity
bounds this only after the fact. So §16.5's question is answered: the 3× screen alone is NOT
sufficient containment for the identified risk class.

**Neutralizing change:** class-level treatment of the demonstrated risk class, frozen at QC:
enumerate every `interactive_session`-fixture (and any similarly timing-sensitive) test in
the admitted pool; screen that class at a higher multiple (10× is still cheap local
compute — minutes per chain by the probe's own timing) and/or apply the majority-vote (2/3)
event rule to that class in-run while keeping fail-any for the rest, with the class
membership list published in the freeze. Keep the global majority-vote sensitivity as-is.

### R5 — Authoring contamination: nothing stops the scenario/step-def author from reading the hidden referee (sharpens §16.4)
**Sections attacked:** §3.3, §8, §16.4. **Framing:** win.

§3.3 separates step-definition authorship from held-out-probe authorship. It does NOT
separate either from the **upstream hidden test suites**, which sit in the same repo the
author must handle during QC (flake screen, discriminating-check screen, KNOWN_ISSUES
repair). An author who has read `tests/test_checkpoint_N.py` while writing the checkpoint's
Gherkin scenarios (or step definitions) can — deliberately or not — tune the visible suite
toward the hidden surface, inflating the covered fraction and manufacturing exactly the R1
covered-dominance win. The coverage map is then constructed by the same hands. A hostile
commenter: "your visible suite was written by someone staring at the hidden grader." The
sibling-practice toolbox (fresh-session authoring, free subagents) makes real containment
available at zero spend; the draft doesn't use it.

**Neutralizing change:** extend §3.3's separation discipline one level up: scenario blocks
and step definitions are authored in sessions that have NOT opened any upstream test file
for that chain (session-level rule, recorded per chain); the scenario→check coverage map is
built in a separate later session after both sides are frozen; QC screens (which must read
tests) run in yet another session. Record the session separation in the freeze manifest.
Residual same-author risk stays disclosed under §16.4 — this doesn't cure it, it removes
the cheapest and most damaging channel.

### R6 — The κ binding-vs-referee agreement check has no threshold and no consequence
**Sections attacked:** §3.3, §10.1 (rung 2). **Framing:** both.

Scenario faithfulness is load-bearing twice: if the frozen step definitions operationalize
the Gherkin more strictly or more loosely than the upstream hidden checks operationalize
the same spec, then (win framing) T iterates against a surface that systematically differs
from the grading surface and H7/H8 revive ("the knob was set to make the visible suite
predict the referee"), or (null framing) T's runner passes while the referee fails —
mis-targeted feedback that neuters the treatment and buys a null. The draft's only
instrument is the κ agreement check "on the shakedown chains" — measured AFTER freeze, with
**no pre-stated acceptable range and no pre-stated response** to a bad value. As written it
can only ever be narrated post-hoc.

**Neutralizing change:** pre-state in §3.3: the κ (or simple agreement-rate) range that
counts as adequate manipulation; and the response to failure — a bad κ at shakedown is a
calibration failure ⇒ fix step definitions ⇒ **new task version / compatibility boundary**
(per §13.5 machinery) and re-run the affected QC screens, never a quiet re-freeze. State
that κ is computed on covered checks only (uncovered checks are disagreements by design).

### R7 — Chain-broken events can carry the headline with no pre-declared rule when the sensitivity disagrees
**Sections attacked:** §5 (non-runnable rule), §13.3, §6.2. **Framing:** win.

The agent-caused non-runnable rule scores ALL active previously-passed checks as failed —
one broken entrypoint at one checkpoint sets R(i) = 1 outright. The treatment's guaranteed
completion-time run trivially catches does-not-run breakage (it is a smoke test before it
is anything else), so a hostile reading of a win: "the effect is T being told its program
doesn't start — you measured compile-level feedback, not accumulated-promise preservation."
The draft has the right sensitivity (exclude chain-broken-only events) but — unlike the
flake sensitivity, where §7 pre-commits "the claim takes the weaker reading" — there is
**no rule for what happens when the chain-broken sensitivity disagrees with the primary**.
That asymmetry is an experimenter degree of freedom parked exactly where the win is most
likely to be inflated.

**Neutralizing change:** extend the §7 weaker-reading rule to ALL claim-relevant
pre-registered sensitivities in §13.3 (chain-broken-only exclusion, tampered-checkpoint
exclusion, provenance split, flake rule): material disagreement ⇒ both reported and the
claim language takes the weaker reading. Additionally, publish the event-type decomposition
(chain-broken vs behavioral regressions) alongside any positive claim.

### R8 — The primary analysis unit is ambiguous: do codex pairs pool into Δ?
**Sections attacked:** §6.1, §11.2, §14 inputs 2–3, §13.3. **Framing:** both (experimenter degrees of freedom).

§6.1 defines Δ as "mean over chains i" with no statement of which agent's runs constitute
the N = 33 pairs. The codex slice is "8 confirmatory chains run in both arms on codex" —
are those 8 chains *also* run under Claude Code (making 41 chain×agent pairs, 8 chains
contributing twice)? Or are the 33 pairs claude-only with codex a disjoint side-experiment?
Each reading gives a different primary test, different power, and a different p-value — and
the choice could be made after seeing which is prettier. This is a freeze-blocking
ambiguity in a document whose stated convention is "no silent blanks."

**Neutralizing change:** one paragraph in §6.1, frozen: the primary Δ is computed over
chain×bulk-agent pairs only (claude-fable-5, N per §14 input 7); the codex slice is a
separate directional check feeding §6.2 criterion 2 and the §13.3 slice sensitivity, never
pooled into the primary; state whether codex-slice chains are drawn from the same
confirmatory pool and whether they also run under claude (recommend: yes, and the claude
runs of those chains are the ones in the primary).

### R9 — Risk-set asymmetry: the eligibility rule makes the primary biased *against* T, and the draft never says so
**Sections attacked:** §5 (eligibility), §6.1, §11.2. **Framing:** null.

Eligibility-after-first-pass fixed the F7 paradox in one direction only. Under the design's
own hypothesis, T implements more behavior earlier, so T accumulates MORE regression-eligible
checks and more eligible check-transitions than C. At equal per-check hazard, P(≥ 1 event)
is then mechanically higher for T — the chain binary is conservative against the treatment.
For the win framing this is free rigor (a win survived a headwind — worth claiming!). For
the null framing it is an unnamed null-manufacturing channel: a true per-promise benefit can
be exactly cancelled by T keeping more promises. The draft's null-interpretation language
(§11.2/§11.3) never names it, so a null would be published as "no effect" when the honest
reading may be "more promises kept, same per-promise breakage."

**Neutralizing change:** (a) name the bias direction in §11.2's honesty statement; (b) add
a pre-registered secondary: per-chain regression events **per eligible check-transition**
(exposure-normalized hazard), paired across arms; (c) require any null publication to report
the per-arm eligible-set sizes alongside Δ. No change to the primary.

### R10 — Authored-chain dilution: 10 of 33 primary units would enter with zero base-rate evidence
**Sections attacked:** §8 (authoring provision), §11.2, §14 input 7. **Framing:** null.

The §9 floor is measured on 8 pilot chains drawn from the NATIVE corpus. The default
confirmatory adds 10 **authored** chains that no pilot ever touched. If authored chains are
systematically easier (same-author scenarios, cleaner specs, shorter dependency webs — the
natural drift of in-format imitation), they contribute concordant-zero pairs, diluting Δ by
up to 10/33 ≈ 30% and buying a null the floor never screened. The QC screens verify checks
discriminate — they say nothing about whether frontier agents actually break on the chain.
The provenance sensitivity exists (§13.3) but, per R7, has no claim-relevance rule.

**Neutralizing change:** either (a) pre-register an authored-chain difficulty admission
heuristic (match native chains on length and cross-checkpoint dependency density, criteria
frozen before authoring); or (b) accept the risk explicitly: state in §11.2 that the
authored fraction carries unmeasured base-rate risk, elevate the provenance split to a
claim-relevant sensitivity under the R7 weaker-reading rule (a null driven by dead authored
chains must be reported as such, not as "no effect"). (b) is the minimum; (a) is cheap.

### R11 — Claim-rule criterion 2 passes vacuously at zero discordance (adjudicates §16.3: the proposed containment is a fig leaf as written)
**Sections attacked:** §6.2 criterion 2, §16.3, §14 input 3. **Framing:** win.

Criterion 2 requires "Δ ≤ 0 for … the Codex slice". At 8 chains, zero discordant pairs is a
likely outcome, and it yields Δ = 0 — which **satisfies Δ ≤ 0**. An entirely uninformative
codex slice then launders into "both agent CLIs directionally beneficial" in the published
claim. §16.3 flags slice-size noise but its proposed resolution (scoped-claim fallback at
slice = 0) misses the sharper failure at slice = 8: the criterion is not noise-vulnerable so
much as **vacuously satisfiable**.

**Neutralizing change:** an evaluability rule in §6.2: criterion 2 is evaluable only if the
codex slice contains ≥ 2 discordant pairs; otherwise it is recorded as "not evaluable" and
the claim auto-scopes to "under this agent" — identical treatment to the slice-0 case.
Change "Δ ≤ 0" to "Δ < 0 among discordant pairs" for the evaluable case, or keep ≤ with the
evaluability precondition. §16.3's question is thereby answered: minimum evaluable slice,
defined by discordance not chain count.

### R12 — The shakedown creates outcomes §13.5 then forbids reacting to; freeze-of-N contradicts the immutability wording
**Sections attacked:** §10.1 (rung 2), §13.5, §11.3. **Framing:** both (process trap).

§13.5 freezes referee/assets/metrics "after the first arm-level outcome is observed." Rung 2
produces arm-level outcomes (calibration-classified, but observed) — and rung 2 exists
precisely to catch plumbing faults that may **require** changes. As written, any
post-shakedown fix either violates §13.5 or silently invokes new-version machinery nobody
has scoped. Separately, freeze-of-N (§11.1/§11.3) deliberately happens AFTER rung-1 outcomes
are observed — a pre-declared, control-conditioned adaptation that the blanket §13.5
language technically forbids. Neither tension is fatal; both are wording traps a hostile
reviewer will spring ("you changed the harness after observing arm outcomes").

**Neutralizing change:** scope §13.5 explicitly: (a) freeze-of-N and the R3 ceiling branch
are pre-declared adaptations conditioned only on control-arm (rung-1) data, exercised before
any treatment outcome exists — permitted by construction; (b) define the post-shakedown
change policy: plumbing/orchestration fixes (snapshot mechanics, wrapper bugs, prompt
plumbing) are permitted with a logged changelist; any change to referee content, visible
assets, scenario text, step definitions, or metrics after rung 2 = new task version + new
compatibility boundary + re-run of affected QC screens, and rung 2 repeats.

### R13 — The minimized feedback channel is an unrecorded null path with no manipulation check
**Sections attacked:** §2.3 (feedback content), §4, §16 (omission). **Framing:** null.

Feedback is minimized to scenario ID + pass/fail + a minimal assertion-boundary diff — a
deliberate anti-leak choice (F9). The cost side is never examined: if the minimized content
is insufficient to LOCALIZE a failure (which scenario step, which behavior, where), the
treatment's information channel is throttled by the design itself, and a null is partly
self-inflicted. The task-brief's own null-framing list names this path; §16 misses it
entirely. The on-demand runner mitigates (the agent can iterate) but iteration against
uninformative output is exactly the failure mode to check, not assume away.

**Neutralizing change:** (a) add a shakedown (rung 2) manipulation check: for a sample of
induced failures, verify from the trajectory that the agent could and did localize the
failing behavior from the minimized output (or record that it could not); (b) add the
minimization choice to the pre-registered null-interpretation language: a null is "under
this feedback content spec," and the content spec is published. Zero structural change.

### R14 — The Level-4 win sentence omits its own comparator; the TDAD caveat lives in §4 but not in the claim wording
**Sections attacked:** §1.4, §4. **Framing:** win (wording overreach).

§4 correctly pre-registers that the contrast is executable-vs-prose **under an identical
instructed review ritual** — and cites TDAD's L2-verified finding that instructed
verification prose without execution can make regressions *worse*, i.e. the control ritual
may sit below an ambient baseline. But the §1.4 claim template ("executable acceptance
feedback did/did not reduce accumulated-surface regressions under this task/model/budget")
never carries the comparator. A published win in that wording claims more than the design
identifies: the estimand is "vs identical prose-scenario review ritual", not "vs how agents
otherwise work". Hostile version: "your control was rigged below baseline by a ritual TDAD
says is harmful, then you beat it and dropped the comparator from the headline."

**Neutralizing change:** amend the §1.4 template to name the comparator: "…reduced
accumulated-surface regressions **relative to identical prose scenarios under a matched
review ritual**, under this task/model/budget." Require the C-attempt-1 vs C-final curve
(does the ritual itself help or hurt C?) to be published alongside any claim, win or null —
the decomposition already produces it for free.

### R15 — The $25 rung-3 cap is an unsourced number in a document whose convention bans unsourced numbers
**Sections attacked:** §14 input 1 (and input 3). **Framing:** wasted-spend / process.

"Metered cap $25 total (covers a codex API slice if chosen)" carries no cost model. A rough
one: 8 chains × 2 arms × ~5.4 checkpoints ≈ 86 agentic checkpoint-sessions on a metered
codex model; at plausible per-session agentic costs this lands well above $25. If the
operator selects the API-key option on the recommended cap, the predictable outcome is a
mid-slice hard abort — spend with no readout, the exact failure class this program's spend
discipline exists to prevent. This is also the draft's only violation of its own "every
number stated (source named) or operator input" convention: $25 is a recommended default
whose feasibility claim ("covers a codex API slice") has no source.

**Neutralizing change:** strike the feasibility claim; add a sourcing rule: the codex-API
cost estimate is computed from rung-1 token telemetry × published codex pricing and
presented at §14 ratification BEFORE the auth-mode choice; the cap is then set from the
estimate with stated headroom. (The account-auth default itself is unaffected — $0 marginal.)

---

## B. MINOR findings (record; accept-of-risk acceptable)

### r16 — Memorization probe covers 3 of ~31 admitted chains
**§8.** Rung 0 probes 3 chains; exclusion applies per-chain; the other ~28 are admitted on
no evidence. The draft's direction argument (contamination → null bias, and rung 1 measures
the surviving consequence directly) is sound and makes this self-limiting, and the corpus
post-dates the stated claude knowledge cutoff. **Change:** add the dating argument
explicitly (corpus commit 2026-05-16 vs each roster model's cutoff, codex included); if any
roster model's cutoff post-dates the corpus, scale the probe up (subscription-only, cheap)
or justify the 3-chain sample as corpus-level inference in so many words.

### r17 — L2 extension checkpoints are not explicitly bound to the QC screens (adjudicates §16.2)
**§10.3.** Adjudication of §16.2: L2 is worth keeping — it is cheap, information-preserving,
and its containment (new Stage-1b prereg, disclosed provenance, published either way) is
real, not a fig leaf; a straight stop would discard the one affordable difficulty probe
remaining. **Change:** one sentence — L2-authored extension checkpoints pass the identical
QC rung (flake screen, discriminating-check screen, lifecycle metadata) before any re-run.

### r18 — Author-model = subject-model overlap is undisclosed
**§16.4.** Scenarios/step defs/probes will be authored with Claude assistance; the bulk
agent is claude-fable-5. Claude-authored phrasing may be differentially legible to Claude
agents — direction unclear, symmetric across arms, but it flavors the codex-vs-claude slice
comparison. **Change:** one disclosure sentence in §16.4.

### r19 — OpenSpec archive-step interaction with injected/mirrored files is asserted nowhere specific
**§2.2/§2.3.** The pinned-CLI gotchas are named, but the specific hazards — the archive
step rewriting accumulated scenario text in the workspace (the known MODIFIED-replace
surface), and its interaction with T's mirrored feature files and the hash check ("mirrors
hash-checked against the shared spec text" — which text: injected-frozen or post-archive
workspace?) — are not in any assertion list. **Change:** name both in the rung-2 shakedown
assertion list; define the hash-check reference as the frozen catalog text, not workspace
state.

### r20 — No cap on per-chain flake-screen attrition
**§7/§8.** A chain whose screen excludes many tests keeps a thinned hidden surface and
enters the pool event-poor. **Change:** publish per-chain exclusion counts (already
required) plus a pre-set admission cap (e.g. a chain losing > 10% of its referee checks to
the screen is inadmissible pending repair).

### r21 — Timeout-exit vs completion-declaration parity is undefined
**§4/§12.** Completion-declaration = CLI process exit; a codex 7200 s timeout-kill is also
an exit. Whether a timed-out attempt 1 gets the revise turn, in both arms identically, is
unstated. **Change:** one sentence defining timeout handling as identical across arms and
recorded as a validity annotation.

### r22 — Coverage-map scale is unexamined
**§3.2.** Labeling every hidden check across ~170 admitted checkpoints (chains like xjq
carry 167 tests at the final checkpoint) is thousands of covered/uncovered judgments by the
same author (see R5). **Change:** state the mapping method (mechanical first-pass +
recorded human audit of a sample; sample size named) in §3.2.

### r23 — Paired back-to-back runs share subscription/rate-limit state
**§12.1.** Order randomization handles it in expectation; backoff events could still hit
the second-run arm asymmetrically within a pair. **Change:** log rate-limit/backoff events
per run (upstream `HIT_RATE_LIMITED` state) and include them in the validity-flag review.

### r24 — Codex account-auth optics for the public write-up
**§12.3/§14 input 4.** Already an operator input with the API-key alternative named;
recorded here only because a hostile commenter will raise it against a published win that
leaned on account-auth runs. Accept-of-risk at ratification is legitimate; the write-up
should state the auth mode either way (it is already in the manifest).

---

## C. Adjudication of the five §16 open issues

1. **§16.1 (power vs corpus scarcity):** the honesty statement is REAL (the draft states
   MDE 30–40 pp, names it worse than the panel's band, and pre-commits the null framing).
   Incomplete in two places: the missing ceiling branch (R3) and the unstated
   power-at-default for a parent-sized effect (R3). Of the candidate rescues: **reject** a
   transition-level primary now (assumption-laden; the GLMM companion already exists);
   **reject** replicates at default budget (clustered gains too small per §14 input 8);
   **keep** the chain-binary primary with the R3 pre-declared count-based ceiling branch;
   **accept** large-effect-only scope with the null framing carrying small effects.
2. **§16.2 (L2 self-authoring):** containment is real; keep L2 (r17 adds the missing QC
   sentence). Not a fig leaf.
3. **§16.3 (criterion 2 vs slice):** the proposed scoped-claim fallback is a **fig leaf as
   written** — it handles slice = 0 but not the vacuous Δ = 0 pass at slice = 8. Replace
   per R11 (discordance-based evaluability rule).
4. **§16.4 (same-author concentration):** disclosure posture is honest and the mechanical
   mitigations are real, but the containment is incomplete: it never firewalls the
   scenario/step-def author from the upstream hidden tests, which is the cheapest and most
   damaging contamination channel (R5), and it omits the author-model overlap (r18). With
   R5 + r18 applied, accept the residual — true author independence is genuinely
   unavailable in a one-operator program and the draft says so.
5. **§16.5 (interactive-fixture flakes):** the draft's containment (3× screen +
   majority-vote sensitivity) is **insufficient by its own arithmetic** (R4). Adopt the
   class-level rule: enumerate the class, screen it at 10×, and/or majority-vote that class
   in-run. Question answered: yes, a larger multiple — but targeted at the class, not
   globally.

---

## D. Attacks mounted that the draft survived (recorded for the Three Amigos)

- **ITT estimand + structural absence (D3/D4 composition):** attacked as strawman-control
  and as unenforceable-ban; survives — self-verification is allowed, instrumented, and the
  estimand language ("provided … vs frontier-agent initiative") matches what is identified.
- **Exposure precondition compliance:** §9 names the event, the base rate with sources, and
  a pre-spend abort — the AGENTS.md shape is genuinely met (R2 attacks the gate's precision,
  not its existence).
- **Discriminating-check precondition:** per-individual-check, with a concrete B(n)
  definition including held-out probes. Sound.
- **Visible-vs-hidden gap rule:** §3.2 makes the gap a headline figure. Compliant (R1
  attacks the claim rule built on top of it, not the reporting).
- **OpenSpec scoping:** shared-environment property under `e1-openspec-workflow-v0`, never
  a condition or arm; banned strings absent from condition IDs; no cross-program pooling.
  Compliant. (Reusing the E1-named profile is required by the binding constraint, and the
  no-pooling language is present.)
- **Run classifications / claim ladder:** rungs 0–3 classified within vocabulary; nothing
  exceeds Level 4; pilot published regardless of outcome. Compliant.
- **Replay-validity, tamper telemetry, parity validator, interleaved scheduling, pinned
  builds:** all present and correctly composed from D7/F10 and the E4-grade rule.
- **Eligibility rule (F7) as such:** the can't-regress-what-never-worked rule is correct;
  R9 attacks the unnamed direction of its residual bias, not the rule.
- **Memorization direction argument:** contamination here biases toward null, and rung 1
  measures the surviving consequence directly — the argument holds (r16 is about probe
  coverage, not the logic).

---

## E. Verdict

**The draft contains NO FATAL flaw. It may proceed to revision (v2) and then to the Three
Amigos review of the resolved draft, in fresh sessions.** Fifteen MAJOR findings (R1–R15)
must be fixed in v2 before any freeze — the load-bearing cluster is R1+R5 (covered-dominance
gameability plus the authoring channel that feeds it), R2+R3 (the floor's noise and the
missing ceiling branch — the two ways the exposure machinery can still buy an uninformative
run), and R4 (flake-screen leakage). All fixes are amendments — claim-rule
operationalizations, pre-declared branches, authoring-hygiene session rules, wording — none
requires redesigning the estimand, the arms, the referee architecture, or the rung ladder.
Nine MINOR findings may be fixed or explicitly accepted at ratification. Nothing in this
document authorizes spend; every run rung still requires separate explicit operator
authorization.
