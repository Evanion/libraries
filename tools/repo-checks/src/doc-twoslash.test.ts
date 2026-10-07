import { existsSync, globSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative as relativeTo } from 'node:path';

import { createProjectGraphAsync, parseJson, workspaceRoot } from '@nx/devkit';
import { findMatchingProjects } from 'nx/src/devkit-internals';
import { createTwoslasher } from 'twoslash';
import { describe, expect, it } from 'vitest';

import { MARKDOWN_SOURCES } from '@evanion/doc-examples/examples-file';
import { expandReferences } from '@evanion/doc-examples/mdx-reference-loader';
import { writesOwnImports } from '@evanion/doc-examples/preamble';
// @ts-expect-error -- plain ESM, imported by next.config.ts under Turbopack.
import { expandRegions } from '@evanion/doc-examples/mdx-region-loader';
import { authoredPages } from './docs-content';

/**
 * A `twoslash` fence in the docs content is compiled by Nextra during
 * `next build`, and a type error in one fails that build. This runs the same
 * compile in `nx test`, for the reason `doc-regions.test.ts` gives: the build
 * is slow and runs late.
 *
 * It also closes the one gap in Twoslash's own checking. `// @errors: 2322`
 * declares which errors a fence is allowed to produce, and Twoslash throws on
 * any error the fence produces that the list does not name. It does not throw
 * on a listed error the fence stopped producing, so a fence asserting a type
 * failure degrades silently into a fence asserting nothing. The second
 * assertion here is the other direction: every code a fence declares must
 * still be produced.
 *
 * Nextra passes no `twoslashOptions`, so a fence compiles against Twoslash's
 * own defaults — `strict`, ESNext module and target — and resolves
 * `@evanion/*` through each package's published `exports`, against the `dist/`
 * its build emits. That is what a reader installing the package gets, and it
 * is why `nx.json` orders the libraries' builds ahead of the docs app's.
 *
 * The same compiler runs over the packages' markdown: the README and the files
 * under `docs/`. A markdown fence reaches the test run through `includeSource`,
 * which executes it and never type-checks it, so a README could assert the
 * result of a call its own package's types refuse and CI stayed green over it.
 * The second describe closes that.
 *
 * A markdown fence compiles where its test run executes it: from the directory
 * of the file holding it, so a relative import reaches the same file the test
 * run imports, and with the package's own ambient declarations, which is how an
 * `.astro` import has a type in `@evanion/astro-widget`'s sources and in its
 * examples.
 */

