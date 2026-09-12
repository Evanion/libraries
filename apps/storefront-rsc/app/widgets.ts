import { createWidgets } from '@evanion/react-widget';
import { Catalogue } from './catalogue';

/**
 * The app's widget set. One component, called at module scope as the package
 * requires: there is no provider to call it inside, because React's
 * `react-server` condition has no createContext.
 *
 * `@evanion/react-widget` resolves here through its `import` condition to the
 * package's built `dist/`, the way a published consumer resolves it. The app's
 * tsconfig sets `customConditions: []` to keep the type side on the same file.
 */
export const { Widgets, defineItems } = createWidgets({
  components: { catalogue: Catalogue },
});

/**
 * The page's items. `props` carries presentation only -- no catalogue, no urns,
 * nothing fetched. The widget awaits its own data, which is the whole point of
 * this app, and `heading` is still checked against the component's props.
 */
export const items = defineItems([
  { id: 'catalogue', type: 'catalogue', props: { heading: 'On the table' } },
]);
