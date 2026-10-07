import { describe, expect, it } from 'vitest';
import { configDigest } from './digest.js';
import { createFeatures } from './features.js';
import { serializeConfig } from './serialize.js';
import { validateConfig } from './validate.js';
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

describe('reload, the candidate it reads as a served document', () => {
  it('refuses a variant set that declares no order', () => {
    const features = createFeatures([
      { key: 'cta', enabled: true, variants: [{ name: 'a', weight: 1 }] },
    ]);

    const result = features.reload({
      features: [
        {
          key: 'cta',
          enabled: true,
          variantBy: 'targetingKey',
          variantSeed: 'cta:variant',
          variants: [{ name: 'a', weight: 1 }],
        },
      ],
    } as unknown as FeatureConfig<'cta'>);

    // `createFeatures` passes `arrayIsOrder` because its definitions are a
    // literal an author wrote, and `reload` omits it because a publisher
    // either states the order or states none. A holder defaulting the member
    // off the array position assigns variants differently from the publisher.
    expect(result.ok === false && result.issues[0]?.code).toBe(
      'invalid-variant-order',
    );
  });

  it('refuses a definition that declares variants and no bucketing members', () => {
    const features = createFeatures([
      { key: 'cta', enabled: true, variants: [{ name: 'a', weight: 1 }] },
    ]);

    const result = features.reload({
      features: [
        {
          key: 'cta',
          enabled: true,
          variants: [{ name: 'a', weight: 1, order: 0 }],
        },
      ],
    } as unknown as FeatureConfig<'cta'>);

    expect(
      result.ok === false && result.issues.map((issue) => issue.path),
    ).toEqual(['/features/0/variantBy', '/features/0/variantSeed']);
  });

  it('refuses a window boundary that names no instant', () => {
    const features = createFeatures([{ key: 'sale', enabled: true }]);

    const result = features.reload({
      features: [
        {
          key: 'sale',
          enabled: true,
          rules: [
            {
              when: [{ field: 'now', op: 'before', value: 'the first of May' }],
            },
          ],
        },
      ],
    } as unknown as FeatureConfig<'sale'>);

    // The whole `whenIssues` walk runs for a served document alone, and this
    // is the code that pins it to the reload path.
    expect(result.ok === false && result.issues[0]?.code).toBe(
      'invalid-instant',
    );
  });

  it('keeps deciding from the installed document after it refuses one', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    features.reload({
      features: [
        {
          key: 'checkout',
          enabled: false,
          variants: [{ name: 'a', weight: 1 }],
        },
      ],
    } as unknown as FeatureConfig<'checkout'>);

    expect(features.isEnabled('checkout')).toBe(true);
  });
});

