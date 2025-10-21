import * as React from 'react';
import { ProviderArray } from './Compose.types';

// Props for the ComposeProvider component
interface ComposeProviderProps {
  providers: ProviderArray;
  children: React.ReactNode;
}

// Legacy support for 'components' prop (deprecated)
interface LegacyComposeProviderProps {
  components: ProviderArray;
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
 *   [AuthProvider, { user, token }]
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
export const ComposeProvider: React.FC<
  ComposeProviderProps | LegacyComposeProviderProps
> = (props) => {
  const providerList =
    'providers' in props ? props.providers : props.components;

  // Development mode warnings
  if (process.env.NODE_ENV !== 'production') {
    if (providerList.length === 0) {
      console.warn(
        'ComposeProvider: Empty provider array. No providers will be applied.'
      );
    }

    // Warn about deprecated 'components' prop
    if ('components' in props) {
      console.warn(
        'ComposeProvider: The "components" prop is deprecated. Please use "providers" instead.'
      );
    }
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
};
