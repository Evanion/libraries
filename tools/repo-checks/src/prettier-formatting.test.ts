import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import * as prettier from 'prettier';
import { afterAll, describe, expect, it } from 'vitest';

import { workingTreeFiles } from './prettier-formatting.js';

/**
 * Every file prettier can parse carries the formatting prettier gives it.
 *
 * `.github/workflows/ci.yml` gives `npx prettier --check .` a job of its own,
 * ahead of lint, test and build. Nothing in `nx lint` reads formatting:
 * `eslint.config.mjs` loads no prettier plugin. A branch one column past the
 * 80-character `printWidth` is green under `nx affected -t test lint build` and
 * red in CI, so the same question CI asks gets asked inside a task Nx schedules
 * and caches.
 *
 * The file list is the working tree, which is what the CI job walks and what
 * the author has in front of them. {@link workingTreeFiles} says why the index
 * is the wrong list. Prettier's own API answers for each file, with
 * `.prettierignore` and `.gitignore` as the ignore files the 3.x CLI defaults
 * to and `.prettierrc` resolved per file, so the verdict here and the verdict
 * in CI come from one implementation.
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

describe('a file in the working tree', () => {
  it('carries the formatting prettier gives it', async () => {
    const unformatted: string[] = [];

    for (const path of workingTreeFiles(workspaceRoot)) {
      if ((await isFormatted(path)) === false) unformatted.push(path);
    }

    expect(
      unformatted.sort(),
      'CI runs `npx prettier --check .` as its own job. Run ' +
        '`npx prettier --write` over the files named here.',
    ).toEqual([]);
  });
});

/**
 * The file list, against fixture repositories.
 *
 * Read against this repository it answers whatever this repository holds while
 * the suite runs, and the state that matters -- a file written and not
 * committed -- is one a clean checkout never has.
 */
describe('the working tree list', () => {
  const fixtures: string[] = [];

  afterAll(() => {
    for (const root of fixtures) rmSync(root, { recursive: true, force: true });
  });

  /**
   * A repository holding `committed`, with `working` written over it after the
   * commit. An empty string in `working` deletes the file.
   */
  function repository(
    committed: Record<string, string>,
    working: Record<string, string> = {},
  ): string {
    const root = mkdtempSync(join(tmpdir(), 'prettier-formatting-'));
    fixtures.push(root);

    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: root, stdio: 'ignore' });

    git('init', '--initial-branch=main');
    git('config', 'user.email', 'fixture@example.com');
    git('config', 'user.name', 'Fixture');
    // A signing key the runner does not have fails the commit, and the
    // developer running this may have commit.gpgsign on globally.
    git('config', 'commit.gpgsign', 'false');

    for (const [path, contents] of Object.entries(committed)) {
      const file = join(root, path);
      mkdirSync(join(file, '..'), { recursive: true });
      writeFileSync(file, contents);
    }

    git('add', '-A');
    git('commit', '-m', 'fixture');

    for (const [path, contents] of Object.entries(working)) {
      const file = join(root, path);
      if (contents === '') {
        rmSync(file);
        continue;
      }
      mkdirSync(join(file, '..'), { recursive: true });
      writeFileSync(file, contents);
    }

    return root;
  }

  it('holds a committed file', () => {
    expect(workingTreeFiles(repository({ 'a.ts': 'a\n' }))).toEqual(['a.ts']);
  });

  /**
   * The state the check is read in. Every file a branch adds is untracked while
   * its author runs the verification command, so a list read off the index
   * answers about none of them.
   */
  it('holds a file that is written and not committed', () => {
    const root = repository({ 'a.ts': 'a\n' }, { 'b.ts': 'b\n' });

    expect(workingTreeFiles(root)).toEqual(['a.ts', 'b.ts']);
  });

  it('holds a file added to the index and not committed', () => {
    const root = repository({ 'a.ts': 'a\n' }, { 'b.ts': 'b\n' });

    execFileSync('git', ['add', 'b.ts'], { cwd: root, stdio: 'ignore' });

    expect(workingTreeFiles(root)).toEqual(['a.ts', 'b.ts']);
  });

  /** `--exclude-standard` is where the CLI's `.gitignore` reading lands. */
  it('leaves out a file .gitignore covers', () => {
    const root = repository(
      { '.gitignore': 'dist\n' },
      { 'dist/bundle.js': 'x\n' },
    );

    expect(workingTreeFiles(root)).toEqual(['.gitignore']);
  });

  /** Prettier walks the disk, so a path only the index holds would throw. */
  it('leaves out a tracked file the working tree no longer has', () => {
    const root = repository({ 'a.ts': 'a\n', 'b.ts': 'b\n' }, { 'b.ts': '' });

    expect(workingTreeFiles(root)).toEqual(['a.ts']);
  });

  it('reads a file inside a directory', () => {
    const root = repository({ 'src/a.ts': 'a\n' }, { 'src/b.ts': 'b\n' });

    expect(workingTreeFiles(root)).toEqual(['src/a.ts', 'src/b.ts']);
  });
});
