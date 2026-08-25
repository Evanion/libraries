import * as React from 'react';
import type { ProviderArray, ValidateProviders } from './Compose.types.js';

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

/** Props for `ComposeProvider`. */
export interface ComposeProviderProps<T extends ProviderArray = ProviderArray> {
  /**
   * Providers to compose. The first entry ends up outermost.
   *
   * The `T & ValidateProviders<T>` intersection is deliberate. A bare
   * `ValidateProviders<T>` is a non-homomorphic mapped type, which is not an
   * inferable position -- TypeScript would give up on inferring `T`, fall back
   * to the constraint, and accept anything. Keeping `T` in the intersection
   * gives inference something to latch onto while the mapped half does the
   * checking.
   */
  providers: T & ValidateProviders<T>;
  children: React.ReactNode;
}

/**
 * Legacy prop shape.
 *
 * @deprecated Use {@link ComposeProviderProps} and the `providers` prop instead.
 */
export interface LegacyComposeProviderProps<
  T extends ProviderArray = ProviderArray,
> {
  components: T & ValidateProviders<T>;
  children: React.ReactNode;
}

/** Either accepted prop shape for {@link ComposeProvider}. */
export type AnyComposeProviderProps =
  ComposeProviderProps | LegacyComposeProviderProps;

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
 * @param props.components - (Deprecated) Legacy alias for providers
 * @param props.children - Child elements to wrap with providers
 */
export function ComposeProvider<const T extends ProviderArray>(
  props: ComposeProviderProps<T>,
): React.ReactElement;
export function ComposeProvider<const T extends ProviderArray>(
  props: LegacyComposeProviderProps<T>,
): React.ReactElement;
export function ComposeProvider(
  props: AnyComposeProviderProps,
): React.ReactElement {
  const hasProviders = 'providers' in props;
  const hasComponents = 'components' in props;
  const providerList = (
    hasProviders
      ? props.providers
      : (props as LegacyComposeProviderProps).components
  ) as ProviderArray;

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

  // Warnings live in an effect rather than the render body so they fire once per
  // mount instead of on every render (and twice per render under StrictMode).
  React.useEffect(() => {
    if (!isDevelopment) return;

    if (providerList.length === 0) {
      console.warn(
        'ComposeProvider: Empty provider array. No providers will be applied.',
      );
    }

    if (hasComponents) {
      console.warn(
        'ComposeProvider: The "components" prop is deprecated. Please use "providers" instead.',
      );
    }

    if (hasProviders && hasComponents) {
      console.warn(
        'ComposeProvider: Received both "providers" and "components". "providers" takes precedence and "components" is ignored.',
      );
    }
  }, [providerList, hasProviders, hasComponents]);

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
