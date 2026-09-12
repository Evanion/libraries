import { createContext } from 'react-router';
import type { ShelfRow } from './shelf.js';

/**
 * The correlation id of the page view in flight.
 *
 * A router context and not a module variable, because one process serves every
 * request concurrently. It is set once by the shell's middleware and read by
 * every loader beneath it, which is the only way several loaders can share one
 * id: nested loaders run in parallel, so a loader that minted its own would put
 * a different id on each of the calls making up one page view, and shop-api's
 * trail would have no key to group them under.
 *
 * Middleware is the v8 mechanism for this. v7 had no route-module hook that ran
 * before the loaders with somewhere to put a value.
 */
export const correlationContext = createContext<string>('');

/** The catalogue joined to stock, or the reason it could not be read. */
export interface ShelfSnapshot {
  rows: ShelfRow[];
  /** Set when shop-api could not be reached; `rows` is then empty. */
  unavailable?: string;
}

/**
 * Reads the shelf once per request, however many loaders ask for it.
 *
 * A function and not the data, and this is the part that is easy to get wrong.
 * The shelf is what a `POST` to a title page mutates, and React Router's order
 * within one request is middleware, then the action, then the revalidating
 * loaders. Middleware that fetched the shelf itself would therefore hand every
 * revalidated loader the state from *before* the action, and the page would
 * render the change only on the next navigation -- which is exactly what
 * happened before this was a function.
 *
 * So the middleware installs an empty memo cell and the first loader to need the
 * shelf fills it. Sibling loaders await the same promise, so a page view still
 * makes one catalogue read, and that read now happens after any action has run.
 *
 * The rule this encodes: middleware is for per-request facts that cannot change
 * within the request, like a correlation id. Anything a mutation invalidates has
 * to be fetched during the loader phase, because loaders are what React Router
 * re-runs.
 */
export type ReadShelf = () => Promise<ShelfSnapshot>;

export const shelfContext = createContext<ReadShelf>(async () => ({
  rows: [],
}));
