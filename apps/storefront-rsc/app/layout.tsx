import type { ReactNode } from 'react';
import { Bricolage_Grotesque, Public_Sans } from 'next/font/google';
import './global.css';

/**
 * Both families are self-hosted: `next/font/google` downloads the files during
 * the build and serves them from this app, so the rendered page makes no
 * request to Google. Each one exposes a custom property rather than a class, so
 * global.css holds the whole type decision alongside the rest of the tokens.
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
  title: 'Baize — async Server Component widget',
  description:
    'One page rendering @evanion/react-widget as an async React Server Component that fetches its own data.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={`${title.variable} ${text.variable}`} lang="en">
      <body>{children}</body>
    </html>
  );
}
