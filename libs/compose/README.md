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

### Why this is better:
- 🧩 **Readability**: Your provider stack is now a clean, linear list.
- 🎯 **Compile-Time Safety**: The `provider()` helper ensures that the props you pass match the component's requirements. Missing or wrong props are compile errors, not runtime crashes.
- ⚡ **RSC Ready**: `ComposeProvider` uses no hooks or context, making it fully compatible with React Server Components (RSC) and Next.js `app/layout.tsx` without needing a `'use client'` boundary.
- 🪶 **Zero Dependencies**: Lightweight and efficient, adding no bloat to your bundle.

## Installation

```bash
npm install @evanion/compose
```

React 18 or 19 is the only peer dependency. The package is ESM-only.

## Beyond the Basics

While the basic usage is simple, `@evanion/compose` handles complex edge cases for production apps:

- **Type-Safe Tuples**: Use `[Component, props]` tuples for a concise alternative to the `provider()` helper.
- **Fixed-Length Arrays**: The library uses TypeScript's `const` type inference to check every entry in your array individually.
- **Remounting Logic**: Learn how to manage conditional providers without accidentally unmounting your entire application subtree.

For detailed API references, migration guides from 1.x, and advanced type-checking patterns, visit our documentation site:

👉 **[docs.evanion.com/compose](https://docs.evanion.com/compose)**

## License
MIT
