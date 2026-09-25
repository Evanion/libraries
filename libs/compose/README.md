[![npm version](https://img.shields.io/npm/v/@evanion/compose)](https://www.npmjs.com/package/@evanion/compose)
[![npm downloads](https://img.shields.io/npm/dm/@evanion/compose)](https://www.npmjs.com/package/@evanion/compose)
[![CI](https://github.com/Evanion/libraries/actions/workflows/ci.yml/badge.svg)](https://github.com/Evanion/libraries/actions/workflows/ci.yml)

# @evanion/compose

Flatten nested React providers into a single, readable list, with each entry's
props checked against its own component.

Full documentation: [docs.evanion.com/compose](https://docs.evanion.com/compose).

## The problem

Raise your hand if your `App.tsx` looks like this:

```tsx
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <CacheProvider value={emotionCache}>
        <ThemeProvider theme={theme}>
          <TranslationProvider locale={locale} messages={messages}>
            <StateProvider state={stateStore}>
              <CoffeeProvider>
                <SanityProvider>
                  <Routes />
                </SanityProvider>
              </CoffeeProvider>
            </StateProvider>
          </TranslationProvider>
        </ThemeProvider>
      </CacheProvider>
    </ErrorBoundary>
  );
};
```

## The solution

```tsx
import { ComposeProvider, provider } from '@evanion/compose';

const providers = [
  ErrorBoundary,
  provider(CacheProvider, { value: emotionCache }),
  provider(ThemeProvider, { theme }),
  provider(TranslationProvider, { locale, messages }),
  provider(StateProvider, { state: stateStore }),
  CoffeeProvider,
  SanityProvider,
];

const App: React.FC = () => {
  return (
    <ComposeProvider providers={providers}>
      <Routes />
    </ComposeProvider>
  );
};
```

The first entry ends up outermost, so the list reads in the same order as the
pyramid it replaces. Rendered, the array is the tree:

<!-- #region render-order -->

```tsx @import.meta.vitest
const CartProvider = ({ children }: React.PropsWithChildren) => (
  <div id="cart">{children}</div>
);

const ThemeProvider = ({
  theme,
  children,
}: React.PropsWithChildren<{ theme: 'light' | 'dark' }>) => (
  <div id={theme}>{children}</div>
);

const markup = renderToStaticMarkup(
  <ComposeProvider
    providers={[CartProvider, provider(ThemeProvider, { theme: 'dark' })]}
  >
    <p>Brass: Birmingham</p>
  </ComposeProvider>,
);

markup; // -> '<div id="cart"><div id="dark"><p>Brass: Birmingham</p></div></div>'
```

<!-- #endregion render-order -->

`CartProvider` is first in the array and outermost in the markup. `ThemeProvider`
needs a prop, so it goes through `provider()`, which pairs the component with the
props.

## Installation

```bash
npm install @evanion/compose
```

React 18 or 19 is the only peer dependency, and the package has no runtime
dependencies of its own.

The package is ESM only. There is no `require` condition, so CommonJS
consumers -- Jest without `transform`/ESM support, or a `require()` call on a
Node that cannot load ES modules through it -- hit `ERR_REQUIRE_ESM`.

`ComposeProvider` uses no hooks, no context and no class component, so it is
importable from a React Server Component graph -- a Next.js `app/layout.tsx`
included -- without a `'use client'` boundary.

## A root component with three providers

A board game shop's root holds a cart, a theme and a currency. `Shop` renders
them around whatever page it is given:

<!-- #region first-shop -->

```tsx @import.meta.vitest
const CartProvider = ({ children }: React.PropsWithChildren) => (
  <div id="cart">{children}</div>
);

const ThemeProvider = ({
  theme,
  children,
}: React.PropsWithChildren<{ theme: 'light' | 'dark' }>) => (
  <div id={theme}>{children}</div>
);

const CurrencyProvider = ({ children }: React.PropsWithChildren) => (
  <div id="currency">{children}</div>
);

function Shop({ children }: React.PropsWithChildren) {
  return (
    <ComposeProvider
      providers={[
        CartProvider,
        provider(ThemeProvider, { theme: 'dark' }),
        CurrencyProvider,
      ]}
    >
      {children}
    </ComposeProvider>
  );
}

const markup = renderToStaticMarkup(
  <Shop>
    <p>Brass: Birmingham</p>
  </Shop>,
);

markup; // -> '<div id="cart"><div id="dark"><div id="currency"><p>Brass: Birmingham</p></div></div></div>'
```

<!-- #endregion first-shop -->

## Two ways to write an entry

A provider with no props is the component itself. A provider with props is
either a `provider()` call or a `[component, props]` tuple.

```tsx
provider(ThemeProvider, { theme }); // checked where you write it
[ThemeProvider, { theme }]; // checked where the array is passed
```

They type-check identically. The difference is where the check happens, and
therefore whether you get autocomplete:

|                                 | `provider()`          | tuple                                        |
| ------------------------------- | --------------------- | -------------------------------------------- |
| IntelliSense while typing props | yes                   | no -- you must know the prop names           |
| Errors reported at              | the `provider()` call | the `<ComposeProvider>` that takes the array |
| An entry held in a variable     | still checked         | widened, and refused without naming the prop |

A tuple is checked only while the array stays a literal tuple, which it is when
written inline in the JSX attribute or declared `as const`. Annotated
`ProviderArray`, or checked with `satisfies ProviderArray`, the array widens to
a plain array and its entries go unchecked. Below, the annotated array compiles
and renders `ThemeProvider` with no `theme`, and the same entry declared
`as const` reports the missing prop:

<!-- #region named-array -->

```tsx @import.meta.vitest
// @errors: 2322
import type { ProviderArray } from '@evanion/compose';

const ThemeProvider = ({
  theme,
  children,
}: React.PropsWithChildren<{ theme: 'light' | 'dark' }>) => (
  <div id={theme}>{children}</div>
);

const annotated: ProviderArray = [[ThemeProvider, {}]];
const constant = [[ThemeProvider, {}]] as const;

<ComposeProvider providers={constant}>{null}</ComposeProvider>;

const markup = renderToStaticMarkup(
  <ComposeProvider providers={annotated}>
    <p>Brass: Birmingham</p>
  </ComposeProvider>,
);

markup; // -> '<div><p>Brass: Birmingham</p></div>'
```

<!-- #endregion named-array -->

`// @errors: 2322` lists the compiler error the block produces. The docs site
compiles every such block and fails its build when a listed error stops
appearing.

## Changing the array remounts the subtree

React reconciles by position, so
`providers={[...(isAuthed ? [AuthProvider] : []), ThemeProvider]}` unmounts and
remounts everything below it on login, losing all state in it. Keep the array a
fixed length and let the providers themselves handle the conditional case.

## What the type errors look like

An array written inline is checked entry by entry, and each failing entry
reports on its own line. At runtime nothing checks the props, so the same array
renders:

<!-- #region checked-inline -->

```tsx @import.meta.vitest
// @errors: 2322 2741
const ThemeProvider = ({
  theme,
  children,
}: React.PropsWithChildren<{ theme: 'light' | 'dark' }>) => (
  <div id={theme}>{children}</div>
);

const markup = renderToStaticMarkup(
  <ComposeProvider
    providers={[
      ThemeProvider,
      [ThemeProvider, {}],
      [ThemeProvider, { theme: 'baize' }],
      [ThemeProvider, { theme: 'dark', accent: 'green' }],
    ]}
  >
    <p>Brass: Birmingham</p>
  </ComposeProvider>,
);

markup; // -> '<div><div><div id="baize"><div id="dark"><p>Brass: Birmingham</p></div></div></div></div>'
```

<!-- #endregion checked-inline -->

`provider()` reports a wrong value at the call, naming the value and the type it
missed, and returns the pair unchanged:

<!-- #region checked-at-call -->

```tsx @import.meta.vitest
// @errors: 2322
const ThemeProvider = ({
  theme,
  children,
}: React.PropsWithChildren<{ theme: 'light' | 'dark' }>) => (
  <div id={theme}>{children}</div>
);

const entry = provider(ThemeProvider, { theme: 'baize' });

entry; // -> [ThemeProvider, { theme: 'baize' }]
```

<!-- #endregion checked-at-call -->

Failures that are not just a wrong value carry the explanation in a property
name, so TypeScript prints it in the first line rather than under a structural
walk:

```
Property '"ComposeError: unknown prop 'accent'"' is missing in type
'[ThemeProvider, { theme: "dark"; accent: "green"; }]'
but required in type 'ComposeError<"unknown prop 'accent'">'.
```

## API reference

### `ComposeProvider`

| Prop        | Meaning                              |
| ----------- | ------------------------------------ |
| `providers` | the providers, first entry outermost |
| `children`  | what they wrap                       |

`ComposeProvider` is a generic function, not a `React.FC`. It infers the
providers array as a literal tuple (`const T`), which is what lets it check each
entry against its own component.

It throws a `TypeError` naming the prop when `providers` is not an array, which
only a caller outside TypeScript can reach, and warns once in development when
the array is empty.

### `provider(component, props)`

Returns the readonly tuple `[component, props]`, with `props` checked and
autocompleted against `component`.

```tsx
const p = provider(ThemeProvider, {
  theme: 'dark', // <- IntelliSense suggests available props
});
```

### Types

`Provider` -- a provider component or a `[component, props]` tuple.

`ProviderArray` -- a readonly array of those.

`ValidatedProviders<T>` -- the type of the `providers` prop. For a literal
tuple it validates entry by entry; for an already-widened `ProviderArray` it
resolves to `ProviderArray`, so a value of that type can be forwarded through a
wrapper component.

`ComposeProviderProps<T>` -- the props interface. A wrapper generic over it
passes its caller's array to `ComposeProvider` still checked:

<!-- #region wrapper -->

```tsx @import.meta.vitest
// @errors: 2741
import type { ComposeProviderProps, ProviderArray } from '@evanion/compose';

const CartProvider = ({ children }: React.PropsWithChildren) => (
  <div id="cart">{children}</div>
);

const ThemeProvider = ({
  theme,
  children,
}: React.PropsWithChildren<{ theme: 'light' | 'dark' }>) => (
  <div id={theme}>{children}</div>
);

function AppProviders<const T extends ProviderArray>({
  providers,
  children,
}: ComposeProviderProps<T>) {
  return <ComposeProvider providers={providers}>{children}</ComposeProvider>;
}

<AppProviders providers={[CartProvider, [ThemeProvider, {}]]}>
  {null}
</AppProviders>;

const markup = renderToStaticMarkup(
  <AppProviders providers={[CartProvider]}>
    <p>Brass: Birmingham</p>
  </AppProviders>,
);

markup; // -> '<div id="cart"><p>Brass: Birmingham</p></div>'
```

<!-- #endregion wrapper -->

A wrapper that types its prop as plain `ProviderArray` compiles too, and the
entries are unchecked at that boundary -- a `ProviderArray` has already lost the
identity of its elements, so there is nothing left to check.

## Migrating from 1.x

| Before                                                  | After                                 |
| ------------------------------------------------------- | ------------------------------------- |
| `<ComposeProvider components={[...]}>`                  | `<ComposeProvider providers={[...]}>` |
| `LegacyComposeProviderProps`                            | removed                               |
| `AnyComposeProviderProps`                               | removed                               |
| forwarding a `ProviderArray` variable failed to compile | compiles, unchecked at that boundary  |

The deprecated `components` prop is gone from the type surface entirely. A
JavaScript caller that still passes it gets a named error rather than silent
acceptance:

<!-- #region removed-components -->

```tsx @import.meta.vitest
const CartProvider = ({ children }: React.PropsWithChildren) => (
  <div id="cart">{children}</div>
);

// The props a JavaScript caller passes, which no compiler checked.
const legacy = { components: [CartProvider] } as never;

let message = '';
try {
  renderToStaticMarkup(React.createElement(ComposeProvider, legacy));
} catch (error) {
  message = (error as Error).message;
}

message; // -> 'ComposeProvider: `components` was removed in v2.0 — rename it to `providers`.'
```

<!-- #endregion removed-components -->

Keeping it as a second overload is what produced the unreadable diagnostics in
1.x: every error on a `providers` call carried a second half about the legacy
overload that could never match.

## Contributing

Contributions are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](../../LICENSE) for details.