describe('reload, the envelope it installs', () => {
  it('installs every envelope member the candidate declared', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    const result = features.reload({
      version: 7,
      schemaVersion: 'v1',
      schema: { context: { fields: { tier: 'string' } } },
      maxStale: 30000,
      features: [{ key: 'checkout', enabled: true }],
    });

    expect(result.ok).toBe(true);
    expect(features.envelope).toEqual({
      version: 7,
      schemaVersion: 'v1',
      schema: { context: { fields: { tier: 'string' } } },
      maxStale: 30000,
    });
  });

  it('writes the installed envelope and no payload into a serialization', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    features.reload({
      version: 7,
      schemaVersion: 'v1',
      schema: { context: { fields: { tier: 'string' } } },
      maxStale: 30000,
      features: [{ key: 'checkout', enabled: true }],
    });

    expect(serializeConfig(features)).toEqual({
      version: 7,
      schemaVersion: 'v1',
      schema: { context: { fields: { tier: 'string' } } },
      maxStale: 30000,
      features: [{ key: 'checkout', enabled: true }],
    });
  });

  it('replaces the envelope whole and keeps no member of the document before it', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);
    features.reload({
      version: 41,
      maxStale: 1000,
      features: [{ key: 'checkout', enabled: true }],
    });

    features.reload({ features: [{ key: 'checkout', enabled: true }] });

    // A candidate states the whole envelope. A merge would leave a holder
    // reporting a version and a staleness budget the document it installed
    // never carried.
    expect(features.envelope).toEqual({});
    expect(features.version).toBeUndefined();
  });

  it('answers a caller that named its own envelope with that one', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);
    features.reload({
      version: 41,
      maxStale: 60,
      features: [{ key: 'checkout', enabled: true }],
    });

    expect(serializeConfig(features, { version: 99 })).toEqual({
      version: 99,
      features: [{ key: 'checkout', enabled: true }],
    });
  });

  it('lifts a version of zero and a version of the empty string', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    const first = features.reload({
      version: 0,
      features: [{ key: 'checkout', enabled: true }],
    });

    expect(first).toEqual({
      ok: true,
      version: 0,
      previousVersion: undefined,
      changed: [],
    });
    expect(features.version).toBe(0);

    // Both values are falsy and both are legal, so a lift written with `||` or
    // a check written as `if (candidate.version)` answers `undefined` here.
    expect(
      features.reload({
        version: '',
        features: [{ key: 'checkout', enabled: true }],
      }),
    ).toEqual({ ok: true, version: '', previousVersion: 0, changed: [] });
    expect(features.version).toBe('');
  });

  it('installs a candidate whose version repeats the installed one', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);
    features.reload({
      version: 41,
      features: [{ key: 'checkout', enabled: true }],
    });

    const result = features.reload({
      version: 41,
      features: [{ key: 'checkout', enabled: false }],
    });

    // A version is opaque and no entry point orders one, so a repeated version
    // decides nothing. A store that short-circuited on it would keep serving a
    // document the publisher replaced under the same name.
    expect(result).toEqual({
      ok: true,
      version: 41,
      previousVersion: 41,
      changed: ['checkout'],
    });
    expect(features.isEnabled('checkout')).toBe(false);
  });

  it('keeps the installed envelope when a candidate is refused', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);
    features.reload({
      version: 41,
      features: [{ key: 'checkout', enabled: true }],
    });
    const before = features.envelope;

    const result = features.reload({
      version: 42,
      schema: { context: { fields: { tier: 'string' } } },
      features: [{ key: 'checkout', enabled: true }],
    });

    expect(result).toEqual({
      ok: false,
      version: 41,
      rejected: 42,
      issues: [expect.objectContaining({ code: 'missing-schema-version' })],
    });
    expect(features.envelope).toBe(before);
    expect(features.version).toBe(41);
    expect(serializeConfig(features).version).toBe(41);
  });

  it('reports one issue for a candidate carrying one', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    const result = features.reload({
      features: [
        { key: 'checkout', enabled: true },
        { key: 'express', enabled: true, dependsOn: ['nowhere'] },
      ],
    } as unknown as FeatureConfig<'checkout'>);

    expect(result.ok === false && result.issues).toHaveLength(1);
  });

  it('refuses a document whose digest covers other bytes', () => {
    const other: FeatureConfig<'checkout'> = {
      version: 2,
      features: [{ key: 'checkout', enabled: true }],
    };
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    const result = features.reload({
      version: 2,
      digest: configDigest(other),
      features: [{ key: 'checkout', enabled: false }],
    });

    // § 2 puts the verification on this path: a holder that finds a digest
    // recomputes it. It holds only because `collectIssues` receives the
    // candidate whole, and stripping the member before the check would drop
    // the verification and keep every other case green.
    expect(result.ok === false && result.issues[0]?.code).toBe(
      'digest-mismatch',
    );
    expect(features.isEnabled('checkout')).toBe(true);
    expect(features.version).toBeUndefined();
  });

  it('writes no digest into the envelope it installs', () => {
    const document = {
      version: 1,
      features: [{ key: 'checkout', enabled: true }],
    } satisfies FeatureConfig<'checkout'>;
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    features.reload({ ...document, digest: configDigest(document) });

    // `ConfigEnvelope` fences `digest` to `never` because `configDigest` is the
    // one writer of the member. A store that keeps the candidate's digest hands
    // `serializeConfig` a value that covers other bytes.
    expect(features.envelope.digest).toBeUndefined();
  });

  it('serializes a document a holder accepts after a toggle', () => {
    const document = {
      version: 1,
      features: [
        { key: 'checkout', enabled: true },
        { key: 'express', enabled: true, dependsOn: ['checkout'] },
      ],
    } satisfies FeatureConfig<'checkout' | 'express'>;
    const features = createFeatures([
      { key: 'checkout', enabled: true },
      { key: 'express', enabled: true, dependsOn: ['checkout'] },
    ]);
    features.reload({ ...document, digest: configDigest(document) });
    features.toggle('checkout', false);

    expect(validateConfig(serializeConfig(features))).toEqual({ ok: true });
  });
});

