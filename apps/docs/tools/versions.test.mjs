import { describe, expect, it } from 'vitest';

import {
  compareVersions,
  parseVersion,
  releaseLines,
  taggedAfter,
} from './versions.mjs';

/**
 * The invariant: a package's lines hold what `npm install` resolves, newest
 * first, and a version sorts where semver puts it.
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
        releases: [{ tag: '@evanion/urn@2.0.0', version: '2.0.0' }],
      },
      {
        segment: 'v1',
        releases: [
          { tag: '@evanion/urn@1.1.1', version: '1.1.1' },
          { tag: '@evanion/urn@1.0.0', version: '1.0.0' },
        ],
      },
    ]);
  });

  it('leaves a prerelease out of every line', () => {
    expect(releaseLines('@evanion/urn', ['@evanion/urn@3.0.0-beta.0'])).toEqual(
      [],
    );
  });

  it('names every tag above a version, prereleases included', () => {
    expect(taggedAfter('@evanion/urn', tags, '1.1.1')).toEqual([
      '@evanion/urn@3.0.0-beta.0',
      '@evanion/urn@2.0.0',
    ]);
    expect(taggedAfter('@evanion/urn', tags, '2.0.0')).toEqual([
      '@evanion/urn@3.0.0-beta.0',
    ]);
  });
});
