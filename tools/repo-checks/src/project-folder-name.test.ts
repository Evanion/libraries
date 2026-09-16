import { createProjectGraphAsync, workspaceRoot } from '@nx/devkit';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { misnamedFolders, unscoped, type Project } from './project-folder-name';

/**
 * The invariant: every project's folder basename is its unscoped package name.
 *
 * `nx.json` decides what is published by directory glob and `docs.yml` decides
 * what deploys by directory glob, so the folder name is how a reader answers both
 * without opening anything. A folder that does not carry the package's name makes
 * every such reading a guess, and the guess is right until it is not.
 *
 * The projects are read from the graph so a package added anywhere is checked
 * without editing this file, and the name is read from `package.json` rather than
 * from the graph's project name, because `package.json` is what npm publishes and
 * what the rule is about.
 */

const graph = createProjectGraphAsync({ exitOnError: false });

/** Every project in the workspace that has a `package.json`, as `[name, root]`. */
const projects: Promise<Project[]> = (async () => {
  const found: Project[] = [];

  for (const node of Object.values((await graph).nodes)) {
    const manifest = join(workspaceRoot, node.data.root, 'package.json');

    if (!existsSync(manifest)) continue;

    const { name } = JSON.parse(readFileSync(manifest, 'utf-8')) as {
      name?: string;
    };

    if (name) found.push({ name, root: node.data.root });
  }

  return found;
})();

describe('every project folder', () => {
  /**
   * A graph that resolved no projects answers the assertion below vacuously,
   * which is a guard that cannot fail.
   */
  it('is checked against a workspace that has its projects', async () => {
    expect((await projects).length).toBeGreaterThan(0);
  });

  it('carries the unscoped name of the package inside it', async () => {
    expect(
      misnamedFolders(await projects).map(
        (project) =>
          `${project.root} holds ${project.name}, so it has to be named ` +
          `${project.expected}`,
      ),
      'Rename the folder, or rename the package. The directory a project sits ' +
        'in is what `nx.json` releases by and what `.github/workflows/docs.yml` ' +
        'deploys by, and neither reads `package.json` to do it.',
    ).toEqual([]);
  });
});

/**
 * The rule itself, against fixtures. The workspace holds the invariant today, so
 * asserting the rule against it asserts nothing about the rule.
 */
describe('the folder name rule', () => {
  function check(projects: readonly Project[]): string[] {
    return misnamedFolders(projects).map((project) => project.root);
  }

  it('passes a scoped package whose folder is its unscoped name', () => {
    expect(check([{ name: '@evanion/luhn', root: 'libs/luhn' }])).toEqual([]);
  });

  it('fails a scoped package in a folder named something else', () => {
    expect(
      check([
        { name: '@evanion/nestjs-correlation-id', root: 'nest/correlation-id' },
      ]),
    ).toEqual(['nest/correlation-id']);
  });

  /** The scope belongs to the directory the project sits in, not to its folder. */
  it('fails a folder that repeats the scope', () => {
    expect(
      check([{ name: '@evanion/luhn', root: 'libs/evanion-luhn' }]),
    ).toEqual(['libs/evanion-luhn']);
  });

  it('passes an unscoped package whose folder is its name', () => {
    expect(check([{ name: 'storefront', root: 'apps/storefront' }])).toEqual(
      [],
    );
  });

  /** The directory a project sits under is what decides publishing, not the name. */
  it('does not care which directory the folder sits under', () => {
    expect(
      check([
        { name: '@evanion/baize-ui', root: 'internal/baize-ui' },
        { name: '@evanion/luhn', root: 'libs/luhn' },
      ]),
    ).toEqual([]);
  });

  it('passes a project at the workspace root', () => {
    expect(check([{ name: 'libraries', root: 'libraries' }])).toEqual([]);
  });

  /** A prefix match is not a match: `widget` and `react-widget` are two packages. */
  it('fails a folder that only shares a name prefix', () => {
    expect(
      check([{ name: '@evanion/react-widget', root: 'libs/widget' }]),
    ).toEqual(['libs/widget']);
  });

  it('reports every mismatch, ordered by root', () => {
    expect(
      check([
        { name: '@evanion/token', root: 'libs/tokens' },
        { name: '@evanion/luhn', root: 'libs/luhn' },
        { name: '@evanion/compose', root: 'libs/composer' },
      ]),
    ).toEqual(['libs/composer', 'libs/tokens']);
  });
});

describe('dropping the scope', () => {
  it('removes a leading @scope/', () => {
    expect(unscoped('@evanion/luhn')).toBe('luhn');
  });

  it('leaves an unscoped name alone', () => {
    expect(unscoped('luhn')).toBe('luhn');
  });

  /** `a/b` without a leading `@` is not a scope, so nothing is dropped. */
  it('leaves a slash that is not a scope alone', () => {
    expect(unscoped('a/b')).toBe('a/b');
  });
});
