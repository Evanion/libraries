import { useMDXComponents as getThemeComponents } from 'nextra-theme-docs';
import AccessDemo from './components/landing/AccessDemo';
import ComposeSpecimen from './components/landing/ComposeSpecimen';
import DataDemo from './components/landing/DataDemo';
import LuhnSpecimen from './components/landing/LuhnSpecimen';
import TokenSpecimen from './components/landing/TokenSpecimen';
import UrnSpecimen from './components/landing/UrnSpecimen';
import Probe from './components/Probe';
import Diagram from './components/diagram/Diagram';
import Listing from './components/listing/Listing';
import WidgetPlayground from './components/WidgetPlayground';
import PlaygroundExamples from './components/PlaygroundExamples';
import PageSheet from './components/PageSheet';
import WorkshopNotice from './components/WorkshopNotice';
import './components/landing/landing.css';
import {
  Button,
  ButtonLink,
  Card,
  CardGrid,
  CardGridCell,
  Chip,
  Panel,
  SectionHeader,
  Stat,
  StatLine,
  TagRow,
  Text,
  Title,
} from '@evanion/baize-ui';

const themeComponents = getThemeComponents();

/**
 * The component map every MDX page is compiled against.
 *
 * Nextra resolves this by convention: the file has to sit at the app root and
 * export `useMDXComponents`, and `app/[[...mdxPath]]/page.tsx` reads `wrapper`
 * off the same map. The components listed here are what an `.mdx` page may use
 * as a JSX tag without importing anything.
 *
 * `components` is spread over the theme's own map and under the app's own
 * components, so a caller can override a theme element and cannot shadow one of
 * these with it.
 *
 * The five landing specimens are here for decision 20 of
 * `docs/specs/2026-09-16-documentation-standard.md` § 9: a control a reader can
 * operate belongs both on the front page, where it sells the package, and on
 * the section's demonstration page, where the reader has the explanation around
 * it. They are the same components the landing page renders, so there is one of
 * each and one test. `landing.css` is imported beside them because the landing
 * page imports it for itself and a specimen mounted anywhere else would arrive
 * unstyled.
 *
 * The `@evanion/baize-ui` primitives are here rather than imported per page
 * because that is what makes them available to a page that only writes MDX, and
 * the design system is the site's, not one page's. They are stateless and render
 * class names, so they cost a page that does not use them nothing. The ones with
 * shop vocabulary in their props -- the mechanism tag, the availability pill, the
 * box art -- are left out: this site sells nothing.
 */
export function useMDXComponents(components) {
  return {
    ...themeComponents,
    ...components,
    Button,
    ButtonLink,
    Card,
    CardGrid,
    CardGridCell,
    Chip,
    Panel,
    SectionHeader,
    Stat,
    StatLine,
    TagRow,
    Text,
    Title,
    Probe,
    // Not a tag an author writes: `tools/remark-diagram.mjs` rewrites a
    // ```mermaid fence into one, and the name has to be on this map for the
    // rewritten element to resolve to anything.
    Diagram,
    // Not a tag an author writes either: `tools/mdx-listing-loader.mjs` wraps a
    // fence carrying one of documentation standard § 5's exemption tags in one.
    Listing,
    PageSheet,
    WorkshopNotice,
    WidgetPlayground,
    PlaygroundExamples,
    AccessDemo,
    ComposeSpecimen,
    DataDemo,
    LuhnSpecimen,
    TokenSpecimen,
    UrnSpecimen,
  };
}
