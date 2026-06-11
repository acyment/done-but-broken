// Percent-duration and fixed coupons with stacking order (I-STACK): all percent coupons
// apply to the discountable base first, then fixed coupons, and the combined discount is
// capped at the discountable base. Discount math is half-even (I-ROUND).

import { mulDivHalfEven } from "./money";

export type CouponKind = "percent" | "fixed";

export type CouponGrant = {
  coupon_id: string;
  kind: CouponKind;
  percent_bp: number | null;
  amount_cents: number | null;
  remaining_invoices: number;
};

export function createCouponGrant(input: {
  coupon_id: string;
  kind: CouponKind;
  percent_bp?: number;
  amount_cents?: number;
  duration_invoices: number;
}): CouponGrant {
  if (!Number.isSafeInteger(input.duration_invoices) || input.duration_invoices < 1) {
    throw new Error("coupon duration_invoices must be a positive integer");
  }

  if (input.kind === "percent") {
    if (!Number.isSafeInteger(input.percent_bp) || input.percent_bp! < 1 || input.percent_bp! > 10000) {
      throw new Error("percent coupon requires percent_bp in 1..10000");
    }

    return {
      coupon_id: input.coupon_id,
      kind: "percent",
      percent_bp: input.percent_bp!,
      amount_cents: null,
      remaining_invoices: input.duration_invoices
    };
  }

  if (!Number.isSafeInteger(input.amount_cents) || input.amount_cents! < 1) {
    throw new Error("fixed coupon requires positive integer amount_cents");
  }

  return {
    coupon_id: input.coupon_id,
    kind: "fixed",
    percent_bp: null,
    amount_cents: input.amount_cents!,
    remaining_invoices: input.duration_invoices
  };
}

// The discountable base is the invoice subtotal floored at zero. Each percent coupon
// contributes round_half_even(base * percent_bp / 10000) independently; fixed coupons
// then add their face value. The total discount never exceeds the base.
export function computeDiscountTotal(subtotal_cents: number, grants: CouponGrant[]): number {
  const base = Math.max(0, subtotal_cents);
  let discount = 0;

  for (const grant of grants) {
    if (grant.kind === "percent") {
      discount += mulDivHalfEven(base, grant.percent_bp!, 10000);
    }
  }

  discount = Math.min(discount, base);

  for (const grant of grants) {
    if (grant.kind === "fixed") {
      discount = Math.min(discount + grant.amount_cents!, base);
    }
  }

  return discount;
}

// Every active grant is consumed by one generated invoice; grants expire at zero uses.
export function consumeCouponUse(grants: CouponGrant[]): CouponGrant[] {
  return grants
    .map((grant) => ({ ...grant, remaining_invoices: grant.remaining_invoices - 1 }))
    .filter((grant) => grant.remaining_invoices > 0);
}
