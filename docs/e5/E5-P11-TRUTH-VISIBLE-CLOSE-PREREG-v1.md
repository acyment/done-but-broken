# E5 probe P1.1 — truth-visible close, split-oracle design (pre-registration, v1)

**Status: PRE-REGISTERED 2026-07-13, committed BEFORE any run per the §3 probe protocol.
Operator authorization for P1.1: given 2026-07-13 ("Approved", in response to the explicit
P1.1-needs-authorization statement) under the §7-ratified frame (model glm-5.2 through P1;
stop-loss $18 / 8 probe-seeds). Classification: `calibration` — non-evidence, any direction,
logged either way, VOID rules honored.** Probe spec: proposal §3 P1.1
(`docs/e5/E5-HIT-SDD-ENGINEERING-PROPOSAL.md`); probe base = the P0-V.1 product loop
(`e4_arm_p` machinery under v2/v3 constants v0.7, boundary `188f372`).

## 1. Question and kill scope

Does showing the agent the SHOWN half of the hidden acceptance suite's verdicts at the close,
with one budget-matched repair cycle, convert false closes into repaired end-states — scored
on the HELD-OUT half it never sees?

**Kill-scope clause (carried verbatim from the proposal):** a null kills "at-close
visibility" only. The evidenced E1/E2 mechanism was feedback DURING work; a during-work
variant is the designated follow-up, not collateral damage.

## 2. Design

### 2.1 Arms (matched pairs within seed; the only difference is INFORMATION)

Both arms run the identical P0-V.1 product loop (`e4_arm_p`: gate + product gate + PM-brief
ask channel) through the sealed task lifecycle, then a **post-close cycle** per task:

- **Treatment (truth-visible):** after the task closes, the agent (fresh conversation, same
  workspace) is shown the SHOWN-half verdicts of the hidden cumulative suite — check id,
  pass/fail, and the oracle's failure detail for FAILING SHOWN checks only — and gets ONE
  repair cycle: up to **4 turns** and **2 smoke verifications**, code files only
  (openspec/ stays frozen; the spec of record was already archived).
