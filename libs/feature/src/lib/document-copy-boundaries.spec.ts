import { describe, expect, it } from 'vitest';

import type { FeatureConfig } from './config.js';
import { configCopier, documentCopy } from './document-copy.js';
import { FeatureConfigError } from './errors.js';
import { createFeatures } from './features.js';
import { parseFeatureConfig } from './parse.js';
import { validateConfig } from './validate.js';

/**
 * The two definition-level members § 3 of
 * `docs/specs/2026-09-23-feature-config-distribution.md` has a served document
 * state on every feature declaring variants. `order` is the third and it sits
 * on each variant.
 */
const TRAVELS = {
  variantBy: 'targetingKey',
  variantSeed: 'cta:variant',
} as const;

/** A served definition whose one variant carries `value`. */
function carrying(value: unknown): unknown {
  return {
    key: 'cta',
    enabled: true,
    ...TRAVELS,
    variants: [{ name: 'blue', weight: 1, order: 0, value }],
  };
}

/** The text a raise carries, or the sentence saying it raised nothing. */
function raised(run: () => unknown): string {
  try {
    run();
    return 'raised nothing';
  } catch (raise) {
    return raise instanceof Error ? raise.message : String(raise);
  }
}

/**
 * Reads `ask` on the host § 8 of
 * `docs/specs/2026-09-23-feature-hydration.md` names: a native client
 * embedding a JavaScript engine with no DOM, which provides `JSON` and neither
 * `TextEncoder` nor `structuredClone`.
 *
 * Both globals are restored in a `finally`, so a raise out of `ask` leaves the
 * rest of this file running on the host it started on.
 */
function onJsonOnlyHost<T>(ask: () => T): T {
  const encoder = globalThis.TextEncoder;
  const clone = globalThis.structuredClone;
  Reflect.deleteProperty(globalThis, 'TextEncoder');
  Reflect.deleteProperty(globalThis, 'structuredClone');

  try {
    return ask();
  } finally {
    Reflect.set(globalThis, 'TextEncoder', encoder);
    Reflect.set(globalThis, 'structuredClone', clone);
  }
}

