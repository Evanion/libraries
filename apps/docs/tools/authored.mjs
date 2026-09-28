import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * The pages a person wrote, as absolute paths.
 *
 * `content/` holds two kinds of page: the ones written on `main` -- the
 * `/next/` tree and the sections with no version -- and the ones
 * `nx run docs:archives` generates for each release. The generated ones are
 * ignored by git, so "what a person wrote" is "what git does not ignore", and
 * nothing here lists which directories are which. A measurement or a check of
 * the site's own writing reads these; one that counted the generated pages
 * would count each page once per version.
 *
 * @param {string} docsRoot the docs app's directory
 */
export function authoredPages(docsRoot) {
  return execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'content'],
    { cwd: docsRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
    .split('\n')
    .filter((file) => file.endsWith('.mdx'))
    .sort()
    .map((file) => join(docsRoot, file));
}
