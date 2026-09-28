import { describe, expect, it } from 'vitest';
import { packageFor } from './sections';

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
