import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createFeatures,
  parseFeatureConfig,
  serializeConfig,
} from '@evanion/feature';
import { createFeatureContext, FeatureProvider, useFeature } from './index.js';
import type {
  DecisionSet,
  DivergenceObserver,
  DivergenceReport,
} from '@evanion/feature';

/**
 * The input classes the provider answers at its edges.
 *
 * `adoptDecisions` in `@evanion/feature` runs the version check, the
 * sufficiency check and the comparison, and `adopt.spec.ts` there holds their
 * cases. This file holds what the provider adds around that call: the
 * `NODE_ENV` read it passes as `compare`, in production, in a runtime that
 * defines no `process` and in one whose `process` carries no `env`; the
 * observer it installs and the render it delivers to; the memo across
 * re-renders; a key the shipped set does not name; and the bound provider,
 * which the shared one's cases never mount.
 */

/** A split with two variants, which a document states in full. */
const SPLIT = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ],
  },
] as const;

/** The schema `parseFeatureConfig` builds the split's store at. */
type Split = { cta: { variant: 'control' | 'blue' } };

/** A split and a flag, so a partial set can drop one of the two. */
const PAIR = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ],
  },
  { key: 'banner', enabled: true },
] as const;

/** The schema `parseFeatureConfig` builds the pair's store at. */
type Pair = { cta: { variant: 'control' | 'blue' }; banner: never };

/** A split that buckets on a field of its own, whose control is not first. */
const CUSTOM = [
  {
    key: 'cta',
    enabled: true,
    variantBy: 'accountId',
    variants: [
      { name: 'blue', weight: 50, order: 1 },
      { name: 'green', weight: 50, order: 0 },
    ],
  },
] as const;

function storeAt(version: string) {
  const parsed = parseFeatureConfig<Split>(
    serializeConfig(createFeatures(SPLIT), { version }),
  );
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.features;
}

function pairAt(version: string) {
  const parsed = parseFeatureConfig<Pair>(
    serializeConfig(createFeatures(PAIR), { version }),
  );
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.features;
}

function Cta() {
  return <span data-testid="cta">{useFeature('cta').variant}</span>;
}

function Banner() {
  return (
    <span data-testid="banner">{String(useFeature('banner').enabled)}</span>
  );
}

