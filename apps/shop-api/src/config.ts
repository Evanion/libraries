/** Shared between main.ts (what the server listens on) and InventoryClient
 * (what it calls back into, on localhost, for the orders -> inventory hop). */
export const GLOBAL_PREFIX = 'api';
export const PORT = Number(process.env.PORT) || 3000;