describe('reload, the references it swaps', () => {
  it('answers dependants from the graph it built', () => {
    const features = createFeatures([
      { key: 'checkout', enabled: true },
      { key: 'express', enabled: true, dependsOn: ['checkout'] },
    ]);

    expect(features.dependants('checkout')).toEqual(['express']);

    features.reload({
      features: [
        { key: 'checkout', enabled: true },
        { key: 'gift', enabled: true, dependsOn: ['checkout'] },
      ],
    } as unknown as FeatureConfig<'checkout' | 'express'>);

    expect(features.dependants('checkout')).toEqual(['gift']);
  });

  it('answers definition from the document it installed', () => {
    const features = createFeatures([
      { key: 'checkout', enabled: true },
      { key: 'express', enabled: true, dependsOn: ['checkout'] },
    ]);

    features.reload({
      features: [
        { key: 'checkout', enabled: false },
        { key: 'gift', enabled: true, dependsOn: ['checkout'] },
      ],
    } as unknown as FeatureConfig<'checkout' | 'express'>);

    expect(features.definition('express')).toBeUndefined();
    expect(features.definition('checkout')).toEqual({
      key: 'checkout',
      enabled: false,
    });
    expect(features.keys).toEqual(['checkout', 'gift']);
  });

  it('clones the candidate and freezes what it installed', () => {
    const definition = {
      key: 'checkout',
      enabled: true,
      dependsOn: [] as string[],
    };
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    // The cast is what lets the case hold a mutable definition. A publisher
    // reaches `reload` with whatever `JSON.parse` returned and edits it after.
    features.reload({
      features: [definition],
    } as unknown as FeatureConfig<'checkout'>);
    definition.enabled = false;
    definition.dependsOn.push('nowhere');

    // The candidate is the caller's object and a publisher may reuse it. A
    // store holding it would answer from a document that changed behind its
    // own back, with nothing resolved against what it holds now.
    expect(features.isEnabled('checkout')).toBe(true);
    expect(features.config).toEqual([
      { key: 'checkout', enabled: true, dependsOn: [] },
    ]);
    expect(Object.isFrozen(features.config)).toBe(true);
    expect(Object.isFrozen(features.config[0])).toBe(true);
    expect(Object.isFrozen(features.config[0]?.dependsOn)).toBe(true);
  });

  it('replaces the array the config getter hands out', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);
    const before = features.config;

    features.reload({ features: [{ key: 'checkout', enabled: false }] });

    expect(features.config).not.toBe(before);
    expect(before).toEqual([{ key: 'checkout', enabled: true }]);
  });

  it('gives a plan started before it a decision set from one document', () => {
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
    // The same seam Step 10 uses for `resolve`. `plan` binds its view after
    // `withNow`, and this getter runs inside the walk that follows.
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

    const planned = features.plan({ targetingKey: 'u1', stickyVariants });

    expect(planned).toMatchObject({
      parent: { decision: { enabled: true } },
      child: { decision: { enabled: true } },
    });
    expect(features.isEnabled('child')).toBe(false);
  });
});

