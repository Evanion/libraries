import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import * as prettier from 'prettier';
import { describe, expect, it } from 'vitest';

/**
 * Every tracked file prettier can parse carries the formatting prettier gives
 * it.
 *
 * `.github/workflows/ci.yml` gives `npx prettier --check .` a job of its own,
 * ahead of lint, test and build. Nothing in `nx lint` reads formatting:
 * `eslint.config.mjs` loads no prettier plugin. A branch one column past the
 * 80-character `printWidth` is green under `nx affected -t test lint build` and
 * red in CI, so the same question CI asks gets asked inside a task Nx schedules
 * and caches.
 *
 * The file list is `git ls-files`, which is the tree a fresh checkout carries
 * and therefore the tree the CI job formats. Prettier's own API answers for
 * each file, with `.prettierignore` and `.gitignore` as the ignore files the
 * 3.x CLI defaults to and `.prettierrc` resolved per file, so the verdict here
 * and the verdict in CI come from one implementation.
 *
 * A file prettier infers no parser for is skipped, the way the CLI skips it.
 * That is where the repository's binaries and its extensionless files go.
 *
 * The failure reports the file and not the diff, because `npx prettier --write
 * <file>` is the whole repair.
 */

/**
 * The ignore files prettier 3's CLI reads when none is named.
 *
 * Absolute, because prettier resolves a relative ignore path against
 * `process.cwd()` and Nx runs this project's `test` target from
 * `tools/repo-checks`. Relative names there find no ignore file at all, and
 * every path `.prettierignore` covers -- the generated token sheet, every
 * CHANGELOG.md -- gets read as debt.
 */
const IGNORE = ['.gitignore', '.prettierignore'].map((name) =>
  join(workspaceRoot, name),
);

/** Every file git tracks, workspace-relative. */
function trackedFiles(): string[] {
  return execFileSync('git', ['ls-files', '-z'], {
    cwd: workspaceRoot,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter((path) => path !== '');
}

/** Whether prettier would rewrite `path`, or null where it does not read it. */
async function isFormatted(path: string): Promise<boolean | null> {
  const file = join(workspaceRoot, path);
  const info = await prettier.getFileInfo(file, { ignorePath: IGNORE });
  if (info.ignored || info.inferredParser === null) return null;

  const options = await prettier.resolveConfig(file);

  return prettier.check(readFileSync(file, 'utf-8'), {
    ...options,
    filepath: file,
  });
}

describe('a tracked file', () => {
  it('carries the formatting prettier gives it', async () => {
    const unformatted: string[] = [];

    for (const path of trackedFiles()) {
      if ((await isFormatted(path)) === false) unformatted.push(path);
    }

    expect(
      unformatted.sort(),
      'CI runs `npx prettier --check .` as its own job. Run ' +
        '`npx prettier --write` over the files named here.',
    ).toEqual([]);
  });
});
