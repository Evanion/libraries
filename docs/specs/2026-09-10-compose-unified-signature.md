# compose: one signature, readable diagnostics

Status: Implemented in #79. Corrected below where the implementation measured the design wrong.
Package: `@evanion/compose` (repo 2.0.0, npm 1.0.8 — breaking changes are free until 2.0.0 ships)
Closes: #19, #20, #21.

## The contradiction being resolved

#19 asks for an added overload accepting an already-widened `ProviderArray`.
#20 asks for the two existing overloads to be collapsed, because the overload
split is part of the diagnostic cascade. Both are facets of the tuple failure
branch in `Compose.types.ts:76-95`, along with the closed #18.

They reconcile into one generic signature that accepts a widened
`ProviderArray` and produces readable errors. Not three sequential edits.

## Signature

```ts
export interface ComposeProviderProps<T extends ProviderArray = ProviderArray> {
  providers: ValidatedProviders<T>;
  children: React.ReactNode;
}

export function ComposeProvider<const T extends ProviderArray>(
  props: ComposeProviderProps<T>,
): React.ReactElement;
```

`ValidatedProviders<T>` branches once, before any element-wise check:

```ts
export type ValidatedProviders<T extends ProviderArray> =
  number extends T['length']
    ? ProviderArray            // widened: element identity already erased
    : T & ValidateProviders<T>; // literal tuple: validate element by element
```

`number extends T['length']` is the standard tuple-versus-array test, as used by
type-fest's `is-tuple.d.ts`. It is stricter than PR #62's
`T extends readonly [unknown, ...unknown[]]`, which only asserts at least one
element and works by accident.

All four input shapes go through this one signature:

- inline literal array — `const T` infers a tuple, validated element-wise
- `provider()` tuples — already returns a literal `readonly [T, Props]`
- bare components — handled by `ValidateProvider`'s component branch
- a `ProviderArray`-typed variable — widens, `length: number`, accepted as-is

That last case is #19.

## Why the cascade happens, and where it is fixed

When `T` is a plain non-tuple array, comparing it against `ReadonlyArray<X>`
structurally walks every inherited member, `every`, `map`, `reduce` and the rest.
TypeScript treats this as expected behaviour; see microsoft/TypeScript#50351.

The fix is not inside `ValidateProvider`. It is the gate above it: a widened
array never reaches `ValidateProviders`, so it is never compared member by
member. #19's fix and #20's fix are the same line.

TypeScript 6.0.3, this repo's version, changed nothing about overload or
conditional-type diagnostics. This is a shape problem, not a version problem.

## Error carrier

Failures become a branded carrier whose message is the object key, so
"Property '...' is missing" prints the message first instead of burying it:

```ts
type ComposeError<Msg extends string> = { readonly [K in `ComposeError: ${Msg}`]: never };

export type ValidateProvider<T> = T extends readonly [infer C, infer P]
  ? C extends AnyComponent
    ? P extends AnyComponent
      ? ComposeError<'second tuple element must be props, not another component'>
      : Exclude<keyof P, keyof PropsWithoutChildren<C>> extends never
        ? [P] extends [PropsWithoutChildren<C>]
          ? T
          : readonly [C, PropsWithoutChildren<C>]
        : ComposeError<`unknown prop '${Extract<Exclude<keyof P, keyof PropsWithoutChildren<C>>, string>}'`>
    : ComposeError<'first tuple element must be a component'>
  : T extends AnyComponent
    ? Record<string, never> extends PropsWithoutChildren<T>
      ? T
      : ComposeError<'this component requires props — use provider(Component, props) or a [Component, props] tuple'>
    : ComposeError<'not a valid provider'>;

export type ValidateProviders<T extends ProviderArray> = {
  readonly [K in keyof T]: ValidateProvider<T[K]>;
};
```

The missing-or-wrong-prop branch deliberately returns the real expected shape
rather than a carrier, because that diagnostic is already readable.

The excess-key check must run BEFORE the assignability check, not nested inside
it. An earlier draft of this spec had them the other way round, which #79
measured as still producing #20's 13-line `every` cascade: a component whose
props are all optional is a weak type, so `{ b: 1 }` is not assignable to it and
the case fell through to the repaired-shape branch — the exact comparison this
design exists to avoid.

Parameterising the failure branch instead of hardcoding `never` is prior art:
ts-toolbelt's `Any.Try<A1, A2, Catch>`. Naming the message into the key is the
documented friendly-error variant of the same idiom.

Resulting text for #20's cases:

- excess prop: `Property 'ComposeError: unknown prop 'typo'' is missing in type '{...}'`
- bare component needing props: names `provider(Component, props)` in the message
- array-method cascade: gone, never reached for widened arrays
- legacy-overload noise: gone, no second overload exists

## The deprecated `components` prop

Dropped from the type surface. 2.0.0 is the breaking window and keeping a union
or a second overload reintroduces the cascade #20 is about.

Runtime replaces the `hasComponents` branch at `Compose.tsx:114-120,140-150`
with a named error, since silently accepting a prop with no type support is
worse than refusing:

```ts
if (!('providers' in props)) {
  if ('components' in props) {
    throw new TypeError('ComposeProvider: `components` was removed in v2.0 — rename to `providers`.');
  }
  throw new TypeError(/* existing undefined message */);
}
```

`LegacyComposeProviderProps` and `AnyComposeProviderProps` are removed. This also
resolves #21's precedence and legacy-path gaps: there is nothing left to test.

## PR #62

Supersede, do not merge or rebase. It bundles three changes:

- the `Compose.tsx` conditional — superseded by `ValidatedProviders`, same goal,
  weaker tuple test, and it keeps both overloads so it does not address #20
- the `Compose.types.ts` hunk (bare-component-needs-props, component-in-props-slot)
  — good and orthogonal, port it through `ComposeError`
- the `provider()` excess-prop constraint — independent, keep as-is

## Type tests (#21)

Expected to compile: inline literal array; a `provider()` mix; a bare component
with no required props; a `const providers: ProviderArray = [...]` forwarded
through a wrapper (#19); an empty array.

Expected `@ts-expect-error`: missing required prop; wrong literal union value;
excess prop on a tuple; excess prop through a `provider()` variable; bare
component that requires props; a component in the tuple's props slot; any use of
`components`.

Before locking the exact `ComposeError` wording into tests, compile once against
TypeScript 6.0.3 and read the real diagnostic. Branded-key errors render
differently across TypeScript and IDE versions.

## Already correct, do not re-fix

`Compose.tsx:156` slices before reversing, so the input-mutation bug #21 guards
against is fixed. `Compose.tsx:116-120` implements `providers`-over-`components`
precedence correctly. Both need tests, not code.

## RSC

The package has no `'use client'` and does not need one. Commit 29cbd0c removed
the `useEffect` that had forced it; the source now uses only JSX and plain
functions. Do not introduce any React API absent from the `react-server`
condition. `memo`, `Suspense`, `lazy`, `use`, `useMemo` and `useCallback` are
available; `Component`, `createContext`, `useContext` and the stateful hooks are
not.

#21 asks for a test that imports the package under the `react-server` condition.
That is still worth adding even though the bug it would have caught is fixed.

## Migration

| Before | After |
| --- | --- |
| `<ComposeProvider components={[...]}>` | `<ComposeProvider providers={[...]}>` |
| `LegacyComposeProviderProps` | removed |
| `AnyComposeProviderProps` | removed |
| forwarding a `ProviderArray` variable failed to compile | compiles, unchecked at that boundary |
