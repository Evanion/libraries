# @evanion/compose

**Flatten nested React providers into one type-checked list.**

A React root nests one provider inside the next, so adding one reindents the tree and moving one means finding its closing tag. `@evanion/compose` lets you flatten nested providers into a single, readable list, while TypeScript still checks each provider's props against its own component.

## The Problem: Nested Providers

As your app grows, your root component nests one level deeper per provider. It's hard to read, hard to reorder, and a missing prop in a deeply nested provider is hard to find:

```tsx
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <CacheProvider value={emotionCache}>
        <ThemeProvider theme={theme}>
          <TranslationProvider locale={locale} messages={messages}>
            <StateProvider state={stateStore}>
              <CartProvider>
                <TooltipProvider>
                  <Routes />
                </TooltipProvider>
              </CartProvider>
            </StateProvider>
          </TranslationProvider>
        </ThemeProvider>
      </CacheProvider>
    </ErrorBoundary>
  );
};
```

## The Solution: Flattened Composition

`@evanion/compose` replaces the nesting with an array. The first entry in the list becomes the outermost provider, matching the natural order of your nesting.

```tsx
import { ComposeProvider, provider } from '@evanion/compose';

const providers = [
  ErrorBoundary,
  provider(CacheProvider, { value: emotionCache }),
  provider(ThemeProvider, { theme }),
  provider(TranslationProvider, { locale, messages }),
  provider(StateProvider, { state: stateStore }),
  CartProvider,
  TooltipProvider,
];

const App: React.FC = () => {
  return (
    <ComposeProvider providers={providers}>
      <Routes />
    </ComposeProvider>
  );
};
```

Rendered, the array is the tree. `CartProvider` is first in the array and outermost in the markup:

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

`ThemeProvider` needs a prop, so it goes through `provider()`, which pairs the component with its props.

### Why this is better:

- 🧩 **Readability**: Your provider stack is now a clean, linear list.
- 🎯 **Compile-Time Safety**: The `provider()` helper checks the props you pass against the component's own props. A missing or wrong prop is a compile error. Nothing checks props at runtime.
- ⚡ **RSC Ready**: `ComposeProvider` uses no hooks, no context and no class component, so a React Server Component, a Next.js `app/layout.tsx` included, can import it without a `'use client'` boundary. A provider you pass that calls `createContext` is still client code.
- 🪶 **Zero Dependencies**: React is the only peer dependency, and the package has no runtime dependencies of its own.

## Installation

```bash
npm install @evanion/compose
```

React 18 or 19 is the only peer dependency. The package is ESM-only and needs Node 20 or newer. It has no `require` condition, so a CommonJS consumer needs a Node whose `require()` loads ES modules: 20.19 or later on Node 20, or 22.12 or later. An older `require()`, or Jest without ESM support, fails with `ERR_REQUIRE_ESM`.

## Beyond the Basics

While the basic usage is simple, `@evanion/compose` handles the cases a production app runs into:

