# Hidden Oracle Notes

`oracle-cases.json` holds the executable private case data (events, expected values,
per-assertion tolerances, and the cumulative commitment-by-checkpoint map) that defines
pass/fail; the `*-private.txt` files describe those variants in prose; and
`reference/pricing.ts` holds the complete correct reference implementation. All of these
are hashed into the task seal via `hidden_oracle_hash`, so changing any expected value or
case changes the seal. The oracle adapter in `src/pricing-discount-oracle.ts` loads
`oracle-cases.json` from this directory and only contains generic assertion-evaluation
logic. None of these files may be rendered into participant prompts. The candidate's
`template-workspace` deliberately implements only the first two checkpoints; the reference
here implements all nine and is used only to prove the oracle is satisfiable.
