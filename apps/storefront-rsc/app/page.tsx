import { Widgets, items } from './widgets';

/**
 * The page fetches nothing and is deliberately not `async`. It renders the
 * widget set and the widget goes and gets the catalogue itself, inside the
 * `<Suspense>` boundary the renderer puts around every item, so the shell
 * flushes before shop-api answers.
 */
export default function Home() {
  return (
    <main className="page">
      <h1 className="masthead">Baize</h1>
      <p className="lede">
        One page, one widget. The widget below is an async Server Component that
        fetches the catalogue from shop-api during render. Its data and its
        fetch are server-side; neither is in the JavaScript this page sends.
      </p>
      <Widgets items={items} />
    </main>
  );
}
