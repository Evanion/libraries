export interface CartItem {
  urn: string;
  quantity: number;
}

export interface CreateOrderRequest {
  items: CartItem[];
}

export interface OrderResult {
  urn: string;
  items: CartItem[];
  correlationId: string | undefined;
  /** The correlation id the inventory hop reported back, one per cart item. */
  inventoryCorrelationIds: (string | undefined)[];
}
