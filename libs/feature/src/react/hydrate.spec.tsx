import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createFeatures,
  parseFeatureConfig,
  serializeConfig,
} from '../index.js';
import { FeatureProvider, useFeature } from './index.js';
import type { DivergenceReport, FeatureConfig } from '../index.js';

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

/** The document a control plane at `version` serves, with every member stated. */
function served(version: string): FeatureConfig<'cta'> {
  return serializeConfig(createFeatures(SPLIT), { version });
}

function storeAt(version: string) {
  const parsed = parseFeatureConfig<{ cta: { variant: 'control' | 'blue' } }>(
    served(version),
  );
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.features;
}

const SALE = [
  {
    key: 'sale',
    enabled: true,
    rules: [
      {
        id: 'window',
        when: [{ field: 'now', op: 'after', value: '2030-01-01T00:00:00Z' }],
      },
    ],
  },
] as const;

function Cta() {
  const decision = useFeature('cta');
  return <span data-testid="cta">{decision.variant}</span>;
}

function Sale() {
  return <span data-testid="sale">{String(useFeature('sale').enabled)}</span>;
}

describe('FeatureProvider', () => {
  it('renders the shipped decisions when the two versions disagree', () => {
    const client = storeAt('v2');
    const shipped = storeAt('v1').snapshot({ targetingKey: 'u-9' });
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={client}
        decisions={shipped}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent(
      String(shipped.decisions.cta.variant),
    );
    expect(reports.map((report) => report.kind)).toEqual(['config-version']);
  });

  it('names both versions on the report it sends', () => {
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={storeAt('v2')}
        decisions={storeAt('v1').snapshot({ targetingKey: 'u-9' })}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(
      reports.find((report) => report.kind === 'config-version'),
    ).toMatchObject({ shipped: { version: 'v1' }, local: { version: 'v2' } });
  });

  it('renders what it resolves itself under re-resolve', () => {
    const shipped = storeAt('v1').snapshot({ targetingKey: 'u-9' });
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={storeAt('v2')}
        decisions={{
          ...shipped,
          decisions: { cta: { ...shipped.decisions.cta, variant: 'blue' } },
        }}
        context={{ targetingKey: 'u-9' }}
        onVersionMismatch="re-resolve"
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('control');
    expect(
      reports.filter((report) => report.kind === 'config-version'),
    ).toMatchObject([{ shipped: { version: 'v1' }, local: { version: 'v2' } }]);
  });

  it('renders the shipped set under re-resolve when neither side is versioned', () => {
    const store = createFeatures(SPLIT);
    const shipped = store.snapshot({ targetingKey: 'u-9' });

    render(
      <FeatureProvider
        features={store}
        decisions={{
          ...shipped,
          decisions: { cta: { ...shipped.decisions.cta, variant: 'blue' } },
        }}
        context={{ targetingKey: 'u-9' }}
        onVersionMismatch="re-resolve"
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('blue');
  });

  it('reports a set and a store that cannot be compared', () => {
    const literal = createFeatures([{ key: 'cta', enabled: true }]);
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={literal}
        decisions={literal.snapshot()}
        onDivergence={(report) => reports.push(report)}
      >
        <span />
      </FeatureProvider>,
    );

    expect(reports.map((report) => report.kind)).toEqual(['unversioned']);
  });

  it('sends no report when the two versions agree', () => {
    const store = storeAt('v1');
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={store.snapshot({ targetingKey: 'u-9' })}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(reports).toEqual([]);
  });

  it('resolves its own store when no set was shipped', () => {
    render(
      <FeatureProvider
        features={storeAt('v1')}
        context={{ targetingKey: 'u-9' }}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('control');
  });

  it('renders on through an onDivergence that throws', () => {
    render(
      <FeatureProvider
        features={storeAt('v2')}
        decisions={storeAt('v1').snapshot({ targetingKey: 'u-9' })}
        context={{ targetingKey: 'u-9' }}
        onDivergence={() => {
          throw new Error('observer');
        }}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toBeInTheDocument();
  });

  it('resolves locally at the instant a render-origin set carries', () => {
    const store = createFeatures(SALE);
    const shipped = store.snapshot({ now: new Date('2031-01-01T00:00:00Z') });
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={shipped}
        context={{}}
        onDivergence={(report) => reports.push(report)}
      >
        <Sale />
      </FeatureProvider>,
    );

    expect(shipped.origin).toBe('render');
    expect(screen.getByTestId('sale')).toHaveTextContent('true');
    expect(
      reports.filter((report) => report.kind === 'decision-differs'),
    ).toEqual([]);
  });

  it('resolves locally at its own clock for a build-origin set', () => {
    const store = createFeatures(SALE);
    const shipped = store.snapshot(
      { now: new Date('2031-01-01T00:00:00Z') },
      { origin: 'build' },
    );
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={shipped}
        context={{}}
        onDivergence={(report) => reports.push(report)}
      >
        <Sale />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('sale')).toHaveTextContent('true');
    expect(
      reports.filter((report) => report.kind === 'decision-differs'),
    ).toMatchObject([
      { key: 'sale', shipped: { enabled: true }, local: { enabled: false } },
    ]);
  });

  it('names the context field a shipped assignment bucketed on', () => {
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

    const missing = reports.find((report) => report.kind === 'missing-field');

    expect(missing?.field).toBe('targetingKey');
    expect(missing?.local).toEqual({ variant: 'control', source: 'fallback' });
  });

  it('names no field for a shipped decision that already fell back', () => {
    const store = storeAt('v1');
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={store.snapshot({})}
        context={{}}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(reports.filter((report) => report.kind === 'missing-field')).toEqual(
      [],
    );
  });

  it('names every key whose local answer differs from the shipped one', () => {
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={{
          ...shipped,
          decisions: { cta: { ...shipped.decisions.cta, enabled: false } },
        }}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(
      reports.filter((report) => report.kind === 'decision-differs'),
    ).toHaveLength(1);
  });

  it('names both sides of a decision that differs', () => {
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={{
          ...shipped,
          decisions: { cta: { ...shipped.decisions.cta, variant: 'blue' } },
        }}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(
      reports.find((report) => report.kind === 'decision-differs'),
    ).toMatchObject({
      key: 'cta',
      shipped: { variant: 'blue' },
      local: { variant: 'control' },
    });
  });

  it('runs no decision diff under NODE_ENV production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={{
          ...shipped,
          decisions: { cta: { ...shipped.decisions.cta, enabled: false } },
        }}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );
    vi.unstubAllEnvs();

    expect(
      reports.filter((report) => report.kind === 'decision-differs'),
    ).toEqual([]);
  });
});
