import * as React from 'react';

/**
 * React's per-request dispatcher, at the three members the server tests'
 * rendering reaches. `cache` reads `getCacheForType`, and the development JSX runtime
 * asks the same object for the element owner on every `jsx()` call.
 */
interface CacheDispatcher {
  getCacheForType: <T>(create: () => T) => T;
  cacheSignal: () => null;
  getOwner: () => null;
}

interface ServerInternals {
  A: CacheDispatcher | null;
}

/** Where `cache` looks for the dispatcher, under React's own spelling. */
interface ReactServerBuild {
  __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ServerInternals;
}

/**
 * Runs `render` inside one request's cache scope.
 *
 * `cache(fn)` reads the cache dispatcher off React's server internals and calls
 * `fn` straight through when there is none, so outside a scope like this one it
 * memoises nothing and an assertion about fetching once would hold whatever the
 * app did. Next installs a dispatcher per request; this installs one of the same
 * shape, and restoring the previous value afterwards is what makes two calls to
 * this helper two separate page views.
 */
export async function inOneRequest<T>(render: () => Promise<T>): Promise<T> {
  const internals = (React as unknown as ReactServerBuild)
    .__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const store = new Map<unknown, unknown>();
  const previous = internals.A;
  internals.A = {
    getCacheForType: <T2>(create: () => T2): T2 => {
      if (!store.has(create)) store.set(create, create());
      return store.get(create) as T2;
    },
    cacheSignal: () => null,
    getOwner: () => null,
  };
  try {
    return await render();
  } finally {
    internals.A = previous;
  }
}
