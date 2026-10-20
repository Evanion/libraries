import { createWidgets } from '@evanion/react-widget';
import type { AnyWidgetItem, WidgetItem } from '@evanion/react-widget';
import type { ReactNode } from 'react';

const Listing = (props: { title: string }) => <h3>{props.title}</h3>;

const Shelf = (props: { heading: string; children?: ReactNode }) => (
  <section>
    <h4>{props.heading}</h4>
    {props.children}
  </section>
);

const components = { listing: Listing, shelf: Shelf };

const { Widgets } = createWidgets({ components });

/**
 * The shop's renderer, handed a saved page straight from the CMS.
 *
 * The payload is runtime JSON the compiler never saw, so it arrives as
 * `AnyWidgetItem[]` and is narrowed to the typed item list at this one
 * boundary, the way the react-widget "Checking a CMS payload" page does after
 * `validateItems`. The demo draws it unchecked on purpose: the renderer skips
 * what it cannot draw.
 */
export function Blocks({ items }: { items: AnyWidgetItem[] }) {
  return <Widgets items={items as WidgetItem<typeof components>[]} />;
}