describe('documentCopy', () => {
  it('hands back a copy and not the value it was handed', () => {
    const object = { version: 1 };
    const array = ['checkout'];
    const empty = {};

    expect([
      documentCopy(object) === object,
      documentCopy(array) === array,
      documentCopy(empty) === empty,
    ]).toEqual([false, false, false]);
  });

  it('names the empty pointer for a value handed over whole', () => {
    const copy = () => documentCopy(() => 1);

    expect(copy).toThrow('"" carries a function, and a document carries none');
  });

  it('escapes a slash and a tilde in the member name it points at', () => {
    const copy = () => documentCopy({ 'a/b~c': { d: new Date(0) } });

    expect(copy).toThrow(
      '"/a~1b~0c/d" carries a Date, and a document carries none',
    );
  });

  it('refuses a bigint, which JSON states no form of', () => {
    const copy = () => documentCopy(carrying(BigInt(41)));

    expect(copy).toThrow(
      '"/variants/0/value" carries a bigint, and a document carries none',
    );
  });

  it('refuses the Set and the ArrayBuffer a reload diff reads off a variant', () => {
    const refused = [
      raised(() => documentCopy(carrying(new Set([1])))),
      raised(() => documentCopy(carrying(new ArrayBuffer(4)))),
    ];

    expect(refused).toEqual([
      '"/variants/0/value" carries a Set, and a document carries none',
      '"/variants/0/value" carries a ArrayBuffer, and a document carries none',
    ]);
  });

  it("names the author's own class where a variant value carries an instance", () => {
    class Widget {
      readonly label = 'buy';
    }

    const copy = () => documentCopy(carrying(new Widget()));

    expect(copy).toThrow(
      '"/variants/0/value" carries a Widget, and a document carries none',
    );
  });

  it('names an object where its prototype declares no constructor', () => {
    const inherited = Object.create(Object.create(null)) as object;

    const copy = () => documentCopy(carrying(inherited));

    expect(copy).toThrow(
      '"/variants/0/value" carries a object, and a document carries none',
    );
  });

  it('copies the members of an object an author built with no prototype', () => {
    const bare = Object.create(null) as Record<string, unknown>;
    bare['label'] = 'buy';

    expect(documentCopy({ value: bare })).toEqual({ value: { label: 'buy' } });
  });

  it('refuses the first member no document carries where two of them do', () => {
    const copy = () =>
      documentCopy({ first: new Map(), second: Symbol('second') });

    expect(copy).toThrow('"/first" carries a Map, and a document carries none');
  });

  it('carries a non-finite number and a negative zero, which a JSON round trip loses', () => {
    const source = {
      nan: Number.NaN,
      up: Number.POSITIVE_INFINITY,
      down: Number.NEGATIVE_INFINITY,
      zero: -0,
    };

    const copy = documentCopy(source);

    expect([
      Number.isNaN(copy.nan),
      copy.up,
      copy.down,
      Object.is(copy.zero, -0),
    ]).toEqual([
      true,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      true,
    ]);
  });

  it('carries the largest and the smallest number a document states', () => {
    const source = {
      largest: Number.MAX_SAFE_INTEGER,
      smallest: Number.MIN_SAFE_INTEGER,
      tiny: Number.MIN_VALUE,
      step: Number.EPSILON,
      long: 'é'.repeat(1_000),
    };

    expect(documentCopy(source)).toEqual(source);
  });

  it('carries a member whose value is undefined, the way structuredClone does', () => {
    const copy = documentCopy({ pinned: undefined, key: 'cta' });

    expect([Object.keys(copy), 'pinned' in copy]).toEqual([
      ['pinned', 'key'],
      true,
    ]);
  });

  it('drops a member a symbol keys, which no document carries', () => {
    const marker = Symbol('served');
    const source = { [marker]: 1, key: 'cta' };

    const copy = documentCopy(source);

    expect([Object.getOwnPropertySymbols(copy), copy.key]).toEqual([[], 'cta']);
  });

  it('copies one subtree twice where two pointers share it', () => {
    const shared = { label: 'buy' };

    const copy = documentCopy({ left: shared, right: shared });

    expect([
      copy.left === copy.right,
      copy.left === shared,
      copy.right,
    ]).toEqual([false, false, { label: 'buy' }]);
  });

  it('names the pointer an array holding itself closes at', () => {
    const loop: unknown[] = [];
    loop.push(loop);

    const copy = () => documentCopy(carrying(loop));

    expect(copy).toThrow(
      '"/variants/0/value/0" carries a cycle, and a document carries none',
    );
  });

  it('hands back a writable copy of the frozen document a store holds', () => {
    const installed = Object.freeze({
      features: Object.freeze([Object.freeze({ key: 'checkout' })]),
    });

    const copy = documentCopy(installed);

    expect([
      Object.isFrozen(copy),
      Object.isFrozen(copy.features),
      copy.features[0]?.key,
    ]).toEqual([false, false, 'checkout']);
  });

  it('copies an array of one element and an array of none', () => {
    const source = { one: ['checkout'], none: [] as readonly string[] };

    const copy = documentCopy(source);

    expect([copy.one, copy.none, copy.one === source.one]).toEqual([
      ['checkout'],
      [],
      false,
    ]);
  });

  it('raises the typed error for every value no document carries', () => {
    const values = [
      () => 1,
      Symbol('blue'),
      new Date(0),
      /blue/,
      new Map(),
      new Uint8Array([1]),
      BigInt(1),
    ];

    const typed = values.map((value) => {
      try {
        documentCopy(carrying(value));
        return 'raised nothing';
      } catch (raise) {
        return raise instanceof FeatureConfigError ? 'typed' : 'untyped';
      }
    });

    expect(typed).toEqual(Array.from(values, () => 'typed'));
  });
});

describe('configCopier', () => {
  it('answers documentCopy where globalThis carries structuredClone as no function', () => {
    const clone = globalThis.structuredClone;

    const answers = [undefined, null, 'structuredClone', 41].map((carried) => {
      Reflect.set(globalThis, 'structuredClone', carried);
      try {
        return configCopier() === documentCopy;
      } finally {
        Reflect.set(globalThis, 'structuredClone', clone);
      }
    });

    expect(answers).toEqual([true, true, true, true]);
  });

  it('answers a copier that copies rather than one that hands its argument back', () => {
    const source = { variants: [{ name: 'blue', value: { label: 'buy' } }] };

    const copy = configCopier()(source);
    source.variants[0]!.value.label = 'moved';

    expect([copy === source, copy.variants[0]?.value.label]).toEqual([
      false,
      'buy',
    ]);
  });
});

