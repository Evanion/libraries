import { useMDXComponents as getThemeComponents } from 'nextra-theme-docs';
import WidgetPlayground from './components/WidgetPlayground';
import PlaygroundExamples from './components/PlaygroundExamples';

// Get the default MDX components
const themeComponents = getThemeComponents();

// Merge components
export function useMDXComponents(components) {
  return {
    ...themeComponents,
    ...components,
    WidgetPlayground,
    PlaygroundExamples,
  };
}
