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
 * A source file, so `Shelf` is a component the test can import and render. The
 * README's regions carry the `// -> value` claims the other react-widget pages
 * show; a region here cannot, because the claim rewriter reads README fences
 * and JSDoc blocks only.
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
const { Widgets } = createWidgets({
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