const FENCE = /^(\s*)(`{3,})(.*)$/;
const ERRORS = /^\s*\/\/\s*@errors:\s*(.+)$/m;
const QUERY = /^\s*\/\/\s*\^\?\s*$/;
const DOCTESTED = /@import\.meta\.vitest/;

interface Fence {
  /** Workspace-relative path, with the line the fence opens on. */
  page: string;
  info: string;
  code: string;
}

/** The fences of one markdown file, and the package they belong to. */
interface FileFences {
  /** Absolute path of the package root, where `src` sits. */
  root: string;
  /** Absolute path of the directory holding the file, which they compile from. */
  dir: string;
  fences: Fence[];
}

/** Every fenced block in one document, closing on a marker of its own width. */
function fencesIn(source: string, page: string): Fence[] {
  const fences: Fence[] = [];
  let open: { ticks: string; info: string; at: number } | null = null;
  let body: string[] = [];

  source.split('\n').forEach((line, index) => {
    const marker = line.match(FENCE);

    if (marker && open === null) {
      open = {
        ticks: marker[2] as string,
        info: (marker[3] as string).trim(),
        at: index + 1,
      };
      body = [];
      return;
    }

    if (open === null) return;

    if (marker && (marker[2] as string).startsWith(open.ticks)) {
      fences.push({
        page: `${page}:${open.at}`,
        info: open.info,
        code: body.join('\n'),
      });
      open = null;
      return;
    }

    body.push(line);
  });

  return fences;
}

const relative = (path: string): string => path.slice(workspaceRoot.length + 1);

/**
 * Every `twoslash` fence, with its references and regions already filled in.
 *
 * Both loaders, in the order `next.config.ts` runs them, because a fence a
 * loader emits is a fence Nextra compiles. A reference entry's signature and
 * example exist nowhere in the page as written, so reading the page as written
 * would leave the compiler's own emissions as the only fences on the site that
 * nothing checks before the build.
 */
function twoslashFences(): Fence[] {
  return authoredPages().flatMap((page) => {
    const source = readFileSync(page, 'utf8');
    const expanded = expandRegions(
      expandReferences(source, workspaceRoot, page),
      workspaceRoot,
      page,
    ) as string;

    return fencesIn(expanded, relative(page)).filter(({ info }) =>
      /\btwoslash\b/.test(info),
    );
  });
}

/**
 * The roots of the packages `nx release` versions, read from `nx.json` the way
 * `docs-navigation.test.ts` reads them, so a new package is covered by adding
 * it to the workspace and nothing else.
 */
async function releasedRoots(): Promise<string[]> {
  const nxJson = parseJson<{ release?: { projects?: string | string[] } }>(
    readFileSync(join(workspaceRoot, 'nx.json'), 'utf-8'),
    { expectComments: true },
  );
  const patterns = nxJson.release?.projects;

  if (!patterns) throw new Error('nx.json must define release.projects');

  const graph = await createProjectGraphAsync({ exitOnError: false });

  return findMatchingProjects(
    Array.isArray(patterns) ? patterns : [patterns],
    graph.nodes,
  ).map((name) => {
    const node = graph.nodes[name];
    if (!node)
      throw new Error(`${name} matched release.projects but is not a node`);
    return node.data.root;
  });
}

/**
 * The markdown fences this compiles: doctested, so their claims already execute
 * and a compile error in one is a documented call the package refuses, and
 * self-contained, so the fence names what it uses.
 *
 * A fence that imports no value continues an earlier fence's context, or the
 * package's preamble, and would fail on symbols it never declares. An
 * `import type` line alone does not make a fence self-contained, for the reason
 * `writesOwnImports` gives. Those fences carry the documentation standard's
 * § 9 exemption and bringing them under a compiler is separate work.
 */
async function markdownFences(): Promise<FileFences[]> {
  const roots = await releasedRoots();

  return roots.flatMap((root) => {
    const packageDir = join(workspaceRoot, root);

    return markdownFiles(packageDir).map((file) => ({
      root: packageDir,
      dir: dirname(file),
      fences: fencesIn(readFileSync(file, 'utf8'), relative(file)).filter(
        ({ info, code }) =>
          ['ts', 'tsx'].includes(info.split(/\s+/)[0] ?? '') &&
          DOCTESTED.test(info) &&
          writesOwnImports(code),
      ),
    }));
  });
}

/**
 * The markdown files whose fences a package's test run executes, by the globs
 * `docExampleSources` hands vitest.
 */
function markdownFiles(packageDir: string): string[] {
  return globSync([...MARKDOWN_SOURCES], { cwd: packageDir })
    .sort()
    .map((entry) => join(packageDir, entry));
}

/**
 * The ambient declarations a package's sources compile with: every `.d.ts`
 * under its `src`, keyed by its path from `dir`, the directory the compiler
 * runs in.
 */
function ambientDeclarations(
  root: string,
  dir: string,
): Record<string, string> {
  const src = join(root, 'src');
  if (!existsSync(src)) return {};

  return Object.fromEntries(
    readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter((entry) => entry.endsWith('.d.ts'))
      .map((entry) => [
        relativeTo(dir, join(src, entry)),
        readFileSync(join(src, entry), 'utf8'),
      ]),
  );
}

/** The markdown fences that did not compile from their file's directory. */
function markdownFailures(files: readonly FileFences[]): string[] {
  return files.flatMap(({ root, dir, fences }) =>
    compileFailures(
      fences,
      createTwoslasher({
        vfsRoot: dir,
        extraFiles: ambientDeclarations(root, dir),
      }),
    ),
  );
}

/** One line per fence that did not compile, or declares an error it lost. */
function compileFailures(
  fences: readonly Fence[],
  twoslasher = createTwoslasher(),
): string[] {
  const failures: string[] = [];

  for (const { page, info, code } of fences) {
    const lang = info.split(/\s+/)[0] === 'tsx' ? 'tsx' : 'ts';
    const declared = (code.match(ERRORS)?.[1] ?? '')
      .split(/\s+/)
      .filter(Boolean);

    let produced: number[];
    try {
      // `error.code` is typed `string | number | undefined`. An absent one
      // becomes NaN and matches no declared code, which is the direction this
      // guard needs: a code that stopped being produced still has to fail.
      produced = twoslasher(code, lang).errors.map((error) =>
        Number(error.code),
      );
    } catch (error) {
      failures.push(`${page} [${info}]: ${(error as Error).message}`);
      continue;
    }

    for (const declaredCode of declared) {
      if (!produced.includes(Number(declaredCode))) {
        failures.push(
          `${page} [${info}]: declares @errors: ${declaredCode}, which the compiler no longer reports`,
        );
      }
    }
  }

  return failures;
}

describe('twoslash fences', () => {
  const fences = twoslashFences();

  it('finds the fences', () => {
    expect(fences.length).toBeGreaterThan(0);
  });

  it('carries only the meta Nextra injects its Popup component for', () => {
    // rehype-twoslash-popup.js matches `node.data.meta === 'twoslash'`, while
    // the transformer triggers on /\btwoslash\b/. A fence between the two
    // renders hover markup and no import for the `Popup` behind it, and MDX
    // throws on the missing component. The fences here are already expanded,
    // so `file=` and `region=` are gone the way Nextra will see them.
    expect(
      fences.filter(
        ({ info }) => info.split(/\s+/).slice(1).join(' ') !== 'twoslash',
      ),
    ).toEqual([]);
  });

  it('ends a fence on its `^?` query', () => {
    // The theme draws a persisted query in a `position: absolute` popup
    // (`.twoslash-popup-container` in nextra-theme-docs' stylesheet), so it
    // covers whatever line follows it rather than pushing it down. Last line,
    // and therefore one query per fence.
    const covered = fences.filter(({ code }) => {
      const lines = code.trimEnd().split('\n');
      return lines.some(
        (line, index) => QUERY.test(line) && index !== lines.length - 1,
      );
    });

    expect(covered.map(({ page, info }) => `${page} [${info}]`)).toEqual([]);
  });

  it('compiles, and still produces every error it declares', () => {
    expect(compileFailures(fences)).toEqual([]);
  });
});

describe('package markdown fences', () => {
  it('finds a doctested fence in more than one package', async () => {
    const packages = new Set(
      (await markdownFences())
        .filter(({ fences }) => fences.length > 0)
        .map(({ root }) => root),
    );
    expect(packages.size).toBeGreaterThan(1);
  });

  it('finds a doctested fence under docs/', async () => {
    expect(
      (await markdownFences()).some(
        ({ root, dir, fences }) => dir !== root && fences.length > 0,
      ),
    ).toBe(true);
  });

  it('compiles', async () => {
    expect(markdownFailures(await markdownFences())).toEqual([]);
  });
});
