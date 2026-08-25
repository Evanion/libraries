import './global.css';
import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import 'nextra-theme-docs/style.css';
import { PropsWithChildren } from 'react';

export const metadata = {
  title: {
    default: 'Evanion Libraries',
    template: '%s | Evanion Libraries',
  },
  description:
    'Documentation for the Evanion open source libraries: compose, urn and react-widget.',
  metadataBase: new URL('https://docs.evanion.com'),
};

const navbar = (
  <Navbar
    logo={<b>Evanion Libraries</b>}
    projectLink="https://github.com/Evanion/libraries"
  />
);
const footer = (
  <Footer>MIT {new Date().getFullYear()} © Mikael Pettersson.</Footer>
);

export default async function RootLayout({ children }: PropsWithChildren) {
  return (
    <html
      // Not required, but good for SEO
      lang="en"
      // Required to be set
      dir="ltr"
      // Suggested by `next-themes` package https://github.com/pacocoursey/next-themes#with-app
      suppressHydrationWarning
    >
      <Head
      // ... Your additional head options
      >
        {/* Your additional tags should be passed as `children` of `<Head>` element */}
      </Head>
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/Evanion/libraries/tree/main/apps/docs"
          footer={footer}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
