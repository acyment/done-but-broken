export type CartItem = {
  name: string;
  price: number;
};

export type Discount = {
  label: string;
};

export function renderCart(items: CartItem[], discounts: Discount[]): string {
  const total = items.reduce((sum, item) => sum + item.price, 0);
  const itemText = items.map((item) => item.name).join(", ");
  const discountText = discounts.map((discount) => discount.label).join(", ");

  return `Items: ${itemText}; Total: ${total}; Discounts: ${discountText}`;
}
