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
    // Two members the digest reads, because `version` and `digest` are stripped
    // before the text is taken and a permutation of those two changes nothing.
    const written: FeatureConfig = {
      maxStale: 60_000,
      schemaVersion: '2',
      features: document.features,
    };
    const permuted: FeatureConfig = {
      features: document.features,
      schemaVersion: '2',
      maxStale: 60_000,
    };

    expect(configDigest(permuted)).toBe(configDigest(written));
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

  it('agrees when the version changes and nothing else does', () => {
    // `version` is stripped with `digest`, because § 2 of
    // `docs/specs/2026-09-23-feature-config-distribution.md` has a publisher
    // with no version scheme write the digest into both members. A publisher
    // holds neither value when it computes the digest, so a text that carried
    // them could not be recomputed from the document it served.
    const bumped: FeatureConfig = { ...document, version: 42 };

    expect(configDigest(bumped)).toBe(configDigest(document));
  });

  it('verifies the document a publisher with no version scheme serves', () => {
    // § 2's recipe, run in order: the publisher digests the configuration, sets
    // both members to what it got, and the holder recomputes over what arrived.
    const authored: FeatureConfig = {
      features: [{ key: 'x', enabled: true }],
    };
    const digest = configDigest(authored);
    const served: FeatureConfig = { ...authored, version: digest, digest };

    expect(configDigest(served)).toBe(digest);
  });

  it('agrees whatever version the document carries', () => {
    const unlabelled: FeatureConfig = { features: document.features };
    const labels = [
      41,
      42,
      '',
      '41',
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      0,
      -0,
    ] as const;

    for (const version of labels) {
      expect(configDigest({ ...unlabelled, version })).toBe(
        configDigest(unlabelled),
      );
    }
  });

  it('agrees across a trip through JSON', () => {
    const arrived = JSON.parse(JSON.stringify(document)) as FeatureConfig;

    expect(configDigest(arrived)).toBe(configDigest(document));
  });
  it('agrees between a holder that parsed an overflowing literal and one that cached it', () => {
    // JSON's number grammar accepts any exponent, and an overflowing literal
    // parses to a non-finite double, so `JSON.parse` does hand a holder
    // `Infinity`. A second holder that wrote the same served bytes to a disk
    // cache through `JSON.stringify` and read them back holds `null` at the
    // same member. § 2 of
    // `docs/specs/2026-09-23-feature-config-distribution.md` reads two
    // disagreeing digests as two configurations, so the two would refetch a
    // document each of them already holds.
    const parsed = JSON.parse(
      '{"features":[],"maxStale":1e999}',
    ) as FeatureConfig;
    const cached = JSON.parse(JSON.stringify(parsed)) as FeatureConfig;

    expect(parsed.maxStale).toBe(Number.POSITIVE_INFINITY);
    expect(cached.maxStale).toBeNull();
    expect(configDigest(cached)).toBe(configDigest(parsed));
  });

  it('agrees on a condition value an overflowing literal wrote', () => {
    // The same literal at a condition value, which decides a rule. Two holders
    // of one served rule that derive two `ruleId`s is the instability decision
    // 5 exists to prevent, and two holders that digest the document apart is
    // the same disagreement one level up.
    const bytes =
      '{"features":[{"key":"x","enabled":true,"rules":' +
      '[{"when":[{"field":"n","op":"eq","value":-1e999}]}]}]}';
    const parsed = JSON.parse(bytes) as FeatureConfig;
    const cached = JSON.parse(JSON.stringify(parsed)) as FeatureConfig;

    expect(configDigest(cached)).toBe(configDigest(parsed));
  });

  it('writes a NaN a document holds in memory the way JSON carries it', () => {
    // `NaN` is the one of the three no JSON text reaches, and a document built
    // in memory holds it. `serializeConfig` refuses one at every member it
    // emits, so this document reaches no holder, and the digest still answers
    // for the bytes a publisher would have served.
    const held = {
      features: [],
      maxStale: Number.NaN,
    } as unknown as FeatureConfig;
    const carried = {
      features: [],
      maxStale: null,
    } as unknown as FeatureConfig;

    expect(configDigest(held)).toBe(configDigest(carried));
  });

  it('holds the digest a second implementation has to reproduce', () => {
    // A publisher in one language and a holder in another compare this string,
    // so the four seeds, the word order and the canonical text are the wire
    // contract. Changing any of them renames every document already served.
    expect(configDigest(document)).toBe('008719950c5f1e205da50d6e50510cc7');
  });

  it('holds the digest of a document carrying every number text a port guesses at', () => {
    // The vector above holds no digit, so it pins key sorting, array order and
    // ASCII string quoting and pins nothing about the number text. `canonical`
    // delegates a finite number to `JSON.stringify`, which is ECMAScript
    // `Number::toString`: `1e+21` for 1e21, `1e-7`, `0` for `-0`, and the
    // shortest text that round-trips for 0.1 + 0.2. A port that formats a
    // double through Java's `Double.toString` writes `1.0` where this writes
    // `1`, `1.0E21` where this writes `1e+21`, and disagrees on every document
    // carrying a weight, an order, a rollout or a `maxStale`.
    const numbers: FeatureConfig = {
      maxStale: 60_000,
      features: [
        {
          key: 'x',
          enabled: true,
          rules: [{ id: 'ramp', rollout: { percent: 0.1 + 0.2 } }],
          variants: [
            { name: 'a', weight: 1, order: -0, value: 1e21 },
            { name: 'b', weight: 1e-7, order: 1, value: 100 },
          ],
        },
      ],
    };

    expect(configDigest(numbers)).toBe('a0fa63e5dfddfe34132ec38f50359ff0');
  });

  it('holds the digest of a document carrying every escape a port guesses at', () => {
    // The other half the vector above leaves open. `canonical` delegates a
    // string to `JSON.stringify`, which writes `\t` for a tab, lowercase hex in
    // `\u0001` for a control character, a lone surrogate as `\udfff`, and
    // leaves `/`, U+2028 and every non-ASCII character raw. A port that escapes
    // `/`, writes uppercase hex, or emits `\u00e9` for the last character
    // disagrees on every document carrying one of them.
    const escapes: FeatureConfig = {
      features: [
        {
          key: 'tab\tkey',
          enabled: true,
          variants: [
            {
              name: 'a',
              weight: 1,
              value: 'soh\u0001slash/sep\u2028lone\udfffnonascii\u00e9',
            },
          ],
        },
      ],
    };

    expect(configDigest(escapes)).toBe('452bf789ea05a29f371fa7c2190e17cf');
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

  it('disagrees between the largest and the smallest safe integer maxStale', () => {
    const largest: FeatureConfig = {
      ...document,
      maxStale: Number.MAX_SAFE_INTEGER,
    };
    const smallest: FeatureConfig = {
      ...document,
      maxStale: Number.MIN_SAFE_INTEGER,
    };

    expect(configDigest(smallest)).not.toBe(configDigest(largest));
  });

  it('disagrees between a numeric window instant and the string that spells it', () => {
    // `SerializedInstant` is `string | number`, so a holder that read the
    // instant as epoch milliseconds and a publisher that wrote the digits into
    // a string describe one window and digest apart.
    expect(configDigest(windowAt('41'))).not.toBe(configDigest(windowAt(41)));
  });

  it('agrees for a maxStale of 0 and one of -0', () => {
    const zero: FeatureConfig = { ...document, maxStale: 0 };
    const negative: FeatureConfig = { ...document, maxStale: -0 };

    expect(configDigest(negative)).toBe(configDigest(zero));
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

  it('pads a hash word narrower than 8 hex characters', () => {
    // The first word of this document's digest is 0x00871995. Joining the four
    // words unpadded returns 30 characters and loses the boundaries between
    // them, so a holder comparing against a correct publisher's 32 reports a
    // mismatch on a document nobody changed.
    expect(configDigest(document).slice(0, 8)).toBe('00871995');
  });

  it('leaves the digest member of the document it reads in place', () => {
    // `validateConfig` calls this on a document the holder keeps. Deleting the
    // member from the argument would leave the holder caching a document with
    // nothing to verify, and a second verification of the same object would
    // find no digest to check.
    const carried: FeatureConfig = { ...document, digest: 'not a digest' };

    configDigest(carried);

    expect(carried.digest).toBe('not a digest');
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
      expect(configDigest(document)).toBe('008719950c5f1e205da50d6e50510cc7');
    } finally {
      Reflect.set(globalThis, 'TextEncoder', encoder);
      Reflect.set(globalThis, 'structuredClone', clone);
    }
  });

  it('reads a subtree two paths share once', () => {
    // A getter counts the reads. `serializeConfig` preserves the sharing
    // `structuredClone` left in the store, so this is the graph the next call
    // walks: 16 levels of diamond give the leaf 2^16 paths.
    let reads = 0;
    const leaf = {
      get depth() {
        reads += 1;
        return 1;
      },
    };
    let held: object = leaf;
    for (let level = 0; level < 16; level += 1) held = { l: held, r: held };
    const shared = {
      features: [{ key: 'x', enabled: true }],
      schema: { features: { x: { variants: { held } } } },
    } as unknown as FeatureConfig;

    configDigest(shared);

    expect(reads).toBe(1);
  });

  it('agrees for a shared subtree and the copies JSON expands it into', () => {
    const leaf = { depth: 1 };
    const shared = {
      features: [{ key: 'x', enabled: true }],
      schema: { features: { x: { variants: { l: leaf, r: leaf } } } },
    } as unknown as FeatureConfig;
    const arrived = JSON.parse(JSON.stringify(shared)) as FeatureConfig;

    expect(configDigest(arrived)).toBe(configDigest(shared));
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
