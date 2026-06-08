// Reference (correct) implementation of pricing-discount-lifecycle-v0.
//
// This file lives under hidden-oracle/ so it is sealed into the task hash and is
// never rendered into agent prompt packets. It is used only by tests to prove the
// hidden oracle is satisfiable (passes every checkpoint) and to provide a careful
// "reference agent" path. The candidate template-workspace deliberately implements
// only the first two checkpoints; this file implements all nine.

type CouponKind = "percent" | "fixed";

type Line = {
  sku: string;
  unitPrice: number;
  quantity: number;
};

type Coupon = {
  code: string;
  couponKind: CouponKind;
  value: number;
};

type PricingState = {
  processedEventIds?: string[];
  currency?: string;
  lines?: Record<string, Line>;
  lineSale?: Record<string, number>;
  bulkRules?: Record<string, { minQuantity: number; percentOff: number }>;
  coupons?: Coupon[];
  cap?: { maxDiscountPercent: number };
  taxRatePercent?: number;
  taxExempt?: Record<string, boolean>;
};

export function applyEvent(state: PricingState = {}, event: any): PricingState {
  const next = cloneState(state);

  if (!event || typeof event.id !== "string" || event.id.length === 0) {
    return next;
  }

  if ((next.processedEventIds ?? []).includes(event.id)) {
    return next;
  }

  next.processedEventIds = [...(next.processedEventIds ?? []), event.id];

  if (event.type === "item_added") {
    if (typeof event.sku === "string" && typeof event.unitPrice === "number" && typeof event.quantity === "number") {
      next.lines = { ...(next.lines ?? {}) };
      next.lines[event.sku] = { sku: event.sku, unitPrice: event.unitPrice, quantity: event.quantity };
    }
  } else if (event.type === "line_sale_set") {
    if (typeof event.sku === "string" && typeof event.percentOff === "number") {
      next.lineSale = { ...(next.lineSale ?? {}), [event.sku]: event.percentOff };
    }
  } else if (event.type === "bulk_rule_set") {
    if (typeof event.sku === "string" && typeof event.minQuantity === "number" && typeof event.percentOff === "number") {
      next.bulkRules = {
        ...(next.bulkRules ?? {}),
        [event.sku]: { minQuantity: event.minQuantity, percentOff: event.percentOff }
      };
    }
  } else if (event.type === "coupon_applied") {
    if (
      typeof event.code === "string" &&
      (event.couponKind === "percent" || event.couponKind === "fixed") &&
      typeof event.value === "number"
    ) {
      const coupons = [...(next.coupons ?? [])];

      if (!coupons.some((coupon) => coupon.code === event.code)) {
        coupons.push({ code: event.code, couponKind: event.couponKind, value: event.value });
      }

      next.coupons = coupons;
    }
  } else if (event.type === "cap_set") {
    if (typeof event.maxDiscountPercent === "number") {
      next.cap = { maxDiscountPercent: event.maxDiscountPercent };
    }
  } else if (event.type === "tax_rate_set") {
    if (typeof event.percent === "number") {
      next.taxRatePercent = event.percent;
    }
  } else if (event.type === "tax_exempt_set") {
    if (typeof event.sku === "string") {
      next.taxExempt = { ...(next.taxExempt ?? {}), [event.sku]: true };
    }
  }

  return next;
}

export function getQuote(state: PricingState = {}) {
  const currency = state.currency ?? "USD";
  const lines = Object.values(state.lines ?? {});

  const perLine = lines.map((line) => {
    const salePercent = state.lineSale?.[line.sku] ?? 0;
    const bulkRule = state.bulkRules?.[line.sku];
    const bulkPercent = bulkRule && line.quantity >= bulkRule.minQuantity ? bulkRule.percentOff : 0;
    const listLine = line.unitPrice * line.quantity;
    // Line-level discounts stack multiplicatively: sale first, then bulk.
    const netUnit = line.unitPrice * (1 - salePercent / 100) * (1 - bulkPercent / 100);
    const lineTotal = netUnit * line.quantity;

    return {
      sku: line.sku,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineDiscount: listLine - lineTotal,
      lineTotal,
      listLine
    };
  });

  const preDiscountSubtotal = perLine.reduce((sum, line) => sum + line.listLine, 0);
  const postLineSubtotal = perLine.reduce((sum, line) => sum + line.lineTotal, 0);

  let running = postLineSubtotal;

  // Percentage coupons (I03) apply to the running post-line-discount subtotal, in order.
  for (const coupon of state.coupons ?? []) {
    if (coupon.couponKind === "percent") {
      running -= running * (coupon.value / 100);
    }
  }

  // Fixed-amount coupons (I06) apply only after all percentage coupons.
  for (const coupon of state.coupons ?? []) {
    if (coupon.couponKind === "fixed") {
      running -= Math.min(coupon.value, running);
    }
  }

  // Discount cap (I07): total discount may not exceed cap% of the pre-discount subtotal.
  // When the cap is not binding it must be an exact no-op.
  const totalDiscountBeforeCap = preDiscountSubtotal - running;
  const maxDiscount =
    state.cap !== undefined ? preDiscountSubtotal * (state.cap.maxDiscountPercent / 100) : Number.POSITIVE_INFINITY;

  if (totalDiscountBeforeCap > maxDiscount) {
    running = preDiscountSubtotal - maxDiscount;
  }

  // Non-negative floor.
  running = Math.max(0, running);

  const postDiscountTotal = running;
  const discountTotal = preDiscountSubtotal - postDiscountTotal;

  // Tax (I08): pro-rata allocate the post-discount total to lines by post-line-discount
  // line total, then tax only the non-exempt portion.
  let taxableBase = 0;

  if (postLineSubtotal > 0) {
    for (const line of perLine) {
      const allocated = postDiscountTotal * (line.lineTotal / postLineSubtotal);

      if (!state.taxExempt?.[line.sku]) {
        taxableBase += allocated;
      }
    }
  }

  const taxTotal = taxableBase * ((state.taxRatePercent ?? 0) / 100);

  // Single final currency rounding (I09): round the final total once, half-up to 2 decimals.
  const total = roundHalfUp(postDiscountTotal + taxTotal);

  return {
    currency,
    lines: perLine.map((line) => ({
      sku: line.sku,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineDiscount: line.lineDiscount,
      lineTotal: line.lineTotal
    })),
    subtotal: preDiscountSubtotal,
    discountTotal,
    taxTotal,
    total
  };
}

export function getLineTotal(state: PricingState = {}, sku: string): number {
  const line = getQuote(state).lines.find((candidate) => candidate.sku === sku);

  return line ? line.lineTotal : 0;
}

export function canApplyCoupon(state: PricingState = {}, code: string): boolean {
  return !(state.coupons ?? []).some((coupon) => coupon.code === code);
}

function roundHalfUp(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function cloneState(state: PricingState): PricingState {
  return {
    ...state,
    processedEventIds: [...(state.processedEventIds ?? [])],
    lines: { ...(state.lines ?? {}) },
    lineSale: { ...(state.lineSale ?? {}) },
    bulkRules: { ...(state.bulkRules ?? {}) },
    coupons: [...(state.coupons ?? [])],
    taxExempt: { ...(state.taxExempt ?? {}) }
  };
}
