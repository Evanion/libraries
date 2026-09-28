import { SkipNavContent } from 'nextra/components';
import { items } from '../../components/landing/items';
import { Widgets } from '../../components/landing/region';
import '../../components/landing/landing.css';

export const metadata = {
  // Absolute, so the tab does not read "Evanion Libraries | Evanion Libraries".
  title: { absolute: 'Evanion Libraries' },
  description:
    'Small TypeScript libraries, one problem each: rendering from data, authorization from one policy, identifiers and codes, and three that stand on their own.',
};

/**
 * The landing page.
 *
 * Not an MDX document: it renders inside Nextra's `Layout` -- the navbar, the
 * search, the theme -- and outside its article frame, so it carries no sidebar,
 * no breadcrumb, no table of contents and no prev/next footer. Those are what a
 * document has, and this page is an index.
 *
 * The page is a `@evanion/react-widget` region. Every section is an item in
 * `items`, placed by `meta`, rendered by the component its `type` names in
 * `region.tsx`. That is not decoration: the widget libraries are the flagship
 * here, and a reader looking at this page is looking at one of them working.
 * The "Rendering from data" section says so, beside a demo built the same way
 * whose items a reader can edit.
 *
 * `SkipNavContent` is the target the theme's skip link points at. The article
 * frame renders it for a document; here the page renders it itself.
 */
export default function Page() {
  return (
    <>
      <SkipNavContent />
      <Widgets items={items} />
    </>
  );
}
