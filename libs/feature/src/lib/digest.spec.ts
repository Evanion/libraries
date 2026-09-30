import { describe, expect, it } from 'vitest';
import { configDigest } from './digest.js';
import type { FeatureConfig, SerializedInstant } from './config.js';

const document: FeatureConfig = {
  version: 41,
  features: [
    { key: 'checkout', enabled: true },
    { key: 'express', enabled: true, dependsOn: ['checkout'] },
  ],
};

/** A document whose one rule opens a window at `value`. */
function windowAt(value: SerializedInstant): FeatureConfig {
  return {
    features: [
      {
        key: 'x',
        enabled: true,
        rules: [{ when: [{ field: 'now', op: 'before', value }] }],
      },
    ],
  };
}

describe('configDigest', () => {
  it('returns 32 hex characters', () => {
    expect(configDigest(document)).toMatch(/^[0-9a-f]{32}$/);
  });

  it('agrees for two documents differing only in key order', () => {
    const permuted: FeatureConfig = {
      features: [...document.features],
      version: document.version,
    };

    expect(configDigest(permuted)).toBe(configDigest(document));
  });

  it('agrees for an absent key and a key written undefined', () => {
    const explicit: FeatureConfig = { ...document, schemaVersion: undefined };

    expect(configDigest(explicit)).toBe(configDigest(document));
  });

  it('agrees whatever digest the document already carries', () => {
    const carried: FeatureConfig = { ...document, digest: 'not a digest' };

    expect(configDigest(carried)).toBe(configDigest(document));
  });

  it('disagrees when the rules array order changes', () => {
    const rules = [
      {
        id: 'staff',
        when: [{ field: 'staff', op: 'eq' as const, value: true }],
      },
      { id: 'beta', when: [{ field: 'beta', op: 'eq' as const, value: true }] },
    ];
    const one: FeatureConfig = {
      features: [{ key: 'x', enabled: true, rules }],
    };
    const other: FeatureConfig = {
      features: [{ key: 'x', enabled: true, rules: [...rules].reverse() }],
    };

    expect(configDigest(other)).not.toBe(configDigest(one));
  });

  it('disagrees when a version changes and nothing else does', () => {
    const bumped: FeatureConfig = { ...document, version: 42 };

    expect(configDigest(bumped)).not.toBe(configDigest(document));
  });

  it('agrees across a trip through JSON', () => {
    const arrived = JSON.parse(JSON.stringify(document)) as FeatureConfig;

    expect(configDigest(arrived)).toBe(configDigest(document));
  });
  it('holds the digest a second implementation has to reproduce', () => {
    // A publisher in one language and a holder in another compare this string,
    // so the four seeds, the word order and the canonical text are the wire
    // contract. Changing any of them renames every document already served.
    expect(configDigest(document)).toBe('ddd6fe2b511b25e52af770cc85ec4284');
  });

  it('disagrees when a feature the document declares is turned off', () => {
    const off: FeatureConfig = {
      ...document,
      features: [{ key: 'checkout', enabled: false }, document.features[1]!],
    };

    expect(configDigest(off)).not.toBe(configDigest(document));
  });

  it('disagrees when the features array order changes', () => {
    const permuted: FeatureConfig = {
      ...document,
      features: [...document.features].reverse(),
    };

    expect(configDigest(permuted)).not.toBe(configDigest(document));
  });

  it('disagrees when a schemaVersion arrives', () => {
    const declared: FeatureConfig = { ...document, schemaVersion: '2' };

    expect(configDigest(declared)).not.toBe(configDigest(document));
  });

  it('disagrees when maxStale changes and nothing else does', () => {
    const shorter: FeatureConfig = { ...document, maxStale: 60_000 };

    expect(configDigest(shorter)).not.toBe(configDigest(document));
  });

  it('strips the envelope member alone, not every member named digest', () => {
    const one: FeatureConfig = {
      features: [{ key: 'x', enabled: true }],
      schema: { features: { x: { variants: { digest: { type: 'string' } } } } },
    };
    const other: FeatureConfig = {
      features: [{ key: 'x', enabled: true }],
      schema: { features: { x: { variants: { digest: { type: 'number' } } } } },
    };

    expect(configDigest(other)).not.toBe(configDigest(one));
  });

  it('returns 32 hex characters for a document declaring no features', () => {
    expect(configDigest({ features: [] })).toMatch(/^[0-9a-f]{32}$/);
  });

  it('disagrees between a document with no features and one with a feature', () => {
    const one: FeatureConfig = { features: [{ key: 'x', enabled: true }] };

    expect(configDigest({ features: [] })).not.toBe(configDigest(one));
  });

  it('disagrees between a feature listed once and the same feature listed twice', () => {
    const once: FeatureConfig = { features: [{ key: 'x', enabled: true }] };
    const twice: FeatureConfig = {
      features: [
        { key: 'x', enabled: true },
        { key: 'x', enabled: true },
      ],
    };

    expect(configDigest(twice)).not.toBe(configDigest(once));
  });

  it('disagrees between an absent rules array and an empty one', () => {
    const absent: FeatureConfig = { features: [{ key: 'x', enabled: true }] };
    const empty: FeatureConfig = {
      features: [{ key: 'x', enabled: true, rules: [] }],
    };

    expect(configDigest(empty)).not.toBe(configDigest(absent));
  });

  it('disagrees between an absent version and one written as an empty string', () => {
    const empty: FeatureConfig = { version: '', features: [] };

    expect(configDigest(empty)).not.toBe(configDigest({ features: [] }));
  });

  it('disagrees between the largest and the smallest safe integer version', () => {
    const largest: FeatureConfig = {
      ...document,
      version: Number.MAX_SAFE_INTEGER,
    };
    const smallest: FeatureConfig = {
      ...document,
      version: Number.MIN_SAFE_INTEGER,
    };

    expect(configDigest(smallest)).not.toBe(configDigest(largest));
  });

  it('disagrees between a numeric version and the string that spells it', () => {
    // `version` is `string | number`, so a holder that read the counter out of
    // a header and a publisher that held it as a number describe one document
    // and digest apart.
    const spelled: FeatureConfig = { ...document, version: '41' };

    expect(configDigest(spelled)).not.toBe(configDigest(document));
  });

  it('agrees for a version of 0 and one of -0', () => {
    const zero: FeatureConfig = { ...document, version: 0 };
    const negative: FeatureConfig = { ...document, version: -0 };

    expect(configDigest(negative)).toBe(configDigest(zero));
  });

  it('agrees for a version of NaN and one of Infinity, which JSON writes as null', () => {
    const nan: FeatureConfig = { ...document, version: Number.NaN };
    const infinite: FeatureConfig = {
      ...document,
      version: Number.POSITIVE_INFINITY,
    };

    expect(configDigest(infinite)).toBe(configDigest(nan));
  });

  it('agrees for a Date and the ISO string a transport hands back', () => {
    // The document type refuses a `Date` at a window instant, and a caller
    // assembling an envelope by hand reaches this position anyway. § 9 asks the
    // two forms for one digest, because `toEpoch` reads both to one instant.
    const authored = windowAt(new Date(0) as unknown as SerializedInstant);
    const arrived = windowAt('1970-01-01T00:00:00.000Z');

    expect(configDigest(arrived)).toBe(configDigest(authored));
  });

  it('disagrees for two window instants a transport carries apart', () => {
    const earlier = windowAt('1970-01-01T00:00:00.000Z');
    const later = windowAt('1970-01-01T00:00:01.000Z');

    expect(configDigest(later)).not.toBe(configDigest(earlier));
  });

  it('agrees for two definitions whose members are written in a different order', () => {
    const one: FeatureConfig = {
      features: [{ key: 'x', enabled: true, seed: 's', variantBy: 'tenant' }],
    };
    const other: FeatureConfig = {
      features: [{ variantBy: 'tenant', seed: 's', enabled: true, key: 'x' }],
    };

    expect(configDigest(other)).toBe(configDigest(one));
  });

  it('disagrees when a dependsOn array names one feature twice', () => {
    const twice: FeatureConfig = {
      ...document,
      features: [
        document.features[0]!,
        { key: 'express', enabled: true, dependsOn: ['checkout', 'checkout'] },
      ],
    };

    expect(configDigest(twice)).not.toBe(configDigest(document));
  });

  it('disagrees when a dependsOn array is reordered', () => {
    const forwards: FeatureConfig = {
      features: [{ key: 'x', enabled: true, dependsOn: ['a', 'b'] }],
    };
    const backwards: FeatureConfig = {
      features: [{ key: 'x', enabled: true, dependsOn: ['b', 'a'] }],
    };

    expect(configDigest(backwards)).not.toBe(configDigest(forwards));
  });

  it('disagrees when a rule id changes and the conditions do not', () => {
    const when = [{ field: 'staff', op: 'eq' as const, value: true }];
    const named: FeatureConfig = {
      features: [{ key: 'x', enabled: true, rules: [{ id: 'staff', when }] }],
    };
    const renamed: FeatureConfig = {
      features: [{ key: 'x', enabled: true, rules: [{ id: 'crew', when }] }],
    };

    expect(configDigest(renamed)).not.toBe(configDigest(named));
  });

  it('covers a __proto__ member a parsed document carries as its own key', () => {
    const smuggled = JSON.parse(
      '{"features":[],"__proto__":{"admin":true}}',
    ) as FeatureConfig;

    expect(configDigest(smuggled)).not.toBe(configDigest({ features: [] }));
  });

  it('digests with TextEncoder and structuredClone deleted from globalThis', () => {
    // § 8 of `docs/specs/2026-09-23-feature-config-distribution.md` runs this
    // on a native client embedding a JavaScript engine with no DOM, which
    // provides `JSON` and neither of these.
    const encoder = globalThis.TextEncoder;
    const clone = globalThis.structuredClone;
    Reflect.deleteProperty(globalThis, 'TextEncoder');
    Reflect.deleteProperty(globalThis, 'structuredClone');

    try {
      expect(configDigest(document)).toBe('ddd6fe2b511b25e52af770cc85ec4284');
    } finally {
      Reflect.set(globalThis, 'TextEncoder', encoder);
      Reflect.set(globalThis, 'structuredClone', clone);
    }
  });

  it('refuses a document that holds itself', () => {
    const shape: Record<string, unknown> = {};
    shape['self'] = shape;
    const cyclic = {
      features: [{ key: 'x', enabled: true }],
      schema: { features: { x: { variants: { held: shape } } } },
    } as unknown as FeatureConfig;

    expect(() => configDigest(cyclic)).toThrow(RangeError);
  });
});
