import { createWidgets } from '@evanion/react-widget';
import type { ReactNode } from 'react';

const Listing = (props: { title: string }) => <h3>{props.title}</h3>;

const Shelf = (props: { heading: string; children?: ReactNode }) => (
  <section>
    <h4>{props.heading}</h4>
    {props.children}
  </section>
);

/** The shop's renderer: the same `Widgets` a React app ships. */
export const { Widgets: Blocks } = createWidgets({
  components: { listing: Listing, shelf: Shelf },
});
