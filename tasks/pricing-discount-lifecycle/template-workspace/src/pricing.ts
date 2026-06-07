// Storefront pricing engine.
//
// Implemented so far: I01 base subtotal and I02 per-line sale discounts.
// Later checkpoints (order coupons, bulk tiers, discount caps, tax, and final
// rounding) still need to be implemented in getQuote so they compose with the
// rules already here without changing earlier totals.

type Line = {
  sku: string;
  unitPrice: number;
  quantity: number;
};

type PricingState = {
  processedEventIds?: string[];
  currency?: string;
  lines?: Record<string, Line>;
  lineSale?: Record<string, number>;
};

export function applyEvent(state: PricingState = {}, event: any): PricingState {
  const next: PricingState = {
    ...state,
    processedEventIds: [...(state.processedEventIds ?? [])],
    lines: { ...(state.lines ?? {}) },
    lineSale: { ...(state.lineSale ?? {}) }
  };

  if (!event || typeof event.id !== "string" || event.id.length === 0) {
    return next;
  }

  if ((next.processedEventIds ?? []).includes(event.id)) {
    return next;
  }

  next.processedEventIds = [...(next.processedEventIds ?? []), event.id];

  if (event.type === "item_added") {
    if (typeof event.sku === "string" && typeof event.unitPrice === "number" && typeof event.quantity === "number") {
      next.lines![event.sku] = { sku: event.sku, unitPrice: event.unitPrice, quantity: event.quantity };
    }
  } else if (event.type === "line_sale_set") {
    if (typeof event.sku === "string" && typeof event.percentOff === "number") {
      next.lineSale![event.sku] = event.percentOff;
    }
  }

  // TODO (I03+): record and apply order coupons, bulk tiers, caps, tax, and rounding.

  return next;
}

export function getQuote(state: PricingState = {}) {
  const currency = state.currency ?? "USD";
  const lines = Object.values(state.lines ?? {});

  const perLine = lines.map((line) => {
    const salePercent = state.lineSale?.[line.sku] ?? 0;
    const listLine = line.unitPrice * line.quantity;
    const lineTotal = line.unitPrice * (1 - salePercent / 100) * line.quantity;

    return {
      sku: line.sku,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineDiscount: listLine - lineTotal,
      lineTotal,
      listLine
    };
  });

  const subtotal = perLine.reduce((sum, line) => sum + line.listLine, 0);
  const postLineSubtotal = perLine.reduce((sum, line) => sum + line.lineTotal, 0);

  return {
    currency,
    lines: perLine.map((line) => ({
      sku: line.sku,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineDiscount: line.lineDiscount,
      lineTotal: line.lineTotal
    })),
    subtotal,
    discountTotal: subtotal - postLineSubtotal,
    taxTotal: 0,
    total: postLineSubtotal
  };
}

export function getLineTotal(state: PricingState = {}, sku: string): number {
  const line = getQuote(state).lines.find((candidate) => candidate.sku === sku);

  return line ? line.lineTotal : 0;
}

export function canApplyCoupon(_state: PricingState = {}, _code: string): boolean {
  // TODO (I05): return false once a coupon with this code has already been applied.
  return true;
}
