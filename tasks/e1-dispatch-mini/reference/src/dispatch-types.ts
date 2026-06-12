export type Line = {
  line_id: string;
  amount_cents: number;
  shipped: boolean;
  returned: boolean;
};

export type Order = {
  order_id: string;
  paid: boolean;
  cancelled: boolean;
  lines: Line[];
  notes: string[];
};

export type DispatchState = {
  orders: Record<string, Order>;
};

export type Ev = Record<string, unknown> & { type: string };
export type Query = Record<string, unknown> & { kind: string };

export function emptyState(): DispatchState {
  return { orders: {} };
}
