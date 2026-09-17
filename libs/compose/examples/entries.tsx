/**
 * The three ways one entry of `providers` can be written, as compiled source.
 *
 * Cited by `apps/docs/content/compose/getting-started.mdx` and `api.mdx`
 * through `file=libs/compose/examples/entries.tsx region=entries`, and rendered
 * by `Compose.test.tsx`, which asserts that the three forms produce the same
 * tree. The claim the pages make about them is that they differ in where the
 * compiler checks them and in nothing else, so a test that renders all three is
 * the one that can fail.
 *
 * The `// @jsx:` line is a Twoslash directive. The pages render these regions
 * as Twoslash fences, which compile them against Twoslash's own defaults --
 * classic JSX, which wants `React` in scope -- and the directive is what puts
 * the compiler on the automatic runtime this repo builds with. Twoslash strips
 * the line, so no reader sees it.
 *
 * Outside `src/`, so `package.json`'s `files` never packs it and the library
 * build never reaches it.
 */
// #region entries
// @jsx: react-jsx
import type { PropsWithChildren } from 'react';
import { ComposeProvider, provider } from '@evanion/compose';

const CurrencyProvider = ({ children }: PropsWithChildren) => (
  <div id="currency">{children}</div>
);

const ThemeProvider = ({
  theme,
  children,
}: PropsWithChildren<{ theme: 'light' | 'dark' }>) => (
  <div id={theme}>{children}</div>
);

export function Counter({ children }: PropsWithChildren) {
  return (
    <ComposeProvider
      providers={[
        // A bare component, for a provider whose props are all optional.
        CurrencyProvider,
        // A `provider()` call, checked where it is written.
        provider(ThemeProvider, { theme: 'dark' }),
        // A tuple, checked where the array reaches `ComposeProvider`.
        [ThemeProvider, { theme: 'light' }],
      ]}
    >
      {children}
    </ComposeProvider>
  );
}
// #endregion entries
