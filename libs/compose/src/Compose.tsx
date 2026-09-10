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
 * This is deliberately a module-level set rather than a hook. An earlier version
 * used `useEffect`, which meant the component required hooks -- and under
 * React's `react-server` condition `useEffect` is `undefined`, so
 * `ComposeProvider` threw on first render in any React Server Component. A Next.js
 * root `app/layout.tsx` is exactly that. Keeping the component hook-free is what
 * lets it be imported from the server graph without a `'use client'` boundary.
 *
 * The effect version also did not achieve what it claimed: its dependency was the
 * caller's array, and a JSX literal is a fresh identity every render, so the
 * warning re-fired on every render for the most common call style.
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
 * Deliberately not re-exported from `index.ts`, so it is not public API -- it
 * exists because a module-level cache is otherwise impossible to test more than
 * once per file.
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
 * Composes multiple React providers into a single component to eliminate nesting.
 * Providers are applied in order (first provider is outermost, matching pyramid-of-doom reading order).
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
 *
 * @param props.providers - Array of providers to compose
 * @param props.children - Child elements to wrap with providers
 */
export function ComposeProvider<const T extends ProviderArray>(
  props: ComposeProviderProps<T>,
): React.ReactElement {
  // A JavaScript consumer, or one upgrading from 1.x, can still reach this with
  // the removed `components` prop. Refusing by name beats silently accepting a
  // prop the types no longer describe.
  if (!('providers' in props) && 'components' in props) {
    throw new TypeError(
      'ComposeProvider: `components` was removed in v2.0 \u2014 rename it to `providers`.',
    );
  }

  const providerList = props.providers as ProviderArray;

  // Fail with a message that names the problem. Without this, a missing prop
  // surfaces as "Cannot read properties of undefined (reading 'length')", which
  // says nothing about what the caller did wrong.
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
