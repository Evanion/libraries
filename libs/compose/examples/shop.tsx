/**
 * The provider stack the `compose` pages render, as compiled source.
 *
 * `apps/docs/content/compose/*.mdx` cites the region below through
 * `file=libs/compose/examples/shop.tsx region=stack`, so what a reader copies
 * off a page is this file, character for character. `Compose.test.tsx` renders
 * `Shop` and asserts the nesting the pages claim for it, which is what holds a
 * listing to its own prose.
 *
 * The `// @jsx:` line is a Twoslash directive. The pages render these regions
 * as Twoslash fences, which compile them against Twoslash's own defaults --
 * classic JSX, which wants `React` in scope -- and the directive is what puts
 * the compiler on the automatic runtime this repo builds with. Twoslash strips
 * the line, so no reader sees it.
 *
 * Outside `src/`, so `package.json`'s `files` never packs it and the library
 * build never reaches it: an example is documentation, not API.
 */
// #region stack
// @jsx: react-jsx
import type { PropsWithChildren } from 'react';
import { ComposeProvider, provider } from '@evanion/compose';

const CartProvider = ({ children }: PropsWithChildren) => (
  <div id="cart">{children}</div>
);

const ThemeProvider = ({
  theme,
  children,
}: PropsWithChildren<{ theme: 'light' | 'dark' }>) => (
  <div id={theme}>{children}</div>
);

const CurrencyProvider = ({ children }: PropsWithChildren) => (
  <div id="currency">{children}</div>
);

export function Shop({ children }: PropsWithChildren) {
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
// #endregion stack
