// Mid-period upgrade proration lines (I-TOTALS, I-ALLOC neighborhood).
// The upgrade event carries remaining_days and period_days explicitly; no calendar math.

import { mulDivHalfEven } from "./money";
import type { InvoiceLine } from "./invoice";

export type UpgradeProrationInput = {
  event_id: string;
  old_plan_id: string;
  old_plan_price_cents: number;
  new_plan_id: string;
  new_plan_price_cents: number;
  remaining_days: number;
  period_days: number;
};

// Returns [credit for unused time on the old plan, charge for remaining time on the new plan].
// Each amount is rounded half-even at line level: round_half_even(price * remaining / period).
export function prorationLinesForUpgrade(input: UpgradeProrationInput): InvoiceLine[] {
  if (!Number.isSafeInteger(input.remaining_days) || !Number.isSafeInteger(input.period_days)) {
    throw new Error("remaining_days and period_days must be integers");
  }

  if (input.period_days <= 0 || input.remaining_days <= 0 || input.remaining_days > input.period_days) {
    throw new Error("proration requires 0 < remaining_days <= period_days");
  }

  const credit = mulDivHalfEven(input.old_plan_price_cents, input.remaining_days, input.period_days);
  const charge = mulDivHalfEven(input.new_plan_price_cents, input.remaining_days, input.period_days);

  return [
    {
      line_id: `${input.event_id}-credit`,
      kind: "proration_credit",
      description: `Unused time on plan ${input.old_plan_id} (${input.remaining_days} of ${input.period_days} days)`,
      amount_cents: -credit,
      discount_cents: 0,
      refunded_cents: 0
    },
    {
      line_id: `${input.event_id}-charge`,
      kind: "proration_charge",
      description: `Remaining time on plan ${input.new_plan_id} (${input.remaining_days} of ${input.period_days} days)`,
      amount_cents: charge,
      discount_cents: 0,
      refunded_cents: 0
    }
  ];
}
