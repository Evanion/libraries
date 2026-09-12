/** One line item in a cart: a game urn and how many copies. */
export interface CartItem {
  urn: string;
  quantity: number;
}

/** Body of `POST /orders`. */
export interface CreateOrderRequest {
  items: CartItem[];
}

/**
 * Response from a successful checkout.
 *
 * `correlationId` is this request's own id; `inventoryCorrelationIds` are
 * what the /inventory endpoint reported back for each cart item, over the
 * real HTTP hop InventoryClient makes. Comparing the two is how the demo
 * makes correlation-id propagation observable end to end.
 */
export interface OrderResult {
  urn: string;
  items: CartItem[];
  correlationId: string | undefined;
  /** The correlation id the inventory hop reported back, one per cart item. */
  inventoryCorrelationIds: (string | undefined)[];
}
