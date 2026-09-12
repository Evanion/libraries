/**
 * Path prefix every route is mounted under.
 *
 * Read by both `main.ts`, which sets it, and `InventoryClient`, which builds a
 * URL back into this same process with it. One constant, because the outbound
 * URL has to match the mounted path for the orders -> inventory hop to resolve.
 */
export const GLOBAL_PREFIX = 'api';

/**
 * Port the server listens on, and the port `InventoryClient` dials on
 * localhost.
 *
 * Read at import time, so a test that sets `process.env.PORT` has to do it
 * before the first import of this module -- `orders.e2e.spec.ts` imports
 * dynamically for exactly that reason.
 */
export const PORT = Number(process.env.PORT) || 3000;
