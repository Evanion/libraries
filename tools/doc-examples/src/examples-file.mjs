import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/**
 * Where a package keeps the examples the docs site cites.
 *
 * The README is the package's npm landing page and carries one example. Every
 * region a docs page or a reference entry names lives in `docs/examples.md`,
 * which `files` in the package's `package.json` leaves out of the tarball.
 * Both files run as tests of the package, through `MARKDOWN_SOURCES`.
 */
export const EXAMPLES_FILE = 'docs/examples.md';

/** The markdown files whose doctest fences run, relative to the package. */
export const MARKDOWN_SOURCES = ['README.md', 'docs/**/*.md'];

/**
 * The package directory a markdown file of examples belongs to.
 *
 * A path operation only, because the cut reads a page's regions out of git at
 * a pinned commit, where there is no directory to look in. The preamble sits at
 * the package root, beside `README.md` and one level above `docs/`.
 */
export function packageDirOf(file) {
  const dir = dirname(file);
  return basename(dir) === 'docs' ? dirname(dir) : dir;
}

/**
 * The file a package's reference examples come from.
 *
 * `docs/examples.md`, or `README.md` for a tree from before the examples moved
 * out of it. The cut materialises a package from its release tag, and a tag
 * older than the move holds every region in the README.
 */
export function examplesFileIn(packageDir) {
  const examples = join(packageDir, EXAMPLES_FILE);
  return existsSync(examples) ? examples : join(packageDir, 'README.md');
}