/** The set a store at `version` ships, with `cta` assigned the other variant. */
function shippedBlue(version: string) {
  const shipped = storeAt(version).snapshot({ targetingKey: 'u-9' });
  return {
    ...shipped,
    decisions: { cta: { ...shipped.decisions.cta, variant: 'blue' as const } },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('FeatureProvider', () => {
  it('renders the shipped answer where its own store resolves another one', () => {
    // Both documents declare one split and differ in their version alone, so
    // the two stores assign `u-9` the same variant and a provider that quietly
    // resolved locally would render what the server sent. The override is what
    // separates the two answers.
    render(
      <FeatureProvider
        features={storeAt('v2')}
        decisions={shippedBlue('v1')}
        context={{ targetingKey: 'u-9' }}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('blue');
  });

  it('throws for a key the shipped set does not name', () => {
    const store = pairAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const partial = {
      ...shipped,
      decisions: { cta: shipped.decisions.cta },
    } as unknown as DecisionSet<Pair>;

    expect(() =>
      render(
        <FeatureProvider
          features={store}
          decisions={partial}
          context={{ targetingKey: 'u-9' }}
        >
          <Banner />
        </FeatureProvider>,
      ),
    ).toThrow(/banner/);
  });

  it('runs no diff in a runtime that defines no process global', () => {
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const reports: DivergenceReport[] = [];
    // A runtime that answers neither half of the read is as often a served
    // production page as a developer's machine, and the diff's second
    // resolution is the cost § 4 keeps out of production.
    vi.stubGlobal('process', undefined);

    try {
      render(
        <FeatureProvider
          features={store}
          decisions={{
            ...shipped,
            decisions: {
              cta: { ...shipped.decisions.cta, reason: 'rule-match' },
            },
          }}
          context={{ targetingKey: 'u-9' }}
          onDivergence={(report) => reports.push(report)}
        >
          <Cta />
        </FeatureProvider>,
      );
    } finally {
      vi.unstubAllGlobals();
    }

    expect(reports).toEqual([]);
  });

  it('renders in a runtime that defines no process global', () => {
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const reports: DivergenceReport[] = [];
    // The package ships as plain ESM, so a browser loading it through an
    // import map holds no `process` and a shim may hold one with no `env`.
    vi.stubGlobal('process', undefined);

    try {
      render(
        <FeatureProvider
          features={store}
          decisions={shipped}
          context={{ targetingKey: 'u-9' }}
          // The guard sits behind `observer !== undefined`, so a provider
          // mounted without an observer never reaches the read this case is
          // about.
          onDivergence={(report) => reports.push(report)}
        >
          <Cta />
        </FeatureProvider>,
      );
    } finally {
      vi.unstubAllGlobals();
    }

    expect(reports).toEqual([]);
    expect(screen.getByTestId('cta')).toHaveTextContent(
      String(shipped.decisions.cta.variant),
    );
  });

  it('renders in a runtime whose process carries no env', () => {
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const reports: DivergenceReport[] = [];
    vi.stubGlobal('process', {});

    try {
      render(
        <FeatureProvider
          features={store}
          decisions={shipped}
          context={{ targetingKey: 'u-9' }}
          onDivergence={(report) => reports.push(report)}
        >
          <Cta />
        </FeatureProvider>,
      );
    } finally {
      vi.unstubAllGlobals();
    }

    expect(reports).toEqual([]);
    expect(screen.getByTestId('cta')).toHaveTextContent(
      String(shipped.decisions.cta.variant),
    );
  });

  it('emits no resolve event for an observed store with no observer installed', () => {
    const events: string[] = [];
    const store = createFeatures(SPLIT, {
      observe: (event) => {
        events.push(event.type);
      },
    });
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const produced = events.length;

    render(
      <FeatureProvider
        features={store}
        decisions={shipped}
        context={{ targetingKey: 'u-9' }}
      >
        <Cta />
      </FeatureProvider>,
    );

    // Nothing reads a development resolution here, and the event it emits
    // names decisions this provider never publishes.
    expect(events).toHaveLength(produced);
  });

  it('renders through every check it runs with no observer installed', () => {
    const store = createFeatures(CUSTOM);
    const shipped = store.snapshot({ accountId: 'a-1' });

    render(
      <FeatureProvider
        features={store}
        decisions={{
          ...shipped,
          decisions: {
            cta: { ...shipped.decisions.cta, variant: 'blue' as const },
          },
        }}
        context={{}}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('blue');
  });

  it('keeps reporting after an observer throws', () => {
    const store = createFeatures(CUSTOM);
    const shipped = store.snapshot({ accountId: 'a-1' });
    const seen: DivergenceReport['kind'][] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={{
          ...shipped,
          decisions: {
            cta: { ...shipped.decisions.cta, variant: 'blue' as const },
          },
        }}
        context={{}}
        onDivergence={(report) => {
          seen.push(report.kind);
          throw new Error('observer');
        }}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(seen).toHaveLength(3);
    expect(new Set(seen)).toEqual(
      new Set(['unversioned', 'missing-field', 'decision-differs']),
    );
  });

  it('names the missing context field under NODE_ENV production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const store = storeAt('v1');
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={store.snapshot({ targetingKey: 'u-9' })}
        context={{}}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(
      reports.filter((report) => report.kind === 'missing-field'),
    ).toMatchObject([{ key: 'cta', field: 'targetingKey' }]);
  });

  it('reports the two versions under NODE_ENV production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={storeAt('v2')}
        decisions={shippedBlue('v1')}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(reports.map((report) => report.kind)).toEqual(['config-version']);
  });

  it('renders what it resolves itself under re-resolve in NODE_ENV production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    render(
      <FeatureProvider
        features={storeAt('v2')}
        decisions={shippedBlue('v1')}
        context={{ targetingKey: 'u-9' }}
        onVersionMismatch="re-resolve"
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('control');
  });

  it('runs no diff under re-resolve with an observer in NODE_ENV production', () => {
    // The one production input class that resolves locally and holds an
    // observer to report to. `'re-resolve'` resolves for what it publishes,
    // and the development diff reads the same resolution, so the production
    // gate is the only thing between the two.
    vi.stubEnv('NODE_ENV', 'production');
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={storeAt('v2')}
        decisions={shippedBlue('v1')}
        context={{ targetingKey: 'u-9' }}
        onVersionMismatch="re-resolve"
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    // The two sides differ on `cta`: the set ships `blue` and this store
    // resolves `control`, which is a `'decision-differs'` report in
    // development and nothing here.
    expect(screen.getByTestId('cta')).toHaveTextContent('control');
    expect(reports.map((report) => report.kind)).toEqual(['config-version']);
  });

  it('reports once across a re-render that writes a new observer', () => {
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const context = {};
    const reports: DivergenceReport[] = [];
    // An observer prop written inline, which a parent re-rendering on a
    // keystroke hands the provider as a new function every time.
    const tree = () => (
      <FeatureProvider
        features={store}
        decisions={shipped}
        context={context}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>
    );

    const { rerender } = render(tree());
    const mounted = reports.length;
    rerender(tree());
    rerender(tree());

    expect(mounted).toBe(1);
    expect(reports).toHaveLength(mounted);
  });

  it('reports again when a re-render changes the context', () => {
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const reports: DivergenceReport[] = [];
    const observe = (report: DivergenceReport) => reports.push(report);
    const tree = (context: Record<string, unknown>) => (
      <FeatureProvider
        features={store}
        decisions={shipped}
        context={context}
        onDivergence={observe}
      >
        <Cta />
      </FeatureProvider>
    );

    const { rerender } = render(tree({}));
    // A context identity the provider has not resolved yet, which is an input
    // the checks have to read again.
    rerender(tree({}));

    expect(reports).toHaveLength(2);
  });

  it('publishes the set a re-render hands it', () => {
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const context = { targetingKey: 'u-9' };
    const { rerender } = render(
      <FeatureProvider features={store} decisions={shipped} context={context}>
        <Cta />
      </FeatureProvider>,
    );

    rerender(
      <FeatureProvider
        features={store}
        decisions={{
          ...shipped,
          decisions: {
            cta: { ...shipped.decisions.cta, variant: 'blue' as const },
          },
        }}
        context={context}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('blue');
  });

  it('publishes what it resolves when a re-render changes the policy', () => {
    const store = storeAt('v2');
    const shipped = shippedBlue('v1');
    const context = { targetingKey: 'u-9' };
    const { rerender } = render(
      <FeatureProvider features={store} decisions={shipped} context={context}>
        <Cta />
      </FeatureProvider>,
    );

    rerender(
      <FeatureProvider
        features={store}
        decisions={shipped}
        context={context}
        onVersionMismatch="re-resolve"
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('control');
  });
  it('delivers to an observer installed after the mount', () => {
    const store = createFeatures(SPLIT);
    // A store built from a literal carries no version, so every pass of the
    // checks sends exactly one report.
    const shipped = {
      ...store.snapshot({ targetingKey: 'u-9' }),
      version: 'v1',
    };
    const seen: DivergenceReport[] = [];
    // One context identity across both renders, so the observer's arrival is
    // the only input the checks read that changed. A fresh literal each render
    // recomputes the pass for the context and reports whether the provider
    // reads the observer's presence or not.
    const context = { targetingKey: 'u-9' };
    // A gate an application opens once consent lands, or a reporter it
    // imports lazily.
    const tree = (onDivergence?: DivergenceObserver) => (
      <FeatureProvider
        features={store}
        decisions={shipped}
        context={context}
        onDivergence={onDivergence}
      >
        <Cta />
      </FeatureProvider>
    );

    const { rerender } = render(tree());
    rerender(tree((report) => seen.push(report)));

    expect(seen.map((report) => report.kind)).toEqual(['unversioned']);
  });

  it('delivers to the observer the last render installed', () => {
    const store = createFeatures(SPLIT);
    const shipped = {
      ...store.snapshot({ targetingKey: 'u-9' }),
      version: 'v1',
    };
    const first: DivergenceReport[] = [];
    const second: DivergenceReport[] = [];
    // A fresh context identity each render, which is an input the checks read
    // again.
    const tree = (onDivergence: DivergenceObserver) => (
      <FeatureProvider
        features={store}
        decisions={shipped}
        context={{ targetingKey: 'u-9' }}
        onDivergence={onDivergence}
      >
        <Cta />
      </FeatureProvider>
    );

    const { rerender } = render(tree((report) => first.push(report)));
    rerender(tree((report) => second.push(report)));

    expect(first.map((report) => report.kind)).toEqual(['unversioned']);
    expect(second.map((report) => report.kind)).toEqual(['unversioned']);
  });
});

describe('createFeatureContext', () => {
  it('publishes the shipped set through the bound provider', () => {
    const bound = createFeatureContext(storeAt('v1'));

    render(
      <bound.FeatureProvider
        decisions={shippedBlue('v1')}
        context={{ targetingKey: 'u-9' }}
      >
        <Cta />
      </bound.FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('blue');
  });

  it('reports the two versions through the bound provider', () => {
    const bound = createFeatureContext(storeAt('v1'));
    const reports: DivergenceReport[] = [];

    render(
      <bound.FeatureProvider
        decisions={shippedBlue('v2')}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </bound.FeatureProvider>,
    );

    expect(
      reports.filter((report) => report.kind === 'config-version'),
    ).toMatchObject([{ shipped: { version: 'v2' }, local: { version: 'v1' } }]);
  });

  it('compares the substituted store version and not the factory store one', () => {
    const bound = createFeatureContext(storeAt('v1'));
    const reports: DivergenceReport[] = [];

    render(
      <bound.FeatureProvider
        features={storeAt('v2')}
        decisions={storeAt('v2').snapshot({ targetingKey: 'u-9' })}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </bound.FeatureProvider>,
    );

    expect(reports).toEqual([]);
  });

  it('renders the shipped set through the bound provider on a mismatch', () => {
    // The bound provider states no policy of its own, so this holds the
    // default both providers answer a mismatch with.
    const bound = createFeatureContext(storeAt('v2'));

    render(
      <bound.FeatureProvider
        decisions={shippedBlue('v1')}
        context={{ targetingKey: 'u-9' }}
      >
        <Cta />
      </bound.FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('blue');
  });

  it('renders what the bound provider resolves itself under re-resolve', () => {
    const bound = createFeatureContext(storeAt('v2'));

    render(
      <bound.FeatureProvider
        decisions={shippedBlue('v1')}
        context={{ targetingKey: 'u-9' }}
        onVersionMismatch="re-resolve"
      >
        <Cta />
      </bound.FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('control');
  });
});
