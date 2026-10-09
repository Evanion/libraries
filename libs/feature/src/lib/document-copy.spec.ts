import { describe, expect, it } from 'vitest';

import { configCopier, documentCopy } from './document-copy.js';
import { FeatureConfigError } from './errors.js';
import { createFeatures } from './features.js';

/** A definition whose one served variant carries `value`. */
function carrying(value: unknown): unknown {
  return {
    key: 'cta',
    enabled: true,
    variantBy: 'targetingKey',
    variantSeed: 'cta:variant',
    variants: [{ name: 'blue', weight: 1, order: 0, value }],
  };
}

/** A value nested deeper than `recurse` walks on the runtime this runs on. */
function nestedPast(recurse: (value: unknown) => unknown): unknown {
  for (let depth = 2_000; depth <= 512_000; depth *= 2) {
    let value: unknown = 1;
    for (let at = 0; at < depth; at += 1) value = [value];
    try {
      recurse(value);
    } catch {
      return value;
    }
  }
  throw new Error(
    'no array nested 512000 levels deep exhausted the stack this runtime hands the walk, so the cases over it name a refusal nothing produces',
  );
}

/** A definition holding itself, which is the cycle no document carries. */
function cyclic(): unknown {
  const value: Record<string, unknown> = {};
  value['holds'] = value;
  return carrying(value);
}

describe('documentCopy', () => {
  it('copies a nested object by value', () => {
    const value = { label: 'buy' };
    const source = { variants: [{ name: 'blue', value }] };

    const copy = documentCopy(source);
    value.label = 'moved';

    expect(copy.variants[0]?.value.label).toBe('buy');
  });

  it('copies a nested array by value', () => {
    const source = { dependsOn: ['checkout', 'express'] };

    const copy = documentCopy(source);
    source.dependsOn[1] = 'moved';

    expect(copy.dependsOn).toEqual(['checkout', 'express']);
  });

  it('copies a null, each primitive and an empty object', () => {
    const source = {
      nothing: null,
      text: 'buy',
      count: 41,
      on: true,
      bare: {},
      empty: [],
    };

    expect(documentCopy(source)).toEqual(source);
  });

  it('writes a member named __proto__ as an own member and no prototype', () => {
    const source = JSON.parse('{"__proto__":{"polluted":true}}') as object;

    const copy = documentCopy(source);

    expect(Object.getPrototypeOf(copy)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(copy, '__proto__')?.value).toEqual({
      polluted: true,
    });
  });

  it('raises the typed error every refusal over a supplied configuration is', () => {
    const copy = () => documentCopy(carrying(() => 1));

    expect(copy).toThrow(FeatureConfigError);
  });

  it('names the path and the thing for a value no document carries', () => {
    const refused: Record<string, unknown> = {
      function: carrying(() => 1),
      symbol: carrying(Symbol('blue')),
      Date: carrying(new Date('2026-10-09T00:00:00.000Z')),
      RegExp: carrying(/blue/),
      Map: carrying(new Map()),
      Uint8Array: carrying(new Uint8Array([1, 2, 3])),
    };

    const messages = Object.entries(refused).map(([noun, value]) => {
      try {
        documentCopy(value);
        return `${noun} raised nothing`;
      } catch (raise) {
        return raise instanceof Error ? raise.message : String(raise);
      }
    });

    expect(messages).toEqual([
      '"/variants/0/value" carries a function, and a document carries none',
      '"/variants/0/value" carries a symbol, and a document carries none',
      '"/variants/0/value" carries a Date, and a document carries none',
      '"/variants/0/value" carries a RegExp, and a document carries none',
      '"/variants/0/value" carries a Map, and a document carries none',
      '"/variants/0/value" carries a Uint8Array, and a document carries none',
    ]);
  });

  it('names the path a value holding itself closes at', () => {
    const copy = () => documentCopy(cyclic());

    expect(copy).toThrow(
      '"/variants/0/value/holds" carries a cycle, and a document carries none',
    );
  });

  it('raises the host RangeError and no typed error past the depth it walks', () => {
    const deep = nestedPast(documentCopy);
    const copy = () => documentCopy(deep);

    expect(copy).toThrow(RangeError);
    expect(copy).not.toThrow(FeatureConfigError);
  });
});

describe('configCopier', () => {
  it('answers structuredClone where the global is a function', () => {
    expect(configCopier()).toBe(globalThis.structuredClone);
  });

  it('answers documentCopy where globalThis carries no structuredClone', () => {
    const clone = globalThis.structuredClone;
    Reflect.deleteProperty(globalThis, 'structuredClone');

    try {
      expect(configCopier()).toBe(documentCopy);
    } finally {
      Reflect.set(globalThis, 'structuredClone', clone);
    }
  });
});

describe('the construction path on a host defining no structuredClone', () => {
  it('builds a store from a literal with structuredClone deleted', () => {
    // The third leg § 8 of `docs/specs/2026-09-23-feature-hydration.md`
    // names. `parse.spec.ts` covers a document a holder accepts and one it
    // refuses, `reload.spec.ts` covers the install, and `createFeatures` over a
    // bare array takes the same copy and installs no envelope.
    const clone = globalThis.structuredClone;
    Reflect.deleteProperty(globalThis, 'structuredClone');

    try {
      const features = createFeatures([
        { key: 'checkout', enabled: true },
        { key: 'express', enabled: true, dependsOn: ['checkout'] },
      ]);

      expect(features.isEnabled('express')).toBe(true);
    } finally {
      Reflect.set(globalThis, 'structuredClone', clone);
    }
  });

  it('throws the path out of a literal carrying a value no document holds', () => {
    const clone = globalThis.structuredClone;
    Reflect.deleteProperty(globalThis, 'structuredClone');

    try {
      const build = () =>
        createFeatures([
          {
            key: 'cta',
            enabled: true,
            variantBy: 'targetingKey',
            variantSeed: 'cta:variant',
            variants: [{ name: 'blue', weight: 1, value: new Date() }],
          },
        ]);

      expect(build).toThrow(
        '"/variants/0/value" carries a Date, and a document carries none',
      );
    } finally {
      Reflect.set(globalThis, 'structuredClone', clone);
    }
  });
});
