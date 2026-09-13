import { Text, Title } from '@evanion/baize-ui';

import { Widgets, items } from './widgets';

/**
 * The page fetches nothing and is deliberately not `async`. It renders one
 * widget region and the three widgets in it go and get their own data, each
 * inside the `<Suspense>` boundary the renderer puts around every item, so the
 * shell flushes before shop-api answers any of them.
 */
export default function Home() {
  return (
    <main className="page">
      <Title as="h1" size="xl">
        Baize
      </Title>
      {/* Wrapped rather than given a class: no component in the library takes
          one, so the space around a passage is the page's to set. */}
      <div className="lede">
        <Text measured>
          One page, one widget region. Each widget below is an async Server
          Component that fetches its own data from shop-api during render. The
          data and the fetches are server-side; neither is in the JavaScript
          this page sends.
        </Text>
      </div>
      <Widgets items={items} />
    </main>
  );
}
