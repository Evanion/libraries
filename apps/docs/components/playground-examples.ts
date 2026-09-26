/**
 * The snippets the tab strip switches between.
 *
 * Each `code` string is handed to react-live in `noInline` mode, so it ends in a
 * `render(...)` call and may only use names from `playgroundScope`. An import, or
 * a name that is not there, surfaces as a runtime error in the preview pane
 * rather than at build time -- nothing typechecks these strings, so
 * `playground-examples.test.tsx` evaluates every one of them instead.
 *
 * Each one is set in Baize, the board game shop every docs example uses, so a
 * reader who met a listing card on the React Widget pages meets the same card
 * here.
 *
 * A module of its own rather than a constant inside PlaygroundExamples, so that
 * test reaches the shipped snippets without rendering the playground.
 */
export const examples = {
  shelf: {
    title: 'A shelf of listings',
    code: `const ListingCard = ({ title, price }) => (
  <article className="border border-gray-300 dark:border-gray-600 p-4 my-2 rounded-lg bg-white dark:bg-gray-800">
    <h3 className="mb-2 text-gray-900 dark:text-gray-100 font-semibold">{title}</h3>
    <p className="text-gray-700 dark:text-gray-300">{price} kr</p>
  </article>
);

const TableBooking = ({ tables, tonight }) => (
  <div className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg my-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
    {tables} tables free {tonight ? 'tonight' : 'this week'}
  </div>
);

const { Widgets } = createWidgets({
  components: {
    listing: ListingCard,
    booking: TableBooking,
  },
});

const items = [
  { id: 'booking', type: 'booking', props: { tables: 4, tonight: true } },
  { id: 'brass', type: 'listing', props: { title: 'Brass: Birmingham', price: 649 } },
  { id: 'wingspan', type: 'listing', props: { title: 'Wingspan', price: 549 } },
];

render(<Widgets items={items} />)`,
  },

  newIn: {
    title: 'New in, nested',
    code: `const Shelf = ({ title, children }: { title: string; children?: React.ReactNode }) => (
  <section className="p-5 bg-gray-50 dark:bg-gray-900 rounded-lg my-2">
    <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
    <div className="flex flex-wrap gap-2">{children}</div>
  </section>
);

const ListingCard = ({ title, price }: { title: string; price: number }) => (
  <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800 max-w-xs">
    <h4 className="mb-2 text-gray-900 dark:text-gray-100 font-semibold">{title}</h4>
    <p className="font-bold text-blue-600 dark:text-blue-400">{price} kr</p>
  </div>
);

const { Widgets } = createWidgets({
  components: {
    shelf: Shelf,
    listing: ListingCard,
  },
  chrome: {
    wrapper: ({ children }) => (
      <div className="p-2">
        <header className="mb-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
          New in at Baize
        </header>
        {children}
      </div>
    ),
  },
});

const items = [
  {
    id: 'new-in',
    type: 'shelf',
    props: { title: 'On the table tonight' },
    children: [
      { id: 'spirit-island', type: 'listing', props: { title: 'Spirit Island', price: 799 } },
      { id: 'hive', type: 'listing', props: { title: 'Hive', price: 299 } },
    ],
  },
];

render(<Widgets items={items} />)`,
  },

  counter: {
    title: 'At the counter',
    code: `const Figure = ({ label, value }: { label: string; value: string }) => (
  <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 m-2 min-w-48 text-center">
    <h4 className="mb-2 text-gray-900 dark:text-gray-100 font-semibold">{label}</h4>
    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{value}</div>
  </div>
);

const { Widgets } = createWidgets({
  components: { figure: Figure },
  chrome: {
    wrapper: ({ children }) => (
      <div className="p-5 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <h2 className="text-center mb-5 text-xl font-bold text-gray-900 dark:text-gray-100">
          Baize at the counter
        </h2>
        <div className="flex flex-wrap justify-center gap-2">{children}</div>
      </div>
    ),
  },
});

const items = [
  { id: 'tables', type: 'figure', props: { label: 'Tables booked tonight', value: '3 of 4' } },
  { id: 'orders', type: 'figure', props: { label: 'Orders to pick up', value: '7' } },
  { id: 'library', type: 'figure', props: { label: 'Games in the library', value: '300' } },
];

render(<Widgets items={items} />)`,
  },
};
