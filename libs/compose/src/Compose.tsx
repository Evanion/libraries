import * as React from 'react';
import type { ProviderArray, ValidatedProviders } from './Compose.types.js';

/**
 * `process` does not exist in a browser unless a bundler injects it, and this
 * package ships an ESM build that can be loaded without one. Reading
 * `process.env.NODE_ENV` unguarded throws `ReferenceError: process is not
 * defined` on first render in that case.
 *
 * Computed once at module scope so bundlers that substitute
 * `process.env.NODE_ENV` can still fold this to `false` and drop the warnings.
 */
const isDevelopment =
  typeof process !== 'undefined' &&
  process.env != null &&
  process.env.NODE_ENV !== 'production';

/**
 * Messages already emitted, so a warning fires once rather than on every render.
 *
 * This is deliberately a module-level set rather than a hook: a `useEffect`
 * would require the component to use hooks, and React's `react-server`
 * condition leaves `useEffect` `undefined`, so `ComposeProvider` would throw on
 * first render in any React Server Component -- a Next.js root
 * `app/layout.tsx` included. Keeping the component hook-free is what lets it
 * be imported from the server graph without a `'use client'` boundary.
 *
 * A `useEffect`-based version also would not do what it looks like it does:
 * its dependency would be the caller's array, and a JSX literal is a fresh
 * identity every render, so the warning would re-fire on every render for the
 * most common call style.
 */
const warnedMessages = new Set<string>();

function warnOnce(message: string): void {
  if (!isDevelopment || warnedMessages.has(message)) return;
  warnedMessages.add(message);
  console.warn(message);
}

/**
 * Clears the warn-once cache.
 *
 * Not re-exported from `index.ts`, so it is not public API. It exists because a
 * module-level cache otherwise lets only the first test in a file observe a
 * warning.
 *
 * @internal
 */
export function __resetWarningsForTests(): void {
  warnedMessages.clear();
}

/** Props for `ComposeProvider`. */
export interface ComposeProviderProps<T extends ProviderArray = ProviderArray> {
  /**
   * Providers to compose. The first entry ends up outermost.
   *
   * See {@link ValidatedProviders} for why the checking is gated on whether
   * `T` is a literal tuple.
   */
  providers: ValidatedProviders<T>;
  children: React.ReactNode;
}

/**
 * Nests `providers` around `children`, first entry outermost, so the rendered
 * tree reads in the order the array is written.
 *
 * A generic function rather than a `React.FC`: the `const T` parameter infers
 * the array as a literal tuple, which is what lets each entry be checked
 * against its own component. A `React.FC` annotation would widen it and the
 * per-entry checking would be gone.
 *
 * Hook-free, so it can be imported from a React Server Component graph without
 * a `'use client'` boundary. React's `react-server` export condition leaves
 * every stateful hook, `createContext` and `useContext` `undefined`.
 *
 * Changing the length or order of the array remounts everything below it: React
 * reconciles by position, so `[...(isAuthed ? [AuthProvider] : []), Theme]`
 * unmounts and remounts the whole subtree on login. Keep the array a fixed
 * length and let the providers handle the conditional case themselves.
 *
 * @throws {TypeError} when `providers` is not an array, which only a caller
 * outside TypeScript can reach.
 *
 * @example
 * ```tsx
 * const providers = [
 *   ThemeProvider,
 *   provider(AuthProvider, { user, token })
 * ];
 *
 * <ComposeProvider providers={providers}>
 *   <App />
 * </ComposeProvider>
 * ```
 */
export function ComposeProvider<const T extends ProviderArray>(
  props: ComposeProviderProps<T>,
): React.ReactElement {
  // `components` is not in `ComposeProviderProps`, so only a caller outside
  // TypeScript reaches here. Naming the prop is what turns an empty render
  // into a message the caller can act on.
  if (!('providers' in props) && 'components' in props) {
    throw new TypeError(
      'ComposeProvider: `components` was removed in v2.0 \u2014 rename it to `providers`.',
    );
  }

  const providerList = props.providers as ProviderArray;

  // Without this guard a missing prop surfaces from the array reads below as
  // "Cannot read properties of undefined", naming neither the prop nor the
  // component.
  if (!Array.isArray(providerList)) {
    throw new TypeError(
      `ComposeProvider: expected \`providers\` to be an array, received ${
        providerList === undefined ? 'undefined' : typeof providerList
      }. Pass an array of providers, e.g. <ComposeProvider providers={[ThemeProvider]}>.`,
    );
  }

  if (isDevelopment && providerList.length === 0) {
    warnOnce(
      'ComposeProvider: Empty provider array. No providers will be applied.',
    );
  }

  return (
    <>
      {providerList
        .slice()
        .reverse()
        .reduce((acc: React.ReactNode, curr) => {
          const [ProviderComponent, providerProps] = Array.isArray(curr)
            ? [curr[0], curr[1]]
            : [curr, {}];

          return (
            <ProviderComponent {...providerProps}>{acc}</ProviderComponent>
          );
        }, props.children)}
    </>
  );
}
