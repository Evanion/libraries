import { ComponentType, ComponentProps } from 'react';

/**
 * Extracts props from a React component, excluding the children prop.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PropsWithoutChildren<T extends ComponentType<any>> = Omit<
  ComponentProps<T>,
  'children'
>;

/**
 * Helper to create a strongly-typed provider tuple.
 * This enables full IntelliSense for provider props.
 *
 * @param component - The provider component
 * @param props - Props for the provider (autocompleted based on component type)
 *
 * @example
 * ```tsx
 * const p = provider(ThemeProvider, {
 *   theme: 'dark',           // ← IntelliSense suggests 'theme' and 'primaryColor'
 *   primaryColor: '#007acc'
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function provider<T extends ComponentType<any>>(
  component: T,
  props: PropsWithoutChildren<T>,
): readonly [T, PropsWithoutChildren<T>] {
  return [component, props] as const;
}

/**
 * A provider can be either:
 * - A component without props: `ThemeProvider`
 * - A tuple with component and props: `[ThemeProvider, { theme: 'dark' }]`
 *
 * For best IntelliSense, use the `provider()` helper function.
 *
 * @example
 * ```tsx
 * const providers = [
 *   SimpleProvider,
 *   provider(ThemeProvider, { theme: 'dark', primaryColor: '#007acc' }),
 * ] as const;
 * ```
 */
export type Provider =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | ComponentType<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | readonly [ComponentType<any>, any];

/**
 * Array of providers to be composed.
 * Providers are applied in order (first provider is outermost).
 */
export type ProviderArray = readonly Provider[];