describe('the envelope a document installs on a host defining no structuredClone', () => {
  /**
   * A document whose `maxStale` carries a `Date`. `memberIssues` names the six
   * top-level members and declares nothing about this one's value, so the
   * checker passes it and `envelopeOf` is the reader that meets it.
   */
  const stale = {
    version: 1,
    maxStale: new Date('2026-01-01T00:00:00.000Z'),
    features: [{ key: 'checkout', enabled: true }],
  } as unknown as FeatureConfig;

  it('clears the checker and builds a store where the host defines the global', () => {
    expect([validateConfig(stale), parseFeatureConfig(stale).ok]).toEqual([
      { ok: true },
      true,
    ]);
  });

  it('throws the pointer of the envelope member where the host defines none', () => {
    const thrown = onJsonOnlyHost(() => raised(() => createFeatures(stale)));

    expect(thrown).toBe(
      '"/maxStale" carries a Date, and a document carries none',
    );
  });

  it('reports the text it throws where parseFeatureConfig reads the same bytes', () => {
    const result = onJsonOnlyHost(() => parseFeatureConfig(stale));

    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'unknown-member',
        message: '"/maxStale" carries a Date, and a document carries none',
      },
    ]);
  });

  it('leaves the installed document deciding where reload refuses the envelope', () => {
    const store = createFeatures({
      version: 1,
      features: [{ key: 'checkout', enabled: true }],
    } as FeatureConfig);

    const answers = onJsonOnlyHost(() => ({
      result: store.reload(stale),
      enabled: store.isEnabled('checkout'),
      version: store.version,
    }));

    expect(answers).toEqual({
      result: {
        ok: false,
        version: 1,
        rejected: 1,
        issues: [
          {
            code: 'unknown-member',
            message: '"/maxStale" carries a Date, and a document carries none',
          },
        ],
      },
      enabled: true,
      version: 1,
    });
  });
});

describe('reload on a host defining no structuredClone', () => {
  it('keys the refusal on the definition the second row of the candidate carries', () => {
    const store = createFeatures({
      version: 1,
      features: [{ key: 'checkout', enabled: true }],
    } as FeatureConfig);
    const candidate = {
      version: 2,
      features: [{ key: 'checkout', enabled: true }, carrying(() => 1)],
    } as unknown as FeatureConfig;

    const result = onJsonOnlyHost(() => store.reload(candidate));

    expect(result).toEqual({
      ok: false,
      version: 1,
      rejected: 2,
      issues: [
        {
          code: 'unknown-member',
          message:
            'feature "cta" carries a value no copy of the definition holds: ' +
            '"/variants/0/value" carries a function, and a document carries none',
          key: 'cta',
          path: '/features/1',
        },
      ],
    });
  });
});

describe('a variant value the two hosts answer differently', () => {
  /**
   * Open question 5 of
   * `docs/superpowers/plans/2026-10-09-feature-hydration.md` is where the owner
   * rules on this split. `structuredClone` carries a `Date` into the store and
   * the `reload` diff reads it; `documentCopy` refuses it, because § 1 of
   * `docs/specs/2026-09-23-feature-config-distribution.md` gives a served
   * document JSON and JSON writes no `Date`.
   */
  const dated = {
    version: 1,
    features: [carrying(new Date('2026-01-01T00:00:00.000Z'))],
  } as unknown as FeatureConfig;

  it('installs the document where the host defines structuredClone', () => {
    expect(parseFeatureConfig(dated).ok).toBe(true);
  });

  it('refuses the same document where the host defines none', () => {
    const result = onJsonOnlyHost(() => parseFeatureConfig(dated));

    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'unknown-member',
        message:
          'feature "cta" carries a value no copy of the definition holds: ' +
          '"/variants/0/value" carries a Date, and a document carries none',
        key: 'cta',
        path: '/features/0',
      },
    ]);
  });
});