describe('reload, a toggle it lands inside', () => {
  it('leaves every reference on the document it installed', () => {
    const features = createFeatures([
      {
        key: 'parent',
        enabled: true,
        variants: [{ name: 'a', weight: 1 }],
      },
    ]);

    let swapped = false;
    // `assignVariant` reads `stickyVariants[key]` for every feature that
    // declares variants, so this getter runs inside the resolve `toggle` runs
    // before its write.
    const stickyVariants = {
      get parent(): string | undefined {
        if (!swapped) {
          swapped = true;
          features.reload({
            version: 9,
            features: [{ key: 'zeta', enabled: true }],
          } as unknown as FeatureConfig<'parent'>);
        }
        return undefined;
      },
    } as Readonly<Record<string, string>>;

    features.toggle('parent', false, { targetingKey: 'u1', stickyVariants });

    // The install swaps all five references together. A write built from the
    // array `toggle` bound would put the pre-reload document back under the
    // candidate's graph, index and keys, and `definition` would then answer a
    // key the candidate declares with the definition the previous document
    // held at that position.
    expect(features.keys).toEqual(['zeta']);
    expect(features.config.map((definition) => definition.key)).toEqual([
      'zeta',
    ]);
    expect(features.definition('zeta' as 'parent')?.key).toBe('zeta');
    expect(features.version).toBe(9);
  });

  it('writes the toggle into the document the reload installed', () => {
    const features = createFeatures([
      {
        key: 'parent',
        enabled: true,
        variants: [{ name: 'a', weight: 1 }],
      },
    ]);

    let swapped = false;
    const stickyVariants = {
      get parent(): string | undefined {
        if (!swapped) {
          swapped = true;
          features.reload({
            features: [{ key: 'parent', enabled: true }],
          });
        }
        return undefined;
      },
    } as Readonly<Record<string, string>>;

    features.toggle('parent', false, { targetingKey: 'u1', stickyVariants });

    // The key survived the swap, so the write lands on the definition the
    // candidate declares for it and not on the one the bound array held.
    expect(features.isEnabled('parent')).toBe(false);
    expect(features.config[0]?.variants).toBeUndefined();
  });

  it('refuses the write when the installed document dropped the key', () => {
    const features = createFeatures([
      {
        key: 'parent',
        enabled: true,
        variants: [{ name: 'a', weight: 1 }],
      },
      { key: 'child', enabled: true, dependsOn: ['parent'] },
    ]);

    let swapped = false;
    const stickyVariants = {
      get parent(): string | undefined {
        if (!swapped) {
          swapped = true;
          features.reload({
            version: 9,
            features: [{ key: 'zeta', enabled: true }],
          } as unknown as FeatureConfig<'parent'>);
        }
        return undefined;
      },
    } as Readonly<Record<string, string>>;

    const result = features.toggle('parent', false, {
      targetingKey: 'u1',
      stickyVariants,
    });

    // No document carries the key, so no write landed anywhere. An `ok: true`
    // here reaches an auditor as a toggle the store accepted, and § 6 has the
    // reload discard the toggle rather than hide it.
    expect(result).toEqual({
      ok: false,
      key: 'parent',
      error: 'unknown-feature',
    });
    expect(features.keys).toEqual(['zeta']);
    expect(
      features.config.some((definition) =>
        Object.hasOwn(definition, 'undefined'),
      ),
    ).toBe(false);
  });

  it('names no dependant the installed document stopped declaring', () => {
    const split = [{ name: 'a', weight: 1 }];
    const features = createFeatures([
      { key: 'parent', enabled: true, variants: split },
      { key: 'child', enabled: true, dependsOn: ['parent'], variants: split },
    ]);

    let swapped = false;
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
                variants: [{ name: 'a', weight: 1, order: 0 }],
              },
            ],
          });
        }
        return undefined;
      },
    } as Readonly<Record<string, string>>;

    const result = features.toggle('parent', false, {
      targetingKey: 'u1',
      stickyVariants,
    });

    // `willDisable` is the kill-switch preview an operator reads. A list taken
    // off the pre-reload graph names a dependant the installed document does
    // not declare, filtered on a decision set the installed document produced.
    expect(result).toEqual({
      ok: true,
      key: 'parent',
      enabled: false,
      willDisable: [],
    });
    expect(features.keys).toEqual(['parent']);
    expect(features.isEnabled('parent')).toBe(false);
  });

  it('names no dependant the reload disabled when the toggle enables', () => {
    const split = [{ name: 'a', weight: 1 }];
    const features = createFeatures([
      { key: 'parent', enabled: true, variants: split },
      { key: 'child', enabled: true, dependsOn: ['parent'], variants: split },
    ]);

    let swapped = false;
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
                variants: [{ name: 'a', weight: 1, order: 0 }],
              },
              { key: 'child', enabled: false, dependsOn: ['parent'] },
            ],
          });
        }
        return undefined;
      },
    } as Readonly<Record<string, string>>;

    const result = features.toggle('parent', true, {
      targetingKey: 'u1',
      stickyVariants,
    });

    // `ToggleResult.willDisable` is empty when enabling. A diff taken across
    // two documents attributes every `enabled` the reload moved to the toggle.
    expect(result).toEqual({
      ok: true,
      key: 'parent',
      enabled: true,
      willDisable: [],
    });
  });
});

/** One definition carrying `value` on its single variant. */
const valued = (value: unknown) => ({
  key: 'cta' as const,
  enabled: true,
  variantBy: 'targetingKey',
  variantSeed: 'cta:variant',
  variants: [{ name: 'a', weight: 1, order: 0, value }],
});

