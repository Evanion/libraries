import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
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
 */

const CONTENT = join(workspaceRoot, 'apps/docs/content');
const FENCE = /^(\s*)(`{3,})(.*)$/;
const ERRORS = /^\s*\/\/\s*@errors:\s*(.+)$/m;
const QUERY = /^\s*\/\/\s*\^\?\s*$/;

interface Fence {
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

/** Every `twoslash` fence, with its regions already filled in. */
function twoslashFences(): Fence[] {
  const fences: Fence[] = [];

  for (const page of mdxFiles(CONTENT)) {
    const source: string = expandRegions(
      readFileSync(page, 'utf8'),
      workspaceRoot,
      page,
    );

    let open: { ticks: string; info: string } | null = null;
    let body: string[] = [];

    for (const line of source.split('\n')) {
      const marker = line.match(FENCE);

      if (marker && open === null) {
        open = {
          ticks: marker[2] as string,
          info: (marker[3] as string).trim(),
        };
        body = [];
        continue;
      }

      if (
        marker &&
        open !== null &&
        (marker[2] as string).startsWith(open.ticks)
      ) {
        if (/\btwoslash\b/.test(open.info)) {
          fences.push({
            page: page.slice(workspaceRoot.length + 1),
            info: open.info,
            code: body.join('\n'),
          });
        }
        open = null;
        continue;
      }

      if (open !== null) body.push(line);
    }
  }

  return fences;
}

describe('twoslash fences', () => {
  const fences = twoslashFences();
  const twoslasher = createTwoslasher();

  it('finds the fences', () => {
    expect(fences.length).toBeGreaterThan(0);
  });

  it('carries only the meta Nextra injects its Popup component for', () => {
    // rehype-twoslash-popup.js matches `node.data.meta === 'twoslash'`, while
    // the transformer triggers on /\btwoslash\b/. A fence between the two
    // renders hover markup with no component behind it.
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
    const failures: string[] = [];

    for (const { page, info, code } of fences) {
      const lang = info.split(/\s+/)[0] === 'tsx' ? 'tsx' : 'ts';
      const declared = (code.match(ERRORS)?.[1] ?? '')
        .split(/\s+/)
        .filter(Boolean);

      let produced: number[];
      try {
        // `code` is typed `string | number | undefined`. An absent one becomes
        // NaN and matches no declared code, which is the direction this guard
        // needs: a code that stopped being produced still has to fail.
        produced = twoslasher(code, lang).errors.map((error) =>
          Number(error.code),
        );
      } catch (error) {
        failures.push(`${page} [${info}]: ${(error as Error).message}`);
        continue;
      }

      for (const code of declared) {
        if (!produced.includes(Number(code))) {
          failures.push(
            `${page} [${info}]: declares @errors: ${code}, which the compiler no longer reports`,
          );
        }
      }
    }

    expect(failures).toEqual([]);
  });
});
