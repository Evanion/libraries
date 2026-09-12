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
      <h1 className="masthead">Baize</h1>
      <p className="lede">
        One page, one widget region. Each widget below is an async Server
        Component that fetches its own data from shop-api during render. The
        data and the fetches are server-side; neither is in the JavaScript this
        page sends.
      </p>
      <Widgets items={items} />
    </main>
  );
}
