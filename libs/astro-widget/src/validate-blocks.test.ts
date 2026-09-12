import { describe, expect, it } from 'vitest';
import { validateBlocks } from './validate-blocks';

const registry = { hero: {}, services: {} };

/**
 * Names `Object.prototype` carries. A CMS text field can hold any of them, and
 * a lookup written with `in` or a bare index finds them on the prototype of
 * every plain object.
 */
const inheritedKeys = [
  'constructor',
  'toString',
  'valueOf',
  'hasOwnProperty',
  '__proto__',
];

describe('validateBlocks', () => {
  it('returns no problems for a valid list', () => {
    const problems = validateBlocks(
      [{ type: 'hero', heading: 'Hello' }],
      registry,
      { hero: ['heading'] }
    );
    expect(problems).toEqual([]);
  });

  it('reports an unknown block type with its index', () => {
    const problems = validateBlocks([{ type: 'unknown-block' }], registry);
    expect(problems).toEqual([
      { index: 0, type: 'unknown-block', message: 'unknown block type' },
    ]);
  });

  it('reports a missing required field', () => {
    const problems = validateBlocks([{ type: 'hero' }], registry, { hero: ['heading'] });
    expect(problems).toEqual([
      { index: 0, type: 'hero', message: 'missing field heading' },
    ]);
  });

  it('treats an empty string as missing', () => {
    const problems = validateBlocks([{ type: 'hero', heading: '   ' }], registry, {
      hero: ['heading'],
    });
    expect(problems).toHaveLength(1);
  });

  it('validates nested children', () => {
    const problems = validateBlocks(
      [{ type: 'hero', heading: 'Hello', children: [{ type: 'also-unknown' }] }],
      registry
    );
    expect(problems).toEqual([{ index: 0, type: 'also-unknown', message: 'unknown block type' }]);
  });

  it.each(inheritedKeys)(
    'reports the inherited key %s as an unknown block type',
    (type) => {
      let problems: ReturnType<typeof validateBlocks> = [];
      expect(() => {
        problems = validateBlocks([{ type }], registry, { hero: ['heading'] });
      }).not.toThrow();

      expect(problems).toEqual([
        { index: 0, type, message: 'unknown block type' },
      ]);
    }
  );

  it.each(inheritedKeys)(
    'treats a required map without an entry for %s as no required fields',
    (type) => {
      let problems: ReturnType<typeof validateBlocks> = [];
      expect(() => {
        problems = validateBlocks([{ type }], { [type]: {} }, {});
      }).not.toThrow();

      expect(problems).toEqual([]);
    }
  );

  it('reads a required field off the block itself, not off its prototype', () => {
    const problems = validateBlocks([{ type: 'hero' }], registry, {
      hero: ['toString'],
    });
    expect(problems).toEqual([
      { index: 0, type: 'hero', message: 'missing field toString' },
    ]);
  });

  it('reports a non-array input rather than throwing', () => {
    const problems = validateBlocks(undefined as never, registry);
    expect(problems).toEqual([
      { index: -1, type: '-', message: 'blocks is not a list' },
    ]);
  });
});
