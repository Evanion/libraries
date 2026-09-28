import { describe, expect, it } from 'vitest';
import { packageFor, versionOptions } from './sections';

/**
 * The invariant: a route names one package, one version of it, and one page,
 * and the grammar in `docs/specs/2026-09-13-released-by-default.md` § 1 is the
 * only thing deciding which.
 */
describe('the section a route is in', () => {
  it('is the newest release on the bare path', () => {
    expect(packageFor(['luhn', 'usage'])).toMatchObject({
      entry: { slug: 'luhn' },
      segment: null,
      next: false,
      page: ['usage'],
    });
  });

  it('is a release line under a version segment', () => {
    expect(packageFor(['urn', 'v1', 'api'])).toMatchObject({
      entry: { slug: 'urn' },
      segment: 'v1',
      next: false,
      page: ['api'],
    });
  });

  /** Below 1.0.0 the minor is the breaking bump, so the segment carries it. */
  it('reads a zero-major segment with its minor', () => {
    expect(packageFor(['react-widget', 'v0.2'])).toMatchObject({
      entry: { slug: 'react-widget' },
      segment: 'v0.2',
      page: [],
    });
  });

  it('is main under /next/', () => {
    expect(packageFor(['next', 'luhn', 'usage'])).toMatchObject({
      entry: { slug: 'luhn' },
      segment: null,
      next: true,
      page: ['usage'],
    });
  });

  /** `/next/` is `main`, which has no release lines of its own. */
  it('reads no version segment under /next/', () => {
    expect(packageFor(['next', 'urn', 'v1'])).toMatchObject({
      segment: null,
      next: true,
      page: ['v1'],
    });
  });

  it('is no section outside a package', () => {
    expect(packageFor(['testing'])).toBeNull();
    expect(packageFor(['next'])).toBeNull();
  });

  it('reads a page named like a version as a page when it is not one', () => {
    expect(packageFor(['luhn', 'version'])).toMatchObject({
      segment: null,
      page: ['version'],
    });
  });
});

/**
 * The invariant: every version the switcher offers is a page the export wrote,
 * and an entry that cannot keep the reader on their page says so.
 */
describe('the versions of a page', () => {
  const urn = {
    current: { version: '2.0.0', segment: 'v2', pages: ['', 'api'] },
    lines: [{ version: '1.1.1', segment: 'v1', pages: ['', 'api'] }],
    next: { pages: ['', 'api', 'components'] },
  };

  it('goes to the same page in each version', () => {
    const section = packageFor(['urn', 'api']);

    expect(section && versionOptions(section, urn)).toEqual([
      { label: '2.0.0', href: '/urn/api/', active: true, missing: false },
      { label: '1.1.1', href: '/urn/v1/api/', active: false, missing: false },
      { label: 'main', href: '/next/urn/api/', active: false, missing: false },
    ]);
  });

  it('goes to the index of a version that has no such page, and says so', () => {
    const section = packageFor(['next', 'urn', 'components']);

    expect(section && versionOptions(section, urn)).toEqual([
      { label: '2.0.0', href: '/urn/', active: false, missing: true },
      { label: '1.1.1', href: '/urn/v1/', active: false, missing: true },
      {
        label: 'main',
        href: '/next/urn/components/',
        active: true,
        missing: false,
      },
    ]);
  });

  it('marks the release line the reader is on', () => {
    const section = packageFor(['urn', 'v1']);

    expect(
      section && versionOptions(section, urn).map((option) => option.active),
    ).toEqual([false, true, false]);
  });

  /** With no release, the bare path and `/next/` are the same pages. */
  it('offers nothing for a package with no release', () => {
    const section = packageFor(['react-acl']);

    expect(
      section &&
        versionOptions(section, {
          current: { version: null, segment: null, pages: [''] },
          lines: [],
          next: { pages: [''] },
        }),
    ).toEqual([]);
  });
});
