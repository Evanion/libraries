import { describe, expect, it } from 'vitest';
import { validateBlocks } from './validate-blocks';

const registry = { hero: {}, tjanster: {} };

describe('validateBlocks', () => {
  it('returns no problems for a valid list', () => {
    const problems = validateBlocks(
      [{ type: 'hero', rubrik: 'Hej' }],
      registry,
      { hero: ['rubrik'] }
    );
    expect(problems).toEqual([]);
  });

  it('reports an unknown block type with its index', () => {
    const problems = validateBlocks([{ type: 'saknas' }], registry);
    expect(problems).toEqual([
      { index: 0, type: 'saknas', message: 'okänd blocktyp' },
    ]);
  });

  it('reports a missing required field', () => {
    const problems = validateBlocks([{ type: 'hero' }], registry, { hero: ['rubrik'] });
    expect(problems).toEqual([
      { index: 0, type: 'hero', message: 'saknar fältet rubrik' },
    ]);
  });

  it('treats an empty string as missing', () => {
    const problems = validateBlocks([{ type: 'hero', rubrik: '   ' }], registry, {
      hero: ['rubrik'],
    });
    expect(problems).toHaveLength(1);
  });

  it('validates nested children', () => {
    const problems = validateBlocks(
      [{ type: 'hero', rubrik: 'Hej', children: [{ type: 'nej' }] }],
      registry
    );
    expect(problems).toEqual([{ index: 0, type: 'nej', message: 'okänd blocktyp' }]);
  });

  it('reports a non-array input rather than throwing', () => {
    const problems = validateBlocks(undefined as never, registry);
    expect(problems).toEqual([
      { index: -1, type: '-', message: 'sektionslistan är inte en lista' },
    ]);
  });
});
