import { Text } from '@evanion/baize-ui';
import { createWidgets } from '@evanion/react-widget';
import { Activity } from './activity';
import { Catalogue } from './catalogue';
import { Spotlight } from './spotlight';

/**
 * The app's widget registry, called at module scope as the package requires:
 * there is no provider to call it inside, because React's `react-server`
 * condition has no createContext.
 *
 * All three components are async Server Components that fetch their own data.
 * The `suspenseFallback` is what each of them is replaced by until its own
 * awaits resolve -- the renderer puts a `<Suspense>` boundary around every item
 * rather than one around the region, so a slow widget holds up only itself.
 *
 * `@evanion/react-widget` resolves here through its `import` condition to the
 * package's built `dist/`, the way a published consumer resolves it. The app's
 * tsconfig sets `customConditions: []` to keep the type side on the same file.
 */
export const { Widgets, defineItems } = createWidgets({
  components: {
    spotlight: Spotlight,
    catalogue: Catalogue,
    activity: Activity,
  },
  chrome: {
    suspenseFallback: <Text tone="moss">Asking shop-api…</Text>,
  },
});

/**
 * The region's items. `props` carries presentation and identity only -- a
 * heading, a urn. No catalogue, no stock, no telemetry: each widget awaits its
 * own, which is the whole point of this app. The props are still checked
 * against each component.
 */
export const items = defineItems([
  { id: 'spotlight', type: 'spotlight', props: { urn: 'urn:game:wingspan' } },
  { id: 'catalogue', type: 'catalogue', props: { heading: 'On the table' } },
  { id: 'activity', type: 'activity', props: { heading: 'Asked of shop-api' } },
]);
