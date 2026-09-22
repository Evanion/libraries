import { Head } from 'nextra/components';
import { ThemeProvider } from 'next-themes';
import { Bricolage_Grotesque, Public_Sans } from 'next/font/google';
import 'nextra-theme-docs/style.css';
import './global.css';
import { PropsWithChildren } from 'react';
import { baizeBackground, baizeColor } from './baize-theme';

/**
 * The two families `@evanion/baize-ui` names and does not ship, self-hosted: the
 * files are downloaded during the build and served from this site, so a rendered
 * page makes no request to Google. Each exposes a custom property, and global.css
 * points the library's own family tokens at them.
 */
const title = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-title',
});

const text = Public_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-text',
});

export const metadata = {
  title: {
    default: 'Evanion Libraries',
    template: '%s | Evanion Libraries',
  },
  description: 'Documentation for the Evanion open source libraries.',
  metadataBase: new URL('https://docs.evanion.com'),
};

/**
 * The document every route renders inside: the element, the fonts, the ground
 * and the theme, and nothing that belongs to one kind of page.
 *
 * The docs chrome is one level down. `(site)/layout.tsx` holds
 * `nextra-theme-docs`'s `Layout` -- the navbar, the sidebar, the search -- over
 * the landing page and the content tree, and `(tool)/` is a sibling group whose
 * routes render a full-viewport tool with chrome of its own. Neither group
 * names a URL segment, so every existing path is unchanged. In the App Router a
 * root layout applies to every route, so moving the chrome down is the only way
 * a route escapes it.
 *
 * **`ThemeProvider` is here rather than inside Nextra's `Layout`.** `html.dark`
 * is what `global.css` swaps the palette on, and `next-themes` is what writes
 * that class from a blocking script. A route outside the docs chrome would
 * otherwise render in the light palette with no way to change it. Nextra's
 * `Layout` still renders a provider of its own and it costs nothing: a
 * `ThemeProvider` that finds an enclosing one returns its children unchanged
 * (`next-themes@0.4.6`, `dist/index.mjs`). The options below are the defaults
 * `nextra-theme-docs/dist/schemas.js:24-30` parses, so the behaviour of a docs
 * page is the behaviour it already had.
 *
 * The theme stylesheet is imported ahead of `global.css`, because global.css is
 * what remaps the theme's own variables onto Baize tokens and the later
 * declaration of a custom property is the one that applies.
 */
export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html
      className={`${title.variable} ${text.variable}`}
      lang="en"
      // nextra-theme-docs reads `dir` to place its sidebar and breadcrumbs; it
      // has no default, so an unset value leaves both unplaced.
      dir="ltr"
      // next-themes writes the colour-scheme class onto this element from a
      // blocking script before React hydrates. Without this the class the
      // client sees never matches the server's markup.
      suppressHydrationWarning
    >
      {/* The ground and the accent reach the theme here rather than through CSS:
          `Head` writes both into an inline `<style>` in the document, which wins
          over any stylesheet link. Both are derived from the library's tokens. */}
      <Head backgroundColor={baizeBackground} color={baizeColor} />
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          storageKey="theme"
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
