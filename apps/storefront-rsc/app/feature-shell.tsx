'use client';

import { useMemo, type ReactNode } from 'react';
import { parseFeatureConfig, type DecisionSet } from '@evanion/feature';
import { FeatureProvider } from '@evanion/react-feature';

import type { FeaturesDocument, ShopFlags } from './features';

/**
 * Mounts the provider over the client tree.
 *
 * This is the one client module in the app, and it exists because a `Features`
 * is closures over a frozen document and cannot be a prop. The server sends
 * the document, which is plain data, and this module builds its own store from
 * it. The decisions arrive as the set the server resolved, so what the client
 * renders is what the server rendered whatever this store would answer.
 *
 * `targetingKey` and `roles` are the fields the server's context carried. The
 * provider re-resolves the shipped set to check it, and a context missing the
 * field a rollout buckets on reports a divergence that is not one.
 */
export function FeatureShell({
  config,
  decisions,
  targetingKey,
  roles,
  children,
}: {
  config: FeaturesDocument['config'];
  decisions: DecisionSet<ShopFlags>;
  targetingKey: string;
  roles: string[];
  children: ReactNode;
}) {
  // #region client-provider
  const features = useMemo(() => {
    const parsed = parseFeatureConfig<ShopFlags>(config);
    if (!parsed.ok) {
      throw new Error('the server shipped a feature document it cannot read');
    }
    return parsed.features;
  }, [config]);
  const context = useMemo(
    () => ({ targetingKey, roles }),
    [targetingKey, roles],
  );

  return (
    <FeatureProvider
      features={features}
      context={context}
      decisions={decisions}
    >
      {children}
    </FeatureProvider>
  );
  // #endregion client-provider
}