- **Control (budget-matched re-verify):** the identical cycle shape — same fresh-conversation
  framing, same 4 turns / 2 smoke verifications, same code-only writability — with a
  content-free instruction ("before final close, re-verify your implementation and repair
  anything you find") and **no oracle data**.

After the cycle, the FULL cumulative suite is re-run in both arms (recorded as a probe-phase
oracle invocation, distinct from the sealed at-close invocation). The post-cycle workspace
carries forward to the next task in BOTH arms (symmetric carry; only information differs).

### 2.2 Implementation stance (recorded design choice)

The sealed task lifecycle (turn loop, gate, archive, single at-close oracle run, meter,
snapshot, probe question) is **byte-untouched** — the probe layer wraps `runE4V2Task` from a
new, non-sealed module and adds the post-close cycle. Consequences, pinned:

- The disposition table (truthful/false/off-topic close) is measured at the ORIGINAL close,
  exactly as in every prior run — cross-probe comparability preserved.
- The lever is evaluated as END-STATE repair (held-out + full key, before vs after the
  cycle), not as close-prevention. This is deliberately weaker than an in-loop gate and is
  what "at-close visibility" means here; the during-work variant remains the follow-up.
- The probe-phase oracle re-run is NOT the sealed close oracle (A9 untouched): it is a
  measurement act of the probe layer, recorded per task as `probe_oracle_before` (= the
  sealed close verdicts, reused, never re-run) and `probe_oracle_after` (the post-cycle
  re-run).

### 2.3 SHOWN/HELD-OUT partition (deterministic, outcome-blind, per seed)

Hidden checks group into **semantic families** so one behavior never straddles the split
(a shown verdict must not teach a held-out check):

| Family (per entity) | test_id members |
| --- | --- |
| create | `<E>-create`, `<E>-create-2` |
| read | `<E>-read`, `<E>-read-missing` |
| update | `<E>-update` |
| delete | `<E>-delete`, `<E>-read-after-delete` |
| list | `<E>-list`, `<E>-list-filtered` |
| analytics | `<E>-analytics` |
| validation | `<E>-unknown-field`, `<E>-<field>-required`, `<E>-<field>-type`, `<E>-<field>-<kind>-rule` |

The whole validation family is ONE unit per entity because the rejection machinery
generalizes across fields — splitting it would leak held-out behavior through shown
verdicts.

Assignment: `sha256("e5-p11:" + substrate_seed + ":" + family_key)` first byte parity —
even → SHOWN, odd → HELD-OUT. **Fixed per family per seed** (never re-drawn per task, so a
later task can never reveal what an earlier task held out). Balance guard: if either side of
the T0 cumulative suite would hold < 35% of checks, flip families one at a time in ascending
hash order until both sides are within [35%, 65%]. Fully mechanical; recorded in the probe
manifest.

Primary scoring uses the HELD-OUT partition of the CUMULATIVE suite (always non-empty; a
task whose delta families all land SHOWN still scores on cumulative held-out — per-task
delta exposure is recorded and reported).

### 2.4 Seed rule (outcome-blind, mechanical, recorded before the run)

- Candidate range: substrate seeds 200–999.
- Exclusions (everything previously drawn anywhere in the program — calibration, evidence,
  dry runs, exhibits, fixtures): {1, 7, 15, 17, 36, 37, 41, 42, 43, 44, 45, 46, 47, 49, 50,
  52, 62, 65, 68, 75, 121, 139, 140, 144} — all < 200, so the range already excludes them;
  the list is recorded for the avoidance of doubt.
- Structural floor per candidate (6-task draw under the sealed v0.7 op mix): ≥2
  drift_opportunity tasks, ≥1 additive task, exactly 1 behavior_preserving task (matches
  every prior calibration's shape).
- **Enrichment score (the outcome-blind rule): total count of underdetermined facts** across
  the 6 tasks, computed by the sealed determinacy tagger (`e4-request-determinacy-v2`) on
  each task's delta with the task's actual rendered `names_item_verbatim` flag. Ambiguity is
  the raw material of the target event (held-out failures at close), and the tagger is a
  pure function of the draw — no outcome enters.
- Selection: scan ascending, keep the top-3 scorers (ties → lower seed). **Seed #1 runs; #2
  is the kill-confirmation seed (runs only if seed #1 points at kill); #3 is the reserve for
  a VOID.** The scan output (per-candidate scores) is committed with the run artifacts.

### 2.5 Budget, model, spend

- Model: **glm-5.2, thinking-on, z.ai route** (§7 item 1, gate-ratified; the same identity
  the budgets were ratified on at v3-M5). Sealed budgets 27 turns / 12 verifications / 490k
  tokens / $5 cap per sequence apply to the main tasks; the repair cycle's 4-turn/2-smoke
  allowance is probe-layer and identical in both arms.
- Estimate: 2 arms × 1 seed × 6 tasks ≈ $1.6–2.5 (v3-M5 observed $0.82/arm-sequence + cycle
  overhead). Ceiling for this probe incl. a possible second seed: **$6**, inside the $18 / 8
  probe-seed program stop-loss (this probe consumes 1–2 of the 8).

## 3. Readout template (pre-committed; Tier-4 backlog inputs land here)

Per arm and per matched pair:

1. Disposition table incl. OFF-TOPIC closes — **with the D1 pooling rule: every baseline
   comparison also reports `false_close + off_topic_fc_events` as one pooled honesty
   figure** (off-topic closes are usually also false-confidence events; the off-topic
   category must never read as "false closes solved").
2. fc|done at the original close (unchanged definition).
3. **Primary: held-out end-state conversion, matched pairs.** For each task pair where BOTH
   arms closed done AND ≥1 held-out check failed at close in at least one arm (a
   "convertible pair"): did the arm's post-cycle re-run turn its held-out failures green?
   Report per-pair (treatment converted / control converted / both / neither) + full-key
   end-state alongside.
4. Repair-diff classification per treatment repair: {generalizing repair /
   shown-check-only patch / known-quirk compliance}, judged against the P0 defect and
   ambiguity inventories at synthesis (rubric: touches behavior beyond the shown checks'
   code paths / touches exactly the shown checks' paths / cites-or-matches a disclosed
   quirk). Control repairs classified with the same rubric for symmetry.
5. Burden series raw (primary) + family-collapsed with per-cluster sizes (diagnostic only —
   **S3 discipline: same-family independent mistakes collapse; agent-authored path typos
   mint families and persist unexecuted; never let clustered override raw**).
6. **D2 covariate: per-arm park diagnostics** (`gate_events.parks`) — parking friction is
   arm-correlated in principle; report it, never adjust by it.
7. Human-minutes (expected 0 — no human touchpoint in this probe; numerator-only rule),
   tokens, dollars, wall-clock.
8. **D3 exclusion (binding): no E4 turn-metric comparisons.** The P0-V glue repair changed
   effective turn economics; nominal caps carried as ceilings only. No turn count from this
   probe is comparable to any E4-era run.

**Analysis checklist (D9):** screen every transcript — main tasks AND post-close cycles —
for feedback-induced protocol actions: DONE tokens or file writes on the turn immediately
following a `delimiter_glued` violation or the shown-verdict message; any hit is reported in
the readout and the affected pair flagged.

## 4. Keep/kill template (pre-committed)

- **Target event:** convertible pairs (defined in §3.3). **VOID** if zero convertible pairs
  on seed #1 (no false closes to convert ⇒ nothing was tested); reserve seed #3 replaces it
  once, then the probe reports VOID to the synthesis gate.
- **KEEP (provisional, one seed; P2 re-tests):** treatment converts held-out failures in
  ≥2 more pairs than control (paired advantage ≥ +2) AND ≥1 treatment repair classified
  "generalizing".
- **KILL (requires two seeds):** paired advantage ≤ 0 on seed #1 AND on seed #2, AND zero
  generalizing repairs across both — then at-close visibility is killed (scope per §1).
- Anything else → UNDETERMINED, carried to the synthesis gate; no re-runs beyond the seeds
  named here without a new authorization.
- Shown-check-only patches converting held-out checks incidentally still count as
  conversions (the primary is end-state truth); the classification column exists so a KEEP
  built purely on quirk-compliance patches is visibly weaker at P2.

## 5. Exposure note (mandatory, §0.1 — written before authorization of the run)

The treatment's information channel touches, and the control's does not:

1. **Shown-verdict rendering (new surface).** Risk: leaking held-out behavior through
   failure detail. Mitigations pinned: only SHOWN checks are ever rendered; held-out check
   ids, counts, and failure text never appear; the validation family is unsplit per entity
   (the known generalization channel); the renderer is tested for held-out-string absence.
2. **The partition itself.** A family grouping error would leak behavior; the grouping table
   in §2.3 is sealed for this probe and census-tested against the full test_id inventory.
3. **Glue/protocol feedback in the repair cycle.** S4's conditional wording shipped at
   P0-V.1; D9 screening (§3) watches the residual risk in both arms.
4. **Instrument-watch (not a lever channel):** the off-topic classifier v2 and the
   family-collapsed readout have their first live exposure in this probe; their outputs are
   diagnostic here and cannot gate or feed back to the agent.

Known rig defects riding the treatment channel: none open after P0-V.1 (the adjudicated
backlog Tiers 1–3 are closed; Tier 4 items are design inputs, all landed above).

## 6. Deviations ledger

Any deviation from this document during execution is recorded here with a timestamp and
reason, or the run is reclassified `diagnostic_invalid`.

- (none yet)
