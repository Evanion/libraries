/** How many visitors every demo decides for. */
export const CROWD_SIZE = 48;

/** The demo visitors' ids, `cust-0001` upward. */
export const crowdIds: readonly string[] = Array.from(
  { length: CROWD_SIZE },
  (_, index) => `cust-${String(index + 1).padStart(4, '0')}`,
);
