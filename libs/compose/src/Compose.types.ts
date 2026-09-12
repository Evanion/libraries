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
 * `T`'s props without `children`.
 *
 * `children` is excluded because `ComposeProvider` supplies it — it is the next
 * provider in the array, or the caller's own children at the innermost level.
 * Leaving it in would make every provider's props look incomplete.
 */
export type PropsWithoutChildren<T extends AnyComponent> = Omit<
  ComponentProps<T>,
  'children'
>;

/**
 * Pairs a component with its props as a `[component, props]` tuple.
 *
 * The props are checked here, at the call, rather than where the array reaches
 * `ComposeProvider`: `T` is inferred from `component` in the same call, so the
 * editor has the component's prop names while the object is being typed. A bare
 * tuple literal only knows what it should be once `ComposeProvider` sees it.
 *
 * The `Record<Exclude<…>, never>` intersection on `props` is what rejects an
 * excess key. Plain assignability would not: TypeScript's excess-property check
 * fires on a fresh object literal and is skipped for a props object passed
 * through a variable.
 *
 * @example
 * ```tsx
 * const p = provider(ThemeProvider, {
 *   theme: 'dark',
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
 * A list of providers, first entry outermost.
 *
 * `readonly`, so an array written with `as const` is assignable. Annotating a
 * value with this type widens away the element identity, and
 * {@link ValidatedProviders} then checks nothing — build the array where the
 * components are known if you want per-entry errors.
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
        // weak type, so an object of only unknown keys is not assignable to it;
        // checking assignability first sends that case down the repaired-shape
        // branch, where comparing the caller's mutable tuple against a
        // constructed `readonly` tuple makes TypeScript report the variance of
        // `Array.prototype.every` rather than the prop nobody declared.
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
 * type-fest's `is-tuple.d.ts` uses). Two things depend on it:
 *
 * - A value already typed as {@link ProviderArray} has lost its element
 *   identity, so there is nothing left to check element by element. Sent
 *   through {@link ValidateProviders} it maps every entry onto the *repaired*
 *   shape, which the original is not assignable to, and forwarding a
 *   `ProviderArray` through a wrapper component stops compiling.
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
