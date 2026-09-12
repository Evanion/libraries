import { useMDXComponents as getThemeComponents } from 'nextra-theme-docs';
import WidgetPlayground from './components/WidgetPlayground';
import PlaygroundExamples from './components/PlaygroundExamples';

const themeComponents = getThemeComponents();

/**
 * The component map every MDX page is compiled against.
 *
 * Nextra resolves this by convention: the file has to sit at the app root and
 * export `useMDXComponents`, and `app/[[...mdxPath]]/page.tsx` reads `wrapper`
 * off the same map. The components listed here are what an `.mdx` page may use
 * as a JSX tag without importing anything.
 *
 * `components` is spread over the theme's own map and under the playground
 * components, so a caller can override a theme element and cannot shadow a
 * playground with one.
 */
export function useMDXComponents(components) {
  return {
    ...themeComponents,
    ...components,
    WidgetPlayground,
    PlaygroundExamples,
  };
}
