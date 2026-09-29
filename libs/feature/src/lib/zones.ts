/**
 * The zone harness the suite reads a value under.
 *
 * It lives outside `zones.spec.ts` because Vitest registers a `describe`
 * against whichever file is collecting, so a suite exported alongside a helper
 * is collected again inside every file that imports the helper. Five files
 * import this one, and `apps/docs/tools/test-statistics.mjs` publishes
 * `report.json`'s `numTotalTests` as the package's case count, so each
 * re-registration is a case on the `/testing` page that nobody wrote.
 *
 * `tsconfig.lib.json` excludes it from the build and `package.json` excludes it
 * from the published files, because it belongs to the suite and not to the API.
 * `zones.spec.ts` holds its cases.
 */

/**
 * Runs `read` with the process reporting `zone` as its timezone.
 *
 * Node reads `process.env.TZ` on every `Date` construction, so a case can ask
 * what a host in Los Angeles would answer without running a second process.
 *
 * That holds while the suite runs in a child process, which is Vitest's `forks`
 * pool. A worker thread gets its own copy of the environment and V8 keeps the
 * zone the thread started in, so under `pool: 'threads'` the assignment is a
 * no-op: every three-zone case across the package reads one zone three times
 * and passes, and the determinism the cases are about goes untested. So the
 * host is asked which zone it now reports and a reading other than `zone`
 * throws, which is also what a zone name the host does not know gets.
 */
export function inZone<T>(zone: string, read: () => T): T {
  const original = process.env.TZ;
  process.env.TZ = zone;
  try {
    const reported = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (reported !== zone) {
      throw new Error(
        `the host reports ${String(reported)} after being asked for ${zone}, so nothing read under it reads the zone it names`,
      );
    }
    return read();
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
}

/** The answer in three zones spread far enough apart to cross a day boundary. */
export const everywhere = <T>(read: () => T): T[] =>
  ['UTC', 'Asia/Tokyo', 'America/Los_Angeles'].map((zone) =>
    inZone(zone, read),
  );
