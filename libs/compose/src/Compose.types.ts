import { ComponentType, ComponentProps } from 'react';

/**
 * Any provider component, for use in a generic *constraint*.
 *
 * `any` is load-bearing and cannot be tightened. `ComponentType<unknown>` would
 * reject a provider with concrete props, because component props are
 * contravariant -- a `ComponentType<{theme: string}>` is not assignable to a
 * `ComponentType<unknown>`. TypeScript has no "some component, props unknown"
 * type for this position.
 *
 * Inference is unaffected: the checks below resolve against the concrete
 * component that was actually passed, not against this constraint.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyComponent = ComponentType<any>;

/**
 * Extracts props from a React component, excluding the children prop.
 */
export type PropsWithoutChildren<T extends AnyComponent> = Omit<
  ComponentProps<T>,
  'children'
>;

/**
 * Helper to create a strongly-typed provider tuple.
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
export function provider<T extends AnyComponent>(
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
 * @example
 * ```tsx
 * const providers = [
 *   SimpleProvider,
 *   [ThemeProvider, { theme: 'dark', primaryColor: '#007acc' }],
 * ] as const;
 * ```
 */
export type Provider = AnyComponent | readonly [AnyComponent, unknown];

/**
 * Array of providers to be composed.
 * Providers are applied in order (first provider is outermost).
 */
export type ProviderArray = readonly Provider[];

/**
 * Checks one provider entry.
 *
 * A valid entry maps to itself. An entry whose props do not match its
 * component maps to the shape it *should* have had, which is what surfaces the
 * mismatch as a type error at the call site -- naming the missing or wrong
 * prop rather than just saying the array is wrong.
 */
export type ValidateProvider<T> = T extends readonly [infer C, infer P]
  ? C extends AnyComponent
    ? [P] extends [PropsWithoutChildren<C>]
      ? // Assignability alone permits extra properties, so check for keys the
        // component does not declare -- otherwise a typo in a prop name is
        // silently accepted. The excess keys are mapped to `never` rather
        // than simply dropped, because the caller's object would still
        // satisfy an intersection that merely omitted them.
        Exclude<keyof P, keyof PropsWithoutChildren<C>> extends never
        ? T
        : readonly [
            C,
            PropsWithoutChildren<C> &
              Record<Exclude<keyof P, keyof PropsWithoutChildren<C>>, never>,
          ]
      : readonly [C, PropsWithoutChildren<C>]
    : never
  : T extends AnyComponent
    ? T
    : never;

/**
 * Applies {@link ValidateProvider} across a provider tuple, preserving
 * positions so an error points at the offending element.
 */
export type ValidateProviders<T extends ProviderArray> = {
  readonly [K in keyof T]: ValidateProvider<T[K]>;
};
