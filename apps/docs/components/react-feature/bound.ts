import { createFeatures } from '@evanion/feature';
import { createFeatureContext } from '@evanion/react-feature';

/**
 * The store the demonstration page's `react-bound` fence builds.
 *
 * The same two variants at the same weights, so the control answers what that
 * region claims for the two customer ids it names. `provider.test.tsx` reads
 * the region and holds both answers to it, which is what keeps the control and
 * the fence above it one example.
 */
export const features = createFeatures([
  {
    key: 'checkout-cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
]);

/**
 * The provider and the hooks bound to that store.
 *
 * `createFeatureContext` is called once at module scope rather than inside the
 * component, because each call makes its own React context and a call per
 * render would publish to a context the hooks of the previous render read.
 */
export const { FeatureProvider, useFeature } = createFeatureContext(features);

/** The customer ids the region claims an answer for, in the order it writes them. */
export const documented = ['cust-0199', 'cust-0042'] as const;
