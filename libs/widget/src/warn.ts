/**
 * Dev-only console warning, emitted once per distinct message.
 *
 * The renderer warns from render, so a single stale `type` in a CMS payload
 * logs again on every re-render, and twice over for a page that renders on the
 * server and then hydrates. Every message carries the offending item's `type`
 * and `id`, so keying on the message text reports each bad item exactly once
 * per process while still reporting a second bad item separately.
 *
 * Nothing is logged when `NODE_ENV` is `production`: bundlers fold that check
 * to `false` and drop the call, so a stale item never reaches an end user's
 * console.
 *
 * Internal: not re-exported from the package entry point.
 */
const seen = new Set<string>();

export function warnOnce(message: string): void {
  if (process.env.NODE_ENV === 'production') return;
  if (seen.has(message)) return;
  seen.add(message);
  console.warn(message);
}

/**
 * Clears the set of already-reported messages.
 *
 * The set lives as long as the process, which is what a dev server wants and
 * what a test file does not: one case's warning would silence the next case
 * that produces the same message. `test-setup.ts` calls this before each test.
 */
export function resetWarnings(): void {
  seen.clear();
}
