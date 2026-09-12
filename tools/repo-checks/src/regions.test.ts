import { describe, expect, it } from 'vitest';

import { RegionError, parseRegions, readRegion } from '@evanion/doc-examples';

/**
 * Named regions are what the docs app renders instead of its own copy of an
 * example. Every malformed case throws, because the alternative is a docs page
 * quietly rendering something other than what the README ships.
 */

const fence = '```';

const source = [
  '# Luhn',
  '',
  '<!-- #region quick-start -->',
  `${fence}ts @import.meta.vitest`,
  "const { checksum } = Luhn.generate('foo');",
  "expect(checksum).toEqual('5');",
  fence,
  '<!-- #endregion quick-start -->',
  '',
  'Prose.',
  '',
  '<!-- #region hex -->',
  `${fence}ts`,
  "createLuhn({ dictionary: '0123456789abcdef' });",
  fence,
  '<!-- #endregion hex -->',
].join('\n');

describe('parseRegions', () => {
  it('finds every region', () => {
    expect([...parseRegions(source, 'README.md').keys()]).toEqual([
      'quick-start',
      'hex',
    ]);
  });

  it('returns the code without the fences', () => {
    expect(parseRegions(source, 'README.md').get('quick-start')?.code).toBe(
      "const { checksum } = Luhn.generate('foo');\nexpect(checksum).toEqual('5');",
    );
  });

  it('strips the doctest marker from the language', () => {
    expect(parseRegions(source, 'README.md').get('quick-start')?.lang).toBe(
      'ts',
    );
  });

  it('ignores prose outside any region', () => {
    expect(parseRegions(source, 'README.md').size).toBe(2);
  });

  it('rejects a region wrapping no code block', () => {
    const empty = [
      '<!-- #region x -->',
      'just prose',
      '<!-- #endregion x -->',
    ].join('\n');

    expect(() => parseRegions(empty, 'README.md')).toThrow(/expected exactly 1/);
  });

  it('rejects a region wrapping two code blocks', () => {
    const two = [
      '<!-- #region x -->',
      `${fence}ts`,
      'a();',
      fence,
      `${fence}ts`,
      'b();',
      fence,
      '<!-- #endregion x -->',
    ].join('\n');

    expect(() => parseRegions(two, 'README.md')).toThrow(/expected exactly 1/);
  });

  it('rejects a region that is never closed', () => {
    const open = ['<!-- #region x -->', `${fence}ts`, 'a();', fence].join('\n');

    expect(() => parseRegions(open, 'README.md')).toThrow(/never closed/);
  });

  it('rejects a mismatched #endregion name', () => {
    const crossed = [
      '<!-- #region x -->',
      `${fence}ts`,
      'a();',
      fence,
      '<!-- #endregion y -->',
    ].join('\n');

    expect(() => parseRegions(crossed, 'README.md')).toThrow(RegionError);
  });

  it('rejects a duplicate region name', () => {
    const twice = [
      '<!-- #region x -->',
      `${fence}ts`,
      'a();',
      fence,
      '<!-- #endregion x -->',
      '<!-- #region x -->',
      `${fence}ts`,
      'b();',
      fence,
      '<!-- #endregion x -->',
    ].join('\n');

    expect(() => parseRegions(twice, 'README.md')).toThrow(/defined twice/);
  });
});

describe('readRegion', () => {
  it('reads one region', () => {
    expect(readRegion(source, 'README.md', 'hex').code).toContain('createLuhn');
  });

  it('lists the regions that do exist when one is missing', () => {
    expect(() => readRegion(source, 'README.md', 'quickstart')).toThrow(
      /Regions in this file: hex, quick-start/,
    );
  });
});
