import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { FeatureConfigError } from './errors.js';
import { createFeatures } from './features.js';
import { parseFeatureConfig } from './parse.js';
import { serializeConfig } from './serialize.js';
import type { FeatureConfig } from './config.js';
import type { FeatureEvent } from './observe.js';
import type { Schema } from './types.js';

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

  it('states the version the decisions resolved under when an observer reloads', () => {
    let reload: ((document: FeatureConfig) => unknown) | undefined;
    const parsed = parseFeatureConfig(served('v1'), {
      observe: (event) => {
        if (event.type !== 'resolve') return;
        const pending = reload;
        reload = undefined;
        pending?.(
          serializeConfig(createFeatures([{ key: 'cta', enabled: false }]), {
            version: 'v2',
          }),
        );
      },
    });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    reload = (document) => parsed.features.reload(document);

    const set = parsed.features.snapshot({ targetingKey: 'u-4711' });

    expect(set.decisions.cta.enabled).toBe(true);
    expect(set.version).toBe('v1');
    expect(parsed.features.version).toBe('v2');
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
  it('carries a version the document states as the number zero', () => {
    const parsed = parseFeatureConfig(
      serializeConfig(createFeatures(SPLIT), { version: 0 }),
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));

    expect(parsed.features.snapshot().version).toBe(0);
  });

  it('carries a version the document states as the empty string', () => {
    const parsed = parseFeatureConfig(
      serializeConfig(createFeatures(SPLIT), { version: '' }),
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));

    expect('version' in parsed.features.snapshot()).toBe(true);
  });

  it('keeps a numeric version a number', () => {
    const parsed = parseFeatureConfig(
      serializeConfig(createFeatures(SPLIT), { version: 7 }),
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));

    expect(parsed.features.snapshot().version).toBe(7);
  });

  it('states the version a reload installed', () => {
    const parsed = parseFeatureConfig(served('v1'));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const accepted = parsed.features.reload(served('v2'));

    expect(accepted.ok).toBe(true);
    expect(parsed.features.snapshot().version).toBe('v2');
  });

  it('keeps the version it held when a reload is refused', () => {
    const parsed = parseFeatureConfig(served('v1'));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const refused = parsed.features.reload({
      version: 'v2',
      features: [{ key: 'cta', enabled: true, dependsOn: ['absent'] }],
    });

    expect(refused.ok).toBe(false);
    expect(parsed.features.snapshot().version).toBe('v1');
  });

  it('resolves against the document a reload installed', () => {
    const parsed = parseFeatureConfig(
      serializeConfig(createFeatures([{ key: 'checkout', enabled: true }]), {
        version: 'v1',
      }),
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    parsed.features.reload(
      serializeConfig(createFeatures([{ key: 'checkout', enabled: false }]), {
        version: 'v2',
      }),
    );

    expect(parsed.features.snapshot().decisions.checkout.enabled).toBe(false);
  });

  it('holds an empty decision map for a store with no definitions', () => {
    const set = createFeatures([]).snapshot({
      now: new Date('2026-10-09T00:00:00Z'),
    });

    expect(set.decisions).toEqual({});
    expect(set.now).toBe('2026-10-09T00:00:00.000Z');
    expect(set.origin).toBe('render');
  });

  it('states a render origin for an options object naming none', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(features.snapshot({}, { origin: undefined }).origin).toBe('render');
  });

  it('states the render origin a caller names explicitly', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(features.snapshot({}, { origin: 'render' }).origin).toBe('render');
  });

  it('states the origin a caller names beside no context', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(features.snapshot(undefined, { origin: 'build' }).origin).toBe(
      'build',
    );
  });

  it('states each instant it is handed, not the first one', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(features.snapshot({ now: new Date(0) }).now).toBe(
      '1970-01-01T00:00:00.000Z',
    );
    expect(
      features.snapshot({ now: new Date('2000-01-02T03:04:05.006Z') }).now,
    ).toBe('2000-01-02T03:04:05.006Z');
  });

  it('states the largest instant a Date holds, in extended ISO 8601', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(
      features.snapshot({ now: new Date(8_640_000_000_000_000) }).now,
    ).toBe('+275760-09-13T00:00:00.000Z');
  });

  it('states the smallest instant a Date holds, in extended ISO 8601', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(
      features.snapshot({ now: new Date(-8_640_000_000_000_000) }).now,
    ).toBe('-271821-04-20T00:00:00.000Z');
  });

  it('reads the clock for a call that names no instant', () => {
    onTestFinished(() => {
      vi.useRealTimers();
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-04T05:06:07.008Z'));
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(features.snapshot().now).toBe('2026-03-04T05:06:07.008Z');
  });

  it('names the field when the context holds an instant no string describes', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    expect(() => features.snapshot({ now: new Date(Number.NaN) })).toThrow(
      FeatureConfigError,
    );
    expect(() => features.snapshot({ now: new Date(Number.NaN) })).toThrow(
      /context\/now/,
    );
  });

  it('reports nothing for the call it refuses that instant on', () => {
    const seen: FeatureEvent<Schema>[] = [];
    const features = createFeatures(SPLIT, {
      observe: (event) => {
        seen.push(event as FeatureEvent<Schema>);
      },
    });

    expect(() => features.snapshot({ now: new Date(Number.NaN) })).toThrow(
      FeatureConfigError,
    );
    expect(seen).toEqual([]);
  });

  it('assigns the control the other side of the band buckets to', () => {
    const features = createFeatures(SPLIT);

    expect(
      features.snapshot({ targetingKey: 'u-1' }).decisions.cta.variant,
    ).toBe('blue');
  });

  it('hands the observer the decisions the caller receives', () => {
    const seen: FeatureEvent<Schema>[] = [];
    const features = createFeatures(SPLIT, {
      observe: (event) => {
        seen.push(event as FeatureEvent<Schema>);
      },
    });

    const set = features.snapshot({ targetingKey: 'u-4711' });

    expect(seen[0]?.type).toBe('resolve');
    expect(seen[0] && 'decisions' in seen[0] && seen[0].decisions).toBe(
      set.decisions,
    );
  });

  it('names the instant the set states on the event it reports', () => {
    const seen: FeatureEvent<Schema>[] = [];
    const features = createFeatures(SPLIT, {
      observe: (event) => {
        seen.push(event as FeatureEvent<Schema>);
      },
    });

    const set = features.snapshot({ now: new Date('2026-05-06T07:08:09Z') });

    expect(seen[0]?.at.toISOString()).toBe(set.now);
  });

  it('reports the event version the options named and states none on the set', () => {
    const seen: FeatureEvent<Schema>[] = [];
    const features = createFeatures(SPLIT, {
      observe: (event) => {
        seen.push(event as FeatureEvent<Schema>);
      },
      version: 'ev-1',
    });

    const set = features.snapshot({ targetingKey: 'u-4711' });

    expect(seen[0]?.version).toBe('ev-1');
    expect('version' in set).toBe(false);
  });

  it('answers a set though the observer raises out of the callback', () => {
    const failures: unknown[] = [];
    const features = createFeatures(SPLIT, {
      observe: () => {
        throw new Error('boom');
      },
      onObserveError: (error) => {
        failures.push(error);
      },
    });

    const set = features.snapshot({ targetingKey: 'u-4711' });

    expect(set.decisions.cta.variant).toBe('control');
    expect(failures).toHaveLength(1);
  });

  it('freezes nothing for a store carrying no observer', () => {
    const features = createFeatures(SPLIT, {});

    expect(Object.isFrozen(features.snapshot({ targetingKey: 'u-4711' }))).toBe(
      false,
    );
  });

  it('freezes every decision a store carrying an observer answers', () => {
    const features = createFeatures(SPLIT, { observe: () => undefined });

    const set = features.snapshot({ targetingKey: 'u-4711' });

    expect(Object.isFrozen(set.decisions)).toBe(true);
    expect(Object.isFrozen(set.decisions.cta)).toBe(true);
  });

  it('writes no instant onto the context a caller handed it', () => {
    const features = createFeatures(SPLIT);
    const context = Object.freeze({ targetingKey: 'u-4711' });

    const set = features.snapshot(context);

    expect(set.decisions.cta.variant).toBe('control');
    expect('now' in context).toBe(false);
  });

  it('answers a fresh set for every call', () => {
    const features = createFeatures(SPLIT);
    const context = { targetingKey: 'u-4711', now: new Date(0) };

    const first = features.snapshot(context);
    const second = features.snapshot(context);

    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });

  it('carries a feature keyed on a prototype member as an own property', () => {
    const features = createFeatures([
      { key: 'constructor', enabled: true },
      { key: '__proto__', enabled: false },
    ]);

    const set = features.snapshot();

    expect(Object.keys(set.decisions)).toEqual(['constructor', '__proto__']);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(set.decisions['__proto__']?.enabled).toBe(false);
  });
});
