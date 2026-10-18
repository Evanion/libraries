# @evanion/compose

**Flatten your React provider nesting into a type-safe, readable list.**

As an application grows, the root component often becomes a "pyramid of doom"—a wall of nested providers that is difficult to read, reorder, and debug. `@evanion/compose` solves this by allowing you to define your provider stack as a linear array without losing the strict type-safety of each provider's props.

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

## Capabilities of @evanion/compose

The `@evanion/compose` package provides a streamlined way to manage your component tree:

- **Compile-Time Safety**: The `provider()` helper ensures that passed props match the component's requirements, turning missing or wrong props into compile errors rather than runtime crashes.
- **RSC Compatibility**: Because `ComposeProvider` uses no hooks or context, it is fully compatible with React Server Components (RSC) and Next.js `app/layout.tsx` without requiring a `'use client'` boundary.
- **Linear Readability**: Your provider stack is transformed from a deep nest into a clean, linear list where the first entry is the outermost provider.

## Installation

`@evanion/compose` is an ESM-only package that requires Node 20 or newer. It has no runtime dependencies and requires React 18 or 19 as a peer dependency.

```bash
npm install @evanion/compose
```

## Documentation

For detailed API references, migration guides from 1.x, and advanced type-checking patterns, visit the documentation site:

👉 **[libs.evanion.com/docs/compose](https://libs.evanion.com/docs/compose/)**

## License

MIT
