import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFeatures } from '@evanion/feature';
import {
  createFeatureContext,
  FeatureProvider,
  useFeature,
  useFeatureEnabled,
  useFeatures,
  useVariant,
} from './index.js';

/**
 * Every hook mounted with no provider above it, wide and bound.
 *
 * All eight read their decisions through one guard, and the message that guard
 * raises is the only line a developer sees in a browser console. It names the
 * package the provider comes from, because a tree missing a provider is most
 * often a tree whose author installed the core and not the adapter, and a
 * message naming `@evanion/feature` would send them to the wrong install.
 *
 * `react.spec.tsx` holds what the hooks answer under a provider, and one case
 * there holds `useFeatures` to raising at all. These hold the message, and
 * they hold it for each hook: `useFeatureEnabled` and `useVariant` read
 * through `useFeature`, so a refactor that gave either one its own context
 * read would raise somewhere else and no case there would notice.
 */

const MESSAGE =
  'useFeatures must be called inside a <FeatureProvider> (from @evanion/react-feature)';

const cta = createFeatures([
  {
    key: 'cta',
    enabled: true,
    variants: [{ name: 'only', weight: 1, value: { label: 'Buy' } }],
  },
]);

/** Mounts `read` with nothing above it and answers what it raised. */
function orphan(read: () => void): () => void {
  function Orphan() {
    read();
    return null;
  }

  return () => render(<Orphan />);
}

describe('a wide hook with no provider above it', () => {
  const hooks: readonly [string, () => void][] = [
    ['useFeatures', () => void useFeatures()],
    ['useFeature', () => void useFeature('cta')],
    ['useFeatureEnabled', () => void useFeatureEnabled('cta')],
    ['useVariant', () => void useVariant('cta')],
  ];

  it.each(hooks)(
    'raises from %s, naming the provider and the package',
    (_name, read) => {
      expect(orphan(read)).toThrow(MESSAGE);
    },
  );

  it('names the adapter and not the core, which carries no provider', () => {
    expect(orphan(() => void useFeatures())).toThrow(/@evanion\/react-feature/);
    expect(orphan(() => void useFeatures())).not.toThrow(
      /@evanion\/feature\/react/,
    );
  });
});

describe('a bound hook with no provider above it', () => {
  const bound = createFeatureContext(cta);

  const hooks: readonly [string, () => void][] = [
    ['useFeatures', () => void bound.useFeatures()],
    ['useFeature', () => void bound.useFeature('cta')],
    ['useFeatureEnabled', () => void bound.useFeatureEnabled('cta')],
    ['useVariant', () => void bound.useVariant('cta')],
  ];

  it.each(hooks)(
    'raises from %s, naming the provider and the package',
    (_name, read) => {
      expect(orphan(read)).toThrow(MESSAGE);
    },
  );
});

describe('a bound hook under the wrong provider', () => {
  it('raises under the package provider, which writes no bound context', () => {
    // The factory's provider writes both contexts and the package's writes
    // only the shared one, so a bound hook under a plain provider reads
    // nothing. Holding it to the same message keeps the two mistakes
    // indistinguishable to a reader, which they are: a provider the hook can
    // read is missing.
    const bound = createFeatureContext(cta);

    function Reader() {
      bound.useFeatures();
      return null;
    }

    expect(() =>
      render(
        <FeatureProvider features={cta} context={{ targetingKey: 'u' }}>
          <Reader />
        </FeatureProvider>,
      ),
    ).toThrow(MESSAGE);
  });

  it("raises under another factory's provider, because each call makes its own context", () => {
    const first = createFeatureContext(cta);
    const second = createFeatureContext(cta);

    function Reader() {
      first.useFeatures();
      return null;
    }

    expect(() =>
      render(
        <second.FeatureProvider context={{ targetingKey: 'u' }}>
          <Reader />
        </second.FeatureProvider>,
      ),
    ).toThrow(MESSAGE);
  });

  it("reads the package hooks under either factory's provider", () => {
    // The other direction, and it is not symmetric: both bound providers
    // publish to the shared context, so the package's own hooks work under
    // each one.
    const bound = createFeatureContext(cta);

    function Reader() {
      return <span>{String(useFeatureEnabled('cta'))}</span>;
    }

    expect(() =>
      render(
        <bound.FeatureProvider context={{ targetingKey: 'u' }}>
          <Reader />
        </bound.FeatureProvider>,
      ),
    ).not.toThrow();
  });
});
