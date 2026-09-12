import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from '@react-router/dev/routes';

/**
 * The route tree, declared rather than inferred from filenames.
 *
 * `shell.tsx` is a pathless layout: it owns the session, the provider stack and
 * the page chrome, and it is the only route that loads them, so every page below
 * it gets them from one loader rather than four.
 */
export default [
  layout('./shell.tsx', [
    index('./routes/dashboard.tsx'),
    route('orders', './routes/orders.tsx'),
    ...prefix('shelf', [
      index('./routes/shelf.tsx'),
      route(':urn', './routes/title.tsx'),
    ]),
  ]),
] satisfies RouteConfig;
