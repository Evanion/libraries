import { useMDXComponents as getThemeComponents } from 'nextra-theme-docs';
import WidgetPlayground from './components/WidgetPlayground';
import PlaygroundExamples from './components/PlaygroundExamples';
import WorkshopNotice from './components/WorkshopNotice';
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
    WorkshopNotice,
    WidgetPlayground,
    PlaygroundExamples,
  };
}
