import { describe, expect, it } from 'vitest';

import {
  compareVersions,
  parseVersion,
  releaseLines,
  taggedPast,
} from './versions.mjs';

/**
 * The invariant: a package's lines hold what `npm install` resolves, newest
 * first, each is documented by its newest x.y.0 release, and a version sorts
 * where semver puts it.
 */

const order = (versions) =>
  [...versions].sort((a, b) =>
    compareVersions(parseVersion(a), parseVersion(b)),
  );

describe('the order of versions', () => {
  it('compares numeric prerelease identifiers as numbers', () => {
    expect(order(['1.0.0-beta.10', '1.0.0-beta.2'])).toEqual([
      '1.0.0-beta.2',
      '1.0.0-beta.10',
    ]);
  });

  it('puts a numeric identifier below an alphanumeric one, and a shorter list below a longer', () => {
    expect(
      order(['1.0.0-beta', '1.0.0-1', '1.0.0-beta.1', '1.0.0-alpha']),
    ).toEqual(['1.0.0-1', '1.0.0-alpha', '1.0.0-beta', '1.0.0-beta.1']);
  });

  it('puts a prerelease below its release', () => {
    expect(order(['1.0.0', '1.0.0-rc.1', '0.9.9'])).toEqual([
      '0.9.9',
      '1.0.0-rc.1',
      '1.0.0',
    ]);
  });
});

describe('the release lines of a package', () => {
  const tags = [
    '@evanion/urn@1.1.1',
    '@evanion/urn@2.0.0',
    '@evanion/urn@3.0.0-beta.0',
    '@evanion/urn@1.0.0',
    '@evanion/luhn@9.0.0',
  ];

  it('files releases by line, newest first', () => {
    expect(releaseLines('@evanion/urn', tags)).toEqual([
      {
        segment: 'v2',
        cut: { tag: '@evanion/urn@2.0.0', version: '2.0.0' },
        releases: [{ tag: '@evanion/urn@2.0.0', version: '2.0.0' }],
      },
      {
        segment: 'v1',
        cut: { tag: '@evanion/urn@1.1.1', version: '1.1.1' },
        releases: [
          { tag: '@evanion/urn@1.1.1', version: '1.1.1' },
          { tag: '@evanion/urn@1.0.0', version: '1.0.0' },
        ],
      },
    ]);
  });

  it('cuts a line from its x.y.0 and not from a patch of it', () => {
    const [line] = releaseLines('@evanion/luhn', [
      '@evanion/luhn@3.0.0',
      '@evanion/luhn@3.0.1',
    ]);

    expect(line.cut).toEqual({ tag: '@evanion/luhn@3.0.0', version: '3.0.0' });
  });

  it('cuts a line from its newest x.y.0', () => {
    const [line] = releaseLines('@evanion/luhn', [
      '@evanion/luhn@3.0.0',
      '@evanion/luhn@3.0.1',
      '@evanion/luhn@3.1.0',
    ]);

    expect(line.cut.version).toBe('3.1.0');
  });

  /** Below 1.0.0 the minor is the breaking bump, so 0.4.0 opens a line. */
  it('cuts a 0.x line from its 0.y.0 and keeps the line 0.4.0 supersedes', () => {
    const tags = [
      '@evanion/token@0.3.0',
      '@evanion/token@0.3.1',
      '@evanion/token@0.4.0',
    ];

    expect(
      releaseLines('@evanion/token', tags.slice(0, 2)).map((line) => [
        line.segment,
        line.cut.version,
      ]),
    ).toEqual([['v0.3', '0.3.0']]);
    expect(
      releaseLines('@evanion/token', tags).map((line) => [
        line.segment,
        line.cut.version,
      ]),
    ).toEqual([
      ['v0.4', '0.4.0'],
      ['v0.3', '0.3.0'],
    ]);
  });

  /** A x.y released before this repository tagged is cut from its first tag. */
  it('cuts a line whose x.y.0 has no tag from the first tag of its x.y', () => {
    const [line] = releaseLines('@evanion/urn', [
      '@evanion/urn@1.0.0',
      '@evanion/urn@1.1.1',
      '@evanion/urn@1.1.2',
    ]);

    expect(line.cut.version).toBe('1.1.1');
  });

  it('leaves a prerelease out of every line', () => {
    expect(releaseLines('@evanion/urn', ['@evanion/urn@3.0.0-beta.0'])).toEqual(
      [],
    );
  });

  it('names every tag of a later x.y, prereleases included', () => {
    expect(taggedPast('@evanion/urn', tags, '1.1.1')).toEqual([
      '@evanion/urn@3.0.0-beta.0',
      '@evanion/urn@2.0.0',
    ]);
    expect(taggedPast('@evanion/urn', tags, '2.0.0')).toEqual([
      '@evanion/urn@3.0.0-beta.0',
    ]);
    expect(taggedPast('@evanion/urn', tags, '1.0.0')).toEqual([
      '@evanion/urn@3.0.0-beta.0',
      '@evanion/urn@2.0.0',
      '@evanion/urn@1.1.1',
    ]);
  });

  it('names no patch of the version as past it', () => {
    expect(
      taggedPast(
        '@evanion/luhn',
        ['@evanion/luhn@3.0.1', '@evanion/luhn@3.0.2-rc.0'],
        '3.0.0',
      ),
    ).toEqual([]);
  });
});
