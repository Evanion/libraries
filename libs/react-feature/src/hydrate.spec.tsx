import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createFeatures,
  parseFeatureConfig,
  serializeConfig,
} from '@evanion/feature';
import { FeatureProvider, useFeature } from './index.js';
import type { DivergenceReport, FeatureConfig } from '@evanion/feature';

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

function Cta() {
  const decision = useFeature('cta');
  return <span data-testid="cta">{decision.variant}</span>;
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

  it('runs the decision diff outside NODE_ENV production', () => {
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
