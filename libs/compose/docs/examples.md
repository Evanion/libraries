# @evanion/compose examples

The documentation site renders these blocks by region, and each one runs as a test of this package.

## The Solution: Flattened Composition

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

## A Root Component with Three Context Providers

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

## Three Ways to Write an Entry

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

## What the Type Errors Look Like

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

## API Reference

### Types

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

## Migrating from 1.x

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
