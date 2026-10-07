import { describe, expect, it } from 'vitest';
import { createFeatures } from './features.js';
import { serializeConfig } from './serialize.js';
import type { FeatureConfig } from './config.js';

const start: FeatureConfig = {
  version: 41,
  features: [
    { key: 'checkout', enabled: true },
    { key: 'express', enabled: true, dependsOn: ['checkout'] },
  ],
};

describe('reload', () => {
  it('installs a candidate and names what changed', () => {
    const features = createFeatures([
      { key: 'checkout', enabled: true },
      { key: 'express', enabled: true, dependsOn: ['checkout'] },
    ]);

    const result = features.reload({
      version: 42,
      features: [
        { key: 'checkout', enabled: false },
        { key: 'express', enabled: true, dependsOn: ['checkout'] },
      ],
    });

    expect(result).toEqual({
      ok: true,
      version: 42,
      previousVersion: undefined,
      changed: ['checkout'],
    });
  });

  it('decides from the installed document afterwards', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    features.reload({ features: [{ key: 'checkout', enabled: false }] });

    expect(features.isEnabled('checkout')).toBe(false);
  });

  it('lifts the installed version', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    features.reload({
      version: 'flags@41',
      features: [{ key: 'checkout', enabled: true }],
    });

    expect(features.version).toBe('flags@41');
  });

  it('keeps the installed document when a candidate is refused', () => {
    const features = createFeatures([
      { key: 'checkout', enabled: true },
      { key: 'express', enabled: true, dependsOn: ['checkout'] },
    ]);
    const before = features.config;

    // `reload` takes a document keyed on what the store declares, and this
    // candidate names five keys it does not. The cast is what lets the case
    // reach the checker with the document a control plane could serve.
    const result = features.reload({
      version: 42,
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
        { key: 'b', enabled: true, dependsOn: ['nowhere'] },
        { key: 'c', enabled: true, dependsOn: ['d'] },
        { key: 'd', enabled: true, dependsOn: ['c'] },
      ],
    } as unknown as FeatureConfig<'checkout' | 'express'>);

    expect(result).toEqual({
      ok: false,
      version: undefined,
      rejected: 42,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'duplicate-feature' }),
      ]),
    });
    expect(features.config).toBe(before);
    expect(features.isEnabled('express')).toBe(true);
  });

  it('reports four issues for a candidate carrying four', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    const result = features.reload({
      features: [
        { key: 'a', enabled: true },
        { key: 'a', enabled: true },
        { key: 'b', enabled: true, dependsOn: ['nowhere'] },
        { key: 'c', enabled: true, dependsOn: ['d'] },
        { key: 'd', enabled: true, dependsOn: ['c'] },
        {
          key: 'e',
          enabled: true,
          variantBy: 'targetingKey',
          variantSeed: 'e:variant',
          variants: [{ name: 'only', weight: -1, order: 0 }],
        },
      ],
    } as unknown as FeatureConfig<'checkout'>);

    expect(result.ok === false && result.issues).toHaveLength(4);
  });

  it('refuses an unknown member and keeps deciding', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    const result = features.reload({
      features: [{ key: 'checkout', enabled: false }],
      hashVersion: 2,
    } as unknown as FeatureConfig<'checkout'>);

    expect(result.ok === false && result.issues[0]?.code).toBe(
      'unknown-member',
    );
    expect(features.isEnabled('checkout')).toBe(true);
  });

  it('discards a local toggle the incoming document does not carry', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);
    features.toggle('checkout', false);

    features.reload({ features: [{ key: 'checkout', enabled: true }] });

    // The store's truth is the configuration source. A toggle is a local write
    // against it, and a merge would make the store answer from two authorities
    // with no record of which one decided.
    expect(features.isEnabled('checkout')).toBe(true);
  });

  it('names no key whose resolved answer moved because now moved', () => {
    const rules = [
      {
        when: [
          {
            field: 'now' as const,
            op: 'before' as const,
            value: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    ];
    const features = createFeatures([{ key: 'sale', enabled: true, rules }]);

    const result = features.reload({
      features: [{ key: 'sale', enabled: true, rules }],
    });

    // The window expired and nothing about the feature changed, so `changed`
    // is empty. It diffs stored intent and never diffs a resolved value.
    expect(result.ok && result.changed).toEqual([]);
  });

  it('carries the installed envelope into a serialization', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    features.reload({
      ...start,
      features: [{ key: 'checkout', enabled: true }],
    });

    expect(serializeConfig(features).version).toBe(41);
  });

  it('installs an empty document and names every key it dropped', () => {
    const features = createFeatures([
      { key: 'checkout', enabled: true },
      { key: 'express', enabled: true, dependsOn: ['checkout'] },
    ]);

    const result = features.reload({ features: [] });

    expect(result.ok && result.changed).toEqual(['checkout', 'express']);
    expect(features.keys).toEqual([]);
    expect(features.resolve()).toEqual({});
  });

  it('installs the document it already holds and names nothing', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);
    features.reload({
      version: 41,
      features: [{ key: 'checkout', enabled: true }],
    });

    const result = features.reload({
      version: 41,
      features: [{ key: 'checkout', enabled: true }],
    });

    expect(result).toEqual({
      ok: true,
      version: 41,
      previousVersion: 41,
      changed: [],
    });
  });

  it('keys a reload on a number the way the store keys on one', () => {
    const features = createFeatures([
      { key: 1, enabled: true },
      { key: 2, enabled: true, dependsOn: [1] },
    ]);

    const result = features.reload({
      features: [
        { key: 1, enabled: false },
        { key: 2, enabled: true, dependsOn: [1] },
      ],
    });

    // `FeatureKey` is `string | number` and a JSON object key is a string, so a
    // diff that went through `Object.keys` would report `'1'` and a caller
    // comparing it with `1` would find nothing.
    expect(result.ok && result.changed).toEqual([1]);
    expect(features.isEnabled(2)).toBe(false);
  });

  it('diffs a variant value that holds itself without looping', () => {
    const value: Record<string, unknown> = { label: 'Buy' };
    value['self'] = value;
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variantBy: 'targetingKey',
        variantSeed: 'cta:variant',
        variants: [{ name: 'a', weight: 1, order: 0, value }],
      },
    ]);

    const other: Record<string, unknown> = { label: 'Get it' };
    other['self'] = other;
    const result = features.reload({
      features: [
        {
          key: 'cta',
          enabled: true,
          variantBy: 'targetingKey',
          variantSeed: 'cta:variant',
          variants: [{ name: 'a', weight: 1, order: 0, value: other }],
        },
      ],
    });

    expect(result.ok && result.changed).toEqual(['cta']);
  });

  it('gives a resolve started before it a decision set entirely from one document', () => {
    const split = [{ name: 'a', weight: 1, order: 0 }];
    const features = createFeatures([
      {
        key: 'parent',
        enabled: true,
        variantBy: 'targetingKey',
        variantSeed: 'parent:variant',
        variants: split,
      },
      {
        key: 'child',
        enabled: true,
        dependsOn: ['parent'],
        variantBy: 'targetingKey',
        variantSeed: 'child:variant',
        variants: split,
      },
    ]);

    let swapped = false;
    // `assignVariant` reads `stickyVariants[key]` for every feature that
    // declares variants, so this getter runs inside the walk: after
    // `resolveAll` bound its view of the store, and before the walk reaches
    // `child`. The member type is a string per key and this pin is absent, so
    // the assertion is what lets the getter answer with none.
    const stickyVariants = {
      get parent(): string | undefined {
        if (!swapped) {
          swapped = true;
          features.reload({
            features: [
              {
                key: 'parent',
                enabled: true,
                variantBy: 'targetingKey',
                variantSeed: 'parent:variant',
                variants: split,
              },
              {
                key: 'child',
                enabled: false,
                dependsOn: ['parent'],
                variantBy: 'targetingKey',
                variantSeed: 'child:variant',
                variants: split,
              },
            ],
          });
        }
        return undefined;
      },
    } as Readonly<Record<string, string>>;

    const decisions = features.resolve({ targetingKey: 'u1', stickyVariants });

    expect(decisions).toMatchObject({
      parent: { enabled: true },
      child: { enabled: true },
    });
    expect(features.isEnabled('child')).toBe(false);
  });
});
