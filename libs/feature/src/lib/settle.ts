import { contextEpoch } from './instant.js';
import type { EvaluationContext, Instant } from './types.js';

/**
 * The instant a context carries, or `undefined` when it carries none or cannot
 * be read. The read follows the prototype chain, and a getter, a trapping proxy
 * or a value `contextEpoch` cannot read makes the instant absent.
 */
function readNow(context: unknown): Instant | undefined {
  try {
    const value = (context as { now?: Instant } | undefined)?.now;
    if (value !== undefined) contextEpoch(value);
    return value;
  } catch {
    return undefined;
  }
}

/**
 * Copies the own enumerable properties of a context, one read at a time. A
 * property whose getter throws is left out as absent, and a context that cannot
 * be enumerated (a revoked proxy) copies as an empty one. `now` is read apart
 * from the rest, so an unreadable one is absent from the copy.
 */
export function copyContext(context: unknown): Record<string, unknown> {
  const copy: Record<string, unknown> = {};
  let names: string[] = [];
  try {
    names = Object.keys(context as object);
  } catch {
    // Nothing to enumerate: the context copies as empty.
  }
  for (const name of names) {
    if (name === 'now') continue;
    try {
      Object.defineProperty(copy, name, {
        value: (context as Record<string, unknown>)[name],
        enumerable: true,
        writable: true,
        configurable: true,
      });
    } catch {
      // The getter threw: the property reads as absent.
    }
  }
  const now = readNow(context);
  if (now !== undefined) copy['now'] = now;
  return copy;
}

/** A copy of the context carrying `now`, from the context or else `fallback`. */
export function settleContext(
  context: EvaluationContext | undefined,
  fallback: () => Instant,
): EvaluationContext & { now: Instant } {
  const copy = copyContext(context);
  return { ...copy, now: (copy['now'] as Instant | undefined) ?? fallback() };
}
