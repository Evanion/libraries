/**
 * The shop page the `react-widget` pages render, as compiled source.
 *
 * `apps/docs/content/react-widget/*.mdx` cites the regions below through
 * `file=libs/react-widget/examples/listing.tsx region=…`, so what a reader
 * copies off a page is this file, character for character.
 * `src/documented-examples.test.tsx` renders each export and asserts the markup
 * the pages claim for it, which is what holds a listing to its own prose.
 *
 * The `// @jsx:` line is a Twoslash directive. The pages render these regions
 * as Twoslash fences, which compile them against Twoslash's own defaults --
 * classic JSX, which wants `React` in scope -- and the directive is what puts
 * the compiler on the automatic runtime this repo builds with. Twoslash strips
 * the line, so no reader sees it.
 *
 * A source file rather than README fences, which is decision 17 of the
 * documentation standard and the route `compose` took first: `vite-plugin-doctest`
 * wraps a markdown block in `if (import.meta.vitest)` and oxc hoists the
 * `react/jsx-runtime` import the JSX transform adds to the top of that block,
 * where the guard no longer covers it. Every fence on these pages is JSX, so
 * every one of them would fail.
 *
 * Outside `src/`, so `package.json`'s `files` never packs it and the library
 * build never reaches it: an example is documentation, not API.
 */
// #region catalogue
// @jsx: react-jsx
import { createWidgets } from '@evanion/react-widget';

const ListingCard = ({ title, price }: { title: string; price: number }) => (
  <article className="listing">
    <h3>{title}</h3>
    <p>{price} kr</p>
  </article>
);

const TableBooking = ({
  tables,
  tonight,
}: {
  tables: number;
  tonight: boolean;
}) => (
  <div className="booking">
    <span>{tables} tables</span>
    <span>{tonight ? 'tonight' : 'this week'}</span>
  </div>
);

// Call once, at module scope.
const { Widgets, defineItems } = createWidgets({
  components: { listing: ListingCard, booking: TableBooking },
  chrome: {
    wrapper: ({ children }) => <section className="shelf">{children}</section>,
  },
});

export function Shelf() {
  return (
    <Widgets
      items={[
        { id: 'b1', type: 'booking', props: { tables: 4, tonight: true } },
        {
          id: 'g1',
          type: 'listing',
          props: { title: 'Brass: Birmingham', price: 649 },
        },
      ]}
    />
  );
}
// #endregion catalogue

// #region typed-items
// @jsx: react-jsx
export const shelfItems = defineItems([
  { id: 'g1', type: 'listing', props: { title: 'Wingspan', price: 549 } },
  { id: 'b1', type: 'booking', props: { tables: 4, tonight: false } },
]);
// #endregion typed-items
