# @evanion/compose

**Escape "Provider Hell" with flattened, type-safe provider composition.**

Stop nesting your React providers in a deepening pyramid that makes your `App.tsx` unreadable and your component tree a nightmare to maintain. `@evanion/compose` lets you flatten nested providers into a single, readable list—while keeping the strict type-safety of each provider's props.

## The Problem: The Provider Pyramid of Doom

As your app grows, your root component inevitably becomes a wall of nesting. It's hard to read, hard to reorder, and a single missing prop in a deeply nested provider can be a nightmare to debug:

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

## The Solution: Flattened Composition

`@evanion/compose` replaces the pyramid with a simple array. The first entry in the list becomes the outermost provider, matching the natural order of your nesting.

A bare component works for a provider whose props are all optional, while `provider()` checks the props of others where they are written. This block runs in the package's test suite with `React`, `renderToStaticMarkup` from `react-dom/server`, and `ComposeProvider` and `provider` from `@evanion/compose` imported; the `// ->` comment shows the resulting markup.

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

## Key Features

- 🧩 **Readability**: Your provider stack is now a clean, linear list.
- 🎯 **Compile-Time Safety**: The `provider()` helper ensures that the props you pass match the component's requirements. Missing or wrong props are compile errors, not runtime crashes.
- ⚡ **RSC Ready**: `ComposeProvider` uses no hooks or context, making it fully compatible with React Server Components (RSC) and Next.js `app/layout.tsx` without needing a `'use client'` boundary.
- 📦 **Dependencies**: React 18 or 19 is the only peer dependency, with no runtime dependencies. The package is ESM only, requires Node 20 or newer, and ships its own types.

## Installation

```bash
npm install @evanion/compose
```

## Documentation

For detailed API references, migration guides from 1.x, and advanced type-checking patterns, visit our documentation site:

👉 **[docs.evanion.com/compose](https://docs.evanion.com/compose/)**

## License

MIT
