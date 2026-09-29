import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every file prettier's CLI would read under `root`, root-relative.
 *
 * `npx prettier --check .` walks the working tree and skips what the ignore
 * files cover, so a file the author has written but not committed is one of the
 * files it checks. `git ls-files` lists the index, which leaves every new file
 * out until the commit that adds it -- and the commit is after the point where
 * the author ran the verification command and read it as green. A branch that
 * adds five unformatted files passes the check that was written to hold them
 * and fails in CI. So the list is `--cached` and `--others`, which is the
 * working tree.
 *
 * `--exclude-standard` applies `.gitignore`, `.git/info/exclude` and the user's
 * global excludes, the way the CLI applies `.gitignore`. Prettier is asked
 * about each file afterwards, so `.prettierignore` is still read where it is
 * read in CI.
 *
 * A path the index holds and the working tree does not -- a staged deletion, a
 * file removed with `rm` -- is dropped, because prettier walks what is on disk
 * and reading it would throw. An unmerged path is listed once per stage during
 * a conflict, and the set drops the repeats.
 *
 * The IO is passed in so the rule can be asserted against a fixture
 * repository: this repository's own tree answers whatever it happens to hold
 * today.
 */
export function workingTreeFiles(root: string): string[] {
  const listed = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: root, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 },
  )
    .split('\0')
    .filter((path) => path !== '');

  return [...new Set(listed)]
    .filter((path) => existsSync(join(root, path)))
    .sort();
}
