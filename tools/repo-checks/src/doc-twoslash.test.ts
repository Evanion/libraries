import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { createProjectGraphAsync, parseJson, workspaceRoot } from '@nx/devkit';
import { findMatchingProjects } from 'nx/src/devkit-internals';
import { createTwoslasher } from 'twoslash';
import { describe, expect, it } from 'vitest';

// @ts-expect-error -- plain ESM, imported by next.config.ts under Turbopack.
import { expandRegions } from '@evanion/doc-examples/mdx-region-loader';

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
 * The same compiler runs over the package READMEs. A README fence reaches the
 * test run through `includeSource`, which executes it and never type-checks it,
 * so a README could assert the result of a call its own package's types refuse
 * and CI stayed green over it. The second describe closes that.
 */

const CONTENT = join(workspaceRoot, 'apps/docs/content');
const FENCE = /^(\s*)(`{3,})(.*)$/;
const ERRORS = /^\s*\/\/\s*@errors:\s*(.+)$/m;
const QUERY = /^\s*\/\/\s*\^\?\s*$/;
const DOCTESTED = /@import\.meta\.vitest/;
const SELF_CONTAINED = /^import[\s{]/m;

interface Fence {
  /** Workspace-relative path, with the line the fence opens on. */
  page: string;
  info: string;
  code: string;
}

function mdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return mdxFiles(path);
    return entry.name.endsWith('.mdx') ? [path] : [];
  });
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

/** Every `twoslash` fence, with its regions already filled in. */
function twoslashFences(): Fence[] {
  return mdxFiles(CONTENT).flatMap((page) =>
    fencesIn(
      expandRegions(readFileSync(page, 'utf8'), workspaceRoot, page),
      relative(page),
    ).filter(({ info }) => /\btwoslash\b/.test(info)),
  );
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
 * The README fences this compiles: doctested, so their claims already execute
 * and a compile error in one is a documented call the package refuses, and
 * self-contained, so the fence names what it uses.
 *
 * A fence that imports nothing continues an earlier fence's context and would
 * fail on symbols it never declares. Those carry the documentation standard's
 * § 5 exemption and bringing them under a compiler is separate work.
 */
async function readmeFences(): Promise<Fence[]> {
  const roots = await releasedRoots();

  return roots.flatMap((root) => {
    const readme = join(workspaceRoot, root, 'README.md');
    if (!existsSync(readme)) return [];

    return fencesIn(readFileSync(readme, 'utf8'), relative(readme)).filter(
      ({ info, code }) =>
        ['ts', 'tsx'].includes(info.split(/\s+/)[0] ?? '') &&
        DOCTESTED.test(info) &&
        SELF_CONTAINED.test(code),
    );
  });
}

/** One line per fence that did not compile, or declares an error it lost. */
function compileFailures(fences: readonly Fence[]): string[] {
  const twoslasher = createTwoslasher();
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

describe('package README fences', () => {
  it('finds a doctested fence in more than one package', async () => {
    const fences = await readmeFences();
    expect(fences.length).toBeGreaterThan(0);
    expect(new Set(fences.map(({ page }) => page)).size).toBeGreaterThan(1);
  });

  it('compiles', async () => {
    expect(compileFailures(await readmeFences())).toEqual([]);
  });
});
