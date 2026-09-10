import { describe, expect, it } from 'vitest';
import { validateBlocks } from './validate-blocks';

const registry = { hero: {}, services: {} };

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

  it('reports a non-array input rather than throwing', () => {
    const problems = validateBlocks(undefined as never, registry);
    expect(problems).toEqual([
      { index: -1, type: '-', message: 'blocks is not a list' },
    ]);
  });
});