- **Type-Safe Tuples**: Use `[Component, props]` tuples for a concise alternative to the `provider()` helper.
- **Fixed-Length Arrays**: The library uses TypeScript's `const` type inference to check every entry in your array individually.
- **Wrapper Components**: `ComposeProviderProps<T>` lets your own wrapper pass its caller's array through still checked.
- **Remounting**: [Changing the Array Remounts the Subtree](#changing-the-array-remounts-the-subtree), below, keeps a conditional provider from remounting everything under it.

For guides on where the check happens and how to keep it, visit the documentation site:

👉 **[docs.evanion.com/compose](https://docs.evanion.com/compose)**

The rest of this README is the reference: every example below marked `@import.meta.vitest` runs in the package's test suite.

## A Root Component with Three Context Providers

A board game shop's root holds a cart, a theme and a currency, each a context provider. `Shop` composes them, and `Basket` reads all three:

<!-- #region first-shop -->

```tsx @import.meta.vitest
const CartContext = React.createContext(0);
const ThemeContext = React.createContext<'light' | 'dark'>('light');
const CurrencyContext = React.createContext<'SEK' | 'GBP' | 'USD'>('SEK');

const CartProvider = ({ children }: React.PropsWithChildren) => (
  <CartContext.Provider value={2}>{children}</CartContext.Provider>
);

const ThemeProvider = ({
  theme,
  children,
}: React.PropsWithChildren<{ theme: 'light' | 'dark' }>) => (
  <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
);

const CurrencyProvider = ({
  currency,
  children,
}: React.PropsWithChildren<{ currency: 'SEK' | 'GBP' | 'USD' }>) => (
  <CurrencyContext.Provider value={currency}>
    {children}
  </CurrencyContext.Provider>
);

function Shop({ children }: React.PropsWithChildren) {
  return (
    <ComposeProvider
      providers={[
        CartProvider,
        provider(ThemeProvider, { theme: 'dark' }),
        provider(CurrencyProvider, { currency: 'SEK' }),
      ]}
    >
      {children}
    </ComposeProvider>
  );
}

function Basket() {
  const games = React.useContext(CartContext);
  const theme = React.useContext(ThemeContext);
  const currency = React.useContext(CurrencyContext);

  return <p className={theme}>{`${games} games, priced in ${currency}`}</p>;
}

const markup = renderToStaticMarkup(
  <Shop>
    <Basket />
  </Shop>,
);

markup; // -> '<p class="dark">2 games, priced in SEK</p>'
```

<!-- #endregion first-shop -->

A context provider renders no element of its own, so `markup` is `Basket`'s paragraph alone, and the values in it came through all three providers.

## Three Ways to Write an Entry

A provider with no props is the component itself. A provider with props is either a `provider()` call or a `[component, props]` tuple. The providers from here on render a `div` whose `id` is their prop, so the markup shows which props arrived:

<!-- #region entries -->

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

const CurrencyProvider = ({
  currency,
  children,
}: React.PropsWithChildren<{ currency: 'SEK' | 'GBP' | 'USD' }>) => (
  <div id={currency}>{children}</div>
);
// ---cut---
const markup = renderToStaticMarkup(
  <ComposeProvider
    providers={[
      // A bare component, for a provider whose props are all optional.
      CartProvider,
      // A `provider()` call, checked where it is written.
      provider(ThemeProvider, { theme: 'dark' }),
      // A tuple, checked where the array reaches `ComposeProvider`.
      [CurrencyProvider, { currency: 'SEK' }],
    ]}
  >
    <p>Brass: Birmingham</p>
  </ComposeProvider>,
);

markup; // -> '<div id="cart"><div id="dark"><div id="SEK"><p>Brass: Birmingham</p></div></div></div>'
```

<!-- #endregion entries -->

The docs site renders each block from its `// ---cut---` down. The lines above the marker declare what the block needs to compile.

A `provider()` call and a tuple type-check identically. The difference is where the check happens, and therefore whether you get autocomplete:

|                                 | `provider()`          | tuple                                        |
| ------------------------------- | --------------------- | -------------------------------------------- |
| IntelliSense while typing props | yes                   | no: you must know the prop names             |
| Errors reported at              | the `provider()` call | the `<ComposeProvider>` that takes the array |
| An entry held in a variable     | still checked         | widened, and refused without naming the prop |

A tuple is checked only while the array has a fixed-length array type, which it has when written inline in the JSX attribute or declared `as const`. Annotated `ProviderArray`, or checked with `satisfies ProviderArray`, the array widens to a plain array and its entries go unchecked. Below, the annotated array compiles and renders `ThemeProvider` with no `theme`, and the same entry declared `as const` reports the missing prop:

<!-- #region named-array -->

```tsx @import.meta.vitest
// @errors: 2322
const ThemeProvider = ({
  theme,
  children,
}: React.PropsWithChildren<{ theme: 'light' | 'dark' }>) => (
  <div id={theme}>{children}</div>
);
// ---cut---
import type { ProviderArray } from '@evanion/compose';

const annotated: ProviderArray = [[ThemeProvider, {}]];
const constant = [[ThemeProvider, {}]] as const;
const plain = [[ThemeProvider, { theme: 'dark' }]];

// Compiled for their errors only: `constant` misses `theme`, and `plain` has
// widened to an array that is not a provider.
<ComposeProvider providers={constant}>{null}</ComposeProvider>;
<ComposeProvider providers={plain}>{null}</ComposeProvider>;

const markup = renderToStaticMarkup(
  <ComposeProvider providers={annotated}>
    <p>Brass: Birmingham</p>
  </ComposeProvider>,
);

markup; // -> '<div><p>Brass: Birmingham</p></div>'
```

<!-- #endregion named-array -->

`// @errors: 2322` lists the compiler error the block produces. The docs site compiles every such block and fails its build when a listed error stops appearing.

## Changing the Array Remounts the Subtree

React reconciles by position, so `providers={[...(isAuthed ? [AuthProvider] : []), ThemeProvider]}` unmounts and remounts everything below it on login, losing all state in it. Keep the array a fixed length and let the providers themselves handle the conditional case.

A new props value is not a change to the array's shape. An entry built from state, `provider(ThemeProvider, { theme })`, re-renders `ThemeProvider` in place when `theme` changes, and the state below it stays.

## What the Type Errors Look Like

An array written inline is checked entry by entry, and each failing entry reports on its own line. At runtime nothing checks the props, so the same array renders:

<!-- #region checked-inline -->

```tsx @import.meta.vitest
// @errors: 2322 2741
const ThemeProvider = ({
  theme,
  children,
}: React.PropsWithChildren<{ theme: 'light' | 'dark' }>) => (
  <div id={theme}>{children}</div>
);
// ---cut---
const markup = renderToStaticMarkup(
  <ComposeProvider
    providers={[
      ThemeProvider,
      [ThemeProvider, {}],
      [ThemeProvider, { theme: 'blue' }],
      [ThemeProvider, { theme: 'dark', accent: 'green' }],
    ]}
  >
    <p>Brass: Birmingham</p>
  </ComposeProvider>,
);

markup; // -> '<div><div><div id="blue"><div id="dark"><p>Brass: Birmingham</p></div></div></div></div>'
```

<!-- #endregion checked-inline -->

`provider()` reports a wrong value at the call, naming the value and the type it missed, and returns the pair unchanged:

<!-- #region checked-at-call -->

```tsx @import.meta.vitest
// @errors: 2322
const ThemeProvider = ({
  theme,
  children,
}: React.PropsWithChildren<{ theme: 'light' | 'dark' }>) => (
  <div id={theme}>{children}</div>
);
// ---cut---
const entry = provider(ThemeProvider, { theme: 'blue' });

entry; // -> [ThemeProvider, { theme: 'blue' }]
```

<!-- #endregion checked-at-call -->

Failures that are not just a wrong value resolve to `ComposeError<"…">`, so TypeScript prints the explanation in the first line of the error:

```
Type '[…, { theme: "dark"; accent: "green"; }]' is not assignable to type
'readonly […] & ComposeError<"unknown prop 'accent'">'.
```

## API Reference

### `ComposeProvider`

| Prop        | Meaning                              |
| ----------- | ------------------------------------ |
| `providers` | the providers, first entry outermost |
| `children`  | what they wrap                       |

`ComposeProvider` is a generic function, not a `React.FC`. It infers the providers array as a fixed-length array type (`const T`), which is what lets it check each entry against its own component.

It throws a `TypeError` naming the prop when `providers` is not an array, which only a caller outside TypeScript can reach, and warns once in development when the array is empty.

### `provider(component, props)`

Returns the readonly tuple `[component, props]`, with `props` checked and autocompleted against `component`.

```tsx
const p = provider(ThemeProvider, {
  theme: 'dark', // <- IntelliSense suggests available props
});
```

### Types

- `AnyComponent`: the constraint for any component, `ComponentType<any>`.
- `PropsWithoutChildren<T>`: the props an entry has to supply, which is `T`'s props without `children`.
- `Provider`: a provider component or a `[component, props]` tuple.
- `ProviderArray`: a readonly array of those.
- `ValidateProvider<T>` and `ValidateProviders<T>`: the checks for one entry and for each position of an array.
- `ValidatedProviders<T>`: the type of the `providers` prop. For a fixed-length array type it validates entry by entry; for an already-widened `ProviderArray` it resolves to `ProviderArray`, so a value of that type can be forwarded through a wrapper component.
- `ComposeProviderProps<T>`: the props interface.

A wrapper generic over `ComposeProviderProps<T>` passes its caller's array to `ComposeProvider` still checked:

<!-- #region wrapper -->

```tsx @import.meta.vitest
// @errors: 2741
const CartProvider = ({ children }: React.PropsWithChildren) => (
  <div id="cart">{children}</div>
);

const ThemeProvider = ({
  theme,
  children,
}: React.PropsWithChildren<{ theme: 'light' | 'dark' }>) => (
  <div id={theme}>{children}</div>
);
// ---cut---
import type { ComposeProviderProps, ProviderArray } from '@evanion/compose';

function AppProviders<const T extends ProviderArray>({
  providers,
  children,
}: ComposeProviderProps<T>) {
  return <ComposeProvider providers={providers}>{children}</ComposeProvider>;
}

// Compiled for its error only: the caller's tuple misses `theme`.
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

A wrapper that types its prop as plain `ProviderArray` compiles too, and the entries are unchecked at that boundary: a `ProviderArray` has already lost the identity of its elements, so there is nothing left to check.

## Migrating from 1.x

| 1.0.8                                           | 2.0                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| `<ComposeProvider components={[...]}>`          | `<ComposeProvider providers={[...]}>`                                    |
| dual CommonJS and ESM builds                    | ESM only; `require('@evanion/compose')` needs Node 20.19, 22.12 or newer |
| the `Component` type                            | `Provider` or `ProviderArray`                                            |
| `Provider`, an alias of `Component`             | `AnyComponent \| readonly [AnyComponent, unknown]`                       |
| `ComposeProvider` typed as a `React.FC`         | a generic function that no longer assigns to `React.FC`                  |
| a missing `providers` fails reading `undefined` | throws a `TypeError` naming `providers`                                  |

The `components` prop is gone from the type surface. A JavaScript caller that still passes it gets a named error:

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

## License

MIT License - see [LICENSE](../../LICENSE) for details.
