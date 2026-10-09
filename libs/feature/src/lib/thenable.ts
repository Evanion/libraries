/**
 * Reads whether a value is a thenable.
 *
 * A callback that answers a promise-like object gets a rejection handler. A
 * callback that answers a plain value gets none. The predicate reads `then` off
 * an object and not off a function, so a function carrying a `then` member is a
 * plain value here, the way `Promise.resolve` treats it.
 */
export function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}