describe('reload, the diff it reports', () => {
  it('names a key whose rule moved its window', () => {
    const features = createFeatures([
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            when: [
              {
                field: 'now' as const,
                op: 'before' as const,
                value: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
        ],
      },
    ]);

    const result = features.reload({
      features: [
        {
          key: 'sale',
          enabled: true,
          rules: [
            {
              when: [
                {
                  field: 'now',
                  op: 'before',
                  value: '2027-01-01T00:00:00.000Z',
                },
              ],
            },
          ],
        },
      ],
    });

    // The counterpart of the case that names nothing when the clock moved. A
    // diff that answered a constant empty array would pass that one.
    expect(result.ok && result.changed).toEqual(['sale']);
  });

  it('names nothing when a store reloads the document it serialized', () => {
    const features = createFeatures([
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            when: [
              {
                field: 'now' as const,
                op: 'before' as const,
                value: new Date(1767225600000),
              },
            ],
          },
        ],
      },
    ]);

    const result = features.reload(serializeConfig(features));

    // `serializeConfig` writes the window `Date` as the ISO string, which
    // `toEpoch` reads to the same epoch, so the publisher and the holder decide
    // the window alike and the two documents state one intent.
    expect(result.ok && result.changed).toEqual([]);
  });

  it('names a key whose variant value holds different Set members', () => {
    const features = createFeatures([valued(new Set(['gold']))]);

    const result = features.reload({
      features: [valued(new Set(['silver']))],
    } as unknown as FeatureConfig<'cta'>);

    // `Object.keys` reads nothing off a Set, so a walk over the keys alone
    // calls any two of them equal and the candidate installs a value the diff
    // never looked at.
    expect(result.ok && result.changed).toEqual(['cta']);
  });

  it('names a key whose variant value holds a Date against a plain object', () => {
    const features = createFeatures([valued(new Date(0))]);

    const result = features.reload({
      features: [valued({})],
    } as unknown as FeatureConfig<'cta'>);

    expect(result.ok && result.changed).toEqual(['cta']);
  });

  it('names a key whose variant value holds a different pattern', () => {
    const features = createFeatures([valued(/gold/u)]);

    const result = features.reload({
      features: [valued(/silver/u)],
    } as unknown as FeatureConfig<'cta'>);

    expect(result.ok && result.changed).toEqual(['cta']);
  });

  it('names nothing when a variant value holds one Map twice', () => {
    const entries: readonly [string, number][] = [['gold', 1]];
    const features = createFeatures([valued(new Map(entries))]);

    const result = features.reload({
      features: [valued(new Map(entries))],
    } as unknown as FeatureConfig<'cta'>);

    // The counterpart. A diff that answered `false` for every Map would pass
    // the three cases above and name a key nothing changed about.
    expect(result.ok && result.changed).toEqual([]);
  });

  it('names a key whose attribute condition holds a Date against its string', () => {
    const features = createFeatures([
      {
        key: 'sale',
        enabled: true,
        rules: [
          {
            when: [{ field: 'cohort', op: 'eq' as const, value: new Date(0) }],
          },
        ],
      },
    ]);

    const result = features.reload({
      features: [
        {
          key: 'sale',
          enabled: true,
          rules: [
            {
              when: [
                {
                  field: 'cohort',
                  op: 'eq' as const,
                  value: '1970-01-01T00:00:00.000Z',
                },
              ],
            },
          ],
        },
      ],
    } as unknown as FeatureConfig<'sale'>);

    // The window operators are the pair that reads an instant. Every other
    // operator runs over `===` in `evaluateCondition`, so the store comparing
    // the `Date` and a holder comparing the string decide this rule two ways
    // and the two documents state two intents.
    expect(result.ok && result.changed).toEqual(['sale']);
  });

  it('names the keys in the candidate order, with a dropped key after them', () => {
    const features = createFeatures([
      { key: 'alpha', enabled: true },
      { key: 'beta', enabled: true },
      { key: 'gamma', enabled: true },
    ]);

    const result = features.reload({
      features: [
        { key: 'gamma', enabled: false },
        { key: 'alpha', enabled: true },
        { key: 'delta', enabled: true },
      ],
    } as unknown as FeatureConfig<'alpha' | 'beta' | 'gamma'>);

    expect(result.ok && result.changed).toEqual(['gamma', 'delta', 'beta']);
  });

  it('names nothing when a candidate reorders the definitions alone', () => {
    const features = createFeatures([
      { key: 'alpha', enabled: true },
      { key: 'beta', enabled: true },
    ]);

    const result = features.reload({
      features: [
        { key: 'beta', enabled: true },
        { key: 'alpha', enabled: true },
      ],
    });

    expect(result.ok && result.changed).toEqual([]);
    expect(features.keys).toEqual(['beta', 'alpha']);
  });

  it('names a key whose dependsOn carries the same keys in another order', () => {
    const features = createFeatures([
      { key: 'alpha', enabled: true },
      { key: 'beta', enabled: true },
      { key: 'gamma', enabled: true, dependsOn: ['alpha', 'beta'] },
    ]);

    const result = features.reload({
      features: [
        { key: 'alpha', enabled: true },
        { key: 'beta', enabled: true },
        { key: 'gamma', enabled: true, dependsOn: ['beta', 'alpha'] },
      ],
    });

    // The diff reads an array positionally, so the stored intent differs. The
    // cascade reaches the same answer either way, and the diff reports the
    // document and never the answer.
    expect(result.ok && result.changed).toEqual(['gamma']);
  });

  it('names a key whose definition gained a member', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    const result = features.reload({
      features: [{ key: 'checkout', enabled: true, dependsOn: [] }],
    });

    expect(result.ok && result.changed).toEqual(['checkout']);
  });

  it('names nothing for a member one document writes as undefined', () => {
    const features = createFeatures([{ key: 'checkout', enabled: true }]);

    const result = features.reload({
      features: [{ key: 'checkout', enabled: true, dependsOn: undefined }],
    });

    // An absent key and a key written as `undefined` state one intent, which is
    // the rule `canonical` states for the same reason.
    expect(result.ok && result.changed).toEqual([]);
  });

  it('names nothing when one document shares an object two keys hold', () => {
    const shared = { label: 'Buy' };
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variantBy: 'targetingKey',
        variantSeed: 'cta:variant',
        variants: [
          { name: 'a', weight: 1, order: 0, value: shared },
          { name: 'b', weight: 1, order: 1, value: shared },
        ],
      },
    ]);

    const result = features.reload({
      features: [
        {
          key: 'cta',
          enabled: true,
          variantBy: 'targetingKey',
          variantSeed: 'cta:variant',
          variants: [
            { name: 'a', weight: 1, order: 0, value: { label: 'Buy' } },
            { name: 'b', weight: 1, order: 1, value: { label: 'Buy' } },
          ],
        },
      ],
    });

    // Reference sharing is not part of the intent. A pair map that held the
    // first pairing would refuse the structurally equal object at the second
    // key and name a feature nothing changed about.
    expect(result.ok && result.changed).toEqual([]);
  });

  it('names a key whose variants differ in weight alone', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variantBy: 'targetingKey',
        variantSeed: 'cta:variant',
        variants: [
          { name: 'a', weight: 50, order: 0 },
          { name: 'b', weight: 50, order: 1 },
        ],
      },
    ]);

    const result = features.reload({
      features: [
        {
          key: 'cta',
          enabled: true,
          variantBy: 'targetingKey',
          variantSeed: 'cta:variant',
          variants: [
            { name: 'a', weight: 90, order: 0 },
            { name: 'b', weight: 10, order: 1 },
          ],
        },
      ],
    });

    expect(result.ok && result.changed).toEqual(['cta']);
  });

  it('names every key of a candidate that replaced all of them', () => {
    const features = createFeatures([
      { key: 'alpha', enabled: true },
      { key: 'beta', enabled: true },
    ]);

    const result = features.reload({
      features: [
        { key: 'gamma', enabled: true },
        { key: 'delta', enabled: true },
      ],
    } as unknown as FeatureConfig<'alpha' | 'beta'>);

    expect(result.ok && result.changed).toEqual([
      'gamma',
      'delta',
      'alpha',
      'beta',
    ]);
  });

  it('names the one key a candidate brought to a store built from nothing', () => {
    const features = createFeatures<{ checkout: never }>([]);

    const result = features.reload({
      features: [{ key: 'checkout', enabled: true }],
    });

    expect(result.ok && result.changed).toEqual(['checkout']);
    expect(features.keys).toEqual(['checkout']);
  });

  it('keys a reload on zero', () => {
    const features = createFeatures([{ key: 0, enabled: true }]);

    const result = features.reload({ features: [{ key: 0, enabled: false }] });

    // `0` is a legal `FeatureKey` and it is falsy, so a lookup written as
    // `if (key)` drops the only definition this document carries.
    expect(result.ok && result.changed).toEqual([0]);
    expect(features.isEnabled(0)).toBe(false);
    expect(features.keys).toEqual([0]);
  });
});
