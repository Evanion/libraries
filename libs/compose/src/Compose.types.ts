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
export function provider<
  T extends AnyComponent,
  P extends PropsWithoutChildren<T>,
>(
  component: T,
  props: P & Record<Exclude<keyof P, keyof PropsWithoutChildren<T>>, never>,
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
 * Carries a failure message in a property *key*.
 *
 * A failing entry has to become some type the caller's value is not assignable
 * to, and whatever that type is ends up quoted in the diagnostic. Putting the
 * explanation in the key means TypeScript prints it in the first line --
 * `Property 'ComposeError: unknown prop 'typo'' is missing in type '{...}'` --
 * instead of burying it under a structural walk.
 *
 * `never` as the value is what makes the object unsatisfiable, so no caller can
 * accidentally produce one.
 *
 * Parameterising the failure branch rather than hardcoding `never` follows
 * ts-toolbelt's `Any.Try<A1, A2, Catch>`; naming the message into the key is the
 * friendly-error variant of the same idiom.
 */
type ComposeError<Msg extends string> = {
  readonly [K in `ComposeError: ${Msg}`]: never;
};

/**
 * Checks one provider entry.
 *
 * A valid entry maps to itself. A failing entry maps to a {@link ComposeError}
 * naming what is wrong -- except for a missing or mistyped prop value, which
 * maps to the shape the entry *should* have had, because "Type 'blue' is not
 * assignable to type 'light' | 'dark'" already says everything a carrier could.
 */
export type ValidateProvider<T> = T extends readonly [infer C, infer P]
  ? C extends AnyComponent
    ? P extends AnyComponent
      ? ComposeError<'second tuple element must be props, not another component'>
      : // The excess-key check runs *before* the assignability check, and the
        // order is load-bearing. A component whose props are all optional is a
        // weak type, so `{ b: 1 }` is not assignable to it -- checking
        // assignability first sent that case down the repaired-shape branch,
        // where comparing the caller's mutable tuple against a constructed
        // `readonly` tuple made TypeScript report the variance of
        // `Array.prototype.every` instead of the prop nobody declared. That is
        // the error #20 opens with.
        Exclude<keyof P, keyof PropsWithoutChildren<C>> extends never
        ? [P] extends [PropsWithoutChildren<C>]
          ? T
          : readonly [C, PropsWithoutChildren<C>]
        : ComposeError<`unknown prop '${Extract<
            Exclude<keyof P, keyof PropsWithoutChildren<C>>,
            string
          >}'`>
    : ComposeError<'first tuple element must be a component'>
  : T extends AnyComponent
    ? Record<string, never> extends PropsWithoutChildren<T>
      ? T
      : ComposeError<'this component requires props — use provider(Component, props) or a [Component, props] tuple'>
    : ComposeError<'not a valid provider'>;

/**
 * Applies {@link ValidateProvider} across a provider tuple, preserving
 * positions so an error points at the offending element.
 */
export type ValidateProviders<T extends ProviderArray> = {
  readonly [K in keyof T]: ValidateProvider<T[K]>;
};

/**
 * The type of the `providers` prop: element-wise validation for a literal
 * tuple, and the plain array type for anything already widened.
 *
 * `number extends T['length']` is the standard tuple-versus-array test (the one
 * type-fest's `is-tuple.d.ts` uses). It is the whole fix for two separate
 * problems:
 *
 * - A value already typed as {@link ProviderArray} has lost its element
 *   identity, so there is nothing left to check element by element. Sending it
 *   through {@link ValidateProviders} mapped every entry onto the *repaired*
 *   shape, which the original was not assignable to, so forwarding a
 *   `ProviderArray` through a wrapper component could not compile.
 * - Comparing a non-tuple array against a constructed `ReadonlyArray` makes
 *   TypeScript walk every inherited member -- `every`, `map`, `reduce` -- and
 *   report the variance of `predicate` before it ever mentions the real
 *   mismatch (microsoft/TypeScript#50351). Gating above the mapped type means a
 *   widened array is never compared member by member.
 *
 * Keeping `T` in the intersection on the tuple branch is also deliberate: a
 * bare `ValidateProviders<T>` is a non-homomorphic mapped type and therefore
 * not an inference site, so TypeScript would fall back to the constraint and
 * check nothing.
 */
export type ValidatedProviders<T extends ProviderArray> =
  number extends T['length'] ? ProviderArray : T & ValidateProviders<T>;
