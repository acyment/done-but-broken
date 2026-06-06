type ReservationStatusId =
  | "held"
  | "backordered"
  | "confirmed"
  | "canceled"
  | "expired"
  | "shipped"
  | "missing";

type Reservation = {
  reservationId: string;
  sku: string;
  quantity: number;
  requestedAt?: string;
  expiresAt?: string;
  status: ReservationStatusId;
  orderId?: string;
  shipmentId?: string;
  canceledAt?: string;
};

type StockLedger = {
  onHand: number;
  shipped: number;
  returnedSellable: number;
  damagedReturns: number;
};

type InventoryState = {
  processedEventIds?: string[];
  inventory?: Record<string, StockLedger>;
  reservations?: Record<string, Reservation>;
};

export function applyEvent(state: InventoryState = {}, event: any): InventoryState {
  const next = cloneState(state);

  if (!event || typeof event.id !== "string" || event.id.length === 0) {
    return next;
  }

  if ((next.processedEventIds ?? []).includes(event.id)) {
    return next;
  }

  next.processedEventIds = [...(next.processedEventIds ?? []), event.id];

  if (event.type === "stock_received") {
    const stock = stockFor(next, event.sku);

    stock.onHand += event.quantity ?? 0;
    allocateBackorders(next, event.sku, event.receivedAt);
  } else if (event.type === "reservation_requested") {
    requestReservation(next, event);
  } else if (event.type === "order_confirmed") {
    confirmReservation(next, event);
  } else if (event.type === "reservation_cancelled") {
    cancelReservation(next, event);
  } else if (event.type === "order_shipped") {
    shipReservation(next, event);
  } else if (event.type === "item_returned") {
    recordReturn(next, event);
  }

  return next;
}

export function canReserve(
  state: InventoryState = {},
  sku: string,
  quantity: number,
  now: string
): boolean {
  return getAvailability(state, sku, now).sellable >= quantity;
}

export function getAvailability(state: InventoryState = {}, sku: string, now: string) {
  const stock = state.inventory?.[sku] ?? emptyStock();
  let held = 0;
  let committed = 0;
  let backordered = 0;

  for (const reservation of Object.values(state.reservations ?? {})) {
    if (reservation.sku !== sku) {
      continue;
    }

    const status = effectiveReservationStatus(reservation, now);

    if (status === "held") {
      held += reservation.quantity;
    } else if (status === "confirmed") {
      committed += reservation.quantity;
    } else if (status === "backordered") {
      backordered += reservation.quantity;
    }
  }

  return {
    sku,
    onHand: stock.onHand,
    held,
    committed,
    shipped: stock.shipped,
    backordered,
    sellable: Math.max(0, stock.onHand - held - committed),
    returnedSellable: stock.returnedSellable,
    damagedReturns: stock.damagedReturns
  };
}

export function getReservationStatus(
  state: InventoryState = {},
  reservationId: string,
  now: string
) {
  const reservation = state.reservations?.[reservationId];

  if (!reservation) {
    return {
      reservationId,
      status: "missing"
    };
  }

  return {
    reservationId: reservation.reservationId,
    sku: reservation.sku,
    quantity: reservation.quantity,
    status: effectiveReservationStatus(reservation, now),
    expiresAt: reservation.expiresAt,
    orderId: reservation.orderId,
    shipmentId: reservation.shipmentId,
    canceledAt: reservation.canceledAt
  };
}

function requestReservation(state: InventoryState, event: any) {
  if (!event.reservationId || !event.sku || typeof event.quantity !== "number") {
    return;
  }

  const status = canReserve(state, event.sku, event.quantity, event.requestedAt) ? "held" : "backordered";

  state.reservations = {
    ...(state.reservations ?? {}),
    [event.reservationId]: {
      reservationId: event.reservationId,
      sku: event.sku,
      quantity: event.quantity,
      requestedAt: event.requestedAt,
      expiresAt: event.expiresAt,
      status
    }
  };
}

function confirmReservation(state: InventoryState, event: any) {
  const reservation = state.reservations?.[event.reservationId];

  if (!reservation || effectiveReservationStatus(reservation, event.confirmedAt) !== "held") {
    if (reservation && effectiveReservationStatus(reservation, event.confirmedAt) === "expired") {
      reservation.status = "expired";
    }
    return;
  }

  reservation.status = "confirmed";
  reservation.orderId = event.orderId;
}

function cancelReservation(state: InventoryState, event: any) {
  const reservation = state.reservations?.[event.reservationId];

  if (!reservation || reservation.status === "shipped") {
    return;
  }

  if (["held", "confirmed", "backordered"].includes(effectiveReservationStatus(reservation, event.canceledAt))) {
    reservation.status = "canceled";
    reservation.canceledAt = event.canceledAt;
  }
}

function shipReservation(state: InventoryState, event: any) {
  const reservation = state.reservations?.[event.reservationId];

  if (!reservation || effectiveReservationStatus(reservation, event.shippedAt) !== "confirmed") {
    return;
  }

  const stock = stockFor(state, reservation.sku);

  reservation.status = "shipped";
  reservation.shipmentId = event.shipmentId;
  stock.onHand = Math.max(0, stock.onHand - reservation.quantity);
  stock.shipped += reservation.quantity;
}

function recordReturn(state: InventoryState, event: any) {
  const reservation = state.reservations?.[event.reservationId];

  if (!reservation || reservation.status !== "shipped") {
    return;
  }

  const stock = stockFor(state, event.sku ?? reservation.sku);
  const quantity = event.quantity ?? 0;

  if (event.disposition === "sellable") {
    stock.onHand += quantity;
    stock.returnedSellable += quantity;
  } else {
    stock.damagedReturns += quantity;
  }
}

function allocateBackorders(state: InventoryState, sku: string, now: string) {
  const reservations = Object.values(state.reservations ?? {})
    .filter((reservation) => reservation.sku === sku && reservation.status === "backordered")
    .toSorted((left, right) => (left.requestedAt ?? "").localeCompare(right.requestedAt ?? ""));

  for (const reservation of reservations) {
    if (canReserve(state, sku, reservation.quantity, now)) {
      reservation.status = "held";
    }
  }
}

function effectiveReservationStatus(reservation: Reservation, now: string): ReservationStatusId {
  if (reservation.status !== "held") {
    return reservation.status;
  }

  return isBefore(now, reservation.expiresAt) ? "held" : "expired";
}

function stockFor(state: InventoryState, sku: string): StockLedger {
  state.inventory = { ...(state.inventory ?? {}) };
  state.inventory[sku] = state.inventory[sku] ?? emptyStock();

  return state.inventory[sku];
}

function emptyStock(): StockLedger {
  return {
    onHand: 0,
    shipped: 0,
    returnedSellable: 0,
    damagedReturns: 0
  };
}

function cloneState(state: InventoryState): InventoryState {
  return {
    ...state,
    processedEventIds: [...(state.processedEventIds ?? [])],
    inventory: Object.fromEntries(
      Object.entries(state.inventory ?? {}).map(([sku, stock]) => [sku, { ...stock }])
    ),
    reservations: Object.fromEntries(
      Object.entries(state.reservations ?? {}).map(([reservationId, reservation]) => [
        reservationId,
        { ...reservation }
      ])
    )
  };
}

function isBefore(left?: string, right?: string): boolean {
  if (!left || !right) {
    return false;
  }

  return left < right;
}
