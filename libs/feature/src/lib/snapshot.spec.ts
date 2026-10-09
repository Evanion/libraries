import { describe, expect, it } from 'vitest';

import { createFeatures } from './features.js';
import { parseFeatureConfig } from './parse.js';
import { serializeConfig } from './serialize.js';
import type { FeatureConfig } from './config.js';

const SPLIT = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
] as const;

/** The document a control plane at `version` serves, with every member stated. */
function served(version: string): FeatureConfig {
  return serializeConfig(createFeatures(SPLIT), { version });
}

describe('Features.snapshot', () => {
  it('carries the version the document it parsed states', () => {
    const parsed = parseFeatureConfig(served('v7'));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));

    const set = parsed.features.snapshot({
      now: new Date('2026-10-09T00:00:00Z'),
    });

    expect(set.version).toBe('v7');
  });

  it('states the instant it resolved at, as ISO 8601', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(
      features.snapshot({ now: new Date('2026-10-09T11:22:33.444Z') }).now,
    ).toBe('2026-10-09T11:22:33.444Z');
  });

  it('carries no version for a store built from a literal', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect('version' in features.snapshot()).toBe(false);
  });

  it('states a render origin when the caller names none', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(features.snapshot().origin).toBe('render');
  });

  it('states the origin a build-time caller names', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(features.snapshot({}, { origin: 'build' }).origin).toBe('build');
  });

  it('holds the decision resolve answers for the same context', () => {
    const features = createFeatures(SPLIT);
    const context = { targetingKey: 'u-4711' };

    expect(features.snapshot(context).decisions).toEqual(
      features.resolve(context),
    );
  });

  it('assigns the variant the subject buckets to', () => {
    const features = createFeatures(SPLIT);

    expect(
      features.snapshot({ targetingKey: 'u-4711' }).decisions.cta.variant,
    ).toBe('control');
  });

  it('reports one resolve event to a store that observes', () => {
    const seen: string[] = [];
    const features = createFeatures(SPLIT, {
      observe: (event) => {
        seen.push(event.type);
      },
    });

    features.snapshot({ targetingKey: 'u-4711' });

    expect(seen).toEqual(['resolve']);
  });

  it('freezes what a store carrying an observer answers', () => {
    const features = createFeatures(SPLIT, { observe: () => undefined });

    expect(Object.isFrozen(features.snapshot({ targetingKey: 'u-4711' }))).toBe(
      true,
    );
  });

  it('reads an explicit instant over the clock', () => {
    const features = createFeatures([
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            id: 'window',
            when: [
              { field: 'now', op: 'after', value: '2030-01-01T00:00:00Z' },
            ],
          },
        ],
      },
    ]);

    expect(
      features.snapshot({ now: new Date('2031-01-01T00:00:00Z') }).decisions
        .sale.enabled,
    ).toBe(true);
  });
});
