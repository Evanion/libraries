/** Messages already reported, for the lifetime of the process. */
const seen = new Set<string>();

/**
 * Dev-only console warning, emitted once per distinct message.
 *
 * The renderer warns from render, so one stale `type` in a CMS payload logs
 * again on every re-render, and twice over for a page that renders on the
 * server and then hydrates. Every message in `ERROR_MESSAGES` carries the
 * offending item's `type` and `id`, which is what makes the message text a
 * usable key: each bad item is reported once per process, and a second bad
 * item is still reported separately.
 *
 * Nothing is logged when `NODE_ENV` is `production`. A bundler folds that
 * comparison to `false` and drops the call, so a stale item never reaches an
 * end user's console.
 *
 * Internal: not re-exported from the package entry point.
 */
export function warnOnce(message: string): void {
  if (process.env.NODE_ENV === 'production') return;
  if (seen.has(message)) return;
  seen.add(message);
  console.warn(message);
}

/**
 * Clears the set of already-reported messages.
 *
 * A set that lives as long as the process is what a dev server wants and what a
 * test file cannot have: one case's warning would silence the next case that
 * produces the same message. `test-setup.ts` calls this before each test.
 *
 * Internal: not re-exported from the package entry point.
 */
export function resetWarnings(): void {
  seen.clear();
}
