import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Asserts the build is server-rendered rather than prerendered.
 *
 * This is the one claim about the storefront that a unit test cannot make: every
 * page is on-demand, so there is no HTML on disk to assert against, and the
 * absence of that HTML is the assertion. A page that quietly became static would
 * bake the catalogue in and stop carrying the correlation id on a page view,
 * which is the reason the app exists.
 */

const appRoot = join(import.meta.dirname, '..');
const dist = join(appRoot, 'dist');

describe('the build output', () => {
  // `nx test` depends on `build`, so dist/ is normally already there; this builds
  // it when the file is run directly, e.g. from an editor or `vitest`.
  beforeAll(() => {
    if (!existsSync(join(dist, 'server', 'entry.mjs'))) {
      execFileSync('npx', ['astro', 'build'], { cwd: appRoot, stdio: 'pipe' });
    }
  }, 180_000);

  it('emits a server entry, which is what serves every page on demand', () => {
    expect(existsSync(join(dist, 'server', 'entry.mjs'))).toBe(true);
  });

  it('prerenders no page to html', () => {
    const prerendered = readdirSync(dist, { recursive: true }).filter(
      (entry) => typeof entry === 'string' && entry.endsWith('.html'),
    );

    expect(prerendered).toEqual([]);
  });

  it('emits the client assets the pages link to', () => {
    expect(existsSync(join(dist, 'client'))).toBe(true);
  });
});
